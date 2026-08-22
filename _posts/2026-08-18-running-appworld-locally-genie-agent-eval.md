---
layout: post
title: "Running AppWorld Locally for Genie Agent Evals: Docker Compose, MCP, and Things We Wish We Knew Upfront"
date: 2026-08-18 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 50
description: "Run AppWorld locally with Genie: docker-compose, MCP HTTP wiring, health gates, and lessons from replacing custom shims with the official three-server stack."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, benchmarking, appworld, mcp, docker, workflows, orchestration, production]
permalink: /blog/running-appworld-locally-genie-agent-eval/
faqs:
  - question: "What do I need to run AppWorld locally for agent evals?"
    answer: "Three services: environment (:8000) for task init/save/evaluate, APIs (:9000) for mock apps, and MCP HTTP (:10000) for per-app tools. The harness owns /initialize and /evaluate; the agent only calls MCP tools like spotify__login."
  - question: "Can I use the published ghcr.io/stonybrooknlp/appworld Docker image as-is?"
    answer: "Not for MCP. The published latest image is ~2 years old and only serves environment|apis. Rebuild on top of it with appworld[mcp] from current source — same pattern as HiThink GAGE's Dockerfile."
  - question: "Why does appworld install fail after a git clone?"
    answer: "Encrypted app bundles ship via Git LFS. A plain clone leaves pointer files under src/appworld/.source/*.bundle. Run git lfs pull, seed bundles from a PyPI wheel, or build the Docker image with APPWORLD_VERSION=git so the build clones and installs fresh."
  - question: "Does the agent call load_task or evaluate?"
    answer: "No — not via MCP. Official MCP exposes app API tools only ({app}__{method}). Your eval harness must POST /initialize before the agent runs and POST /save + /evaluate after."
  - question: "How do I know the stack is ready before a cohort?"
    answer: "Probe environment and APIs with HTTP GET, then list_tools on MCP (non-empty). We gate cohorts on all three; starting Genie when MCP is down produces confusing tool-missing errors."
---

**Prerequisite for the AppWorld eval series** ([fair evals](/blog/fair-agent-evals-before-performance/) → [orchestration tax](/blog/agent-orchestration-tax-evals/) → [failure modes](/blog/ai-agent-eval-failure-modes/) → [handoff gate](/blog/stop-duplicate-agent-workers-handoff-gate/)): get the benchmark running on your machine before you argue about planner tax or failure modes.

We wired [Genie](https://github.com/stackgenhq/genie) to the official [AppWorld](https://github.com/stonybrooknlp/appworld) [MCP server](https://github.com/stonybrooknlp/appworld#electric_plug-introducing-appworld-mcp-server-and-client) ([paper](https://arxiv.org/abs/2407.18901)) for simple-vs-plan routing evals. This post is the **ops guide** we wanted on day one: Docker Compose, copy-paste snippets, and the traps that burned an afternoon.

![AppWorld local stack: environment, APIs, MCP HTTP](/assets/images/appworld/orchestration-stack.svg)

---

## TL;DR

- **Three servers, three jobs:** environment (`:8000`) = task lifecycle; APIs (`:9000`) = mock apps; MCP HTTP (`:10000`) = tools the agent calls.
- **Published Docker image is not enough:** [ghcr.io/stonybrooknlp/appworld:latest](https://github.com/StonyBrookNLP/appworld/pkgs/container/appworld) predates MCP — extend it like [GAGE does](https://github.com/HiThink-Research/GAGE/blob/83cc359dbb3056ea8f4090f4c398ba2f066231a0/docker/appworld/Dockerfile).
- **Harness owns init/evaluate; agent owns MCP** — do not rebuild `load_task` / `evaluate` shims in your agent runtime.
- **Health gate all three** before starting a cohort — env+apis up without MCP looks fine until every tool call fails.

### Explain like I'm five

AppWorld is a pretend city with fake apps. The **environment** desk hands you today's homework. The **API** buildings are where work happens. **MCP** is the phone book of actions you are allowed to dial. Your robot only uses the phone book — you still have to check homework in and turn it in at the environment desk.

---

## Architecture (one screen)

```text
eval harness                agent (Genie, etc.)
     |                              |
     | POST /initialize             | streamable_http MCP
     v                              v
environment :8000              MCP HTTP :10000/mcp
     |                              |
     |                              | tool calls
     v                              v
              APIs :9000  (mock Spotify, Venmo, phone, …)
     |
     | POST /save, POST /evaluate
     v
        official TGC/SGC judge
```

| Port | Service | You call it for |
|------|---------|-----------------|
| 8000 | [`appworld serve environment`](https://github.com/stonybrooknlp/appworld/blob/main/src/appworld/cli.py) | [`/initialize`](https://github.com/stonybrooknlp/appworld/blob/main/src/appworld/serve/environment.py), `/save`, `/evaluate` |
| 9000 | `appworld serve apis` | Stateful mock HTTP APIs (agent reaches these via MCP) |
| 10000 | [`appworld serve mcp http`](https://github.com/stonybrooknlp/appworld#link-starting-mcp-server) | `list_tools` / `call_tool` — names like `spotify__login` |

Genie prefixes the MCP server name: `spotify__login` → `appworld_spotify__login`.

Upstream documents the full three-server flow for terminal agents in [`guides/evaluating_terminal_agents.md`](https://github.com/stonybrooknlp/appworld/blob/main/guides/evaluating_terminal_agents.md).

---

## Things we wish we knew upfront

### 1. The official Docker image is a base layer, not the full stack

`docker pull ghcr.io/stonybrooknlp/appworld:latest` gives you an older build with `serve environment|apis` only. **No `serve mcp`. No `serve multiple`.** PyPI `appworld` 0.1.3 matches that era.

**Fix:** Reinstall `appworld[mcp]` from current [`stonybrooknlp/appworld`](https://github.com/stonybrooknlp/appworld) main on top of the image — exactly what [GAGE's Dockerfile](https://github.com/HiThink-Research/GAGE/blob/83cc359dbb3056ea8f4090f4c398ba2f066231a0/docker/appworld/Dockerfile) does. The [`serve mcp`](https://github.com/stonybrooknlp/appworld/blob/main/src/appworld/cli.py) subcommand lives in current source, not the published image.

### 2. Git clone ≠ installable AppWorld

[`src/appworld/.source/apps.bundle`](https://github.com/stonybrooknlp/appworld/tree/main/src/appworld/.source) and `tests.bundle` are **encrypted blobs**, often shipped via **Git LFS**. A shallow clone without LFS leaves pointer text files; `appworld install` then fails or unpacks incomplete apps.

```bash
cd /path/to/appworld
git lfs pull
pip install -e ".[mcp]"
appworld install
appworld download data
```

**Workaround without LFS auth:** seed bundles from a PyPI wheel:

```bash
pip download appworld -d /tmp/aw-wheel --no-deps
unzip -o /tmp/aw-wheel/appworld-*.whl 'appworld/.source/*' -d /tmp/aw-whl
cp /tmp/aw-whl/appworld/.source/*.bundle /path/to/appworld/src/appworld/.source/
appworld install
```

### 3. MCP does not expose `load_task` or `evaluate`

Early wiring duplicated upstream with custom tools (`appworld_load_task`, `appworld_call`, `appworld_evaluate`). Official MCP exposes **per-API tools only** (`venmo__like_transaction`, etc.) — see the [MCP server docs](https://github.com/stonybrooknlp/appworld#electric_plug-introducing-appworld-mcp-server-and-client).

Your **harness** must call the [environment HTTP API](https://github.com/stonybrooknlp/appworld/blob/main/src/appworld/serve/environment.py) directly (same contract as [`evaluating_terminal_agents.md`](https://github.com/stonybrooknlp/appworld/blob/main/guides/evaluating_terminal_agents.md#initialize-the-task)):

```bash
# 1. Before agent run
curl -s -X POST http://127.0.0.1:8000/initialize \
  -H 'Content-Type: application/json' \
  -d '{"task_id":"29caf6f_1","remote_apis_url":"http://127.0.0.1:9000","experiment_name":"local"}'

# 2. Agent works via MCP …

# 3. After agent run
curl -s -X POST http://127.0.0.1:8000/save \
  -H 'Content-Type: application/json' \
  -d '{"task_id":"29caf6f_1"}'

curl -s -X POST http://127.0.0.1:8000/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"task_id":"29caf6f_1","suppress_errors":true}'
```

Trust the judge's `success` bit — not assistant prose ([evidence-based verification](/blog/evidence-based-verification/)).

### 4. `serve multiple` races MCP if APIs are not ready

Starting all three in one CLI invocation is correct **when** your installed `appworld` supports it ([`cli.py`](https://github.com/stonybrooknlp/appworld/blob/main/src/appworld/cli.py), [`parallelizing_worlds.md`](https://github.com/stonybrooknlp/appworld/blob/main/guides/parallelizing_worlds.md)):

```bash
appworld serve multiple \
  --environment '' \
  --apis '' \
  --mcp 'http --port 10000' \
  --root "$APPWORLD_ROOT"
```

Upstream's terminal-agent guide uses the same pattern with explicit ports:

```bash
appworld serve multiple \
  --environment "--port 8000" \
  --apis "--port 9000" \
  --mcp "http --port 10000 --output-type content_only" \
  --root "$APPWORLD_ROOT"
```

On older installs, start **apis first**, wait, then environment, then MCP. Our Docker entrypoint falls back to that order automatically.

### 5. Env+apis can look healthy while MCP is dead

We repeatedly hit: `curl :8000` and `:9000` return 200, cohort starts, Genie lists zero MCP tools. **Always gate on MCP `list_tools`** before burning API credits — upstream ships [`scripts/call_mcp_server.py`](https://github.com/stonybrooknlp/appworld/blob/main/scripts/call_mcp_server.py) for exactly this smoke test.

### 6. Do not duplicate `data/` under your agent repo

Point `APPWORLD_ROOT` at one upstream checkout. Task DBs and `api_docs` belong there after [`appworld download data`](https://github.com/stonybrooknlp/appworld/blob/main/src/appworld/cli.py).

### 7. Apple Silicon: pin platform for the base image

The published image is `linux/amd64`. On ARM Macs, set `platform: linux/amd64` in Compose or expect slow emulation — still easier than fighting pydantic/bundle mismatches on a half-installed editable checkout.

---

## Docker Compose (recommended path)

Requires **Docker BuildKit** (`DOCKER_BUILDKIT=1`) for `additional_contexts`.

### `docker-compose.yml`

```yaml
services:
  appworld:
    platform: linux/amd64
    build:
      context: ${GENIE_APPWORLD_ROUTING:?set to examples/appworld-routing}
      dockerfile: docker/Dockerfile
      additional_contexts:
        appworld: ${APPWORLD_ROOT:?set to stonybrooknlp/appworld checkout}
      args:
        APPWORLD_VERSION: ${APPWORLD_VERSION:-git}
        APPWORLD_GIT_REF: ${APPWORLD_GIT_REF:-main}
        APPWORLD_ENV_PORT: ${APPWORLD_ENV_PORT:-8000}
        APPWORLD_APIS_PORT: ${APPWORLD_APIS_PORT:-9000}
        APPWORLD_MCP_PORT: ${APPWORLD_MCP_PORT:-10000}
    image: genie-appworld-stack:latest
    container_name: genie-appworld-stack
    ports:
      - "8000:8000"
      - "9000:9000"
      - "10000:10000"
    volumes:
      - ${APPWORLD_ROOT}/data:/run/data:rw
      - ${APPWORLD_ROOT}/experiments/outputs:/run/experiments/outputs:rw
    restart: unless-stopped
```

### `docker/Dockerfile` (extends official image)

```dockerfile
# syntax=docker/dockerfile:1
ARG APPWORLD_PLATFORM=linux/amd64
FROM --platform=${APPWORLD_PLATFORM} ghcr.io/stonybrooknlp/appworld:latest

WORKDIR /run
ENV APPWORLD_ROOT=/run

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc python3-dev build-essential git && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

ARG APPWORLD_VERSION=git
ARG APPWORLD_GIT_REF=main
COPY --from=appworld . /tmp/appworld-src

RUN if [ "${APPWORLD_VERSION}" = "git" ]; then \
        git clone --depth 1 --branch "${APPWORLD_GIT_REF}" \
          https://github.com/stonybrooknlp/appworld.git /tmp/appworld-src && \
        cd /tmp/appworld-src && pip install --no-cache-dir --upgrade ".[mcp]"; \
    elif [ "${APPWORLD_VERSION}" = "source" ]; then \
        cd /tmp/appworld-src && pip install --no-cache-dir --upgrade ".[mcp]"; \
    else \
        pip install --no-cache-dir --upgrade "appworld[mcp]"; \
    fi && \
    pip install --no-cache-dir --upgrade "typer==0.16.0" "click==8.1.7"

RUN appworld install && appworld download data

COPY docker/entrypoint.sh /usr/local/bin/appworld-stack-entrypoint.sh
RUN chmod +x /usr/local/bin/appworld-stack-entrypoint.sh

EXPOSE 8000 9000 10000
ENTRYPOINT ["/usr/local/bin/appworld-stack-entrypoint.sh"]
```

GAGE also pins `typer`/`click` — without that, `serve multiple` flags can disagree between the base image and your reinstall.

### Start and stop

```bash
export APPWORLD_ROOT=/path/to/stonybrooknlp/appworld
export GENIE_APPWORLD_ROUTING=/path/to/genie/examples/appworld-routing

# Build + run
DOCKER_BUILDKIT=1 docker compose -p genie-appworld up -d --build

# Or use the helper script in the Genie example
USE_DOCKER=1 ./scripts/appworld_stack.sh

# Stop
docker compose -p genie-appworld down
```

After `git lfs pull` on your checkout, prefer a source build:

```bash
APPWORLD_VERSION=source USE_DOCKER=1 ./scripts/appworld_stack.sh
```

---

## Local stack (no Docker)

When Docker is overkill, use **two Python environments**:

| Venv | Purpose |
|------|---------|
| `.venv-appworld-stack` | PyPI `appworld` — reliable **env + apis** |
| `.venv-appworld` | Editable [`stonybrooknlp/appworld[mcp]`](https://github.com/stonybrooknlp/appworld) — **MCP HTTP** |

```bash
# One-time setup
python3.11 -m venv .venv-appworld-stack
.venv-appworld-stack/bin/pip install appworld
cd "$APPWORLD_ROOT" && ../.venv-appworld-stack/bin/appworld install
../.venv-appworld-stack/bin/appworld download data

python3.11 -m venv .venv-appworld
.venv-appworld/bin/pip install -e "/path/to/stonybrooknlp/appworld[mcp]"
# … bundles + appworld install as above …
```

Start scripts (simplified; matches [upstream MCP HTTP docs](https://github.com/stonybrooknlp/appworld#http-mode)):

```bash
export APPWORLD_ROOT=/path/to/stonybrooknlp/appworld

.venv-appworld-stack/bin/appworld serve apis --no-show-usage --port 9000 --root "$APPWORLD_ROOT" &
sleep 2
.venv-appworld-stack/bin/appworld serve environment --no-show-usage --port 8000 --root "$APPWORLD_ROOT" &
sleep 2
.venv-appworld/bin/appworld serve mcp http \
  --remote-apis-url http://127.0.0.1:9000 \
  --port 10000 \
  --root "$APPWORLD_ROOT" &
```

---

## Health gate (run before every cohort)

```bash
# Environment + APIs
curl -sf http://127.0.0.1:8000/ >/dev/null && echo "environment OK"
curl -sf http://127.0.0.1:9000/ >/dev/null && echo "apis OK"

# MCP — must return a non-empty tool list (upstream: scripts/call_mcp_server.py)
python3 scripts/call_mcp_server.py \
  --remote-apis-url http://127.0.0.1:9000 \
  --remote-mcp-url http://127.0.0.1:10000
```

Optional stronger check from upstream:

```bash
appworld verify tasks \
  --remote-apis-url http://127.0.0.1:9000 \
  --remote-mcp-url http://127.0.0.1:10000
```

---

## Wire your agent (Genie example)

Point MCP at HTTP transport — not a custom stdio shim:

```toml
[[mcp.servers]]
name = "appworld"
transport = "streamable_http"
server_url = "${APPWORLD_MCP_URL}"
timeout = "180s"
```

```bash
export APPWORLD_MCP_URL=http://127.0.0.1:10000/mcp
```

Run a single-task smoke cohort:

```bash
./scripts/wait_for_appworld.sh
LIMIT=1 COHORT_PATH=tasks/plan_fit_5.json python3 scripts/run_decision_cohort.py
```

The harness initializes each task, streams the agent, then saves and evaluates — judge fields land in `results.jsonl`.

---

## Split topology when MCP won't build in-container

If your image only has env+apis (MCP install failed bundle check), run **hybrid**:

| Component | Where |
|-----------|--------|
| environment + apis | Docker container on `:8000` / `:9000` |
| MCP HTTP | Host `.venv-appworld` on `:10000` → `remote-apis-url http://127.0.0.1:9000` |

This unblocks harness and judge work while you fix LFS/bundles for a single-container setup.

---

## Monday-morning checklist

1. `APPWORLD_ROOT` has `data/` from `appworld download data` (once).
2. Bundles under [`.source/`](https://github.com/stonybrooknlp/appworld/tree/main/src/appworld/.source) are real files, not LFS pointers.
3. All three ports respond; MCP `list_tools` is non-empty.
4. Harness calls `/initialize` before the agent and `/evaluate` after — agent never does.
5. Agent config uses official `{app}__{method}` tools, not invented `list_notes` REST names ([failure modes](/blog/ai-agent-eval-failure-modes/)).
6. Cohort refuses to start if the stack is down — fail fast beats debugging hallucinated tool errors.

---

## What's next

With the stack up, run the eval series: [fair tool parity](/blog/fair-agent-evals-before-performance/) → [orchestration tax](/blog/agent-orchestration-tax-evals/) → [failure taxonomy](/blog/ai-agent-eval-failure-modes/) → [handoff gate](/blog/stop-duplicate-agent-workers-handoff-gate/).

**AppWorld codebase**

- [Repository](https://github.com/stonybrooknlp/appworld)
- [MCP server docs](https://github.com/stonybrooknlp/appworld#electric_plug-introducing-appworld-mcp-server-and-client) · [`scripts/call_mcp_server.py`](https://github.com/stonybrooknlp/appworld/blob/main/scripts/call_mcp_server.py)
- [`src/appworld/cli.py`](https://github.com/stonybrooknlp/appworld/blob/main/src/appworld/cli.py) — `serve environment|apis|mcp|multiple`
- [`src/appworld/serve/environment.py`](https://github.com/stonybrooknlp/appworld/blob/main/src/appworld/serve/environment.py) — `/initialize`, `/save`, `/evaluate`
- [`guides/evaluating_terminal_agents.md`](https://github.com/stonybrooknlp/appworld/blob/main/guides/evaluating_terminal_agents.md) — three-server terminal eval walkthrough
- [`guides/parallelizing_worlds.md`](https://github.com/stonybrooknlp/appworld/blob/main/guides/parallelizing_worlds.md) — `serve multiple` and parallel environments
- [`src/appworld/.source/`](https://github.com/stonybrooknlp/appworld/tree/main/src/appworld/.source) — encrypted app bundles (Git LFS)
- [Official container package](https://github.com/StonyBrookNLP/appworld/pkgs/container/appworld) — base image only; extend for MCP

**Our wiring**

- [GAGE AppWorld Dockerfile](https://github.com/HiThink-Research/GAGE/blob/83cc359dbb3056ea8f4090f4c398ba2f066231a0/docker/appworld/Dockerfile) — extend-base-image pattern we copied
- [Genie `appworld-routing` example](https://github.com/stackgenhq/genie/tree/main/examples/appworld-routing) — harness, compose, and stack scripts

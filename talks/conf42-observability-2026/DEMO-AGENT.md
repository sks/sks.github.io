# Demo agent pack (kinded YAML)

Local Conf42 recording pack — apply from this talk folder, run a synthetic symptom, export a **conversation debug zip**.

Requires **stackgen / stackgen-beta ≥ v0.82.0-rc.1** with `ai apply` / `ai run`. Auth: `stackgen configure` or `STACKGEN_URL` + `STACKGEN_TOKEN` (local Guild or dogfood).

Kinded YAML reference (upstream): [Kinded YAML apply](https://appcd-dev.github.io/solutions/ai-apply/)

## What this pack wires

| Kind | Name | Role |
|------|------|------|
| Agent | `obs-signal-investigator` | Synthetic symptom → ≥3 `note` calls + `load_skill` |
| Agent | `obs-handoff-summarizer` | Investigate output → support handoff note |
| Skill | `obs-debug-checklist` | SOP: identity, tool trail, honest gaps |
| Workflow | `obs-debug-zip-demo` | Two stages (`symptom` input) — multi-execution conversation |

Manifest: [`obs-debug-zip.yaml`](./obs-debug-zip.yaml) in this directory.

**No integrations** — only built-in `note` and `load_skill`.

## Apply and run

```bash
cd talks/conf42-observability-2026

stackgen ai apply -f obs-debug-zip.yaml --dry-run
stackgen ai apply -f obs-debug-zip.yaml --approve

stackgen ai run workflow/obs-debug-zip-demo \
  --input 'symptom=p95 latency on checkout API spiked 4x for 12 minutes; APM green, no 5xx'
```

Inspect / cleanup:

```bash
stackgen ai get agent/obs-signal-investigator
stackgen ai get workflow/obs-debug-zip-demo
stackgen ai delete workflow/obs-debug-zip-demo
stackgen ai delete skill/obs-debug-checklist
stackgen ai delete agent/obs-handoff-summarizer
stackgen ai delete agent/obs-signal-investigator
```

## Download the debug zip (Segment B)

1. Wait until both workflow stages finish.
2. In the Aiden UI: **Activity** / **Sessions** → conversation for `obs-debug-zip-demo`.
3. Enable export once per browser, then reload:

   ```js
   localStorage.setItem("stackgen.execution.debugExport", "1")
   ```

4. Click **Export conversation debug zip**.
5. Unzip and check:

   | File | Talk use |
   |------|----------|
   | `manifest.json` | export metadata + `guild_version` |
   | `execution.json` | Langfuse DAG / watch payload |
   | `subscribe-events.ndjson` | SSE replay |
   | `judge-report.json` | optional rubric |

6. Optional Segment A: open the same run in Langfuse — stage → LLM → `note` / `load_skill`.

### Alternate: chat the investigator alone

Apply the manifest, chat with **`obs-signal-investigator`**, paste the symptom, export that conversation. Workflow is better for the talk (two stages → one zip).

## Talk track (~5 min)

1. Show `obs-debug-zip.yaml` — Agents, Skill, Workflow; no Terraform, no cloud keys.
2. Dry-run → apply → run with the latency symptom.
3. Call out multiple `note` calls + skill load.
4. Enable debug export → download zip.
5. Unpack — what support gets when an investigation went wrong.

## Reset

`delete -f` only accepts a **one-document** YAML file. This pack is multi-doc, so delete by kind/name:

```bash
stackgen ai delete workflow/obs-debug-zip-demo
stackgen ai delete skill/obs-debug-checklist
stackgen ai delete agent/obs-handoff-summarizer
stackgen ai delete agent/obs-signal-investigator
```

(Workflow first so nothing still references the agents/skill.)

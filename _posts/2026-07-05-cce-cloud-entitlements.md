---
layout: post
title: "You Vibe-Coded the AWS Calls — Do You Know What IAM Permissions You Actually Need?"
date: 2026-07-05 11:00:00 -0700
description: "Install CCE with Homebrew or GitHub Actions, scan real open-source code, and turn SDK usage into an IAM action list — before your Cursor-generated Route 53 client hits production."
tags: [cce, aws, iam, security, devops, ai-coding, go, github-actions]
---

You asked the IDE for "sync Kubernetes services to Route 53." It wrote the Go code. Tests pass. The PR looks fine.

Nobody listed the IAM permissions.

In July 2026, that gap is normal. Cursor, Antigravity, Copilot, and agentic workflows ship **features** faster than humans ship **least-privilege policies**. The model knows `route53.NewFromConfig`. It does not know your org's IAM naming convention, your SCP boundaries, or whether `ChangeResourceRecordSets` on `*` is a career-limiting move.

**CCE (Code Context Engine)** is a small CLI that reads your source tree and answers a concrete question:

> *Which cloud API operations does this code actually call?*

You can install it with Homebrew — no Go toolchain required:

```bash
brew install stackgenhq/homebrew-stackgen/cce
```

Formula and binaries are published by [StackGen](https://github.com/stackgenhq/homebrew-stackgen/blob/main/cce.rb) (`v0.0.5` as of this writing), with builds for macOS (Intel + Apple Silicon) and Linux (amd64 + arm64). For CI, use the [GitHub Action](#github-actions-recommended-for-ci) — it runs the same CLI from [`ghcr.io/stackgenhq/cce`](https://github.com/stackgenhq/homebrew-stackgen/pkgs/container/cce).

This post walks through **one real repo** and shows what different roles on your team should do with the output.

---

## Why this matters for AI-assisted cloud code

| What the IDE optimizes for | What production still requires |
|----------------------------|--------------------------------|
| Code that compiles | IAM that matches *actual* SDK usage |
| Happy-path examples | Audit evidence for security review |
| Fast iteration | Drift detection when someone adds a new AWS client |

CCE does not replace security review. It gives you a **machine-readable entitlement list** derived from static analysis — the same facts you'd otherwise reconstruct by hand with `grep`, code review, and guesswork.

Think of it as a guardrail for high-velocity teams: the IDE keeps shipping features; CCE keeps the permission conversation grounded in what the code actually calls.

---

## Who this is for (four personas)

### Developers

You merged AI-assisted AWS SDK code and you're not sure if you need `route53:*` or three specific actions. Run CCE locally before you open the "please fix my IAM" ticket. Paste the JSON into your PR description so reviewers see *intent*, not just diffs.

### DevOps / platform engineers

You own Terraform modules and IRSA roles. CCE tells you what the **application** calls; your IaC declares what the **role** allows. Diff those two and you catch over-provision (`*` policies "just in case") and under-provision (app calls `sts:AssumeRole` but the role can't). Drop [`sks/cce-action`](https://github.com/sks/cce-action) into your pipeline — same ergonomics as `actions/checkout`.

### SREs

Incident or change review: "Did this deploy introduce new cloud APIs?" Scan before and after; `cce diff` flags **new** entitlements. Pair that with your change calendar instead of discovering `AccessDenied` in prod at 2 a.m.

### Engineering managers

You don't need to read Go. Ask for a CCE report in the release artifact — entitlement count, top services, derived action list — the same way you ask for test coverage. It's a cheap gate between "AI helped us ship" and "we know what we shipped."

---

## Example: [external-dns](https://github.com/kubernetes-sigs/external-dns)

**Why this repo?** [kubernetes-sigs/external-dns](https://github.com/kubernetes-sigs/external-dns) is a well-known Kubernetes add-on (~9k stars, actively maintained). It syncs Services and Ingresses to DNS providers. The AWS provider is a small, readable Go package — not a megarepo, not a test fixture — and it uses **AWS SDK for Go v2** for Route 53 and STS role assumption.

Real production software, clear cloud surface, easy to clone and scan.

### 1. Clone and scan

```bash
git clone --depth 1 https://github.com/kubernetes-sigs/external-dns.git
cd external-dns

cce --folder provider/aws \
  --language GO \
  --filter cloud \
  --format json \
  --output external-dns-aws.json
```

CCE walks `provider/aws`, parses Go with tree-sitter, and maps SDK call sites to `(provider, resource, operation)` tuples — e.g. Route 53 list/change operations and STS assume-role wiring used for cross-account credentials.

Human-readable summary:

```bash
cce --folder provider/aws --language GO --filter cloud --format text
```

### 2. Extract the IAM action list

The scan JSON is the source of truth. Each entitlement row is a `(provider, resource, operation)` tuple. For AWS IAM, combine `resource` and `operation` into action strings (`route53:ListHostedZones`, `sts:AssumeRole`, …):

```bash
jq -r '.entitlements[]
  | select(.provider == "AWS")
  | "\(.resource):\(.operation)"' external-dns-aws.json | sort -u
```

That sorted list is what you wire into Terraform, IRSA trust policies, or your internal policy generator. **CCE gives you the Action array from static analysis** — resource ARNs and condition keys stay in your IaC workflow where they belong.

Wire it into a minimal policy skeleton yourself, or let your platform team's existing tooling consume the tuple list directly:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["route53:ListHostedZones", "route53:ChangeResourceRecordSets", "sts:AssumeRole"],
    "Resource": ["arn:aws:route53:::hostedzone/YOUR_ZONE_ID"]
  }]
}
```

Replace the `Action` values with your `jq` output; scope `Resource` to real ARNs in Terraform — never ship `Resource: "*"` because a blog post showed you a shortcut.

**This is a draft input**, not a signed-off production policy. It answers "what APIs does the code touch?" so your platform team can scope IAM correctly.

### 3. Optional: preview what will be scanned

Large monorepo? Dry-run the file list first:

```bash
cce plan --folder provider/aws
```

CCE honors `.gitignore` by default — it skips `vendor/` and noise so you scan application source, not dependencies.

### 4. Optional: CI gate on new permissions (local)

On a feature branch:

```bash
cce --folder provider/aws --language GO --filter cloud \
  --format json --output after.json

cce diff baseline.json after.json --fail-new
```

If a PR adds a new DynamoDB client in `registry/dynamodb`, the diff fails until someone acknowledges the new cloud surface — useful when agents keep "helpfully" adding SDK imports.

For production pipelines, use GitHub Actions instead of shell-installing CCE on every runner (see below).

---

## GitHub Actions (recommended for CI)

Add CCE to an existing workflow with [`sks/cce-action`](https://github.com/sks/cce-action) (`@v1.2.1`). The action pulls [`ghcr.io/stackgenhq/cce`](https://github.com/stackgenhq/homebrew-stackgen/pkgs/container/cce) — no Homebrew, no tarball extract on the runner.

### Basic scan on every PR

Save as `.github/workflows/cce-scan.yml`:

```yaml
name: Cloud entitlements

on:
  pull_request:
  push:
    branches: [main]

jobs:
  cce:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: sks/cce-action@v1.2.1
        with:
          folder: provider/aws
          language: GO
          filter: cloud
          output: cce-report.json
```

The step uploads `cce-report.json` as a workflow artifact and sets `entitlement-count` for downstream jobs.

### PR gate: fail on new cloud APIs

For a repo like external-dns, scan `main` as baseline, then diff the PR branch:

```yaml
name: CCE PR gate

on:
  pull_request:
    branches: [main]

jobs:
  entitlements:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: main
          path: baseline-tree

      - uses: sks/cce-action@v1.2.1
        with:
          folder: baseline-tree/provider/aws
          language: GO
          output: baseline.json
          upload-artifact: false

      - uses: actions/checkout@v4

      - uses: sks/cce-action@v1.2.1
        with:
          folder: provider/aws
          language: GO
          output: pr.json
          baseline: baseline.json
          fail-on-new: true
```

If the PR introduces a new SDK call (say, an agent adds a DynamoDB client), the second step fails until someone reviews the new entitlements.

### Enterprise: custom lenses in CI

Platform teams with internal IDP lenses can pass a pinned HTTPS `mapper-file` (see the [enterprise lenses guide](https://github.com/appcd-dev/cce/blob/main/docs/guides/enterprise-lenses-and-catalogs.md)):

```yaml
- uses: sks/cce-action@v1.2.1
  with:
    folder: .
    language: AUTO
    filter: all
    mapper-file: https://artifacts.corp.example/cce/lenses/idp/v1.2.0/idp_lenses.yaml
    output: idp-inventory.json
```

Recipe packs (`mode: run`, `pack: modernization-pack`, `remote: true`) and self-hosted catalogs are supported too — see the [action README](https://github.com/sks/cce-action#recipe-packs-and-catalogs-path-b).

### Reading GitHub Actions output

A green CCE step in Actions means the container ran and (if configured) the diff gate passed. Here is how to read what you get back.

**1. Step log (quick sanity check)**

After `Pulling CCE container ghcr.io/stackgenhq/cce:0.0.5`, look for:

```text
Entitlements found: 11
```

That number is `summary.total_entitlements` from the scan JSON. For a basic `filter: cloud` scan of external-dns `provider/aws`, **11** is expected (Route 53 + STS call sites). If you see **0**, check `folder`, `language`, or whether the path is mounted correctly in Docker.

The [cce-action CI run](https://github.com/sks/cce-action/actions/runs/28751246690) exercises three jobs:

| Job | What it proves | Typical `Entitlements found` |
|-----|----------------|------------------------------|
| `external-dns` | Basic scan + `cce diff --fail-new` smoke | **11** |
| `modernization-pack` | `mode: run` with public recipe pack | **33** (see below) |
| `custom-lens-url` | Remote `mapper-file` lens + built-in cloud fill | **≥ 11** |

**Why 33 in the modernization-pack job?** That job runs `pack: modernization-pack`, which merges cloud entitlements, SDK uplift, and tech-debt recipes in one parse. SDK uplift maps the same call sites under both `AWS` and `AWS_V2` providers, so the count is higher than a plain cloud scan — not a bug. Use `mode: scan` + `filter: cloud` when you only want IAM-oriented tuples for a single provider namespace.

**2. Step outputs (for downstream jobs)**

| Output | Example | Use |
|--------|---------|-----|
| `report-path` | `external-dns.json` | Path to the JSON file in the workspace |
| `entitlement-count` | `11` | Fail a job if count jumps (`if: steps.cce.outputs.entitlement-count > 20`) |
| `diff-path` | `cce-diff.json` | Set when `baseline` is provided |

```yaml
- id: cce
  uses: sks/cce-action@v1.2.1
  with:
    folder: provider/aws
    language: GO

- run: echo "Found ${{ steps.cce.outputs.entitlement-count }} entitlements"
```

**3. Workflow artifacts**

By default the action uploads a **`cce-entitlements`** artifact containing the scan JSON. In the Actions run → **Artifacts** → download and open the file.

Top-level shape:

```json
{
  "files_scanned": 9,
  "entitlements": [ … ],
  "summary": {
    "total_entitlements": 11,
    "by_provider": { "AWS": 11 }
  }
}
```

Each `entitlements[]` row is one mapped call site:

| Field | Meaning |
|-------|---------|
| `provider` | Cloud or custom provider (`AWS`, `PLATFORM`, …) |
| `resource` | Service id for IAM (`route53`, `sts`, `s3`, …) |
| `operation` | API operation (`ListHostedZones`, `AssumeRole`, …) |
| `file`, `line`, `column` | Where in source the call lives |
| `method`, `signature` | Fully-qualified SDK method and call shape |

Derive IAM actions: `"${resource}:${operation}"` (e.g. `route53:ListHostedZones`). Group and dedupe across rows — one policy statement can list many actions.

**4. Diff report (PR gate)**

When `baseline` is set, a second file `cce-diff.json` (or your `diff-output` name) is written. Same tree → no drift:

```json
{
  "baseline_total": 11,
  "current_total": 11,
  "added": null,
  "removed": null,
  "provider_delta": { "AWS": 0 }
}
```

A PR that adds a new SDK import shows rows in **`added`** — that is what triggers `--fail-new`. Review each added row: new `resource`/`operation` means new IAM surface.

**5. Structured logs inside the container**

CCE also prints JSON logs to stderr (`mapping summary`, `files_scanned`, `mapped_calls`). These are useful for debugging lens prefix mismatches; the **artifact JSON** is what you attach to PRs and feed into IaC tooling.

---

## Reading the output (local CLI)

The same JSON shape applies when you run CCE with Homebrew or Docker locally. After:

```bash
cce --folder provider/aws --language GO --filter cloud --format json --output report.json
```

start with `jq '.summary' report.json`, then inspect call sites:

```bash
jq -r '.entitlements[] | "\(.file):\(.line) \(.resource):\(.operation)"' report.json | sort -u
```

Use that list in a PR comment, a security review ticket, or as input to your Terraform/IRSA module — the Action artifact is the same file, produced in CI instead of on your laptop.

---

On `provider/aws`, CCE focuses on **application-level AWS usage**, not every file in the monorepo. Typical findings for external-dns:

| AWS area | Why it shows up |
|----------|-----------------|
| **route53** | Listing hosted zones, record sets, applying change batches |
| **sts** | Assume-role credential chain for cross-account Route 53 |

If you also run the DynamoDB registry backend:

```bash
cce --folder registry/dynamodb --language GO --filter cloud \
  --format json --output external-dns-dynamodb.json
```

…you'll see **dynamodb** operations used for the optional registry — a second IAM story worth a separate role or policy attachment.

There is **no S3** in the AWS provider package; don't paste an S3-heavy policy on this workload because a template said so.

---

## How this fits your workflow (not another dashboard)

| Step | What happens |
|------|----------------|
| **1. Code** | IDE or agent writes AWS SDK calls |
| **2. Scan** | `cce --format json` → entitlements file (`provider`, `resource`, `operation`) |
| **3. Actions** | Extract IAM action strings; scope resources in Terraform / IRSA |
| **4. Gate** | `sks/cce-action` with `baseline` + `fail-on-new` blocks PRs that add cloud surface without review |

The IDE will keep getting better at *writing* cloud code. Nobody is betting the company on the IDE knowing your AWS Organizations layout. CCE is the static half of the loop: **code → entitlements → policy conversation**.

---

## Install reference

**Local (macOS / Linux):**

```bash
brew tap stackgenhq/homebrew-stackgen
brew install stackgenhq/homebrew-stackgen/cce
cce --help
```

**CI (GitHub Actions):**

```yaml
- uses: sks/cce-action@v1.2.1
  with:
    folder: provider/aws
    language: GO
```

**Container (same image the action uses):**

```bash
docker pull ghcr.io/stackgenhq/cce:0.0.5
docker run --rm -v "$PWD:$PWD" -w "$PWD" ghcr.io/stackgenhq/cce:0.0.5 \
  -folder provider/aws -language GO -filter cloud -format json -output report.json
```

Docs and recipes: [appcd-dev.github.io/cce](https://appcd-dev.github.io/cce/) · Action: [github.com/sks/cce-action](https://github.com/sks/cce-action)

---

## Closing thought

AI-assisted development lowered the cost of **adding** cloud integrations. It did not lower the cost of **proving** you only requested the permissions you need. A five-minute CCE scan on `provider/aws` before merge is cheaper than a security review round-trip — and cheaper than prod discovering your new Route 53 client can't assume the role you never updated.

The public CCE CLI handles fast, local entitlement extraction. Scaling that across an entire org — multi-cloud lens packs in corporate CI/CD, centralized governance, runtime alignment — is what [StackGen](https://cloud.stackgen.com) extends. Questions about enterprise rollout: **sales@stackgen.com**.

---

*Sabith builds production AI and cloud governance systems in Go. More notes on [agents, Terraform, and defense-in-depth](/blog/defense-in-depth/) on this blog.*

---
layout: post
title: "You Vibe-Coded the AWS Calls — Do You Know What IAM Permissions You Actually Need?"
date: 2026-07-05 11:00:00 -0700
description: "The complete CCE guide — what Code Context Engine solves, how to install and run it (CLI, Docker, GitHub Actions), recipes, lenses, and reading scan output."
image: /assets/images/og-governance.png
tags: [cce, aws, iam, security, devops, ai-coding, go, github-actions]
---

You asked the IDE for "sync Kubernetes services to Route 53." It wrote the Go code. Tests pass. The PR looks fine.

Nobody listed the IAM permissions.

**CCE (Code Context Engine)** is a static-analysis CLI that reads your source tree and answers:

> *Which cloud API operations does this code actually call?*

This post is the **one-stop guide** — what CCE solves, how to run it locally and in CI, and how to read the output. Deeper reference lives at [appcd-dev.github.io/cce](https://appcd-dev.github.io/cce/).

**On this page:** [What it solves](#what-cce-solves) · [What it is not](#what-cce-is-not) · [Concepts](#core-concepts) · [Install](#install) · [CLI cheat sheet](#cli-cheat-sheet) · [Personas](#who-its-for) · [Worked example](#worked-example-external-dns) · [Recipes & packs](#recipes-and-packs) · [Enterprise lenses](#enterprise-lenses-and-catalogs) · [GitHub Actions](#github-actions) · [Reading output](#reading-the-output) · [Resources](#resources)

---

## What CCE solves

CCE is **read-only inventory**: it maps SDK and library call sites to structured tuples `(provider, resource, operation)` using tree-sitter. It does not rewrite code, execute your app, or parse Terraform.

| Problem | How CCE helps |
|---------|----------------|
| **IAM / least privilege** | Derive the `Action` list your code needs before opening a platform ticket |
| **AI-assisted cloud code** | Ground permission reviews in static facts, not guesswork or `route53:*` templates |
| **PR drift** | `cce diff --fail-new` fails CI when a branch adds new cloud APIs |
| **SDK modernization** | `sdk-uplift` recipe labels legacy vs v2 SDK usage in one parse |
| **Tech debt / forbidden libs** | Custom lenses flag deprecated packages (`TECH_DEBT`, `FORBIDDEN`) |
| **CVE reachability** | Lenses tie CVE-affected packages to **call sites** in your repo (f-SBOM style) |
| **Platform golden path** | Detect raw `boto3` / AWS SDK bypassing your internal platform SDK |
| **Audit evidence** | JSON/SARIF reports with file, line, and method for each mapped call |
| **Pre-deploy review** | Attach entitlement reports to change tickets the way you attach test coverage |

CCE does **not** replace security sign-off. It gives reviewers and platform teams a **machine-readable baseline** — the same facts you'd reconstruct with `grep`, code review, and spreadsheets.

In the AI-assisted development era, the IDE optimizes for code that compiles. Production still needs IAM that matches *actual* usage, audit evidence, and drift detection when someone (or an agent) adds a new AWS client. CCE is the guardrail for high-velocity teams.

---

## What CCE is not

Keep expectations aligned:

| Limitation | Detail |
|------------|--------|
| **Static only** | No runtime tracing, reflection, or dynamic plugin dispatch |
| **Source, not IaC** | Does not parse Terraform, CloudFormation, or IAM JSON — diff app code vs IaC externally |
| **Languages** | Go, Java, Python, JavaScript (`.go`, `.java`, `.py`, `.js`/`.jsx`/`.mjs`/`.cjs`) |
| **Polyglot folders** | One language per scan; use `AUTO` or run per language |
| **Facades** | Internal wrappers may hide underlying SDK calls unless you scan the SDK or add lens rules |
| **Effective permissions** | Reports what code *calls*, not what AWS IAM eventually allows after SCPs and boundaries |

Full list: [Known limitations](https://appcd-dev.github.io/cce/reference/known-limitations/).

---

## Core concepts

| Term | What it is |
|------|------------|
| **Entitlement** | One row: `(provider, resource, operation)` plus file/line/method |
| **Lens** | YAML mapper (`*_lenses.yaml`) — rules that turn call sites into entitlements; passed via `-mapper-file` |
| **Recipe** | Catalog entry (id, languages, `filter`) pointing at a lens — discover with `cce catalog` |
| **Pack** | Named bundle of recipe ids (e.g. `modernization-pack`) — one parse, merged JSON |
| **Diff** | Compare two JSON reports; `--fail-new` for CI gates |

**Mapper precedence:** With `-mapper-file`, your lens runs **first**; built-in cloud rules fill gaps when the lens does not match.

**Filters:** `-filter cloud` keeps cloud-style rows only. Use `-filter all` for custom providers (`PLATFORM`, `TECH_DEBT`, `CVE`, …).

---

## Install

| Where | How |
|-------|-----|
| **macOS / Linux** | `brew install stackgenhq/homebrew-stackgen/cce` ([formula](https://github.com/stackgenhq/homebrew-stackgen/blob/main/cce.rb), `v0.0.5`) |
| **CI** | [`sks/cce-action@v1.2.1`](https://github.com/sks/cce-action) → pulls [`ghcr.io/stackgenhq/cce`](https://github.com/stackgenhq/homebrew-stackgen/pkgs/container/cce) |
| **Container** | `docker pull ghcr.io/stackgenhq/cce:0.0.5` |

```bash
# Local
brew tap stackgenhq/homebrew-stackgen
brew install stackgenhq/homebrew-stackgen/cce
cce -version

# Docker (same image as the GitHub Action)
docker run --rm -v "$PWD:$PWD" -w "$PWD" ghcr.io/stackgenhq/cce:0.0.5 \
  -folder . -language GO -filter cloud -format json -output report.json
```

---

## CLI cheat sheet

Run from your project root. CCE honors **`.gitignore`** by default (skips `vendor/`, `node_modules/`, …).

| Goal | Command |
|------|---------|
| Preview files (no parse) | `cce plan -folder . -language AUTO` |
| Cloud entitlements (IAM) | `cce -folder . -language AUTO -filter cloud -format json -output cloud.json` |
| Human-readable scan | `cce -folder . -filter cloud -format text` |
| SARIF for security tools | `cce -folder . -filter cloud -format sarif -output findings.sarif` |
| List recipes / packs | `cce catalog` · `cce catalog --remote` |
| Modernization pack | `cce run -folder . -language AUTO -pack modernization-pack -remote -output pack.json` |
| Pick recipes | `cce run -recipes cloud-entitlements,sdk-uplift -remote -output subset.json` |
| Custom lens | `cce -folder . -filter all -mapper-file ./my-lens.yaml -format json -output out.json` |
| CI gate | `cce diff baseline.json current.json --fail-new` |
| Policy-aware diff | `cce diff baseline.json current.json -policy policy.yaml` |

**Performance:** Prefer `cce run -pack …` over multiple `cce` invocations on the same folder — parse once, map many. Tune `CCE_MAX_PARALLELISM` on large CI runners.

**Which command when:**

| You need | Use | Not |
|----------|-----|-----|
| One cloud report | `cce -filter cloud …` | Three separate scans |
| Cloud + SDK + tech-debt | `cce run -pack modernization-pack` | Shell loop of `cce` commands |
| Custom org rules | `-mapper-file` + `-filter all` | `-filter cloud` alone |

Browse the full [use case catalog](https://appcd-dev.github.io/cce/use-cases/catalog/) (modernization, security, governance, SRE, AI).

---

## Who it's for

| Role | Typical workflow |
|------|------------------|
| **Developers** | Scan before the "fix my IAM" ticket; paste JSON into the PR |
| **DevOps / platform** | Diff app entitlements vs Terraform/IRSA; add `sks/cce-action` to pipelines |
| **SREs** | Scan before/after deploys; catch new cloud APIs in change review |
| **Security** | SARIF + diff gates; CVE reachability and audit-evidence recipes |
| **Engineering managers** | Entitlement count and top services in release artifacts — like test coverage |

---

## Worked example: [external-dns](https://github.com/kubernetes-sigs/external-dns)

[kubernetes-sigs/external-dns](https://github.com/kubernetes-sigs/external-dns) syncs Kubernetes services to DNS providers. The AWS provider is a small Go package using **AWS SDK for Go v2** (Route 53 + STS). Real software, not a toy repo.

### Scan

```bash
git clone --depth 1 https://github.com/kubernetes-sigs/external-dns.git
cd external-dns

cce -folder provider/aws -language GO -filter cloud \
  -format json -output external-dns-aws.json
```

CCE parses `provider/aws` with tree-sitter and emits `(provider, resource, operation)` tuples — Route 53 list/change operations and STS assume-role wiring.

### Derive IAM actions

```bash
jq -r '.entitlements[]
  | select(.provider == "AWS")
  | "\(.resource):\(.operation)"' external-dns-aws.json | sort -u
```

**CCE gives you the Action array from static analysis.** Resource ARNs and condition keys belong in Terraform/IRSA — never ship `Resource: "*"` because a template said so.

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

### What to expect on `provider/aws`

| AWS area | Why it shows up |
|----------|-----------------|
| **route53** | Hosted zones, record sets, change batches |
| **sts** | Assume-role chain for cross-account Route 53 |

Optional DynamoDB registry backend: scan `registry/dynamodb` separately — a second IAM story. There is **no S3** in the AWS provider package.

### Local PR gate

```bash
cce -folder provider/aws -language GO -filter cloud -format json -output after.json
cce diff baseline.json after.json --fail-new
```

---

## Recipes and packs

Discover built-in analysis recipes:

```bash
cce catalog --remote
```

**Modernization pack** (cloud + SDK uplift + tech-debt in one parse):

```bash
cce run -folder . -language AUTO -pack modernization-pack -remote -output pack.json
jq '.summary' pack.json
```

Public lenses are hosted at `https://releases.stackgen.com/cce/lenses/…` and `…/cce/recipes/latest/`.

| Recipe id | Purpose |
|-----------|---------|
| `cloud-entitlements` | Built-in cloud SDK → IAM-oriented tuples |
| `sdk-uplift` | Legacy vs modern SDK labels |
| `tech-debt-inventory` | Deprecated / forbidden library call sites |
| `cve-reachability` | CVE-related package usage at call sites |
| `platform-adoption` | Internal platform SDK vs direct cloud SDK |
| `pre-deploy-iam-review` | Same extraction as cloud entitlements, CI-oriented |
| `change-control` | Signal for new cloud API usage |

Details: [Analysis recipes & packs](https://appcd-dev.github.io/cce/reference/analysis-recipes/).

---

## Enterprise lenses and catalogs

Platform teams can ship **org-specific** rules without waiting on upstream releases.

**Path A — lens only (fastest):** Host `idp_lenses.yaml` on internal HTTPS, pin version in CI:

```bash
cce -folder . -language AUTO -filter all \
  -mapper-file https://artifacts.corp.example/cce/lenses/idp/v1.2.0/idp_lenses.yaml \
  -format json -output idp-inventory.json
```

**Path B — catalog + pack:** Register recipes in your `catalog.json` / `packs.json`, host on HTTPS, run:

```bash
cce catalog --remote \
  -catalog-url https://artifacts.corp.example/cce/recipes/latest/catalog.json \
  -packs-url https://artifacts.corp.example/cce/recipes/latest/packs.json

cce run -folder . -language AUTO -pack corp-platform-pack -remote \
  -catalog-url https://artifacts.corp.example/cce/recipes/latest/catalog.json \
  -packs-url https://artifacts.corp.example/cce/recipes/latest/packs.json \
  -output platform.json
```

Full guide: [Enterprise lenses and catalogs](https://appcd-dev.github.io/cce/guides/enterprise-lenses-and-catalogs/) (templates, pitfalls, CI policies).

---

## GitHub Actions

Add CCE to any workflow with [`sks/cce-action`](https://github.com/sks/cce-action) (`@v1.2.1`). Pulls `ghcr.io/stackgenhq/cce` — no Homebrew on the runner.

### Basic scan on every PR

`.github/workflows/cce-scan.yml`:

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

### PR gate: fail on new cloud APIs

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

### Enterprise lens in CI

```yaml
- uses: sks/cce-action@v1.2.1
  with:
    folder: .
    language: AUTO
    filter: all
    mapper-file: https://artifacts.corp.example/cce/lenses/idp/v1.2.0/idp_lenses.yaml
    output: idp-inventory.json
```

### Recipe pack in CI

```yaml
- uses: sks/cce-action@v1.2.1
  with:
    mode: run
    pack: modernization-pack
    remote: true
    output: modernization.json
```

More examples: [github.com/sks/cce-action](https://github.com/sks/cce-action/tree/main/examples).

---

## Reading the output

### Scan JSON

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

| Field | Meaning |
|-------|---------|
| `provider` | `AWS`, `AWS_V2`, `PLATFORM`, `TECH_DEBT`, … |
| `resource` | Service id (`route53`, `sts`, `s3`, …) |
| `operation` | API operation (`ListHostedZones`, `AssumeRole`, …) |
| `file`, `line`, `column` | Call site location |
| `method`, `signature` | FQN and call shape for reviewers |

```bash
jq '.summary' report.json
jq -r '.entitlements[] | "\(.file):\(.line) \(.resource):\(.operation)"' report.json | sort -u
```

IAM action string: `"${resource}:${operation}"` → `route53:ListHostedZones`.

### GitHub Actions log

After `Pulling CCE container ghcr.io/stackgenhq/cce:0.0.5`:

```text
Entitlements found: 11
```

| Job (cce-action CI) | Mode | Typical count |
|---------------------|------|----------------|
| `external-dns` | `scan` + diff smoke | **11** |
| `modernization-pack` | `run` + `modernization-pack` | **33** (AWS + AWS_V2 from SDK uplift) |
| `custom-lens-url` | `scan` + remote lens | **≥ 11** |

Use **`mode: scan`** + **`filter: cloud`** for IAM gates. Pack mode counts are higher by design.

**Step outputs:** `report-path`, `entitlement-count`, `diff-path` (when `baseline` is set). Artifact: **`cce-entitlements`** (download from Actions → Artifacts).

### Diff JSON (PR gate)

No drift:

```json
{
  "baseline_total": 11,
  "current_total": 11,
  "added": null,
  "removed": null,
  "provider_delta": { "AWS": 0 }
}
```

New SDK usage appears in **`added`** — that is what `--fail-new` enforces. Review each row: new `resource`/`operation` = new IAM surface.

---

## How it fits your workflow

| Step | What happens |
|------|----------------|
| **1. Code** | IDE or agent writes SDK calls |
| **2. Scan** | `cce` or `sks/cce-action` → entitlements JSON |
| **3. Actions** | Derive IAM action strings; scope ARNs in Terraform / IRSA |
| **4. Gate** | `baseline` + `fail-on-new` blocks unreviewed cloud surface |

**code → entitlements → policy conversation** — the static half of cloud governance while the IDE keeps shipping features.

---

## Resources

| Resource | Link |
|----------|------|
| **User docs** | [appcd-dev.github.io/cce](https://appcd-dev.github.io/cce/) |
| **Get started** | [Get started with CCE](https://appcd-dev.github.io/cce/get-started/) |
| **Use case catalog** | [All workflows by goal](https://appcd-dev.github.io/cce/use-cases/catalog/) |
| **GitHub Action** | [github.com/sks/cce-action](https://github.com/sks/cce-action) |
| **Container image** | [ghcr.io/stackgenhq/cce](https://github.com/stackgenhq/homebrew-stackgen/pkgs/container/cce) |
| **Homebrew** | [stackgenhq/homebrew-stackgen](https://github.com/stackgenhq/homebrew-stackgen) |
| **Custom lens YAML** | [Grok rules & prefixes](https://appcd-dev.github.io/cce/reference/custom-lens-yaml/) |
| **CCE vs OpenRewrite** | [When to use which](https://appcd-dev.github.io/cce/reference/cce-vs-openrewrite/) |
| **Enterprise lenses** | [IDP catalogs & packs](https://appcd-dev.github.io/cce/guides/enterprise-lenses-and-catalogs/) |
| **Limitations** | [Known limitations](https://appcd-dev.github.io/cce/reference/known-limitations/) |
| **Action CI example** | [Run #28751246690](https://github.com/sks/cce-action/actions/runs/28751246690) |

---

## Closing thought

AI-assisted development lowered the cost of **adding** cloud integrations. It did not lower the cost of **proving** you only requested the permissions you need. A five-minute CCE scan before merge is cheaper than a security review round-trip — and cheaper than prod discovering your Route 53 client can't assume the role you never updated.

The public CLI handles fast, local entitlement extraction. Scaling across an org — multi-cloud lens packs in corporate CI/CD, centralized governance, runtime alignment — is what [StackGen](https://cloud.stackgen.com) extends. Enterprise questions: **sales@stackgen.com**.

---

*Sabith builds production AI and cloud governance systems in Go. Related on this blog: [defense-in-depth for agents](/blog/defense-in-depth/) · [Terraform for agent governance](/blog/terraform-config/).*

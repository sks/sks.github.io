---
layout: post
title: "You Vibe-Coded the AWS Calls — Do You Know What IAM Permissions You Actually Need?"
date: 2026-07-05 11:00:00 -0700
description: "Install CCE with Homebrew, scan real open-source code, and turn SDK usage into an IAM action list — before your Cursor-generated Route 53 client hits production."
tags: [cce, aws, iam, security, devops, ai-coding, go]
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

Formula and binaries are published by [StackGen](https://github.com/stackgenhq/homebrew-stackgen/blob/main/cce.rb) (`v0.0.5` as of this writing), with builds for macOS (Intel + Apple Silicon) and Linux (amd64 + arm64).

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

You own Terraform modules and IRSA roles. CCE tells you what the **application** calls; your IaC declares what the **role** allows. Diff those two and you catch over-provision (`*` policies "just in case") and under-provision (app calls `sts:AssumeRole` but the role can't).

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

### 4. Optional: CI gate on new permissions

On a feature branch:

```bash
cce --folder provider/aws --language GO --filter cloud \
  --format json --output after.json

cce diff baseline.json after.json --fail-new
```

If a PR adds a new DynamoDB client in `registry/dynamodb`, the diff fails until someone acknowledges the new cloud surface — useful when agents keep "helpfully" adding SDK imports.

---

## What you should expect from this scan

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
| **4. Gate** | `cce diff --fail-new` in CI blocks PRs that add cloud surface without review |

The IDE will keep getting better at *writing* cloud code. Nobody is betting the company on the IDE knowing your AWS Organizations layout. CCE is the static half of the loop: **code → entitlements → policy conversation**.

---

## Install reference

```bash
# One-time
brew tap stackgenhq/homebrew-stackgen
brew install stackgenhq/homebrew-stackgen/cce

# Verify
cce --help
```

Docs and recipes: [appcd-dev.github.io/cce](https://appcd-dev.github.io/cce/)

---

## Closing thought

AI-assisted development lowered the cost of **adding** cloud integrations. It did not lower the cost of **proving** you only requested the permissions you need. A five-minute CCE scan on `provider/aws` before merge is cheaper than a security review round-trip — and cheaper than prod discovering your new Route 53 client can't assume the role you never updated.

The public CCE CLI handles fast, local entitlement extraction. Scaling that across an entire org — multi-cloud lens packs in corporate CI/CD, centralized governance, runtime alignment — is what [StackGen](https://cloud.stackgen.com) extends. Questions about enterprise rollout: **sales@stackgen.com**.

---

*Sabith builds production AI and cloud governance systems in Go. More notes on [agents, Terraform, and defense-in-depth](/blog/defense-in-depth/) on this blog.*

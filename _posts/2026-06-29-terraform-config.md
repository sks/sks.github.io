---
layout: post
title: "Terraform for Agent Configuration — Infrastructure as Code Meets AI Governance"
date: 2026-06-29 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 10
description: "We use Terraform to configure our AI agents. Not YAML. Not a dashboard. Terraform. Here's why."
image: /assets/images/og-iac.png
tags: [terraform, iac, gitops, ai-agents, governance]
---

We use Terraform to configure our AI agents. Not YAML. Not a dashboard. Terraform.

This sounds like overkill until you consider what "configuring an AI agent" actually involves in production: defining personas, attaching tools, binding governance policies, routing to specific models, setting cost budgets, configuring notification channels, and managing secrets. Across dozens of agents. Across multiple teams. With audit trails and rollback.

That's not application config. That's infrastructure.

---

## The Problem with Dashboards

Most agent platforms offer a dashboard: click "Create Agent," fill in a form, hit save. This works for one agent. For an enterprise with many agents across many teams, dashboards create problems:

1. **No audit trail** — Who changed an agent's tool list last Tuesday? The dashboard doesn't know.
2. **No review process** — Config changes go live immediately. No PR, no review, no "are you sure?"
3. **No rollback** — Something broke? Good luck remembering what the previous config looked like.
4. **Drift** — The "source of truth" is a database somewhere. Nobody's sure if it matches what was intended.
5. **No environments** — You can't test an agent config change in staging before it hits production.

These aren't hypothetical. We hit every one of them before we changed approach.

---

## Why We Built a Terraform Provider Instead

Terraform uses a declarative model: you describe the desired state, and the tool figures out how to get there. That model maps naturally onto agent configuration — an agent's persona, tool list, and governance bindings are exactly the kind of "desired state" Terraform is built for.

So we built a custom Terraform provider for our platform, and agent configuration became just another resource type alongside the rest of a team's infrastructure-as-code.

### The GitOps Workflow

Agent configuration now lives in a Git repository, alongside the governance policies that apply to it. The workflow looks like any other infrastructure change:

1. An engineer opens a PR proposing a config change (e.g., "add a new tool to this agent")
2. CI runs a plan step that shows exactly what will change — nothing more, nothing less
3. The team reviews that plan in the PR, the same way they'd review a Kubernetes manifest change
4. On merge, the change applies automatically
5. The audit trail lives in Git history plus the tool's own state tracking

### "Plan Before Apply" Is the Killer Feature

Before any change goes live, you see precisely what will happen — one tool added, one policy attached, nothing else touched. A reviewer can approve with confidence because they're looking at a diff, not trusting that a form was filled out correctly.

For a platform where a misconfigured agent can run shell commands against production systems, "see before you apply" isn't a nice-to-have. It's the whole point.

**One nuance worth knowing if you build something similar:** if a config change merges while an agent is mid-task in a durable workflow engine, the in-flight execution should keep running against the configuration it started with, not hot-swap mid-task. The updated config takes effect on the *next* invocation. Otherwise you risk a tool list changing out from under an agent halfway through an active investigation — which is a much stranger bug to debug than it sounds.

---

## Cross-Resource References Matter More Than You'd Think

Terraform's dependency graph turned out to be one of the more valuable parts of this, almost by accident. Governance policies are created first, agents reference them by ID. If someone tries to delete a policy that's still referenced by a live agent, the plan step catches it before anything breaks — no orphaned references, no silently misconfigured agents.

---

## Secret Management

Secrets — model provider API keys, integration tokens — flow through standard secret-management integrations rather than living in config files. They never appear in version control, and depending on backend configuration, never touch persisted state either.

---

## Why This Beats the Alternatives

| Capability | Dashboard | Plain config files | Terraform |
|-----------|-----------|---------------------|-----------|
| Audit trail | Weak | Git history only | Git + state |
| PR review | No | Yes | Yes |
| Preview changes before applying | No | No | Yes |
| Drift detection | No | No | Yes |
| Rollback | Manual | Git revert | Apply previous state |
| Cross-resource references | Manual IDs | Manual IDs | Automatic, validated |
| Secret management | Varies | Weak | Strong |

---

## Lessons Learned

1. **Agent config is infrastructure.** If your agents can run shell commands on production servers, their configuration deserves the same rigor as your Kubernetes manifests — not a form in a dashboard.

2. **"Plan before apply" is non-negotiable for AI agents.** A misconfigured tool list or a missing governance rule is a security incident, not a bug ticket. Preview every change.

3. **Separate concerns by scope, not by convenience.** A single developer working locally has very different config needs than an enterprise managing dozens of agents across teams. Don't force one format to serve both.

4. **Governance policy belongs in version control.** Policies are code. They need review, testing, and versioning — not a database row edited through a UI.

5. **Build the IaC layer earlier than feels necessary.** We didn't start here — we migrated once the pain of dashboard-driven config became obvious. In hindsight, the GitOps workflow would have prevented several early misconfigurations if we'd had it from month one.

---

**Acknowledgments.** [Deepjyot Kapoor](https://www.linkedin.com/in/deepjyot-kapoor/) contributed to platform bootstrap and API surface work at Aiden.

*Does your agent platform use IaC for configuration? I'd love to hear about alternative approaches. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*



---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

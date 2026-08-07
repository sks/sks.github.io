---
layout: post
title: "From Vague GitHub Issue to PR with Aiden"
date: 2026-08-07 18:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 38
description: "A follow-along guide to OpenTofu: configuring every Aiden piece as sg_* resources — models, GitHub integration, agent, workflow, webhook, schedule — for Specify → Research → Plan → review PR."
image: /assets/images/og-default.png
tags: [ai-agents, github, workflows, aiden, terraform, opentofu, sdlc, beginners]
permalink: /blog/from-vague-github-issue-to-pr-with-aiden/
faqs:
  - question: "Can an AI agent run a GitHub Project board SDLC?"
    answer: "Yes, if you keep the board as source of truth, write evidence as issue comments, and treat Status hops as one step at a time — with humans merging any PR."
  - question: "How do you configure Aiden agents with Terraform or OpenTofu?"
    answer: "Aiden ships a Terraform/OpenTofu provider. You declare agents, workflows, webhooks, schedules, and policies as sg_* resources, then tofu plan / tofu apply like any other infrastructure."
  - question: "Why did dragging a Project card not trigger my agent webhook?"
    answer: "Repo Issues webhooks fire on issue events, not on Projects v2 Status changes. You need a different signal — for example a short poll of the board — if humans drag cards."
  - question: "Should the agent merge the PR?"
    answer: "No. Opening a reviewable PR is enough for a first loop. Merge stays a human decision."
---

GitHub Projects are great until the board fills with cards that say “make nav better” and nothing else.

I wanted a boring demo that still felt magical: open a **vague** GitHub issue, watch it land on a Project board, and let [Aiden](/blog/aiden-platform/) walk it through **Specify → Research → Plan** — then, if we asked for it, open a **review PR**. No second orchestration product. No “trust me, the agent did homework” without a comment on the issue.

We dogfooded it on this blog’s repo and a personal GitHub Project. Internally we package the same idea as reusable OpenTofu modules under `appcd-dev/solutions` — **that repo is invite-only today**. So this post does **not** ask you to `module "…"` anything. Below is a **flat root** of `sg_*` resources you can follow with the [StackGen Terraform/OpenTofu provider](/blog/terraform-config/) on a tenant you already have.

Snippets are teaching shapes (shortened personas/runbooks). Swap URLs, tokens, and column names for your board.

---

## The problem

When cards stay vague, humans do unpaid product work in the comments:

1. Turn the wish into acceptance criteria (**Specify**)
2. Look at the repo and write down what already exists (**Research**)
3. Write a plan someone could implement (**Plan**)
4. Maybe open a PR (**Implement**)

| Do | Don’t |
| -- | ----- |
| One issue per run | Boil the ocean across the whole board |
| Comment evidence on the issue | Keep findings only in chat |
| Hop Status one column at a time | Jump Specify → Done in silence |
| Open a PR for humans to merge | Auto-merge |

That is [bring-up discipline](/blog/bring-up-agent-workflows-like-hardware/) applied to a kanban.

---

## 0. Provider + variables

**Prerequisite:** you need an **active StackGen / Aiden tenant** (URL + token + org/project id). Without that, `tofu apply` has nowhere to create resources — this is not a local-only sandbox.

Aiden is not “paste a system prompt into a dashboard.” StackGen ships `provider "sg"`. Point it at your tenant; every agent object becomes plan/apply/drift — same muscle memory as the rest of your infra.

```hcl
terraform {
  required_version = ">= 1.5"
  required_providers {
    sg = {
      source  = "releases.stackgen.com/stackgen/stackgen"
      version = ">= 0.1.33, < 0.2.0"
    }
  }
}

provider "sg" {
  stackgen_url   = var.stackgen_url   # e.g. https://ai.dev.stackgen.com
  stackgen_token = var.stackgen_token # never commit
  project_id     = var.stackgen_project_id
}

variable "stackgen_url" { type = string }
variable "stackgen_token" {
  type      = string
  sensitive = true
}
variable "stackgen_project_id" { type = string }

variable "openai_api_key" {
  type      = string
  sensitive = true
}
variable "github_token" {
  type        = string
  sensitive   = true
  description = "PAT with repo + Projects v2 (read:project, project)"
}

variable "default_project_url" {
  type    = string
  default = "https://github.com/users/YOU/projects/1"
}
```

We use **OpenTofu** (`tofu`) interchangeably with Terraform for `fmt`, `init`, `plan`, and `apply`.

---

## 1. Model stack — secret → provider → named model

```hcl
resource "sg_secret" "openai" {
  name        = "demo-openai-vault"
  description = "OpenAI API key"
  category    = "LLM"
  subcategory = "openai"
  metadata = {
    OPENAI_API_KEY = var.openai_api_key
  }
}

resource "sg_guild_model_provider" "openai" {
  name            = "openai"
  provider_type   = "openai"
  token_reference = sg_secret.openai.name
}

resource "sg_guild_model" "primary" {
  name          = "gpt-5.4-2026-03-05" # use a model your tenant already knows
  provider_name = sg_guild_model_provider.openai.name
  # …other model fields per your tenant / provider docs
}
```

You only need **one** working model for the demo. Attach Anthropic the same way if you prefer Claude.

---

## 2. GitHub integration — vault + `sg_guild_integration`

```hcl
resource "sg_secret" "github" {
  name        = "demo-github-vault"
  description = "GitHub PAT for Projects + issues + PRs"
  category    = "SCM"
  subcategory = "github"
  metadata = {
    provider = "github"
    token    = var.github_token
  }
}

resource "sg_guild_integration" "github" {
  name           = "github-integration"
  description    = "GitHub for Project Status, comments, optional PR"
  type           = "github"
  enabled        = true
  secret_ref_ids = [sg_secret.github.id]

  image = {
    name = "ghcr.io/stackgenhq/github-mcp:latest" # pin what your tenant documents
  }
}
```

Without Projects scopes, GraphQL Status reads fail in opaque ways. Budget time for token scopes before blaming the agent.

---

## 3. Guardrails policy — merge stays human

```hcl
resource "sg_policy" "guardrails" {
  name        = "github-project-assistant-guardrails"
  type        = "intervention"
  description = "HITL for destructive shell / merge / CI dispatch"
  rego_source = <<-REGO
    package policy
    import rego.v1

    default approval_required := false

    approval_required if {
      contains(input.tool.name, "_execute_command")
      cmd := lower(input.tool.arguments.command)
      some p in {"rm -rf", "git push --force", "gh pr merge", "gh workflow run"}
      contains(cmd, p)
    }
  REGO
}
```

Allow `gh pr create` in the runbook path; keep **merge** behind HITL. Autonomy to open a PR; accountability to land it.

---

## 4. Agent + budget + policy attachment

Put the long persona in `persona.md` next to your root (mission, comment template, “do not merge”). Keep absolute filesystem paths **out** of spawn goals — they trip execution-surface guards when GitHub tools expect relative paths.

```hcl
resource "sg_agent" "project_assistant" {
  name        = "github-project-assistant"
  persona     = file("${path.cwd}/persona.md")
  model_names = [sg_guild_model.primary.name]

  integrations = [sg_guild_integration.github.name]

  auto_approve_tools = [
    { tool = "${sg_guild_integration.github.name}_*" },
    { tool = "note" },
    { tool = "read_notes" },
  ]
}

resource "sg_agent_budget" "project_assistant" {
  agent_name  = sg_agent.project_assistant.name
  limit_usd   = 20
  period_type = "daily"
}

resource "sg_agent_policy_attachment" "guardrails" {
  agent_name = sg_agent.project_assistant.name
  policy_id  = sg_policy.guardrails.id
  enabled    = true
}
```

---

## 5. Runbook + workflow

The runbook markdown is the playbook: how to read Status, what Specify/Research/Plan must post, when to chain, when to open a PR. Bind it to a single workflow stage so chat and webhooks share one entrypoint.

```hcl
resource "sg_runbook_sop" "item_assist" {
  name        = "github-project-item-assist"
  approve     = true
  description = file("${path.cwd}/runbook-item-assist.md")
}

resource "sg_workflow" "item_assist" {
  name        = "github-project-item-assist"
  domain      = "software-engineering"
  description = "One GitHub Project item: Specify → Research → Plan (+ optional PR)"
  approve     = true

  required_inputs = ["project_url", "issue_number"]
  optional_inputs = ["repository", "auto_advance", "sdlc_chain"]

  stages = [
    {
      stage_id    = "assist_item"
      description = "Board SDLC for one issue; comments; Status hops; optional PR"
      required    = true
    },
  ]

  stage_bindings = [
    {
      stage_id     = "assist_item"
      agent_ref    = sg_agent.project_assistant.name
      runbook_refs = [sg_runbook_sop.item_assist.name]
    },
  ]
}
```

Start the **workflow**, not a naked agent chat — inputs stay structured.

---

## 6. Webhook — issue opened

```hcl
resource "sg_webhook" "issues" {
  name           = "github-project-item-assist-issues"
  target_type    = "workflow"
  target_name    = sg_workflow.item_assist.name
  enabled        = true
  token_rotation = "v1"

  action = <<-EOT
    GitHub issue opened. Extract repository.full_name and issue.number.
    project_url = ${var.default_project_url}
    auto_advance = true
    sdlc_chain = true
    If the issue is missing from the Project, add it under Specify, then run
    Specify → Research → Plan. When implement is enabled in the runbook, open a
    review PR after Plan. Do not merge. Ignore non-open noise.
  EOT
}

output "webhook_token" {
  value     = sg_webhook.issues.token
  sensitive = true
}

output "webhook_ingress_payload_url" {
  description = "Paste into GitHub → Webhooks → Payload URL"
  sensitive   = true
  value = format(
    "%s/guild/api/v1/webhooks/trigger?apiKey=%s&orgId=%s",
    trimsuffix(var.stackgen_url, "/"),
    urlencode(sg_webhook.issues.token),
    urlencode(var.stackgen_project_id),
  )
}
```

On our dogfood host, the trigger lived under a `/guild` API prefix — a bare `/api/v1/...` returned an nginx `404` with a valid token. Register the repo webhook for **Issues** (opened), content type JSON, secret = `webhook_token` (or rely on `apiKey` in the URL).

---

## 7. Schedule — card drag is not an Issues event

```hcl
resource "sg_agent_schedule" "status_poll" {
  target_type = "workflow"
  target_name = sg_workflow.item_assist.name
  name        = "github-project-status-poll"
  expression  = "*/5 * * * *" # five-field cron, UTC
  enabled     = true

  action = <<-EOT
    Poll Project ${var.default_project_url}.
    Pick at most ONE item in Research or Plan that still needs a matching
    "### Aiden project assist — <Stage>" comment (or Plan ready for implement
    with no PR yet). Prefer Plan. Then run github-project-item-assist for that
    issue with project_url, issue_number, repository, auto_advance=true,
    sdlc_chain=true. If idle, reply "status poll: idle" and stop.
  EOT
}
```

Webhooks and schedules share the same `target_type` / `target_name` pairing — both aim at the workflow.

---

## Failure story #1: “I dragged Research → Plan and nothing happened”

Repo Issues deliveries showed only `opened` and `ping`. Dragging a Projects v2 card is **not** an `issues` event. The schedule is the fix for personal boards — eventual, not instant. **Match the trigger to the UI gesture.**

---

## Failure story #2: the agent “posted” `@comment.md`

```text
@issue28_comment.md
```

For `gh api`, capital **`-F`** expands `@file`; lowercase `-f` sends the path string. This is the same class of bug as putting `#42` on a shell command line — everything after `#` is treated as a comment, so the rest of the command disappears.

```bash
gh api "repos/$OWNER/$REPO/issues/$N/comments" -F body=@assist_comment.md
```

---

## What a good stage comment looks like

```markdown
### Aiden project assist — Specify

**Issue:** #29
**Status (before):** Specify
**Status (after):** Research
**auto_advance:** true

#### Output
Goal, in/out of scope, acceptance criteria, open questions…

#### Next human step
Review, answer questions, or let the chain continue.
```

Dogfood closed with [navigation polish PR #31](https://github.com/sks/sks.github.io/pull/31) — agent opened, human merged.

---

## Apply loop

```bash
# in your flat root (provider + sg_* resources above)
tofu init
tofu plan
tofu apply

tofu output -raw webhook_ingress_payload_url
tofu output -raw webhook_token
```

Open a vague issue on the allowlisted repo — or drag a card and wait for the poll. “What’s deployed?” is state + Git history.

---

## Wrap-up

**Takeaways**

1. **`sg_*` resources are the product surface** — follow them before wrapping modules.
2. **Order matters** — secrets → providers/models → integrations → agent → workflow → webhook/schedule.
3. **Receipts on GitHub** — issue comments beat chat transcripts.
4. **Issue opened ≠ card dragged** — wire both triggers you care about.
5. **CLI flag semantics are product** — `-F` vs `-f` for `@file`.
6. **Merge stays human.**

**Read next:** [Terraform for Agent Configuration](/blog/terraform-config/) · [How to Debug Multi-Step AI Agent Workflows](/blog/bring-up-agent-workflows-like-hardware/) · [AI Agent Runtime vs Platform](/blog/aiden-platform/) · [Is the Task Actually Done?](/blog/is-the-task-actually-done/). Packaged modules live in `appcd-dev/solutions` (**invite-only for now**) — same shapes as the flat `sg_*` root above when your org gets access.

---

*Building AI agents that leave receipts on the systems you already use? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

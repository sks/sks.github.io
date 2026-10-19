---
layout: post
title: "Manage AI agent policies as code with Terraform"
date: 2026-10-24 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 84
description: "Policy as code for AI agent guardrails: create Rego with sg_policy, attach with sg_agent_policy_attachment, review with plan and apply."
image: /assets/images/diagrams/oct/policy-as-code-attach.svg
tags: [ai-agents, terraform, opentofu, opa, policy-as-code, aiden, governance]
permalink: /blog/manage-ai-agent-policies-terraform/
faqs:
  - question: "How do you manage AI agent policies with Terraform?"
    answer: "Declare sg_policy with rego_source, then sg_agent_policy_attachment with agent_name and policy_id. Review with tofu plan before apply."
  - question: "What is the StackGen Terraform provider source?"
    answer: "releases.stackgen.com/stackgen/stackgen. You need a tenant URL, token, and project id. Tokens never belong in git."
  - question: "Should policy type be tool_call or logic?"
    answer: "Use logic for allow/deny and intervention for approval_required. Older provider examples still show tool_call; solutions modules use logic and intervention."
  - question: "Does the Terraform attachment support priority?"
    answer: "The REST attach API accepts priority. The sg_agent_policy_attachment resource today exposes agent_name, policy_id, and enabled."
---

Manage AI agent policies as code the same way you manage infrastructure: Rego in git, `plan` before `apply`, attach by UUID.

[Authorize with OPA](/blog/authorize-ai-agent-tool-calls-opa/) proved a deny rule locally. This post puts that rule on an agent with the StackGen Terraform/OpenTofu provider. Background on why agent config moved to a provider lives in [Terraform for agent configuration](/blog/terraform-config/).

**Key takeaways**

- `sg_policy` creates Rego; `sg_agent_policy_attachment` binds it to an agent.
- Prefer `type = "logic"` / `"intervention"` over stale `tool_call` examples.
- Test with `opa test`, then `tofu plan`, then attach.
{: .key-takeaways}

---

![Rego file to sg_policy to attachment to agent](/assets/images/diagrams/oct/policy-as-code-attach.svg)

*Names stay stable. Attachments reference the policy UUID.*

## Why policy as code for agents?

HashiCorp’s line for AI-driven infrastructure is “agent proposes, control plane governs.” Same split here: the model proposes a tool call; the platform policy decides. Putting Rego only in a UI click means the next incident has no PR to blame and no plan output to review.

OpenShell and gateway products roll rules in **audit** then **enforce**. Aiden’s practical equivalent: prove the rule with `opa test`, create it disabled or on a non-prod agent first, then enable the attachment.

## Provider setup

You can exercise create/attach for free:

1. [Create a free account](https://app.stackgen.com/) at [app.stackgen.com](https://app.stackgen.com/).
2. Open [Personal access tokens](https://app.stackgen.com/app/settings/personal-access-tokens) and mint a token. That value is `stackgen_token`. Never commit it.
3. Set `stackgen_url` to `https://app.stackgen.com` and `stackgen_workspace_id` to your workspace UUID from the app.

Without URL, token, and workspace id, `tofu apply` has nowhere to create resources. Same bar as [Aiden the Hard Way](/blog/from-vague-github-issue-to-pr-with-aiden/). Pin the provider to **0.1.48** ([docs](https://appcd-dev.github.io/terraform-provider-stackgen/)).

```hcl
terraform {
  required_version = ">= 1.5"
  required_providers {
    sg = {
      source  = "releases.stackgen.com/stackgen/stackgen"
      version = "0.1.48"
    }
  }
}

provider "sg" {
  stackgen_url   = var.stackgen_url   # https://app.stackgen.com
  stackgen_token = var.stackgen_token # personal access token; never commit
  workspace_id   = var.stackgen_workspace_id
}
```

Docs: [terraform-provider-stackgen](https://appcd-dev.github.io/terraform-provider-stackgen/) · [`sg_policy`](https://appcd-dev.github.io/terraform-provider-stackgen/resources/policy.html).

## Create the policy from a file

Keep Rego on disk. Terraform loads it with `file()`.

```hcl
resource "sg_policy" "deny_secret_write" {
  name        = "lab-deny-secret-write"
  description = "Deny gh secret set (teaching lab)"
  type        = "logic"
  rego_source = file("${path.module}/policies/deny-secret-write.rego")
}
```

Honest note on types: provider HTML examples still show `type = "tool_call"` and `decision := "deny"`. Solutions and Hard Way use `package policy` with `allow` / `approval_required` and types `logic` / `intervention`. Teach the live shape.

## Create a minimal agent and attach

The lab creates a bare `sg_agent`, then attaches the policy by UUID:

```hcl
resource "sg_agent" "lab" {
  name        = var.agent_name
  description = "Teaching lab agent for OPA policy attach"
  persona     = "You are a lab agent used only to demonstrate policy attachment."
}

resource "sg_agent_policy_attachment" "deny_secret_write" {
  agent_name = sg_agent.lab.name
  policy_id  = sg_policy.deny_secret_write.id
  enabled    = true
}
```

For a full agent plus workflows in one module, use [Aiden the Easy Way](/blog/aiden-the-easy-way/).

## Lab step

Full teaching root:

[`samples/aiden-opa-policies/02-terraform-attach/`](https://github.com/sks/sks.github.io/tree/main/samples/aiden-opa-policies/02-terraform-attach)

```bash
cd samples/aiden-opa-policies/02-terraform-attach
cp terraform.tfvars.example terraform.tfvars
# stackgen_url = https://app.stackgen.com
# stackgen_token = from Personal access tokens
# stackgen_workspace_id = your workspace UUID
tofu init
tofu plan
# tofu apply only when you intend to mutate the tenant
```

Next: clock-based rules. [Time-based AI agent policies with OPA](/blog/time-based-ai-agent-policies-opa/).

---

*Policy reviews belong in PRs.* [Create a free account](https://app.stackgen.com/), mint a [personal access token](https://app.stackgen.com/app/settings/personal-access-tokens), then run the attach lab.

> Free to try: [create an account](https://app.stackgen.com/), then create a [personal access token](https://app.stackgen.com/app/settings/personal-access-tokens) for Terraform. StackGen / Aiden: [app.stackgen.com](https://app.stackgen.com/).

Previous: [Authorize AI agent tool calls with OPA](/blog/authorize-ai-agent-tool-calls-opa/). Next: [Time-based AI agent policies with OPA](/blog/time-based-ai-agent-policies-opa/).

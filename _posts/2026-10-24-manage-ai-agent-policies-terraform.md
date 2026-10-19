---
layout: post
title: "Manage AI agent policies as code with Terraform"
date: 2026-10-24 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 84
description: "Policy as code for AI agent guardrails: create Rego with sg_policy, attach with sg_agent_policy_attachment, review with plan and apply."
image: /assets/images/diagrams/oct/manage-policies-terraform.jpg
tags: [ai-agents, terraform, opentofu, opa, policy-as-code, aiden, governance]
permalink: /blog/manage-ai-agent-policies-terraform/
faqs:
  - question: "How do you manage AI agent policies with Terraform?"
    answer: "Declare sg_policy with rego_source, then sg_agent_policy_attachment with agent_name and policy_id. Review with tofu plan before apply."
  - question: "What is the StackGen Terraform provider source?"
    answer: "releases.stackgen.com/stackgen/stackgen at version 0.1.48. You need a tenant URL, personal access token, and workspace_id. Tokens never belong in git."
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

![Managing AI agent policies as code with Terraform from Rego to StackGen enforcement](/assets/images/diagrams/oct/manage-policies-terraform.jpg)

*`opa test` locally, declare `sg_policy` and `sg_agent_policy_attachment`, `tofu plan` / `apply`, then Aiden enforces allow or deny on tool calls.*

## Architecture: control plane vs enforce path

Terraform (and the Guild API) own the **control plane**:

| Resource | Stores | Runtime effect |
|----------|--------|----------------|
| `sg_policy` | Rego text, type (`logic` / `intervention` / …), UUID | Available for evaluation |
| `sg_agent` | Agent identity and config | Target for attachment |
| `sg_agent_policy_attachment` | `(agent_name, policy_id, enabled)` | PEP includes that Rego for that agent |

Nothing in this path runs the LLM. `tofu apply` only mutates stored policy and links. The **data plane** (factsheet → OPA → allow/deny/ask → tool) is unchanged until a live tool call happens. That split is why you can `opa test` offline, `tofu plan` the attach, and only then enable enforcement.

Provider docs: [terraform-provider-stackgen](https://appcd-dev.github.io/terraform-provider-stackgen/) (pin **v0.1.48**). Prefer `workspace_id` on the provider; `org_id` / `project_id` are deprecated aliases.

## Why policy as code for agents?

HashiCorp’s line for AI-driven infrastructure is “agent proposes, control plane governs.” Same split here: the model proposes a tool call; the platform policy decides. Putting Rego only in a UI click means the next incident has no PR to blame and no plan output to review.

OpenShell and gateway products roll rules in **audit** then **enforce**. Aiden’s practical equivalent: prove the rule with `opa test`, create it on a lab agent first, then enable the attachment on production agents.

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

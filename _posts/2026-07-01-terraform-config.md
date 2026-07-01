---
layout: post
title: "Terraform for Agent Configuration — Infrastructure as Code Meets AI Governance"
date: 2026-07-01
description: "We use Terraform to configure our AI agents. Not YAML. Not a dashboard. Terraform. Here's why."
tags: [terraform, iac, gitops, ai-agents, governance]
---

We use Terraform to configure our AI agents. Not YAML. Not a dashboard. Terraform.

This sounds like overkill until you consider what "configuring an AI agent" actually involves in production: defining personas, attaching tools, binding OPA policies, routing to specific models, setting cost budgets, configuring Slack channels, and managing secrets. Across 20 agents. Across 5 teams. With audit trails and rollback.

That's not application config. That's infrastructure.

---

## The Problem with Dashboards

Most agent platforms offer a dashboard: click "Create Agent," fill in a form, hit save. This works for one agent. For an enterprise with 20+ agents, dashboards create problems:

1. **No audit trail** — Who changed the SRE agent's tools last Tuesday? The dashboard doesn't know.
2. **No review process** — Config changes go live immediately. No PR, no review, no "are you sure?"
3. **No rollback** — Something broke? Good luck remembering what the previous config looked like.
4. **Drift** — The "source of truth" is a database somewhere. Nobody knows if it matches what was intended.
5. **No environments** — Can't test agent config changes in staging before production.

---

## The Custom Terraform Provider

We built a Terraform provider for Aiden. Here's what it looks like:

```hcl
terraform {
  required_providers {
    stackgen = {
      source  = "registry.terraform.io/stackgenhq/stackgen"
    }
  }
}

provider "stackgen" {
  base_url = "https://aiden.internal.company.com"
  token    = var.aiden_api_token
}
```

### Defining Agents

```hcl
resource "stackgen_agent" "sre_copilot" {
  name = "sre-copilot"

  persona = <<-EOT
    You are an SRE copilot. Help with incident triage, 
    runbook execution, and RCA drafting. Prefer safe, 
    read-only operations unless explicitly approved.
  EOT

  tools = [
    "websearch", "webfetch", "run_shell",
    "kubectl_get", "datadog_query", "pagerduty_list"
  ]

  policy_ids = [
    stackgen_policy.deny_destructive_shell.id,
    stackgen_policy.require_prod_approval.id,
  ]

  platforms = jsonencode({
    slack = { channel = var.slack_channel_sre }
  })
}
```

### Defining Policies

```hcl
resource "stackgen_policy" "deny_destructive_shell" {
  name        = "deny-destructive-shell"
  description = "Block rm -rf, format, and other destructive commands"
  type        = "logic"
  rego_source = file("${path.module}/policies/deny-destructive.rego")
}

resource "stackgen_policy" "require_prod_approval" {
  name        = "require-production-approval"
  description = "Require HITL approval for any production changes"
  type        = "logic"
  rego_source = file("${path.module}/policies/prod-approval.rego")
}
```

### Configuring Model Providers

```hcl
resource "stackgen_setting" "model_provider" {
  name = "model_provider"
  config = {
    provider   = "anthropic"
    api_key    = var.anthropic_api_key
    model_name = "claude-sonnet-4-20250514"
  }
}

resource "stackgen_setting" "fallback_model" {
  name = "fallback_model"
  config = {
    provider   = "google"
    api_key    = var.gemini_api_key
    model_name = "gemini-2.5-flash"
  }
}
```

---

## The GitOps Workflow

Agent configuration lives in a Git repo alongside the Rego policies:

```
agent-config/
├── main.tf              # Agent definitions
├── policies/
│   ├── deny-destructive.rego
│   └── prod-approval.rego
├── variables.tf         # Input variables
├── outputs.tf           # Agent IDs, endpoints
├── terraform.tfvars     # Non-secret values
└── .github/workflows/
    └── terraform.yml    # CI/CD pipeline
```

The workflow:

```
1. Engineer opens PR: "Add datadog_query tool to sre-copilot"
2. CI runs `terraform plan` — shows exactly what will change
3. Team reviews the plan in the PR
4. PR merges → `terraform apply` runs automatically
5. Agent config updated, audit trail in Git + Terraform state
```

### `terraform plan` is the Killer Feature

Before any change goes live, you see exactly what will happen:

```
$ terraform plan

  # stackgen_agent.sre_copilot will be updated in-place
  ~ resource "stackgen_agent" "sre_copilot" {
        name = "sre-copilot"
      ~ tools = [
          + "datadog_query",
            "kubectl_get",
            "pagerduty_list",
            "run_shell",
            "webfetch",
            "websearch",
        ]
    }

Plan: 0 to add, 1 to change, 0 to destroy.
```

One tool added. Nothing else changed. The reviewer can approve with confidence.

---

## Cross-Resource References

Terraform's dependency graph is perfect for agent configuration. Policies are created first, then referenced by agents:

```hcl
resource "stackgen_policy" "deny_destructive_shell" {
  name = "deny-destructive-shell"
  # ...
}

resource "stackgen_agent" "sre_copilot" {
  policy_ids = [
    stackgen_policy.deny_destructive_shell.id,  # ← reference
  ]
}
```

If you delete a policy that's referenced by an agent, `terraform plan` tells you:

```
Error: Reference to undeclared resource

  on main.tf line 42:
  stackgen_policy.deny_destructive_shell.id references a 
  resource that no longer exists.
```

No orphaned references. No silent misconfigurations.

---

## Secret Management

Terraform integrates with secret management tools:

```hcl
# From environment variables
variable "anthropic_api_key" {
  type      = string
  sensitive = true
}

# From HashiCorp Vault
data "vault_generic_secret" "anthropic" {
  path = "secret/ai/anthropic"
}

resource "stackgen_setting" "model_provider" {
  config = {
    api_key = data.vault_generic_secret.anthropic.data["api_key"]
  }
}
```

Secrets never appear in `.tf` files, state files (with proper backend config), or Git history.

---

## Comparison

| Capability | Dashboard | YAML + kubectl | Terraform |
|-----------|-----------|---------------|-----------|
| Audit trail | ❌ | ⚠️ Git only | ✅ Git + state |
| PR review | ❌ | ✅ | ✅ |
| Preview changes | ❌ | ❌ | ✅ `terraform plan` |
| Drift detection | ❌ | ❌ | ✅ `terraform plan` |
| Rollback | Manual | `git revert` | ✅ Apply previous state |
| Cross-resource refs | ❌ | Manual IDs | ✅ Automatic |
| Secret management | Varies | ❌ | ✅ Vault, env vars |
| Environments | Manual copy | Manual copy | ✅ Workspaces |
| Reusable modules | ❌ | ❌ | ✅ Terraform modules |

---

## Lessons Learned

1. **Agent config is infrastructure.** If your agents can run shell commands on production servers, their configuration deserves the same rigor as your Kubernetes manifests.

2. **`plan` before `apply` is non-negotiable.** For AI agents, a misconfigured tool list or missing policy is a security incident. Preview every change.

3. **Separate runtime config from platform config.** TOML for what the agent loads at startup. HCL for what the platform manages across all agents. Different scopes, different tools.

4. **Rego policies belong in version control.** OPA policies are code. They need review, testing, and versioning — not a database row edited via UI.

5. **Build the provider early.** We started with direct API calls and migrated to Terraform at month 3. We wish we'd started at month 1 — the GitOps workflow would have prevented several misconfigurations.

---

*Does your agent platform use IaC for configuration? I'd love to hear about alternative approaches. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

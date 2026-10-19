# Aiden OPA policies (teaching labs)

Authorize AI agent tool calls with [Open Policy Agent](https://www.openpolicyagent.org/) (OPA) Rego, then manage those policies as code with the StackGen Terraform/OpenTofu provider.

These folders are **teaching shapes**: short Rego, local `opa test`, and a minimal Terraform attach. They mirror patterns from [appcd-dev/solutions](https://github.com/appcd-dev/solutions) and Aiden e2e guardrails, shortened for learning.

Companion posts:

1. [Why Open Policy Agent for AI agent guardrails](/blog/why-opa-for-ai-agent-guardrails/)
2. [Authorize AI agent tool calls with OPA](/blog/authorize-ai-agent-tool-calls-opa/) (lab `01`)
3. [Manage AI agent policies as code with Terraform](/blog/manage-ai-agent-policies-terraform/) (lab `02`)
4. [Time-based AI agent policies with OPA](/blog/time-based-ai-agent-policies-opa/) (labs `03`, `04`)
5. [Guardrails and human approval for AI agent tool calls](/blog/ai-agent-guardrails-human-approval/) (lab `04`)

## Prerequisites

- [OPA CLI](https://www.openpolicyagent.org/docs/latest/#running-opa) (`opa version` works)
- Labs `01`, `03`, `04`: local only (no tenant)
- Lab `02`: free [StackGen account](https://app.stackgen.com/), [personal access token](https://app.stackgen.com/app/settings/personal-access-tokens), and `stackgen_workspace_id` (never commit secrets). Provider **v0.1.48**. Use `stackgen_url = "https://app.stackgen.com"`. Docs: [terraform-provider-stackgen](https://appcd-dev.github.io/terraform-provider-stackgen/).

## Quick start

```bash
cd samples/aiden-opa-policies
make opa-test
```

## Lab map

| Lab | What it teaches | Tenant? |
|-----|-----------------|---------|
| `01-deny-secret-write/` | Deny `gh secret set` | No |
| `02-terraform-attach/` | `sg_policy` + `sg_agent_policy_attachment` | Yes |
| `03-business-hours/` | Allow-list tool hours from `input.timestamp` | No |
| `04-freeze-and-hitl/` | Change freeze + HITL for destructive shell | No |

Shared factsheet examples live under `fixtures/`.

## Conventions

- Package: `package policy` + `import rego.v1`
- Hard allow/deny: Terraform type `logic`
- Human ask: type `intervention` with `approval_required`
- Provider registry: `releases.stackgen.com/stackgen/stackgen` at version `0.1.48`
- Docs: https://appcd-dev.github.io/terraform-provider-stackgen/

Starter pack: [/start/opa-policies/](/start/opa-policies/).

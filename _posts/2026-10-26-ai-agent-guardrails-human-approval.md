---
layout: post
title: "Guardrails and human approval for AI agent tool calls"
date: 2026-10-26 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 86
description: "Allow, deny, or ask: OPA HITL for destructive shell, secret writes, and data exfiltration. Test with opa test before you ship."
image: /assets/images/diagrams/oct/allow-ask-deny.svg
tags: [ai-agents, opa, hitl, guardrails, human-in-the-loop, aiden, security]
permalink: /blog/ai-agent-guardrails-human-approval/
faqs:
  - question: "When should an AI agent tool call ask for human approval?"
    answer: "When the action is high impact but sometimes legitimate: destructive shell, merges, terraform destroy. Hard-deny clear exfil and secret writes instead of asking."
  - question: "How does Aiden map allow, ask, and deny?"
    answer: "logic policies set allow. intervention policies set approval_required (ask). A deny is allow := false. approval_authorization policies decide who may click Approve."
  - question: "How do you test HITL Rego without a UI?"
    answer: "Write opa test cases that assert approval_required for matching commands and not for safe ones. Dry-run evaluate APIs can probe the same Rego without an LLM."
  - question: "What should operators check before attaching a policy?"
    answer: "opa test green, correct policy type, attachment enabled only after review, deny for secrets/exfil, HITL for reversible destruction, and fail closed on evaluate errors."
---

Guardrails and human approval are not the same control.

**Deny** blocks. **Ask** pauses until a person decides. Framework docs call that triad allow / ask / deny ([TanStack sandbox policy](https://tanstack.com/ai/latest/docs/sandbox/policy), [OpenAI guardrails and human review](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals)). Aiden maps ask to `approval_required` on an `intervention` policy. This post finishes the series with when to use which, a HITL shell lab, and an operator checklist.

**Key takeaways**

- Secret writes and clear exfil: hard deny.
- Destructive but sometimes valid: ask (`approval_required`).
- Prove both with `opa test` before Terraform attach.
{: .key-takeaways}

---

![Decision tree for allow ask deny on agent tool calls](/assets/images/diagrams/oct/allow-ask-deny.svg)

*Asking a human about `gh secret set` is the wrong control. Blocking it is the right one.*

## Architecture: ask is a third PDP outcome

Deny and allow finish in one evaluate. **Ask** splits the path:

1. Tool call hits the PEP. Attached `intervention` Rego sets `approval_required`.
2. Runtime **does not** execute the tool. It records a pending approval (requester, tool, arguments).
3. A human decides. On that resolve, `approval_authorization` policies may evaluate `input.approver` (who is allowed to Approve).
4. On approve, the PEP runs the original tool call. On reject, the agent gets a denial, not a silent success.

That is why ask is not “a softer deny.” It is a durable pause with a second policy type for who may unpause. The LLM never self-approves.

Composition: attach several policies to one agent. Typical layout is one `logic` deny catalog, one `intervention` HITL file, optional time-window `logic`, optional `approval_authorization`. Keep each file one concern.

## Why “just HITL everything” fails

If every shell command asks for approval, people click Approve to clear the queue. That is the [HITL paradox](/blog/hitl-paradox/) in miniature. Save ask for high-impact, sometimes-legitimate actions. Hard-deny the ones that should never run unattended.

## Allow, ask, deny in Aiden

| Decision | Policy type | Rego signal |
|----------|-------------|-------------|
| allow | `logic` | `allow` is true |
| deny | `logic` | `allow` is false |
| ask | `intervention` | `approval_required` is true |
| who may Approve | `approval_authorization` | rules on `input.approver` |

## HITL for destructive shell

Teaching shape (also in Hard Way guardrails):

```rego
package policy

import rego.v1

default approval_required := false

approval_required if {
  endswith(input.tool.name, "_execute_command")
  cmd := lower(input.tool.arguments.command)
  destructive_pattern(cmd)
}

destructive_pattern(cmd) if contains(cmd, "rm -rf")
destructive_pattern(cmd) if contains(cmd, "terraform destroy")
destructive_pattern(cmd) if contains(cmd, "kubectl delete")
destructive_pattern(cmd) if contains(cmd, "drop table")

approval_reason := "Destructive shell requires human approval" if {
  approval_required
}
```

Terraform:

```hcl
resource "sg_policy" "hitl_shell" {
  name        = "lab-hitl-destructive-shell"
  type        = "intervention"
  description = "HITL for destructive shell"
  rego_source = file("${path.module}/hitl-destructive-shell.rego")
}
```

Lab: `samples/aiden-opa-policies/04-freeze-and-hitl/hitl/`.

Keep secret-write **deny** from lab `01` as a separate `logic` policy. Do not merge “ask about rm” and “deny secrets” into one confused file.

## How do you verify without clicking Approve?

```bash
cd samples/aiden-opa-policies
opa test 04-freeze-and-hitl/hitl
make opa-test
```

Platform dry-run: POST evaluate with the same Rego and a factsheet (e2e helpers do this without an LLM). That is your “audit before enforce” step.

## Operator checklist

1. Default deny for allow-list catalogs; explicit deny for secret and exfil patterns.
2. Co-locate `*_test.rego` next to every uploaded policy; CI runs `opa test`.
3. Use `logic` vs `intervention` deliberately; wrong type silently does nothing useful.
4. Attach only policies you tested; enable after `tofu plan` review.
5. Prefer HITL for reversible high impact; hard deny for secrets and dumps.
6. Fail closed when evaluation errors; never treat “policy engine down” as allow.
7. Record deny and ask reasons humans can read (`deny_reason`, `approval_reason`).
8. Stack sandbox isolation (OpenShell-style) under tool-call OPA when blast radius demands it ([defense in depth](/blog/defense-in-depth/)).

## Where to go

```bash
git clone https://github.com/sks/sks.github.io.git
cd sks.github.io/samples/aiden-opa-policies
make opa-test
```

- Starter pack: [/start/opa-policies/](/start/opa-policies/)
- Full agent wiring: [Hard Way](/blog/from-vague-github-issue-to-pr-with-aiden/) · [Easy Way](/blog/aiden-the-easy-way/)
- Provider: [sg_policy docs](https://appcd-dev.github.io/terraform-provider-stackgen/resources/policy.html)
- Production catalogs: [appcd-dev/solutions](https://github.com/appcd-dev/solutions) agent `policies/` folders

**Try it free.** [Create a free account](https://app.stackgen.com/) at [app.stackgen.com](https://app.stackgen.com/). Open [Personal access tokens](https://app.stackgen.com/app/settings/personal-access-tokens), mint a token, and use it with Terraform to create agents and attach the policies from this series.

---

*Agents that leave receipts still need a gate they cannot charm. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

> Free to try: [create an account](https://app.stackgen.com/), then create a [personal access token](https://app.stackgen.com/app/settings/personal-access-tokens) for Terraform. StackGen / Aiden: [app.stackgen.com](https://app.stackgen.com/).

Previous: [Time-based AI agent policies with OPA](/blog/time-based-ai-agent-policies-opa/). Series hub: [Enterprise AI Agents in Go](/series/enterprise-ai-agents-go/).

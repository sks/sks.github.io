---
layout: post
title: "Why Open Policy Agent for AI agent guardrails"
date: 2026-10-22 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 82
description: "How OPA and Rego came about, why policy engines beat prompt rules, how Pydantic AI and other frameworks wire allow/ask/deny yourself, and what Aiden ships pre-equipped."
image: /assets/images/diagrams/oct/why-opa-agent-guardrails.jpg
tags: [ai-agents, opa, rego, guardrails, governance, aiden, pydantic-ai]
permalink: /blog/why-opa-for-ai-agent-guardrails/
faqs:
  - question: "What is Open Policy Agent?"
    answer: "OPA is a CNCF-graduated open-source policy engine. You write rules in Rego, send it structured JSON, and get allow/deny (or richer) decisions outside your application code."
  - question: "Why use OPA for AI agent guardrails instead of system prompts?"
    answer: "Prompts live inside the model loop and can be rephrased or ignored. OPA evaluates at an enforcement point before the tool runs, so the agent cannot skip the gate by wording the request differently."
  - question: "Can Pydantic AI or LangGraph do the same thing?"
    answer: "They give you pause hooks (ToolGuardrail, interrupt, needsApproval). You still build the policy engine, shared store, attach path, GitOps, and tests yourself unless a platform already ships them."
  - question: "What does Aiden come pre-equipped with for policy?"
    answer: "Runtime Rego evaluation on tool calls, logic and intervention policy types, Terraform resources to create and attach policies, a dry-run evaluate API, and HITL approval."
  - question: "What is the PDP vs PEP in Aiden?"
    answer: "PDP is OPA evaluating Rego. PEP is the Guild runtime that builds the factsheet, calls OPA, and only then runs the tool or pauses for HITL."
---

System prompts tell an agent to be careful. That is not how authorization works.

When an agent can open PRs, run shell, or call MCP tools, something outside the model has to answer: *may this tool run, with these arguments, right now?* That is what [Open Policy Agent](https://www.openpolicyagent.org/docs/latest/) (OPA) was built for, long before agents showed up. This post covers where OPA came from, why it fits agent guardrails, how frameworks like Pydantic AI wire the same allow/ask/deny pattern yourself, and what [Aiden](/blog/aiden-platform/) already ships so you are not bolting a policy engine onto every agent.

**Key takeaways**

- OPA started as a cloud-native answer to DIY authorization, not as an agent product.
- Policy engines decide before side effects; prompts do not.
- Frameworks give you the pause hook. Aiden gives you the policy engine, attach, and Terraform path.
{: .key-takeaways}

---

![DIY frameworks versus Aiden agent platform for OPA policy](/assets/images/diagrams/oct/why-opa-agent-guardrails.jpg)

*DIY pause hooks and bridging code versus Aiden’s built-in enforcement point, OPA engine, Terraform/GitOps, HITL, and shared catalog.*

## Architecture: PDP, PEP, and the factsheet

![Aiden control plane versus data plane OPA architecture](/assets/images/diagrams/oct/aiden-policy-architecture.svg)

*Control plane stores and attaches Rego. Data plane evaluates it on every tool call before side effects.*

Classical authorization splits into two roles:

| Role | Name | In Aiden |
|------|------|----------|
| **PDP** | Policy Decision Point | Embedded OPA evaluates Rego and returns allow / deny / ask |
| **PEP** | Policy Enforcement Point | Guild runtime: build input, call OPA, then run the tool only on allow (or after HITL) |

The LLM is never the PDP. It proposes a tool call. The PEP refuses to execute until the PDP answers.

**Factsheet.** Before each tool run, the runtime builds a JSON `input` document (agent, timestamp, tool name and arguments, optional user / `policy_data` / skill). Rego reads that document only. No hidden prompt text. No trust in the model’s “I checked the rules.”

**Attachment.** Policies are stored as versioned Rego (`sg_policy`). `sg_agent_policy_attachment` binds a policy UUID to an agent name. At runtime the PEP loads attached policies for that agent and evaluates them. Manage happens out of band (Terraform, API, UI). Enforce happens on the hot path.

**Layers.** Tool-call OPA sits above the model and below the tool. Sandbox products such as [OpenShell](https://developer.nvidia.com/blog/run-autonomous-self-evolving-agents-more-safely-with-nvidia-openshell/) add filesystem / network / process isolation. Same industry vocabulary (deny by default, out-of-process policy). Different layers. Stack them when blast radius demands it ([defense in depth](/blog/defense-in-depth/)).

## How did Open Policy Agent come about?

Before OPA, teams kept rewriting authorization for each service, API, and orchestrator. Policies lived in wikis and PDFs while automation moved faster than humans could keep up. Styra’s founders described that mess directly when OPA moved into CNCF incubating status: heterogeneous stacks, too many APIs, and no single place to enforce invariants ([Open Policy Agent moved to CNCF incubating status](https://www.styra.com/blog/open-policy-agent-moved-to-cncf-incubating-status/)).

In 2016, Tim Hinrichs and Torin Sandall (with Teemu Koponen) created OPA and its policy language, Rego, at Styra. Their pitch still holds: every team used to roll its own storage until databases existed; every team still rolls its own policy engine until something purpose-built takes that job ([The origin of Open Policy Agent and Rego](https://www.styra.com/blog/origin-of-open-policy-agent-rego/), [OPA 101](https://www.styra.com/blog/open-policy-agent-101-a-beginners-guide/)).

The project entered the CNCF sandbox in 2018, reached incubating in 2019, and graduated in 2021 ([Sandbox to graduation](https://www.styra.com/blog/the-open-policy-agent-journey-from-sandbox-to-graduation/); [CNCF interview with Torin Sandall](https://www.cncf.io/humans-of-cloud-native/torin-sandall-co-creator-of-opa/)). Official overview: [openpolicyagent.org docs](https://www.openpolicyagent.org/docs/latest/).

Agents did not invent the need. They made it louder. An LLM that calls tools is another client that must not authorize itself.

## What are the advantages of OPA for agent guardrails?

**Policy lives outside the agent.** You change Rego without redeploying model prompts. Review happens in git, same as application code.

**One language across layers.** Teams already use OPA for Kubernetes admission, Terraform plan checks, and microservice authz. Agent tool calls are another JSON document with a tool name, arguments, and identity.

**Deny by default is natural.** `default allow := false` plus explicit allow rules matches how sandbox products and MCP blogs talk about safe rollout ([TrueFoundry OPA guardrails](https://www.truefoundry.com/docs/ai-gateway/opa-guardrails), [ThreatClaw on MCP tool permissions](https://threatclaw.io/en/blog/opa-rego-mcp-tool-permissions-ai-agent)).

**Testable decisions.** `opa test` runs fixtures without an LLM. That is the cheap layer of an [agent testing pyramid](/blog/ai-agent-testing-pyramid/).

**Decisions before side effects.** NVIDIA [OpenShell](https://developer.nvidia.com/blog/run-autonomous-self-evolving-agents-more-safely-with-nvidia-openshell/) pushes out-of-process enforcement for sandboxes (network, filesystem, process). Aiden’s documented strength is the same idea at the **tool-call** boundary: Rego before MCP or shell executes. Stack those layers if you need both ([defense in depth](/blog/defense-in-depth/)).

## How do you get the same pattern in Pydantic AI and other frameworks?

You can. You assemble more of it yourself.

| Framework | What you get out of the box | What you still build |
|-----------|----------------------------|----------------------|
| [Pydantic AI](https://pydantic.dev/docs/ai/harness/guardrails/) | `ToolGuardrail` allow / block / approve; deferred HITL | Shared Rego/OPA (or Python rules), attach across agents, GitOps, evaluate API |
| [OpenAI Agents SDK](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals/) | Tool guardrails; `needsApproval` + resumable state | External policy decision point and tenant attachment |
| LangGraph | `interrupt()` before a node; checkpointer resume | Place side effects after the interrupt; wire OPA yourself |
| CrewAI | Task `human_input` / output guardrails | Weaker pre-tool gate; no shared OPA control plane |

Pydantic AI sketch: block writes outside a workspace, or ask a human for production.

```python
from pathlib import Path
from pydantic_ai_harness import GuardrailResult, ToolGuardrail
from pydantic_ai_harness.guardrails import ToolCallInfo

WORKSPACE = Path("/workspace")

def stay_in_workspace(call: ToolCallInfo) -> GuardrailResult:
    if call.name == "write_file":
        target = Path(str(call.args["path"])).resolve()
        if not target.is_relative_to(WORKSPACE):
            return GuardrailResult.block(f"{target} is outside the workspace.")
    if call.args.get("env") == "prod":
        return GuardrailResult.approve()
    return GuardrailResult.allow()

# Agent(..., capabilities=[ToolGuardrail(guard=stay_in_workspace)])
```

Same decision in Rego for Aiden-shaped factsheets:

```rego
package policy
import rego.v1

default allow := true

allow := false if {
  input.tool.name == "write_file"
  not startswith(input.tool.arguments.path, "/workspace/")
}

default approval_required := false

approval_required if {
  input.tool.arguments.env == "prod"
}
```

The Python version is fine for one agent process. The Rego version is what you attach to many agents, test with fixtures, and ship through Terraform without rewriting guards in each SDK.

## What does Aiden come pre-equipped with?

Aiden’s runtime builds a **factsheet** for each tool call (agent, timestamp, tool name and arguments, optional user and `policy_data`) and evaluates attached Rego before execution. That is the enforcement point.

Already on the platform:

- Policy types: `logic` (allow/deny), `intervention` (`approval_required`), `approval_authorization` (who may click Approve)
- Terraform/OpenTofu: `sg_policy` and `sg_agent_policy_attachment` via the [StackGen provider](https://appcd-dev.github.io/terraform-provider-stackgen/resources/policy.html) ([why we moved config to Terraform](/blog/terraform-config/))
- Dry-run evaluate so you can probe a policy without calling the LLM
- HITL pause and resume when intervention fires
- Shared catalogs in solutions modules and per-agent `policies/` folders

Punchline: frameworks give you the **pause hook**. Aiden gives you the **policy engine + attach + manage + test** path without wiring OPA into every agent yourself.

## Where to go next

Clone the teaching labs and run local tests:

```bash
git clone https://github.com/sks/sks.github.io.git
cd sks.github.io/samples/aiden-opa-policies
make opa-test
```

**Try it free on StackGen.** [Create a free account](https://app.stackgen.com/) at [app.stackgen.com](https://app.stackgen.com/). Then open [Personal access tokens](https://app.stackgen.com/app/settings/personal-access-tokens), mint a token, and use it as `stackgen_token` when you create agents and policies with Terraform (next posts).

Next post walks through deny-by-default authorization with a real Rego example: [Authorize AI agent tool calls with OPA](/blog/authorize-ai-agent-tool-calls-opa/). Starter pack: [/start/opa-policies/](/start/opa-policies/).

---

*Building agents that need a real authorization boundary? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

> Free to try: [create an account](https://app.stackgen.com/), then create a [personal access token](https://app.stackgen.com/app/settings/personal-access-tokens) for Terraform. StackGen / Aiden: [app.stackgen.com](https://app.stackgen.com/).

Previous: [E2E Learning Loop Blind Spots](/blog/e2e-learning-loop-blind-spots/). Next: [Authorize AI agent tool calls with OPA](/blog/authorize-ai-agent-tool-calls-opa/).

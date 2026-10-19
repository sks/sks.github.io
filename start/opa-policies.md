---
layout: page
title: AI agent guardrails with OPA starter pack
permalink: /start/opa-policies/
description: "Five posts on Open Policy Agent for AI agents: origin and advantages, authorize tool calls, Terraform policy as code, time-based rules, and human approval."
faqs:
  - question: "Where should I start with Aiden OPA policies?"
    answer: "Read why OPA exists and what Aiden ships pre-built, then authorize a deny rule locally with opa test, attach it with Terraform, add time windows, and finish with allow/ask/deny HITL."
  - question: "Do I need an Aiden tenant for every lab?"
    answer: "No. Labs 01, 03, and 04 run with the OPA CLI only. Lab 02 needs a free StackGen account, a personal access token, and a workspace id."
  - question: "Where is the cloneable sample code?"
    answer: "samples/aiden-opa-policies/ in the sks.github.io repository. Run make opa-test from that folder."
  - question: "How do I get a token for Terraform?"
    answer: "Create a free account at app.stackgen.com, then open Personal access tokens under settings and mint a token for stackgen_token. Pin the StackGen provider to 0.1.48."
---

A short path for engineers who want **AI agent guardrails** with Open Policy Agent: decisions outside the model, managed as policy as code.

Architecture in one line: the LLM proposes a tool call; a **PEP** builds a factsheet; **OPA (PDP)** returns allow / deny / ask; only then does the tool run. Terraform manages policies and attachments on the control plane. Details and diagrams start in [Why Open Policy Agent for AI agent guardrails](/blog/why-opa-for-ai-agent-guardrails/).

**Try it free.** [Create an account](https://app.stackgen.com/) at [app.stackgen.com](https://app.stackgen.com/), then mint a [personal access token](https://app.stackgen.com/app/settings/personal-access-tokens) to run Terraform labs that create agents and policies.
## The five posts

1. **[Why Open Policy Agent for AI agent guardrails](/blog/why-opa-for-ai-agent-guardrails/).** Origin, advantages, Pydantic AI and other frameworks DIY vs Aiden pre-equipped.  
2. **[Authorize AI agent tool calls with OPA](/blog/authorize-ai-agent-tool-calls-opa/).** Enforcement point, factsheet, deny `gh secret set`.  
3. **[Manage AI agent policies as code with Terraform](/blog/manage-ai-agent-policies-terraform/).** `sg_policy` + `sg_agent_policy_attachment`.  
4. **[Time-based AI agent policies with OPA](/blog/time-based-ai-agent-policies-opa/).** Business hours and change freezes.  
5. **[Guardrails and human approval for AI agent tool calls](/blog/ai-agent-guardrails-human-approval/).** Allow / ask / deny and operator checklist. 

## Clone and test

```bash
git clone https://github.com/sks/sks.github.io.git
cd sks.github.io/samples/aiden-opa-policies
make opa-test
```

Sample README: [samples/aiden-opa-policies](https://github.com/sks/sks.github.io/tree/main/samples/aiden-opa-policies).

## Related

- Foundations: [Defense in depth](/blog/defense-in-depth/) · [Terraform for agent config](/blog/terraform-config/) · [Aiden platform](/blog/aiden-platform/)
- Full agents: [Hard Way](/blog/from-vague-github-issue-to-pr-with-aiden/) · [Easy Way](/blog/aiden-the-easy-way/)
- Series hub: [Building an Enterprise AI Agent Platform in Go](/series/enterprise-ai-agents-go/)
- Provider docs: [sg_policy](https://appcd-dev.github.io/terraform-provider-stackgen/resources/policy.html)

{% include subscribe.html %}

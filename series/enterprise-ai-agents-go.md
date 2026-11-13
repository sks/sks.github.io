---
layout: page
title: Building an Enterprise AI Agent Platform in Go
nav_title: Series
permalink: /series/enterprise-ai-agents-go/
description: "Enterprise AI agents in Go: a practitioner series on production runtimes, workflows, SRE triage, and platform lessons from Aiden at StackGen."
faqs:
  - question: "Why build an enterprise AI agent platform in Go?"
    answer: "We chose Go for its types, deployment model, and concurrency support. The series explains that choice alongside its costs, including access to Python-first AI libraries; it is not a general recommendation to switch languages."
  - question: "Where should I start reading?"
    answer: "Use a starter pack: agent evals (pyramid and supervised E2E), Go agent runtime (definition, why Go, platform split), or SRE on-call (triage, RCA, observability). Then open the searchable series archive and follow series_order. Each post is self-contained but builds on prior lessons."
  - question: "Who is this series for?"
    answer: "Engineers interested in how agents run and fail in practice. The starter packs introduce the terms before the more detailed implementation posts."
---

This series follows our work on an **AI agent runtime**—the software that manages a language model's tool calls, state, and retries—and **Aiden**, StackGen's platform for running agents across teams. Many examples involve site reliability engineering (SRE): investigating incidents and keeping services available. The posts mix implementation details, experiments, and lessons from things that went wrong. Results from our setup may not transfer directly to yours; the useful part is often the test or tradeoff, not our choice.

## Start with a pack

| Pack | For |
|------|-----|
| [Agent evals](/start/agent-evals/) | Testing pyramid, separate grader, supervised E2E loop |
| [Go agent runtime](/start/go-runtime/) | Runtime definition, Go vs Python, platform split |
| [SRE on-call](/start/sre-on-call/) | Triage, RCA, observability |
| [SRE as service](/start/sre-as-service/) | Service Rendered Efficiently culture pack |
| [AI agent guardrails with OPA](/start/opa-policies/) | Authorize tool calls, Terraform policy as code, time rules, HITL |
| [Evidence-gated RCA checklist](/checklists/evidence-gated-rca/) | Operator review of agent write-ups |
| [“Done” checklist](/checklists/agent-done/) | When not to trust agent completion |

## Topic hubs

Dive by theme:

- [AI agent workflows](/topics/ai-agent-workflows/) — multi-stage pipelines, bring-up, evidence-gated RCA
- [AI agents for SRE](/topics/ai-agents-sre/) — incident triage, observability, tokenomics
- [Service Rendered Efficiently](/topics/service-rendered-efficiently/) — AI investigation as a service product (sibling series)
- [Go AI agents](/topics/go-ai-agents/) — language choice, platform architecture, IaC config
- [AI agent runtime](/topics/ai-agent-runtime/) — loop vs platform

{% assign series_name = "Building an Enterprise AI Agent Platform in Go" %}
{% assign series_search_placeholder = "Try “triage”, “memory”, or “observability”…" %}
{% include series-archive.html series_name=series_name search_placeholder=series_search_placeholder %}

## More on this site

Unnumbered related posts appear above the archive footer. Standalone engineering notes are listed on the [series index](/series/#standalone-production-notes).

{% include subscribe.html %}

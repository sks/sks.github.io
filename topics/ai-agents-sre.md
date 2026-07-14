---
layout: page
title: AI Agents for SRE
permalink: /topics/ai-agents-sre/
description: "AI-augmented incident triage, agent observability, and tokenomics for on-call teams — what actually helps SREs versus what sounds good in a demo."
hub: ai-agents-sre
faqs:
  - question: "What actually helps on-call SRE teams with AI agents?"
    answer: "Parallel context gathering with bounded tool loops, evidence from observability planes, and human-reviewable outputs — not open-ended autonomous remediation in the first iteration."
  - question: "How do you observe AI agent workloads in production?"
    answer: "Traditional APM misses agent-specific failure modes. You need session-level traces, tool-call attribution, token budgets, and eval gates — not just request latency."
  - question: "How do you control LLM costs for agent sessions?"
    answer: "Treat context as an operating budget: tiered memory, tool response compression, doom-loop detection, and per-session FinOps loops — cheaper models alone are not a strategy."
---

**AI agents for SRE** sit at the intersection of on-call pain and demo hype. These posts separate what moved our incident response from what merely looked impressive in a slide deck.

Part of the series [Building an Enterprise AI Agent Platform in Go](/series/enterprise-ai-agents-go/).

## Featured posts

| Post | What you'll learn |
|------|-------------------|
| [AI Incident Triage for SREs — What Actually Helps On-Call](/blog/ai-incident-triage-sre/) | Practitioner take on what helps on-call vs demo theater |
| [You Can't Debug What You Can't See — Observability for AI Agents](/blog/observability/) | Why traditional APM fails for agent workloads |
| [LLM Tokenomics for Production Agents — Context Budgets as an Operating Model](/blog/maintaining-tokenomics-with-aiden/) | Context budgets, compression, FinOps operating model |
| [Beyond Confluence Runbooks](/blog/beyond-confluence-runbooks/) | When GitOps triage beats wiki playbooks for agents — and when it doesn't |

## FAQ

{% for faq in page.faqs %}
### {{ faq.question }}

{{ faq.answer }}

{% endfor %}

{% include subscribe.html %}

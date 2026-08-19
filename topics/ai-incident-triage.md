---
layout: page
title: AI Incident Triage
permalink: /topics/ai-incident-triage/
description: "AI incident triage for SREs: what helps on-call gather context, form hypotheses, and draft RCA — without demo theater."
hub: ai-incident-triage
faqs:
  - question: "What is AI incident triage?"
    answer: "Using an AI agent to gather alert context, pull signals from observability and change planes, and propose a bounded next step for on-call — not open-ended autonomous remediation on day one."
  - question: "What actually helps SREs with AI triage?"
    answer: "Parallel context gathering with budgets, evidence from systems of record, human-reviewable outputs, and hard gates that refuse confidence when required digs are missing."
  - question: "How is triage different from root cause analysis?"
    answer: "Triage shrinks the blast radius and decides what to check next. RCA proves a cause with elimination and evidence. Agents that narrate RCA before triage finishes invent fluent wrong stories."
  - question: "Where is the full AI incident triage essay?"
    answer: "The canonical long-form piece lives on StackGen: AI Incident Triage for SREs — What Actually Helps On-Call. This hub links that essay plus Production Notes follow-ups on hypotheses, evidence gates, and verification."
---

**AI for incident triage** is the easiest place to ship a demo that fails at 3 AM. These links separate what moved our response from what looked good in a slide deck.

Part of the series [Building an Enterprise AI Agent Platform in Go](/series/enterprise-ai-agents-go/).

## Featured reading

| Piece | What you'll learn |
|-------|-------------------|
| [AI Incident Triage for SREs — What Actually Helps On-Call](https://stackgen.com/blog/ai-incident-triage-for-sres-what-works-on-call) | Practitioner take on on-call vs demo theater (canonical on StackGen) |
| [The Hypothesis Ladder](/blog/hypothesis-ladder/) | Identity and onset before deploy theories; prove then narrate |
| [Evidence-Gated RCA — Prove, Then Narrate](/blog/evidence-gated-multiplane-rca/) | Structural gates so fluency cannot outrun evidence |
| [AI Agent Root Cause Analysis — Curiosity Before Confidence](/blog/curiosity-before-confidence/) | Soft prompts do not stop bad RCA; hard gates do |
| [SRE for Agentic Systems](/blog/sre-for-agentic-systems/) | Why uptime alone is not enough when agents judge |
| [Single-Agent vs Multi-Agent Orchestration: How to Choose](/blog/single-agent-vs-multi-agent/) | Single-agent vs multi-agent for incident triage — decision framework |

## Related hubs

- [AI agents for SRE](/topics/ai-agents-sre/) — broader SRE + agents map
- [AI agent workflows](/topics/ai-agent-workflows/) — multi-stage bring-up
- [AI agent runtime](/topics/ai-agent-runtime/) — the loop underneath triage agents

{% include subscribe.html %}

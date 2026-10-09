---
layout: post
title: "What Are SRE AI Agents?"
date: 2026-08-07 14:00:00 -0700
last_modified_at: 2026-08-09 17:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 37
description: "What are SRE AI agents? AI for incident triage, diagnostics, and RCA with bounded autonomy — not a chatbot and not open-ended remediation demos."
image: /assets/images/og-default.png
tags: [ai-agents, sre, incident-response, on-call, production, aiden]
permalink: /blog/what-are-sre-ai-agents/
faqs:
  - question: "What are SRE AI agents?"
    answer: "Agents that help site reliability and on-call teams triage incidents, query observability and change planes, and draft evidence-backed next steps — with budgets and human review, not open-ended auto-remediation theater."
  - question: "How is an SRE AI agent different from a chatbot?"
    answer: "A chatbot answers questions in a thread. An SRE agent runs a bounded tool loop against live systems, leaves an auditable trail, and stops when evidence or policy says stop."
  - question: "Should SRE agents remediate automatically?"
    answer: "Not as the first milestone. Start with parallel context gathering and human-reviewable outputs. Remediations need fail-closed gates, receipts, and Judgment-style health checks — not demo confidence."
---

A **site reliability engineering (SRE) AI agent** uses a model and tools to support incident triage: gather observability and change evidence, propose a hypothesis, and draft root cause analysis (RCA) for human review. Unlike a question-answering chat alone, it runs a bounded sequence of tool calls. Automatic remediation is a separate, higher-risk capability, not a prerequisite for triage.

Fast path: [SRE on-call starter pack](/start/sre-on-call/). A topic map is [AI agents for SRE](/topics/ai-agents-sre/). For triage, see [AI incident triage](/topics/ai-incident-triage/). A longer discussion of on-call use is on StackGen: [AI Incident Triage for SREs](https://stackgen.com/blog/ai-incident-triage-for-sres-what-works-on-call).

---

## What good looks like (and what does not)

**Helps on-call**

- Parallel context gathering with a budget (time, tools, tokens)
- Evidence from systems of record — metrics, logs, deploys — with source and time range
- Outputs a human can skim in under a minute: what was checked, what was not, what to do next
- Hard stops when required digs are missing ([curiosity before confidence](/blog/curiosity-before-confidence/))

**Sounds good in a demo**

- A confident causal narrative without enough evidence
- “Root cause: the deploy” before identity and onset are established ([hypothesis ladder](/blog/hypothesis-ladder/))
- Unbounded remediation without approval or rollback controls
- Green HTTP while judgment quietly drifts ([SRE for agentic systems](/blog/sre-for-agentic-systems/))

A fluent explanation is not evidence that the proposed cause is correct.

---

## Triage vs RCA vs remediation

| Mode | Job of the agent | Human role |
| ------ | ------------------ | ------------ |
| **Triage** | Shrink blast radius; decide what to check next | Owns priority and customer impact |
| **RCA** | Eliminate causes with evidence; narrate last | Approves the write-up |
| **Remediation** | Propose or execute a bounded change | Approves mutations; needs receipts |

Triage can remain read-only. Remediation requires separate authorization, rollback planning, and evidence that a proposed action is appropriate; see [demo-to-deploy failure modes](/blog/demo-to-deploy-receipts/).

---

## Where the runtime fits

![Platform policy surrounds a bounded runtime loop that manages model choices, tools, context, stop conditions, and trace](/assets/images/diagrams/aug-runtime/agent-runtime-boundary.svg)

*An SRE agent needs a bounded execution loop, not just a fluent model answer.*

An SRE agent still needs an [AI agent runtime](/topics/ai-agent-runtime/) — the loop that plans, calls tools, and stops. Enterprise packaging (tenancy, policy, many teams) is the [platform layer](/blog/aiden-platform/). Keeping those layers separate helps locate budget enforcement and mid-run steering.

---

## Where to go next

- Hub: [AI agents for SRE](/topics/ai-agents-sre/)
- Hub: [AI incident triage](/topics/ai-incident-triage/)
- Definition: [What Is an AI Agent Runtime?](/blog/what-is-an-ai-agent-runtime/)
- Essay: [What actually helps on-call](https://stackgen.com/blog/ai-incident-triage-for-sres-what-works-on-call)
- Discipline: [Hypothesis ladder](/blog/hypothesis-ladder/) · [Evidence-gated RCA](/blog/evidence-gated-multiplane-rca/)

---

**Acknowledgments.** On-call lessons here draw on the StackGen [Aiden](/about/) SRE work; deeper posts credit named teammates where git history supports it.

*Building AI for incident triage without the demo theater? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> StackGen develops AI tools for site reliability engineering (SRE), including incident triage and diagnostic workflows. Product details are at [ai.stackgen.com](https://ai.stackgen.com).

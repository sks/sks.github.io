---
layout: post
title: "Don't Invent PromQL: Measure the Alert Rule Query First"
date: 2026-08-07 14:00:00 -0700
series: "Service Rendered Efficiently"
series_order: 10
description: "Alert title said latency; the rule was ClickHouse. AI SRE agents that invent PromQL from titles ship wrong RCA. Measure the stored query first."
image: /assets/images/og-default.png
tags: [ai-agents, sre, observability, rca, incident-response, evaluation]
permalink: /blog/measure-the-firing-expression-first/
faqs:
  - question: "Should AI SRE agents trust the alert title for which system to query?"
    answer: "No. The alert rule's stored query is the source of truth. When the title and the stored query disagree (for example title says latency, rule is ClickHouse), measure the rule's real query before broad digs."
  - question: "What happens when AI agents invent PromQL from the alert title?"
    answer: "They query the wrong observability system — metrics vs logs vs warehouse — and narrate confident wrong RCAs while the real signal lived elsewhere."
  - question: "What should happen when the alert title and the rule query disagree?"
    answer: "Force measuring the rule's real query before parallel tool digs. Do not invent PromQL from the title alone."
---

An alert title suggested latency, but the stored rule queried ClickHouse. An AI agent used for site reliability engineering (SRE) could infer a Prometheus Query Language (PromQL) metric from that title and produce the wrong root cause analysis (RCA).

*The incident patterns below are composite and anonymized. Counts are rounded. Names, IDs, and infrastructure details are fictionalized to protect customer confidentiality.*

---

## Start with the alert rule

- **Title ≠ stored query** — read and run the alert rule’s actual query first
- Efficiency is the **right system first** (metrics vs logs vs warehouse), not fewer tool calls on the wrong one
- When title and stored query disagree, measure the stored query before parallel digs
- In these examples, investigators who re-queried the rule found issues missed by agents that searched broadly first

The title is a label, not the measurement definition. Fetch the stored rule expression, check the query backend and time range, and run it before choosing additional data sources.

---

## Composite miss

- Disk / capacity-flavored title
- Agent narrates “>80% capacity storm” without live samples
- Human measures the rule’s stored query, finds a double-count or a warehouse query that never touched Prometheus

Or: AI Governance–style alert; human finds CDN 500s + application exception; agent restates the symptom with `not_enough_information` after querying the wrong place.

This is [hypothesis ladder](/blog/hypothesis-ladder/) discipline applied at the **first** fork: identity of the signal before depth theories.

---

## If you lead an SRE team

- In RCA review: “Did they measure the rule expression?” as a checklist item
- Stop rewarding fluent narratives that never touched the stored query
- Prefer a partial finding after measurement to an unsupported metrics-vs-logs explanation

## If you ship the agent platform

- Detect title-vs-stored-query mismatch early
- Block parallel digs until the expression is measured
- Keep the measured result in evidence the present stage must cite

---

## Related

- Previous: [Empty Query ≠ Absent Signal](/blog/empty-query-not-absent-signal/)
- Next: [Cut the Dead Air Before Investigation Starts](/blog/cut-dead-air-before-investigation/)
- [Hypothesis ladder](/blog/hypothesis-ladder/)
- [Evidence-gated RCA](/blog/evidence-gated-multiplane-rca/)

---

**Acknowledgments.** Signal-quality early-branch lessons from shipping Aiden SRE investigate. Patterns composite.

*Building AI for incident triage without the demo theater? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---
layout: post
title: "Measure the Firing Expression Before You Invent PromQL"
date: 2026-09-01 14:00:00 -0700
series: "Service Rendered Efficiently"
series_order: 10
description: "The alert title said latency. The rule was ClickHouse. Efficiency means measuring the stamped expression before inventing queries."
image: /assets/images/og-default.png
tags: [sre, ai-agents, service, incident-response, aiden, observability, rca]
permalink: /blog/measure-the-firing-expression-first/
faqs:
  - question: "Should AI SRE agents trust the alert title for which plane to query?"
    answer: "No. The rule's stamped query is the source of truth. Title-vs-query plane mismatch is common and should trigger an early branch to measure the expression first."
  - question: "What happens when agents skip measuring the firing expression?"
    answer: "They invent PromQL on the wrong plane and narrate confident wrong RCAs — capacity storms, latency stories — while the real signal lived in another system."
  - question: "What is GATE_MEASURE_THE_EXPR?"
    answer: "A product gate that forces measuring the alert's actual expression before collector fan-out when title and query planes disagree."
---

The alert title said latency. The rule was ClickHouse. The agent queried the wrong plane.

*The incident patterns below are composite and anonymized. Counts are rounded. Names, IDs, and infrastructure details are fictionalized to protect customer confidentiality.*

---

## TL;DR

- **Title ≠ plane** — stamp and measure the firing expression first
- Efficiency is the **right plane first**, not fewer tool calls on the wrong one
- Early branch on title-vs-query mismatch before collector fan-out
- Human investigators who re-query the rule beat “storm-first, measure-second” agents

### Explain like I'm five

If the fire alarm sign says “kitchen” but the sensor wire goes to the basement, you check the basement first. Reading the sign and then searching the kitchen is busy work.

---

## Composite miss

- Disk / capacity-flavored title
- Agent narrates “>80% capacity storm” without live samples
- Human measures the stamped expression, finds a double-count or a warehouse query that never touched Prom

Or: AI Governance–style alert; human finds CDN 500s + application exception; agent restates the symptom with `not_enough_information` after querying the wrong place.

This is [hypothesis ladder](/blog/hypothesis-ladder/) discipline applied at the **first** fork: identity of the signal before depth theories.

---

## If you lead an SRE team

- In RCA review: “Did they measure the rule expression?” as a checklist item
- Stop rewarding fluent narratives that never touched the stamped query
- Prefer agents that say PARTIAL after measuring over agents that invent a plane story

## If you ship the agent platform

- Detect title-vs-query plane mismatch early
- Gate fan-out until the expression is measured
- Keep the measured result in evidence tokens the present stage must cite

---

## Related

- Previous: [Empty Query ≠ Absent Signal](/blog/empty-query-not-absent-signal/)
- Next: [Cut the Dead Air Before Investigation Starts](/blog/cut-dead-air-before-investigation/)
- [Hypothesis ladder](/blog/hypothesis-ladder/)
- [Evidence-gated RCA](/blog/evidence-gated-multiplane-rca/)

---

**Acknowledgments.** Signal-quality early-branch lessons from shipping Aiden SRE investigate. Patterns composite.

*Building AI for incident triage without the demo theater? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---
layout: post
title: "Empty Query ≠ Absent Signal: Plane Blindness and Adaptive Ladders"
date: 2026-07-31 10:00:00 -0700
series: "Service Rendered Efficiently"
series_order: 9
description: "When Grafana says no_data, the investigation isn't over — it's mis-scoped. Plane blindness and adaptive ladders for AI SRE."
image: /assets/images/og-default.png
tags: [sre, ai-agents, service, incident-response, aiden, observability, rca]
permalink: /blog/empty-query-not-absent-signal/
faqs:
  - question: "Does an empty PromQL result mean the signal is absent?"
    answer: "No. Empty or failed queries are often mis-scoped labels, wrong time range, wrong plane, or a transient gateway fault. Exhaust adaptive ladders before declaring not_enough_information."
  - question: "What is plane blindness in AI SRE?"
    answer: "Treating one failed or empty query on one observability plane as proof that metrics or logs do not exist, then filling the gap with a fluent storm narrative."
  - question: "What should skills encode for multi-tenant B2B platforms?"
    answer: "Label discovery, wider ranges than instant-only, and tenant identity resolution chains — the steps senior SREs already run manually."
---

When Grafana says `no_data`, the investigation isn't over. It's mis-scoped.

*The incident patterns below are composite and anonymized. Counts are rounded. Names, IDs, and infrastructure details are fictionalized to protect customer confidentiality.*

---

## TL;DR

- Empty query ≠ absent data
- Live evals: humans re-querying the same labels beat agents that declared metrics “unavailable”
- Adaptive ladders: label discovery, wider ranges, alternate planes
- Skills encode senior SRE craft — that is **Rendered**, not prompt magic

### Explain like I'm five

If you look in the fridge for juice and open only the door for leftovers, empty shelves do not mean there is no juice. Open the other door.

---

## Northstar Platform (composite)

Fictional multi-tenant B2B setup:

- Agent queries instant PromQL with narrow labels → empty
- Declares metrics unavailable; invents a capacity-storm story
- Human runs the same metric with discovered labels and a 7-day range → thousands of series
- Alternate plane has zero matching hosts — that emptiness is real for *that* plane, not a license to stop

Another composite: Kafka lag partition → tenant GUID → customer impact. Instant `count(...)` at alert time returns 0; a week-long range has the mapping. Writing `UNRESOLVED` before the ladder is a common miss.

---

## If you lead an SRE team

- Reject “not enough information” that skipped label and range ladders
- Compare agent digs to a human re-query on the same identity before blaming the model
- Invest in skills that document your tenant → impact resolution chain (genericized for your stack)

## If you ship the agent platform

- Encode plane-blindness recovery as required digs, not optional curiosity
- Distinguish circuit-open / OOM sidecar failures from true empty results
- Keep storm narratives gated behind measured evidence ([hypothesis ladder](/blog/hypothesis-ladder/))

---

## Related

- Previous: [Ungrounded Synthesis as Hypothesis](/blog/ungrounded-synthesis-as-hypothesis/)
- Next: [Measure the Firing Expression First](/blog/measure-the-firing-expression-first/)
- [Hypothesis ladder](/blog/hypothesis-ladder/)

---

**Acknowledgments.** Plane-blindness patterns from live investigate evals and multi-tenant skill work. Customer schemas renamed; narratives composite.

*Building AI for incident triage without the demo theater? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

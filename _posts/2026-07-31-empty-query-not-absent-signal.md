---
layout: post
title: "Empty PromQL ≠ Missing Data: Fix AI SRE Scope Blindness"
date: 2026-07-31 10:00:00 -0700
series: "Service Rendered Efficiently"
series_order: 9
description: "Grafana no_data often means wrong labels, range, or system—not missing signal. Fallback digs AI SRE agents must run before declaring absent data."
image: /assets/images/og-default.png
tags: [ai-agents, sre, observability, rca, incident-response, grafana]
permalink: /blog/empty-query-not-absent-signal/
faqs:
  - question: "Does an empty PromQL result mean the signal is absent?"
    answer: "No. Empty or failed queries are often mis-scoped labels, wrong time range, wrong observability system, or a transient gateway fault. Exhaust fallback digs before declaring not_enough_information."
  - question: "What is scope blindness in AI SRE agents?"
    answer: "Treating one failed or empty query on one observability system (metrics vs logs vs warehouse) as proof that data does not exist, then filling the gap with a fluent storm narrative."
  - question: "What fallback digs should AI SRE agents run after empty Grafana results?"
    answer: "Label discovery, wider time ranges than instant-only, and try another observability system — plus tenant identity resolution chains senior SREs already run manually."
---

When Grafana returns `no_data`, your AI SRE agent’s job is not over. One empty PromQL is usually wrong scope — not proof the signal is gone.

*The incident patterns below are composite and anonymized. Counts are rounded. Names, IDs, and infrastructure details are fictionalized to protect customer confidentiality.*

---

## TL;DR

- Empty query ≠ absent data
- Live evals: humans re-querying the same labels beat agents that declared metrics “unavailable”
- Fallback digs: discover labels, widen the time range, try another observability system
- Skills encode senior SRE craft — that is **Rendered**, not prompt magic

### Explain like I'm five

If you look in the fridge for juice and open only the door for leftovers, empty shelves do not mean there is no juice. Open the other door.

---

## Northstar Platform (composite)

Fictional multi-tenant B2B setup:

- Agent queries instant PromQL with narrow labels → empty
- Declares metrics unavailable; invents a capacity-storm story
- Human runs the same metric with discovered labels and a 7-day range → thousands of series
- Another observability system has zero matching hosts — that emptiness is real for *that* system, not a license to stop

Another composite: Kafka lag partition → tenant GUID → customer impact. Instant `count(...)` at alert time returns 0; a week-long range has the mapping. Writing `UNRESOLVED` before the fallback digs is a common miss.

---

## If you lead an SRE team

- Reject “not enough information” that skipped label and range fallback digs
- Compare agent digs to a human re-query on the same identity before blaming the model
- Invest in skills that document your tenant → impact resolution chain (genericized for your stack)

## If you ship the agent platform

- Treat one empty PromQL as a scope miss until label/range/other-system digs ran
- Distinguish circuit-open / OOM tool-server failures from true empty results
- Keep storm narratives gated behind measured evidence ([hypothesis ladder](/blog/hypothesis-ladder/))

---

## Related

- Previous: [Ungrounded Synthesis as Hypothesis](/blog/ungrounded-synthesis-as-hypothesis/)
- Next: [Measure the Firing Expression First](/blog/measure-the-firing-expression-first/)
- [Hypothesis ladder](/blog/hypothesis-ladder/)

---

**Acknowledgments.** Wrong-system / wrong-scope patterns from live investigate evals and multi-tenant skill work. Customer schemas renamed; narratives composite.

*Building AI for incident triage without the demo theater? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

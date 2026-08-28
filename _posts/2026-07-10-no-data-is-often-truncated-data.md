---
layout: post
title: "\"No Data\" Is Often Truncated Data"
date: 2026-08-30 14:00:00 -0700
series: "Service Rendered Efficiently"
series_order: 6
description: "AI SRE agents calling truncated Grafana previews 'no data' is a product failure — spill recovery and honesty vocabulary fix it."
image: /assets/images/og-default.png
tags: [sre, ai-agents, service, incident-response, aiden, observability, grafana]
permalink: /blog/no-data-is-often-truncated-data/
faqs:
  - question: "Why do AI agents say no data when metrics exist?"
    answer: "Large tool outputs get preview-truncated. Agents answer from the snippet and invent Unavailable. The full series often still sits in a spill file on disk."
  - question: "What is spill recovery for observability tools?"
    answer: "A shared model that forces return_full before pattern greps, pages when byte caps hit, and exposes spill_path for compact aggregates — plus COMPLETE / PARTIAL / FAILED vocabulary."
  - question: "How should agents report incomplete observability evidence?"
    answer: "Say PARTIAL or FAILED with what was retrieved. Never claim no signal when the preview was truncated."
---

Agents were answering from preview snippets of large Grafana outputs and calling it done. Utilization reports said “Unavailable.” The evidence was still on disk.

*The incident patterns below are composite and anonymized. Counts are rounded. Names, IDs, and infrastructure details are fictionalized to protect customer confidentiality.*

---

## TL;DR

- Truncated previews ≠ empty datasources
- Require **return_full** (then page) before grepping patterns
- Expose **spill_path** for compact aggregates
- Honesty vocabulary: **COMPLETE / PARTIAL / FAILED** — never fake “no signal”

### Explain like I'm five

If you only read the first page of a cookbook and say “there are no recipes for pasta,” you are wrong — the pasta chapter was on page forty. Ask for the whole book, or admit you only read the first page.

---

## The failure mode

Large PromQL / LogQL / warehouse results hit context limits. The runtime shows a preview. The model treats the preview as the universe. RCA claims the plane has no data. A human re-runs the same query and gets series.

That is not curiosity. That is **unrendered craft** — the service lied about what it saw.

Related packing discipline: [claim-aware evidence packing](/blog/claim-aware-evidence-packing/).

---

## What fixed it (product shape)

- Shared spill model for large tool outputs
- Mandatory full retrieve before pattern search
- Paging when full retrieve hits byte caps
- `spill_path` available for `jq`-style aggregates without stuffing the whole blob into the chat
- Completeness labels the operator can trust

---

## If you lead an SRE team

- Treat “Unavailable” without a completeness tag as a defect
- Ask “was this preview or full?” in review of agent RCAs
- Prefer PARTIAL with a spill pointer over a confident empty narrative

## If you ship the agent platform

- Do not let models grep truncated previews as if they were complete
- Teach completeness vocabulary in the tool contract, not only in the system prompt
- Keep operator-visible paths to the spill for post-hoc verification

---

## Related

- Previous: [Correlate prior sessions](/blog/correlate-prior-sessions-gate/)
- Next: [Deliver Findings at the Budget Cap](/blog/deliver-findings-at-the-budget-cap/)
- [Claim-aware evidence packing](/blog/claim-aware-evidence-packing/)

---

**Acknowledgments.** Spill recovery lessons from shipping observability tools in the Aiden / Guild stack. Patterns composite.

*Building AI for incident triage without the demo theater? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

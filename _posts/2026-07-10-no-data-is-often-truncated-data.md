---
layout: post
title: "AI Agents Call Truncated Grafana 'No Data'—It's Spill"
date: 2026-07-10 14:00:00 -0700
series: "Service Rendered Efficiently"
series_order: 6
description: "Large tool results get preview-truncated; AI SRE agents invent 'Unavailable.' Spill recovery and COMPLETE/PARTIAL/FAILED fix dishonest RCA."
image: /assets/images/og-default.png
tags: [ai-agents, sre, observability, grafana, rca, context-engineering]
permalink: /blog/no-data-is-often-truncated-data/
faqs:
  - question: "Why do AI SRE agents say no data when Grafana metrics exist?"
    answer: "Large tool outputs get preview-truncated for the context window. Agents answer from the snippet and invent Unavailable. The full series often still sits in a spill file on disk."
  - question: "What is spill recovery for observability tool results?"
    answer: "A shared model that forces return_full before pattern greps, pages when byte caps hit, and exposes spill_path for compact aggregates — plus COMPLETE / PARTIAL / FAILED vocabulary."
  - question: "How should AI agents report incomplete observability evidence?"
    answer: "Say PARTIAL or FAILED with what was retrieved. Never claim no signal when the preview was truncated."
---

Your AI SRE agent skimmed a truncated Grafana preview, wrote “Unavailable,” and closed the dig. The full series was still on disk — truncated tool results, not missing metrics.

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

That is not curiosity. That is **the product lied about completeness** — the service claimed no signal when it only saw a preview.

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

- Sequel: [Cursor paging for spilled agent tool output](/blog/cursor-paging-spilled-agent-tool-output/) — opaque cursors beat grep-as-primary
- Previous: [Correlate prior sessions](/blog/correlate-prior-sessions-gate/)
- Next: [Deliver Findings at the Budget Cap](/blog/deliver-findings-at-the-budget-cap/)
- [Claim-aware evidence packing](/blog/claim-aware-evidence-packing/)

---

**Acknowledgments.** Spill recovery lessons from shipping observability tools in Aiden. Patterns composite.

*Building AI for incident triage without the demo theater? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

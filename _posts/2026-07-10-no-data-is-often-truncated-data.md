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

An incident agent called a Grafana metric “Unavailable” after seeing only a preview of the tool response. The remaining series had been written to a spill file—a disk copy used when a tool result is too large for the model’s context window. In this composite case, incomplete retrieval was mistaken for missing metrics.

*The incident patterns below are composite and anonymized. Counts are rounded. Names, IDs, and infrastructure details are fictionalized to protect customer confidentiality.*

---

## The failure mode

PromQL (Prometheus metric queries), LogQL (log queries), and warehouse queries can return more bytes than the agent can read in one turn. The runtime presents a preview and stores the rest. If the agent treats that preview as the entire result, its root-cause analysis (RCA) can report no data even though a human rerunning the query sees series.

The fault is a missing completeness contract, not evidence that the data source was empty. A genuine empty full result and an unread remainder require different conclusions.

Related packing discipline: [claim-aware evidence packing](/blog/claim-aware-evidence-packing/).

---

## Retrieving and labeling the result

- A shared spill model that marks large tool outputs as previews and retains the full result
- A required `return_full` retrieval before searching the result for patterns
- Paging when `return_full` hits byte caps; a single page is still only partial evidence
- A `spill_path` pointer for `jq`-style aggregates over the stored result without stuffing the whole blob into chat
- Completeness labels: **COMPLETE** only after the requested scope is read, **PARTIAL** when some pages remain, and **FAILED** when retrieval fails. These describe retrieval, not whether the underlying system is healthy

---

## Reviewing an agent RCA

- Treat “Unavailable” without a completeness tag as a defect
- Ask “was this preview or full?” in review of agent RCAs
- Prefer PARTIAL with a spill pointer over a claim of no signal when retrieval is unfinished

## Enforcing this in the platform

- Do not let models grep truncated previews as if they were complete
- Teach completeness vocabulary in the tool contract, not only in the system prompt
- Keep operator-visible, access-controlled paths to the spill for later verification

---

## Related

- Sequel: [Cursor paging for spilled agent tool output](/blog/cursor-paging-spilled-agent-tool-output/) — opaque cursors beat grep-as-primary
- Previous: [Correlate prior sessions](/blog/correlate-prior-sessions-gate/)
- Next: [Deliver Findings at the Budget Cap](/blog/deliver-findings-at-the-budget-cap/)
- [Claim-aware evidence packing](/blog/claim-aware-evidence-packing/)

---

**Acknowledgments.** Spill recovery lessons from shipping observability tools in Aiden. Patterns composite.

*Building AI for incident triage without the demo theater? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---
layout: post
title: "Slack Is a Triage Board, Not a Log Dump"
date: 2026-06-19 10:00:00 -0700
series: "Service Rendered Efficiently"
series_order: 3
description: "Make incident replies in Slack scannable: show counts, findings and uncertainty, with links to evidence and searchable Activity."
image: /assets/images/og-default.png
tags: [sre, ai-agents, service, incident-response, aiden, slack, on-call]
permalink: /blog/slack-is-a-triage-board/
faqs:
  - question: "What should an AI SRE post in Slack during triage?"
    answer: "A concise status with headline counts, numbered alert lines, findings even when the cause is undetermined, and a link to supporting evidence."
  - question: "Should undetermined triage post nothing?"
    answer: "No. Undetermined is not empty. Operators need findings-so-far and what was checked. A bare Incomplete status does not tell on-call what was checked or what to do next."
  - question: "What belongs in Activity search for incidents?"
    answer: "Initiator, Slack thread links, and qualifier search (who started it, which channel) so support can find the conversation without opening every row."
---

In `#incidents-prod`, an on-call site reliability engineering (SRE) operator needs a short status and a route to the evidence. A long transcript is hard to scan; an “Incomplete” card without findings gives no next step.

*The incident patterns below are composite and anonymized. Counts are rounded. Names, IDs, and infrastructure details are fictionalized to protect customer confidentiality.*

---

## What the channel needs

The diagram separates the facts on-call needs in the Slack card from detailed evidence and searchable conversation metadata elsewhere.

![Investigation findings flow into a concise Slack triage card, with links to detailed evidence and authorized Activity search](/assets/images/diagrams/june-foundations/slack-triage-card.svg)

**Helps on-call**

- Headline counts (a compact KPI, or key-performance-indicator strip) and a priority summary that can be skimmed quickly
- Numbered alert inventory with enough identity to open the right dashboard
- Findings when root-cause analysis (RCA) is inconclusive — what was checked, what remains unknown
- A link back to the watch page / session for the underlying evidence

**Erodes trust**

- Dense Slack `mrkdwn` (Slack-formatted text) walls that bury the finding
- “Incomplete” with no findings body
- Activity rows (the product’s investigation history) that hide who started the thread and which Slack channel it came from

Slack Block Kit, the format for structured Slack messages, can carry a compact summary while a web dashboard holds the detail. Full parity is not necessary: the channel should contain the decision-relevant facts and a link to inspect the rest. Avoid posting sensitive raw logs into a broadly visible channel.

---

## If you lead an SRE team

- Review Slack cards with on-call: can a reader identify the alert, current finding, uncertainty, and next action without opening a transcript?
- Distinguish “undetermined with findings” from a completed RCA; partial work is useful but does not resolve the incident
- Make Activity answer “who started this?” and “which channel?” while respecting access controls

## If you ship the agent platform

- Render incident replies as compact structured blocks, not transcript dumps
- Keep undetermined triage on a path that still emits findings-so-far
- Index initiator and Slack thread metadata; support qualifier search (`started_by:`, channel tokens) only for viewers authorized to see those conversations

---

## Related

- Previous: [Stop Re-Investigating the Same Alert](/blog/stop-re-investigating-the-same-alert/)
- Next: [Same Alert, Different Verdict](/blog/same-alert-different-verdict/)
- Series: [Service Rendered Efficiently](/series/service-rendered-efficiently/)

---

**Acknowledgments.** Slack triage UX lessons from shipping Aiden incident replies. Patterns composite.

*If you are building AI for incident triage, Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

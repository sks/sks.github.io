---
layout: post
title: "Slack Is a Triage Board, Not a Log Dump"
date: 2026-08-29 10:00:00 -0700
series: "Service Rendered Efficiently"
series_order: 3
description: "SRE AI in Slack should look like a triage board — KPI strips, findings-so-far, searchable Activity — not a dense log wall."
image: /assets/images/og-default.png
tags: [sre, ai-agents, service, incident-response, aiden, slack, on-call]
permalink: /blog/slack-is-a-triage-board/
faqs:
  - question: "What should an AI SRE post in Slack during triage?"
    answer: "A scannable triage board: headline counts, numbered alert lines, and findings even when RCA is undetermined — not a dense mrkdwn wall or a hollow Incomplete card."
  - question: "Should undetermined triage post nothing?"
    answer: "No. Undetermined is not empty. Operators need findings-so-far and what was checked. Hollow Incomplete cards erode trust faster than a wrong but honest partial."
  - question: "What belongs in Activity search for incidents?"
    answer: "Initiator, Slack thread links, and qualifier search (who started it, which channel) so support can find the conversation without opening every row."
---

Operators @mention the bot in `#incidents-prod` expecting a triage board. What they often get is a log dump — or worse, a hollow “Incomplete” card with nothing to act on.

*The incident patterns below are composite and anonymized. Counts are rounded. Names, IDs, and infrastructure details are fictionalized to protect customer confidentiality.*

---

## TL;DR

- Slack incident UX is part of the **investigation service**, not a logging afterthought
- KPI strip + numbered alerts beats dense prose walls
- **Undetermined ≠ empty** — post findings-so-far
- Activity rows need initiator + thread links with searchable qualifiers

### Explain like I'm five

When you ask “how is the game going?”, you want the score and who has the ball — not every play-by-play mumbled into one paragraph, and not a blank card that says “unclear.”

---

## What good looks like

**Helps on-call**

- Headline counts and priority summary you can skim in seconds
- Numbered alert inventory with enough identity to open the right dashboard
- Real investigation content when RCA is inconclusive — what was checked, what remains unknown
- A link back to the watch page / session for receipts

**Erodes trust**

- Dense mrkdwn walls that bury the finding
- “Incomplete” with no findings body
- Activity rows that hide who started the thread and which Slack channel it came from

Parity between web alert dashboards and Slack Block Kit matters. Operators should not have to open the product UI to get what the channel already needed.

---

## If you lead an SRE team

- Review Slack cards the way you review status pages — scannability is a service SLA
- Treat “undetermined with findings” as a successful delivery of partial work
- Require Activity to answer “who started this?” and “which channel?” without a scavenger hunt

## If you ship the agent platform

- Render incident replies as compact structured blocks, not transcript dumps
- Keep undetermined triage on a path that still emits findings-so-far
- Index initiator and Slack thread metadata; support qualifier search (`started_by:`, channel tokens)

---

## Related

- Previous: [Stop Re-Investigating the Same Alert](/blog/stop-re-investigating-the-same-alert/)
- Next: [Same Alert, Different Verdict](/blog/same-alert-different-verdict/)
- Series: [Service Rendered Efficiently](/series/service-rendered-efficiently/)

---

**Acknowledgments.** Slack triage UX lessons from shipping Aiden incident replies. Patterns composite.

*Building AI for incident triage without the demo theater? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

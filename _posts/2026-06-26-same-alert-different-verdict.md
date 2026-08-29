---
layout: post
title: "Same Alert, Different Verdict: Entry Path Is Context"
date: 2026-06-26 14:00:00 -0700
series: "Service Rendered Efficiently"
series_order: 4
description: "Don't paste the alert in the UI and wonder why Slack gave a different impact score — entry path carries investigation context."
image: /assets/images/og-default.png
tags: [sre, ai-agents, service, incident-response, aiden, on-call, rca]
permalink: /blog/same-alert-different-verdict/
faqs:
  - question: "Why can the same alert get different AI impact scores?"
    answer: "Different entry paths carry different context. Slack threads include rule UID, fingerprint, and thread signals that a UI paste often drops. Alert state can also flip FIRING to RESOLVED between hourly runs."
  - question: "How should operators compare investigation sessions?"
    answer: "Compare watch links from the Slack thread, not by re-pasting alert text into the UI. Thread metadata is part of the evidence."
  - question: "Does verdict drift mean the agent is wrong?"
    answer: "Not always. Entry-path loss and state change between runs explain many high-vs-low impact disagreements without inventing a model failure."
---

Don't paste the alert in the UI and wonder why Slack gave a different impact score.

*The incident patterns below are composite and anonymized. Counts are rounded. Names, IDs, and infrastructure details are fictionalized to protect customer confidentiality.*

---

## TL;DR

- **Entry path is context** — Slack thread signals ≠ UI paste
- Rule UID, fingerprint, and thread history often never make it into a pasted blob
- Hourly cycles can flip FIRING → RESOLVED between runs without the agent “lying”
- Compare sessions via **watch links from Slack**, not re-pasted text

### Explain like I'm five

If you tell two friends the same story, but one also saw the photo album and the other only heard a summary, they will write different book reports. That is not them being random — that is missing context.

---

## Two ingestion paths (composite)

**Path A — Slack thread.** Alert arrives with bot metadata. Operator @mentions. The investigator sees thread signals: rule identity, fingerprints, prior bot posts.

**Path B — UI paste.** Operator copies title + description into chat. Looks similar to a human. Drops structured identity the thread had for free.

**Path C — state change.** Same alert ID, later hour: status is RESOLVED. Impact narrative correctly softens. Compared naively to an earlier FIRING run, it looks like “verdict drift.”

Production debug export analysis for a mid-size SaaS customer showed this pattern repeatedly: high vs low impact on the “same” alert often tracked **how the session started** and **whether the alert was still firing**, not model roulette.

This sits next to [Evidence Discarded After the Lead](/blog/evidence-discarded/) — another failure mode where context that existed was not used. Here the context never arrived.

---

## If you lead an SRE team

- Train on-call: compare investigations from Slack watch links
- Document that Slack-connected ≠ auto-investigate (webhook / poll paths are separate)
- When impact disagrees, ask “same entry path?” before “model broken?”

## If you ship the agent platform

- Prefer structured alert objects over free-text paste for investigate launch
- Preserve thread signals into the investigation context block
- Surface alert state (FIRING / RESOLVED) prominently in the RCA header so humans do not misread time skew as inconsistency

---

## Related

- Previous: [Slack Is a Triage Board](/blog/slack-is-a-triage-board/)
- Next: [When the Operator Asks to Correlate, Make It a Gate](/blog/correlate-prior-sessions-gate/)
- [Evidence discarded](/blog/evidence-discarded/)

---

**Acknowledgments.** Entry-path lessons from customer readiness work and anonymized correlation analysis. Patterns composite.

*Building AI for incident triage without the demo theater? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

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

The same alert text can lead to different impact assessments when an investigation starts from a Slack thread rather than a paste into a web interface. The text may be identical, but the available evidence is not.

*The incident patterns below are composite and anonymized. Counts are rounded. Names, IDs, and infrastructure details are fictionalized to protect customer confidentiality.*

---

## What Changes Between Sessions

In the Slack path, an alert arrives with bot metadata. An operator mentions the investigator in the thread. That session can include a rule UID (unique identifier), an alert fingerprint that links related events, and prior thread posts.

In the web-interface path, an operator pastes the title and description into a chat. The words look similar to a person, but the structured identity and thread history may be missing. In a third case, a later hourly run uses the same alert ID after its status changes from **FIRING** (still active) to **RESOLVED** (no longer firing). A lower current-impact assessment may then be appropriate even if an earlier one was high.

In production debug exports for a mid-size software-as-a-service (SaaS) customer, we repeatedly saw high-versus-low assessments associated with entry path and alert state. These observations do not establish the cause of every disagreement or rule out model error. They suggest checking the evidence and timestamps before treating two outputs as responses to the same inputs.

This is distinct from [Evidence Discarded After the Lead](/blog/evidence-discarded/), where evidence reached the session but was not used. Here some evidence may never reach the investigation at all.

![Slack thread, UI paste, and later hourly run carry different alert identity, thread context, or current status into an assessment.](/assets/images/diagrams/june-operations/alert-entry-context.svg)

The three paths illustrate why matching alert wording is not enough: compare structured context and the time of the alert state before comparing verdicts.

## For On-Call Teams

Compare sessions through the watch links in the Slack thread when possible, rather than creating a new session by pasting alert text. Check the alert state and timing as well as the wording. A Slack connection does not itself mean every alert is investigated automatically: webhook and polling paths are separate. If the impact assessment differs, ask whether the entry paths and alert states matched before concluding the model was inconsistent.

## For Platform Builders

Prefer a structured alert object to free text when launching an investigation. Carry thread metadata into the session, and display **FIRING** or **RESOLVED** prominently in the root-cause analysis (RCA) header. That gives a reviewer a better chance of distinguishing changed evidence from an unexplained change in judgment. It does not guarantee a correct impact score.

## Related

- Previous: [Slack Is a Triage Board](/blog/slack-is-a-triage-board/)
- Next: [When the Operator Asks to Correlate, Make It a Gate](/blog/correlate-prior-sessions-gate/)
- [Evidence discarded](/blog/evidence-discarded/)

---

**Acknowledgments.** Entry-path lessons from customer readiness work and anonymized correlation analysis. Patterns composite.

*If you're working on incident triage, find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

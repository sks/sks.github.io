---
layout: post
title: "When the Operator Asks to Correlate, Make It a Gate"
date: 2026-08-30 10:00:00 -0700
series: "Service Rendered Efficiently"
series_order: 5
description: "Natural-language correlation goals need server-side gates — not hope the LLM remembers to search prior incidents."
image: /assets/images/og-default.png
tags: [sre, ai-agents, service, incident-response, aiden, on-call, workflows]
permalink: /blog/correlate-prior-sessions-gate/
faqs:
  - question: "Why do agents ignore 'correlate with prior incidents'?"
    answer: "Soft prompts are polite suggestions. Without a classified user goal and a hard gate that blocks close until prior search ran, the model can skip correlation and still look done."
  - question: "What is a user-goal gate for correlation?"
    answer: "Server-side intent that stamps correlate_prior_session on the run and refuses verdict/triage accept until prior-incident search and session listing completed."
  - question: "How should operators make correlation intent explicit?"
    answer: "Use an explicit command or phrase the product recognizes (for example /correlate), not only conversational hope."
---

Natural language user goals need server-side gates, not hope the LLM remembers.

*The incident patterns below are composite and anonymized. Counts are rounded. Names, IDs, and infrastructure details are fictionalized to protect customer confidentiality.*

---

## TL;DR

- “Link prior incidents before you close” failed silently when it was only a prompt ask
- Fix: classify chat into a testable **user goal**, stamp session metadata, **hard-reject** close until prior search ran
- Explicit `/correlate` (or equivalent) beats ambient politeness
- Service SRE enforces what operators asked for — it does not trust the model to volunteer it

### Explain like I'm five

If a teacher says “check your homework against last week’s answers before you turn it in,” a sticker on the desk is not enough. The teacher should refuse the homework until you show the checkmark.

---

## The miss

Composite: an operator in Slack asked the investigator to correlate with prior sessions for the same alert family before closing. The run produced a fluent RCA. Nothing in the control plane required a prior-incident search. The ask evaporated.

That is not a creativity failure. It is a **service contract** failure. The human stated a goal; the product treated it as flavor text.

---

## What enforcement looks like

1. Classify the turn into a small set of goals (`investigate`, `correlate_prior_session`, …)
2. Stamp the goal on the session / investigation metadata
3. Block verdict or triage accept until required digs complete — e.g. search prior incidents + list sessions keyed by alert identity
4. Offer an explicit slash command so intent is unambiguous

Webhook trigger acknowledgements that return correlation fields (`run_id`, `invocation_id`, target name) help the same story from the automation side: you can wait on **one** invocation instead of grepping audit logs.

This is the same philosophy as [curiosity before confidence](/blog/curiosity-before-confidence/) and [evidence-gated RCA](/blog/evidence-gated-multiplane-rca/): Go (or the host) owns pass/fail; the model narrates after.

---

## If you lead an SRE team

- Treat missed correlation asks as product bugs, not “operator should have phrased better”
- Require explicit correlate intent for noisy alert families
- Measure how often close happens without prior-session search when the goal was set

## If you ship the agent platform

- Do not rely on system-prompt reminders for correlation
- Hard-gate accept paths on required tools / digs for that user goal
- Return waitable correlation IDs from webhook triggers so eval harnesses and operators share one poll story

---

## Related

- Previous: [Same Alert, Different Verdict](/blog/same-alert-different-verdict/)
- Next: ["No Data" Is Often Truncated Data](/blog/no-data-is-often-truncated-data/)
- [Curiosity before confidence](/blog/curiosity-before-confidence/)

---

**Acknowledgments.** User-goal gating lessons from shipping Aiden SRE investigate. Patterns composite.

*Building AI for incident triage without the demo theater? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---
layout: post
title: "When the Operator Asks to Correlate, Make It a Gate"
date: 2026-07-03 10:00:00 -0700
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

An operator asked an incident-investigation agent to compare the current alert with earlier incidents. The agent wrote a plausible root-cause analysis (RCA) without doing that comparison. A language-model instruction alone did not make the requested search a condition of finishing.

*The incident patterns below are composite and anonymized. Counts are rounded. Names, IDs, and infrastructure details are fictionalized to protect customer confidentiality.*

---

## The miss

Composite: an operator in Slack asked the investigator to correlate with prior sessions for the same alert family before closing. The run produced a fluent RCA. Nothing in the control plane required a prior-incident search. The request was not recorded as a requirement on the run.

The missing comparison was a service-contract failure: the product let the investigation close without checking whether the operator’s requested work happened. A prior match would not necessarily change the verdict, but the search should be visible either way.

---

## What enforcement looks like

1. Classify the operator’s message into a small set of goals (`investigate`, `correlate_prior_session`, …). Classification needs a way to clarify ambiguous requests; it cannot infer intent perfectly.
2. Stamp the goal on the session / investigation metadata
3. Block verdict or triage acceptance until required searches complete — for example, search prior incidents and list sessions keyed by alert identity. Record an explicit unavailable or failed search rather than silently treating it as a match or as no history.
4. Offer an explicit slash command such as `/correlate` for operators who want to remove ambiguity

For automated triggers, webhook acknowledgements can return correlation fields (`run_id`, `invocation_id`, target name). Those identifiers let an operator or test harness wait for one invocation instead of searching audit logs.

The distinction is also central to [curiosity before confidence](/blog/curiosity-before-confidence/) and [evidence-gated RCA](/blog/evidence-gated-multiplane-rca/): host code checks whether the search ran; the model explains what the search found. A gate proves the action occurred, not that the retrieved incident is relevant.

---

## What operators can check

- Treat missed correlation asks as product bugs, not “operator should have phrased better”
- Require explicit correlate intent for noisy alert families
- Measure how often close happens without prior-session search when the goal was set

## What the platform must enforce

- Do not rely on system-prompt reminders for correlation
- Gate acceptance on the required searches for that recorded user goal, while making tool failures and missing history explicit
- Return waitable correlation IDs from webhook triggers so evaluation tests and operators can track the same run

---

## Related

- Previous: [Same Alert, Different Verdict](/blog/same-alert-different-verdict/)
- Next: ["No Data" Is Often Truncated Data](/blog/no-data-is-often-truncated-data/)
- [Curiosity before confidence](/blog/curiosity-before-confidence/)

---

**Acknowledgments.** User-goal gating lessons from shipping Aiden SRE investigate. Patterns composite.

*Building AI for incident triage without the demo theater? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

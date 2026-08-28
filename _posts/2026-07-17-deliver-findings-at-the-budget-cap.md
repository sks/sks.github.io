---
layout: post
title: "Deliver Findings at the Budget Cap — Not an Apology"
date: 2026-08-31 10:00:00 -0700
series: "Service Rendered Efficiently"
series_order: 7
description: "When an SRE AI agent hits MaxLLMCalls, synthesize findings — don't wipe the run with a budget_exhausted apology."
image: /assets/images/og-default.png
tags: [sre, ai-agents, service, incident-response, aiden, tokenomics, on-call]
permalink: /blog/deliver-findings-at-the-budget-cap/
faqs:
  - question: "What should happen when an investigation agent hits its budget?"
    answer: "The last allowed turn should synthesize Theory and Unknowns from evidence already gathered. Findings lead; budget caveats follow. Do not replace the answer with a canned budget_exhausted message."
  - question: "Is hitting MaxLLMCalls a failure?"
    answer: "Hitting a ceiling is normal on long Grafana digs. Zero output at the ceiling is the product failure."
  - question: "How does this relate to loop-detection salvage?"
    answer: "Same service idea: keep useful incident findings when the finishing loop stalls. Budget finalization is the cousin for execution ceilings."
---

Your on-call agent ran out of turns. That should not mean zero RCA.

*The incident patterns below are composite and anonymized. Counts are rounded. Names, IDs, and infrastructure details are fictionalized to protect customer confidentiality.*

---

## TL;DR

- Execution ceilings (max LLM calls, tool iterations, wall clock) are **normal** on long investigations
- Last allowed call should **synthesize what was learned**
- Findings first; budget caveat second
- Preserve tool-call telemetry so postmortems show what was queried

### Explain like I'm five

If the school bell rings while you are writing a book report, turn in the pages you have with a note “I ran out of time.” Do not throw the pages away and hand in a slip that only says “time’s up.”

---

## The wrong product behavior

A twenty-minute Grafana / change-plane dig hits `MaxLLMCalls`. The UI shows a canned exhaustion marker. Everything the agent already collected vanishes behind an apology.

Operators experience that as: “the bot did nothing.” The logs know better. The service failed to **render**.

Cousin: [AI agent loop detection — don't throw away the answer](/blog/ai-agent-loop-detection-salvage/).

---

## The right product behavior

- Detect approaching ceiling
- Force a findings-first finalization turn
- Structure: Theory / Unknowns / what was checked / budget caveat
- Keep tool telemetry attached for humans grading the run

Partial RCA beats silent failure on an incident timeline.

---

## If you lead an SRE team

- Treat zero-output-at-cap as a Sev for the investigation product
- Review salvaged answers as real deliverables with explicit Unknowns
- Size budgets for the dig shape you actually run — then still demand finalization

## If you ship the agent platform

- Implement budget finalization in the expert loop, not as a UI apology
- Prefer preserving observed answers over discarding the run
- Log salvage length so you can measure how often ceilings still produced value

---

## Related

- Previous: ["No Data" Is Often Truncated Data](/blog/no-data-is-often-truncated-data/)
- Next: [Ungrounded Synthesis Must Read as Hypothesis](/blog/ungrounded-synthesis-as-hypothesis/)
- [Loop detection salvage](/blog/ai-agent-loop-detection-salvage/)

---

**Acknowledgments.** Budget finalization lessons from the Aiden agent runtime. Patterns composite.

*Building AI for incident triage without the demo theater? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

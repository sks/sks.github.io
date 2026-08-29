---
layout: post
title: "AI Agent Hit Max Turns? Deliver Partial RCA, Not Apology"
date: 2026-07-17 10:00:00 -0700
series: "Service Rendered Efficiently"
series_order: 7
description: "When an AI SRE agent hits its LLM-call budget, synthesize Theory/Unknowns from gathered evidence. Zero output at the cap is the product failure."
image: /assets/images/og-default.png
tags: [ai-agents, sre, token-cost, on-call, incident-response, rca]
permalink: /blog/deliver-findings-at-the-budget-cap/
faqs:
  - question: "What should happen when an AI SRE agent hits its LLM-call budget?"
    answer: "The last allowed turn should synthesize Theory and Unknowns from evidence already gathered. Findings lead; budget caveats follow. Do not replace the answer with a canned budget_exhausted message."
  - question: "Is hitting the max LLM-call budget a failure for investigate agents?"
    answer: "Hitting a ceiling is normal on long Grafana digs. Zero output at the ceiling — no partial RCA — is the product failure."
  - question: "How does budget finalization relate to loop-detection salvage?"
    answer: "Same idea: keep useful incident findings when the finishing loop stalls. Budget finalization is the cousin for execution ceilings."
---

Your on-call AI SRE agent ran out of turns mid-Grafana dig. That should mean a partial RCA — Theory, Unknowns, what was checked — not a blank `budget_exhausted` apology.

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

A twenty-minute Grafana / change dig hits the max LLM-call budget (`MaxLLMCalls`). The UI shows a canned exhaustion marker. Everything the agent already collected vanishes behind an apology.

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

- Implement budget finalization in the agent loop, not as a UI apology
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

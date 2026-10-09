---
layout: post
title: "AI Agent Hit Max Turns? Deliver Partial RCA, Not Apology"
date: 2026-07-17 10:00:00 -0700
series: "Service Rendered Efficiently"
series_order: 7
description: "When an incident agent reaches a model-call limit, preserve observed findings and label a partial analysis incomplete."
image: /assets/images/og-default.png
tags: [ai-agents, sre, token-cost, on-call, incident-response, rca]
permalink: /blog/deliver-findings-at-the-budget-cap/
faqs:
  - question: "What should happen when an AI SRE agent hits its LLM-call budget?"
    answer: "If time and calls remain, reserve a final turn to summarize observations, tentative theory, and unknowns. Otherwise return saved notes labeled incomplete rather than only a budget_exhausted message."
  - question: "Is hitting the max LLM-call budget a failure for investigate agents?"
    answer: "A ceiling can be reached during long investigations. Treat the loss of collected findings at that ceiling as a product failure; a partial RCA must be labeled incomplete."
  - question: "How does budget finalization relate to loop-detection salvage?"
    answer: "Both preserve useful findings when an agent cannot finish normally. Budget finalization handles resource ceilings; loop-detection salvage handles repetitive execution."
---

An AI agent investigating a service incident may reach its maximum number of model calls while querying Grafana, a monitoring dashboard. The site reliability engineering (SRE) responder still needs the findings collected so far. A partial root-cause analysis (RCA)—possible explanation, unknowns, and checks performed—is more useful than a bare `budget_exhausted` marker, provided it is labeled incomplete.

*The incident patterns below are composite and anonymized. Counts are rounded. Names, IDs, and infrastructure details are fictionalized to protect customer confidentiality.*

---

## Why the ceiling changes the output

An execution ceiling limits model calls, tool iterations, or elapsed time so an investigation cannot run indefinitely. If the agent is close to one, it should reserve room for a final account of what it observed. That account should distinguish a supported finding from an untested theory, state what it could not check, and retain the tool-call record for later review. A hard timeout may prevent even that final call, so the runtime should preserve notes incrementally.

---

## The wrong product behavior

In this composite scenario, a twenty-minute Grafana and deployment-history search hits the maximum large-language-model (LLM) call count (`MaxLLMCalls`). The UI shows a canned exhaustion marker. Everything the agent already collected vanishes behind an apology.

Operators experience that as: “the bot did nothing.” The tool log may still contain useful observations. The product failed to deliver them to the responder.

Cousin: [AI agent loop detection — don't throw away the answer](/blog/ai-agent-loop-detection-salvage/).

---

## The right product behavior

- Detect approaching ceiling
- Reserve a final model call for findings when the remaining budget permits; otherwise return saved notes
- Separate observed findings, tentative theory, unknowns, checks performed, and the budget caveat
- Keep the record of tool calls and their outcomes attached for people reviewing the run

A labeled partial RCA can help during an incident, but it is not a verified root cause.

![Budget-cap flow from saved tool outcomes to a partial findings report, including hard-timeout fallback to notes.](/assets/images/diagrams/july-investigation/deliver-findings-at-the-budget-cap.svg)

*Diagram: The arrows show tool results being saved before the cap, then assembled into a final account if a call remains; the lower path salvages incremental notes when a hard timeout blocks that call.*

---

## If you lead an SRE team

- Treat zero-output-at-cap as a product reliability issue; assign severity according to operational impact
- Review salvaged answers as real deliverables with explicit Unknowns
- Size budgets for the dig shape you actually run — then still demand finalization

## If you ship the agent platform

- Implement budget finalization in the agent loop, not as a UI apology
- Prefer preserving observed answers over discarding the run
- Record how often a budget-limited run delivered findings and whether responders found them useful; length alone is not value

---

## Related

- Previous: ["No Data" Is Often Truncated Data](/blog/no-data-is-often-truncated-data/)
- Next: [Ungrounded Synthesis Must Read as Hypothesis](/blog/ungrounded-synthesis-as-hypothesis/)
- [Loop detection salvage](/blog/ai-agent-loop-detection-salvage/)

---

**Acknowledgments.** Budget finalization lessons from the Aiden agent runtime. Patterns composite.

*Building AI for incident triage without the demo theater? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

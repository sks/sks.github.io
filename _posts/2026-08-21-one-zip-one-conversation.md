---
layout: post
title: "Debug AI Agent Failures: One Zip Per Conversation"
date: 2026-08-21 14:00:00 -0700
series: "Service Rendered Efficiently"
series_order: 12
description: "Support said the AI investigation went wrong. Give one conversation debug zip—not per-execution scavenger hunts—then grade batches into product gates."
image: /assets/images/og-default.png
tags: [ai-agents, sre, evaluation, observability, on-call, incident-response]
permalink: /blog/one-zip-one-conversation/
faqs:
  - question: "What should support get when an AI SRE investigation goes wrong?"
    answer: "One debug zip for the whole conversation — execution DAG, event replay, judge report — not one export per execution they have to hunt down."
  - question: "How does batch grading of agent debug exports improve the product?"
    answer: "A week of anonymized exports showed duplicate investigates, verdict drift by entry path, and missing correlation. That grading prioritized reuse policy and user-goal gates over prompt tweaks."
  - question: "How should you search Activity for a failed AI investigation thread?"
    answer: "Qualifier search for initiator and Slack channel so you can find the thread without opening every row."
---

Support: “this AI investigation went wrong.” You should download **one** debug zip for the whole conversation — then grade a week of those exports to decide what to build next.

*The incident patterns below are composite and anonymized. Counts are rounded. Names, IDs, and infrastructure details are fictionalized to protect customer confidentiality.*

---

## TL;DR

- Per-conversation debug export > per-execution scavenger hunt
- Activity search: initiator + Slack channel qualifiers
- **Methodology:** grade a week of exports → encode fixes as gates (reuse, correlate, honesty about truncated vs full tool output)
- Service SRE learns from the teams you serve by reading their handoffs, not by shipping more frameworks

### Explain like I'm five

If a group project goes wrong, you want the whole folder of what everyone did — not twelve sticky notes in twelve lockers. Then you look at a pile of folders to see the same mistake repeating.

---

## Handoff as service

Support and platform engineers talk in conversations. Debug export that only exists one execution at a time forces them to guess which step mattered. Conversation-scoped zip download (same bundle as the watch page: DAG, event replay, judge report) is the handoff artifact the service owed them.

Pair it with Activity rows that answer who started the thread and which channel it came from. Related honesty about agent observability: [when agent observability lies](/blog/when-agent-observability-lies/).

---

## How batch grading drove the product

Composite table from a **7-day anonymized** export set (rounded):

| Pattern | What we saw | Product response |
|---------|-------------|------------------|
| Duplicate digs | One alert with **20+** full investigates | Reuse-first launch policy |
| Verdict drift | High vs low impact on “same” alert | Document entry-path context; prefer Slack watch links |
| Missed correlate asks | Close without prior-session search | User-goal gates |
| Empty claims | “No data” on truncated previews | Honesty about truncated vs full tool output (`return_full`) |

The rubric was operator-facing: Did we serve the human who already had an RCA? Did we tell the truth about completeness? Could support reproduce the failure from one artifact?

That is **Service Rendered Efficiently** in reverse: measure what you made possible (or failed to), then ship product gates — not demo theater.

Canary evals still matter for live path health ([canary-first consistency](/blog/canary-first-sre-investigate-consistency-evals/)). Debug-zip grading answers a different question: what are we systematically doing to the teams we serve?

---

## If you lead an SRE team

- Require one-zip handoff for any “conversation went wrong” ticket
- Schedule weekly export grading the way you schedule incident review
- Prioritize backlog by recurring service failures (duplicates, dishonest empties), not by shiny agent demos

## If you ship the agent platform

- Conversation-scoped debug download from Activity
- Qualifier search for initiator and channel
- Feed grading themes into gates; keep raw customer exports off the public internet and out of blog posts

---

## Series wrap

You started with a culture frame: not what you built — what you made possible. The posts in between were receipts: reuse, Slack triage boards, entry path, correlation gates, honesty about truncated tool output, budget findings, hypothesis delivery, fallback digs for empty queries, measure the rule’s stored query first, cold start, and this handoff loop.

Archive: [Service Rendered Efficiently](/series/service-rendered-efficiently/). Checklist: [SRE as service](/checklists/sre-as-service/). Starter: [SRE as service pack](/start/sre-as-service/).

---

**Acknowledgments.** Debug export and Activity search lessons from shipping Aiden. Batch grading described without customer identifiers.

*Building AI for incident triage without the demo theater? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

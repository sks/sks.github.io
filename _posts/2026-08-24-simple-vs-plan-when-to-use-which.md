---
layout: post
title: "Simple vs Plan: When to Use Which (AppWorld smoke cohort)"
date: 2026-08-24 20:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 53
description: "Simple vs plan on AppWorld skills smoke: plan scores higher on some tasks, ties on another, and costs more in this three-task sample. Choose the mode that fits the job — both belong in the toolkit."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, multi-agent, orchestration, appworld, benchmarking, tokenomics, workflows, aiden]
permalink: /blog/simple-vs-plan-when-to-use-which/
faqs:
  - question: "Should I always use plan mode instead of simple mode?"
    answer: "No. Plan won quality on some AppWorld smoke tasks and tied on others — while costing ~2–4× wall time and ~5–6× total prompt tokens. Use plan when the errand needs collect→classify→mutate, tool packing, or a focused worker; use simple for speed, cost, and shallow single-hop work."
  - question: "When is simple mode the better default?"
    answer: "When you want lower latency and cost, the job is a shallow or single-hop errand, or you need a tight context budget on one agent. On our smoke cohort, simple matched plan on a hard Spotify action task (28.6% each) while finishing in tens of seconds instead of minutes."
  - question: "When is plan mode worth the orchestration tax?"
    answer: "When the job may benefit from a coordinator plus focused workers — multi-step collect→classify→mutate flows, packed tool lists, or Q&A that needs a specialist. Confirm the benefit against added time and tokens on your tasks. On our cohort, plan cleared a Spotify Q&A task that simple only half-cleared (100% vs 50%)."
  - question: "Does plan mode always use more context than simple?"
    answer: "Total prompt across the run is higher (~5–6× on this cohort). Peak on the final coordinator turn is often similar to — or smaller than — simple’s single seat, because workers absorb the bulk and handoffs stay compact (<2KB)."
  - question: "What AppWorld series are these numbers from?"
    answer: "Series simple-vs-plan-3-20260824T213004Z — three skills_smoke_3 tasks (Spotify rate liked songs, Venmo like roommate txs, Spotify most-recommended artist Q&A). Directional n=3; not a product scorecard."
---

Earlier this week, [planning beat reacting](/blog/multi-agent-vs-single-agent-mcp-tool-tax-pass-at-k/) on a couple of AppWorld tasks — and paid the [orchestration tax](/blog/agent-orchestration-tax-evals/) for it. That could suggest planning always wins, but this three-task follow-up does not support a general rule.

We ran a small **simple vs plan** smoke on three skill-shaped errands. Plan passed one task and had a higher partial score on another. Simple matched plan on a hard action task while spending far less. The practical choice depends on the task and the costs you can tolerate. Keep both modes available while measuring them on your own work.

Dataset: [AppWorld](https://github.com/stonybrooknlp/appworld), a simulated-app benchmark, via Model Context Protocol (MCP), the interface for app actions. Runtime: Aiden. Series id: `simple-vs-plan-3-20260824T213004Z`. **n = 3 tasks — directional, not a launch scorecard.**

---

## What happened in the three tasks

Both paths scored **28.6%** on a Spotify action task and failed the strict check. On a Venmo task, the planner scored **83.3%** versus **66.7%**, but both still failed. On a Spotify question-answering task, the planner reached **100%** and passed, versus **50%** for the single agent. These percentages are checks passed inside AppWorld, not success probabilities. In this sample, the single agent finished in **~40–73 seconds**; planning took **~141–275 seconds** and **~5–6×** the total prompt text processed. If speed matters and the task is straightforward, start with one agent. Consider a planner for work that benefits from a narrow worker goal, then verify that benefit against its time and cost on more tasks.

---

## Scorecard (skills_smoke_3)

| Task | Simple % | Plan % | Strict | Winner |
|------|---------:|-------:|--------|--------|
| uc-06 Spotify rate liked playlist songs (`692c77d_1`) | 28.6 | 28.6 | both fail | **tie** |
| uc-07 Venmo like roommate transactions (`2a163ab_1`) | 66.7 | 83.3 | both fail | **plan on partial checks only** |
| uc-10 Spotify most-recommended artist Q&A (`287e338_1`) | 50.0 | 100.0 | plan pass | **plan** |

*Caption: pass percentages from AppWorld `/evaluate` · series `simple-vs-plan-3-20260824T213004Z`.*

**What the table is not saying:** “retire simple.” On uc-06, simple matched plan on a multi-step Spotify action while burning a fraction of the wall clock. On uc-10, the focused-worker run passed while the single-agent run did not; the sample does not prove which part of the plan caused the difference.

---

## Cost and context (approx)

| Mode | Wall time | Prompt shape |
|------|-----------|--------------|
| **Simple** | ~40–73s | One agent; final context ~15–16k; Σ prompt ~15–16k |
| **Plan** | ~141–275s (~2–4×) | Σ prompt ~5–6× higher (orchestration tax); final coordinator turn often similar to or *smaller* than simple’s single turn |

Workers absorbed the bulk of the tokens. Subagent isolation held — compact handoffs stayed under **2KB**, same class of boundary we saw in the [MCP tool-tax post](/blog/multi-agent-vs-single-agent-mcp-tool-tax-pass-at-k/).

**Monday-morning rule:** quote **peak per seat** *and* **sum across the run**. If you only watch the coordinator gauge, plan can look “smaller.” If you only watch the sum, simple looks “cheaper.” Ship with both numbers on the receipt.

---

## When to use which

![Decision fork from task shape to simple agent or plan worker, converging on judge outcome, failure class, wall time and total prompt](/assets/images/diagrams/aug-evals/simple-plan-routing.svg)

*Caption: Route by task shape, then test strict outcome and cost rather than declaring a universal mode winner.*

| Reach for **simple** when… | Reach for **plan** when… |
|----------------------------|--------------------------|
| Latency or $ matter more than a few points of judge score | The errand is **collect → classify → mutate** |
| The job is shallow / single-hop | You need **tool packing** (narrow tools on a worker) |
| You want a **tight context budget on one agent** | Q&A benefits from a **focused worker** (uc-10) |
| You’re still debugging the harness, not routing policy | You’ve already paid for fairness and want isolation |

Neither column is “smarter.” Simple is not dumb — it can **tie plan on hard action work** (uc-06) while finishing in under a minute. Plan is not free — you may gain task-specific quality at a cost in wall time and tokens; this small sample does not guarantee that tradeoff on other work.

One harness note that keeps paying off: document the **real MCP tool names** workers should call (e.g. `review_song`, `delete_account`, `create_file`). Wrong names burn turns on create-agent rewrites instead of domain work — a quiet tax that hits plan harder because workers inherit the packing list.

---

## What we are not claiming

- This is **not** “plan always wins” or “simple is obsolete.”
- **n = 3** smoke tasks with no repeated trials here — use them to form routing hypotheses, not to crown an architecture.
- Strict AppWorld success is still a separate bar from pass% — two of three tasks failed strict in both modes.

For the earlier cohort where plan moved failure classes (mutations vs wording) and paid catalog tax, see [Multi-Agent vs Single-Agent: MCP Tool Tax + pass@k](/blog/multi-agent-vs-single-agent-mcp-tool-tax-pass-at-k/).

---

## Monday-morning checklist

1. Classify the errand: shallow hop vs collect→classify→mutate vs focused Q&A.
2. Default **simple** when speed/cost dominate; escalate to **plan** when isolation or packing is the product.
3. Log peak **and** total prompt; assert handoff bytes stay bounded.
4. Record failure class next to pass% — a 83% with progress is a different ticket than a 28% tie on the wrong mutation.
5. Keep both modes in the product — routing is a feature, not a religion.

---

## Related reading

- [Multi-Agent vs Single-Agent: MCP Tool Tax + pass@k](/blog/multi-agent-vs-single-agent-mcp-tool-tax-pass-at-k/)
- [Agent orchestration tax](/blog/agent-orchestration-tax-evals/)
- [Single-Agent vs Multi-Agent Orchestration: How to Choose](/blog/single-agent-vs-multi-agent/)
- [How to evaluate AI agents: clarify + zero-tool failures](/blog/how-to-evaluate-ai-agents-clarifying-questions-zero-tool-calls/)
- [Fair agent evals before performance](/blog/fair-agent-evals-before-performance/)
- [Running AppWorld locally](/blog/running-appworld-locally-genie-agent-eval/)

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

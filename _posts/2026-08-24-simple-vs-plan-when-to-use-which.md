---
layout: post
title: "Simple vs Plan: When to Use Which (AppWorld smoke cohort)"
date: 2026-08-24 20:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 53
description: "Simple vs plan on AppWorld skills smoke: plan wins some tasks, ties on others, and always costs more. Choose the mode that fits the job — both belong in the toolkit."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, multi-agent, orchestration, appworld, benchmarking, tokenomics, workflows, aiden]
permalink: /blog/simple-vs-plan-when-to-use-which/
faqs:
  - question: "Should I always use plan mode instead of simple mode?"
    answer: "No. Plan won quality on some AppWorld smoke tasks and tied on others — while costing ~2–4× wall time and ~5–6× total prompt tokens. Use plan when the errand needs collect→classify→mutate, tool packing, or a focused worker; use simple for speed, cost, and shallow single-hop work."
  - question: "When is simple mode the better default?"
    answer: "When you want lower latency and cost, the job is a shallow or single-hop errand, or you need a tight context budget on one agent. On our smoke cohort, simple matched plan on a hard Spotify action task (28.6% each) while finishing in tens of seconds instead of minutes."
  - question: "When is plan mode worth the orchestration tax?"
    answer: "When the job benefits from a coordinator plus focused workers — multi-step collect→classify→mutate flows, packed tool lists, or Q&A that needs a specialist. On our cohort, plan cleared a Spotify Q&A task that simple only half-cleared (100% vs 50%)."
  - question: "Does plan mode always use more context than simple?"
    answer: "Total prompt across the run is higher (~5–6× on this cohort). Peak on the final coordinator turn is often similar to — or smaller than — simple’s single seat, because workers absorb the bulk and handoffs stay compact (<2KB)."
  - question: "What AppWorld series are these numbers from?"
    answer: "Series simple-vs-plan-3-20260824T213004Z — three skills_smoke_3 tasks (Spotify rate liked songs, Venmo like roommate txs, Spotify most-recommended artist Q&A). Directional n=3; not a product scorecard."
---

Earlier this week, [planning beat reacting](/blog/multi-agent-vs-single-agent-mcp-tool-tax-pass-at-k/) on a couple of AppWorld tasks — and paid the [orchestration tax](/blog/agent-orchestration-tax-evals/) for it. Easy takeaway: *plan always wins*.

Wrong takeaway.

We ran a small **simple vs plan** smoke on three skill-shaped errands. Plan won some. Simple matched plan on a hard action task while spending far less. The hopeful version: **both modes belong in the toolkit** — pick the one that fits the job.

Dataset: [AppWorld](https://github.com/stonybrooknlp/appworld) via MCP. Runtime: Aiden. Series id: `simple-vs-plan-3-20260824T213004Z`. **n = 3 tasks — directional, not a launch scorecard.**

---

## TL;DR

- **uc-06** (Spotify rate liked playlist songs): **28.6% / 28.6%** — tie; both miss strict.
- **uc-07** (Venmo like roommate transactions): **66.7% → 83.3%** — plan ahead; both still miss strict.
- **uc-10** (Spotify most-recommended artist Q&A): **50% → 100%** — clear plan win (strict pass).
- **Cost:** simple finishes in **~40–73s** with **~15–16k** prompt on one seat; plan takes **~141–275s (~2–4×)** and **~5–6×** total prompt — workers absorb bulk; handoffs stayed **&lt;2KB**.
- **Rule:** simple for speed/cost/shallow hops; plan for collect→classify→mutate, tool packing, or focused-worker Q&A.

### Explain like I'm five

Sometimes one person with a shopping list is enough. Sometimes you need a foreman who sends specialists. Hiring the whole crew for milk is wasteful. Sending one person to rebuild a kitchen alone is also wasteful. Match the crew to the errand.

---

## Scorecard (skills_smoke_3)

| Task | Simple % | Plan % | Strict | Winner |
|------|---------:|-------:|--------|--------|
| uc-06 Spotify rate liked playlist songs (`692c77d_1`) | 28.6 | 28.6 | both fail | **tie** |
| uc-07 Venmo like roommate transactions (`2a163ab_1`) | 66.7 | 83.3 | both fail | **plan** |
| uc-10 Spotify most-recommended artist Q&A (`287e338_1`) | 50.0 | 100.0 | plan pass | **plan** |

*Caption: pass percentages from AppWorld `/evaluate` · series `simple-vs-plan-3-20260824T213004Z`.*

**What the table is not saying:** “retire simple.” On uc-06, simple matched plan on a multi-step Spotify action while burning a fraction of the wall clock. On uc-10, a focused worker was the difference between a half-answer and a clear win.

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

| Reach for **simple** when… | Reach for **plan** when… |
|----------------------------|--------------------------|
| Latency or $ matter more than a few points of judge score | The errand is **collect → classify → mutate** |
| The job is shallow / single-hop | You need **tool packing** (narrow tools on a worker) |
| You want a **tight context budget on one agent** | Q&A benefits from a **focused worker** (uc-10) |
| You’re still debugging the harness, not routing policy | You’ve already paid for fairness and want isolation |

Neither column is “smarter.” Simple is not dumb — it can **tie plan on hard action work** (uc-06) while finishing in under a minute. Plan is not free — you buy quality headroom with wall time and a token tax.

One harness note that keeps paying off: document the **real MCP tool names** workers should call (e.g. `review_song`, `delete_account`, `create_file`). Wrong names burn turns on create-agent rewrites instead of domain work — a quiet tax that hits plan harder because workers inherit the packing list.

---

## What we are not claiming

- This is **not** “plan always wins” or “simple is obsolete.”
- **n = 3** smoke tasks — use it to tune routing intuition, not to crown an architecture.
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

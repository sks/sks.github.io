---
layout: post
title: "Multi-Agent vs Single-Agent: When Planning Beats Reacting (MCP Tool Tax + pass@k)"
date: 2026-08-24 16:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 52
description: "Single-agent MCP loaded 453 tools (~17k peak). A planner peaked lower, spent ~2× total tokens, and sometimes won quality. Report pass@1 and pass@3 — that is not pass^k."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, multi-agent, orchestration, mcp, appworld, benchmarking, tokenomics, workflows]
permalink: /blog/multi-agent-vs-single-agent-mcp-tool-tax-pass-at-k/
faqs:
  - question: "Should I use multi-agent or a single agent for MCP tool tasks?"
    answer: "Start single-agent. Add a planner only when focused worker goals or tool isolation beat the orchestration tax on your slice. On AppWorld, plan won quality on two tasks but paid ~2× total prompt tokens and four LLM calls vs one."
  - question: "Why does single-agent mode peak higher than plan mode on MCP context?"
    answer: "Simple mode loads the full MCP tool catalog into one agent (~453 tools → ~17k peak prompt). Plan's coordinator only sees meta-tools plus compact handoffs, so peak stays ~9.4k even when total tokens across agents are higher."
  - question: "What is pass@k vs pass^k for agent evals?"
    answer: "pass@k: at least one of k attempts succeeds (capability). pass^k: all k attempts succeed (consistency). Our cohort reports pass@1 and pass@3 only — we did not measure pass^k."
  - question: "Does subagent tool history inflate the orchestrator prompt?"
    answer: "Not on our plan run. Worker peaked ~9k prompt tokens; create_agent returned a 292-byte JSON summary; coordinator next peak stayed ~9.4k — same order of magnitude, not stacked transcripts."
  - question: "When did planning beat reacting on AppWorld?"
    answer: "On two directional task pairs after harness fixes: movie SMS 87.5%→100% (strict pass only for plan) and Venmo refund 0%→85.7% (both fail strict). n=2 — not a universal routing rule."
---

After fixing [unattended-test failures](/blog/how-to-evaluate-ai-agents-clarifying-questions-zero-tool-calls/), we saw a planner help on some AppWorld tasks while using more total model input. A planner coordinates a worker with a narrower goal; a single agent keeps all available actions in one conversation. Measure both the largest prompt in any one model call and the sum across calls before choosing.

Same [AppWorld](https://github.com/stonybrooknlp/appworld) stack rebuild (453 MCP tools) through the **Aiden agent runtime**. Part of the [AI agent evaluation series](/blog/fair-agent-evals-before-performance/). Earlier posts often showed plan **losing** to a direct MCP baseline when orchestration blocked before domain bugs mattered. In two task pairs after fixes, plan improved partial scores, but only one of those two passed the strict judge check. A follow-up smoke cohort ([simple vs plan: when to use which](/blog/simple-vs-plan-when-to-use-which/)) shows plan is not universal: simple ties on hard action tasks and wins on speed/cost.

---

## What the two task pairs show

For the movie-list SMS, the single agent reached the apps but received **87.5%** because its answer included the wrong titles; the planner’s focused worker produced the David Fincher subset and passed at **100%**. For a Venmo refund, the single agent made no database writes (**0%**), while the planner made the changes but still failed the final answer check (**85.7%**). That is one strict pass across these two plan runs, not a broad “planner wins” result. On the movie task, the planner’s largest coordinator prompt was **9,398 tokens** against **17,268** for simple mode, but it used roughly **32,000 total prompt tokens** across four model calls against **17,268** in one. Narrower context per call can cost more overall.

---

## Setup (same experiment as the harness post)

| Mode | Shape |
|------|-------|
| **Simple** (single-agent) | One agent + full MCP catalog |
| **Plan** (multi-agent) | Coordinator + worker with explicit tool list |

Judge: AppWorld `/evaluate`. Numbers from series run 2026-08-24; **n = 2 tasks for quality A/B, directional — not a product scorecard.**

---

## When planning beat reacting (quality)

| Task (English name) | Single-agent | Plan | What changed |
|---------------------|-------------:|-----:|--------------|
| Movie list SMS to Christopher (`29caf6f_1`) | **87.5%** fail — `assert answers match` | **100%** pass | Worker goal filtered to David Fincher titles (`Fight Club`, `The Social Network`) |
| Venmo refund (`60d0b5b_1`) | **0%** fail — no DB mutations | **85.7%** fail — `assert answers match` only | Plan moved failure from **no mutation** to **answer wording** |

**Movie SMS:** simple reached tools and SMS but the final answer string missed the judge. Score **87.5%** vs **100%** — not “simple never tried.” In this run, the focused worker goal coincided with a correct answer; one pair cannot isolate the goal wording as the cause.

**Venmo:** simple loop-trapped with **no** `venmo.Transaction` writes (**0%**). Plan’s worker performed Venmo ops (**85.7%**) — only wording failed. That is progress you can tune; 0% is not.

When comparing modes, record **failure class** next to pass% — an 85.7% with mutations is a different ticket than 0% with none.

---

## MCP tool catalog tax: peak ≠ total

With **453 MCP tools** after stack rebuild, simple mode pays the full catalog in one prompt. Plan’s coordinator sees meta-tools (`search_tools`, `create_agent`, …) plus compact handoffs.

| Task | Mode | Coordinator peak prompt | Total prompt (all agents) | LLM calls |
|------|------|------------------------:|--------------------------:|----------:|
| Movie SMS (`29caf6f_1`) | Simple | **17,268** | 17,268 | 1 |
| Movie SMS (`29caf6f_1`) | Plan | **9,398** | ~32,000 | 4 |
| Venmo refund (`60d0b5b_1`) | Simple | **11,873** | 11,873 | 1 |
| Venmo refund (`60d0b5b_1`) | Plan | **9,501** | ~29,902 | 4 |

*Caption: n=2 task pairs · directional · from `agent call completed` in run logs.*

| Metric you might quote | Who wins on this cohort |
|------------------------|-------------------------|
| Coordinator / root **peak** prompt | Plan (~9.4k vs 11.9–17.3k) |
| **Total** prompt across agents | Simple (one call) |
| LLM call count | Simple (1 vs 4) |

**Monday-morning rule:** log **peak prompt per agent role** *and* **summed prompt across the run**. If you only watch the orchestrator gauge, plan looks “smaller.” If you only watch the sum, simple looks “cheaper.” Neither is the ship gate alone.

This matches the [orchestration tax](/blog/agent-orchestration-tax-evals/) story with a sharper split: **per-turn context pressure** vs **end-to-end token budget**. Official [MCP client guidance](https://modelcontextprotocol.io/docs/2026-07-28/develop/clients/client-best-practices) now recommends progressive tool loading when catalogs eat the context window — our numbers are one measured example of that tax.

---

## Delegation is a summary boundary, not a memory leak

Assumption worth testing: *subagent context should not inflate the orchestrator.*

On plan **movie SMS** (`29caf6f_1`), it held:

| Stage | What we measured |
|-------|------------------|
| Worker full tool transcript | Peak prompt **9,003** |
| `create_agent` handoff | **292 bytes** JSON summary |
| Coordinator next turn | Peak **9,398** |
| Final answer | Two movie titles |

Worker did phone login, note read, SMS send — full tool JSON stayed on the worker branch. Log shape: `sub-agent result stored in working memory` … `length:292`.

**Observation in this trace:** the handoff was short, and the coordinator prompt did not grow by the size of the worker transcript. That does not prove every handoff excludes sensitive data; inspect and redact summaries as well.

**Caveat:** structured notes in the handoff and episodic importance scoring (~4.9k prompt) are **orchestration tax**, not a leak. Separate them in traces.

**Harness check:** keep the handoff small and inspect its contents. Comparing handoff bytes with worker prompt tokens is only a rough warning sign because bytes and tokens are different units; a growing coordinator prompt calls for trace inspection, not an automatic leak verdict.

Contrast with [zero-tool delegation theater](/blog/how-to-evaluate-ai-agents-clarifying-questions-zero-tool-calls/): a clean summary of *no work* is still a failure.

---

## pass@1 vs pass@3 (and why this is not pass^k)

Four-task plan cohort: **3/4 pass@3**, not **3/4 pass@1**.

| Task | pass@1 | pass@3 | What changed across attempts |
|------|--------|--------|------------------------------|
| Movie SMS (`29caf6f_1`) | fail (87.5%) | **pass** | Attempt 1: over-broad list; attempt 2: clarify stall; attempt 3: Fincher subset |
| Splitwise invites (`3aa1a22_3`) | pass | pass | Sim-time filtering (prior fix) |
| Venmo refund (`60d0b5b_1`) | pass | pass | Clean Venmo path |
| Spotify playlist (`b0a8eae_3`) | fail | fail (so far) | Orchestration + tool-pack gaps |

### pass@k vs pass^k (six-line box)

| Metric | Question it answers | Behavior as k grows |
|--------|---------------------|---------------------|
| **pass@k** | Did at least one of k observed attempts pass? | Cannot decrease as attempts are added to the same set |
| **pass^k** | Did all k observed attempts pass? | Cannot increase as attempts are added to the same set |

**This cohort:** we report **pass@1** and **pass@3** only. We did **not** measure pass^k (all three attempts must pass). A single successful trace is not a reliability estimate or a release gate.

See [τ-bench on pass^k](https://qaskills.sh/blog/tau-bench-agent-evaluation-guide-2026) and [Anthropic on agent evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) for the general reliability framing.

Log **failure class per attempt** (`instruction_over_broad`, `clarifying_question`, `zero_tool_worker`) — not just the final judge bit.

---

## Monday-morning checklist

1. Deny clarify tools in unattended benchmark config ([harness post](/blog/how-to-evaluate-ai-agents-clarifying-questions-zero-tool-calls/)).
2. Count domain MCP calls per worker — zero mutations = fail.
3. Classify failures before comparing single-agent vs plan.
4. Quote **peak and total** prompt tokens — not one or the other.
5. Assert handoff bytes stay bounded vs worker peak context.
6. Report **pass@1 and pass@3**; say explicitly if you did not run pass^k.

---

## Related reading

- [Simple vs Plan: When to Use Which](/blog/simple-vs-plan-when-to-use-which/) — smoke cohort: plan wins some, ties some; choose by fit
- [How to evaluate AI agents: clarify + zero-tool failures](/blog/how-to-evaluate-ai-agents-clarifying-questions-zero-tool-calls/)
- [Agent orchestration tax](/blog/agent-orchestration-tax-evals/)
- [Fair agent evals before performance](/blog/fair-agent-evals-before-performance/)
- [Stop duplicate agent workers](/blog/stop-duplicate-agent-workers-handoff-gate/)
- [AI agent eval failure modes](/blog/ai-agent-eval-failure-modes/)
- [Running AppWorld locally](/blog/running-appworld-locally-genie-agent-eval/)

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

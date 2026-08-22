---
layout: post
title: "Fair Agent Evals: Don't Compare Planner vs Single-Agent Until Tools Match"
date: 2026-08-14 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 46
description: "Fair agent evals for planner vs single-agent: match domain tool access on workers before you compare tokens, pass rate, or declare a routing winner."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, benchmarking, multi-agent, workflows, orchestration, mcp, aiden, production]
permalink: /blog/fair-agent-evals-before-performance/
faqs:
  - question: "What makes an AI agent evaluation fair when comparing planner vs single-agent?"
    answer: "Both paths must reach the same domain tools on the worker that actually mutates state. The planner root may stay meta-only, but the subcontractor must get the full MCP pack. Also match unattended mode, judge parsing, budgets, and record whether tools were hard-denied vs soft-dropped."
  - question: "Why did our planner look cheaper before we fixed the handoff?"
    answer: "The planner path spent budget on spawn and repair while workers called zero domain APIs. That is a wiring bug, not evidence that orchestration is efficient. Cheap runs that never touch the benchmark APIs are invalid comparisons."
  - question: "How do you evaluate AI agents that use MCP tools?"
    answer: "Log tool-access parity first: which names were on the root vs worker registry, whether create-worker calls hard-failed on missing names, and whether parent telemetry double-counts subagent calls. Only then compare tokens, iterations, and external judge pass rate."
  - question: "Does AppWorld judge pass mean the agent succeeded?"
    answer: "AppWorld publishes TGC/SGC through its own evaluate harness — not your runtime's self-report. If the agent never calls evaluate, or prose says PASS while the judge returns false, the eval failed regardless of fluent narration."
  - question: "Is this only about one agent runtime?"
    answer: "No. Any planner-worker shape — LangGraph, CrewAI, AutoGen, OpenAI Agents, or an in-house tree — needs the same fairness gate before you compare modes."
---

If you are trying to **evaluate AI agents** on a tool-using benchmark, the first question is not “which mode wins?” It is **whether both modes could use the same tools on the worker that does the work.**

We ran paired evals on [AppWorld](https://github.com/stonybrooknlp/appworld) — a controllable multi-app benchmark ([paper](https://arxiv.org/abs/2407.18901)) — through our agent runtime in Aiden, with domain APIs exposed via [Model Context Protocol](https://modelcontextprotocol.io/) (MCP). The early numbers lied. The planner path looked cheaper until we realized workers often had **zero** domain API calls while the single-agent loop was doing the job.

This post is part one of a three-part series on **fair agent evals**: fix tool parity, then measure orchestration tax, then classify failure modes. Part two: [orchestration tax](/blog/agent-orchestration-tax-evals/). Part three: [failure modes](/blog/ai-agent-eval-failure-modes/).

---

## TL;DR

- **Unfair eval:** planner workers never received the domain MCP pack → “cheaper” planner, **0** domain calls, hallucinated success in transcripts.
- **Fairness gate:** after handoff fix, **10/10** pairs passed tool-access checks on a mixed ten-task cohort; workers averaged **~20** domain calls vs **~14** on single-agent — both sides actually ran the benchmark.
- **Judge pass stayed 0** for both modes on every clean cohort we finished — fairness fixes *measurement*, not magic scores.
- **Monday-morning rule:** do not publish planner vs single-agent numbers until the worker registry shows the same domain tools you expect on the root in simple mode.

### Explain like I'm five

Comparing two cooks is unfair if one gets ingredients and the other only gets a phone to call a helper who was never given a kitchen key. The helper might write a beautiful note saying dinner is ready. You still have no food.

---

## What we were actually comparing

Two execution shapes on the same AppWorld tasks:

| Shape | Who calls domain APIs | Typical orchestration |
|-------|----------------------|------------------------|
| **Single-agent loop** | Root agent holds the full MCP tool pack | One plan → tool → context cycle |
| **Planner + worker** | Meta root delegates; **worker** should hold the MCP pack | Spawn subcontractor with explicit `tool_names` |

The benchmark judge is AppWorld’s own **evaluate** step (their TGC/SGC — task goal completion / scenario goal completion). We treat that as ground truth, not assistant prose. Telemetry came from [Langfuse](https://langfuse.com/) generation counts (aggregates only in this write-up).

This is the eval sequel to [single-agent vs multi-agent orchestration](/blog/single-agent-vs-multi-agent/) — same “match the axes” discipline, applied to a public tool benchmark instead of a single-plane triage dig.

---

## The unfair run (why the planner looked cheap)

On an early three-task smoke, averages looked like this:

| Mode | Avg domain API calls | Avg worker spawns | What actually happened |
|------|---------------------:|------------------:|------------------------|
| Single-agent | **~14** | **0** | Linear `load → login → call → evaluate` |
| Planner | **0** | **~1.3** | Root spawned workers; workers often had **no** domain tools |

The planner path burned tokens on `create_agent` / `search_tools` while never calling the apps under test. In at least one run the transcript claimed export success and evaluation pass with **no** tool receipts — classic self-report without a judge call.

**Interpretation:** that is not “orchestration is cheaper.” That is **an invalid A/B**.

![Bar chart: domain API calls per run before handoff fix (single-agent ~14, planner ~0) vs after fix on n=10 cohort (13.8 vs 20.5)](/assets/images/appworld/fairness-gate.svg)

*Caption: After the handoff fix, both paths call domain APIs; judge pass remained 0.*

---

## The fairness gate (what “fair” means here)

We defined **tool-access fairness** separately from **task success**:

1. **Single-agent:** domain MCP tools present; no worker spawn tool on the root.
2. **Planner:** at least one worker spawn; worker registry includes the full domain MCP pack; no hard-fail because optional infra names were missing from the registry.
3. **Unattended:** no clarify / permission prompts (eval mode must not wait for a human).
4. **Judge:** `evaluate` result parsed; fallback DB scoring labeled when the agent stopped on budget.

On a two-task **fair canary**, **2/2** pairs passed fairness. Domain calls averaged **12** (single-agent) vs **31.5** (planner workers) — both sides touched the APIs.

On a **ten-task mixed cohort** (simple-band and advanced-band tasks), **10/10** pairs passed fairness. Averages: **13.8** vs **20.5** domain calls, **14.6** vs **43.8** model iterations, **~1.6×** tokens — **judge pass 0** for both.

Fairness does **not** mean matched compute budget (planner runs allowed slightly higher caps and worker node limits in this harness). It means **both sides could do the work**.

---

## Copy-paste fairness scorecard

Before you compare planner vs single-agent on any tool benchmark, record:

| # | Check | Pass? |
|---|--------|-------|
| 1 | Worker (or root) registry lists every domain tool the task needs | |
| 2 | Planner root is not required to call domain APIs if design is meta-only | |
| 3 | Spawn payload does not hard-fail on benign extra tool names | |
| 4 | Parent telemetry does not count subagent tools as root tools (or you split roles in analysis) | |
| 5 | Unattended mode — no HITL / clarify stalls | |
| 6 | External judge invoked and parsed; prose PASS ≠ judge PASS | |

If row 1 fails, stop. Fix wiring, then rerun. Tokens and “wins” before that are noise.

---

## Lessons learned

1. **Cheaper can mean “did not run the benchmark.”** Zero domain calls is an abort signal, not a routing win.
2. **Fairness is a gate, not a score.** Ten-of-ten fair pairs still produced zero AppWorld judge passes — that is an honest result.
3. **Handoff bugs look like mode failures.** “Planner has no APIs” was registry wiring, not a law of trees.
4. **Self-report is not evaluate.** Fluent PASS lines without judge receipts are a failure class, not a tie-breaker.
5. **The pattern generalizes.** Any planner-worker runtime needs the same checklist before you trust mode comparisons.

---

## Related reading

### On this site

- [Single-Agent vs Multi-Agent Orchestration](/blog/single-agent-vs-multi-agent/) — decision framework before you eval
- [From Vibes to Contracts: Agent Evals](/blog/from-vibes-to-contracts-agent-evals/) — eval sets, graders, `pass^k`
- [Is the Task Actually Done?](/blog/is-the-task-actually-done/) — completion vs narration
- Next in series: [Agent Orchestration Tax](/blog/agent-orchestration-tax-evals/)

### Elsewhere

- [AppWorld](https://github.com/stonybrooknlp/appworld) benchmark and [paper](https://arxiv.org/abs/2407.18901) — dataset, license, and TGC/SGC judge
- [Model Context Protocol](https://modelcontextprotocol.io/) — how domain tools reached the agent
- [Langfuse](https://langfuse.com/) — token and generation observability
- Planner-worker docs: [LangGraph](https://langchain-ai.github.io/langgraph/), [CrewAI](https://docs.crewai.com/), [AutoGen](https://microsoft.github.io/autogen/), [OpenAI Agents](https://openai.github.io/openai-agents-python/)
- [Google ADK evaluation](https://google.github.io/adk-docs/evaluate/) — eval-set vocabulary we borrow on this site

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

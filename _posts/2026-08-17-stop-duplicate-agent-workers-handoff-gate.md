---
layout: post
title: "Stop Spawning Duplicate Workers: What a Handoff Gate Changed in Agent Evals"
date: 2026-08-17 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 49
description: "Stop duplicate agent workers: a handoff gate fixed fairness 5/5 and cut planner token tax, but strict AppWorld judge pass stayed 0/5 — pass% is not success."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, multi-agent, orchestration, workflows, handoff, subagent, aiden, production]
permalink: /blog/stop-duplicate-agent-workers-handoff-gate/
faqs:
  - question: "What is an agent handoff gate in planner-worker evals?"
    answer: "A per-run guard that records the first successful worker handoff and returns that result when the planner tries to spawn again. It stops duplicate AppWorld runs after the subcontractor already finished — without it, orchestration tax and fairness metrics lie."
  - question: "Why did judge pass_percentage rise but strict success stay at zero?"
    answer: "pass_percentage counts partial test passes inside AppWorld's evaluate harness. success is the binary gate. We saw plan at 56% average pass% vs simple at 41.7%, but judge_pass remained 0/5 for both — higher partial scores are diagnostic, not shippable."
  - question: "Did the planner become cheaper than single-agent after the gate fix?"
    answer: "On average, yes on this five-task slice: planner tokens were about 0.86× single-agent (down from ~1.34× pre-gate). Per-task it still varies; three tasks were cheaper on single-agent. Do not treat average ratio as a universal routing rule."
  - question: "Why does create_agent count still show ~3 when only one worker ran?"
    answer: "SSE metrics count blocked spawn tool calls the planner attempted after the handoff gate returned the prior worker result. Log verification showed one real worker per task; the extra counts are wasted orchestrator iterations, not extra subcontractors."
  - question: "How does this relate to fair agent evals?"
    answer: "Fairness (tool-access parity) must pass before you compare cost or pass%. This sequel fixed fairness from 2/5 to 5/5 pairs OK, then re-measured. See the trilogy starting with fair agent evals before performance."
---

We fixed **fair agent evals** and cut **agent orchestration tax** — and still scored **0/5 strict judge passes**.

That is not a failure of honesty. It is what happens when you stop measuring the wrong thing. Parts [one](/blog/fair-agent-evals-before-performance/), [two](/blog/agent-orchestration-tax-evals/), and [three](/blog/ai-agent-eval-failure-modes/) of this series documented unfair handoffs, ~1.6× token overhead, and failure classes on a five-task [AppWorld](https://github.com/stonybrooknlp/appworld) cohort ([paper](https://arxiv.org/abs/2407.18901)) via [Model Context Protocol](https://modelcontextprotocol.io/) (MCP). This post is the sequel: what changed after we shipped a **successful handoff gate**, re-enabled note tooling, soft-dropped missing infra names on spawn, and capped worker nodes to one.

Dataset unchanged. Judge unchanged (AppWorld TGC/SGC through `evaluate`). Observability: [Langfuse](https://langfuse.com/) aggregates only.

---

## TL;DR

- **Fairness:** **2/5** → **5/5** pairs OK after subcontractor fixes (infra tools registered, spawn soft-drop, handoff gate, one worker node cap).
- **Orchestration tax:** planner/single token ratio **~1.34×** → **~0.86×**; iterations **38.4** → **27.8** on plan side.
- **Strict `judge_pass`:** **0/5** both before and after — fixing fairness and cost did not clear the benchmark bar.
- **Diagnostic pass%:** plan **56.0%** avg vs simple **41.7%** — useful trend, **not** a winner badge (`success` stayed false).
- **Monday-morning rule:** gate duplicate workers **before** debating planner vs single-agent on tokens.

### Explain like I'm five

If you already sent one helper to do the chore, do not send a second helper with the same list. The second trip wastes time and makes your scorecard count two helpers even though only one actually worked.

---

## What we fixed (behavior, not blueprint)

After [failure-mode](/blog/ai-agent-eval-failure-modes/) runs on the same `plan_fit_5` tasks, we addressed harness and runtime issues that made planner mode look worse than it was:

| Fix | What it does |
|-----|----------------|
| **Note tools registered** | Infra note/read tools available so spawn payloads do not hard-fail on names the registry lacked |
| **Soft-drop on spawn** | Optional infra names dropped instead of aborting the whole `create_agent` call |
| **Successful handoff gate** | First completed worker handoff is stored; repeat spawn attempts return that result instead of launching another AppWorld runner |
| **Worker node cap = 1** | Planner tree cannot grow a second worker branch on these eval configs |
| **Unattended mode** | No clarify / human-wait tools in benchmark runs |

Same five delegation-fit tasks (phone → notes → SMS, inbox + contacts + Splitwise, workout note → Spotify, batch Venmo, trip ledger → Splitwise). Same model family and MCP tool pack.

---

## Before vs after (aggregate)

| Metric | Pre-gate cohort | Post-gate (`plan-fit5-gate`) |
|--------|----------------:|-----------------------------:|
| Fairness pairs OK | **2 / 5** | **5 / 5** |
| Avg tokens (simple / plan) | 136,322 / 198,691 | 175,138 / 157,623 |
| Planner / single token ratio | **~1.34×** | **~0.86×** |
| Avg iterations (simple / plan) | 14.6 / 38.4 | 14.0 / 27.8 |
| Strict `judge_pass` | **0 / 5** both | **0 / 5** both |
| Avg judge `pass_percentage` | (not clean headline) | **41.7%** / **56.0%** |
| Head-to-head (strict) | ties 5/5 | ties 5/5 |

![Fairness pairs OK and planner token ratio before vs after handoff gate](/assets/images/appworld/handoff-gate-before-after.svg)

*Caption: `plan_fit_5` cohort, n=5 task pairs · strict judge pass = 0 both runs.*

**Interpretation:** the gate and fairness fixes **removed invalid comparisons** and **reduced coordination waste**. They did **not** make either mode production-ready on AppWorld.

---

## Per-task scorecard (post-gate)

| Task | Simple pass% / tokens | Plan pass% / tokens | Strict outcome | Notes |
|------|----------------------:|--------------------:|----------------|-------|
| `29caf6f_1` | 50.0% / 110,581 | 50.0% / 124,037 | both `fail_judge` | tie; simple cheaper |
| `3aa1a22_3` | 28.6% / 275,342 | 50.0% / 193,229 | both fail (plan `budget_no_eval`) | plan higher pass%, lower tokens |
| `b0a8eae_3` | 50.0% / 185,992 | 50.0% / 264,356 | both `fail_judge` | tie; simple cheaper |
| `afc0fce_2` | 50.0% / 105,322 | 100.0% / **0** | simple `fail_judge`; plan `budget_no_eval` | plan pass% misleading — zero token telemetry |
| `32616b5_1` | 30.0% / 198,455 | 30.0% / 206,495 | both `fail_judge` | tie; similar pass% |

**Scoreboard on pass% alone:** plan higher on **2/5** tasks. **Scoreboard on `judge.success`:** **no wins** — the only honest headline.

---

## Two metrics, two stories

| Metric | Use it for | Do not use it for |
|--------|------------|-------------------|
| `pass_percentage` | Diagnosing partial progress, comparing runs after harness fixes | Declaring a routing winner |
| `judge.success` (strict) | Shippable / benchmark pass gate | Explaining away budget or telemetry gaps |

We saw planner prose claim evaluate PASS while the harness labeled `budget_no_eval`. We saw **100% pass_percentage** with **zero** Langfuse tokens on one plan row — a telemetry hole, not a victory. Same lesson as [evidence-based verification](/blog/evidence-based-verification/) and the [agent-done checklist](/checklists/agent-done/): **systems of record vote; narration does not.**

This is also why [from vibes to contracts](/blog/from-vibes-to-contracts-agent-evals/) separates correctness, consistency, and reliability — partial test passes are not `pass^k`.

---

## Metric blind spot: spawn count vs real workers

Post-gate logs verified **one real worker spawn per task** when the handoff gate returned the prior result on repeat `create_agent` calls (`stop_after_successful_handoff` behavior).

SSE aggregates still showed **~3.0** `create_agent` events per plan run. Those are **blocked retries** — the planner burning orchestrator iterations on spawn attempts the gate rejected.

**Copy for your harness:**

| Log | What it tells you |
|-----|-------------------|
| `create_agent_count` (SSE) | Tool invocations, including blocked duplicates |
| Worker session / trace roots | How many subcontractors actually ran |
| Handoff gate return events | When duplicate spawns were suppressed |

Without all three, you will over-count workers and under-estimate wasted planner loops.

---

## Residual blockers (honest ceiling)

Even with fairness **5/5** and lower token tax:

- **`wrong_method_422`** — wrong documented API names after docs search
- **`budget_no_eval`** — iteration cap before evaluate on both modes
- **`pii_poison`** — redacted placeholders copied into tool calls (plan, 1/5 tasks)
- **`discovery_hit = 0`** — harness signal still flat despite search tools being called

No task reached `judge.success=true`. The next increment is task logic and discovery quality, not another spawn policy tweak alone.

---

## Lessons learned

1. **Fix fairness before you re-rank modes.** 2/5 → 5/5 pairs OK changed the cost story entirely.
2. **A handoff gate fixes duplicate work, not task intelligence.** Strict judge pass stayed 0/5.
3. **Average token ratio can flip sign** once duplicate workers stop — do not immortalize one ratio from an unfair run.
4. **`pass_percentage` without `success` is a diagnostic, not a product gate.**
5. **Count real worker traces, not spawn tool calls** — blocked retries still tax the planner.

---

## Related reading

### On this site

- [Fair Agent Evals](/blog/fair-agent-evals-before-performance/) — part 1
- [Agent Orchestration Tax](/blog/agent-orchestration-tax-evals/) — part 2
- [AI Agent Eval Failure Modes](/blog/ai-agent-eval-failure-modes/) — part 3 (pre-gate cohort)
- [Single-Agent vs Multi-Agent](/blog/single-agent-vs-multi-agent/) — when branching is worth it
- [Is the Task Actually Done?](/blog/is-the-task-actually-done/)

### Elsewhere

- [AppWorld](https://github.com/stonybrooknlp/appworld) · [paper](https://arxiv.org/abs/2407.18901)
- [Model Context Protocol](https://modelcontextprotocol.io/) · [Langfuse](https://langfuse.com/)
- [Google ADK evaluation](https://google.github.io/adk-docs/evaluate/)
- [LangGraph](https://langchain-ai.github.io/langgraph/) · [CrewAI](https://docs.crewai.com/) · [AutoGen](https://microsoft.github.io/autogen/) · [OpenAI Agents](https://openai.github.io/openai-agents-python/)

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

---
layout: post
title: "Agent Orchestration Tax: Tokens, Iterations, and Tool Calls After a Fair Eval"
date: 2026-08-15 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 47
description: "Agent orchestration tax after a fair eval: on AppWorld tasks, planner paths cost ~1.6× tokens and ~3× iterations — measure coordination cost separately from benchmark success."
image: /assets/images/og-appworld-orchestration-tax.jpg
tags: [ai-agents, evaluation, benchmarking, multi-agent, tokenomics, orchestration, reactree, workflows, aiden, production]
permalink: /blog/agent-orchestration-tax-evals/
faqs:
  - question: "What is agent orchestration tax?"
    answer: "Extra tokens, model iterations, and tool calls spent on spawning workers, repairing handoffs, and gate retries — on top of the domain work itself. It shows up whenever a planner coordinates instead of calling tools directly."
  - question: "How much orchestration tax did planner mode pay on a fair AppWorld eval?"
    answer: "On a fair ten-task cohort with tool-access parity, planner paths averaged about 1.6× tokens, 3.0× model iterations, and 1.5× domain tool calls versus single-agent. Compare tax on equal footing — benchmark TGC is a separate gate from orchestration cost."
  - question: "Does higher tool call count mean better results on agent benchmarks?"
    answer: "Not automatically. In our fair cohort, more domain calls and more iterations did not correlate with clearing strict AppWorld TGC on this slice. Measure tax separately from external judge success."
  - question: "When is planner orchestration worth the tax?"
    answer: "When work branches — parallel independent reads across apps or planes, isolated worker budgets, or auditability of specialist steps. Skip it for ID-chained mutations one loop can own."
  - question: "How does this relate to ReAcTree tax on SRE triage?"
    answer: "Same invoice, different job. Our SRE A/B showed ~1.6× wall time and ~3.9× tool calls for the same findings on single-plane triage. Here we measure the tax on a public multi-app benchmark after fixing tool fairness."
---

Once **fair agent evals** prove both modes can reach the same domain tools ([part one](/blog/fair-agent-evals-before-performance/)), the next question is cost: what does the planner path charge for coordination?

We call that **agent orchestration tax** — extra tokens, model iterations, and spawn overhead on top of the AppWorld APIs themselves. This is not a dunk on multi-agent systems. It is the invoice you should see on the receipt before you default to a tree.

Dataset: [AppWorld](https://github.com/stonybrooknlp/appworld) via MCP, judged by their evaluate harness. Observability: [Langfuse](https://langfuse.com/) aggregates. Runtime: Aiden.

![Agent orchestration tax: coordination layers stacked on domain work](/assets/images/og-appworld-orchestration-tax.jpg)

---

## TL;DR

- **Fair ten-task cohort** (tool-access parity **10/10**): planner **~1.6×** tokens, **~3.0×** iterations, **~1.5×** domain tool calls vs single-agent.
- **Orchestration tax is the story here** — extra coordination cost is measurable once fairness holds; benchmark TGC on this slice is a separate tuning problem.
- **Delegation-fit five-task cohort:** token ratio **~1.3×**, iterations **~2.6×**, head-to-head **ties 5/5** (both modes hit the same benchmark ceiling).
- **Monday-morning rule:** pay the tax when branching is the job; refuse it when one loop already owns an ID-chained mutation chain.

### Explain like I'm five

Hiring a project manager for a one-person errand adds meetings. Sometimes you need the manager because three teams work at once. Sometimes you just needed one person to walk to the store.

---

## Scorecard (record these on every fair A/B)

| Metric | Why it matters |
|--------|----------------|
| **Tokens** (prompt + completion) | Coordination shows up in root + worker streams |
| **Model iterations** | Spawn, repair, and gate retries are iterations, not “thinking harder” |
| **Domain tool calls** | Did extra loops translate into more API work or just overhead? |
| **Worker spawns** | Planner tax often scales with spawn count |
| **External judge pass** | AppWorld TGC/SGC — not assistant prose |
| **Fairness OK** | From [part one](/blog/fair-agent-evals-before-performance/) checklist |

---

## Fair mixed cohort (n = 10 tasks × 2 modes)

After the handoff fix, every pair passed tool-access fairness.

| Metric | Single-agent | Planner + worker | Ratio (planner / single) |
|--------|-------------:|-----------------:|-------------------------:|
| Avg tokens | **132,374** | **217,252** | **~1.64×** |
| Avg model iterations | **14.6** | **43.8** | **~3.0×** |
| Avg domain tool calls | **13.8** | **20.5** | **~1.49×** |
| Avg worker spawns | **0** | **~3.2** | — |
| Strict AppWorld TGC | not cleared (10/10) | not cleared (10/10) | tie on benchmark bar |

**Outcomes texture:** single-agent often hit iteration budget **without** calling evaluate (`ran_without_judge` on 7/10). Planner paths reached evaluate more often — useful for diagnosing harness gaps, not a routing win by itself.

Same findings class as our [SRE agent benchmarks](/blog/ai-sre-agent-benchmarks-wall-time-tools-tokens/) post: coordination multiplies iterations; it does not automatically deepen inspection.

![Where orchestration tax stacks on top of domain work](/assets/images/appworld/orchestration-stack.svg)

![Normalized orchestration tax: tokens 1.64x, iterations 3.0x, domain calls 1.49x vs single-agent baseline](/assets/images/appworld/orchestration-tax.svg)

*Caption: Fair ten-task AppWorld cohort · orchestration tax measured after tool parity.*

---

## Delegation-fit cohort (n = 5 tasks designed for planners)

We then picked five tasks that *should* favor delegate-then-synthesize: cross-app reads, batch fan-out, ledger reconciliation.

| Metric | Single-agent | Planner + worker |
|--------|-------------:|-----------------:|
| Avg tokens | **136,322** | **198,691** |
| Avg iterations | **14.6** | **38.4** |
| Token ratio | — | **~1.34×** |
| Head-to-head | — | **ties 5/5** (0 plan wins, 0 single wins) |
| Strict AppWorld TGC | not cleared (5/5) | not cleared (5/5) |
| Fairness | — | **2 / 5** pairs OK (infra tool drop on spawn) |

On “planner-shaped” work, **neither mode cleared strict TGC** on this five-task slice. Higher `pass_percentage` in logs (often **~50%**) did not imply `success: true` — a recurring theme for [part three](/blog/ai-agent-eval-failure-modes/).

---

## When the tax is worth paying

| Pay orchestration tax | Skip it |
|----------------------|---------|
| Parallel independent reads (metrics + logs + tickets) | Single-plane checklist one parent owns |
| Isolated worker budgets / blast-radius containment | ID-chained API mutations (create → pay → confirm) |
| Audit trail per specialist step | Latency-sensitive unattended eval with tiny node budget |

This mirrors [single-agent vs multi-agent](/blog/single-agent-vs-multi-agent/): **branching is the job**, not the slide deck.

For **LLM token budget** discipline when tax is unavoidable, see [maintaining tokenomics](/blog/maintaining-tokenomics-with-aiden/) — measure root + worker streams together.

---

## Caveats (read before you quote these numbers)

- **Small n:** ten and five task cohorts — directional, not a leaderboard.
- **Unequal caps:** planner runs allowed slightly higher iteration and worker node limits in this harness.
- **Missing telemetry:** some planner rows showed **zero** Langfuse tokens while SSE showed tool activity — exclude or flag before averaging.
- **Historical 168-task Grok pairing** from an earlier era is a **separate prior** — different model and harness; do not overlay these OpenAI-family runs.
- **We did not benchmark LangGraph, CrewAI, or AutoGen** — we measured one runtime on AppWorld; the tax *shape* should transfer.

---

## Lessons learned

1. **Fairness first, tax second.** Without tool parity, tax numbers are meaningless.
2. **More iterations ≠ better routing.** ~3× iterations bought coordination overhead on this slice — compare against whether branching was actually required.
3. **Domain calls can rise without clearing TGC.** Planner workers called more APIs; benchmark success is still a separate harness tuning track.
4. **Delegation-fit tasks are not auto-wins.** 3/5 unfair spawns on infra naming dominated early runs — fix fairness before reading mode rankings.
5. **Record spawn count.** ~3.2 spawns per task on a budget meant for “one worker” is its own failure mode.

---

## Related reading

### On this site

- [Fair Agent Evals: Tools Must Match](/blog/fair-agent-evals-before-performance/) — part one
- [AI Agent Eval Failure Modes](/blog/ai-agent-eval-failure-modes/) — part three
- [Simple vs Plan: When to Use Which](/blog/simple-vs-plan-when-to-use-which/) — smoke cohort routing guide
- [AI SRE Agent Benchmarks: Wall Time, Tools, Tokens](/blog/ai-sre-agent-benchmarks-wall-time-tools-tokens/) — same tax idea on triage
- [Single-Agent vs Multi-Agent](/blog/single-agent-vs-multi-agent/) — when to branch

### Elsewhere

- [AppWorld](https://github.com/stonybrooknlp/appworld) · [paper](https://arxiv.org/abs/2407.18901)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Langfuse](https://langfuse.com/)
- [LangGraph](https://langchain-ai.github.io/langgraph/) · [CrewAI](https://docs.crewai.com/) · [AutoGen](https://microsoft.github.io/autogen/) · [OpenAI Agents](https://openai.github.io/openai-agents-python/)
- [Google ADK evaluation](https://google.github.io/adk-docs/evaluate/)

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

---
layout: post
title: "Hybrid Plan Mode: Smart Planner, Generate Digs"
date: 2026-09-09 21:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 68
description: "Plan roots already route to planning; digs default to tool_calling. Mapping a high-effort reasoning model onto every task burns dig wall. Split the roster instead."
image: /assets/images/og-default.png
tags: [ai-agents, reasoning, orchestration, reactree, evaluation, tokenomics, sre, aiden]
permalink: /blog/hybrid-plan-smart-planner-generate-digs/
faqs:
  - question: "Do I need a new execution mode for hybrid plan?"
    answer: "No. Hierarchical plan already sends the root to a planning task type and dig workers to tool_calling by default. The fix is the model roster: reasoning for planning, generate for digs."
  - question: "Why did an all-reasoning plan bench burn wall clock?"
    answer: "Every good_for_task row, including tool_calling, pointed at the same high-effort Responses seat. Digs asked for tools and still got a slow reasoning model for Grafana loops."
  - question: "What did the hybrid roster change?"
    answer: "Planning and synthesis stayed on a medium-effort reasoning preview. Digs, efficiency helpers, and summarizer seats moved to generate-class models. Dig Expert.Do times dropped from multi-minute reasoning digs to tens of seconds or a couple of minutes."
---

[Reasoning effort is not free](/blog/reasoning-effort-is-not-a-free-upgrade/). [Reasoning vs generate](/blog/reasoning-vs-generate-tool-heavy-agents/) asked which *seat* belongs on a tool-heavy job. This post is the next cut: **split the roster inside hierarchical plan**, not another orchestration mode.

Cousins: [hierarchical vs single-agent](/blog/plan-mode-merits-demerits-observability/) · [what is ReAcTree?](/blog/what-is-reactree/).

---

## TL;DR

- Hierarchical plan already separates roles: root = `planning`, digs default = `tool_calling`.
- An all-reasoning roster ignored that split. Digs correctly requested tools and still ran on a high-effort Responses preview — first digs in the **~8–13 minute** class, multi-million dig tokens on a prior rematch.
- Hybrid roster: reasoning (medium) for planning / scientific reasoning; generate for digs / efficiency / summarizer.
- Same burn-rate alert, same Grafana MCP plane: hybrid plan finished in **~6 minutes** with a measured Theory. Dig Expert.Do times landed in the **~12s–2.5m** band. Routing logs showed plan → Responses, digs → generate.

### Explain like I'm five

The foreman should think about which rooms to open. The plumbers should measure the pipes. If you give every plumber a philosophy seminar before each wrench turn, the basement floods while they think.

---

## The mistake

We did not need a new `ExecutionMode`. The harness already does this:

```text
User → plan root (task_type=planning)
         → create_agent dig (task_type=tool_calling)
              → observability tools + notes
         → Theory synthesis
```

The burn happened in **config**. Every `good_for_task`, including `tool_calling`, pointed at the same Responses reasoning model with high effort. Digs asked for tools. The router obeyed and handed them the expensive seat.

That is not “reasoning is bad at SRE.” It is **reasoning spent on the wrong turn**.

---

## The hybrid roster

| Task class | Seat | Effort |
|------------|------|--------|
| `planning`, `scientific_reasoning`, `general_task` | Responses reasoning preview | medium (not high for the first pass) |
| `tool_calling`, `terminal_calling`, `efficiency` | Generate (gpt-5.4-class) | none |
| `summarizer`, `frontdesk` | Generate mini or full | none |

Contract in one line: **planner thinks; digs measure.**

Keep the plan persona **delegation-only**. Do not revive parent-first root tools or soft-cap tricks for this win. The roster is enough when routing already splits task types.

---

## Receipt (obfuscated)

Job: hierarchical plan on a live **API availability burn-rate** card. One Grafana tool plane. Same prompt across seats.

| Roster | Wall | Digs | What closed |
|--------|------|------|-------------|
| All-generate control | ~0.5m | 1 | Thin undetermined this pass (dig never attached real probes) |
| All-reasoning high (prior rematch) | ~13m | 2 | Expensive dig tax; multi-million dig tokens |
| **Hybrid** | **~6m** | **4** | Probable Theory: one hot route all 5xx, matching app error type |

Hybrid log assertion (the part that matters more than wall):

- Root `GetModel` → `planning` → Responses preview  
- Every dig `GetModel` → `tool_calling` → generate  
- Dig tool credits actually fired (alert rule, firing instances, metric/log probes)

We stopped a fresh all-reasoning rematch early once the first dig already selected Responses for `tool_calling`. The prior ~13m receipt was enough baseline.

---

## What operators should copy

1. **Audit the roster.** If `tool_calling` maps to your highest-effort reasoner, you are taxing digs on purpose.
2. **Keep dig `task_type` off planning.** Host prompts that set digs to `planning` reintroduce the tax even with a good default.
3. **Remap summarizer and efficiency** too. Fallbacks that inherit the reasoner quietly rebuild the bill.
4. **Start medium on the planner.** Raise only if Theory quality regresses. High everywhere is how the basement floods.

---

## Blindspots

- A dig that explicitly requests `planning` still pulls the reasoner. Policy must forbid that.
- Hybrid wall is still slower than a lucky all-generate sprint when generate digs attach tools on the first try. The point is **not** beating generate on latency. It is **not paying reasoning dig tax** while keeping a thinking planner.
- Quality still depends on dig tool allowlists. A fast undetermined close is not a win.

Ship the mix. Bill the mix. Let the foreman think and the plumbers measure.

---
layout: post
title: "Hierarchical vs Single-Agent on a Dual-Part Observability Job"
date: 2026-09-08 18:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 61
description: "When a hierarchical ReAcTree planner earns its tax on alert+logs triage — and when a single-agent ReAct loop is the better default. Real ratios from a six-combo bench."
image: /assets/images/og-default.png
tags: [ai-agents, reactree, react, orchestration, evaluation, tokenomics, sre, aiden]
permalink: /blog/plan-mode-merits-demerits-observability/
faqs:
  - question: "Is hierarchical ReAcTree always better for incident triage?"
    answer: "No. On our dual-part Grafana job, hierarchical helped xAI slightly on wall and helped gpt-5.4 on total tokens, but hurt a Responses reasoning preview until host gates landed — including a 0.69 correctness stub."
  - question: "When should I default to a single-agent ReAct loop?"
    answer: "When one tool plane owns the dig, latency matters, and the model class already closes Theory/Unknowns without a coordinator. Single-agent matched quality for xAI and gpt-5.4 on this job."
  - question: "When is hierarchical ReAcTree worth it?"
    answer: "When you need structured multi-part collection, tool packing on workers, or a coordinator that keeps the root from drowning in large tool dumps. Measure with the same prompt — do not assume."
---

[What is ReAcTree?](/blog/what-is-reactree/) defines the two shapes: a **single-agent ReAct loop** (one reason→act→observe trajectory) versus a **hierarchical ReAcTree planner** (parent decomposes subgoals, may spawn child nodes, control-flow coordination). Paper: [PDF](https://arxiv.org/pdf/2511.02424) · [abs](https://arxiv.org/abs/2511.02424). Older AppWorld notes: [simple vs plan when to use which](/blog/simple-vs-plan-when-to-use-which/).

This comparison concerns one session with two deliverables: investigate a firing alert, then compare a log anomaly with its baseline. It tests whether coordination overhead buys enough structure on this particular Grafana/Loki plane; it does not establish a default orchestration mode.

Full scorecard: [six model×orchestration combos](/blog/six-model-mode-combos-alert-logs-bench/).

---

## What the evidence supports

- **Merit (xAI):** hierarchical finished **~10% faster** than single-agent with similar tokens and full correctness.
- **Merit (gpt-5.4):** the hierarchical run used **~32% fewer total prompt tokens** than single-agent at the same quality (wave 1).
- **Demerit (Responses preview):** hierarchical once produced a **thin Undetermined** close (corr 0.69) while single-agent scored 1.0 — faster wall, worse product.
- **Demerit (wave 2):** absolute wall increased while Grafana clients were contended. One Responses hierarchical close met more checklist items after host changes, but this rematch cannot isolate a speed or quality effect from contention and run variability.


---

## Merits

### 1. Compression for generate-class models

In wave 1, the gpt-5.4 single-agent run used ~**373k** total tokens; its hierarchical counterpart used ~**255k** and met the same checklist. These are summed across the tree, not merely the parent prompt. On this one run, delegation reduced token use without much wall-time change. A child-heavy tree could instead increase the total.

### 2. Slight wall win for efficient reasoners

The xAI hierarchical run took ~**141s** versus ~**157s** single-agent, with both scoring 1.0 on the checklist. With one run per cell, this 16-second difference is a measurement, not a reliable speedup estimate; queueing and tool latency can change it.

### 3. Structure for multi-part errands

The prompt demanded **two** Theory blocks. The hierarchical coordinator habit matches that shape when the model cooperates — Part A/B labels showed up cleanly in successful hierarchical closes.

---

## Demerits

### 1. Quality collapse is possible

Responses hierarchical (wave 1): corr **0.69**, ~**530** characters, Undetermined on both parts. Single-agent on the same model: corr **1.0**, full measured write-up, slower wall. **Faster ≠ better.**

### 2. Orchestration without children still costs

Child-agent counts stayed near zero in these runs. Even so, the hierarchical path spent model turns on coordination and packing tool results. When the parent can query the only needed backend directly, that overhead may not pay for itself ([orchestration tax](/blog/agent-orchestration-tax-evals/)). A genuinely independent second plane is a different case.

### 3. Trees can amplify token waste when thinking is heavy

Wave 2 gpt-5.4 hierarchical used nearly **twice** the tokens of its wave-1 run while the tool server was more contended. A tree does not cap retries or token use on its own. Pair it with [no-progress / fan-out guards](/blog/stop-retrying-the-same-failed-query/).

---

## Decision table

![Decision path from task scope to a single loop or planner](/assets/images/diagrams/sept/plan-shapes.svg)

*The coordinator earns its cost only when separated work improves the outcome enough to justify it.*


| Situation | Prefer |
|-----------|--------|
| One observability plane, tight latency | **single-agent** (ReAct) |
| Multi-part close, generate model, token bill hurts | **hierarchical** (ReAcTree) — measure |
| Preview reasoning model, weak host gates | **single-agent** until gates land |
| Multi-plane parallel falsifiers | **hierarchical / tree** ([when multi-agent](/blog/single-agent-vs-multi-agent/)) |

When you *do* keep hierarchical plan, split the model roster so digs stay on generate seats — [hybrid plan: smart planner, generate digs](/blog/hybrid-plan-smart-planner-generate-digs/). The tree already routes planning vs tool_calling; an all-reasoning map wastes that split.

If both modes are supported, compare them on repeated, equivalent incidents with the same tool access. Use correctness before token and wall differences, and inspect the child traces when the tree wins or fails.

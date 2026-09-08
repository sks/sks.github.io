---
layout: post
title: "What Is ReAcTree? Hierarchical Agent Trees for Long-Horizon Work"
date: 2026-09-08 09:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 57
description: "Plain English: ReAct is one reason→act→observe loop. ReAcTree is a tree of agent nodes with sequence, parallel, and fallback control flow — for SRE-style tool-heavy jobs."
image: /assets/images/og-default.png
tags: [ai-agents, reactree, react, orchestration, multi-agent, sre, evaluation]
permalink: /blog/what-is-reactree/
faqs:
  - question: "What is ReAcTree in one sentence?"
    answer: "A hierarchical agent pattern where a parent decomposes subgoals, may spawn child agent nodes, and coordinates them with sequence, parallel, or fallback control flow — instead of one flat ReAct loop doing everything."
  - question: "How is ReAcTree different from ReAct?"
    answer: "ReAct is one agent: reason, call a tool, observe, repeat in a single trajectory. ReAcTree keeps that loop at each node, but the run is a tree: parents plan and compose children rather than stuffing every probe into one context."
  - question: "When should I use a single-agent ReAct loop instead?"
    answer: "When one tool plane owns the dig, latency matters, and the model already closes with Theory/Unknowns without a coordinator. Hierarchical runs pay an orchestration tax; measure both shapes on the same prompt."
  - question: "Does the paper claim ReAcTree always wins?"
    answer: "No. The authors report large gains on long-horizon household tasks (e.g. WAH-NL ~61% vs ReAct ~31% with Qwen 2.5 72B). That motivates trees for hard multi-step work; your SRE job still needs its own receipt."
  - question: "Where do production bugs show up?"
    answer: "In the wiring: governance on child tools, parallel graph compile, per-step timeouts, session isolation. See our production bug notes after implementing ReAcTree."
---

Most agent demos are a **single-agent ReAct loop**: one model reasons, calls a tool, reads the observation, repeats. That shape is honest and easy to debug.

**ReAcTree** is the other shape that shows up once jobs get long and tool-heavy. A parent agent decomposes subgoals, may spawn **child agent nodes**, and coordinates them with explicit control flow (sequence, parallel, fallback). Each node still looks like ReAct locally. The *run* is a tree.

Paper ([PDF](https://arxiv.org/pdf/2511.02424) · [abs](https://arxiv.org/abs/2511.02424)) · [reference code](https://github.com/Choi-JaeWoo/ReAcTree) · production scars: [ReAcTree bugs we hit](/blog/reactree-bugs/).

---

## TL;DR

- **Single-agent (ReAct):** one trajectory, one context, reason→act→observe until done.
- **Hierarchical (ReAcTree):** parent plans subgoals; children dig; control flow stitches results.
- Paper motivation (authors’ numbers, not ours): on WAH-NL with Qwen 2.5 72B, ReAcTree ~**61%** vs ReAct ~**31%**.
- For SRE triage, trees help when the errand has **rooms** (alert + logs + change). They hurt when one plane owns the dig and you just paid a foreman to watch one plumber.
- Always A/B both shapes on the **same** frozen prompt. We did that here: [six model×orchestration combos](/blog/six-model-mode-combos-alert-logs-bench/).

### Explain like I'm five

One kid with a flashlight checks every room alone. That is ReAct.

A team lead assigns “kitchen,” “basement,” and “attic,” waits for reports, then writes one story. That is ReAcTree. Sometimes the team finds the fire faster. Sometimes the lead stares at the clipboard and the basement still floods.

---

## ReAct in thirty seconds

[ReAct](https://arxiv.org/abs/2210.03629) interleaves thought and tool use in **one** agent:

1. Reason about the goal  
2. Act (tool call)  
3. Observe the result  
4. Repeat  

Great default for “query this alert rule, then LogQL, then write Theory / Unknowns / Do-this-now.” One context. One failure mode. You can read the stream top to bottom.

---

## ReAcTree: tree + control flow

From the paper: the parent does not only call leaf tools. It builds a **tree of agent nodes**. Children get scoped subgoals. Composition is not vibes — it is typed control flow:

| Flow | Plain meaning |
|------|----------------|
| **Sequence** | Finish A, then B |
| **Parallel** | Fan out A∥B, join |
| **Fallback** | Try A; on failure try B |

Shared working memory and episodic lessons show up in the paper design. In production you still have to wire timeouts, governance, and isolation yourself ([six bugs](/blog/reactree-bugs/)).

Short labels we use in benches:

| Label | Means |
|-------|--------|
| **single-agent** | Flat ReAct loop |
| **hierarchical** / **ReAcTree** | Parent + children + control flow |

---

## Why ops / SRE people care

Incident work is long-horizon and tool-heavy: metrics, logs, deployments, tickets. A single-agent loop can drown in catalog tools and megabyte tool dumps. A tree can:

- **Isolate** noisy LogQL into a child context  
- **Fan out** falsifiers in parallel  
- Keep the parent’s close **structured** (Part A / Part B) when the model cooperates  

It can also:

- Pay **orchestration tax** (coordinator turns even when children barely dig)  
- **Collapse quality** if the parent stops early with Undetermined and no receipts  
- Hide measurement in child spans so a naive parent log looks “tool-empty”

We measured both shapes on one dual-part Grafana/Loki job. Merits and demerits with numbers: [hierarchical vs single-agent on observability](/blog/plan-mode-merits-demerits-observability/).

---

## Merits

1. **Context packing.** Workers can carry fat tool catalogs or large tool dumps while the parent keeps a smaller synthesis context.
2. **Multi-part errands.** Alert triage plus a 24h/7d log compare matches “rooms,” not one paragraph.
3. **Parallel falsifiers.** When the host allows true fan-out, wall can improve without stuffing every probe into one trajectory.

## Demerits

1. **Orchestration tax.** Coordinator tokens and latency even for a single tool plane.
2. **Fragility.** A hierarchical run can finish “fast” with a stub Theory unless the host forces receipts and no-progress halts.
3. **Harder debug.** You need merged session traces across parent and children, not only the root stream.

---

## Two meters for cost (do not mix them)

A tree has two different token stories:

| Meter | What it answers |
|-------|-----------------|
| **Peak prompt at one node** | Did the parent (or a child) blow the context window on a turn? |
| **Sum of tokens across the whole tree** | What did the run cost end to end? |

A hierarchical run can look “small” on the parent gauge while the **sum across nodes** is larger than a single-agent ReAct loop. The reverse also happens: workers absorb bulk and the parent’s peak stays tidy while the total bill still drops versus one overloaded seat. Report both meters, plus wall clock. Numbers from our dual-part Grafana job: [scorecard](/blog/six-model-mode-combos-alert-logs-bench/).

---

## What to read next

1. [Six model×orchestration combos](/blog/six-model-mode-combos-alert-logs-bench/) — scorecard  
2. [Hierarchical vs single-agent merits](/blog/plan-mode-merits-demerits-observability/) — when the tax earns its keep  
3. [ReAcTree production bugs](/blog/reactree-bugs/) — what the paper skipped  
4. [Single-agent vs multi-agent](/blog/single-agent-vs-multi-agent/) — choosing a shape  

If you only remember one line: **ReAct is the loop; ReAcTree is the tree of loops.** Measure both before you romanticize either.

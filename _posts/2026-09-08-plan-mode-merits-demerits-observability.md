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

This post is the observability rematch: one alert + one log anomaly in the same session.

Full scorecard: [six model×orchestration combos](/blog/six-model-mode-combos-alert-logs-bench/).

---

## TL;DR

- **Merit (xAI):** hierarchical finished **~10% faster** than single-agent with similar tokens and full correctness.
- **Merit (gpt-5.4):** the hierarchical run used **~32% fewer total prompt tokens** than single-agent at the same quality (wave 1).
- **Demerit (Responses preview):** hierarchical once produced a **thin Undetermined** close (corr 0.69) while single-agent scored 1.0 — faster wall, worse product.
- **Demerit (everyone, wave 2):** hierarchical did not magically cut absolute wall under contended Grafana clients; gates fixed quality, not speed.

### Explain like I'm five

Hiring a foreman helps when the job has rooms. Hiring a foreman who stares at the blueprint and never measures the leaky pipe is worse than sending one plumber.

---

## Merits

### 1. Compression for generate-class models

gpt-5.4 single-agent wrote the longest close and burned ~**373k** tokens. Hierarchical landed the same checklist at ~**255k**. If your bill is dominated by generate seats, a tree can shrink the **total context bill across the whole tree** even when wall is flat.

### 2. Slight wall win for efficient reasoners

xAI hierarchical ~**141s** vs single-agent ~**157s**, both corr 1.0. Not a miracle. Enough to stop treating ReAcTree as pure tax for that class.

### 3. Structure for multi-part errands

The prompt demanded **two** Theory blocks. The hierarchical coordinator habit matches that shape when the model cooperates — Part A/B labels showed up cleanly in successful hierarchical closes.

---

## Demerits

### 1. Quality collapse is possible

Responses hierarchical (wave 1): corr **0.69**, ~**530** characters, Undetermined on both parts. Single-agent on the same model: corr **1.0**, full measured write-up, slower wall. **Faster ≠ better.**

### 2. Orchestration without children still costs

We kept child agent nodes near zero on this plane. Hierarchical still paid for coordinator turns and tool packing. If the parent already owns Grafana, you are paying management overhead for a single plane ([orchestration tax](/blog/agent-orchestration-tax-evals/)).

### 3. Trees can amplify token waste when thinking is heavy

Wave 2 gpt-5.4 hierarchical nearly **doubled** tokens vs its own wave-1 hierarchical under heavier contention. ReAcTree is not a governor by itself. Pair it with [no-progress / fan-out guards](/blog/stop-retrying-the-same-failed-query/).

---

## Decision table

| Situation | Prefer |
|-----------|--------|
| One observability plane, tight latency | **single-agent** (ReAct) |
| Multi-part close, generate model, token bill hurts | **hierarchical** (ReAcTree) — measure |
| Preview reasoning model, weak host gates | **single-agent** until gates land |
| Multi-plane parallel falsifiers | **hierarchical / tree** ([when multi-agent](/blog/single-agent-vs-multi-agent/)) |

Ship both. Pick with a receipt, not a vibe.

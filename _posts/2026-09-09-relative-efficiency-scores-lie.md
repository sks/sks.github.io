---
layout: post
title: "Relative Efficiency Scores Lie When Absolute Wall Doubles"
date: 2026-09-09 12:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 63
description: "Efficiency normalized to a cohort median can rise while every seat gets slower. Publish absolute wall, tokens, and correctness first."
image: /assets/images/og-default.png
tags: [ai-agents, benchmarking, evaluation, tokenomics, metrics, aiden]
permalink: /blog/relative-efficiency-scores-lie/
faqs:
  - question: "Can efficiency go up when the agent is slower?"
    answer: "Yes. If you divide correctness by a resource index normalized to that run’s median, a slower cohort raises everyone’s denominator baseline. Rank stays useful; absolute wall is what operators feel."
  - question: "What should dashboards show instead?"
    answer: "Absolute wall seconds, total tokens, USD, and a binary or checklist correctness. Keep relative efficiency as a within-cohort ranking aid only."
  - question: "How did this show up in practice?"
    answer: "On a rematch with heavier Grafana contention, xAI hierarchical wall went from ~141s to ~262s while its relative efficiency rose. The product was not faster."
---

We almost shipped a victory lap because “efficiency” went up.

It did. The agents also took almost twice as long.

---

## TL;DR

- Our efficiency formula normalizes wall, tokens, and cost to the **cohort median**.
- In a slower wave, the median rises. Relative scores can improve while **absolute** wall and tokens get worse.
- Use relative scores to **rank seats inside one wave**. Use absolutes to compare harnesses across days.
- Example: xAI hierarchical wall **141s → 262s**, relative eff **1.375 → 1.584**. Rank 1 both times. Operator latency lost.

### Explain like I'm five

If every kid in class runs slower on a muddy track, the kid who finishes first still gets a gold star. That does not mean recess got faster.

---

## The formula we used

```text
eff = correctness / (0.45·wall/median + 0.45·tokens/median + 0.10·cost/median)
```

Fine for [ranking six combos](/blog/six-model-mode-combos-alert-logs-bench/) across **single-agent ReAct** and **hierarchical ReAcTree** shapes ([what is ReAcTree?](/blog/what-is-reactree/)). Dangerous in a changelog bullet: “efficiency +15%.”

---

## What to publish

| Field | Cross-harness? | Within-wave rank? |
|-------|----------------|-------------------|
| Wall seconds | **Yes** | Yes |
| Tokens in+out | **Yes** | Yes |
| USD | **Yes** | Yes |
| Correctness checklist | **Yes** | Yes |
| Relative efficiency | No (label it) | **Yes** |

Also log **contention**: how many sessions shared the tool server. Our second wave ran six hot Grafana clients together. That is not the same lab as four finished seats plus a serial rerun.

---

## A rule for changelogs and reviews

> Absolute wall and tokens for the golden prompt. Relative efficiency only as a rank table.

If you cannot paste both, you are not done measuring.

Related: [web metrics → LLM metrics](/blog/web-metrics-to-llm-metrics/), [fair evals before performance](/blog/fair-agent-evals-before-performance/).

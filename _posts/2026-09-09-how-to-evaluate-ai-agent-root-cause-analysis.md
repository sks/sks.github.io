---
layout: post
title: "How to Evaluate an AI Agent for Root Cause Analysis"
date: 2026-09-09 18:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 66
description: "A checklist-first RCA eval: Theory, Unknowns, next action, measured signal, honesty about gaps — plus wall, tokens, and cost. Built from a live alert+logs bench."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, sre, incident-response, rca, benchmarking, reactree, aiden]
permalink: /blog/how-to-evaluate-ai-agent-root-cause-analysis/
faqs:
  - question: "How do you evaluate an AI agent for root cause analysis?"
    answer: "Score the close against an explicit checklist (Theory disposition, Unknowns, next action, measured alert or query, numbers, honesty), then record wall time, tokens, and cost on a frozen prompt with live tools."
  - question: "Is pass/fail enough?"
    answer: "Binary pass hides partial honesty. Use a weighted checklist so ‘Undetermined with named blocked query’ beats ‘confident fiction’."
  - question: "What prompt shape works for RCA evals?"
    answer: "A dual-part job: one firing alert to triage, one related log or change plane to compare. Forces measurement and cross-linking instead of a single-paragraph vibe. Run both single-agent ReAct and hierarchical ReAcTree if your runtime supports both."
---

Most “AI RCA” pages sell magic. Here is a grading sheet you can run this week on a frozen prompt with live tools.

---

## TL;DR

- Freeze a **dual-part** prompt (alert + related logs/change).  
- Score **13 binary checks** (or your variant) before you look at latency.  
- Then record wall, tokens, USD.  
- Reject confident closes that invent series. Reward honest Unknowns with named gaps.  
- Rematch after every harness change — and across orchestration shapes if you ship both.

### Explain like I'm five

Do not grade the detective on how dramatic the story sounds. Grade whether they checked the house, wrote what they could not check, and said what to do next.

---

## The checklist we used

From a live Grafana/Loki job ([numbers](/blog/six-model-mode-combos-alert-logs-bench/)), comparing a **single-agent ReAct loop** and a **hierarchical ReAcTree planner** ([primer](/blog/what-is-reactree/) · [PDF](https://arxiv.org/pdf/2511.02424)):

**Part A**

- Theory section present  
- Unknowns present  
- Actionable next step  
- Alert actually measured (rule / firing / query)  
- Concrete numbers  

**Part B**

- Target namespace named  
- 24h window  
- 7d (or stated baseline) window  
- Compare / anomaly language  
- Logs / LogQL evidence  

**Cross-cutting**

- Honesty about gaps / truncated tool dumps  
- Part A labeled  
- Part B labeled  

Correctness = hits / 13. A Responses hierarchical stub scored **0.69**. Full seats scored **1.0**. That single number explained more than any vibe review.

Use the operator [evidence-gated RCA checklist](/checklists/evidence-gated-rca/) as the human twin.

---

## Metrics beside the checklist

| Metric | Why |
|--------|-----|
| Wall seconds | On-call patience |
| Tokens in+out | Bill and context pressure |
| USD | Finance will ask |
| Tool families | Measurement vs catalog |
| Child / tree node count | Orchestration tax |

Do not crown a model on checklist alone if it took ten minutes and half a million tokens. Do not crown a fast model that skips Part B.

---

## Anti-patterns

- Judging on prose fluency  
- Allowing HITL tools in unattended benches  
- Changing the prompt between A/B seats  
- Reporting only relative [efficiency](/blog/relative-efficiency-scores-lie/)  
- Crowning one orchestration shape without rematching the other  

---

## Minimal harness

1. Golden prompt file in git.  
2. One config per model × orchestration shape (single-agent / hierarchical).  
3. Script that prints checklist + wall + tokens.  
4. Store Theory text next to the score — future you will need the voice ([styles](/blog/what-reasoning-models-write-on-triage/)).

That is how you evaluate RCA agents like an engineer, not like a demo audience.

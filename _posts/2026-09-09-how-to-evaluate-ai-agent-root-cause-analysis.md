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

Root cause analysis (RCA) is an explanation of what caused an incident, supported by measurements and a mechanism. An agent can produce a fluent explanation without having checked the relevant system. A frozen prompt and explicit rubric make that difference inspectable.

---

## What the evidence supports

- Freeze a **dual-part** prompt (alert + related logs/change).  
- Score **13 binary checks** (or your variant) before you look at latency.  
- Then record wall, tokens, USD.  
- Reject confident closes that invent series. Reward honest Unknowns with named gaps.  
- Rematch after every harness change — and across orchestration shapes if you ship both.


---

## The checklist we used

![Compare an agent root-cause answer against incident evidence](/assets/images/diagrams/sept/rca-eval.svg)

*The evaluation checks whether the final claim matches the source record, not just how confident it sounds.*


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

For this bench, correctness was hits / 13. A Responses hierarchical stub scored **0.69**; full-checklist runs scored **1.0**. These checks capture coverage and gap disclosure, not whether every proposed cause is true. Keep the known incident mechanism and human review alongside the score.

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

First reject unsupported or incomplete diagnoses; then compare wall time and token use among acceptable runs. On-call time matters, but a fast answer that skips Part B does not satisfy this task.

---

## Anti-patterns

- Judging on prose fluency  
- Allowing human-in-the-loop (HITL) tools in an unattended bench without recording the human intervention
- Changing the prompt between A/B seats  
- Reporting only relative [efficiency](/blog/relative-efficiency-scores-lie/)  
- Crowning one orchestration shape without rematching the other  

---

## Minimal harness

1. Version a fixed prompt, expected mechanism, and scoring rubric in git.
2. One config per model × orchestration shape (single-agent / hierarchical).  
3. Script that prints checklist + wall + tokens.  
4. Store the proposed Theory and its cited observations next to the score. A checklist can give credit for naming numbers even when they come from the wrong window ([styles](/blog/what-reasoning-models-write-on-triage/)).

Repeat each configuration before inferring reliability. This 13-check rubric was designed for an alert-plus-logs job; adapt the evidence checks when the incident instead depends on deployments, traces, or configuration history.

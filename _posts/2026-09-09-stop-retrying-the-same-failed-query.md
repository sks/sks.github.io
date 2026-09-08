---
layout: post
title: "Stop Retrying the Same Failed Observability Query"
date: 2026-09-09 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 62
description: "Host-side gates for typed query failures, unchanged observations, and same-tool fan-out — why prompt-only retries fail on high-thinking models."
image: /assets/images/og-default.png
tags: [ai-agents, reactree, loop-detection, observability, evaluation, production, aiden]
permalink: /blog/stop-retrying-the-same-failed-query/
faqs:
  - question: "Why do reasoning models retry the same failed PromQL or LogQL?"
    answer: "High-thinking seats treat HTTP 200 typed failures as soft success and tweak args forever. Prompt text alone does not stop that. The host must classify failed/empty observations and halt after one steer."
  - question: "What host gates help?"
    answer: "Treat all-failed query envelopes as upstream failure, hash terminal failed/empty observations so identical failures match, steer once then stop with partial findings, and cap parallel copies of the same tool in one wave."
  - question: "Did these gates make our bench faster?"
    answer: "Not on absolute wall for a contended six-way Grafana rematch. They did coincide with a hierarchical ReAcTree Responses seat jumping from 0.69 to 1.0 correctness on the same prompt."
---

Prompt poetry does not stop a high-thinking model from poking a dead PromQL with slightly different labels.

We already had [loop detection](/blog/ai-agent-loop-detection-salvage/) and habits that prefer parent measurement before spawning children ([single vs multi](/blog/single-agent-vs-multi-agent/)). They were not enough. The missing piece is **observation identity**: if the world did not change, stop paying for another thought.

Shapes in the rematch: **single-agent ReAct** vs **hierarchical ReAcTree** ([what is ReAcTree?](/blog/what-is-reactree/) · [PDF](https://arxiv.org/pdf/2511.02424)).

---

## TL;DR

- Typed query failures (`n` / `outcome: failed`, all-failed arrays) must count as **failures**, not transport success.
- Hash **terminal failed/empty** observations; identical hashes → steer once → halt with partial findings.
- Cap **same-tool fan-out** in one wave — even for retrieval tools.
- Context-only tools (`search_tools`, `load_skill`, notes) must **not** satisfy “live evidence” gates.
- On our rematch, the big product win was quality on a reasoning-preview **hierarchical** seat ([scorecard](/blog/six-model-mode-combos-alert-logs-bench/)), not a free latency cut.

### Explain like I'm five

If the smoke detector keeps saying “battery dead” the same way, write it down once, try another room, then stop pressing the same button.

---

## What we saw without the gates

On a dual-part alert+logs job, a Responses **hierarchical** seat finished “fast” with:

- corr **0.69**
- both parts **Undetermined**
- almost no measured Part B numbers

Single-agent on the same model scored **1.0** and took longer. The planner was not “more careful.” It was **done pretending**.

Meanwhile generate and xAI seats already closed full Theories. The failure mode is concentrated where thinking budget is large and host feedback is polite.

---

## Gates that are not prompts

| Gate | Behavior |
|------|----------|
| Typed failure class | All-failed query envelope → upstream failure |
| No-progress ledger | Same failed/empty observation hash twice → steer, then stop |
| Fan-out cap | Nth parallel copy of the same tool → hard error |
| Tool classes | Catalog/skill/notes ≠ live measurement |

Do **not** reuse “required completion tool names” for gain-exhausted tools. That field means something else; mixing it drops required gates when a plane is exhausted.

---

## What still lies to you

- Tools that return HTTP 200 without `n` / `outcome` still look healthy. Fix the envelope at the integration.
- Contended tool servers make **everyone** slower. Gates do not delete queueing.
- Valid credentials + broken upstream image can keep stale tools until refresh.

---

## Monday checklist

1. Log observation hashes for failed/empty query tools.  
2. Alert when steer-then-halt fires more than N times per session.  
3. Re-run one golden dual-part prompt after every gate change.  
4. Read the Theory — if it says Undetermined with no blocked query named, fail the build.

Related: [empty query is data](/blog/empty-query-not-absent-signal/), [deliver findings at the budget cap](/blog/deliver-findings-at-the-budget-cap/), [how models write Theories](/blog/what-reasoning-models-write-on-triage/).

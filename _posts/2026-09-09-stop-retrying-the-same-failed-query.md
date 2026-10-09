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

An agent can receive a failed PromQL (Prometheus metric query), change its labels, and issue the same ineffective probe again. If the backend returns HTTP 200 with an application-level `failed` outcome, transport status alone will not tell the runtime to stop.

We already had [loop detection](/blog/ai-agent-loop-detection-salvage/) and habits that prefer parent measurement before spawning children ([single vs multi](/blog/single-agent-vs-multi-agent/)). Those controls did not identify repeated terminal observations. We added an observation fingerprint for failed or empty results so the host could detect a repeated response even when the agent changed superficial query arguments. Identical errors can justify a different probe or an explicit Unknown, not an automatic conclusion that the incident signal is absent.

Shapes in the rematch: **single-agent ReAct** vs **hierarchical ReAcTree** ([what is ReAcTree?](/blog/what-is-reactree/) · [PDF](https://arxiv.org/pdf/2511.02424)).

---

## What the evidence supports

- Typed query failures (`n` / `outcome: failed`, all-failed arrays) must count as **failures**, not transport success.
- Hash **terminal failed/empty** observations; identical hashes → steer once → halt with partial findings.
- Cap **same-tool fan-out** in one wave — even for retrieval tools.
- Context-only tools (`search_tools`, `load_skill`, notes) must **not** satisfy “live evidence” gates.
- On our rematch, the big product win was quality on a reasoning-preview **hierarchical** seat ([scorecard](/blog/six-model-mode-combos-alert-logs-bench/)), not a free latency cut.


---

## What we saw without the gates

On a dual-part alert+logs job, a Responses **hierarchical** seat finished “fast” with:

- corr **0.69**
- both parts **Undetermined**
- almost no measured Part B numbers

Single-agent on the same model scored **1.0** and took longer. The hierarchical close was not evidence of a resolved incident; it omitted the measurements needed by Part B. One run per configuration does not establish why the planner ended early.

In this wave, the generate and xAI seats met the checklist. That local pattern suggests inspecting the reasoning-preview seat’s feedback and completion condition; it does not mean high-thinking models inherently retry more on other workloads.

---

## Gates that are not prompts

| Gate | Behavior |
|------|----------|
| Typed failure class | All-failed query envelope → upstream failure |
| No-progress ledger | Same failed/empty observation fingerprint twice → offer a different route once; if it recurs, stop the loop with partial findings |
| Fan-out cap | Limit concurrent copies of a tool when they hit the same backend; permit justified independent queries within the capacity budget |
| Tool classes | Catalog/skill/notes ≠ live measurement |

Keep "required completion tool names" (the calls a workflow must make) separate from "gain-exhausted tools" (calls blocked after repeated non-progress). If the same field represents both, exhausting a query route can accidentally remove a required evidence check.

---

## What still lies to you

- Tools that return HTTP 200 without `n` / `outcome` still look healthy. Fix the envelope at the integration.
- Contended tool servers make **everyone** slower. Gates do not delete queueing.
- Valid credentials + broken upstream image can keep stale tools until refresh.

---

## Monday checklist

1. Log observation hashes for failed/empty query tools.  
2. Choose and record a threshold for repeated steer-then-halt events per session, then alert when it is crossed; `N` must reflect expected query volume and error rates.
3. Re-run one golden dual-part prompt after every gate change.  
4. Inspect the final Theory: an Undetermined answer should name the failed query and preserve any usable measurements. Fail the evaluation if it presents a gap as a measured negative.

Related: [empty query is data](/blog/empty-query-not-absent-signal/), [deliver findings at the budget cap](/blog/deliver-findings-at-the-budget-cap/), [how models write Theories](/blog/what-reasoning-models-write-on-triage/).

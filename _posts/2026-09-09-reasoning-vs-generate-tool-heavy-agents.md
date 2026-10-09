---
layout: post
title: "Reasoning vs Generate Models for Tool-Heavy Agents"
date: 2026-09-09 16:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 65
description: "Merits and demerits of reasoning vs normal chat models on a live Grafana triage job — elapsed time, tokens, Theory style, and when each earns the bill."
image: /assets/images/og-default.png
tags: [ai-agents, reasoning, openai, evaluation, tokenomics, sre, reactree, aiden]
permalink: /blog/reasoning-vs-generate-tool-heavy-agents/
faqs:
  - question: "Should tool-heavy SRE agents always use reasoning models?"
    answer: "No. On our dual-part observability bench, a normal chat model (gpt-5.4) matched correctness with lower elapsed time than a heavy Responses reasoning preview, while an efficient xAI reasoning model won on cost/time. Pick by measured receipts, not brand."
  - question: "What are the merits of reasoning models here?"
    answer: "Stronger skepticism (artifact vs leak), denser numeric Theories on efficient reasoners, and better recovery when host gates stop dead retries."
  - question: "What are the demerits?"
    answer: "Higher elapsed time and tokens, hierarchical ReAcTree quality collapse without gates, and a habit of exploring catalogs before measuring."
---

[Reasoning effort is not free](/blog/reasoning-effort-is-not-a-free-upgrade/). This is the cousin question: **reasoning model vs normal chat model** when the job is mostly tools. Which OpenAI API you call is a third choice ([Completions vs Responses](/blog/chat-completions-vs-responses-api/)). A `resp_` id identifies the Responses endpoint, not the cause of a slow dig. Compare per-turn reasoning tokens, tool wait, and retries before attributing time to a model or API.

Data: [six combos](/blog/six-model-mode-combos-alert-logs-bench/), voice: [what they write](/blog/what-reasoning-models-write-on-triage/). We ran one **single-agent ReAct** and one **hierarchical ReAcTree** trial for each class ([what is ReAcTree?](/blog/what-is-reactree/) · [PDF](https://arxiv.org/pdf/2511.02424)).

---

## What the evidence supports

| Class | Merit | Demerit | Wave-1 ballpark |
|-------|-------|---------|-----------------|
| **xAI-class reasoning** | Highest relative efficiency in this wave; full closes; hierarchical slightly faster | Still ~190k tokens | ~141–157s, corr 1.0 |
| **Generate (gpt-5.4)** | Solid falsifiers; hierarchical used fewer total tokens | Verbose; hierarchical can get expensive under load | ~148–154s, 255–373k tok |
| **Responses reasoning preview** | In this run, skeptical artifact Theories | Slow, costly; hierarchical can stub | ~200–285s, ~475–516k tok; hierarchical corr 0.69 once |


---

## Merits of reasoning seats

1. **Alternative hypotheses** — the preview run considered a sparse metric series rather than assuming the goroutine-growth alert proved a leak. Check the sample density before accepting either explanation.
2. **Numeric habit** on efficient reasoners (derivatives, windows, baselines).  
3. **Recovery options** — after a failed query, a host can supply a typed error and permit a different probe. Whether that helps depends on the model and the tool failure.

## Demerits of reasoning seats

1. **Elapsed time and tokens** climb fast on preview-class models. Calling the Responses API is not the tax; **hidden thinking tokens and high effort** are ([Completions vs Responses](/blog/chat-completions-vs-responses-api/)).  
2. **Hierarchical ReAcTree fragility** without observation gates.  
3. **Catalog thrash** — empty `search_file`, skill loads, before the first PromQL.

## Merits of generate seats

1. **Predictable closes** with falsifier lines.  
2. **Hierarchical runs can shrink** total tokens on multi-part jobs (smaller context bill across the tree).  
3. **Cheaper $/useful Theory** than preview reasoning on this errand.

## Demerits of generate seats

1. **Verbosity** — operators skim less.  
2. Under contention, hierarchical may **inflate** tokens instead of compressing.  
3. In these closes, less emphasis on measurement-artifact hypotheses; a prompt or rubric can require an explicit alternative, but it cannot create missing evidence.

---

## Practical mix

![Reasoning effort and tool calls both contribute to run time](/assets/images/diagrams/sept/reasoning-cost.svg)

*Compare how much the model thinks and what the tool calls actually return on the same task.*


- Default Collect: **efficient reasoning or generate**, measured.  
- Synthesis-only high effort: still valid ([adaptive effort](/blog/reasoning-effort-is-not-a-free-upgrade/)).  
- Preview reasoning: **canary** behind gates, never silent default.  
- Hierarchical plan: **split the roster** — reasoning on `planning`, generate on dig `tool_calling` ([hybrid plan](/blog/hybrid-plan-smart-planner-generate-digs/)). Mapping high-effort reasoning onto every task is how digs burn eight minutes measuring one PromQL.

For this single alert-plus-logs task, the xAI-class seat had the best cohort-relative score; that is not a model-family ranking across incidents. Repeat the task and compare correctness before cost, including the full tree’s token use and the cost of failed tool calls.

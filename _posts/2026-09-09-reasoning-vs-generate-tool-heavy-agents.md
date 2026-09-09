---
layout: post
title: "Reasoning vs Generate Models for Tool-Heavy Agents"
date: 2026-09-09 16:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 65
description: "Merits and demerits of reasoning vs generate seats on a live Grafana triage job — wall, tokens, Theory style, and when each earns the bill."
image: /assets/images/og-default.png
tags: [ai-agents, reasoning, openai, evaluation, tokenomics, sre, reactree, aiden]
permalink: /blog/reasoning-vs-generate-tool-heavy-agents/
faqs:
  - question: "Should tool-heavy SRE agents always use reasoning models?"
    answer: "No. On our dual-part observability bench, a generate seat (gpt-5.4) matched correctness with lower wall than a Responses reasoning preview, while an xAI reasoning seat won efficiency. Pick by receipt."
  - question: "What are the merits of reasoning models here?"
    answer: "Stronger skepticism (artifact vs leak), denser numeric Theories on efficient reasoners, and better recovery when host gates stop dead retries."
  - question: "What are the demerits?"
    answer: "Higher wall and tokens, hierarchical ReAcTree quality collapse without gates, and a habit of exploring catalogs before measuring."
---

[Reasoning effort is not free](/blog/reasoning-effort-is-not-a-free-upgrade/). This is the cousin question: **reasoning seat vs generate seat** when the job is mostly tools.

Data: [six combos](/blog/six-model-mode-combos-alert-logs-bench/), voice: [what they write](/blog/what-reasoning-models-write-on-triage/). We A/B’d **single-agent ReAct** and **hierarchical ReAcTree** on each class ([what is ReAcTree?](/blog/what-is-reactree/) · [PDF](https://arxiv.org/pdf/2511.02424)).

---

## TL;DR

| Class | Merit | Demerit | Wave-1 ballpark |
|-------|-------|---------|-----------------|
| **Efficient reasoning (xAI-class)** | Best eff; full closes; hierarchical slightly faster | Still ~190k tokens | ~141–157s, corr 1.0 |
| **Generate (gpt-5.4)** | Solid falsifiers; hierarchical used fewer total tokens | Verbose; hierarchical can get expensive under load | ~148–154s, 255–373k tok |
| **Heavy reasoning preview (Responses)** | Skeptical artifact Theories | Slow, costly; hierarchical can stub | ~200–285s, ~475–516k tok; hierarchical corr 0.69 once |

### Explain like I'm five

A deep thinker and a fast writer both visit the same leaky basement. The deep thinker may notice the gauge is sticky. The fast writer may finish the insurance form sooner. You need the form either way.

---

## Merits of reasoning seats

1. **Disposition diversity** — artifact vs leak is a real prior, not noise.  
2. **Numeric habit** on efficient reasoners (derivatives, windows, baselines).  
3. **Room to use host steers** — when you halt dead queries, a thinking model can change rooms instead of looping.

## Demerits of reasoning seats

1. **Wall and tokens** climb fast on preview-class models.  
2. **Hierarchical ReAcTree fragility** without observation gates.  
3. **Catalog thrash** — empty `search_file`, skill loads, before the first PromQL.

## Merits of generate seats

1. **Predictable closes** with falsifier lines.  
2. **Hierarchical runs can shrink** total tokens on multi-part jobs (smaller context bill across the tree).  
3. **Cheaper $/useful Theory** than preview reasoning on this errand.

## Demerits of generate seats

1. **Verbosity** — operators skim less.  
2. Under contention, hierarchical may **inflate** tokens instead of compressing.  
3. Less natural “sticky gauge” skepticism unless the persona demands it.

---

## Practical mix

- Default Collect: **efficient reasoning or generate**, measured.  
- Synthesis-only high effort: still valid ([adaptive effort](/blog/reasoning-effort-is-not-a-free-upgrade/)).  
- Preview reasoning: **canary** behind gates, never silent default.  
- Hierarchical plan: **split the roster** — reasoning on `planning`, generate on dig `tool_calling` ([hybrid plan](/blog/hybrid-plan-smart-planner-generate-digs/)). Mapping high-effort reasoning onto every task is how digs burn eight minutes measuring one PromQL.

Ship a mix. Bill the mix. Do not romanticize the dial.

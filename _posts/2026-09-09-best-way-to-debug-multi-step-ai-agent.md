---
layout: post
title: "Best Way to Debug a Multi-Step AI Agent in Production"
date: 2026-09-09 14:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 64
description: "A practical debug loop for multi-step agents: one zip, one golden prompt, tool families, observation hashes, and Theory receipts — not more prompts."
image: /assets/images/og-default.png
tags: [ai-agents, debugging, workflows, production, evaluation, observability, reactree, aiden]
permalink: /blog/best-way-to-debug-multi-step-ai-agent/
faqs:
  - question: "What is the best way to debug a multi-step AI agent?"
    answer: "Freeze one golden prompt, export one execution debug bundle, grade what the model saw per step, separate tool good-vs-waste, then change one host gate or tool contract — not the system prompt first."
  - question: "Should I start by rewriting the system prompt?"
    answer: "No. Prompt changes hide harness bugs. Fix typed failures, fan-out, and completion gates first; use prompts for role and output shape only."
  - question: "What artifacts do I need?"
    answer: "Session id, wall clock, token totals, tool call list with outcomes, final Theory text, and ideally a single zip that holds the conversation plus tool payloads."
---

Here is the debug loop we use on multi-step agents in production — not a framework tour. Runtime notes from [Aiden](/blog/aiden-platform/) where useful; the steps are shape-agnostic.

---

## TL;DR

1. **One golden prompt** you can re-run cold.  
2. **One debug zip / session export** ([one zip, one conversation](/blog/one-zip-one-conversation/)).  
3. Grade **per step**: what the model saw, which tools paid rent, which were waste.  
4. Fix **host contracts** before prose.  
5. Rematch the golden prompt and publish **absolute** wall/tokens/correctness.

### Explain like I'm five

When a Rube Goldberg machine fails, you do not rewrite the instruction manual first. You watch which gear stuck, replace that gear, then run the same marble again.

---

## Step 1 — Freeze the errand

Dual-part jobs are ideal: alert triage + log anomaly ([our combo](/blog/six-model-mode-combos-alert-logs-bench/)). If the agent can fake Part A and skip Part B, your gate is soft.

Record: model, **orchestration shape** (**single-agent** ReAct vs **hierarchical** ReAcTree — [primer](/blog/what-is-reactree/) · [PDF](https://arxiv.org/pdf/2511.02424)), host flags, tool endpoint, session id.

---

## Step 2 — Export once

Prefer a single artifact: transcript + tool results + stage timeline. If you only have logs, at least pull:

- wall seconds  
- token in/out  
- tool names + error strings  
- final Theory / Unknowns / Do-this-now  

For hierarchical runs, merge parent and child spans from session traces. Parent-only logs lie.

---

## Step 3 — Grade the loop, not the vibes

Ask four questions:

| Question | Fail looks like |
|----------|-----------------|
| Did measurement tools run? | Only `search_tools` / skills |
| Did failures look like failures? | HTTP 200 empty treated as success |
| Did observations change? | Same failed LogQL five times |
| Did the close name receipts? | Undetermined with no blocked query |

Bring-up multi-stage workflows [like hardware](/blog/bring-up-agent-workflows-like-hardware/): green one stage at a time.

---

## Step 4 — Change the host

Order of operations that saved us time:

1. Typed failure / no-progress / fan-out ([stop retrying](/blog/stop-retrying-the-same-failed-query/))  
2. Tool path contracts ([cursor paging for truncated tool output](/blog/cursor-paging-spilled-agent-tool-output/))  
3. Prefer parent measurement before children ([single vs multi](/blog/single-agent-vs-multi-agent/))  
4. Prompt / skill text last  

Mid-run steer belongs here too ([steer agents mid-run](/blog/steer-ai-agents-mid-run/)) — operators need a cancel path when the loop is clearly stuck.

---

## Step 5 — Rematch and refuse relative theater

If wall doubled, say wall doubled ([relative efficiency lies](/blog/relative-efficiency-scores-lie/)). If correctness jumped on one seat, show the Theory text.

That is the whole craft: **same marble, one gear, honest stopwatch**.

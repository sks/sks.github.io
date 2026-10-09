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
    answer: "Session id, elapsed seconds, token totals, tool call list with outcomes, final Theory text, and ideally a single zip that holds the conversation plus tool payloads. To see which OpenAI API and how much thinking ran, check whether response ids start with resp_ or chatcmpl_, and whether usage lists reasoning tokens."
---

When a multi-step agent gives a plausible but unsupported incident diagnosis, start from the execution record rather than rewriting its prompt. This procedure uses [Aiden](/blog/aiden-platform/) traces as an example, but applies wherever model calls and tool observations can be exported.

---

## What the evidence supports

1. **One golden prompt** you can re-run cold.  
2. **One debug zip / session export** ([one zip, one conversation](/blog/one-zip-one-conversation/)).  
3. Grade **per step**: what the model saw, which tools paid rent, which were waste.  
4. Fix **host contracts** before prose.  
5. Rematch the golden prompt and publish **absolute** wall/tokens/correctness.


---

## Step 1 — Freeze the errand

A two-part test—alert triage plus a log comparison, as in [our bench](/blog/six-model-mode-combos-alert-logs-bench/)—makes omissions visible. Freeze the request, expected evidence, time windows, and tool access; otherwise a rematch may test a different task. A single-part job can still work if its expected observations are explicit.

Record: model, **orchestration shape** (**single-agent** ReAct vs **hierarchical** ReAcTree — [primer](/blog/what-is-reactree/) · [PDF](https://arxiv.org/pdf/2511.02424)), host flags, tool endpoint, session id.

---

## Step 2 — Export once

Prefer a single artifact: transcript + tool results + stage timeline. If you only have logs, at least pull:

- elapsed seconds  
- token in/out  
- tool names + error strings  
- final Theory / Unknowns / Do-this-now  
- per model call: model name, whether the response id starts with `resp_` (Responses API) or `chatcmpl_` (Chat Completions), and whether usage lists reasoning tokens ([Completions vs Responses](/blog/chat-completions-vs-responses-api/))

For hierarchical runs, merge parent and child spans (timed records of model and tool calls) using the session id. A parent-only view can miss a child’s measurement or hide a child’s repeated failed query.

---

## Step 3 — Inspect observations and claims

Read the sequence from tool request to observation to final claim. For example, an HTTP 200 may carry a query envelope whose `outcome` is `failed`; transport success is not measurement success. Ask four questions:

| Question | Fail looks like |
|----------|-----------------|
| Did measurement tools run? | Only `search_tools` / skills |
| Did failures look like failures? | HTTP 200 empty treated as success |
| Did observations change? | Same failed LogQL five times |
| Did the close name receipts? | Undetermined with no blocked query |

Bring-up multi-stage workflows [like hardware](/blog/bring-up-agent-workflows-like-hardware/): green one stage at a time.

---

## Step 4 — Change the host

Change one variable at a time. For a repeated failed query, this order helps distinguish a broken tool contract from a model instruction problem:

1. Typed failure / no-progress / fan-out ([stop retrying](/blog/stop-retrying-the-same-failed-query/))  
2. Tool path contracts ([cursor paging for truncated tool output](/blog/cursor-paging-spilled-agent-tool-output/))  
3. Prefer parent measurement before children ([single vs multi](/blog/single-agent-vs-multi-agent/))  
4. Prompt / skill text last  

Mid-run steer belongs here too ([steer agents mid-run](/blog/steer-ai-agents-mid-run/)) — operators need a cancel path when the loop is clearly stuck.

---

## Step 5 — Rematch with absolute measures

If wall doubled, say wall doubled ([relative efficiency lies](/blog/relative-efficiency-scores-lie/)). If correctness jumped on one seat, show the Theory text.

Keep both before-and-after traces. If correctness improved but the tool server was less contended, do not attribute the wall-time change to your code. If the new gate halts an agent early, require it to carry the partial evidence and blocked query into the final answer.

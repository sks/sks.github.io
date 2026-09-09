---
layout: post
title: "Chat Completions vs Responses API (and Why Agents Feel Slow)"
date: 2026-09-09 22:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 69
description: "OpenAI Chat Completions and the Responses API are two ways to call a model. Reasoning models are a different choice. How to tell them apart in a debug export, and why Responses is not automatically slower."
image: /assets/images/og-default.png
tags: [ai-agents, openai, reasoning, debugging, tokenomics, aiden, golang]
permalink: /blog/chat-completions-vs-responses-api/
faqs:
  - question: "Is the Responses API slower than Chat Completions?"
    answer: "Usually no. If you use the same model, the same tools, and you are not asking the model to do extra hidden thinking, both APIs take about the same time. Runs feel slow when the model spends tokens on internal reasoning, when every worker thinks hard, or when the client tries Completions first, gets an error, then retries on Responses."
  - question: "How do I know which API an agent run used?"
    answer: "Open the execution debug export and look at the model call records. Response ids that start with resp_ came from the Responses API. Ids that start with chatcmpl_ came from Chat Completions. If the usage block lists reasoning tokens (often named output_reasoning_tokens), the model also did hidden thinking on that turn."
  - question: "Is using the Responses API the same as using a reasoning model?"
    answer: "No. The API is only how your app talks to the provider. A normal chat model can use Responses. A reasoning model can still fail on Chat Completions when you attach tools and turn thinking on. Pick the API for compatibility. Pick the model for how hard it should think."
---

When an investigation takes seven minutes, it is easy to blame “the Responses API.”

That usually mixes three different choices:

1. **Which API** the runtime called (Chat Completions or Responses)
2. **Which kind of model** ran (a normal chat model or a reasoning model)
3. **How hard** that model was told to think (reasoning effort)

This post separates those three with language you can reuse in a runbook, plus fields you can check in a debug export. Related reading: [reasoning effort](/blog/reasoning-effort-is-not-a-free-upgrade/), [reasoning vs normal models on tool-heavy jobs](/blog/reasoning-vs-generate-tool-heavy-agents/), [planner on a thinking model, workers on a fast model](/blog/hybrid-plan-smart-planner-generate-digs/).

---

## TL;DR

| What people say | What is usually going on |
|-----------------|--------------------------|
| “Responses is slow” | The model is thinking, the workers are on a reasoning model, or the client retried after a Completions error |
| “We used reasoning because the id says `resp_`” | `resp_` only means Responses API. Check whether usage reports **reasoning tokens** |
| “Turn thinking up on the newest model” | Many models reject tools + thinking on Chat Completions and require Responses |
| “The trace says operation=`chat`, so this is Completions” | That label is often wrong or too coarse. Prefer the response id prefix |

### Explain like I'm five

Mail and courier are two ways to deliver a letter. A short note and a long essay are two kinds of letter. If the essay took all afternoon, do not blame the courier.

---

## Two separate decisions

Think of a grid:

| | Normal chat model | Reasoning model |
|--|-------------------|-----------------|
| **Chat Completions** | Everyday agent loop | Often rejected when tools and thinking are both on |
| **Responses API** | Fine | Usually required for tools + thinking |

**API (rows):** which OpenAI endpoint (or compatible server) your runtime calls. Completions responses are often id’d `chatcmpl_…`. Responses API ids are often `resp_…`.

**Model class (columns):** a normal model that mostly writes the answer you see, vs a reasoning model that may also spend **hidden thinking tokens** before that answer. Providers bill and time those thinking tokens separately (in traces they often appear as `output_reasoning_tokens` or `reasoning_tokens`).

You can put a normal model on Responses. You can also fail a reasoning call on Completions and only succeed after a retry on Responses. Those are different problems.

---

## Why Chat Completions rejects some reasoning calls

Several current OpenAI-family models allow **tools plus thinking** only on the Responses API. Chat Completions returns an error unless you turn thinking off or switch APIs.

When our Go runtime was Completions-first, we saw:

- clear HTTP 400 errors when someone put a high-thinking model on a tool-heavy worker
- temporary workarounds that used an older model that still accepted tools on Completions
- occasional **double cost and double wait**: Completions fails, then Responses succeeds

Today the OpenAI path can prefer Responses when the model catalog says thinking levels exist, and it can still fall back from Completions to Responses when the first call refuses tools + thinking. The effort dial still matters: [reasoning effort is not free](/blog/reasoning-effort-is-not-a-free-upgrade/).

**Takeaway.** Supporting Responses does not mean every worker should think hard. It means the call does not die with a 400 when a reasoning model needs tools. **Which model each role uses** still decides latency ([hybrid plan](/blog/hybrid-plan-smart-planner-generate-digs/)).

---

## Is Responses slower?

**Not as “which URL you call.”**

What actually slows a run:

1. **Hidden thinking tokens** — the model spends time before you see a tool call or a sentence  
2. **High thinking on every worker turn** — a long think before each metric or log query  
3. **Retry after a Completions error** — you pay for a failed call and then the real call  
4. **Huge prompts and one-at-a-time workers** — still the main cost of many investigate-alert sessions  

On a recent investigator export: almost every primary-model hop used Responses (`resp_…`), many hops reported reasoning tokens, and a few helper hops on another model reported none. The slow part was how the dig was shaped and how much thinking we asked for, not “we picked the wrong endpoint name.”

---

## How to read a debug export

Export one run ([how we debug multi-step agents](/blog/best-way-to-debug-multi-step-ai-agent/) · [one zip, one conversation](/blog/one-zip-one-conversation/)). In the LLM call records inside `execution.json`:

| What to look at | Chat Completions | Responses / thinking |
|-----------------|------------------|----------------------|
| Response id | starts with `chatcmpl_` | starts with `resp_` |
| Reasoning token fields | missing or zero | often greater than zero |
| Reasoning effort setting | often absent | may be set; missing does not always mean “no thinking” if the model defaults to some thinking |

Also check **which model** each role got. A good mix is: planner on a reasoning model, workers on a normal chat model. If every worker is also on a high-thinking Responses model, the dig will feel stuck even when the API is fine.

Do not trust `gen_ai.operation.name: chat` alone. We still see that label on Responses calls.

---

## Checklist for builders

- [ ] In docs, say **API** and **model class** as two sentences, not one buzzword  
- [ ] Use Responses (or Completions then Responses on refuse) when tools and thinking are both required  
- [ ] Log response id prefix and reasoning token counts on every model call  
- [ ] Default workers to a normal / low-thinking model; keep hard thinking for planning and final write-up  
- [ ] When a run is slow, ask “did it think?” before “is Responses broken?”  

---

## Where to go next

- [Reasoning effort is not a free upgrade](/blog/reasoning-effort-is-not-a-free-upgrade/) — where to spend thinking time  
- [Reasoning vs generate models for tool-heavy agents](/blog/reasoning-vs-generate-tool-heavy-agents/) — which model class fits a Grafana job  
- [Hybrid plan: smart planner, generate digs](/blog/hybrid-plan-smart-planner-generate-digs/) — different models for planner and workers  
- [Best way to debug a multi-step AI agent](/blog/best-way-to-debug-multi-step-ai-agent/) — one golden prompt, one export, fix the host first  

Blame the essay length, not the courier.

---

*Routing Completions vs Responses in a production agent runtime? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

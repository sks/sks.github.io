---
layout: post
title: "From Lighthouse to LLMs — A Performance Vocabulary for the Token Era"
date: 2026-07-17 10:00:00 -0700
description: "FCP, LCP, TBT, and CLS don't measure what users wait for in AI apps. Here's the LLM equivalent of each — and how to debug them."
tags: [llm, performance, observability, web-vitals, ai-agents, system-design]
---

If you're transitioning from traditional web engineering into AI/LLM product work, your performance instincts are still valuable — but the vocabulary needs an update.

In the web world, we use Google Lighthouse to measure pixels, bytes, and clicks. Users wait for the DOM to paint, images to decode, and JavaScript to stop blocking the main thread.

In the LLM world, users aren't waiting for images to load. They're waiting for **tokens to generate**. The bottleneck might be a cold API connection, a 10,000-token system prompt saturating the pre-fill phase, or a model that streams valid JSON until it suddenly doesn't.

You can't copy-paste Lighthouse scores onto an AI feature and call it done. But you *can* translate the mental model. Here's the map I wish someone had handed me on day one.

---

## Why Web Metrics Break Down for LLMs

Google's Core Web Vitals measure **perceived load time** and **visual stability** on a page the browser already has the bytes for. The user experience problem is: *when does something useful appear, and does the layout jump around while it does?*

LLM applications have a different physics:

| Web assumption | LLM reality |
|----------------|-------------|
| Payload arrives, then renders | Output is **generated incrementally** over seconds or minutes |
| Work is mostly client-side | Heavy compute happens **on a remote GPU** you don't control |
| "Loaded" is a discrete event | "Done" is when the model emits a **stop token** — or errors mid-stream |
| Stability = pixels don't move | Stability = **structure doesn't break** mid-response |

The four mappings below aren't perfect analogies. They're **debugging lenses** — a shared language for teams that span frontend, backend, and ML infrastructure.

---

## 1. First Contentful Paint (FCP) → Time to First Token (TTFT)

### Web: FCP

**First Contentful Paint** measures how long after navigation until the browser renders *anything* meaningful — text, an image, a canvas. It's the moment the user stops staring at a blank screen.

A slow FCP usually means: slow server response, render-blocking resources, or a massive bundle before first paint.

### LLM: TTFT

**Time to First Token** measures how long after the user submits a prompt until the model streams its **first output token**.

That might be the first word of a chat reply, the opening `{` of a JSON object, or the first chunk of a tool-call argument in an agent workflow.

### Why it matters

TTFT is the LLM equivalent of "does this app feel frozen?" Humans tolerate waiting more gracefully when *something* starts happening quickly — a cursor blink isn't enough; they need visible progress.

Research on perceived latency consistently shows that **time-to-first-feedback** dominates satisfaction more than total duration for interactive tasks. A response that takes 30 seconds but shows the first token in 400ms feels very different from one that sits silent for 8 seconds and then dumps everything at once.

### What drives TTFT up

- **Cold starts** — serverless inference endpoints spinning up GPUs on first request
- **Network round-trips** — TLS handshake, geographic distance to the API region
- **Queueing** — shared inference clusters under load; your request waits behind others
- **Routing overhead** — classification, safety filters, or retrieval that runs *before* generation starts
- **Large prompts** — not quite the same as TBT (below), but a huge context still adds latency before token zero

### How to measure it

Instrument at the client or API gateway:

```
user_submitted_at  →  first_token_received_at  =  TTFT
```

For streaming APIs, TTFT is the delta between sending the request and receiving the first `content` chunk in the SSE/WebSocket stream. Log it per model, per region, per prompt size bucket.

### How to improve it

- **Warm pools** or provisioned throughput for production endpoints
- **Edge routing** to the nearest inference region
- **Don't block generation on retrieval** — start streaming a "thinking..." state while RAG runs, or pipeline retrieval in parallel with a draft response (product-dependent)
- **Smaller routing models** for classification that must happen pre-generation
- **Streaming always on** — never buffer the full response server-side before sending byte one to the client

### Agent wrinkle

In tool-calling agents, users often perceive TTFT at **two** moments: first token of the *planning* response, and first token after a *tool result* is fed back. Track both. An agent that feels fast on the first message but goes silent for 15 seconds after every tool call has a TTFT problem on the second hop, not the first.

---

## 2. Largest Contentful Paint (LCP) → Total Generation Time

### Web: LCP

**Largest Contentful Paint** measures when the largest visible element (hero image, headline block) finishes rendering. It's the "main content is here" moment — not just *something*, but *the thing you came for*.

### LLM: Total Generation Time (TGT)

**Total Generation Time** (or **time-to-last-token**) measures how long from user submission until the model finishes — the final token, the closing brace, the stop sequence.

For a chat app, that's the full answer. For an agent, that's the entire multi-step run until the task completes or errors out.

### Why it matters

A snappy TTFT with glacial throughput is a trap. Users see immediate feedback, then wait forever. LCP taught us the same lesson on the web: a fast spinner followed by a 12-second hero image load still feels broken.

**Tokens per second (TPS)** is the throughput half of this equation:

```
effective_duration ≈ TTFT + (output_tokens / TPS)
```

A model with 200ms TTFT and 80 TPS generates a 400-token response in ~5.2 seconds. The same TTFT at 15 TPS takes ~27 seconds. Same "snappy start," wildly different LCP equivalent.

### What drives total generation time up

- **Long outputs** — models that ramble, or prompts that encourage verbosity
- **Low TPS** — smaller models on overloaded hardware, or rate-limited tiers
- **Sequential agent steps** — each tool call adds another full generation cycle
- **Retries** — malformed JSON triggers a re-prompt; you pay generation time twice
- **Reasoning models** — internal chain-of-thought tokens count even when hidden

### How to measure it

```
user_submitted_at  →  last_token_received_at  =  Total Generation Time
```

Also log `output_token_count` and compute effective TPS. Break down agent runs by **per-step** generation time, not just end-to-end — otherwise you can't tell whether the model is slow or the tools are.

### How to improve it

- **Output length controls** — max tokens, concise system prompts, "answer in 3 bullets"
- **Model tiering** — fast model for drafts, slow model for final polish (if quality allows)
- **Parallel tool calls** where the task permits independent evidence gathering
- **Don't retry blindly** — repair truncated JSON locally before re-prompting the model
- **Cache** semantically identical prompts (careful with staleness)

### The scorecard trap

Teams often optimize TTFT because it's easy to measure and demos well. Total generation time is what shows up in session length metrics, support tickets ("it took forever"), and inference bills. Optimize both, but don't trade one for the other invisibly.

---

## 3. Total Blocking Time (TBT) → Prompt Pre-fill / Queue Time

### Web: TBT

**Total Blocking Time** sums every period where the main thread is blocked long enough to prevent input responsiveness — typically JavaScript execution chunks over 50ms. Heavy parsing, layout thrashing, and synchronous work on the critical path all contribute.

The user can see the page, but they can't interact. The UI feels frozen.

### LLM: Pre-fill Time

**Pre-fill time** (sometimes called **prompt processing time** or **input processing**) is the phase where the inference engine processes the **entire input context** — system prompt, retrieved documents, conversation history, tool results — **before** generating the first output token.

During pre-fill, the GPU is busy. The user sees nothing new (or only a loading indicator). From their perspective, the app is blocked — even if TTFT is technically measured *after* pre-fill completes.

On many inference stacks, pre-fill time scales **roughly linearly with input token count**. Double the context, double the wait before token one.

### Why it matters

This is the hidden tax of "just throw it in the context window."

That 10,000-token PDF you stuffed into the system prompt? The 40 retrieved RAG chunks? The full tool output from `kubectl describe`? Each token must be processed before generation begins. Users experience this as a long pause *after* they hit Enter and *before* anything streams — a dead zone that TTFT alone doesn't explain if you're not segmenting your telemetry.

### Pre-fill vs TTFT — don't conflate them

| Phase | What's happening | User perception |
|-------|------------------|-----------------|
| Queue time | Request waiting for a GPU slot | "Nothing is happening" |
| Pre-fill | Input tokens processed | "Still nothing" |
| Decode | Output tokens generated | "It's responding" |

**TTFT = queue + pre-fill + first decode token.** If you only track TTFT, you can't tell whether to fix queueing, shrink the prompt, or switch models.

### What drives pre-fill up

- **Massive system prompts** — persona, policies, few-shot examples, tool schemas all in every request
- **Unbounded conversation history** — sending the full thread instead of a summary
- **RAG over-retrieval** — 50 chunks because similarity threshold was loose
- **Tool outputs in context** — multi-KB JSON blobs from API calls, repeated every turn
- **Multi-modal inputs** — images and PDFs expand token count dramatically

### How to measure it

If your inference provider exposes timing breakdowns (many do in response headers or usage metadata), log:

- `queue_time_ms`
- `prompt_tokens` / `prompt_eval_duration`
- `completion_tokens` / `eval_duration`

If not, proxy it: measure time from request sent to first byte, and correlate with `input_token_count` across requests. A steep slope means you're pre-fill bound.

### How to improve it

- **Context budgeting** — cap history, summarize old turns, prune tool outputs
- **Retrieve less, retrieve better** — quality over quantity in RAG
- **Tool output summarization** — feed the model a digest, not raw logs
- **Prompt caching** — many providers cache identical prompt prefixes across requests; structure prompts so static content comes first
- **Smaller tool schemas** — bloated OpenAPI-style definitions in every call add up fast

### Agent wrinkle

Agents are pre-fill machines. Every tool result lands back in context. A five-step investigation can accumulate more input tokens on step five than step one had in total — and each step pays pre-fill on the *entire* accumulated history. **Context growth per step** is an agent-specific TBT metric worth charting.

---

## 4. Cumulative Layout Shift (CLS) → Output Drift and Schema Breaks

### Web: CLS

**Cumulative Layout Shift** measures unexpected visual movement — an ad loads and pushes the "Submit" button down, you misclick. Stability means the UI you started interacting with is the UI you finish interacting with.

### LLM: Output Drift

**Output drift** is the structural equivalent: the model's output **changes shape mid-stream** in a way that breaks your consumer.

Examples:

- Streaming markdown until a code fence never closes
- JSON that starts valid and truncates mid-object
- A tool call where the model invents a fourth argument halfway through
- Classification that flips from `safe` to `unsafe` on the last token
- An agent that says "I'll only read files" and then emits a shell command

The user's mental model — and your parser's assumptions — **shift underneath them**. That's CLS for LLMs.

### Why it matters

Web CLS causes mis-clicks. LLM output drift causes **parser crashes, silent data corruption, and wrong tool invocations** — often worse than a visible error because the system proceeds with garbage.

Frontend developers learned to reserve space for ads and set image dimensions. LLM developers need the same discipline: **never assume the model will finish the shape it started.**

### Common drift patterns

| Pattern | What breaks | Symptom |
|---------|-------------|---------|
| Truncated JSON | `json.Unmarshal`, Zod schemas | `unexpected end of JSON input` |
| Fence-wrapped output | Naive parsers | Valid JSON hidden inside markdown |
| Type drift | Strict structs | `"count": "five"` instead of `"count": 5` |
| Schema creep | Tool validators | Extra fields, renamed keys |
| Formatting decay | Long generations | Model "forgets" it's in JSON by token 800 |
| Tool hallucination | Governance layer | Model calls a tool that wasn't offered |

### How to measure it

- **Parse success rate** — % of completions that pass schema validation on first try
- **Repair rate** — how often you need JSON repair or retry logic
- **Mid-stream abort rate** — streams that end without a stop token or closing delimiter
- **Tool validation failures** — args rejected by type checking or policy
- **Downstream error rate** — frontend crashes, workflow failures, 500s after "successful" model calls

### How to improve it

- **Structured outputs** — JSON mode, constrained decoding, grammar-guided generation where supported
- **Repair at the right layer** — syntax repair (trailing commas, fences) vs semantic validation (wrong field types)
- **Validate after repair, not before** — see [why one repair pass isn't enough](/blog/json-repair-layers/) for the ordering trap
- **Shorter generations** — less runway for format decay
- **Don't stream directly into a brittle parser** — buffer until you have a complete logical unit, or use incremental parsers designed for partial JSON
- **Streaming truncation handling** — repair on stream end before finalizing tool calls

### Agent wrinkle

Agents multiply drift risk. Each tool call is a parse boundary. Each sub-agent returns prose that gets embedded in the parent's context. **Drift anywhere in the tree propagates.** Measure parse success rate per tool, not just per chat message.

---

## Putting It Together: A Debugging Flowchart

Next time someone says "the AI feature feels slow," don't stop at vibes. Ask:

```
1. Is nothing happening for a while, then tokens appear?
   → TTFT problem (cold start, queue, routing, or pre-fill)

2. Do tokens appear fast, but the answer takes forever?
   → Throughput / total generation time (TPS, output length, retries)

3. Is there a long dead zone before ANY tokens, especially on big prompts?
   → Pre-fill / context bloat (history, RAG, tool outputs)

4. Does it stream fine until the UI/parser explodes at the end?
   → Output drift (truncation, schema break, fence wrapping)
```

For agents, add:

```
5. Does it feel fast on message one and slow after every tool call?
   → Per-hop TTFT + growing pre-fill from accumulated context

6. Does the agent "work" but do the wrong thing?
   → Tool hallucination or semantic drift — a CLS problem, not a latency problem
```

---

## A Comparison Table

| Web Vital | LLM Equivalent | Measures | User feels |
|-----------|----------------|----------|------------|
| **FCP** | **TTFT** | Time to first output token | "Is it frozen?" |
| **LCP** | **Total generation time** | Time to last token / task done | "Why is this taking so long?" |
| **TBT** | **Pre-fill / queue time** | Input processing before decode | "I hit Enter and nothing happened" |
| **CLS** | **Output drift** | Structural stability of output | "It broke halfway through" |

---

## What to Instrument on Day One

You don't need a bespoke observability platform to start. Log these fields on every LLM request:

| Field | Why |
|-------|-----|
| `ttft_ms` | Snappiness |
| `total_duration_ms` | End-to-end wait |
| `input_tokens` / `output_tokens` | Pre-fill and cost proxies |
| `tokens_per_second` | Throughput |
| `parse_success` (bool) | Drift detector |
| `retry_count` | Hidden latency multiplier |
| `model` / `region` | Segmentation |

For agents, add per-step spans: each LLM call and each tool execution as a child of the session trace. Without that breakdown, you'll optimize the wrong hop.

---

## Lessons Learned

1. **Borrow the web mental model, not the web metrics.** Lighthouse scores don't apply. The *categories* — first paint, main content, blocking, stability — absolutely do.

2. **TTFT and total time are independent problems.** Fixing one doesn't fix the other. Demo TTFT; production cares about both.

3. **Pre-fill is the silent killer of "unlimited context."** Bigger windows don't help if you fill them with garbage the GPU must read every turn.

4. **Output drift is a UX metric, not just a parsing bug.** Users experience schema breaks as untrustworthy, glitchy software — the same way they experience layout shift as a broken page.

5. **Agents compound all four.** Multi-step runs stack pre-fill, multiply TTFT hops, extend total time, and add parse boundaries. Measure the workflow, not just the chat message.

---

*Which of these four are you wrestling with most — TTFT, total generation time, pre-fill bloat, or output drift? I'd love to hear what's biting you in production. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

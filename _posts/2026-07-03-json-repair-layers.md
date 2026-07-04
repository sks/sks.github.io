---
layout: post
title: "Why One JSON Repair Pass Isn't Enough for Production Agent Tool Calls"
date: 2026-07-03 10:00:00 -0700
series: "Building an AI Agent Platform in Go"
series_order: 13
description: "LLMs emit broken tool JSON constantly. Here's why a single repair step fails in production — and what we learned fixing it."
tags: [ai-agents, production, go, reliability, tool-calls]
---

Your agent didn't crash. It just stopped mid-run with `invalid character after top-level value` — after spending real money on tokens and looking completely healthy until the tool handler tried to parse its arguments.

If you build agent platforms in Go — middleware pipelines, tool handlers, streaming model adapters — you've probably seen this. This post is for that crowd: AI backend and platform engineers shipping tool-calling agents to production, not prompt-engineering tutorials.

The LLM *almost* produced valid JSON. Almost isn't good enough when strict parsing is your gatekeeper.

We spent months building defense-in-depth for **security** ([layered governance](/blog/defense-in-depth/)). It turns out you need the same philosophy for **reliability**: one JSON repair pass is not enough when models stream, truncate, wrap output in markdown fences, and double-encode payloads.

---

## The Failure Modes

Before layering fixes, name the ways tool JSON breaks in the wild:

| Symptom | Typical cause |
|---------|---------------|
| `invalid character after top-level value` | Trailing prose after a JSON object, or two objects concatenated |
| `unexpected end of JSON input` | Streaming cut off mid-object; truncated tool argument blocks |
| Fence-wrapped JSON | Model wraps args in markdown code blocks despite the schema |
| Double-encoded strings | Model returns a JSON string containing JSON instead of a JSON object |
| Semantic garbage that parses | Valid JSON, wrong shape — goal text leaked into a structured field |

**Key insight:** These are not one bug. Streaming truncation needs different handling than fence stripping. A generic repair library won't fix domain-specific field bleed. That's why we ended up with multiple repair points instead of one heroic library import.

---

## Why One Layer Isn't Enough

Think of repair happening at different **boundaries** in the stack, each catching a different class of failure:

**Early in the execution path** — before tool routing, so malformed arguments get fixed before they pollute logs, traces, or downstream middleware. Much of this belongs in the agent framework itself; we contributed generic fixes upstream as part of our [open-source work](/blog/open-source-ecosystem/) rather than forking duplicate logic.

**At the agent boundary** — an opt-in repair step when agents and sub-agents are constructed, so broken args get fixed before they propagate through the system.

**At the tool handler boundary** — the last line of defense before your application code sees bytes. If the model emitted a mostly-valid object with trailing garbage, this layer recovers the usable part instead of failing the whole run.

**In domain-specific middleware** — generic repair can't fix *meaning*. Sometimes the model puts a user's goal in the wrong field, or nests fields incorrectly for a tool that expects a specific envelope shape. That requires product logic, not a syntax repair library. Removing this layer because "the framework has jsonrepair now" would break tools silently.

**In prose output parsers** — a different job entirely. [Aiden](/blog/aiden-platform/) parses free-text model responses — navigation payloads, UI schemas, quality rubrics. That's not tool-call JSON. It's LLM prose that *should* contain JSON somewhere. Different input shape, different call sites, different failure modes. Don't delete prose parsers just because tool-argument repair improved upstream.

---

## The Bug Class: Repair After Validation

Here's the mistake that cost us real incidents: **running strict validation before repair.**

A middleware stack that validates tool arguments with a plain parse, then a separate middleware that fixes semantic issues for specific tools, means generic malformed JSON hits validation first and dies — technically correct error, operationally useless.

Meanwhile, earlier repair layers in the pipeline may have already fixed most problems. But anything that slips through — or any tool path that bypasses framework repair — still hits validation cold.

**Fix:** Repair-then-validate. Either run a generic repair step before validation in the middleware chain, or change validation to attempt repair on parse failure for recoverable payloads.

Don't remove validation. It produces structured errors models can learn from. **Fix the order.**

---

## What's Redundant vs What's Not

| Repair point | Remove? | Verdict |
|--------------|---------|---------|
| Framework-level (early path) | No | Framework-owned; contribute upstream, don't fork |
| Agent-boundary opt-in | Maybe after soak | Trial disable on paths well-covered below |
| Tool handler boundary | No | Core fix — keep |
| Domain semantic middleware | No | Product logic — not replaceable by generic repair |
| Prose output parsers | No | Different job than tool args |

**Not worth doing yet:** ripping out overlapping layers because "we have repair now." Wait several weeks of production soak. Measure tool-call failure rates before and after.

---

## Streaming: A Special Case

Standard repair handles complete-but-messy JSON. **Streaming** is worse: a tool argument block can arrive truncated — valid prefix, no closing brace.

The fix belongs at the lifecycle moment when the stream finalizes the block: attempt repair on the partial buffer, fall back to an empty object only when repair fails entirely. Repair closes unterminated strings, arrays, and objects so a truncated chunk becomes syntactically valid before parsing runs. Without this, agents using streaming models die mid-incident on long tool arguments — exactly when you need them most.

The empty-object fallback is a last resort. It preserves the run but drops args. Repair-first recovers most truncated payloads.

---

## Defense-in-Depth for Probabilistic Output

Security defense-in-depth assumes attackers are creative. JSON repair defense-in-depth assumes **models are sloppy**:

1. **Repair early** so traces and logs show clean args
2. **Repair at tool boundaries** so handlers stay simple
3. **Repair semantically** where domain shape matters
4. **Parse prose separately** where output isn't a tool call at all
5. **Validate after repair** so models still get useful error feedback

No single layer catches everything. That's the point.

---

## What We Learned

1. **One repair library is not a strategy.** It fixes syntax. It doesn't fix streaming truncation at the right lifecycle hook, semantic field bleed, or prose-embedded JSON.

2. **Ordering matters as much as repair.** Validation before repair is a bug class. Audit your middleware chain.

3. **Don't consolidate layers you haven't measured.** Overlap between layers is fine during a soak. Premature deletion brings back 3 AM pages.

4. **Keep framework fixes in the framework.** Upstream generic repair so the community benefits and your fork shrinks. Product-specific semantic repair stays in the product.

5. **Contribute the generic fix, keep the domain fix.** Same pattern as our [open-source contribution model](/blog/open-source-ecosystem/) — isolate what's universal, merge it upstream, build what's specific on top.

---

*How many JSON repair layers does your agent stack have? Genuinely curious whether teams hit the validation-before-repair trap too. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

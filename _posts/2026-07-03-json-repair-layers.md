---
layout: post
title: "Why One JSON Repair Pass Isn't Enough for Production Agent Tool Calls"
date: 2026-07-03 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 13
description: "Production agent tool calls need layered JSON repair — why one pass fails on malformed LLM output and what we learned in Go middleware."
image: /assets/images/og-why-go.png
tags: [ai-agents, production, go, reliability, tool-calls]
---

A tool-calling agent can run normally until a handler parses its arguments and returns `invalid character after top-level value`. By then the run has already spent tokens, and the error may leave an investigation unfinished.

If you build [production AI agents in Go](/topics/go-ai-agents/) — middleware pipelines, tool handlers, streaming model adapters — you've probably seen this. This post is for that crowd: AI backend and platform engineers shipping tool-calling agents to production, not prompt-engineering tutorials.

A large language model (LLM) may produce almost-valid JavaScript Object Notation (JSON), the structured format many tool handlers expect. Strict parsing rejects it even when the intended arguments are apparent.

Our [layered governance](/blog/defense-in-depth/) work suggested a reliability analogue: different boundaries see different malformed payloads. Multiple repair points helped with streamed, truncated, fenced, or double-encoded arguments; none replaces validation.

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

These are different failure classes. Streaming truncation needs different handling than fence stripping. A generic repair library cannot decide whether text belongs in a domain-specific field. That is why we retained multiple repair points.

---

## Why One Layer Isn't Enough

Think of repair happening at different **boundaries** in the stack, each catching a different class of failure:

**Early in the execution path** — before tool routing, so malformed arguments get fixed before they pollute logs, traces, or downstream middleware. Much of this belongs in the agent framework itself; we contributed generic fixes upstream as part of our [open-source work](/blog/open-source-ecosystem/) rather than forking duplicate logic.

**At the agent boundary** — an opt-in repair step when agents and sub-agents are constructed, so broken args get fixed before they propagate through the system.

**At the tool handler boundary** — the last line of defense before application code sees bytes. A handler may recover a complete object followed by extraneous text, but it must reject ambiguous or unsafe arguments rather than guessing.

**In domain-specific middleware** — generic repair can't fix *meaning*. Sometimes the model puts a user's goal in the wrong field, or nests fields incorrectly for a tool that expects a specific envelope shape. That requires product logic, not a syntax repair library. Framework syntax repair alone cannot replace checks on the meaning and placement of fields.

**In prose output parsers** — a different job entirely. [Aiden](/blog/aiden-platform/) parses free-text model responses — navigation payloads, UI schemas, quality rubrics. That's not tool-call JSON. It's LLM prose that *should* contain JSON somewhere. Different input shape, different call sites, different failure modes. Prose parsers remain a separate concern even if tool-argument repair improves upstream.

---

## The Bug Class: Repair After Validation

The ordering mistake we encountered was **running strict validation before repair** on paths intended to recover malformed syntax.

A middleware stack that validates tool arguments with a plain parse, then a separate middleware that fixes semantic issues for specific tools, means generic malformed JSON hits validation first and dies — technically correct error, operationally useless.

Meanwhile, earlier repair layers in the pipeline may have already fixed most problems. But anything that slips through — or any tool path that bypasses framework repair — still hits validation cold.

For recoverable syntax errors, attempt repair before schema validation: either add a generic step before the validator or let validation retry parsing after repair. Log the original and repaired forms for audit; reject payloads whose meaning cannot be recovered safely.

Don't remove validation. It produces structured errors models can learn from. **Fix the order.**

![Tool argument pipeline showing syntax repair before schema validation, followed by domain-specific checks and rejection of unsafe ambiguity](/assets/images/diagrams/july-workflows/json-repair-order.svg)

*Repairing syntax first preserves validation while keeping domain meaning checks separate.*

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

The repair attempt belongs when the stream finalizes the argument block. An empty-object fallback when repair fails can preserve the run, but only if the tool schema permits empty arguments; otherwise fail explicitly. Repair closes unterminated strings, arrays, and objects so a truncated chunk becomes syntactically valid before parsing runs. Without this, agents using streaming models die mid-incident on long tool arguments — exactly when you need them most.

The empty-object fallback is a last resort. It preserves the run but drops args. Repair-first can recover some truncated payloads, depending on which fields were lost.

---

## Where each check belongs

These checks address different risks at different boundaries:

1. **Repair early** so traces and logs show clean args
2. **Repair at tool boundaries** so handlers stay simple
3. **Repair semantically** where domain shape matters
4. **Parse prose separately** where output isn't a tool call at all
5. **Validate after repair** so models still get useful error feedback

A syntax-valid payload can still have missing or wrong fields, so the final schema and policy checks remain necessary.

---

## What we would check before removing a layer

1. **One repair library is not a strategy.** It fixes syntax. It doesn't fix streaming truncation at the right lifecycle hook, semantic field bleed, or prose-embedded JSON.

2. **Ordering matters as much as repair.** Validation before repair is a bug class. Audit your middleware chain.

3. **Don't consolidate layers you haven't measured.** Overlap between layers is fine during a soak. Removing a layer without failure-rate data risks reintroducing the same parse failures.

4. **Keep framework fixes in the framework.** Upstream generic repair so the community benefits and your fork shrinks. Product-specific semantic repair stays in the product.

5. **Contribute the generic fix, keep the domain fix.** Same pattern as our [open-source contribution model](/blog/open-source-ecosystem/) — isolate what's universal, merge it upstream, build what's specific on top.

---

## Related reading

- [LLM Tokenomics for Production Agents](/blog/maintaining-tokenomics-with-aiden/) — tool response compression at the boundary
- [Go vs Python for AI Agents](/blog/why-go/) — why middleware chains live in Go
- More on [AI agents for SRE](/topics/ai-agents-sre/) · full [series](/series/enterprise-ai-agents-go/)

---


*How many JSON repair layers does your agent stack have? Genuinely curious whether teams hit the validation-before-repair trap too. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*



---

> We build incident-triage agents at StackGen; the SRE offering is at [ai.stackgen.com](https://ai.stackgen.com).

---
layout: post
title: "Five Layers of JSON Repair — Why One Fix Isn't Enough for Production Agent Tool Calls"
date: 2026-07-03 10:00:00 -0700
series: "Building an AI Agent Platform in Go"
series_order: 13
description: "LLMs emit broken tool JSON constantly. Here's why we repair at five different layers — and which ones you can actually remove."
tags: [ai-agents, production, go, reliability, tool-calls]
---

Your agent didn't crash. It just stopped mid-run with `invalid character after top-level value` — after spending $2.40 on tokens and looking completely healthy until the tool handler tried to parse its arguments.

If you build agent platforms in Go — middleware pipelines, tool handlers, streaming model adapters — you've probably seen this. This post is for that crowd: AI backend and platform engineers shipping tool-calling agents to production, not prompt-engineering tutorials.

This is one of the most common production failure modes for tool-calling agents. The LLM *almost* produced valid JSON. Almost isn't good enough when `json.Unmarshal` is your gatekeeper.

We spent months building defense-in-depth for **security** ([five layers of governance](/blog/defense-in-depth/)). It turns out you need the same philosophy for **reliability**: one JSON repair pass is not enough when models stream, truncate, wrap output in markdown fences, and double-encode payloads.

Here's the five-layer repair model we run in production — what each layer fixes, what overlaps, and the ordering bug that made repair and validation fight each other.

---

## The Failure Modes

Before layering fixes, name the ways tool JSON breaks in the wild:

| Symptom | Typical cause |
|---------|---------------|
| `invalid character after top-level value` | Trailing prose after a JSON object, or two objects concatenated |
| `unexpected end of JSON input` | Streaming cut off mid-object; Claude `tool_use` block truncated |
| Fence-wrapped JSON | Model wraps args in ` ```json ` blocks despite the schema |
| Double-encoded strings | Model returns `"{"key":"value"}"` instead of `{"key":"value"}` |
| Semantic garbage that parses | Valid JSON, wrong shape — goal text leaked into a `create_agent` call |

**Key insight:** These are not one bug. A streaming truncation needs different handling than a fence strip. A generic repair library won't fix domain-specific field bleed. That's why we ended up with five layers instead of one heroic `jsonrepair` import.

---

## The Five Layers

```
LLM emits tool call
        │
        ▼
┌───────────────────────────────────────┐
│ L1: Framework graph repair             │  Repair before tool routing
├───────────────────────────────────────┤
│ L2: Opt-in SDK flag (runtime)          │  Repair at agent construction
├───────────────────────────────────────┤
│ L3: Function tool unmarshaler          │  Repair at handler boundary
├───────────────────────────────────────┤
│ L4: Semantic middleware                │  Domain-specific envelope repair
├───────────────────────────────────────┤
│ L5: Prose output parsers (platform)    │  Judges, navigation, UI — not tool args
└───────────────────────────────────────┘
        │
        ▼
   Tool handler runs
```

### Layer 1 — Framework graph repair

Inside [trpc-agent-go](https://github.com/trpc-group/trpc-agent-go), the function-call processor repairs tool arguments in the execution graph **before** routing to handlers. This catches malformed JSON early — including paths that never reach a typed `FunctionTool`.

This layer is framework-owned. Don't duplicate it in your product code. **Do** make sure you're on a pin that includes it — we upstreamed the wiring as part of our [open-source contribution work](/blog/open-source-ecosystem/).

### Layer 2 — Opt-in SDK repair flag

Our agent runtime enables `WithToolCallArgumentsJSONRepairEnabled(true)` on expert runs and sub-agent creation. This turns on repair at the agent boundary so broken args get fixed before they hit logs, traces, or downstream middleware.

**Overlap with Layer 3?** Yes, partially — after a recent pin bump, function tools also repair at `Call()` time. We're keeping Layer 2 during a soak period, then trial-disabling it for sub-agents only (they mostly use function tools). Expert runs stay protected until we're confident the lower layers cover every path.

### Layer 3 — Function tool unmarshaler

The last line of defense before your Go handler sees bytes: `FunctionTool` decodes arguments with a repair-then-unmarshal helper. If the LLM emitted `{"query": "kafka lag"` plus a trailing comma and a half-finished second object, this layer recovers the first object instead of failing the whole run.

This is the fix we care most about upstreaming — it's the difference between "agent retried 3 times and gave up" and "agent ran the tool."

### Layer 4 — Semantic middleware (not generic JSON)

Generic repair can't fix **meaning**. Our note tools expect a specific envelope shape. Sometimes the model puts the user's goal inside `content` when it belongs in `title`, or nests fields incorrectly.

A dedicated middleware runs **before** strict validation and applies semantic repairs — field recovery, envelope normalization — that `jsonrepair` will never know about. Same category: ReAcTree's `create_agent` request repair (goal bleed, missing fields). These are product logic, not plumbing.

**This layer must stay.** Removing it because "the framework has jsonrepair now" would break note tools silently.

### Layer 5 — Prose output parsers (different job)

[Aiden](/blog/aiden-platform/) is StackGen's multi-tenant agent orchestration platform — the layer above our Go agent runtime that runs agents for enterprise teams with governance, budgets, and audit trails. Aiden's platform code parses **free-text LLM responses** — navigation DAGs, A2UI payloads, execution judge rubrics. That's not tool-call JSON. It's LLM prose that *should* contain JSON somewhere.

```go
// Simplified pattern — strip fences, then flexible decode
func DecodeLLMJSON(raw string, dest any) error {
    cleaned := stripMarkdownFences(raw)
    return decodeFlexibleJSON(cleaned, dest)
}
```

We use [kaptinlin/jsonrepair](https://github.com/kaptinlin/jsonrepair) here because the framework's repair package is `internal/` — not importable. **Do not delete this** just because upstream added repair. Different input shape, different call sites, different failure modes.

---

## The Bug Class: Repair After Validation

Here's the mistake that cost us real incidents: **running strict validation before repair.**

Our tool middleware stack looked like this:

```
NoteRepairMiddleware → InputValidationMiddleware → … → tool
```

`InputValidationMiddleware` did a plain `json.Unmarshal`. `NoteRepairMiddleware` fixed semantic issues — but only for note tools. Generic malformed JSON hit validation first and died with an LLM-friendly error that was technically correct and operationally useless.

Meanwhile, Layers 1–3 repaired JSON **earlier** in the pipeline. But anything that slipped through — or any tool path that bypassed the framework repair — still hit validation cold.

**Fix:** Repair-then-validate. Either run a generic JSON repair step before validation in the middleware chain, or change validation to attempt repair on `Unmarshal` failure for recoverable payloads.

Don't remove validation. It produces structured errors models can learn from. **Fix the order.**

---

## What's Redundant vs What's Not

| Layer | Remove? | Verdict |
|-------|---------|---------|
| L1 Framework graph | No | Framework-owned; don't fork duplicate logic |
| L2 SDK opt-in flag | Maybe after soak | Trial disable on sub-agents first |
| L3 Function tool unmarshaler | No | Core fix — keep |
| L4 Semantic middleware | No | Domain logic — not replaceable by jsonrepair |
| L5 Prose parsers | No | Different job than tool args |

**Cosmetic cleanup worth doing:** we had two thin entry points (`llmutils` facade → `jsonutils`) for the same prose-decode helpers. Merging them reduces confusion without changing behavior.

**Not worth doing yet:** ripping out Layer 2 because "we have repair now." Wait 2–4 weeks of production soak. Measure tool-call failure rates before and after.

---

## Streaming Anthropic: A Special Case

Standard repair handles complete-but-messy JSON. **Streaming** is worse: the `tool_use` block's `input` field can arrive truncated — valid prefix, no closing brace.

We added repair on `content_block_stop` before finalizing the tool call: try `jsonrepair` on the partial buffer, fall back to `{}` only when repair fails entirely. The repair step closes any unterminated strings, arrays, or objects — inserting the missing `}`, `]`, and `"` so a truncated chunk becomes syntactically valid JSON before `json.Unmarshal` runs. Without this, SRE agents using Claude would die mid-incident on long tool arguments — exactly when you need them most.

The `{}` fallback is a last resort. It preserves the run but drops args. Repair-first recovers most truncated payloads. Test both paths.

---

## Defense-in-Depth for Probabilistic Output

Security defense-in-depth assumes attackers are creative. JSON repair defense-in-depth assumes **models are sloppy**:

1. **Repair early** (graph) so traces and logs show clean args
2. **Repair at boundaries** (function tools) so handlers stay simple
3. **Repair semantically** (middleware) where domain shape matters
4. **Parse prose separately** (platform) where output isn't a tool call at all
5. **Validate after repair** so models still get useful error feedback

No single layer catches everything. That's the point.

---

## What We Learned

1. **One `jsonrepair` import is not a strategy.** It fixes syntax. It doesn't fix streaming truncation at the right lifecycle hook, semantic field bleed, or prose-embedded JSON.

2. **Ordering matters as much as repair.** Validation before repair is a bug class. Audit your middleware chain.

3. **Don't consolidate layers you haven't measured.** Overlap between L2 and L3 is fine during a soak. Premature deletion brings back 3 AM pages.

4. **Keep framework fixes in the framework.** We upstream repair wiring so the community benefits and our fork shrinks. Product-specific semantic repair stays in the product.

5. **Contribute the generic fix, keep the domain fix.** That's the same pattern as our [open-source contribution model](/blog/open-source-ecosystem/) — isolate what's universal, merge it upstream, build what's specific on top.

---

*How many JSON repair layers does your agent stack have? Genuinely curious whether teams hit the validation-before-repair trap too. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

---
layout: post
title: "Cursor paging for spilled agent tool output"
date: 2026-09-01 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 56
description: "When observability tool results spill to disk, agents should page with opaque cursors, not grep the preview and declare every pod Unavailable."
image: /assets/images/og-default.png
tags: [ai-agents, mcp, observability, grafana, context-engineering, sre, production, aiden]
permalink: /blog/cursor-paging-spilled-agent-tool-output/
faqs:
  - question: "Why do AI agents say no data when Grafana metrics exist?"
    answer: "Large batched PromQL or LogQL results exceed the tool envelope. The runtime returns a truncated preview plus a spill_id. Agents that grep the preview for series names often miss the actual values and falsely report Unavailable."
  - question: "What is cursor paging for spilled tool output?"
    answer: "A contract where the agent calls a spill search tool with only spill_id, receives a small chunk plus next_cursor, and passes that cursor unchanged until it is omitted. Pattern grep and return_full stay secondary escape hatches."
  - question: "Why does regex grep fail on spilled JSON?"
    answer: "A pattern like \"name\": \"cpu_usage\" matches header lines inside large objects (pod labels, metadata) but not the series[] block you need. The grep looks successful while the values never enter context."
  - question: "What should agent builders ship for large MCP tool results?"
    answer: "Write-time spill manifest, completeness truncated on the originating tool, opaque cursor tokens, small pages that fit after JSON escaping, and inventory hints so the agent knows what exists before it finishes paging."
---

An AI SRE agent batched twelve PromQL queries against Grafana. The platform spilled a 345KB JSON blob to disk and handed the model a short preview plus a `spill_id`.

The agent tried to recover with pattern grep: search the spill for `"name": "cpu_usage"`. It got hits on metadata lines inside huge objects. It never saw the `series[]` values. It marked every pod in the acme checkout fleet **Unavailable** and closed the dig.

A human paged through the same spill and found healthy series for most pods. The metrics existed. The recovery strategy was wrong.

This post is the sequel to [when truncated previews look like no data](/blog/no-data-is-often-truncated-data/). Same failure class, sharper fix: **opaque cursor paging** as the primary path, grep as a backup.

*Examples below are composite. Names like acme are placeholders.*

---

## TL;DR

- Oversized observability JSON gets **preview + spill_id**, not the full payload in chat
- **Grep-as-primary** on spilled JSON matches the wrong lines and invents empty planes
- **Cursor paging**: `spill_id` only on page 1, then pass `next_cursor` unchanged until gone
- Originating tools should say `completeness: truncated` and point agents at paging
- Pattern grep and capped `return_full` remain escape hatches, not the default loop
- Builders: write-time manifest, small pages, opaque tokens, budget-aware cursors

### Explain like I'm five

When the answer is too long for one message, do not keyword-search the file and hope. Get page one and a bookmark. Flip pages until the bookmark runs out.

---

## Problem

[Model Context Protocol](https://modelcontextprotocol.io/) tools are honest about completeness until they are not. Integrations return complete JSON because that is what the upstream API gave them. The agent runtime has a hard ceiling on how much of that JSON can ride in one tool result after escaping.

The compromise is spill:

1. Persist the full payload on disk
2. Return a truncated preview in the tool envelope
3. Attach a stable `spill_id` (and often a completeness flag)

That works until the agent treats the preview as the universe, or treats grep on the spill as a cheap substitute for reading it.

In the acme-style incident, a multi-query metrics batch returned dozens of result objects. CPU, memory, and request-rate series for many pods lived in the spill. The preview showed structure and labels. The agent never walked the bytes where the numbers were.

The RCA sounded confident and wrong: every pod unavailable, plane empty. Operators re-ran one query manually and got green series. Trust in the agent dropped faster than error rates.

Related: [claim-aware evidence packing](/blog/claim-aware-evidence-packing/) explains why verifiers must not accuse agents of inventing what you truncated. This post is about **getting the truncated data back** before the verdict.

---

## Why grep fails

Pattern search on a spilled file feels efficient. The model already knows the metric name from the alert. Why not `search_query_spill` with a regex?

Because JSON is not a flat log file.

| What the agent wanted | What grep often matched |
| --- | --- |
| `series[]` values for `cpu_usage` | `"name": "cpu_usage"` inside pod label objects |
| Numeric points for a time range | Header lines at the start of each result block |
| The pod that actually breached | Metadata `"name":` fields on unrelated keys |

A 345KB blob can produce **dozens of false-positive lines** that look like success. The agent stops paging. It never pulls the slab where the arrays live.

Single-shot `return_full` with a byte cap fails the same way in practice: one window, still truncated, still interpreted as complete.

**Adopt:** treat grep and `return_full` as **secondary** tools when cursor paging cannot answer a narrow question.

**Avoid:** making regex the default recovery loop after `completeness: truncated`.

---

## Cursor paging contract

Industry APIs solved this decades ago with opaque cursors. Agent tool spills are the same shape: too much data, fixed page size, deterministic continuation.

```
  ┌─────────────────────┐
  │ Observability tool  │
  │ (batched PromQL)    │
  └──────────┬──────────┘
             │ preview + spill_id + completeness: truncated
             v
  ┌─────────────────────┐     spill_id only
  │ search_query_spill  │◄────────────────────┐
  │  (or search_spill)  │                     │
  └──────────┬──────────┘                     │
             │ chunk + chunk_kind             │
             │ optional inventory             │
             │ next_cursor (if more)          │
             v                                  │
       Agent reads chunk ──────────────────────┘
             │ pass next_cursor unchanged
             v
       Repeat until next_cursor omitted
```

**Page 1**

- Input: `{ "spill_id": "<id>" }` only
- Output: `{ "chunk", "chunk_kind", "inventory?", "next_cursor?" }`

**Page 2+**

- Input: `{ "spill_id": "<id>", "cursor": "<opaque token>" }`
- Pass the cursor **exactly** as returned. Do not parse, split, or invent offsets.

**Done**

- When `next_cursor` is absent, the agent has walked the spill under the platform budget.

Optional `inventory.result_names` (or similar) lets the agent plan: twelve results spilled, I am on chunk four of nine. That reduces premature "no data" closes.

Honesty vocabulary still applies: **COMPLETE / PARTIAL / FAILED**. Paging halfway and declaring an empty plane is still a defect.

---

## What agents should do

For operators and prompt authors, the playbook is short:

1. **Read the originating tool result.** If `completeness` is `truncated`, assume the preview is not the dataset.
2. **Call the spill tool with only `spill_id`.** No regex on the first pass.
3. **Consume each `chunk` before requesting the next page.** Extract labels, series, and timestamps from what arrived, not from what you hope grep will find.
4. **Loop on `next_cursor` until it disappears.** If inventory lists result names, track which ones you have seen.
5. **Use grep or `return_full` only when paging is insufficient** for a targeted follow-up (one metric name, one pod label), and say PARTIAL if you still did not walk the full spill.

Training beats hidden policy: tool descriptions should state that truncated observability results **require cursor paging**, not preview inference.

For SRE review: treat "Unavailable" on every series after a truncated tool return as a **recovery bug**, not a datasource bug.

---

## Optional implementation notes for builders

If you ship MCP observability tools or a shared spill layer, these patterns held up in production without turning the blog into a blueprint.

**Write-time manifest.** When the spill file is created, record byte slabs for byte-perfect paging and a lightweight JSON scan for named result inventory. The read path stays O(page) instead of re-parsing 300KB on every agent turn.

**Small pages.** Target a page size that still fits the agent tool envelope **after** JSON escaping. A few kilobytes per page beats one "full" slice that gets trimmed anyway.

**Opaque cursor tokens.** Encode `{version}.{chunk}:{offset}` (or equivalent) server-side. Agents pass the token back unchanged. They do not need to know the encoding.

**Budget shrink safety.** If the platform trims a page to satisfy a hard cap, advance the cursor so no bytes are skipped or replayed forever.

**Secondary paths.** Keep pattern grep and bounded `return_full` for narrow questions. Document them as escape hatches in the tool schema, not step one.

**Completeness on the origin tool.** The batch query tool should say it truncated, name the spill id, and link to the paging tool in the hint text. Do not make the agent infer spill from a vague "output too large" string.

Public concepts worth stealing: [cursor-based pagination](https://slack.engineering/evolving-api-pagination-at-slack/) (opaque tokens, stable iteration) and MCP's tool-result model (structured payloads, explicit follow-up tools).

---

## Related

- [AI agents call truncated Grafana "no data"](/blog/no-data-is-often-truncated-data/) (the preview failure mode)
- [Claim-aware evidence packing](/blog/claim-aware-evidence-packing/) (do not accuse agents of inventing truncated receipts)
- [LLM tokenomics for production agents](/blog/maintaining-tokenomics-with-aiden/) (why spills exist in the first place)
- [Web metrics to LLM metrics](/blog/web-metrics-to-llm-metrics/) (tool payload size as a first-class metric)

---

**Acknowledgments.** Cursor paging for observability spills came out of shipping batched query tools in Aiden. Patterns are composite; thanks to teammates who debugged false "Unavailable" RCAs in the wild.

*Building AI for incident triage without the demo theater? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports, check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

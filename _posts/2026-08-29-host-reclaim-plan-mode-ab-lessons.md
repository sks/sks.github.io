---
layout: post
title: "Observation Masking Cut Token Cost 43%—Then Lost the RCA"
date: 2026-08-29 12:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 54
description: "Context engineering A/B: observation masking (tool-result clearing) made an AI SRE agent ~43% cheaper—then failed equal-evidence RCA. Scorecard + knobs."
image: /assets/images/og-default.png
tags: [ai-agents, context-engineering, sre, token-cost, evaluation, observability, rca, observation-masking]
permalink: /blog/host-reclaim-plan-mode-ab-lessons/
faqs:
  - question: "What is observation masking (tool-result clearing) for AI agents?"
    answer: "After a successful durable note (offload), the host replaces large prior tool results in the context window with short pointers so later turns stay smaller. It is agent context management’s host-side cousin of Deep Agents’ offload-before-summarize — not the same as LLM summarize or compaction."
  - question: "Does cheaper agent context mean better AI SRE RCA?"
    answer: "Not in this A/B. ON was ~10% faster and ~43% cheaper with real clear events, but failed equal-evidence: fewer Datadog/Grafana digs, no full-series tools, empty caller→origin APM path, undetermined cause. OFF found a probable upstream connectivity failure. Scorecard OFF 6 / ON 5."
  - question: "How should you evaluate tool-result clearing or observation masking?"
    answer: "Pass only if clear events fired, ON tokens/cost ≤ OFF, equal-evidence checklist ON ≥ OFF, and a recoverability probe that forbids new tool digs and requires reading durable notes. Prefer cost and tool-family mix over raw tool-call count."
  - question: "What auto-clear threshold should you try next for context engineering?"
    answer: "Keep summarize and extra context-summarize paths off when measuring clearing alone. Leave loop detection on. Try a higher auto-clear byte threshold (~20KB when enabled in prod-shaped configs) vs 0, and pass only on RCA parity — not on token cost alone."
  - question: "Is a huge unit-fixture compression ratio proof for live investigate?"
    answer: "No. A synthetic note+clear path can show tool chars collapsing after offload and clearing; that is a lab ceiling, not a live investigate multiplier. Do not lead marketing with that ratio."
---

Cheaper agent context is not the win condition for AI SRE investigate agents.

We A/B’d **observation masking** — host-side **tool-result clearing** after offload — on a plan-style gateway-timeout investigate. ON evicted large tool bodies from the context window after a durable note, cut Langfuse spend, finished faster, and still **failed** the bar that matters: RCA quality. OFF named a probable upstream connectivity failure. ON stayed undetermined. That is the context-engineering trap: token cost down, cause lost.

This post is the good / bad / ugly with numbers, the equal-evidence scorecard you can copy, and the knobs for the next fair rematch. Related: [AI SRE agent benchmarks](/blog/ai-sre-agent-benchmarks-wall-time-tools-tokens/), [fair agent evals](/blog/fair-agent-evals-before-performance/), [simple vs plan](/blog/simple-vs-plan-when-to-use-which/).

---

## TL;DR

- **Observation masking saved money, lost the cause.** Clear events fired (**2**). Wall and cost improved. Equal-evidence checklist lost (OFF **6** / ON **5**). Pass rule “ON checklist ≥ OFF” failed.
- **v4 (primary):** OFF **754.0 s** / **75** tools / ~**$1.75** vs ON **677.1 s** (~10% faster) / **73** tools / ~**$1.00** (~43% cheaper). Both passed recoverability via durable notes (`read_notes`).
- **Why ON lost RCA:** OFF ran **8** Datadog + **21** Grafana (including full-result spill and series queries) and named an upstream hop. ON ran **4** Datadog + **14** Grafana, **no** full-series tools → empty caller→origin APM path, no origin cause.
- **Both** burned skill/catalog discovery (`discover_skills`) ×10. Wasteful retries are not unique to the ON arm.
- **Do not lead with unit-fixture compression.** Synthetic note+clear paths can crush visible tool chars. That is a **lab ceiling**, not a live investigate multiplier.
- **Next experiment:** higher auto-clear threshold (~20KB-shaped) vs 0; summarize / extra compaction off; pass only on RCA parity.

### Explain like I'm five

You asked two detectives the same case. One kept the photocopies on the desk and found the broken pipe between the front desk and the warehouse. The other filed the photocopies early to save desk space, knocked on fewer doors, and wrote “unclear.” Saving paper is fine. Closing the case is the job.

---

## Observation masking vs LLM summarize

Industry alignment first. [LangChain’s Deep Agents context management](https://www.langchain.com/blog/context-management-for-deepagents) argues for **offload before summarize**: write durable notes / external memory, then shrink what the model still sees in the active window. Recent agent-context work calls the same pattern **observation masking**: hide stale tool outputs, keep recent turns + reasoning. Quality-matched token evals make the same demand: cut tokens **without** dropping resolution.

Here, **tool-result clearing** is our host-side observation-masking step after a successful note: large prior tool bodies in session context are replaced with short pointers so later turns stay smaller. It is opt-in (default off). A lightweight no-plan path can skip clearing when the run does not need it.

It is **not** the same lever as LLM summarization, chat-window compaction, PII redaction, or a grounding / hallucination guard. We measured clearing **alone**. That matters.

---

## Setup (obfuscated twins)

Matched plan-style twins, incident-triage session:

| Lever | Both | OFF | ON |
|-------|------|-----|----|
| Compaction | ON | | |
| Summarize / extra context-summarize / cache / sanitize / PII / grounding guard | OFF | | |
| Loop detection | ON | | |
| Auto-clear tool-result bytes | | **0** (off) | **8000** (bench forced fire; prod-shaped default when enabled is closer to **~20KB**) |
| Prompt | Same historical gateway timeout on a catalog API path | | |
| Surface | chat UI | | |
| Tools | Grafana + Datadog MCP tool servers | | |

Scenario (horizontal language only): tenant **TENANT-UAT**, request `GET /api/catalog/v2/.../assets`, caller **edge-gateway**, origin **catalog-service**, signals like `error.type=ResourceAccessException`, connection refused / connect timeout, gateway **504**.

Langfuse: we cite **cost / latency / tool counts** only. No customer trace IDs, no secrets.

---

## The good

**Clearing is a real lever.** ON produced host auto-clear events (**2** on v4; clear count progressed **2** then **4**). OFF had **0**. The informative gate passed: clearing actually fired.

**Recoverability worked.** Final turn forbade new evidence collection; both arms had to `read_notes` and restate Symptom/Cause from durable notes. Both **passed**. Notes were not vaporware.

**Cost and wall moved the right way on token cost.** v4 ON was ~**10%** faster wall (incl. recoverability) and ~**43%** cheaper on agent traces (excl. bootstrap). v3 pointed the same direction earlier: OFF **520 s** / ~**$1.18** / **70** tools vs ON **471 s** / ~**$0.84** / **62** tools, with **1** clear event on ON.

**Design meritorious on paper:** clearing after a successful note matches Deep Agents’ offload-before-summarize order; loop detection curbs wasteful retries; opt-in default off; lightweight no-plan path can skip clearing.

That is the good. It is not enough.

---

## The bad

**ON lost the RCA.**

| Metric (v4) | OFF | ON |
|-------------|----:|---:|
| Wall (incl. recoverability) | **754.0 s** | **677.1 s** (~10% faster) |
| Tool calls | **75** | **73** |
| Langfuse $ (agent traces, excl. bootstrap) | ~**$1.75** | ~**$1.00** (~43% cheaper) |
| Host auto-clear events | **0** | **2** |
| Recoverability `read_notes` | pass | pass |
| Equal-evidence checklist | **6** | **5** |
| Verdict quality | Probable upstream connectivity (edge-gateway → catalog-service; 504 + ResourceAccessException) | Undetermined |

**Tool mix explains the miss better than tool count.**

| Family | OFF | ON |
|--------|----:|---:|
| Datadog | **8** | **4** |
| Grafana | **21** (incl. full-result spill / series / parallel) | **14**, **no** full-series tools |
| Skill/catalog discovery | **10** | **10** |

OFF kept enough APM/log digs to close the caller→origin APM path and name an origin cause. ON starved that family mix, left the caller→origin APM path empty, and never pinned origin. Raw tool totals (**75** vs **73**) look like a tie. Family mix says otherwise.

**Demerits we own:**

- Path-unmatched arms still “complete” with a confident shrug.
- Aggressive **8KB** threshold forces fire in bench; it is harsher than the ~20KB prod-shaped default when enabled.
- Wasteful retries can burn Datadog turns before the useful query lands.
- Cost and wall can improve while RCA worsens. Token savings without equal evidence is a false win.

---

## The ugly

**Marketing token savings without equal evidence.** “43% cheaper + clear events fired” is a LinkedIn sentence. It is also how you ship a quieter, wrong investigate agent.

**Layering two shrink paths.** Summarize or an extra context-summarize path on top of clearing can double-crush evidence. We kept those **off** on purpose. If your next A/B turns them on together, you are not measuring clearing.

**Summarizing durable notes.** Letting an LLM rewrite the source-of-truth note store is a footgun. Our runtime refuses to summarize that store for that reason. If your stack summarizes notes, recoverability probes will pass theater and fail honesty.

**Fixture ceiling theater.** A synthetic note+clear unit path can show visible tool chars collapsing hard after offload and clearing (order-of-magnitude compression). That measures the fixture, not live investigate. Do not lead with a “512×” story. Lead with equal-evidence on a real prompt.

---

## How we measured (copy this)

Pass only if **all** of the following hold:

1. **Informative gate.** ON host auto-clear count **> 0**, or mark the run non-informative (you did not exercise clearing).
2. **Equal-evidence checklist (7 rows).** Score each arm pass/fail; require **ON ≥ OFF**:
   - Window anchored (time range honest to the incident)
   - Caller→origin APM path closed (path measured)
   - Origin logs / `error.type` named when present
   - Infra / readiness checked when relevant
   - Honest gaps: systems we could not query
   - Gateway-as-symptom (do not stop at the 504)
   - Recoverability (durable notes can restate Symptom/Cause)
3. **Recoverability probe.** Final turn forbids new evidence collection. Must `read_notes` and restate Symptom/Cause from notes only.
4. **Cost gate (secondary).** ON tokens / cost ≤ OFF **after** quality gates. Prefer later-gen tokens, Langfuse agent cost, and clear-event count over raw tool-call count.
5. **Tool-family mix.** When RCA gaps appear, compare Datadog full-result spill / series queries vs skill/catalog discovery waste. Totals lie; families tell.

On v4: clear events > 0 ✓, cost/wall ON better ✓, recoverability both pass ✓, checklist ON ≥ OFF ✗ (**5 < 6**). **Overall: FAIL.**

v3 was directional only (same twins, earlier): cheaper/faster with one clear event. We did not treat it as the quality verdict. v4 is the one that closed the scorecard.

---

## Knobs for the next rematch

Domain-agnostic, runtime-shaped:

| Knob | Guidance |
|------|----------|
| Auto-clear tool-result bytes | **0** = off. This bench forced **8000**. Next A/B: try **~20000** (prod-shaped when enabled) vs **0**. |
| Summarize / extra context-summarize | Keep **off** when measuring clearing alone. |
| Loop detection | Keep **on**. |
| Compaction | Independent lever; do not silently change it mid-A/B. |
| Pass rule | Clear events fired **and** RCA parity (checklist ON ≥ OFF) **and** recoverability. Cost is a bonus, not the headline. |

Opinion, stated plainly: **result quality beats token savings for investigate agents.** Save tokens after you can still name the broken hop.

---

## Lessons learned

1. **Tool-result clearing can fire and still lose.** Informative ≠ sufficient.
2. **Equal-evidence is the product bar.** Cost charts without checklist rows are theater.
3. **Tool-family mix diagnoses RCA gaps.** Full-series tools missing beats “we called 73 tools.”
4. **Isolate the lever.** Clearing alone; summarize off; loop on; compaction pinned.
5. **Fixture compression is not live proof.** Keep unit ceilings in the lab notes, not the launch tweet.
6. **Align with offload-before-summarize.** Notes first, shrink second, never LLM-summarize the source-of-truth note store.

Steal the scorecard. Rematch at ~20KB. Pass only when ON keeps the cause.

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

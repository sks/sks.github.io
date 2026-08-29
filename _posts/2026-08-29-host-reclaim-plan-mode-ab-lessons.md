---
layout: post
title: "Host Reclaim A/B: Cheaper Masks Failed the Investigate Bar"
date: 2026-08-29 12:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 54
description: "Plan-mode host reclaim cut cost and wall time, then lost RCA quality. Equal-evidence scorecards, tool-mix diagnosis, and knobs you can reuse."
image: /assets/images/og-default.png
tags: [ai-agents, sre, benchmarking, tokenomics, context-management, evaluation, incident-response, observability, aiden, production]
permalink: /blog/host-reclaim-plan-mode-ab-lessons/
faqs:
  - question: "What is host reclaim for AI agent tool results?"
    answer: "After a successful note (offload), the runtime may replace large prior tool bodies in session context with short pointers so later turns stay smaller. It is the host-side cousin of Deep Agents’ offload-before-summarize pattern — not the same as LLM summarize or compaction."
  - question: "Did host reclaim win the Plan-mode investigate A/B?"
    answer: "No. ON was ~10% faster and ~43% cheaper with real mask events, but it failed equal-evidence: fewer Datadog/Grafana digs, no spill/series tools, empty path APM, undetermined cause. OFF found a probable upstream connectivity failure. Scorecard OFF 6 / ON 5."
  - question: "How should you score reclaim A/Bs?"
    answer: "Pass only if masks fired, ON tokens/cost ≤ OFF, equal-evidence checklist ON ≥ OFF, and a recoverability probe that forbids new Collect and requires read_notes. Prefer cost and tool-family mix over raw tool-call count."
  - question: "What threshold should you try next?"
    answer: "Keep summarize and context_mode off when measuring reclaim alone. Leave loop detection on. Try a higher auto-mask byte threshold (~20KB when enabled in prod-shaped configs) vs 0, and pass only on RCA parity — not on thrift alone."
  - question: "Is a huge unit-fixture compression ratio proof for live investigate?"
    answer: "No. A synthetic skills+spill path can show tool chars collapsing after note+reclaim; that is a fixture ceiling, not a live investigate multiplier. Do not lead marketing with that ratio."
---

Cheaper is not the win condition for investigate agents.

We ran a Plan-mode **host reclaim** A/B on a historical gateway timeout into a catalog API. ON masked tool bodies after a successful note, cut Langfuse spend, finished faster, and still **failed** the bar that matters: result quality. OFF named a probable upstream connectivity failure. ON stayed undetermined.

This post is the good / bad / ugly with numbers, the scorecard we used so you can copy it, and the knobs for the next fair rematch. Related: [AI SRE agent benchmarks](/blog/ai-sre-agent-benchmarks-wall-time-tools-tokens/), [fair agent evals](/blog/fair-agent-evals-before-performance/), [simple vs plan](/blog/simple-vs-plan-when-to-use-which/).

---

## TL;DR

- **ON failed quality.** Masks fired (2 events). Wall and cost improved. Equal-evidence checklist lost (OFF **6** / ON **5**). Pass rule “ON checklist ≥ OFF” failed.
- **v4 (primary):** OFF **754.0 s** / **75** tools / ~**$1.75** vs ON **677.1 s** (~10% faster) / **73** tools / ~**$1.00** (~43% cheaper). Recoverability `read_notes`: **pass** both.
- **Why ON lost RCA:** OFF ran **8** Datadog + **21** Grafana (including spill/series/parallel) and kept a usable lead. ON ran **4** Datadog + **14** Grafana, **no** spill/series tools → empty path APM, no origin cause.
- **Both** burned `discover_skills` ×10. Thrash is not unique to reclaim ON.
- **Do not lead with unit-fixture compression.** Synthetic skills+spill can show huge visible-char collapse after note+reclaim. That is a **fixture ceiling**, not a live investigate multiplier.
- **Next experiment:** higher auto-mask threshold (~20KB-shaped) vs 0; summarize/context_mode off; pass only on RCA parity.

### Explain like I'm five

You asked two detectives the same case. One kept the photocopies on the desk and found the broken pipe between the front desk and the warehouse. The other filed the photocopies early to save desk space, knocked on fewer doors, and wrote “unclear.” Saving paper is fine. Closing the case is the job.

---

## What we mean by host reclaim

Industry alignment first. [LangChain’s Deep Agents context management](https://www.langchain.com/blog/context-management-for-deepagents) argues for **offload before summarize**: put durable notes aside, then shrink what the model keeps in the active window. Quality-matched token evals (ContextSniper-style thinking) make the same demand: cut tokens **without** dropping resolution.

In our agent runtime, **host reclaim** is the host-side move after a successful note: large prior tool results in session context can be replaced with short pointers so later turns stay smaller. It is opt-in (default off). Simple mode can no-op reclaim when the path does not need it. It is **not** the same lever as LLM summarize, context_mode, compaction, PII, or halguard.

We measured reclaim **alone**. That matters.

---

## Setup (obfuscated twins)

Matched Plan-mode twins, Aiden-shaped investigate session:

| Lever | Both | OFF | ON |
|-------|------|-----|----|
| Compaction | ON | | |
| Summarize / context_mode / cache / sanitize / PII / halguard | OFF | | |
| Loop detection | ON | | |
| Auto-mask tool-result bytes | | **0** (off) | **8000** (bench forced fire; prod-shaped default when enabled is closer to **~20KB**) |
| Prompt | Same historical gateway timeout on a catalog API path | | |
| Surface | AG-UI | | |
| Tools | Grafana + Datadog MCP sidecars | | |

Scenario (horizontal language only): tenant **TENANT-UAT**, request `GET /api/catalog/v2/.../assets`, caller **edge-gateway**, origin **catalog-service**, signals like `error.type=ResourceAccessException`, connection refused / connect timeout, gateway **504**.

Langfuse: we cite **cost / latency / tool counts** only. No customer trace IDs, no secrets.

---

## The good

**Reclaim is a real lever.** ON produced host auto-masked events (**2** on v4; masked_count progressed **2** then **4**). OFF had **0**. The informative gate passed: masks actually fired.

**Recoverability worked.** Final turn forbade new Collect; both arms had to `read_notes` and restate Symptom/Cause from notes. Both **passed**. Notes were not vaporware.

**Cost and wall moved the right way on thrift.** v4 ON was ~**10%** faster wall (incl. recoverability) and ~**43%** cheaper on agent traces (excl. bootstrap). v3 pointed the same direction earlier: OFF **520 s** / ~**$1.18** / **70** tools vs ON **471 s** / ~**$0.84** / **62** tools, with **1** mask event on ON.

**Design meritorious on paper:** reclaim after successful note matches Deep Agents’ offload-before-summarize order; loop traps curb thrash; opt-in default off; Simple can no-op.

That is the good. It is not enough.

---

## The bad

**ON lost the RCA.**

| Metric (v4) | OFF | ON |
|-------------|----:|---:|
| Wall (incl. recoverability) | **754.0 s** | **677.1 s** (~10% faster) |
| Tool calls | **75** | **73** |
| Langfuse $ (agent traces, excl. bootstrap) | ~**$1.75** | ~**$1.00** (~43% cheaper) |
| Host auto-masked events | **0** | **2** |
| Recoverability `read_notes` | pass | pass |
| Equal-evidence checklist | **6** | **5** |
| Verdict quality | Probable upstream connectivity (edge-gateway → catalog-service; 504 + ResourceAccessException) | Undetermined |

**Tool mix explains the miss better than tool count.**

| Family | OFF | ON |
|--------|----:|---:|
| Datadog | **8** | **4** |
| Grafana | **21** (incl. spill / series / parallel) | **14**, **no** spill/series |
| `discover_skills` | **10** | **10** |

OFF kept enough APM/log digs to close path APM and name an origin cause. ON starved that family mix, left path APM empty, and never pinned origin. Raw tool totals (**75** vs **73**) look like a tie. Family mix says otherwise.

**Demerits we own:**

- Path-unmatched arms still “complete” with a confident shrug.
- Aggressive **8KB** threshold forces fire in bench; it is harsher than the ~20KB prod-shaped default when enabled.
- Thrash can burn Datadog turns before the useful query lands.
- Cost and wall can improve while RCA worsens. Thrift without equal evidence is a false win.

---

## The ugly

**Marketing thrift without equal evidence.** “43% cheaper + masks fired” is a LinkedIn sentence. It is also how you ship a quieter, wrong investigate agent.

**Stacking crushers.** Summarize or context_mode on top of reclaim can double-crush evidence. We kept those **off** on purpose. If your next A/B turns them on together, you are not measuring reclaim.

**Summarizing `read_notes`.** Letting an LLM rewrite the source-of-truth note plane is a footgun. Our runtime skips SoT summarize for that reason. If your stack summarizes notes, recoverability probes will pass theater and fail honesty.

**Fixture ceiling theater.** A synthetic skills+spill unit path can show visible tool chars collapsing hard after note+reclaim (order-of-magnitude compression). That measures the fixture, not live investigate. Do not lead with a “512×” story. Lead with equal-evidence on a real prompt.

---

## How we measured (copy this)

Pass only if **all** of the following hold:

1. **Informative gate.** ON `host auto-masked` count **> 0**, or mark the run non-informative (you did not exercise reclaim).
2. **Equal-evidence checklist (7 rows).** Score each arm pass/fail; require **ON ≥ OFF**:
   - Window anchored (time range honest to the incident)
   - Path APM closed (caller → origin path measured)
   - Origin logs / `error.type` named when present
   - Infra / readiness checked when relevant
   - `blocked_planes` honesty (say what you could not see)
   - Gateway-as-symptom (do not stop at the 504)
   - Recoverability (notes can restate Symptom/Cause)
3. **Recoverability probe.** Final turn forbids new Collect. Must `read_notes` and restate Symptom/Cause from notes only.
4. **Thrift gate (secondary).** ON tokens / cost ≤ OFF **after** quality gates. Prefer later-gen tokens, Langfuse agent cost, and masked count over raw tool-call count.
5. **Tool-family mix.** When RCA gaps appear, compare Datadog spill/series vs `discover_skills` thrash. Totals lie; families tell.

On v4: masks > 0 ✓, cost/wall ON better ✓, recoverability both pass ✓, checklist ON ≥ OFF ✗ (**5 < 6**). **Overall: FAIL.**

v3 was directional only (same twins, earlier): cheaper/faster with one mask event. We did not treat it as the quality verdict. v4 is the one that closed the scorecard.

---

## Knobs for the next rematch

Domain-agnostic, runtime-shaped:

| Knob | Guidance |
|------|----------|
| Auto-mask tool-result bytes | **0** = off. This bench forced **8000**. Next A/B: try **~20000** (prod-shaped when enabled) vs **0**. |
| Summarize / context_mode | Keep **off** when measuring reclaim alone. |
| Loop detection | Keep **on**. |
| Compaction | Independent lever; do not silently change it mid-A/B. |
| Pass rule | Masks fired **and** RCA parity (checklist ON ≥ OFF) **and** recoverability. Cost is a bonus, not the headline. |

Opinion, stated plainly: **result quality beats thrift for investigate agents.** Save tokens after you can still name the broken hop.

---

## Lessons learned

1. **Host reclaim can fire and still lose.** Informative ≠ sufficient.
2. **Equal-evidence is the product bar.** Cost charts without checklist rows are theater.
3. **Tool-family mix diagnoses RCA gaps.** Spill/series missing beats “we called 73 tools.”
4. **Isolate the lever.** Reclaim alone; summarize off; loop on; compaction pinned.
5. **Fixture compression is not live proof.** Keep unit ceilings in the lab notes, not the launch tweet.
6. **Align with offload-before-summarize.** Notes first, shrink second, never summarize the SoT note plane.

Steal the scorecard. Rematch at ~20KB. Pass only when ON keeps the cause.

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

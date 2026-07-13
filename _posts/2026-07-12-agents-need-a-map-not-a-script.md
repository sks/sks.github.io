---
layout: post
title: "Your RCA Agent Doesn't Need Another Runbook — It Needs a Map"
date: 2026-07-12 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 19
description: "Customer runbooks are a crutch. After months of multi-plane RCA regressions: topology, golden gates, and verify-first beat another notebook."
image: /assets/images/og-agents-need-a-map.jpg
tags: [ai-agents, sre, evaluation, compound-ai, workflows, golang]
permalink: /blog/agents-need-a-map-not-a-script/
---

There's a moment in a great Rahman live set where the band stops replaying the film track and starts reading the room. Same score on paper. Completely different concert.

I've spent the last few months in the gap between demo and production — teaching an AI SRE copilot to investigate real incidents. The work spanned **multiple observability planes** (metrics, logs, traces, and an analytics warehouse), **fixed-stage pipelines** (a directed graph of plan → gather → present — not a free-form chat loop), and two intake shapes: firing alerts and human symptom tickets.

Each path taught the same product lesson, louder every week:

> If your agent only works when you ship it a forty-page customer runbook, **the agent is not good yet.** The runbook is a crutch, not a feature.

The runbook is a programmed track: linear, brittle, written for one scene. **The map** is what a good investigator carries instead. This post names what that map is — then shows why scripts fail without it.

---

## What the map is

A map is not another markdown SOP. It is four things the platform injects **before** the model improvises:

### 1. Topology at launch

Discovery already knows which integrations exist (metrics, logs, warehouse, Git), which services and env tags appear in your estate, and which repos deploy to which workloads. **Inject that graph at investigate launch** so the agent navigates a pruned subgraph instead of inventing dependencies mid-run.

Without it, every incident is a blind crawl. With it, "check deploy correlation" is a first-class probe, not folklore buried in a customer PDF.

### 2. Verify-first probes

Each investigation branch must write **structured evidence** — machine-checkable keys like `orphaned_partition=true`, `readiness_pct=96.6`, or `datadog_ch_crosscheck=mismatch`. Fluent RCA prose comes *after* those fields exist.

A **hypothesis verifier** (deterministic code, not a second LLM) maps evidence keys to a root-cause class. The model drafts; code locks the taxonomy. That is how you avoid "vibe check from a judge wearing a hat."

### 3. Cross-plane reconciliation

Real incidents rarely live in one datastore. The map requires each plane to get a turn, then a mandatory **crosscheck** field that resolves to `match`, `mismatch`, or `single_plane` — not `pending` when gather declares complete.

When metrics say "0.007% errors, issue inactive" but pods restarted once, the headline is **no active incident on scoped path**, not pod theater. Reconciliation is a presentation contract, not prompt flair.

### 4. Verify-learn memory

When an operator confirms or corrects a verdict, store the class, service fingerprint, and what was ruled out. On the next similar alert, surface that memory so the agent does not reopen solved dead ends.

The map grows from production — not from shipping another notebook when Kafka breaks.

```
RUNBOOK (script)                 MAP (environment)
─────────────────                ───────────────────
Step 1: query metric A           Alert + topology (injected)
        │                                │
        ▼                                ▼
Step 2: check logs               Verify probe ──(dead end?)──► widen / retry ──┐
        │                                │ (confirmed)                        │
        ▼                                ▼                                    │
Step 3: write RCA                Rank hypothesis ◄────────────────────────────┘
        │                                │
        ▼                                ▼
(linear — fixed steps)           Verdict + memory (stored for recall)
                                 (branching — retries on failure)
```

| Script model | Map model |
|--------------|-----------|
| Ship another notebook per failure mode | Agent knows probe → discover → requery |
| New gate regex per customer phrasing | Verifier reads structured evidence keys |
| Dependency map checkbox in gather | Topology injected at launch |
| Operator corrects RCA in Slack | Verdict → memory → next run recalls prior |
| Score workflow note tokens | Score **expected vs detected** root-cause class |

**Customer-authored investigation stacks** — per-tenant notebooks, stage-gate regex, spawn allowlists — are **symptoms** of a copilot that did not yet have the four layers above. If the product agent were good, those stacks shrink to optional demos.

---

## When the map is missing: production failure modes

In the happy path, metrics confirm the window, logs corroborate, and the final paragraph names a mechanism an on-call engineer would act on. Without the map, the same model ships gorgeous closing prose on top of a hollow middle stage.

Common patterns:

- **Wrong time window** — stop at 30 minutes when the signal only appears at 7-day cadence; declare victory in the wrong clock.
- **Loudest spike wins** — rank correlation over causation.
- **Hollow gather** — fluent narrative while a middle stage never committed tool receipts.
- **Premature "observability gap"** — give up before widening the window, fixing env tags, or running tag discovery.
- **Sub-agent loops** — spawn helpers until a **spawn budget** (max LLM turns per worker) exhausts, leaving `pending_from_*` stubs the gate accepts anyway.

Operators need **receipts**: concrete IDs, numeric KPIs, ruled-out branches, and next probes that survive a deterministic check.

Prior posts in this series drill into specific antidotes: [evidence-gated RCA](/blog/evidence-gated-multiplane-rca/), [bring-up like hardware](/blog/bring-up-agent-workflows-like-hardware/), [evidence-based verification](/blog/evidence-based-verification/). This one is the product frame they fit inside.

---

## Two venues where scripts broke

I'll describe incidents in parallel universes — no customer names.

### Metric-backed alerts (event-bus lag and API 5xx)

**Shape A:** consumer lag on one partition of a high-volume topic — sparse per-tenant metrics, drama in one GUID's slice of the bus.

**Shape B:** HTTP error-rate SLO on `checkout-api` in `prod-eu`, scoped to `/api/v2/widgets` — while the warehouse whispers a different path is actually on fire.

Different alerts. Same script failures:

| What a good run proves | What the script did instead |
|------------------------|-----------------------------|
| Lag or error rate with **numbers**, not "elevated" | Stopped at a window too narrow for sparse metrics |
| Primary tenant or path identified with evidence | Pasted **redacted placeholder tokens** into SQL → syntax errors → retry loop |
| Cross-plane **crosscheck** resolved | Left `pending` forever while gather declared complete |
| Partition owner or pod health with concrete fields | Wrote `blocked: no data` or `pending_from_*` while gate cheered on non-empty text |
| Presentation uses gather transcript | Read only navigation JSON ("FINISH, iter=1") and ignored evidence |

Fixes were never "more poetry in the runbook." They were **topology + verifier + gates**: UUID-aware regex, forbidden hollow stubs (`branch dispatched…` is not evidence), spawn contracts that allow tag-discovery tools, and headlines that say **no active incident on scoped path** when rates are inactive.

### Symptom tickets (human words, messy scope)

**Intake:** "Billing module stuck after publish in prod-eu since Tuesday."

No metric attached — so structure first: parse Environment / Module / Symptom / Time, ladder env tags (`staging` → `staging-prod`), check the obvious deployment **and** adjacent services (API backend, worker, admin — not only the name in the ticket), query log monitors with **log search** rather than metric APIs on log-based alerts.

**What went wrong:** keyword routing (*Billing* matched an unrelated event-bus workflow), clarifying-question loops while the user said "just investigate," and monitors attached because a title contained a keyword. Wrong genre, wrong hall.

**Trap:** treat human intake like a firing metric alert. The map starts with scope parsing, not tool roulette.

---

## Golden gates (and a testing failure we owned)

Even with a map, you need to **prove each pipeline stage** before you trust the whole run.

**Bring-up** works like hardware bring-up: imagine a fixed pipeline — plan scope → gather evidence → present RCA. Deploy only stages **1 through N**, run one canary investigation, and pass an automated **gate** (a function over **tool outputs**, not LLM adjectives) before you wire up stage N+1. Green one stage until it is boring; then add the next. When stage 2 fails, stage 2 did it — not "the model felt creative today." ([Full hardware analogy here](/blog/bring-up-agent-workflows-like-hardware/).)

Gates are only as honest as their tests. We learned that the hard way:

- **The expectation:** Gate regex demanded the literal English phrase **`tenant GUID`**.
- **The reality:** The agent correctly emitted a raw **`UUID`**.
- **The result:** False failure — and shape-only gates that accepted **empty shells** while rejecting valid data.

Worse: we once shipped a gate regex with **negative lookahead**. Go's RE2 engine does not support that syntax — the gate **crashed mid-run** after gather had already produced good evidence. That is not a plot twist. That is a **missing unit test**. We had golden pass fixtures; we did not have a golden **fail** fixture that would have caught unsupported regex in CI. Gates are code. Code ships with tests, or it ships lies.

**Lesson:** treat gates like unit tests — pass *and* fail fixtures, run in CI, score tool effects not mood words.

---

## Shipping the map in slices

The map only ships if the **platform codebase** practices what the agent preaches: modular stages, verifiable contracts, strictly typed evidence — not one monolithic branch nobody can review.

We split the work:

1. **Manifest DNA** — skills, agents, workflows (what the investigator is allowed to believe).
2. **Hedge gate** — reject soft "likely broader instability" RCA unless dig-ladder exhaustion is documented.
3. **Change plane** — discovery-derived deploy candidates at launch when Git is connected.
4. **Eval harness** — shipped separately from the production investigator.

Incremental rehearsal, not a double soundtrack.

---

## What still goes wrong

No hero narrative. Current board:

- **Inactive incidents** scored as `undetermined` — presentation lacks an "issue not active" mode.
- **Path anchoring** — alert path vs warehouse-dominant path confuses headlines.
- **Spawn budgets** — workers hit max LLM calls; gates still accept `pending_from_*`.
- **Chat path** loads orchestration skills but never runs tools — routing is not investigating.
- **Mitigation homework** — "confirm latency in dashboard" instead of running the verification query.

Each is a **gate or contract** bug, not an intelligence shortage. Fixable without waiting for the next foundation model.

---

## What to steal

If you are building agentic RCA (or any multi-stage compound system):

1. **Inject topology at launch** — do not make the model draw the map mid-run.
2. **Structured evidence → verifier → class** — LLM drafts; code locks.
3. **Cross-plane crosscheck** — mandatory resolution before present-RCA.
4. **Verify-learn memory** — store verdicts; recall on similar fingerprints.
5. **Bring-up rails** — green one stage at a time; gates on tool effects.
6. **Golden pass and fail fixtures** — including regex and gate-engine compatibility.

The goal is not an agent that recites your runbook. It is an agent that walks in with a **map** — and enough humility to run the boring ladders before calling the incident closed.

Research directions worth betting on: hypothesize-then-verify, offline causal graphs pruned per alert, and process-centric evals that grade what happened — not how pretty the closing paragraph was.

---

**Further reading (same series):**

- [Evidence-Gated RCA — Prove, Then Narrate](/blog/evidence-gated-multiplane-rca/)
- [Bring Up Agent Workflows Like Hardware](/blog/bring-up-agent-workflows-like-hardware/)
- [Evidence-Based Verification](/blog/evidence-based-verification/)
- [AI-Augmented Incident Triage](/blog/ai-incident-triage-sre/)

---
layout: post
title: "Your RCA Agent Doesn't Need Another Runbook — It Needs a Map"
date: 2026-07-12 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 19
description: "Runbooks are fine for humans and stable ladders — bad as the agent's only navigation. After months of multi-plane RCA: topology, gates, and verify-first beat another forty-page notebook."
image: /assets/images/og-agents-need-a-map.jpg
tags: [ai-agents, sre, evaluation, compound-ai, workflows, golang]
permalink: /blog/agents-need-a-map-not-a-script/
---

There's a moment in a great Rahman live set where the band stops replaying the film track and starts reading the room. Same score on paper. Completely different concert.

I've spent the last few months in the gap between demo and production — teaching an AI SRE copilot to investigate real incidents. The work spanned **multiple observability planes** (metrics, logs, traces, and an analytics warehouse), **fixed-stage pipelines** (a directed graph of plan → gather → present — not a free-form chat loop), and two intake shapes: firing alerts and human symptom tickets.

Each path taught the same product lesson, louder every week:

> If your agent only works when you ship it a forty-page bespoke runbook, **the agent is not good yet.** The runbook became a crutch — not because runbooks are useless, but because the product had no map underneath.

The runbook is a programmed track: linear, brittle, written for one scene. **The map** is what a good investigator carries when the room changes. This post names what that map is, when a runbook still earns its keep, and why scripts fail when they are the *only* layer.

---

## What the map is

A map is not another markdown SOP. It is four things the platform injects **before** the model improvises:

### 1. Topology at launch

Discovery already knows which integrations exist (metrics, logs, warehouse, Git), which services and env tags appear in your estate, and which repos deploy to which workloads. **Inject that graph at investigate launch** so the agent navigates a pruned subgraph instead of inventing dependencies mid-run.

Without it, every incident is a blind crawl. With it, "check deploy correlation" is a first-class probe, not folklore buried in a static PDF.

### 2. Verify-first probes

Each investigation branch must write **structured evidence** — machine-checkable keys like `queue_depth_spike=true`, `readiness_pct=96.6`, or `warehouse_crosscheck=mismatch`. Fluent RCA prose comes *after* those fields exist.

A **hypothesis verifier** (deterministic code, not a second LLM) maps evidence keys to a root-cause class. The model drafts; code locks the taxonomy. That is how you avoid "vibe check from a judge wearing a hat."

### 3. Cross-plane reconciliation

Real incidents rarely live in one datastore. The map requires each plane to get a turn, then a mandatory **crosscheck** field that resolves to `match`, `mismatch`, or `single_plane` — not `pending` when gather declares complete.

When metrics say "0.007% errors, issue inactive" but pods restarted once, the headline is **no active incident on scoped path**, not pod theater. Reconciliation is a presentation contract, not prompt flair.

### 4. Verify-learn memory

When an operator confirms or corrects a verdict, store the class, service fingerprint, and what was ruled out. On the next similar alert, surface that memory so the agent does not reopen solved dead ends.

The map grows from production — not from shipping another notebook every time RabbitMQ redelivery spikes.

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
| New gate regex per tenant phrasing | Verifier reads structured evidence keys |
| Dependency map checkbox in gather | Topology injected at launch |
| Operator corrects RCA in Slack | Verdict → memory → next run recalls prior |
| Score workflow note tokens | Score **expected vs detected** root-cause class |

**Bespoke investigation stacks** — per-tenant notebooks, stage-gate regex, spawn allowlists — are **symptoms** of a copilot that did not yet have the four layers above. When the map exists, those stacks should **shrink** — not disappear.

---

## When runbooks still earn their keep

The Rahman analogy cuts both ways. A live set still **starts from the score**. You are not throwing out sheet music — you are refusing to let the score be the *only* way the band reads the room.

Runbooks stay valid when:

| Role | Why it works |
|------|----------------|
| **Human SOP** | On-call engineers, auditors, and new hires need a readable ladder for rare events. The PDF is for *people*, not a substitute for injected topology. |
| **Stable, bounded archetypes** | You've closed the same alert class fifty times; the probe sequence is known (queue depth → consumer tag → rebalance). Encode that as **recipes on the map**, not rediscovery every run. |
| **Reference demo** | Greenfield estates need a worked example before discovery is rich. A reference notebook as an **optional demo** while the platform map matures is fine. |
| **HITL remediation** | The map ends at evidence and class. The runbook documents who approves scale-down, which job to run, what lands in the ticket. Investigation vs blast-radius governance are different artifacts. |
| **Local overlay** | Env-specific dashboard IDs, tag quirks, "always widen to 7d on this monitor." **Templates on top of** topology + verifier — not the entire navigation layer. |

The failure mode we kept hitting was not "someone wrote a runbook." It was **runbook as sole dependency** — forty pages shipped per estate because the agent could not navigate without them. Once topology, gates, and memory ship, healthy estates keep runbooks where they belong: human procedures, compliance trails, and overlays — while the agent walks the map.

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

I'll describe incidents in parallel universes — no real org or env names.

### Metric-backed alerts (two archetypes)

**Shape A:** depth on **one queue** in a message broker — cluster-wide totals look fine; the spike hides behind a single routing key you still have to find.

**Shape B:** saturation on **one link** in a dependency chain — the alert names this hop; a second observability plane says the bottleneck slid downstream.

Different alerts, same script failures — two parallel use cases, one failure table:

| What a good run proves | What the script did instead |
|------------------------|-----------------------------|
| Primary signal with **numbers**, not "elevated" | Stopped at a window too narrow for sparse metrics |
| Primary scope key identified with evidence | Pasted **redacted placeholder tokens** into SQL → syntax errors → retry loop |
| Cross-plane **crosscheck** resolved | Left `pending` forever while gather declared complete |
| Queue consumer or pod health with concrete fields | Wrote `blocked: no data` or `pending_from_*` while gate cheered on non-empty text |
| Presentation uses gather transcript | Read only navigation JSON ("FINISH, iter=1") and ignored evidence |

Fixes were rarely "more poetry in the runbook." They were **topology + verifier + gates**: UUID-aware regex, forbidden hollow stubs (`branch dispatched…` is not evidence), spawn contracts that allow tag-discovery tools, and headlines that say **no active incident on scoped path** when the signal is inactive. The runbook's *probe ideas* were often right; the platform had not encoded them as structured evidence and gates.

### Symptom tickets (human words, messy scope)

**Intake:** "Payments module stuck after deploy in production since Tuesday."

No metric attached — so structure first: parse Environment / Module / Symptom / Time, ladder env tags (non-prod before prod), check the obvious deployment **and** adjacent services (edge tier, worker, admin — not only the name in the ticket), query log monitors with **log search** rather than metric queries on log-based alerts.

**What went wrong:** keyword routing (the module name in the ticket matched an unrelated queue-depth workflow), clarifying-question loops while the user said "just investigate," and monitors attached because a title contained a keyword. Wrong genre, wrong hall.

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
7. **Runbooks as overlay, not foundation** — keep human SOPs and stable probe recipes; do not make the agent depend on a fresh notebook per estate.

The goal is not an agent that recites your runbook line by line. It is an agent that walks in with a **map** — optionally guided by runbook recipes you have already proven — and enough humility to run the boring ladders before calling the incident closed.

Research directions worth betting on: hypothesize-then-verify, offline causal graphs pruned per alert, and process-centric evals that grade what happened — not how pretty the closing paragraph was.

---

**Further reading (same series):**

- [Evidence-Gated RCA — Prove, Then Narrate](/blog/evidence-gated-multiplane-rca/)
- [Bring Up Agent Workflows Like Hardware](/blog/bring-up-agent-workflows-like-hardware/)
- [Evidence-Based Verification](/blog/evidence-based-verification/)
- [AI-Augmented Incident Triage](/blog/ai-incident-triage-sre/)

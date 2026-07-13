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

I've spent the last few months in the gap between demo and production — teaching an AI SRE copilot to investigate real incidents across three very different shapes of pain:

1. **Event-bus lag** on a multi-tenant streaming platform (think: one partition orphaned while the rest of the cluster hums along).
2. **HTTP 5xx error-rate** on a regional API gateway serving a narrow checkout path (think: the alert screams about `/v2/widgets` while the warehouse whispers that `/v1/profiles` is actually on fire).
3. **Symptom reports** filed like bug tickets — environment, module, vague human words, no tidy metric attached.

Each archetype has its own detective story. Each one taught the same product lesson, louder every week:

> If your agent only works when you ship it a forty-page customer runbook, **the agent is not good yet.** The runbook is a crutch, not a feature.

The runbook is a programmed track: linear, brittle, written for one scene. **The map** is what a good investigator carries instead — topology of the environment (what connects to what), verify-first probes (prove before you narrate), and memory of dead ends (don't walk the same wrong corridor twice). The track tells you the notes in order. A map tells you where you are and which paths are worth trying next.

This is the field journal of that lesson.

---

## The Demo Sounds Great in the Studio

In the happy path, the copilot is tight and confident: metrics confirm the window, logs corroborate, the final paragraph names a mechanism an on-call engineer would actually act on.

In production, the same model ships a beautiful closing paragraph on top of a hollow middle stage — gorgeous surface, nothing underneath.

It will:

- Stop at a **narrow time window** and declare victory while the incident started an hour earlier.
- Rank the **loudest spike** instead of the **causal spike** (correlation wearing a causation costume).
- Emit fluent RCA prose while a gather stage never finished real work.
- Invent an **"observability gap"** before exhausting the boring ladders: widen the window, fix the env tag, try the alternate service name, discover tags you didn't know you needed.
- Spawn **sub-agents in a loop** — same probes repeated, token meter spinning, nothing new learned.

Operators don't need more narration. They need **receipts**: concrete identities, numeric KPIs, ruled-out branches, and next probes that survive a deterministic check — not a vibe check from a second LLM wearing a judge hat.

If you've been following this series, you've seen pieces of the antidote already: [evidence-gated RCA](/blog/evidence-gated-multiplane-rca/), [bring-up like hardware](/blog/bring-up-agent-workflows-like-hardware/), [evidence-based verification](/blog/evidence-based-verification/). This post is the *why now* — the product pivot those patterns were pointing at.

---

## Three Venues, Same Failure Mode

I'll describe the incidents in parallel universes so nothing here doxes a customer.

### Venue A: The streaming platform (event-bus lag)

**The alert:** consumer group lag climbing on one partition of a high-volume topic. Classic multi-tenant SaaS — thousands of GUIDs, sparse metrics, drama concentrated in one tenant's slice of the bus.

**What a *good* run establishes:**

| Branch | Question | Good signal |
|--------|----------|-------------|
| **B0** | Is lag real and growing? | Timeseries with numbers, not "elevated" |
| **B1** | Who is publishing vs consuming? | Primary tenant GUID with publish dominance or queue age |
| **B2** | Is the database hot? | SQL CPU with correct cloud tags — or honest NO_DATA after ladder |
| **B3** | Which pod owns the partition? | Orphaned partition / ownership mismatch — not "metrics unavailable" |

**What actually went wrong (repeatedly):**

- B1 stopped at a **30-minute window** when GUIDs only appear at **7-day** cadence on sparse metrics.
- B2 pasted **redacted placeholder tokens** into SQL filters → syntax errors → infinite retry loop.
- B3 found `last_owner` on a partition, then wrote **`blocked: no data`** instead of **`orphaned_partition=true`**. Gather gate saw non-empty text and cheered. Present-RCA crowned the wrong primary cause (tenant backlog instead of orphan).
- Presentation read **only the navigation JSON** ("FINISH, iter=1") and ignored the gather transcript.

The fix was never "write more poetry in the runbook." It was **graph composition** (present fans in gather *and* gate), **gate regex that accepts UUID case**, and **forbidden hollow stubs** (`branch dispatched…` is not evidence).

### Venue B: The API gateway (HTTP 5xx)

**The alert:** error-rate SLO breach on `checkout-api` in `prod-eu`, path scoped to `/api/v2/widgets`.

**What a *good* run establishes:**

| Branch | Question | Good signal |
|--------|----------|-------------|
| **B0** | Is the issue active on the scoped path? | Analytics warehouse confirms error rate on the specific path — or honest "not active" |
| **B1** | Are the right tags available? | Worker calls tag-discovery tools without allowlist blocks; servlet-style resource names resolve |
| **B2** | Do cross-plane signals match? | Edge API errors reconcile with backend metrics — crosscheck not stuck on `pending` |
| **B3** | Is pod health the story? | Readiness/restart evidence complete — not `pending_from_*` because spawn budget ran out |

**What actually went wrong (repeatedly):**

- Metrics plane returned NO_DATA on generic HTTP traces while servlet-style names had the answer — but the worker **wasn't allowed** to call tag-discovery. Allowlist drift: runbook says "discover tags," spawn contract says "you may not."
- Warehouse showed **0.007%** errors on the anchored path (issue **not active**) while a **different** path dominated at 16%+. The agent headlined pod restarts because pods were the only stage it finished.
- Cross-plane reconciliation never resolved — crosscheck token `pending` forever while gather declared complete.

**The mature answer** when signals disagree: lead with **"no active incident on scoped path"**, flag **path-scope mismatch** for human review, don't promote unrelated database saturation from cluster-wide SQL outliers. That's not prompt flair. That's a **presentation contract**.

### Venue C: The symptom report (human words, messy scope)

**The intake:** "Billing module stuck after publish in prod-eu since Tuesday."

**What a *good* run establishes:**

| Branch | Question | Good signal |
|--------|----------|-------------|
| **B0** | What is the actual scope? | Incident parsed into structured Environment / Module / Symptom / Time window |
| **B1** | What environment is impacted? | Laddered tags (`staging` → `staging-prod`) match the symptom — not the first keyword hit |
| **B2** | Which services matter? | BFF, worker, admin deployments checked — not only the obvious deployment name |
| **B3** | Where are the logs? | Log-based monitors queried with log search — not metric APIs on log monitors |

**What actually went wrong (repeatedly):**

- Routing by keyword without structure — the word *Billing* appears on a totally different workflow's event bus. Wrong genre, wrong hall.
- Clarifying questions in a loop while the user says "just investigate"; ad-hoc scout agents instead of running observability tools directly.
- Unrelated monitors attached because the alert title contained a keyword.

**Trap to avoid:** treat human intake like a metric alert. Structure first, then probe.

---

## Golden Gates

The engineering move that saved us — I wrote about the hardware analogy [here](/blog/bring-up-agent-workflows-like-hardware/) — is **bring-up**:

1. Power **only stage N** of the pipeline.
2. Define **what "green" means** before you run (`hasConcreteWindow`, `hasRankedSuspect`, `hasSecondPlane` — gates on **tool effects**, not transcript adjectives).
3. Repeat until green is **boring** (one pass is an anecdote; five passes is a rail).
4. Add the next stage.

Failures become **one-room mysteries**. When stage 2 fails, stage 2 did it. Not the universe. Not "maybe the model was feeling creative today."

But bring-up exposed the **plot twist**:

### The scorer was wrong

We spent hours accusing the investigator of missing tenant identifiers. The gate was lying — punishing correct output because the scorer wanted prose, not data.

- **The expectation:** The gate regex demanded the literal English phrase **`tenant GUID`**.
- **The reality:** The agent correctly found and emitted a raw **`UUID`**.
- **The result:** A false failure. Shape-only gates accepted **empty shells** that looked like finished reports, while valid technical data was rejected. In one case, negative lookahead in the regex **crashed the gate engine** outright — Go's RE2 simply doesn't support that syntax.

**Lesson:** treat gates like unit tests. Golden **pass** fixtures *and* golden **fail** fixtures. When the gate lies, you pay duplicate gather cost and ship the wrong headline anyway.

---

## The Product Pivot: Map, Not Script

Runbook vs map — same incident, different mental model:

```
RUNBOOK (script)                 MAP (environment)
─────────────────                ───────────────────
Step 1: query metric A           Alert + topology
        │                                │
        ▼                                ▼
Step 2: check logs               Verify probe ──(dead end?)──► widen / retry ──┐
        │                                │ (confirmed)                        │
        ▼                                ▼                                    │
Step 3: write RCA                Rank hypothesis ◄────────────────────────────┘
        │                                │
        ▼                                ▼
(linear — fixed steps)           Verdict + memory
                                 (branching — retries on failure)
```

**Customer-authored investigation stacks** — per-tenant notebooks, stage-gate regex, spawn allowlists — are **symptoms**. They exist because the copilot didn't yet know how to:

- **Navigate** metrics, logs, traces, and warehouses without a laminated cheat sheet per industry.
- **Rank hypotheses** with a verifier that locks taxonomy (`orphaned_partition` vs `consumer_stall`) from structured evidence fields.
- **See topology** before inventing a dependency map mid-run.
- **Remember** verified outcomes and surface them on the next similar alert.
- **Close the loop** — measure post-deploy/error-rate yourself; don't end with "please confirm latency" as the mitigation.

If the product agent were good, those stacks would shrink to optional demos — reference implementations, not the competitive path.

That's the difference between:

| Script model | Map model |
|--------------|-----------|
| Ship another notebook when Kafka fails | Agent knows probe → discover → requery |
| New gate regex per customer phrasing | Verifier reads structured evidence keys |
| Dependency map checkbox in gather | Topology injected at launch |
| Operator corrects RCA in Slack | Verdict → memory → next run recalls prior |
| Score workflow note tokens | Score **expected vs detected** root-cause class on app path |

The uncomfortable truth: the moat isn't "we have more SOPs." It's **environment + verify + memory**.

Research worth betting on (names only, no vendor pitch):

- **Hypothesize-then-verify** — let the LLM draft; let code lock the class.
- **Meta-causal graphs** — offline graph, online pruned subgraph per alert.
- **Process-centric evals** — Cloud-OpsBench style: grade what happened, not how pretty the closing paragraph was.

---

## Shipping in Slices

The product pivot only ships if the **platform codebase** practices what the agent preaches: modular stages, verifiable contracts, strictly typed evidence — not one monolithic "incident reasoning" branch nobody can review.

We split the work:

1. **Manifest DNA** — skills, agents, workflows (what the investigator is allowed to believe).
2. **Hedge gate** — reject soft "likely broader instability" RCA unless dig-ladder exhaustion is documented ("show your work" as policy, not prose).
3. **Change plane** — discovery-derived deploy candidates at investigate launch (Git connected → deploy correlation isn't optional folklore).
4. **Eval harness** — shipped separately; the production investigator doesn't need a scorecard in the same release train as the gate fix.

That's not bureaucracy. It's incremental rehearsal. The code that builds your RCA platform should mirror the logic you expect from the agent: small surfaces, explicit contracts, behavior owned by the type that holds the data — not helpers scattered everywhere that nobody can test in isolation.

---

## What Still Goes Wrong

No hero narrative. Current failure modes on the board:

- **Inactive incidents** scored as `undetermined` because presentation lacks an "issue not active" mode.
- **Path anchoring** — alert path vs warehouse-dominant path — still confuses headline ranking.
- **Spawn budgets** — pod health stage hits max LLM calls, writes `pending_from_*`, gate accepts it anyway.
- **Chat path** loads orchestration skills but never runs tools — judge scores an F while routing looked fine. Routing isn't investigating.
- **Mitigation homework** — "confirm latency in dashboard" — instead of running the verification query.

Each is a **gate or contract** bug, not an intelligence shortage. That's almost good news. You can fix a gate without waiting for the next foundation model.

---

## What to Steal

If you're building agentic RCA (or any multi-stage compound system):

1. **Fixed DAG, stateless LLM nodes** — [already argued here](/blog/evidence-gated-multiplane-rca/).
2. **Bring-up rails** — green one stage at a time — [hardware discipline](/blog/bring-up-agent-workflows-like-hardware/).
3. **Fan-in gather + gate** — navigation JSON is not the transcript.
4. **Structural gates on artifacts** — UUIDs, KPI digits, forbidden stubs — not English mood words.
5. **Invest in the app agent** — topology, class verifier, memory, operator verdict — not another customer runbook PDF.
6. **Score expected vs detected class** — make golden misses loud, not PARTIAL whispers.

The goal isn't an agent that can recite your runbook. It's an agent that walks in with a **map** and enough humility to run the boring ladders before calling the incident closed.

*Next up in the series: making that map real — topology at launch, verify-learn memory, and a reliability scoreboard that gates the marketing claim.*

---

**Further reading (same series, no customer data):**

- [Evidence-Gated RCA — Prove, Then Narrate](/blog/evidence-gated-multiplane-rca/)
- [Bring Up Agent Workflows Like Hardware](/blog/bring-up-agent-workflows-like-hardware/)
- [Evidence-Based Verification](/blog/evidence-based-verification/)
- [AI-Augmented Incident Triage](/blog/ai-incident-triage-sre/)

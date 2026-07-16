---
layout: post
title: "From Demo to Deploy — Failure Modes with Receipts"
date: 2026-07-15 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 22
description: "Production-ready AI agents need receipts, not fluent demos — evidence gates, bring-up discipline, HITL tiers, and eval checklists for enterprise agent pilots."
image: /assets/images/og-hitl.png
tags: [ai-agents, production, sre, evaluation, hitl, workflows, aiden, compound-ai, enterprise-agents]
permalink: /blog/demo-to-deploy-receipts/
---

**Production-ready AI agents** fail differently than conference demos. Stages and investor decks are full of agent demos that *work*. A clean alert. A fluent root-cause analysis (RCA). A green check. Applause.

Then the same pattern meets a partial dashboard, three services blaming each other, a runbook from 2023, and a human who still owns the pager. The demo did not lie about the model. It lied about **the environment**.

This post is an umbrella for the failure modes we keep relearning while shipping [AI agents for SRE](/topics/ai-agents-sre/) and agent workflows — and the **receipts** that make production different from theater. It is intentionally a map of linked lessons, not a new architecture essay. Steal the checklist; keep your stack.

---

## The Demo Contract (What Quietly Gets Assumed)

Demos assume:

- Telemetry is complete and labeled the way the prompt expects
- The “right” runbook is in context
- Tool calls finish fast and return tidy JSON
- The stop condition (“investigation complete”) means something is true
- A human will not approve blindly under load

Production violates every line. Models stay fluent anyway. That fluency is the hazard.

---

## Failure Modes Worth Naming Out Loud

### 1. Fluent but wrong

The report *looks* like an RCA. Structural completeness of prose is not proof. We wrote about this as the **looks-right heuristic** and the cure — **prove, then narrate** — in [Evidence-Gated RCA](/blog/evidence-gated-multiplane-rca/) (fixed stages emit checkable evidence before the model is allowed to narrate).

*Demo output:* “The database failed due to high CPU.” Looks decisive. Proves almost nothing.

*Production receipt first* (illustrative shape — not a product schema), *then* narrative:

```json
{"query_id": "tx_992", "cpu_spike_pct": 98, "blocked_pid": 412, "window": "last_15m"}
```

**Receipt:** machine-checkable evidence fields before presentation is allowed to speak.

### 2. Open loops that quit early

Unconstrained think → tool → think loops are polite quitters. Thin skim, “nothing to see,” done. Fixed stages with gates beat vibes — and [AI incident triage](/blog/ai-incident-triage-sre/) forces the agent to gather metrics, deploys, and similar incidents *before* proposing where to look.

**Receipt:** stage completion criteria that a unit test could fail.

### 3. Runbook-as-only-navigation

Shipping another forty-page notebook for each failure mode is a symptom that the product has no map. Topology, verify-first probes, cross-plane reconciliation, and learn-from-verdict memory — see [Agents Need a Map, Not a Script](/blog/agents-need-a-map-not-a-script/) (inject estate context at launch; scripts are overlays). Wiki vs executable triage is a sibling trade-off in [Beyond Confluence Runbooks](/blog/beyond-confluence-runbooks/) (GitOps contracts for what must run; wiki for why).

**Receipt:** injected estate context at launch; structured probe outcomes; not “step 7 of 40.”

### 4. End-to-end whodunits

When the whole pipeline is wrong, every stage looks guilty. Bring the board up one rail at a time against golden gates — [Bring Up Agent Workflows Like Hardware](/blog/bring-up-agent-workflows-like-hardware/) (green each stage under live variance before adding the next). Score **expected vs detected class**, not how pretty the transcript reads.

**Receipt:** per-stage green rates before you celebrate the final summary.

### 5. Human-in-the-loop (HITL) theater

Approve-everything creates rubber stamps; approve-nothing blocks the product. Risk tiers beat volume — [The HITL Paradox](/blog/hitl-paradox/) (auto-approve read-only, require approval for state change, hard-deny the worst).

**Receipt:** time-to-decide on approvals trending *up* as volume drops (people are reading again).

### 6. Context death mid-incident

The session did not fail because the model was dumb. It failed because a log wall ate the budget. [Tokenomics](/blog/maintaining-tokenomics-with-aiden/) is finish rate × signal fidelity × cost per **successful** workflow — compress tool walls so the smoking gun survives.

**Receipt:** sessions that finish with the smoking gun still visible after compression.

### 7. Agents that never improve the org

Digests without human-approved materialization are souvenirs. Print → propose → review → change workflows/policies — [The Diary Learning Loop](/blog/diary-learning-loop/) (learning is an approved change to the system, not a bigger vector store).

**Receipt:** reviewed proposals per week, not generated paragraphs per week.

---

## A Compact Receipts Checklist

Print this for demos that claim to be “production-ready.”

| Claim | Ask for the receipt |
|---|---|
| “We found the root cause” | Which evidence keys / identities / KPIs were emitted *before* the narrative? |
| “The agent finished” | Which structural gate passed? Would a wrong answer with the same English still pass? |
| “We follow the runbook” | Is there a map (topology + probes), or only a linear script? |
| “We tested it” | Can you green stages independently under live variance? |
| “Humans are in the loop” | What is auto-approved, what needs a person, what is hard-denied? |
| “Cost is under control” | Finish rate and cost per *success*, not spend per chat. |
| “It learns” | Show an approved change that altered policy or workflow — not a bigger vector store. |
| “It investigates like an SRE” | Does it establish identity and onset before deploy theories? Show ruled-out branches, not one hero narrative. |

If the seller cannot produce receipts, you are buying theater seats.

---

## How to Pitch This Internally

If you are championing better agent standards to leadership — or presenting at an internal tech talk — keep the arc short. You do not need a conference badge for this conversation to matter:

1. **Hook:** same alert, fluent false RCA vs receipts-first path.
2. **Name four polite failures** (looks-right, early quit, runbook crutch, approval fatigue).
3. **Show the map and bring-up discipline** without a product tour.
4. **Close:** humans keep judgment; agents earn trust with artifacts.

That is the sister narrative to reliability-over-intelligence slides — the builder version with scars, usable in a sprint review as much as on a stage.

---

## Related reading (deep dives)

- [Evidence-Gated RCA — Prove, Then Narrate](/blog/evidence-gated-multiplane-rca/) — structural gates so narration cannot leapfrog evidence
- [Your RCA Agent Needs a Map](/blog/agents-need-a-map-not-a-script/) — topology and verify-first probes beat runbook-only agents
- [AI Incident Triage for SREs](/blog/ai-incident-triage-sre/) — shrink the first thirty minutes with parallel context gather
- [Bring Up Agent Workflows Like Hardware](/blog/bring-up-agent-workflows-like-hardware/) — stage-by-stage golden gates under live variance
- [The HITL Paradox](/blog/hitl-paradox/) — risk-tiered approvals so review stays real
- [LLM Tokenomics for Production Agents](/blog/maintaining-tokenomics-with-aiden/) — finish rate and compression as an operating model
- [The Diary Learning Loop](/blog/diary-learning-loop/) — digests become human-approved workflow/policy changes
- [The Hypothesis Ladder](/blog/hypothesis-ladder/) — hypothesis-driven debugging: prove first, narrate last
- Topic hubs: [AI agent workflows](/topics/ai-agent-workflows/) · [AI agents for SRE](/topics/ai-agents-sre/)

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

*What receipt do you wish you had asked for before the last agent pilot? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

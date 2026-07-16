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

Then the same pattern meets a partial dashboard, three services blaming each other, a runbook from 2023, and a human who still owns the pager. **The demo did not lie about the model. It lied about the environment.**

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

Each mode follows the same shape: **demo illusion**, **production reality**, **receipt**.

### 1. Fluent but wrong

**The demo illusion:** The report *looks* like an RCA. “The database failed due to high CPU.” Decisive prose. Proves almost nothing.

**The production reality:** Structural completeness is not proof — the **looks-right heuristic**. The cure is **prove, then narrate**: fixed stages emit checkable evidence before the model narrates. See [Evidence-Gated RCA](/blog/evidence-gated-multiplane-rca/) (multi-backend RCA — metrics, logs, traces — with gates before summary).

Receipt first (illustrative — not a product schema), narrative second:

```json
{"query_id": "tx_992", "cpu_spike_pct": 98, "blocked_pid": 412, "window": "last_15m"}
```

**The receipt:** machine-checkable evidence fields exist *before* presentation is allowed to speak.

### 2. Open loops that quit early

**The demo illusion:** Think → tool → think → “investigation complete.” Green check. Applause.

**The production reality:** Unconstrained loops are **polite quitters** — thin skim, “nothing to see,” done. Fixed stages with gates beat vibes. [AI incident triage](/blog/ai-incident-triage-sre/) gathers metrics, deploys, and similar incidents *before* proposing where to look.

Illustrative gate (shape only):

```json
{"stage": "gather", "required": ["primary_identity", "kpi_value"], "passed": false, "reason": "missing_kpi"}
```

**The receipt:** stage completion criteria a unit test could fail — empty prose cannot pass.

### 3. Runbook-as-only-navigation

**The demo illusion:** Ship a forty-page notebook per failure mode; the agent “follows the runbook.”

**The production reality:** That is a symptom of no **map** — topology and verify-first probes, not step 7 of 40. **Cross-plane reconciliation** (do metrics, logs, and traces agree?) and learn-from-verdict memory belong in the platform, not in another PDF. See [Agents Need a Map, Not a Script](/blog/agents-need-a-map-not-a-script/). Wiki vs executable triage: [Beyond Confluence Runbooks](/blog/beyond-confluence-runbooks/) (GitOps for what must run; wiki for why).

**The receipt:** injected estate context at launch; structured probe outcomes — not “branch dispatched…” placeholders.

### 4. End-to-end whodunits

**The demo illusion:** Run the full pipeline once on a clean fixture; declare victory.

**The production reality:** When everything runs at once, every stage looks guilty. **Bring up one rail at a time** against golden gates under **live variance** (real production noise, not demo data) — [Bring Up Agent Workflows Like Hardware](/blog/bring-up-agent-workflows-like-hardware/). Score **expected vs detected class**, not transcript polish.

**The receipt:** per-stage green rates before you celebrate the final summary.

### 5. Human-in-the-loop (HITL) theater

**The demo illusion:** “Humans approve every action” — slide shows a responsible team.

**The production reality:** Approve-everything creates rubber stamps; approve-nothing blocks the product. **Risk tiers** beat volume — [The HITL Paradox](/blog/hitl-paradox/) (auto-approve read-only, require approval for mutations, hard-deny the worst).

Illustrative tiering (not a product export):

```yaml
tools:
  metrics_query:
    approval: auto          # read-only
  kubectl_scale:
    approval: required
    risk_tier: high         # state change
  shell_rm_rf:
    approval: denied        # hard block
```

**The receipt:** time-to-decide on approvals trends *up* as volume drops — people are reading again.

### 6. Context death mid-incident

**The demo illusion:** Short, tidy tool responses; the agent “reasons through” the incident.

**The production reality:** The session did not fail because the model was dumb. A **log wall ate the budget**. [Tokenomics](/blog/maintaining-tokenomics-with-aiden/) is finish rate × signal fidelity × cost per **successful** workflow — compress tool output so the smoking gun survives.

Before compression (what the model would have choked on):

```text
{"level":"error","msg":"connection reset","trace_id":"a1b2", ... 3,800 more characters ...}
```

After compression (what still fits in context):

```text
error_count=847 window=15m top_msg="connection reset" sample_trace=a1b2…
```

**The receipt:** the session finishes with the decisive signal still visible after compression.

### 7. Agents that never improve the org

**The demo illusion:** “It learns from every incident” — bigger memory, flashier digests.

**The production reality:** Digests without human-approved **materialization** are souvenirs. Print → propose → review → change workflows/policies — [The Diary Learning Loop](/blog/diary-learning-loop/) (learning is an approved change to the system, not a bigger vector store).

Illustrative proposal record (shape only):

```json
{"pattern": "deny_tool:deploy_prod", "count_7d": 12, "proposal": "attach_policy:deploy_guard", "status": "pending_review"}
```

**The receipt:** reviewed proposals per week — not generated paragraphs per week.

---

## A Compact Receipts Checklist

Print this for demos that claim to be “production-ready.”

| Claim | Ask for the receipt |
|---|---|
| “We found the root cause” | Which evidence keys / identities / KPIs were emitted *before* the narrative? |
| “The agent finished” | Which structural gate passed? Would a wrong answer with the same English still pass? |
| “We follow the runbook” | Is there a map (topology + probes), or only a linear script? |
| “We tested it” | Can you green stages independently under live variance (real prod noise, not fixtures)? |
| “Humans are in the loop” | What is auto-approved, what needs a person, what is hard-denied? |
| “Cost is under control” | Finish rate and cost per *success*, not spend per chat. |
| “It learns” | Show an approved change that altered policy or workflow — not a bigger vector store. |
| “It investigates like an SRE” | Does it establish identity and onset before deploy theories? Show ruled-out branches, not one hero narrative. |

If the seller cannot produce receipts, you are buying theater seats.

---

## Slide deck outline (internal pitch)

Use this as a four-slide arc for leadership or a sprint review — no conference badge required.

**Slide 1 — The hook:** Same alert, two paths. Fluent false RCA vs receipts-first investigation. **The demo lied about the environment**, not the model.

**Slide 2 — The hazards:** Name four polite failures — looks-right prose, open loops that quit early, runbook-as-only navigation, HITL theater (rubber stamps under load).

**Slide 3 — The new standard:** Map + verify-first probes, bring-up discipline (one stage green at a time), gated workflows. Link to deep dives; skip the product tour.

**Slide 4 — The payoff:** Humans keep judgment. Agents earn trust with **artifacts** — evidence keys, gate passes, approval tiers, compression that preserves the smoking gun.

Elevator version: *“We don’t need smarter models first. We need receipts — proof the investigation earned its summary before the channel sees it.”*

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

---
layout: post
title: "Prove, Then Narrate — Deterministic Orchestration Over Autonomous Agents"
date: 2026-07-08 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 14
description: "How we stopped prompting reliability into frontier models and wrapped them in a fixed DAG with structural evals, state merging, and token-aware tool loops — using SRE RCA as the proving ground."
tags: [ai-agents, compound-ai, orchestration, evaluation, sre, workflows]
---

The demo version of agentic AI is an unconstrained ReAct loop: think, call a tool, think again, declare victory. The production version is uglier. Models are polite, sycophantic, and excellent at the **"looks-right" heuristic** — marking a stage complete because the *syntactic shape* of their own thought history satisfies a stop condition, not because the investigation earned it.

We hardened multi-plane RCA workflows in Aiden after watching fluent agents skip the boring work. The domain was SRE — metrics, logs, warehouses — but the engineering problem was general: **deterministic orchestration over non-deterministic models.**

We stopped trying to prompt-engineer reliability into a frontier model. We built a **compound AI system**: a fixed DAG where the LLM is a stateless execution engine for individual nodes, and Go-owned control flow owns state, validation, and promotion.

This is a sequel to [AI-augmented incident triage](/blog/ai-incident-triage-sre/) and [evidence-based verification](/blog/evidence-based-verification/) — framed for AI engineers who care about cognitive architecture, not on-call folklore.

---

## The Failure Mode: Unconstrained Loops Lie Politely

Left to an open ReAct loop, a capable agent will:

- Succumb to **sycophancy** — skim a narrow window, find nothing, report that everything looks fine
- Apply the **looks-right heuristic** — emit a report-shaped blob and treat structure as success
- Suffer **context amnesia** — summarize from plan notes while ignoring the evidence stage that just finished
- Invent **observability gaps** before exhausting time-window and alias ladders
- Spawn a **sub-agent swarm** that inflates tokens and latency without improving recall

Operators (and eval harnesses) don't need more prose. They need **falsifiable artifacts**: identities, KPIs, ruled-out branches, and next probes — receipts the runtime can check without another LLM call.

---

## Pattern 1: Fixed DAG Over Autonomous Loops

We chose a boring, reliable graph for several investigation families (streaming lag, HTTP error-rate, symptom reports):

| Node | Job |
|------|-----|
| **Plan / scope** | Parse structured fields. Write a short plan. Forbid root-cause claims. |
| **Gather evidence** | Run diagnostic branches. Persist machine-checkable evidence tokens. |
| **Present** | Merge state. Draft the human summary. Format for the UI. |

**One investigator persona** across nodes beat a mesh of hyper-specialized micro-agents ("metrics agent" talking to "logs agent"). Specialist swarms recreate the coordination tax: cascading context loss, duplicated tool discovery, and token burn on handoff theater.

Mid-graph outputs must say **"node complete — handoff,"** not **"final answer."** Early nodes that emit a finished narrative poison the watch UI and train humans to distrust the system — the same failure mode as [fabricated sub-agent reports](/blog/halguard-fabricated-reports/).

The LLM still reasons inside a node. The **graph** decides when the node is allowed to finish.

---

## Pattern 2: Structural Evals, Not Semantic Vibes

A gate that matches the phrase `"investigation complete"` will promote hollow runs. We learned this the hard way: English-fragment gates rejected correct answers that used a UUID; shape-only gates accepted empty shells that *looked* like finished reports.

Treat the model like an **untrusted third-party API**. Before promoting a payload, run **deterministic guardrails** — structural evals that ask:

- Did the primary branch emit a concrete identity (or an explicit "none found after full ladder")?
- Did presentation include a numeric KPI, not just a heading?
- Did each required evidence key appear before the node claimed success?

Loop-back retries are useful until the gate is wrong. A bad structural check re-runs expensive tool work for no new information — pure **token inflation**. Treat gate fixtures like unit tests: golden pass *and* fail cases.

Related lesson from HalGuard: **don't trust self-report; check the artifact.**

---

## Pattern 3: State Merging Beats Gate-Only Handoffs

Navigation nodes that only emit "FINISH / GO_BACK" are great for control flow and terrible as the sole predecessor of presentation. When present depended only on the gate, the model saw a bare navigation payload, ignored the gather transcript, and produced a polished **"inconclusive — missing evidence"** narrative — while gather had already done excellent work.

That is a **context-window / state-merging bug**, not an intelligence bug.

**Fix the graph:** presentation fans in **gather output + gate**. The gate decides *whether* to proceed; gather carries *what* to say. Control-flow JSON is not an investigation transcript.

This is [workflow composition](/blog/workflow-composition/) applied to agent memory: contracts over vibes.

---

## Pattern 4: Parallel Tool Execution With Explicit Promotion

High-value investigations aren't one tool call. They are **branches** in a mergeable subgraph:

- Confirm the symptom is real (timeseries, not a one-point spike)
- Attribute impact (which identity dominates)
- Probe the dependency layer
- Probe the runtime layer

Run independent branches in parallel for **latency**. Serialize only when a later branch needs identities from an earlier one. We added an explicit **promotion** step: the coordinator copies plaintext candidates into canonical notes before spawning the dependency probe — so workers never paste redacted placeholders into query filters (a common failure when memory redaction meets tool arguments).

Also: forbid "none found" until the **full ladder** finishes. Sparse signals often appear only in wider ranges. Declaring absence after the first narrow window is how agents invent gaps — premature stopping dressed up as rigor.

In a Go runtime, this maps cleanly to bounded concurrency with cancellation: parallel lanes get timeouts so a runaway tool cannot hang the whole incident graph. The model proposes tool calls; the runtime owns fan-out and merge.

---

## Pattern 5: Fight Context Bloat at the Tool Boundary

At high event volume, dumping raw warehouses or paginating noisy logs into the context window is how you turn an investigation into **needle-in-a-haystack** failure — and a bill.

Prefer **pre-aggregated** planes sized to the alert duration: fine grain for short windows, coarser rollups for days and weeks. Batch related queries when the tool supports it; on partial failure, retry **only** failed named queries.

For logs: if page one is dominated by known noise, **rewrite the query** instead of paginating until the LLM budget dies. Query rewriting and grain selection belong in application policy — out of the model's control — so token economics aren't left to hope.

---

## Pattern 6: Dual-Audience Artifacts (Human Front, Machine Appendix)

Operators at 3 AM have zero patience for system-prompt archaeology. Agents need exact evidence keys and gate markers.

We split the playbook:

- **Human body** — numbered steps, tool plane, expected output, calm senior-engineer markdown ([executable runbooks](/blog/markdown-runbooks-playbooks/))
- **Machine appendix** — tokens, note keys, spawn hygiene, gate phrases

One source of truth; two audiences. The UX pattern is underrated: it keeps humans editing the doc while the runtime still gets a parseable contract.

---

## Pattern 7: Route on Schema, Not Keyword Coincidence

Wrong skill load is expensive: the agent diligently runs the wrong playbook and still looks busy. Route by **required fields** (structured intake), not keyword coincidence in free text:

| Input shape | Investigation family |
|-------------|----------------------|
| Topic + consumer group + partition + timeframe | Streaming / lag |
| Environment + module + symptom + time period | Symptom / bug report |
| Service + env + API path + timeframe | HTTP error-rate / SLO |

This is classifier hygiene for compound systems: the router is cheap and deterministic; the expensive model only runs inside the chosen subgraph.

---

## What We Deliberately Did Not Automate

- **Closing the loop without a human** — autonomy over incident state erodes trust ([HITL paradox](/blog/hitl-paradox/))
- **Hardcoded identities in skills** — discover from tools; never bake a customer into the prompt
- **Unbounded sub-agent swarms** — spawn only bounded parallel lanes with allowlists
- **Confident narratives without receipts** — every primary claim needs a signal row the gate can see

---

## Lessons Learned

1. **Compound beats clever prompts.** Put reliability in the graph and the evals; let the model do synthesis and tool routing inside a node.

2. **Structural evals beat semantic vibes.** Promote payloads the way you'd accept an untrusted API response.

3. **State merging is a first-class design problem.** Navigation JSON is not memory.

4. **Parallelism needs promotion rules.** Fan-out without canonical notes pollutes tool arguments.

5. **Token economics live at the tool boundary.** Grain, batching, and query rewrite beat "just use a bigger context."

6. **Dual-audience docs scale.** Humans edit prose; machines read the appendix.

7. **Prove, then narrate.** Narration is the last node — never the first.

None of this requires a smarter model. It requires treating agent workflows like production software: fixed control flow, regression traces, and gates that fail closed when the model tries to skip the boring work.

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

*Where does your agent still get to mark "done" on vibes? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

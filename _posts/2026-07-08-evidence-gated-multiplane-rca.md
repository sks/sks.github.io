---
layout: post
title: "Evidence-Gated RCA — Prove, Then Narrate"
date: 2026-07-08 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 14
description: "Evidence-gated RCA for AI SRE agents: prove with receipts, then narrate. Fixed stages, structural evals, and token-aware tool loops."
image: /assets/images/og-evidence-rca.png
tags: [ai-agents, compound-ai, orchestration, evaluation, sre, workflows]
faqs:
  - question: "What is evidence-gated RCA for AI agents?"
    answer: "A fixed investigation DAG with structural evals and token-aware tool loops. Go owns pass/fail gates; the model narrates only after evidence is committed."
  - question: "Why avoid unconstrained ReAct for production RCA?"
    answer: "Models are polite and excellent at the looks-right heuristic — marking stages complete from syntactic thought shape instead of earned evidence."
  - question: "What does prove-then-narrate mean?"
    answer: "Require committed evidence from observability planes before allowing a fluent root-cause narrative. Narration without proof is a demo pattern, not a production one."
---

In our incident investigations, a free-form reasoning-and-tool-use loop (often called ReAct) sometimes ended with a convincing report before the required checks had run. A report-shaped answer is not evidence that its underlying queries were completed.

We hardened [multi-stage agent workflows](/topics/ai-agent-workflows/) in Aiden, an incident-investigation agent, after seeing that failure. Site reliability engineering (SRE) work here spans metrics, logs, and warehouse data. The aim was to put checkable control flow around model-generated work, not to make the model deterministic.

We used a fixed directed acyclic graph (DAG): a workflow of dependent stages that does not loop back arbitrarily. The large language model (LLM) reasons within each stage; Go code manages state, validates outputs, and decides whether work can move to the next stage. This is a compound system—model plus ordinary software—not a claim that prompts have no role.

This follows [AI-augmented incident triage](/blog/ai-incident-triage-sre/) and [evidence-based verification](/blog/evidence-based-verification/). The examples describe our workflow design, not a controlled comparison of every agent architecture.

---

## What a fluent report can hide

In the runs we examined, a free-form loop could:

- Stop at a narrow time window, find nothing, and report that everything looks fine
- Emit a report-shaped answer that passes a superficial completion check
- Summarize from plan notes without the evidence gathered later
- Call data unavailable before widening the time window or checking alternate names
- Spawn multiple helper agents, adding tokens and latency without clear evidence of better coverage

Operators and automated evaluations need checkable artifacts: identities, key performance indicators (KPIs), ruled-out branches, and next probes. These can establish that required evidence was recorded, although they cannot prove causality on their own.

---

## Pattern 1: Fixed DAG Over Autonomous Loops

We chose a boring, reliable graph for several investigation families (streaming lag, HTTP error-rate, symptom reports):

| Node | Job |
|------|-----|
| **Plan / scope** | Parse structured fields. Write a short plan. Forbid root-cause claims. |
| **Gather evidence** | Run diagnostic branches. Persist machine-checkable evidence tokens. |
| **Present** | Merge state. Draft the human summary. Format for the UI. |

In these workflows, **one investigator persona** across nodes was easier to manage than a mesh of hyper-specialized micro-agents ("metrics agent" talking to "logs agent"). More specialists add handoffs, duplicate tool discovery, and context overhead; they may still be useful where expertise or independent work justifies that cost.

Mid-graph outputs must say **"node complete — handoff,"** not **"final answer."** Early nodes that emit a finished narrative poison the watch UI and train humans to distrust the system — the same failure mode as fabricated sub-agent reports (a topic for a future post).

The LLM still reasons inside a node. The **graph** decides when the node is allowed to finish.

---

## Pattern 2: Structural Evals, Not Semantic Vibes

A gate that matches the phrase `"investigation complete"` will promote hollow runs. We learned this the hard way: English-fragment gates rejected correct answers that used a UUID; shape-only gates accepted empty shells that *looked* like finished reports.

Treat the model like an **untrusted third-party API**. Before promoting a payload, run **deterministic guardrails** — structural evals that ask:

- Did the primary branch emit a concrete identity (or an explicit "none found after full ladder")?
- Did presentation include a numeric KPI, not just a heading?
- Did each required evidence key appear before the node claimed success?

Retries help only when the gate tests the right requirement. A bad structural check re-runs expensive tool work for no new information — pure **token inflation**. Treat gate fixtures like unit tests: golden pass *and* fail cases.

Related lesson from HalGuard: **don't trust self-report; check the artifact.**

---

## Pattern 3: State Merging Beats Gate-Only Handoffs

Navigation nodes that only emit "FINISH / GO_BACK" are great for control flow and terrible as the sole predecessor of presentation. When present depended only on the gate, the model saw a bare navigation payload, ignored the gather transcript, and produced a polished **"inconclusive — missing evidence"** narrative — while gather had already done excellent work.

That is a **context-window / state-merging bug**, not an intelligence bug.

We changed the graph so presentation receives **gather output + gate**. The gate decides *whether* to proceed; gather carries *what* to say. Control-flow JSON is not an investigation transcript.

The gate carries the decision; gathered evidence carries the facts the summary must use.

![Fixed investigation graph where planning feeds evidence gathering, structural gate checks requirements, and presentation receives both decision and facts](/assets/images/diagrams/july-workflows/evidence-gated-rca.svg)

*Presentation needs both the gate decision and the gathered evidence, not a navigation token alone.*

---

## Pattern 4: Parallel Tool Execution With Explicit Promotion

High-value investigations aren't one tool call. They are **branches** in a mergeable subgraph:

- Confirm the symptom is real (timeseries, not a one-point spike)
- Attribute impact (which identity dominates)
- Probe the dependency layer
- Probe the runtime layer

Run independent branches in parallel when latency matters and tool limits permit it. Serialize only when a later branch needs identities from an earlier one. We added an explicit **promotion** step: the coordinator copies plaintext candidates into canonical notes before spawning the dependency probe — so workers never paste redacted placeholders into query filters (a common failure when memory redaction meets tool arguments).

Do not label an identity "none found" until the planned search ladder finishes; if a tool fails, say so instead. Sparse signals often appear only in wider ranges. Declaring absence after the first narrow window is how agents invent gaps — premature stopping dressed up as rigor.

In a Go runtime, this maps cleanly to bounded concurrency with cancellation: parallel lanes get timeouts so a runaway tool cannot hang the whole incident graph. The model proposes tool calls; the runtime owns fan-out and merge.

---

## Pattern 5: Fight Context Bloat at the Tool Boundary

At high event volume, dumping raw warehouses or paginating noisy logs into the context window is how you turn an investigation into **needle-in-a-haystack** failure — and a bill.

Prefer **pre-aggregated** planes sized to the alert duration: fine grain for short windows, coarser rollups for days and weeks. Batch related queries when the tool supports it; on partial failure, retry **only** failed named queries.

For logs: if the first page is dominated by known noise, **rewrite the query** rather than paging through the same noise indefinitely. Application policy can bound query rewriting and sampling grain so a broad model request does not consume the whole context budget; operators still need access to uncompressed evidence.

---

## Pattern 6: Dual-Audience Artifacts (Human Front, Machine Appendix)

Operators at 3 AM have zero patience for system-prompt archaeology. Agents need exact evidence keys and gate markers.

We split the playbook:

- **Human body** — numbered steps, tool plane, expected output, calm senior-engineer markdown (executable runbooks humans still want to edit)
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

## What this design buys—and does not

1. **Compound beats clever prompts.** Put reliability in the graph and the evals; let the model do synthesis and tool routing inside a node.

2. **Structural evals beat semantic vibes.** Promote payloads the way you'd accept an untrusted API response.

3. **State merging is a first-class design problem.** Navigation JSON is not memory.

4. **Parallelism needs promotion rules.** Fan-out without canonical notes pollutes tool arguments.

5. **Token economics live at the tool boundary.** Grain, batching, and query rewrite beat "just use a bigger context."

6. **Dual-audience docs scale.** Humans edit prose; machines read the appendix.

7. **Prove, then narrate.** Narration is the last node — never the first.

The graph makes skipped steps visible, but a structural gate cannot prove a causal explanation is correct. It needs regression traces, checked evidence, and an operator who can contest the verdict.

---

## Related reading

- [Bring Up Agent Workflows Like Hardware](/blog/bring-up-agent-workflows-like-hardware/) — green one stage at a time before trusting the full DAG
- [Evidence-Based Verification](/blog/evidence-based-verification/) — verification from systems of record after investigation
- More on [AI agent workflows](/topics/ai-agent-workflows/) · full [series](/series/enterprise-ai-agents-go/)

---


*Where does your agent still get to mark "done" on vibes? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> We build incident-triage agents at StackGen; the SRE offering is at [ai.stackgen.com](https://ai.stackgen.com).

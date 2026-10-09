---
layout: post
title: "Single-Agent vs Multi-Agent Orchestration: How to Choose"
date: 2026-08-09 15:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 40
description: "Single-agent vs multi-agent for SRE triage: a fair A/B, what each shape wins at, and a decision framework so you stop defaulting to either."
image: /assets/images/og-default.png
tags: [ai-agents, multi-agent, orchestration, sre, reactree, incident-response, workflows, golang, aiden]
permalink: /blog/single-agent-vs-multi-agent/
faqs:
  - question: "What is the difference between a single-agent and a multi-agent system?"
    answer: "A single-agent path is one cognitive loop with tools. A multi-agent path is two or more loops coordinated by a planner or orchestrator — specialists, handoffs, and often parallel digs."
  - question: "When should you use a single agent instead of multi-agent orchestration?"
    answer: "When the work fits one tool plane and a short collect→verdict loop, and latency or cost matter more than parallel specialization. A capable root with tools often matches multi-agent quality with less coordination tax."
  - question: "When is multi-agent orchestration worth it for incident triage?"
    answer: "When you need parallel falsifiers across planes or skills, isolated workers with their own budgets, failure isolation, or auditability of specialist steps — branching is the job, not overhead."
  - question: "Is multi-agent always better for complex SRE work?"
    answer: "No. Complexity of the incident does not automatically require multiple agents. Use multi-agent when the work itself branches; use single-agent when one loop can own the dig end to end."
  - question: "How much slower was multi-agent on a single-plane triage A/B?"
    answer: "On our fair run, multi-agent took about 1.6× the wall time (~95s vs ~58s) and about 3.9× the tool calls (27 vs 7), with the same findings — extra cost was coordination and gate retries, not more inspection depth."
---

For an AI agent that investigates incidents—software that uses a model to select tools and examine results—one design decision is **single-agent vs multi-agent orchestration**: one loop with tools, or a planner coordinating several loops. More loops can enable parallel work, but they also add handoffs and cost.

We compared the two shapes on one [incident triage](/topics/ai-incident-triage/) job for site reliability engineering (SRE): **same prompt, models, tools, and budgets**; the intended difference was execution shape. One path was a **single parent-first agent**. The other kept a **ReAcTree-style planner** that could spawn children.

This is not a takedown of either. Both paths produced the **same class of findings** in this single run. The comparison helps decide what to test next, not which architecture always wins.

---

## What this comparison shows

- **Single-agent** and **multi-agent** are both legitimate production shapes — not a fashion contest.
- On our **single-plane** triage A/B, multi-agent took **~1.6× longer** (~95s vs ~58s) and **~3.9× more tool calls** (27 vs 7) — and still reached the **same** proposed explanation.
- On **multi-plane / parallel** work, the planner’s strengths — isolation, parallel digs, specialist context — are exactly why trees exist ([ReAcTree in production](/blog/reactree-bugs/)).
- Choose by **branching need** and measured latency or isolation requirements.

The comparison tests a narrow, sequential cluster-health task. It does not measure whether parallel specialists would help on incidents spanning metrics, logs, and change history.

---

## What people mean by single-agent vs multi-agent

| Shape | What it is | Good faith strength |
|-------|------------|---------------------|
| **Single-agent** | One plan → tool → context loop. The root calls tools itself. | Simple to reason about, usually lower latency and token tax, one place to put budgets and human-in-the-loop (HITL) approval |
| **Multi-agent orchestration** | A planner (or foreman) coordinates child agents with handoffs | Parallelism, specialist personas, failure isolation, clearer audit of who did which dig |

Counting tools does not make a system multi-agent. **Counting cognitive loops** does. One loop with twenty tools is still single-agent. Two loops with a handoff is multi-agent.

---

## The A/B job (kept deliberately narrow)

We used a **read-only cluster health triage**: inspect nodes and workloads, mark unavailable planes as not applicable, satisfy a completion gate, then write Theory / Impact / Do-this-now with concrete unhealthy names.

That is a **single-plane** job on purpose. It is where orchestration either proves useful — or shows up as pure coordination cost. It is *not* a claim that every SRE investigation looks like this. Multi-plane RCA (metrics + logs + change history) is a different beast ([evidence-gated RCA](/blog/evidence-gated-multiplane-rca/), [hypothesis ladder](/blog/hypothesis-ladder/)).

---

## What both sides got right

Both paths named the **same** class of problems:

- A worker node stuck NotReady / unreachable
- A pod stuck creating because a required secret was missing
- A workload evicted after disk pressure

So the fair story is **not** “one architecture found the truth and the other failed.” Finding quality was a **tie**. The interesting differences were *how* each path spent its budget — and what that implies for other jobs.

---

## The case for single-agent (parent-first)

**Where it shone in this A/B**

- **~58s** end-to-end vs **~95s** on the planner path (**~1.6×** faster)
- **7** tool-call starts vs **27** (**~3.9×** leaner) — collect → gate → summarize without child spawn
- **0** child agents (denied by design) vs **2** spawns on the planner path
- Cleaner completion at one altitude: gate closed without the root retry storm
- Easier operator story: one session to read, one place to steer ([mid-run steer](/blog/steer-ai-agents-mid-run/))

**Why that is a real product win — not just “simpler is nicer”**

On-call assist is a latency product. Every extra model hop is a second the human stares at a spinner. For jobs that fit one plane and one checklist, a capable root with the right tools is often enough. This run supports testing whether a single loop can complete a narrow job before adding a planner; it does not establish a general fleet-level result.

**What single-agent is *not* claiming**

It is not “never delegate.” It is “do not pay for a second cognitive loop until the first one is actually stuck or the work truly branches.”

---

## The case for multi-agent orchestration (planner trees)

**Where the planner is the honest choice**

Even when this narrow A/B made the tree look expensive, the architecture exists for good reasons:

1. **Parallel falsifiers** — metrics vs logs vs deploys should race, not queue. A single loop may serialize these digs; a tree can fan out when its tools and budgets permit ([bring-up discipline](/blog/bring-up-agent-workflows-like-hardware/)).
2. **Specialist context** — a worker can receive a narrower tool set and context, though specialization adds setup and handoff costs.
3. **Failure isolation** — a bad dig can fail without poisoning the parent’s whole turn; partial progress is salvageable.
4. **Governance and audit** — per-child budgets, HITL, and traces nest cleanly when specialists are first-class ([observability for agents](/blog/observability/)).
5. **Depth with hard limits** — ReAcTree-style systems can allow structured delegation while still capping recursion ([production tree bugs we fixed](/blog/reactree-bugs/)).

**Why the tree looked “heavier” on this particular job**

On a single-plane card, the planner still did planner things: spawn children, adaptive completion at the root, more note/search ceremony. In our numbers that showed up as **~1.6× wall time** and **~3.9× tool calls** for the **same** findings — not because the dig needed more shell probes (both paths did three inspection rounds), but because coordination and gate retries piled on. This suggests a mismatch between the branching design and this sequential task, not a defect in multi-agent orchestration overall.

---

## Side-by-side (this A/B only)

One sequential fair run each after setup was honest. Same prompt, models, tools, and budgets; one sequential run per shape is too small to estimate typical latency or variance.

| Dimension | Single-agent | Multi-agent / ReAcTree | Multi-agent vs single |
|-----------|-------------:|------------------------:|----------------------:|
| Wall time | **57.6 s** | **94.7 s** | **~1.6× higher** |
| Tool-call starts | **7** | **27** | **~3.9× heavier** |
| Child-agent spawns | 0 | 2 | — |
| Inspection rounds (shell) | 3 | 3 | tie |
| Completion-gate calls | 2 | 4 | **2×** |
| Finding quality | Same loci | Same loci | tie |
| Best fit signal | One plane, short loop | Parallel / multi-skill / isolation | — |

Treat the table as **evidence for a decision framework**, not a global ranking. One A/B is not a latency SLA — it is a concrete “how much tax did orchestration add when branching was not required?”

---

## A practical decision framework

Ask these before you pick a shape:

1. **Does the work branch?** Competing hypotheses across planes → lean multi-agent. One plane, one checklist → lean single-agent.
2. **Is parallelism the product?** Independent digs that should finish together → multi-agent. Strictly sequential collect → single-agent is fine.
3. **Do specialists need isolation?** Different budgets, tools, or risk profiles per dig → multi-agent. Same tools for the whole turn → single-agent.
4. **What is the latency budget?** Human waiting on chat → bias single-agent until branching forces otherwise.
5. **What must you audit?** Step-level specialist trails → multi-agent. One session narrative → single-agent may be enough.
6. **Are you fair-testing?** Mis-set budgets, over-redaction, HITL clarify stalls, or completion checks at the wrong altitude can fake a winner ([PII for agents](/blog/pii-redaction-ai-agents/), [completion loops](/blog/is-the-task-actually-done/), [loop salvage](/blog/ai-agent-loop-detection-salvage/)).

**Rule of thumb:** start with the simpler shape that can complete the task; test orchestration when independent digs or isolation requirements justify the added coordination.

---

## Fairness pitfalls (both sides get hurt)

Early runs lied until we fixed setup. Worth naming so your own A/Bs stay honest:

1. **Budgets that do not actually apply** to the path under test
2. **Redaction that hides tool names and IDs** the model must use
3. **HITL clarify** on unattended benches (multi-agent especially)
4. **Completion at the wrong altitude** (child done, root still retries)
5. **Loop detectors** that punish legitimate batch inspection

If those are broken, you are not measuring single-agent vs multi-agent. You are measuring config debt.

---

## The principle

**Match execution shape to branching need.**

- A **single agent** is a tool for decisive, same-plane work.
- A **multi-agent tree** is a tool for parallel uncertainty and specialist isolation.

We keep both shapes. This A/B supports using the simpler loop for narrow triage while evaluating a tree separately on tasks that actually require parallel digs.

---

## Where to go next

- [Fair Agent Evals: Tools Must Match](/blog/fair-agent-evals-before-performance/) — eval sequel: fix handoff before you compare modes
- [ReAcTree production bugs](/blog/reactree-bugs/) — why trees need hard depth and shared governance
- [Is the task actually done?](/blog/is-the-task-actually-done/) — completion that is not prose
- [What are SRE AI agents?](/blog/what-are-sre-ai-agents/) — triage vs RCA vs remediation
- Hub: [AI incident triage](/topics/ai-incident-triage/) · [AI agent workflows](/topics/ai-agent-workflows/) · [AI agent runtime](/topics/ai-agent-runtime/)

---

**Acknowledgments.** Both execution shapes in our stack are team work across the Aiden / agent-runtime effort — parent-first paths and planner trees each exist because production pulled for them, not because one fashion won.

*Choosing single-agent vs multi-agent for on-call triage? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> StackGen develops AI tools for site reliability engineering (SRE), including incident triage and diagnostic workflows. Product details are at [ai.stackgen.com](https://ai.stackgen.com).

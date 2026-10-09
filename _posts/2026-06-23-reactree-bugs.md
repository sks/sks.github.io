---
layout: post
title: "Implementing ReAcTree — 6 Production Bugs the Paper Didn't Warn You About"
date: 2026-06-23 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 4
description: "Six runtime bugs we found implementing ReAcTree: delegated approvals, graph wiring, timeouts, session isolation, recursion and memory."
image: /assets/images/og-debug.png
tags: [ai-agents, reactree, production, bugs, go]
---

A paper can specify an algorithm without specifying every boundary in a running service: tool permissions, timeouts, session ownership, and stored failures.

We implemented [ReAcTree](https://arxiv.org/abs/2511.02424) — a hierarchical agent decomposition algorithm — in our production agent runtime. ReAcTree lets a parent agent break complex tasks into sub-goals, assign them to child agents, and coordinate results using sequence, parallel, and fallback control flows.

Our implementation exposed six failures in the surrounding runtime. These are observations from our system, not claims that the paper promised to solve them.

---

## How the delegated plan works

The graph shows how parallel children fan out and rejoin, and which session, deadline, and governance boundaries the later fixes had to enforce.

![Parent agent fans out to isolated child sessions with per-step deadlines, joins their results, and governs each child tool path](/assets/images/diagrams/june-foundations/delegated-graph-safeguards.svg)

If you haven't read the paper, here's the idea:

Instead of one agent trying to do everything, you build a **tree of agents**. A parent agent receives a task like "investigate this production outage," decomposes it into sub-goals ("check logs," "query metrics," "review recent deployments"), and delegates each to a specialized child agent.

Each child works independently, calls its own tools, and reports back. The parent synthesizes the results. The paper defines how goals get decomposed, how sub-agents execute, how control flow composes them (in sequence, in parallel, or with fallback, which tries another path when one fails), how agents share a working memory, and how they carry lessons forward via episodic memory (stored records of earlier attempts).

That design needs an execution graph: the runtime connects tasks, starts child sessions, waits for results, and decides what can run next. The failures below happened at those boundaries.

---

## Bug 1: Governance Bypass on Delegated Work (Critical)

**What happened:** Our agent runtime has a human-in-the-loop system — certain tools require human approval before executing. This worked in the single-agent path we tested.

When we added multi-step delegation via ReAcTree, the tools handed to delegated sub-agents were bound directly, without passing through the same approval layer the primary agent used. A sub-agent could execute a tool that should have required a human sign-off, without ever asking.

**Why it matters:** human-in-the-loop approval means a person must authorize selected actions before execution. The delegated path bypassed that check even though single-agent tests passed. Testing only the primary path did not cover this permission boundary.

**The fix:** every tool binding, regardless of which path it's reached through, now goes through the exact same governance wrapper. We turned this into a standing rule: never bind a tool without full governance wrapping, regardless of the delegation path that leads to it.

**The lesson:** approval, audit, and rate limits need to apply to every tool path. Include delegated and fallback execution in tests, not just the primary agent.

---

## Bug 2: Parallel Execution Wiring Panic (High)

**What happened:** When building a plan that ran several sub-agents simultaneously, the execution graph compiler panicked outright.

**Why it happened:** describing parallel execution as “run nodes concurrently” leaves graph wiring to the implementation. Our execution graph needed one entry point, parallel branches, and a join that collected their results. The compiler failed while connecting those nodes; no model output was involved.

**The fix:** each control-flow type — sequential, parallel, fallback — needed its own dedicated wiring logic rather than sharing one generic path.

**The lesson:** unit tests on individual components missed this entirely, because the bug only existed at the level of the *compiled, composed* graph. Unit tests on individual components did not exercise the graph wiring in this case. We added integration tests that compile and execute full plans end-to-end against a mock model.

---

## Bug 3: A Hung Multi-Step Plan (Medium)

**What happened:** A multi-step sequential plan hung indefinitely. One step waited on a model response that did not arrive, and the parent kept waiting. We could not determine from the hang alone whether the provider, network, or timeout propagation was responsible.

**Why it happened:** a single agent had a request timeout by default. A multi-step plan inherits the parent's overall context, but each step effectively starts its own model session. Without a timeout scoped to each individual step, one slow step could block the plan until the parent deadline, or indefinitely if that deadline was absent or not enforced by the model call.

**The fix:** every step now gets its own fixed time budget, independent of the others, in addition to an overall hard ceiling on the whole plan. A fixed per-step budget turned out to be simpler and more predictable than trying to divide up the parent's total time — dividing it up creates a pathological case where early steps eat their full allowance and leave the last step with almost nothing.

**The tradeoff:** bound each step and the whole run, and propagate cancellation to providers. A fixed step budget is predictable but can stop a legitimately slow step; choose it against expected task duration and expose timeout status to operators.

---

## Bug 4: Shared State Across Concurrent Sub-Agents (Medium)

**What happened:** Several parallel sub-agents ended up sharing state that should have been private to each of them. Under load, one agent's in-flight conversation got mixed up with another's.

**Why it happened:** our client tracked conversation history for multi-turn interactions even though a call site looked request-scoped. Sharing that client across concurrent sub-agents meant sharing conversation state too — a subtle bug that only shows up under real concurrency, not in a single-threaded test.

**The fix:** full per-request isolation. Every sub-agent gets its own fresh session, created when it starts and torn down when it finishes. This isn't just "thread-safe" in the narrow sense — it's complete logical isolation, not just safe concurrent access to shared state.

**The lesson:** if your agent framework supports concurrent agents, verify that model clients, conversation state, and tool registries are isolated *per agent*, not just safe to touch concurrently. "Thread-safe" and "logically isolated" are different properties, and this bug required logical isolation. We enforce it architecturally — a fresh session per sub-agent — rather than relying on careful locking.

---

## Bug 5: Unbounded Recursive Delegation (High)

**What happened:** A sub-agent decided to delegate its own work further, spawning a grandchild agent — which itself tried to delegate again. Without a depth limit, further delegation could continue consuming tokens and compute.

**Why it happens:** the model isn't malfunctioning here. If delegation is a tool available to it, and delegation looks like a reasonable strategy for the task at hand, the model may choose it again even when the operator did not intend a deeper plan.

**The fix:** we don't rely on filtering this out at runtime — we made it structurally impossible. Sub-agents are constructed with a tool set that simply doesn't include delegation tools in the first place. They're not told not to delegate; the capability doesn't exist for them. This enforces a depth limit of one delegated level in this design. Systems that need deeper delegation can instead enforce explicit depth and cost budgets.

**The lesson:** your agent's available tools *are* its action space. If a capability shouldn't be usable in a given context, don't make it available there — don't rely on a prompt instruction to suppress it. A structural restriction is much harder to route around than an instruction, because prompts alone do not remove a tool from the available action set.

---

## Bug 6: Failure Stored as an Unqualified Memory (Low)

**What happened:** A sub-agent failed a task, and the raw failure message got stored as if it were a normal memory. The next time a similar task came up, the agent retrieved that "experience" and concluded the underlying system was broken — without even attempting the task again.

**Why it matters:** a single failed attempt was retrieved as a general statement about the system. The stored record lacked the status and context needed to decide whether it applied to the next task.

**The fix:** we moved to status-aware memory with several quality gates working together — every stored experience carries an explicit status rather than being treated as unconditionally true, failures get distilled into a short lesson rather than stored as a raw error dump, each memory gets weighted by how important it's likely to be for future recall, and retrieval blends relevance, recency, and importance rather than surfacing everything indiscriminately. Older or less relevant entries receive lower retrieval priority; the weighting needs evaluation so an important old failure is not silently lost.

**The lesson:** memory systems for agents need the same data-quality discipline as a database. Storing failures with status and context is more useful than treating every failure as a lasting fact. Retrieval still needs to present uncertainty rather than make a final judgment on its own.

---

## What We Learned

These six bugs point to three checks worth making in other delegated runtimes:

### Pattern 1: Governance must be path-independent

Every tool execution — whether from a single agent, a plan step, a sub-agent, or a fallback branch — must pass through the same governance stack. The wrapper is the enforcement point, not a convention in the prompt.

### Pattern 2: Test the graph, not just the nodes

Unit testing individual components is necessary but not sufficient. Compile full execution plans, run them end-to-end against a mock model, and verify the results. Several of these bugs only existed at the level of the composed system.

### Pattern 3: Agent memory needs provenance, not just quality gates

Don't store everything blindly. But don't discard failures either — tag them, distill them, and let weighted retrieval surface what actually matters. A later run should be able to distinguish a previous failed attempt from evidence that the system is still broken.

---

## Current State

After fixing all six, our test suite — unit tests on individual pieces plus integration tests on fully compiled, composed plans — passes in our supported delegation modes: no delegation, sequential, and parallel. Parallel delegation suits independent evidence-gathering; sequential suits dependent steps with clear handoffs; no delegation avoids coordination overhead for simple tasks, though model and tool latency still dominate many runs.

---

## What's Next

In a future post, I'll cover Pensieve — our memory management system — and when retaining more history can make retrieval less useful.

---


*Have you implemented a research paper in production and found bugs the authors didn't mention? I'd love to hear your war stories. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*



---

I work on AI-assisted incident investigation at StackGen; project information is at [ai.stackgen.com](https://ai.stackgen.com).

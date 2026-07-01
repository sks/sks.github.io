---
layout: post
title: "Implementing ReAcTree — 6 Production Bugs the Paper Didn't Warn You About"
date: 2026-07-01
description: "What happens when you take an arXiv algorithm to production. We found 6 bugs that no paper mentions."
tags: [ai-agents, reactree, production, bugs, go]
---

Research papers show you algorithms. They don't show you the 6 production bugs you'll hit implementing them.

We implemented [ReAcTree](https://arxiv.org/abs/2511.02424) — a hierarchical agent decomposition algorithm — in our production agent runtime. ReAcTree lets a parent agent break complex tasks into sub-goals, assign them to child agents, and coordinate results using sequence, parallel, and fallback control flows.

The paper is elegant. The implementation taught us more about production agent systems than any paper could.

---

## What ReAcTree Does (The 2-Minute Version)

If you haven't read the paper, here's the idea:

Instead of one agent trying to do everything, you build a **tree of agents**. A parent agent receives a task like "investigate this production outage," decomposes it into sub-goals ("check logs," "query metrics," "review recent deployments"), and delegates each to a specialized child agent.

```
         Parent Agent
        /     |      \
   Check    Query    Review
   Logs    Metrics   Deploys
```

Each child works independently, calls its own tools, and reports back. The parent synthesizes the results.

The paper defines:
- **Expand** — decompose a goal into sub-goals
- **Execute** — run a sub-agent on a sub-goal
- **Control flow** — sequence (one after another), parallel (all at once), fallback (try A, if it fails try B)
- **Working memory** — shared blackboard for inter-agent communication
- **Episodic memory** — remember past experiences for future tasks

Simple on paper. Here's what happened in production.

---

## The Paper-to-Code Mapping

Before the bugs, let me show how we mapped paper concepts to code:

| Paper Concept | Code Realization |
|--------------|-----------------|
| Expand(f, [g₁...gₖ]) | `CreateAgentRequest` → `Plan` → `ExecutePlan()` |
| ExecCtrlFlowNode (Alg. 2) | `BuildSequence` / `BuildParallel` / `BuildFallback` |
| Working memory | Shared key-value blackboard across plan steps |
| Episodic memory | Retrieve-before-execute; store-on-success only |
| Action space Aₜ | Filter dangerous tools from sub-agents |

This mapping looked clean. Then we started running real tasks.

---

## Bug 1: HITL Bypass on Plan Steps (Critical 🔴)

**What happened:** Our agent runtime has a Human-in-the-Loop (HITL) system — certain tools (like `run_shell`) require human approval before executing. This works perfectly for single-agent mode.

When we added multi-step plans via ReAcTree, plan-step tools were bound directly from the registry **without passing through the HITL middleware**. A sub-agent could execute `run_shell` without approval.

**Why it's scary:** This is a security bug. The whole point of HITL is preventing unapproved actions. ReAcTree's delegation path bypassed it silently.

**The fix:** Every plan-step tool binding now uses the same `ToolWrapSvc` middleware chain as single delegation. We wrote it as a rule: **never bind tools without full middleware wrapping, regardless of the delegation path.**

```go
// Before (broken): tools bound without middleware
tools := registry.GetTools(toolNames)

// After (fixed): tools always go through the wrap chain
tools := toolWrapSvc.WrapTools(registry.GetTools(toolNames))
```

**The lesson for you:** If your agent framework has any governance layer (approval, audit, rate limits), verify it applies to **every** tool execution path — including dynamically compiled plans, sub-agents, and fallback branches.

---

## Bug 2: Parallel Graph Compilation Panic (High 🟠)

**What happened:** When building a parallel execution plan (3 sub-agents running simultaneously), the graph compiler panicked. The `SetEntryPoint` call conflicted with the parallel fan-out wiring.

**Why papers don't mention this:** Papers describe parallel execution as "run nodes concurrently." The implementation requires a directed acyclic graph with a single entry point that fans out to N parallel nodes and fans back in to a join node. Getting the entry/exit wiring right is a graph compilation problem, not an AI problem.

**The fix:** Flow-specific entry wiring — each control flow type (`BuildSequence`, `BuildParallel`, `BuildFallback`) handles its own graph topology.

**The lesson:** Unit tests missed this because they tested individual nodes, not the compiled graph. We added integration tests that compile and execute full plans with `FakeExpert` (a mock LLM). **If you only unit test agent components, you will miss graph-level bugs.**

---

## Bug 3: Hung Multi-Step Plans (Medium 🟡)

**What happened:** A 5-step sequential plan hung indefinitely. Step 3 was waiting for an LLM response that never came (network timeout, model overloaded). The parent agent waited forever.

**Why it's subtle:** Single-agent mode has a request timeout. Multi-step plans inherit the parent's context but each step starts its own LLM session. Without per-step timeouts, one slow step blocks the entire plan.

**The fix:** Plan timeout propagation — each step gets a timeout derived from the plan's total budget, with a 3-minute default per step:

```go
stepTimeout := plan.Timeout / time.Duration(len(plan.Steps))
if stepTimeout < 3*time.Minute {
    stepTimeout = 3 * time.Minute
}
```

**The lesson:** Timeout management in hierarchical systems is non-obvious. The parent's 10-minute timeout doesn't mean each of 5 steps gets 10 minutes — it means each gets 2 minutes. Scale timeouts with step count.

---

## Bug 4: Shared LLM Concurrency (Medium 🟡)

**What happened:** Three parallel sub-agents shared the same LLM client. Under load, requests interleaved and responses got mixed up. Agent A received Agent B's completion.

**Why it matters:** Most LLM client libraries are stateless per-request, but our client tracked conversation history for multi-turn interactions. Sharing a client across concurrent sub-agents meant shared conversation state.

**The fix:** Per-request isolation — each sub-agent gets its own LLM session. This is a documented contract now, not an implicit assumption.

**The lesson:** If your agent framework supports concurrent agents, verify that LLM clients, conversation state, and tool registries are isolated per-agent. "Thread-safe" doesn't mean "logically isolated."

---

## Bug 5: Recursive `create_agent` (High 🟠)

**What happened:** A sub-agent decided to delegate its work by calling `create_agent` itself — spawning a grandchild agent. That grandchild also called `create_agent`. We had unbounded recursive delegation eating tokens and compute.

**Why it happens:** The LLM sees `create_agent` in its tool list and decides delegation is the best approach. It's not wrong — it's doing exactly what we told it was possible.

**The fix:** Action-space filtering. Sub-agents have `create_agent` and `send_message` stripped from their tool list **before tools are bound**:

```go
// Strip meta-tools from sub-agent action space
subAgentTools = filterTools(parentTools, 
    "create_agent",   // prevent recursive delegation
    "send_message",   // prevent sub-agents messaging users directly
)
```

**The lesson:** Your agent's tool list is its action space. If a tool shouldn't be used in a particular context, **don't make it available** — don't rely on prompt instructions to prevent it. LLMs are creative problem-solvers; they will find ways to use every tool you give them.

---

## Bug 6: Polluted Episodic Memory (Low but Insidious 🟢)

**What happened:** A sub-agent failed its task. The error message — "connection refused: unable to reach API" — was stored as an episodic memory. The next time a similar task came up, the agent retrieved this "experience" and concluded the API was unreachable before even trying.

**Why it's insidious:** The agent appeared to be "learning from experience." It was actually learning from failures and applying them as permanent truths. This is worse than having no memory at all.

**The fix:** Success-gated episodic storage — only store memories when `nodeStatus == Success`:

```go
if result.Status == Success {
    episodicStore.Store(ctx, goal, result)
}
```

We also added confidence scoring — each result gets a 0.0-1.0 confidence score based on execution signals, and only results above a configurable threshold (default 0.5) are stored.

**The lesson:** Memory systems for agents need the same data quality discipline as databases. Garbage in, garbage out — except with agents, garbage out means the agent confidently acts on false memories.

---

## What We Learned

Six bugs. Three patterns:

### Pattern 1: Governance must be path-independent

Every tool execution — whether from a single agent, a plan step, a sub-agent, or a fallback branch — must pass through the same governance stack. No shortcuts.

### Pattern 2: Test the graph, not just the nodes

Unit testing individual components is necessary but not sufficient. Compile full plans, execute them end-to-end with mock LLMs, and verify the results. Our structural test suite (15 taxonomy-linked tests) catches regressions on all 6 bugs.

### Pattern 3: Agent memory needs quality gates

Don't store everything. Don't store failures as successes. Use confidence scoring, success gating, and importance scoring to curate what goes into long-term memory.

---

## Current State

After fixing all 6 bugs, our structural test suite passes at 100% on the taxonomy-linked tests. A 15-run end-to-end pilot (5 tasks × 3 delegation modes) achieved 100% task success:

| Metric | Flat (no delegation) | Sequence | Parallel |
|--------|---------------------|----------|----------|
| Task success | 100% | 100% | 100% |
| Mean tool calls | 10.2 | 19.2 | 16.4 |
| Mean wall clock (s) | 61.6 | 129.2 | 144.1 |

Parallel suits independent evidence gathering. Sequence suits dependent steps with clear handoffs. Flat is fastest for simple tasks.

---

## What's Next

In a future post, I'll cover Pensieve — our memory management system — and why "your agent remembers everything" is a bug, not a feature.

---

*Have you implemented a research paper in production and found bugs the authors didn't mention? I'd love to hear your war stories. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

---
layout: post
title: "Implementing ReAcTree — 6 Production Bugs the Paper Didn't Warn You About"
date: 2026-06-23 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 4
description: "What happens when you take an arXiv algorithm to production. We found 6 bugs that no paper mentions."
image: /assets/images/og-debug.png
tags: [ai-agents, reactree, production, bugs, go]
---

Research papers show you algorithms. They don't show you the production bugs you'll hit implementing them.

We implemented [ReAcTree](https://arxiv.org/abs/2511.02424) — a hierarchical agent decomposition algorithm — in our production agent runtime. ReAcTree lets a parent agent break complex tasks into sub-goals, assign them to child agents, and coordinate results using sequence, parallel, and fallback control flows.

The paper is elegant. The implementation taught us more about production agent systems than any paper could.

---

## What ReAcTree Does (The 2-Minute Version)

If you haven't read the paper, here's the idea:

Instead of one agent trying to do everything, you build a **tree of agents**. A parent agent receives a task like "investigate this production outage," decomposes it into sub-goals ("check logs," "query metrics," "review recent deployments"), and delegates each to a specialized child agent.

Each child works independently, calls its own tools, and reports back. The parent synthesizes the results. The paper defines how goals get decomposed, how sub-agents execute, how control flow composes them (in sequence, in parallel, or with fallback), how agents share a working memory, and how they carry lessons forward via episodic memory.

Simple on paper. Here's what happened in production.

---

## Bug 1: Governance Bypass on Delegated Work (Critical)

**What happened:** Our agent runtime has a human-in-the-loop system — certain tools require human approval before executing. This worked perfectly for a single agent acting alone.

When we added multi-step delegation via ReAcTree, the tools handed to delegated sub-agents were bound directly, without passing through the same approval layer the primary agent used. A sub-agent could execute a tool that should have required a human sign-off, without ever asking.

**Why it's scary:** this is a security bug, not a cosmetic one. The entire point of human-in-the-loop is preventing unapproved actions. The new delegation path bypassed it silently, and nothing in normal testing would have caught it — the single-agent path still worked exactly as designed.

**The fix:** every tool binding, regardless of which path it's reached through, now goes through the exact same governance wrapper. We turned this into a standing rule: never bind a tool without full governance wrapping, regardless of the delegation path that leads to it.

**The lesson for you:** if your agent framework has any governance layer — approval, audit, rate limits — verify it applies to *every* tool execution path, including dynamically compiled plans, sub-agents, and fallback branches. The path you didn't think to check is the one that gets exploited.

---

## Bug 2: Parallel Execution Wiring Panic (High)

**What happened:** When building a plan that ran several sub-agents simultaneously, the execution graph compiler panicked outright.

**Why papers don't mention this:** papers describe parallel execution as "run nodes concurrently." The implementation requires a graph with a single entry point that fans out to several parallel branches and fans back in cleanly. Getting that wiring right is a graph-compilation problem, not an AI problem, and it's exactly the kind of detail that doesn't survive the trip from paper to production code.

**The fix:** each control-flow type — sequential, parallel, fallback — needed its own dedicated wiring logic rather than sharing one generic path.

**The lesson:** unit tests on individual components missed this entirely, because the bug only existed at the level of the *compiled, composed* graph. If you only unit test agent components in isolation, you will miss graph-level bugs. We added integration tests that compile and execute full plans end-to-end against a mock model.

---

## Bug 3: A Hung Multi-Step Plan (Medium)

**What happened:** A multi-step sequential plan hung indefinitely. One step was waiting on a model response that never arrived — a network timeout, an overloaded provider — and the parent agent waited forever.

**Why it's subtle:** a single agent has a request timeout by default. A multi-step plan inherits the parent's overall context, but each step effectively starts its own model session. Without a timeout scoped to each individual step, one slow step blocks the entire plan indefinitely.

**The fix:** every step now gets its own fixed time budget, independent of the others, in addition to an overall hard ceiling on the whole plan. A fixed per-step budget turned out to be simpler and more predictable than trying to divide up the parent's total time — dividing it up creates a pathological case where early steps eat their full allowance and leave the last step with almost nothing.

**The lesson:** timeout management in hierarchical systems is non-obvious. Give every level of the hierarchy its own bounded budget rather than assuming the parent's timeout is enough.

---

## Bug 4: Shared State Across Concurrent Sub-Agents (Medium)

**What happened:** Several parallel sub-agents ended up sharing state that should have been private to each of them. Under load, one agent's in-flight conversation got mixed up with another's.

**Why it matters:** most client libraries look stateless per request, but ours tracked conversation history for multi-turn interactions. Sharing that client across concurrent sub-agents meant sharing conversation state too — a subtle bug that only shows up under real concurrency, not in a single-threaded test.

**The fix:** full per-request isolation. Every sub-agent gets its own fresh session, created when it starts and torn down when it finishes. This isn't just "thread-safe" in the narrow sense — it's complete logical isolation, not just safe concurrent access to shared state.

**The lesson:** if your agent framework supports concurrent agents, verify that model clients, conversation state, and tool registries are isolated *per agent*, not just safe to touch concurrently. "Thread-safe" and "logically isolated" are different properties, and only one of them prevents this bug. We enforce it architecturally — a fresh session per sub-agent — rather than relying on careful locking.

---

## Bug 5: Unbounded Recursive Delegation (High)

**What happened:** A sub-agent decided to delegate its own work further, spawning a grandchild agent — which itself tried to delegate again. Left unchecked, this is unbounded recursive delegation, burning tokens and compute with no natural floor.

**Why it happens:** the model isn't malfunctioning here. If delegation is a tool available to it, and delegation looks like a reasonable strategy for the task at hand, using it is a perfectly rational choice from the model's perspective.

**The fix:** we don't rely on filtering this out at runtime — we made it structurally impossible. Sub-agents are constructed with a tool set that simply doesn't include delegation tools in the first place. They're not told not to delegate; the capability doesn't exist for them. This gives a deliberate, hard depth limit on how far delegation can nest, enforced structurally rather than through a counter that could itself have a bug.

**The lesson:** your agent's available tools *are* its action space. If a capability shouldn't be usable in a given context, don't make it available there — don't rely on a prompt instruction to suppress it. A structural restriction is much harder to route around than an instruction, because a sufficiently capable model will find creative ways to use every tool you hand it.

---

## Bug 6: Memory Poisoned by Its Own Failures (Low but Insidious)

**What happened:** A sub-agent failed a task, and the raw failure message got stored as if it were a normal memory. The next time a similar task came up, the agent retrieved that "experience" and concluded the underlying system was broken — without even attempting the task again.

**Why it's insidious:** the agent looked like it was learning from experience. It was actually learning a false permanent conclusion from a single failure and treating it as ground truth going forward. That's worse than having no memory at all.

**The fix:** we moved to status-aware memory with several quality gates working together — every stored experience carries an explicit status rather than being treated as unconditionally true, failures get distilled into a short lesson rather than stored as a raw error dump, each memory gets weighted by how important it's likely to be for future recall, and retrieval blends relevance, recency, and importance rather than surfacing everything indiscriminately. Stale, low-value entries naturally fade out of that blend over time.

**The lesson:** memory systems for agents need the same data-quality discipline as a database. But the fix isn't "only store successes" — it's "store everything with context about what actually happened, and let retrieval do the judgment call."

---

## What We Learned

Six bugs. Three patterns that generalize well beyond this specific project:

### Pattern 1: Governance must be path-independent

Every tool execution — whether from a single agent, a plan step, a sub-agent, or a fallback branch — must pass through the same governance stack. No shortcuts, no "we'll wire this one up later."

### Pattern 2: Test the graph, not just the nodes

Unit testing individual components is necessary but not sufficient. Compile full execution plans, run them end-to-end against a mock model, and verify the results. Several of these bugs only existed at the level of the composed system.

### Pattern 3: Agent memory needs provenance, not just quality gates

Don't store everything blindly. But don't discard failures either — tag them, distill them, and let weighted retrieval surface what actually matters. The agent should learn from mistakes, not repeat them as unquestioned truth.

---

## Current State

After fixing all six, our test suite — unit tests on individual pieces plus integration tests on fully compiled, composed plans — passes reliably across every delegation mode we support: no delegation, sequential, and parallel. Parallel delegation suits independent evidence-gathering; sequential suits dependent steps with clear handoffs; no delegation is fastest for genuinely simple tasks.

---

## What's Next

In a future post, I'll cover Pensieve — our memory management system — and why "your agent remembers everything" is a bug, not a feature.

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

*Have you implemented a research paper in production and found bugs the authors didn't mention? I'd love to hear your war stories. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*



---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

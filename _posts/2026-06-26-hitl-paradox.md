---
layout: post
title: "The HITL Paradox — When Human Approval Makes Agents Worse"
date: 2026-06-26 10:00:00 -0700
series: "Building an AI Agent Platform in Go"
series_order: 7
description: "Human-in-the-loop is supposed to make agents safer. It can also make them useless. Here's how to find the balance."
tags: [hitl, ai-agents, ux, governance, production]
---

Human-in-the-loop (HITL) is supposed to make agents safer. Put a human between the agent and the dangerous action. Simple.

In practice, HITL has a paradox: **too much approval kills productivity, too little kills safety, and the wrong amount creates a false sense of security.**

We deployed HITL for our agent runtime and watched three failure modes emerge. Here's what happened and how we fixed each one.

---

## Failure Mode 1: Approval Fatigue

Our first HITL deployment required approval for every tool call. Shell commands, web searches, memory reads — everything needed a human click.

Within two days, operators were auto-approving everything without reading the details. The approval popup became muscle memory: see popup → click approve → continue.

We tracked how long operators spent on each approval. In the first week, they were actually reading — several seconds per request. By the second week, that had collapsed to a reflexive click. They weren't reviewing — they were dismissing.

**Why this is worse than no HITL:** Operators now believe they have a safety net. They don't. The safety net is a rubber stamp. But everyone — operators, managers, auditors — thinks the system is reviewed because "human approval is required."

### The Fix: Risk-Based Classification

We classified tools into three tiers instead of treating them all the same:

- **Auto-approve** — safe, read-only, or internal operations that don't touch external systems
- **Require approval** — anything that can modify external state (the default for tools not in the auto-approve list)
- **Hard deny** — blocked entirely, regardless of whether someone would approve them

An important subtlety: **governance operates at the tool boundary, not inside command strings.** Blocking a tool named `bash` prevents that tool from being invoked at all — it doesn't do substring matching against whatever command the model passes to a shell tool. String-level blocklisting on shell primitives (e.g., blocking "rm" as a substring) is fundamentally unsafe — any sufficiently creative model can bypass it via encoding tricks, variable interpolation, or aliasing. Instead, the approval gate sits at the **tool invocation boundary**: a shell tool as a whole requires human approval, and the human sees the full command in the approval request. If you need granular command-level control, the right approach is typed API clients with their own RBAC — not raw shell access with regex filters.

Only state-modifying tools require approval. Read-only operations auto-approve. Destructive capabilities hard-block regardless of approval.

**Result:** Approval volume dropped dramatically. Operators now see a handful of meaningful requests per task instead of a constant stream. Each request actually gets read.

---

## Failure Mode 2: The "Approve Everything" Escape Hatch

Some teams configured their agents to skip all approvals. They'd been burned by approval fatigue and decided HITL wasn't worth the friction.

This defeats the entire purpose of governance. An agent with blanket auto-approval can execute any tool without review — including shell commands on production servers.

### The Fix: Guardrails on the Guardrails

We added loud warnings when someone configures wildcard auto-approval — making it obvious that state-modifying tools will bypass review.

The real safeguard is the hard-deny list: even when auto-approval is set to "everything," tools on the deny list are still blocked. Teams that want minimal friction can use permissive auto-approval while keeping the most dangerous tool categories permanently denied. Fast workflow, hard gates on the worst operations.

---

## Failure Mode 3: Blocking on Approval Halts Everything

Early HITL was synchronous — the agent stopped working and waited for approval. If the operator was in a meeting, the agent sat idle for nearly an hour waiting for a click.

For a single approval, this is annoying. For a task requiring several approvals across different tools, the total wait time could exceed the task's useful lifetime.

### The Fix: Asynchronous Approval

HITL approval is now asynchronous:

1. Agent encounters a tool that requires approval
2. Stores the pending request with a time limit after which it expires
3. Sends a notification (Slack, web UI, or similar)
4. **Continues working on other parts of the task**
5. When approved, the tool executes and results flow back

The agent doesn't block. If it has parallel sub-tasks, it works on those while waiting. If there's nothing else to do, it waits — but the user sees a clear "waiting for approval" status, not a mysteriously silent agent.

**A note on state drift:** Asynchronous approval introduces a classic distributed systems risk — the environment may change between when the agent formulated the tool call and when a human approves it much later. We mitigate this with short approval TTLs (stale approvals auto-expire) and session-scoped caching that doesn't let long-deferred approvals execute against a drifted environment without the agent re-evaluating.

**Batch operations:** Operators can view multiple pending requests at once, grouped by tool type, and approve or reject in bulk. One important guardrail: bulk approval works well for **read-only investigation commands**. For state-modifying operations, each approval should be reviewed individually — otherwise you recreate the rubber-stamp problem at a higher abstraction level.

**What happens on rejection?** When a human rejects a tool call (with or without feedback), the agent receives the rejection as a tool error and can replan. If the human provided feedback (e.g., "use the staging cluster instead"), the agent sees it and can adjust. This gives operators a conversational override, not just a binary approve/deny gate.

---

## The Hidden Bug: HITL Bypass on Sub-Agents

This was a real security issue. When our agent delegated to sub-agents, the sub-agent's tools were bound without passing through the same approval layer the parent used.

A sub-agent could run a shell command without approval, even though the parent agent required it.

**Why it happened:** The sub-agent tool binding was written before HITL existed. When we added HITL, we wrapped the parent's tools but forgot the delegation path.

**The fix:** All tool binding — parent, sub-agent, plan-step, fallback — goes through the same governance middleware chain. One path. One stack. No exceptions.

**The lesson:** When you add a governance layer, you must audit every tool execution path. The path you forget is the one that gets exploited. (More detail in the [ReAcTree bugs post](/blog/reactree-bugs/).)

---

## What Good HITL Looks Like

After three iterations, here's the mental model:

| Tool type | Behavior | Why |
|-----------|----------|-----|
| Read-only | Auto-approve | No external blast radius |
| Informational | Auto-approve | Discovery and lookup only |
| State-modifying | Require approval | Human judgment for writes |
| Destructive | Hard deny | No approval can override |
| Internal memory writes | Exempt | Modifies agent state, not external systems |

**The exemption for memory writes** is important. Memory tools modify the agent's internal notes, not production servers. Requiring approval for every memory operation would trigger approval fatigue without adding safety — it's noise that drowns out real signals.

---

## Signals That Tell You HITL Is Broken

You don't need exact dashboards to know something's wrong. Watch for these patterns:

1. **Approval latency collapsing** — if operators go from reading to clicking in under a second, they're not reading
2. **Approval rate near 100%** — either the agent is perfect or nobody is paying attention
3. **Rejection rate near zero** — same problem from the other direction
4. **Time-to-abandon** — how long before someone configures blanket auto-approval out of frustration

Healthy HITL has meaningful friction on the requests that matter and near-zero friction on everything else.

---

## Lessons Learned

1. **Less approval is more safety.** Fewer, higher-signal approval requests get more attention than constant popups.

2. **Classify tools by risk, not by category.** Not all shell commands are dangerous. Reading pod status is not the same as deleting a namespace.

3. **Make approval asynchronous.** Synchronous blocking kills agent productivity and operator patience.

4. **Audit every tool path.** HITL that applies to most tool calls but misses one delegation route creates a false sense of security. The bypass path is where the risk lives.

5. **Memory tools are not external state.** Don't require approval for internal memory operations — it's noise that drowns out real signals.

---

*How does your team handle the approval fatigue problem? I'd love to hear about alternative approaches. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

---
layout: post
title: "The HITL Paradox — When Human Approval Makes Agents Worse"
date: 2026-07-01
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

**The data:** We tracked approval latency. In week 1, operators spent an average of 8 seconds reviewing each request. By week 2, it was under 2 seconds. They weren't reviewing — they were dismissing.

**Why this is worse than no HITL:** Operators now believe they have a safety net. They don't. The safety net is a rubber stamp. But everyone — operators, managers, auditors — thinks the system is reviewed because "human approval is required."

### The Fix: Risk-Based Classification

We classified tools into three tiers:

```toml
[hitl]
# Never needs approval — safe, read-only
always_allowed = ["web_search", "memory_*", "read_*", "discover_skills"]

# Needs approval — can modify state
# (This is the default for unlisted tools)

# Never allowed — blocked entirely
denied_tools = ["rm", "kubectl delete", "DROP"]
```

Only state-modifying tools require approval. Read-only operations auto-approve. Destructive operations hard-block regardless of approval.

**Result:** Approval requests dropped by 70%. Operators now see 3-5 requests per task instead of 20+. Each request is meaningful — they actually read them.

---

## Failure Mode 2: The `always_allowed = ["*"]` Escape Hatch

Some teams set `always_allowed = ["*"]` to skip all approvals. They'd been burned by approval fatigue and decided HITL wasn't worth the friction.

This defeats the entire purpose of governance. An agent with `always_allowed = ["*"]` can execute any tool without review — including shell commands on production servers.

### The Fix: Guardrails on the Guardrails

We added warnings when `always_allowed` contains wildcards:

```
⚠️ Warning: always_allowed contains "*" — all tools will bypass 
HITL approval. This includes run_shell, kubectl, and other 
state-modifying tools. Are you sure?
```

We also introduced **per-tool overrides** — even if `always_allowed = ["*"]`, specific tools can be forced to require approval:

```toml
[hitl]
always_allowed = ["*"]
force_approval = ["run_shell", "kubectl_apply", "scm_commit_and_pr"]
```

This gives teams the fast workflow they want while maintaining hard gates on the most dangerous operations.

---

## Failure Mode 3: Blocking on Approval Halts Everything

Early HITL was synchronous — the agent stopped working and waited for approval. If the operator was in a meeting, the agent sat idle for 45 minutes waiting for a click.

For a single approval, this is annoying. For a task requiring 5 approvals across different tools, the total wait time could exceed the task's useful lifetime.

### The Fix: Asynchronous Approval

HITL approval is now asynchronous:

1. Agent encounters a tool that requires approval
2. Stores the pending request in the database
3. Sends a notification (Slack, web UI, API)
4. **Continues working on other parts of the task**
5. When approved, the tool executes and results flow back

The agent doesn't block. If it has parallel sub-tasks, it works on those while waiting. If there's nothing else to do, it waits — but the user sees a clear "waiting for approval" status, not a mysteriously silent agent.

**Batch operations:** Operators can approve or reject multiple pending requests at once, grouped by tool name:

```
Pending approvals (3):
  [✅ Approve All] [❌ Reject All]
  
  🔧 run_shell: kubectl get pods -n production
  🔧 run_shell: kubectl describe pod api-server-7d8f
  🔧 run_shell: kubectl logs api-server-7d8f --tail=50
```

Three related shell commands for the same investigation — one click to approve all three.

---

## The Hidden Bug: HITL Bypass on Sub-Agents

This was a real security issue. When our agent delegated to sub-agents via ReAcTree, the sub-agent's tools were bound directly from the registry — **without the HITL middleware wrapper**.

A sub-agent could run `run_shell` without approval, even though the parent agent required it.

**Why it happened:** The sub-agent tool binding was written before HITL existed. When we added HITL, we wrapped the parent's tools but forgot the sub-agent delegation path.

**The fix:** All tool binding — parent, sub-agent, plan-step, fallback — goes through the same `ToolWrapSvc` middleware chain. One path. One governance stack. No exceptions.

**The lesson:** When you add a governance layer, you must audit every tool execution path. The path you forget is the one that gets exploited.

---

## What Good HITL Looks Like

After three iterations, here's our current model:

| Tool Type | Behavior | Example |
|-----------|----------|---------|
| Read-only | Auto-approve | `web_search`, `memory_search`, `read_file` |
| Informational | Auto-approve | `discover_skills`, `list_pods` |
| State-modifying | Require approval | `run_shell`, `commit_code`, `create_pr` |
| Destructive | Hard deny | `rm -rf`, `kubectl delete namespace`, `DROP TABLE` |
| Memory writes | Exempt (not state) | `memory_manage`, `note` |

**The exemption for memory writes** is important. Memory tools modify the agent's internal state, not external systems. Requiring approval for every `memory_manage` call would trigger approval fatigue without adding safety — the agent is only modifying its own notes.

---

## Metrics That Matter

Track these to know if your HITL system is working:

1. **Approval latency** — If it drops below 3 seconds, operators aren't reading requests
2. **Approval rate** — If it's above 95%, you're probably approving too aggressively
3. **Rejection rate** — If it's below 1%, either your agent is perfect or nobody is paying attention
4. **Time-to-abandon** — How long before operators set `always_allowed = ["*"]`

Our current numbers: ~6 second average approval latency, 88% approval rate, 7% rejection rate, 5% auto-expired (operator didn't respond in time).

---

## Lessons Learned

1. **Less approval is more safety.** Fewer, higher-signal approval requests get more attention than constant popups.

2. **Classify tools by risk, not by category.** Not all shell commands are dangerous. `kubectl get pods` is read-only; `kubectl delete pod` is not.

3. **Make approval asynchronous.** Synchronous blocking kills agent productivity and operator patience.

4. **Audit every tool path.** HITL that applies to 90% of tool calls creates a false sense of security. The 10% that bypasses it is where the risk lives.

5. **Memory tools are not external state.** Don't require approval for internal memory operations — it's noise that drowns out real signals.

---

*How does your team handle the approval fatigue problem? I'd love to hear about alternative approaches. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

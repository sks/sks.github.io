---
layout: post
title: "Pensieve — Memory Management for AI Agents That Actually Forget"
date: 2026-06-24 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 5
description: "Your agent remembers everything. That's a bug, not a feature. Here's how we built a memory system that learns, forgets, and self-prunes."
tags: [ai-agents, memory, rag, architecture, go]
---

Your agent remembers everything. That's a bug, not a feature.

We've all seen it: you give an agent a task, it retrieves 40 "relevant" context chunks from a vector store, stuffs them into a 128K context window, and produces a response that's technically accurate but practically useless — because 35 of those chunks were irrelevant, stale, or contradictory.

We built a memory system called Pensieve that handles this differently. Instead of "remember everything and search later," Pensieve manages **four distinct memory types**, with automatic decay, importance scoring, and self-pruning. This post walks through the problem, the design principles, and the production lessons — not the internals.

---

## Why Naive RAG Fails for Agents

RAG (Retrieval-Augmented Generation) works brilliantly for Q&A systems. You have a corpus of documents, you embed them, and you retrieve the most similar chunks for a user question.

Agents are different:

1. **Agents generate memories at runtime.** Every task produces new experiences — what worked, what failed, what the user corrected. The corpus grows with every interaction.

2. **Agent memories have temporal relevance.** "The staging API was down" was true yesterday. Retrieving it today makes the agent avoid an API that's working fine.

3. **Agent memories have quality variation.** Successful task completions, failed attempts, hallucinated outputs, and user corrections all go into the same store. Quality varies wildly.

4. **Agents need structured recall, not just similarity.** "What skills do I have for Kubernetes troubleshooting?" is a different retrieval mode than "find text similar to 'pod crashloopbackoff'."

Standard RAG treats all chunks equally — same embedding, same retrieval, same ranking. Agents need **curated, time-aware, quality-gated memory.**

---

## The Four Memory Types

Pensieve manages four distinct memory stores, each with a different lifecycle and a different reason to exist:

- **Working memory** — a session-scoped blackboard for the current task. Lives only as long as the task does.
- **Episodic memory** — goal-keyed experiences from past tasks, weighted toward relevance and recency, that naturally fade out over time.
- **Notes** — cross-session facts that don't decay, until someone (or the agent) deletes them.
- **Skills** — reusable procedures that persist until they're deprecated.

The split matters more than any single implementation detail: mixing a "what am I doing right now" blackboard with a "what happened last week" experience log with a "how do I do this" procedure store is how naive memory systems end up injecting stale, irrelevant, or contradictory context into every prompt.

### 1. Working Memory — The Session Blackboard

Working memory is a key-value store scoped to a single task execution. When a parent agent delegates to multiple sub-agents via ReAcTree, working memory is the shared blackboard:

```
Parent: "Investigate production outage"
  ├─ Sub-agent 1: writes working_memory["log_analysis"] = "OOM killer triggered at 14:32"
  ├─ Sub-agent 2: writes working_memory["metric_summary"] = "Memory usage spiked from 2GB to 8GB"
  └─ Parent reads both entries to synthesize RCA
```

Working memory dies when the task completes. It's not persisted. Think of it as function-scoped variables.

### 2. Episodic Memory — Experiences with Expiration Dates

Episodic memory stores **what happened during past tasks** — the goal, the approach, the outcome, and what was learned. It's the agent's autobiography.

The critical design choice: **not all episodes are worth remembering, and not every remembered episode should be trusted equally.**

We tag every stored episode with an explicit status — pending, success, or failure — and only promote an episode to "trusted success" after some form of validation (a user thumbs-up, a follow-up confirmation, whatever signal fits the product). Failures aren't discarded, but they aren't stored as raw error dumps either. A 50-line stack trace from a timeout doesn't belong in an agent's memory — it just pollutes future context. Instead, failures are distilled into a short, synthesized lesson before they're stored (more on this below).

*(In the [ReAcTree bugs post](/blog/reactree-bugs/), I mentioned that naively storing failures poisoned the agent. Status-aware storage is how we fixed it.)*

#### Retrieval Scoring

Episodic memories are ranked using a combination of three signals: how semantically relevant a memory is to the current task, how recent it is, and how important it was judged to be at the time.

**Why three signals instead of two?** With only recency and importance, you hit a structural problem: if recency dominates, *any* memory older than a few days gets outranked by a completely routine memory from the last hour — even a critical production incident. Weighting semantic relevance most heavily means the system surfaces memories that actually match the current situation first, and uses recency and importance as tiebreakers rather than the deciding factor. A week-old incident should still surface strongly when today's problem looks similar.

**Why this matters:** An agent that investigated an issue last week shouldn't treat that experience identically to investigating the same issue five minutes ago. But it also shouldn't forget a critical incident just because a routine check happened more recently. Blending relevance, recency, and importance — rather than picking one — is what makes both cases work.

#### Importance Scoring

When an episode is stored, a lightweight LLM call estimates how important it is likely to be for future recall — a hotfix deployed under time pressure scores very differently from a routine health check that came back clean. That score feeds into retrieval weighting above.

### 3. Notes — Cross-Session Persistence

Notes are simple key-value pairs that persist across sessions:

```
notes["user_preference_timezone"] = "US/Pacific"
notes["team_oncall_rotation"]     = "PagerDuty schedule ID: P123ABC"
notes["k8s_cluster_prod"]        = "us-east-1, EKS 1.31, 47 nodes"
```

Notes don't decay. They're for facts that change rarely and apply broadly. The agent manages its own notes — it can create, read, update, and delete them as tool calls.

### 4. Skills — Reusable Procedures

Skills are structured documents that describe **how to do something** — step-by-step procedures with failure handling:

```markdown
# Skill: Kubernetes Pod Crashloop Triage

## Steps
1. Get pod status: `kubectl get pods -n {namespace} | grep CrashLoopBackOff`
2. Check pod events: `kubectl describe pod {pod_name} -n {namespace}`
3. Read last 100 log lines: `kubectl logs {pod_name} -n {namespace} --tail=100`
4. Check resource limits vs actual usage
5. Check if recent deployments changed the image or config

## Common Causes
- OOM kills → check memory limits
- Missing config/secrets → check configmap/secret mounts
- Image pull failures → check registry access
```

Skills are stored on the filesystem and indexed in a vector store for semantic discovery. When an agent starts a task, it searches for relevant skills and loads them into context.

---

## The Self-Pruning Agent

Here's where it gets interesting. In most agent frameworks, you (the developer) manage memory — you decide what to store, what to retrieve, how much context to inject.

In Pensieve, the **agent manages its own memory budget.** It has tools to search past experiences, save or delete memories, read and write persistent notes, and discover and load relevant skills — the same operations a human operator would perform on a knowledge base, exposed to the agent itself.

The agent's system prompt includes instructions to manage its context proactively:

> *"Before starting work, search memory for relevant past experiences and available skills. If your context is getting large, offload resolved information to notes and prune completed sub-task context."*

**Why this works:** The agent knows what information it needs for the current step better than any static retrieval algorithm. By giving it memory management tools, we let it curate its own context window.

**Why this is risky:** An agent can delete useful memories or fail to store important ones. We mitigate this with audit logging — every memory operation is logged to an immutable audit trail, so we can reconstruct what happened. Sub-agents get a restricted view: they can read and search memory, but writes flow through the parent agent's middleware stack with the same governance controls as any other tool call.

---

## The Learning Loop

After every completed task, a background process evaluates whether the experience is novel and useful enough to distill into a reusable **skill** — and if something similar already exists, it either merges into that skill or skips entirely rather than creating a near-duplicate. This is **post-session skill distillation**. The agent doesn't learn during the task — it learns after, asynchronously, without blocking the user.

Example: an agent successfully triages a Redis connection storm for the first time. Because it hasn't handled anything like this before, and no similar skill already exists, the approach gets distilled into a documented procedure. Next time a Redis issue comes up, the agent finds this skill and follows it instead of improvising from scratch.

---

## Failure Learning

Successes teach you what to do. Failures teach you what to avoid. We capture both.

When an agent fails a task (timeout, too many errors, explicit failure status), a dedicated reflection step turns the raw failure into a short, plain-English lesson — what was attempted, what went wrong, and what to try differently next time — rather than storing the raw error trace verbatim.

These reflections are stored as episodic memories, clearly marked as failures. When the agent encounters a similar task, it retrieves both successful experiences and past failures side by side, so it sees what worked *and* what didn't — inspired by [Reflexion](https://arxiv.org/abs/2303.11366): verbal reinforcement without weight updates.

---

## Daily Wisdom Consolidation

Individual episodic memories accumulate. Over time, retrieving them all is expensive and noisy.

Once a day, a background job reads recent episodes and summarizes them into a short list of standing lessons — the kind of thing a human on-call engineer would jot in a shared runbook after a rough week. Those lessons get injected into the agent's prompt going forward, capped to a small, recent window so the summary doesn't grow without bound. The individual episodes it summarized are then cleared out, so the raw memory store stays lean and the distilled wisdom does the work instead.

---

## The PII Problem

Agent memories contain user conversations, tool outputs, API responses — all potentially containing PII (names, emails, IP addresses, tokens).

We run PII redaction **before** persisting any memory — every write path strips emails, bearer tokens, API keys, and similar sensitive patterns before the content ever reaches storage.

There's a domain-specific tension here: our product is an SRE copilot, and in SRE contexts, IP addresses and hostnames are critical telemetry. If the agent remembers "the outage was caused by a rogue pod on node [REDACTED]," the memory is functionally useless for future debugging. We handle this by treating internal, non-routable addresses differently from external ones, and by consistently tokenizing anything sensitive so the same value always maps to the same placeholder — the agent can still learn network topology patterns without ever storing the regulated PII itself.

---

## Lessons Learned

1. **Memory is a data quality problem.** Treat it like a database — validate before insert, enforce schema, handle duplicates.

2. **Temporal decay is essential.** Agents operate in changing environments. Yesterday's truths can be today's hallucinations.

3. **Let agents manage their own context.** Static retrieval algorithms can't know what the agent needs at each step. Give it memory tools and let it curate.

4. **Separate memory types for different lifetimes.** Working memory (seconds), episodic (weeks), notes (permanent), skills (permanent until deprecated). Mixing lifetimes causes stale context pollution.

5. **Failure memories are as valuable as success memories** — but they must be clearly labeled. An agent should learn "don't do X" without concluding "X is impossible."

6. **PII redaction is non-negotiable.** Agents process sensitive data. Memory stores are search targets. Unredacted PII in a vector store is a compliance incident waiting to happen.

**Acknowledgments.** [Nikhil Pavan Kanaka](https://www.linkedin.com/in/nkanaka/) contributed substantially to episodic memory in the agent runtime.

---

## Where This Differs From Off-the-Shelf Memory

Most memory approaches you'll find in open-source agent frameworks pick one axis and optimize it — a single chunk store, a generic checkpointer, or a centralized session store. Few combine temporal decay, quality gating, failure-aware learning, and agent-managed self-pruning into one system. That combination — not any single technique — is what makes Pensieve behave differently from "vector search with extra steps."

---

*How does your agent handle memory? I'm especially interested in approaches to temporal decay and memory quality. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

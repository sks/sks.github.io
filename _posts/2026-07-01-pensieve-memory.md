---
layout: post
title: "Pensieve — Memory Management for AI Agents That Actually Forget"
date: 2026-07-01
description: "Your agent remembers everything. That's a bug, not a feature. Here's how we built a memory system that learns, forgets, and self-prunes."
tags: [ai-agents, memory, rag, architecture, go]
---

Your agent remembers everything. That's a bug, not a feature.

We've all seen it: you give an agent a task, it retrieves 40 "relevant" context chunks from a vector store, stuffs them into a 128K context window, and produces a response that's technically accurate but practically useless — because 35 of those chunks were irrelevant, stale, or contradictory.

We built a memory system called Pensieve that handles this differently. Instead of "remember everything and search later," Pensieve manages **four distinct memory types**, with automatic decay, importance scoring, and self-pruning. This post walks through the architecture, the algorithms, and the production lessons.

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

Pensieve manages four distinct memory stores, each with different lifecycle and retrieval semantics:

```
┌──────────────────────────────────────────────────────────┐
│                     Agent Memory                         │
├──────────────┬──────────────┬──────────┬─────────────────┤
│   Working    │   Episodic   │  Notes   │    Skills       │
│   Memory     │   Memory     │          │                 │
├──────────────┼──────────────┼──────────┼─────────────────┤
│ Session      │ Goal-keyed   │ Cross-   │ Reusable        │
│ blackboard   │ experiences  │ session  │ procedures      │
│              │              │ facts    │                 │
├──────────────┼──────────────┼──────────┼─────────────────┤
│ Lifetime:    │ Lifetime:    │ Lifetime:│ Lifetime:       │
│ Single task  │ Decays over  │ Until    │ Until           │
│              │ ~2 weeks     │ deleted  │ deprecated      │
├──────────────┼──────────────┼──────────┼─────────────────┤
│ No embedding │ Vector +     │ Key-     │ Semantic        │
│ (key-value)  │ weighted     │ value    │ search          │
│              │ retrieval    │ lookup   │                 │
└──────────────┴──────────────┴──────────┴─────────────────┘
```

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

The critical design choice: **not all episodes are worth remembering.**

```go
// Only store episodes from successful task completions
if result.Status == Success && result.Confidence >= 0.5 {
    episodicStore.Store(ctx, StoreRequest{
        Goal:       task.Goal,
        Approach:   task.ToolsUsed,
        Outcome:    result.Summary,
        Confidence: result.Confidence,
    })
}
```

This is **success-gated storage**. Failed tasks, hallucinated outputs, and low-confidence results don't pollute the memory. (We learned this the hard way — see the [ReAcTree bugs post](/blog/2026/07/01/reactree-bugs/) for the full story.)

#### Recency-Weighted Retrieval

Episodic memories fade over time. We use exponential decay:

```
score = recency_weight × importance_weight

recency_weight = e^(-0.01 × hours_since_created)
importance_weight = importance_score / 10
```

A memory from 1 hour ago has a recency weight of ~0.99. A memory from 1 week (168 hours) ago has a weight of ~0.19. After ~2 weeks, memories effectively disappear from retrieval without being deleted.

**Why this matters:** An agent that investigated a DNS issue last week shouldn't treat that experience the same as investigating the same issue 5 minutes ago. Recency decay handles this automatically.

#### Importance Scoring

Not all memories are equally important. When an episode is stored, a lightweight LLM call scores it 1-10:

```
"Deployed a hotfix to production under time pressure" → 9/10
"Ran a routine health check, everything was green"   → 2/10
```

Final retrieval score combines both:

```
total_score = 0.6 × recency + 0.4 × importance
```

This means a moderately old but critical memory (e.g., a production incident) can outrank a very recent but routine task.

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

In Pensieve, the **agent manages its own memory budget.** It has memory management tools:

| Tool | Purpose |
|------|---------|
| `memory_search` | Semantic search across episodic memories |
| `memory_manage` | Save, update, or delete memories |
| `note` | Read or write persistent notes |
| `read_notes` | List all notes |
| `discover_skills` | Search for relevant skills |
| `load_skill` | Load a skill into working context |

The agent's system prompt includes instructions to manage its context proactively:

> *"Before starting work, search memory for relevant past experiences and available skills. If your context is getting large, offload resolved information to notes and prune completed sub-task context."*

**Why this works:** The agent knows what information it needs for the current step better than any static retrieval algorithm. By giving it memory management tools, we let it curate its own context window.

**Why this is risky:** An agent can delete useful memories or fail to store important ones. We mitigate this with audit logging — every memory operation is logged to an immutable audit trail, so we can reconstruct what happened.

---

## The Learning Loop

After every completed task, a background process evaluates whether the experience is worth remembering as a reusable **skill**:

```
Task completes
  → Novelty scoring (LLM rates 1-10)
  → If novelty ≥ 7:
      → Distill into structured skill document
      → Semantic dedup check (similarity ≥ 0.8 → merge or skip)
      → Store to filesystem + vector index
```

This is **post-session skill distillation**. The agent doesn't learn during the task — it learns after, asynchronously, without blocking the user.

Example: An agent successfully triages a Redis connection storm for the first time. The learning loop:

1. Scores it 8/10 novelty (agent hasn't handled Redis issues before)
2. Distills the approach into a skill document
3. Checks if a similar skill exists (none found)
4. Stores it as `dynamic_skills/redis_connection_storm_triage.md`

Next time a Redis issue comes up, the agent finds this skill via `discover_skills` and follows the documented procedure.

---

## Failure Learning

Successes teach you what to do. Failures teach you what to avoid. We capture both.

When an agent fails a task (timeout, too many errors, explicit failure status), a `FailureReflector` generates a verbal reflection:

```
Goal: "Scale the production database replica set"
Status: Failed
Reflection: "Attempted to modify replica count without checking 
if the cluster was in maintenance mode. The API returned 403 
Forbidden. Next time, verify cluster status before making 
scaling changes."
```

These failure reflections are stored as episodic memories with a ⚠️ prefix. When the agent encounters a similar task, it retrieves both successful experiences and past failures:

```
## Relevant Experience
✅ Successfully scaled Redis cluster by updating replica count 
   after confirming maintenance window (2 days ago)

⚠️ Failed to scale database replica set — didn't check 
   maintenance mode first, got 403 (5 days ago)
```

The agent sees what worked **and** what didn't. This is inspired by [Reflexion](https://arxiv.org/abs/2303.11366) — verbal reinforcement without weight updates.

---

## Daily Wisdom Consolidation

Individual episodic memories accumulate. Over time, retrieving them all is expensive and noisy.

Once per day, an `EpisodeConsolidator` reads recent episodes and summarizes them into **wisdom notes** — concise bullet-point lessons:

```markdown
## Consolidated Lessons (July 1, 2026)

- When scaling database replicas, always check cluster 
  maintenance mode status first (learned from failed attempt)
- Redis connection storms usually indicate connection pool 
  exhaustion in the application, not Redis server issues
- PagerDuty incident creation requires the service_id field; 
  use the pd_service_list tool to find it first
```

Wisdom notes are injected into the agent's system prompt as a `## Consolidated Lessons` section. They provide distilled experience without the noise of individual episodes.

---

## The PII Problem

Agent memories contain user conversations, tool outputs, API responses — all potentially containing PII (names, emails, IP addresses, tokens).

We run PII redaction **before** persisting any memory:

```go
// All memory storage goes through PII redaction
func (s *Store) Save(ctx context.Context, req SaveRequest) error {
    req.Content = pii.Redact(req.Content)
    req.Goal = pii.Redact(req.Goal)
    return s.backend.Save(ctx, req)
}
```

The `pii.Redact()` function strips emails, IPs, bearer tokens, API keys, and other sensitive patterns. Memories are useful for learning procedures, not for remembering `john.doe@company.com`'s password.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│ Agent Prompt                                         │
│   ├── Consolidated wisdom (injected automatically)   │
│   ├── Episodic memories (retrieved per-goal)         │
│   ├── Skills (loaded on demand)                      │
│   └── Notes (read via tool call)                     │
├─────────────────────────────────────────────────────┤
│ Memory Management Tools                              │
│   memory_search, memory_manage, note,                │
│   discover_skills, load_skill                        │
├─────────────────────────────────────────────────────┤
│ Storage Layer                                        │
│   ├── Vector store (Qdrant) — embeddings             │
│   ├── Filesystem — skills, notes                     │
│   └── PII redaction — applied before persist         │
├─────────────────────────────────────────────────────┤
│ Background Processes                                 │
│   ├── Learning loop — skill distillation             │
│   ├── Wisdom consolidation — daily digest            │
│   └── Memory decay — exponential time-based          │
└─────────────────────────────────────────────────────┘
```

---

## Lessons Learned

1. **Memory is a data quality problem.** Treat it like a database — validate before insert, enforce schema, handle duplicates.

2. **Temporal decay is essential.** Agents operate in changing environments. Yesterday's truths can be today's hallucinations.

3. **Let agents manage their own context.** Static retrieval algorithms can't know what the agent needs at each step. Give it memory tools and let it curate.

4. **Separate memory types for different lifetimes.** Working memory (seconds), episodic (weeks), notes (permanent), skills (permanent until deprecated). Mixing lifetimes causes stale context pollution.

5. **Failure memories are as valuable as success memories** — but they must be clearly labeled. An agent should learn "don't do X" without concluding "X is impossible."

6. **PII redaction is non-negotiable.** Agents process sensitive data. Memory stores are search targets. Unredacted PII in a vector store is a compliance incident waiting to happen.

---

## The Comparison

| Feature | Standard RAG | LangGraph Memory | Mem0 | Pensieve |
|---------|-------------|-----------------|------|----------|
| Memory types | 1 (chunks) | 2 (short/long-term) | Centralized | **4 (working, episodic, notes, skills)** |
| Temporal decay | None | None | None | **Exponential (configurable)** |
| Quality gates | None | None | None | **Success + confidence gating** |
| Failure learning | None | None | None | **Reflexion-style reflections** |
| Self-pruning | None | None | None | **Agent-managed via tools** |
| Skill distillation | None | None | None | **Post-session, novelty-gated** |
| PII redaction | Manual | Manual | Manual | **Automatic before persist** |

---

*How does your agent handle memory? I'm especially interested in approaches to temporal decay and memory quality. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

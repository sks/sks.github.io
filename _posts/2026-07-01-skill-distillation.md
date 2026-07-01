---
layout: post
title: "Teaching Agents to Learn Without Fine-Tuning"
date: 2026-07-01 06:00:00 -0700
series: "Building an AI Agent Platform in Go"
series_order: 6
description: "Post-session skill distillation from agent traces — how we teach agents to write their own runbooks."
tags: [ai-agents, learning, skills, llm, architecture]
---

We don't fine-tune models. We teach agents to write their own runbooks.

Most approaches to making agents "learn" involve fine-tuning — adjusting model weights based on past interactions. This works, but it's opaque (you can't inspect what was learned), irreversible (you can't selectively forget), and expensive (requires GPU time and careful dataset curation).

We took a different approach: **post-session skill distillation**. After every completed task, the agent evaluates whether the experience was novel enough to codify as a reusable skill. If it was, it generates a structured runbook — inspectable, editable, revocable, and version-controlled.

---

## The Learning Pipeline

```
Task completes successfully
  │
  ▼
Novelty Scoring (LLM rates 1-10)
  │
  ├─ Score < 7: Skip — routine task, nothing new
  │
  ▼
Skill Distillation (LLM extracts procedure)
  │
  ▼
Semantic Dedup Check (similarity ≥ 0.8?)
  │
  ├─ Yes: Merge with existing skill or skip
  │
  ▼
Dual Persist
  ├─ Filesystem: ~/.agent/dynamic_skills/redis_triage.md
  └─ Vector Store: indexed for semantic discovery
```

### Step 1: Novelty Gate

Not every task is worth learning from. Routine health checks, simple Q&A, and repetitive operations don't produce new knowledge. We use a lightweight LLM call to score novelty:

```
Task: "Triaged a Redis connection storm caused by connection pool exhaustion"
Novelty: 8/10 — Agent hasn't handled Redis connection pool issues before

Task: "Checked pod status in production namespace"
Novelty: 2/10 — Routine kubectl operation, done dozens of times
```

Only tasks scoring ≥ 7 proceed to distillation. This threshold is configurable — set it lower for agents that are still learning their domain, higher for mature agents.

### Step 2: Skill Distillation

The LLM receives the full task context — goal, tools used, tool outputs, final result — and generates a structured skill document:

```markdown
# Skill: Redis Connection Storm Triage

## Context
Use when: Redis connection errors spike, application-level 
connection timeouts, or monitoring alerts for Redis connection count.

## Steps
1. Check Redis connection count: `redis-cli info clients`
2. Identify top connection consumers by application
3. Check application connection pool settings (max connections, 
   idle timeout, connection lifetime)
4. Verify if connection pool exhaustion matches the timeline
5. If confirmed: adjust pool settings and redeploy affected services
6. If not: escalate to Redis cluster investigation

## Failure Lessons
- Don't restart Redis first — it masks the root cause
- Connection pool defaults (usually 10-25) are too low for 
  high-throughput services
```

### Step 3: Semantic Deduplication

Before storing, we check if a similar skill already exists. If semantic similarity ≥ 0.8, we either merge the new insights into the existing skill or skip storage entirely.

This prevents the agent from generating 15 variations of "how to check pod logs" over time.

### Step 4: Dual Persistence

Skills are stored in two places:
- **Filesystem** (`~/.agent/<agent_name>/dynamic_skills/`) — human-readable, version-controllable, editable
- **Vector store** — indexed for semantic discovery via `discover_skills`

The filesystem is the source of truth. The vector index is rebuilt from disk on startup.

---

## How Skills Are Used

When an agent receives a new task, the orchestrator searches for relevant skills **before starting work**:

```
User: "We're seeing Redis connection errors in production"

Orchestrator: 
  1. discover_skills("redis connection errors production")
  2. Found: "Redis Connection Storm Triage" (similarity: 0.89)
  3. load_skill("redis_connection_storm_triage")
  4. Injects skill steps into sub-agent's context
  5. Sub-agent follows the documented procedure
```

The agent isn't improvising — it's following a procedure it wrote from its own experience. And because the skill is a markdown file, a human can review, edit, or delete it.

---

## Why Not Fine-Tuning?

| Property | Fine-Tuning | Skill Distillation |
|----------|------------|-------------------|
| Inspectable | ❌ Weight changes are opaque | ✅ Markdown files on disk |
| Editable | ❌ Can't edit specific knowledge | ✅ Edit the `.md` file |
| Revocable | ❌ Can't selectively forget | ✅ Delete the file |
| Auditable | ❌ What was learned when? | ✅ Git history + audit log |
| Cost | 💰 GPU time, dataset curation | 💲 One LLM call per novel task |
| Latency | Hours (training) | Seconds (generation) |
| Portable | ❌ Model-specific | ✅ Works with any LLM |

The key advantage: **skill files are debuggable**. When an agent does something wrong, you can trace it to a specific skill, read the procedure, and fix it. With fine-tuning, you're guessing which training example caused the behavior.

---

## The Audit Trail

Every learning decision is logged:

```jsonl
{"event":"learning_started","goal":"Triage Redis connection storm","timestamp":"..."}
{"event":"novelty_scored","score":8,"reason":"First Redis pool exhaustion case","timestamp":"..."}
{"event":"skill_created","skill":"redis_connection_storm_triage","path":"dynamic_skills/...","timestamp":"..."}
```

```jsonl
{"event":"learning_started","goal":"Check pod status","timestamp":"..."}
{"event":"learning_skipped","score":2,"reason":"Routine kubectl operation","timestamp":"..."}
```

Full observability into what the agent is learning, what it's skipping, and why.

---

## Edge Cases We Hit

### The "always novel" agent

A freshly deployed agent scored everything as novel (≥7) because it had no prior experience. It generated 30 skills in its first day, many of which were trivial.

**Fix:** We added a warm-up period where the novelty threshold is temporarily set to 9, then decays to the configured value over the first week.

### Skill drift

An agent learned a procedure for an API that later changed its endpoint. The skill became wrong, and the agent kept following it.

**Fix:** Skills include a `last_verified` timestamp. If a skill hasn't been successfully used in 30 days, it's flagged for human review. We're also exploring automatic re-validation.

### Cross-agent skill contamination

Two agents with different roles (SRE and security analyst) shared a vector store. The security agent's skills polluted the SRE agent's discovery results.

**Fix:** Skills are namespaced by `agent_name`. Each agent's vector store collection is isolated: `skills_{agent_name}`.

---

## Lessons Learned

1. **Learning happens after the task, not during.** Don't slow down the user's workflow with background analysis. Distill asynchronously.

2. **Quality gates prevent garbage skills.** Novelty scoring + semantic dedup + success gating keep the skill store clean.

3. **Inspectable > opaque.** If you can't read what the agent learned, you can't trust it. Markdown files beat weight updates.

4. **Namespace everything.** Agent memory, skills, and vector stores must be isolated per agent. Cross-contamination is a production risk.

5. **Skills have a lifecycle.** They're created, used, updated, and eventually deprecated. Treat them like code, not like permanent truths.

---

*How do you handle agent learning in your system? I'm especially curious about approaches to skill quality and lifecycle management. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

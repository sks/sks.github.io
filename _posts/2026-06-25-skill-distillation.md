---
layout: post
title: "Teaching Agents to Learn Without Fine-Tuning"
date: 2026-06-25 10:00:00 -0700
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
Semantic Dedup Search (find existing similar skills)
  │
  ▼
Single LLM Call: Novelty + Distillation
  │ (existing skills passed as context)
  │
  ├─ should_create: false → Skip — routine task or duplicate
  │
  ├─ update_existing: "skill-name" → Update existing skill in-place
  │
  ▼
Dual Persist
  ├─ Filesystem: ~/.agent/<agent_name>/dynamic_skills/redis-triage.md
  └─ Vector Store: indexed for semantic discovery
```

### Step 1: Semantic Dedup Search

Before calling the LLM, we search the vector store for existing skills that are semantically similar to the current goal. Any skills with similarity ≥ 0.8 are retrieved and passed as context to the distillation call. This is critical — it lets the LLM decide whether this task adds genuinely new knowledge, should update an existing skill, or should be skipped entirely.

### Step 2: Novelty + Distillation (Single LLM Call)

Here's an important design choice: **novelty scoring and skill distillation happen in one LLM call, not two.** The model receives the full task context — goal, tools used, tool execution trace, final result — plus any existing similar skills from the dedup search. It returns a single JSON object:

```json
{
  "should_create": true,
  "novelty_score": 8,
  "name": "redis-connection-storm-triage",
  "description": "Triage Redis connection storms caused by pool exhaustion",
  "instructions": "...(full markdown)...",
  "update_existing": ""
}
```

If `novelty_score` is below the threshold (default: 7, configurable), the skill is discarded even if the LLM generated content. If `update_existing` references an existing skill name, the system updates that skill in-place instead of creating a duplicate.

Why one call instead of two? A separate novelty-scoring call would cost tokens and add latency for every completed task, including the 80%+ that are routine. By combining evaluation and generation, routine tasks are rejected at near-zero marginal cost — the LLM just returns `{"should_create": false, "novelty_score": 2, ...}`.

### Skill Format

Distilled skills follow a structured four-section format:

```markdown
# redis-connection-storm-triage

## What it can do
Triages Redis connection storms caused by connection pool exhaustion,
identifies the root cause, and recommends remediation steps.

## How it did it
1. Checked Redis connection count via `redis-cli info clients`
2. Identified top connection consumers by application label
3. Inspected application connection pool settings (max connections,
   idle timeout, connection lifetime)
4. Correlated pool exhaustion timeline with alert timestamps
5. Adjusted pool settings and triggered rolling redeploy

## What worked
- Checking pool settings BEFORE restarting Redis preserved the evidence
- Correlating timestamps narrowed the root cause within minutes

## What did not work
- Restarting Redis first — it masked the root cause and the
  storm recurred within 20 minutes
- Default pool sizes (10-25) were too low for the workload
```

The "What did not work" section is especially valuable — it encodes failure lessons from the tool execution trace so future agents avoid the same dead ends.

### Semantic Deduplication

The dedup search in Step 1 prevents skill sprawl. If existing skills with similarity ≥ 0.8 are found, they're passed directly to the distillation LLM as context. The LLM then decides:

- **Create new skill** — the task is sufficiently different
- **Update existing skill** — the task adds new insights to an existing procedure (via `update_existing`)
- **Skip entirely** — the existing skill already covers this case

This prevents the agent from generating 15 variations of "how to check pod logs" over time, and lets existing skills evolve as the agent encounters new edge cases.

### Dual Persistence

Skills are stored in two places:
- **Filesystem** (`~/.agent/<agent_name>/dynamic_skills/`) — human-readable, version-controllable, editable
- **Vector store** — indexed for semantic discovery via `search_skill`, with metadata tagging (`type: learned_skill`)

The filesystem is the source of truth. Skills include `created_at` and `updated_at` timestamps embedded as HTML comments, so you can trace when a skill was first learned and when it was last refined.

---

## How Skills Are Used

Skill recall happens at **two levels** — the orchestrator and the sub-agent:

**Orchestrator-level (automatic):** Before any task reaches a sub-agent, the orchestrator searches the vector store for learned skills matching the user's question. Matching skills are loaded from disk and injected into the orchestrator's context as a `## Relevant Learned Skills` section, with a relevance confidence label ("high" for similarity ≥ 0.85, "moderate" otherwise). The orchestrator then passes the relevant skill instructions through to sub-agents via their goal text.

**Sub-agent-level (on-demand):** Every sub-agent has `search_skill` and `load_skill` tools in its toolkit. If the orchestrator's pre-matching didn't surface a relevant skill, or if the sub-agent encounters a subtask mid-execution, it can search and load skills on its own:

```
Sub-agent receives goal: "Triage Redis connection errors in production"
  │
  ▼ (skill hint injected by orchestrator)
"Relevant Skills for This Task: redis-connection-storm-triage"
  │
  ▼
load_skill("redis-connection-storm-triage")
  │
  ▼
Follows the documented procedure step-by-step
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
{"actor":"learner","action":"learning_started","goal_preview":"Triage Redis connection storm","tools_used":5}
{"actor":"learner","action":"skill_created","skill_name":"redis-connection-storm-triage","novelty_score":8}
{"actor":"learner","action":"skill_indexed_in_vector_store","skill_name":"redis-connection-storm-triage"}
```

```jsonl
{"actor":"learner","action":"learning_started","goal_preview":"Check pod status"}
{"actor":"learner","action":"learning_skipped","reason":"below_novelty_threshold","novelty_score":2,"threshold":7}
```

Full observability into what the agent is learning, what it's skipping, and why.

---

## Edge Cases We Hit

### The "always novel" agent

A freshly deployed agent scored everything as novel (≥7) because it had no prior experience. It generated dozens of skills in its first few days, many of which were trivial.

**Fix:** For freshly deployed agents, we set the `minimum_novelty_score` to 9 in the agent's config. As the agent accumulates skills and the semantic dedup starts catching routine patterns, we lower the threshold to the default 7. This is a manual config knob, not an automatic decay — we found that automatic decay introduced a hard-to-debug edge case where the threshold would drift to different values across agent replicas.

### Skill drift

An agent learned a procedure for an API that later changed its endpoint. The skill became wrong, and the agent kept following it.

**Fix:** Skills carry `created_at` and `updated_at` timestamps. We're building toward automatic staleness detection — flagging skills that haven't been updated in 30+ days for human review. For now, the pragmatic mitigation is that stale skills tend to fail when followed, which surfaces them in the audit log as `learning_failed` events that operators can investigate.

### Cross-agent skill contamination

Two agents with different roles (SRE and security analyst) shared a vector store. The security agent's skills polluted the SRE agent's discovery results.

**Fix:** Skills are scoped via metadata filtering in the vector store. Each agent's skill search includes agent-specific metadata tags so results are isolated even in a shared collection. The filesystem path is already namespaced by agent name (`~/.agent/<agent_name>/dynamic_skills/`), so the dual-persistence model naturally prevents cross-contamination at the file level.

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

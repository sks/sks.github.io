---
layout: post
title: "Teaching Agents to Learn Without Fine-Tuning"
date: 2026-06-25 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 6
description: "Post-session skill distillation from agent traces — how we teach agents to write their own runbooks."
image: /assets/images/og-memory.png
tags: [ai-agents, learning, skills, llm, architecture]
---

We don't fine-tune models. We teach agents to write their own runbooks.

Most approaches to making agents "learn" involve fine-tuning — adjusting model weights based on past interactions. This works, but it's opaque (you can't inspect what was learned), irreversible (you can't selectively forget), and expensive (requires GPU time and careful dataset curation).

We took a different approach: **post-session skill distillation**. After every completed task, the agent evaluates whether the experience was novel enough to codify as a reusable skill. If it was, it generates a structured runbook — inspectable, editable, revocable, and version-controlled.

---

## The Idea, at a High Level

After a task finishes, the agent checks whether it already has something similar in its skill library. If it does, and the new experience doesn't add much, nothing happens — most completed tasks are routine and shouldn't generate a new document. If the existing library has something close but not quite right, that skill gets updated in place instead of duplicated. Only genuinely novel experiences get distilled into a brand-new skill document.

The skill itself is a structured write-up: what the skill lets you do, how it's done step by step, what worked, and — just as importantly — what didn't. That failure section is often the most valuable part: it encodes dead ends so a future agent doesn't have to rediscover them the hard way.

**Why evaluate novelty and generate the skill in one pass instead of two separate steps?** A separate "is this worth remembering" check would cost extra time and tokens on every single completed task, including the large majority that are routine. Folding novelty judgment and generation together means routine tasks get rejected almost for free — the judgment call and the potential write-up happen in the same pass, so there's no separate up-front cost paid on tasks that turn out not to be worth keeping.

---

## Semantic Deduplication Prevents Skill Sprawl

Before generating anything, the agent searches its existing skill library for anything that looks similar to the current task. This does two things: it stops the agent from writing fifteen near-identical variations of "how to check pod logs" over time, and it lets existing skills evolve — a new edge case can update a skill that already mostly covers the situation, rather than spawning a duplicate.

---

## Skills Live on Disk, Not in Weights

Skills are stored as plain files — human-readable, diffable, and editable by hand if needed — and separately indexed so the agent can find them by meaning, not just by exact name. The file is the source of truth; the index just makes it discoverable.

---

## How Skills Get Used

Skill recall happens at two points. Before a task is even handed to a sub-agent, the system checks whether anything in the skill library looks relevant and, if so, surfaces it as context up front. If that automatic pass misses something, or a new sub-task comes up mid-execution, the agent itself can search and load a skill on demand. Either way, the agent isn't improvising from scratch — it's following a documented procedure it (or a predecessor) actually wrote. And because it's a plain file, a human can review, edit, or delete it at any time.

---

## Why Not Fine-Tuning?

| Property | Fine-Tuning | Skill Distillation |
|----------|------------|-------------------|
| Inspectable | Weight changes are opaque | Plain files you can read |
| Editable | Can't edit specific knowledge | Edit the file directly |
| Revocable | Can't selectively forget | Delete the file |
| Auditable | Unclear what was learned when | Full history available |
| Cost | GPU time, dataset curation | One model call per novel task |
| Latency | Hours | Seconds |
| Portable | Model-specific | Works with any model |

The key advantage: **skill files are debuggable**. When an agent does something wrong, you can trace it to a specific skill, read the procedure, and fix it. With fine-tuning, you're guessing which training example caused the behavior.

---

## Edge Cases We Hit

### The "everything is novel" agent

A freshly deployed agent with no prior experience treats almost everything as novel, generating a flood of skills in its first few days — many of them trivial. We handle this with a stricter novelty bar for brand-new agents that relaxes over time, once there's enough of a library for semantic deduplication to start doing its job. We deliberately made this a manual knob rather than something that decays automatically — an automatic decay curve introduced a hard-to-debug edge case where agent replicas could end up with different effective thresholds.

### Skill drift

An agent learned a procedure for a system that later changed underneath it. The skill became wrong, but the agent kept following it anyway. We're building toward automatic staleness detection — flagging skills that haven't been touched in a while for human review. For now, the practical mitigation is that stale skills tend to fail visibly when followed, which surfaces them for investigation rather than silently misleading the agent forever.

### Cross-agent contamination

Two agents with very different roles shared a skill index, and one agent's skills started polluting the other's search results. The fix was straightforward once identified: scope every skill search to the agent it belongs to, both in the index and on disk, so results never leak across agents even when they technically share infrastructure.

---

## Lessons Learned

1. **Learning happens after the task, not during.** Don't slow down the user's workflow with background analysis. Distill asynchronously.

2. **Quality gates prevent garbage skills.** Novelty judgment plus deduplication plus a success signal keep the skill library clean.

3. **Inspectable beats opaque.** If you can't read what the agent learned, you can't trust it. Plain files beat weight updates.

4. **Namespace everything.** Agent memory, skills, and any shared index must be isolated per agent. Cross-contamination is a production risk, not a theoretical one.

5. **Skills have a lifecycle.** They're created, used, updated, and eventually deprecated. Treat them like code, not like permanent truths.

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

*How do you handle agent learning in your system? I'm especially curious about approaches to skill quality and lifecycle management. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*



---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

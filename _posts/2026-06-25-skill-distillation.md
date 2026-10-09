---
layout: post
title: "Agent Skill Distillation Without Fine-Tuning"
date: 2026-06-25 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 6
description: "Agent skill distillation without fine-tuning: teach reusable skills from production traces instead of GPU-trained distilled models."
image: /assets/images/og-memory.png
tags: [ai-agents, learning, skills, llm, architecture]
---

Rather than change a model's weights after an incident, we sometimes turn a completed agent task into a runbook. We call that **post-session skill distillation**: reviewing what happened after the user-facing work is done and saving a reusable procedure only when the experience adds something useful.

This is one way to give an agent access to past work. It does not replace model training, and a generated procedure still needs to be checked against the system it describes.

---

## From Task to Procedure

After a task, the agent searches its existing skill library for a similar procedure. Routine repetitions are skipped. A new edge case can update an existing skill, while a substantially different successful approach can become a new file. The file describes the goal, steps, what worked, and dead ends to avoid.

We combine the novelty decision and potential draft in one model pass rather than paying for a separate screening call on every completed task. That reduces calls for routine tasks; it does not make the assessment free or guarantee a good decision.

## Avoiding Duplicate Skills

Searching by meaning before writing helps avoid many versions of "check pod logs." It also lets a skill evolve when the next incident reveals an exception. Similarity is not enough to establish that two systems behave the same way, so an update still deserves review.

Skills are plain files on disk. A separate semantic index helps find them, but the file remains the source of truth. An operator can read a diff, edit a step, or remove an obsolete procedure. At task start the system looks up relevant skills before delegating work to a sub-agent; during execution the agent can also search and load a skill when a new sub-task appears. Recalled instructions are context, not proof that they still apply.

## Why Files Instead of Fine-Tuning Here?

Fine-tuning changes model weights using a training dataset. That can improve behavior across many examples, but changing or tracing one particular learned procedure is difficult. For our runbooks, files make a narrower, more reversible intervention:

| Question | Fine-tuning | Skill files |
|----------|-------------|-------------|
| Can an operator inspect one procedure? | Not directly from the weights | Yes, in the file |
| Can one procedure be edited or removed? | Requires a different training or mitigation process | Edit or remove the file and its index entry |
| What is the cost? | Training and dataset preparation | Model review plus storage and ongoing maintenance |
| How soon is a change available? | Depends on training and deployment | After the file and index are updated |
| Does it carry across models? | Usually model-specific | Files can be read by different models, though results may differ |

Neither choice guarantees correctness. Version history can show when a file changed; it cannot by itself show that the steps worked. A fine-tuned model may be appropriate for broader behavior changes, while a file works well for an explicit operational procedure.

## Problems We Encountered

### An empty library makes everything look new

At first, a newly deployed agent produced too many trivial skills because it had little to compare against. We set a stricter novelty threshold for new agents and relax it manually as their libraries grow. We avoided automatic threshold decay after finding that replicas could end up with different effective settings, making behavior harder to debug.

### Procedures become stale

A skill for a system that later changed kept being retrieved. We are working toward flagging old skills for human review. Today, a failed run can reveal a stale step, but some stale instructions can also produce plausible results, so visible failure is not a complete safeguard.

### Shared indexes can mix roles

Two agents with different jobs shared an index; one agent's skills appeared in the other's searches. We scoped searches and disk storage to the owning agent. That prevents this particular cross-agent mix-up even when the infrastructure is shared.

## Practical Takeaways

Distill after the task so analysis doesn't delay the user. Require evidence of success and check for duplicates before keeping a procedure. Maintain skills as you would runbooks: review, update, and eventually deprecate them. Keep each agent's retrieval scope explicit. The benefit in our system is that a person can inspect what the agent will read next time, not that the agent has permanently learned the right answer.

---

*How do you review and retire agent procedures? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> **StackGen builds AI-assisted SRE (site reliability engineering) tools.** Our offering at [ai.stackgen.com](https://ai.stackgen.com) supports incident triage, diagnostics, and draft root-cause analyses.

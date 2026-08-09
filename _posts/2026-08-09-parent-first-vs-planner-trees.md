---
layout: post
title: "When the Planner Costs More Than the Work"
date: 2026-08-09 15:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 40
description: "A fair A/B of parent-first agent loops vs ReAcTree-style planners on the same incident triage job — same findings, very different orchestration tax."
image: /assets/images/og-default.png
tags: [ai-agents, sre, reactree, incident-response, workflows, golang, aiden]
permalink: /blog/parent-first-vs-planner-trees/
faqs:
  - question: "When should an SRE agent skip the planner and work parent-first?"
    answer: "When the job is one tool plane and a short collect→verdict loop — for example read-only cluster inspection that ends in Theory / Impact / Do-this-now. Spawning children adds wall time without better findings."
  - question: "When do planner trees still win for incident triage?"
    answer: "When you need parallel falsifiers across skills or planes — metrics plus logs plus change history — or long-horizon digs that justify isolated workers. The tree earns its keep when branching is the work."
  - question: "What failed in a fair parent-first vs planner A/B?"
    answer: "Not finding quality — both paths named the same unhealthy loci. The planner spent extra turns on child spawn, clarifying stalls, and completion-gate retries at the root after a child already finished the dig."
---

We already knew [ReAcTree has sharp edges in production](/blog/reactree-bugs/). What we had not measured cleanly was a quieter question:

> For a **single-plane** incident triage job — inspect, gate, summarize — does the planner tree earn its keep, or does a **parent-first** root finish the same work with less tax?

So we ran a fair A/B. Same prompt. Same models. Same tools and budgets. Differ only by execution shape: one path keeps the root agent on the tools; the other keeps the ReAcTree planner and lets it spawn children.

**No architecture blueprint here** — just the comparison lesson, and when to pick which shape.

---

## The job (deliberately boring)

Not a multi-plane Grafana → logs → GitHub saga. A **read-only cluster health triage**: look at nodes and workloads, mark unavailable planes as not applicable, hit a completion gate, then write Theory / Impact / Do-this-now with concrete unhealthy names.

That shape matters. It is the kind of work where orchestration overhead shows up as pure waste — or proves it was necessary.

---

## What stayed the same

Both paths found the **same** class of problems:

- A worker node stuck NotReady / unreachable
- A pod stuck creating because a required secret was missing
- A workload evicted after disk pressure on a node

Finding quality was a **tie**. The interesting delta was everything around the findings.

---

## Where the paths diverged

| Dimension | Parent-first root | Planner / ReAcTree |
|-----------|-------------------|--------------------|
| Wall time | Faster finish | Noticeably slower on the same job |
| Tool chatter | Short, direct loop | Several times more calls |
| Child agents | None (capability denied) | Spawned children for work the root could do |
| Completion gate | Clean close | Extra root retries after a child already dug |
| Theory / Do-this-now | Concrete names | Same loci, more procedural noise |

The planner did not invent better RCA. It paid for **delegation and adaptive loops** on a task that did not need branching.

That matches a failure mode we keep rediscovering: [fluency and ceremony are not evidence](/blog/curiosity-before-confidence/). Here the ceremony was structural — spawn, note, search, retry the gate — not a wrong Theory.

---

## What wins where

**Prefer parent-first when**

- One tool plane owns the dig (shell against the cluster, or one observability family)
- The loop is short: collect → gate → summarize
- You care about latency and bill for on-call assist, not for proving the tree can nest

**Prefer a planner tree when**

- Competing falsifiers should run in parallel across skills or planes
- Digs need isolated workers with their own budgets
- The job is long-horizon enough that orchestration is the product, not overhead

This is the same instinct as [bring-up one stage at a time](/blog/bring-up-agent-workflows-like-hardware/): do not pay for a composed system when a single green stage already answers the card.

---

## Fairness pitfalls (the quiet killers)

A few setup mistakes made early runs look like “simple is broken” or “the planner is blind.” None of them were about model IQ.

1. **Budgets that lie** — aggregate ceilings that do not actually raise the root’s iteration limits cut parent-first runs mid-dig while the planner still looked healthy.
2. **Over-eager redaction** — when tool names and cluster identifiers become opaque placeholders in the model view, agents stall or invent fake tools. Trust the prompt IDs; let rehydration do its job ([PII for agents](/blog/pii-redaction-ai-agents/)).
3. **Clarifying-question HITL on an unattended bench** — the planner path can pause forever waiting for a human to name tools that were already in the prompt.
4. **Completion checks at the wrong altitude** — a child can satisfy the gate while the root adaptive loop still rejects “done” until the parent calls the same gate again. That is tree tax, not missing evidence.
5. **Loop traps on legitimate repeats** — batch inspection and gate retries look like doom loops if exemption policy is too aggressive ([salvage the answer](/blog/ai-agent-loop-detection-salvage/)).

If your A/B is not fair on those five, you are measuring configuration debt — not planner value.

---

## The principle

**Match execution shape to branching need.**

A tree is a tool for parallel uncertainty. A parent-first root is a tool for decisive, single-plane work. Using a tree for the latter does not make the agent smarter; it makes the session longer.

We will keep ReAcTree for the jobs that need it. We will also stop apologizing for the boring path when the boring path wins.

---

## Where to go next

- [ReAcTree production bugs](/blog/reactree-bugs/) — why trees need hard depth and shared governance
- [Is the task actually done?](/blog/is-the-task-actually-done/) — completion that is not prose
- [What are SRE AI agents?](/blog/what-are-sre-ai-agents/) — triage vs RCA vs remediation
- Hub: [AI incident triage](/topics/ai-incident-triage/) · [AI agent workflows](/topics/ai-agent-workflows/)

---

**Acknowledgments.** Parent-first execution in our agent runtime was driven as a product bet by the Aiden / runtime team so ordinary triage stops over-delegating; this A/B is the measurement that made the trade-off concrete.

*Choosing execution shape for on-call agents — or stuck paying planner tax for single-plane digs? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

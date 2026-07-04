---
layout: post
title: "Why We Split Our Agent Runtime From Our Platform"
date: 2026-06-30 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 11
description: "A CLI agent for one developer and an enterprise agent platform for many teams have almost nothing in common operationally. Here's the trade-off behind keeping them as one runtime, two layers."
tags: [aiden, platform, multi-tenant, architecture, ai-agents, stackgen]
---

A CLI tool for one developer is fun. Making it work for dozens of teams with different policies, models, budgets, and notification channels is engineering.

We built our AI agent runtime as a single-binary CLI tool. It worked beautifully — for one person. Then we needed to run it for an enterprise with many teams, many agents, and strict governance requirements. That's when we built **Aiden**.

---

## What is Aiden?

**Aiden** is [StackGen](https://stackgen.com)'s enterprise agent orchestration platform. It lets platform and SRE teams deploy AI agents that can triage incidents, query observability tools, run diagnostics, draft RCA reports, and execute approved remediation — with the governance, audit trails, and multi-tenancy that production requires.

If you've only used a chat wrapper or a local coding agent, Aiden is a different category: a **platform** for running many agents across many teams, each with its own tools, policies, knowledge base, and budget caps.

You can try the SRE-focused offering at [ai.stackgen.com](https://ai.stackgen.com). This post is about a single decision that shaped everything else: how we grew a single-user tool into a multi-tenant platform without rewriting it from scratch.

---

## The Gap Between "Works for Me" and "Works for the Company"

A CLI agent running on one developer's machine gets to assume a lot: one user, one set of credentials, one machine, implicit trust, and no need to remember anything between runs.

None of that holds at enterprise scale. You suddenly need teams with different permissions and budgets, centralized governance over who can deploy which agent with which tools, durable state that survives crashes and restarts, and the ability to run many agents concurrently without them stepping on each other.

That gap — between a tool that trusts its one user and a platform that has to assume nothing — is the whole story of what Aiden had to become.

---

## The Decision: Keep the Runtime Embeddable

The obvious approach when you need to scale a single-user tool into a multi-tenant service is to wrap it in a microservice: put an API in front of it, add a database, call it over the network from everything else.

We deliberately didn't do that. The agent runtime stays a **library** that the platform imports directly, in the same process, rather than a separate service the platform talks to over the network. The platform owns persistence, policy, and orchestration; the runtime owns the actual agent loop of reasoning and calling tools. Nothing crosses a network boundary just to run an agent.

**Why this mattered:** every network hop you introduce between "the thing that decides what to do" and "the thing that governs whether it's allowed to" is a place where serialization bugs, version skew, and partial failures creep in. Keeping them in the same process and the same type system eliminates an entire category of bugs before they can exist — at the cost of losing the hardware-level isolation you'd get from separate processes. We accepted that trade-off deliberately: a shared-nothing microservice architecture would have cost us months of plumbing for a scale of problem (dozens of teams, not thousands) where the isolation benefit didn't yet justify the complexity.

The honest trade-off: because everything runs in one process, a severe enough failure in one agent's execution can, in the worst case, affect others sharing that process. We mitigate this with checkpointed, resumable execution and per-agent resource limits rather than hardware isolation — good enough for our current scale, and a decision we'd revisit if the isolation requirements changed.

---

## Durable Execution Was Non-Negotiable

Agent tasks can run for minutes, involve multiple tool calls, and sometimes need to pause and wait for a human to approve something before continuing. That combination — long-running, resumable, occasionally paused on a human — ruled out treating an agent task like a normal stateless HTTP request.

We built on a durable workflow engine designed for exactly this shape of problem: if a worker crashes mid-task, execution resumes from where it left off rather than starting over and re-doing (and re-paying for) work that already happened. Waiting for human approval doesn't block a worker thread indefinitely — the workflow can suspend and resume cleanly whenever the human responds, whether that's in five seconds or five hours.

---

## Governance Needed Two Different Speeds

Not every governance decision is the same shape. Some decisions are fast and static — "is this specific tool ever allowed to run without a human looking at it first?" Others are contextual and depend on who's asking, what they're asking for, and the situation at the time — "is this specific action allowed right now, for this team, under this policy?"

Trying to force both into a single mechanism led to either a system too slow for the simple case or too rigid for the complex one. We ended up with two deliberately different layers: a fast, static check close to the runtime for the common case, and a slower, more expressive, context-aware policy layer at the platform level for everything that needs real judgment. Neither layer tries to do the other's job.

---

## Tenant Isolation Is a Data-Breach Problem, Not a UX Problem

Once multiple teams share infrastructure, "isolation" stops being a nice architectural property and becomes a compliance requirement. If one team's data — documents, past conversations, learned procedures — leaks into another team's agent, that's not a bug report, it's an incident.

We treat every storage layer as tenant-scoped from the ground up rather than bolting isolation on after the fact: separate logical partitions per tenant for knowledge and memory, permission scoping enforced at the point of use, and independent cost budgets with hard stops per tenant. Retrofitting isolation onto a system that wasn't built with it in mind is far more painful than starting with it.

---

## Quality Needs an Outside Opinion

Once you have many agents running many tasks unattended, you need some way to know whether they're actually doing a good job — not just whether they crashed. We run every completed task through an automated review step that grades it on relevance, tool usage, and completion quality.

The one rule that made this useful rather than theater: **the model doing the grading is never the same model that did the work.** An agent evaluating its own output tends to be generous with itself. An independent reviewer is a meaningfully better signal.

---

## What We Learned

1. **Embed, don't orchestrate — until the isolation math changes.** Running the agent as a library inside the platform eliminated an entire class of serialization and deployment complexity, at a cost we accepted knowingly. That trade-off is scale-dependent, not universal.

2. **Durable execution is worth the learning curve.** If your tasks can run for minutes and pause for a human, you need crash recovery and resumability as first-class properties, not an afterthought bolted onto a request/response model.

3. **Governance needs different speeds for different questions.** A single mechanism trying to be both fast and context-aware ends up being neither. Split the layers on purpose.

4. **Tenant isolation is non-negotiable from day one.** Retrofitting it later is a much bigger project than building it in from the start.

5. **Self-grading produces inflated scores.** Always use an independent reviewer for quality assessment, not the system grading its own work.

6. **Name the boundary between "framework" and "platform" early.** Teams that blur the two end up with governance logic in the wrong place, and untangling that later is expensive.

---

## Further Reading in This Series

This post covers *why* the runtime and platform are split the way they are. The rest of the series digs into specific pieces of the runtime itself — language choice, configuration, memory, delegation, security, and observability — each as its own story with its own production lessons. See the [series index](/) for the full list.

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

*Building a multi-tenant agent platform, or wrestling with a similar embed-vs-orchestrate decision? I'd love to hear what you're building — find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*



---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

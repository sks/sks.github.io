---
layout: post
title: "AI Agent Runtime vs Platform — Why We Split Them"
date: 2026-06-30 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 11
description: "AI agent runtime vs platform: why we split the Go runtime from Aiden, a multi-tenant orchestration layer for enterprise GenAI agents."
image: /assets/images/og-platform.png
tags: [aiden, platform, multi-tenant, architecture, ai-agents, stackgen]
faqs:
  - question: "What is an AI agent runtime vs a platform?"
    answer: "The runtime is the loop that plans, calls tools, and manages context. The platform adds tenancy, policy, durable workflows, budgets, and IaC-configured agents for many teams."
  - question: "Why split the Go runtime from Aiden?"
    answer: "A single-user CLI agent and a multi-tenant enterprise orchestration layer have different failure modes, auth, and policy needs. Splitting keeps the core loop lean."
  - question: "Who is Aiden for?"
    answer: "Enterprise SRE and platform teams that need multi-tenant agent orchestration with policies, models, budgets, and notification channels — not a personal chatbot demo."
---

A command-line interface (CLI) agent on one developer's machine can assume one user, one set of credentials, and a short-lived task. Those assumptions did not hold when we needed agents for multiple teams, each with its own tools, policies, model choices, budgets, and notifications.

We kept the Go agent runtime—the loop that chooses steps and calls tools—as an embeddable library. We built **Aiden** around it to handle shared operations. For a short introduction to the loop, see [What Is an AI Agent Runtime?](/blog/what-is-an-ai-agent-runtime/) and the [AI agent runtime hub](/topics/ai-agent-runtime/).

---

## What Aiden Adds

**Aiden** is [StackGen](https://stackgen.com)'s platform for deploying agents used by site reliability engineering (SRE) and platform teams. Those agents can investigate incidents, query monitoring systems, run diagnostics, draft root-cause analysis (RCA) reports, and perform approved remediation. The platform manages tenants (teams sharing infrastructure but requiring separate access), policies, audit records, knowledge, and cost limits. The SRE-focused offering is at [ai.stackgen.com](https://ai.stackgen.com); more on [Go agents](/topics/go-ai-agents/).

A local runtime needs to execute a task. A shared platform must also recover interrupted tasks, apply permissions consistently, and prevent one team's data or spending from affecting another team. That is the boundary we chose; it does not imply every organization needs this architecture.

## Why We Embedded the Runtime

We considered putting the runtime behind its own network service. Instead, Aiden imports it as a library in the same process: the runtime manages the agent loop while the platform manages persistence, policies, and orchestration. This avoids a network hop, serialization boundary, and separate service version for each call between those components.

![One Aiden process contains an imported runtime for agent execution and a platform for workflows, policy, tenant scope, budgets, and audit; durable workflows support resumption.](/assets/images/diagrams/june-operations/runtime-platform-split.svg)

The split is by responsibility rather than network service: the embedded runtime handles the loop, while platform workflows support waits and recovery.

The tradeoff is weaker process isolation. A severe failure in one agent's execution can affect other agents sharing that process. We use checkpointed, resumable tasks and per-agent resource limits to reduce the effect, not to provide hardware isolation. At our scale of dozens of teams, we judged a separate service's operational complexity greater than its current benefit; stronger isolation requirements would change that decision.

## Long Tasks Need Resumption

An investigation may run for minutes, make several tool calls, and pause for human approval. A stateless HTTP request does not fit that work well. We use a durable workflow engine to checkpoint progress and resume after a worker crash or approval wait. This avoids redoing some completed steps and paying for their model calls again, though individual external actions still need safe retry behavior; a checkpoint by itself cannot guarantee exactly-once effects. A suspended workflow does not keep a worker thread blocked throughout an approval wait.

## Two Speeds of Governance

Some decisions can be made quickly from a static rule: is this tool denied, or does it always need approval? Other decisions depend on team, request, and context. We place the fast check close to the runtime and use a more expressive platform policy layer for context-sensitive decisions. Both have to cover every path to tool execution. The split is an implementation tradeoff: a simpler system might use one policy mechanism without unacceptable overhead.

## Tenant Boundaries

Each team's documents, conversations, memories, and learned procedures need appropriate access controls. We use separate logical partitions per tenant for knowledge and memory, enforce permissions when resources are used, and apply independent budgets with hard stops. Logical partitions and access checks reduce cross-team exposure; they must be tested, since a missing tenant filter could still disclose data. We designed this into storage access rather than trying to retrofit it after teams began sharing data.

## Reviewing Output Quality

We run an automated review of completed tasks for relevance, tool use, and completion quality. The reviewer model differs from the one that did the work and checks the task record rather than relying solely on the agent's own claim. This provides another signal, not a definitive grade: a second model can share blind spots, and operators still need to check consequential outcomes against the real system.

## What the Split Taught Us

Embedding saved service plumbing while accepting a shared-process risk. Durable workflows made approval waits and worker recovery manageable, provided we also considered retries. Static and contextual policy checks serve different needs, and tenant scoping has to be enforced where data is read or written. These lessons reflect our workload rather than a universal rule to embed or split services.

## Further Reading in This Series

The other posts cover language choice, configuration, memory, delegation, security, and observability in the runtime and platform.

## Related reading

- [What Is an AI Agent Runtime?](/blog/what-is-an-ai-agent-runtime/) — the loop we separated from platform responsibilities
- [Go vs Python for AI Agents](/blog/why-go/) — the language choice under both layers
- [What Are SRE AI Agents?](/blog/what-are-sre-ai-agents/) — the operations work these agents support
- [Terraform for Agent Configuration](/blog/terraform-config/) — infrastructure as code for agent governance
- More on [Go AI agents](/topics/go-ai-agents/) · full [series](/series/enterprise-ai-agents-go/)

---

*How have you divided agent execution from shared governance? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> **StackGen builds AI-assisted SRE tools.** Our offering at [ai.stackgen.com](https://ai.stackgen.com) supports incident triage, diagnostics, and draft root-cause analyses.

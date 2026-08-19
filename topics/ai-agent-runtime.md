---
layout: page
title: AI Agent Runtime
permalink: /topics/ai-agent-runtime/
description: "What is an AI agent runtime? The production loop for planning, tools, and context — vs a GenAI platform — and how we run it in Go."
hub: ai-agent-runtime
faqs:
  - question: "What is an AI agent runtime?"
    answer: "The long-running loop that plans, calls tools, manages context, and returns a result. It is the execution engine — not the multi-tenant control plane, policy catalog, or chat UI around it."
  - question: "How is an agent runtime different from a GenAI platform?"
    answer: "A runtime owns one agent's turn-taking and tool use. A platform adds tenancy, policy, durable workflows, budgets, and IaC-configured agents for many teams. We keep the Go runtime embeddable and put enterprise concerns in Aiden."
  - question: "What should you look for in a production agent runtime?"
    answer: "Bounded tool loops, observable sessions, mid-run steerability, memory that does not blow the context budget, and clear failure modes when tools or models misbehave — not just a prompt wrapper."
  - question: "Why build an AI agent runtime in Go?"
    answer: "Concurrency, single-binary deployment, and typed middleware for tools and gates. Python still wins for research notebooks; Go wins for long-running production runtimes."
---

An **AI agent runtime** is the process that actually runs the agent: plan, call tools, manage context, finish or fail. Most “agent” marketing skips this layer and sells a platform, a chatbot, or a notebook demo instead.

**Fast path:** [Go agent runtime starter pack](/start/go-runtime/) (five posts).

These posts separate the **runtime** from the **platform**, and explain what broke when we treated them as the same thing.

Part of the series [Building an Enterprise AI Agent Platform in Go](/series/enterprise-ai-agents-go/).

## Start here

| Post | What you'll learn |
| ------ | ------------------- |
| [What Is an AI Agent Runtime?](/blog/what-is-an-ai-agent-runtime/) | Plain definition, what it is not, and production failure modes |
| [AI Agent Runtime vs Platform — Why We Split Them](/blog/aiden-platform/) | Why the Go loop stays embeddable and Aiden owns tenancy |
| [Go vs Python for AI Agents — Why We Chose Go](/blog/why-go/) | Language choice for a production agent runtime |
| [Go Platform Architecture at Speed](/blog/anatomy-of-a-platform/) | Growing the codebase without drowning |
| [Claim-Aware Evidence Packing](/blog/claim-aware-evidence-packing/) | Verifier bags that match answer claims; fail open when evidence was cut |

## Related on this site

- [Go AI agents](/topics/go-ai-agents/) — language and architecture
- [AI agent workflows](/topics/ai-agent-workflows/) — multi-stage bring-up and verification
- [AI agents for SRE](/topics/ai-agents-sre/) — triage, RCA, and on-call use

{% include subscribe.html %}

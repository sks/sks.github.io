---
layout: home
title: "Enterprise AI Agents in Go (Runtime & SRE)"
description: "Learn how to build enterprise AI agent runtimes, durable workflows, and SRE automation in Go. Production notes by StackGen Principal Engineer Sabith K S."
---

# Production Notes on Enterprise AI Agents

Principal Engineer at [StackGen](https://stackgen.com), building enterprise AI agent platforms in Go.

I write about the engineering decisions, production bugs, and hard-won lessons from building an **AI agent runtime** and **[Aiden](/blog/aiden-platform/)** — StackGen's multi-tenant agent orchestration platform for enterprise SRE and platform teams.

**Featured by CNCF:** [You Can't Debug What You Can't See — Observability for AI Agents](https://www.cncf.io/blog/2026/08/04/you-cant-debug-what-you-cant-see-observability-for-ai-agents/)

## Start here

New to the series? Read these three, in order:

1. **[What Is an AI Agent Runtime?](/blog/what-is-an-ai-agent-runtime/)** — plain definition of the production agent loop
2. **[Go vs Python for AI Agents](/blog/why-go/)** — why we chose Go for a production agent runtime
3. **[What Are SRE AI Agents?](/blog/what-are-sre-ai-agents/)** — triage vs RCA vs remediation without demo theater
4. **[AI Incident Triage for SREs — What Actually Helps On-Call](https://stackgen.com/blog/ai-incident-triage-for-sres-what-works-on-call)** — what actually helps on-call (on StackGen)

**Full series:** [Building an Enterprise AI Agent Platform in Go](/series/enterprise-ai-agents-go/)

## Topic hubs

- [AI agent runtime](/topics/ai-agent-runtime/) — what a runtime is vs a GenAI platform
- [AI agent workflows](/topics/ai-agent-workflows/) — bring-up, evidence-gated RCA, verification
- [AI agents for SRE](/topics/ai-agents-sre/) — triage, observability, tokenomics
- [AI incident triage](/topics/ai-incident-triage/) — on-call triage vs demo theater
- [Go AI agents](/topics/go-ai-agents/) — language choice, platform architecture

## Aiden — Enterprise Agent Platform

**[What Is an AI Agent Runtime?](/blog/what-is-an-ai-agent-runtime/)** — plain definition of the production agent loop.

**[AI Agent Runtime vs Platform — Why We Split Them](/blog/aiden-platform/)** — the engineering trade-off behind turning a single-user CLI agent into a multi-tenant enterprise platform.

{% include subscribe.html %}

## Connect

- **Newsletter**: [Subscribe on Substack]({{ site.newsletter_url }}){% if site.substack_latest_issue_url != "" %} · [{{ site.substack_latest_issue_label }}]({{ site.substack_latest_issue_url }}){% endif %} · [RSS](/feed.xml)
- **GitHub**: [@sks](https://github.com/sks)
- **LinkedIn**: [Sabith](https://linkedin.com/in/sabithks)
- **Company**: [StackGen](https://stackgen.com)

---
layout: page
title: Building an Enterprise AI Agent Platform in Go
permalink: /series/enterprise-ai-agents-go/
description: "A practitioner series on building production AI agents in Go — runtime design, workflows, SRE triage, observability, and enterprise platform lessons from StackGen."
faqs:
  - question: "Why build an enterprise AI agent platform in Go?"
    answer: "Go gives you static typing, simple deployment, and concurrency primitives that map cleanly to multi-stage agent workflows. This series covers when that trade-off beats Python-first AI frameworks in production."
  - question: "Where should I start reading?"
    answer: "Start with Why We Chose Go for our AI agent platform, then follow series_order through runtime bugs, memory, governance, and platform split. Each post is self-contained but builds on prior lessons."
  - question: "Who is this series for?"
    answer: "Staff engineers, platform teams, and SREs shipping agentic workflows to production — not tutorial readers looking for a hello-world chatbot."
---

This series documents what we learned building a **production AI agent runtime** and **Aiden** — StackGen's multi-tenant orchestration platform for enterprise SRE and platform teams. Every post is grounded in shipped behavior and production failures, not demo polish.

**Start here:** [Go vs Python for AI Agents — Why We Chose Go](/blog/why-go/)

## Topic hubs

Dive by theme:

- [AI agent workflows](/topics/ai-agent-workflows/) — multi-stage pipelines, bring-up, evidence-gated RCA
- [AI agents for SRE](/topics/ai-agents-sre/) — incident triage, observability, tokenomics
- [Go AI agents](/topics/go-ai-agents/) — language choice, platform architecture, IaC config

## Full series (reading order)

{% assign series_name = "Building an Enterprise AI Agent Platform in Go" %}
{% assign series_posts = site.posts | where_exp: "post", "post.series == series_name" | sort: "series_order" %}

| # | Post | Summary |
|---|------|---------|
{% for post in series_posts -%}
| {{ post.series_order }} | [{{ post.title }}]({{ post.url | relative_url }}) | {{ post.description }} |
{% endfor %}

## More on this site

Posts outside the numbered series (e.g. cloud entitlements, web→LLM metrics) live on the [homepage](/) archive.

{% include subscribe.html %}

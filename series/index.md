---
layout: page
title: Series
permalink: /series/
nav_title: Series
description: "All blog series on Production Notes: Building an Enterprise AI Agent Platform in Go, ClickHouse on AWS, and Service Rendered Efficiently."
faqs:
  - question: "How many series does this site have?"
    answer: "Three: Building an Enterprise AI Agent Platform in Go (85 posts), ClickHouse on AWS: Self-Managed from First Principles (9 posts), and Service Rendered Efficiently (12 posts). This page links each with its starter pack and topic hub."
  - question: "Can I search across all series?"
    answer: "Each series page has its own search box scoped to that series. For cross-series search, use the topic hubs or the starter packs, which group related posts across series."
  - question: "Where do standalone posts live?"
    answer: "Posts without a series appear in the homepage archive and in topic hubs, not on series pages."
---

Every numbered, ordered series on this site. Each series page has month-folded archives, search, and reading order.

{% assign all_series = site.posts | where_exp: "post", "post.series" | group_by: "series" | sort: "size" | reverse %}

{% assign go = "Building an Enterprise AI Agent Platform in Go" %}
{% assign ch = "ClickHouse on AWS: Self-Managed from First Principles" %}
{% assign sre = "Service Rendered Efficiently" %}
{% assign go_count = site.posts | where: "series", go | size %}
{% assign ch_count = site.posts | where: "series", ch | size %}
{% assign sre_count = site.posts | where: "series", sre | size %}

| Series | Posts | What it covers | Start here |
|--------|-------|----------------|------------|
| [Building an Enterprise AI Agent Platform in Go](/series/enterprise-ai-agents-go/) | {{ go_count }} | Production agent runtime, workflows, evals, SRE triage, guardrails | [Starter packs](/start/go-runtime/) |
| [ClickHouse on AWS: Self-Managed from First Principles](/series/clickhouse-on-aws/) | {{ ch_count }} | Self-managed ClickHouse on AWS: engines, topology, S3 storage, spot readers, cost | [ClickHouse starter pack](/start/clickhouse-aws/) |
| [Service Rendered Efficiently](/series/service-rendered-efficiently/) | {{ sre_count }} | SRE as a service product: culture, investigation, operator outcomes | [SRE as service starter pack](/start/sre-as-service/) |

## Topic hubs

Cross-series themes:

- [AI agent runtime](/topics/ai-agent-runtime/) · [AI agent workflows](/topics/ai-agent-workflows/) · [AI agents for SRE](/topics/ai-agents-sre/) · [Go AI agents](/topics/go-ai-agents/) · [AI incident triage](/topics/ai-incident-triage/)
- [Service Rendered Efficiently](/topics/service-rendered-efficiently/)
- [ClickHouse on AWS](/topics/clickhouse-aws/)

{% include subscribe.html %}

---
layout: page
title: "ClickHouse on AWS: Self-Managed from First Principles"
nav_title: Series
permalink: /series/clickhouse-on-aws/
description: "Self-managed ClickHouse on AWS for engineers starting from first principles: MergeTree internals, engine choices, cluster topology, S3 storage, spot readers, operations, and cost — with the numbers and failure stories behind each choice."
faqs:
  - question: "Who is this ClickHouse series for?"
    answer: "Engineers starting with ClickHouse on AWS — no prior ClickHouse knowledge assumed. Each post defines its terms, uses real numbers from a production log analytics cluster, and links the official docs it builds on."
  - question: "Do I need ClickHouse Cloud to follow along?"
    answer: "No. The series is self-managed from first principles: ReplicatedMergeTree, ClickHouse Keeper, and S3 storage policies on EC2. Post 2 explains what ClickHouse Cloud's SharedMergeTree gives you and when buying it wins."
  - question: "Why EC2 instead of Kubernetes for ClickHouse?"
    answer: "For a small stateful fleet, stable identity under spot churn, Keeper raft discipline, S3-tiered storage, and not paying the cluster tax beat the Altinity operator's conveniences. The final post walks the data flows and the honest reversal condition — if you already run a large EKS fleet, the calculus flips."
---

This series explains the **ClickHouse cluster** behind a log analytics platform I run—self-managed on AWS, starting from first principles. It's written for junior engineers: every term is defined at first use, and every claim carries a number or a link to the official docs. It records not just what we chose but what broke—a $1,700/month EBS leak, a spot-identity race, and deprecated zero-copy replication. Numbers come from a production log analytics cluster; what transfers to your setup is usually the measurement, not our answer.

## Start with a pack

| Pack | For |
|------|-----|
| [ClickHouse on AWS starter pack](/start/clickhouse-aws/) | The full series in reading order with one-line takeaways |

## Topic hubs

Dive by theme:

- [ClickHouse on AWS](/topics/clickhouse-aws/) — all posts by topic

{% assign series_name = "ClickHouse on AWS: Self-Managed from First Principles" %}
{% assign series_search_placeholder = "Try “S3”, “Keeper”, or “spot”…" %}
{% include series-archive.html series_name=series_name search_placeholder=series_search_placeholder %}

## More on this site

Standalone engineering notes are listed on the [series index](/series/#standalone-production-notes).

{% include subscribe.html %}

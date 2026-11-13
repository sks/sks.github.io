---
layout: page
title: ClickHouse on AWS
permalink: /topics/clickhouse-aws/
description: "Self-managed ClickHouse on AWS from first principles: MergeTree internals, engine choices, cluster topology, S3 tiered storage, spot readers, operations, and cost engineering."
hub: clickhouse-aws
faqs:
  - question: "Is ClickHouse Cloud's SharedMergeTree available self-hosted?"
    answer: "No. SharedMergeTree and the Shared* engine family exist only in ClickHouse Cloud. Self-managed ClickHouse uses ReplicatedMergeTree with ClickHouse Keeper; Altinity's experimental CAS disks (Antalya 26.6+) are the emerging OSS answer for shared object storage."
  - question: "Can ClickHouse store table data directly in S3?"
    answer: "Yes. Storage policies define an S3 disk, an optional cache wrapper disk, and hot/cold volume tiers. New parts land on local disk for fast merges; TTL rules and move_factor push cold parts to S3. A persistent metadata disk maps parts to objects and must never be lost."
  - question: "How do you run ClickHouse readers on Spot instances?"
    answer: "Give each reader a stable replica name with a DynamoDB ordinal claimer: a conditional PutItem per boot, a 15-minute lease renewed every 5 minutes, and a spot interruption handler that releases the claim before shutdown."
  - question: "Why run ClickHouse on EC2 instead of Kubernetes?"
    answer: "For a 6-9 node stateful fleet, stable identity under spot churn, Keeper raft discipline, S3-tiered storage policies, and not paying a cluster tax beat the operator's conveniences. If you already run a large EKS fleet with a platform team, the Altinity operator is a good default instead."
---

This topic collects the posts on running self-managed ClickHouse on AWS — the log analytics platform I run — written for engineers starting from first principles. ClickHouse Cloud makes the engine and storage decisions for you; on your own EC2 fleet you make them yourself, and these posts make each one explicitly.

**Fast path:** [ClickHouse on AWS starter pack](/start/clickhouse-aws/).

Part of the series [ClickHouse on AWS: Self-Managed from First Principles](/series/clickhouse-on-aws/).

For the AI-agent SRE work that this cluster serves, see [AI agents for SRE](/topics/ai-agents-sre/).

## The posts

| Post | What you'll learn |
|------|-------------------|
| [A Junior Engineer's Guide to ClickHouse: The MergeTree Mental Model](/blog/clickhouse-mergetree-mental-model/) | Parts, merges, and ORDER BY granule skipping — why columnar log queries are cheap and tiny inserts are not |
| [SharedMergeTree vs ReplicatedMergeTree: Picking a ClickHouse Engine When You Don't Have ClickHouse Cloud](/blog/clickhouse-cloud-vs-self-managed-engines/) | Cloud's engine doesn't exist in OSS; what ReplicatedMergeTree with Keeper gives you instead, and the zero-copy lesson |
| [Writers, Readers, Keepers: Designing a ClickHouse Cluster That Survives Node Loss](/blog/clickhouse-cluster-topology-keeper/) | Three node roles, the Keeper quorum math that flips replicated tables read-only, and the dedicated raft disk |
| [ClickHouse on S3: Tiered Storage Policies That Don't Melt](/blog/clickhouse-s3-tiered-storage/) | Hot local disk, a TTL'd cold S3 tier, async-insert tuning, and the one metadata volume you cannot lose |
| [Running ClickHouse Readers on Spot: The Stable-Identity Problem](/blog/clickhouse-spot-readers-stable-identity/) | A DynamoDB ordinal claimer that gives spot-launched readers a stable replica name across instance generations |
| [Operating Self-Managed ClickHouse: Golden Images, Bootstrap, and Runbooks](/blog/clickhouse-operations-runbooks/) | Golden AMIs, two-stage bootstrap, rolling config refresh, and the runbook debt plain EC2 owes you versus the operator |
| [The Cost Levers of Self-Managed ClickHouse on AWS](/blog/clickhouse-aws-cost-engineering/) | The real monthly numbers — Graviton, a 50% spot split, S3 tiering, and the $1,700/month orphaned-volume leak |
| [After ReplicatedMergeTree: CAS, Iceberg, and When to Just Buy ClickHouse Cloud](/blog/clickhouse-whats-next-cas-iceberg/) | CAS content-addressed storage, Apache Iceberg, and the honest buy-versus-build checklist |
| [Why I Draw ClickHouse Data Flows (and Why EC2 Beat Kubernetes for This Cluster)](/blog/clickhouse-ec2-vs-k8s-mermaid-data-flow/) | Mermaid data-flow diagrams of the whole cluster, and why plain EC2 beat the Kubernetes operator here |
| [Dead Projections and Useless FINAL: Tuning ClickHouse Tenant Databases by Reading the Source](/blog/clickhouse-tenant-tuning-from-source/) | A projection that doubled storage but never ran, why SUM(count) over SummingMergeTree never needs FINAL, the {database} keeper-path macro for per-database tenancy, and the system-log TTL trap |

{% include subscribe.html %}

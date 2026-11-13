---
layout: page
title: ClickHouse on AWS starter pack
permalink: /start/clickhouse-aws/
description: "Thirteen production notes on self-managed ClickHouse on AWS — MergeTree internals, engine choices, cluster topology, S3 storage, spot readers, operations, cost, replica identity, and tenant tuning from the source."
faqs:
  - question: "I'm new to ClickHouse. Where should I start?"
    answer: "Read in order. Post 1 explains the MergeTree storage model from zero; each later post defines its terms and links the official docs it builds on. No prior ClickHouse or Kubernetes knowledge is assumed."
  - question: "Do I need Kubernetes to follow this series?"
    answer: "No. The series is self-managed ClickHouse on EC2 with S3 storage. The final post compares EC2 and Kubernetes honestly, with the conditions that would flip the decision."
  - question: "Are the numbers real?"
    answer: "Yes — steady-state costs, lease timings, cache sizes, and failure stories come from a production log analytics cluster. Your numbers will differ; the levers and failure modes are the transferable part."
---

A short path into self-managed ClickHouse on AWS. The posts are in reading order.

## The posts

1. **[A Junior Engineer's Guide to ClickHouse: The MergeTree Mental Model](/blog/clickhouse-mergetree-mental-model/)** — parts, merges, and the ORDER BY index, and why tiny inserts break everything  
2. **[SharedMergeTree vs ReplicatedMergeTree: Picking a ClickHouse Engine When You Don't Have ClickHouse Cloud](/blog/clickhouse-cloud-vs-self-managed-engines/)** — what Cloud gives you for free and what open source gives you instead  
3. **[Writers, Readers, Keepers: Designing a ClickHouse Cluster That Survives Node Loss](/blog/clickhouse-cluster-topology-keeper/)** — split the cluster into three roles so any one node can die at 3 a.m.  
4. **[ClickHouse on S3: Tiered Storage Policies That Don't Melt](/blog/clickhouse-s3-tiered-storage/)** — all bytes in S3, a local cache, and the one EBS volume you cannot lose  
5. **[Running ClickHouse Readers on Spot: The Stable-Identity Problem](/blog/clickhouse-spot-readers-stable-identity/)** — spot readers at ~70% off, with a DynamoDB claimer that keeps replica names stable  
6. **[Operating Self-Managed ClickHouse: Golden Images, Bootstrap, and Runbooks](/blog/clickhouse-operations-runbooks/)** — the boring machinery that turns EC2 boxes into something like a managed service  
7. **[The Cost Levers of Self-Managed ClickHouse on AWS](/blog/clickhouse-aws-cost-engineering/)** — real monthly numbers, the levers that move them, and the $1,700/month volume leak  
8. **[After ReplicatedMergeTree: CAS, Iceberg, and When to Just Buy ClickHouse Cloud](/blog/clickhouse-whats-next-cas-iceberg/)** — content-addressed storage, open table formats, and the honest buy-vs-build checklist  
9. **[Why I Draw ClickHouse Data Flows (and Why EC2 Beat Kubernetes for This Cluster)](/blog/clickhouse-ec2-vs-k8s-mermaid-data-flow/)** — the three diagrams that name every hop, and why EC2 won  
10. **[ClickHouse Config Is Not YAML: What One Re-Render Taught Me About Replica Identity](/blog/clickhouse-replica-identity-config-render/)** — the macros, Keeper paths, and raft IDs that name a node — and the re-render that re-keyed them  
11. **[The S3 Path Bug Nobody Sees: Silent Config, Shattered Tenants, and a CAS-Ready Fix](/blog/clickhouse-s3-key-prefix-silent-config-bug/)** — a config element ClickHouse silently ignored, proven live with an insert and an `aws s3 ls`  
12. **[Operating ClickHouse Without Kubernetes](/blog/clickhouse-operate-without-kubernetes/)** — the operator's domain code, packaged as a single binary, against EC2  
13. **[Dead Projections and Useless FINAL: Tuning ClickHouse Tenant Databases by Reading the Source](/blog/clickhouse-tenant-tuning-from-source/)** — a projection that doubled storage but never ran, a FINAL that cost 20 seconds a query, and the `{database}` keeper-path macro that makes per-database tenancy work  

## Next

- Hub: [ClickHouse on AWS](/topics/clickhouse-aws/)  
- Full series: [ClickHouse on AWS: Self-Managed from First Principles](/series/clickhouse-on-aws/)  
- Related: [SRE on-call starter pack](/start/sre-on-call/) — the log platform this series describes exists to make on-call investigations faster.

{% include subscribe.html %}

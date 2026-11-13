---
layout: post
title: "After ReplicatedMergeTree: CAS, Iceberg, and When to Just Buy ClickHouse Cloud"
date: 2026-11-12 09:00:00 -0800
series: "ClickHouse on AWS: Self-Managed from First Principles"
series_order: 8
description: "CAS content-addressed storage, Apache Iceberg, and the honest checklist for choosing self-managed ClickHouse over ClickHouse Cloud."
image: /assets/images/og-default.png
tags: [clickhouse, cas, apache-iceberg, clickhouse-cloud, architecture, storage]
permalink: /blog/clickhouse-whats-next-cas-iceberg/
faqs:
  - question: "What is CAS in ClickHouse?"
    answer: "Content-Addressed Storage is a new disk type in Altinity's Antalya 26.6, not a new table engine. Set metadata_type=cas on an object_storage disk and every part file is referenced by content hash, so many servers share one object pool. It works with all MergeTree engines and initializes a 200M-row table on a new replica in ~14 seconds instead of full network replication."
  - question: "Why is CAS better than zero-copy replication?"
    answer: "Zero-copy said replica 2 should reference replica 1's object, tracking ownership in Keeper. Its garbage collection was broken and it was deprecated in 2025 (PR 82250). CAS says the file's hash identifies the object, so any replica can independently publish a reference to it. No per-replica state to break."
  - question: "What does Apache Iceberg give you that CAS doesn't?"
    answer: "Iceberg puts table data in an open format on S3 that Spark, Trino, and DuckDB can read directly. CAS shares storage inside ClickHouse with no DDL change; Iceberg shares data with everyone but is a different table layout. CAS = share inside ClickHouse. Iceberg = share with everyone."
  - question: "Is CAS production-ready?"
    answer: "No. It is experimental, and insert-heavy paths are not fully optimized. Altinity's own guidance is to use it as a cold tier — write locally, TTL-move merged parts to the CAS disk — not as primary storage. It is functionally complete for AWS S3 and GCS; Azure support is pending."
  - question: "When should you buy ClickHouse Cloud instead of self-managing?"
    answer: "If the team is under 10 with no dedicated DBA, you need ClickPipes or warehouse connectors now, or you want zero upgrade labor, buy. If the workload is predictable and large, spot economics are available, or per-tenant chargeback and air-gapped compliance matter, self-managed wins. Remember leaving Cloud means a data export plus DDL cleanup, because SharedMergeTree does not exist in OSS."
---

Everything so far in this series is the honest current answer. ReplicatedMergeTree for durability, Keeper for coordination, Amazon Simple Storage Service (S3)-backed tiered policies for cheap storage, spot readers for cheap compute. Run it, and the bill stays predictable.

But the architecture has one structural cost. Structural means it is built into the design, not caused by bad settings. Each replica keeps its own copy of the data, so S3 storage scales with replica count. Three readers means three copies of everything. I run a log analytics platform on this design, and I think about that line item every month. This post covers what is coming to fix it — Content-Addressed Storage (CAS) and Iceberg from Project Antalya — and the honest decision about when to stop building and buy ClickHouse Cloud.

**Key takeaways**

- CAS (experimental, Altinity Antalya 26.6) makes storage content-addressed: one object pool shared by all replicas, ~14-second initialization on a new replica, no data definition language (DDL) rewrite. Altinity's guidance: cold tier today, not primary storage.
- Iceberg puts table data in an open format other engines (Spark, Trino, DuckDB) can read — a different trade than CAS's drop-in simplicity.
- ClickHouse Cloud buys SharedMergeTree, compute-compute separation, and ClickPipes — at metered pricing and with lock-in: `SHOW CREATE TABLE` returns `Shared*` engines that don't exist in open-source software (OSS).
{: .key-takeaways}

---

## The structural cost of ReplicatedMergeTree

ReplicatedMergeTree is the engine that keeps identical parts of a table on multiple servers, so queries and inserts survive a node loss. Each replica stores its own complete copy. Picture four branch offices of one company: each office photocopies the entire archive so every office can answer questions locally. The copies are identical, but the paper bill grows with every branch you open. In ClickHouse terms, this is the photocopy problem: durability is bought by paying for each branch's copy again.

```
Before CAS — storage scales with replicas
   writer ─┐
   writer ─┼─► replica 1: parts in s3/tenant/a (full copy)
           ├► replica 2: parts in s3/tenant/b (full copy)
           └► replica 3: parts in s3/tenant/c (full copy)

After CAS — one object pool, references shared
   writer ─┐
   writer ─┼─► replica 1 ─┐
           ├► replica 2 ─┼─► s3/pool/<content-hash> (one copy)
           └► replica 3 ─┘
```

## CAS: content-addressed storage, not a new engine

CAS — Content-Addressed Storage — shipped experimental in [Altinity Antalya 26.6](https://altinity.com/blog/introducing-cas-drop-in-compute-storage-separation-for-clickhouse-mergetree-tables) (September 2026). The design is one change: `metadata_type=cas` on an existing `object_storage` disk type. It is a **disk type, not a new table engine**, so it works with every MergeTree engine — no DDL rewrite, no re-ingestion, no application changes.

The core idea is a fingerprint. Think of parcel tracking, or how git version control stores files: every page gets an identifier (ID) stamped from its content, not from where it came from. Two branches that print the same page discover they hold the same fingerprint, so the page exists only once. Any branch can find any page by fingerprint alone.

How it works, in order:

1. Every part file gets its **content hash** — a fingerprint computed from the file's bytes. Two replicas that merge into the same part bytes publish references to the same object.
2. Many servers share one object pool. The fingerprint is the object's name, so any replica can independently publish a reference to an object it just wrote — or that another replica wrote first.
3. No per-replica local reference state. This is the key property: nothing on a replica says "I own that object."
4. Coordination uses conditional writes and manifests in the bucket for object pool updates; Keeper still coordinates the replication log itself.
5. Garbage collection (GC) — identifying and deleting unreferenced objects — is proven with Temporal Logic of Actions (TLA+). TLA+ is a formal method: a mathematical proof that a protocol has no bad interleavings. (GC is where zero-copy died.)
6. A 200-million-row table initializes on a **new** replica in ~14 seconds: the new replica publishes references to the existing objects instead of copying 200M rows over the network — like a new branch office receiving the archive's catalog and finding every page already exists.

Current state: functionally complete for Amazon Web Services (AWS) S3 and Google Cloud Storage (GCS); Azure pending. Limits: experimental status, and insert-heavy paths are not fully optimized. Altinity's own guidance is to run CAS as a **cold tier** — write locally, TTL-move merged parts to the CAS disk — not as primary storage. Discussion and operator feedback live in [altinity/clickhouse-operator#1951](https://github.com/Altinity/clickhouse-operator/issues/1951).

## Why CAS beats the zero-copy approach

ClickHouse tried this before, and the failure is worth studying. Zero-copy replication stamped every page with the **owner's** name: "borrowed from branch 1." When branch 1 left, the pages it "owned" became orphans nobody dared throw away. That is why its garbage collection was broken: no one could prove a page was safe to delete. Zero-copy was deprecated in 2025 ([pull request (PR) #82250](https://github.com/ClickHouse/ClickHouse/pull/82250)).

The fix is not better bookkeeping on "who owns this object." It is removing ownership entirely:

- Zero-copy: "replica 2 references replica 1's object" — needs per-object owner state, and a GC that can break.
- CAS: "the file's hash identifies the object; any replica can independently publish a reference to it" — no owner state, and a GC proven with TLA+ instead of hoped for. Content fingerprints have no owner to lose.

## Iceberg: share with everyone

[Apache Iceberg](https://iceberg.apache.org/) is the other half of [Project Antalya](https://altinity.com/blog). Iceberg is an open table format — data plus metadata files on S3 that define tables, partitions, and snapshots. Compare publishing your archive in Portable Document Format (PDF) instead of a company-only filing system: anyone with a PDF reader can open it, not just your own staff. Write table data in Iceberg and Spark, Trino, and DuckDB read it directly, no ClickHouse in between.

That is a different trade than CAS:

| | CAS | Iceberg |
|---|---|---|
| What it shares | storage inside ClickHouse | table data with everyone |
| DDL change | none (disk type) | table format change |
| Engines that read it | ClickHouse only | Spark, Trino, DuckDB, anything Iceberg-native |
| Complexity | drop-in | open-format migration |

For a junior engineer: CAS = share inside ClickHouse. Iceberg = share with everyone. CAS is a drop-in shelf inside your own library — same shelves, shared storage, no changes to the catalog. Iceberg opens the archive to everyone but adds conversion rules for how it is published. They answer different questions.

## When to just buy ClickHouse Cloud

Now the office-building choice. [ClickHouse Cloud](https://clickhouse.com/docs/en/cloud/overview) is a fully managed office building: maintenance you can't see is included — SharedMergeTree (the cloud engine where storage is shared across compute nodes, not replicated per node), compute-compute separation (isolate ingest from dashboards), ClickPipes (managed connectors), managed upgrades, backups, and scaling you do not configure. Renting a plot and building it yourself is self-managed: a known monthly rent (~$3.1–3.5k/month for the prod profile from the [cost post](/blog/clickhouse-aws-cost-engineering/)) plus your chores — upgrades, Keeper health checks, 3am pages.

The trade has two parts. Pricing is metered — you pay for what you use, which is hard to forecast. Compute runs roughly $0.22–$0.75 per unit-hour and storage roughly $25.30–$50/TB-month; typical ranges, not quotes. And there is a lock-in: the managed building's furniture is bolted in a way that only fits their rooms. `SHOW CREATE TABLE` on a Cloud table returns `Shared*` engine names that do not exist in OSS ClickHouse. Moving out means re-packing everything — exporting the data and re-declaring engines — not a straight copy.

The decision checklist, in order:

1. **Team size under 10, no dedicated DBA → lean Cloud.** A DBA is a database administrator; self-managing means someone owns upgrades, Keeper quorum health, and 3am pages. Without one, the building with maintenance included is cheaper than it looks.
2. **Predictable large workload, spot economics available → self-managed pays.** The numbers from the [cost post](/blog/clickhouse-aws-cost-engineering/): ~$3.1–3.5k/month prod versus Cloud metered at comparable scale. A known rent beats an unpredictable one.
3. **Per-tenant chargeback → self-managed.** Per-tenant S3 prefixes give per-tenant cost attribution cheaply (post 7 shows it); mapping that onto a shared Cloud service adds reconciliation work.
4. **Compliance or air-gap → self-managed.** An air-gapped environment has no internet connection to the outside. ClickPipes and managed services do not run inside your virtual private cloud (VPC)-only, no-egress environment.
5. **Need ClickPipes or warehouse connectors now → Cloud.** Building and operating that pipeline yourself is a team, not a task.
6. **Want exit options → OSS engines.** Self-managed runs the same OSS engines you could run anywhere; Cloud's SharedMergeTree is Cloud-only, so leaving is a data export plus DDL cleanup.

## What this series chose, and why

I self-manage. The workload is log analytics: predictable in shape, bursty in arrival, spot-tolerant on the reader side. Spot economics are available. Per-tenant isolation and chargeback are requirements, and per-tenant S3 prefixes deliver both without extra infrastructure. The team is small but has SRE skills — site reliability engineering, the practice of running systems with automation and monitoring — and the platform already runs Amazon Elastic Compute Cloud (EC2), S3, and Terraform.

If any of those changed — team under 10 with no SRE skill, no spot availability, or a hard requirement for ClickPipes next quarter — the checklist above says Cloud, and I would buy it. Self-managed is not an identity. It is an answer for a specific shape of workload, and it must keep being the cheaper answer every month.

Next in the series: Mermaid data-flow diagrams and why EC2 over Kubernetes — [/blog/clickhouse-ec2-vs-k8s-mermaid-data-flow/](/blog/clickhouse-ec2-vs-k8s-mermaid-data-flow/).

Previous: [The Cost Levers of Self-Managed ClickHouse on AWS](/blog/clickhouse-aws-cost-engineering/). Next: [Why EC2 over Kubernetes for ClickHouse, with Mermaid data-flow diagrams](/blog/clickhouse-ec2-vs-k8s-mermaid-data-flow/).

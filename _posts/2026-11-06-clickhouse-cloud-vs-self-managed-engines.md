---
layout: post
title: "SharedMergeTree vs ReplicatedMergeTree: Picking a ClickHouse Engine When You Don't Have ClickHouse Cloud"
date: 2026-11-06 09:00:00 -0700
series: "ClickHouse on AWS: Self-Managed from First Principles"
series_order: 2
description: "Cloud's SharedMergeTree does not exist in open source: what you get instead with ReplicatedMergeTree, Keeper, and the zero-copy lesson."
image: /assets/images/og-default.png
tags: [clickhouse, sharedmergetree, replicatedmergetree, keeper, aws, self-hosted]
permalink: /blog/clickhouse-cloud-vs-self-managed-engines/
faqs:
  - question: "Is SharedMergeTree available in open source ClickHouse?"
    answer: "No. SharedMergeTree is a ClickHouse Cloud engine. Running its DDL on self-hosted clickhouse-server fails with Unknown table engine SharedMergeTree. Use ReplicatedMergeTree on open source."
  - question: "What is SharedMergeTree?"
    answer: "A MergeTree variant where a single copy of each part lives in shared object storage (like S3) and every compute node reads the same copy. Replicas coordinate through the shared storage plus Keeper, which enables elastic scaling and compute-compute separation."
  - question: "Why was zero-copy replication deprecated?"
    answer: "The S3 disk, local reference state, and per-replica Keeper bookkeeping could not stay transactionally in sync, and orphan files were never cleaned properly. ClickHouse removed the zero-copy tests in PR #82250."
  - question: "What do I need to run ReplicatedMergeTree on AWS?"
    answer: "A ZooKeeper or ClickHouse Keeper quorum for coordination, N replicas per shard each with its own local copy of data, and a storage policy for tiering local hot data to S3 with a cache."
  - question: "How do I migrate a ClickHouse Cloud schema to open source?"
    answer: "The table engines map one to one: SharedMergeTree to MergeTree, SharedSummingMergeTree to SummingMergeTree, and so on. Rewrite engine names in DDL, remove Cloud-only settings, and export and re-insert the data."
---

The first surprise in self-hosting ClickHouse is a data definition language (DDL) error.

You export a schema from ClickHouse Cloud, or you copy a tutorial that assumes it. Then you paste it onto your own Amazon Elastic Compute Cloud (EC2)-hosted clickhouse-server. The CREATE TABLE fails with `Unknown table engine SharedMergeTree`. The engine you just read about does not exist in the software you installed. That is not a misconfiguration. It is the dividing line between the paid product and the open source project. Understanding it is the first decision in any self-managed deployment on Amazon Web Services (AWS).

I run a log analytics platform on self-managed ClickHouse on AWS. Cloud users get this decision made for them. I had to make it consciously. This post covers what SharedMergeTree actually is, what open source gives you instead, and why the obvious middle path (replicas sharing Amazon Simple Storage Service (S3) objects) was abandoned. Future posts in this series build the real architecture on EC2.

One running example carries the post: a company with branch offices and a head office. Each branch keeps records. The head office keeps one shared list of who has recorded what. The example maps closely onto ClickHouse replication, and each section notes where the picture stops matching the real mechanism.

**Key takeaways**

- SharedMergeTree is ClickHouse Cloud only. Open source DDL with Shared* engines fails with `Unknown table engine`.
- On open source you run ReplicatedMergeTree with a Keeper quorum: one ZooKeeper-style path per table, one named replica per node.
- Zero-copy replication — the 2020s attempt to have replicas share S3 objects — was deprecated upstream in 2025 because orphan files never got cleaned properly.
- The real open-source software (OSS) pattern: ReplicatedMergeTree + Keeper + a storage policy with a local hot disk, an S3 cold tier, and a cache disk in between.
- Engine families map 1:1 between Cloud and OSS (MergeTree→SharedMergeTree, Summing→SharedSumming), so migration is engine-name rewrites plus data export.
{: .key-takeaways}

---

## What SharedMergeTree is, and where it lives

SharedMergeTree is a MergeTree variant with one copy of each part, stored in shared object storage such as S3. Every compute node reads that same copy. Replicas do not copy data to each other; they coordinate through the shared storage plus Keeper, ClickHouse's ZooKeeper-compatible coordination service. Reference: [SharedMergeTree in the Cloud docs](https://clickhouse.com/docs/en/cloud/reference/shared-merge-tree).

Use the branch-office picture. Every branch works from ONE shared filing cabinet in the basement. No branch keeps its own photocopy of the whole cabinet. In ClickHouse terms, the basement cabinet is the S3 bucket, and the branches are compute nodes.

```
ClickHouse Cloud (SharedMergeTree):

  compute node A ─┐
  compute node B ─┼──► one copy of each part in S3
  compute node C ─┘         │
        ▲                   │
        └── Keeper: metadata + coordination
```

What that buys you is elastic scaling and compute-compute separation: you can add a read node in minutes, because there is no data to copy, and you scale compute and storage independently. Adding a branch office is cheap when nobody has to photocopy the cabinet. On Cloud, every MergeTree-family table you create uses it, and the engine names carry a Shared prefix: `SHOW CREATE TABLE` returns `SharedMergeTree`, `SharedSummingMergeTree`, and so on.

On open source, the same DDL fails: the engine is simply not in the build. Reference: [MergeTree family docs](https://clickhouse.com/docs/en/engines/table-engines/mergetree-family/mergetree). The analogy also shows the cost of the cabinet model: every read must walk down to the basement. Cloud hides that latency with caching; a self-managed cluster must plan for it explicitly, which is why the storage-policy section below exists.

## The operator's answer: it's not supported

This is not a bug waiting on a fix. The Altinity maintainers closed the feature request as not planned. From [Altinity/clickhouse-operator#1951](https://github.com/Altinity/clickhouse-operator/issues/1951) (opened April 2026, closed May 2026):

> "SharedMergeTree is not supported by open source ClickHouse. The migration procedure may replace it with ReplicatedMergeTree and vice versa."

The issue is worth reading for the exact friction. Engineers migrating schemas from ClickHouse Cloud to self-hosted clusters on Kubernetes encounter `Unknown table engine SharedMergeTree` on standard clickhouse-server builds. Every CREATE TABLE needs manual refactoring. The maintainers' position: this is a migration step, not a missing feature.

## What you get on open source instead

The open source answer is ReplicatedMergeTree. Same two-argument shape everywhere: a ZooKeeper path for the table and a replica name.

```sql
CREATE TABLE events ON cluster '{cluster}'
(
    timestamp  DateTime,
    service    LowCardinality(String),
    status     UInt16
)
ENGINE = ReplicatedMergeTree('/clickhouse/{shard}/tenant/events', '{replica}')
PARTITION BY (toYYYYMMDD(timestamp), toHour(timestamp))
ORDER BY (timestamp, service)
TTL toDateTime(timestamp) + INTERVAL 30 DAY
```

```
Open source (ReplicatedMergeTree):

  node A: full copy ◄──┐
  node B: full copy ◄──┼── Keeper: replication log + part coordination
                        │
      data ships replica-to-replica, not via shared storage
```

In the branch-office picture, each branch keeps its own full copy of the ledger. The head office (Keeper) keeps a shared to-do list that says "branch X has recorded page 12." When a new branch joins, it reads the to-do list and copies the pages it is missing from another branch. In ClickHouse terms, each branch is a replica with its own full copy of the data, the head office is the Keeper quorum, and the to-do list is the replication log.

The two arguments matter:

- `/clickhouse/{shard}/tenant/events` — the ZooKeeper path identifying the table, the same for every replica. In the picture, the name of the ledger at head office.
- `{replica}` — a name substituted per server from its config, so each node's copy is identifiable in the replication log. In the picture, the branch name on the to-do list.

Reference: [Replicated* table engines](https://clickhouse.com/docs/en/engines/table-engines/mergetree-family/replication).

The hard dependency is [ClickHouse Keeper](https://clickhouse.com/docs/en/operations/clickhouse-keeper): the coordination service storing the replication log, part metadata, and leader elections. It is mandatory for ReplicatedMergeTree — there is no configuration where replicas coordinate without a Keeper (or ZooKeeper) quorum, and a three-node quorum tolerates one node failure. Plan for Keeper before you plan for ClickHouse itself: without Keeper, replicated tables go read-only, and an under-provisioned Keeper is a common self-managed outage. The analogy holds here too: if head office loses the to-do list, the branches cannot safely record new pages, so they stop writing.

Replication is asynchronous. A node that was down during inserts fetches missed parts from another replica after it returns. You get eventual consistency across replicas, not synchronous mirroring — like a branch that was closed for a day catching up by copying missed pages later.

## The zero-copy history lesson

There is an obvious-sounding middle path between full copies and Cloud's shared storage: keep ReplicatedMergeTree, but have replicas share the S3 objects instead of each downloading full parts. It was tried. It is called zero-copy replication, and it was deprecated upstream in 2025. Reference: [ClickHouse pull request (PR) #82250](https://github.com/ClickHouse/ClickHouse/pull/82250), "Remove tests for zero-copy replication" (merged July 2025).

Why it failed is worth knowing, because it explains the whole design space:

```
Zero-copy replication (deprecated):

  replica A ─┐
  replica B ─┼──► shared S3 objects ──► dedupe by reference
             ┘
  problem: S3 metadata + per-replica local state + Keeper bookkeeping
           could not stay transactionally in sync
```

In the branch-office picture, the old system tried this: branch 2 says to branch 1, "do not photocopy page 12 for me. I will read your original, on your shelf, without moving it." The problem: nobody kept track of who was still reading which page. When branch 1 wanted to throw a page away, it could not tell whether another branch still needed it. Pages nobody owned never got thrown away. Those are the *orphan files*.

In ClickHouse terms, three systems had to agree: the S3 objects, each replica's local reference state (which parts it logically has), and the per-replica bookkeeping in Keeper. No transaction spanned all three, so parts got deleted from S3 while another replica still referenced them (or the reverse), and garbage collection could not tell live references from stale ones. Altinity's [introducing Content-Addressed Storage (CAS)](https://altinity.com/blog/introducing-cas-drop-in-compute-storage-separation-for-clickhouse-mergetree-tables) post tells the same story and links Tinybird's write-up of the orphan-objects problems users hit in production.

The lesson generalizes: sharing mutable state between replicas over object storage is a correctness problem, not a performance problem. Cloud solves it with a different architecture, SharedMergeTree's single copy with one writer path. It does not solve it by attaching sharing onto ReplicatedMergeTree.

## The real OSS pattern: replication + storage tiering

So what does the rest of this series build? Not S3-shared parts. The architecture is:

- **ReplicatedMergeTree** for every table, with the two-argument shape above.
- **Keeper** as the mandatory coordination quorum (3 nodes, tolerating 1 failure).
- **A storage policy** with a local hot disk (solid-state drive (SSD)-backed) for recent parts, an S3 cold tier for older parts, and a cache disk in front of S3 so repeated cold reads are served from the cache, not from S3.

```
Storage policy tiering:

  hot part (today)   ──► local NVMe/SSD
  cold part (30d old) ──► S3
                          ▲
  repeated cold read ─────┘── served from cache disk, not S3
```

Back to the filing room. Keep today's pages in your own desk drawer. Keep the archive in the basement. But leave pages you looked at yesterday on top of your desk. In ClickHouse terms, the desk drawer is the local SSD, the basement is S3, and the desk-top stack is the cache disk.

The trade-off is clear. You lose Cloud's instant elastic scale: adding a replica means copying data over the network. You gain full control of cost, placement, and retention. For a log platform with a predictable ingest rate and a 30-day time-to-live (TTL), the trade-off favors self-managing, which is the subject of the posts that follow.

## Migration is engine-name rewrites plus data export

One thing makes Cloud→OSS migration tractable: the engine families map one to one.

| Cloud engine | OSS engine |
|--------------|------------|
| SharedMergeTree | MergeTree / ReplicatedMergeTree |
| SharedSummingMergeTree | SummingMergeTree |
| SharedReplacingMergeTree | ReplacingMergeTree |
| SharedAggregatingMergeTree | AggregatingMergeTree |

So a Cloud schema export becomes four steps: rewrite the engine name, drop Cloud-only settings, re-create the table on the OSS cluster, then export data from Cloud (INSERT SELECT over a table function, or clickhouse-client dumps) and re-insert in reasonably large batches. The DDL is the easy half; the data movement is where you spend time. The part/merge/index machinery from the [first post](/blog/clickhouse-mergetree-mental-model/) is identical on both sides. Only the engine name and replication plumbing differ.

## Decision matrix

| Option | What you run | Effort | Scaling story |
|--------|---------------|--------|---------------|
| ClickHouse Cloud | SharedMergeTree (automatic) | Buy | Metered, elastic, compute-compute separation included by default |
| OSS on EC2 | ReplicatedMergeTree + Keeper | Build | Add replicas by copying data; storage tiering via storage policies |

A third option is emerging: Altinity CAS. CAS separates compute and storage, offered as a drop-in MergeTree extension; it is experimental as of September 2026, in the Antalya 26.6 release. It is the open source answer to shared storage. In the branch-office picture, CAS stamps every page with a fingerprint of its *content* — the same idea as the tracking number on a parcel, or the commit hash in git. Any branch can look up a page by its fingerprint, so duplicate copies disappear naturally, and two identical pages are recognized as one. In ClickHouse terms, the fingerprint is a content-addressed part reference: any node can find the single copy in shared storage without a per-replica ledger of borrowed originals. CAS is not what this series builds on: it is too new to be safe for a production log platform. Full coverage in the final post of the series: [What's next: CAS and Iceberg](/blog/clickhouse-whats-next-cas-iceberg/).

Next: cluster topology and sizing Keeper and shards on AWS. [ClickHouse cluster topology and Keeper sizing](/blog/clickhouse-cluster-topology-keeper/).

---

*Cloud gives you SharedMergeTree automatically. Open source gives you ReplicatedMergeTree plus a Keeper quorum you operate yourself. Choose deliberately, knowing that difference.*

Previous: [A Junior Engineer's Guide to ClickHouse: The MergeTree Mental Model](/blog/clickhouse-mergetree-mental-model/). Next: [ClickHouse cluster topology and Keeper sizing](/blog/clickhouse-cluster-topology-keeper/).

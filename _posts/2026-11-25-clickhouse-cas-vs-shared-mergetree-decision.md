---
layout: post
title: "CAS, SharedMergeTree, or Plain Replication: How to Actually Decide"
date: 2026-11-25 09:00:00 -0800
series: "ClickHouse on AWS: Self-Managed from First Principles"
series_order: 25
description: "A decision framework for shared storage in ClickHouse: ReplicatedMergeTree on S3, Altinity Antalya CAS, or ClickHouse Cloud SharedMergeTree — with the costs, failure modes, and exit costs of each."
image: /assets/images/og-default.png
tags: [clickhouse, cas, architecture, decision-making, s3, finops]
permalink: /blog/clickhouse-cas-vs-shared-mergetree-decision/
faqs:
  - question: "Is CAS a replacement for SharedMergeTree?"
    answer: "It solves the same problem — one copy of the bytes for many replicas — but it is not the same system. SharedMergeTree is Cloud-only, closed source, and coordinates through ClickHouse Cloud's control plane. CAS is open source (Apache-2.0, Altinity Antalya), object-store based, and keeps ReplicatedMergeTree semantics."
  - question: "Should a greenfield project start with CAS?"
    answer: "Only if you can tolerate experimental software and you have a real replica-multiplier cost problem. Start with plain ReplicatedMergeTree on S3 with per-replica prefixes; adopt CAS for the cold tier when the S3 line item justifies it."
  - question: "How much does CAS actually save?"
    answer: "It removes the (replicas − 1) × cold-bytes term. For 3 replicas and 20 TB of cold data, roughly 40 TB of S3 storage and its request/IA costs. It saves nothing on compute, Keeper, EBS metadata disks, or backups."
  - question: "What is the exit cost if CAS goes wrong?"
    answer: "Move the affected partitions back with ALTER TABLE ... MOVE PARTITION TO DISK, then disable cas_config. No export, no re-ingest. The data is ordinary parts throughout."
---

By now the mechanism is clear from the previous posts. What remains is the decision. This is the framework I would use in a design review — weighted the way a bill-paying engineer would, not the way a benchmark author would.

**Key takeaways**

- Plain replication is the right default. CAS is a cost optimization for the cold tier, gated on evidence.
- CAS wins when the storage multiplier is your dominant cost and you can run experimental software deliberately.
- SharedMergeTree wins when you would rather pay ClickHouse to own the problem and you accept Cloud lock-in.
- The decision is reversible in one direction only if you design for it up front (disks and policies, not engine rewrites).
{: .key-takeaways}

---

## The three options

| | ReplicatedMergeTree + S3 | CAS (Antalya) | SharedMergeTree (Cloud) |
|---|---|---|---|
| Where the bytes live | 1 copy per replica | 1 copy per unique blob | 1 copy, managed |
| Source | upstream OSS | Altinity Antalya OSS (experimental) | ClickHouse Cloud only |
| Coordination | Keeper (replication log) | Keeper (unchanged) + pool-internal leases/GC in S3 | Cloud control plane |
| DDL | `ON CLUSTER` | `ON CLUSTER` (unchanged) | Cloud semantics; engines are `Shared*` |
| Maturity | boring, battle-tested | experimental; format may change | GA in Cloud |
| Cost model | S3 × replica count | S3 × 1 (+ request overhead during folds) | Metered storage + compute |
| Lock-in | none | low (data is ordinary parts) | high (`SHOW CREATE TABLE` shows engines that don't exist in OSS) |
| Exit | trivial | `MOVE PARTITION` back | export + DDL rewrite |

## Decision questions, in order

**1. Is your S3 line item actually the problem?**
If compute and Keeper dominate, stop here. CAS optimizes bytes, not anything else. Pull the last three months of S3 storage by prefix and compute `bytes × (replicas − 1) × price`. If that number is not worth engineering time, you are done.

**2. Is your replication layer healthy?**
If `ON CLUSTER` DDL is flaky, Keeper has drift, or replicas flap, fix that first. CAS inherits the replication substrate; it does not stabilize it. The [failure-modes post](/blog/clickhouse-cas-failure-modes/) shows what "broken underneath" looks like.

**3. Can you operate experimental software deliberately?**
CAS means: pinned builds, a staging pool, release-note reading, `cas_gc_log` in your dashboards, and a rollback plan you have actually executed. If your org cannot do that, you have your answer.

**4. Do you need other engines to read the same data?**
If Spark/DuckDB/Trino must scan the table in place, neither CAS nor ReplicatedMergeTree is the answer — that is Iceberg territory, a different trade (open format, external catalog, no ClickHouse-native merges).

**5. Would you rather pay someone?**
ClickHouse Cloud exists for teams who looked at items 1–4 and decided their time was worth more than the invoice delta. That is a legitimate answer, and it comes with SharedMergeTree, no Keeper to run, and no DDL fan-out to debug. The cost is meters you cannot turn off and DDL you cannot take with you.

## A scoring sheet you can argue with

Weight each 0–3, multiply, sum per column. It is not scientific; it makes the implicit explicit.

| Criterion (weight) | Replicated | CAS | SharedMT |
|---|---|---|---|
| Cold-tier storage cost (3) | 0 | 9 | 9 |
| Operational risk (3, higher=better/safer) | 9 | 5 | 9 |
| Exit cost / portability (2) | 6 | 5 | 1 |
| Feature velocity / support (1) | 2 | 1 | 3 |
| Fit with existing IaC & IAM (1) | 3 | 2 | 0 |
| **Total** | **17** | **17** | **22** |

Flip the storage weight and CAS wins decisively; flip the risk weight and plain replication does. The point is not the number — it is that the decision moves with your weights, and you should be able to say which weights you used out loud.

## The adoption path I would actually take

1. **Today:** per-replica S3 prefixes, `TTL ... TO VOLUME 'cold'`, tenant policies, per-partition accounting. Zero new risk. Most clusters stop here and should.
2. **When storage cost shows up on a budget review:** add CAS disks *alongside* existing ones, no table touched. Verify mounts on every node.
3. **Pilot:** one cold, low-traffic table; `MOVE PARTITION` one partition; measure S3 bytes before/after and GC behavior for two weeks.
4. **Expand:** tenant by tenant. Keep `cas_config` in git. Review the GC log weekly until it is boring.
5. **Never:** big-bang migration, mixed-version CAS fleets, CAS as primary storage for hot data.

## What I would tell a team adopting this quarter

Budget two weeks of platform work before the first partition moves: AMI build, bucket preconditions, IAM scoping, monitoring, rollback rehearsal, and one page of runbook. The software is ready to try. Your control plane probably is not, and that is where the time goes.

## References

- Altinity Antalya CAS: <https://altinity.com/blog/introducing-cas-drop-in-compute-storage-separation-for-clickhouse-mergetree-tables>
- Docs: <https://docs.altinity.com/altinityantalya/>
- Cloud SharedMergeTree: <https://clickhouse.com/docs/cloud/managing-services/shared-merge-tree>
- Previous: [zero-copy](/blog/clickhouse-zero-copy-replication-dead/) · [object model](/blog/clickhouse-cas-object-model/) · [walkthrough](/blog/clickhouse-cas-on-aws-walkthrough/) · [failure modes](/blog/clickhouse-cas-failure-modes/)

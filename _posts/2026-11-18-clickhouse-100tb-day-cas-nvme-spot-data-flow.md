---
layout: post
title: "100 TB/Day ClickHouse on AWS: Continuous Spot Data Flows, NVMe Cache, and CAS Cold-Tier Cost"
date: 2026-11-18 17:00:00 -0800
series: "ClickHouse on AWS: Self-Managed from First Principles"
series_order: 45
description: >-
  An interactive D3 walkthrough of a 100 TB/day (3.04 PB/month) self-managed
  ClickHouse cluster on AWS running 100% Spot writers, 100% Spot NVMe-cached
  readers, NVMe hot-path compaction, and Altinity Antalya CAS — with exact
  7-day and 33-day cluster cost math ($0.0014/GB to $0.0026/GB).
tags: [clickhouse, cas, aws, s3, nvme, spot-instances, finops, architecture, d3]
permalink: /blog/clickhouse-100tb-day-cas-nvme-spot-data-flow/
faqs:
  - question: "How does a 100 TB/day self-managed ClickHouse cluster handle Spot reclaims on both writers and readers?"
    answer: >-
      Keepers stay On-Demand (3-node Raft quorum) while BOTH writers and readers
      run on diversified Graviton Spot pools and can be reclaimed at any given
      time. When EC2 issues a 2-minute Spot interruption notice to a writer or
      reader, the NLB health check (/replicas_status) drains traffic in 30
      seconds to surviving replicas. Committed hot parts are already replicated
      intra-AZ over :9010, and aged parts live in 1x S3 CAS. The replacement
      Spot instance claims its ordinal slot and deterministic server UUID in
      DynamoDB, formats its local NVMe disk, and relinks cold S3 parts via
      CA_RELINK_COOKIE in ~2–3 seconds with zero bytes copied.
  - question: "How does the NVMe disk assist the hot path on Spot writers as well as readers?"
    answer: >-
      On 100 TB/day writers, MergeTree background merges and synchronous
      Materialized Views write large sequential blocks (127–242 KB) that easily
      saturate standard gp3 EBS bandwidth and stall CPUs at >65% %iowait.
      Using local NVMe instance-store disks (*gd Spot pools) on the writer hot
      path delivers multi-GB/s sequential throughput (~2–4x gp3) at $0 extra EBS
      cost, absorbs burst inserts and ~1 GiB wide-part ZSTD compaction without
      %iowait stalls, serves write-through hot queries locally, and disappears
      cleanly with the VM on Spot termination (zero orphan EBS volumes).
  - question: "What does 100 TB/day (3.04 PB/month) cost with Spot compute, NVMe hot/read cache, and CAS?"
    answer: >-
      At 15.2x ZSTD compression (6.58 TB/day compressed), the ClickHouse + CAS
      cluster costs ~$4,314/month at 7-day retention ($0.0014/GB) and
      ~$8,041/month at 33-day retention ($0.0026/GB). Compared to an unsharded
      10-replica non-CAS cluster ($47,862/month in cold S3 alone at 33 days),
      CAS saves ~$43,076/month (~$517k/year).
  - question: "Why keep hot parts on local NVMe for writers instead of writing directly to S3?"
    answer: >-
      Setting perform_ttl_move_on_insert = false lets high-rate batched inserts
      commit on local NVMe without waiting on S3 PUT latency, and compacts
      hundreds of small parts into ~1 GiB wide parts at multi-GB/s disk
      bandwidth before aging them once (1x) to the shared CAS pool. This
      eliminates EBS %iowait bottlenecks and prevents million-request S3 Tier-1
      PUT storms.
---

Static architecture diagrams hide the thing engineers actually need to reason about: **continuous motion across roles**. At **100 TB/day (`3,040,000 GB/month`)**, four coupled roles run simultaneously every second—**100% Spot writers** ingesting and compacting parts on local **NVMe hot disks**, a Keeper Raft quorum ordering metadata, cold blobs deduplicating into a shared content-addressed S3 pool, and **100% Spot readers** serving queries straight off local NVMe SSDs.

Because **both writers and readers run on Spot instances**, any writer or reader can be reclaimed by EC2 at any given time. Below is an interactive, color-coded D3 simulation grounded in our production-validated AWS architecture (with all internal cluster names, account IDs, and private domains abstracted). Every role streams continuously in parallel—or you can isolate any section, switch between **7-day** and **33-day** retention costs, and click **Reclaim Spot Writer** or **Reclaim Spot Reader** to watch how NLB drain, DynamoDB leases, local NVMe disks, and zero-byte CAS relinks recover in seconds.

**Key takeaways**

- **Every role is continuously active — and both fleets are 100% Spot**: **10 Spot writers** ingest `~590k rows/sec` over TLS onto local **NVMe hot disks**, compact `15.2×` ZSTD wide parts, and replicate intra-AZ (`:9010`) while **6 Spot NVMe readers** concurrently serve queries from RAM and local NVMe `cas_cache`.
- **Writers can be reclaimed at any time without losing data**: On a 2-minute EC2 Spot notice, NLB `/replicas_status` drains new inserts to surviving writers, already-committed hot parts are safe on peer replicas via `:9010`, cold parts are durable in `1×` S3 CAS, and the replacement Spot writer claims its `writer-N` DynamoDB lease, attaches `1×` CAS in `~2.4s`, and syncs recent hot deltas.
- **NVMe instance-store disks accelerate the hot path and eliminate EBS bottlenecks**: Bundled `*gd` NVMe SSDs deliver multi-GB/s throughput (`~2–4×` `gp3`) at `$0` extra EBS cost—eliminating `%iowait` disk-bandwidth stalls during `~1 GiB` MergeTree compactions on writers, keeping write-through hot reads off S3, and leaving zero orphan EBS volumes when a Spot node terminates.
- **100 TB/day ClickHouse + CAS cost drops to `$0.0014/GB` (`7d`) and `$0.0026/GB` (`33d`)**: Combining diversified Graviton `*gd` Spot writers and readers, NVMe hot & cache disks, the free S3 Gateway Endpoint, and `1×` CAS cold storage saves **`$43,076/month` (`~$517k/year`)** at 33-day retention compared to `10×` per-replica S3 copies.
{: .key-takeaways}

---

## Live 100 TB/Day Architecture Simulation

Use the color-coded tabs to inspect each subsystem, toggle **7d / 33d Retention** to see the live monthly cost shift, or click **Reclaim Spot Writer** / **Reclaim Spot Reader** to trace a 2-minute Spot interruption and zero-byte CAS recovery.

<div id="ch-100tb-cas-flow"></div>
<script defer src="/assets/js/clickhouse-100tb-cas-flow.js"></script>

---

## 1. Color-Coded Walkthrough: What Happens in Each Role

### 1. Writers Fleet · 100% Spot Replicas & NVMe Hot Path (Orange)

- **100% Spot writers (reclaimable at any time)**: Writers run on `10×` 16-vCPU / 64 GiB `*gd` Graviton Spot instances spread across multiple instance families (`capacity-optimized` allocation, capacity rebalancing enabled) behind `ingest.clickhouse.example:8443` (ACM TLS terminated at the NLB). Any writer can receive a 2-minute Spot interruption notice at any moment; `/replicas_status` drains new inserts away in `30s` while surviving writers continue ingesting uninterrupted.
- **How the NVMe disk assists the hot path**: In load tests at high ingest rates, MergeTree background merges (`127–242 KB` sequential blocks) saturated standard `gp3` EBS bandwidth (`125 MB/s`) and stalled vCPUs at **`>65% %iowait`** long before hitting IOPS limits. Putting the hot-path buffer and write-through `cas_cache` on the writer's bundled local **NVMe SSD (`~950 GB` on `16-vCPU *gd`, `$0` extra EBS)** provides **`~2–4×` `gp3` sequential bandwidth**, absorbing `100 TB/day` burst inserts, `3` synchronous Materialized Views, and `~1 GiB` wide-part ZSTD compactions with virtually zero `%iowait` stalls.
- **Metadata safety & intra-AZ `:9010` sync**: Only a small `128 GB gp3` volume (`delete_on_termination = true`) holds the parts catalog/metadata (`$102/mo` total across 10 writers). ZSTD compacts `100 TB/day` raw down to **`6.58 TB/day` (`15.2×`)**, and committed hot parts replicate immediately between writers and readers over interserver TLS (`:9010`) inside a single AZ at **`$0.00/GB`** so an abrupt Spot reclaim never loses committed blocks.

### 2. Keeper Quorum, DynamoDB Spot Leases & Backup (Emerald)

- **3-Node On-Demand Keeper quorum (`:9181`)**: Unlike writers and readers, Keepers never run on Spot. Three 2-vCPU / 8 GiB nodes on dedicated `gp3` Raft volumes survive a rolling node replacement without losing write quorum.
- **DynamoDB node claims (`ch-node-claims`)**: When any Spot writer or reader terminates and a replacement boots, `chinit` executes a conditional DynamoDB write to claim an ordinal slot (`writer-N` / `reader-N`) and writes a deterministic server UUID so CAS mount ownership never hits `Code: 246` conflicts.
- **Nightly isolated backup**: An on-demand backup replica wakes at `02:00 UTC`, syncs metadata, writes tar snapshots to a separate versioned/object-locked backup bucket, and self-stops.

### 3. CAS Cold Pool & Lifecycle (Purple) — 1× Storage + Zero-Byte Relink

- **Free S3 Gateway Endpoint (`$0.00/GB`)**: All ClickHouse-to-S3 traffic rides the regional VPC Gateway Endpoint, avoiding **`$18,000+/month`** in `$0.045/GB` NAT Gateway data-processing charges.
- **1× Shared XXH3-128 Pool**: Under `tiered_cas` (`perform_ttl_move_on_insert = false`), merged `~1 GiB` wide parts age off the NVMe hot path (`TTL +1–7d` or `move_factor = 0.1` pressure spill), hash into `XXH3-128` blobs, and upload **once** (`1×`) into an unversioned S3 CAS bucket (`s3://org-ch-cas-cold-pool/cas/`) with **no `{replica}` segment** in the path.
- **Zero-byte relink (`CA_RELINK_COOKIE`)**: Replacement Spot writers and Spot readers never copy gigabytes of cold history over `:9010`. They verify `HEAD` on S3 and attach the manifest in **`~2–3 seconds`** with **`0 bytes`** transferred; writers then pull only recent un-aged hot delta parts over `:9010`.
- **GC & Lifecycle**: An elected CAS GC leader folds ref-logs every `300s` (`cas_gc_interval_sec = 300`) using S3 `If-Match` conditional writes. S3 lifecycle transitions cold objects to `Standard-IA` (`$0.0125/GB`) at `30` days before whole-part `TTL` expiry at `32–33` days.

### 4. Readers Fleet · 100% Spot Replicas & NVMe Instance-Store Cache (Sky Blue)

- **Read-only Spot fleet behind `/replicas_status`**: Query clients (`query.clickhouse.example:8443`) hit an NLB target group gated by `HTTP :8123/replicas_status`, ensuring newly booted Spot readers finish relinking before serving traffic.
- **Why NVMe instance store is ideal here**: Readers run `6×` 4-vCPU / 16 GiB Graviton NVMe Spot instances (`*gd` pool). Each instance ships with local NVMe SSDs included at **`$0` extra EBS cost** and **`~2×` `gp3` throughput**, which `chinit` formats and mounts automatically as `cas_cache`.
- **Hot vs. Cold query split**: Hot queries resolve in RAM (`5 GiB` mark cache + `8 GiB` uncompressed cache) or local NVMe `cas_cache` (`~95%+` hit rate). Cache misses fetch byte ranges from the CAS S3 pool via the free Gateway Endpoint and warm NVMe for subsequent queries.

---

## 2. 100 TB/Day Cost Breakdown (`3,040,000 GB/Month`, `us-west-2`)

Using our measured **`15.2×` ZSTD** compression ratio, `100 TB/day` produces **`6.58 TB/day` (`6,579 GB/day`)** of net compressed ClickHouse data:
- **7-day cold pool (`1×` CAS)**: `46.1 TB` (`46,053 GB`) in S3 Standard (`$0.023/GB-mo`) = **`$1,059/month`**
- **33-day cold pool (`1×` CAS)**: `30d` in S3 Standard (`$4,540/mo`) + `3d` in Standard-IA (`$247/mo`) = **`$4,786/month`** (`217.1 TB`)

| Cost Line Item (100 TB/day = 3.04M GB/mo) | 7-Day Retention | 33-Day Retention | Notes & Cost Levers |
|---|---|---|---|
| **Writers Fleet (`10×` 16-vCPU / 64 GiB `*gd` Spot)** | `$1,900/mo` | `$1,900/mo` | `100%` Spot across 3 Graviton `*gd` families; **`$0` NVMe hot disk** |
| **Writer Metadata EBS (`10×` 128 GB `gp3`)** | `$102/mo` | `$102/mo` | Catalog only (`delete_on_termination=true`); hot/merge path rides NVMe |
| **Readers Fleet (`6×` 4-vCPU / 16 GiB `*gd` Spot)** | `$330/mo` | `$330/mo` | `100%` Spot (`*gd` NVMe pool); `NVMe cas_cache` = **`$0` EBS** |
| **Reader Metadata EBS (`6×` 64 GB `gp3`)** | `$31/mo` | `$31/mo` | Small catalog disk only (`cas_cache` rides local NVMe) |
| **Keeper Quorum (`3×` 2-vCPU / 8 GiB On-Demand)** | `$162/mo` | `$162/mo` | On-Demand Raft quorum + dedicated `64 GB gp3` fsync disks |
| **CAS Cold S3 Pool (`1×` Shared XXH3-128)** | **`$1,059/mo`** | **`$4,786/mo`** | `46.1 TB` @ 7d · `217.1 TB` @ 33d (30d Std + 3d IA) |
| **S3 API Requests (Wide Parts + `gc_interval=300s`)** | `$580/mo` | `$580/mo` | `~1 GiB` wide parts + 300s GC folding keep Tier-1 PUTs low |
| **NLBs + `warning` CW Logs + DynamoDB + Backup** | `$150/mo` | `$150/mo` | Verbose logs stay local in ZSTD `system.text_log`; S3 Gateway = `$0/GB` |
| **Total ClickHouse + CAS Cluster (`100 TB/day`)** | **`$4,314/mo`** | **`$8,041/mo`** | **`$0.0014/GB` (`0.14¢/GB`)** @ 7d · **`$0.0026/GB` (`0.26¢/GB`)** @ 33d |

### What CAS + Spot + NVMe Saves at 100 TB/Day

| Architecture Variant (33-Day Retention, 100 TB/day) | Cold S3 Storage | Total Cluster Cost | Savings vs. Non-CAS 10× |
|---|---|---|---|
| **Non-CAS Unsharded (`10×` per-replica S3 copies)** | `$47,862/mo` | `~$51,117/mo` | Baseline |
| **Non-CAS Sharded (`S = 5` shards × `r = 3` = `3×` S3)** | `$14,359/mo` | `~$17,614/mo` | `-$33,503/mo` (`-66%`) |
| **Antalya CAS (`1×` S3) + 100% Spot + NVMe Hot/Read** | **`$4,786/mo`** | **`~$8,041/mo`** | **`-$43,076/mo` (`-84%`)** |

At `100 TB/day`, moving both **hot-path compaction** and **cold-read caching** onto free **NVMe instance-store disks**, running **100% Spot compute** for writers and readers alike, and deduplicating cold S3 into a **`1×` CAS pool** turns a `$51.1k/month` storage-bound cluster into a **`$4.3k–$8.0k/month`** elastic system under **`0.26¢/GB`**.

Previous: [Three Generations of a 30 TB/Day ClickHouse Fleet: Non-CAS vs. CAS, What Broke, and a Blueprint for Self-Managed S3](/blog/clickhouse-fleet-evolution-non-cas-to-cas-blueprint/). Series index: [ClickHouse on AWS: Self-Managed from First Principles](/series/clickhouse-on-aws/).

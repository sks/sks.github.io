---
layout: post
title: "100 TB/Day ClickHouse on AWS: Continuous Spot Data Flows, NVMe Cache, and CAS Cold-Tier Cost"
date: 2026-11-18 17:00:00 -0800
series: "ClickHouse on AWS: Self-Managed from First Principles"
series_order: 45
description: >-
  An interactive D3 walkthrough of a 100 TB/day (3.04 PB/month) self-managed
  ClickHouse cluster on AWS with On-Demand writer-0 (backup-wake coordinator),
  Spot writer-1..9 and NVMe-cached Spot readers, NVMe hot-path compaction, and
  Altinity Antalya CAS — with exact 7-day and 33-day cluster cost math
  ($0.0015/GB to $0.0028/GB).
tags: [clickhouse, cas, aws, s3, nvme, spot-instances, finops, architecture, d3]
permalink: /blog/clickhouse-100tb-day-cas-nvme-spot-data-flow/
faqs:
  - question: "Why does writer-0 stay On-Demand while writer-1..9 and all readers run on Spot?"
    answer: >-
      writer-0 is the cluster's ordinal-0 maintenance and backup coordinator: it
      triggers `chinit backup-wake` on schedule (02:00 UTC) to wake the
      on-demand backup replica (`backup-0`), and runs dead-replica GC, orphan
      volume sweeps, and autoscale coordination. Pinning
      `writer_spot_on_demand_base_capacity = 1` in the writers ASG keeps
      writer-0 On-Demand (never Spot-reclaimed) while letting writer-1..9 and
      reader-0..5 run 100% Spot on diversified Graviton *gd pools. When EC2
      reclaims any Spot writer or reader with a 2-minute notice, NLB
      /replicas_status drains traffic in 30s, committed hot parts stay safe via
      :9010 replication, and the replacement claims its DynamoDB lease,
      formats its NVMe disk, and relinks 1x S3 CAS parts in ~2-3 seconds.
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
      cluster (including On-Demand writer-0 and 3x On-Demand Keepers) costs
      ~$4,704/month at 7-day retention ($0.0015/GB) and ~$8,638/month at 33-day
      retention ($0.0028/GB, kept in S3 Standard to avoid Standard-IA's 30-day
      minimum early-deletion fee). Compared to an unsharded 10-replica non-CAS
      cluster ($49,934/month in cold S3 alone at 33 days), CAS saves
      ~$44,941/month (~$539k/year).
  - question: "Why keep hot parts on local NVMe for writers instead of writing directly to S3?"
    answer: >-
      Setting perform_ttl_move_on_insert = false lets high-rate batched inserts
      commit on local NVMe without waiting on S3 PUT latency, and compacts
      hundreds of small parts into ~1 GiB wide parts at multi-GB/s disk
      bandwidth before aging them once (1x) to the shared CAS pool. This
      eliminates EBS %iowait bottlenecks and prevents million-request S3 Tier-1
      PUT storms.
---

Static architecture diagrams hide the thing engineers actually need to reason about: **continuous motion across roles**. At **100 TB/day (`3,040,000 GB/month`)**, four coupled roles run simultaneously every second—**`writer-0` On-Demand + Spot `writer-1..9`** ingesting and compacting parts on local **NVMe hot disks**, a Keeper Raft quorum ordering metadata, cold blobs deduplicating into a shared content-addressed S3 pool, and **100% Spot readers** serving queries straight off local NVMe SSDs.

While **`writer-0` stays pinned On-Demand** (`on_demand_base_capacity = 1`) because it triggers nightly `backup-wake` for `backup-0` and coordinates cluster maintenance, **`writer-1..9` and all readers run on Spot instances** and can be reclaimed by EC2 at any given time. Below is an interactive, color-coded D3 simulation grounded in our production-validated AWS architecture (with all internal cluster names, account IDs, and private domains abstracted). Every role streams continuously in parallel—or you can isolate any section, switch between **7-day** and **33-day** retention costs, and click **Reclaim Spot Writer** or **Reclaim Spot Reader** to watch how NLB drain, DynamoDB leases, local NVMe disks, and zero-byte CAS relinks recover in seconds.

**Key takeaways**

- **`writer-0` stays On-Demand (starts nightly backup); `writer-1..9` & all readers run 100% Spot**: `writer-0` is pinned On-Demand (`writer_spot_on_demand_base_capacity >= 1` in Terraform) so `chinit backup-wake` (`02:00 UTC`), dead-replica GC, and orphan sweeps are never interrupted by Spot preemption, while **9 Spot writers** and **6 Spot NVMe readers** absorb scale-out at Spot pricing.
- **Spot `writer-1..9` & `reader-0..5` can be reclaimed at any time without losing data**: On a 2-minute EC2 Spot notice, NLB `/replicas_status` drains traffic to surviving nodes (`writer-0` stays live), already-committed hot parts are safe on peer replicas via `:9010`, cold parts are durable in `1×` S3 CAS, and the replacement Spot instance claims its DynamoDB lease, attaches `1×` CAS in `~2.4s`, and syncs recent hot deltas.
- **NVMe instance-store disks accelerate the hot path and eliminate EBS bottlenecks**: Bundled `*gd` NVMe SSDs deliver multi-GB/s throughput (`~2–4×` `gp3`) at `$0` extra EBS cost—eliminating `%iowait` disk-bandwidth stalls during `~1 GiB` MergeTree compactions on writers, keeping write-through hot reads off S3, and leaving zero orphan EBS volumes when a Spot node terminates.
- **100 TB/day ClickHouse + CAS cost drops to `$0.0015/GB` (`7d`) and `$0.0028/GB` (`33d`)**: Combining On-Demand `writer-0` with diversified Graviton `*gd` Spot `writer-1..9` and readers, NVMe hot & cache disks, the free S3 Gateway Endpoint, and `1×` CAS cold storage saves **`$44,941/month` (`~$539k/year`)** at 33-day retention compared to `10×` per-replica S3 copies.
{: .key-takeaways}

---

## Live 100 TB/Day Architecture Simulation

Use the color-coded tabs to inspect each subsystem, toggle **7d / 33d Retention** to see the live monthly cost shift, or click **Reclaim Spot Writer** / **Reclaim Spot Reader** to trace a 2-minute Spot interruption and zero-byte CAS recovery.

<div id="ch-100tb-cas-flow"></div>
<script defer src="/assets/js/clickhouse-100tb-cas-flow.js"></script>

---

## 1. Color-Coded Walkthrough: What Happens in Each Role

### 1. Writers Fleet · On-Demand `writer-0` + Spot `writer-1..9` & NVMe Hot Path (Orange)

- **On-Demand `writer-0` + Spot `writer-1..9` (`writer_spot_on_demand_base_capacity = 1`)**: The 10-writer fleet runs `16-vCPU / 64 GiB *gd` Graviton instances behind `ingest.clickhouse.example:8443` (ACM TLS terminated at the NLB). **`writer-0` stays pinned On-Demand** in the writers ASG `mixed_instances_policy` because it acts as the ordinal-0 coordinator responsible for starting `backup-0` (`chinit backup-wake` at `02:00 UTC`), running `dead-replica-gc`/`orphaned-gc`, and driving vertical autoscale steps. Above that 1-node floor, **`writer-1..9` run 100% Spot** across 3 `*gd` families (`capacity-optimized`, reclaimable anytime) — on a 2-min notice, `/replicas_status` drains new inserts in `30s` to `writer-0` and surviving Spot writers.
- **How the NVMe disk assists the hot path**: In load tests at high ingest rates, MergeTree background merges (`127–242 KB` sequential blocks) saturated standard `gp3` EBS bandwidth (`125 MB/s`) and stalled vCPUs at **`>65% %iowait`** long before hitting IOPS limits. Putting the hot-path buffer and write-through `cas_cache` on the writer's bundled local **NVMe SSD (`~950 GB` on `16-vCPU *gd`, `$0` extra EBS)** provides **`~2–4×` `gp3` sequential bandwidth**, absorbing `100 TB/day` burst inserts, `3` synchronous Materialized Views, and `~1 GiB` wide-part ZSTD compactions with virtually zero `%iowait` stalls.
- **Metadata safety & intra-AZ `:9010` sync**: Only a small `128 GB gp3` volume (`delete_on_termination = true`) holds the parts catalog/metadata (`$102/mo` total across 10 writers). ZSTD compacts `100 TB/day` raw down to **`6.58 TB/day` (`15.2×`)**, and committed hot parts replicate immediately between writers and readers over interserver TLS (`:9010`) inside a single AZ at **`$0.00/GB`** so an abrupt Spot reclaim never loses committed blocks.

### 2. Keeper Quorum, DynamoDB Spot Leases & Backup (Emerald)

- **3-Node On-Demand Keeper quorum (`:9181`)**: Unlike writers and readers, Keepers never run on Spot. Three 2-vCPU / 8 GiB nodes on dedicated `gp3` Raft volumes survive a rolling node replacement without losing write quorum.
- **DynamoDB node claims (`ch-node-claims`)**: When any Spot writer or reader terminates and a replacement boots, `chinit` executes a conditional DynamoDB write to claim an ordinal slot (`writer-N` / `reader-N`) and writes a deterministic server UUID so CAS mount ownership never hits `Code: 246` conflicts.
- **Nightly isolated backup (`writer-0` → `backup-0`)**: On-Demand `writer-0` invokes `chinit backup-wake` at `02:00 UTC` to wake the stopped `backup-0` EC2 instance, which syncs metadata, writes tar snapshots to a separate versioned/object-locked backup bucket, and self-stops.

### 3. CAS Cold Pool & Lifecycle (Purple) — 1× Storage + Zero-Byte Relink

- **Free S3 Gateway Endpoint (`$0.00/GB`)**: All ClickHouse-to-S3 traffic rides the regional VPC Gateway Endpoint, avoiding **`$18,000+/month`** in `$0.045/GB` NAT Gateway data-processing charges.
- **1× Shared XXH3-128 Pool**: Under `tiered_cas` (`perform_ttl_move_on_insert = false`), merged `~1 GiB` wide parts age off the NVMe hot path (`TTL +1–7d` or `move_factor = 0.1` pressure spill), hash into `XXH3-128` blobs, and upload **once** (`1×`) into an unversioned S3 CAS bucket (`s3://org-ch-cas-cold-pool/cas/`) with **no `{replica}` segment** in the path.
- **Zero-byte relink (`CA_RELINK_COOKIE`)**: Replacement Spot writers and Spot readers never copy gigabytes of cold history over `:9010`. They verify `HEAD` on S3 and attach the manifest in **`~2–3 seconds`** with **`0 bytes`** transferred; writers then pull only recent un-aged hot delta parts over `:9010`.
- **GC & Avoiding the S3 Standard-IA Early-Deletion Trap**: An elected CAS GC leader folds ref-logs every `300s` (`cas_gc_interval_sec = 300`) using S3 `If-Match` conditional writes. **Crucial FinOps fix**: for `7d–33d` retention windows, we set `lifecycle_days_to_ia = 0` and keep cold parts in **S3 Standard (`$0.023/GB-mo`)**. Transitioning to S3 Standard-IA at day `30` when ClickHouse TTL drops parts at day `31–33` triggers AWS's **30-day minimum storage duration early-deletion fee**—making those final 3 days cost `~$2,467/mo` instead of `~$454/mo` in S3 Standard (`>5×` more expensive). Standard-IA only pays off for longer retention (`≥ 60–90+` days) where objects stay in IA well past the 30-day floor.

### 4. Readers Fleet · 100% Spot Replicas & NVMe Instance-Store Cache (Sky Blue)

- **Read-only Spot fleet behind `/replicas_status`**: Query clients (`query.clickhouse.example:8443`) hit an NLB target group gated by `HTTP :8123/replicas_status`, ensuring newly booted Spot readers finish relinking before serving traffic.
- **Why NVMe instance store is ideal here**: Readers run `6×` 4-vCPU / 16 GiB Graviton NVMe Spot instances (`*gd` pool). Each instance ships with local NVMe SSDs included at **`$0` extra EBS cost** and **`~2×` `gp3` throughput**, which `chinit` formats and mounts automatically as `cas_cache`.
- **Hot vs. Cold query split**: Hot queries resolve in RAM (`5 GiB` mark cache + `8 GiB` uncompressed cache) or local NVMe `cas_cache` (`~95%+` hit rate). Cache misses fetch byte ranges from the CAS S3 pool via the free Gateway Endpoint and warm NVMe for subsequent queries.

---

## 2. 100 TB/Day Cost Breakdown (`3,040,000 GB/Month`, `us-west-2`)

Using our measured **`15.2×` ZSTD** compression ratio, `100 TB/day` produces **`6.58 TB/day` (`6,579 GB/day`)** of net compressed ClickHouse data:
- **7-day cold pool (`1×` CAS)**: `46.1 TB` (`46,053 GB`) in S3 Standard (`$0.023/GB-mo`) = **`$1,059/month`**
- **33-day cold pool (`1×` CAS)**: `217.1 TB` (`217,105 GB`) kept in S3 Standard (`$0.023/GB-mo`, `lifecycle_days_to_ia = 0`) = **`$4,993/month`**

| Cost Line Item (100 TB/day = 3.04M GB/mo) | 7-Day Retention | 33-Day Retention | Notes & Cost Levers |
|---|---|---|---|
| **Writers Fleet (`1×` OD `writer-0` + `9×` `*gd` Spot)** | `$2,290/mo` | `$2,290/mo` | `writer-0` pinned On-Demand (`~$580/mo`) for `backup-wake`; `writer-1..9` Spot (`$1,710/mo`); **`$0` NVMe hot disk** |
| **Writer Metadata EBS (`10×` 128 GB `gp3`)** | `$102/mo` | `$102/mo` | Catalog only (`delete_on_termination=true`); hot/merge path rides NVMe |
| **Readers Fleet (`6×` 4-vCPU / 16 GiB `*gd` Spot)** | `$330/mo` | `$330/mo` | `100%` Spot (`*gd` NVMe pool); `NVMe cas_cache` = **`$0` EBS** |
| **Reader Metadata EBS (`6×` 64 GB `gp3`)** | `$31/mo` | `$31/mo` | Small catalog disk only (`cas_cache` rides local NVMe) |
| **Keeper Quorum (`3×` 2-vCPU / 8 GiB On-Demand)** | `$162/mo` | `$162/mo` | On-Demand Raft quorum + dedicated `64 GB gp3` fsync disks |
| **CAS Cold S3 Pool (`1×` Shared XXH3-128)** | **`$1,059/mo`** | **`$4,993/mo`** | `46.1 TB` @ 7d · `217.1 TB` @ 33d (all S3 Standard; no 30d IA early-deletion fee) |
| **S3 API Requests (Wide Parts + `gc_interval=300s`)** | `$580/mo` | `$580/mo` | `~1 GiB` wide parts + 300s GC folding keep Tier-1 PUTs low |
| **NLBs + `warning` CW Logs + DynamoDB + Backup** | `$150/mo` | `$150/mo` | Verbose logs stay local in ZSTD `system.text_log`; S3 Gateway = `$0/GB` |
| **Total ClickHouse + CAS Cluster (`100 TB/day`)** | **`$4,704/mo`** | **`$8,638/mo`** | **`$0.0015/GB` (`0.15¢/GB`)** @ 7d · **`$0.0028/GB` (`0.28¢/GB`)** @ 33d |

### What CAS + Spot + NVMe Saves at 100 TB/Day

| Architecture Variant (33-Day Retention, 100 TB/day) | Cold S3 Storage | Total Cluster Cost | Savings vs. Non-CAS 10× |
|---|---|---|---|
| **Non-CAS Unsharded (`10×` per-replica S3 copies)** | `$49,934/mo` | `~$53,579/mo` | Baseline |
| **Non-CAS Sharded (`S = 5` shards × `r = 3` = `3×` S3)** | `$14,980/mo` | `~$18,625/mo` | `-$34,954/mo` (`-65%`) |
| **Antalya CAS (`1×` S3) + OD `w0` + Spot + NVMe** | **`$4,993/mo`** | **`~$8,638/mo`** | **`-$44,941/mo` (`-84%`)** |

---

## 3. Production Caveats & Operational Trade-offs

Good FinOps engineering makes the trade-offs explicit alongside the savings:

- **S3 Standard-IA minimum duration (`30` days)**: Never transition cold parts to Standard-IA unless parts survive well past `lifecycle_days_to_ia + ~17` days (for example, `60–90+` day retention with a day-30 transition). For `≤ 47`-day TTLs, keep `lifecycle_days_to_ia = 0` in S3 Standard so early-deletion charges never erase the lower storage rate.
- **Experimental status of Altinity Antalya CAS**: CAS (`metadata_type = cas`) is marked experimental in Antalya `26.6+` / `26.8` builds. Pin your Golden AMI build version, monitor `PartsLockWaitMicroseconds` and CAS GC concurrency (`cas_gc_interval_sec = 300`), ensure versioning and Object Lock remain disabled on the CAS bucket, and drill restores from `backup-0` before promoting CAS to strict-SLA production.
- **Spot writer floor under regional capacity crunches**: Pinning `writer-0` On-Demand (`writer_spot_on_demand_base_capacity = 1`) keeps `backup-wake` and maintenance safe, and spreading `writer-1..9` across 3 `*gd` families minimizes correlated reclaims. However, if a regional Spot crunch evicts multiple writers faster than `:9010` replication drains, workloads with strict zero-backpressure SLAs should raise `writer_spot_on_demand_base_capacity` to their `writer_min` ingest quorum floor (or keep `writer_spot_ratio = 0.0`).
- **Single-AZ compute vs. cross-AZ `:9010` transfer**: Placing writers, readers, and Keepers in one AZ eliminates AWS's `$0.02/GB` round-trip cross-AZ data-transfer fee on `:9010` hot replication (`$4,000–$8,000+/mo` saved at this ingest scale), while S3 still preserves 3-AZ data durability. The trade-off is AZ-level compute availability (an AZ outage becomes an ASG re-launch into a healthy AZ rather than zero-second failover).
- **Compression sensitivity (`15.2×` vs. `3×–6×`)**: The `$4,704–$8,638/mo` numbers assume `15.2×` ZSTD compression measured on structured observability logs/telemetry. High-entropy payloads (random UUIDs, hashes, unindexed JSON) typically compress at `3×–6×`, which increases S3 cold storage and `:9010`/S3 bandwidth by `~2.5–5×`—though `1×` CAS still eliminates the `10×` replica-copy multiplier either way.

At `100 TB/day`, pinning `writer-0` On-Demand to anchor backups and maintenance while moving **hot-path compaction** and **cold-read caching** onto free **NVMe instance-store disks**, running **Spot compute** for `writer-1..9` and all readers, and deduplicating cold S3 into a **`1×` CAS pool** turns a `$53.6k/month` storage-bound cluster into a **`$4.7k–$8.6k/month`** elastic system under **`0.28¢/GB`**.

Previous: [Three Generations of a 30 TB/Day ClickHouse Fleet: Non-CAS vs. CAS, What Broke, and a Blueprint for Self-Managed S3](/blog/clickhouse-fleet-evolution-non-cas-to-cas-blueprint/). Series index: [ClickHouse on AWS: Self-Managed from First Principles](/series/clickhouse-on-aws/).

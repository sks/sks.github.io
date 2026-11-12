---
layout: post
title: "ClickHouse on S3: Tiered Storage Policies That Don't Melt"
date: 2026-11-08 09:00:00 -0800
series: "ClickHouse on AWS: Self-Managed from First Principles"
series_order: 4
description: "How I put all ClickHouse table data in S3 with a tiered storage policy, tuned async inserts so small writes don't hit Too many parts, and why the metadata disk is the one EBS volume that matters."
image: /assets/images/og-default.png
tags: [clickhouse, s3, aws, storage-policy, tiered-storage, cost-optimization]
permalink: /blog/clickhouse-s3-tiered-storage/
faqs:
  - question: "Can ClickHouse store table data directly in S3?"
    answer: "Yes. Declare an s3 disk in storage_configuration, point the table's storage_policy at it, and parts are written as S3 objects. A cache disk in front of the s3 disk keeps hot reads local."
  - question: "Why is the metadata disk more important than the S3 data?"
    answer: "S3 holds the bytes, but the persistent EBS volume holds the map from tables and rows to S3 object keys. Without that map the S3 objects are anonymous parts no server can read."
  - question: "Why not send old log data to Glacier?"
    answer: "A query has to read any part instantly. Glacier retrieval takes minutes to hours, which turns any query over old data into a failure. Standard-IA after 30 days keeps data queryable and cheap."
  - question: "What causes Too many parts with S3 storage, and how do you fix it?"
    answer: "S3 writes take tens of milliseconds, so many small inserts create parts faster than merges can fold them. Fix it with async_insert, a 100 MB or 10 second batch window, and parts_to_throw_insert raised to 3000."
  - question: "Does ClickHouse traffic to S3 go through a NAT gateway?"
    answer: "No. An S3 gateway endpoint keeps traffic inside the VPC for free. NAT gateway processing costs $0.045/GB, which adds up fast on write-heavy log ingestion."
---

S3 is cheap and effectively unlimited. EC2 instances are neither. So all table data in the log analytics platform I run lives in S3, and the ClickHouse nodes are replaceable compute. They cache hot data on local disks, merge parts, and write the results back to the bucket.

Think of an unlimited cheap warehouse outside the city, plus a small shop counter in town where you keep bestsellers. The warehouse holds everything; the counter holds only what customers ask for most. In ClickHouse terms, the warehouse is the S3 bucket, and the counter is the EC2 instance's local disk. That is the same separated-storage idea ClickHouse Cloud is built on, self-managed. Onboarding is the win: a new tenant is an S3 prefix plus a storage policy, not a capacity-planning project. This post covers the storage policy, the insert and read tuning S3 forces on you, and the one EBS volume you cannot lose. Reference: [storing data](https://clickhouse.com/docs/en/operations/storing-data).

**Key takeaways**

- All table bytes live in S3. Local disks are a cache and a merge scratchpad, which makes EC2 replaceable.
- A `tiered` policy lands new parts on local disk and moves cold parts to S3 (`move_factor` 0.1, TTL to the cold volume), with an S3 lifecycle rule to Standard-IA after 30 days.
- Small inserts are the enemy on S3. `async_insert` with a 100 MB / 10 s batch window and `parts_to_throw_insert` at 3000 keeps ingestion alive.
- The metadata disk — persistent gp3, `delete_on_termination` false — holds the map from tables and rows to S3 objects. Lose it and S3 is an unreadable pile.
- Never Glacier. Any query must be able to read any part instantly.
{: .key-takeaways}

---

## Parts, bytes, and the map

ClickHouse stores a table as immutable parts. A part is a set of files: column data, checksums, a primary key index, and marks. With an S3 disk, those files become S3 objects under a prefix, and the table's parts become pointers, not local files.

Three places matter:

| Location | Holds | If lost |
|---|---|---|
| S3 bucket | The bytes of every part | Practically never |
| Metadata gp3 volume | The map: tables → parts → S3 object keys | Unrecoverable without the daily snapshot |
| Cache disk (local gp3/NVMe) | Hot file segments pulled from S3 | Not a problem; it refills on demand |

## The storage policy

```xml
<storage_configuration>
  <disks>
    <default>
      <path>/var/lib/clickhouse/</path>
    </default>
    <s3>
      <type>s3</type>
      <endpoint from_env="CH_S3_ENDPOINT"/>
      <use_environment_credentials>true</use_environment_credentials>
    </s3>
    <s3_cache>
      <type>cache</type>
      <disk>s3</disk>
      <path>/var/lib/clickhouse/s3_cache/</path>
      <max_size>10Gi</max_size>
    </s3_cache>
  </disks>
  <policies>
    <tiered>
      <volumes>
        <hot><disk>default</disk></hot>
        <cold><disk>s3_cache</disk></cold>
      </volumes>
      <move_factor>0.1</move_factor>
    </tiered>
  </policies>
</storage_configuration>
```

What each piece does:

- **`s3` disk**: parts are written as objects to the endpoint in `CH_S3_ENDPOINT`. The platform points that endpoint at a per-tenant prefix inside the bucket. Onboarding a tenant is a prefix and a policy, not new disks.
- **`use_environment_credentials`**: the instance's IAM role authenticates. No static access keys in any config file.
- **`s3_cache`**: the shelf behind the shop counter. Recent hot items sit within reach; anything missing is fetched from the warehouse, and the fetched item is placed on the shelf for next time. In ClickHouse terms, the shelf is a cache disk wrapping the s3 disk: reads pull file segments through a local path capped at `max_size` (10 Gi here), so hot queries stay off S3.
- **Volumes**: `hot` is the local default disk, `cold` is the cached S3 disk. Tables opt in with `storage_policy = 'tiered'`.

```sql
CREATE TABLE logs ON CLUSTER '{cluster}'
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{uuid}/{shard}', '{replica}')
TTL ts TO VOLUME 'cold'
SETTINGS storage_policy = 'tiered';
```

New parts always land in the first volume — local disk, where merges are fast. Think of a librarian who moves books nobody has borrowed recently from the front shelf to the archive. In ClickHouse terms, the librarian is the TTL moving parts to the cold volume as they age, plus `move_factor` 0.1, which pushes data down a tier when the hot volume drops below ~10% free. Reference: [storage policies](https://clickhouse.com/docs/en/operations/storing-data), [S3 disk](https://clickhouse.com/docs/en/operations/storing-data#s3).

## Pair it with an S3 lifecycle rule

The S3 side has one rule. Back to the library: books nobody borrows move to a cheaper archive aisle after 30 days. In ClickHouse terms, the cheaper aisle is the S3 lifecycle rule moving objects to Standard-IA 30 days after creation. S3 Standard is $0.023/GB-month; Standard-IA is $0.0125 ([S3 pricing](https://aws.amazon.com/s3/pricing/)). Parts are immutable, so an object's age tracks its data age exactly — 5 TB of tenant logs costs about $118/mo at Standard and about $64/mo once aged.

Never Glacier. The archive still lets any clerk fetch any book in seconds. A deep-storage vault would require a three-hour retrieval wait, so every request for an old book would simply fail. In ClickHouse terms, every query must be able to read any part instantly. Glacier retrieval takes minutes to hours, and tiered storage is about cheaper storage, not archiving.

## The metadata disk holds the address book

Say it plainly: S3 holds the goods; the persistent gp3 disk holds the address book that says which shelf each item is on. Lose the address book, and the warehouse is full of items nobody can find. In ClickHouse terms, the address book is a persistent 512 GB gp3 EBS volume holding the map from tables and rows to S3 object keys. ClickHouse can reconstruct nothing from the bucket alone.

That is why the volume is never deleted on replacement (`delete_on_termination = false`), why replaced instances re-attach it instead of rebuilding, and why it is snapshotted daily. EBS snapshots are incremental at $0.05/GB-month — the one backup in the stack that actually restores tables.

## The insert path: too many small writes, fixed by async inserts

An EBS write takes under a millisecond. An S3 PUT takes tens of milliseconds. Every insert produces a part, and a part on the s3 disk means a batch of object writes. Log traffic arrives as thousands of small inserts per minute. Parts appear faster than merges fold them, and ClickHouse throws `Too many parts` once a partition crosses its 300-part ceiling (`parts_to_throw_insert` default).

Think of the post office. If every customer posts one letter, the postman carries many small envelopes. Instead, the postman waits until the bag holds 100 MB or 10 seconds pass, then delivers one big bag. Fewer, bigger deliveries. In ClickHouse terms, the postman is `async_insert`: it buffers inserts server-side and folds them into large parts, so the client gets one response and ClickHouse makes fewer, larger S3 writes. The ingest profile fixes all three sides — buffering, ceiling, merge size:

```xml
<profiles>
  <async_insert>
    <async_insert>1</async_insert>
    <async_insert_max_data_size>104857600</async_insert_max_data_size>
    <async_insert_busy_timeout_ms>10000</async_insert_busy_timeout_ms>
    <async_insert_stale_timeout_ms>5000</async_insert_stale_timeout_ms>
    <parts_to_throw_insert>3000</parts_to_throw_insert>
  </async_insert>
</profiles>
```

- **`async_insert`** buffers inserts server-side and folds them into large parts. The client gets one response; ClickHouse makes fewer, larger S3 writes.
- **The batch window** is 100 MB or 10 seconds, whichever comes first. `async_insert_stale_timeout_ms` at 5000 lets a batch flush even while new inserts keep arriving.
- **`parts_to_throw_insert` 3000** raises the ceiling tenfold. Back to the warehouse: an aisle accepts up to 3000 boxes, then refuses new deliveries until existing boxes are consolidated. In ClickHouse terms, the box ceiling is `parts_to_throw_insert`, raised from the default 300 so bursts that merge slowly on S3 keep going.

Merge settings matter more than usual, because every merge of cold data is an S3 round trip: read every source part, write the new one. Raising `max_bytes_to_merge_for_max_part_size_in_partition` above its 150 GB default keeps final merges big — fewer, larger S3 transactions per GB stored. Tables also stick to lz4, the default codec. When every part write is an S3 transaction, faster compression keeps the async-insert window short. Reference: [asynchronous inserts](https://clickhouse.com/docs/en/optimize/asynchronous-inserts).

## The read path: cache, hedge, and pool

Queries over cold data read S3 through the cache disk. Picture a counter clerk who remembers which items were asked for recently and keeps them within reach. In ClickHouse terms, that memory is two server-side caches:

```xml
<mark_cache_size>5368709120</mark_cache_size>
<uncompressed_cache_size>8589934592</uncompressed_cache_size>
```

- **Mark cache, 5 GB**: primary key marks held in RAM, so index ranges resolve without disk reads.
- **Uncompressed cache, 8 GB**: recently decompressed blocks held in RAM for repeated queries.
- **Hedged requests, limit 5**: on a slow read, ClickHouse opens a second connection and keeps whichever answer arrives first — protection against S3 latency spikes.
- **Read pools sized for S3**: `asynchronous_read_pull_pool_size` 64, `background_read_pool_size` 32, `remote_read_max_threads` 128. Enough parallel reads to use S3 throughput without queries waiting behind each other.

## What it costs

On storage: S3 Standard at $0.023/GB-month against EBS gp3 at $0.08/GB-month provisioned — the 5 TB above is about $118/mo on S3 versus about $410/mo provisioned, and the S3 side halves again after the 30-day Standard-IA transition. EBS still pays for the metadata volume and cache, but data growth no longer means instance resizing.

On network: an S3 gateway endpoint is free and keeps ClickHouse↔S3 traffic inside the VPC. Without it, that traffic pays NAT gateway processing at $0.045/GB — 5 TB of write churn alone would be $230/mo for nothing.

## The tiered flow on one screen

```
              insert ──▶ writer (EC2)
                             │
               part lands in the hot volume
               (local disk, fast merges)
                             │
             TTL / move_factor 0.1 pushes
             cold parts down a tier
                             ▼
             ┌───────────────────────────┐
             │  S3 bucket (all the bytes) │
             │  Standard → Standard-IA    │
             │  at 30 days. No Glacier.   │
             └─────────────┬─────────────┘
                           │ reads pass through
             ┌─────────────▼─────────────┐
             │  cache disk (local gp3 or  │
             │  NVMe, max_size 10Gi)     │
             └─────────────┬─────────────┘
                           ▼
                         query

 metadata gp3 (512 GB, delete_on_termination=false):
 the map of tables ▶ parts ▶ S3 object keys.
 Snapshotted daily. Lose it, lose the data.
```

*S3 keeps the goods. The metadata disk keeps the address book.*

Previous: [Writers, Readers, Keepers: designing a ClickHouse cluster that survives node loss](/blog/clickhouse-cluster-topology-keeper/). Next: [Spot readers with stable identity](/blog/clickhouse-spot-readers-stable-identity/).

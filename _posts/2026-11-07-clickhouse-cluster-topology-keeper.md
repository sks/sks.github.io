---
layout: post
title: "Writers, Readers, Keepers: Designing a ClickHouse Cluster That Survives Node Loss"
date: 2026-11-07 09:00:00 -0700
series: "ClickHouse on AWS: Self-Managed from First Principles"
series_order: 3
description: "How I split a ClickHouse cluster into writers, readers, and keepers, why Keeper quorum is the one thing that flips replicated tables read-only, and how static node identity keeps instance replacement boring."
image: /assets/images/og-default.png
tags: [clickhouse, keeper, aws, cluster-topology, replication, ec2]
permalink: /blog/clickhouse-cluster-topology-keeper/
faqs:
  - question: "What is ClickHouse Keeper?"
    answer: "Keeper is ClickHouse's ZooKeeper-compatible coordination service. It stores replication queues, the distributed DDL task queue at /clickhouse/task_queue/ddl, and part allocation for ReplicatedMergeTree tables, using raft for consensus."
  - question: "How many Keeper nodes do I need?"
    answer: "Three is the practical minimum. Raft tolerates one node down out of three; with two down there is no quorum, and every ReplicatedMergeTree table flips read-only until a keeper is restored."
  - question: "Why does Keeper need a dedicated disk?"
    answer: "Keeper fsyncs every write before acknowledging it. If merges share the same disk, merge I/O spikes fsync latency, Keeper misses heartbeats, and you get leader elections and cluster-wide read-only tables."
  - question: "Why aren't writers and keepers in an Auto Scaling group?"
    answer: "Raft members need stable server IDs. Keeper's myid lives on a dedicated EBS volume, so a replaced instance rejoins with its old identity instead of triggering a re-election storm or split-brain."
  - question: "What does internal_replication do in remote_servers?"
    answer: "With true, the Distributed table writes each block to one replica and the ReplicatedMergeTree engine copies it to the others. With false, the Distributed table writes every replica itself, which breaks insert dedup on retries."
---

A single ClickHouse server can ingest, merge, and serve queries on one machine. That works until the machine fails. I run a log analytics platform on AWS, and the cluster design starts from one question: which node can we lose at 3 a.m. without waking anyone up?

The answer is any one node. Ingestion, querying, and coordination must be three separate jobs on three separate kinds of machine. This post is the topology: writers, readers, keepers, one shard, two load balancers, and the quorum math that keeps replicated tables writable. Reference: [ClickHouse Keeper](https://clickhouse.com/docs/en/operations/clickhouse-keeper).

**Key takeaways**

- Writers and readers are separate node pools so a runaway analytical query can never starve ingestion.
- Every `ReplicatedMergeTree` table coordinates through Keeper. Two of three keepers down means no quorum, and every replicated table flips read-only — the exact failure mode the alarms watch for.
- Keeper's raft disk is a dedicated 64 GB gp3. Keeper fsyncs every write; merge I/O on a shared disk spikes fsync latency, misses heartbeats, and triggers leader elections.
- Writers and keepers are fixed-identity EC2 with persistent EBS. Readers scale in an Auto Scaling Group.
- One shard, `internal_replication` true: the engine replicates, and the Distributed table never writes N copies.
{: .key-takeaways}

---

## Three node roles, three failure modes

Think of a restaurant. The kitchen prepares food; the dining room serves it. A rush of customers never stops the kitchen cooking, and a slow chef makes only his own tables wait. In ClickHouse terms, writers are the kitchen and readers are the dining room.

Writers are two EC2 instances with static private IPs and fixed identity. Every insert — OTLP over gRPC, HTTP, or the native protocol — enters through them. If inserts queue, upstream buffers grow and logs get dropped. Writers run no analytical queries.

Readers are an Auto Scaling Group of replicas serving dashboards, ad-hoc SQL, and the API. They are cheap to replace. A very expensive `GROUP BY` over a month of data occupies one reader; the rest keep answering.

Keepers are three small nodes running ClickHouse Keeper. They hold no table data, only the coordination state that makes replication work.

Why split writers from readers? Isolation. Memory limits are per query, but CPU, disk I/O, and page cache are shared. On a shared node, a month-long aggregation can make inserts time out.

## Keeper, for someone who has never run one

Keeper is ClickHouse's coordination service: a ZooKeeper-compatible replacement ClickHouse maintains itself, with raft for consensus. Every replicated table coordinates through it. Picture a bank head office that keeps one to-do list shared by all branches: "branch reader-1 has recorded page 12; fetch it from a peer." In ClickHouse terms, Keeper is the head office, and every replica acts on its list. The list lives in memory on top of a raft log:

- **Replication queues**: which parts exist on which replica, and what still needs copying.
- **The distributed DDL task queue**: `ON CLUSTER` statements land at `/clickhouse/task_queue/ddl`, and each node executes them.
- **Part allocation**: the record of where every part lives.

No Keeper, no replicated tables — the list is the whole replication loop. Reference: [replication in MergeTree](https://clickhouse.com/docs/en/engines/table-engines/mergetree-family/replication).

Keeper runs raft with majority quorum. Think of three bank managers who must co-sign the ledger. If one is at lunch, the other two can still approve a new page. If two are away, the bank stops approving pages rather than risk two managers approving different things. In ClickHouse terms, three keepers tolerate one down. With two down there is no quorum: every `ReplicatedMergeTree` table switches to read-only, inserts fail, and `system.replicas.is_readonly` goes to 1 cluster-wide. That is the condition the ingestion alarms watch — the only failure that stops ingestion without losing a single data node.

## The raft disk gets its own gp3

Keeper fsyncs every write to its raft log before acknowledging it. That is what makes it crash-safe — and sensitive to disk latency. Picture the manager's signing desk: every signature must be written in permanent ink and dry before the page counts as signed. Now put a busy printer on the same desk — the paper shakes, the ink smears, signatures arrive late, and the bank elects a new manager mid-signature. In ClickHouse terms, fsync is the ink and the printer is merge I/O, bursts of sequential writes that can saturate a disk for minutes. With a shared disk, fsync latency spikes, heartbeats are missed, and raft elects a new leader — repeated elections end in the same read-only state as losing quorum outright.

Each keeper therefore gets a dedicated 64 GB gp3 for the raft log and nothing else. gp3 delivers 3,000 baseline IOPS at any size — small, fast, and isolated from merge I/O.

## Why keepers and writers are not in an ASG

Auto Scaling groups replace instances, and replacement is where coordination systems break. Raft identifies members by server ID, not IP address. Think of bank branches at fixed street addresses: the manager's name is on a permanent plaque, so a rebuilt branch reopens under the same name and keeps signing the same ledger. In ClickHouse terms, the plaque is Keeper's `myid`, kept on a dedicated EBS volume, not an AMI. When a keeper is replaced, the volume re-attaches, the node rejoins with its old identity, and raft catches it up — no repeated elections, no split-brain (two nodes both acting as leader).

Writers get fixed identity for the same reason: their local state is expensive to rebuild, and static private IPs keep inter-node replication traffic predictable after replacement.

Readers are the only pool in an ASG, because a reader is a pure replica: replace it, and the new node streams parts from siblings. Reader names still must be stable across instance generations — the next post covers how spot readers keep stable names while the instance under them changes.

## One shard, and every data node is a replica of it

Log volume grows along one axis — time — and queries concentrate on recent data, so the cluster is a single shard. All data nodes (2 writers + 3 readers in prod) are replicas of it. `remote_servers` names them:

```xml
<remote_servers>
  <logexplorer>
    <shard>
      <internal_replication>true</internal_replication>
      <replica><host>10.0.11.10</host><port>9000</port></replica>
      <replica><host>10.0.12.10</host><port>9000</port></replica>
      <replica><host>10.0.21.20</host><port>9000</port></replica>
    </shard>
  </logexplorer>
</remote_servers>
```

Readers continue the same shape. `remote_servers` lives in the server config alongside macros — see [configuration files](https://clickhouse.com/docs/en/operations/configuration-files).

`internal_replication` must be true. Think of the kitchen writing the order once, and one runner delivering a copy to every dining room. If every dining room placed its own copy, the kitchen would cook duplicate meals and the bill would be wrong. In ClickHouse terms, the runner is the `Distributed` table writing each block to exactly one replica, and the replicated engine copying it to the others through the replication queue. With false, the Distributed table writes every replica itself — N copies per insert, N times the I/O, and insert dedup breaks on retry because each retried insert carries a fresh block hash. Duplicate rows follow. Reference: [Distributed table engine](https://clickhouse.com/docs/en/engines/table-engines/special/distributed).

## {shard}, {replica}, and names that outlive instances

Tables use macros, never hard-coded paths:

```xml
<macros>
  <shard>01</shard>
  <replica>writer-01</replica>
</macros>
```

```sql
CREATE TABLE logs ON CLUSTER '{cluster}'
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{uuid}/{shard}', '{replica}')
ORDER BY ts;
```

The first argument is the table's path in Keeper, where its replication queue lives. `{uuid}` makes it unique per table; `{shard}` groups the table's replicas. The second is this replica's name in that queue — and replica names must be stable across instance generations. The name is how the queue tracks who has which parts. Change the name, and you register a new replica that must re-fetch everything. Identity is configuration, not instance metadata.

## Two network load balancers

Think of a hotel with two doors. Deliveries use the service elevator; guests use the front entrance. If a crowd blocks the lobby, food still arrives through the service door. In ClickHouse terms, the service door is the ingest NLB in front of the writers, and the front entrance is the query NLB in front of the readers. Ingestion and queries scale and fail independently: a heavy query must not block the path inserts use, and adding readers must never change ingest targets. TLS terminates at each NLB with an ACM certificate.

## What it costs

The platform runs two sizes of this shape:

| | Dev | Prod |
|---|---|---|
| Writers | 1 × t4g.large (2 vCPU, 8 GB) | 2 × r8g.2xlarge (8 vCPU, 64 GB) |
| Readers | 1 × t4g.large | 3 × r8g.4xlarge (16 vCPU, 128 GB) |
| Keepers | 1 × t4g.small | 3 × r8g.xlarge (4 vCPU, 32 GB) |
| Total | ~$150–250/mo | ~$3.1–3.5k/mo |
Dev's single keeper is a deliberate single point of failure, acceptable when the tenant is one. Prod runs three, because three is the smallest count that survives losing one.

## The whole picture

```
      inserts (OTLP / native / HTTP)      queries (dashboards, SQL)
                   │                                │
            ┌──────▼──────┐                   ┌──────▼──────┐
            │ ingest NLB  │                   │  query NLB  │
            │ (TLS + ACM) │                   │ (TLS + ACM) │
            └──────┬──────┘                   └──────┬──────┘
                   │                                │
       ┌───────────┴───────────┐        ┌────────────┴───────────┐
       │     writers × 2       │        │    readers ASG (3+)     │
       │  fixed EC2, static IP │        │  replaceable replicas  │
       │     r8g.2xlarge       │        │      r8g.4xlarge        │
       └───────────┬───────────┘        └────────────┬────────────┘
                   │                                 │
                   └────────────────┬────────────────┘
                            replication queue
                                     │
                          ┌──────────▼──────────┐
                          │     keepers × 3     │
                          │    raft, r8g.xlarge  │
                          │  64 GB gp3 raft disk │
                          │   (no table data)   │
                          └─────────────────────┘
```

Every writer and reader is a replica of the same single shard; keepers hold coordination state only.

*If the cluster can only survive nodes you never replace, it can't survive anything.*

Previous: [ClickHouse Cloud vs self-managed engines](/blog/clickhouse-cloud-vs-self-managed-engines/). Next: [ClickHouse on S3: tiered storage policies that don't melt](/blog/clickhouse-s3-tiered-storage/).

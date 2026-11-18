---
layout: page
title: ClickHouse on AWS starter pack
permalink: /start/clickhouse-aws/
description: "Forty production notes on self-managed ClickHouse on AWS — MergeTree internals, engines, topology, S3 storage, operations, cost, the chinit bootstrapper arc (including the full bootstrap walkthrough), and the CAS zero-copy arc."
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
13. **[Boot Sequence as a Contract: How a Self-Managed ClickHouse Node Comes Up (and How It Fails)](/blog/clickhouse-boot-sequence-contract/)** — the ordered checks and failure boundaries that make bootstrap and restart behavior inspectable
14. **[Dead Projections and Useless FINAL: Tuning ClickHouse Tenant Databases by Reading the Source](/blog/clickhouse-tenant-tuning-from-source/)** — a projection that doubled storage but never ran, a FINAL that cost 20 seconds a query, and the `{database}` keeper-path macro that makes per-database tenancy work
15. **[A Field Map of ClickHouse Storage: Disks, Object Stores, and Metadata in the Source](/blog/clickhouse-storage-classification-source/)** — disk types, object-storage backends, metadata choices, and the key template behind S3 object layout
16. **[Destroy, Then Create: The Ordering Rule That Keeps Static-IP ClickHouse Replaceable](/blog/clickhouse-destroy-then-create-static-ips/)** — Terraform replacement ordering, exclusive static IPs, volume identity, and Keeper quorum safety
17. **[One Binary to Bootstrap a Node: Why chinit Replaced 3,600 Lines of Bash](/blog/chinit-one-binary-node-bootstrap/)** — the boot script as a state machine, the typed spec that replaces template variables, and how to know your fleet is ready
18. **[Dissolving the Second Binary: How chinit Absorbed Its Own Companion CLI](/blog/chinit-dissolve-second-binary/)** — the process boundary as a liability, the typed port that replaced argv, and the release-tag lesson that broke the gates twice
19. **[Who Decides What a Node Is Called? Lease Identity for an Ephemeral Stateful Fleet](/blog/chinit-lease-identity-ephemeral-fleet/)** — one conditional write, a TTL lease, a drain protocol, and stateless replacement as the repair strategy
20. **[Adopting the Pattern: A Migration Guide for Declarative Node Bootstrap and Lease Identity](/blog/chinit-adopt-pattern-fleet/)** — the staged order, the traps that cost live cutovers, what not to port, and the five questions that say you are done
21. **[ClickHouse zero-copy replication is dead: the content-addressed design that replaced it](/blog/clickhouse-zero-copy-replication-dead/)** — why upstream deprecated it, how the garbage collection broke, and the CAS object model that replaced it: blobs, manifests, ref logs, mount leases, and why Keeper is not on the data path
22. **[Touching CAS Without Betting the Cluster: A Hands-On Staging Walkthrough](/blog/clickhouse-cas-on-aws-walkthrough/)** — bucket preconditions, the Antalya build, the disk XML, per-partition adoption, and the queries that prove it works
23. **[What Breaks with ClickHouse CAS, and How to Decide If You Should Run It](/blog/clickhouse-cas-failure-modes/)** — mount refusal, identity drift, GC wedges, the blast radius — and the weighted scorecard for CAS vs SharedMergeTree vs plain replication, with exit costs
24. **[Draining 29,000 S3Queue Files Fast: Every Setting That Matters](/blog/clickhouse-s3queue-backlog-drain-optimizations/)** — why the backlog formed, every governing setting with source permalinks, and the ~8x drain tuning
25. **[Three Days of Keeper Silence: How a Lost Metric Push Made a Healthy Cluster Blind](/blog/clickhouse-keeper-silence-alarm-design/)** — the timer that never shipped, the metric push that evaporated in a port, and why liveness alarms must treat silence as failure
26. **[The Self-Terminating Alarm: When Per-Host Scale-In Kills Every Scale-Out](/blog/asg-per-host-scale-in-wedge/)** — the per-host alarm whose action destroys its own metric, the ASG-wedge anatomy, and the aggregate-alarm fix
27. **[When df Lies: keep_free_space and a Fleet That Grows Its Own Volumes](/blog/clickhouse-effective-disk-headroom-self-healing/)** — effective disk headroom, the merge-stall cascade, online EBS + ext4 growth, and the disk-autoscale self-healing loop  
28. **[The Fleet That Could Not Heal Itself: TLS Storms, Dead DNS, and What 'Self-Healing' Actually Requires](/blog/fleet-that-could-not-heal-itself/)** — the four error waves of a load soak, and the detection-diagnosis-remedy chain that closed each  
29. **[Graviton Roulette: The Day NVMe Device Names Broke Our Boot](/blog/gravitron-nvme-enumeration-boot-disk-guard/)** — device-name roulette, the e2label near-miss on root, and the label-first/partition-skip/patient-wait guards  
30. **[S3Queue Is a Multi-Node Engine: Stop Bottlenecking Ingest on One Writer](/blog/s3queue-multi-node-ingest-fanout/)** — keeper-claimed files, exactly-once across the fleet, and the one-table fix that turned 100% one-node ingest into single-digit fleet CPU
31. **[The Cloud-Neutral Bootstrapper That Wasn't: Auditing chinit for Azure](/blog/chinit-azure-portability-audit/)** — the Fatal assumptions hiding in the "shared" pipeline, the checksum with one signer, and the 18-release pin drift as a symptom of an unbootable port
32. **[From an Empty EC2 Box to a Cluster Member: What Bootstrapping ClickHouse on AWS Actually Means](/blog/clickhouse-aws-bootstrap-chinit-walkthrough/)** — every AWS primitive a node touches between launch and its first served query, and what chinit does at each of its twenty-four steps
33. **[The Roster, the Journal, and the Bookmarks: What Actually Happens When You CREATE a Replicated ClickHouse Table](/blog/clickhouse-replicated-table-roster-journal-bookmarks/)** — the plain-English mental model behind every replication debugging story: membership in Keeper, the shared operations log, per-replica bookmarks, macros, and why idempotent DDL makes convergence possible at all
34. **[The Five-Round Brawl to Make Schema Convergence Automatic](/blog/clickhouse-schema-convergence-five-rounds/)** — a comment-shredding SQL splitter, ghost replica registrations, a Keeper outage dressed as success, a macro that broke the recovery command, and an ingest table with no business on a backup node — the anatomy of teaching a fleet to converge its own schema
35. **[Postgres Was a Filing Cabinet. ClickHouse Is a Warehouse](/blog/clickhouse-for-postgres-people-warehouse-mergetree/)** — the zero-to-hero on-ramp for SQL people: one five-year-old's picture, every MergeTree concept with its Postgres counterpart (b-tree → sparse index, autovacuum → merges, MVCC → eventual consistency), and the two replication designs that end at SharedMergeTree
36. **[The Loading Dock and the Clipboard: What a ClickHouse S3Queue Table Actually Is](/blog/clickhouse-s3queue-loading-dock-fundamentals/)** — why log pipelines stage files in S3, what a queue table does to a file (discover, claim, parse, insert, delete), and the Keeper clipboard that makes the same queue safe across a fleet — the starting point the backlog-drain and fan-out posts assumed
37. **[Free Is a Route, Not a Setting: The S3 Gateway Endpoint at 30 TB/day](/blog/s3-gateway-endpoint-30tb-day/)** — the `$0.045/GB` NAT Gateway trap, the three silent-bypass paths (route table, cross-region bucket, hardcoded URL), and the plan-time guards that make "free" an invariant
38. **[Don't Ship Tarballs to a Column Store: ClickHouse Compression from S3Queue to MergeTree](/blog/clickhouse-compression-end-to-end-s3/)** — the three compression boundaries in a 30 TB/day pipeline, why `.ndjson.zst` beats `.tgz` and `.gz`, and why compression alone doesn't fix S3 object-count costs
39. **[Why the Fix Didn't Fix It: Stopping a 16.8M-Request S3 API Storm in a ClickHouse Fleet](/blog/stopping-s3-api-storm-clickhouse-fleet/)** — the five interlocking bugs (`TabSeparated` `\'` false-drift drops, `64 GiB` hot `gp3` + `10 MiB` wide parts, EBS `optimizing` timeouts, Nitro NVMe size flips, and unrolled Launch Templates) that kept an `$84/day` S3 API storm alive until every loop was closed
40. **[Why ClickHouse Looked 30% Busy While Maxed Out: The 125 MB/s EBS gp3 Wall](/blog/clickhouse-ebs-iowait-illusion-125-mbs-gp3-wall/)** — why 64 background merges stalled at ~30% user CPU (`0%` idle, `69%` `%iowait`, `805` IOPS hitting `125 MB/s`), and why `$20/mo` for `500 MB/s` `gp3` throughput beat adding `$344/mo` writers by `17x`

## Next

- Hub: [ClickHouse on AWS](/topics/clickhouse-aws/)  
- Full series: [ClickHouse on AWS: Self-Managed from First Principles](/series/clickhouse-on-aws/)  
- Related: [SRE on-call starter pack](/start/sre-on-call/) — the log platform this series describes exists to make on-call investigations faster.

{% include subscribe.html %}

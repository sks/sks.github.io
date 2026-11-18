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
| [Operating Self-Managed ClickHouse: Golden Images, Bootstrap, and Runbooks](/blog/clickhouse-operations-runbooks/) | Golden AMIs, the wrapper-plus-binary bootstrap, rolling config refresh, and the runbook debt plain EC2 owes you versus the operator |
| [Boot Sequence as a Contract](/blog/clickhouse-boot-sequence-contract/) | The ordered checks and failure boundaries of a node boot — identity before render, secrets before render, criticality as data |
| [One Binary to Bootstrap a Node: Why chinit Replaced 3,600 Lines of Bash](/blog/chinit-one-binary-node-bootstrap/) | The boot script as a state machine — the typed spec, retry policies, and state file that replace template variables |
| [From an Empty EC2 Box to a Cluster Member](/blog/clickhouse-aws-bootstrap-chinit-walkthrough/) | Every AWS primitive a node touches between launch and its first query — the AMI, the wrapper, the lease claim, the render — and all twenty-four chinit steps in order |
| [Who Decides What a Node Is Called? Lease Identity for an Ephemeral Stateful Fleet](/blog/chinit-lease-identity-ephemeral-fleet/) | One conditional write, a TTL lease, a drain protocol — stable names for replicas that live in an Auto Scaling Group |
| [The Cloud-Neutral Bootstrapper That Wasn't: Auditing chinit for Azure](/blog/chinit-azure-portability-audit/) | The Fatal assumptions hiding in a "shared" pipeline, the checksum with one signer, and the portability checklist |
| [The Cost Levers of Self-Managed ClickHouse on AWS](/blog/clickhouse-aws-cost-engineering/) | The real monthly numbers — Graviton, a 50% spot split, S3 tiering, and the $1,700/month orphaned-volume leak |
| [After ReplicatedMergeTree: CAS, Iceberg, and When to Just Buy ClickHouse Cloud](/blog/clickhouse-whats-next-cas-iceberg/) | CAS content-addressed storage, Apache Iceberg, and the honest buy-versus-build checklist |
| [Why I Draw ClickHouse Data Flows (and Why EC2 Beat Kubernetes for This Cluster)](/blog/clickhouse-ec2-vs-k8s-mermaid-data-flow/) | Mermaid data-flow diagrams of the whole cluster, and why plain EC2 beat the Kubernetes operator here |
| [Dead Projections and Useless FINAL: Tuning ClickHouse Tenant Databases by Reading the Source](/blog/clickhouse-tenant-tuning-from-source/) | A projection that doubled storage but never ran, why SUM(count) over SummingMergeTree never needs FINAL, the {database} keeper-path macro for per-database tenancy, and the system-log TTL trap |
| [ClickHouse zero-copy replication is dead: the content-addressed design that replaced it](/blog/clickhouse-zero-copy-replication-dead/) | Why zero-copy was deprecated, how its GC broke, and the CAS object model that replaced it — blobs, manifests, ref logs, mount leases, Keeper off the data path |
| [Touching CAS Without Betting the Cluster: A Hands-On Staging Walkthrough](/blog/clickhouse-cas-on-aws-walkthrough/) | Bucket preconditions, the Antalya build, the disk XML, per-partition adoption |
| [What Breaks with ClickHouse CAS, and How to Decide If You Should Run It](/blog/clickhouse-cas-failure-modes/) | Mount refusal, identity drift, GC wedges, the blast radius of a shared pool — and the weighted scorecard for CAS vs SharedMergeTree vs plain replication, with exit costs |
| [Draining 29,000 S3Queue Files Fast: Every Setting That Matters](/blog/clickhouse-s3queue-backlog-drain-optimizations/) | The discovery/claim/insert stages of an S3Queue backlog, every governing setting with source permalinks, and the tuning that took drain up ~8x |
| [Three Days of Keeper Silence](/blog/clickhouse-keeper-silence-alarm-design/) | The lost metric push, the missing timer, missing-data semantics that hid it, and why liveness alarms must treat silence as failure |
| [The Self-Terminating Alarm](/blog/asg-per-host-scale-in-wedge/) | How a per-host scale-in alarm kills every scale-out — and the aggregate ASG-dimension alarm that fixes it |
| [When df Lies: Effective Disk Headroom](/blog/clickhouse-effective-disk-headroom-self-healing/) | keep_free_space vs the df view, the merge-stall cascade, and a job that grows EBS volumes + ext4 online before parts explode |
| [The Fleet That Could Not Heal Itself](/blog/fleet-that-could-not-heal-itself/) | A loopback TLS storm, a cluster config listing dead nodes, two definitions of "overloaded" — and the detection-diagnosis-remedy chain behind actual self-healing |
| [Graviton Roulette: NVMe Device Names Broke Our Boot](/blog/gravitron-nvme-enumeration-boot-disk-guard/) | Device-name roulette across instance types, the e2label near-miss on root, and the label-first/partition-skip/patient-wait disk guards |
| [S3Queue Is a Multi-Node Engine](/blog/s3queue-multi-node-ingest-fanout/) | Keeper-claimed files, exactly-once across the fleet, and the one-table fix that turned one-node 100% ingest into single-digit fleet CPU |
| [The Roster, the Journal, and the Bookmarks](/blog/clickhouse-replicated-table-roster-journal-bookmarks/) | The plain-English mental model for replicated tables — membership, the shared operations log, per-replica bookmarks, macros, and idempotent DDL — that makes the debugging stories readable |
| [The Five-Round Brawl to Make Schema Convergence Automatic](/blog/clickhouse-schema-convergence-five-rounds/) | A comment-shredding splitter, ghost replica registrations, failure dressed as success, a macro that broke its own recovery command, and role-scoped DDL — teaching a fleet to converge its schema with no human in the loop |
| [Postgres Was a Filing Cabinet. ClickHouse Is a Warehouse](/blog/clickhouse-for-postgres-people-warehouse-mergetree/) | The zero-to-hero on-ramp for SQL people — the five-year-old's picture, every MergeTree concept mapped to its Postgres counterpart, and the two replication designs ending at SharedMergeTree |
| [The Loading Dock and the Clipboard](/blog/clickhouse-s3queue-loading-dock-fundamentals/) | Why log pipelines stage files in S3, one file's journey through an S3Queue table, and the Keeper clipboard that makes the same queue safe on a whole fleet — the starting point the backlog and fan-out posts assumed |
| [Free Is a Route, Not a Setting: The S3 Gateway Endpoint at 30 TB/day](/blog/s3-gateway-endpoint-30tb-day/) | The `$0.045/GB` NAT Gateway trap, the three silent-bypass paths, and the plan-time guards that keep S3 traffic free |
| [Don't Ship Tarballs to a Column Store](/blog/clickhouse-compression-end-to-end-s3/) | The three compression boundaries in a 30 TB/day S3 pipeline, why `.ndjson.zst` beats `.tgz`, and why byte ratio doesn't fix object-count PUTs |
| [Why the Fix Didn't Fix It: Stopping a 16.8M-Request S3 API Storm](/blog/stopping-s3-api-storm-clickhouse-fleet/) | Five interlocking bugs between a fix on paper and a draining fleet: `TabSeparated` `\'` false-drift drops, `64 GiB` hot disks + `10 MiB` wide parts, EBS `optimizing` timeouts, Nitro NVMe size flips, and unrolled Launch Templates |
| [Why ClickHouse Looked 30% Busy While Maxed Out: The 125 MB/s EBS gp3 Wall](/blog/clickhouse-ebs-iowait-illusion-125-mbs-gp3-wall/) | Why 64 merges stalled at ~30% `%usr` (`0%` idle, `69%` `%iowait`, `805` IOPS pinned at `125 MB/s`), and how `$20/mo` `gp3` `500 MB/s` throughput flipped `%usr` to `89.4%` in 20 seconds |
| [The Math of ClickHouse CAS on AWS: How Content-Addressed S3 Cuts Cold Storage from R× to 1×](/blog/clickhouse-cas-cost-math-s3-deduplication/) | Closing the silent S3 Gateway Endpoint leaks, the exact $r \times \frac{V}{c}$ storage and cross-AZ math at 30 TB/day, the four traps of enabling CAS in Terraform/CI, and reaching `0.26¢–0.38¢/GB` COGS |
| [Meet chinit: Running ClickHouse on Plain Cloud VMs Without Missing Kubernetes](/blog/announcing-chinit-clickhouse-vms-vs-operator/) | Open-sourcing `chinit` (`v0.2.0`, Apache-2.0): plain-English lifecycle walkthrough, honest pros and cons vs. `clickhouse-operator`, and who benefits |

{% include subscribe.html %}

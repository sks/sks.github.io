---
layout: post
title: "The S3 Path Bug Nobody Sees: Silent Config, Shattered Tenants, and a CAS-Ready Fix"
date: 2026-11-14 08:00:00 -0800
series: "ClickHouse on AWS: Self-Managed from First Principles"
series_order: 11
description: "ClickHouse silently ignored a storage config element on every boot, and every tenant's parts landed in one shared bucket root. How I proved it live, why zero-copy deprecation makes per-replica paths mandatory, and the policy shape that makes CAS a drop-in later."
image: /assets/images/og-default.png
tags: [clickhouse, s3, storage, cas, debugging, sre, infrastructure]
permalink: /blog/clickhouse-s3-key-prefix-silent-config-bug/
faqs:
  - question: "What was the silent config bug?"
    answer: "The tenant S3 disks configured <key_prefix>data/<tenant>/</key_prefix>, but key_prefix is not a supported element for s3-type disks in ClickHouse 26.8 — the server silently ignores unknown elements in disk config. Every tenant's parts were landing in the bucket root under generated 3-character prefixes, matching nothing the per-tenant IAM policies scoped."
  - question: "How do you give each replica its own S3 path?"
    answer: "Put the path in <endpoint_subpath> instead of <key_prefix>. endpoint and endpoint_subpath are macro-expanded, so <endpoint_subpath>data/<tenant>/{replica}/</endpoint_subpath> resolves per node from the macros. This is the Altinity-documented pattern, and without zero-copy replication it is mandatory: replicas sharing one prefix corrupt each other's objects on merge and TTL deletes."
  - question: "Why can't replicas just share one S3 prefix?"
    answer: "Zero-copy replication — the feature that let replicas share objects — was deprecated upstream in 2025 (ClickHouse PR #82250 removed its tests). Without it, each replica physically copies parts, and if they share a prefix, one replica's merge or TTL delete removes objects another replica's metadata still references. Broken parts, 404s, refetch storms."
  - question: "What makes a storage policy CAS-ready?"
    answer: "Two volumes in the Altinity cas_with_ttl shape: hot (local disk, volume_priority=1) and cold (S3, volume_priority=2, perform_ttl_move_on_insert=false, prefer_not_to_merge=true). Insert lands locally and TTL moves merged parts to S3. Adopting CAS later swaps only the disk definition — type=s3 becomes object_storage with metadata_type=cas on a shared prefix — and no policy or DDL changes."
  - question: "How did the bug get found and fixed live?"
    answer: "I created a test table with the tenant storage policy on the running cluster, inserted 5,000 rows, and listed the bucket: parts appeared at the root under random 3-character prefixes, nothing under data/<tenant>/. The fix moved tenant and replica segments into endpoint_subpath; re-running the same test showed parts in data/<tenant>/<replica>/, verified on both the writer and reader with zero overlap."
---

Every infrastructure team has a bug class they don't have a name for until
it bites: the config element that parses, validates, applies — and does
nothing. This post is about finding one in a running ClickHouse cluster,
the deprecation it was hiding, and what a correct Amazon Simple Storage Service (S3) layout looks like
once you stop trusting the config file and start asking the bucket.

The short version: for months, every multi-tenant S3 disk on my cluster
was configured with a `key_prefix`. ClickHouse 26.8 silently ignored it.
Every tenant's parts landed in the bucket root under generated
three-character prefixes. The per-tenant Identity and Access Management (IAM) policies that scoped
`data/<tenant>/*` matched nothing ClickHouse actually wrote. And the
comment in my own settings file claimed zero-copy replication was the
default on shared object storage — which upstream deprecated in 2025.

**Key takeaways**

- `<key_prefix>` is not a supported element for s3-type disks in
  ClickHouse 26.8 — unknown disk-config elements are silently ignored.
  Tenant paths must live in `endpoint_subpath`, which is macro-expanded.
- Zero-copy replication is deprecated (pull request (PR) #82250). Without it, replicas
  physically copy parts, so every replica needs its own S3 prefix — a
  shared prefix means one replica's merge deletes another replica's
  objects while its metadata still references them.
- The Content-Addressed Storage (CAS)-ready policy shape is two volumes: hot local
  (`volume_priority=1`), cold S3 (`volume_priority=2`,
  `perform_ttl_move_on_insert=false`). Insert locally, then move parts to S3 when their time-to-live (TTL) expires.
  CAS adoption later is a disk-definition swap, not a migration.
- Prove storage layout with a live insert and an `aws s3 ls`, not with a
  config review. The bucket is the only witness that tells the truth.
{: .key-takeaways}

---

## The config that lied

The multi-tenant design was clean on paper. Each tenant got an S3 disk
with a key prefix:

```xml
<disk_default>
    <type>s3</type>
    <endpoint from_env="CH_S3_ENDPOINT" />
    <key_prefix>data/default/</key_prefix>
    <use_environment_credentials>true</use_environment_credentials>
    <skip_bucket_creation>true</skip_bucket_creation>
</disk_default>
```

`CH_S3_ENDPOINT` is the bucket root. The `key_prefix` is supposed to
scope every object the disk writes under `data/default/`. The IAM policy
grants the node roles access to `data/*`, the lifecycle rule tiers
`data/*` to Standard-IA, and the chargeback story prices per-tenant
prefixes. Tenants can never collide. Except none of that was happening.

The first hint was in the bucket:

```
$ aws s3 ls s3://ch-int-dev-clickhouse-data/
                           PRE bootstrap/
                           PRE szl/
```

No `data/` prefix. Just `bootstrap/` (the node bootstrap artifacts) and
`szl/` — a cryptic three-character directory with a single tiny object.
A tenant table had been writing for weeks. Where were its parts?

## Proving it live

Config review finds nothing wrong: the Extensible Markup Language (XML) parses, the server boots, the
disk answers in `system.disks`:

```
┌─name─────────┬─type──────────┐
│ default      │ Local         │
│ disk_default │ ObjectStorage │
│ s3           │ ObjectStorage │
└──────────────┴───────────────┘
```

The only witness that tells the truth is the bucket. So I created a test
table with the tenant policy and inserted 5,000 rows:

```sql
CREATE TABLE storage_prefix_test ON CLUSTER `ch-int-dev`
(ts DateTime, msg String)
ENGINE = ReplicatedMergeTree('/clickhouse/01/storage_prefix_test', '{replica}')
ORDER BY ts
SETTINGS storage_policy='tenant_default';

INSERT INTO storage_prefix_test
SELECT now() + number, 'test row ' || toString(number) FROM numbers(5000);
```

Then listed the bucket by timestamp:

```
$ aws s3 ls s3://ch-int-dev-clickhouse-data/ --recursive
2026-11-12 13:28:02  40780  dbk/gbiwvlpelexvujrpvwdcwoopbmaiq
2026-11-12 13:28:02     66  gxn/wlfwqahehruqanckcnjzkqjnyferr
2026-11-12 13:28:02      1  hlx/eyhmmcjmnkwccbzvmgecplpdikshl
2026-11-12 13:28:02    312  jce/aphumsxqfzhlbbxsrpvvnsysznqig
```

Thirteen objects under thirteen random three-character prefixes,
timestamped at the exact second of my insert. Nothing under
`data/default/`. The `key_prefix` had never done anything.

The bug was in the source. `ObjectStorageFactory.cpp` in 26.8 reads
exactly four path elements for an s3 disk: `endpoint`,
`endpoint_subpath`, `key_template`, and `key_compatibility_prefix`.
`key_prefix` is not among them — it exists for `local_blob_storage`
disks only. And the disk loader does not reject unknown elements; it
skips them. A typo'd config element doesn't fail the boot. It just
doesn't exist.

For a junior engineer: this is the difference between a config error and
a config lie. An error shouts at startup. A lie passes every check and
writes your data somewhere you never asked.

## The second problem: why "just share the prefix" is wrong

The tempting fix is to delete `key_prefix` and put the tenant path in the
endpoint — one shared prefix per tenant, all replicas writing to it.
That's how the settings file described the existing design:

> allow_remote_fs_zero_copy_replication was REMOVED in modern ClickHouse —
> zero-copy sharing of S3 parts between replicas is the default behavior
> for replicated tables on shared object storage.

That comment was wrong, and it matters. Zero-copy replication — the
mechanism where one replica writes an S3 object and the others reference
it without copying — was deprecated upstream in 2025
([PR #82250](https://github.com/ClickHouse/ClickHouse/pull/82250)
removed its tests). The garbage collector couldn't prove orphans safe to
delete. Without zero-copy, a ClickHouse maintainer's own words on
[issue #98475](https://github.com/ClickHouse/ClickHouse/issues/98475)
are the design: physical copying, always.

So on a shared prefix, each replica physically writes its own copy of
every part — into the *same* object keys. A merge on writer-0 rewrites
parts and deletes the originals; reader-0's metadata still points at the
deleted objects. TTL drops do the same. You get broken parts, S3 Hypertext Transfer Protocol (HTTP) 404 (not found) errors,
and refetch storms that look like replication problems, not storage
problems.

The rule, per Altinity's own administrative best practices: **every
replica writes its own S3 path.** The pattern uses macros:

```xml
<endpoint_subpath>data/${tenant}/{replica}/</endpoint_subpath>
```

`endpoint` and `endpoint_subpath` are macro-expanded at load, and
`{replica}` resolves from each node's `macros.xml` — the same identity
machinery from
[the last post](/blog/clickhouse-replica-identity-config-render/).
Writer-0 writes `data/default/writer-0/`, reader-0 writes
`data/default/reader-0/`, and neither can touch the other's objects.

After the fix, the same live test on both nodes:

```
$ aws s3 ls s3://ch-int-dev-clickhouse-data/data/default/
                           PRE reader-0/
                           PRE writer-0/
```

Two prefixes, one per replica, zero overlap. That's the whole fix. The
IAM scopes still work because `data/<tenant>/*` covers the new
`{replica}` sub-segments, and chargeback still prices per tenant.

## The cost model this buys you (and the one it doesn't)

Honesty about what per-replica paths mean for the bill. With zero-copy
dead and CAS not yet adopted, cold storage scales with replica count:

```
cold bytes ≈ sum over tenants of (N_replicas × tenant cold bytes)
```

A reader Auto Scaling Group (ASG) scaling 3 → 10 multiplies the cold tier by up to ~3.3×.
That is the structural cost from
[the CAS post](/blog/clickhouse-whats-next-cas-iceberg/) — it is not a
setting, it is the engine — and per-replica paths make it visible
instead of hiding it in a shared prefix's key collisions. I'd rather
have an honest line item than a corrupt data path. When
[CAS](https://altinity.com/blog/introducing-cas-drop-in-compute-storage-separation-for-clickhouse-mergetree-tables)
is ready, the cold tier collapses back to one object pool — the layout
below is the shape it drops into.

## The policy shape that makes CAS a drop-in

The old tenant policy wrote directly to S3 on every insert — the
expensive path Altinity explicitly says not to optimize for. The
restructure follows their `cas_with_ttl` pattern:

```xml
<tenant_default>
    <volumes>
        <hot>
            <disk>default</disk>
            <volume_priority>1</volume_priority>
        </hot>
        <cold>
            <disk>disk_default</disk>
            <volume_priority>2</volume_priority>
            <perform_ttl_move_on_insert>false</perform_ttl_move_on_insert>
            <prefer_not_to_merge>true</prefer_not_to_merge>
        </cold>
    </volumes>
    <move_factor>0.1</move_factor>
</tenant_default>
```

Three decisions in there that each earn their keep:

- **Explicit `volume_priority`.** On 26.8, volume order is config order
  when no volume sets a priority, and once any does, priorities must
  cover 1..N. Explicit numbers remove the ambiguity for the next editor.
- **`perform_ttl_move_on_insert=false`.** Inserts never wait on S3; the
  background TTL job moves merged parts after the fact. Tables declare
  the hot window: `TTL ts + INTERVAL 7 DAY TO VOLUME 'cold'`.
- **`prefer_not_to_merge=true` on cold.** Merges must not rewrite S3
  objects on every fan-in. TTL moves handle decay.

And the CAS seam: adopting content-addressed storage later swaps only
the disk definition — `type=s3` becomes `object_storage` with
`metadata_type=cas` on a *shared* prefix (no `{replica}` segment,
because the hash identifies the object, not the owner). Every policy,
every table, every data definition language (DDL) statement stays untouched. That's the entire point of the
shape.

Verified live on the restructured policy: a 10,000-row insert lands on
`default` (the local hot volume) on both replicas, `MOVE PARTITION TO
VOLUME 'cold'` moves each replica's parts to its own S3 prefix, and a
TTL rule materializes the move without a manual `ALTER`.

## The fleet-replacement debugging chain

Applying the fix live taught the harder lesson: a config change on this
stack triggers a fleet replacement (the config hash rolls the ASG), and
every fresh boot re-runs the bootstrap that renders users, macros, and
cluster config. When that chain breaks, the failure modes masquerade as
each other:

1. **Authentication (auth) failures everywhere.** The writer's chctl user render produced
   a malformed `z_chctl-users.xml` — two nested `<clickhouse>` roots.
   The server crash-looped on `SAXParseException`, then on a missing
   profile. The reader's render had produced the correct file. Same
   rollout, different node, different result.
2. **A second auth conflict from the base image.** The fresh writer's
   packaged `users.xml` carried a `<password>` for `default`; the users.d
   override added `password_sha256_hex`. Two auth methods for one user =
   `BAD_ARGUMENTS` at startup. The fix: one mechanism, one file.
3. **"Cannot connect to localhost:9000" with a healthy binary.** The
   systemd unit uses `Type=notify` with a pidfile; a half-configured
   node fails the notify handshake even though `clickhouse-server`
   starts fine in the foreground.
4. **Root-start refusals.** Emergency starts ran as root; 26.8 refuses
   when the data directory is owned by `clickhouse`:
   `MISMATCHING_USERS_FOR_PROCESS_AND_DATA`. Amazon Web Services (AWS) Systems Manager (SSM) runs as root —
   `sudo -u clickhouse` or the systemd unit, always.
5. **Missing macros.** A fresh boot whose metadata disk attached slowly
   aborted bootstrap before rendering `macros.xml`, and every
   `ON CLUSTER '{cluster}'` statement failed with
   `NO_ELEMENTS_IN_CONFIG`. The schema is fine; the node never got its
   identity.

The recovery for all of it was the same shape: restore identity
(macros), restore auth (one auth method per user), start via systemd,
then re-apply the schema — which, because it's a single idempotent file
with `IF NOT EXISTS`, converges in one pass. The schema-sync unit then
propagated it to every replica that booted later. No data was lost
because development (dev) is a zero-data environment; the runbook documents the production (prod) path (restore from backup, or re-replicate from a healthy peer).

## What I'd tell the next person

- **A storage layout is verified with `aws s3 ls`, not with a config
  file.** Insert a known number of rows, list the bucket, compare. Ten
  minutes, and it caught a months-old bug that every config review had
  passed.
- **Treat unknown-element silence as a design risk.** ClickHouse ignoring
  `key_prefix` is the same failure class as a typo'd setting name
  anywhere: validated at review, absent at runtime. Where the data lands
  is the only contract.
- **Per-replica S3 paths are not an optimization.** With zero-copy
  deprecated, they're the correctness requirement — the alternative is
  replicas deleting each other's objects.
- **Version the config generator, pin it, and render it offline.** The
  render-smoke check in the repo — render every template, `bash -n` the
  scripts, parse the XML — exists because these bugs surface as boot
  failures 30 minutes into a fleet rollout. It's the cheapest insurance
  in the stack.

The repo now documents all of it: the per-replica path contract in the
module's AGENTS.md, the cost model and CAS migration diff in the
scaling runbook, and the corrected replication diagram. The schema that
runs on top of this storage is one idempotent Structured Query Language (SQL) file — replicated
engines, `ON CLUSTER` everywhere, and the materialized-view chain it
feeds — the same single-file shape that let the fleet re-apply it in one
pass after every replacement.

Previous: [ClickHouse Config Is Not YAML Ain't Markup Language (YAML): What One Re-Render Taught Me About Replica Identity](/blog/clickhouse-replica-identity-config-render/).

Series index: [ClickHouse on AWS: Self-Managed from First Principles](/series/clickhouse-on-aws/).

---
layout: post
title: "Running ClickHouse Readers on Spot: The Stable-Identity Problem"
date: 2026-11-09 09:00:00 -0800
series: "ClickHouse on AWS: Self-Managed from First Principles"
series_order: 5
description: "A DynamoDB ordinal claimer gives spot-launched ClickHouse readers a stable replica name across instance generations."
image: /assets/images/og-default.png
tags: [clickhouse, aws, spot-instances, dynamodb, sre]
permalink: /blog/clickhouse-spot-readers-stable-identity/
faqs:
  - question: "Why do ClickHouse readers on spot instances need a stable identity?"
    answer: "ClickHouse keeps replication state keyed by replica name, not by AWS instance ID. A spot replacement boots with a new ID, so if it also picks a new replica name it either re-downloads all its data or collides with a live replica's Keeper path."
  - question: "How does the DynamoDB ordinal claimer work?"
    answer: "Each booting reader tries reader-0, reader-1, and so on with a conditional PutItem that succeeds only if the row is absent or its lease_until is in the past. The first writer wins the ordinal; DynamoDB evaluates the condition inside the write, so two racing readers cannot both win."
  - question: "What happens if a spot reader dies without releasing its lease?"
    answer: "Its renewal cron stops, so the 15-minute lease expires and the claim becomes acquirable within at most 15 minutes. The 5-minute renewal cadence tolerates two missed cron runs before another instance can take the ordinal."
  - question: "Why keep any on-demand readers when spot is about 70% cheaper?"
    answer: "A capacity event can reclaim every spot instance in an availability zone at once. The on-demand floor bounds worst-case reader loss; prod runs reader_spot_ratio 0.5, dev runs 1.0 because brief reader loss there is acceptable."
---

Same replica. Different instance every hour.

I run a log analytics platform on self-managed ClickHouse. Most queries go to the readers. A reader is a replica: it serves read queries (SELECT) and holds a full copy of the data. If one reader dies, the others answer its queries. That makes readers good candidates for Amazon Elastic Compute Cloud (EC2) Spot. Spot instances are spare Amazon Web Services (AWS) capacity. They cost up to about 70% less than normal on-demand machines. In exchange, AWS can take a spot machine back at any time, with a two-minute warning ([AWS Spot](https://aws.amazon.com/ec2/spot/)).

The problem is not price. It is identity. Imagine a company with three shared reception desks, numbered 0, 1, and 2. Those desks are our readers: `reader-0`, `reader-1`, `reader-2`. The desks are staffed by temporary workers, who cost much less than permanent staff and arrive and leave all the time. Those workers are spot instances. Each desk has a logbook. The logbook records everything that happened at that desk, and it belongs to the desk number, not to the person sitting there. In ClickHouse terms, the logbook is the replication state: the record of which data parts a replica holds, stored under paths in [ClickHouse Keeper](https://clickhouse.com/docs/en/operations/clickhouse-keeper), the coordination service that replaced ZooKeeper. A new worker must take over a desk number together with its logbook. If she sits at a desk with a random new number, she has no logbook. If she shares desk 2's logbook, two people write in the same book and the records get damaged. This post describes the fix: a DynamoDB ordinal claimer.

**Key takeaways**

- Spot readers are ~70% cheaper, but ClickHouse replica identity must be stable across instance generations; the Auto Scaling Group (ASG) will not give you that.
- A one-table DynamoDB claimer arbitrates who is `reader-0`: one conditional PutItem per ordinal, no locks and no leader.
- A 15-minute lease renewed every 5 minutes frees a dead reader's name on its own and tolerates two missed cron runs.
- The 2-minute spot warning handler releases the claim and drains ClickHouse; without it every eviction leaves a ghost and an Amazon Simple Storage Service (S3) re-warm.
{: .key-takeaways}

---

## Why identity breaks on spot

Every node declares its identity in a macro (a named value in the server's config):

```xml
<macros>
  <cluster>logs</cluster>
  <replica>reader-0</replica>
</macros>
```

ReplicatedMergeTree tables keep per-replica bookkeeping under Keeper paths like `/clickhouse/tables/{shard}/{table}/replicas/{replica}`. The name is the identity. A random name hurts two ways:

1. The replacement boots as `ip-10-0-1-42`. Keeper has no state for that name, so the table starts cold (from an empty state) and re-fetches every part from S3 and peers. On a reader with tiered storage (data kept in S3, a small local cache), that is many S3 downloads and a large bill. It is the worker sitting at a desk number with no logbook, rebuilding her records from nothing.
2. Worse: the replacement claims a name that a live replica already owns. Two writers on one Keeper path is split-brain — two replicas writing the same record at the same time. ClickHouse's own docs warn it can corrupt data. It is two workers writing in one logbook, destroying each other's pages.

An ASG is the AWS service that adds and removes machines automatically. It gives you temporary instance identifiers (IDs). ClickHouse needs a stable name. Nothing in AWS provides one for free. That is the gap.

## The ordinal claimer

Back at the office: put a sign-in sheet at the door. One strict receptionist manages the sheet. Every arriving worker asks the receptionist for desk 0. The receptionist says yes only if the sheet line for desk 0 is empty, or if the badge on that line has expired. (Each winner receives a badge valid for 15 minutes — the lease, explained below.) Otherwise the worker asks for desk 1, then desk 2. Only one person can win a desk, because the receptionist checks the sheet and writes the name in one single action. In ClickHouse terms, the receptionist is DynamoDB and one line of the sign-in sheet is a conditional write. Concretely: one table, hash key `hostname`, one row per reader: `reader-0`, `reader-1`, `reader-2`. Three routines.

**Claim at boot.** Try ordinals in order; the first conditional write wins:

```bash
aws dynamodb put-item \
  --table-name reader-claims \
  --item "{\"hostname\":{\"S\":\"reader-0\"},
           \"instance_id\":{\"S\":\"i-xyz\"},
           \"lease_until\":{\"N\":\"$((now + 900))\"}}" \
  --condition-expression \
    "attribute_not_exists(hostname) OR lease_until < :now"
```

That condition is the design. DynamoDB evaluates the condition inside the item write, so the check and the write are one atomic step: two readers racing for `reader-0` cannot both win ([condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html)). No locks, no coordinator, no leader election — no node is voted the boss. The loser's write fails and it tries the next ordinal, just as the receptionist never accepts two names on one desk line.

**Renew.** A cron job (a scheduled task) on the reader pushes `lease_until` 15 minutes out, every 5 minutes. The update is conditional on `instance_id = me`, so a stale instance cannot extend someone else's lease.

**Release.** On a spot interruption, delete the row. The ordinal becomes free immediately.

Expired rows are deleted by DynamoDB time-to-live (TTL), which removes expired items on its own schedule — typically within 48 hours. That is only extra cleanup. Correctness never depends on it. Only the lease comparison matters.

```
boot                        every 5 min                spot warning (2 min)
────────                    ───────────                ────────────────────
claim: PutItem row           renew: UpdateItem          release: DeleteItem
  reader-0, lease +15 min     lease_until = now+15m     + de-register DNS
  condition:                  condition:                then drain:
  attribute_not_exists         instance_id = me         STOP REPLICATION QUEUES
  OR lease_until < now                                  STOP DISTRIBUTED SENDS
                                                        SYSTEM SHUTDOWN

instance dies silently: renewals stop → lease expires in ≤ 15 min → ordinal free
```

## Why a lease and not a delete

In the office, every worker carries a badge. The badge is valid for 15 minutes. The worker must renew it every 5 minutes. If a worker faints and never returns her badge, the badge expires by itself after 15 minutes, and the desk becomes free. Nobody has to walk to the desk and check. In ClickHouse terms, the badge is the lease: the `lease_until` value in the claim row.

A reader that dies without a spot warning — a kernel panic (an operating system crash) or a failed health check — stops renewing. Within at most 15 minutes its ordinal is free for the replacement. The 5-minute renewal against a 15-minute lease is the tolerance: two missed cron runs (10 minutes) and the claim still holds; the third miss loses it. This is the same heartbeat idea as any distributed lease. Choose the numbers to match how often your machines fail.

## What the claim unlocks

The claimed ordinal becomes the hostname: `reader-0`. That drives the `{replica}` macro, so Keeper paths stay stable. At claim time the node also registers an A record in a Route 53 private hosted zone (Domain Name System (DNS) that works only inside the virtual private cloud (VPC)) with a 60-second TTL. Peers can therefore always find its address. On restart the node comes back with the same name. It finds its replication state and copies only the missing changes instead of starting cold. That is the worker signing in for desk 1, opening the desk-1 logbook, and reading what she missed. Restart is boring. Boring is the goal.

## The spot interruption handler

The office has a loudspeaker. When AWS reclaims a spot machine, the loudspeaker says: "You have two minutes to leave." A good worker does three things before she walks out: she signs out at the door, she returns her badge, and she stops writing in the logbook mid-sentence. The next worker can then take over the desk cleanly. In ClickHouse terms, the loudspeaker is the spot interruption notice, and the three actions are DNS de-registration, lease release, and the STOP statements below.

AWS publishes a 2-minute warning before it reclaims a spot machine: a call to the instance metadata service returns 200 on `spot/instance-action` instead of 404 ([spot interruption notices](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/spot-interrupts.html)). A unit on every reader polls every 5 seconds. On the warning it drains, in order:

```sql
SYSTEM STOP REPLICATION QUEUES;  -- no fetch or merge starts mid-shutdown
SYSTEM STOP DISTRIBUTED SENDS;  -- no in-flight file send gets cut
SYSTEM SHUTDOWN;                 -- drain, then exit
```

then it de-registers the DNS record and releases the lease.

Skip the handler and every eviction leaves a "ghost" — a record that belongs to a dead machine, like a name plate on an empty desk. The DNS record points at a dead Internet Protocol (IP) address. The claim row stays leased for up to 15 minutes, so the replacement cannot take the name. When it finally takes the name, it boots cold and re-downloads its data from S3. That is a 15-minute ghost window plus a full S3 re-download per eviction. These are the exact costs that spot was supposed to save.

## The on-demand floor

One risk remains. In a storm, the temp agency may recall all temporary workers at the same moment. If every desk is staffed by temps, reception closes completely. So the company keeps half the desks staffed by permanent employees, whom the agency cannot recall, and reception never fully closes. In ClickHouse terms, the permanent staff are on-demand readers, and the split is `reader_spot_ratio`.

Prod runs `reader_spot_ratio = 0.5`: half the readers spot, half on-demand. A capacity event (AWS suddenly needing many machines back) in one availability zone can reclaim every spot reader at once. The on-demand floor — a guaranteed minimum of always-running readers — limits the worst case, so queries keep serving. Dev runs 1.0; two minutes of dev reader loss is fine. The reader ASG also diversifies across at least two Graviton families (r7g and r8g, m7g and m8g) with capacity-optimized allocation. That strategy picks the pool that is interrupted least often, not the cheapest one.

## What still fails sometimes

The claimer works when I exercise it by hand: claim, renew, release, and lease expiry all behave. On the deployed dev cluster it does not reliably complete on ASG-launched instances. The DynamoDB call inside cloud-init (the AWS first-boot script) seems to conflict with another startup step. I have not found the cause yet. The current workaround: reader-0's name is applied via SSM (AWS Systems Manager, AWS's tool for remotely running commands on machines) at launch instead. The open follow-up is retries plus structured logging in the claim path, so the next failure says which ordinal, which attempt, and why. I publish this anyway. The mechanism is correct. The failure is a small implementation bug, not a design error. Describing what still fails is more useful than presenting a perfect diagram.

Previous: [S3 tiered storage for ClickHouse](/blog/clickhouse-s3-tiered-storage/). Next: [Operating self-managed ClickHouse: golden images, bootstrap, and runbooks](/blog/clickhouse-operations-runbooks/).

---

*Stable identity is not an EC2 feature. It is one small table and one conditional write.*

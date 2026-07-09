---
layout: post
title: "AI-Augmented Incident Triage for SREs"
date: 2026-07-07 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 15
description: "What actually helps on-call versus what sounds good in a demo — a practitioner's honest take on AI incident triage."
tags: [sre, incident-response, on-call, ai-agents, production]
---

The demo version of AI incident triage is seductive: alert fires, agent reads it, agent fixes it, you go back to sleep. The on-call version is messier — ambiguous alerts, partial telemetry, three services pointing fingers, and a human who still owns the pager.

We built AI triage into Aiden after watching SRE teams drown in the first thirty minutes of incidents. Not to replace on-call engineers. To **shrink the time between "something's wrong" and "we know where to look."**

Here's what actually helped versus what sounded good in slide decks.

---

## The Problem: The First Thirty Minutes Are Expensive

Incident triage isn't fixing. It's narrowing: What's broken? What changed? Who's impacted? What do we already know?

That work is repetitive and parallelizable. Pull recent deploys. Check error rates. Scan similar past incidents. Correlate the alert with dashboards. Draft a timeline for the channel.

It's also where fatigue kills. At 3 AM, even senior engineers skip steps. They jump to the last incident that looked like this one. Sometimes they're right. Sometimes they chase a red herring for an hour.

We wanted an agent that does the boring parallel work while the human thinks — not an agent that closes the incident and sends a self-congratulatory summary.

---

## What Actually Helped

### Correlating Signals Across Systems

The highest-value triage step was connecting dots humans reach for manually: deploy timestamps next to error spikes, saturation metrics next to queue depth, customer reports next to regional failure patterns.

The agent didn't need to *decide* the root cause. It needed to **present a hypothesis board** — "here are five things that changed in the last hour, ranked by plausibility, with links to evidence."

Operators told us this alone saved meaningful time. Not because the model is smarter than them. Because it doesn't get tired and forget to check the CDN when the API looks sick.

### Drafting the Incident Timeline

Writing "12:04 — alert fired, 12:07 — deploy completed, 12:09 — error rate elevated" in Slack while debugging is friction nobody needs. An agent that drafts the timeline from audit logs and alert history — for human edit — kept channels coherent without pulling engineers out of investigation mode.

### Surfacing Similar Past Incidents

Institutional memory is uneven. The engineer who fixed this exact failure two years ago might be on vacation. Searchable runbooks help, but only if someone remembers the right keywords.

Semantic search over past incident summaries and postmortems gave on-call a "have we seen this before?" answer in seconds. Quality depended entirely on how well past incidents were documented — garbage in, garbage out, no AI magic.

### Preparing RCA Skeletons

After mitigation, writing the RCA is another chore. An agent that drafts structure — timeline, impact, contributing factors, open questions — from execution traces gave teams a head start. Humans still owned conclusions. The draft prevented staring at a blank doc.

---

## What Didn't Help (Or Made Things Worse)

### Auto-Remediation Without Guardrails

Restarting pods because error rates spiked feels heroic in a demo. In production, it masks underlying issues, violates change policy, and trains teams to distrust the agent. We learned this lesson overlaps heavily with [defense in depth for tool calls](/blog/defense-in-depth/) — triage agents investigate first.

### Confident Root Cause Narratives

Models narrate well. "The root cause was a memory leak in the payment service" reads authoritative whether or not it's true. On-call needs **evidence-linked hypotheses**, not prose that sounds like a finished postmortem.

### Replacing the Bridge Call

Coordination is human. Agents don't resolve disagreements between service owners. They can brief participants faster — they can't run the bridge.

---

## Lessons Learned

1. **Triage is narrowing, not fixing.** Optimize for "where to look next," not "incident resolved."

2. **Evidence links beat eloquent summaries.** Every claim should point at telemetry, logs, or change records humans can verify.

3. **Draft for humans, don't publish for them.** Timelines and RCAs are edit-then-send, not auto-post.

4. **Institutional memory quality is your ceiling.** AI search over messy incident history returns messy answers. Invest in postmortem hygiene.

5. **The pager still belongs to a person.** AI that tries to close the loop without human ownership erodes trust fast.

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

*What's the one triage step you wish happened automatically on every page? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*



---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

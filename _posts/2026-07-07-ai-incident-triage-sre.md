---
layout: post
title: "AI-Augmented Incident Triage for SREs"
date: 2026-07-07 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 15
description: "What actually helps on-call versus what sounds good in a demo — a practitioner's honest take on AI incident triage, grounded in how we fan out context gathering in Go."
tags: [sre, incident-response, on-call, ai-agents, production, golang]
---

The demo version of AI incident triage is seductive: alert fires, agent reads it, agent fixes it, you go back to sleep. The on-call version is messier — ambiguous alerts, partial telemetry, three services pointing fingers, and a human who still owns the pager.

We built AI triage into Aiden after watching SRE teams drown in the first thirty minutes of incidents. Not to replace on-call engineers. To **shrink the time between "something's wrong" and "we know where to look."**

Here's what actually helped versus what sounded good in slide decks — and how the Go runtime underneath makes the parallel work cheap enough to ship.

---

## The Problem: The First Thirty Minutes Are Expensive

Incident triage isn't fixing. It's narrowing: What's broken? What changed? Who's impacted? What do we already know?

That work is repetitive, highly parallelizable, and perfectly suited for an orchestrator. Pull recent deploys. Check error rates. Scan similar past incidents. Correlate the alert with dashboards. Draft a timeline for the channel.

It's also where fatigue kills. At 3 AM, even senior engineers skip steps. They jump to the last incident that looked like this one. Sometimes they're right. Sometimes they chase a red herring for an hour.

We wanted an agent that does the boring parallel work while the human thinks — not an agent that closes the incident and sends a self-congratulatory summary.

---

## Under the Hood: Concurrency for Rapid Triage

This series is about building an enterprise agent platform in Go. Triage is where that choice pays rent.

Aiden does not walk your stack sequentially. When an alert hits the webhook path, the runtime fans out read-only context gathering with bounded concurrency (`errgroup`-style coordination): metrics spikes, recent rollouts, and similar past incidents run in parallel, then merge into a structured payload for the model.

Illustrative shape — not a copy of production types:

```go
// Concurrent context gather — illustrative pattern, not production source.
func (a *TriageAgent) GatherIncidentContext(ctx context.Context, alert Alert) (*IncidentContext, error) {
	g, ctx := errgroup.WithContext(ctx)
	payload := &IncidentContext{}

	g.Go(func() error {
		metrics, err := a.metrics.FetchSpikes(ctx, alert.Service, alert.FiredAt)
		payload.Metrics = metrics
		return err
	})

	g.Go(func() error {
		deploys, err := a.cd.RecentRollouts(ctx, alert.Service, alert.FiredAt)
		payload.Deployments = deploys
		return err
	})

	g.Go(func() error {
		similar, err := a.memory.SearchSimilar(ctx, alert.Summary, 3)
		payload.SimilarIncidents = similar
		return err
	})

	if err := g.Wait(); err != nil {
		return nil, fmt.Errorf("triage context gathering failed: %w", err)
	}
	return payload, nil
}
```

Humans tab-switch for a quarter hour. The orchestrator compresses the same fan-out into a short wait, then hands the LLM a **structured** bag of facts — not a blank chat and a prayer. Token budget stays sane because we gather once, in parallel, before the model starts narrating.

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

Semantic search over past incident summaries and postmortems gave on-call a "have we seen this before?" answer in seconds. Quality depended entirely on how well past incidents were documented — **garbage in, garbage out, no AI magic.** Embeddings don't invent missing postmortems; they only retrieve what you bothered to write. In practice we spent more engineering time on **chunk hygiene and metadata** (service, severity, timeframe) than on the embedding model itself — the Go side of "clean before you index" mattered more than swapping vector backends.

### Preparing RCA Skeletons

After mitigation, writing the RCA is another chore. An agent that drafts structure — timeline, impact, contributing factors, open questions — from execution traces gave teams a head start. Humans still owned conclusions. The draft prevented staring at a blank doc.

---

## What Didn't Help (Or Made Things Worse)

### Auto-Remediation Without Guardrails

Restarting pods because error rates spiked feels heroic in a demo. In production, it masks underlying issues, violates change policy, and trains teams to distrust the agent. We learned this lesson overlaps heavily with [defense in depth for tool calls](/blog/defense-in-depth/) — triage agents investigate first.

### Confident Root Cause Narratives

Models narrate well. On-call engineers don't want a wall of prose. They want data they can verify. Here is the shift we had to make in how Aiden presents triage:

> #### The demo version (what doesn't help)
>
> **Aiden:** "The root cause of this incident is a memory leak in the payment service caused by the latest deployment of `v2.4.1`."
>
> *Why this fails:* Overly confident, no telemetry links, forces the engineer to rebuild the investigation from scratch anyway.

> #### The SRE version (what actually helps)
>
> **Aiden triage summary**
>
> - **Hypothesis 1 (high likelihood):** Upstream DB connection pool exhaustion.
>   - *Evidence:* `payment-service` p99 latency spiked from 45ms to 4200ms at 12:04 UTC ([metrics]). `db-pool-saturation` hit 98% in the same window.
> - **Hypothesis 2 (medium likelihood):** Bad deploy.
>   - *Evidence:* Image `v2.4.1-rc3` rolled out ~4 minutes before the alert ([CD]).

On-call needs **evidence-linked hypotheses**, not prose that sounds like a finished postmortem.

### Replacing the Bridge Call

Coordination is human. Agents don't resolve disagreements between service owners. They can brief participants faster — they can't run the bridge.

---

## Lessons Learned

1. **Triage is narrowing, not fixing.** Optimize for "where to look next," not "incident resolved."

2. **Evidence links beat eloquent summaries.** Every claim should point at telemetry, logs, or change records humans can verify.

3. **Draft for humans, don't publish for them.** Timelines and RCAs are edit-then-send, not auto-post.

4. **Institutional memory quality is your ceiling.** AI search over messy incident history returns messy answers. Invest in postmortem hygiene before you invest in a fancier embedder.

5. **The pager still belongs to a person.** AI that tries to close the loop without human ownership erodes trust fast. Treat the agent as an indefatigable junior who pulls the data — not the commander running the bridge.

Building that assistant well means separating **gather** (Go concurrency, structured payloads) from **narrate** (the model). In the [next post](/blog/evidence-based-verification/), we go further: verification that refuses to trust self-report until tools return proof.

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

*What's the one triage step you wish happened automatically on every page? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

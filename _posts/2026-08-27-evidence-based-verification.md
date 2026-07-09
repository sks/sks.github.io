---
layout: post
title: "Evidence-Based Verification — Don't Trust Self-Report, Check the System"
date: 2026-07-08 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 16
description: "An agent that says 'deploy succeeded' without checking ArgoCD or Datadog is lying politely. Verification must pull evidence from systems of record — with Go owning pass/fail."
tags: [ai-agents, sre, verification, observability, production, golang]
---

The most dangerous sentence an agent can produce is: **"I've confirmed the issue is resolved."**

Confirmed how? By re-reading its own summary? By noticing the user stopped complaining? By vibes?

We built agents for SRE workflows where **self-report is worthless**. The only verification that matters pulls evidence from systems of record — monitoring, deployment pipelines, ticket state — before anyone closes an incident.

This sits next to [AI-augmented incident triage](/blog/ai-incident-triage-sre/): triage gathers hypotheses; verification refuses to promote a "resolved" claim until tools vote.

---

## The Demo vs Production Gap

Demos reward fluent narratives. Production rewards **falsifiable checks**.

An agent that narrates a plausible root cause without querying metrics is performing theater. Operators learn to distrust the UI. Eventually they bypass the agent and open Grafana themselves — at which point the agent is expensive autocomplete.

Evidence-based verification flips the contract: **the agent may not claim an outcome until tools return proof.**

---

## What "Evidence" Means in Practice

For a typical remediation workflow, we require checks like:

| Claim | Required evidence |
|-------|-------------------|
| Error rate normalized | Query metrics; compare to baseline window |
| Deploy rolled out | Read deployment status from the CD system |
| Feature flag flipped | Fetch flag state from config service |
| Ticket ready to close | Validate linked alerts cleared |

The agent still explains *why* in prose. Prose is the summary. **Evidence is the gate.**

---

## How Teams Usually Get This Wrong

Teams paste monitoring links into prompts and call it verification. The model may not fetch them; it may summarize from stale context.

Another pattern: verifying only the happy path in demos — alert cleared in staging — while production checks differ.

Evidence without timestamps is gossip. Always record when the observation was true, not only what it said.

---

## Architecture & Implementation in Go

To keep pass/fail deterministic, we do not let the LLM stare at a raw log dump and guess "healthy." The model may **select** which checks to run; the Go runtime **executes** them and adjudicates.

Illustrative boundary — not a copy of production types:

```go
// Deterministic verification boundary — illustrative pattern.
type Evidence struct {
	CheckName string
	Passed    bool
	ObservedAt time.Time // freshness is part of the contract
	Artifact  string     // raw system-of-record payload for humans
}

type VerificationCheck interface {
	Name() string
	Verify(ctx context.Context) (Evidence, error)
}

type Pipeline struct {
	Checks []VerificationCheck
}

func (p *Pipeline) Execute(ctx context.Context) ([]Evidence, bool) {
	// Production fans these out with errgroup + per-check deadlines.
	results := make([]Evidence, 0, len(p.Checks))
	allPassed := true
	for _, check := range p.Checks {
		ev, err := check.Verify(ctx)
		if err != nil || !ev.Passed {
			allPassed = false
		}
		results = append(results, ev)
	}
	return results, allPassed
}
```

Go's `context` deadlines enforce **freshness**: a check that cannot return within the verification window fails closed instead of recycling a planning-phase metric. Strong typing keeps pass/fail on structured fields — not on whether the model "feels" the incident is over.

The model is a *worker* that proposes a checklist. The Go core is the *auditor*.

High-level flow:

1. **Completion checklist** attached to the workflow (human-authored or templated)
2. Each item maps to a **read-only** `VerificationCheck`
3. Pipeline runs checks (often concurrently), collects `Evidence`
4. Pass/fail is deterministic on structured data
5. Optional model step translates evidence into operator language *after* adjudication

That avoids the "judge model agrees with worker model" problem.

---

## Failure Stories

**The green deploy that wasn't.** An agent reported success after pushing a manifest. Evidence check queried the CD system — rollout stuck at 50%, new pods crash-looping. Without the check, on-call would have moved on.

**The metric snapshot lie.** An agent quoted an error rate from a tool result cached ~10 minutes prior. A fresh query showed the spike had returned. Stale evidence is still lying.

**The partial fix.** Remediation addressed symptom A; checklist required symptom B clear too. Verification failed; agent continued instead of closing.

---

## The Verification Checklist for Production Agents

If you are building remediation agents today, audit workflows against these rules:

- [ ] **Separate narration from adjudication.** Let models write summaries; let typed tools vote on the outcome.
- [ ] **Enforce strict freshness.** Evidence queries run at verification time — never reuse a planning-phase metric snapshot.
- [ ] **Treat checklists as product artifacts.** SREs edit validation like runbooks (config or code), not buried prompt prose.
- [ ] **Fail with raw artifacts.** On failure, show the system-of-record payload — not just "try again."
- [ ] **Stick to read-only tools.** Verification must not mutate state while checking it.

For each automated remediation workflow, list the external systems that must agree before closure. If the list is empty, you only have narrative verification — fine for drafts, unacceptable for production state changes.

Train operators to click through to evidence artifacts, not only the summary paragraph. Trust compounds when skeptics can verify without reading raw traces.

---

## Closing Perspective

**Production agent platforms rarely fail because the model is too small. They fail because ordinary distributed systems problems — retries, tenancy, approvals, routing, messaging — meet probabilistic components without the scaffolding SRE teams already know how to build.** The patterns in this post are not exotic research; they are discipline applied where demos cut corners.

When you adopt one of these ideas, measure one outcome operators care about: time to resume after crash, approval latency, cross-tenant leak tests passed, cost per successful workflow, or postmortem draft quality. Qualitative wins matter for trust; qualitative plus a trend line convinces leadership to fund the next increment.

If you are early in your agent journey, implement the safety and isolation pieces before the clever routing pieces. Customers forgive slower answers more easily than wrong answers in another customer's environment, or duplicate production mutations because retries were naive.

Share what broke in your stack. The agent ecosystem is young enough that honest failure stories save the next team weeks — the same way early cloud outage postmortems taught us multi-AZ before marketing did.

In [Prove, Then Narrate](/blog/evidence-gated-multiplane-rca/), we take the same philosophy upstream: structural evals and fixed DAGs so investigation stages cannot mark "done" on vibes either.

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

*How do your agents prove they did what they claim? I'd love to hear patterns from other domains. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

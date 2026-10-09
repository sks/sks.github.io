---
layout: post
title: "Evidence-Based Verification — Don't Trust Self-Report, Check the System"
date: 2026-07-08 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 16
description: "Evidence-based verification for AI agents: don't trust self-report — pull proof from ArgoCD, Datadog, and systems of record, then let Go own pass/fail."
image: /assets/images/og-evidence-rca.png
tags: [ai-agents, sre, verification, observability, production, golang]
---

An agent can say "I've confirmed the issue is resolved" after a remediation. That sentence is useful only if an operator can see what was checked, when, and against which system. A deployment request being accepted, for example, does not mean the new pods are serving traffic.

For SRE (site reliability engineering) workflows, we use **evidence-based verification**: the agent can propose and explain checks, but monitoring, deployment, and configuration systems supply the observations used to decide whether a workflow is complete. This is a downstream gate for [evidence-gated agent workflows](/topics/ai-agent-workflows/). It complements [AI-augmented incident triage](/blog/ai-incident-triage-sre/): triage develops a hypothesis; verification tests the outcome of a change.

---

## A plausible account is not a completion check

A demo may end when an agent writes a convincing account of a fix. In an incident, an operator needs a check that could also come back negative. After a rollout, for instance, the agent should read the continuous delivery (CD) system's rollout status rather than infer success from the manifest it submitted. If the check fails, the workflow stays open and the operator sees the underlying result.

That does not mean prose is useless. The agent's summary helps a person understand the result; it should not be the authority for pass or fail.

---

## What counts as evidence?

A remediation checklist connects each completion claim to a fresh observation:

| Claim | Required evidence |
|-------|-------------------|
| Error rate normalized | Query metrics; compare to baseline window |
| Deploy rolled out | Read deployment status from the CD system |
| Feature flag flipped | Fetch flag state from config service |
| Ticket ready to close | Validate linked alerts cleared |

A green alert alone may not prove that the service recovered: the alert could have been silenced or the metric window could be too short. The checklist should reflect the actual change and its failure modes, not just the easiest signal to query. Record the observation time and retain a link or payload so someone can inspect the result.

Pasting monitoring links into a prompt is not the same as fetching them. The model can answer from earlier context without opening the link. Likewise, a staging check may not cover the production dependency that failed. Verification has to run against the relevant environment and window.

---

## Keep the decision boundary in Go

We do not ask the language model to read a raw log dump and pronounce the system healthy. It may select checks; the Go runtime executes them and evaluates structured results. This sketch shows the boundary, not production types:

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

A `context` deadline limits how long a check can wait; it does **not** by itself prove that returned data is fresh. Production checks also need to validate `ObservedAt` against the verification window and reject cached or missing observations. The sketch marks errors as failure, but real code must preserve the error alongside the evidence so an operator can distinguish "check failed" from "could not check." Structured fields make that distinction possible without asking a second model to judge the first model's prose.

The workflow is:

1. Attach a completion checklist, written by an operator or template, to the remediation.
2. Map each item to a **read-only** `VerificationCheck`.
3. Run the checks and collect timestamped `Evidence` and errors.
4. Decide pass/fail on the structured results, including freshness requirements.
5. Optionally have the model explain the decision in operator language *after* adjudication.

Read-only checks avoid changing the state they are supposed to inspect. They also make retries safer, although a query timeout or an unavailable monitoring backend still means the workflow cannot claim success.

---

## Where the check changes the outcome

**A green manifest, an incomplete rollout.** An agent reported success after pushing a manifest. The CD check found the rollout stuck at 50% with new pods crash-looping. Submitting a change was not the same as completing it.

**An old metric snapshot.** The agent cited an error rate from a tool result cached about 10 minutes earlier; a fresh query showed the spike had returned. A timestamp turned an apparently reassuring number into a reason to keep investigating.

**Only part of the symptom cleared.** Remediation addressed symptom A, while the checklist also required symptom B to clear. The workflow did not close on the first improvement.

These examples illustrate why the checks should be chosen before the agent writes its closing summary. A checklist can still be wrong or incomplete; operators need to be able to review and change it.

---

## A review checklist for remediation workflows

- [ ] **Separate narration from adjudication.** The model summarizes; typed checks determine the outcome.
- [ ] **Set a freshness window.** Query at verification time and reject observations outside that window, rather than reusing a planning-phase snapshot.
- [ ] **Keep the checklist reviewable.** SREs should be able to edit validation as they edit runbooks, in config or code, instead of hunting through prompt prose.
- [ ] **Expose failed checks and raw artifacts.** Show the system response and any query error, not only "try again."
- [ ] **Use read-only verification tools.** A check should not mutate the state it is measuring.

For each automated remediation, list the external systems that must agree before closure. Some workflows need only one check; a deploy plus a feature-flag change may need several. If none can be queried, say that verification is incomplete rather than presenting the agent's summary as proof.

The tradeoff is extra queries and, sometimes, a longer path to closure. That cost is visible. An unverified closure can hide a still-failing service, which is why we keep the gate and give operators the artifacts to challenge it.

In [Evidence-Gated RCA — Prove, Then Narrate](/blog/evidence-gated-multiplane-rca/), we apply the same idea earlier in an investigation: fixed stages and structural evaluations prevent a root-cause analysis (RCA) from being marked complete merely because its narrative sounds finished.

---

## Related reading

- [Bring Up Agent Workflows Like Hardware](/blog/bring-up-agent-workflows-like-hardware/) — score tool calls, not transcripts
- [AI Incident Triage for SREs](/blog/ai-incident-triage-sre/) — gather before you verify
- More on [AI agent workflows](/topics/ai-agent-workflows/) · full [series](/series/enterprise-ai-agents-go/)

---

*How do your agents prove they did what they claim? I'd love to hear patterns from other domains. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

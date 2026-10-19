---
layout: post
title: "When Is an E2E Finding Actually Closed?"
date: 2026-10-14 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 80
description: "Close an E2E finding only after scope, human disposition, runnable asserts, real execution, and post-change verification. Track loop health, not PR volume."
image: /assets/images/diagrams/oct/e2e-closing-findings.svg
tags: [ai-agents, evaluation, testing, ci-cd, reliability, observability, aiden]
permalink: /blog/closing-e2e-findings/
faqs:
  - question: "When is an E2E finding actually closed?"
    answer: "When scope and evidence limits are recorded, a human disposition exists, runnable asserts exist when warranted, required checks ran, the exact revision was verified when relevant, and the next review can see resolved, open, or contradicted without repeating the same work."
  - question: "Who can claim what in an E2E investigation?"
    answer: "CI owns run identity and artifacts. The harness owns fixtures and outcome classes. The agent investigates. Observability supplies time-bounded evidence. A PR is a proposal. Only a human owns merge risk and the deploy-to-verify join."
  - question: "How do you know an AI RCA-style proposal is trustworthy?"
    answer: "Require independent evidence joins, recorded unknowns, and a post-change assertion that passes. A fluent write-up or a draft URL alone is not enough."
  - question: "What metrics show the learning loop is working?"
    answer: "Implemented-gap rate, verification latency, recurrence, duplicate candidates, skip and preflight rate, evidence completeness, false positives, and analysis cost. PR count alone misleads."
---

Yesterday we split the [supervised loop](/blog/supervised-e2e-learning-loop/) into [coverage versus failure paths](/blog/e2e-coverage-and-failure-loops/). Both paths still need an exit criterion stricter than “the agent opened something.”

We closed a ticket because an agent had opened a draft fix. The draft linked a run URL. Nobody recorded which log pages were unread. The merge happened days later on a different SHA than the one we eventually deployed. The next nightly failed the same assert. The finding had never been closed. We had filed paperwork.

In this setup a *finding* is a durable record of a coverage gap or an observed failure. Closing it is stricter than creating a candidate. The same discipline that makes [RCA evals](/blog/how-to-evaluate-ai-agent-root-cause-analysis/) reject fluent fiction applies here: independent evidence, named gaps, and a check that can fail.

**Key takeaways**

- Each evidence plane may claim only what it owns.
- Minimum finding fields beat tribal memory.
- Loop health is implemented gaps and verification latency, not PR volume.
{: .key-takeaways}

---

![Evidence planes feed a finding record; closure needs disposition, asserts, execution, deploy, and re-verification](/assets/images/diagrams/oct/e2e-closing-findings.svg)

*Authority boundaries stop a draft URL from pretending to be remediation.*

## Evidence and authority boundaries

| Plane | May claim | May not claim alone |
|-------|-----------|---------------------|
| CI scheduler | Run, ref, attempt, artifacts, concurrency | That every scenario executed |
| E2E harness | Fixtures, sessions, skipped / blocked / failed / unknown / verified | That a product root cause is true |
| Agent runtime | Investigation steps and tool calls | That terminal status equals a usable result |
| Remote runner | Scoped dig commands under its credentials | Host CI token authority |
| Observability | Logs and metrics inside stated bounds and labels | That empty data means healthy |
| Pull request | A reviewable proposal with links | That remediation succeeded |
| Human | Ownership, risk, merge, deploy verify | Nothing automatic replaces this join |

Empty or partial telemetry stays a limitation. [No data is often truncated data](/blog/no-data-is-often-truncated-data/) in adjacent work; the same rule applies to unread CI pages.

This is also where industry guidance and our ledger agree. [Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) treats evals as evidence about a system under a task, not as vibes about a transcript. [Applause's 2026 report](https://www.applause.com/state-of-digital-quality-2026/functional-testing-report/) warns that “self-healing” automation can change the rules of a test to stay green. Closure that weakens an assert to match a broken product is an open finding with better paperwork.

## Minimum finding record

Record at least: scheduled window; run URL and attempt; target ref or SHA; session or trace ids when created; query links and coverage limits; source and deployed revision; candidate URL, repo, and status; confidence and unknowns; regression assertion; review decision; deployment and verification-run evidence. Keep secrets out of the record.

## Closure checklist

A finding is closed and verified only when:

1. Investigated scope and evidence limitations are recorded.
2. The candidate has a human disposition, not just a generated URL.
3. Runnable positive and negative assertions exist where a regression is warranted.
4. Required checks execute rather than silently skip ([CI flakes](/blog/ai-agent-evals-cicd-flakes/)).
5. The product revision is observed on the intended environment when relevant.
6. The post-change run passes the specific assertion with independent evidence.
7. The next scheduled review can mark the same finding resolved, still open, or contradicted without paying for an identical investigation.

[AWS's multi-layer testing guidance](https://docs.aws.amazon.com/wellarchitected/latest/agentic-ai-lens/agentops06-bp01.html) puts shadow and staging comparison above end-to-end gates for a reason. Merge is not the same plane as “this revision behaved on the target environment.”

## Loop-health measures

| Measure | Why it matters |
|---------|----------------|
| Reviewed and implemented gap rate | Plans that never ship are open loops |
| Verification latency | Merge without re-assert hides deploy lag |
| Recurrence | Same failure without durable identity |
| Duplicate candidates | Cost amplification |
| Skip and preflight rate | Green that did not evaluate |
| Evidence completeness | Unread pages marked incomplete |
| False-positive rate | Fixture issues labelled as product bugs |
| Analysis cost | Tokens spent without durable closure |

These are targets to track. Do not claim them until the ledger exists. ChaCo’s ICSE evaluation even separates “test generated” from “reviewers would merge it” and “it found a real bug.” Count the last two, not the first.

## Try this on the next five findings

1. Fill the minimum record before arguing about the patch.
2. Name the owning plane for each claim in the write-up.
3. Reject closure when required checks skipped.
4. Link deploy observation to the exact SHA when the product changed.
5. Store disposition so the next window can short-circuit duplicates.
6. Score the week on implemented gaps and verification latency.

[Two loops](/blog/e2e-coverage-and-failure-loops/) feed this checklist. The next post lists the bookkeeping failures that keep findings open even when jobs look green.

## Further reading

- [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) on evidence over fluency
- [Applause functional testing 2026](https://www.applause.com/state-of-digital-quality-2026/functional-testing-report/) on human review of AI-touched tests
- [AWS Agentic AI Lens: multi-layered testing](https://docs.aws.amazon.com/wellarchitected/latest/agentic-ai-lens/agentops06-bp01.html) on staging and shadow as separate planes

Previous: [Two E2E Feedback Loops](/blog/e2e-coverage-and-failure-loops/). Next: [E2E Learning Loop Blind Spots](/blog/e2e-learning-loop-blind-spots/).

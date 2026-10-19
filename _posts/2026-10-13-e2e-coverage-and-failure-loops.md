---
layout: post
title: "Two E2E Feedback Loops: Coverage Gaps vs Failure Fixes"
date: 2026-10-13 14:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 79
description: "Keep coverage discovery and failure RCA as separate E2E loops. Product changes need runnable asserts; observed failures need classify, fix, deploy, and re-assert."
image: /assets/images/diagrams/oct/e2e-two-loops.svg
tags: [ai-agents, evaluation, testing, ci-cd, reliability, aiden]
permalink: /blog/e2e-coverage-and-failure-loops/
faqs:
  - question: "What are the two E2E feedback loops?"
    answer: "Loop A turns recent product changes into coverage plans and runnable asserts. Loop B turns CI and runtime failures into classified fixes, deploys, and regression asserts."
  - question: "Why keep coverage scanning separate from failure RCA?"
    answer: "They use different time windows, evidence, and owners. Merging them hides whether you missed a new contract or failed to remediate a known break."
  - question: "What does no gap found mean?"
    answer: "No justified uncovered user-visible contract was found in the inspected repositories and window. It is not proof the organization has complete E2E coverage."
  - question: "Is a merge-tier RCA smoke the same as a daily anomaly review?"
    answer: "No. Seeding from a few recent failed runs proves proposal capability. A daily review needs a fixed window, full inventory of failures and unknowns, and durable candidate retention."
---

The [supervised loop](/blog/supervised-e2e-learning-loop/) from this morning needs two inputs, not one mega-job. We once pointed a single nightly at “make E2E smarter.” It scanned recent commits and peeked at a handful of failed runs. When something slipped, we could not tell whether the scanner missed a contract or the failure path never kept a durable candidate.

*Loop A* turns product change into coverage. *Loop B* turns observed failure into a fix and a regression assert. Keep them separate until a human joins the work.

**Key takeaways**

- Coverage discovery and anomaly review are different cadences with different evidence.
- “No gap in inspected scope” is not “we are fully covered.”
- Proposal smoke that cleans up its own drafts is not a durable review queue.
{: .key-takeaways}

---

![Loop A scans commits into coverage asserts; Loop B correlates failures into fixes and verification](/assets/images/diagrams/oct/e2e-two-loops.svg)

*Two paths share a human gate. Conflating them creates blind spots.*

## Loop A: changes become coverage

1. Scheduled regression runs as usual.
2. A feature scan inspects recent commits and source PRs in a curated product-repo list. Exclude the E2E repo itself so generated test churn is not mistaken for product features.
3. Classify user-visible API, UI, agent, workflow, or integration changes versus chores, docs, and CI-only work.
4. A justified gap produces one draft coverage plan. Reuse an open labelled draft rather than spawning duplicates. No justified gap produces a scoped no-gap note with evidence.
5. A reviewer validates the contract, implements or requests runnable positive and negative asserts, checks cleanup safety, and merges.
6. The owning cadence runs the new test. Record a real execution. A green plan-only PR does not establish coverage.

That “last mile” of uncovered change is getting research attention. [ChaCo (ICSE 2026)](https://software-lab.org/publications/icse2026_ChaCo.pdf) targets lines left uncovered by a specific pull request, generates candidate tests, and asks developers to review integration into the suite. The interesting part for operators is the handoff: automation proposes when the change is still on a reviewer’s mind; humans still own merge. Uber’s [AutoCover](https://homes.cs.washington.edu/~rjust/publ/auto_cover_icse_2026.pdf) story is similar at industry scale. Generated tests enter review queues; they do not quietly redefine the contract.

## Loop B: failures become fixes

### Useful smoke versus daily review

A merge-tier job that digs a few recent failed runs and opens a draft fix (or explains why none is justified) proves the agent can propose. It does not guarantee that every previous-day failure, timeout, cancellation, or unknown was reviewed.

An intentional daily path should:

1. Define a closed UTC window and record absolute start and end, target environment, and run identities.
2. Inventory executions in that window, including failures, cancellations, timeouts, unknowns, and unexpected skips. Report pagination limits. Never infer absence from unread data.
3. Join run attempt, session or trace ids, source SHA, deployed revision, and time-aligned logs and metrics. A nearby commit alone is not causality.
4. Classify: product defect, test defect, fixture or credential problem, deploy lag, transient environment, or unknown.
5. Propose a minimal draft in the correct repo, or a justified no-fix note. A product fix should carry a regression assert or a linked coverage follow-up. Do not weaken an assertion to hide an outage.
6. Keep candidates durable with finding identity and ownership. De-duplicate. Unknown stays unknown.
7. Require human review. After merge, verify the exact product revision is deployed, then run the assertion. Only then mark verified.

[Anthropic's evals guidance](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) separates regression (“can we still do a known job?”) from capability exploration. Loop B is mostly regression repair with evidence. Loop A is how new contracts enter the regression set without pretending the org was already covered.

## Where teams mix the loops

| Symptom | Likely mix-up |
|---------|----------------|
| Feature scan “green,” incidents still surprise | Loop A ran; Loop B window never closed |
| Many fix drafts, same failure next week | Candidates cleaned up or never deployed |
| Coverage draft lists chores and docs | Classification skipped user-visible filter |
| “No gaps” while a renamed repo went dark | Allowlist drift treated as empty truth |
| RCA cites a tool call but wrong namespace | Correlation skipped environment join |

## Try this split

1. Name two jobs in the runbook: coverage scan and anomaly review. Different schedules are fine.
2. Write the allowlist and window bounds where operators can see them.
3. Require absolute timestamps on every finding.
4. Retain coverage drafts by default; treat fix-draft cleanup as smoke unless a human adopts the candidate.
5. Link every accepted product fix to a regression assert or an explicit coverage follow-up.
6. Measure implemented-gap rate and verification latency, not draft count.

The [pyramid](/blog/ai-agent-testing-pyramid/) still decides which layer answers which question. These two loops decide how new questions enter the suite without lying about what automation already finished.

## Further reading

- [Change And Cover (ChaCo)](https://software-lab.org/publications/icse2026_ChaCo.pdf) on PR-scoped test augmentation with human review
- [AutoCover at industry scale](https://homes.cs.washington.edu/~rjust/publ/auto_cover_icse_2026.pdf) on generated tests that still pass review queues
- [State of Digital Quality 2026: functional testing](https://www.applause.com/state-of-digital-quality-2026/functional-testing-report/) on AI for gap finding versus human ownership of intent

Previous: [Supervised E2E Learning Loop](/blog/supervised-e2e-learning-loop/). Next: [When Is an E2E Finding Actually Closed?](/blog/closing-e2e-findings/).

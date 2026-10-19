---
layout: post
title: "E2E Learning Loop Blind Spots: Skip-as-Success and More"
date: 2026-10-14 14:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 81
description: "Most open E2E learning loops are bookkeeping failures: skip-as-success, top-N false absence, merge without deploy, and lost proposals. An operator checklist."
image: /assets/images/diagrams/oct/e2e-blind-spots.svg
tags: [ai-agents, evaluation, testing, ci-cd, reliability, aiden]
permalink: /blog/e2e-learning-loop-blind-spots/
faqs:
  - question: "What blind spots keep an E2E learning loop open?"
    answer: "Cadence mismatch, top-N or pagination treated as complete, skip-as-success, fixture problems labelled as product bugs, merged SHA not deployed, lost or cleaned-up proposals, non-FIFO missed windows, and merges without post-deploy verification."
  - question: "What is skip-as-success in CI?"
    answer: "A job concludes successfully while required scenarios never ran because prerequisites were missing. Inspect scenario counts and JUnit, not only the workflow conclusion."
  - question: "Why is top-N dangerous for anomaly review?"
    answer: "Seeding from the latest N failed runs or truncated API pages omits other failures. Unread data must be marked incomplete, never inferred as healthy."
  - question: "How do you keep proposals from disappearing?"
    answer: "Retain coverage drafts for human adoption by default. Treat fix-draft cleanup as proposal smoke unless someone deliberately adopts the candidate into a review queue."
---

This morning’s [closure checklist](/blog/closing-e2e-findings/) assumes the ledger is honest. Most open [supervised learning loops](/blog/supervised-e2e-learning-loop/) fail before that checklist, as operations bugs.

We trusted a green nightly. The feature scan had run. The RCA smoke had opened and closed a draft. Concurrently, a required suite skipped on a missing credential, a newer pending run replaced an older one, and the product fix from last week was still not on the environment the tests hit. The model was fine. The bookkeeping was not.

**Key takeaways**

- Green workflow status is not proof every scenario executed.
- Unread pages and top-N seeds are incomplete, not empty.
- Merge, deploy, and re-assert are separate joins.
{: .key-takeaways}

---

![Eight blind spots from cadence mismatch to missing post-deploy verification](/assets/images/diagrams/oct/e2e-blind-spots.svg)

*Fix the ledger before blaming the agent.*

## Blind spots that keep the loop open

| Blind spot | What goes wrong | Closure |
|------------|-----------------|---------|
| Cadence mismatch | Feature discovery mistaken for a full anomaly sweep | Keep [Loop A and Loop B](/blog/e2e-coverage-and-failure-loops/) explicit |
| Top-N / pagination | Latest N failures or truncated APIs omit the rest | Report limits; mark unread incomplete |
| Skip as success | Job success masks skipped suites | Inspect scenario counts, not only conclusion |
| Fixture versus product | Missing creds or apps labelled as product bugs | Fail preflight explicitly; no runtime verdict |
| Merge ≠ deploy | Merged SHA not live, or telemetry from another env | Observe exact image or build on the target |
| Lost proposals | Plans unimplemented; fix drafts cleaned up unread | Retain coverage drafts; adopt fixes deliberately |
| Queue starvation | Newer pending run replaces older; windows vanish | Record what actually ran; chase missing windows |
| No post-deploy verify | Fix merged, assert never run on new build | Link a verification run to the finding |

Related CI honesty themes live in [evals in CI/CD](/blog/ai-agent-evals-cicd-flakes/): a required-task skip is not a pass. [Block's agent testing pyramid](https://engineering.block.xyz/blog/testing-pyramid-for-ai-agents) keeps live LLM work off every-PR CI partly because flaky or skipped probabilistic jobs teach the wrong lesson about green. [AWS](https://docs.aws.amazon.com/wellarchitected/latest/agentic-ai-lens/agentops06-bp01.html) adds shadow comparison for the same reason staging lies.

[Applause](https://www.applause.com/state-of-digital-quality-2026/functional-testing-report/) calls out another failure mode that looks like Loop B success: automation that rewrites the test to pass. That is skip-as-success with better marketing. Closing a finding by deleting the assert leaves the product broken and the ledger smug.

## Operator checklist

1. For each scheduled job, write whether it is coverage scan, anomaly review, or plain regression.
2. Store absolute window bounds and watermarks on findings.
3. On every green run, open the scenario summary before trusting the conclusion.
4. Label fixture and credential failures as preflight, not product RCA.
5. Join namespace, cluster, and deploy revision before accepting a root cause story.
6. Give every durable candidate an identity, owner, and disposition.
7. After product merge, require exact-revision observation plus the linked assert.
8. Weekly, sample one “no gap” and one “no fix justified” outcome for evidence quality.

## What not to optimize

Do not chase PR volume. Do not treat prompt text as an authorization barrier. Do not assume a concurrency group is a FIFO review of every commit. Do not weaken asserts to make a shared environment look healthy.

The [pyramid](/blog/ai-agent-testing-pyramid/) still places checks at the cheapest useful layer. The learning loop only makes the system better when these blind spots are named and closed in the ledger, not when the agent sounds confident in a draft.

## Further reading

- [Testing Pyramid for AI Agents](https://engineering.block.xyz/blog/testing-pyramid-for-ai-agents) on cost, flakes, and what belongs outside default CI
- [AWS Agentic AI Lens: multi-layered testing](https://docs.aws.amazon.com/wellarchitected/latest/agentic-ai-lens/agentops06-bp01.html) on shadow and staging joins
- [Applause functional testing 2026](https://www.applause.com/state-of-digital-quality-2026/functional-testing-report/) on self-healing that changes the rules
- [Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) for the non-agent baseline that still applies

Previous: [When Is an E2E Finding Actually Closed?](/blog/closing-e2e-findings/). Next: [Why Open Policy Agent for AI agent guardrails](/blog/why-opa-for-ai-agent-guardrails/).

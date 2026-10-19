---
layout: post
title: "Supervised E2E Learning Loop for AI Agents (Not Auto-Merge)"
date: 2026-10-13 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 78
description: "A supervised E2E learning loop makes agent suites stronger over time. Automation drafts coverage and fixes; humans merge, deploy, and re-assert. A draft PR is not closure."
image: /assets/images/diagrams/oct/supervised-e2e-loop.svg
tags: [ai-agents, evaluation, testing, ci-cd, reliability, aiden]
permalink: /blog/supervised-e2e-learning-loop/
faqs:
  - question: "What is a supervised E2E learning loop for AI agents?"
    answer: "A feedback system where scheduled tests and product changes produce coverage or fix proposals, and humans review, implement, merge, deploy when needed, and re-assert. Automation proposes; people close."
  - question: "Does an agent-opened draft PR close the E2E loop?"
    answer: "No. A draft is an intermediate proposal. Closure needs a human disposition, runnable assertions, checks that actually run, and post-change verification against the intended revision."
  - question: "How does this relate to the AI agent testing pyramid?"
    answer: "The pyramid places cheap checks under costly live trials. The learning loop sits above that: it uses cadence tiers to turn new product behavior and observed failures into better coverage over time."
  - question: "Should E2E agents auto-merge fixes?"
    answer: "Not in this setup. Auto-merge and unattended deploy skip ownership, risk judgment, and the deploy-to-verify join that makes a finding durable."
---

Last week we tightened [CI honesty for agent evals](/blog/ai-agent-evals-cicd-flakes/): missing tasks fail, retries stay visible, trial IDs match traces. That stops a green build from lying about the current suite. It does not answer whether the suite got stronger after the run.

We once treated a green nightly and a freshly opened draft pull request as proof the suite had learned. The draft held a plan. The job that proposed a fix closed its own candidate during cleanup. Nothing new ran on the next cadence. The pyramid still caught some regressions. It did not get stronger.

A *supervised E2E learning loop* turns two inputs into better coverage: product changes that need asserts, and observed failures that need a product or test fix. Automation gathers evidence and drafts proposals. Humans review, implement, merge, deploy when the product changed, and re-assert. A created PR is an intermediate result, not proof the loop closed.

**Key takeaways**

- Keep a [cost-tiered pyramid](/blog/ai-agent-testing-pyramid/) for diagnosis; add a supervised loop so the suite improves.
- Draft coverage plans and fix candidates are proposals, not coverage.
- The loop stays open if work is plan-only, cleaned up unread, skipped, or never verified on the live revision.
{: .key-takeaways}

---

![Product changes and runtime evidence feed draft PRs; humans merge tests and deploy fixes so the next cadence can prove them](/assets/images/diagrams/oct/supervised-e2e-loop.svg)

*Solid path: propose → review → merge → prove. Dashed return edges are what make it a loop.*

## What a supervised loop adds to the pyramid

The [testing pyramid](/blog/ai-agent-testing-pyramid/) answers where a check belongs. Fast stubbed bounds and contract checks run often. Live trials stay few. That split matches [Ham Vocke's practical test pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) and the agent-specific framing in [Block's Testing Pyramid for AI Agents](https://engineering.block.xyz/blog/testing-pyramid-for-ai-agents): keep expensive probabilistic work off the default merge path.

[AWS's Agentic AI Lens](https://docs.aws.amazon.com/wellarchitected/latest/agentic-ai-lens/agentops06-bp01.html) makes the same point in ops language. Unit and integration layers stay fast; end-to-end and shadow work stay deliberate. It also says the pyramid gets stronger over time only if the suite grows with production failures. That growth step is the learning loop.

Cadence still matters for cost. In this setup, merge-tier work stays cheap with selective live smoke. Nightly runs mid-cost integration and journey suites. Weekly work holds longer investigations and soak. That layering is the pyramid applied to wall-clock and token spend.

The learning loop asks a different question: after the suite runs, did anything durable get better? Without it, teams accumulate draft plans, closed-by-cleanup fix candidates, and green jobs that skipped the scenarios that mattered.

## Draft is not closed

| Result | What it proves | What it does not prove |
|--------|----------------|------------------------|
| Draft coverage plan | Someone noticed a possible gap | Executable positive and negative asserts exist |
| Draft fix PR | Proposal capability ran | The fix merged, deployed, and re-asserted |
| Green job conclusion | Workflow finished | Every required scenario executed |
| `todo` or plan-only merge | Intent was recorded | The next cadence ran a real assertion |

Treat “no gap found in the inspected scope” the same way. It is a scoped negative, not a claim of complete organizational coverage.

Industry practice is catching up to that distinction. [Applause's 2026 functional testing report](https://www.applause.com/state-of-digital-quality-2026/functional-testing-report/) still puts human judgment near the center of functional quality, including review of AI-generated tests and intent. Automation that “heals” a failing check by changing what it asserts is the opposite of a closed loop.

## How to wire a supervised loop

1. Keep pyramid layers and [fail missing baseline tasks](/blog/ai-agent-evals-cicd-flakes/) so green means something.
2. Separate product-change scanning from failure review. They have different windows and owners. The next post covers both loops.
3. Retain coverage proposals long enough for humans to adopt them. Do not confuse proposal-smoke cleanup with a review queue.
4. Require runnable asserts before calling a gap closed. Plans help; they are not tests.
5. After a product merge, observe the exact revision on the intended environment, then run the specific assertion.
6. Record scope limits, unknowns, and dispositions so the next run does not pay for the same investigation again.

A pyramid stops known regressions at the cheapest useful layer. A supervised learning loop is how the suite earns new layers without pretending the agent can merge and deploy on its own.

## Further reading

- [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) (Anthropic) on regression versus capability questions
- [Testing Pyramid for AI Agents](https://engineering.block.xyz/blog/testing-pyramid-for-ai-agents) (Block) on keeping live LLM work out of default CI
- [AGENTOPS06-BP01: multi-layered testing](https://docs.aws.amazon.com/wellarchitected/latest/agentic-ai-lens/agentops06-bp01.html) (AWS Well-Architected) on growing the suite from production

Previous: [AI Agent Evals in CI/CD](/blog/ai-agent-evals-cicd-flakes/). Next: [Two E2E Feedback Loops](/blog/e2e-coverage-and-failure-loops/).

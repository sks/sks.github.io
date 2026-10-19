---
layout: page
title: Agent evals starter pack
permalink: /start/agent-evals/
description: "Five posts on AI agent evaluation: testing pyramid, separate grader, and a supervised E2E learning loop that humans close with deploy and re-assert."
faqs:
  - question: "Where should I start on AI agent evals?"
    answer: "Read the testing pyramid first (what belongs in CI), then why the grader must be separate from the agent. After that, the supervised E2E loop posts cover how suites get stronger without auto-merge theater."
  - question: "How long is this pack?"
    answer: "Five posts. TL;DRs fit in one sitting; the E2E closure and blind-spot posts repay a careful read if you run live trials."
---

A short path for engineers putting agent evals in CI and growing coverage without treating draft PRs as closure.

## The five posts

1. **[The AI Agent Testing Pyramid](/blog/ai-agent-testing-pyramid/).** Fast bounds, contract checks, a few live trials.
2. **[AI Agent Evaluation: Why the Grader Must Be Separate](/blog/ai-agent-evaluation-separate-grader/).** Agent model is not the judge.
3. **[Supervised E2E Learning Loop](/blog/supervised-e2e-learning-loop/).** Automation drafts; humans merge, deploy, re-assert.
4. **[When Is an E2E Finding Actually Closed?](/blog/closing-e2e-findings/).** Scope, disposition, runnable asserts, real execution.
5. **[E2E Learning Loop Blind Spots](/blog/e2e-learning-loop-blind-spots/).** Skip-as-success and other bookkeeping failures.


## Next

- Hub: [AI agent workflows](/topics/ai-agent-workflows/)
- Related: [Two E2E Feedback Loops](/blog/e2e-coverage-and-failure-loops/) · [Deterministic Checks vs LLM-as-a-Judge](/blog/deterministic-checks-vs-llm-judge/) · [AI Agent Evals in CI/CD](/blog/ai-agent-evals-cicd-flakes/)
- Full series: [Building an Enterprise AI Agent Platform in Go](/series/enterprise-ai-agents-go/)
- Service path: [SRE as service starter pack](/start/sre-as-service/)

{% include subscribe.html %}

---
layout: post
title: "The AI Agent Testing Pyramid: What Belongs in CI?"
date: 2026-10-06 15:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 73
description: "Use fast tests for agent bounds, contract checks for facts, and a small number of live trials for whole jobs."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, testing, ci-cd, reliability, benchmarking, aiden]
permalink: /blog/ai-agent-testing-pyramid/
faqs:
  - question: "What is an AI agent testing pyramid?"
    answer: "A layered suite with many fast deterministic tests, some checks against external facts and interfaces, and fewer expensive trials that run a real agent on a user task."
  - question: "Should live LLM evals run on every pull request?"
    answer: "Not by default in this setup. Keep fast checks on every push and run live trials by opt-in or schedule. A team with fast, stable, affordable trials may choose a different gate."
  - question: "What belongs at the base of an agent evals pyramid?"
    answer: "Stubbed-model tests for behavior that does not require a live model: refusing an oversize prompt, not treating a repeated observation as progress, and bounding the length of a handoff brief."
  - question: "How does this differ from Block's agent testing pyramid?"
    answer: "Block frames layers by tolerated uncertainty and keeps live LLM work out of CI. We agree on the fast base; here live trials can run opt-in on a pull request or weekly, rather than gating every push."
---

We considered a suite dominated by long live trials with several attempts each. It would have been slow to run and difficult to diagnose: a failed investigation might reflect an agent change, an unavailable dependency, or an unstable grader. The [Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) offers a useful way to split those concerns. Test small, predictable behaviors often; reserve whole-system runs for questions the smaller tests cannot answer.

An *agent trial* here means a run with a real model, tools, and a user-shaped task. A *stubbed model* is a fixed response supplied by a test instead of a model call. A *contract check* verifies a fact or interface against an authoritative source, such as a trace ID or a CI coverage record.

---

## Which checks go where?

| Layer | Example | Why use it | Limit |
|-------|---------|------------|-------|
| Fast checks | Reject a prompt over the input cap; classify a repeated observation | Cheap and reproducible on each push | Cannot show whether the agent completes a real job |
| Contracts | Compare a reported percentage with CI; match trial and trace IDs | Catches fabricated or miswired facts | Cannot judge whether the explanation helps a reader |
| Live trials | Ask the agent to investigate one incident and write a deliverable | Exercises model, tools, and handoffs together | Slower, costlier, and subject to service/model variation |
| Weekly exploratory tasks | Try an unfamiliar research task | Finds capability gaps outside known regressions | Results need investigation before becoming a gate |

For fast checks, replace the model with a stub and feed in known inputs. Check that an oversize prompt is refused, a repeat observation does not advance progress, and a worker brief stays within its bound. These are close to the small, isolated tests Vocke describes.

At the contract layer, assert things code can decide: the file exists, the number equals the system-of-record value, or the ID in a trace export matches the trial. A contract failure identifies a narrower problem than a single score for an entire investigation.

Keep live trials few and give each a task and deliverable. They can exercise a real sidecar and one incident without pulling every alert in a cluster into every run. If a required dependency is missing, write a skip *and* mark the report unsuccessful; otherwise the suite can appear green without evaluating the task.

[Block's Testing Pyramid for AI Agents](https://engineering.block.xyz/blog/testing-pyramid-for-ai-agents) emphasizes different levels of tolerated uncertainty. For our suite, a pull-request live run is opt-in and the baseline plus less familiar tasks run weekly. That is a cost and reliability choice, not a universal rule for all teams.

## Regression and capability are different questions

[Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) distinguishes *regression* evaluations (can the system still do a known job?) from *capability* evaluations (what new jobs can it do?). The fast and contract layers mostly guard known behavior. Live tasks can do either: reuse a known case for a regression check or try a new case to learn the limits. A new capability task may need a rubric and stable environment before it is suitable as a merge gate.

Retries do not by themselves make a long trial trustworthy. We moved handoff size limits, input caps, and the question “did this observation add information?” into fast tests. The live layer then checks whether a job finished against its checklist, while [CI honesty](/blog/ai-agent-evals-cicd-flakes/) records failed attempts rather than concealing them. After a harness change, use [frozen exams](/blog/same-problem-sre-model-bake-off/)—the same saved tasks and criteria—to compare runs. [Fair agent evals](/blog/fair-agent-evals-before-performance/) also depend on comparable tool access.

## If you are reorganizing a suite

1. Label existing tests fast, contract, live regression, or exploratory. Identify any assertion duplicated across layers.
2. Move input bounds and classifications that need no model call into stubbed tests.
3. Compare factual claims with their source in code, rather than asking a model judge to recall the value.
4. Choose whether live runs should be opt-in, scheduled, or a gate based on their cost, stability, and the risk of the change. In this setup they are opt-in or weekly.
5. Make required-task skips visible and unsuccessful. Compare unchanged tasks after changing the harness.

The point of the pyramid is diagnostic value, not a prescribed count of tests: use the cheapest layer that can actually answer the question, then keep a small whole-system layer to catch interactions the smaller checks miss.

Previous: [Why the Grader Must Be Separate](/blog/ai-agent-evaluation-separate-grader/). Next: [Deterministic Checks vs LLM-as-a-Judge](/blog/deterministic-checks-vs-llm-judge/).

---
layout: post
title: "The AI Agent Testing Pyramid: What Belongs in CI?"
date: 2026-10-06 15:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 73
description: "An AI agent testing pyramid: fast bound checks at the base, fact contracts in the middle, few live trials on top. Keep long LLM runs out of every push."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, testing, ci-cd, reliability, benchmarking, aiden]
permalink: /blog/ai-agent-testing-pyramid/
faqs:
  - question: "What is an AI agent testing pyramid?"
    answer: "A layered suite: many fast deterministic checks, some fact and contract checks, and a few expensive live trials. The shape follows Ham Vocke's practical test pyramid applied to agents."
  - question: "Should live LLM evals run on every pull request?"
    answer: "No by default. Keep fast checks on every push. Make live trials opt-in or scheduled so you do not burn tokens and wait fifteen minutes for a flake."
  - question: "What belongs at the base of an agent evals pyramid?"
    answer: "Stubbed-model tests for bounds: prompt too large is refused, a repeated observation is not progress, a short brief stays short. These run without calling a live model."
  - question: "How does this differ from Block's agent testing pyramid?"
    answer: "Block frames layers by tolerated uncertainty and keeps live LLM work out of CI. We agree on the base. Our live trials are opt-in on a pull request or weekly, never the default gate for every push."
---

We almost shipped an ice-cream cone: a stack of fifteen-minute live trials with several retries each. That is not an **AI agent testing pyramid**. That is a slow thermometer.

Ham Vocke's [Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) still holds. Write lots of small fast tests. Write fewer coarse ones. Write very few end-to-end ones. Agents do not repeal that. They make the top more expensive.

---

## TL;DR

- Fast checks stub the model and lock bounds.
- Contract checks lock facts against a system of record.
- Live trials are few, each with one user job and one deliverable.
- Pull-request live suites are opt-in. Weekly runs hold the baseline and the exploratory tip.
- Push bounds down into fast tests so the slow layer only asks whether the job finished honestly.

### Explain like I'm five

Check that the bike's brakes work a hundred times in the driveway. Ride around the block a few times. Do not prove every bolt by racing the Tour de France on every lunch break.

---

## The layers we use

```text
weekly exploratory tasks
        ^
opt-in pull request live suite
        ^
live trials (one job, one artifact)
        ^
contracts (facts, trace identity)
        ^
fast checks (bounds, classifiers)
```

**Fast checks.** Stub the model. A prompt that does not fit is refused. A repeated observation is not progress. A short brief stays short. These are the solitary unit tests Vocke describes: collaborators replaced so the subject is small and fast.

**Contracts.** The file exists. The number matches the system of record. The id on the trial matches the id in the trace store. These are narrow integration and contract tests. They do not need a full narrative score.

**Live trials.** Few. Each one is a user-shaped job with one deliverable. A missing dependency writes a skip, and a skip is a failure for the report, not a pass. Sociable where it must be: a real sidecar, one incident, not every alert in the cluster.

**Pipeline tip.** The pull-request suite is opt-in. A weekly run keeps the baseline and holds the odd research task. That is Vocke's exploratory testing, automated lightly and rarely.

[Block's Testing Pyramid for AI Agents](https://engineering.block.xyz/blog/testing-pyramid-for-ai-agents) frames layers by how much uncertainty you tolerate. We agree on the base. Where we differ: live model trials are not a default check on every push. They are on purpose, expensive, and few.

---

## Capability vs regression

[Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) separates capability evals (what can it do) from regression evals (does it still do what it used to). The pyramid maps cleanly:

| Layer | Role |
|-------|------|
| Fast checks | Regression for bounds and classifiers |
| Contracts | Regression for facts you must not invent |
| Live trials | Mix: regression suite for known jobs, capability for new ones |
| Weekly research | Capability and exploration |

Do not put capability hunting into the default merge gate. That is how you get a fifteen-minute flake that blocks a one-line fix.

---

## The ice-cream cone we almost shipped

Long live investigations. Several attempts. Parallel jobs that wait on each other. Averaging attempts into one boolean gate. Each of those choices pushed cost and noise upward.

The fix was not "more retries." The fix was moving handoff size bounds, input caps, and "is this observation new?" into fast tests. The slow layer only asks: did this job finish honestly against the checklist? Retries belong in [CI honesty](/blog/ai-agent-evals-cicd-flakes/), with fail rates still published.

That is the same instinct as [fair agent evals](/blog/fair-agent-evals-before-performance/): fix the measurement before you crown a winner.

---

## What to do Monday

1. List your current agent tests. Label each fast, contract, live, or weekly.
2. Move any bound or classifier that does not need a live model into the fast layer.
3. Make live LLM trials opt-in or scheduled. Do not burn tokens on every push.
4. Gate regressions on known jobs. Keep capability hunts in a separate suite.
5. Treat a missing live dependency as a failed skip in the report, not a silent green.
6. Rematch after harness changes using [frozen exams](/blog/same-problem-sre-model-bake-off/), not random CI luck.

---

## Takeaway

An **AI agent testing pyramid** is still a pyramid. If your suite looks like a soft-serve swirl of live model runs, you will learn late and pay early.

Previous: [Why the Grader Must Be Separate](/blog/ai-agent-evaluation-separate-grader/). Next: [Deterministic Checks vs LLM-as-a-Judge](/blog/deterministic-checks-vs-llm-judge/).

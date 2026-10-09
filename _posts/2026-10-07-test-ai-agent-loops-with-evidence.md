---
layout: post
title: "How to Test AI Agent Loops Without Overfitting"
date: 2026-10-07 08:30:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 75
description: "Detect stalled agent loops from outcomes and evidence, not repeated tool names; test the stop rule with stubbed calls."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, testing, debugging, reliability, loops, aiden]
permalink: /blog/test-ai-agent-loops-with-evidence/
faqs:
  - question: "How do you do AI agent loop detection without overfitting?"
    answer: "Do not stop solely because a tool name repeats. Cap failures, record each call's outcome, and compare the information returned. Ignore transient IDs when deciding whether an observation is new."
  - question: "Is a successful HTTP response always evidence?"
    answer: "No. HTTP 200 means the transport returned a response; if the body reports a failed query, classify it as an upstream failure rather than usable evidence."
  - question: "Should loop and evidence rules need a live LLM trial?"
    answer: "The classifications and stop rules can be unit-tested with stubbed model and tool results. Keep a few live trials for interactions those tests cannot cover."
  - question: "What if a later trace lacks the new loop behavior?"
    answer: "Check which build the trial ran before changing the logic. In our case an old binary explained a trace missing the new fields."
---

We initially treated a repeated tool name as a sign that an agent was stuck. It stopped an investigation that called the same tool again and received new information. The rule measured call repetition, not progress.

Here a *loop* means the agent keeps acting without resolving the task or learning anything useful. That is harder to identify than a repeated call: the same tool can return a new result, and different calls can return the same unhelpful observation. [Best Way to Debug a Multi-Step AI Agent](/blog/best-way-to-debug-multi-step-ai-agent/) and [loop salvage](/blog/ai-agent-loop-detection-salvage/) discuss trace reading and preserving the best available answer; this post focuses on testing the stop rule.

---

## Record outcomes rather than names

We removed the same-tool-again middleware. We kept a failure limit, a typed outcome for each call, and a bounded result summary. The outcome distinguishes success from validation, rejected, runtime, and upstream failures. A failure cap keeps a broken tool from being retried indefinitely; choose the cap for your cost and recovery needs rather than assuming every repeated call is wrong.

We also compare *observation fingerprints*: compact representations of what a result says, with transient identifiers left out. For example, the same empty pod status with a new UUID is still an empty status; a new spill label alone is not new evidence. Fingerprinting can miss meaningful changes if it discards too much, so test examples where the second call really does add information.

The public gate then asks whether evidence is complete, whether feedback was addressed, and whether the latest calls added information. Test the gate's observable decision, not only a private helper. [Vocke's practical test pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) motivates keeping these classifications in fast tests with stubbed collaborators.

## A successful request can contain a failed query

HTTP 200 only says the server answered the request. If its payload says the datasource query failed, the agent has not obtained usable evidence. Classify that as an upstream failure so the next reasoning step cannot cite it as support. This is the distinction behind [evidence-based verification](/blog/evidence-based-verification/): transport success and the agent's own report do not establish the underlying fact.

## Keep domain rules near their source

We tried putting SRE-specific checks—metric family, cluster phase, inventory gap—into shared stop logic. That made a general runtime dependent on one investigation domain. The runtime now handles truncation markers, deduplication, failure limits, and evidence completeness. Tool producers or domain skills handle whether a specific panel or metric is necessary.

Two useful test shapes follow:

| Test | Supply | Assert |
|------|--------|--------|
| Isolated classification | Stubbed model and tool outcomes | Failed payload is not success; repeated empty result is not progress; a changed observation can be progress |
| Boundary test | Real nearby gate components, outer network stubbed | “Complete” is refused while required evidence is pending |

A live trial can still expose unexpected model behavior, but it is a slower way to debug a deterministic classifier. If a trace after deployment lacks expected attributes, first confirm the trial ran the new binary. We once investigated the logic before discovering an old build; [evals in CI/CD](/blog/ai-agent-evals-cicd-flakes/) covers that reporting problem.

## Try this on an existing stop rule

1. Identify rules that fire on repeated tool names alone. Replace them with outcome- and evidence-based checks where possible.
2. Add the “transport okay, payload failed” case and a failure cap.
3. Fingerprint results without ephemeral IDs, then test both duplicate and genuinely new observations.
4. Unit-test classifications and the public gate with stubbed results; retain a few live trials for integration behavior.
5. Verify the build identity in a live trace before attributing missing fields to a code regression.

No classifier can infer progress perfectly from every tool response. Explicit outcomes and small tests at least make its decisions inspectable and adjustable without forcing the agent to avoid a useful tool call.

Previous: [Deterministic Checks vs LLM-as-a-Judge](/blog/deterministic-checks-vs-llm-judge/). Next: [Multi-Agent Handoff Testing](/blog/multi-agent-handoff-testing-context-loss/).

---
layout: post
title: "AI Agent Evals in CI/CD: Flakes, Retries, and Missing Results"
date: 2026-10-07 16:30:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 77
description: "Keep live agent trials deliberate, report missing tasks and failed attempts, and match trial IDs to traces before trusting a CI result."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, ci-cd, testing, reliability, observability, aiden]
permalink: /blog/ai-agent-evals-cicd-flakes/
faqs:
  - question: "Should AI agent evals run on every pull request?"
    answer: "In this setup live LLM suites are opt-in or scheduled; fast deterministic checks run on every push. Choose a different gate if your live trials are stable, affordable, and important enough to justify it."
  - question: "How should retries work for flaky AI evals?"
    answer: "Classify infrastructure failures separately from agent misses and keep every attempt visible. For known-good regression tasks, this setup uses pass-if-any to absorb infrastructure flakes, while publishing per-attempt failures; do not use it to hide intermittent agent failures."
  - question: "What if a baseline task is missing from this run?"
    answer: "Fail the report for a required baseline task. A skipped or absent result is not evidence that the task passed."
  - question: "Why must the trial id match the trace id?"
    answer: "The matching ID links the graded trial to the conversation trace. If they differ, the trace may belong to a different run; a root span showing a worker assignment rather than the user's ask is another sign of mis-correlation."
---

We had a green CI result even though a difficult task was skipped and the remaining attempts were averaged. The color described the reporter's arithmetic, not whether the agent completed every required task. CI needs to distinguish an agent miss from an infrastructure problem and a missing result from a pass.

A *live trial* runs the agent with its model and tools on a task. A *flake* is a run failure caused by unstable infrastructure or another condition unrelated to the agent behavior being evaluated; do not assume every inconsistent answer is a flake. [Ham Vocke's practical test pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) places costly end-to-end tests sparingly. One of our live trials can take about fifteen minutes, so we keep them deliberate and inspectable.

---

## Place and report the suite deliberately

Fast checks run on pushes; live trials sit at the top of the [testing pyramid](/blog/ai-agent-testing-pyramid/) and run by pull-request opt-in or weekly schedule. Build the image once and load its archive in parallel jobs. Avoid a single serial job when tasks can safely run independently.

For our pull-request workflow, an in-progress trial continues when another push arrives, while older queued runs can be cancelled. Updating one report comment keeps the current results easy to find. The gate should also retain build identity and comparable tool access: [fair agent evals](/blog/fair-agent-evals-before-performance/) explains why modes should not be compared until tools match.

## Interpret attempts before choosing a gate

Retries help when a sidecar fails to start or a trial times out before producing a file. They do not establish that the agent is reliable. Averaging attempts into a single pass/fail value made a two-of-three pass fail even though retries were intended to absorb infrastructure noise. For known regression tasks in this setup, the merge gate uses pass-if-any for infrastructure-flake retries *and* publishes each attempt's result or a pass@k summary (the share of tasks solved within k attempts). An agent that fails intermittently can otherwise look green. If a task is new or an agent error caused the retries, investigate rather than granting it an infrastructure-flake exception.

| Observation | What to investigate |
|-------------|---------------------|
| Timeout with no deliverable | Infrastructure or trial timeout; classify before retrying |
| Success exit but no required deliverable | Contract failure: the expected artifact was not written |
| Required baseline task absent from summary | Reporter/gate failure; mark the report unsuccessful |
| Required-task skip marked as pass | Reporter bug; a skip is not a successful run |
| Trial ID differs from trace ID | Correlation bug; waiting longer does not make two IDs equal |

A required task blocked by a missing dependency should write a skip and fail the report. An optional token-spend explanation may fall back to a heuristic, provided the report says so and does not change a failed required task to green.

## Link a result to the right conversation

The trial ID should match the trace ID used by the exporter. Otherwise a grader can inspect the wrong conversation. Check that the root trace span describes the user's ask, not merely a worker assignment. An HTTP 501 (“API not implemented”) is not an eventual-consistency delay; retrying sleep will not create that endpoint.

Keep keys in the secret store, but leave non-secret trace UI hosts as plain configuration. Our CI redacted a host stored as a secret and broke the link in the summary. Export traces into the run artifact so a result can be reviewed later. Import shared CI helpers as modules rather than relying on behavior that only works when a file runs as `__main__`.

Weekly research tasks can mention the product under test without naming private tools in the persona. They explore *capability*—what the agent might do on unfamiliar work—rather than serving as the default *regression* gate for known work.

## A CI review checklist

1. Decide which live jobs merit an opt-in label, a schedule, or a merge gate; keep fast checks on every push.
2. Build once and record the build identity, then reuse the image for parallel trials.
3. Report each attempt and classify failures before applying a retry policy; reserve pass-if-any here for identified infrastructure flakes on known tasks.
4. Fail on any absent required baseline task or required-task skip. Keep optional degradations explicit.
5. Print trial and trace IDs side by side and spot-check a root span weekly; include the trace artifact and a working, non-secret UI host.
6. Classify the last five red runs as infrastructure, contract, correlation, or agent misses. Fix a misleading reporter before treating its color as an agent diagnosis.

A red build is useful when it points to a real, identifiable failure; a green one is useful when it accounts for every required task and does not conceal unstable attempts.

Previous: [Multi-Agent Handoff Testing](/blog/multi-agent-handoff-testing-context-loss/). Series hub: [Enterprise AI Agents in Go](/series/enterprise-ai-agents-go/).

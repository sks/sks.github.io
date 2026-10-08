---
layout: post
title: "AI Agent Evals in CI/CD: Flakes, Retries, and Missing Results"
date: 2026-10-07 16:30:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 77
description: "AI agent evals in CI/CD only help if red means a real regression. Opt in, fail missing tasks, pin trial id to the trace, and separate flakes from agent bugs."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, ci-cd, testing, reliability, observability, aiden]
permalink: /blog/ai-agent-evals-cicd-flakes/
faqs:
  - question: "Should AI agent evals run on every pull request?"
    answer: "Make live LLM suites opt-in. Keep fast deterministic checks on every push. Live trials burn tokens and flake if you force them on every synchronize."
  - question: "How should retries work for flaky AI evals?"
    answer: "Retry for infra flakes. For the merge gate, pass if any attempt cleared a known-good regression task. Still publish per-attempt fail rates so intermittent agent bugs stay visible. Do not average attempts into a single boolean."
  - question: "What if a baseline task is missing from this run?"
    answer: "Fail the report. A silent skip used to stay green and hide broken infrastructure."
  - question: "Why must the trial id match the trace id?"
    answer: "If they differ, you graded the wrong conversation. A root span that shows a worker assignment instead of the user ask is the same bug."
---

A green CI job once meant "we skipped the hard task and averaged the rest." That is not **agent regression testing**. That is optimism with a checkmark. **AI agent evals in CI/CD** only earn their keep when red means a real regression.

[Ham Vocke](https://martinfowler.com/articles/practical-test-pyramid.html) put expensive tests in the pipeline on purpose. Agents make that advice sharper: a live trial can run about fifteen minutes and still lie if the report lies.

---

## TL;DR

- Opt in. Do not spend a live model on every push.
- Build the image once. Reuse it across parallel jobs.
- Do not cancel a run that already started. Cancel older runs still waiting.
- Do not average attempts into a single pass/fail. Pass-if-any for infra flakes; publish fail rates so real intermittency stays visible.
- If a baseline task is missing, fail. Silent skips used to stay green.
- Pin the trial id to the trace id. Sleeping longer does not fix a mismatch.
- A timeout with no file is a flake. A missing brief is a contract break.

### Explain like I'm five

If three kids take a spelling test and two spell the word right, you do not fail the class because the average score looks soft. And if one kid never got a pencil, you do not mark them present.

---

## Place the suite deliberately

Live LLM work is the top of the [testing pyramid](/blog/ai-agent-testing-pyramid/). Keep it opt-in on a pull request. A weekly run holds the baseline and the exploratory tip.

Build the agent image once. Parallel jobs load that archive. One long job that does everything serially taught us nothing except how long twenty-five minutes feels.

Do not cancel an in-progress run when a newer push arrives. Cancel older runs that are still queued. Update one pull-request comment instead of stacking a new novel every synchronize.

Fairness still applies: [do not compare modes until tools match](/blog/fair-agent-evals-before-performance/).

---

## Retries without lying

Several attempts exist to absorb infra flakes (timeouts, missing sidecars). Averaging attempts into one boolean is a bad gate: it fails a 2-of-3 pass that retries were meant to absorb.

Best-of-N as a *merge gate* also has a cost. It can hide an agent that fails one in three times. Use pass-if-any only for tasks you already trust as regression coverage, and always publish per-attempt fail rates (or pass@k) so intermittent agent bugs stay visible. Averaging is a diagnostic metric, not a green/red switch.

| Signal | Treat as |
|--------|----------|
| Timeout, no deliverable file | Flake / infra |
| Deliverable missing after success exit | Contract break |
| Baseline task absent from this summary | Gate fail |
| Required task skip written as pass | Bug in the reporter |
| Trace id ≠ trial id | Correlation bug, not lag |

Decision rule: **if a missing trial disappears from the report, fail the report.**

Split skip types. A required task that could not run (missing dependency) must fail the gate. An optional side job, such as a token-spend narrative, may degrade to a heuristic without greenwashing the suite.

---

## Traces are part of the receipt

The id on the trial and the id on the trace must be the same id. If the runner stamps its own session and your exporter looks elsewhere, you grade the wrong conversation. The root span should show the user's ask, not a worker's assignment.

Portable rules that keep showing up:

- Do not treat "API not implemented" (for example HTTP 501) as eventual consistency. Sleeping longer does not fix a mismatched id.
- Do not put non-secret UI origins into the secret store. CI redacts them and breaks links in the job summary. Keys stay secret. Public hosts stay plain strings.
- Export traces into the artifact. Import shared CI helpers as modules, not as one-off scripts that only work when run as `__main__`.

---

## Weekly tip stays exploratory

A weekly research task may discuss the product under test. It still must not name private tools in the persona. Capability hunting lives here, not in the default merge gate. That is Anthropic's capability vs regression split applied to the calendar.

---

## CI honesty checklist

1. Live suite is label-gated or scheduled.
2. Image built once, loaded many times.
3. In-progress run kept; stale queued runs cancelled.
4. One upserted report comment, not a stack.
5. Merge gate uses pass-if-any only for infra-flake retries on known regression tasks; publish per-attempt rates.
6. Missing baseline task fails the compare.
7. Trial id equals trace id on a spot check every week.
8. Trace UI host is not a secret.
9. Required-task skip fails the gate; optional analyst jobs may degrade without greening the suite.

---

## What to do Monday

1. Move live LLM jobs behind an opt-in label or a weekly schedule.
2. Stop averaging attempts into a boolean. Publish fail rates; use pass-if-any only for infra flakes.
3. Fail when a baseline task is absent from the current summary.
4. Print trial id and trace id side by side in the report. Diff them.
5. Move public UI hosts out of the secret store.
6. Classify the last five red runs as flake vs contract vs real agent miss. Fix the reporter before you fix the agent if the reporter lied.

---

## Takeaway

**AI agent evals in CI/CD** are useful only when a red build is a real regression and a green build is not a missing task. Everything else is expensive theater.

Previous: [Multi-Agent Handoff Testing](/blog/multi-agent-handoff-testing-context-loss/). Series hub: [Enterprise AI Agents in Go](/series/enterprise-ai-agents-go/).

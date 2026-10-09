---
layout: post
title: "SRE for Agentic Systems: Why Uptime Isn't Enough Anymore"
date: 2026-08-06 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 35
description: "SRE for agentic systems: uptime isn't enough. Judgment SLOs and how to measure agentic drift when the agent can be 'up' and still wrong."
image: /assets/images/og-default.png
tags: [ai-agents, sre, observability, golang]
faqs:
  - question: "Why isn't API uptime enough for agentic systems?"
    answer: "An agent can return HTTP 200 while confidently misclassifying alerts or escalating work humans used to handle. Infrastructure green does not mean judgment is healthy."
  - question: "What is agentic drift?"
    answer: "Decay of decision quality over time — often from upstream model tweaks, shifting prompts, or degraded tools — while latency and error rate still look fine."
  - question: "What are Judgment SLOs?"
    answer: "Service objectives that measure decision quality for agents, not only classic SRE signals like latency, errors, and saturation."
---

An agent can remain available while its decisions become less useful. Availability alone will not show that failure.

An HTTP 200 confirms that a request completed, not that an AI agent classified an alert correctly. A misclassification can still return a successful response. For example, even 10,000 misclassified PagerDuty alerts would not necessarily lower API uptime.

**Site reliability engineering (SRE)** for agentic systems adds checks on decisions made by AI agents—software that can select tools and take steps toward a task. If an agent can propose or perform bounded production changes, latency, error rate, and saturation still matter, but they do not measure whether the decision was appropriate.

Decision quality needs separate measurement.

---

## The Problem: Agentic Drift and Silent Failures

When we deployed the agent runtime for [Aiden](/blog/aiden-platform/) to handle incident triage, process health and latency dashboards looked normal. The large language model (LLM) provider latency was within bounds.

But behind the scenes, a subtle change in the underlying foundational model caused the agent to become overly cautious. It started escalating alerts to humans that it previously handled autonomously. Infrastructure metrics did not capture the change; in our observed workflow, utility dropped by 40%. That figure describes this deployment, not a general rate of agent drift.

This is **agentic drift**: decision quality decays over time, potentially because of upstream model changes, shifting prompt context, or degraded tool integrations. Execution metrics alone would not have identified this decision-quality change.

## The Solution: Judgment SLOs

![Agent decisions are judged live against rubrics and nightly against historical incidents, separately from uptime](/assets/images/diagrams/aug-runtime/judgment-slo.svg)

*A healthy API response does not prove the agent made a sound decision.*

We added **Judgment service-level objectives (SLOs)**: explicit targets for decision quality, alongside operational targets.

A Judgment SLO measures the fidelity and correctness of an agent's decisions against a known baseline. For example, a service might target 99.9% of HTTP requests returning a 200 within 200ms; a judgment target here asks that 95% of root-cause hypotheses match a historical human-verified cause for comparable incidents. Neither target alone establishes that the live decision is safe.

### 1. Golden Scorecards
A decision-quality target needs a baseline. We built "Golden Scorecards" into the agent runtime. We took 500 resolved, complex production incidents and manually graded reference triage paths. A historical path is a comparison point, not necessarily the only valid investigation.

Every night, a background process runs the current iteration of the agent against these 500 incidents in a sandboxed environment. If the agent's decision-making deviates by more than 5% from the reference path, the build fails. Such a comparison can miss valid alternative paths and should be reviewed when the underlying incident or rubric changes.

### 2. The Execution Judge Pattern
Running batch evaluations at night is good, but production happens during the day. How do you measure judgment live?

We implemented an **Execution Judge** pattern in Go. Instead of just firing off a workflow and hoping for the best, the agent runtime orchestrates a secondary, lightweight "Judge" agent. When the primary agent makes a high-stakes decision (e.g., "I am going to restart this pod to fix the latency"), the Judge evaluates the decision trace against a set of organizational rubrics.

If Judge confidence falls below our human-in-the-loop (HITL) threshold, the action is paused and the trace is escalated to a person for review. A judge score is another model output, not independent proof of safety. The system tracks these escalations. A spike in escalation rate can trigger a page based on the judgment target even while infrastructure metrics stay stable; escalations should also be reviewed for policy or case-mix changes.

## The Era of Governed Autonomy

Agents are distributed systems with variable model outputs. Their decisions can degrade even when their process metrics remain stable.

Decision-quality SLOs, error budgets, and regression tests can reveal failures that uptime misses. Historical scorecards and a second model judge have their own blind spots, so high-stakes actions still need policy limits and human review.

---

> StackGen develops AI tools for site reliability engineering (SRE), including incident triage and diagnostic workflows. Product details are at [ai.stackgen.com](https://ai.stackgen.com).

---
layout: post
title: "SRE for Agentic Systems: Why Uptime Isn't Enough Anymore"
date: 2026-08-06 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 35
description: "SRE for agentic systems and AI agents. Introducing Judgment SLOs and how to measure agentic drift in production."
image: /assets/images/og-default.png
tags: [ai-agents, sre, observability, golang]
---

There is a terrifying new metric in production engineering: **the 100% uptime silent failure.**

When your traditional microservices have 100% API uptime, you can usually sleep through the night. When your AI agent runtime has 100% API uptime, it might be rapidly and confidently misclassifying 10,000 PagerDuty alerts while returning HTTP 200s. 

We are entering the era of **SRE for Agentic Systems**. As agents move from read-only copilots to bounded remediation—where they actually touch production—traditional Site Reliability Engineering metrics like latency, error rate, and saturation are no longer enough to measure system health. 

You now have to measure *judgment*.

---

## The Problem: Agentic Drift and Silent Failures

When we first deployed the agent runtime for [Aiden](/blog/aiden-platform/) to handle incident triage, our dashboards looked beautiful. The goroutines were healthy, memory was flat, and the LLM provider latency was within bounds. 

But behind the scenes, a subtle change in the underlying foundational model caused the agent to become overly cautious. It started escalating alerts to humans that it previously handled autonomously. From an infrastructure perspective, everything was perfect. From a business perspective, the agent's utility dropped by 40%.

This is **Agentic Drift**. It is the decay of decision quality over time, often caused by upstream model tweaks, shifting prompt contexts, or degraded tool integrations. If you only monitor the execution layer, you will miss the drift until your human on-call engineers burn out.

## The Solution: Judgment SLOs

To solve this, we introduced the concept of **Judgment SLOs**. 

A Judgment SLO measures the fidelity and correctness of an agent's decisions against a known baseline. Just as you have an SLO that 99.9% of HTTP requests must return a 200 within 200ms, a Judgment SLO dictates that 95% of the agent's root cause hypotheses must match the historical human-verified root cause for similar incidents.

### 1. Golden Scorecards
You cannot measure judgment in a vacuum. You need a baseline. We built a system of "Golden Scorecards" into the agent runtime. We took 500 resolved, complex production incidents and manually graded the perfect triage path. 

Every night, a background process runs the current iteration of the agent against these 500 incidents in a sandboxed environment. If the agent's decision-making deviates by more than 5% from the golden path, the build fails. 

### 2. The Execution Judge Pattern
Running batch evaluations at night is good, but production happens during the day. How do you measure judgment live?

We implemented an **Execution Judge** pattern in Go. Instead of just firing off a workflow and hoping for the best, the agent runtime orchestrates a secondary, lightweight "Judge" agent. When the primary agent makes a high-stakes decision (e.g., "I am going to restart this pod to fix the latency"), the Judge evaluates the decision trace against a set of organizational rubrics. 

If the Judge confidence falls below our Human-in-the-Loop (HITL) threshold, the action is paused, and the trace is escalated to a human. The system tracks these escalations. If the escalation rate spikes, our Judgment SLO burns down, triggering a page to the platform engineers—long before the infrastructure metrics even blip.

## The Era of Governed Autonomy

We can no longer afford to treat AI agents as magical black boxes that just "work." They are distributed, non-deterministic systems. They will break, they will hallucinate, and they will drift. 

By applying rigorous SRE principles—like SLOs, error budgets, and automated regression testing—to the *cognitive* output of the agent, we bridge the trust gap. We move from hoping the agent does the right thing, to proving it.

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

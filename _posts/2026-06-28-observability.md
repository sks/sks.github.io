---
layout: post
title: "You Can't Debug What You Can't See — Observability for AI Agents"
date: 2026-06-28 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 9
description: "Observability for production AI agents — session traces, tool attribution, and token budgets beyond traditional APM."
tags: [observability, ai-agents, langfuse, monitoring, production]
---

Traditional APM can't tell you why your agent spent far more than usual asking the same question three times.

We've been running [AI agents for SRE teams](/topics/ai-agents-sre/) in production for months. The hardest part isn't building them — it's understanding what they're doing when they go wrong. Agents don't crash with stack traces. They loop, hallucinate, burn tokens, and produce plausible-looking output that's subtly wrong.

Here's what we learned about seeing inside.

---

## Why Standard Monitoring Falls Short

Standard application monitoring answers questions like:
- Is the service up?
- How fast are responses?
- Are there errors?

Agent monitoring needs to answer different questions:
- **Why did this task cost dramatically more than usual?**
- **Why did the agent call the same tool repeatedly?**
- **Did the agent actually do what it said it did?**
- **Which model is best for this task type?**
- **Is the agent learning, or is it making the same mistakes?**

These are fundamentally different questions. Prometheus counters and Grafana dashboards alone won't answer them.

---

## The Three Pillars for Agents

### 1. Traces — The Session Timeline

Every agent session should produce a trace — not a generic APM trace, but an **agent trace** that captures the full decision history: each model call, each tool invocation, each sub-agent delegation, with timing and cost attached.

We use [Langfuse](https://langfuse.com) as our trace backend. Every LLM call, tool execution, and sub-agent delegation is a span. Traces nest — sub-agent work appears as children of the parent trace, so you can follow delegation without losing the thread.

Trace delivery must be non-blocking. Tool execution should never wait on a synchronous HTTP POST to a tracing backend. Use a batch exporter pipeline so spans buffer in memory and flush periodically. On shutdown, drain remaining spans gracefully. If the trace backend is temporarily unreachable, you lose telemetry — not availability.

### 2. Costs — The Unit Economics Question

Token costs are the unit economics of agents. You need visibility at two levels:

- **Per session** — total cost, token breakdown, which model did what
- **Per agent over time** — daily burn rate, session count, cost trends

**Why this matters:** An agent that loops — calling the same tool repeatedly because it can't make progress — burns tokens geometrically. Without cost monitoring, you discover this when the invoice arrives, not when the loop starts.

**Proactive guardrails:** Reactive alerting alone isn't fast enough — a tight loop in a parallel agent can burn through budget in seconds before a webhook fires. Hard iteration caps, per-tool call budgets, and loop detection that blocks identical consecutive calls all act as **pre-flight circuit breakers**. Alerts are the second line of defense, not the first.

**Alerting:** Alert when a single session exceeds a multiple of the rolling average cost for that agent. This catches slower-burning anomalies — hallucination spirals, model routing errors, gradually accumulating context — that slip past hard limits.

### 3. Audit — The Immutable Record

Every tool call, governance decision, and memory operation should log to an append-only record — structured, timestamped, searchable. Tool outputs that contain sensitive data get sanitized before logging. You need to reconstruct what happened without exposing credentials in the process.

---

## The Diagnostic Command

We built a `doctor`-style diagnostic command (think `brew doctor`) that checks agent health in one shot: model connectivity, vector store reachability, pending approvals, memory counts, trace backend status, integration health.

One command tells you if the agent's dependencies are healthy. No digging through five dashboards to find which dependency is down.

---

## Automated Session Reviews

Raw traces are useful for debugging individual sessions. But with many agents running hundreds of sessions daily, you can't review them all manually.

We run automated analysis on completed traces: duration, cost, tool count, loop detection, token efficiency flags. Anomalous sessions — loops, high cost, tool errors — get flagged for human review. Humans review the flags, not every session.

---

## Metrics vs Traces

For real-time dashboards and alerting, export bounded metrics to Prometheus (or similar): tool success/failure rates by tool name, per-agent session costs, approval latency histograms, classification counts.

These complement traces — they don't replace them.

**A warning on cardinality:** Keep Prometheus labels low-cardinality. Tool names and agent names are safe — they have bounded values. Never put unique identifiers like session IDs into Prometheus labels. A production system running thousands of agent sessions daily will cause a cardinality explosion that crashes the metrics server. Leave per-session details to your tracing backend or structured logs.

---

## What to Watch

| Signal | Why it matters |
|--------|----------------|
| Session cost vs rolling average | Catches loops and runaway context early |
| Identical consecutive tool calls | Loop detection before cost explodes |
| Approval latency | Stale approvals mean blocked agents |
| Model error rate | Provider issues vs agent bugs |
| Vector store / integration health | Silent dependency failures |
| Daily token burn vs budget | Invoice surprises |
| Audit log growth rate | Potential runaway execution |

---

## Lessons Learned

1. **Cost is your canary.** Sudden cost spikes almost always indicate a bug — loops, model routing errors, or unbounded context accumulation. Alert on cost first, debug second.

2. **Traces are for debugging, metrics are for alerting.** Don't try to alert on traces (too detailed) or debug with metrics (too aggregated). Use both.

3. **Audit PII-redaction is non-negotiable.** Your audit trail will be queried during incident reviews. If it contains credentials or PII, your observability tool becomes a liability.

4. **Build a diagnostic command.** One command, all dependencies, clear pass/fail — saves more time than any dashboard.

5. **Automate trace analysis.** You can't review hundreds of sessions a day manually. Let the analyzer flag anomalies; humans review the flags.

---

## Related reading

- [Maintaining Tokenomics with Aiden](/blog/maintaining-tokenomics-with-aiden/) — context budgets and cost attribution
- [AI Incident Triage for SREs](/blog/ai-incident-triage-sre/) — what to gather once you can see sessions
- More on [AI agents for SRE](/topics/ai-agents-sre/) · full [series](/series/enterprise-ai-agents-go/)

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

*What observability tools do you use for your agent platform? I'm especially interested in cost monitoring and loop detection approaches. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*



---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

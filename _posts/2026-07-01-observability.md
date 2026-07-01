---
layout: post
title: "You Can't Debug What You Can't See — Observability for AI Agents"
date: 2026-07-01
description: "Traditional APM can't tell you why your agent spent $4.72 asking the same question three times. Here's what agent observability actually requires."
tags: [observability, ai-agents, langfuse, monitoring, production]
---

Traditional APM can't tell you why your agent spent $4.72 asking the same question three times.

We've been running AI agents in production for 4 months. The hardest part isn't building them — it's understanding what they're doing when they go wrong. Agents don't crash with stack traces. They loop, hallucinate, burn tokens, and produce plausible-looking output that's subtly wrong.

Here's the observability stack we built to see inside.

---

## Why Standard Monitoring Falls Short

Standard application monitoring answers questions like:
- Is the service up? (health check)
- How fast are responses? (latency P50/P99)
- Are there errors? (error rate)

Agent monitoring needs to answer:
- **Why did this task cost $12 when it usually costs $0.50?**
- **Why did the agent call the same tool 7 times?**
- **Did the agent actually do what it said it did?**
- **Which model is best for this task type?**
- **Is the agent learning, or is it making the same mistakes?**

These are fundamentally different questions. You can't answer them with Prometheus counters and Grafana dashboards alone.

---

## The Three Pillars for Agents

### 1. Traces — The Session Timeline

Every agent session produces a trace. Not an APM trace — an **agent trace** that captures the full decision history:

```
Session: "Investigate production latency spike"
├─ LLM Call #1: Plan generation (tokens: 1200 in, 340 out, $0.004)
├─ Tool: web_search("production latency monitoring") → 3 results
├─ LLM Call #2: Analyze results (tokens: 2100 in, 890 out, $0.008)
├─ Tool: run_shell("kubectl top pods -n production") → approved, 1.2s
├─ Sub-agent: "Check database metrics"
│   ├─ LLM Call #3: Sub-plan (tokens: 800 in, 200 out, $0.002)
│   ├─ Tool: run_shell("psql -c 'SELECT * FROM pg_stat_activity'")
│   └─ LLM Call #4: Analysis (tokens: 3400 in, 1200 out, $0.012)
├─ LLM Call #5: Synthesize findings (tokens: 4200 in, 1800 out, $0.018)
└─ Tool: send_message("Root cause: connection pool exhaustion...")
    
Total: 5 LLM calls, 3 tool calls, 1 sub-agent, $0.044, 47 seconds
```

We use [Langfuse](https://langfuse.com) as our trace backend. Every LLM call, tool execution, and sub-agent delegation is a span. Traces nest — sub-agent traces are children of the parent trace.

### 2. Costs — The $4.72 Question

Token costs are the unit economics of agents. We track:

```
Per-session:
  Total cost         $0.044
  Input tokens       11,700
  Output tokens      4,430
  Model breakdown:
    claude-sonnet:   $0.038 (4 calls)
    gemini-flash:    $0.006 (1 call, efficiency task)

Per-agent (daily):
  sre-copilot:       $12.40 (28 sessions)
  security-analyst:  $3.20  (7 sessions)
  dev-assistant:     $18.90 (42 sessions)
```

**Why this matters:** An agent that loops — calling the same tool repeatedly because it can't make progress — burns tokens geometrically. A 10-iteration loop on Claude Sonnet costs 10× a single call. Without cost monitoring, you discover this when the invoice arrives.

**Alerting:** We alert when a single session exceeds 3× the rolling average cost for that agent. This catches loops, hallucination spirals, and model routing errors early.

### 3. Audit — The Immutable Record

Every tool call, governance decision, and memory operation is logged to an append-only NDJSON file:

```jsonl
{"ts":"...","event":"tool_call","tool":"run_shell","args":{"cmd":"kubectl get pods"},"decision":"auto_approved","middleware_ms":2}
{"ts":"...","event":"tool_result","tool":"run_shell","status":"success","output_bytes":1247,"redacted":false}
{"ts":"...","event":"hitl_pending","tool":"kubectl_apply","request_id":"abc123"}
{"ts":"...","event":"hitl_approved","request_id":"abc123","approver":"sabith","latency_s":6.2}
{"ts":"...","event":"memory_store","type":"episodic","goal":"investigate latency","confidence":0.82}
```

The audit trail is PII-redacted. Tool outputs that contain sensitive data are sanitized before logging. You can trace what happened without exposing credentials.

---

## The Diagnostic CLI

We built `genie doctor` (think `brew doctor`) — a diagnostic command that checks agent health:

```bash
$ genie doctor

✅ Model connectivity: claude-sonnet, gemini-flash (2/2 reachable)
✅ Vector store: qdrant at localhost:6334 (healthy, 1,247 vectors)
✅ HITL: 0 pending approvals
✅ Memory: 42 episodic memories, 12 skills, 8 notes
⚠️ Langfuse: connected but 3 failed trace uploads in last hour
❌ MCP server "datadog": connection refused
   → Last successful connection: 2 hours ago
   → Try: npx -y @datadog/mcp-server --check
```

One command tells you if the agent's dependencies are healthy. No digging through logs, no checking 5 dashboards.

---

## Trace Analysis — Automated Session Reviews

Raw traces are useful for debugging individual sessions. But with 50+ agents running hundreds of sessions daily, you can't review them all manually.

We built a trace analyzer that produces automated session breakdowns:

```markdown
## Session Analysis: sre-copilot (session-abc123)

**Request:** "Why is the API slow?"
**Duration:** 47s | **Cost:** $0.044 | **Tools:** 3 | **LLM calls:** 5

### Efficiency Assessment
- ✅ No tool loops detected
- ✅ Sub-agent completed successfully
- ⚠️ High input token count on call #5 (4,200 tokens)
  → Consider: Trim sub-agent output before synthesis

### Cost Breakdown
| Call | Model | Tokens (in/out) | Cost |
|------|-------|-----------------|------|
| Plan | claude-sonnet | 1,200 / 340 | $0.004 |
| Analyze | claude-sonnet | 2,100 / 890 | $0.008 |
| Sub-plan | gemini-flash | 800 / 200 | $0.002 |
| Sub-analyze | claude-sonnet | 3,400 / 1,200 | $0.012 |
| Synthesize | claude-sonnet | 4,200 / 1,800 | $0.018 |
```

The analyzer runs on every trace. Anomalous sessions (loops, high cost, tool errors) are flagged for human review.

---

## Prometheus Metrics

For real-time dashboards and alerting, we export metrics:

```
# Tool call success/failure rates
toolwrap_tool_call_total{tool="run_shell",outcome="success"} 142
toolwrap_tool_call_total{tool="run_shell",outcome="failure"} 3

# Per-agent session costs
agent_session_cost_usd{agent="sre-copilot"} 0.044

# HITL approval latency
hitl_approval_latency_seconds{quantile="0.5"} 6.2
hitl_approval_latency_seconds{quantile="0.99"} 45.1

# Semantic router classification
semantic_router_classification_total{route="operations",tier="L1"} 89
semantic_router_classification_total{route="jailbreak",tier="L0"} 2
```

These feed into standard Grafana dashboards for the operations team. They don't replace Langfuse traces — they complement them with real-time alerting.

---

## What We Monitor

| What | How | Alert Threshold |
|------|-----|----------------|
| Session cost | Langfuse traces | > 3× rolling average |
| Tool loop | Middleware counter | > 2 identical consecutive calls |
| HITL latency | Prometheus histogram | > 5 minutes (approval stale) |
| Model errors | Prometheus counter | > 5% error rate in 5 minutes |
| Vector store health | `genie doctor` cron | Connection refused |
| MCP server health | Heartbeat check | 3 missed heartbeats |
| Token burn rate | Daily aggregation | > 2× daily budget |
| Audit file growth | Filesystem monitor | > 1GB/day (potential loop) |

---

## Lessons Learned

1. **Cost is your canary.** Sudden cost spikes almost always indicate a bug — loops, model routing errors, or unbounded context accumulation. Alert on cost first, debug second.

2. **Traces are for debugging, metrics are for alerting.** Don't try to alert on traces (too detailed) or debug with metrics (too aggregated). Use both.

3. **Audit PII-redaction is non-negotiable.** Your audit trail will be queried during incident reviews. If it contains credentials or PII, your observability tool becomes a liability.

4. **Build a diagnostic CLI.** `genie doctor` saves more time than any dashboard. One command, all dependencies, clear pass/fail.

5. **Automate trace analysis.** You can't review 200 sessions a day manually. Let the analyzer flag anomalies; humans review the flags.

---

*What observability tools do you use for your agent platform? I'm especially interested in cost monitoring and loop detection approaches. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

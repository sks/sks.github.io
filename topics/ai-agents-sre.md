---
layout: page
title: AI Agents for SRE
permalink: /topics/ai-agents-sre/
description: "SRE AI agents for incident triage, diagnostics, and RCA — what actually helps on-call teams versus demo theater, plus observability and tokenomics."
hub: ai-agents-sre
faqs:
  - question: "What are SRE AI agents?"
    answer: "AI agents that help site reliability and on-call teams triage incidents, query observability and change planes, and draft evidence-backed next steps — with budgets and human review, not open-ended auto-remediation theater."
  - question: "What actually helps on-call SRE teams with AI agents?"
    answer: "Parallel context gathering with bounded tool loops, evidence from observability planes, and human-reviewable outputs — not open-ended autonomous remediation in the first iteration."
  - question: "How do you observe AI agent workloads in production?"
    answer: "Traditional APM misses agent-specific failure modes. You need session-level traces, tool-call attribution, token budgets, and eval gates — not just request latency."
  - question: "How do you control LLM costs for agent sessions?"
    answer: "Treat context as an operating budget: tiered memory, tool response compression, doom-loop detection, and per-session FinOps loops — cheaper models alone are not a strategy."
  - question: "How should AI agents do root cause analysis without guessing?"
    answer: "Use a hypothesis ladder: establish identity and onset before change theories, keep competing branches parallel until evidence rules them out, and prove before narrating — not one fluent hero narrative. Soft prompts alone won't stop early closure; fail-closed checks should refuse confidence while required digs remain unattempted."
  - question: "What if the agent found evidence but still gave up?"
    answer: "That is abandon-after-lead — different from inventing under emptiness. When the rule payload matches the pasted alert, ignore mismatched firing peers, pin query windows to fire time, and require Theory to cite the strongest metric or log lead instead of restating the checklist."
---

**SRE AI agents** sit at the intersection of on-call pain and demo hype. Start with the **[SRE on-call starter pack](/start/sre-on-call/)** (five posts), or [What Are SRE AI Agents?](/blog/what-are-sre-ai-agents/) for the plain definition, then dig into triage, RCA, and observability below.

Also see [AI incident triage](/topics/ai-incident-triage/) for the on-call-specific landing page. Pocket checklists: [evidence-gated RCA](/checklists/evidence-gated-rca/) · [“done” checks](/checklists/agent-done/).

Part of the series [Building an Enterprise AI Agent Platform in Go](/series/enterprise-ai-agents-go/).

## Featured posts

| Post | What you'll learn |
|------|-------------------|
| [What Are SRE AI Agents?](/blog/what-are-sre-ai-agents/) | Plain definition — triage vs RCA vs remediation |
| [AI Incident Triage for SREs — What Actually Helps On-Call](https://stackgen.com/blog/ai-incident-triage-for-sres-what-works-on-call) | Practitioner take on what helps on-call vs demo theater (on StackGen) |
| [You Can't Debug What You Can't See — Observability for AI Agents](/blog/observability/) | Why traditional APM fails for agent workloads |
| [LLM Tokenomics for Production Agents — Context Budgets as an Operating Model](/blog/maintaining-tokenomics-with-aiden/) | Context budgets, compression, FinOps operating model |
| [Is the Task Actually Done?](/blog/is-the-task-actually-done/) | When "done" needs an independent check — goal-scoped loops without melting the bill |
| [Beyond Confluence Runbooks](/blog/beyond-confluence-runbooks/) | When GitOps triage beats wiki playbooks for agents — and when it doesn't |
| [From Demo to Deploy — Failure Modes with Receipts](/blog/demo-to-deploy-receipts/) | Polite demo→prod failures and the receipts checklist for production-ready claims |
| [The Diary Learning Loop](/blog/diary-learning-loop/) | Daily digests → human-approved workflow and policy proposals |
| [The Hypothesis Ladder](/blog/hypothesis-ladder/) | Hypothesis-driven RCA — identity before depth, parallel branches, prove then narrate |
| [AI Agent Root Cause Analysis — Curiosity Before Confidence](/blog/curiosity-before-confidence/) | Soft prompts don't stop bad AI RCA — hard gates, batched validation, curiosity before confidence |
| [Be Creative. Don't Invent.](/blog/be-creative-do-not-invent/) | When stuck, search harder — don't fabricate IDs, metrics, or a tidy root cause |
| [AI Agent Root Cause Analysis — Evidence Discarded After the Lead](/blog/evidence-discarded/) | AI agent RCA fails when digs find a lead and discard it — peer noise, fire-time windows, transcript gates |
| [AI Agent Loop Detection — Don't Throw Away the Answer](/blog/ai-agent-loop-detection-salvage/) | Keep useful incident findings when the agent's finishing loop stalls |
| [PII Redaction for AI Agents](/blog/pii-redaction-ai-agents/) | Protect model history while preserving authorized operator debugging |
| [Single-Agent vs Multi-Agent Orchestration: How to Choose](/blog/single-agent-vs-multi-agent/) | When single-agent vs multi-agent fits SRE triage — fair A/B, both sides |
| [AI SRE Agent Benchmarks: Wall Time, Tools, Tokens](/blog/ai-sre-agent-benchmarks-wall-time-tools-tokens/) | Fair scorecard — wall time, tool calls, payload bytes, ReAcTree tax |
| [Canary First: Consistency Evals for Live SRE Investigate](/blog/canary-first-sre-investigate-consistency-evals/) | Nightly black-box investigate — canary before tokens, draft ≠ done, concurrence |

{% include subscribe.html %}

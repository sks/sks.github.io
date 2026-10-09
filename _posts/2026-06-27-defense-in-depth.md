---
layout: post
title: "Your Agent Has Root — Defense-in-Depth for AI Agents That Wield Real Tools"
date: 2026-06-27 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 8
description: "Defense-in-depth for production AI agents: layered policy, HITL, and tool governance when the agent has root — prompts are not security."
image: /assets/images/og-governance.png
tags: [security, ai-agents, hitl, governance, production]
---

An agent with access to a shell, application programming interfaces (APIs), code repositories, or infrastructure can affect real systems. A prompt that asks it not to do harm is useful guidance, but it is not an access-control boundary. When we gave agents these tools, we added checks outside the model and applied them at tool execution.

The layers below address different risks. They reduce exposure in our implementation; none proves that a system is secure.

---

## What We Try to Defend Against

1. **Prompt injection:** instructions hidden in untrusted input attempt to redirect the agent, for example toward deleting a database.
2. **Tool misuse:** an agent pursuing a legitimate request chooses an unsafe action, such as destructive cleanup.
3. **Excess privilege:** an agent can reach a tool it was not meant to use.
4. **Data exfiltration:** sensitive data, including personally identifiable information (PII), leaves through an output or external call.
5. **Recursive resource use:** delegated agents spawn more work than the system can safely support.

These are different failure modes for [production AI agents](/topics/ai-agents-sre/). A policy on tool calls cannot, on its own, prevent secret exposure in every read result, and a good audit log cannot prevent a destructive action.

## Layer 1: Check the Request

Before giving the agent tools, we classify the user's request. This can catch obvious attempts to override instructions or requests outside the intended service. It is not a robust defense against an instruction buried in a document or tool result the agent reads later.

"Check if the API key is properly configured on the production server" illustrates the limit. It is a reasonable operations question, but an agent might answer by dumping all environment variables, including credentials. The user's intent and the safety of a proposed action need separate checks.

## Layer 2: Enforce Policy at Every Tool Boundary

Parent agents, delegated agents, plan steps, and fallback paths pass through the same enforcement code. It blocks named tools on a hard-deny list without asking a language model to decide; it also interrupts repeated identical calls and temporarily limits tools that fail repeatedly within a short window. Those loop controls manage resource use, while deny rules manage access. Neither substitutes for permission limits on the underlying accounts.

Deterministic here means a configured rule gives a predictable result, not that every dangerous command can be recognized from its text. Prefer narrow, typed tools and least-privilege credentials to unrestricted shells when possible.

## Layer 3: Ask a Human for Consequential Calls

Human-in-the-loop (HITL) approval applies to calls that can change external state; read-only actions are generally allowed without it, and certain destructive tools are denied regardless of approval. The agent can work on independent tasks while a request waits. Review helps with context-sensitive decisions, but an approver can miss details, so it is not a substitute for tool restrictions. The [HITL post](/blog/hitl-paradox/) discusses approval fatigue and bypasses.

## Layer 4: Check Claims Against Execution

A completed agent may say it deployed successfully when a tool returned an error. We use a second large language model (LLM) to compare the response with the raw execution trace: which tools ran, and what they returned. Unsupported claims are flagged before being presented or used downstream. A different model looking at the raw trace is more independent than asking the agent to grade its own summary, but the reviewer can still miss a problem. For important changes, also verify the actual system state.

## Layer 5: Keep an Audit Record

We log tool calls, model requests, and policy decisions to an append-only record, with sensitive material sanitized before storage. This supports reconstruction after an incident. Append-only behavior and sanitization depend on storage permissions and redaction quality; the log is evidence, not a preventive control and not automatically a complete record of everything a model inferred.

## Where the Layers Meet

Our most instructive failure was a delegation route that initially bypassed governance because it was added through a different binding path; the [ReAcTree bugs post](/blog/reactree-bugs/) describes it. A strong rule on one path does nothing for another path that never invokes it. We now audit each new route through which a tool can execute.

The practical lesson is to restrict available tools and credentials, enforce policy consistently, use human review where it adds judgment, verify claims against traces and system state, and retain a usable audit record. Those controls have different jobs and should be tested separately. The right mix depends on the systems and privileges an agent can reach.

## Related reading

- [The HITL Paradox](/blog/hitl-paradox/) — when human approval helps or hurts
- [AI Agent Runtime vs Platform — Why We Split Them](/blog/aiden-platform/) — where policy enforcement lives
- More on [AI agents for SRE](/topics/ai-agents-sre/) · full [series](/series/enterprise-ai-agents-go/)

---

*How do you test that delegated agents use the same security controls? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> **StackGen builds AI-assisted site reliability engineering (SRE) tools.** Our offering at [ai.stackgen.com](https://ai.stackgen.com) supports incident triage, diagnostics, and draft root-cause analyses.

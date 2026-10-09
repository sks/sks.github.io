---
layout: post
title: "Pensieve — Memory Management for AI Agents That Actually Forget"
date: 2026-06-24 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 5
description: "AI agent memory that forgets on purpose — Pensieve manages four memory types with decay and self-pruning so RAG stops stuffing stale context."
image: /assets/images/og-memory.png
tags: [ai-agents, memory, rag, architecture, go]
---

An agent can retrieve a past incident and still make a worse decision because that incident is no longer relevant. In our SRE (site reliability engineering) copilot, a search over stored context could return many apparently related passages, including stale or contradictory ones. Imagine retrieving 40 chunks for a 128K-token context window when 35 do not help the current task: the large window can accommodate the text, but it cannot make it relevant. This is an illustration of the failure mode, not a measured distribution across our sessions.

We built Pensieve to give different kinds of information different lifetimes. It separates temporary task state, past experiences, persistent facts, and reusable procedures. This is a description of our design and the problems it addresses, not a claim that every agent needs the same memory system.

---

## Why Retrieval Alone Wasn't Enough

RAG (retrieval-augmented generation) typically finds document passages similar to a question and places them in a model's context, the text available to it for that response. That can work well for questions about a relatively stable document collection. An agent also creates new material as it works: attempts, failures, tool results, and user corrections. Those records have different reliability and expiration dates. "The staging API was down" may be valuable yesterday and misleading today. A failed attempt is not evidence that an approach can never work.

Similarity therefore cannot be the only criterion for recall. We also need to know when an experience happened, whether it was validated, and whether the current task needs a fact, an account of a prior task, or a procedure.

## Four Kinds of Memory

- **Working memory** holds state for one task and disappears when that task ends.
- **Episodic memory** records past tasks, with relevance, recency, and importance affecting recall.
- **Notes** hold cross-session facts until updated or deleted; they do not automatically decay.
- **Skills** are reusable procedures that remain available until changed or deprecated.

This separation does not make stored information correct. It does let us apply different checks and lifetimes to each kind.

![Four Pensieve memory types branch from agent work: task-scoped working state, ranked episodes, cross-session notes, and reusable skills.](/assets/images/diagrams/june-operations/memory-lifetimes.svg)

The diagram contrasts lifetimes and recall checks; a stored episode or procedure still needs validation before use.

### Working memory: a task blackboard

When a parent agent delegates work to smaller agents through ReAcTree, our task-delegation approach, they can share a session-scoped key-value store (named entries with values):

```
Parent: "Investigate production outage"
  ├─ Sub-agent 1: writes working_memory["log_analysis"] = "OOM killer triggered at 14:32"
  ├─ Sub-agent 2: writes working_memory["metric_summary"] = "Memory usage spiked from 2GB to 8GB"
  └─ Parent reads both entries to synthesize RCA
```

OOM means out of memory; an RCA is a root-cause analysis. These entries coordinate this investigation, not future ones. They are not persisted after the task.

### Episodic memory: what happened before

An episode contains a goal, approach, outcome, and lesson. We mark it pending, successful, or failed. An episode becomes a trusted success only after a validation signal, such as user confirmation. Failed episodes remain available, but we summarize the failure rather than saving a long stack trace as if it were advice. This addressed the failure contamination described in the [ReAcTree bugs post](/blog/reactree-bugs/).

Retrieval blends semantic relevance to the current task, recency, and an importance estimate made by a lightweight large language model (LLM) call when the episode is stored. A routine health check from an hour ago should not automatically outrank a week-old incident matching today's symptoms. Nor should that old incident be accepted without checking whether the environment has changed. The scoring is a ranking aid, not a truth test.

### Notes: facts across sessions

```
notes["user_preference_timezone"] = "US/Pacific"
notes["team_oncall_rotation"]     = "PagerDuty schedule ID: P123ABC"
notes["k8s_cluster_prod"]        = "us-east-1, EKS 1.31, 47 nodes"
```

Here `k8s` means Kubernetes and EKS is Amazon's managed Kubernetes service. Notes can be created, read, updated, and deleted through agent tools. They do not decay automatically, which makes review important when a supposedly stable fact, such as a cluster size, changes.

### Skills: procedures, not observations

Skills live as files and are indexed in a vector store so the agent can find them by meaning. A skill might read:

```markdown
# Skill: Kubernetes Pod Crashloop Triage

## Steps
1. Get pod status: `kubectl get pods -n {namespace} | grep CrashLoopBackOff`
2. Check pod events: `kubectl describe pod {pod_name} -n {namespace}`
3. Read last 100 log lines: `kubectl logs {pod_name} -n {namespace} --tail=100`
4. Check resource limits vs actual usage
5. Check if recent deployments changed the image or config

## Common Causes
- OOM kills → check memory limits
- Missing config/secrets → check configmap/secret mounts
- Image pull failures → check registry access
```

`CrashLoopBackOff` is Kubernetes' state for a container repeatedly failing and restarting. The agent searches for relevant skills at task start and can load a procedure into its prompt. A skill is a starting point for investigation, not authorization to run every command it mentions.

## Letting the Agent Curate Context

Pensieve gives the agent tools to search experiences, save or delete memories, edit notes, and discover skills. Its instructions ask it to look for relevant experiences before working and to offload resolved details when its context grows. This can be more selective than always injecting the top search results, but it also lets the agent overlook or delete useful information.

We log each memory operation in an append-only audit trail for investigation. Delegated agents can read and search; writes pass through the parent agent's governance middleware, the code that checks tool calls against policy. Logging gives us a record, not a guarantee that a deletion was wise.

## Learning After a Task

A background process reviews completed tasks for procedures worth reusing. It compares a candidate with existing skills, merges a useful variation into a related skill, or skips a near-duplicate. A first successful Redis connection-storm triage, for example, might become a runbook rather than requiring the next agent to improvise the same steps. This happens after the user-facing task rather than delaying it.

Failures go through a separate reflection step: what was tried, what failed, and what might be tried differently. The result is stored as a labeled failed episode, not a raw error dump. Future searches can show failures alongside successes without presenting them as working recipes. This draws on [Reflexion](https://arxiv.org/abs/2303.11366), which uses verbal feedback rather than updating model weights.

Once a day, another job summarizes recent episodes into a short, bounded set of standing lessons for the prompt and clears the summarized raw episodes. This controls storage and prompt size, but summarization can lose details. An audit record and the summary serve different purposes; a short lesson should not be mistaken for the complete incident history.

## Sensitive Data in Memory

Conversations, tool output, and API responses may include personally identifiable information (PII), credentials, or network details. We redact patterns such as emails, bearer tokens, and API keys before writing memories. Redaction based on patterns can miss secrets or remove useful context, so it should not be the only privacy control.

Network addresses illustrate the tradeoff for an SRE copilot. A record saying a pod ran on `[REDACTED]` may be useless for diagnosing a repeated topology problem. We distinguish internal, non-routable addresses from external ones and consistently replace sensitive values with the same placeholder, preserving some relationships without keeping the original value. Whether an address is permissible to retain still depends on the organization's data policy.

## What We Would Keep

Validate episodes before treating them as successes; distinguish current task state from durable facts and procedures; label failures; and revisit notes and skills when systems change. Give agents memory tools only alongside scoped permissions and auditability. For our changing operations environment, relevance, recency, and quality checks are more useful than filling a large prompt with everything the search found. Other systems may choose different retention and review rules.

Pensieve differs from a single vector-search collection by combining those lifetimes, validation states, and agent-managed pruning. It does not eliminate stale or incorrect memory; it makes those risks easier to see and manage.

---

*How do you handle temporal relevance and memory quality in your agents? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> **StackGen builds AI-assisted SRE tools.** Our offering at [ai.stackgen.com](https://ai.stackgen.com) supports incident triage, diagnostics, and draft root-cause analyses.

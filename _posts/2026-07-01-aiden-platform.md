---
layout: post
title: "From CLI Agent to Multi-Tenant Platform — Building Aiden"
date: 2026-07-01 11:00:00 -0700
series: "Building an AI Agent Platform in Go"
series_order: 11
description: "A CLI tool for one developer is fun. Making it work for 50 teams with different policies is engineering."
tags: [platform, multi-tenant, architecture, temporal, ai-agents]
---

A CLI tool for one developer is fun. Making it work for 50 teams with different policies, models, budgets, and Slack channels is engineering.

We built our AI agent runtime as a single-binary CLI tool. It worked beautifully — for one person. Then we needed to run it for an enterprise with 20 teams, 50 agents, and strict governance requirements. That's when we built Aiden.

---

## The Gap Between CLI and Platform

The CLI agent assumes:
- **One user** — your credentials, your tools, your config
- **One machine** — runs locally or in one container
- **Trust** — you trust yourself not to break things
- **Ephemeral** — start, run, stop. No persistence between runs

The enterprise needs:
- **Multi-tenancy** — teams with different permissions and budgets
- **Centralized governance** — who can deploy which agents with which tools?
- **Persistent state** — workflow history, audit trails, cost accounting
- **Horizontal scaling** — run 50 agents concurrently without resource contention

---

## The Architecture Decision: Embed, Don't Orchestrate

The obvious approach: run the agent runtime as a microservice, put an API gateway in front, add a database.

We did something different. **Aiden imports the agent runtime as a Go module:**

```go
import "github.com/stackgenhq/agentruntime/pkg/app"

// Inside Aiden's Temporal workflow:
func (w *AgentWorkflow) Execute(ctx workflow.Context, req AgentRequest) error {
    agent, err := app.NewApplication(ctx, app.Config{
        AgentName: req.AgentName,
        Persona:   req.Persona,
        Tools:     req.AllowedTools,
    })
    return agent.Run(ctx, req.Prompt)
}
```

Same process. Same memory space. No serialization. No network hops. The agent runtime is a library, not a service.

**An important nuance on Temporal lifecycle:** The simplified example above wraps the entire agent run in a single unit of work. In production, the agent's execution loop is modelled as a Temporal Workflow — not a monolithic Activity. HITL approval gates use a non-blocking interrupt pattern: when the agent needs human approval, the middleware returns an `interrupt.Error` that yields execution back to the Temporal workflow, which then waits for a signal (approve/reject) and resumes from the exact point of interruption. This avoids re-burning tokens or duplicating tool calls if a worker crashes mid-execution.

**The trade-off of in-process embedding:** Go goroutines share a single OS process, which means there's zero hardware-level isolation between tenants. If one agent triggers an OOM (e.g., parsing a corrupted 500MB PDF), the OS kills the entire worker process — taking other tenants' active executions with it. We mitigate this through Temporal's built-in crash recovery (workflows replay from the last checkpoint on a healthy worker) and per-agent memory budgets at the container level. Resource-heavy operations like document parsing are offloaded to dedicated worker pools.

**Why this works in Go:** Go modules give you versioned, reproducible dependencies. The agent runtime and the platform share types directly. In Python, you'd fight import conflicts, version mismatches, and dependency hell across two large codebases.

---

## Temporal for Workflow Orchestration

Each agent session is a [Temporal](https://temporal.io) workflow. Why Temporal?

1. **Durability** — if the server crashes mid-task, the workflow resumes from the last checkpoint
2. **Visibility** — every workflow step is visible in Temporal's UI
3. **Timeouts** — workflow-level and activity-level timeouts are built in
4. **Retry policies** — configurable retry with backoff for transient failures
5. **Task queues** — agents run on dedicated task queues for resource isolation

```
Agent Request → Temporal Workflow
  ├─ Activity: Load agent config from database
  ├─ Activity: Initialize agent runtime (Go module import)
  ├─ Activity: Execute agent task
  │   ├─ Stream events to frontend (AG-UI protocol)
  │   ├─ HITL approvals stored in DB, resolved async
  │   └─ Tool calls go through governance middleware
  ├─ Activity: Store results and audit trail
  └─ Activity: Run execution judge (quality scoring)
```

### The Execution Judge

After every task completion, an automated judge grades the result:

- **Did the agent answer the question?** (relevance)
- **Did it use tools appropriately?** (tool selection)
- **Did it complete without errors?** (execution quality)
- **Was the response well-structured?** (output quality)

The judge uses a different LLM than the agent to avoid self-evaluation bias. Scores feed into dashboards for agent quality monitoring over time.

---

## Multi-Tenancy Model

Each tenant (team/org) gets:

```
Tenant: "platform-team"
├── Agents: [sre-copilot, dev-assistant, security-analyst]
├── Policies: [deny-destructive-shell, require-pr-review]
├── Model Providers: [anthropic (primary), gemini (fallback)]
├── Integrations: [slack, github, datadog, pagerduty]
├── Budgets: [$50/day limit, alert at $30]
└── Knowledge Hub: [runbooks.pdf, architecture.md, oncall.md]
```

**Isolation guarantees:**
- **Vector stores** are namespaced by tenant and agent
- **Tool permissions** are scoped by two governance layers (HITL + OPA)
- **Model routing** is per-tenant (different teams can use different providers)
- **Budgets** are per-tenant with hard stops

### Two-Layer Governance

Tool governance operates at two levels:

**Layer 1: HITL Middleware (agent runtime)** — Fast, static allow/deny lists loaded from TOML config:

```toml
[hitl]
always_allowed = ["web_search", "memory_*", "read_*", "discover_skills"]
denied_tools   = ["bash", "shell_*"]
```

Denied tools are hard-blocked. Allowed tools auto-approve. Everything else pauses for human review (see the [HITL Paradox post](/blog/hitl-paradox/) for the full story).

**Layer 2: OPA/Rego Policies (platform layer)** — Contextual, attribute-based policies for decisions that HITL can't express:

```rego
package policy

# Deny deployments outside maintenance windows
allow = false {
    input.tool.name == "kubectl_apply"
    not in_maintenance_window(input.timestamp)
}

# Require manager approval for high-risk operations
approval_required = true {
    input.tool.name == "run_shell"
    input.current_project.role_name != "admin"
}
```

OPA policies are compiled in-process using the [OPA Go SDK](https://www.openpolicyagent.org/docs/latest/integration/#integrating-with-the-go-sdk) — no sidecar, no HTTP hop. Compiled Rego modules are cached in an LRU cache keyed by `(policyID, version)`, so repeated evaluations are sub-millisecond. The evaluator receives a rich ABAC input document containing the agent identity, tool call, calling user, their project memberships, and skill provenance — giving Rego policies full context for fine-grained decisions.

Policies are classified into four types: **Logic** (boolean allow/deny), **Temporal** (time-based access), **Intervention** (trigger HITL approval), and **Routing** (A/B persona selection). When multiple policies are attached to an agent, outcomes are resolved using XACML-inspired combining algorithms (deny-overrides, permit-overrides, first-applicable).

Policies are defined per-tenant via Terraform (see the [Terraform config post](/blog/terraform-config/) for the full GitOps story) and evaluated at tool execution time.

---

## Knowledge Hub

Enterprise agents need domain knowledge — runbooks, architecture docs, API specs, incident playbooks. The Knowledge Hub handles document ingestion:

```
Upload document (PDF, DOCX, Markdown)
  │
  ▼
Document Parser (Docling or Gemini)
  │
  ▼
Chunk and Embed
  │
  ▼
Store in tenant-scoped vector collection
  │
  ▼
Available via agent's memory_search tool
```

**Multi-backend parsing:** We support Docling (open-source, runs as a sidecar) and Gemini (file upload + structured extraction) for document parsing. The parser is selected via config — no code changes needed.

---

## The Workflow Engine

Beyond single-task execution, Aiden supports multi-step **workflows** — predefined sequences of agent actions with approval gates:

```
Workflow: "Incident Response"
├── Stage 1: Triage (sre-copilot)
│   └── Automatic: gather logs, metrics, recent deploys
├── Gate: Human confirms severity
├── Stage 2: Mitigation (sre-copilot)
│   └── Requires approval for each remediation action
├── Stage 3: RCA Draft (sre-copilot)
│   └── Automatic: generate root cause analysis
└── Stage 4: Post-mortem (dev-assistant)
    └── Automatic: create Jira ticket with RCA
```

Workflows support versioning, traffic splitting (for A/B testing agent configurations), and multi-armed bandit weight updates for automatic optimization.

---

## What We Learned

1. **Embed, don't orchestrate.** Running the agent as a library inside the platform eliminates an entire class of serialization, networking, and deployment complexity.

2. **Temporal is worth the complexity.** The durability and visibility guarantees pay for the learning curve. Agent tasks can run for minutes — you need crash recovery.

3. **Governance as middleware scales.** Two layers: HITL middleware for fast tool-level allow/deny at the runtime, OPA/Rego for contextual ABAC policies at the platform. Compiled in-process with LRU caching — no sidecar, sub-millisecond evaluations.

4. **Tenant isolation is non-negotiable.** Vector store contamination between tenants is a data breach. Namespace everything from day one.

5. **Quality scoring needs a separate model.** Self-evaluation (agent grades itself) produces inflated scores. Use a different model for the execution judge.

---

*Building a multi-tenant agent platform? I'd love to compare architectures. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

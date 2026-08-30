---
layout: post
title: "Weekly Reflection: Context Engineering Beat the Language Wars"
date: 2026-08-30 11:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 55
description: "Weekly reflection for Aug 24 to 30: context engineering is the craft that matters, deep harnesses for long jobs only, and why Go vs Python is the wrong debate for agent quality."
image: /assets/images/og-default.png
tags: [ai-agents, context-engineering, weekly-reflection, industry, orchestration, sre, evaluation, tokenomics, aiden]
permalink: /blog/weekly-reflection-context-engineering-wins/
faqs:
  - question: "What is context engineering for AI agents?"
    answer: "Context engineering is curating what tokens enter the model each step: system instructions, tools, memory, retrieval, history, and scratchpad. It is not just rewriting the system prompt. The usual operations are write, select, compress, and isolate."
  - question: "Are Python or TypeScript agents smarter than Go agents?"
    answer: "No. With the same model, tools, and context assembly, language choice mostly changes ecosystem velocity and runtime ops cost. Quality still comes from context engineering, tool design, and evals."
  - question: "Should every production agent use a deep multi-agent harness?"
    answer: "No. Use fixed workflows when the path is known, a single ReAct loop for short open-ended work, and a deep harness (plan, spill, subagents, compaction) only when long-horizon runs drown a simple loop."
  - question: "What should teams adopt for agent context management in 2026?"
    answer: "MCP for tools, durable notes before shrinking the window, tool-result clearing for re-fetchable payloads, compaction before context rot, lean tool lists, traces plus outcome evals, and contract-first subagent handoffs."
  - question: "What should teams avoid in agent architecture?"
    answer: "Unnecessary autonomy, stuffing every tool and document every turn, role-heavy multi-agent theater, compacting only after the model is already confused, and rewriting the runtime language as a quality strategy."
  - question: "Which open-source repos should I clone to learn these agent patterns?"
    answer: "Start with LangGraph (Python) or LangGraph.js / Mastra (TypeScript) or trpc-agent-go (Go) for graphs; DeepAgents or the Claude Agent SDK for deep harnesses; Pydantic AI, OpenAI Agents SDK, or Vercel AI SDK for lean ReAct; and the Model Context Protocol SDKs plus modelcontextprotocol/servers for tools."
---

This week I kept getting the same question in different clothes: *would our agents be smarter in Python or TypeScript?*

Wrong question. The interesting news this week, and our own A/B scars, point somewhere else. **Context engineering** is the craft. Orchestration ideology is a routing decision. Language is an ops preference.

This is a **weekly reflection**: industry patterns worth stealing, plus what we actually learned running investigate agents. No blueprint. Steal the principles.

---

## TL;DR

- **Winning ideology:** simplest orchestration that passes evals. Workflow when the path is known, ReAct when it is not, deep harness only for long-horizon drowning.
- **Winning craft:** write / select / compress / isolate the window every turn. Prompt wording is one slot, not the whole job.
- **Language wars are a sideshow.** Same model + same tools + same context ≈ same quality. Ecosystems and binary size differ. Intelligence does not.
- **Our week:** [simple vs plan](/blog/simple-vs-plan-when-to-use-which/) both belong in the toolkit; [observation masking](/blog/host-reclaim-plan-mode-ab-lessons/) can cut spend and still lose the RCA.
- **Adopt:** MCP, durable notes, tool-result clearing, compaction before rot, lean tools, traces + outcome scorecards.
- **Avoid:** autonomy theater, context stuffing, role-tax crews, language rewrites as a quality plan.
- **Build:** clone public OSS by ideology (LangGraph / DeepAgents / Mastra / trpc-agent-go / MCP SDKs). Tables below.

### Explain like I'm five

Giving the detective a different language to speak does not find the leak. Giving them a clean desk, the right tools, and a notebook does.

---

## Industry news that actually mattered

### 1. Context engineering ate prompt engineering

LangChain’s [context engineering for agents](https://www.langchain.com/blog/context-engineering-for-agents) framing is still the cleanest summary of what serious teams do:

| Op | Plain English |
|----|---------------|
| **Write** | Park facts outside the window (scratchpad, notes, memory) |
| **Select** | Pull only what this step needs (RAG, JIT reads, tool search) |
| **Compress** | Summarize or trim so the window stays useful |
| **Isolate** | Split work so one seat is not polluted (subagents that return summaries) |

Anthropic’s older [building effective agents](https://www.anthropic.com/engineering/building-effective-agents) note still holds in 2026 commentary: start simple, prefer workflows when the path is predictable, treat tools as carefully as prompts. Frameworks help until they hide the loop you need to debug.

Provider-side helpers are catching up to the same playbook. Claude’s agent stack now talks openly about **memory tools**, **tool-result clearing**, and **server-side compaction**. Those are the same three levers production teams were hand-rolling last year. They are API features. They are not Python features.

### 2. Deep harnesses, not “more agents”

The “deep agent” pattern (plan tool + filesystem/spill + subagents + compaction) is real for long jobs. It is also easy to overfit.

Field guidance this summer is blunt: classify the workload. Sub-minute single-domain turns stay on a lean ReAct loop. Multi-minute research or coding work earns the harness. Role-heavy crews that re-send a persona every turn often buy a [token tax](/blog/agent-orchestration-tax-evals/) without buying quality.

Multi-agent failures are often **context fragmentation**, not weak orchestration. Shared governed context + contract-first handoffs beat “add another specialist.”

### 3. Framework surveys, same moral

Comparisons like [Langfuse’s agent framework survey](https://langfuse.com/blog/2025-03-19-ai-agent-comparison) list LangGraph, DeepAgents, Pydantic AI, Mastra, Claude/OpenAI agent SDKs, and friends. Useful as a menu. Useless as a personality test.

There is no single best framework. There is a best fit for control needs, language, and how much loop you want to own. Steal primitives. Do not worship brands.

### 4. Language is ops, not IQ

Go vs Python write-ups keep proving the same split: Python wins notebook velocity and ML-library gravity; Go wins concurrent session density and deploy shape. None of that rewrites the model’s brain.

If someone tells you “Python agents are far better,” ask what changed: model, tools, context assembly, or just the README language. Three of those move quality. One of them moves LinkedIn comments.

---

## What we learned in our own lab this week

### Simple and plan both stay

On a small AppWorld smoke, [plan did not always win](/blog/simple-vs-plan-when-to-use-which/). Sometimes it tied. Sometimes it earned the quality headroom. It always cost more wall time and more total prompt.

Monday rule we are keeping: **route by errand shape**, not by fashion. Shallow hops default simple. Collect→classify→mutate and packed-tool workers earn plan. Log peak **and** sum tokens so the coordinator gauge cannot lie.

### Cheaper context is not the RCA bar

We A/B’d host-side **observation masking** (tool-result clearing after durable notes) on a plan-style investigate. Clearing fired. Spend dropped. The cause got worse.

That post is the full scorecard: [Observation Masking Cut Token Cost, Then Lost the RCA](/blog/host-reclaim-plan-mode-ab-lessons/). The lesson travels beyond our stack:

1. Clear events must fire (informative).
2. Outcome checklist must hold (sufficient).
3. Measure tool-family mix, not just call count.
4. Isolate the lever. Do not silently turn on summarize mid-A/B.
5. Lab compression ceilings are not live investigate multipliers.

**Result quality beats token savings for investigate agents.** Save tokens after you can still name the broken hop.

That is context engineering with teeth: compress without poisoning the case file.

---

## Adopt this week

1. **Draw the loop.** Workflow vs ReAct vs deep harness: pick by task shape, then eval.
2. **Treat the window as a product.** Write notes. Select JIT. Compress before rot. Isolate noisy digs.
3. **Lean the tool surface.** Overlapping tools confuse models. MCP stays the delivery layer.
4. **Offload before you shrink.** Durable note first; clear or compact second.
5. **Ship scorecards.** Wall time, tokens, and *whether the cause survived*, together.
6. **Contract-first handoffs.** Subagents return verifiable summaries, not novels.

## Avoid this week

1. **Unnecessary agency.** LLM deciding what a router already knows.
2. **Front-loading** every doc and tool every turn.
3. **Role theater.** A crew of personas for a one-hop errand.
4. **Compacting after rot.** Summaries inherit confusion.
5. **Framework opacity.** If you cannot see prompts and tool results, you cannot debug.
6. **Language rewrites as a quality strategy.** Change the context system instead.

---

## Is context engineering language-specific?

No.

The discipline is information architecture. The helpers differ by library and model provider. You can do excellent context engineering in Go and terrible context engineering in the trendiest Python graph framework. The reverse is also true.

What is portable:

- Skill and system text
- MCP tool contracts
- Spill / note / clear / compact policies
- Outcome evals

What is local:

- Which SDK exposes compaction hooks first
- How cheap concurrent sessions are to run
- How fast your team ships experiments

Build the portable layer hard. Rent the local helpers.

---

## Repos to clone this week (public OSS)

Steal the ideology from code, not from slides. Below are **public** GitHub repos worth checking out, grouped by the pattern they teach. Pick one per language you ship in. Stars move; the *why* does not.

### Workflows and explicit graphs

| Lang | Repo | Why checkout |
|------|------|--------------|
| **Python** | [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | The reference for stateful graphs, checkpoints, HITL interrupts, and durable resume. Read this when you want the control Anthropic calls “workflows.” |
| **TypeScript** | [langchain-ai/langgraphjs](https://github.com/langchain-ai/langgraphjs) | Same graph ideas in JS/TS. Useful when your product already lives in Node and you want LangGraph-shaped control without a Python sidecar. |
| **Go** | [trpc-group/trpc-agent-go](https://github.com/trpc-group/trpc-agent-go) | GraphAgent + runners + MCP in a Go-native stack. Closest “LangGraph for Go” if you care about service-shaped concurrency and single-binary deploy. |

### Deep harness (plan + spill + subagents)

| Lang | Repo | Why checkout |
|------|------|--------------|
| **Python** | [langchain-ai/deepagents](https://github.com/langchain-ai/deepagents) | Batteries on top of LangGraph: planning, filesystem offload, subagents. The open-source shape of “deep” long-horizon work. |
| **Python / TypeScript** | [anthropics/claude-agent-sdk-python](https://github.com/anthropics/claude-agent-sdk-python) · [anthropics/claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript) | The Claude Code harness as a library: compaction, permissions, subagents, MCP. Study how a production loop manages context, not just how it calls tools. |
| **Go** | [google/adk-go](https://github.com/google/adk-go) | Google’s Agent Development Kit in Go: workflow runtime, sessions, multi-agent patterns without forcing Python. Pair with [google/adk-python](https://github.com/google/adk-python) if you want the fuller examples. |

### Lean ReAct / typed single agents

| Lang | Repo | Why checkout |
|------|------|--------------|
| **Python** | [pydantic/pydantic-ai](https://github.com/pydantic/pydantic-ai) | Type-safe agents and tools with validation as a first-class citizen. Best “simple ReAct with contracts” starting point in Python. |
| **Python** | [huggingface/smolagents](https://github.com/huggingface/smolagents) | Minimal code-first agents. Good for learning the loop without drowning in orchestration. |
| **Python / TypeScript** | [openai/openai-agents-python](https://github.com/openai/openai-agents-python) · [openai/openai-agents-js](https://github.com/openai/openai-agents-js) | Small primitives: agent, tools, handoffs, sessions, guardrails. Provider-friendly and easy to read end-to-end. |
| **TypeScript** | [vercel/ai](https://github.com/vercel/ai) | Streaming + UI + agent loop helpers for product teams. Reach for this when the agent is a feature inside a Next.js app, not a separate control plane. |
| **Go** | [cloudwego/eino](https://github.com/cloudwego/eino) | CloudWeGo’s Go agent/orchestration toolkit. Another public Go path if you want to compare designs next to trpc-agent-go. |

### Multi-agent / role crews (use carefully)

| Lang | Repo | Why checkout |
|------|------|--------------|
| **Python** | [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) | Fastest path to role-based crews. Worth reading so you understand the token tax of personas, and when Flows keep autonomy inside a workflow. |
| **TypeScript** | [mastra-ai/mastra](https://github.com/mastra-ai/mastra) | TS-native agents + graph workflows + memory + evals in one package. Best “batteries included” TypeScript start without porting Python mental models. |

### Tool plane and context delivery (MCP)

| Lang | Repo | Why checkout |
|------|------|--------------|
| **Spec + servers** | [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | Reference MCP servers. Start here to see how tools and resources are exposed as a standard. |
| **Python** | [modelcontextprotocol/python-sdk](https://github.com/modelcontextprotocol/python-sdk) | Official Python MCP SDK. |
| **TypeScript** | [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) | Official TS MCP SDK. |
| **Go** | [modelcontextprotocol/go-sdk](https://github.com/modelcontextprotocol/go-sdk) · [mark3labs/mcp-go](https://github.com/mark3labs/mcp-go) | Official Go MCP SDK plus a widely used community Go MCP library. Checkout both if you build Go tool servers. |

### Suggested learning path

1. **Day 1:** Clone one lean ReAct repo in your language (`pydantic-ai`, `vercel/ai`, or `eino` / `trpc-agent-go`). Run a single tool loop.
2. **Day 2:** Add MCP with the matching language SDK. One tool, one resource, one log of what entered the window.
3. **Day 3:** Read LangGraph (or GraphAgent examples in trpc-agent-go) for write/select/compress/isolate on a real state object.
4. **Day 4:** Only then open DeepAgents or the Claude Agent SDK. Steal the harness pieces you need; do not copy the whole religion.

Stars are popularity, not fitness. Prefer the repo that matches the ideology you need this week.

---

## Monday-morning checklist

1. Name the ideology for each product surface: workflow, ReAct, or deep harness.
2. Add a token + tool-family trace to the next investigate eval.
3. Prefer offload-then-clear over “summarize everything.”
4. Keep both simple and plan (or equivalent) behind a router. Do not crown a religion.
5. Ask one hostile question in review: *did we make the agent smarter, or just louder?*
6. Clone one public repo from the tables above in the language you ship. Run a one-tool loop before you design a crew.

---

## Related reading

- [Observation masking A/B](/blog/host-reclaim-plan-mode-ab-lessons/)
- [Simple vs plan](/blog/simple-vs-plan-when-to-use-which/)
- [Agent orchestration tax](/blog/agent-orchestration-tax-evals/)
- [Claim-aware evidence packing](/blog/claim-aware-evidence-packing/)
- [Go vs Python for AI agents](/blog/why-go/)
- [Prompt caching for agents](/blog/prompt-caching-ai-agents/)

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/). They are the engineers behind the agent runtime and platform this series describes.

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports, check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

---
layout: post
title: "Weekly Reflection: Context Engineering Beat the Language Wars"
date: 2026-08-30 11:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 55
description: "Weekly reflection: context engineering over language wars, plus public libraries and servers for write/select/compress/isolate with multi-language or MCP clients."
last_modified_at: 2026-08-30 12:00:00 -0700
image: /assets/images/og-default.png
tags: [ai-agents, context-engineering, weekly-reflection, industry, orchestration, sre, evaluation, tokenomics, memory, mcp, aiden]
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
  - question: "Which libraries or servers help with context engineering and support multiple client languages?"
    answer: "For memory write/select: Mem0 (Python + TypeScript + MCP) or Hindsight (Python + NPM + MCP). For temporal entity graphs: Graphiti with its MCP server (Zep cloud adds Python/TypeScript/Go). For window compress: provider clear/compact APIs in any language client. For prove-it: Langfuse traces and RAGAS-style evals. Prefer tools with a few clear verbs or MCP so your host language does not matter."
---

This week, a recurring question was whether moving our agents to Python or TypeScript would make them better investigators. A language change could improve access to libraries or speed of prototyping, but it would not by itself change which incident evidence the model sees.

This reflection separates three choices: **context engineering** (what information enters the model's limited window at each step), orchestration (how the work is sequenced), and implementation language (how the service is built and operated). Our investigation A/B gives a concrete reason to keep them separate: reducing context cost also reduced the evidence gathered. This is a set of observations and places to look next, not a universal architecture recipe.

---

## Where I landed this week

- **Pick orchestration by task.** A fixed workflow suits a known path; a ReAct loop (reason, act with a tool, observe, repeat) suits a short open-ended task; longer work may justify a planning and offload harness. Compare outcomes before adopting the extra machinery.
- **Manage the context window deliberately.** Write useful findings outside it, select what this step needs, compress older material, and isolate noisy work. Each operation can also lose evidence if used carelessly.
- **Language affects delivery, not a model's reasoning directly.** Holding model, tools, and context fixed is a useful comparison, though different SDKs may make those inputs easier or harder to implement.
- **Our week:** [simple vs plan](/blog/simple-vs-plan-when-to-use-which/) both have uses; [observation masking](/blog/host-reclaim-plan-mode-ab-lessons/) cut spend but failed the root-cause analysis (RCA) quality gate.
- **Places to start:** The public repositories and context tools below offer examples, not a required stack. Trace cost and tool use alongside outcome quality.

---

## Ideas from the ecosystem worth testing

### 1. Context is more than the system prompt

LangChain's [context engineering for agents](https://www.langchain.com/blog/context-engineering-for-agents) offers a useful four-operation vocabulary:

| Op | Plain English |
|----|---------------|
| **Write** | Save findings outside the model's active window, such as in notes or a scratchpad |
| **Select** | Retrieve what this step needs, for example through retrieval-augmented generation (RAG), just-in-time reads, or tool search |
| **Compress** | Summarize or trim older material to make room, after preserving what must survive |
| **Isolate** | Give a separate worker a noisy subtask and bring back a bounded result |

Anthropic's [building effective agents](https://www.anthropic.com/engineering/building-effective-agents) makes a complementary case for starting with the simplest workable design and defining tool interfaces carefully. A framework helps when it exposes state and decisions; it hinders debugging when it hides them.

Provider APIs such as Claude's memory tools, tool-result clearing, and server-side compaction offer ways to implement these operations. Clearing removes older tool responses from active context; compaction reduces the transcript. Neither is a Python-only idea, and neither guarantees that important evidence survives.

### 2. Deep harnesses, not “more agents”

A "deep" harness combines a plan, a place to spill large results, optional subagents, and context compaction. That can help a long research or coding task when a single loop runs out of room. For a short, single-domain query, each planning or handoff step adds latency and tokens; our [orchestration tax evaluation](/blog/agent-orchestration-tax-evals/) is a reason to measure that overhead rather than assume more roles improve quality.

A handoff is useful when the next worker receives the specific findings and open questions it needs. Otherwise, splitting work can fragment the context: one worker finds the key log line and the next never sees it. Prefer an explicit handoff contract to a list of specialist personas.

### 3. Framework surveys, same moral

[Langfuse's agent framework survey](https://langfuse.com/blog/2025-03-19-ai-agent-comparison) lists LangGraph, DeepAgents, Pydantic AI, Mastra, and the Claude/OpenAI agent SDKs. It is a useful menu of state, tool, and tracing patterns, not a ranking for every workload. Compare what you need to control and inspect before choosing a runtime.

### 4. Language is ops, not IQ

Python offers fast experimentation and a broad machine-learning ecosystem. Go may suit a service team that values concurrency and a straightforward deployment artifact. Those are consequential engineering tradeoffs; they are not evidence that an agent will reach a better answer merely by moving languages. When comparing two implementations, first check whether the model, tool interfaces, context assembly, and evaluation task are actually the same.

---

## What we learned in our own lab this week

### Simple and plan both stay

In a small AppWorld smoke test, [plan did not always beat simple](/blog/simple-vs-plan-when-to-use-which/). It sometimes tied and sometimes made room for a better answer, while taking more wall time and more total prompt tokens in that test. A short tool lookup may not need a plan; a collect→classify→mutate task or a worker handling many tools may. We will route by task shape and record both peak context size and summed tokens across steps, since a coordinator's context gauge alone can miss the total cost.

### Cheaper context is not the RCA bar

We A/B’d host-side **observation masking** (tool-result clearing after durable notes) on a plan-style investigate. Clearing fired. Spend dropped. The cause got worse.

The [observation-masking A/B](/blog/host-reclaim-plan-mode-ab-lessons/) has the full scorecard. In that run, ON was about **43%** cheaper but scored **5** against OFF's **6** on an equal-evidence checklist. The procedure is more reusable than that single cost figure:

1. Clear events must fire (informative).
2. Outcome checklist must hold (sufficient).
3. Measure tool-family mix, not just call count.
4. Isolate the lever. Do not silently turn on summarize mid-A/B.
5. Lab compression ceilings are not live investigate multipliers.

For an investigation, cost savings are useful only if the evidence still supports a defensible conclusion. A note can be readable yet omit the query that would have identified the broken connection.

---

## Practices to try—and their limits

1. **Choose the loop by task.** Start with a fixed workflow when steps are known; test a ReAct loop or a planning harness where the path is open-ended.
2. **Budget the window.** Save notes, retrieve only what is needed, and compress before context fills up. Verify that a later step can recover the finding, not merely read a note.
3. **Keep tools distinguishable.** Overlapping tool descriptions can make selection harder. Model Context Protocol (MCP) can expose tools across host languages, but does not make their contracts good by itself.
4. **Offload before shrinking.** Persist findings before clearing or compacting old results; retain a way to inspect original evidence.
5. **Pair traces with an outcome check.** Wall time and tokens matter, but so does whether the RCA can identify the cause.
6. **Specify handoffs.** Ask a subagent for bounded findings, sources, and unresolved questions rather than a free-form narrative.

Avoid using a model for routing decisions a deterministic rule already handles, loading every document on every turn, or rewriting the runtime language as a substitute for improving context and evaluation. If your framework obscures prompts and tool results, make those visible before adding more layers.

---

## Is context engineering language-specific?

No.

The underlying problem is information architecture: what to retain, retrieve, and show at each step. Libraries and model providers expose different hooks. A Go implementation can do this well, and a Python graph can do it poorly, or vice versa.

What is portable:

- Skill and system text
- MCP tool contracts
- Spill / note / clear / compact policies
- Outcome evals

What is local:

- Which SDK exposes compaction hooks first
- How cheap concurrent sessions are to run
- How fast your team ships experiments

Keep tool contracts and outcome checks portable where practical; choose SDK-specific conveniences based on the service you operate.

---

## Repos to clone this week (public OSS)

These **public** repositories show different implementation patterns. The tables are starting points for reading code, not endorsements of every dependency or a suggestion to migrate an existing service. Pick one that matches a problem you have and check its current APIs and maintenance status.

### Workflows and explicit graphs

| Lang | Repo | Why checkout |
|------|------|--------------|
| **Python** | [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | An example of stateful graphs, checkpoints, human-in-the-loop (HITL) interrupts, and durable resume. Useful when the workflow needs explicit state transitions. |
| **TypeScript** | [langchain-ai/langgraphjs](https://github.com/langchain-ai/langgraphjs) | Same graph ideas in JS/TS. Useful when your product already lives in Node and you want LangGraph-shaped control without a Python sidecar. |
| **Go** | [trpc-group/trpc-agent-go](https://github.com/trpc-group/trpc-agent-go) | GraphAgent + runners + MCP in a Go-native stack. A Go-native graph and runner design to compare if service deployment and concurrency are priorities. |

### Deep harness (plan + spill + subagents)

| Lang | Repo | Why checkout |
|------|------|--------------|
| **Python** | [langchain-ai/deepagents](https://github.com/langchain-ai/deepagents) | Batteries on top of LangGraph: planning, filesystem offload, subagents. The open-source shape of “deep” long-horizon work. |
| **Python / TypeScript** | [anthropics/claude-agent-sdk-python](https://github.com/anthropics/claude-agent-sdk-python) · [anthropics/claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript) | The Claude Code harness as a library: compaction, permissions, subagents, MCP. Study how a production loop manages context, not just how it calls tools. |
| **Go** | [google/adk-go](https://github.com/google/adk-go) | Google’s Agent Development Kit in Go: workflow runtime, sessions, multi-agent patterns without forcing Python. Pair with [google/adk-python](https://github.com/google/adk-python) if you want the fuller examples. |

### Lean ReAct / typed single agents

| Lang | Repo | Why checkout |
|------|------|--------------|
| **Python** | [pydantic/pydantic-ai](https://github.com/pydantic/pydantic-ai) | Type-safe agents and tools with validation as a first-class citizen. A starting point for a typed single-agent loop in Python. |
| **Python** | [huggingface/smolagents](https://github.com/huggingface/smolagents) | Minimal code-first agents. A compact example for examining tool calls and the agent loop. |
| **Python / TypeScript** | [openai/openai-agents-python](https://github.com/openai/openai-agents-python) · [openai/openai-agents-js](https://github.com/openai/openai-agents-js) | Small primitives: agent, tools, handoffs, sessions, guardrails. Provider-friendly and easy to read end-to-end. |
| **TypeScript** | [vercel/ai](https://github.com/vercel/ai) | Streaming + UI + agent loop helpers for product teams. Reach for this when the agent is a feature inside a Next.js app, not a separate control plane. |
| **Go** | [cloudwego/eino](https://github.com/cloudwego/eino) | CloudWeGo’s Go agent/orchestration toolkit. Another public Go path if you want to compare designs next to trpc-agent-go. |

### Multi-agent / role crews (use carefully)

| Lang | Repo | Why checkout |
|------|------|--------------|
| **Python** | [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) | An example of role-based crews and Flows; compare the extra prompts and handoffs with a single-agent baseline. |
| **TypeScript** | [mastra-ai/mastra](https://github.com/mastra-ai/mastra) | TS-native agents + graph workflows + memory + evals in one package. A TypeScript example combining agents, workflows, memory, and evaluation. |

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
4. **Day 4:** Compare DeepAgents or the Claude Agent SDK with your one-tool loop. Add only the planning, offload, or permission mechanisms your task needs.

Stars measure attention, not fit. Prefer a repository whose state model, tool contracts, and deployment assumptions match the problem you are testing.

---

## Libraries and servers for context engineering

Frameworks provide the loop; the tools below help assemble its context window. The selection criteria here are a clear API, a public open-source core, and access from more than one client language (or through MCP). Check licensing, deployment requirements, and current client support before adoption.

### How to judge a CE tool

1. Can you explain the API in one sentence with a few verbs?
2. Can a non-Python service call it (native SDK or MCP)?
3. Can you self-host the core without a cloud-only lock-in?
4. Do docs show write/select/compress against a real token budget?

A session cleaner built for one interactive host may still be useful there, but it is a weaker fit for a multi-host service until it demonstrates stable contracts and recoverability.

### Write and select (memory)

| Tool | Mental model | Clients / access | Why checkout |
|------|--------------|------------------|--------------|
| [mem0ai/mem0](https://github.com/mem0ai/mem0) (+ [mem0-mcp](https://github.com/mem0ai/mem0-mcp) OpenMemory) | `add` / `search` / `get_all` | Python + TypeScript; MCP for Cursor, Claude, and other hosts | A memory layer for keeping retrievable facts outside the chat transcript; test whether retrieval returns the right fact. |
| [vectorize-io/hindsight](https://github.com/vectorize-io/hindsight) | **retain / recall / reflect** | Python + NPM clients; Docker server; MCP | Learning-oriented memory server with a three-verb API that is easy to teach a team. |
| [getzep/graphiti](https://github.com/getzep/graphiti) (+ in-repo MCP server) | Temporal knowledge graph: entities + facts with validity windows | Python library + MCP tools; Zep cloud SDKs for Python, TypeScript, and Go | When “what was true when” matters more than a flat vector recall. |
| [langchain-ai/langmem](https://github.com/langchain-ai/langmem) | Manage/search memory tools on LangGraph store | Python (LangGraph-native) | Use when you already live in LangGraph and want hot-path memory tools without a new service. |

**Scope note:** Letta is a full stateful runtime rather than a drop-in memory library. Cognee's ingest-to-graph path is Python-centered; non-Python agents may need a REST or MCP boundary.

### Compress and isolate (active window)

| Tool | Mental model | Clients / access | Why checkout |
|------|--------------|------------------|--------------|
| Provider context APIs (Claude memory tool, tool-result clearing, server compaction) | Clear re-fetchable payloads; compact the transcript; note durable facts | HTTP clients / official SDKs | Compare provider clearing and compaction before building a custom summarizer, and test recovery of evidence. See Anthropic’s [context engineering cookbook](https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools). |
| [langchain-ai/deepagents](https://github.com/langchain-ai/deepagents) | Offload bulky results to a filesystem, then summarize; isolate work in subagents | Python (patterns travel) | An open example of offload-before-summarize and context isolation; the pattern can be applied in another runtime. |
| MCP resources + spill/note stores | Pointer in-window, payload out-of-window | Any MCP client language | Durable note first, then a smaller active window; check that the pointer can retrieve the source. |

### Select backends and prove-it tooling

| Tool | Role | Clients / access |
|------|------|------------------|
| [qdrant/qdrant](https://github.com/qdrant/qdrant) | Vector retrieval backend | Go server; Python / TypeScript / Go / Rust clients |
| [chroma-core/chroma](https://github.com/chroma-core/chroma) | Vector retrieval option for local development | Multi-language clients |
| [lancedb/lancedb](https://github.com/lancedb/lancedb) | Embedded vector/table select | Multi-language clients |
| [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | Reference MCP tool/resource servers | MCP-compatible hosts |
| [langfuse/langfuse](https://github.com/langfuse/langfuse) | Trace tokens and context growth per turn; pair traces with outcome evaluation | Multi-language SDKs / OpenTelemetry |
| [vibrantlabsai/ragas](https://github.com/vibrantlabsai/ragas) (RAGAS) | Evaluate retrieval and generation against a task-specific dataset | Python |

### Decision cheat sheet

| You need… | Start here |
|-----------|------------|
| A memory service reachable from several host languages | **Mem0** or **Hindsight** (consider MCP if the host is Cursor/Claude) |
| Entity relationships and “true when” | **Graphiti** (+ MCP); Zep cloud if you want managed Py/TS/Go SDKs |
| Already on LangGraph | **LangMem** |
| Large tool responses filling the active window | Test provider **clear/compact** with a recovery check; study DeepAgents for offload and isolation |
| Evidence that context changes helped | **Langfuse** traces plus an outcome scorecard (RAGAS or a task-specific rubric) |

A practical distinction is Mem0 for a bolt-on memory store, Graphiti/Zep when relationships need time validity, and LangMem when you already use LangGraph. MCP can reduce coupling to a single client SDK, though you still need to evaluate the server. For another survey, see [Atlan's context-engineering tools guide](https://atlan.com/know/context-engineering/context-engineering-tools-for-ai-agents/) and comparisons of Mem0, Zep, LangMem, and Hindsight.

---

## Monday-morning checklist

1. Name the ideology for each product surface: workflow, ReAct, or deep harness.
2. Add a token + tool-family trace to the next investigate eval.
3. Prefer offload-then-clear over “summarize everything.”
4. Keep simple and plan (or equivalent) available behind a router until outcome tests support removing one.
5. Ask in review: *what evidence shows that this change improved the outcome, not just the trace or transcript?*
6. Run a one-tool loop from a public repository in the language you ship before adding more workers.
7. If memory is the bottleneck, test one tool from the cheat sheet (Mem0, Hindsight, or Graphiti). Validate write and retrieval against an actual task before tuning compression.

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

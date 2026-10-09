---
layout: post
title: "LLM Tokenomics for Production Agents — Context Budgets as an Operating Model"
date: 2026-07-09 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 17
description: "LLM tokenomics for production agents: token budget strategies, context compression, and FinOps loops that keep sessions finishing."
image: /assets/images/og-tokenomics.png
tags: [llm, finops, ai-agents, context-window, production, aiden]
faqs:
  - question: "What is LLM tokenomics for production agents?"
    answer: "An operating model for context budgets, tool-response compression, and FinOps loops — not just picking a cheaper model."
  - question: "Why doesn't switching to a smaller model fix agent cost?"
    answer: "Sessions often die from context exhaustion after huge tool payloads, not from reasoning cost. Smaller models help greetings; they do not fix wall-of-JSON tool returns."
  - question: "What should you balance in a token operating model?"
    answer: "Keep context budget, tool compression, and session completion in balance so triage finishes instead of dying mid-investigation."
---

Finance asked us to reduce large language model (LLM) spend. Routing simple greetings to a smaller model helped with those calls, but it did not address an incident investigation that exhausted its context window—the amount of text a model can handle in one request—after a large log-query result.

That failure reframed the problem. For [production incident agents](/topics/ai-agents-sre/), **tokenomics** means managing the volume and cost of text sent to models while preserving enough evidence to finish a task. We track three competing outcomes:

- **Finish rate** — sessions complete the task instead of hitting context limits
- **Signal fidelity** — compression does not hide the smoking gun
- **Unit economics** — cost per *successful* workflow, not per chat message

We split the work across the **agent runtime** (middleware, session memory, routing) and **Aiden** (ingress, workflows, operator visibility). Neither layer alone is enough. This post describes our architecture and its gaps; it does not claim a measured industry-wide optimum.

---

## Four Tiers of Context

In our longer sessions, replaying verbatim history (tier 2) crowded out compact digests (tier 3) and archived data fetched only when needed (tier 4). The tiers are a design model, not a universal storage standard.

| Tier | What lives here | Typical mistake |
|------|-----------------|-----------------|
| **1 — Active task** | Current goal, open tool args, policy pins | Over-injecting workspace docs every turn |
| **2 — Recent turns** | Last few user/model exchanges | Replaying full tool payloads forever |
| **3 — Rolling summaries** | Observation registers, stage digests, episodic notes | One lossy mega-summary that forgets specifics |
| **4 — Archive** | Full traces, attachments, audit — retrieved selectively | Either never archived, or never retrievable |

Data should flow **into** the model from the right tier — not all tiers at full fidelity every turn:

```
  [Tier 4: Archive]           --> selective fetch on demand --+
  [Tier 3: Rolling summaries] --> continuous compaction ------+--> [ LLM turn ]
  [Tier 2: Recent turns]      --> verbatim sliding window -----+
  [Tier 1: Active task]       --> hard-pinned instructions ----+
```

Several published approaches use related techniques. [Prosus ARC](https://medium.com/prosus-ai-tech-blog/context-compression-for-production-ai-agents-d6cc34bd3358) replaces a single condensation pass with a structured rolling summary plus optional retrieval when the summary is not enough. [Maxim's context-engineering guide](https://www.getmaxim.ai/articles/context-engineering-for-ai-agents-production-optimization-strategies/) argues for proactive compaction before you hit the wall, not after the API returns a context-length error. The cited [long-horizon agent research](https://arxiv.org/html/2606.10209v1) reports that pruning whole tool call/response pairs and summarizing what was removed can improve task success while reducing tokens in its studied setting; that result is not a measurement of our incident workload.

We were already building toward tiers 3 and 4 in places. We had not named the model clearly enough for operators.

---

## Layered Defenses — What We Ship

Think of tokenomics as **defense in depth**: ingress caps, tool middleware, session memory, workflow budgets, then cost attribution feeding back into tuning. Each layer is cheap compared to letting a runaway loop bill you for another frontier-model turn.

```
  ingress caps  -->  tool middleware  -->  session memory  -->  workflow budgets
        ^                                                              |
        |                                                              v
  operator tuning  <--  cost attribution  <---------------------------
```

### Tool boundary compression (and why Go fits)

A broad log request can return far more data than the next model turn can accommodate. Returning the entire payload also makes it harder to find the incident signal.

We shape tool output **before** it enters the model's working memory — not "hope the model ignores the noise." In production, every tool call runs through a **composable middleware chain** in Go: the tool executes first; shaping runs on the **return path**. Cheap byte work happens on the hot path; an LLM summarizer is invoked only when mechanical cuts are not enough. That ordering matters when you are processing large JSON blobs on every integration response.

Illustrative shape — one link in a longer chain, not production source:

```go
// Post-tool response shaping — illustrative middleware only.
type summarizeFunc func(ctx context.Context, text string) (string, error)

func responseShapingMiddleware(summarize summarizeFunc) func(next Handler) Handler {
	return func(next Handler) Handler {
		return func(ctx context.Context, call ToolCall) (any, error) {
			output, err := next(ctx, call) // run the integration first
			if err != nil {
				return nil, err
			}

			raw, ok := asText(output)
			if !ok {
				return output, nil
			}

			shaped := stripKnownNoise(raw)
			if withinBudget(shaped) {
				return shaped, nil
			}

			// Score chunks locally against terms from call.Args — no model call here.
			shaped = keepRelevantChunks(shaped, call.Args)
			if withinBudget(shaped) {
				return shaped, nil
			}

			// Summarize last. Exact content-hash hits are rare on live logs (timestamps drift);
			// upstream semantic memoization and stripping volatile fields improve hit rate.
			summary, err := summarize(ctx, shaped)
			if err != nil {
				return shaped, nil // prefer partial signal over failing the tool
			}
			return capForContext(summary), nil
		}
	}
}
```

Our production chain includes audit, semantic cache, and loop detection. Return-path shaping is one important place to reduce model input, though the impact varies by integration. The snippet above is the pedagogical core, not a copy of our wiring diagram.

The tiered pattern in plain language:

1. **Structural stripping** — drop known noise fields, binary blobs, repeated array elements
2. **Relevance-based chunking** — score chunks against terms in the tool call arguments; return the best slices **without** another LLM call when possible
3. **Summarization** — when the payload is still too large and thematic understanding matters, compress with a dedicated summarizer profile; cache when payloads repeat, but do not expect byte-identical log dumps to hit often
4. **Hard ceiling** — nothing above a maximum string size enters context, period

The design tension is **lossy compression with intent preservation**. Blind truncation is worse than bloat — you cut the one line that explains the outage. We preserve identifiers **mechanically** (trace IDs, commit SHAs, error codes) and let summarization handle the surrounding narrative. That mirrors what [Thomson Reuters Labs observed in proactive compression work](https://medium.com/tr-labs-ml-engineering-blog/keeping-the-lights-on-proactive-context-compression-for-pydanticai-agents-6ee3e4e84f6d): arbitrary string chopping breaks agent reasoning, but structural, hierarchical summarization keeps the lights on when you still need an LLM in the loop.

Operators still get the full payload in audit and replay; the model sees a shaped view. That split matters for postmortems — see [observability for agents](/blog/observability/) and [defense in depth for tool calls](/blog/defense-in-depth/).

### Session memory and compaction

Long investigations do not fit in verbatim history. We use [Pensieve-style session compaction](/blog/pensieve-memory/) (rolling-window compression when context utilization gets high) — older tool results shrink or roll into summaries while protected turns stay intact. Sub-agents receive **request-scoped** context, not the entire orchestrator tree. Prior-turn reasoning tokens can be discarded once a turn completes; the facts that matter should live in structured state, not in re-read prose.

For chat follow-ups, we compact prior user prompts and maintain a small **observation register** (a short digest of recent tool work) so the agent can answer "what did we learn from Datadog?" without replaying every API response.

### Duplicate-work prevention

Avoiding redundant calls saves tokens. Semantic memoization—reusing a recent result for a tool call with equivalent intent and arguments—can skip re-execution when the data is still fresh. Loop detection stops identical tool streaks before they become a doom spiral. Circuit breakers and rate limits are reliability tools first — but stopping a runaway loop also reduces cloud spend. FinOps here means attributing operational cost to the work that caused it.

### Workflow and ingress budgets

On the Aiden side, we handle governance **before** a runaway tool loop starts:

- **Spawn contracts:** Hard caps on LLM rounds and tool iterations propagated to sub-agents per workflow stage. Planning stays tight; investigation gets more room, but still bounded.
- **Evidence-gated orchestration:** [Fixed workflow graphs with structural gates](/blog/evidence-gated-multiplane-rca/) instead of unbounded ReAct loops — fluency was masking skipped work *and* inflating token burn.
- **Attachment gates:** Large files get an inline preview; full documents route to retrieval instead of being re-inlined every turn.
- **Gather-once triage:** [Parallel context collection, then narrate](/blog/ai-incident-triage-sre/) — same discipline for chat: stop stuffing the same attachment after a few turns.
- **Stratified audit sampling:** On offline paths (diary, execution grading), errors and warnings are prioritized; the prompt includes an explicit "sampled N of M" so the model knows visibility is bounded.
- **Heuristic shortcuts:** Digest-based grading and LLM-free draft planners where a full model pass is overkill.

### Model routing by task type

Not every call needs your best model. Classification, salutations, and simple lookups route to an **efficiency** profile. Bulk compression routes to a **summarizer** profile tuned for long inputs. The orchestrator can short-circuit obvious cases before spinning up a full reasoning tree — a pattern we describe in [why we split runtime from platform](/blog/aiden-platform/).

### The FinOps loop

Session totals can obscure which component spent the tokens. One triage session might include cheap classification, one massive log summarization, three verification retries, and a reasoning model only for the final paragraph. Charge it all to "triage" and nobody fixes the summarization middleware — and Finance cannot forecast whether next month's margin holds.

We attribute tokens and cost at **tool boundaries** — parent tool identity in telemetry, like distributed tracing for LLM spend. That turns optimization into a conversation both engineering and finance can act on: which integration blew the budget, which middleware avoided a repeat model call, which workflow stage needs a tighter spawn contract. We therefore review cost per successful run alongside monthly spend; a cheap failed run is not useful savings.

That pairs with middleware instrumentation: did cache hit avoid a model call? did shaping reduce the next turn? did the circuit breaker stop a retry storm? The vocabulary for what to measure is in [LLM performance metrics](/blog/web-metrics-to-llm-metrics/). Per-trace summaries and agent USD budgets give operators a stop signal; historical cost bands on workflows set expectations before a run starts.

---

## Roadmap: What We Are Stealing and What Is Still Missing

These are patterns we are considering or partly using, not commitments or benchmarked improvements.

| Pattern | Status | Notes |
|---------|--------|-------|
| **Structured summary + selective retrieval** ([ARC](https://medium.com/prosus-ai-tech-blog/context-compression-for-production-ai-agents-d6cc34bd3358)) | Partial | Extends observation registers and RAG; still need an ARC-style "fetch turn N from archive" tool for long threads |
| **Proactive compaction at high utilization** | Partial | Session compaction exists; operator-facing compression metrics on every chat path are thin |
| **Recency pruning of whole tool pairs** ([arxiv](https://arxiv.org/html/2606.10209v1)) | Adopting | Better than chopping tokens mid-string inside one tool response |
| **Governance pinning** | Partial | Safety rules must never be evicted during compaction — see [the HITL paradox](/blog/hitl-paradox/) |
| **Map-reduce for huge offline prompts** | Gap | Diary and batch paths can still choke on very large days despite sampling |
| **Full-document workflow import without chunking** | Gap | Heuristic draft planners exist; LLM compose path does not yet chunk |
| **Expectations → runtime** | Gap | Historical cost bands are visible but do not auto-tighten spawn budgets |
| **Provider prompt caching** | Gap | App-layer workspace reuse only; no model KV cache blocks yet |
| **Graduated degradation** | Gap | Budgets stop spend at the limit but do not progressively tighten context as spend rises |

---

## Operator Playbook

A short checklist that does not require reading our config:

1. **Enable tool shaping middleware** — tune per integration category after incidents, not once globally
2. **Set spawn budgets per workflow stage** — planning tight, investigation moderate, publish/narrate bounded
3. **Route classification and summarization to cheaper task profiles** — reserve frontier models for synthesis
4. **Use retrieval for large docs** — stop re-inlining attachments after the first few turns
5. **Attribute spend at tool boundaries** — fix the expensive loop, not the whole product
6. **Watch compression ratio and recovery rate** — how often agents re-fetch because a summary was lossy

---

## Risks to check during rollout

**Truncating without an archive.** If operators cannot replay what the model saw, postmortems become arguments.

**Summarizing away identifiers.** A generic summarizer treats a commit SHA like prose — it may truncate, round, or hallucinate trailing characters. For our incident workflows we pin such identifiers through regex or structured parsing; let the model summarize everything *around* the identifiers, not instead of them.

**Session totals as the only metric.** The expensive tool hides inside an otherwise cheap session.

**One global context policy.** Log tools, metrics APIs, and ticket systems need different shaping strategies.

**Compaction that evicts policy.** Safety rules must be pinned, not summarized away with chat history.

---

## Operating tradeoffs

1. **Tokenomics is context engineering plus FinOps**, not a model dropdown.
2. **Cheap cuts before expensive summarization** — relevance chunking and stripping beat another LLM call per tool.
3. **Shape the model's view; keep the full dump for humans** — compression is working memory, not evidence destruction.
4. **Workflow bounds beat hope** — spawn budgets and fixed graphs prevent both skipped work and token swarms.
5. **Measure at tool boundaries** — attribution turns optimization from "use Haiku" into "fix this integration pipeline."

---

## Related reading

- [Prompt caching for AI agents is an architecture problem](/blog/prompt-caching-ai-agents/) — make stable context reusable across turns
- [You Can't Debug What You Can't See — Observability for AI Agents](/blog/observability/) — see token burn before the session dies
- [Why One JSON Repair Pass Isn't Enough](/blog/json-repair-layers/) — tool-call reliability at the boundary
- More on [AI agents for SRE](/topics/ai-agents-sre/) · full [series](/series/enterprise-ai-agents-go/)

---


*How does your team balance finish rate, fidelity, and unit economics? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> We build incident-triage agents at StackGen; the SRE offering is at [ai.stackgen.com](https://ai.stackgen.com).

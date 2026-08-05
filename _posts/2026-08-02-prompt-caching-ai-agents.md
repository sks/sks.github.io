---
layout: post
title: "Prompt Caching for AI Agents Is an Architecture Problem"
date: 2026-08-02 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 30
description: "Prompt caching for AI agents fails when context is turbulent — stable prefixes, early compaction, isolated helpers, and references beat payload copies."
image: /assets/images/og-tokenomics.png
tags: [ai-agents, prompt-caching, llm, tokenomics, context-management, aiden, production]
permalink: /blog/prompt-caching-ai-agents/
---

**Prompt caching for AI agents** looked like a provider setting. We enabled it and expected the token bill to improve — repeated turns that re-send the same context should have been both cheaper and faster.

The cache existed. The agent kept missing it.

The problem was not the provider. It was the shape of the conversation. Tool definitions moved around. Large observations were copied into later turns. Small utility prompts inherited an entire investigation. Context grew until emergency compaction rewrote the prefix.

Every request looked new because, structurally, it was new.

**Prompt caching for AI agents is not a switch. It is an architecture constraint.**

---

## Why Chat Caching Advice Breaks for Agents

For a simple chat application, the reusable prefix is easy to imagine:

- system instructions,
- a stable conversation,
- one new user turn.

Agents are different. A single task can add tool schemas, tool results, delegated work, notes, retries, summaries, and governance messages. The context is not only longer; it changes shape more often.

Provider caches generally reward a stable prefix. Agent runtimes often produce a turbulent prefix.

That is why a healthy cache strategy starts before the API call. You have to control how the runtime builds context.

---

## Stability Beats Cleverness

The first requirement is boring: deterministic ordering.

If the same tools appear in a different order on each turn, the shared prefix changes even when the capabilities are identical. If instructions are assembled from maps or registries without a stable order, logically equivalent prompts become different byte sequences.

Stable ordering does not make the agent smarter. It makes repeated work recognizable.

The same applies to instruction blocks. Put stable policy and persona material before volatile session content. Avoid rebuilding a semantically identical prefix with cosmetic differences.

Prompt caching rewards predictability. Agent architecture often celebrates dynamism. Production systems need to know where each one belongs.

---

## Pass References, Not Copies

Agent context balloons when every layer repeats the same evidence.

A worker stores an observation. The coordinator copies it into a note. A later worker receives both the observation and the note. The final synthesizer receives all of it again.

Nothing new was learned, but the prompt pays for the same fact repeatedly.

A better pattern is to let durable working memory hold the full value and pass a compact reference through later turns. The model can retrieve the detail when needed instead of carrying every payload forever.

Illustrative shape — carry a pointer, not the payload:

```json
{"evidence_ref": "obs-42"}          // later turns pass this
{"text": "…5,000 words of logs…"}  // instead of re-sending this
```

This has three benefits:

- less context duplication,
- a more stable prompt prefix,
- and clearer provenance for where a fact came from.

References are not free. If retrieval is unreliable, the model may lose access to necessary evidence. Important facts still need a protected path into synthesis. The goal is not “replace everything with pointers.” It is “stop copying large values by default.”

This is the same discipline behind [memory compaction for long-running agents](/blog/pensieve-memory/): preserve meaning, not transcript volume.

---

## Compact Before the Context Is on Fire

Late compaction is expensive.

By the time the prompt approaches its limit, the runtime has already paid to carry oversized history across several turns. Emergency summarization also changes a large portion of the prefix at once, which can wipe out cache reuse.

Earlier, gradual compaction is less dramatic:

- shrink old tool payloads after their facts are recorded,
- keep recent decisions and unresolved questions visible,
- preserve evidence needed for final claims,
- and remove conversational scaffolding that no longer changes the outcome.

The right moment is not one universal percentage. Different tasks have different evidence density. A short code review and a multi-system incident investigation should not compact on the same schedule.

What matters is making compaction an operating policy, not a last-second rescue.

---

## Isolate One-Shot Utility Calls

This was the most surprising source of waste.

Agent runtimes make many small model calls that are not part of the user conversation:

- score whether a memory matters,
- summarize a payload,
- check whether an answer is grounded,
- reflect on a failed attempt,
- classify a short piece of text.

If those calls inherit the full conversation, a tiny classification request can replay an entire investigation. It may also inherit unfinished tool-call state that has nothing to do with the utility task.

The fix is a boundary: one-shot work gets the minimum context it needs in an isolated request. It should not silently join the main session just because both operations use the same model client.

Isolation improves:

- cost,
- cacheability,
- correctness,
- and audit clarity.

It also forces an important design question: what inputs does this helper actually require? “The whole session” is often an accidental answer.

---

## Budgets Must Survive Delegation

A coordinator can have a careful context budget and still lose control when delegated workers ignore it.

Explicit limits need to remain explicit across the task tree. A child agent should not silently expand a small investigative budget into a much larger default. Output summaries should be the normal return path, with full detail available through references when the coordinator needs it.

This is not only about cost. Smaller delegated outputs reduce the amount of volatile text inserted into the parent’s next prompt, which keeps more of the prefix reusable.

[Tokenomics for production agents](/blog/maintaining-tokenomics-with-aiden/) is therefore inseparable from orchestration. The budget is a property of the whole run, not just the top-level model call.

---

## What to Measure

A cache dashboard without context-shape signals tells only half the story.

Watch for:

- repeated calls with unexpectedly low cache reuse,
- prompt growth between turns that learned nothing new,
- large payloads copied across multiple roles,
- utility calls with investigation-sized inputs,
- major prefix churn after compaction,
- and delegated work that returns far more text than the parent needs.

Cost is the lagging signal. Context shape is the cause.

Pair provider usage data with [agent-level observability](/blog/observability/) so you can attribute misses to a stage, helper, or tool boundary instead of blaming the model vendor.

---

## Trade-Offs and Blind Spots

Cache-friendly does not mean frozen.

- Fresh policy must override cache reuse.
- Revoked access cannot remain embedded in a convenient prefix.
- New evidence must be visible even when it changes the prompt.
- Summaries can omit a detail that later becomes important.
- Stable ordering must not become a hidden priority rule for the model.

Correctness and governance come first. The aim is to make **unchanged** context stable, not to stop context from changing.

---

## Lessons Learned

1. **Prompt caching starts in context construction.** Provider settings cannot repair a turbulent prefix.
2. **Deterministic ordering matters.** Equivalent toolsets should look equivalent across turns.
3. **References beat repeated payloads.** Keep full evidence available without carrying every copy.
4. **Compact before crisis.** Gradual context hygiene costs less than emergency rewriting.
5. **Isolate utility work.** A small helper call should not replay the user’s whole investigation.
6. **Carry budgets through delegation.** Child work can destroy parent-level savings.

The cheapest prompt is not merely the shortest one. It is the one whose unchanged parts the system can recognize and reuse.

---

## Related reading

- [LLM tokenomics for production agents](/blog/maintaining-tokenomics-with-aiden/)
- [Pensieve memory — agents that forget intelligently](/blog/pensieve-memory/)
- [Observability for AI agents](/blog/observability/)
- [Go vs Python for AI agents](/blog/why-go/)

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

*Are your prompt-cache misses a provider problem, or a context-shape problem? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

---
layout: post
title: "Be Creative. Don't Invent."
date: 2026-07-27 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 27
description: "When an AI SRE agent hits a dead end during incident response, creativity means searching harder — not hallucinating rule IDs, metrics, or a tidy root cause analysis."
image: /assets/images/og-evidence-rca.png
tags: [ai-agents, sre, root-cause-analysis, incident-response, on-call, prompt-engineering, aiden, production, llm-hallucination]
permalink: /blog/be-creative-do-not-invent/
---

We had an AI SRE investigation that looked incredibly busy—and still completely failed.

The alert was real. The agent widened scopes, stitched context across fragmented tools, and wrote a highly confident story. But under the hood, it had **made things up**: a rule ID that never existed, a metric family nobody scraped, and a “lead” pulled from exporter noise simply because the real symptom never materialized. 

In AI-driven incident response, models often deliver "confident wrong answers" when they lose the scent. Creativity is fine. Invention is a critical bug.

---

## The One-Liner

**Be creative. Do not invent.**

| Creative (The Goal) | Invent (The Bug) |
| --- | --- |
| Retry the ID copied directly from the alert page | Slug a brand new ID derived from the title |
| Discover series after an empty PromQL query | Guess a counter from an unrelated, past incident |
| Widen labels strictly from what the alert carried | Paste tokens from an entirely unrelated playbook |
| Call exporter warnings "pipeline noise" | Promote them to "Theory" because *something* had to be wrong |
| Close with *undetermined* and suggest next probes | Close with a tidy, fabricated mechanism you never reproduced |

Creativity = search, widen, and recover using **evidence already anchored in the prompt, RAG retrieval, or tool results**.  
Invention = filling gaps with plausible defaults hallucinated from memory.

This exact pattern showed up twice in one week: once inventing failure counters when PromQL returned `No data`, and once inventing alert forensics when the rule load failed. They were different forks in the logic, but the exact same epistemic shortcut.

---

## Why Soft “Don’t Guess” Prompts Never Stick

We already preach curiosity and build strict evidence gates for root cause analysis. But large language models (LLMs) still invent under uncertainty—especially when the context window is hungry and the narrative desperately wants a villain. 

We realized that simply adding another `FORBIDDEN` paragraph to the system prompt for every new hallucination failure mode doesn't work. True LLM grounding requires structural boundaries in your agent platform. 

So, we enforce one strict rule, applied precisely at the forks that actually hurt: metric IDs, queries, control plane health, log widen tokens, and how the agent closes when a symptom cannot be reproduced. 

> **Honest undetermined beats a fluent fiction.**

Human responders will readily forgive an AI agent that sets an explicit checkpoint to say, "We don't know yet, but here is what to probe next." However, they will immediately revoke access and mute agents that hallucinate keys and waste time during an active outage. In enterprise AI platforms, trust is built on verifiable telemetry, not just plausible answers.

---

## Related

- [Curiosity before confidence](/blog/curiosity-before-confidence/)
- [Hypothesis ladder](/blog/hypothesis-ladder/)
- [Evidence-gated RCA](/blog/evidence-gated-multiplane-rca/)
- [Evidence discarded after the lead](/blog/evidence-discarded/)

---


*Does your AI agent dig harder when stuck in incident response — or invent the missing piece? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft grounded RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

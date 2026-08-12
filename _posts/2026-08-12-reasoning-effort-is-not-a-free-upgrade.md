---
layout: post
title: "Reasoning Effort Is Not a Free Upgrade for Tool-Heavy Agents"
date: 2026-08-12 12:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 42
description: "Live A/Bs on SRE triage: blanket high reasoning effort timed out, low finished, adaptive low→high dug deeper — and still needed budgets, model routing, and completion contracts."
image: /assets/images/og-default.png
tags: [ai-agents, sre, reasoning, multi-agent, orchestration, incident-response, openai, golang, aiden]
permalink: /blog/reasoning-effort-is-not-a-free-upgrade/
faqs:
  - question: "Does higher reasoning effort make SRE agents better?"
    answer: "Not automatically. On tool-heavy triage, higher effort can burn wall-clock budget on slower turns and extra exploration, so the agent never reaches the completion gate."
  - question: "What is adaptive reasoning effort for multi-agent triage?"
    answer: "Give collectors a cheap thinking budget and reserve expensive reasoning for one synthesis pass after evidence exists — instead of one global setting for every delegated dig."
  - question: "Why do some new models reject tools plus reasoning on Chat Completions?"
    answer: "Several current OpenAI models only allow function tools with non-none reasoning on the Responses API. Chat Completions returns an error unless you drop reasoning or change transport."
  - question: "What still breaks after effort dials work?"
    answer: "Fan-out spawn counts, missing completion tools on the synthesis agent, parent-only tools delegated to children, and uncredited child gate receipts can still prevent a clean close."
---

Providers keep shipping a new dial: **reasoning effort**. The marketing story is simple — turn it up and the model thinks harder.

We ran that story against a real [SRE triage](/topics/ai-incident-triage/) job: same alert class, same observability tools, same wall-clock ceiling. The lesson was not “high is smarter.” It was **effort is a scarce budget that competes with tool turns**, and **where you spend it matters more than the global knob**.

This post stands alone. You do not need the rest of the series. It covers three live shapes — blanket high, blanket low, adaptive low→high — plus what broke when we removed the known alert schema and forced discovery.

---

## TL;DR

- On a tool-heavy API-gateway error-rate dig, **blanket low finished**; **blanket high hit the wall clock** without a usable Summary or completion gate.
- Letting the parent set effort **per child** worked: collectors got low, synthesis got high — and dug deeper than blanket low.
- Adaptive still timed out: **spawn fan-out** and a **missing gate tool on the synthesizer** beat the dial.
- Newer models often refuse **tools + non-none reasoning** on Chat Completions; until Responses API is wired, you need a **hybrid model mix** or you pay for failed requests.
- In unknown waters, discovery and negative evidence worked — but **correlated ≠ drain-the-cluster**, and child completion receipts must count for the parent.

### Explain like I'm five

Giving every worker a PhD-length think session sounds wise. If the fire drill has a timer, the deep thinkers never finish writing the report. Give scouts short think time, give the final storyteller more, and make sure someone still hits the “done” button.

---

## The job

We used a fixed **API gateway high error-rate** card against a live Grafana/Loki plane: collect locus and shape, falsify tempting dependencies, then close with Theory / Unknowns / Do-this-now behind a completion gate.

That is deliberately **tool-heavy**. Most of the wall clock is PromQL/LogQL and repair loops, not essay writing. If reasoning effort only made prose prettier, we would have wasted the A/B. We wanted to know whether the dial helped **finish the method**.

---

## Blanket high vs blanket low

Same model family that still accepts tools plus effort on Chat Completions. Same temperature rules that family requires. Same wall-clock ceiling. Only the global reasoning dial changed.

| Shape | Finished under the ceiling? | Completion gate | Rough feel |
| --- | --- | --- | --- |
| **High everywhere** | No — hit the wall | Never called | More exploration turns, slower LLM hops, empty close |
| **Low everywhere** | Yes | Called with a correlated theory | Cleaner Collect → close; usable operator Summary |

**What low got right**

- Named a concrete cluster / host / namespace locus
- Described a step-change error-rate cliff that matched the alert timing
- Stayed honest that mechanism was **correlated**, not proven causal
- Proposed next checks instead of inventing a root cause

**What high did instead**

- Burned the budget on broader search and command loops
- Never reached the gate or operator Summary
- Looked busy; delivered almost nothing an on-call could act on

**Finding 1.** For tool-heavy triage, **higher effort is not a free quality upgrade**. It taxes every model turn. If your product is latency-bounded assist, that tax can erase the dig.

**Finding 2.** Tool strategy shifted with effort. Low preferred focused observability queries and closed. High preferred broader exploration and never synthesized. The dial changed *how* the agent spent time, not just how carefully it wrote.

Related: [single-agent vs multi-agent](/blog/single-agent-vs-multi-agent/) — architecture taxes show up the same way. Effort is another tax.

---

## Adaptive: low collectors, high synthesis

Global knobs are blunt. The better product question is: **can the parent choose effort per delegated dig?**

We taught the orchestrator a portable effort field on child spawn: cheap for bounded evidence collection, expensive for competing-hypothesis synthesis. Omission keeps the model’s configured default. Bad values should **fail soft** (warn and fall back), not abort the whole investigation because the LLM invented `"turbo"`.

On the same alert class, the parent actually toggled:

| Child role | Effort chosen |
| --- | --- |
| Rule / window / locus / shape / differentials / recovery collectors | low |
| Mechanism synthesis | high |

**What improved vs blanket low**

- Stronger validation that the ratio cliff was a real 5xx increase, not a denominator artifact
- Concrete gateway status codes in logs (not just a red metric)
- A telemetry confounder: unfiltered request totals disagreed with status-labelled totals — the kind of thing that steals an afternoon if you miss it

**What still failed**

- The parent spawned too many collectors in parallel, then a recovery agent, then high synthesis — effort selection did not cap fan-out
- The synthesis child sometimes lacked the **completion gate tool**, so there was no receipt to close on
- Redaction placeholders on trusted alert ids made rule-scoped digs thrash even while metric/log digs continued

**Finding 3.** Per-child effort dials are real and useful. They are **not** a substitute for spawn budgets, tool allowlists, and completion contracts ([is the task actually done?](/blog/is-the-task-actually-done/)).

---

## Model routing is part of the dial

While probing newer models for the adaptive config, we hit a sharp platform edge:

- Some current models reject **function tools + non-none reasoning** on `/v1/chat/completions`
- They want the **Responses** API for that combination
- Our agent runtime’s OpenAI path is still Chat Completions today (this is an industry-wide gap in several Go agent frameworks, not a one-off)

So the practical mix became:

| Role | Safe shape today |
| --- | --- |
| Parent / summarizer | Newest capable model with reasoning **off** (or none) when tools are in play |
| Tool-bearing collectors / synthesis | Slightly older sibling that still accepts tools + low/high on Chat Completions |
| Planning fallback | Same tool-friendly sibling when the newer model refuses |

**Finding 4.** “Turn reasoning up on the newest model” can be a **400**, not a quality win. Until Responses support lands, treat model choice and effort as a **joint** routing problem — or force none whenever tools are attached ([prompt caching](/blog/prompt-caching-ai-agents/) and tokenomics posts rhyme here: the cheap path is the one that actually runs).

---

## Unknown waters: discovery without a card

We then removed the crutches: no alert UID, no metric name, no label schema, no named failing dependency. The agent had to learn the telemetry vocabulary and change strategy after no-data.

**What went well**

- Connectivity checks before inventing an alert identity
- Label discovery: one aggregation dimension worked; another returned empty and was abandoned
- Widening search after no-data instead of cosmetic query thrash
- Keeping **negative evidence** (healthy auth / API / DB paths) instead of clinging to a favorite villain
- Closing with a **correlated** theory and terminal avenues — uncertainty survived synthesis

**What still hurt**

- The parent tried to delegate a **parent-only** tool; repair loops burned retries
- One high-effort synthesis hop went through the wrong model lane and paid for a Chat Completions rejection before fallback
- A child accepted the gate, but the parent’s completion contract did not fully credit that receipt — orchestration kept chewing wall clock after useful close text existed
- First-draft remediation overreached: a newly appearing cluster target looked like a rollout. It can also be **telemetry onboarding**. Correlated is not permission to drain production traffic

We tightened the prompt afterward: treat new targets as both hypotheses, require a read-only segmented check before change talk, and mark traffic moves as human authority until a causal split appears ([curiosity before confidence](/blog/curiosity-before-confidence/), [be creative — do not invent](/blog/be-creative-do-not-invent/)).

**Finding 5.** Adaptive effort helps unknown waters only if **discovery discipline** and **authority boundaries** travel with it. Otherwise you get a smarter-sounding wrong action.

---

## The principle

**Spend thinking budget where it changes the decision — and meter everything else.**

| Put low / none here | Put high here | Never confuse with effort |
| --- | --- | --- |
| Bounded metric/log collection | Competing mechanisms, confounders, synthesis | Spawn count, wall clock, Max tool/LLM calls |
| Parent coordination on tool-hostile models | One bounded synthesis pass after evidence exists | Completion gate ownership |
| Retries and repair | Causal claims that need careful language | Permission to change production |

Or shorter: **effort is not IQ. It is a schedule.**

---

## Builder checklist

- [ ] Global high effort is not the default for tool-heavy on-call assist  
- [ ] Parents can set effort **per child**; invalid values fail soft  
- [ ] Collectors are cheap; **one** synthesis pass is expensive  
- [ ] Spawn fan-out and per-child timeouts are capped independently of effort  
- [ ] Synthesis owns the completion gate tool — and child receipts count for the parent  
- [ ] Parent-only tools cannot be delegated  
- [ ] Model routing knows which lanes accept tools + reasoning (Chat Completions vs Responses)  
- [ ] Correlated findings cannot recommend production traffic changes without human authority  
- [ ] New entities are both “change” and “telemetry artifact” until split  

Shareable cousins: [evidence-gated RCA checklist](/checklists/evidence-gated-rca/) · [agent done checklist](/checklists/agent-done/).

---

## Where to go next

- [Single-agent vs multi-agent orchestration](/blog/single-agent-vs-multi-agent/) — another tax that looks like quality  
- [Is the task actually done?](/blog/is-the-task-actually-done/) — gates that are not prose  
- [Evidence-gated multiplane RCA](/blog/evidence-gated-multiplane-rca/) — when deeper digs earn their keep  
- [Maintaining tokenomics with Aiden](/blog/maintaining-tokenomics-with-aiden/) — budgets as product  
- Hubs: [AI agents for SRE](/topics/ai-agents-sre/) · [AI agent workflows](/topics/ai-agent-workflows/) · [AI incident triage](/topics/ai-incident-triage/)

Turning the thinking dial to eleven feels productive. On a timer, the agents that finish are the ones that **saved the expensive turns for the argument that needed them**.

---

*Debating where to spend reasoning budget in on-call agents? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

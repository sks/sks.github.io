---
layout: post
title: "When Your AI Agent Scorecard Lies"
date: 2026-07-19 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 24
description: "A production lesson in agent observability: measure telemetry quality before trusting reliability, correctness, cost, or latency scores."
image: /assets/images/og-observability.png
tags: [observability, ai-agents, telemetry, evaluation, sre, production, langfuse]
permalink: /blog/when-agent-observability-lies/
---

We built a health scorecard for our AI agents. It returned a confident grade.

The grade was wrong.

Not because the arithmetic was broken. Not because the agents suddenly became worse. The scorecard was faithfully summarizing the wrong population of traces — mostly background model work with thin session context, sparse token metadata, and no quality evaluation. Missing evidence was being treated as real performance.

For a moment, that false confidence almost won. A near-perfect reliability number sat next to a collapsed correctness score, and the instinctive reaction was to argue about the agents: promote the “healthy” fleet, or spend a weekend hunting a phantom regression. The real failure was upstream. We were about to trust a dashboard that had scored the wrong work.

That incident changed how I think about AI observability:

> **Before you measure agent quality, measure the quality of the telemetry describing the agent.**

This is a sequel to [You Can't Debug What You Can't See](/blog/observability/) — same obsession with production visibility, one layer up: what happens when the scorecard itself becomes the bug.

---

## The Failure: Correct Math, Wrong Dataset

The scorecard produced a strange combination:

| Dimension | Scorecard said |
| --- | --- |
| Reliability | Excellent |
| Correctness | Terrible |
| Efficiency | Terrible |
| Latency | Acceptable |

Each conclusion was defensible from the rows it received. That was the trap. The rows mostly represented helper activity — summarization, formatting, safety checks — rather than complete user-facing agent runs. A trace without a session could not reveal retries across the session. A trace without model and token data could not support an efficiency score. A trace without an evaluator score could not prove correctness or incorrectness.

The first mistake was treating all traces as interchangeable.

An AI platform is full of model work that looks similar on a span list: user-facing sessions, workflow stages, tool calls, retrieval, routing, background helpers. They all burn tokens. They do not answer the same operational question. Mix them into one fleet score and the largest category wins. Volume becomes truth.

---

## Missing Data Is Not a Passing Grade

Traditional monitoring often treats the absence of errors as success. That assumption is dangerous for agents.

Imagine a reliability report trying to detect retry storms. If most traces have no session identity, the report cannot know whether five calls belong to five healthy sessions or one agent stuck repeating itself.

“No retries detected” is not the same as “no retries occurred.”

The honest result is:

> **Retry health unknown because session coverage is insufficient.**

The same rule applies across the scorecard:

| Missing telemetry | What you cannot honestly conclude |
| --- | --- |
| Session identity | Retry rate, loops, or session reliability |
| Model and token usage | Cost or token efficiency |
| Quality evaluations | Correctness |
| Workflow-stage identity | Which procedure failed |
| Evidence provenance | Whether a conclusion is grounded |

Every score should carry a **coverage statement**. If coverage falls below what the dimension requires, cap the claim, lower confidence, or refuse to score it. A blank instrument panel is not evidence that the engine is healthy.

Once we stopped congratulating ourselves for empty panels, the next question was obvious: what does a usable agent span actually need to carry?

---

## Identity Is the Backbone of Agent Telemetry

Distributed tracing taught us to connect service calls with trace and span identifiers. Agents need more semantic identity because their failures happen across conversations and procedures, not only network hops.

At minimum, a production agent trace should answer:

- Which session did this work belong to?
- Which agent performed it?
- Which workflow was running?
- Which stage was active?
- Which model handled the generation?
- Was this user-facing work or internal helper work?
- What execution did this stage contribute to?

The exact field names matter less than consistency. Identity should propagate from the workflow into model calls, tools, retrieval, and downstream services. Without that envelope, you can inspect isolated spans but cannot reconstruct intent.

The difference is easiest to see side by side. A naked span gives you latency and tokens in isolation:

```json
{
  "span": "llm_generate",
  "duration_ms": 1200,
  "tokens": 450
}
```

A contextual span answers *which work* those numbers belong to:

```json
{
  "span": "llm_generate",
  "trace_id": "req-987",
  "session_id": "sess-456",
  "workflow_stage": "intent_classification",
  "workload_class": "helper",
  "duration_ms": 1200,
  "tokens": 450
}
```

Same generation. Different operational meaning. Only the second one belongs in a scorecard denominator — and only in the right one.

Research such as [AgentTrace](https://arxiv.org/abs/2602.10133) frames the same problem as three connected surfaces: **cognitive** (model interactions and decisions), **operational** (workflow steps, retries, outcomes), and **contextual** (tools, APIs, retrieval, environment). The useful idea is not adopting another tracing product. It is keeping those surfaces causally linked under one execution identity, so a model call, a stage outcome, and a tool failure can be read as one story instead of three dashboards.

Identity alone was not enough. We still had to stop pretending every model call was an agent outcome.

---

## Classify Work Before Scoring It

The fastest correction was conceptual.

We now treat traces as different workload classes:

- **Persona work** — the agent acting toward a user or workflow goal.
- **Procedure work** — a stage executing a defined responsibility.
- **Context work** — tools and retrieval that ground the decision.
- **Helper work** — summarization, formatting, classification, or safety support.

A single user request usually fans into all four. Persona work owns the goal. Procedure work advances the workflow. Context work grounds the decision. Helper work cleans, formats, or guards. Helper work is still observable — it can fail, become slow, or waste tokens — but it belongs in a helper-health view, not in the denominator for user-facing correctness.

That distinction prevents two opposite errors: high-volume helper traffic making a fleet look healthier than it is, and unevaluated helper traffic making correctness and efficiency look worse than they are.

Classification should happen when telemetry is emitted, not through fragile name matching months later. At span start, stamp a workload class into the logger or tracer context and let every child span inherit it. Retroactive parsing of span names is how scorecards slowly drift back into fiction.

Once work was classified, another gap showed up: even well-identified traces did not automatically create a useful handoff between stages.

---

## A Workflow Stage Needs a Contract

Traces show how execution moved. They do not automatically create state the next stage can trust.

In a multi-stage agent workflow, the next stage should not have to reread an entire conversation to discover what the previous stage learned. Humans reviewing an incident should not have to do that either.

Each stage needs a small, structured outcome contract: identity and status, the finding or decision, evidence references, confidence and known blind spots, and the next-stage handoff. For an investigation, that might mean one stage records normalized incident context, another records evidence-backed findings, and a later stage records the final verdict. The exact schema is domain-specific; the principle is not.

> **Free-form prose is presentation. Structured stage output is state.**

Persist both. The prose helps operators. The structured record makes workflows queryable, testable, and scorable — which is the only way a scorecard can grade a procedure instead of grading a vibes-shaped paragraph.

That lesson connects directly to [evidence-gated RCA](/blog/evidence-gated-multiplane-rca/) and the [hypothesis ladder](/blog/hypothesis-ladder/): claims without checkable state are theater.

---

## Provenance Beats a Polished Explanation

[Research on execution provenance](https://arxiv.org/abs/2606.04990) reinforces a lesson SRE teams already know: evaluating only the final answer is insufficient.

An agent can produce a plausible RCA while querying the wrong service, ignoring a failed tool call, reusing stale memory, inventing a causal bridge, or skipping the procedure entirely. The evaluation has to inspect the path: which evidence was retrieved, which tool result supports each claim, what alternatives were ruled out, which signal plane was unavailable, and whether the stage followed its procedure.

This does **not** require storing private hidden reasoning or exposing raw chain-of-thought. Capture observable decisions, tool actions, evidence references, and structured conclusions. That gives operators accountability without turning sensitive model internals into a data-retention problem.

Which brings us back to the collapsed correctness score on that first dashboard. It was not proof the agents were broken. It was proof we had almost no evaluations attached to the traces we were scoring.

---

## Correctness Requires an Evaluator

One of the most important scorecard rules is also the least satisfying:

> **No evaluation data means correctness is unknown, not zero.**

Model and tool telemetry can reveal loops, errors, latency, and cost. They cannot independently prove that an answer is correct.

Correctness needs an evaluator appropriate to the task: deterministic checks for structured outputs, evidence-grounding checks for investigations, policy compliance for governed actions, human review for ambiguous outcomes, or a carefully bounded model-based judge. The evaluator should score the execution record as well as the final response. A polished answer produced through a broken process should not receive full credit.

Frameworks such as [IntellAgent](https://arxiv.org/abs/2501.11067) point the same way: graph-shaped conversational behavior needs fine-grained diagnostics, not one static answer score.

By this point the shape of the fix was clear — identity, classification, contracts, provenance, evaluators. There was still one more temptation: pretending we could observe every layer of the stack.

---

## Observe the Stack, but Do Not Pretend You Own All of It

A recent [multi-layer survey of AI observability](https://arxiv.org/abs/2604.26152) describes monitoring from model internals and confidence calibration through behavioral monitoring, operational intelligence, and infrastructure tracing. That taxonomy is useful because it clarifies ownership.

An enterprise agent platform can reasonably own behavioral monitoring, workflow and tool provenance, operational scorecards, and application and infrastructure correlation. It usually cannot see proprietary model activations or GPU-kernel behavior from a hosted model provider. Pretending otherwise produces dashboards full of guesses.

The practical goal is not “observe everything.” It is: know which layer each signal belongs to, connect the layers you can observe, state which layers are blind, and keep confidence within that evidence boundary.

So the final rule is the one we should have started with.

---

## The Scorecard Should Grade Itself First

Before calculating agent health, a scorecard should publish its own data-quality report:

- What share of traces belong to the intended workload?
- How many have session and stage identity?
- How many include model and usage data?
- How many have quality evaluations?
- Was the requested time window fully harvested?
- Which integrations or signal planes were unavailable?

Only then should it produce reliability, correctness, performance, and efficiency results.

If data collection is incomplete, fail loudly. A partial report labeled “complete” is worse than no report because it creates false confidence — the same false confidence that almost sent us chasing the wrong problem.

This is the observability version of validating your test harness before trusting the benchmark.

---

## A Practical Review Checklist

When an agent scorecard looks surprising, check:

1. **Population** — Confirm you are scoring user-facing runs, not whichever trace type is most common.
2. **Coverage** — Verify each dimension has the metadata it needs before you trust the number.
3. **Identity** — Group by session, agent, workflow, and stage — or refuse to score.
4. **Classification** — Separate helper traffic from persona work at emission time.
5. **Causality** — Follow model decisions into tool and environment effects under one identity.
6. **Provenance** — Require conclusions to cite executed evidence, not polished prose alone.
7. **Procedure** — Detect whether stages followed their assigned process.
8. **Evaluation** — Treat correctness as measured, inferred, or unknown — never as “missing equals zero.”
9. **Blind spots** — Name unavailable signals in the report itself.
10. **Honesty** — Stop or visibly limit the score when collection is incomplete.

---

## Lessons Learned

1. **Telemetry quality comes before agent quality.** A sophisticated rubric cannot repair a polluted dataset.

2. **Missing data is a confidence problem, not a success signal.** Unknown must remain a first-class result.

3. **Classify model work at emission time.** Persona, procedure, context, and helper traffic should not share one denominator.

4. **Stage identity makes workflows debuggable.** Session traces are necessary; stage-level grouping explains where the process broke.

5. **Structured handoffs turn traces into operational state.** Prose is for people; contracts are for the next stage and the evaluator.

6. **Correctness needs evidence or an evaluator.** Token counts and low error rates cannot tell you whether the answer was right.

7. **Scorecards need observability about themselves.** Coverage, completeness, and blind spots belong beside every grade.

The scorecard that started this post was not lying maliciously. It was doing math on a story we had never told the telemetry to carry. Fix the story first. Then trust the grade.

---

## Related reading

- [You Can't Debug What You Can't See](/blog/observability/) — the foundations of production agent tracing, costs, and audit
- [LLM Performance Metrics](/blog/web-metrics-to-llm-metrics/) — translating web-performance instincts into token-era metrics
- [Evidence-Gated Multi-Plane RCA](/blog/evidence-gated-multiplane-rca/) — why claims must not outrun their evidence
- [The Hypothesis Ladder](/blog/hypothesis-ladder/) — proving and eliminating before narrating

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

*Has an AI scorecard ever given you a precise answer to the wrong question? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

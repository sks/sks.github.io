---
layout: post
title: "When Your AI Agent Scorecard Lies"
date: 2026-07-19 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 24
description: "An AI agent scorecard can grade the wrong work; check trace identity, coverage, and evaluations before using its reliability or quality scores."
image: /assets/images/og-observability.png
tags: [observability, ai-agents, telemetry, evaluation, sre, production, langfuse]
permalink: /blog/when-agent-observability-lies/
---

We built a health scorecard for AI agents—programs that call models and tools to complete tasks. It graded the wrong work. The calculations summarized traces (records of execution steps) dominated by background model calls, not complete user-facing runs. Many records lacked a session identifier, token usage, or an evaluation of answer quality. The resulting grade described that incomplete dataset, not necessarily the agents’ performance.

A near-perfect reliability number beside a poor correctness score initially suggested a problem with the agents. First we had to ask what each number actually counted. The dashboard mixed helper calls with agent sessions and treated unevaluated work as though it had been judged.

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

Each conclusion was defensible from the rows it received. That was the trap. The rows mostly represented helper activity — summarization, formatting, safety checks — rather than complete user-facing agent runs. A trace without a session identifier could not reveal retries across the whole attempt. A trace without model and token data could not support an efficiency score. A trace without an evaluator score could not prove correctness or incorrectness.

The first mistake was treating all traces as interchangeable.

An AI platform records several kinds of work: user-facing sessions, workflow stages, tool calls, retrieval, routing, and background helpers. Model calls among them consume tokens (units of text billed or limited by a model provider). They do not answer the same operational question. Mix them into one fleet score and the largest category wins. The most frequent workload can dominate the result.

---

## Missing Data Is Not a Passing Grade

A monitoring report that finds no errors may still be missing the records needed to detect them. That matters especially when judging an agent across multiple steps.

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

Every score should carry a **coverage statement**. If coverage is insufficient for a dimension, mark it unscored or state the limits and uncertainty of the estimate. A blank instrument panel is not evidence that the engine is healthy.

Once we stopped congratulating ourselves for empty panels, the next question was obvious: what does a usable agent span actually need to carry?

---

## Identity Is the Backbone of Agent Telemetry

Distributed tracing links requests across services using trace identifiers and spans (individual recorded operations). Agent work also needs task context because a failure may span a conversation, a workflow, and several tool calls.

For session-level scoring, a trace or its linked records should answer:

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

Same generation. Different operational meaning. The second can be grouped with the right workload; neither example alone establishes whether the user’s task succeeded.

[AgentTrace](https://arxiv.org/abs/2602.10133) describes three connected views: **cognitive** (observable model interactions and decisions), **operational** (workflow steps, retries, outcomes), and **contextual** (tools, APIs, retrieved material, environment). The useful idea is not adopting another tracing product. It is linking those records under one execution identity, so a model call, a stage outcome, and a tool failure can be examined together. Linking does not on its own establish why the failure happened.

Identity alone was not enough. We still had to stop pretending every model call was an agent outcome.

---

## Classify Work Before Scoring It

The fastest correction was conceptual.

We now treat traces as different workload classes:

- **Persona work** — the agent acting toward a user or workflow goal; this is a workload label, not a separate person.
- **Procedure work** — a stage executing a defined responsibility.
- **Context work** — tools and retrieval that ground the decision.
- **Helper work** — summarization, formatting, classification, or safety support.

One user request may involve all four classes. Here, “persona” means the user-facing attempt to meet a goal; “procedure” is a workflow step; “context” is retrieved information or a tool result; and “helper” is supporting work such as formatting. Helper work can be slow or fail, but an unevaluated formatting call should not count as a failed user answer.

That distinction prevents two opposite errors: high-volume helper traffic making a fleet look healthier than it is, and unevaluated helper traffic making correctness and efficiency look worse than they are.

Classify work when the record is created: attach a workload class to the tracing context and pass it to child operations. Inferring classes later from names is brittle if naming conventions change.

Once work was classified, another gap showed up: even well-identified traces did not automatically create a useful handoff between stages.

---

## A Workflow Stage Needs a Contract

Traces show how execution moved. They do not automatically create state the next stage can trust.

In a multi-stage agent workflow, the next stage should not have to reread an entire conversation to discover what the previous stage learned. Humans reviewing an incident should not have to do that either.

Each stage needs a small, structured outcome contract: identity and status, the finding or decision, evidence references, confidence and known blind spots, and the next-stage handoff. For an investigation, that might mean one stage records normalized incident context, another records evidence-backed findings, and a later stage records the final verdict. The exact schema is domain-specific; the principle is not.

> **Keep the readable explanation and the structured stage result separately.**

Persist both. The prose helps operators. The structured record makes workflow steps queryable and testable, allowing a scorecard to check whether a procedure was followed rather than judging writing style alone.

That lesson connects directly to [evidence-gated RCA](/blog/evidence-gated-multiplane-rca/) and the [hypothesis ladder](/blog/hypothesis-ladder/): claims without checkable state are theater.

---

## Provenance Beats a Polished Explanation

[Research on execution provenance](https://arxiv.org/abs/2606.04990) reinforces a lesson SRE teams already know: evaluating only the final answer is insufficient.

An agent can produce a plausible RCA while querying the wrong service, ignoring a failed tool call, reusing stale memory, inventing a causal bridge, or skipping the procedure entirely. The evaluation has to inspect the path: which evidence was retrieved, which tool result supports each claim, what alternatives were ruled out, which signal plane was unavailable, and whether the stage followed its procedure.

This does **not** require storing private hidden reasoning or raw chain-of-thought. Record observable actions, tool outcomes, evidence references, and structured conclusions, with suitable access and retention limits. These records make claims auditable without asserting access to the model’s internal reasoning.

Which brings us back to the collapsed correctness score on that first dashboard. It was not proof the agents were broken. It was proof we had almost no evaluations attached to the traces we were scoring.

---

## Correctness Requires an Evaluator

One of the most important scorecard rules is also the least satisfying:

> **Without an evaluation, correctness for those runs is unmeasured, not zero.**

Model and tool telemetry can reveal loops, errors, latency, and cost. They cannot independently prove that an answer is correct.

Correctness needs a task-specific evaluator: exact checks for structured outputs, comparison with cited evidence for investigations, policy checks for restricted actions, or human review for ambiguous outcomes. A model-based judge may help but can also err. Evaluate the observable execution path as well as the final response when the process itself matters.

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

If collection is incomplete, label the report accordingly or withhold the affected scores. A partial report labeled “complete” can prompt decisions based on the wrong population.

This is the observability version of validating your test harness before trusting the benchmark.

![Scorecard data-quality flow from workload classification and coverage checks to qualified scoring.](/assets/images/diagrams/july-investigation/when-agent-observability-lies.svg)

*Diagram: The upper arrows classify traces and audit identity, usage, evaluation, and collection coverage before scoring; the lower path turns missing coverage into unscored or qualified dimensions rather than a passing grade.*

---

## A Practical Review Checklist

When an agent scorecard looks surprising, check:

1. **Population** — Confirm you are scoring user-facing runs, not whichever trace type is most common.
2. **Coverage** — Verify each dimension has the metadata it needs before you trust the number.
3. **Identity** — Group by session, agent, workflow, and stage — or refuse to score.
4. **Classification** — Separate helper traffic from persona work at emission time.
5. **Sequence** — Link model calls, tools, and system effects under one execution identity; the link does not by itself prove cause.
6. **Evidence origin** — Require conclusions to cite the records actually retrieved, not polished prose alone.
7. **Procedure** — Check whether stages performed required steps.
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

6. **Correctness needs task-specific evaluation.** Token counts and low tool-error rates cannot establish whether the answer was right.

7. **Scorecards need observability about themselves.** Coverage, completeness, and blind spots belong beside every grade.

The scorecard was doing arithmetic on records that lacked the identities and evaluations its claims required. After fixing those gaps, the grade can be read with its coverage statement—not as a substitute for inspecting individual failures.

---

## Related reading

- [PII redaction for AI agents](/blog/pii-redaction-ai-agents/) — preserve authorized debugging without exposing model history
- [You Can't Debug What You Can't See](/blog/observability/) — the foundations of production agent tracing, costs, and audit
- [LLM Performance Metrics](/blog/web-metrics-to-llm-metrics/) — translating web-performance instincts into token-era metrics
- [Evidence-Gated Multi-Plane RCA](/blog/evidence-gated-multiplane-rca/) — why claims must not outrun their evidence
- [The Hypothesis Ladder](/blog/hypothesis-ladder/) — proving and eliminating before narrating

---


*Has an AI scorecard ever given you a precise answer to the wrong question? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> **StackGen is building AI-assisted incident triage.** Our offering aims to help teams run diagnostics and draft RCA reports; operators should still verify consequential findings. See [ai.stackgen.com](https://ai.stackgen.com).

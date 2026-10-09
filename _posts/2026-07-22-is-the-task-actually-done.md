---
layout: post
title: "Is the Task Actually Done? — Completion Loops for Production Agents"
date: 2026-07-22 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 25
description: "Check an AI agent’s deliverable and tool outcomes before reporting a goal as complete; return unverified work explicitly when checking stops."
tags: [ai-agents, verification, llm-as-judge, production, golang, aiden, sre, budgets]
permalink: /blog/is-the-task-actually-done/
faqs:
  - question: "Why do production agents need a completion check?"
    answer: "The word done triggers human next steps. If the agent meant I tried and failed or I wrote a confident paragraph, you get a polished false alarm."
  - question: "What is a goal-scoped completion loop?"
    answer: "A separate, bounded check of the goal, deliverable, and tool outcomes before declaring completion. If that check is unavailable, the result remains unverified."
  - question: "Why is done the most expensive word an agent can say?"
    answer: "Not because of tokens, but because humans close tickets, merge changes, or sleep based on that claim."
---

When an AI agent says **“done,”** someone may close a ticket, merge a change, or stop investigating. The claim needs to mean more than “the agent called a tool.” A submission can be rejected, and a fluent report can leave a required check unfinished. Completion should be checked against the actual goal.

We changed the runtime—the software that coordinates model calls and tools—to verify completion on tasks with measurable deliverables. [External verification](/blog/evidence-based-verification/) asks whether a monitoring, deployment, or ticketing system confirms an outcome. Here the narrower question is whether the agent’s own recorded steps justify its completion claim, and what to do when checking costs time or money.

---

## What needs verification

For a measurable task, check the requested deliverable, the outcomes of required tools, and any external state that matters. A separate evaluator can examine those records, but a second model is not automatically independent evidence. Casual conversation need not pay for this additional pass. Repeated attempts also need limits on cost and safeguards against applying the same change twice.

---

## 1. What the Necessity Was

Three failure modes kept showing up in measurable work — workflow stages, investigation agents with required deliverables — while casual chat stayed fine:

**Invoked is not succeeded.** An agent could call the tool that was supposed to finish the job, get a structured rejection, and still treat the turn as complete because "the tool ran." Operators saw a finished session with an empty or failed deliverable. The distinction is straightforward: an attempted submission is not a successful deliverable.

**Self-report is circular.** Asking the same planner "are you done?" in the same context is inviting it to rationalize stopping. Fluency rises; honesty does not. A separate check can disagree, although it may share some of the planner’s blind spots.

**Retries create new risks.** An evaluator that requests another attempt can raise spending and repeat state-changing actions. Both the worker and the evaluator use model calls, and a repeated write may have a second effect.

We already knew soft prompts do not enforce curiosity — see [curiosity before confidence](/blog/curiosity-before-confidence/). Soft prompts also do not enforce completion. The runtime needed a contract: some runs may stop when the model shrugs; **goal-directed runs stop when the recorded goal is met or a limit prevents further attempts; the latter must not be labeled success.**

This sits next to [cost and completion accounting](/blog/maintaining-tokenomics-with-aiden/) and [demo-to-deploy receipts](/blog/demo-to-deploy-receipts/): a step record shows what happened; a completion check tests whether the specified goal was met within limits.

---

## 2. Options We Considered

We argued through several designs. None were free.

| Option | Appeal | Why we did not ship it as the default |
| --- | --- | --- |
| **Always verify every chat turn** | Simple mental model | Pays a second model call for "thanks" and "hello"; latency and cost explode on interactive chat |
| **Regex / "DONE" string gates** | Cheap, deterministic | Agents learn to print the magic word; brittle across languages and tools |
| **Same-turn self-critique only** | No extra architecture | Shares the planner's blind spots; classic self-grade bias |
| **Human approval on every finish** | Human judgment for consequential tasks | Routine approvals can become a queue or a rubber stamp — see [the HITL paradox](/blog/hitl-paradox/) |
| **Only external system checks** | Strong when available | Some goals are internal, such as submitting a structured deliverable; not every finish has a monitoring-system query |
| **Period spending limits alone** | Familiar cost control | Too broad for a single task: they may stop an account only after one attempt has already spent too much |
| **Uncapped evaluator retries** | More opportunities to correct a rejected answer | Spending and delay can grow without a limit |

The interesting debate was not "judge or no judge." It was **when the judge is allowed to wake up**, **what it is allowed to see**, and **how the host stops the loop without lying about success.**

---

## 3. What We Ended Up With

We shipped a **goal-scoped completion loop** in the agent runtime, activated by hosts like [Aiden](/blog/aiden-platform/) on measurable work — not on every casual turn.

**Activation is a policy.** Casual chat stays off. Goals and required-deliverable agents opt in. Operators can disable the whole capability.

**The check is separate from the planner.** A second, lower-cost evaluation pass looks at the goal and the recorded tool outcomes. It can catch a rejected submission, but a model evaluator is not an independent source of truth about external state.

**Return partial work rather than hang.** If the evaluator is unavailable or an attempt or spending limit is reached, return the best candidate with an explicit unverified status. This is not authorization to treat a write as completed.

**Budgets cover both passes.** Token and cost ceilings include the task-performing model and evaluator. The host application supplies pricing; without rates, cost ceilings cannot be enforced, though attempt limits still apply.

**State changes need a ledger.** A mutation is an action that changes state, such as scaling a service or charging a card. Mark tools read-only or mutating and track an operation identifier to prevent a retry from repeating a successful write. If a prior outcome is unknown, check the system of record before retrying; a ledger alone cannot prove what happened outside the runtime.

**Record outcomes.** Distinguish verified, rejected, budget-exhausted, and evaluator-unavailable runs so operators can separate task failures from verification failures.

Illustrative shape of the *loop* — pedagogical, not production types:

```go
// Pedagogical sketch — bounded completion loop, not a copy of our runtime.
type JudgeInput struct {
	Goal      string
	Candidate string
	// Strict tool status list: name, outcome (ok|error|denied), optional short excerpt.
	ToolStatus []ToolStatus
}

type Verdict string // "verified" | "rejected" | "unavailable"

func RunUntilDone(ctx context.Context, goal string, maxAttempts int, budget *SpendBudget) (string, error) {
	var best string
	for attempt := 0; attempt < maxAttempts; attempt++ {
		if budget != nil && budget.Exhausted() {
			return best, nil // sketch omits status return; caller must mark unverified/budget_exhausted
		}
		candidate, usage := worker.Attempt(ctx, goal, attempt)
		best = prefer(best, candidate)
		budget.Record(usage)

		verdict, judgeUsage := judge.Evaluate(ctx, JudgeInput{
			Goal:       goal,
			Candidate:  candidate,
			ToolStatus: toolLedger.Snapshot(), // successes and failures, not prose only
		})
		budget.Record(judgeUsage)

		switch verdict {
		case "verified":
			return candidate, nil
		case "unavailable":
			return best, nil // sketch omits status return; caller must mark unverified
		default: // rejected — retry with feedback, still under maxAttempts
			continue
		}
	}
	return best, nil // sketch omits status return; caller must mark unverified after attempts
}
```

**What the evaluator sees:** the original goal, the latest candidate string, and a bounded JSON-shaped list of tool execution statuses (succeeded vs failed/denied) — redacted excerpts, not the full transcript. It does **not** get raw secrets or multi-megabyte dumps. The handoff is: worker proposes → ledger records tool outcomes → evaluator checks → runtime accepts, retries, or returns an explicitly unverified candidate.

In short: propose with the planner, check within a bounded loop, and account for cost and state-changing actions in the host application.

![Goal-scoped completion loop with worker candidate, tool ledger, evaluator, and unverified fallback.](/assets/images/diagrams/july-investigation/is-the-task-actually-done.svg)

*Diagram: The arrows pass a worker candidate through recorded tool outcomes to a separate check; rejection or evaluator unavailability routes to bounded retry or an explicitly unverified result, with unknown writes checked externally before retry.*

---

## 4. Papers and Traditions We Were Inspired By

We did not invent "ask another model if the work is finished." We stole the good parts and refused the demos that ignore cost and side effects.

| Tradition | What we took | What we refused to copy blindly |
| --- | --- | --- |
| **[ReAct](https://arxiv.org/abs/2210.03629)** (Yao et al.) | Interleave reasoning and tools; "done" is not a free text label | Unbounded loops as a product feature |
| **[Reflexion](https://arxiv.org/abs/2303.11366)** (Shinn et al.) | Verbal feedback from a critique step can improve the next attempt | Treating reflection as free and always-on |
| **[Self-Refine](https://arxiv.org/abs/2303.17651)** (Madaan et al.) | Iterative improve-with-feedback is a real pattern | Same-model self-grade without an evidence seam |
| **[CRITIC](https://arxiv.org/abs/2305.11738)** (Gou et al.) | Tool-interactive critique beats pure introspection | Assuming every environment exposes perfect verifiers |
| **[LLM-as-a-Judge](https://arxiv.org/abs/2306.05685)** (Zheng et al.) | A separate evaluator can help on measurable tasks | Using judges as a substitute for systems-of-record checks |
| **[Let's Verify Step by Step](https://arxiv.org/abs/2305.20050)** (Lightman et al.) | Process-level signals beat outcome-only self-report | Importing math-benchmark process rewards wholesale into SRE |

The synthesis for enterprise agents: **critique is valuable; critique without evidence, budgets, and mutation policy is a liability.** These research patterns informed the design, but deployment adds questions about operating cost, verification gaps, and repeatable writes.

---

## Technical Details Without Spilling the Blueprint

**Separate invocation counts from success counts.** "Required tool was called" ≠ "required tool succeeded." Gate the latter when the deliverable matters.

**Evidence for judges must be redacted and bounded.** Rolling windows beat "attach the whole transcript."

**Separate spending by role.** Record tokens used by the task-performing model and by the evaluator. If billing only reports the whole session, it is hard to tell which pass to optimize.

**Observe activation rate and outcome mix.** Share of runs that request verification; verify vs reject vs exhaust budget; share of cost estimates that resolve to real prices.

**Keep casual chat cheap.** Verifying everything after one scary "done" turns the platform into a latency tax. Goal mode for goals; open chat for chat.

---

## Lessons Learned

**1. Completion is a product surface, not a prompt appendix.** If finishing wrong is costly, the runtime must own the stop condition.

**2. A separate model still needs evidence.** If it reads only the final answer, it may repeat the planner’s mistake.

**3. Return work with status.** If the evaluator cannot run, return a candidate marked unverified rather than hanging or implying completion.

**4. Retries add cost and side-effect risks.** Limit attempts and track state-changing operations.

**5. Pricing must be wired in.** A cost ceiling cannot work without model prices; attempt limits still apply when prices are unavailable.

Related: [evidence-gated RCA](/blog/evidence-gated-multiplane-rca/), [hypothesis ladder](/blog/hypothesis-ladder/), [curiosity before confidence](/blog/curiosity-before-confidence/), [tokenomics](/blog/maintaining-tokenomics-with-aiden/). Topic hubs: [AI agent workflows](/topics/ai-agent-workflows/) · [AI agents for SRE](/topics/ai-agents-sre/).

---


*Does your agent stop because the goal is met — or because it typed "done"? Picture abhi baaki hai until the checklist is. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> **StackGen is building AI-assisted incident triage.** Our offering aims to help teams run diagnostics and draft RCA reports; operators should still verify consequential findings. See [ai.stackgen.com](https://ai.stackgen.com).

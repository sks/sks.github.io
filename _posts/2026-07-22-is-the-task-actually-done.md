---
layout: post
title: "Is the Task Actually Done? — Completion Loops for Production Agents"
date: 2026-07-22 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 25
description: "Why production AI agents need an independent completion check — options we rejected, the goal-scoped loop we shipped, and the papers that shaped it."
tags: [ai-agents, verification, llm-as-judge, production, golang, aiden, sre, budgets]
permalink: /blog/is-the-task-actually-done/
---

The most expensive word an agent can say is **"done."**

Not because the tokens are costly. Because the next human action *assumes* the work finished: close the ticket, page down, merge the change, sleep. If "done" meant "I called the submit tool and it rejected me" or "I wrote a confident paragraph without finishing the checklist," you did not save an on-call engineer — you gave them a polished false alarm. It is the production version of *3 Idiots*' "**All is well**": chanting the line does not mean the exam went well.

We spent the last stretch hardening how our agent runtime decides a goal is complete. This is not the same story as [pulling proof from systems of record](/blog/evidence-based-verification/) (Datadog, Argo CD, ticket state). That post is about *external* truth. This one is about *internal* honesty: the planner thinks it finished; who is allowed to disagree — and what happens when disagreement is expensive? Bollywood already taught us the genre rule: **the interval is not the ending.** Picture abhi baaki hai.

---

## TL;DR

- **"Done" without a second opinion is self-grading.** Same model, same turn, same incentives to stop.
- **Always-on judges burn money on "hi."** Goal-scoped activation beats verifying every greeting.
- **Prose is not evidence.** Completion checks need typed tool outcomes — success vs invoked-but-failed.
- **Retries without budgets are a new outage class.** Cap attempts and spend; fail open to the best candidate when the check cannot run.
- **Retries without mutation safety are a worse outage class.** Re-running a write twice is not "thorough."

### Explain like I'm five

You finish a homework sheet and say "I'm done." A teacher who only reads your smile will stamp it. A teacher who checks the worksheet — and only stamps when the answers that matter are actually there — is annoying in the moment and correct at report-card time. Production agents need the second teacher. Not for every doodle in the margins. For the assignments that matter. Think of it as the difference between the hero declaring victory in the rain, and the editor ensuring the villain actually hit the ground.

---

## 1. What the Necessity Was

Three failure modes kept showing up in measurable work — workflow stages, investigation agents with required deliverables — while casual chat stayed fine:

**Invoked is not succeeded.** An agent could call the tool that was supposed to finish the job, get a structured rejection, and still treat the turn as complete because "the tool ran." Operators saw a finished session with an empty or failed deliverable. That is *Sholay* energy without the punchline: someone asked the famous question "**kitne aadmi the?**" (*how many men were there?*) and the system answered "we spoke to Gabbar" — not how many, not whether it worked.

**Self-report is circular.** Asking the same planner "are you done?" in the same context is inviting it to rationalize stopping. Fluency rises; honesty does not. It is the family meeting in *Kabhi Khushi Kabhie Gham* where everyone insists the house is fine while the plot is clearly not.

**Retries create new risks.** Once you add an independent check that can request another attempt, you inherit two enterprise problems for free: **unbounded spend** (worker + judge loops) and **double side effects** (the same mutation applied twice because the loop restarted).

We already knew soft prompts do not enforce curiosity — see [curiosity before confidence](/blog/curiosity-before-confidence/). Soft prompts also do not enforce completion. The runtime needed a contract: some runs may stop when the model shrugs; **goal runs stop when the goal is met, the budget is gone, or we fail open honestly.**

This sits next to [tokenomics](/blog/maintaining-tokenomics-with-aiden/) and [demo-to-deploy receipts](/blog/demo-to-deploy-receipts/): receipts prove a step happened; completion loops prove the *goal* happened without letting the wallet or the infrastructure catch fire.

---

## 2. Options We Considered

We argued through several designs. None were free.

| Option | Appeal | Why we did not ship it as the default |
| --- | --- | --- |
| **Always verify every chat turn** | Simple mental model | Pays a second model call for "thanks" and "hello"; latency and cost explode on interactive chat |
| **Regex / "DONE" string gates** | Cheap, deterministic | Agents learn to print the magic word; brittle across languages and tools |
| **Same-turn self-critique only** | No extra architecture | Shares the planner's blind spots; classic self-grade bias |
| **Human approval on every finish** | Highest trust | Does not scale; becomes a queue, not a product — see [the HITL paradox](/blog/hitl-paradox/) |
| **Only external system checks** | Strong when available | Many goals are internal (structured deliverable submitted, required tools succeeded); not every finish has a Datadog query |
| **Period spend enforcers alone** | Familiar FinOps | Wrong granularity for a single goal loop; stops the tenant after the damage, not the runaway attempt |
| **Uncapped judge retries** | Maximum thoroughness | Creates a new class of bill shock and latency outages |

The interesting debate was not "judge or no judge." It was **when the judge is allowed to wake up**, **what it is allowed to see**, and **how the host stops the loop without lying about success.**

---

## 3. What We Ended Up With

We shipped a **goal-scoped completion loop** in the agent runtime, activated by hosts like [Aiden](/blog/aiden-platform/) on measurable work — not on every casual turn.

**Activation is a policy.** Casual chat stays off. Goals and required-deliverable agents opt in. Operators can disable the whole capability.

**The check is independent.** A separate efficiency-oriented pass scores whether the *goal* is met — not whether the planner feels finished.

**Fail open beats hang.** If the judge is down or the attempt/spend ceiling hits, return the best candidate and record why you stopped.

**Budgets are first-class.** Token and cost ceilings cover worker *and* judge. Hosts supply pricing; without rates, cost ceilings stay inert and iteration caps still bind.

**Mutations need a ledger.** Retries must not re-apply writes. Tag tools as read-only vs mutating; refuse a second *successful* mutation under the same operation identity. Without that, "try again" becomes "charge twice."

**Outcomes are observable.** Verified, rejected, budget-exhausted, judge-unavailable — audit and metrics, or you cannot tell hard goals from strict judges from missing prices.

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
			return best, nil // fail open: keep best candidate, record budget_exhausted
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
			return best, nil // fail open
		default: // rejected — retry with feedback, still under maxAttempts
			continue
		}
	}
	return best, nil // fail open after attempts
}
```

**What the judge sees:** the original goal, the latest candidate string, and a bounded JSON-shaped list of tool execution statuses (succeeded vs failed/denied) — redacted excerpts, not the full transcript. It does **not** get raw secrets or multi-megabyte dumps. The handoff is: worker proposes → ledger snapshots tool truth → judge adjudicates → runtime either accepts, retries, or fails open.

One line: **propose in the planner; adjudicate in a bounded loop; price and mutate with host-aware guardrails.**

---

## 4. Papers and Traditions We Were Inspired By

We did not invent "ask another model if the work is finished." We stole the good parts and refused the demos that ignore cost and side effects.

| Tradition | What we took | What we refused to copy blindly |
| --- | --- | --- |
| **[ReAct](https://arxiv.org/abs/2210.03629)** (Yao et al.) | Interleave reasoning and tools; "done" is not a free text label | Unbounded loops as a product feature |
| **[Reflexion](https://arxiv.org/abs/2303.11366)** (Shinn et al.) | Verbal feedback from a critique step can improve the next attempt | Treating reflection as free and always-on |
| **[Self-Refine](https://arxiv.org/abs/2303.17651)** (Madaan et al.) | Iterative improve-with-feedback is a real pattern | Same-model self-grade without an evidence seam |
| **[CRITIC](https://arxiv.org/abs/2305.11738)** (Gou et al.) | Tool-interactive critique beats pure introspection | Assuming every environment exposes perfect verifiers |
| **[LLM-as-a-Judge](https://arxiv.org/abs/2306.05685)** (Zheng et al.) | A separate evaluator can be useful when scoped | Using judges as a substitute for systems-of-record checks |
| **[Let's Verify Step by Step](https://arxiv.org/abs/2305.20050)** (Lightman et al.) | Process-level signals beat outcome-only self-report | Importing math-benchmark process rewards wholesale into SRE |

The synthesis for enterprise agents: **critique is valuable; critique without evidence, budgets, and mutation policy is a liability.** Academia optimized for accuracy on benches. We optimized for "does not lie, does not melt the bill, does not double-write" on customer tenants.

---

## Technical Details Without Spilling the Blueprint

**Separate invocation counts from success counts.** "Required tool was called" ≠ "required tool succeeded." Gate the latter when the deliverable matters.

**Evidence for judges must be redacted and bounded.** Rolling windows beat "attach the whole transcript."

**Attribute spend by role.** Worker tokens and judge tokens are different economic animals. If the invoice only says "session," you will never know which half to tighten.

**Observe activation rate and outcome mix.** Share of runs that request verification; verify vs reject vs exhaust budget; share of cost estimates that resolve to real prices.

**Keep casual chat cheap.** Verifying everything after one scary "done" turns the platform into a latency tax. Goal mode for goals; open chat for chat.

---

## Lessons Learned

**1. Completion is a product surface, not a prompt appendix.** If finishing wrong is costly, the runtime must own the stop condition.

**2. Independence without evidence is theater.** A second model reading only the essay will rubber-stamp confident essays.

**3. Fail open beats fail forever.** When the judge cannot run, return the candidate with a recorded reason — do not hang.

**4. Retries invent two bugs.** Budget the loop. Ledger the mutations.

**5. Hosts own rates; runtimes own seams.** Cost ceilings without a pricing adapter are documentation cosplay.

Related: [evidence-gated RCA](/blog/evidence-gated-multiplane-rca/), [hypothesis ladder](/blog/hypothesis-ladder/), [curiosity before confidence](/blog/curiosity-before-confidence/), [tokenomics](/blog/maintaining-tokenomics-with-aiden/). Topic hubs: [AI agent workflows](/topics/ai-agent-workflows/) · [AI agents for SRE](/topics/ai-agents-sre/).

---

**Acknowledgments.** [Dhairya Dudhatra](https://www.linkedin.com/in/dhairya-dudhatra/) built much of the early completion-loop foundation in the agent runtime that this hardening builds on.

*Does your agent stop because the goal is met — or because it typed "done"? Picture abhi baaki hai until the checklist is. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

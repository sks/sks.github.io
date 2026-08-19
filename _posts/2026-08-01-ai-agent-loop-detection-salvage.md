---
layout: post
title: "AI Agent Loop Detection — Don't Throw Away the Answer"
date: 2026-08-01 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 29
description: "AI agent loop detection can erase a good answer. Preserve the best evidence-backed result when a stalled run ends — don't throw the work away."
image: /assets/images/og-debug.png
tags: [ai-agents, loop-detection, reliability, orchestration, sre, aiden, production]
permalink: /blog/ai-agent-loop-detection-salvage/
---

**AI agent loop detection** is supposed to stop wasted work. In one incident run, it also threw away the answer.

The agent had already answered the incident question. It had gathered evidence, narrowed the likely cause, and written a useful summary. Then it entered a small closing loop: short variations of “done,” each one less informative than the answer before it. The repetition guard eventually stopped the run.

What reached the operator was not the useful answer. It was a generic message asking them to try again.

The safety mechanism worked — the loop stopped — but the product still failed. **AI agent loop detection protected the runtime and discarded the result.**

That is the part most loop-detection designs miss. They focus on whether the agent should continue. Operators care about a second question:

> When the run stops, what is the best honest answer the agent has already earned?

---

## The Failure: A Healthy Stop With an Unhealthy Handoff

Agent loops rarely fail as clean crashes. They decay.

A strong investigation can be followed by:

- A ceremonial closing phrase
- A repeated tool-free response
- A request to mark the task complete
- Another closing phrase
- Finally, a repetition halt

If the runtime only remembers the most recent turn, the weakest output wins. The final “done” replaces the evidence-backed answer that appeared earlier.

This creates a strange operator experience. The tool trace shows useful work. The final response claims nothing useful happened. The operator, mid-incident at 3 AM, now has to reconstruct the answer manually from the transcript.

We had already seen the sibling failure where an agent [finds evidence and discards the lead](/blog/evidence-discarded/). This was worse in a subtle way: the synthesis itself was good. The runtime discarded it after synthesis.

---

## Loop Health and Answer Quality Are Different Signals

A stalled loop does not imply that every output produced during the loop is bad.

The run can be unhealthy while an earlier answer is still valuable:

- The agent may have completed the task and failed to recognize completion.
- A closing instruction may have triggered repetitive wording.
- A required finishing step may be missing even though the findings are sound.
- The model may keep polishing an answer that was already good enough.

Treating “loop stopped” as “all work invalid” collapses two decisions into one.

The runtime needs to judge:

1. **Should execution continue?**
2. **What should be delivered if execution stops?**

The first protects cost and latency. The second protects operator value.

---

## Preserve the Best Substantive Candidate

The fix is conceptually simple: keep a best-so-far answer while the run evolves.

“Best” does not mean longest. It means the candidate that contains the strongest useful combination of:

- an answer to the operator’s actual question,
- evidence or tool-backed findings,
- explicit uncertainty,
- and a concrete next step where the evidence is incomplete.

Short closing phrases should not displace that candidate. Neither should generic apologies, empty completion markers, or repetition fallbacks.

When the loop halts, the runtime can return the strongest substantive candidate with an honest status note: the investigation produced useful findings, but the finishing loop stalled.

This is not hiding failure. It is separating **execution failure** from **answer value**.

---

## Nudge Once Before Giving Up

Immediate salvage is not always the right first move.

Sometimes the answer is nearly complete but missing a required action: cite the evidence, publish the result, or perform a final read-only verification. In that case, the runtime should give the agent a tightly bounded recovery opportunity before halting.

The recovery message should name the unfinished obligation instead of saying “try again.” Generic nudges create generic retries.

The pattern is:

- detect repetition,
- identify what completion still requires,
- give a focused recovery chance within the run's budget,
- then stop and salvage the best answer if the run still cannot progress.

The bounded recovery matters. Without a limit, “helpful retry” becomes another name for the loop.

This complements [independent completion checks](/blog/is-the-task-actually-done/). A completion judge can say what is missing. Loop handling decides how long to keep trying and what survives if the retry fails.

---

## Do Not Salvage Around a Real Evidence Gate

Salvage can become dangerous if it bypasses the reason the task exists.

If the operator asked the agent to inspect live systems, a polished answer written before any live probe is not a valid substitute. If a workflow requires approval before a change, an earlier recommendation cannot be presented as an executed result.

That gives us two classes of completion:

- **Presentation completion:** The answer is useful but the closing loop is stuck. Salvage is appropriate.
- **Evidence completion:** Required observations or actions never happened. Salvage may provide partial findings, but it must not claim completion.

This is why [evidence-gated orchestration](/blog/evidence-gated-multiplane-rca/) matters. A good paragraph cannot satisfy a missing evidence gate.

The runtime should preserve useful work without upgrading partial work into proof.

---

## Why the Operator-Facing Status Matters

There are two bad extremes:

1. Hide the stall and present the answer as perfectly complete.
2. Throw away the answer and show only a generic failure.

The useful middle is transparent:

- Here are the evidence-backed findings.
- The finishing loop stalled.
- This specific step remains incomplete.

Operators can act on the findings and still understand the limitation. That builds more trust than either false confidence or needless amnesia.

The same distinction helps observability. A run can be recorded as “stopped for repetition” while its delivery outcome says “substantive answer preserved.” Reliability metrics no longer have to pretend every halted loop produced zero value.

---

## Lessons Learned

1. **A loop is not the answer.** Execution health and answer quality need separate decisions.
2. **Keep the strongest earned result.** Do not let a weak closing turn overwrite an evidence-backed answer.
3. **Recover with a specific obligation.** A focused, bounded nudge is better than repeated “continue” prompts.
4. **Never salvage past a hard gate.** Partial findings can survive; missing evidence cannot become proof.
5. **Tell the operator what happened.** Preserve value and disclose the stall.

Loop detection should stop wasted work. It should not erase completed work on the way out.

---

## Related reading

- [AI agent RCA — evidence discarded after the lead](/blog/evidence-discarded/)
- [Is the task actually done?](/blog/is-the-task-actually-done/)
- [AI agent RCA — curiosity before confidence](/blog/curiosity-before-confidence/)
- [Observability for AI agents](/blog/observability/)

---


*Has your agent ever produced the right answer and then lost it while trying to finish? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

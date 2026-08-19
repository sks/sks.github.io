---
layout: post
title: "From Vibes to Contracts: How We Rebuilt Agent Evals Around an Industry Standard"
date: 2026-08-13 19:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 45
description: "From vibes to contracts: how we rebuilt agent evals around eval sets, rubrics vs criteria, a grader stack, and pass^k reliability."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, reliability, sre, rca, adk, pass-at-k, incident-response, aiden, production]
permalink: /blog/from-vibes-to-contracts-agent-evals/
faqs:
  - question: "Why move agent evals to an EvalSet/EvalCase style contract?"
    answer: "Because a portable contract separates the case (input + expected shape), the rubric (what good looks like in words), the criteria (which metrics gate), and the grader stack (who scores). That separation lets you change prompts without breaking case identity and lets you compare runs over time."
  - question: "What is pass^k and why does it matter for agents?"
    answer: "pass^k asks whether an agent clears the bar on every one of k independent trials — not just once. A single good answer is a demo; clearing the bar every time is a product. Non-determinism means reliability, not peak score, is the honest metric."
  - question: "Why did three consistent RCAs still fail the reliability gate?"
    answer: "All three named the same causal mechanism, so they concurred. But one trial dropped the evidence detail and impact quantification below the quality bar. Concurrence passed; pass^k failed. That gap is exactly what a reliability gate is supposed to expose."
  - question: "Is mean score a good gate for agent evaluation?"
    answer: "No. A high mean can hide one bad trial. If on-call assist has to be trusted at 3 AM, you gate on every-trial reliability, keep the mean as a diagnostic, and treat concurrence as a separate cross-run property."
---

For a year our agent evaluation was, if I am honest, **vibes with a rubric**. Run the agent, ask a judge model, "Is this good?" read the number, and ship. It felt rigorous because there was a score. It was not.

The tell came from a live [SRE investigation consistency evaluation](/blog/canary-first-sre-investigate-consistency-evals/): the same alert, investigated three times, produced three write-ups that *agreed on the cause* — yet I still could not answer the only question that matters for on-call assist: **"Can I trust this every time, not just this time?"** Our harness had no vocabulary for that question. So we rebuilt it around the contract the industry is quietly standardizing on.

This is the story of that transformation — from a single number to a real evaluation contract.

---

## TL;DR

- **Scoring one output is a demo, not an eval.** We were grading beauty contests.
- **The industry has converged on a shape.** Eval sets and cases, rubrics separate from pass/fail criteria, a stack of graders, and reliability measured across repeated trials. Google's agent kit, the model labs' eval tooling, and the open-source eval frameworks all rhyme here.
- **Reliability is `pass^k`, not mean score.** Clear the bar on *every* trial or you have not cleared it.
- **Correctness ≠ consistency ≠ reliability.** Three different gates. We used to collapse them into one.
- **Dogfood proof:** three live RCAs concurred on the mechanism, but one trial dropped its evidence quality — so consistency passed and reliability failed. That is the whole point.

### Explain like I'm five

Grading a robot once is like tasting one cookie and calling the whole batch good. The real test is whether *every* cookie is good, whether three bakers describe the same recipe, and whether you wrote down what "good" means *before* you tasted.

---

## Where we started: a number without a contract

The old flow had exactly one moving part that mattered: a judge produced a correctness score, and a threshold turned it into green or red. Everything else — what "good" meant, how many times we ran, whether repeated runs agreed — lived in people's heads or in ad-hoc flags.

That design has three quiet failures:

1. **The rubric and the gate were the same thing.** "What good looks like" (a paragraph a human can argue with) got fused with "what number blocks the merge." You cannot evolve one without disturbing the other.
2. **Case identity was tied to prompt text.** Tweak the wording and the eval looked like a *new* case, so you lost the ability to compare tonight's run to last week's.
3. **One trial decided everything.** For a non-deterministic agent, that is like judging a coin as "heads" because the first flip landed heads.

None of this is exotic. It is just what happens when evals grow organically instead of from a contract.

---

## What the industry actually converged on

When I stepped back and read how the serious players structure agent evals — Google's agent development kit, the model labs' eval harnesses, the open-source evaluation frameworks — the surface details differ but the **shape is the same**. Four ideas keep recurring:

| Concept | What it holds | Why it exists |
|---|---|---|
| **Eval set / case** | A stable case: input, expected *shape*, and a durable ID | Compare the same case across time even when prompts change |
| **Rubric** | Prose description of what a good answer contains | Human-readable, argue-able, evolves independently of gates |
| **Criteria** | The metrics that actually gate, with their bars | Separates "what good means" from "what blocks the build" |
| **Grader stack** | Multiple scorers — cheap structural checks, model judges, cross-run checks | No single scorer is trusted for everything |

And sitting on top of all of it: **reliability as a first-class metric**, usually expressed as some flavor of `pass^k` — did the agent clear the bar on *every* one of k trials.

The insight that reordered my thinking: **these are separable concerns that we had welded together.** A rubric is not a threshold. A case is not its prompt. A grader is not the gate. Once you split them, the eval stops being a vibe and becomes a contract you can reason about.

I deliberately did *not* adopt anyone's runtime. Pulling in a heavy eval SDK to get four good ideas is the classic over-abstraction trap. We borrowed the **portable contract** — the vocabulary and the separation — and expressed it in our own harness. Ideas travel; dependencies calcify.

---

## The transformation, concretely

Here is the before/after in plain terms, no blueprint required.

**Before:** one run, one judge, one number, one threshold, identity tied to prompt text.

**After:**

- A **case** carries a stable identity independent of how the prompt is phrased, so a reworded input is still "the same test."
- A **rubric** says, in words a human reviewer can challenge, what a trustworthy RCA must contain — a concrete cause, quantified impact, honest uncertainty, evidence.
- **Criteria** name which metrics gate and hold their bars, kept apart from the rubric prose.
- A **grader stack** runs in escalating cost: a cheap structural pass (did it finish and produce a cause at all), then the model judges, then a cross-run concurrence check.
- **Reliability** is computed across repeated trials as an every-trial gate, not an average.

Shape-only, the contract reads like this — note how identity, prose, gates, and scorers each live in their own slot:

```yaml
case:
  id: sre.node-not-ready          # durable, survives prompt rewrites
  input: { alert: "Node Not Ready", env: dogfood }
rubric: "A trustworthy RCA names a concrete cause, quantifies impact,
         states honest uncertainty, and cites evidence."
criteria:                          # what actually gates
  correctness: { min: 0.8 }
  reliability: { trials: 3, gate: pass^k }   # every trial, not the mean
graders: [structural, model_judge, cross_run_concurrence]
```

The escalating grader stack pairs perfectly with the [canary-first discipline](/blog/canary-first-sre-investigate-consistency-evals/): the structural grader is your canary, and you only pay the expensive judges once the cheap grader is green. Same tokenomics lesson, now baked into the contract instead of bolted on.

---

## The dogfood run that justified the whole thing

We pointed the new contract at a live "Node Not Ready" alert on our own environment: one canary, then two judged follow-ups, then a cross-run comparison. (Lessons on running these safely live in the [consistency-eval post](/blog/canary-first-sre-investigate-consistency-evals/); this post is about what the *contract* revealed.)

The result is the best advertisement for the transformation I could have asked for:

- **All three investigates concurred.** Every one landed on the same causal mechanism — a node-local reachability loss — and each was honest about which deeper trigger it could not verify. Under the old world, "they agree and scored well" would have been a clean pass.
- **Reliability failed anyway.** Two of the three trials cleared the quality bar; the third told the *same story* but dropped its evidence detail and impact quantification below the line. Concurrence: pass. `pass^k`: fail.

Sit with that. The mechanism was right every time. The team would have shipped. And the reliability gate — the thing we did not even *have* before — correctly said "not yet," because a version of this that thin at 3 AM erodes trust even when the headline cause is correct.

When we sat with that gap, the core takeaway became undeniable:

**Finding.** A high mean and a confident consensus can coexist with a trust problem. Only an every-trial gate surfaces it. That is not a nice-to-have; that is the difference between a demo and a product.

---

## Why three gates, not one

The transformation forced me to name three questions I had been smearing together:

1. **Correctness** — does *this* answer match the rubric? (per-run)
2. **Consistency** — do the runs tell the *same story*? (cross-run agreement)
3. **Reliability** — does *every* run clear the bar? (cross-run every-trial)

They fail independently. You can be correct-on-average but unreliable (our dogfood run). You can be reliable but inconsistent if the bar is low enough to pass contradictory stories. You can be consistent but wrong if all runs share the same blind spot. Collapse them into one number and you will confidently ship the wrong thing.

---

## Lessons learned

1. **A score is not an eval.** Without a contract behind it, a number just launders vibes.
2. **Steal the shape, not the SDK.** The industry's convergence on eval sets, rubric/criteria separation, grader stacks, and `pass^k` is portable. Adopt the ideas; keep your own runtime.
3. **Separate what good means from what blocks the build.** Rubrics evolve; gates stay stable. Fusing them freezes both.
4. **Give cases an identity that outlives their prompt.** Otherwise you can never compare across time.
5. **Reliability is `pass^k`, full stop.** Mean score hides the trial that would have burned an on-call engineer.
6. **Correctness, consistency, reliability are three gates.** Name them separately or ship the wrong thing confidently.

The homework is honest: our reliability gap is real (one thin trial in three), and the fix is upstream — preserve richer evidence through the whole grader path so a correct mechanism never arrives underdressed. But the important shift already landed. Our evals stopped asking "is this one good?" and started asking "can I trust this every time?" — which is the only question a 3 AM operator actually cares about.

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

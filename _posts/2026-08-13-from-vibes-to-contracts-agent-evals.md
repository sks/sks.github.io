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

Our earlier agent evaluation used one run and a model-based judge: it scored an answer against a rubric, then compared the score with a threshold. That produced a number, but not a measure of variation across repeated runs.

A live [site reliability engineering (SRE) investigation consistency evaluation](/blog/canary-first-sre-investigate-consistency-evals/) made the gap visible: three investigations of the same alert produced write-ups that agreed on the proposed cause, but the old harness did not check whether each run met the same quality bar. We separated case identity, rubric, gate criteria, and graders. This is an implementation pattern, not a claim that one industry standard governs every evaluation.

---

## What to check

- **A single score cannot measure run-to-run reliability.** It remains useful for diagnosing an individual output.
- **Several evaluation frameworks use separable pieces:** cases, rubrics, pass/fail criteria, and graders. We adopted those distinctions without adopting a particular SDK.
- **Here `pass^k` means all k sampled trials pass.** It is stricter than their mean score, but a pass on three trials does not guarantee every future run will pass.
- **Correctness ≠ consistency ≠ reliability.** Three different gates. We used to collapse them into one.
- **In one internal run:** three root cause analyses (RCAs) concurred on the mechanism, but one missed the evidence-quality bar. Agreement passed; the all-trials gate failed.

A repeated-trial gate asks whether each sampled run meets a specified bar. A separate agreement check asks whether runs name the same mechanism. Neither alone establishes that mechanism is true.

---

## Where we started: a number without a contract

The old flow had exactly one moving part that mattered: a judge produced a correctness score, and a threshold turned it into green or red. Everything else — what "good" meant, how many times we ran, whether repeated runs agreed — lived in people's heads or in ad-hoc flags.

That design has three quiet failures:

1. **The rubric and the gate were the same thing.** "What good looks like" (a paragraph a human can argue with) got fused with "what number blocks the merge." You cannot evolve one without disturbing the other.
2. **Case identity was tied to prompt text.** Tweak the wording and the eval looked like a *new* case, so you lost the ability to compare tonight's run to last week's.
3. **One trial decided everything.** For a non-deterministic agent, that is like judging a coin as "heads" because the first flip landed heads.

None of this is exotic. It is just what happens when evals grow organically instead of from a contract.

---

## Separating the parts of an evaluation contract

![Stable case and rubric flow through independent criteria and graders into distinct correctness, consistency, and every-trial reliability gates](/assets/images/diagrams/aug-runtime/eval-contract-gates.svg)

*Correctness, agreement, and all-trials passing are different checks.*

The frameworks we considered differ in implementation, but four useful concerns recur in evaluation design:

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

The grader sequence follows [canary-first discipline](/blog/canary-first-sre-investigate-consistency-evals/): run structural checks before paying for model judges. The same model-call budgeting principle is expressed in the contract.

---

## The dogfood run that justified the whole thing

We pointed the new contract at a live "Node Not Ready" alert on our own environment: one canary, then two judged follow-ups, then a cross-run comparison. (Lessons on running these safely live in the [consistency-eval post](/blog/canary-first-sre-investigate-consistency-evals/); this post is about what the *contract* revealed.)

The result illustrated why the gates need separate names:

- **All three investigates concurred.** Every one landed on the same causal mechanism — a node-local reachability loss — and each was honest about which deeper trigger it could not verify. A single mean score could have obscured the weaker trial.
- **Reliability failed anyway.** Two of the three trials cleared the quality bar; the third told the *same story* but dropped its evidence detail and impact quantification below the line. Concurrence: pass. `pass^k`: fail.

All three write-ups named the same mechanism, but one did not meet the specified evidence and impact criteria. Under this contract, that is a failed all-trials gate. The result is limited to this alert and these three trials.

**Finding.** Mean quality and agreement can hide a weak individual run. An all-trials gate exposes that sampled failure, while additional cases and independent review remain necessary for broader confidence.

---

## Why three gates, not one

The transformation forced me to name three questions I had been smearing together:

1. **Correctness** — does *this* answer match the rubric? (per-run)
2. **Consistency** — do the runs tell the *same story*? (cross-run agreement)
3. **Reliability** — does *every* run clear the bar? (cross-run every-trial)

They fail independently. You can be correct-on-average but unreliable (our dogfood run). You can be reliable but inconsistent if the bar is low enough to pass contradictory stories. You can be consistent but wrong if all runs share the same blind spot. Collapse them into one number and you will confidently ship the wrong thing.

---

## Lessons learned

1. **A score needs a defined contract.** Record the case, rubric, threshold, and grader so the number is interpretable.
2. **Adopt the structure without requiring an SDK.** The industry's convergence on eval sets, rubric/criteria separation, grader stacks, and `pass^k` is portable. Adopt the ideas; keep your own runtime.
3. **Separate what good means from what blocks the build.** Rubrics and gates can change independently, with versioned criteria.
4. **Give cases an identity that outlives their prompt.** Otherwise you can never compare across time.
5. **Use `pass^k` for an all-trials gate in this harness.** Report sample size and case coverage; a mean can still help diagnose shifts.
6. **Correctness, consistency, reliability are separate checks.** Keep their results visible rather than merging them into one score.

One trial in three was below the specified bar. We need to determine whether evidence was lost during investigation, synthesis, or grading before choosing a fix. Repeating the test across more alerts and trials would better characterize reliability than this single case.

For tool-using benchmarks, the same contract applies at the wiring layer first: [fair agent evals](/blog/fair-agent-evals-before-performance/) before you trust mode comparisons.

---

> StackGen develops AI tools for site reliability engineering (SRE), including incident triage and diagnostic workflows. Product details are at [ai.stackgen.com](https://ai.stackgen.com).

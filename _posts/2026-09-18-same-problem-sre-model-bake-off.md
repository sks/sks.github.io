---
layout: post
title: "Same Incident, Five Models: Rank Investigators Without Mixing the Exam"
date: 2026-09-18 15:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 71
description: "Random CI reruns mix model skill with incident difficulty. Freeze one checkout outage, swap only the bound model, and rank on Correct first, then wall time and new input tokens."
image: /assets/images/og-default.png
tags: [ai-agents, sre, benchmarking, evaluation, tokenomics, rca, aiden]
permalink: /blog/same-problem-sre-model-bake-off/
faqs:
  - question: "Why can't you rank SRE models from random one-incident eval reruns?"
    answer: "Each rerun can draw a different fault. A two-call image-tag miss looks cheaper than a long auth miss even if both answers are Correct. Freeze the incident, then change only the bound model."
  - question: "Which model won the frozen checkout-outage comparison?"
    answer: "claude-fable-5: Correct at judge 100, 113s wall, 26k new input tokens, 6 model turns. Fable 5.1 and Opus 5 also scored 100 and took longer. Sonnet 5 was Correct at 89. Opus 4.8 blamed a sibling CrashLoop and scored 0."
  - question: "Should you use a combined efficiency score to pick a model?"
    answer: "Not when the formula caps at 100 as soon as the answer is Correct and the run stays under token and time budgets. Publish Correct, wall seconds, new input tokens, and tool counts. Use dollars only if the trace actually priced the calls."
  - question: "Is one trial enough to crown a production default?"
    answer: "No. A single run is a receipt you can argue about, not a reliability claim. Repeat the same incident, and treat missing registry models as skipped seats, not losses."
---

A continuous-integration (CI) evaluation reran nine times, but each attempt drew a different injected incident. Ranking those attempts by wall time would conflate model behavior with fault difficulty.

Each attempt investigated a **different** injected fault. The cheap seat got a two-call image-tag miss. The expensive Correct seat got a long database-auth miss. The combined efficiency number printed **100** for four different Correct runs because they all finished under the token and wall allowances.

Those results are useful as canaries for whether the investigator can handle varied faults. They are not a controlled head-to-head model comparison.

For a narrower comparison, we fixed the checkout incident and bound **one registered model at a time** to the investigator. The resulting table ranks single runs on that fault, not model reliability across outages.

---

## What the evidence supports

- Sampling a random incident per rerun mixes **fault difficulty** with **model skill**. Rank only after everyone sits the same case.
- On a checkout outage caused by a payment feature flag set to fail every charge, **claude-fable-5** was the efficient Correct close (113s, 26k new input tokens, 6 model turns / 16 tools, judge 100).
- **claude-opus-4-8** was reasonably fast and still **Incorrect** (it blamed a sibling catalog CrashLoop). Cheap-and-wrong is last.
- A combined “session efficiency” score saturated at 100 for every Correct seat under about 1M billed tokens and 3 minutes. Do not use it to pick a model. See [session efficiency should not beat accuracy](/blog/session-efficiency-should-not-beat-accuracy/) and [relative efficiency scores lie](/blog/relative-efficiency-scores-lie/).
- One model from the earlier random wave was not in the org registry that day. Skip the seat. Do not invent a substitute.


---

## What the random reruns actually measured

The pipeline drew **one random incident per attempt**. One of those attempts happened to be the checkout outage. The other eight were not rematches.

| Attempt | Bound model | Incident drawn | Judge |
|--------:|-------------|---------------|-------|
| 1 | gpt-5.6-terra | database auth miss | Correct, 8m 29s, 538k new input |
| 2 | gpt-5.6-terra | policy blocked a workload | Incorrect |
| 3 | claude-sonnet-5 | checkout / payment failures | Correct |
| 5 | claude-fable-5-1 | init-container hang | Correct |
| 6 | claude-opus-4-8 | overly aggressive liveness probe | Correct, 98s |
| 7 | claude-opus-5 | storage identity missing | Correct |
| 8 | claude-fable-5 | wrong container image | Correct, 2 model turns |
| 4 / 9 | mixed / none | admission webhook / capacity | failed or blocked |

Sorting that table by wall time or dollars would favor the easy wrong-image case for **Fable 5** and the short probe case for **Opus 4.8**. We initially read those attempts as a ranking, but the incident varied along with the model. The next step is a rematch on one prompt, the same rule I already used for [six model×orchestration combos](/blog/six-model-mode-combos-alert-logs-bench/).

A green pipeline still is not a Correct diagnosis. Same lesson as [canary-first investigate evals](/blog/canary-first-sre-investigate-consistency-evals/): the job can finish while the write-up is wrong.

---

## How we made the comparison fair

![The same saved incident and conditions feed each candidate](/assets/images/diagrams/sept/model-benchmark.svg)

*Compare quality, wall time and cost using the same incident rather than unrelated reruns.*


Hold the **fault** constant. Change only the **model** on the investigator.

1. Freeze one known case: checkout fails because a payment feature flag is set to fail 100% of charges. The firing alert is high request error rate on **payment**, not a pending-pod sibling.
2. Read the investigator’s current model list and save it.
3. Attach exactly one registered model so the next investigate uses that seat.
4. Re-run the same inject and grade against the known root cause.
5. Put the original model list back when you are done. Shared environments are shared.

That is the same fairness instinct as [do not compare planner vs single-agent until tools match](/blog/fair-agent-evals-before-performance/): if the worker cannot reach the same tools, or cannot sit the same exam, the cheaper number is invalid.

We did **not** compare orchestration shapes here. This is a model-on-investigator comparison, not planner tax. Keep those axes separate ([wall / tools / tokens scorecard](/blog/ai-sre-agent-benchmarks-wall-time-tools-tokens/)).

One trial per model means these numbers are directional. The same fault reduces one source of variation, but live tools and model sampling can still vary; repeated runs and tool-condition logs are needed before changing a default.

---

## Frozen-incident leaderboard

Same fault: the payment service evaluates a feature flag and throws a synthetic invalid-token error on every charge. Checkout surfaces that as failed-to-charge-card. An independent judge scores the write-up against the expected mechanism, not against how complete the helper notes look.

| Rank | Model | Judge | Score | Wall | New input | Cached input | Output | Turns / tools |
|-----:|-------|-------|------:|-----:|----------:|-------------:|-------:|--------------:|
| 1 | claude-fable-5 | Correct | 100 | **113s** | **26k** | 228k | 7.2k | **6 / 16** |
| 2 | claude-fable-5-1 | Correct | 100 | 145s | 41k | 329k | 9.4k | 7 / 25 |
| 3 | claude-opus-5 | Correct | 100 | 172s | 43k | 532k | 12k | 10 / 30 |
| 4 | claude-sonnet-5 | Correct | 89 | 243s | 61k | 781k | 19k | 13 / 58 |
| 5 | claude-opus-4-8 | **Incorrect** | 0 | 160s | 44k | 629k | 9.4k | 11 / 50 |

Prompt-resend totals (the number many dashboards still call “billed”) followed the same order among Correct seats: 317k → 451k → 658k → 943k. Opus 4.8 used 760k **and was wrong**.

Dollar totals were a **priced subset**. Fable 5.1 had no priced model-call cost at all. So dollars do not pick the winner. That is the same “publish absolutes, label the composite” rule as the [RCA eval checklist](/blog/how-to-evaluate-ai-agent-root-cause-analysis/).

"New input" counts prompt tokens not served from cache; "cached input" counts repeated prompt material eligible for provider cache treatment. Cache discounts and prices depend on the provider and contract, so token columns alone do not establish dollar cost. Prompt-resend totals can be much larger than new reads: I have seen a 700k sent-token session with only 100k new-read tokens. Report both; neither alone is a complete dollar figure.

---

## What the write-ups actually said

**Fable 5 / Fable 5.1 / Opus 5 / Sonnet 5** all named the mechanism: payment feature flag enabled at 100% failure, payment throws at charge time, checkout returns failed-to-charge-card. The good closes also noted the config was written after the original deploy, which is the inject fingerprint.

**Sonnet 5** still scored 89 instead of 100. It hedged impact at “about 50%” while the traces showed a full charge outage, and it spent 58 tool calls getting there. Correct-but-sloppy is not Incorrect. It is also not the efficiency pick.

**Opus 4.8** wrote a confident story about the product-catalog memory limit and CrashLoopBackOff. That locus existed as **startup residue** on some of the Correct runs too. The winners demoted it. Opus 4.8 crowned it. That is [evidence discarded after the lead](/blog/evidence-discarded/) in reverse: a real sibling symptom ate the actual payment flag.

The random-wave Opus 4.8 win on a **liveness probe** incident does not contradict this. Different exam.

---

## Why the combined efficiency score was useless here

Many suites collapse success, tokens, and time into one headline. A typical shape:

```text
score = 100 × Correct × clip(token_budget / tokens, floor, 1) × clip(time_budget / wall, floor, 1)
```

On a single incident, Correct is 0 or 1. If both ratios **cap at 1**, every Correct run under budget prints **100**. Fable 5, Fable 5.1, and Opus 5 all sat there. Sonnet 5 dropped only because wall was 243s. Opus 4.8 printed 0 because it was wrong.

That is the capped shape from [session efficiency should not beat accuracy](/blog/session-efficiency-should-not-beat-accuracy/) (no bonus above Correct). It still cannot rank four Correct seats against each other. Use wall, new input tokens, and tool churn for that. [AgentSLABench](https://arxiv.org/abs/2608.00805) makes the same point: efficiency-adjusted success cannot exceed success.

Scores normalized to the **cohort median** answer a different question and cannot compare runs across cohorts without a fixed baseline ([relative efficiency scores lie](/blog/relative-efficiency-scores-lie/)). This frozen-incident table therefore shows absolute resources and judge outcomes instead.

---

## What to do on Monday

1. **Freeze the incident** before you change the model. Random one-shots are canaries, not leaderboards.
2. **Attach one registered model** on the investigator. The workflow name is not where models live.
3. **Restore the previous binding.** Shared investigators are shared.
4. **Correct first.** Then wall. Then new input tokens and tool churn. Then dollars if the trace priced the calls.
5. **Skip missing registry seats.** Do not silently swap in whatever is attached today.
6. **Read the write-up.** Two Correct scores can still differ in honesty ([how we grade RCA](/blog/how-to-evaluate-ai-agent-root-cause-analysis/), [what reasoning models write](/blog/what-reasoning-models-write-on-triage/)).
7. **One trial is a receipt, not a default.** Repeat the same incident before you change production bindings. Consistency is a different gate ([canary first](/blog/canary-first-sre-investigate-consistency-evals/)).

The random-wave wrong-image case and the frozen checkout outage are different tests. On the checkout case, Fable 5 was the fastest Correct seat in one trial. That supports a targeted follow-up evaluation, not an across-incident production default.

---

## Related on this site

- [Six model×orchestration combos on one alert+logs job](/blog/six-model-mode-combos-alert-logs-bench/) — same prompt, six seats
- [Session efficiency should not beat accuracy](/blog/session-efficiency-should-not-beat-accuracy/) — cap composites at Correct
- [Relative efficiency scores lie](/blog/relative-efficiency-scores-lie/) — medians hide slower labs
- [Fair agent evals before performance](/blog/fair-agent-evals-before-performance/) — tool parity before mode wars
- [AI SRE agent benchmarks](/blog/ai-sre-agent-benchmarks-wall-time-tools-tokens/) — wall, tools, tokens, orchestration tax
- [Reasoning vs generate for tool-heavy agents](/blog/reasoning-vs-generate-tool-heavy-agents/) — do not assume the “bigger” model is the efficient closer
- [Reasoning effort is not a free upgrade](/blog/reasoning-effort-is-not-a-free-upgrade/) — thinking budget vs tool turns

---

**Acknowledgments.** Ranked on a live Kubernetes lab against a production investigator. Numbers from session traces and an independent diagnosis judge. One trial per model, 18 September 2026.

---

> **StackGen** works on AI-assisted incident triage and diagnostic workflows. See [ai.stackgen.com](https://ai.stackgen.com) for the offering.

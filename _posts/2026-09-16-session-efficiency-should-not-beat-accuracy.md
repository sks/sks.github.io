---
layout: post
title: "Session Efficiency Should Not Beat Accuracy"
date: 2026-09-16 12:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 70
description: "We labeled a score 0-100 and watched a perfect, cheap, fast agent run print 125. Cap budget bonuses at 1.0 so efficiency never grades above how often you were Correct."
image: /assets/images/og-default.png
tags: [ai-agents, benchmarking, evaluation, tokenomics, metrics, sre, aiden]
permalink: /blog/session-efficiency-should-not-beat-accuracy/
faqs:
  - question: "Why can a 0-100 efficiency score print above 100?"
    answer: "If the formula gives extra points for finishing under the token and time allowances, and multiplies those extras together, a fully Correct run can land above 100. Capping the final number at 100 hides a bad formula."
  - question: "What should the score do instead?"
    answer: "Multiply Correct-rate by how close you stayed to each budget, but never give more than full credit for finishing early. Finishing under budget stays a perfect efficiency score for that part. Savings show up as lower dollars and shorter wall clock."
  - question: "Where do I see that we used less money or time?"
    answer: "In the absolute numbers: tokens used, wall seconds, and Cost-of-Pass (total dollars divided by how many problems were Correct). Keep those visible. Use the combined efficiency score as a short headline, not the only number."
---

We said the score goes from **0 to 100**.

A run that got every problem right, used fewer tokens than we allowed, and finished faster than we allowed printed **125**.

The dashboard was not broken. The formula was giving extra credit for finishing early, then multiplying those bonuses together.

---

## Words we use

If you have never scored an AI agent eval, these five terms are enough:

| Word | Plain meaning |
|------|----------------|
| **Accuracy** | Share of problems graded Correct (right diagnosis). 1.0 means all Correct. |
| **Tokens** | How much text the model read and wrote. Rough proxy for dollar cost. |
| **Wall time** | Clock time until the run finished. |
| **Budget / allowance** | The token count and wall time we hoped not to exceed. |
| **Efficiency score** | One headline that mixes “were you Correct?” with “did you stay near budget?” |

A **combined score** (sometimes called a composite) collapses those into one number for a pass/fail check. That is useful. It is dangerous when the scale on the label does not match the math.

---

## TL;DR

- We built a session efficiency score for agent evals: Correct-rate times a token factor times a wall-time factor.
- Each factor could go up to **1.25** when the run beat the allowance (25% bonus for finishing early).
- Two bonuses multiplied: √1.25 × √1.25 = **1.25**. With every problem Correct, that prints **125** on a chart labeled 0-100.
- Cap each factor at **1.0**. Finishing early does not grade above “you were Correct.” Put the savings in tokens, wall seconds, and dollars per Correct.
- Same idea as AgentSLABench’s efficiency-adjusted success: success times budget ratios, never above success.

### Explain like I'm five

If homework is due Friday and you finish Tuesday, you still get 100, not 125. Finishing early shows up as free time, not a grade above perfect.

**Mapping that to agents:** Correct answers are the grade. Tokens and wall time are how much work and waiting you spent. Using less of those is good. It should not invent points above “you got them all right.”

---

## How the old formula overshot

We scored suite runs with something like this:

```text
token_factor = clip(token_allowance / tokens_used, 0.25, 1.25)
wall_factor  = clip(wall_allowance / wall_seconds, 0.25, 1.25)
score        = 100 × accuracy × √token_factor × √wall_factor
```

`clip` just means “keep the number between these two ends.”

Intent was fine: punish wasteful digs, keep one number for a pass/fail check. The upper end at **1.25** was the mistake. It turns “beat the budget” into **extra points for finishing early**. When both token and wall bonuses sit at 1.25, their square roots multiply to 1.25. Accuracy 1.0 × 1.25 × 100 = **125**.

Walk one real seat in sentences, then numbers.

We allowed about **1 million** tokens and **180** seconds. The run used about **565k** tokens and **132** seconds, and was Correct. Tokens were under allowance, so the old formula gave up to a 25% bonus. Wall was also under, so another 25% bonus. Those bonuses compound. Result: raw **125**. A cleaner shape that never grades above Correct would print **100** for the same seat.

| Field | Value |
|-------|-------|
| Accuracy | 1 (all Correct) |
| Tokens used | ≈ 565k (allowance 1M) |
| Wall time | ≈ 132s (allowance 180s) |
| Old raw score | **125** |
| Score with bonuses capped at 1.0 | **100** |

Same Correct. Same thrift. Different story if your pass/fail check says “must be at least 80 on a 0-100 scale.”

---

## What other people already do

**[AgentSLABench](https://arxiv.org/abs/2608.00805)** publishes an efficiency-adjusted success rate: multiply success by how close you stayed to each budget, and never give more than full credit for finishing early. Under budget does not inflate the score. Over budget shrinks it. For you: the headline cannot exceed “how often were you Correct?”

**Cost-of-Pass** is a separate dollar ledger: total spend divided by how many problems were Correct. That is where thrift belongs in money terms, not as a fake 125 on an accuracy-capped dial.

When people [benchmark agents](/blog/ai-sre-agent-benchmarks-wall-time-tools-tokens/), they still need absolute wall, tools, and tokens on the page. A combined score is a headline for a pass/fail check, not the only number in a changelog. Keep evals [fair before you chase performance](/blog/fair-agent-evals-before-performance/), [start with canaries](/blog/canary-first-sre-investigate-consistency-evals/), and keep [RCA judge checklists](/blog/how-to-evaluate-ai-agent-root-cause-analysis/) readable next to the score.

---

## The shape that stays honest

```text
token_factor = clip(token_allowance / tokens_used, 0.25, 1.0)
wall_factor  = clip(wall_allowance / wall_seconds, 0.25, 1.0)
score        = 100 × accuracy × token_factor × wall_factor
```

What changed:

1. **Upper end at 1.0**, not 1.25. Beat the allowance → factor = 1. No extra points past Correct.
2. **Multiply the factors directly.** No nested square roots that still let a 1.25 product through when the upper clip is above 1.
3. **Floor at 0.25** still softens one wildly over-budget run so a single hung seat does not zero the whole headline.

On the same worked seat: accuracy 1, both factors clip to 1.0 → **score = 100**. Thrift still shows as fewer tokens, shorter wall, and lower Cost-of-Pass. The pass/fail check stops lying about the scale.

---

## Two ways efficiency scores lie

| Lie | What goes wrong | What you see |
|-----|-----------------|--------------|
| [Normalize to this week’s average](/blog/relative-efficiency-scores-lie/) | Everyone got slower, so the “average” rose | Score rises while real wall time doubles |
| Extra points for finishing early (this post) | Bonuses above 1.0 multiply | Score rises past Correct on a 0-100 label |

Rule for both:

> Publish Correct-rate, wall seconds, tokens, and dollars first. Only then print a combined score. Never invent a scale that “all Correct + thrifty” can exceed by design.

If your suite needs one number for a pass/fail check, cap it at accuracy times 100 and put the savings on the axes operators actually bill and wait on.

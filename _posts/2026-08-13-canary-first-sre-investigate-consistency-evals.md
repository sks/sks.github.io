---
layout: post
title: "Canary First: Lessons from Black-Box Consistency Evals for Live SRE Investigate"
date: 2026-08-13 18:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 44
description: "Canary-first evals for live SRE investigate: check the canary before burning judge tokens, and never treat a draft RCA as done."
image: /assets/images/og-default.png
tags: [ai-agents, sre, evaluation, consistency, tokenomics, incident-response, observability, aiden, production, rca]
permalink: /blog/canary-first-sre-investigate-consistency-evals/
faqs:
  - question: "What is a black-box consistency eval for SRE investigate?"
    answer: "A live check that discovers an active alert, runs investigate multiple times with a forced fresh thread, judges each structured RCA against a quality rubric, and requires the root causes to concur — without mocking the product path."
  - question: "Why run a canary before a full ×3 consistency eval?"
    answer: "One live investigate with structural checks (completed status + root cause present) proves the path works without burning LLM judge or concurrence tokens. Fix pollers and auth before you pay for three scored RCAs."
  - question: "Why is draft a dangerous terminal status for investigation polling?"
    answer: "Agents often write structured RCA text while status is still draft. If your poller treats draft-plus-root-cause as done, you score incomplete work, fail gates, and falsely blame the agent."
  - question: "Should quiet nights fail the nightly eval?"
    answer: "Usually no. No active alerts is an environment condition. Warn by default; only hard-fail when operators explicitly require an alert to exist."
  - question: "How is consistency different from correctness for SRE agents?"
    answer: "Correctness asks whether one RCA matches a rubric. Consistency asks whether three independent investigates on the same alert land on the same story — high scores that disagree still fail the product bar."
---

Passing unit tests does not establish that the live **Investigate** workflow still works in the internal test environment.

While wiring a nightly black-box check—one that exercises the product through its external interfaces—for [Aiden](/blog/aiden-platform/)'s site reliability engineering (SRE) investigation path, we selected an active alert, started fresh investigations, judged each structured root cause analysis (RCA), and checked whether the conclusions agreed. The first continuous integration (CI) run failed because the harness misread an intermediate status. A later local full pass succeeded after the poller was corrected; that does not establish nightly reliability across alerts.

This sits next to [benchmarks for wall time and tool tax](/blog/ai-sre-agent-benchmarks-wall-time-tools-tokens/) and [“is the task actually done?”](/blog/is-the-task-actually-done/). Different axis: not “how expensive was the dig,” but **“does the live product path still produce stable RCAs tonight?”**

---

## What the trial showed

- **Canary before full.** One live investigate + structural checks first. Spend judge tokens only after the path is honest.
- **Draft is not done.** RCA text can appear while status is still in progress. Poll for a real terminal success state.
- **Sync failure ≠ empty queue.** Prefer discover from existing alerts over blocking on a flaky sync.
- **Correctness ≠ consistency.** Three high scores that tell different stories still fail.
- **Quiet nights are untested, not green.** Warn when no active alert is available; make alert availability a hard requirement only if the test contract calls for it.
- **Stream progress logs.** Buffered stdout can make a fifteen-minute poll appear stalled.

Run one investigation to verify authentication, alert discovery, polling, and a terminal success state before paying for repeated model-judged trials. Text in a draft root cause analysis (RCA) is not a terminal state.

---

## What the test was intended to catch

We wanted a nightly check through the same product interfaces an operator uses:

1. Find an active alert (Grafana-backed preferred, any active alert acceptable).
2. Start investigate with a forced new thread — **repeat**.
3. Wait until structured RCA is actually finished.
4. Score each write-up against a quality rubric (not a curated golden RCA for one famous incident).
5. Require the root causes to **concur**.

This tests the live workflow rather than comparing model quality in isolation. Related: [demo → deploy receipts](/blog/demo-to-deploy-receipts/) — polite demos hide the failure modes that only show up when you hit the real button.

---

## Lesson 1 — Canary first, tokens second

The full path uses both live investigation wall time and large language model (LLM) judge and concurrence calls.

Running three investigations immediately cost time and model calls before we had checked:

- Auth headers actually reach the SRE app
- Alerts exist tonight
- Investigate returns an id
- Polling reaches a real success state

**Canary mode** flipped the order:

| Mode | Live investigates | LLM judge | Concurrence | Goal |
|------|-------------------|-----------|-------------|------|
| **Canary** | One | No — structural score only | Skipped | Path smoke |
| **Full** | Several | Yes | Hard checks + LLM yes/no | Nightly bar |

The structural check requires a successful terminal status **and** root cause text. It catches some poller and authentication failures without paying for model judges, but it does not assess the root cause itself.

**Finding.** Tokenomics for evals is the same discipline as [tokenomics for agents](/blog/maintaining-tokenomics-with-aiden/): do not spend the expensive pass until the cheap pass is green.

---

## Lesson 2 — Draft is not done

The most expensive bug was conceptual.

The agent often writes `structured_rca` — including a plausible root cause — while the investigation status is still **draft**. Our poller treated “terminal status + has root cause” as finished, and listed draft among the terminal set.

Result:

- Canary/full scored incomplete work as a hard failure (“ended with status draft”)
- CI failed even when later repeats completed cleanly
- We almost “fixed” the agent instead of the eval

**Finding.** Intermediate states that look “done enough” will fool every black-box harness. Done means the **product** status you show operators when the case is closed — not the first moment prose appears.

Same family of mistake as trusting a tool loop that printed an answer and never called the completion gate.

---

## Lesson 3 — Sync warnings are not environment failure

Full mode optionally syncs Grafana alerts before discover. On our dogfood, sync often **failed** while active alerts were already sitting in the queue.

If you treat sync failure as fatal, every quiet-looking night becomes a red build — even when investigate would have worked. Better shape:

- Try sync
- On failure, **warn and continue**
- Discover from whatever is already active
- Only then decide “quiet night”

**Finding.** Distinguishing **infra flake**, **empty queue**, and **agent regression** is the whole point of a nightly. Collapse those three and you train the team to ignore the pager.

---

## Lesson 4 — Correctness and consistency are different gates

After the poller fix, a full local pass looked like this in spirit (qualitative):

- Three investigates completed
- Each scored well against the rubric
- Concurrence said yes — same mechanism story, same locus class, honest about what was unverified

That was the cross-run agreement check for this alert. Three agreeing RCAs on one alert support a narrow consistency claim; they do not prove correctness or stability across different alerts.

**Finding.** High mean correctness with disagreeing roots is still a fail. Consistency is a **cross-run** property. Related: [curiosity before confidence](/blog/curiosity-before-confidence/) — fluent disagreement is still disagreement.

---

## Lesson 5 — Quiet nights and config drift

Two more configuration risks:

1. **No active alerts.** Default to warn-only. Require an alert only when someone is deliberately red-teaming the queue.
2. **Integration name drift.** Config said one Grafana integration name; live alerts labeled another. Filter no-ops, then fall back to “any active.” Document the live name or you will debug ghosts.

Also: **unbuffered stdout**. A long poll with buffered logs looks hung. We killed a healthy run once because the terminal was silent. Always force line-buffered progress for live evals.

---

## Practical checklist

For any live “button path” eval on an agent product:

1. **Canary** — one real call, structural success only, no judge panel  
2. **Terminal states audited** — exclude in-progress statuses that already carry partial output  
3. **Environment vs product** — sync flake and empty queues are not agent fails  
4. **Repeat + concur** — correctness per run, consistency across runs  
5. **Opt-in strict emptiness** — quiet nights warn unless forced  
6. **Unbuffered logs** — if you cannot see poll ticks, you will sabotage yourself  

Then schedule the expensive full mode nightly. Keep canary for PR confidence and “did we break dogfood?” mornings.

---

## Lessons learned

1. **Black-box nightlies catch what unit tests cannot** — especially status machines and auth headers.  
2. **Canary first** — prove the path before you buy judge tokens.  
3. **Draft ≠ done** — partial RCA text is not a closed investigation.  
4. **Sync fail ≠ no alerts** — discover from the queue you have.  
5. **Consistency is concurrence**, not three independent beauty contests.  
6. **Warn on quiet nights**; hard-fail only when operators ask.  
7. **Unbuffered progress** is part of the harness, not a nice-to-have.

Next steps are broader alert coverage, a cheaper deterministic agreement check before the LLM yes/no, and a more reliable sync path. The canary limits wasted judge calls, but a pass on one alert remains narrow evidence.

---

> StackGen develops AI tools for site reliability engineering (SRE), including incident triage and diagnostic workflows. Product details are at [ai.stackgen.com](https://ai.stackgen.com).

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

Unit tests green does not mean the **Investigate** button still works on dogfood.

We learned that the hard way while wiring a nightly black-box check for [Aiden](/blog/aiden-platform/)'s SRE investigate path: pick any active alert, force a fresh investigation a few times, judge each structured RCA, and ask whether the stories **concur**. The first CI run was red for the wrong reasons. The second local full pass was green — but only after we stopped lying to ourselves about what “done” means.

This sits next to [benchmarks for wall time and tool tax](/blog/ai-sre-agent-benchmarks-wall-time-tools-tokens/) and [“is the task actually done?”](/blog/is-the-task-actually-done/). Different axis: not “how expensive was the dig,” but **“does the live product path still produce stable RCAs tonight?”**

---

## TL;DR

- **Canary before full.** One live investigate + structural checks first. Spend judge tokens only after the path is honest.
- **Draft is not done.** RCA text can appear while status is still in progress. Poll for a real terminal success state.
- **Sync failure ≠ empty queue.** Prefer discover from existing alerts over blocking on a flaky sync.
- **Correctness ≠ consistency.** Three high scores that tell different stories still fail.
- **Quiet nights should warn, not page.** Empty alert queues are environment — make hard-fail opt-in.
- **Unbuffered logs or you are flying blind.** Buffered stdout turns a fifteen-minute poll into a “hung” mystery.

### Explain like I'm five

Before you grade three book reports with a fancy teacher, check that the printer still prints one page. And do not call the report finished just because someone scribbled the ending while the cover still says “draft.”

---

## What we were trying to catch

We wanted a **black-box** nightly that exercises the same path an operator uses:

1. Find an active alert (Grafana-backed preferred, any active alert acceptable).
2. Start investigate with a forced new thread — **repeat**.
3. Wait until structured RCA is actually finished.
4. Score each write-up against a quality rubric (not a curated golden RCA for one famous incident).
5. Require the root causes to **concur**.

That is a product gate, not a model bake-off. Related: [demo → deploy receipts](/blog/demo-to-deploy-receipts/) — polite demos hide the failure modes that only show up when you hit the real button.

---

## Lesson 1 — Canary first, tokens second

The full path is expensive in **two** currencies: live investigate wall clock, and LLM judge / concurrence calls.

Our first instinct was “just run ×3.” That burned time and tokens before we had proven:

- Auth headers actually reach the SRE app
- Alerts exist tonight
- Investigate returns an id
- Polling reaches a real success state

**Canary mode** flipped the order:

| Mode | Live investigates | LLM judge | Concurrence | Goal |
|------|-------------------|-----------|-------------|------|
| **Canary** | One | No — structural score only | Skipped | Path smoke |
| **Full** | Several | Yes | Hard checks + LLM yes/no | Nightly bar |

Structural score means: completed successfully **and** root cause text is present. Ugly? Yes. Cheap? Also yes. It catches poller and auth bugs without paying a panel.

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

That is the bar we care about for on-call assist. A single pretty RCA is a demo. Three agreeing RCAs are a product.

**Finding.** High mean correctness with disagreeing roots is still a fail. Consistency is a **cross-run** property. Related: [curiosity before confidence](/blog/curiosity-before-confidence/) — fluent disagreement is still disagreement.

---

## Lesson 5 — Quiet nights and config drift

Two more footguns:

1. **No active alerts.** Default to warn-only. Require an alert only when someone is deliberately red-teaming the queue.
2. **Integration name drift.** Config said one Grafana integration name; live alerts labeled another. Filter no-ops, then fall back to “any active.” Document the live name or you will debug ghosts.

Also: **unbuffered stdout**. A long poll with buffered logs looks hung. We killed a healthy run once because the terminal was silent. Always force line-buffered progress for live evals.

---

## Practical checklist (steal this)

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

We still have homework — alert diversity so we do not always pick the same Node Not Ready, cheaper hard concurrence before the LLM yes/no, and fixing the sync path so full mode does not waste wall clock. The important shift already landed: the nightly asks a product question, and the canary keeps that question affordable.

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

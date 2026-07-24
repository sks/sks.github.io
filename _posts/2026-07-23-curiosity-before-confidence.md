---
layout: post
title: "AI Agent Root Cause Analysis — Curiosity Before Confidence"
date: 2026-07-23 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 26
description: "AI agent root cause analysis for SRE: soft prompts don't stop bad RCAs — curiosity checklists, hard gates, and batched validation before confident narratives."
image: /assets/images/og-evidence-rca.png
tags: [ai-agents, root-cause-analysis, sre, incident-response, on-call, evaluation, prompt-engineering, production, aiden, compound-ai]
permalink: /blog/curiosity-before-confidence/
---

**AI agent root cause analysis (RCA)** fails the same way demos succeed: the model sounds sure before the investigation earned it. Soft prompts teach manners. They do not enforce curiosity.

We kept adding instructions — longer investigator DNA, more “never claim root cause until…” paragraphs, another skill that explained claim grades in plain English. The [AI agents for SRE](/topics/ai-agents-sre/) stayed fluent. They still closed strong incidents with homework left on the table.

The uncomfortable lesson: **soft prompts teach manners; they do not enforce curiosity.** Confidence without unfinished digs is not rigor — it is a well-written shrug.

And shrugs at 3 AM are expensive. A premature, highly confident (but wrong) RCA does not merely waste tokens. It sends tired humans down the wrong rabbit hole while the real failure keeps burning. After one or two of those nights, operators stop arguing with the agent — they **disable it**. Trust is the product. Fluency without curiosity spends it.

---

## TL;DR — Soft Prompts vs Hard Gates for AI RCA

- **Prompt inflation is a coping mechanism.** Every bad RCA tempts another paragraph. The model skims it under load.
- **Fail-closed at the tool boundary**, not in the essay. If a strong claim cannot pass a machine check, reject the claim — do not hope the next turn “remembers.”
- **One gap per rejection is how agents thrash.** Return the whole homework list once so a retry can fix many mistakes in one shot.
- **Co-occurrence is not cause.** Seeing two signals fire together is a weaker claim than proving a shared entity or a mechanism that survives time.
- **Empty is not skip.** “We checked competing branches and found none open” is work. Skipping the checklist because the story feels obvious is not.

### Explain like I'm five

Before you get a gold-star sticker that says “we know what broke,” you have to finish your homework checklist: look in the rooms that matter, write down what you could not open, and do not invent a villain because the story felt done. The sticker is **confidence**. The checklist is **curiosity**. Soft reminders on the fridge (“remember your homework!”) help. A teacher who will not stamp the sticker until the checklist is done is what production needs.

---

## The Failure Mode: AI Investigators Closing RCA With Homework Left

Picture a familiar on-call night:

1. Alert fires. Symptom is real.
2. Two services look guilty in the same window.
3. Logs for the confirming hop are thin or blind.
4. The model writes a decisive RCA anyway — polite hedges buried below the fold.
5. An operator opens the same dashboard and asks the question the agent never did.
6. Next week, someone mutes the agent channel “until we trust it again.”

We already knew the **looks-right heuristic**: report-shaped prose is not proof. What surprised us was how often the agent had *almost* done the right work — then skipped the boring last questions because the narrative felt done.

Curiosity is not vibes. Curiosity is a **checklist of digs that must be attempted, blocked, or answered** before you are allowed to sound sure. If those digs stay undone — never tried — a “probable” headline is premature theater.

Humans enforce this in good war rooms with peer pressure. Models need something colder.

This sits next to [evidence-gated multi-plane RCA](/blog/evidence-gated-multiplane-rca/) and [hypothesis-driven debugging for AI SRE](/blog/hypothesis-ladder/). Those posts covered stages and elimination order. This one is about what happens when you try to *sermon* your way out of early closure — and what actually moved the needle.

---

## Soft Prompts Teach; Hard Gates Enforce AI RCA Discipline

We tried the soft path first — because it is cheap and feels virtuous.

| Soft approach | What actually happens |
| --- | --- |
| Add another “FORBIDDEN until…” paragraph | Skipped when context is crowded |
| Restate claim grades in the persona | Recited, then ignored at submit time |
| Hope the model “thinks on itself” | Excellent essays; uneven compliance |

The durable move is the same pattern we keep returning to for **production AI agents**: **let the model propose; let the runtime adjudicate.**

In plain English: before a strong confidence label (“probable,” “confirmed,” “root cause”) is allowed into the operator-facing summary, the submit path must **fail closed** on missing homework — reject the claim unless the checks pass. The prose can still be eloquent. Eloquence is no longer the pass condition.

Related: [production-ready AI agents need receipts, not fluent demos](/blog/demo-to-deploy-receipts/). Receipts are how you prove a prior step happened. Sermons are how you ask nicely.

---

## Why One Validation Error at a Time Makes AI Agents Thrash

Here is a second failure mode that looks like “the model is dumb” when it is really **your error UX** for tool-calling agents.

Gate returns: “missing field A.”

Agent fixes A. Resubmits.

Gate returns: “missing field B.”

Agent fixes B. Resubmits.

Gate returns: “temporal story conflicts with recovery.”

Tokens burn. Latency climbs. The pager is still open. The investigator learns the wrong lesson: *compliance is a maze.*

Independent gaps should arrive **in one rejection**. That is not a nicety — it is an orchestration tax cut. A single retry that lists every unfinished dig beats a polite drip of surprises.

Illustrative shape only — not a product schema:

```json
// Thrash: one surprise per round-trip
{"ok": false, "error": "missing dig: confirm log plane"}

// Steer once: whole homework list
{"ok": false, "errors": [
  "missing dig: confirm log plane",
  "missing dig: name the failing entity",
  "story conflicts with self-clearing symptom"
]}
```

This generalizes beyond incident RCA. Any tool-facing agent that validates multi-field payloads will thrash if your validators exit on the first smell. Batch the rejection. Steer once. Move on.

---

## Claim Grades for AI Root Cause Analysis

Operators do not need our internal vocabulary. They need honesty about **how strong a sentence is allowed to be** in an AI-written RCA.

A practical ladder of belief — the *idea*, not a schema:

1. **Observation** — we saw a signal in a window.
2. **Candidate** — two things happened near each other; mechanism is still a guess.
3. **Grounded** — we joined the story to a shared entity or a checkable causal receipt, not just a coincidence.
4. **Ruled out** — we looked; this branch lost.

The production bug is promoting (2) with the language of (3). Co-occurrence is cheap. Mechanism is expensive. If your agent cannot tell those apart in the write-up, humans stop trusting the channel — and trust is what keeps the agent in the on-call loop.

Time is a falsifier too. A mechanism that *should persist without remediation* cannot lead a confident RCA after the symptom self-clears — unless evidence explains why the mechanism ended. Stories that ignore recovery are fiction with timestamps.

---

## Empty Checklist Is Not Skipped Curiosity

Another trap: treating “no open branches” as a free pass to skip the discipline that would have recorded them.

There are two different states:

- **Affirmed empty** — we ran the competing-hypothesis checklist; none remain open; here is proof we did that work.
- **Never asked** — we jumped to a favorite story and never opened the checklist.

Those must not look the same to the runtime. Otherwise every confident agent invents a shortcut: omit the boring bookkeeping, claim the room was already clean.

You can debate *how* to prove prior work. The product requirement is simpler: **strong RCA claims require evidence that the curiosity step ran**, including when the answer was “nothing left open.”

---

## How Do You Stop AI Agents From Closing Root Cause Analysis Too Early?

A short practitioner checklist:

1. **Treat strong labels as promotions**, not vibes — probable / confirmed / root cause must pass machine checks.
2. **Batch validation gaps** so one retry fixes the homework list, not a maze of one-field surprises.
3. **Grade every sentence** — observation, coincidence, and mechanism are different claims.
4. **Let time veto bad stories** — persistent mechanisms vs self-clearing symptoms need reconciliation.
5. **Require proof curiosity ran** — including when the checklist is affirmatively empty.
6. **Optimize for operator trust**, not demo green. Wrong-but-confident burns the channel faster than honest unknown.

---

## What We Deliberately Did Not Do

A few anti-patterns we rejected while hardening AI RCA agents:

- **More megaprompt as the primary control.** Skills still matter for vocabulary and taste. They are not the lock on the door.
- **Trusting summary prose to self-police.** Presentation can rewrite hedges; it cannot invent missing digs after the fact.
- **Confusing “how strong is this sentence?” with “which branches did we eliminate?”** Claim grades and competing-branch checklists answer different questions. One does not substitute for the other.
- **Optimizing for demo green.** A gate that is easy to satisfy with empty shells will ship confidence and spend trust.

We also left some engineering trade-offs for later — short-lived proofs of prior work are simpler than shared durable state and fail differently when you run many instances. That is a scaling conversation, not an excuse to skip the gate.

---

## Lessons That Generalize Beyond One Stack

**1. Curiosity is a first-class exit criterion.** If required digs were never tried, you are not done — regardless of how good the narrative sounds.

**2. Batch the rejection.** Multi-field tool contracts should return every independent gap once. Serial surprises train thrash.

**3. Grade the sentence.** Observation, coincidence, and mechanism are different claims. Force the write-up to match the grade you earned.

**4. Let time veto bad stories.** Persistent mechanisms and self-clearing symptoms are in tension until evidence reconciles them.

**5. Affirmed empty ≠ skipped.** “Nothing open” must be the *result* of a check, not the *absence* of one.

**6. Prompts scale poorly under incident load.** Put the hard stop at the boundary where promotion happens — before confidence reaches the human.

**7. Operator trust is the SLO.** Wrong-but-confident RCA burns it faster than slow-but-honest unknown.

---

## Related reading

- [Evidence-gated RCA — prove, then narrate](/blog/evidence-gated-multiplane-rca/)
- [The hypothesis ladder for AI SRE root cause analysis](/blog/hypothesis-ladder/)
- [From demo to deploy — failure modes with receipts](/blog/demo-to-deploy-receipts/)
- [AI incident triage for SREs — what actually helps on-call](/blog/ai-incident-triage-sre/)
- Topic hubs: [AI agents for SRE](/topics/ai-agents-sre/) · [multi-stage AI agent workflows](/topics/ai-agent-workflows/)

Confidence is cheap. Curiosity is the scarce resource. Ship the second first — or operators will ship the mute button.

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

*Does your AI investigator close RCA with digs still never tried — or refuse confidence until curiosity is exhausted? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

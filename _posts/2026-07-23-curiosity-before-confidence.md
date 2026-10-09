---
layout: post
title: "AI Agent Root Cause Analysis — Curiosity Before Confidence"
date: 2026-07-23 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 26
description: "For AI-assisted incident analysis, record required checks, return missing fields together, and limit confidence to what the evidence supports."
image: /assets/images/og-evidence-rca.png
tags: [ai-agents, root-cause-analysis, sre, incident-response, on-call, evaluation, prompt-engineering, production, aiden, compound-ai]
permalink: /blog/curiosity-before-confidence/
---

A root-cause analysis (RCA) should explain an incident using observations, not just a plausible story. While building [AI agents for site reliability engineering (SRE)](/topics/ai-agents-sre/)—software operations and incident response—we found that instructions to “check everything before claiming a cause” did not consistently prevent early conclusions.

A wrong RCA can send responders toward the wrong service. The practical question is what checks must be recorded before a high-confidence claim reaches them, and how to report a gap without pretending it was filled.

---

## Checks before a strong claim

A prompt can request careful investigation, but the submission path can also check for recorded work. A **gate** is such a check: it refuses a “probable” or “confirmed” label if required evidence or attempted probes are missing. A gate cannot prove a cause merely because fields are populated. It can, however, expose skipped work, return all missing items at once, and distinguish “checked and empty” from “never checked.”

---

## The Failure Mode: Closing an RCA With Checks Unfinished

Picture a familiar on-call night:

1. Alert fires. Symptom is real.
2. Two services look guilty in the same window.
3. Logs for the confirming hop are thin or blind.
4. The model writes a decisive RCA anyway — polite hedges buried below the fold.
5. An operator opens the same dashboard and asks the question the agent never did.
6. Next week, someone mutes the agent channel “until we trust it again.”

A report that looks complete is not necessarily supported by evidence. What surprised us was how often the agent had *almost* done the right work — then skipped the boring last questions because the narrative felt done.

Here, “curiosity” means a **list of checks that must be attempted, blocked, or answered** before a strong claim is submitted. If a required check was never tried, a “probable” headline needs to be withheld or qualified.

Human responders can question a conclusion in real time; an automated investigator also needs inspectable criteria before it publishes one.

This builds on [evidence-gated RCA across several data sources](/blog/evidence-gated-multiplane-rca/) and [hypothesis-driven debugging](/blog/hypothesis-ladder/). Those posts cover stages and elimination order. Here the question is what a check at submission time can catch that instructions alone did not.

---

## Instructions and submission checks serve different purposes

We tried the soft path first — because it is cheap and feels virtuous.

| Soft approach | What actually happens |
| --- | --- |
| Add another “FORBIDDEN until…” paragraph | Skipped when context is crowded |
| Restate claim grades in the persona | Recited, then ignored at submit time |
| Hope the model “thinks on itself” | Excellent essays; uneven compliance |

A more reliable division of labor is to let the model propose a finding and let the runtime—the software that runs the workflow—check whether required records exist.

In plain English: before a strong confidence label (“probable,” “confirmed,” “root cause”) is allowed into the operator-facing summary, the submit path must **fail closed** on missing homework — reject the claim unless the checks pass. Passing the structural check still does not establish causality; reviewers must examine the evidence and its fit to the claim.

Related: [production-ready AI agents need receipts, not fluent demos](/blog/demo-to-deploy-receipts/). Receipts are how you prove a prior step happened. Sermons are how you ask nicely.

---

## Return independent validation errors together

A validator can cause avoidable retries when it reveals one missing field per submission.

Gate returns: “missing field A.”

Agent fixes A. Resubmits.

Gate returns: “missing field B.”

Agent fixes B. Resubmits.

Gate returns: “temporal story conflicts with recovery.”

Tokens burn. Latency climbs. The pager is still open. The investigator learns the wrong lesson: *compliance is a maze.*

Independent gaps should arrive **in one rejection**. Returning all independent errors at once can reduce repeated model calls. Some later checks may still depend on fields fixed in an earlier round.

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

This also applies to other tools that validate multi-field submissions: report independent missing fields together rather than one per attempt.

---

## Claim Grades for AI Root Cause Analysis

Operators do not need our internal vocabulary. They need honesty about **how strong a sentence is allowed to be** in an AI-written RCA.

A practical ladder of belief — the *idea*, not a schema:

1. **Observation** — we saw a signal in a window.
2. **Candidate** — two things happened near each other; mechanism is still a guess.
3. **Grounded** — records connect the proposed explanation to the affected entity and time; a shared identifier alone may still not prove cause.
4. **Ruled out** — a specific check contradicted this explanation within the data available.

The mistake is describing (2) with the language of (3). Two events occurring together are not proof of a mechanism. Make that distinction explicit in the write-up so responders can decide what to test next.

Time can challenge a theory. If the proposed mechanism would persist without intervention but the symptom cleared, the report needs an explanation for that mismatch. Recovery alone does not identify the cause.

---

## Empty Checklist Is Not Skipped Curiosity

Another trap: treating “no open branches” as a free pass to skip the discipline that would have recorded them.

There are two different states:

- **Checked, none remaining** — the recorded competing-explanation checks found no open branches within their scope.
- **Never asked** — we jumped to a favorite story and never opened the checklist.

Those must not look the same to the runtime. Otherwise every confident agent invents a shortcut: omit the boring bookkeeping, claim the room was already clean.

You can debate *how* to prove prior work. The product requirement is simpler: **strong RCA claims require evidence that the curiosity step ran**, including when the answer was “nothing left open.”

![RCA submission flow showing required digs, batched validation gaps, and the difference between skipped and checked-empty curiosity.](/assets/images/diagrams/july-investigation/curiosity-before-confidence.svg)

*Diagram: The arrows move a candidate claim through required digs and a submission gate; the lower path distinguishes a skipped checklist from an affirmatively checked-empty one before allowing stronger wording.*

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

**3. Grade each claim.** An observation, two events occurring together, and a supported mechanism require different wording.

**4. Let time veto bad stories.** Persistent mechanisms and self-clearing symptoms are in tension until evidence reconciles them.

**5. Checked and empty is not skipped.** “Nothing open” must follow recorded checks within their stated scope, not merely an omitted list.

**6. Do not rely only on instructions.** Check required records when a claim is submitted, before it is presented with a strong confidence label.

**7. Review operator impact.** Track whether conclusions help responders, including false confidence and honest unresolved cases; no single score captures trust.

---

## Related reading

- [Evidence-gated RCA — prove, then narrate](/blog/evidence-gated-multiplane-rca/)
- [The hypothesis ladder for AI SRE root cause analysis](/blog/hypothesis-ladder/)
- [From demo to deploy — failure modes with receipts](/blog/demo-to-deploy-receipts/)
- [AI incident triage for SREs — what actually helps on-call](/blog/ai-incident-triage-sre/)
- Topic hubs: [AI agents for SRE](/topics/ai-agents-sre/) · [multi-stage AI agent workflows](/topics/ai-agent-workflows/)

Before a confident RCA is published, make the attempted checks and remaining gaps visible. That gives a responder a basis to accept, challenge, or defer the conclusion.

---


*Does your AI investigator close RCA with digs still never tried — or refuse confidence until curiosity is exhausted? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> **StackGen is building AI-assisted incident triage.** Our offering aims to help teams run diagnostics and draft RCA reports; operators should still verify consequential findings. See [ai.stackgen.com](https://ai.stackgen.com).

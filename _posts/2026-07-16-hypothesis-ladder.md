---
layout: post
title: "The Hypothesis Ladder — Ruling Things Out Before You Narrate"
date: 2026-07-16 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 23
description: "A structured way to investigate service incidents: identify the affected system and onset, test competing explanations, and report uncertainty."
image: /assets/images/og-evidence-rca.png
tags: [sre, incident-response, root-cause-analysis, ai-agents, on-call, hypothesis-driven-debugging, production, aiden]
permalink: /blog/hypothesis-ladder/
faqs:
  - question: "What is the hypothesis ladder in AI RCA?"
    answer: "Identify the affected system and onset, test competing explanations with available data, and keep conclusions within what the checks support."
  - question: "Why do agents latch onto the first plausible story?"
    answer: "Fluency is not evidence. Models often write an RCA-shaped paragraph around a recent deploy before elimination work finishes."
  - question: "Is a longer prompt the fix for early narrating?"
    answer: "A longer prompt alone may not prevent early conclusions. Record competing explanations and check required evidence before accepting a strong claim."
---

A root-cause analysis (RCA) explains why an incident happened. An AI investigator can write one before it has checked alternatives. In our work on [AI agents for site reliability engineering (SRE)](/topics/ai-agents-sre/)—software operations and incident response—we saw the model favor a recent deployment even when the available measurements did not yet support that explanation.

We used a **hypothesis ladder** to structure the search: identify the affected system and start time, test competing explanations, then write a conclusion no stronger than the evidence. It does not make every cause discoverable; it makes an unresolved cause easier to report honestly.

This builds on [AI incident triage](/blog/ai-incident-triage-sre/) and [evidence-gated RCA](/blog/evidence-gated-multiplane-rca/): an investigation should test alternatives before presenting a causal story.

---

## Start with the symptom

If a smoke alarm sounds, locate the smoke and establish when it appeared before naming the appliance. The equivalent for a service incident is to record the affected service, measurement, and onset. A workflow controller can require those fields before it accepts a causal claim; it cannot manufacture evidence that is missing.

---

## The Failure Mode: First Plausible Story Wins

Human on-call teams know the trap. Alert fires. Someone says "probably the deploy." Forty minutes later you are still arguing about that story while the real epicenter smolders — a shared dependency, a mis-scoped metric, a blast radius that does not match the ticket.

A large language model (LLM) can amplify that trap: a sentence naming a service, a change, and a dependency *looks* like an RCA even when none of those links has been tested.

> **The trap in action**
>
> **Alert:** `API 5xx spike on PaymentGateway`
>
> **The hasty conclusion:** *"Likely caused by the v2.4.1 deploy ten minutes ago. Recommend rollback."*
>
> **Illustrative alternative:** Suppose the deploy only changed CSS, while connection logs showed an expired database certificate. Checking identity and onset would distinguish the two; the alert alone would not.

A useful cycle is **theory, prediction, attempted disproof, repeat**. During a live incident, complete understanding may be out of reach. The immediate goal is a testable explanation or a clear statement of what remains unknown and what to check next.

That discipline is old. Making an AI investigator **obey** it in production is the hard part.

---

## What a Hypothesis Ladder Is (Without the Whiteboard)

SRE teams have sketched incident hypothesis trees for years: symptom at the root, broad categories branching out, leaves that must be **tested or marked unknown** — not skipped because someone already likes a story.

The **ladder** adds an order to those checks:

1. **Frame** — what broke, for whom, according to which measurement, and starting when?
2. **Eliminate cheaply** — rule out obvious branches with the smallest queries that could falsify them.
3. **Compete in parallel** — keep multiple mechanisms alive until evidence kills them; do not collapse to one narrative for comfort.
4. **Grade the claim** — events occurring together, moving together over time, and having a causal mechanism support different levels of certainty; the write-up should reflect that distinction.
5. **Stop or escalate honestly** — unknown with ranked next probes beats a confident wrong answer.

The ladder is not a runbook replacement. Runbooks still teach *what* to query for Kafka lag or API error spikes. The ladder teaches *when* you are allowed to say "root cause" at all.

---

## Climb the Boring Steps First (Identity Before Depth)

The recurring mistake was investigating deeply before identifying the fault. A team might open change histories and many monitoring queries before checking which service or instance appears in the measurement that triggered the alert, and when the symptom began.

We enforced a simple ordering rule, expressed in plain language:

- **Who or what is actually failing?** If a short search cannot identify the service or instance, report that gap and say what would resolve it rather than guessing a name.
- **When did it start?** A metric already bad at window open is not the same incident as a sharp step change mid-window.
- **What else could explain it?** Label each competing explanation supported, ruled out, or **untestable with available data**. “Untestable” is not “ruled out.”
- **Only then** examine recent changes: did one precede onset and offer a plausible mechanism, or does it merely coincide with the symptom?

Leading with "what changed?" before those steps is how you get deploy-shaped root causes for problems that live in a shared queue, a mis-tagged pool, or a dependency one hop away.

The order matters because a detailed query about the wrong service can be precise but irrelevant.

---

## Parallel Branches, Not One Hero Narrative

Once framing is solid, the investigator should pursue **competing mechanisms** concurrently — dependency fault, capacity, regression, shared infrastructure when multiple services fail together — rather than one monolithic pass that burns time and tokens and still returns a single guessed story.

| The "hero narrative" (typical AI) | The hypothesis ladder (disciplined investigator) |
| --- | --- |
| Seeks the most plausible story immediately. | Seeks the cheapest falsifying evidence first. |
| Assumes recent changes are the root cause. | Establishes *who* and *when* before opening change timelines. |
| Merges competing ideas into one confident paragraph. | Keeps branches parallel until evidence kills them. |
| Outputs "confirmed root cause" with hedges buried at the bottom. | Outputs "unknown" or "leading hypothesis" with ranked next probes. |

Each branch should follow the same micro-loop:

- **Probe** one mechanism.
- **Try to disprove it** with a planned check when monitoring data can answer.
- **Set aside** a disproved explanation. Mark an untestable one as unknown rather than treating it as disproved.

When two explanations remain plausible, keep both visible and identify a low-cost test that could distinguish them. If the observability stack can run that test, run it. Handing the operator a homework assignment for data you could have fetched is how trust dies at 3 AM.

The AI-specific risk is that a model may combine unresolved alternatives into one tidy paragraph. Keeping a structured list of supported, rejected, and untested explanations outside the generated prose helps prevent that collapse. A controller should accept “unknown” when the necessary checks are unavailable.

---

## Prove First, Narrate Last

A summary written before the checks are complete can make an unsupported explanation look settled. “Telemetry” here means measurements and event records about the system, not a guarantee that all relevant data was captured.

We already wrote about structural gates for multi-stage workflows in [Evidence-Gated RCA](/blog/evidence-gated-multiplane-rca/). The hypothesis ladder applies the same philosophy to **epistemic claims**:

- Durable investigation notes carry the receipts.
- The human-facing summary is **downstream** of what those receipts support.
- Strong language in chat cannot outrun weak evidence in the underlying artifacts.

If event logs or request traces that would confirm the initiating step are unavailable, the write-up stays at **leading hypothesis** or **unknown** — not "confirmed root cause" with a hedge paragraph buried at the bottom.

In practical terms, the software running the workflow checks the recorded results; the model writes within those limits.

---

## What Operators Should Get Every Time

Whether an investigation stops early or runs deep, the human should leave with a **consistent shape** — not a novel every time:

- **Graded certainty** — what we think happened, without one flat confident sentence.
- **Identified blind spots** — retention gaps, missing identity, backends that returned nothing useful.
- **Ranked next actions** — a short list; read-only checks before destructive steps when cause is still unverified.
- **Possible wider impact** — which other users or services might be affected beyond the alert’s narrow label.

A branch marked “checked, nothing found” is useful when it names the check and its limits. It should not be confused with a branch that was never tested.

---

## Lessons That Generalize Beyond Our Stack

**1. Links are not evidence.** Pointing at a dashboard is for humans. If a log row would confirm or refute the mechanism, fetch it or say you could not.

**2. Challenge your leading explanation.** Name the strongest alternative and a check that would change your mind; run it when data is available.

**3. Check the pattern across services.** Simultaneous failures may indicate a shared dependency, but could have other causes; compare affected and unaffected services before settling on one explanation.

**4. Stop with a clear status.** If the available records do not distinguish explanations, say “unknown” and list the next diagnostic checks.

**5. Make checks visible.** Instructions in a prompt can guide an investigation, but recorded checks and explicit stopping rules make it possible to inspect why a headline was allowed.

---

## Related reading

- [AI incident triage](/blog/ai-incident-triage-sre/) — parallel context before the model narrates
- [Evidence-gated RCA](/blog/evidence-gated-multiplane-rca/) — fixed stages and structural evals
- [Your RCA agent needs a map](/blog/agents-need-a-map-not-a-script/) — procedure as reference, not a single megaprompt
- [From demo to deploy](/blog/demo-to-deploy-receipts/) — why fluent output without receipts fails in production
- Topic hubs: [AI agents for SRE](/topics/ai-agents-sre/) · [AI agent workflows](/topics/ai-agent-workflows/)

The ladder orders the investigation and keeps remaining uncertainty visible. It is most useful when the team can inspect the evidence behind each step.

---


*Does your AI investigator stop at “probably the deploy” — or show what it ruled out first? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> **StackGen is building AI-assisted incident triage.** Our offering aims to help teams run diagnostics and draft RCA reports; operators should still verify consequential findings. See [ai.stackgen.com](https://ai.stackgen.com).

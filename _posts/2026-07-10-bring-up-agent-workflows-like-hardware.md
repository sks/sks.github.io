---
layout: post
title: "How to Debug Multi-Stage AI Agent Workflows — Bring Up Like Hardware"
date: 2026-07-10 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 18
description: "Debug multi-stage AI agent workflows by bringing up one stage at a time against golden gates — plus why scoring tool calls beats grading transcripts."
image: /assets/images/og-bring-up-workflows.png
tags: [ai-agents, workflows, evaluation, golang, sre, testing]
---

There's a scene in *Apollo 13* where the crew has to power the command module back up from stone-cold dead, on a battery budget so tight that flipping the wrong switch too early means everybody dies in the dark. They don't just hit the main breaker and vibe. Ken Mattingly sits in a simulator and brings it up **one system at a time, in a precise sequence, under a hard power budget.**

I thought about that scene a lot last week, because I was doing the software version of it: bringing up a [multi-stage agent pipeline](/topics/ai-agent-workflows/) — the kind that takes a screaming alert and walks it through several dependent stages of evidence gathering before it dares to name a root cause.

The instinct that saved me is the oldest one in hardware: **stop running the whole board. Green one rail. Then add the next.**

This post is about why that discipline matters *specifically* for agentic systems — and about the most humbling plot twist of the week, the one where I spent hours interrogating an innocent suspect while the real culprit was standing behind me the whole time. (It was my scorer. The scorer did it.)

---

## The Problem: End-to-End Failures Are a Whodunit Where Everyone Lies

The workflow was a sequential investigation. Each stage depended on the one before it: establish *when* the problem started, then *who* was involved, then corroborate across a second and third data plane, then synthesize an answer. Standard compound-AI shape — a fixed pipeline with a non-deterministic model doing the work inside each node. (I wrote about that architecture in [Evidence-Gated RCA — Prove, Then Narrate](/blog/evidence-gated-multiplane-rca/).)

Here's the trap: when you run all of it and the final answer is wrong, **you have almost no idea who to blame.**

Did the first stage anchor the wrong time window, so every later stage inherited garbage? Did the "who" stage finger the wrong suspect? Did a later stage quietly give up and cover for itself with a confident-sounding summary? A frontier model is the smoothest liar in the building — it will happily narrate a beautiful, plausible conclusion on top of a completely broken middle, look you dead in the eye, and never break character.

So the failure is real, but it's smeared across the entire run. Debugging that is like being handed a dead board and told "it doesn't boot." Great. Where do I even put the probe?

And it gets worse, because every full run:

- **Costs real tokens.** Every stage fans out tool calls. Watching the meter spin like a slot machine while you bisect a bug by brute force is its own little horror film.
- **Is slow.** Minutes per run, not seconds.
- **Is non-deterministic.** Same input, different outcome. One run tells you almost nothing; the next one might disagree with it out of spite.

So the obvious loop — "run it, squint at the transcript, tweak a prompt, run it again" — is expensive, slow, *and* statistically meaningless. You can burn a whole day and genuinely not know whether you fixed the bug or just got a lucky roll.

---

## The Solution: Bring-Up, Not Debugging

The fix was to stop debugging and start doing a board bring-up. Deploy only the first stage. Decide, up front, what "this stage works" actually means — a **golden gate**. Then iterate until it holds, *repeatedly*. Only then add the next stage.

The loop, generically:

1. **Trim the pipeline to level N.** Only the stages up to the one you're proving are powered on.
2. **Run one canary.** One run, scored against the golden gate. If it fails, you fix *that stage* — there is literally nowhere else the bug can hide.
3. **Prove stability.** A single green run is luck. Run it several times back-to-back. A stage is "up" only when it greens *consistently*.
4. **Advance one level.** Redeploy with the next stage added. Repeat until the whole board boots.

A fair question here: if stage 3 depends on stages 1 and 2, how do you test it "in isolation"? You don't — not really. Bring-up is **cumulative, not mocked.** At level N you run stages 1 through N for real and simply don't wire up N+1 onward. I deliberately *avoided* freezing "golden" fixtures of the earlier stages, because with a non-deterministic model those fixtures lie: stage 3 has to survive the actual variance stage 2 produces on a live run, not one pristine cached copy of it. The savings don't come from stubbing the bottom of the ladder — they come from not running the *top* of it, cutting the downstream stages and their tool-call fan-out while you iterate on the rung you're actually proving.

This is where writing the runtime in Go paid off, and not for the reasons people usually cite. The bring-up ladder is *the* canonical Go idiom — a table — and each rung is a stage plus the gate it has to clear:

```go
levels := []struct {
    name  string
    gates []Gate
}{
    {"L1 — anchor the window", []Gate{hasConcreteWindow}},
    {"L2 — name the suspect",  []Gate{hasConcreteWindow, hasRankedSuspect}},
    {"L3 — corroborate",       []Gate{hasConcreteWindow, hasRankedSuspect, hasSecondPlane}},
    // add a rung only after the one above it is repeatably green
}
```

Table-driven bring-up. Add a row, power up a rail. And a `Gate` is just a function over what the agent *did* — a point I'll come back to with a vengeance:

```go
// A Gate scores committed tool calls, never the raw transcript.
type Gate func(effects []ToolCall) Result

func hasConcreteWindow(effects []ToolCall) Result {
    for _, c := range effects {
        if c.Name == "query_metrics" && c.Args.Window != "" {
            return Pass()
        }
    }
    return Fail("stage produced no concrete time window — got a shrug")
}
```

(Illustrative, not the real gate set — the point is the *shape*, not the recipe.) And yes, before anyone says it: these gates are real work. Writing a good one is often harder than writing the prompt, and they rot as requirements drift — a bring-up ladder is a test suite, with all the maintenance tax that implies. I've made my peace with it, because a maintenance tax you pay on purpose beats a 3 AM incident you pay by surprise.

Four things made this dramatically better than end-to-end flailing.

### 1. Failures became attributable (the butler actually did it)

When only stages 1 through N are live and the gate fails, the bug is in stage N. Full stop. No "maybe an earlier stage poisoned the well" — you already greened the earlier stages. Suddenly it's not a whodunit. It's a one-suspect room.

### 2. "Done" got defined *before* the run

A golden gate forces you to write down what success looks like *for that stage* before you execute it. Sounds trivial. It is not. Half the time, articulating the gate — "this stage must produce a concrete time window, not a shrug and the word `unknown`" — revealed that I didn't actually know what the stage was supposed to guarantee. The gate is a mini-spec, and specs-first has a rude habit of finding bugs before the model does.

### 3. Stability replaced vibes

With a non-deterministic model, one passing run is an anecdote wearing a lab coat. You only trust a rail when it comes up clean the same way every single time you cycle the power — not once, but run after run after run. Most agent demos are a single lucky take, screen-recorded. Most agent *outages* are the take nobody re-ran.

How many cycles is "enough"? I won't pretend there's a clean statistical answer — you're not going to run a paid frontier model ten thousand times to pin a confidence interval, and treating a handful of runs as proof of a 99th percentile would be its own kind of lie. The honest heuristic: run it enough that a red result would genuinely *surprise* you, and scale that number to the stage's blast radius. A cheap early stage earns trust quickly. The stage that actually names the culprit — the one an on-call engineer will act on — has to green far more stubbornly before I believe it.

### 4. Cost stayed bounded (respect the amp budget)

Because I only ran the slice I was proving — and could cap how far up the stack I brought things while iterating — I wasn't paying for the full pipeline on every tiny experiment. It's the difference between watching the token meter spin on every runaway full-pipeline rerun and paying for just the one rail you're probing. Ken Mattingly didn't power up systems he wasn't testing, and neither did I.

---

## The Real Bugs It Caught

Bring-up earned its keep by dragging genuine regressions into the light — ones an end-to-end run would have buried under a confident final paragraph:

- A stage anchoring **too narrow a time window**, so downstream correlation missed the actual onset. Investigating an incident with the wrong clock is like reviewing the security footage from *after* the heist.
- A ranking stage picking the wrong signal — the loudest spike instead of the one that actually drove the incident. Correlation cosplaying as causation.
- A later stage quietly taking a **shortcut**: instead of the precise, scoped query the runbook asked for, it reached for a broad, lazy discovery call that technically "worked" but wasn't the disciplined path you want running in front of an on-call engineer at 3 AM.

Each was a one-stage fix, made with confidence, because bring-up told me exactly which rail was smoking.

---

## The Plot Twist: Your Scorer Is Also a Suspect

Here's the lesson I did *not* see coming, and the one I'd most want you to steal.

Partway through, a stage kept failing its gate — even when I read the transcript and the agent had *obviously* done the right thing. Tighten the runbook, re-run, still red. I burned real hours playing bad-cop with a model that hadn't done anything wrong.

The model was innocent. **My scorer was framing it.**

The gate worked by scanning the run's event stream for a forbidden pattern — "did the agent do the thing it shouldn't?" The problem: that same forbidden pattern was *also printed in the runbook I handed the agent* — as the instruction telling it **not** to do that thing. The rule's own wording was sitting right there in the transcript, in plain sight. So every run that correctly *obeyed* the rule still tripped the check, because a dumb string match couldn't tell the difference between **the agent doing X** and **the agent being told, in bold, "never do X."**

I was grading the prompt, not the work. It's the *Minority Report* mistake: arresting someone for a crime that only exists in the pre-cognition transcript, while the actual behavior was spotless.

Once I saw it, I saw it everywhere. A count of "how many times did the agent spawn a sub-task?" was wildly inflated because the phrase appeared all over the instructions and the streaming scaffolding — not just in real invocations. The scorer was reading the *narration* and grading it as *behavior*. My eval had been gaslighting me with my own runbook.

The fix is the reason those gates above take `[]ToolCall` and not a `string`:

> **Grade the agent on what it *did*, not on what it was *told*. Score the effects — the actual tool calls and their arguments — never the raw transcript.**

The transcript is contaminated *by construction*. It contains your instructions, the model's inner monologue, forbidden-pattern warnings, and streamed duplicates of the same event. The *effects* — the concrete actions the agent committed, with their real parameters — are ground truth. Go's type system actually nudges you the right way here: a gate that accepts a typed `[]ToolCall` physically *cannot* accidentally match a warning in the prompt, because the prompt isn't in its arguments. A gate that accepts a raw `string` will betray you the first chance it gets. When I re-pointed every gate at effects instead of text, the phantom failures evaporated and the one *genuine* problem — that lazy shortcut from the section above — stood up in a lineup all by itself.

This is just the agentic version of a sin we already know: asserting on log output instead of on state. We'd never ship a unit test that greps `println` output. It's weirdly easy to forget that when the "state" is a river of streaming JSON and the "log" is a multi-megabyte event dump that happens to contain literally everything.

| You can score on… | What it actually measures | Verdict |
|---------------------|---------------------------|---------|
| The raw transcript / event stream | What the agent was *told* + what it *said* + streaming noise | ❌ **Contaminated** — a witness who overheard the instructions |
| The rendered runbook or prompt | Your own words, read back to you | ❌ **Broken** — you're grading your prompt, not the work |
| The committed tool calls + their arguments | What the agent actually *did* | ✅ **Ground truth** — the only metric that matters |

---

## Lessons Learned

- **Bring up agentic pipelines like hardware.** Green one stage against a golden gate, prove it holds repeatedly, then add the next. End-to-end debugging of a multi-stage agent is a whodunit with an unreliable narrator in every chair.
- **A single green run is an anecdote.** Non-determinism means "it worked once" is noise. Promote a stage only when it's *repeatably* green — clean every time you cycle the power, not just the take you filmed.
- **Define the gate before the run.** Writing down "done" for each stage is a mini-spec that finds bugs before the model does. A table of levels-to-gates keeps it honest.
- **Respect the amp budget.** Only run the slice you're proving; cap how far up you bring things while iterating. Cheap iteration means more iteration.
- **Score effects, not transcripts.** The single highest-leverage fix of the week. Your evals will lie to you with a straight face if they grade the words in the context window instead of the actions the agent actually committed. Make your gates take typed tool calls, not strings.

The best part of bring-up isn't that it finds bugs faster. It's that it turns "it works" from a prayer into a *deposition*. When every rail is green and stable on its own, the full board booting isn't a miracle — it's a formality. That discipline — green rails, effect-based gates, and zero lucky-take demos — is exactly what we're building into our SRE agents, so the person holding the pager gets a deposition instead of a séance. Failure is not an option, and with bring-up, it's not a mystery either.

---

## Related reading

- [Evidence-Gated RCA — Prove, Then Narrate](/blog/evidence-gated-multiplane-rca/) — the compound-AI architecture this bring-up ladder debugs
- [Evidence-Based Verification](/blog/evidence-based-verification/) — don't trust self-report; check systems of record
- More on [AI agent workflows](/topics/ai-agent-workflows/) · full [series](/series/enterprise-ai-agents-go/)

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

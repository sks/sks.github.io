---
layout: post
title: "How We Debug Multi-Stage AI Agent Workflows"
date: 2026-07-10 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 18
description: "How to debug multi-step and multi-stage AI agent workflows and execution logs — green one stage at a time, score tool effects not transcripts."
image: /assets/images/og-bring-up-workflows.png
tags: [ai-agents, workflows, evaluation, golang, sre, testing]
faqs:
  - question: "How do you debug a multi-step AI agent workflow?"
    answer: "Test one stage and its required evidence repeatedly, then enable the next stage. Follow with full runs to check integration."
  - question: "Why not start with only end-to-end runs?"
    answer: "Full runs cost time and model tokens, and their final answers may not show which stage failed. Stage checks help isolate a problem."
  - question: "What should you score when testing agent pipelines?"
    answer: "Check the actual tool calls and required evidence at each stage, not just the agent's description of its work."

---

In *Apollo 13*, the crew works through a power-up sequence under a tight battery budget. That image helped me think about debugging a staged agent workflow: test one dependent stage before paying to run the rest.

I was testing a [multi-stage agent pipeline](/topics/ai-agent-workflows/) that takes an incident alert through dependent evidence-gathering steps before drafting a root cause.

The useful debugging rule was to pass one stage repeatedly, then add the next.

The main surprise was not a model failure. A test that searched the full transcript flagged forbidden wording in the instructions themselves, even though the agent had not taken the forbidden action.

A version of this write-up also lives on StackGen: [How We Debug Multi-Stage AI Agent Workflows](https://stackgen.com/blog/how-we-debug-multi-stage-ai-agent-workflows).

---

## Why a full run was hard to debug

The workflow was a sequential investigation. Each stage depended on the one before it: establish *when* the problem started, then *who* was involved, then corroborate across a second and third data plane, then synthesize an answer. This is a compound AI system: fixed stages with a model performing work inside each stage. (I wrote about that architecture in [Evidence-Gated RCA — Prove, Then Narrate](/blog/evidence-gated-multiplane-rca/).)

Here's the trap: when you run all of it and the final answer is wrong, the final answer alone rarely identifies which stage went wrong.

Did the first stage anchor the wrong time window, so every later stage inherited garbage? Did the "who" stage finger the wrong suspect? Did a later stage quietly give up and cover for itself with a confident-sounding summary? A model can write a plausible conclusion even if a middle stage did not collect the required evidence.

The full run shows a failure, but not which stage introduced it. Stage-level checks give us a place to start.

Full runs also have practical costs:

- **Costs real tokens.** Every stage fans out tool calls. Repeated full runs spend tokens on stages that are not under test.
- **Is slow.** Minutes per run, not seconds.
- **Is non-deterministic.** The same input can produce a different outcome, so a single pass gives limited confidence.

Reading the whole transcript and tweaking a prompt after each run can therefore be slow and misleading. Repeated stage-level checks give a clearer signal, though a small sample still cannot establish a reliability percentile.

---

## Testing stages cumulatively

We ran the first stage alone and defined a **golden gate**—a prewritten check of its required output. After repeat passes, we enabled the next stage and repeated the check.

The loop, generically:

1. **Trim the pipeline to level N.** Only the stages up to the one you're proving are powered on.
2. **Run one canary.** One run, scored against the golden gate. If it fails, inspect that stage and the inputs it inherited; earlier stages can still supply a misleading value despite having passed their own gates.
3. **Prove stability.** A single green run is insufficient evidence of stability. Run it several times back-to-back. A stage is "up" only when it greens *consistently*.
4. **Advance one level.** Redeploy with the next stage added. Repeat until the whole board boots.

This bring-up is **cumulative, not mocked**. To test stage 3, we run stages 1 through 3 for real and leave stage 4 off. We did not freeze outputs from earlier stages because stage 3 must tolerate the variation they produce. Savings come from skipping downstream stages, not from pretending earlier stages have no variance.

![Cumulative stage bring-up moves from time window to identity to corroboration, with repeated golden gates before a full workflow run](/assets/images/diagrams/july-workflows/cumulative-stage-bringup.svg)

*Each slice includes earlier stages for real; only downstream stages are skipped during bring-up.*

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

This is illustrative, not our actual gate set. Gates need maintenance as requirements change, and a tool-call check alone cannot establish that the query returned useful data. They are a test suite, with the same upkeep and false-positive risks as other tests.

The stage checks changed four parts of our debugging loop.

### 1. Failures became easier to localize

Running only stages 1 through N narrows the search. A failed gate at N points to that stage or its inherited inputs; passing earlier gates reduces, but does not eliminate, upstream causes.

### 2. "Done" got defined *before* the run

A golden gate forces you to write down what success looks like *for that stage* before you execute it. Sounds trivial. It is not. Half the time, articulating the gate — "this stage must produce a concrete time window, not a shrug and the word `unknown`" — revealed that I didn't actually know what the stage was supposed to guarantee. The gate is a mini-spec, and specs-first has a rude habit of finding bugs before the model does.

### 3. Stability replaced vibes

One pass cannot establish reliability for a model whose output varies across runs. Repeating the same stage check exposed intermittent failures that a single demonstration would have missed.

We did not derive a statistical pass threshold from these runs. A handful of repetitions cannot establish a 99th-percentile reliability claim. We put more repeated checks on stages with greater operational impact, particularly the stage that names a likely cause, and still required end-to-end testing.

### 4. Iteration cost stayed bounded

Running only the stages under test avoided paying for downstream tool calls on every iteration. The cumulative stages still incurred real cost.

---

## The Real Bugs It Caught

Bring-up earned its keep by dragging genuine regressions into the light — ones an end-to-end run would have buried under a confident final paragraph:

- A stage anchoring **too narrow a time window**, so downstream correlation missed the actual onset. Investigating an incident with the wrong clock is like reviewing the security footage from *after* the heist.
- A ranking stage picking the wrong signal — the loudest spike instead of the one that actually drove the incident. Correlation cosplaying as causation.
- A later stage quietly taking a **shortcut**: instead of the precise, scoped query the runbook asked for, it reached for a broad, lazy discovery call that technically "worked" but wasn't the disciplined path you want running in front of an on-call engineer at 3 AM.

Stage-level traces helped localize each regression; we still checked the downstream behavior after the fix.

---

## When the scorer matched the instructions

The scorer itself needs testing.

A stage kept failing its gate even though its committed tool calls showed the expected behavior. I changed the runbook and reran the stage before checking how the scorer obtained its input.

The agent had followed the instruction; the scorer had matched the instruction text instead of an action.

The gate worked by scanning the run's event stream for a forbidden pattern — "did the agent do the thing it shouldn't?" The problem: that same forbidden pattern was *also printed in the runbook I handed the agent* — as the instruction telling it **not** to do that thing. The rule's own wording was sitting right there in the transcript, in plain sight. So every run that correctly *obeyed* the rule still tripped the check, because a dumb string match couldn't tell the difference between **the agent doing X** and **the agent being told, in bold, "never do X."**

The scorer was grading prompt text along with behavior.

The same issue inflated a sub-task count: the phrase appeared in instructions and streaming scaffolding as well as real invocations. Counting committed spawn calls fixed that measurement.

The fix is the reason those gates above take `[]ToolCall` and not a `string`:

> For action checks, score committed tool calls and their arguments rather than searching a transcript that includes instructions and streaming duplicates. Some outcomes still require checking tool results or external state, not just calls.

The transcript is contaminated *by construction*. It contains your instructions, the model's inner monologue, forbidden-pattern warnings, and streamed duplicates of the same event. Committed tool calls are stronger evidence of attempted actions than narration; they do not by themselves prove the external action succeeded. Go's type system actually nudges you the right way here: a gate that accepts a typed `[]ToolCall` physically *cannot* accidentally match a warning in the prompt, because the prompt isn't in its arguments. A gate that accepts a raw `string` can accidentally match instructions. After I scored committed actions instead of transcript text, the false failures disappeared and the earlier shortcut remained visible.

The distinction is familiar from ordinary testing: a log message is not proof of a state change. Agent event streams make that distinction easy to lose because they mix prompts, generated text, and actions.

| You can score on…                          | What it actually measures                                    | Verdict                                                       |
| ------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------- |
| The raw transcript / event stream          | What the agent was *told* + what it *said* + streaming noise | ❌ **Contaminated** — a witness who overheard the instructions |
| The rendered runbook or prompt             | Your own words, read back to you                             | ❌ **Broken** — you're grading your prompt, not the work       |
| The committed tool calls + their arguments | What the agent actually *did*                                | ✅ **Action evidence** — check results or external state for success |

---

## What the stage tests established

- **Bring up agentic pipelines like hardware.** Green one stage against a golden gate, prove it holds repeatedly, then add the next. End-to-end debugging of a multi-stage agent is a whodunit with an unreliable narrator in every chair.
- **A single green run is an anecdote.** Non-determinism means "it worked once" is noise. Promote a stage only when it's *repeatably* green — clean every time you cycle the power, not just the take you filmed.
- **Define the gate before the run.** Writing down "done" for each stage is a mini-spec that finds bugs before the model does. A table of levels-to-gates keeps it honest.
- **Respect the amp budget.** Only run the slice you're proving; cap how far up you bring things while iterating. Cheap iteration means more iteration.
- **Score actions separately from transcripts.** Typed tool calls avoid matching a warning in the prompt. Check tool results or external state when the requirement is successful execution rather than an attempted call.

Cumulative bring-up shortened our debugging loop and exposed a faulty scorer. It does not replace an end-to-end run: integration, stage handoffs, and the final evidence-backed answer still need testing before an on-call engineer can rely on them.

---

## Related reading

- [Evidence-Gated RCA — Prove, Then Narrate](/blog/evidence-gated-multiplane-rca/) — the compound-AI architecture this bring-up ladder debugs
- [Evidence-Based Verification](/blog/evidence-based-verification/) — don't trust self-report; check systems of record
- [How We Debug Multi-Stage AI Agent Workflows](https://stackgen.com/blog/how-we-debug-multi-stage-ai-agent-workflows) — company-site version of this post
- More on [AI agent workflows](/topics/ai-agent-workflows/) · full [series](/series/enterprise-ai-agents-go/)

---

> We build incident-triage agents at StackGen; the SRE offering is at [ai.stackgen.com](https://ai.stackgen.com).

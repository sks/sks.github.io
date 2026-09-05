# Talk transcript — Conf42 Observability 2026

**Title:** You Can't Debug What You Can't See: Observability for AI Agents  
**Target:** ~27–28 minutes spoken (30-minute slot)  
**How to speak:** The slide already has the dense words. Do **not** read the bullets or tables. Point at the slide, then add a story, a why, or a recent industry beat in plain speech. Let silence sit while people read a table.

**Audience takeaway rule:** every act ends with something they can do Monday. Pause on the starter-set slide so people can screenshot it.

Bracketed cues are for you, not spoken. Timestamps are elapsed talk time at slide start.

---

## Act 1 — Problem + primitives (0:00–6:30)

### Slide 1 — Title · 0:00 · ~40s

Hello everyone. Thanks to Conf42 for having me.

I’m Sabith. I build agent systems at StackGen — mostly in Go — for teams that run this stuff in production, not just demos.

Today I’m going to talk about what breaks when your dashboards are green and the agent is still wrong. We’ll look at traces and a few screens. Nothing live against a cloud account.

[Advance]

---

### Slide 2 — The 3 AM page that looked fine · 0:40 · ~65s

[Let them read the bullets for a beat]

Picture on-call getting a write-up that *sounds* senior. Full sentences. Calm. Confident.

They check the usual place — latency fine, no errors, deps fine. So they trust it.

Then they find out the agent blamed the wrong box, kept poking the same tool, and the bill the next day is ugly.

The line at the bottom is the whole talk in one sentence. Classic monitoring sees “slow request.” It does **not** see “spent a fortune explaining the wrong answer.”

[Advance]

---

### Slide 3 — Agents don't crash · 1:45 · ~50s

[Pause — let them scan the four verbs]

When a microservice dies, you get a restart or a stack. Agents often stay “healthy” while they spin.

They keep calling almost the same tool. They keep talking. They invent a story that reads well. They never actually checked the thing they claimed.

Guides from 2026 keep repeating this: a stuck tool loop often shows up as *slightly worse latency*, not as an error. Your APM stays calm. The agent is still chewing tokens.

You finish the night with a long chat log and a bad answer. No pod crash to point at.

[Advance]

---

### Slide 4 — APM asks vs on-call asks · 2:35 · ~65s

Left side is what we’ve asked for years. Right side is what people ask me after a bad agent run.

I’m not saying throw away latency charts. I’m saying they don’t answer the right-hand column.

Especially that last one — did it actually look at real tool output, or did it just sound sure?

[Advance]

---

### Slide 5 — New primitives · 3:40 · ~55s

[Point at the four rows; don’t read them]

This is the shopping list. Four things we had to add because APM alone wasn’t enough — and the industry caught up to the same list.

MLflow’s 2026 guide puts it bluntly: without span-level traces you’re running a black box. You know something failed; you can’t say why. OpenTelemetry’s GenAI work is standardizing the “what happened” spans — and people in that community still say out loud that *quality* — groundedness, faithfulness — is a separate layer you must add yourself.

Can I replay the whole job, not one HTTP call?  
Can I see which tool ate the money?  
Can I stop a runaway before finance does?  
Can I tell “sounds right” from “checked the data”?

That last line on the slide is the goal for the rest of the talk.

[Advance]

---

### Slide 6 — Cost is the canary · 4:35 · ~50s

We didn’t learn this from a whitepaper. We learned it from invoices — and the rest of the industry is learning it the same way.

You’ve seen the headlines and the GitHub READMEs: agents stuck in retry loops for days, five-figure bills, whole AI budgets burned in a quarter. The quieter math is enough: at current model prices, a few hundred near-identical calls in ten minutes is already tens of dollars — and conventional rate limits don’t fire because each call looks legitimate.

So we put hard stops in the path — max steps, max spend per tool — and we page when one run looks weird next to last week’s average for that agent. Teams publishing in 2026 also say: alert on **tool-loop count**, not only dollars — a healthy run might be a handful of tools; a sick one is dozens, each “fine” by itself.

Money first. Then dig into the trace.

**Takeaway:** ship a spend cap *and* a loop cap before you scale traffic.

[Advance]

---

### Slide 7 — Agenda · 5:25 · ~25s

Quick map. How we wire it. Where the data goes. When the dashboards lie. How we hand a broken run to a human. And a short list you can use on Monday.

[Advance]

---

### Slide 8 — Act 2 divider · 5:50 · ~8s

What we actually put in the product.

[Advance]

---

## Act 2 — What we instrument (6:00–15:20)

### Slide 9 — Session traces · 6:00 · ~55s

[Point at plan / gather / present — don’t recite the table]

Think of one investigation as three chapters, not one span.

First chapter: what are we going after?  
Middle: go fetch. Tools fire.  
Last: write the answer — and show what you based it on.

Kids under those chapters are the model calls and the tools. We stitch hops with OpenTelemetry, and we look at the LLM tree in something Langfuse-shaped. Brand is optional. The chapters aren’t.

**Takeaway:** if you only instrument the final HTTP response, you will never answer “where did the reasoning go wrong.”

[Advance]

---

### Slide 10 — Trace (Segment A) · 6:55 · ~90s

[Recording — point, don’t narrate every label]

Here’s a made-up but realistic tree. Safe for slides — no live cloud.

Top of the gather block: a Grafana query. Same tool again right under it — that’s your “stuck” smell. Present at the bottom has a note that the claims pointed at tools.

On the right you see time and money **per line**. That’s how you answer “which call cost what” without exporting a spreadsheet.

If that pattern shows up and the session is already way over average, you can kill it before you get the forty-thousand-token horror story. One bad retrieval or gather step, amplified across many runs, is how costs jump an order of magnitude — that’s not our metaphor; that’s what span-level cost guides have been warning about this year.

[Advance]

---

### Slide 11 — Tool cost + budgets · 8:25 · ~50s

[Wave at the table]

Two zoom levels. One tool: slow vs chatty vs looping. Whole run: is this weird for *this* agent?

The runtime refuses to go forever. The metrics side tells you when someone is still burning cash anyway. Observability after the fact is not enough anymore — half the new open-source “fuse” tools exist because *alerting* on the invoice is already too late.

**Takeaway:** for every agent, know the healthy tool-call count and alert when a run blows past it.

[Advance]

---

### Slide 12 — Metrics panel · 9:15 · ~40s

Left is burn versus a budget line. Right is a tiny table of who spent what in this run.

That left chart will never show you the wrong RCA text. The tree will. Don’t ask one panel to do both jobs.

[Advance]

---

### Slide 13 — Evidence · 9:55 · ~55s

This is the one people underbuild — and recent eval work explains why.

Nice prose is cheap. Tied to a tool result is not. There’s a 2026 paper line that stuck with me: an LLM judge can score a fluent answer above zero-point-eight-five while the *trace* shows the agent never fetched the thing it claimed. Score on the answer text alone lies. Score on the evidence path doesn’t.

When we present, we ask: did you cite what gather found? If not, don’t call it a win. On the export we sometimes attach a simple grade of the run — not a writing contest.

OpenTelemetry will happily record tokens and latency. It will not, by itself, tell you the answer contradicted the tools. That’s your job.

**Takeaway:** don’t ship “correctness” dashboards that never look at whether gather ran.

[Advance]

---

### Slide 14 — Audit / secrets · 10:50 · ~30s

Keep a log of what ran. Scrub secrets **before** you store it.

If your debug store holds raw keys, the next incident review just got worse.

[Advance]

---

### Slide 15 — Metrics vs traces · 11:20 · ~45s

[Point left column, then right]

Pages and SLOs live here. “Why did it loop?” lives over there.

One hard rule we paid for: don’t put session IDs on Prometheus labels. Tool names are fine. Session IDs blew up our cardinality once. Per-run detail stays in the tree and the logs.

[Advance]

---

### Slide 16 — Dual-sink · 12:05 · ~50s

Go process in the middle. Three exits on purpose.

Tree for the chat and tools. Counters for budgets and health — Grafana, Datadog, whatever you already use. Logs carry the OpenTelemetry id so you can jump from a span to a log line.

If you go hunting LLM steps in the wrong backend, you’ll open a ticket for “missing traces” that aren’t missing.

[Advance]

---

### Slide 17 — Correlation · 12:55 · ~45s

Every outbound hop should carry the standard trace header — MCP, gateway, the lot.

And the id you put in the log must be the same hex id the tracer uses. Not your web framework’s request id. Those look similar and they are not the same string. Mix them and “open logs for this trace” is dead.

[Advance]

---

### Slide 18 — Identity · 13:40 · ~40s

[Image slide]

Trace id alone isn’t enough. We stamp who this work belongs to — session, workflow, stage, persona — on the kids.

Same latency, same tokens, totally different meaning if it’s a helper summary versus the user-facing answer. The 2026 advice from every major guide is the same: put business ids on spans on day one. Retrofitting after an incident hurts.

**Takeaway:** `session_id` + stage on every child span, or you can’t compare runs later.

[Advance]

---

### Slide 19 — Act 3 divider · 14:20 · ~8s

When the numbers look fine and still mislead you.

[Advance]

---

## Act 3 — When visibility lies (14:30–17:40)

### Slide 20 — Scorecard that lied · 14:30 · ~55s

[Let them read the grades]

We built a scorecard. It looked polished. It was wrong.

Math was fine. We scored the wrong pile of spans — mostly little helpers with almost no context. We nearly argued for rolling that “healthy” fleet forward.

The bug was upstream of the chart.

[Advance]

---

### Slide 21 — Missing data · 15:25 · ~55s

[Point at rows]

Empty is not green.

No session stamp → you can’t tell five healthy jobs from one stuck one.  
No tokens → you can’t talk cost.  
No evidence grade → you don’t know correctness.  
No stage → you don’t know which chapter failed.

If coverage is thin, say “unknown.” Don’t invent a A+.

[Advance]

---

### Slide 22 — Rule · 16:20 · ~45s

One sentence, then stop.

Check that your telemetry is honest **before** you grade the agent.

Stamp the chapters when the span starts. Price the tools. Only call it correct when evidence is there.

[Advance]

---

### Slide 23 — Act 4 divider · 17:05 · ~8s

The run already failed. Now what does a human need?

[Advance]

---

## Act 4 — Debug after the fact (17:15–22:30)

### Slide 24 — Support · 17:15 · ~30s

Someone says the AI investigation went wrong.

They remember a *conversation*, not twelve execution ids. Give them one package for the whole thread.

[Advance]

---

### Slide 25 — Trace again · 17:45 · ~50s

Same tree as before. Start here: where it looped, what it cost, whether present cited tools.

[Advance]

---

### Slide 26 — Debug ZIP (Segment B) · 18:35 · ~90s

[Walk the folder on screen]

One zip. Manifest for versions. The graph the UI uses. The event stream so you can replay. Sometimes a short grade of the run.

Same stuff you’d see on the watch page, offline. No guessing which of a dozen runs was the bad one.

[Advance]

---

### Slide 27 — One zip · 20:05 · ~40s

Before: sticky notes across many lockers. After: one folder.

Then you can review a week of folders the way you review incidents — and turn repeats into product rules.

[Advance]

---

### Slide 28 — Product gates · 20:45 · ~45s

[Don’t read the table — pick one example]

We saw the same dig twice → make reuse the default.  
Different answers from Slack vs the web → fix how context arrives.  
Pretty “no data” on a truncated tool dump → be honest that the preview is truncated.

Measure what you blocked your own users from doing. Then ship a gate, not another prompt tweak.

[Advance]

---

## Close (21:30–26:00)

### Slide 29 — Starter set · 21:30 · ~70s

[Hold 3–4 seconds — “screenshot this”]

This is the slide to take a picture of. Six signals. None of them are “is the pod up.”

If you only do **two things next week**:
1. Alert when session spend is N times that agent’s rolling average — *and* when tool-call count blows a healthy ceiling.
2. Refuse to call a run “good” unless present cites gather.

That’s the cheapest path from green dashboards to “why did it do that.”

The write-up at productionnotes.dev has the longer checklist. This table is enough to start a ticket Monday morning.

[Advance]

---

### Slide 30 — Five lessons · 22:40 · ~45s

I’ll leave the list on screen. Spoken version is shorter:

Watch money early — the industry is full of fuse boxes for a reason.  
Trace the chapters.  
Price the tools.  
Don’t trust fluent — check the evidence path.  
Hand humans one zip.

If you remember nothing else: **cost + loop count + grounded present.**

[Advance]

---

### Slide 31 — Thank you · 23:00 · ~35s

Longer write-up is at productionnotes.dev — same title. Also on the CNCF blog.

If you want to talk with us, Discord invite is on the slide.

I’m Sabith — GitHub sks. Thanks again to Conf42.

[Hold]

---

### Slide 32 — Questions · 23:35 · buffer

You can’t debug what you can’t see.

[Stop for recording, or take questions.]

---

## Speaking rules (for dry-run)

1. If the slide has a table, **point** — don’t recite rows.  
2. Prefer “money / stuck / wrong answer” over “token budgets / loop detection / plausible wrongness.”  
3. Use the slide’s jargon only when naming a field or product people must remember (OpenTelemetry, Langfuse, plan/gather/present).  
4. After a dense slide, one story beat > rereading the bullets.  
5. Say **Takeaway:** out loud once per act so remote viewers hear a clear close.

## Conf42 / online recording habits (from Conf42 + general online-speaker guidance)

- **Pre-recorded is a gift:** retake Segment A/B; don’t apologize for a cut. Conf42 speakers call out OBS tutorials and time to review before upload.
- **Eye line:** look at the lens, not the slide deck window. Put a sticky note by the camera.
- **Audio > 4K:** quiet room, external mic; Conf42 and online guides both say sound fails first.
- **Don’t read the slide:** Conf42 wants practical lessons, not a pitch; slides guide, speech teaches.
- **One screenshot moment:** hold the starter-set slide; say “take a picture.”
- **No live cloud:** matches the CFP and avoids flaky demos on YouTube forever.

## Recent industry crib (for Q&A / ad-libs — don’t dump as a bibliography)

| Signal | Source (2025–26) | Use in talk |
|--------|------------------|-------------|
| Span-level traces or you’re a black box | [MLflow agent observability 2026](https://mlflow.org/articles/what-is-agent-observability-a-2026-developer-guide/) | Primitives / session traces |
| One bad retrieval step → order-of-magnitude cost | same | Segment A / gather |
| Loop shows as latency, not errors; alert on tool-loop count | [Alice Labs Agent Observability Guide 2026](https://alicelabs.ai/en/insights/ai-agent-observability-guide-2026) | Agents don’t crash / cost canary |
| Real-time budget + loop circuit breakers (invoice too late) | [AgentBudget](https://agentbudget.dev/agentbudget_whitepaper_v1.pdf), [costfuse](https://github.com/costfuse/costfuse) | Cost canary / tool budgets |
| OTel records what happened, not groundedness | [OTel GenAI SIG write-up](https://www.integrationplumbers.io/resources/inside-the-opentelemetry-genai-sig), [Fiddler OTel guide](https://www.fiddler.ai/blog/opentelemetry-ai-observability-guide) | Evidence pillar |
| Fluent judge score with empty evidence path | [GroundEval (2026)](https://arxiv.org/html/2606.22737) | Evidence / scorecard act |
| Your own longer write-up | [productionnotes.dev](https://productionnotes.dev/blog/observability/) | Close |

## Timing

| Elapsed | Be at |
|---------|--------|
| 3:40 | New primitives |
| 6:55 | Trace walkthrough |
| 9:55 | Evidence |
| 14:30 | Scorecard |
| 17:15 | Support / ZIP |
| 21:30 | Starter set (hold for screenshot) |
| 23:00 | Thank you |

**Over time:** shorten Act 3. Keep Segment A, ZIP, starter set.  
**Under time:** linger on the tree and the zip folder.

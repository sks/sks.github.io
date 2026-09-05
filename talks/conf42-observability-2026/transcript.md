# Transcript — Conf42 Observability 2026

**You Can't Debug What You Can't See: Observability for AI Agents**  
~27 minutes spoken · 30-minute slot

Speak to the room, not to the bullets. The slide already has the dense words — point, then tell the story. Pause when there’s a table so people can read.

---

## Act 1 — Problem + primitives

### Title

Hello everyone. Thanks to Conf42 for having me.

I’m Sabith. I build agent systems at StackGen — mostly in Go — for teams that run this in production, not just demos.

Today I want to talk about what breaks when your dashboards are green and the agent is still wrong. We’ll look at traces and a few screens. Nothing live against a cloud account.

---

### The 3 AM page that looked fine

Picture on-call getting a write-up that sounds senior. Full sentences. Calm. Confident.

They check the usual place — latency fine, no errors, deps fine. So they trust it.

Then they find out the agent blamed the wrong service, kept poking the same tool, and tomorrow’s bill is ugly.

That’s the whole talk in one line. Classic monitoring sees “slow request.” It does not see “spent a fortune explaining the wrong answer.”

---

### Agents don't crash

When a microservice dies, you get a restart or a stack. Agents often stay “healthy” while they spin.

They keep calling almost the same tool. They keep talking. They invent a story that reads well. They never actually checked the thing they claimed.

A stuck tool loop often shows up as slightly worse latency, not as an error. Your APM stays calm. The agent is still chewing tokens.

You finish the night with a long chat log and a bad answer. No pod crash to point at.

---

### APM asks vs on-call asks

Left side is what we’ve asked for years. Right side is what people ask me after a bad agent run.

I’m not saying throw away latency charts. I’m saying they don’t answer the right-hand column.

Especially that last one — did it actually look at real tool output, or did it just sound sure?

---

### New primitives agents need

This is the shopping list. Four things we had to add because APM alone wasn’t enough.

Without span-level traces you’re running a black box. You know something failed; you can’t say why. OpenTelemetry is getting better at recording what happened — tokens, latency, tool calls. Quality is still on you: was the answer grounded, or just fluent?

Can I replay the whole job, not one HTTP call?  
Can I see which tool ate the money?  
Can I stop a runaway before finance does?  
Can I tell “sounds right” from “checked the data”?

That last line on the slide is the goal for the rest of the talk.

---

### Cost is the canary

We didn’t learn this from a whitepaper. We learned it from invoices.

You’ve seen the headlines: agents stuck in retry loops, five-figure bills, whole AI budgets burned in a quarter. The quieter math is enough. At current model prices, a few hundred near-identical calls in ten minutes is already tens of dollars — and normal rate limits don’t fire, because each call looks legitimate.

So we put hard stops in the path — max steps, max spend per tool — and we page when one run looks weird next to last week’s average for that agent. Alert on tool-loop count too, not only dollars. A healthy run might be a handful of tools. A sick one is dozens, each “fine” by itself.

Money first. Then dig into the trace.

Ship a spend cap and a loop cap before you scale traffic.

---

### Agenda

Quick map. How we wire it. Where the data goes. When the dashboards lie. How we hand a broken run to a human. And a short list you can use on Monday.

---

### Act 2 divider

What we actually put in the product.

---

## Act 2 — What we instrument

### Session traces — plan, gather, present

Think of one investigation as three chapters, not one span.

First: what are we going after?  
Middle: go fetch. Tools fire.  
Last: write the answer — and show what you based it on.

Under those chapters sit the model calls and the tools. We stitch hops with OpenTelemetry, and we look at the LLM tree in something Langfuse-shaped. Brand is optional. The chapters aren’t.

If you only instrument the final HTTP response, you will never answer “where did the reasoning go wrong.”

---

### Trace walkthrough

Here’s a made-up but realistic tree. Safe for slides — no live cloud.

Top of the gather block: a Grafana query. Same tool again right under it — that’s your “stuck” smell. Present at the bottom notes that the claims pointed at tools.

On the right you see time and money per line. That’s how you answer “which call cost what” without exporting a spreadsheet.

If that pattern shows up and the session is already way over average, you can kill it before you burn tens of thousands of tokens on a wrong path. One bad gather step, amplified across many runs, is how costs jump by an order of magnitude.

---

### Tool cost + budgets

Two zoom levels. One tool: slow versus chatty versus looping. Whole run: is this weird for this agent?

The runtime refuses to go forever. The metrics side tells you when someone is still burning cash anyway. Watching the invoice is already too late.

For every agent, know the healthy tool-call count and alert when a run blows past it.

---

### Metrics panel

Left is burn versus a budget line. Right is a tiny table of who spent what in this run.

That left chart will never show you the wrong RCA text. The tree will. Don’t ask one panel to do both jobs.

---

### Evidence checks

This is the one people underbuild.

Nice prose is cheap. Tied to a tool result is not. An LLM judge can give a fluent answer a high score while the trace shows the agent never fetched the thing it claimed. Score on the answer text alone lies. Score on the evidence path doesn’t.

When we present, we ask: did you cite what gather found? If not, don’t call it a win. On the export we sometimes attach a simple grade of the run — not a writing contest.

OpenTelemetry will happily record tokens and latency. It will not, by itself, tell you the answer contradicted the tools. That’s your job.

Don’t ship “correctness” dashboards that never look at whether gather ran.

---

### Audit without becoming a secret store

Keep a log of what ran. Scrub secrets before you store it.

If your debug store holds raw keys, the next incident review just got worse.

---

### Metrics vs traces

Pages and SLOs live here. “Why did it loop?” lives over there.

One hard rule we paid for: don’t put session IDs on Prometheus labels. Tool names are fine. Session IDs blew up our cardinality once. Per-run detail stays in the tree and the logs.

---

### Dual sink

Go process in the middle. Three exits on purpose.

Tree for the chat and tools. Counters for budgets and health — Grafana, Datadog, whatever you already use. Logs carry the OpenTelemetry id so you can jump from a span to a log line.

If you go hunting LLM steps in the wrong backend, you’ll open a ticket for “missing traces” that aren’t missing.

---

### Correlation

Every outbound hop should carry the standard trace header — MCP, gateway, the lot.

And the id you put in the log must be the same hex id the tracer uses. Not your web framework’s request id. Those look similar and they are not the same string. Mix them and “open logs for this trace” is dead.

---

### Identity

Trace id alone isn’t enough. We stamp who this work belongs to — session, workflow, stage, persona — on the child spans.

Same latency, same tokens, totally different meaning if it’s a helper summary versus the user-facing answer. Put business ids on spans on day one. Retrofitting after an incident hurts.

Session id plus stage on every child span, or you can’t compare runs later.

---

### Act 3 divider

When the numbers look fine and still mislead you.

---

## Act 3 — When visibility lies

### The scorecard that lied

We built a scorecard. It looked polished. It was wrong.

Math was fine. We scored the wrong pile of spans — mostly little helpers with almost no context. We nearly argued for rolling that “healthy” fleet forward.

The bug was upstream of the chart.

---

### Missing data is not a passing grade

Empty is not green.

No session stamp — you can’t tell five healthy jobs from one stuck one.  
No tokens — you can’t talk cost.  
No evidence grade — you don’t know correctness.  
No stage — you don’t know which chapter failed.

If coverage is thin, say “unknown.” Don’t invent an A+.

---

### Rule

One sentence, then stop.

Check that your telemetry is honest before you grade the agent.

Stamp the chapters when the span starts. Price the tools. Only call it correct when evidence is there.

---

### Act 4 divider

The run already failed. Now what does a human need?

---

## Act 4 — Debug after the fact

### What support actually needs

Someone says the AI investigation went wrong.

They remember a conversation, not twelve execution ids. Give them one package for the whole thread.

---

### Trace again

Same tree as before. Start here: where it looped, what it cost, whether present cited tools.

---

### Debug zip

One zip. Manifest for versions. The graph the UI uses. The event stream so you can replay. Sometimes a short grade of the run.

Same stuff you’d see on the watch page, offline. No guessing which of a dozen runs was the bad one.

---

### One zip

Before: sticky notes across many lockers. After: one folder.

Then you can review a week of folders the way you review incidents — and turn repeats into product rules.

---

### Batch grading → product gates

We saw the same dig twice — make reuse the default.  
Different answers from Slack versus the web — fix how context arrives.  
Pretty “no data” on a truncated tool dump — be honest that the preview is truncated.

Measure what you blocked your own users from doing. Then ship a gate, not another prompt tweak.

---

## Close

### Starter set

This is the slide to take a picture of. Six signals. None of them are “is the pod up.”

If you only do two things next week:

1. Alert when session spend is N times that agent’s rolling average — and when tool-call count blows a healthy ceiling.
2. Refuse to call a run “good” unless present cites gather.

That’s the cheapest path from green dashboards to “why did it do that.”

The write-up at productionnotes.dev has the longer checklist. This table is enough to start a ticket Monday morning.

---

### Five lessons

I’ll leave the list on screen. Spoken version is shorter:

Watch money early.  
Trace the chapters.  
Price the tools.  
Don’t trust fluent — check the evidence path.  
Hand humans one zip.

If you remember nothing else: cost, loop count, and grounded present.

---

### Thank you

Longer write-up is at productionnotes.dev — same title. Also on the CNCF blog.

If you want to talk with us, Discord invite is on the slide.

I’m Sabith — GitHub sks. Thanks again to Conf42.

---

### Questions

You can’t debug what you can’t see.

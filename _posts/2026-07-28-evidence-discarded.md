---
layout: post
title: "AI Agent Root Cause Analysis — Evidence Discarded After the Lead"
date: 2026-07-28 17:45:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 28
description: "AI agent root cause analysis fails when a dig finds a lead and discards it — peer noise, wrong fire-time windows, and transcript gates for AI SRE."
image: /assets/images/og-evidence-rca.png
tags: [ai-agents, sre, root-cause-analysis, incident-response, on-call, evaluation, prompt-engineering, aiden, production, observability]
permalink: /blog/evidence-discarded/
---

When an AI SRE agent invents a root cause, it is a bug. When it finds the actual root cause and willfully ignores it, it is a disaster.

**AI agent root cause analysis (RCA)** usually fails in public by hallucinating. We spent a stretch teaching agents [not to invent when stuck](/blog/be-creative-do-not-invent/). That mattered. Then a dogfood run failed the other way: the agent **already had the answer** — and still quit.

> The muddy footprints were behind the shed. A neighbor’s dog barked two blocks away. The agent threw away the notebook.

The alert card was real. The rule fetch returned the right title and triage queries. A broadened metrics window lit up a clear failure concentration near fire time: integration, environment, reason code, path. A human reading the transcript would have said “probable” and moved to logs.

The agent said something else. A fingerprint miss. An unrelated firing peer from the same Grafana view. Then: *the UID must point to a different alert; I cannot answer; please paste a new UID and a Loki datasource.* The coordinator Summary restated the card’s Explore checklist and forgot the metric lead entirely.

**Failure was not “no evidence.” Evidence existed and was discarded.**

That is a different epistemic bug than invention under emptiness, and a different one than [closing RCA before homework](/blog/curiosity-before-confidence/). Invention fills gaps with fiction. Premature confidence skips digs. **Abandon-after-lead** finds a dig, then lets integrity theater and wall-clock quiet talk it out of the room. If you are building [AI agents for SRE](/topics/ai-agents-sre/) incident triage, this failure mode burns operator trust as fast as fluent fiction — because the human can see the lead in the tool log.

---

## TL;DR — AI SRE agent RCA that throws away the lead

- **Peer noise is not a stop.** When the rule payload matches the pasted alertname, mismatched firing peers are out of scope — not proof the UID is wrong.
- **Pin the fire, not “now.”** First metrics/logs windows must cover `fired_at` plus the card’s burn or lookback windows. Short current quiet is aging, not “no data forever.”
- **A lead that is written must survive synthesis.** If notes already name reason / path / cohort / locus, Theory cites it. Checklist-only undetermined is a bug.
- **Tool misses need one recovery hop.** “Must specify datasource” is not logs-blind until you retry with an explicit logs datasource.
- **Score the transcript, not the vibe.** Cheap log gates catch peer-abort and lead-drop without another full model run.

### Explain like I'm five

You find the muddy footprints behind the shed. Then someone points at a neighbor’s dog two blocks away and you throw away your notebook, call the case unsolved, and ask Mom for a different address. The footprints were the lead. The neighbor’s dog was noise. Production agents need a rule: **when you already wrote the footprints down, you are not allowed to pretend the case is empty.**

---

## What is abandon-after-lead in AI agent RCA?

**Abandon-after-lead** is when an AI investigator:

1. Successfully loads the alert rule that matches the pasted card  
2. Collects a non-empty metric or log concentration (the lead)  
3. Then closes **undetermined** — usually after a fingerprint miss, an unrelated co-firing peer, a wrong query window, or a missing datasource — and asks the operator for a new UID or restates the checklist  

It is not “honest unknown.” Honest unknown means the planes that matter were attempted and stayed empty. Discard means the plane answered and synthesis forgot.

Contrast with sibling failure modes in this series:

| Failure | One-liner | Post |
| --- | --- | --- |
| Invent under emptiness | Fill gaps with fiction | [Be creative. Don’t invent.](/blog/be-creative-do-not-invent/) |
| Close before homework | Confidence without unfinished digs | [Curiosity before confidence](/blog/curiosity-before-confidence/) |
| Fake done | Submit without a completion check | [Is the task actually done?](/blog/is-the-task-actually-done/) |
| **Abandon after lead** | **Find gold, discard it for peer noise** | **This post** |

---

## The Failure Mode: Gold Found, Then Thrown Away

Strip the product names. The shape repeats on any alert-card triage agent doing AI incident response:

1. **Paste** — rule UID, fingerprint, fire time, Do-this-next checklist.
2. **Rule fetch succeeds** — title and annotations match the paste.
3. **Fingerprint miss** — instance not currently firing (aging is allowed).
4. **Wrong window** — first PromQL batch uses wall-clock “now − a few hours” and returns No data.
5. **Broaden** — longer window returns the locus near fire (reason + path + labels).
6. **Peer distraction** — list-firing returns an unrelated alertname in the same storm.
7. **Abandon** — dig claims the UID is wrong; coordinator Summary goes undetermined and pastes the checklist back at the human.
8. **Optional insult** — learning proposes a skill that teaches “actionable undetermined when UID mismatches,” reinforcing the bad stop.

Operators do not mute agents for saying “probable, next probe is logs.” They mute agents that **held the lead and still asked for a new ticket number.**

---

## Four Hard Stops for AI Agent Incident Triage

Soft “please continue” paragraphs did not survive load. We encoded four always-on rules at the persona and skill boundary — the same place [curiosity gates for AI RCA](/blog/curiosity-before-confidence/) live — so synthesis cannot “forget” Collect.

| Principle | Expected agent behavior | Hard stop trigger |
| --- | --- | --- |
| **Card and rule win** | Ignore peers whose alertname ≠ rule title; continue with paste labels + triage query | Claiming “UID points to a different alert” after a matching rule fetch |
| **Fire-time window** | First batch covers fire ± burn/lookback; on empty, broaden *scope* | Sliding the window to “now” and declaring forever quiet |
| **Never abandon with a lead** | Theory cites strongest metric/log note (at least probable unless falsified) | Undetermined that only restates Do-this-next while the lead sits in notes |
| **Datasource or die trying** | One list/retry with an explicit logs/metrics datasource | Treating “must specify datasource” as a hard blind |

None of this is “always dig forever.” [Stop when notes hold](/blog/is-the-task-actually-done/) still applies. The difference: **stopping with a lead in hand is synthesis; stopping because a peer looked scary is abandonment.**

Maps and runbooks still matter ([agents need a map, not a script](/blog/agents-need-a-map-not-a-script/), [beyond Confluence runbooks](/blog/beyond-confluence-runbooks/)). None of them help if synthesis is allowed to forget the map after Collect already walked it.

---

## Why Integrity Theater Feels So Convincing

Fingerprint alignment and firing-instance lists exist for a good reason: agents should not investigate the wrong series. The bug is using **integrity risk as a hard stop** when the stronger signal already agreed.

Priority order that survived dogfood:

1. Pasted card + successful rule payload that matches the alertname  
2. Labels and triage PromQL on that card  
3. Fingerprint / peer list as aging or noise filters  

When (1) and (2) succeed, a peer with a different alertname does not overturn the case. It is the observability equivalent of co-firing neighbors: interesting weather, wrong address.

Wrong time windows compound the theater. Burn alerts evaluate over hours or a day. Querying “the last two hours of wall clock” after the fire often returns No data even when the increase window that paged is still full of failure. Humans broaden to the fire. Agents narrate emptiness.

---

## Catch Discarded Evidence Without Re-Running the Model

We already treat agent sessions as [observability workloads for AI agents](/blog/observability/). The next cheap layer is **transcript scoring**: walk the tool log and fail closed on patterns humans hate — the same spirit as [evidence-gated RCA](/blog/evidence-gated-multiplane-rca/) and [evidence-based verification](/blog/evidence-based-verification/), applied to “did we keep the lead?”

Useful negative fixtures (redacted):

- Dig claims wrong-UID after a matching rule title appears in tool output  
- Metrics show a dominant `reason=` / path / cohort, but Summary is undetermined + checklist paste  
- First metrics `from` misses the known fire instant by a wide margin  
- Logs fail on missing datasource with no retry that sets one  

Positive fixture: same card shape, scientific dig, fire-covering window, lead noted, logs retried with datasource, Theory cites the lead.

This is not a substitute for live eval. It is how you stop shipping the same abandon story twice while the LLM lottery is expensive — and how you keep [multi-stage AI agent workflows](/topics/ai-agent-workflows/) from “learning” a skill that teaches the shrug.

---

## Lessons for Production AI SRE Agents

1. **Empty and discarded are different bugs.** Train and gate both.
2. **Matching rule JSON beats peer rows.** Integrity risk means continue carefully — not ask the human for a new UID.
3. **Leads are sticky.** Writing `reason=…` / `path=…` in notes creates a debt Theory must pay.
4. **Time is part of the expr.** Fire time + eval windows are first-class inputs, not footnotes.
5. **Score abandons in CI.** If the transcript shows gold then shrug, fail the run before you “learn” a skill that teaches the shrug.

---

## Related reading

- [AI agent loop detection — don't throw away the answer](/blog/ai-agent-loop-detection-salvage/)
- [AI agent root cause analysis — curiosity before confidence](/blog/curiosity-before-confidence/)
- [Be creative. Don’t invent.](/blog/be-creative-do-not-invent/)
- [Evidence-gated RCA — prove, then narrate](/blog/evidence-gated-multiplane-rca/)
- [The hypothesis ladder for AI SRE root cause analysis](/blog/hypothesis-ladder/)
- [AI incident triage for SREs — what actually helps on-call](/blog/ai-incident-triage-sre/)
- Topic hubs: [AI agents for SRE](/topics/ai-agents-sre/) · [multi-stage AI agent workflows](/topics/ai-agent-workflows/)

Finding the lead is Collect. Keeping the lead is RCA. Ship both — or operators will ship the mute button.

---


*Does your AI SRE agent keep the lead — or throw the notebook away when a neighbor’s dog barks? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft grounded RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

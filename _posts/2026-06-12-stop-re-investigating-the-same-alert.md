---
layout: post
title: "Stop Re-Investigating the Same Alert"
date: 2026-08-28 14:00:00 -0700
series: "Service Rendered Efficiently"
series_order: 2
description: "Reuse-first SRE AI: stop burning tokens on every Slack follow-up when a completed RCA already exists for the alert."
image: /assets/images/og-default.png
tags: [sre, ai-agents, service, incident-response, aiden, on-call, tokenomics]
permalink: /blog/stop-re-investigating-the-same-alert/
faqs:
  - question: "Why do AI SRE agents re-investigate the same alert?"
    answer: "Hourly alert cycles and Slack follow-ups often launch a full investigate workflow even when a completed RCA already exists. Without a reuse-first policy, every @mention looks like a new job."
  - question: "What should operators do instead of re-running investigate?"
    answer: "Default to the prior summary and watch link within a cooldown window. Explicitly ask to re-investigate or start from scratch only when they need a fresh deep dive."
  - question: "What metric should SRE leads track?"
    answer: "Investigations per alert ID per week — not just model accuracy. Twenty full digs on one alert is usually a product failure, not a smarter-prompt opportunity."
---

Your AI SRE shouldn't burn tokens on every Slack follow-up.

*The incident patterns below are composite and anonymized. Counts are rounded. Names, IDs, and infrastructure details are fictionalized to protect customer confidentiality.*

---

## TL;DR

- Duplicate investigations on the same alert are expected when chat mentions do not reuse completed RCAs
- In one anonymized week: ~100 investigations, ~15 alerts with multiples, **one alert with 20+ full digs**
- Fix: reuse-first launch policy — answer from the prior summary unless the operator asks to re-investigate
- Service metric: **investigations per alert per week**, not fluency of the latest write-up

### Explain like I'm five

If someone already wrote the book report, don't write it again every time a classmate asks “what was that book about?” Hand them the report. Only rewrite if they say “start over.”

---

## The Acme Commerce pattern

Composite story, drawn from production debug export analysis:

**Alert:** `worker-service` errors on invoice jobs missing a required `tenant_id` field after a bad release.

**Behavior:** The alert fired on an hourly cycle. On-call @mentioned the bot in `#incidents-prod` with “why is this still firing?” Each mention launched a **full** investigate workflow. Session after session rediscovered the same KeyError pattern and the same release candidate.

**Outcome:** Roughly twenty completed investigations on one alert ID in a week. Token spend and wall time scaled with chatter, not with new evidence.

The agent was not “wrong.” The **service** was. It treated every human message as a request for a new deep dive.

---

## What reuse-first looks like

When a recent terminal RCA exists for the alert (default cooldown on the order of hours):

1. **Do not** launch a new investigate-alert workflow
2. Answer from the prior investigation summary
3. Include the watch / session link so the human can open the receipts
4. Only start fresh when the operator explicitly asks — “re-investigate,” “from scratch,” “force new”

That is the difference between a chatbot that always digs and a **service** that remembers what it already rendered for this alert.

Slash-style escapes (`/reinvestigate`) make intent obvious. Soft “please check again” language should still hit the reuse path unless the operator opts out.

---

## If you lead an SRE team

- Chart **investigations per alert ID** weekly. Spikes mean the product is redoing work, not that on-call is curious
- Train the channel: follow-ups get the prior summary; say “re-investigate” when you want a new dig
- Count time-to-first-useful-answer on *first* investigate, then reuse latency on follow-ups — different SLAs

## If you ship the agent platform

- Short-circuit on recent terminal status before spawning collectors
- Encode “fresh dig” as an explicit intent regex or slash command, not as ambient enthusiasm in the prompt
- Stamp prior investigation id + finished time into the reuse prompt so the model cannot invent a new story from thread vibes alone

---

## Related

- Series opener: [Service Rendered Efficiently](/blog/service-rendered-efficiently/)
- Next: [Slack Is a Triage Board, Not a Log Dump](/blog/slack-is-a-triage-board/)
- Token budgets: [LLM tokenomics](/blog/maintaining-tokenomics-with-aiden/)
- Checklist: [SRE as service](/checklists/sre-as-service/)

---

**Acknowledgments.** Reuse-first launch policy lessons from shipping Aiden SRE chat investigation. Customer details composite.

*Building AI for incident triage without the demo theater? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

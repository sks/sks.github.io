---
layout: post
title: "Why AI SRE Feels Stuck Before the First Tool Call"
date: 2026-08-14 10:00:00 -0700
series: "Service Rendered Efficiently"
series_order: 11
description: "On-call sees 'the bot is stuck' while vault re-checks and MCP catalog re-index burn cold start. Measure time to the first useful tool call."
image: /assets/images/og-default.png
tags: [ai-agents, sre, on-call, incident-response, observability, mcp]
permalink: /blog/cut-dead-air-before-investigation/
faqs:
  - question: "What slows AI SRE investigation cold start?"
    answer: "Often vault readiness checks and re-indexing unchanged MCP tool catalogs — not the LLM. Shared readiness and skipping unchanged upserts move first useful tool calls earlier."
  - question: "Should one Grafana 502 abort the whole triage run?"
    answer: "No. A single automatic retry on proxy gateway failures avoids opening the circuit for the rest of the investigation on a transient blip."
  - question: "Why is cold-start latency an on-call SLA?"
    answer: "Operators experience dead air as 'the bot is stuck.' Cutting vault and index tax moves the first useful PromQL earlier — not infra trivia."
---

An alert fires. Chat says “investigating,” but no diagnostic query appears yet. In these incident patterns, some of that wait came before the model could use a tool: the worker rechecked its secrets vault and rebuilt an unchanged catalog of available actions. Measure that wait separately from the model’s response time.

*The incident patterns below are composite and anonymized. Counts are rounded. Names, IDs, and infrastructure details are fictionalized to protect customer confidentiality.*

---

## What to measure first

For an alert that needs a Grafana metric query, record the time from the operator’s request to the **first useful query**, not just the time until the chat says “investigating.” A repeat vault check (confirming access to secrets) or an unchanged MCP tool catalog (the list of actions available through Model Context Protocol) can consume that interval without advancing the investigation. Share readiness per worker and skip index writes when the catalog hash has not changed. These changes reduce setup work; they do not make a slow diagnostic query fast.

---

## Two efficient fixes

![Cold-start sequence from alert through shared vault readiness and catalog hash check to first Grafana query, then bounded retry on gateway errors](/assets/images/diagrams/aug-evals/cold-start-first-query.svg)

*Caption: Shared readiness and skipped no-op catalog writes shorten setup before the first useful query; a 502/503 gets one bounded retry.*

**1. Catalog and secrets tax.** Re-checking vault and re-upserting an unchanged tool index delays first PromQL, Grafana’s query language for metrics. Cache readiness for the worker’s lifetime; hash the catalog and skip no-op writes. Invalidate the cache when credentials or tool definitions change, or stale access can become a security and correctness problem.

**2. Gateway blip ≠ circuit open.** A 502 or 503 is a gateway/server error, not proof that the Grafana data source will stay unavailable. One such response used to mark it dead for the rest of the run. Retry once with a short bound, then surface the failure; unlimited retries would hide a real outage and delay the operator.

Long investigations also need a loop detector (a guard against repeating the same action) whose window accounts for legitimate tool calls that take minutes; a 30-second timeout can mistake waiting for a result for a stuck retry. That is another efficiency story: stop the true stuck retry without false-positive blocks.

Tokenomics context: [maintaining tokenomics](/blog/maintaining-tokenomics-with-aiden/).

---

## If you lead an SRE team

- Measure time-to-first-useful-tool-call on investigate
- Page on sustained cold-start regressions the way you page on API latency
- Do not accept “the model is thinking” as the explanation for repeated vault readiness checks

## If you ship the agent platform

- Fail closed on empty vault secrets when advertising tools — but do not re-pay the check every message
- Retry once on known gateway classes; then surface honest failure
- Align workflow loop-detection TTL with real investigate durations

---

## Related

- Previous: [Measure the Firing Expression First](/blog/measure-the-firing-expression-first/)
- Next: [One Zip, One Conversation](/blog/one-zip-one-conversation/)
- Series: [Service Rendered Efficiently](/series/service-rendered-efficiently/)

---

**Acknowledgments.** Cold-start and Grafana retry lessons from Aiden integration work. Patterns composite.

*Building AI for incident triage without the demo theater? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

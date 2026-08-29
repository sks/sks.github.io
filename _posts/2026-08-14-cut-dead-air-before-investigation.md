---
layout: post
title: "Cut the Dead Air Before Investigation Starts"
date: 2026-08-14 10:00:00 -0700
series: "Service Rendered Efficiently"
series_order: 11
description: "First useful SRE tool call should not wait on vault re-checks and catalog re-index — cold start is an on-call SLA."
image: /assets/images/og-default.png
tags: [sre, ai-agents, service, incident-response, aiden, performance, on-call]
permalink: /blog/cut-dead-air-before-investigation/
faqs:
  - question: "What slows AI investigation cold start?"
    answer: "Often vault readiness checks and re-indexing unchanged tool catalogs — not the LLM. Shared readiness and skipping unchanged upserts move first useful tool calls earlier."
  - question: "Should one Grafana 502 abort the whole triage run?"
    answer: "No. A single automatic retry on proxy gateway failures avoids opening the circuit for the rest of the investigation on a transient blip."
  - question: "Why is cold-start latency a service concern?"
    answer: "On-call experiences dead air as 'the bot is stuck.' Cutting vault and index tax is leverage — Efficiently — not infra trivia."
---

The slow part of “start investigating” was often vault checks and re-indexing the same tool catalog — not the model.

*The incident patterns below are composite and anonymized. Counts are rounded. Names, IDs, and infrastructure details are fictionalized to protect customer confidentiality.*

---

## TL;DR

- Cold-start dead air is an **on-call SLA**, not infra trivia
- Share vault readiness across MCP providers per worker
- Skip unchanged tool-index upserts
- One automatic retry on Grafana proxy 502/503 before treating the datasource as dead

### Explain like I'm five

If every time you ask for a flashlight someone re-alphabetizes the entire toolbox before handing it over, you will think the flashlight is broken. Keep the toolbox organized once; hand over the light.

---

## Two efficient fixes

**1. Catalog and secrets tax.** Re-checking vault and re-upserting an unchanged tool index delays first PromQL. Cache readiness; hash the catalog; skip no-op writes.

**2. Gateway blip ≠ circuit open.** One transient 502 from the Grafana proxy used to mark a datasource dead for the rest of the run. A short single retry matches how humans already behave: try once more, then escalate.

Long investigate runs also need long loop-detection windows — minutes-long legitimate tool latency is not a 30-second doom loop. That is another efficiency story: stop the true stuck retry without false-positive blocks.

Tokenomics context: [maintaining tokenomics](/blog/maintaining-tokenomics-with-aiden/).

---

## If you lead an SRE team

- Measure time-to-first-useful-tool-call on investigate
- Page on sustained cold-start regressions the way you page on API latency
- Do not accept “the model is thinking” as the explanation for vault thrash

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

**Acknowledgments.** Cold-start and Grafana retry lessons from Guild integration work. Patterns composite.

*Building AI for incident triage without the demo theater? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

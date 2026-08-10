---
layout: page
title: Evidence-gated RCA checklist
permalink: /checklists/evidence-gated-rca/
description: "A shareable checklist for AI agent root cause analysis — prove with receipts before narrating. No proprietary schemas."
faqs:
  - question: "What is evidence-gated RCA?"
    answer: "Root cause analysis where the workflow refuses a confident narrative until required evidence tokens exist — identity, onset, and ruled-out branches — instead of trusting fluent prose."
---

Use this when reviewing an AI agent's incident write-up. Full essay: [Evidence-Gated Multi-Plane RCA](/blog/evidence-gated-multiplane-rca/).

## Before you trust the narrative

- [ ] **Identity first** — what broke is named from systems of record, not vibe  
- [ ] **Onset before change theory** — when it started is established before “the deploy did it”  
- [ ] **Competing branches stayed open** until evidence closed them (not one hero story)  
- [ ] **Primary claims have receipts** — a metric, log, or deploy row a gate can see without another LLM call  
- [ ] **Missing digs are stated** — “we did not check X” beats silent omission  
- [ ] **Narration is last** — plan / gather / present; early nodes do not emit “final answer”  
- [ ] **Human can skim in under a minute** — what was checked, what wasn't, what to do next  

## Red flags

- Fluent root cause after a handful of tool calls  
- Confidence while required planes were never queried  
- Mid-graph “we're done” copy that trains operators to distrust the UI  

## Related

- [Curiosity before confidence](/blog/curiosity-before-confidence/)  
- [Hypothesis ladder](/blog/hypothesis-ladder/)  
- [SRE on-call starter pack](/start/sre-on-call/)  

{% include subscribe.html %}

---
layout: page
title: SRE as service checklist
permalink: /checklists/sre-as-service/
description: "Ten yes/no questions for AI investigation as a service product — reuse, honesty, handoff. No proprietary schemas."
faqs:
  - question: "What is the SRE as service checklist?"
    answer: "Ten yes/no questions to review whether your AI investigation product serves on-call — reuse, honest partials, Slack triage UX, correlation gates, and one-zip handoff — instead of optimizing for engineering credibility."
---

Use this when reviewing an AI SRE investigation product. Series: [Service Rendered Efficiently](/series/service-rendered-efficiently/). Starter: [SRE as service](/start/sre-as-service/).

*Review your own deployment. Do not paste customer identifiers into shared copies of this checklist.*

## Ten questions

- [ ] **Investigations per alert** — Do we count digs per alert ID weekly and act when one alert sees double-digit reruns?
- [ ] **Reuse-first** — Does a recent completed RCA short-circuit Slack follow-ups unless the operator asks to re-investigate?
- [ ] **Slack triage board** — Do incident cards show scannable KPIs and findings, not only dense logs or hollow Incomplete?
- [ ] **Undetermined with findings** — Does inconclusive triage still post what was checked?
- [ ] **Entry-path honesty** — Do we train operators to compare watch links from Slack instead of re-pasting alert text?
- [ ] **Correlation gates** — If the operator asks to link prior sessions, can the run close without that dig?
- [ ] **Completeness vocabulary** — Can RCAs say COMPLETE / PARTIAL / FAILED instead of fake “no data” on truncated previews?
- [ ] **Budget finalization** — When the agent hits a turn ceiling, do findings still render?
- [ ] **Measure the expression** — Do we gate fan-out on measuring the stamped alert query when title and plane disagree?
- [ ] **One-zip handoff** — Can support download one debug zip per conversation and find threads by initiator / channel?

## Red flags

- Success measured by frameworks shipped or agent LOC  
- Every @mention launches a full investigate  
- Grounding failures invisible in the primary chat bubble  
- Cold-start dead air blamed on “the model thinking”  

## Related

- [Service Rendered Efficiently](/blog/service-rendered-efficiently/)  
- [Stop re-investigating the same alert](/blog/stop-re-investigating-the-same-alert/)  
- [One zip, one conversation](/blog/one-zip-one-conversation/)  
- [Evidence-gated RCA checklist](/checklists/evidence-gated-rca/)  
- [“Done” checklist](/checklists/agent-done/)  

{% include subscribe.html %}

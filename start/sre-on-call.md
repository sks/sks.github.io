---
layout: page
title: SRE on-call starter pack
permalink: /start/sre-on-call/
description: "Five production notes on SRE AI agents — triage, RCA, observability, and what helps on-call without demo theater."
faqs:
  - question: "What should an SRE read first about AI agents?"
    answer: "Start with what SRE AI agents are, then incident triage that helps on-call, then evidence-gated RCA and observability. Skip autonomous remediation demos until triage and receipts are solid."
  - question: "How long is this reading pack?"
    answer: "Five posts. Most readers finish in one sitting if they skim TL;DRs; deeper reads take an evening."
---

A short path for on-call and platform SREs evaluating AI agents. No blueprint — problem → lesson → when *not* to trust the demo.

## The five posts

1. **[What Are SRE AI Agents?](/blog/what-are-sre-ai-agents/)** — triage vs RCA vs remediation without theater  
2. **[AI Incident Triage for SREs](https://stackgen.com/blog/ai-incident-triage-for-sres-what-works-on-call)** — what actually helps on-call (on StackGen)  
3. **[Evidence-Gated Multi-Plane RCA](/blog/evidence-gated-multiplane-rca/)** — prove before you narrate  
4. **[You Can't Debug What You Can't See](/blog/observability/)** — why APM misses agent failures ([CNCF reprint](https://www.cncf.io/blog/2026/08/04/you-cant-debug-what-you-cant-see-observability-for-ai-agents/))  
5. **[Is the Task Actually Done?](/blog/is-the-task-actually-done/)** — completion checks that don't self-grade  

## Pocket checklist

Downloadable principles (no proprietary schemas): [Evidence-gated RCA checklist](/checklists/evidence-gated-rca/) · [“Done” checklist](/checklists/agent-done/)

## Next

- Hub: [AI agents for SRE](/topics/ai-agents-sre/) · [AI incident triage](/topics/ai-incident-triage/)  
- Full series: [Building an Enterprise AI Agent Platform in Go](/series/enterprise-ai-agents-go/?q=sre)  
- Runtime basics: [Go / runtime starter pack](/start/go-runtime/)

{% include subscribe.html %}

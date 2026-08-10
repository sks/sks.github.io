---
layout: page
title: Go agent runtime starter pack
permalink: /start/go-runtime/
description: "Five production notes on AI agent runtimes in Go — definitions, language choice, platform split, and debugging multi-stage workflows."
faqs:
  - question: "Where should I start if I'm evaluating Go for AI agents?"
    answer: "Read what an agent runtime is, why Go beats Python for long-running production loops, then the runtime-vs-platform split and how we bring up multi-stage workflows one gate at a time."
  - question: "Is this a tutorial to build an agent framework?"
    answer: "No. These are practitioner lessons from shipping a production runtime and platform — trade-offs and failure modes, not a build-along blueprint."
---

A short path for engineers choosing a language and architecture for production agent loops.

## The five posts

1. **[What Is an AI Agent Runtime?](/blog/what-is-an-ai-agent-runtime/)** — the loop vs chatbot, notebook, or platform  
2. **[Python vs Go for AI Agents](/blog/why-go/)** — concurrency, deploy shape, when Python still wins  
3. **[AI Agent Runtime vs Platform](/blog/aiden-platform/)** — why we split the embeddable loop from multi-tenant packaging  
4. **[Go Platform Architecture at Speed](/blog/anatomy-of-a-platform/)** — growing fast without drowning  
5. **[Bring Up Agent Workflows Like Hardware](/blog/bring-up-agent-workflows-like-hardware/)** — stage gates beat one-shot demos  

## Next

- Hub: [AI agent runtime](/topics/ai-agent-runtime/) · [Go AI agents](/topics/go-ai-agents/)  
- Full series: [Building an Enterprise AI Agent Platform in Go](/series/enterprise-ai-agents-go/?q=golang)  
- On-call path: [SRE on-call starter pack](/start/sre-on-call/)

{% include subscribe.html %}

---
layout: page
title: Go AI Agents
permalink: /topics/go-ai-agents/
description: "Building enterprise AI agent platforms in Go — language trade-offs, rapid platform architecture, and why we split runtime from multi-tenant orchestration."
hub: go-ai-agents
faqs:
  - question: "Why use Go instead of Python for AI agents?"
    answer: "Concurrency, single-binary deployment, and static typing for tool middleware and workflow gates. Python wins for research and notebook iteration; Go wins for long-running production agent runtimes."
  - question: "When should you not choose Go for agents?"
    answer: "When your team lacks Go depth, when you need tight HuggingFace or notebook integration, or when iteration speed on prompts matters more than runtime discipline."
  - question: "How do you structure an enterprise agent platform in Go?"
    answer: "Split the single-user agent runtime from the multi-tenant platform layer — policy, tenancy, durable workflows, and IaC-configured agents belong in the platform, not the core loop."
---

Every AI framework defaults to Python. We built ours in **Go** — and we'd do it again for production enterprise agents. These posts explain the trade-offs, the architecture patterns, and when you shouldn't follow our path.

Part of the series [Building an Enterprise AI Agent Platform in Go](/series/enterprise-ai-agents-go/).

## Featured posts

| Post | What you'll learn |
|------|-------------------|
| [Go vs Python for AI Agents — Why We Chose Go](/blog/why-go/) | Language decision for a production agent runtime |
| [Go Platform Architecture at Speed — Without Drowning](/blog/anatomy-of-a-platform/) | Growing a Go codebase fast without drowning in complexity |
| [AI Agent Runtime vs Platform — Why We Split Them](/blog/aiden-platform/) | CLI agent vs enterprise multi-tenant platform |

## FAQ

{% for faq in page.faqs %}
### {{ faq.question }}

{{ faq.answer }}

{% endfor %}

{% include subscribe.html %}

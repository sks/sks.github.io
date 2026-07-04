---
layout: home
title: Home
---

# Hi, I'm Sabith 👋

Staff Engineer at [StackGen](https://stackgen.com), building enterprise AI agent platforms in Go.

I write about the engineering decisions, production bugs, and hard-won lessons from building an **AI agent runtime** and **[Aiden](/blog/aiden-platform/)** — StackGen's multi-tenant agent orchestration platform for enterprise SRE and platform teams.

## Aiden — Enterprise Agent Platform

**[Why We Split Our Agent Runtime From Our Platform](/blog/aiden-platform/)** — the engineering trade-off behind turning a single-user CLI agent into a multi-tenant enterprise platform.

## 📚 Blog Series: Building an Enterprise AI Agent Platform in Go

{% for post in site.posts %}
- **[{{ post.title }}]({{ post.url | relative_url }})** — {{ post.description }}
{% endfor %}

## 📬 Connect

- **GitHub**: [@sks](https://github.com/sks)
- **LinkedIn**: [Sabith](https://linkedin.com/in/sabithks)
- **Company**: [StackGen](https://stackgen.com)

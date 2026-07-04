# sks.github.io

Personal engineering blog — AI agents, Go, and production systems.

**Live at:** [sks.github.io](https://sks.github.io)

---

## 📚 Featured Series: Building an Enterprise AI Agent Platform in Go

A 13-part deep dive into building a production AI agent platform in Go — from choosing the language to scaling it across many teams. Based on real production experience building [Aiden](https://sks.github.io/blog/aiden-platform/), StackGen's enterprise agent orchestration platform.

| # | Post | What It Covers |
|---|------|---------------|
| 1 | [Why We Chose Go](https://sks.github.io/blog/why-go/) | Go vs Python for AI agents — concurrency, deployment, type safety |
| 2 | [TOML Over YAML](https://sks.github.io/blog/toml-over-yaml/) | Config format wars — why TOML won over YAML and PKL |
| 3 | [Architecture at Speed](https://sks.github.io/blog/anatomy-of-a-platform/) | Growing a Go codebase fast without drowning in complexity |
| 4 | [ReAcTree Bugs](https://sks.github.io/blog/reactree-bugs/) | 6 production bugs the paper didn't warn you about |
| 5 | [Pensieve Memory](https://sks.github.io/blog/pensieve-memory/) | Memory management for agents that actually forget |
| 6 | [Skill Distillation](https://sks.github.io/blog/skill-distillation/) | Teaching agents to learn without fine-tuning |
| 7 | [The HITL Paradox](https://sks.github.io/blog/hitl-paradox/) | When human approval makes agents worse |
| 8 | [Defense in Depth](https://sks.github.io/blog/defense-in-depth/) | Layered security for tool-wielding agents |
| 9 | [Observability](https://sks.github.io/blog/observability/) | Why traditional APM can't debug agent workloads |
| 10 | [Terraform Config](https://sks.github.io/blog/terraform-config/) | Infrastructure as Code for AI agent governance |
| 11 | [Why We Split Runtime From Platform](https://sks.github.io/blog/aiden-platform/) | The trade-off behind turning a single-user CLI agent into a multi-tenant platform |
| 12 | [Open Source Ecosystem](https://sks.github.io/blog/open-source-ecosystem/) | Contributing back while building commercially |
| 13 | [JSON Repair Layers](https://sks.github.io/blog/json-repair-layers/) | Why one JSON repair pass isn't enough in production |

---

## 🛠 Local Development

This site uses [Jekyll](https://jekyllrb.com/) with the [Minima](https://github.com/jekyll/minima) theme, hosted on [GitHub Pages](https://pages.github.com/).

```bash
# Install dependencies
bundle install

# Run locally
bundle exec jekyll serve

# Open http://localhost:4000
```

## 📁 Repo Structure

```
├── _config.yml          # Jekyll config (theme, permalinks, plugins)
├── _posts/              # Blog posts (Markdown)
├── _includes/           # Custom Jekyll includes
├── about.md             # About page
└── index.md             # Home page
```

## ✍️ Writing a New Post

Create a file in `_posts/` following the naming convention:

```
_posts/YYYY-MM-DD-post-slug.md
```

Front matter template:

```yaml
---
layout: post
title: "Your Post Title"
date: YYYY-MM-DD HH:MM:SS -0700
series: "Building an Enterprise AI Agent Platform in Go"  # optional
series_order: N                                 # optional
description: "A compelling one-liner."
tags: [tag1, tag2, tag3]
---
```

URLs are generated from the title via `permalink: /blog/:title/` — no dates in URLs.

---

## 📝 License

Content © Sabith K S. All rights reserved.

## 🔗 Connect

- **GitHub:** [@sks](https://github.com/sks)
- **LinkedIn:** [Sabith](https://linkedin.com/in/sabithks)
- **StackGen:** [ai.stackgen.com](https://ai.stackgen.com)

# Production Notes

Personal engineering blog — enterprise AI agents, workflows, Go, and production systems.

**Live at:** [productionnotes.dev](https://productionnotes.dev) (GitHub Pages source: `sks.github.io`)

**SEO & ops docs:** [`docs/dns-setup.md`](docs/dns-setup.md) · [`docs/search-console.md`](docs/search-console.md) · [`docs/distribution-sprint.md`](docs/distribution-sprint.md) · [`docs/gsc-weekly-checklist.md`](docs/gsc-weekly-checklist.md)

---

## Featured series: Building an Enterprise AI Agent Platform in Go

An 18+ post practitioner series on building a production AI agent platform in Go — from language choice through workflows, SRE triage, and enterprise platform lessons. Based on real production work on [Aiden](https://productionnotes.dev/blog/aiden-platform/), StackGen's enterprise agent orchestration platform.

**Series hub:** [enterprise-ai-agents-go](https://productionnotes.dev/series/enterprise-ai-agents-go/)

| # | Post | What it covers |
|---|------|----------------|
| 1 | [Why We Chose Go](https://productionnotes.dev/blog/why-go/) | Go vs Python for AI agents |
| 2 | [TOML Over YAML](https://productionnotes.dev/blog/toml-over-yaml/) | Config format trade-offs |
| 3 | [Go Platform Architecture at Speed](https://productionnotes.dev/blog/anatomy-of-a-platform/) | Growing a Go codebase fast |
| 4 | [ReAcTree Bugs](https://productionnotes.dev/blog/reactree-bugs/) | Production bugs in agent trees |
| 5 | [Pensieve Memory](https://productionnotes.dev/blog/pensieve-memory/) | Memory for agents that forget |
| 6 | [Agent Skill Distillation](https://productionnotes.dev/blog/skill-distillation/) | Learning without fine-tuning |
| 7 | [The HITL Paradox](https://productionnotes.dev/blog/hitl-paradox/) | When human approval hurts |
| 8 | [Defense in Depth](https://productionnotes.dev/blog/defense-in-depth/) | Security for tool-wielding agents |
| 9 | [Observability](https://productionnotes.dev/blog/observability/) | APM vs agent workloads |
| 10 | [Terraform Config](https://productionnotes.dev/blog/terraform-config/) | IaC for agent governance |
| 11 | [Runtime vs Platform](https://productionnotes.dev/blog/aiden-platform/) | CLI agent → multi-tenant platform |
| 12 | [Open Source Ecosystem](https://productionnotes.dev/blog/open-source-ecosystem/) | Contributing while shipping commercially |
| 13 | [JSON Repair Layers](https://productionnotes.dev/blog/json-repair-layers/) | Why one repair pass isn't enough |
| 14 | [LLM Performance Metrics](https://productionnotes.dev/blog/web-metrics-to-llm-metrics/) | Metrics for agent systems |
| 15 | [CCE Cloud Entitlements](https://productionnotes.dev/blog/cce-cloud-entitlements/) | Cloud entitlement patterns |
| 16 | [AI Incident Triage](https://productionnotes.dev/blog/ai-incident-triage-sre/) | What helps on-call SREs |
| 17 | [Evidence-Gated RCA](https://productionnotes.dev/blog/evidence-gated-multiplane-rca/) | Multi-plane investigation |
| 18 | [LLM Tokenomics](https://productionnotes.dev/blog/maintaining-tokenomics-with-aiden/) | Context budgets & FinOps |

**Topic hubs:** [workflows](https://productionnotes.dev/topics/ai-agent-workflows/) · [SRE](https://productionnotes.dev/topics/ai-agents-sre/) · [Go agents](https://productionnotes.dev/topics/go-ai-agents/)

---

## Local development

[Jekyll](https://jekyllrb.com/) + [Minima](https://github.com/jekyll/minima) on [GitHub Pages](https://pages.github.com/).

```bash
bundle install
bundle exec jekyll serve
# http://localhost:4000
```

## Repo structure

```
├── _config.yml          # Site URL, author, SEO defaults, plugins
├── _posts/              # Blog posts
├── _includes/           # head-custom (JSON-LD), author-bio, subscribe
├── _layouts/post.html   # Post layout with byline + subscribe
├── series/              # Series pillar page
├── topics/              # Topic hub pages (FAQ + schema)
├── tags/                # Tag archive pages
├── assets/images/       # OG social cards (og-*.png)
├── docs/                # DNS, GSC, distribution playbooks
├── CNAME                # productionnotes.dev
└── robots.txt
```

## Writing a new post

```
_posts/YYYY-MM-DD-post-slug.md
```

```yaml
---
layout: post
title: "Your Post Title"
date: YYYY-MM-DD HH:MM:SS -0700
series: "Building an Enterprise AI Agent Platform in Go"  # optional
series_order: N
description: "Keyword-rich one-liner under 155 chars."
tags: [ai-agents, workflows]
image: /assets/images/og-default.png  # or post-specific og-*.png
---
```

URLs: `permalink: /blog/:title/` — no dates in paths.

## License

Content © Sabith K S. All rights reserved.

## Connect

- **GitHub:** [@sks](https://github.com/sks)
- **LinkedIn:** [Sabith](https://linkedin.com/in/sabithks)
- **StackGen:** [stackgen.com](https://stackgen.com)

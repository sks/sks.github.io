# AGENTS.md

Guidelines for AI coding agents working on this repository.

## Project Overview

This is a Jekyll-based personal blog hosted on GitHub Pages at `sks.github.io`. It contains blog series: **"Building an Enterprise AI Agent Platform in Go"** by Sabith.

## Setup Commands

- **Local preview:** `bundle exec jekyll serve --drafts --future`
- **Build:** `bundle exec jekyll build`
- **Install deps:** `bundle install` (requires Ruby + Bundler)

No custom build pipeline — GitHub Pages builds automatically on push to `main`.

## Architecture

```
sks.github.io/
├── _config.yml          # Jekyll site configuration (minima theme)
├── _includes/
│   └── footer.html      # Custom footer override (minima)
├── _posts/              # Blog posts (Markdown, Jekyll front matter)
│   └── YYYY-MM-DD-slug.md
├── index.md             # Home page with series index
└── about.md             # Author bio and project links
```

- **Theme:** minima (GitHub Pages default)
- **Permalink pattern:** `/blog/:title/` (slug from filename, e.g. `reactree-bugs` — no dates in URLs)
- **No JavaScript, no CSS customizations** — content-only site

## Content Rules

### Naming Restrictions (CRITICAL)

These are **hard rules** — violating them causes real-world harm:

1. **Never use "Genie"** — the product is no longer open source. Use generic terms: "the agent runtime", "our runtime", "the framework".
2. **"Guild" is the repo name only** — externally, the product is called **"Aiden"**. Always use "Aiden" in blog content.

### Blog Content Guardrails (CRITICAL)

**No post may give away the architecture or design for free.** Posts describe the problem and the lesson, never the blueprint. Before publishing, apply the litmus test: *could a competitor rebuild this feature from this post alone? If yes, cut more.*

**Cut from every post:**

- Real code snippets showing actual internal types, functions, or config schemas (Go structs, TOML/HCL examples, JSON schemas) — illustrative pseudo-code is fine if it isn't a literal copy of the real implementation
- Diagrams that map real internal components, data flow, or wiring between systems
- Exact thresholds, weights, formulas, or scoring constants (e.g. "0.4 × cosine + 0.3 × recency", "novelty ≥ 7", "similarity ≥ 0.8")
- Internal service/type/function names (e.g. `ToolWrapSvc`, `BuildParallel`, package paths like `pkg/repository/repositorymodel`) — refer to the pattern generically instead ("a middleware chain", "a scoring model")
- Package/file layout, line counts, dependency graphs, or exact package/interface counts
- Step-by-step "build this exact thing" instructions
- Precise metrics that reveal scale or unit economics (exact percentages, latencies, costs) — prefer qualitative language ("meaningfully fewer approvals" instead of "70% fewer")

**Keep in every post:**

- The problem narrative and why it mattered
- The failure story or production incident
- The high-level lesson or principle, generalizable beyond this specific codebase
- Qualitative outcomes and trade-offs
- Generic industry comparisons and reasoning

### Blog Post Format

Every post must include:

```yaml
---
layout: post
title: "Title Here"
date: YYYY-MM-DD
description: "One-line description for SEO and social cards"
tags: [tag1, tag2, tag3]
---
```

### Call to Action

Every post must end with:

```markdown
---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.
```

### Style Guidelines

- **Audience:** Junior developers through senior engineers and practitioners
- **Tone:** Technical but conversational, like a senior engineer explaining to a colleague
- **Code blocks:** Always specify language (`go`, `toml`, `hcl`, `bash`, `yaml`)
- **Tables:** Use for comparisons (features, trade-offs, metrics)
- **Structure:** Problem → Solution → Lessons Learned
- **No `post_url` tags** — Jekyll fails hard when referenced posts don't exist. Use relative paths (`/blog/slug/`) or "in a future post" text instead

### Writing for LinkedIn

Posts should be:
- Self-contained (no required prior reading)
- Skimmable (bold key takeaways, use headers)
- Opinionated (take a stance, don't hedge everything)
- Practical (real lessons and generalizable trade-offs — see Blog Content Guardrails above for what to keep out)

## Testing

### Before Pushing

1. Verify no naming violations:
   ```bash
   grep -r "Genie\|Guild" _posts/ --include="*.md"
   # Must return empty
   ```

2. Verify no broken `post_url` tags:
   ```bash
   grep -r "post_url" _posts/ --include="*.md"
   # Must return empty
   ```

3. Verify CTA present on all posts:
   ```bash
   for f in _posts/*.md; do grep -q "ai.stackgen.com" "$f" || echo "MISSING CTA: $f"; done
   # Must return empty
   ```

### After Pushing

Monitor the GitHub Actions build:
```bash
gh run list --repo sks/sks.github.io --limit 1 --json status,conclusion
# Must show "conclusion": "success"
```

## Git Workflow

- **`main`** — production, auto-deploys to GitHub Pages
- **Feature branches** — for draft posts or bulk additions
- **NEVER run `git reset`** without explicit human consent
- Use descriptive commit messages with `feat:`, `fix:`, or `docs:` prefixes

## Dependencies

- **Jekyll** (managed by GitHub Pages — no Gemfile in repo)
- **Theme:** minima (remote theme via GitHub Pages)
- **Plugins:** `jekyll-seo-tag`, `jekyll-sitemap`

## Common Tasks

### Add a New Blog Post

1. Create `_posts/YYYY-MM-DD-slug.md` with proper front matter
2. Write content following the style guidelines and [Blog Content Guardrails](#blog-content-guardrails-critical) above
3. Set `date` in front matter to the **publish day** (future dates are hidden until that day on GitHub Pages)
4. Add the ai.stackgen.com CTA at the end
5. Run the naming violation checks
6. Commit, push, verify build passes

### Scheduling and Permalinks

- **Permalinks are slug-only:** `/blog/why-go/` — derived from the filename slug, not the date prefix
- **Never rename files** to change publish timing; it creates noisy diffs and confuses file tracking
- To hide until a future day: change front-matter `date` only, or use `_drafts/`
- Internal links: always `/blog/slug/` — never date-prefixed paths
- Promotion calendar (LinkedIn one-per-day): [`docs/publishing-schedule.md`](docs/publishing-schedule.md)

### Update the Footer

Edit `_includes/footer.html`. This overrides minima's default footer. Keep the `ai.stackgen.com` link.

### Update Site Metadata

Edit `_config.yml`. Changes to `_config.yml` require a full rebuild (GitHub Pages handles this automatically).

# social-radar

Find **recent Reddit and Hacker News threads** (default: last 3 days) with enough engagement to be worth a thoughtful comment — tuned for Production Notes topics (Go agents, SRE, observability, workflows).

## APIs and keys

| Platform | API key? | Notes |
|----------|----------|--------|
| **Hacker News** | **No** | Uses public [Algolia HN Search API](https://hn.algolia.com/api) |
| **Reddit** | **Yes (free)** | [Reddit app credentials](https://www.reddit.com/prefs/apps) — script app + OAuth client credentials |
| **LinkedIn** | **Not available** | LinkedIn does **not** expose a public API to search organic feed posts by engagement. Use manual LinkedIn search or Google Alerts (see below). |

### Reddit setup (5 minutes)

1. Open https://www.reddit.com/prefs/apps → **create another app**
2. Type: **script** (or "web app" if you prefer; script is simplest for read-only CLI)
3. Copy **client ID** (under the app name) and **secret**
4. Export env vars (see `.env.example`):

```bash
export REDDIT_CLIENT_ID="..."
export REDDIT_CLIENT_SECRET="..."
export REDDIT_USER_AGENT="social-radar:1.0 (by /u/your_reddit_username)"
```

Reddit requires a descriptive `User-Agent`; without it requests may be rate-limited or blocked.

### LinkedIn workaround

There is no supported API for "show me viral posts I can comment on." Practical options:

- Saved searches in LinkedIn (e.g. `"AI agents"`, `"platform engineering"`, `"on-call"`)
- [Google Alerts](https://www.google.com/alerts) with queries like:
  - `site:linkedin.com/posts "AI agents" OR "SRE" OR "golang"`
- Third-party social listening tools (paid) if you scale this later

The CLI prints this reminder after each run.

## Run

```bash
cd tools/social-radar
go run . -days 3 -min-score 3 -min-comments 2
```

### Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `-days` | `3` | Only threads newer than this |
| `-min-score` | `3` | Minimum upvotes / HN points |
| `-min-comments` | `2` | Minimum comments |
| `-queries` | see `config.go` | Comma-separated search phrases |
| `-subreddits` | golang, devops, sre, … | Subreddits to search on Reddit |
| `-format` | `table` | `table`, `markdown`, or `both` |
| `-tsv-out` | _(empty)_ | Write TSV table to file |
| `-md-out` | _(empty)_ | Write markdown digest to file |
| `-quiet` | `false` | Suppress stdout table (use with file outputs) |

### Example

```bash
go run . \
  -days 3 \
  -queries "golang AI,LLM production,SRE triage" \
  -subreddits "golang,devops,sre,LocalLLaMA" \
  -format both \
  -tsv-out digest.tsv \
  -md-out digest.md
```

Output is a TSV table and/or markdown digest — sorted by engagement.

## GitHub Actions (automated digest)

Workflow: [`.github/workflows/social-radar.yml`](../../.github/workflows/social-radar.yml)

- **Schedule:** daily at 14:00 UTC
- **Manual:** Actions → **Social radar digest** → **Run workflow**
- **Outputs:**
  - **Job summary** on the run page (markdown table)
  - **Artifact** `social-radar-<run_id>` with `digest.md` + `digest.tsv` (30-day retention)

### Repository secrets (optional, for Reddit)

Settings → Secrets and variables → Actions:

| Secret | Value |
|--------|--------|
| `REDDIT_CLIENT_ID` | From reddit.com/prefs/apps |
| `REDDIT_CLIENT_SECRET` | App secret |
| `REDDIT_USER_AGENT` | `social-radar:1.0 (by /u/your_username)` |

HN works without secrets. If Reddit secrets are missing, the workflow still runs and reports HN-only results.

## Similar projects (inspiration)

Repos that automate HN/Reddit digests via GitHub Actions or CLI — see also **[SPEAKING-AND-CFPS.md](./SPEAKING-AND-CFPS.md)** for conferences, CFPs, and newsletters.

| Repo | What it does |
|------|----------------|
| [mickdur/tech-watch](https://github.com/mickdur/tech-watch) | Twice-daily GenAI digest → Telegram via Actions |
| [marcT1/ai-news-dashboard](https://github.com/marcT1/ai-news-dashboard) | Daily pipeline → JSON + GitHub Pages dashboard + email |
| [Rohit8y/AI-Brief](https://github.com/Rohit8y/AI-Brief) | Reddit + HN + blogs → scored Telegram briefing |
| [solcreek/sunbreak](https://github.com/solcreek/sunbreak) | Go keyword monitor (HN + RSS + Reddit adapter), local-first |
| [mbtz/morningweave](https://github.com/mbtz/morningweave) | Go CLI digest scheduler for HN + Reddit |
| [adrienckr/notslop](https://github.com/adrienckr/notslop) | Multi-source digest CLI (HN, Reddit, X) for content drafting |
| [jedi4ever/social-skills](https://github.com/jedi4ever/social-skills) | Unified fetch CLI for HN, Reddit, GitHub, X, etc. |

**This tool is narrower:** no LLM summarization, no Telegram — just **recent threads with engagement** for manual commenting.

## Build

```bash
go build -o social-radar .
./social-radar
```

## Ethics

- Add value in comments; don't drive-by drop blog links.
- Link to productionnotes.dev only when it directly answers the question.
- Respect each community's self-promotion rules.

## Limitations

- Reddit search is approximate; some fresh threads may be missed.
- HN Algolia index can lag a few minutes behind live HN.
- High-volume runs may hit Reddit rate limits — keep defaults reasonable.

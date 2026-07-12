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

### Example

```bash
go run . \
  -days 3 \
  -queries "golang AI,LLM production,SRE triage" \
  -subreddits "golang,devops,sre,LocalLLaMA"
```

Output is a TSV table: platform, age, score, comments, source, title, URL — sorted by engagement.

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

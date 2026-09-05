---
layout: page
title: Talks
permalink: /talks/
sitemap: false
robots: noindex
description: Conference talks and slide decks on AI agents, observability, and production SRE — by Sabith K S. Unlisted — share the direct URL.
---

# Talks

Unlisted category on [productionnotes.dev](https://productionnotes.dev/). Not linked from the site nav or blog posts — use a direct URL.

Slide sources live in this repo. PDF and HTML exports are built locally with `make talk-conf42`.

## Conf42 Observability 2026

**You Can't Debug What You Can't See: Observability for AI Agents**

- **Event:** [Conf42 Observability 2026](https://www.conf42.com/obs2026) — online, September 10, 2026
- **Duration:** 30 minutes (recorded)
- **Direct page:** [/talks/](/talks/) (this page)
- **Source:** [`talks/conf42-observability-2026/deck.md`](https://github.com/sks/sks.github.io/blob/main/talks/conf42-observability-2026/deck.md)
- **Speaker notes:** [`speaker-notes.md`](https://github.com/sks/sks.github.io/blob/main/talks/conf42-observability-2026/speaker-notes.md)
- **Transcript:** [`transcript.md`](https://github.com/sks/sks.github.io/blob/main/talks/conf42-observability-2026/transcript.md)
- **Demo agent (debug zip):** [`DEMO-AGENT.md`](https://github.com/sks/sks.github.io/blob/main/talks/conf42-observability-2026/DEMO-AGENT.md) · [`obs-debug-zip.yaml`](https://github.com/sks/sks.github.io/blob/main/talks/conf42-observability-2026/obs-debug-zip.yaml)
- **Canonical essay:** [You Can't Debug What You Can't See](/blog/observability/) (also [featured on CNCF](https://www.cncf.io/blog/2026/08/04/you-cant-debug-what-you-cant-see-observability-for-ai-agents/))
- **Deep dives:** [When agent observability lies](/blog/when-agent-observability-lies/) · [One zip per conversation](/blog/one-zip-one-conversation/)

Build the deck:

```bash
make talk-conf42
# outputs: talks/conf42-observability-2026/exports/deck.pdf and deck.html
```

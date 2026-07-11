# SEO progress — Production Notes

Track discoverability work for [productionnotes.dev](https://productionnotes.dev).  
Update checkboxes in PRs on branch `tracking/seo-progress` (merge to `main` when items ship).

**Last reviewed:** 2026-07-11

---

## Done (technical foundation)

- [x] Custom domain `productionnotes.dev` + HTTPS (GitHub Pages / Let's Encrypt)
- [x] `jekyll-seo-tag` — title, description, canonical, Open Graph, Twitter cards
- [x] `jekyll-sitemap` + `robots.txt` → sitemap URL
- [x] JSON-LD: Person, BlogPosting, FAQPage (hubs / series)
- [x] Series pillar + topic hubs + internal linking on top posts
- [x] Per-post `description` on all posts; custom OG images on priority posts
- [x] RSS at `/feed.xml`
- [x] Subscribe block (RSS; newsletter when `newsletter_url` is set)

---

## On-page (repo changes)

- [ ] Homepage meta: keyword-rich `title` + `description` in `index.md` (not "Home")
- [ ] About page `description` in `about.md` front matter
- [ ] WebSite JSON-LD on homepage (`head-custom.html`, layout `home`)
- [ ] Custom OG images for remaining high-traffic posts (replace `og-default.png`)
- [ ] Tag index `/tags/` — meta description + short intro copy
- [ ] `newsletter_url` in `_config.yml` after Buttondown signup

---

## Google Search Console

- [ ] Add property `https://productionnotes.dev`
- [ ] Verify ownership (DNS TXT in Cloudflare recommended)
- [ ] Submit sitemap: `https://productionnotes.dev/sitemap.xml`
- [ ] Request indexing: `/`, series pillar, 3 topic hubs, top 5 posts
- [ ] Weekly review: indexed pages, queries, impressions, CTR

---

## Backlinks & profiles

- [ ] GitHub profile → `https://productionnotes.dev`
- [ ] LinkedIn featured / about → custom domain
- [ ] StackGen or team bio link (if appropriate)
- [ ] Open-source READMEs → relevant posts (canonical URLs only)

---

## Distribution (canonical = productionnotes.dev)

- [ ] LinkedIn: 1 post/week with single article link
- [ ] Hacker News: 1 launch-quality post
- [ ] Reddit: 1 targeted community post (e.g. r/golang, r/devops)
- [ ] Dev.to (or similar): cross-post with `canonical_url` to blog
- [ ] July sprint doc executed (maintainer copy — not in repo)

---

## Content habits (ongoing)

- [ ] Each new post: primary keyword in title, H1, first ¶, `description`
- [ ] Each new post: links to 2 hubs + 1 related post
- [ ] No slug renames after publish (`/blog/:title/` permalinks)
- [ ] Refresh top posts with dated "Update" sections when behavior changes

---

## Redirect domains

- [ ] `agentbringup.dev` → bring-up post (Cloudflare redirect ruleset or UI)
- [ ] `sabithks.dev` → homepage (Cloudflare redirect ruleset or UI)

---

## Notes

| Item | Owner | PR / link |
|------|-------|-----------|
| | | |

# Speaking, CFPs & Linux Foundation — 2026 playbook

**For:** Sabith K S / Production Notes — enterprise AI agents in Go, SRE triage, observability, workflows.  
**As of:** 2026-07-11 (America/Los_Angeles). Deadlines move — always confirm on the official CFP page.

---

## Quick answer: API keys & newsletters

| Need | Solution |
|------|----------|
| **Never miss a CFP** | [CFP Land](https://www.cfpland.com) weekly email + [RSS](https://www.cfpland.com/conferences/) |
| **Browse open CFPs** | [PaperCall open CFPs](https://www.papercall.io/cfps) · [Sessionize explore](https://sessionize.com/explore) · [confs.tech](https://confs.tech/) |
| **Community-maintained list** | [scraly/developers-conferences-agenda](https://github.com/scraly/developers-conferences-agenda) · [developers.events/all-cfps.json](https://developers.events/all-cfps.json) |
| **Linux Foundation calendar** | [events.linuxfoundation.org/about/calendar](https://events.linuxfoundation.org/about/calendar/) — filter by category |
| **SRE-specific** | [USENIX SREcon mailing list](https://www.usenix.org/conference/srecon) (per-region signup) |
| **Go conferences** | [go.dev/wiki/Conferences](https://go.dev/wiki/Conferences) |
| **DevOpsDays (per city)** | [devopsdays.org/speaking](https://devopsdays.org/speaking/) |
| **LinkedIn posts** | No discovery API — Google Alert: `site:linkedin.com/posts "AI agents" OR SRE OR golang` |
| **Automate reminders** | Calendar invites 2 weeks before known annual CFP opens; optional [CFP Land API](https://cfpland.github.io/api-docs/) |

**LinkedIn:** there is still **no** public API to search engaging feed posts. Use saved searches + Google Alerts (same as social-radar).

---

## Your best talk angles (from Production Notes)

Pitch **production lessons**, not product demos:

| Angle | Example title | Best venues |
|-------|---------------|-------------|
| Go for agents | Go vs Python for production AI agent runtimes | GopherCon*, KubeCon, OSS Summit |
| Workflow bring-up | Debug multi-stage agent workflows like hardware bring-up | Platform Eng Day, SREcon, QCon |
| SRE + AI | What actually helps on-call vs demo theater | SREcon, Observability Day/Summit |
| Evidence-gated RCA | Prove, then narrate — deterministic orchestration | KubeCon co-located, PromCon |
| Observability | What traditional APM misses for agent workloads | Observability Summit/Day, Monitorama |
| Tokenomics | Context budgets as an operating model | Platform Eng, FinOps-adjacent tracks |
| HITL / security | When human approval makes agents worse | OpenSSF, security co-located events |
| IaC for agents | Terraform for agent configuration | OpenTofu Day, Platform Eng Day |

\*GopherCon US CFP closed for 2026 — target regional GopherCons or 2027 US CFP (opens ~Jan 18, 2027).

---

## Linux Foundation — projects to engage with (not only CFPs)

“Joining” usually means **contribute + speak + community meetings**, not membership fees.

### CNCF (cloud native — highest fit)

| Project / area | Why you | Engage via |
|----------------|---------|------------|
| **OpenTelemetry** | Agent traces, tool attribution | [OTel community](https://opentelemetry.io/community/), Observability Day/Summit |
| **Prometheus / PromCon** | SRE metrics, eval gates | [Prometheus CNCF](https://prometheus.io/community/), PromCon CFP |
| **Kubernetes** | Platform orchestration | KubeCon, SIG discussions, KCD meetups |
| **Argo CD / Flux** | GitOps + evidence verification posts | ArgoCon, FluxCon |
| **Backstage** | Internal developer platform | BackstageCon |
| **OpenTofu** | Terraform-for-agents post | OpenTofu Day |
| **Cilium / Envoy** | Networking/observability edges | CiliumCon, EnvoyCon |

### Agentic AI / MCP (2026 hot lane)

| Event | Dates | Notes |
|-------|-------|-------|
| [AGNTCon + MCPCon](https://events.linuxfoundation.org/) (EU/US) | Sep–Oct 2026 | Agent + MCP topics; many CFPs closed |
| [Agentics Day](https://events.linuxfoundation.org/) @ KubeCon NA | Nov 9, 2026 | Co-located; CFP closed Jun 21 |
| [MCP Dev Summit](https://events.linuxfoundation.org/) | Toronto Oct 5–6 | CFP open (see urgent list) |
| [Voice Agents Forum](https://events.linuxfoundation.org/) | Sep 16, 2026 SF | CFP closes Jul 24 |

### OpenSSF / security

- **OpenSSF Community Day** — supply chain, defense-in-depth for tool-wielding agents.
- CFP often tied to OSS Summit / Prague co-located week.

### Other LF foundations (lower priority unless topic match)

- **LF AI & Data** — PyTorch Conference, Kubeflow showcase.
- **LF Energy, Automotive, etc.** — only if you pivot topic.

**Speaker support contacts:** `cfp@linuxfoundation.org` · CNCF co-located: `cncfcolocatedevents@cncf.io` · KubeCon: `cfp@cncf.io`

---

## URGENT — LF CFPs still open (week of 2026-07-11)

Verify on [LF calendar](https://events.linuxfoundation.org/about/calendar/) before submitting.

| Event | Event date | CFP closes (per LF calendar) | Fit |
|-------|------------|-------------------------------|-----|
| [OSPOlogy + OSPO Summit China](https://events.linuxfoundation.org/) | Sep 7, 2026 | **Jul 12, 2026** | Open source program / governance |
| [kcpCON](https://events.linuxfoundation.org/) | Oct 1, 2026 (virtual) | **Jul 12, 2026** | K8s multicluster |
| [MCP Dev Summit Toronto](https://events.linuxfoundation.org/) | Oct 5–6, 2026 | **Jul 14, 2026** | MCP / agent tooling |
| [PromCon Europe](https://events.linuxfoundation.org/) | Oct 7–8, 2026 | **Jul 13, 2026** | Prometheus / SRE metrics |
| [Dapr Day Virtual](https://events.linuxfoundation.org/) | Oct 8, 2026 | **Jul 15, 2026** | Distributed app runtime |
| [LF Member European Forum](https://events.linuxfoundation.org/) | Oct 6, 2026 Prague | **Jul 21, 2026** | LF members (check eligibility) |
| [Virtual EnvoyCon](https://events.linuxfoundation.org/) | Oct 14, 2026 | **Jul 22, 2026** | Proxy/edge observability |
| [KubeVirt Summit Virtual](https://events.linuxfoundation.org/) | Oct 15, 2026 | **Jul 22, 2026** | Virtualization |
| [Voice Agents Forum](https://events.linuxfoundation.org/) | Sep 16, 2026 | **Jul 24, 2026** | Voice agents |
| [PyTorch Conference NA](https://events.linuxfoundation.org/) | Oct 20–21, 2026 | **Jul 26, 2026** | ML platform (stretch) |
| [Open Source in Finance Forum NY](https://events.linuxfoundation.org/) | Nov 4–5, 2026 | **Jul 26, 2026** | FinOps / platform |
| [Maintainer Summit](https://events.linuxfoundation.org/) | Nov 8, 2026 SLC | **Jul 19, 2026** | OSS maintainers |
| [ValkeyConf](https://events.linuxfoundation.org/) | Oct 5, 2026 Prague | **Aug 2, 2026** | Data store |
| [OCUDU Ecosystem Dev Summit](https://events.linuxfoundation.org/) | Oct 20–22, 2026 | **Aug 17, 2026** | Telco/edge |
| [MCP Dev Summit Nairobi](https://events.linuxfoundation.org/) | Nov 19–20, 2026 | **Aug 31, 2026** | MCP / agents |
| [OSS / ELC / OSS Japan](https://events.linuxfoundation.org/) | Dec 7–9, 2026 Tokyo | **Aug 24, 2026** | Broad open source |

### Already closed for H2 2026 (plan talk draft for 2027)

| Event | Event date | Notes |
|-------|------------|-------|
| KubeCon + CloudNativeCon NA | Nov 9–12, 2026 SLC | Main + co-located CFP closed May–Jun 2026 |
| Platform Engineering Day NA | Nov 9, 2026 | Co-located @ KubeCon |
| Observability Day NA | Nov 9, 2026 | Co-located |
| Open Source Summit Europe | Oct 7–9, 2026 Prague | CFP closed Jun 24, 2026 |
| Observability Summit Europe | Oct 5, 2026 Prague | CFP closed |
| OSS Summit North America | May 18–20, 2026 Minneapolis | CFP closed Feb 2026 |

---

## Non–Linux Foundation conferences

### USENIX SREcon (top tier for your SRE content)

| Event | When | CFP status (Jul 2026) |
|-------|------|------------------------|
| [SREcon26 Americas](https://www.usenix.org/conference/srecon26americas) | Mar 24–26, 2026 Seattle | **Passed** — talks closed Nov 2025 |
| [SREcon26 EMEA](https://www.usenix.org/conference/srecon26emea) | Oct 13–15, 2026 Dublin | **Closed** May 27, 2026 |
| SREcon27 Americas | Apr 12–14, 2027 Seattle | **Save the date** — [sign up for updates](https://www.usenix.org/conference/srecon) |

**Stay updated:** USENIX conference email list per region.

### Go / GopherCon ecosystem

| Event | When | CFP (Jul 2026) |
|-------|------|----------------|
| [GopherCon 2026](https://www.gophercon.com/) US | Aug 3–6 Seattle | Closed Mar 4, 2026 |
| [GopherCon Europe](https://gophercon.eu/) | Jun 15–18 Berlin | Check [Sessionize gceu26](https://sessionize.com/gceu26/) |
| [GopherCon Latam](https://gopherconlatam.org/) | Sep 2–4 Brazil | Often open via Google Form |
| [GopherCon China](https://gophercon.com.cn/) | Oct 15–16 | Check site |
| [GoLab](https://golab.io/) | Nov 1–3 Bologna | Watch site / [go.dev/wiki/Conferences](https://go.dev/wiki/Conferences) |
| **GopherCon 2027 US** | TBD | CFP opens **~Jan 18, 2027** (per gophercon.com) |

### QCon / InfoQ (curated — no open CFP)

- [QCon San Francisco](https://qconsf.com/) — Nov 16–20, 2026 — tracks: **Engineering AI Systems**, **Real World Platform Engineering**.
- [QCon AI Boston](https://qconferences.com/) — Jun 2026 — production AI focus.
- **How to speak:** email **info@qconferences.com** with talk abstract + production war stories (they hand-pick practitioners).

### DevOpsDays (open CFPs — Jul 2026)

From [devopsdays.org/speaking](https://devopsdays.org/speaking/):

| City | CFP closes | Event |
|------|------------|-------|
| Cairo | 2026-07-25 | 2026-09-26 |
| Portugal (w/ KCD Porto) | 2026-07-31 | 2026-11-19 |
| Bogotá | 2026-08-31 | 2026-10-23 |
| Florianópolis | 2026-08-30 | 2026-10-24 |
| Warsaw | 2026-08-30 | 2026-11-23 |
| Almaty | 2026-10-01 | 2026-10-16 |
| Salvador / Recife | Aug 2026 | Dec 2026 |

Also check [KCD Porto 2026](https://community.cncf.io/) — CFP mentioned through mid-July 2026.

### Other communities worth watching

| Conference | Focus | CFP pattern |
|------------|-------|-------------|
| [Monitorama](http://monitorama.com/) | Observability | Annual, watch Twitter/Mastodon |
| [LeadDev](https://leaddev.com/) | Engineering leadership | Curated + CFP for some events |
| [Velocity / distributed systems](https://www.usenix.org/) | USENIX | Various |
| [AI Engineer Summit](https://www.ai.engineer/) | Production AI | Watch site / newsletter |
| Regional **KCD** (CNCF) | Cloud native community | [community.cncf.io](https://community.cncf.io/) |

---

## How to stay updated in 2026 (set once, review weekly)

### 1. Email newsletters (recommended)

| Newsletter | What you get | Sign up |
|------------|--------------|---------|
| **CFP Land** | Weekly open CFPs, sorted by deadline | [cfpland.com](https://www.cfpland.com) |
| **PaperCall WeeklyCFP** | Was popular; status unclear — use CFP Land as primary | [papercall.io](https://www.papercall.io) |
| **USENIX / SREcon** | Per-conference announcements | [usenix.org](https://www.usenix.org) |
| **CNCF / KubeCon** | CFP open/close emails if you attended or subscribed | [cncf.io](https://www.cncf.io) |
| **LF Events** | Major summit announcements | [events.linuxfoundation.org](https://events.linuxfoundation.org) |
| **Gopher Academy** | GopherCon CFP timing | [gophercon.com](https://www.gophercon.com) |
| **InfoQ / QCon** | Curated conference updates | [qconferences.com](https://qconferences.com) |

### 2. RSS / APIs (for nerds + automation)

| Source | URL |
|--------|-----|
| CFP Land RSS | Linked from [cfpland.com/conferences](https://www.cfpland.com/conferences/) |
| CFP Land API | `GET https://api.cfpland.com/v0/conferences` (CFPs closing in ~21 days) |
| developers.events JSON | `https://developers.events/all-cfps.json` |
| LF calendar | Poll weekly or bookmark filtered view |

### 3. Calendar reminders (annual CFP open — set in Google Calendar)

| Event | Typical CFP opens | Typical CFP closes | Set reminder |
|-------|-------------------|--------------------|--------------|
| GopherCon US | ~3rd Mon Jan | ~early Mar | Jan 1: draft abstract |
| KubeCon NA co-located | ~early May | ~mid Jun | Apr 15 |
| KubeCon EU co-located | ~Sep prior year | ~Nov | Aug 1 |
| OSS Summit NA | ~early Jan | ~mid Feb | Dec 15 |
| OSS Summit EU | ~spring | ~late Jun | May 1 |
| SREcon Americas talks | ~summer prior year | ~Nov | Jul 1 |
| SREcon EMEA talks | ~spring | ~late May | Apr 1 |

### 4. Speaker profile (submit faster)

Create once on [Sessionize](https://sessionize.com/) — LF + many Go conferences use it.

Optional: [PaperCall speaker profile](https://www.papercall.io) for smaller events.

### 5. Weekly 15-minute ritual

1. Skim **CFP Land** email.  
2. Check [devopsdays.org/speaking](https://devopsdays.org/speaking/).  
3. Scan [LF calendar](https://events.linuxfoundation.org/about/calendar/) for new “CFP Status: Open”.  
4. Pick **one** thread from social-radar digest to turn into a comment or talk seed.

---

## Awesome GitHub repos to study

### CFP discovery & speaking

| Repo | Stars | Why |
|------|-------|-----|
| [scraly/developers-conferences-agenda](https://github.com/scraly/developers-conferences-agenda) | High | Community conference + CFP list |
| [cfpland/api-docs](https://github.com/cfpland/api-docs) | — | CFP Land API docs |
| [cfpland/rss-worker](https://github.com/cfpland/rss-worker) | — | RSS feed generation |

### Social listening / digests (related to social-radar)

| Repo | Why |
|------|-----|
| [mickdur/tech-watch](https://github.com/mickdur/tech-watch) | Actions → HN/Reddit/RSS → Telegram digest |
| [marcT1/ai-news-dashboard](https://github.com/marcT1/ai-news-dashboard) | Actions → JSON + Pages dashboard |
| [solcreek/sunbreak](https://github.com/solcreek/sunbreak) | Go keyword monitor (HN, RSS, Reddit) |
| [mbtz/morningweave](https://github.com/mbtz/morningweave) | Go CLI digest scheduler |
| [adrienckr/notslop](https://github.com/adrienckr/notslop) | HN/Reddit/X digest for drafting posts |
| [jedi4ever/social-skills](https://github.com/jedi4ever/social-skills) | Fetch HN/Reddit/GitHub as markdown for agents |

### Go / cloud native (content inspiration)

| Repo | Why |
|------|-----|
| [cncf/landscape](https://github.com/cncf/landscape) | Map where your talks fit |
| [open-telemetry/opentelemetry-go](https://github.com/open-telemetry/opentelemetry-go) | Observability angle |
| [prometheus/prometheus](https://github.com/prometheus/prometheus) | PromCon / SRE overlap |
| [golang/go](https://github.com/golang/go) | GopherCon ecosystem |

---

## 2027 — already on the radar

From [LF calendar](https://events.linuxfoundation.org/about/calendar/) (CFP details TBD):

| Event | Dates |
|-------|-------|
| LF Member Summit | Feb 22–23, 2027 Half Moon Bay |
| KubeCon + CloudNativeCon Europe | Mar 15–18, 2027 Barcelona |
| Open Source Summit North America | May 17–19, 2027 Vancouver |
| Open Source Summit Europe | Sep 20–22, 2027 Glasgow |
| KubeCon + CloudNativeCon NA | Nov 8–11, 2027 New Orleans |
| SREcon27 Americas | Apr 12–14, 2027 Seattle |

**Action now:** draft 2–3 talk abstracts in `_drafts/` so you can submit within 48h when 2027 CFPs open.

---

## Submission checklist

- [ ] Abstract leads with **problem in production**, not “we use AI”
- [ ] No vendor pitch; StackGen/Aiden only as context
- [ ] Link to Production Notes post as optional further reading
- [ ] Sessionize/PaperCall profile + headshot updated
- [ ] Confirm travel / remote policy for each event
- [ ] Add deadline to calendar with 48h and 1-week reminders

---

## Sources

- [Linux Foundation Events Calendar](https://events.linuxfoundation.org/about/calendar/) (fetched 2026-07-11)
- [USENIX SREcon](https://www.usenix.org/conference/srecon)
- [DevOpsDays Speaking](https://devopsdays.org/speaking/)
- [Go Wiki: Conferences](https://go.dev/wiki/Conferences)
- [CFP Land](https://www.cfpland.com)
- [philna.sh — How to find CFPs](https://philna.sh/blog/2020/01/29/how-to-find-cfps-for-developer-conferences/)

*Companion to social-radar — update when LF calendar changes.*

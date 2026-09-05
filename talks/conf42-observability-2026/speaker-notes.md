# Speaker notes — Conf42 Observability 2026

**Target:** 26–28 min spoken + 2 min buffer  
**Format:** Recorded talk; demo segments are separate takes you can re-cut.  
**Full spoken script:** [transcript.md](./transcript.md)

**Live demo agent (optional, local only):** [DEMO-AGENT.md](./DEMO-AGENT.md) · [obs-debug-zip.yaml](./obs-debug-zip.yaml) — not required for Conf42 recording (CFP: no live cloud).

## Audience takeaways (must land)

| Moment | What they should leave with |
|--------|-----------------------------|
| Cost canary | Ship spend **and** loop caps before scale |
| Session traces | Instrument plan → gather → present, not one HTTP span |
| Evidence | Don’t grade correctness without an evidence path |
| Starter set slide | **Screenshot** — two Monday actions + six signals |
| Five lessons | Remember line: **cost + loop count + grounded present** |

## Conf42 / online recording checklist

From Conf42 speaker feedback and general online-speaker guidance:

- [ ] External mic, quiet room (audio beats resolution)
- [ ] Camera at eye level; look at **lens**, not the slide window
- [ ] Retake Segment A / B separately; Conf42 is pre-recorded on purpose
- [ ] Don’t read bullets — Conf42 wants practical lessons, not a pitch
- [ ] Hold starter-set slide 3–4s and say “screenshot this”
- [ ] No live cloud dependency on the recording
- [ ] Export PDF matching the recording: `make talk-conf42-pdf`

## Recent industry crib (ad-lib / Q&A)

| Beat | Why it matters | Link |
|------|----------------|------|
| Black-box without span traces | Validates session-trace pillar | [MLflow 2026 guide](https://mlflow.org/articles/what-is-agent-observability-a-2026-developer-guide/) |
| Bad retrieval → order-of-magnitude cost | Validates tool attribution | same |
| Loops look like latency; alert on tool-loop count | Validates cost canary + loop signal | [Alice Labs 2026](https://alicelabs.ai/en/insights/ai-agent-observability-guide-2026) |
| Invoice-too-late → in-process circuit breakers | Validates hard caps | [AgentBudget](https://agentbudget.dev/agentbudget_whitepaper_v1.pdf), [costfuse](https://github.com/costfuse/costfuse) |
| OTel ≠ groundedness | Validates evidence pillar | [OTel GenAI SIG](https://www.integrationplumbers.io/resources/inside-the-opentelemetry-genai-sig) |
| Judge high score, empty evidence path | Validates “fluent ≠ grounded” | [GroundEval](https://arxiv.org/html/2606.22737) |
| Longer write-up | Close / Discord | [productionnotes.dev](https://productionnotes.dev/blog/observability/) |

Don’t dump URLs on slides. One plain-language beat per section is enough.

## Accepted abstract (stay true)

Traditional APM tells you a request was slow. It won't tell you an agent burned 40k tokens narrating a wrong answer. Observability for AI agents needs new primitives: **session traces** across multi-step reasoning, **tool attribution** (which call cost what), and **token budgets** as first-class signals. This talk covers what we instrument at StackGen — spans that follow an agent through **plan/gather/present**, **per-tool cost and latency**, and **evidence checks** that show whether output was grounded — plus how we **debug a bad session after the fact**. You'll leave with an observability **starter set** that goes beyond dashboards into **"why did this agent do that."**

### Organizer speaker notes

Slides + example traces/dashboards. Stack: **OpenTelemetry** session traces, **Langfuse**-style LLM tracing, token/cost metrics, tool attribution, and evidence checks; visualized in **Grafana/Datadog**-style panels. Reference runtime **Go**. **No live cloud.**

## Block timing

| Block | Focus | Target |
|-------|--------|--------|
| Hook + primitives | 40k tokens, four primitives + industry | ~6:30 |
| Instrument | plan/gather/present, attribution, evidence, dual-sink | ~9:00 |
| Visibility lies | scorecard / coverage | ~3:00 |
| Debug after the fact | ZIP + batch gates | ~5:00 |
| Starter set + close | Screenshot + five lessons | ~3:30 |

## Retake cues

### Segment A — Session trace (~90s)

- Expand: **plan → gather → present**
- Call out: repeated tool (loop), **per-tool** latency/tokens/$, evidence on present
- Anonymize tenant; mock SVG is CFP-safe (no live cloud)

### Segment B — Debug ZIP (~90s)

- `manifest.json`, `execution.json`, `subscribe-events.ndjson`
- One sentence on `judge-report` / evidence grade
- Emphasize: one download for the whole conversation

## Links to mention on close

- Site: https://productionnotes.dev/
- Blog post: https://productionnotes.dev/blog/observability/
- StackGen Discord: https://discord.com/invite/GNVmqXjwT
- CNCF feature: https://www.cncf.io/blog/2026/08/04/you-cant-debug-what-you-cant-see-observability-for-ai-agents/

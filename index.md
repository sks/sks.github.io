---
layout: home
title: "Enterprise AI Agents in Go (Runtime & SRE)"
description: "Production notes on enterprise AI agent runtimes, SRE agents, and durable workflows in Go — by StackGen Principal Engineer Sabith K S."
---

<section class="home-hero" aria-labelledby="home-title">
  <p class="home-eyebrow">Production engineering · AI agents · SRE</p>
  <h1 id="home-title">Production Notes</h1>
  <p class="home-hero__tagline">Build AI agents you can debug, evaluate, and operate.</p>
  <p class="home-hero__lead">Practical notes on runtimes, tool calls, incident investigations, and the unglamorous controls that make agent systems useful after the demo.</p>
  <div class="home-actions">
    <a class="button button--primary" href="/blog/best-way-to-debug-multi-step-ai-agent/">Debug an agent</a>
    <a class="button" href="/start/go-runtime/">Explore the runtime path</a>
  </div>
  <p class="home-proof"><strong>Featured by CNCF:</strong> <a href="https://www.cncf.io/blog/2026/08/04/you-cant-debug-what-you-cant-see-observability-for-ai-agents/">You Can’t Debug What You Can’t See — Observability for AI Agents</a></p>
</section>

## Start with a production problem

No need to read the whole archive. Pick the problem in front of you and follow a focused path.

<div class="guide-grid">
  <article class="guide-card">
    <p class="guide-card__label">Debugging</p>
    <h3><a href="/blog/best-way-to-debug-multi-step-ai-agent/">Find where an agent run went wrong</a></h3>
    <p>Freeze a reproducible task, inspect the trace, and replay one controlled change.</p>
  </article>
  <article class="guide-card">
    <p class="guide-card__label">Evaluation</p>
    <h3><a href="/blog/how-to-evaluate-ai-agent-root-cause-analysis/">Test whether an RCA is trustworthy</a></h3>
    <p>Score evidence and named unknowns before fluency, latency, or token cost.</p>
  </article>
  <article class="guide-card">
    <p class="guide-card__label">Architecture</p>
    <h3><a href="/blog/what-is-an-ai-agent-runtime/">Understand the agent runtime boundary</a></h3>
    <p>Separate the execution loop from the model, chat UI, and multi-tenant platform.</p>
  </article>
  <article class="guide-card">
    <p class="guide-card__label">Language choice</p>
    <h3><a href="/blog/why-go/">Compare Go and Python for AI agents</a></h3>
    <p>Make the trade-off using deployment, concurrency, libraries, and team experience.</p>
  </article>
  <article class="guide-card">
    <p class="guide-card__label">Operations</p>
    <h3><a href="/blog/steer-ai-agents-mid-run/">Interrupt or contain an active agent</a></h3>
    <p>Apply corrections at safe boundaries without silently dropping operator feedback.</p>
  </article>
  <article class="guide-card">
    <p class="guide-card__label">API selection</p>
    <h3><a href="/blog/chat-completions-vs-responses-api/">Diagnose API, model, and latency choices</a></h3>
    <p>Distinguish Chat Completions, Responses, reasoning effort, retries, and tool wait.</p>
  </article>
</div>

## Choose a reading path

| Path | Best for |
|------|----------|
| **[SRE on-call starter pack](/start/sre-on-call/)** | Triage, RCA, observability — 5 posts |
| **[SRE as service starter pack](/start/sre-as-service/)** | Investigation as a service product — 5 posts |
| **[Go agent runtime starter pack](/start/go-runtime/)** | Runtime definition, Go vs Python, platform split — 5 posts |
| **[ClickHouse on AWS starter pack](/start/clickhouse-aws/)** | Self-managed ClickHouse from first principles — full series |
| **[Full enterprise AI agent series](/series/enterprise-ai-agents-go/)** | Searchable archive in full reading order |
| **[Service Rendered Efficiently](/series/service-rendered-efficiently/)** | AI investigation as a service product for on-call |

## Pocket checklists

Copy these into an incident review or agent launch review. No proprietary schemas required.

- **[Debug a multi-step agent](/checklists/agent-debug/)** — reproduce, inspect, change one thing, replay
- **[Review evidence-gated RCA](/checklists/evidence-gated-rca/)** — claims, receipts, and unknowns
- **[Ask whether the agent task is done](/checklists/agent-done/)** — independent verification and mutation safety
- **[Review SRE as a service](/checklists/sre-as-service/)** — reuse, honest partials, and handoff

## Browse by topic

- **[AI agent runtime](/topics/ai-agent-runtime/)** — execution boundaries, debugging, testing, and Go architecture
- **[AI agent workflows](/topics/ai-agent-workflows/)** — bring-up, evidence-gated RCA, and verification
- **[AI agents for SRE](/topics/ai-agents-sre/)** — triage, observability, and tokenomics
- **[AI incident triage](/topics/ai-incident-triage/)** — on-call triage versus demo theater
- **[Go AI agents](/topics/go-ai-agents/)** — language choice and platform architecture
- **[ClickHouse on AWS](/topics/clickhouse-aws/)** — engines, S3 storage, spot readers, and cost
- **[Service Rendered Efficiently](/topics/service-rendered-efficiently/)** — investigation product design

## About these notes

I’m Sabith K S, a Principal Engineer at [StackGen](https://stackgen.com). I write about the systems we build, the mistakes we make, and what we can learn from them. The examples often come from building **[Aiden](/blog/aiden-platform/)**, StackGen’s platform for running agents for multiple teams, and from site reliability engineering (SRE) work.

These are engineering notes from a particular production setting, not a claim that every team needs an agent—or needs to build one in Go.

{% include subscribe.html %}

## Connect

- **Newsletter**: [Subscribe on Substack]({{ site.newsletter_url }}){% if site.substack_latest_issue_url != "" %} · [{{ site.substack_latest_issue_label }}]({{ site.substack_latest_issue_url }}){% endif %} · [RSS](/feed.xml)
- **GitHub**: [@sks](https://github.com/sks)
- **LinkedIn**: [Sabith](https://linkedin.com/in/sabithks)
- **Company**: [StackGen](https://stackgen.com)

---
layout: post
title: "Beyond Confluence Runbooks: Why GitOps Triage Steps Matter in the AI Era"
date: 2026-07-13 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 20
description: "Wiki playbooks trained a generation of on-call engineers. AI agents need procedures that change with your stack — and that's an argument for version-controlled runbooks, not against human-friendly docs."
tags: [runbooks, gitops, confluence, sre, incident-response, ai-agents, golang]
---

A checkout latency alert fires at 2 AM. The on-call engineer opens Confluence, finds a twelve-page playbook with screenshots, and starts clicking through dashboards. Meanwhile, an incident agent retrieves three overlapping wiki chunks from different years and proposes a remediation step that sounds reasonable but was retired eighteen months ago.

Both are following "the runbook." They are not following the same runbook.

This post is not a manifesto to delete your wiki. It is a case study in **when GitOps-style triage artifacts beat wiki articles**, when they do not, and why the honest answer is probably "both, with a clear boundary." The scenario below is **composite and fictional** — it illustrates a pattern we have seen across several production rollouts, not a transcript of any one customer's playbook.

It pairs with [Your RCA Agent Doesn't Need Another Runbook — It Needs a Map](/blog/agents-need-a-map-not-a-script/): that post argues against runbook-as-only-navigation. This one argues for **executable** runbooks when the investigation graph itself must stay reviewable and gated.

---

## The Fictional Incident: Checkout Latency Spike

**Alert:** P95 latency on `POST /v2/checkout` exceeded SLO for fifteen minutes in `prod`.

**Symptoms operators care about:** slow confirmations, elevated cart abandonment, support tickets clustering on mobile web.

**The investigation question:** Is this a traffic spike, a bad deploy, downstream payment latency, or database saturation?

That is generic enough to be universal. How you *encode* the answer is not.

---

## Version A — The Wiki Playbook

A mature team's Confluence article — the kind exported to PDF for auditors and pinned in the `#payments-oncall` channel.

**What it contains:**

* A calm narrative intro: "This playbook covers checkout slowness when the latency SLO page fires."
* Embedded screenshots of the "Payments Overview" dashboard with arrows drawn on heatmaps.
* Step list in prose: acknowledge the page, open dashboard A, compare to last week, check the deploy calendar, open dashboard B if errors rose, skim logs for timeout strings, escalate to the database team if pool wait time looks high.
* A sidebar link to a *different* article: "Connection pool exhaustion — read this if checkout is slow but CPU is fine."
* Example values baked into the text: `prod-us`, `checkout-api`, a sample trace ID format, a phone number for the payments duty manager.

**Why humans love it:** context, visuals, escalation culture, and the story of *when* to stop guessing and call for help.

**Why agents struggle:**

| Wiki habit | What breaks with automation |
| --- | --- |
| "Open the payments dashboard" | Which dashboard? v2 replaced v1 last quarter; search still ranks the old page. |
| Example region prod-us in step 2 | Tonight's alert is prod-eu; the agent copies the example literally. |
| "Compare to last week" | No time window, no metric name, no empty-result behavior. |
| Cross-link to pool exhaustion doc | Retrieval may pull only the checkout page; the branch is never taken. |
| "Skim logs for timeouts" | No service filter, no rate limit, no stop condition. |

None of this means the wiki article is bad. It means it was written for a **human who already knows the system** — not for an executor that needs an interface contract.

---

## Version B — Git-Managed Triage (Same Incident Class)

The same investigation lives in **version-controlled markdown** wired into an agent workflow through config-as-code. No parallel YAML DSL for operators to maintain — but also **not** "the LLM reads English and hopes."

That distinction matters. If execution were pure natural-language interpretation, Version B would inherit Version A's failure modes with a shorter retrieval window. We avoided that by splitting responsibilities across three layers:

| Layer | Who reads it | What it controls |
| --- | --- | --- |
| **Human steps** | On-call engineers | Numbered prose — trigger, actions, decision points |
| **Structured metadata** | CI + workflow binder | Key-value block inside HTML comments — never parsed from bullet wording |
| **Workflow gates** | Runtime (deterministic) | Evidence lines must exist before the next stage advances |

The markdown is the *authoring surface*. The workflow is the *execution contract*. The model fills gaps inside a bounded skill — it does not freestyle the investigation graph.

### Vocabulary (three terms, one example)

These show up throughout the rest of the post — here is what they mean in practice on a checkout latency workflow:

| Term | Plain meaning | Example |
| --- | --- | --- |
| **Bound skill** | A registered runbook fragment the workflow invokes by ID, with a fixed tool allowlist | Skill `confirm_scope` may call observability queries — not arbitrary shell |
| **Evidence line** | A structured note the agent writes after a tool-backed step; gates grep for it | `evidence:scope_summary=service=checkout-api region=prod-eu …` |
| **Workflow gate** | Deterministic check before stage N+1 starts — no LLM vote | Stage 2 blocked until output contains `evidence:scope_summary=` |

Gates are regex or parser checks on agent output, not model judgment calls. That is the line between "markdown authoring" and "deterministic execution." See also [evidence-gated multi-plane RCA](/blog/evidence-gated-multiplane-rca/).

### What operators actually write

**Critical design choice:** machine contract lives in the HTML comment; human prose below stays free-form. We do **not** lint `- **Input:**` bullet text — engineers can rewrite steps, add italics, or say "Inputs" without breaking CI.

### Stage 1 — Confirm scope

```markdown
<!--
step: confirm_scope
input: alert.labels
action: observability.query
output: scope_summary
on_empty: discover_labels, rebuild_query, retry_once
-->

1. Parse service, region, and window from the page — never from examples in this doc.
2. Pull P95 latency and error rate for that slice.
3. If the query returns empty, discover label keys from the observability API, rebuild once, and note what changed.
```

An engineer who rephrases step 2 as "Check latency and errors for the alerted slice" does not touch the contract. Only the comment block is schema.

### Under the hood (illustrative)

CI walks the markdown AST, visits HTML comment nodes, parses key-value lines inside, and validates against a small registry — step IDs exist, `action` maps to an allowed tool family, `output` names a known evidence key. Sketch of the idea:

```go
// Illustrative: collect machine contracts from HTML comments only.
// Prose bullets below each heading are never part of the schema.
type stepMeta struct {
    ID, Input, Action, Output string
}

func collectStepMeta(comments []string) ([]stepMeta, []error) {
    var steps []stepMeta
    var errs []error
    for _, raw := range comments {
        meta, err := parseCommentKV(raw)
        if err != nil {
            errs = append(errs, err)
            continue
        }
        if meta.ID != "" {
            steps = append(steps, meta)
        }
    }
    return steps, errs
}
```

`parseCommentKV` is mundane string splitting and required-key checks — not an NLP pipeline. If the comment block is malformed, the PR fails. If the prose is messy, nobody cares.

At runtime, each `step` ID maps to a **bound skill** with a fixed tool allowlist. Stage 2 cannot start until stage 1 emitted an **evidence line** matching the gate pattern for `scope_summary`. That is how [evidence-based verification](/blog/evidence-based-verification/) plugs in: triage proposes inside the skill; gates promote or block deterministically.

### Why not lint the bullets?

Parsing nested markdown list text for `**Input:**` vs `*Inputs:*` vs an extra space is brittle — exactly the fight platform teams lose when they pretend markdown is YAML. Front-matter-style metadata inside comments gives you:

* **Stable machine parsing** without a second file format operators must learn
* **Pristine human prose** SREs actually want to edit after incidents
* **Clear PR diffs** — contract changes show up in the comment block; narrative edits stay separate

When a team outgrows comment blocks, the escape hatch is generating the skill registry from explicit config *alongside* the markdown — not replacing the human-readable layer.

### The four stages (simplified)

1. **Confirm scope** — parse labels from the alert; query latency and error rate; discover tags on empty series.
2. **Correlate change** — deploy events and feature-flag toggles in the incident window.
3. **Check saturation** — database wait, pool utilization, downstream payment client latency (parallel where safe).
4. **Synthesize** — merge evidence into ranked hypotheses; no remediation without policy.

Regression fixtures carry synthetic alert payloads through CI. If a gate stops matching, the pipeline fails before the next pager — not after a bad incident.

---

## The Devil's Advocate for Confluence (Steel-man)

If I were defending the wiki in an architecture review:

**Most knowledge is not executable.** Vendor contacts, escalation trees, compliance narratives, architecture decision history — keep these human-first. Forcing everything into Git because agents exist creates empty modules and angry technical writers.

**Storytelling is a feature.** The wiki explains *why* pool exhaustion masquerades as API latency, when to call the payments duty manager, and what "good" looks like on a heatmap. Juniors often learn faster from a well-curated page than from a diff.

**GitOps can create a priesthood.** Not every responder wants a PR to fix a typo in step 3. If only platform teams can edit executable runbooks, shadow knowledge returns in Slack pins and oral tradition.

**RAG is good enough for narrowing.** Semantic search plus strict citation gets surprisingly far for read-only triage. The cliff edge is mutating steps and cross-system branches.

**Screenshots orient humans in seconds.** A heatmap PNG beats a paragraph of axis labels for the bridge lead.

**Verdict:** Confluence is not wrong. **Confluence as the only executable contract for agents** is wrong.

---

## Wiki vs Git: Where Each Format Wins

| Dimension | Wiki / PDF playbook | Git-managed triage + workflow binding |
| --- | --- | --- |
| **Authoring friction** | Low — edit page, done | Medium — PR, comment-block lint, smoke test |
| **Staleness detection** | Periodic audits, angry pages | CI fails; gates stop matching |
| **How the agent runs it** | RAG chunks + LLM improvisation | Bound skill per step + deterministic gates |
| **Execution determinism** | None — prose is ambiguous | Gates require evidence lines; tools are allowlisted |
| **Human onboarding** | Strong narrative | Needs companion "why we investigate this way" |
| **Environment variance** | Often hardcoded examples | Parse from alert + discover-first probes |
| **Dual reality risk** | Two humans, two docs | Human reads wiki; agent runs pinned Git revision |
| **Postmortem loop** | Comment threads | Reviewed diff + execution cites revision |
| **Remediation safety** | Policy in prose | Policy rules + HITL gates ([defense in depth](/blog/defense-in-depth/)) |

Procedures change faster than wiki culture: dashboards rename, metrics get prefixed, new regions use different labels. Wiki updates are voluntary; deploy pipelines are not. Agents do not get immunity from stale docs — they get **speed without verification** unless the execution contract is pinned and gated.

---

## What Actually Works: Split the Corpus

The pattern that survived production is **not** "delete Confluence." It is a deliberate split:

| Corpus | Lives in | Consumed by |
| --- | --- | --- |
| **Executable triage** | Git — markdown skills, workflow stages, machine appendices | Agents on critical paths; humans who want canonical steps |
| **Institutional narrative** | Wiki / docs | Training, postmortems, compliance, "why" |
| **Ephemeral incident state** | Incident channel + agent notes | The specific regions, trace IDs, and timestamps for *this* page |

The wiki article remains a fine **training artifact**. The Git revision is the **execution contract**. Export or link from wiki to Git on each release if that is how your org discovers docs.

Think of it like infrastructure: you would not replace your architecture wiki with a Helm chart, but you would not deploy production from a Confluence table either.

---

## A Practical Migration Path (No Big Bang)

1. **Pick one high-churn alert class** — latency SLO breach, error-rate spike, queue depth — where dashboard drift already burned you.
2. **Lift decisions, not URLs** — replace brittle links with named integrations and discover-first queries; keep the wiki link as a human shortcut.
3. **Put contract in comment blocks** — `step`, `input`, `action`, `output` as key-value metadata; keep human steps as normal prose.
4. **Lint comments in CI** — AST walk + registry validation before the runbook can bind to a workflow.
5. **Pin revision on Sev-1** — high severity uses a bound version; lower severity can still search the wiki.
6. **Tabletop the divergence** — same synthetic alert through human-with-wiki and agent-with-Git; fix the doc or the gate once.

We are not optimizing for agents to sound smart. We are optimizing for **the same investigation to run twice and agree with itself** — a bar most wiki-only programs never needed until AI joined the bridge.

---

## Closing Thought

The uncomfortable truth for 2026: **RAG over messy, human-centric wikis is a recipe for operational chaos** if you treat retrieval as execution. Markdown in Git only helps when something other than the model decides whether step 3 actually finished — comment-block metadata for the contract, bound skills for tool scope, evidence lines for proof, gates for promotion.

Platform engineers feel this boundary first. You can build the comment linter, the skill registry, and the gate checks yourself — or you can adopt a platform that already separates human narrative from rigid execution. That separation — wiki for *why*, Git comments for *what must run*, workflows for *when it is allowed to advance* — is why we built Aiden at StackGen: platform teams should not have to invent a shadow YAML engine just to stop agents from improvising on Confluence crumbs.

---

## Related reading

- [Your RCA Agent Doesn't Need Another Runbook — It Needs a Map](/blog/agents-need-a-map-not-a-script/) — maps for navigation; runbooks as overlay
- [Evidence-Gated RCA — Prove, Then Narrate](/blog/evidence-gated-multiplane-rca/) — dual-audience playbooks and stage gates
- [Defense in Depth for Tool Calls](/blog/defense-in-depth/) — policy and HITL around remediation
- More on [AI agents for SRE](/topics/ai-agents-sre/) · full [series](/series/enterprise-ai-agents-go/)

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

*Where does your org draw the line between wiki narrative and executable runbooks? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

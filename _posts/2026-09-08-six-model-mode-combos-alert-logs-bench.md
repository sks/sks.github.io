---
layout: post
title: "Six Model×Orchestration Combos on One Alert+Logs Job"
date: 2026-09-08 12:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 58
description: "Same dual-part observability prompt across three model classes and single-agent ReAct vs hierarchical ReAcTree. Wall, tokens, cost, correctness, and an efficiency score you can steal."
image: /assets/images/og-default.png
tags: [ai-agents, benchmarking, evaluation, tokenomics, sre, observability, reactree, react, reasoning, aiden]
permalink: /blog/six-model-mode-combos-alert-logs-bench/
faqs:
  - question: "What did you hold constant across the six combos?"
    answer: "Same dual-part prompt (firing alert triage + namespace log anomaly 24h vs 7d), same live Grafana/Loki tools, same host settings, same wall budget. Only model class and orchestration shape (single-agent ReAct vs hierarchical ReAcTree) changed."
  - question: "Which combo won on efficiency?"
    answer: "xAI-class reasoning under hierarchical ReAcTree ranked first on both harness waves. OpenAI gpt-5.4 followed. OpenAI Responses reasoning preview was slowest and most expensive per useful close."
  - question: "How do you define efficiency?"
    answer: "correctness / (0.45·wall/median + 0.45·tokens/median + 0.10·cost/median). Relative within a cohort. Always publish absolute wall and tokens next to it."
  - question: "Did hierarchical ReAcTree beat single-agent ReAct?"
    answer: "On this job, hierarchical was a slight win for xAI (faster wall, similar tokens). For gpt-5.4, the hierarchical run used fewer total prompt tokens in the first wave. For the Responses reasoning preview, hierarchical once collapsed quality and later recovered only after host gates — never the cheap win."
---

Vendors sell model cards. Operators need a **receipt**: same job, six seats, numbers you can argue about on Monday.

We ran one dual-part observability job six ways:

1. **xAI-class reasoning** × single-agent / hierarchical  
2. **OpenAI gpt-5.4 (generate)** × single-agent / hierarchical  
3. **OpenAI Responses reasoning preview** × single-agent / hierarchical  

Same live Grafana/Loki plane. Same prompt. Same host settings. We ran this on our production agent runtime ([Aiden](/blog/aiden-platform/)). This is the scorecard. Qualitative close styles live in [how the models think](/blog/what-reasoning-models-write-on-triage/). Tool inventory lives in [the tool menu](/blog/observability-tools-agents-actually-call/).

n = 1 per cell. Directional. Steal the method, not the marketing claim.

---

## Shapes we compared

Two orchestration shapes. First mention definitions (used everywhere below):

| Shape | Open name | Meaning |
|-------|-----------|---------|
| **single-agent** | Single-agent ReAct loop | One agent, reason→act→observe in one trajectory |
| **hierarchical** | Hierarchical ReAcTree planner | Parent decomposes subgoals, may spawn child agent nodes, control-flow coordination |

Background: [What is ReAcTree?](/blog/what-is-reactree/) · paper [PDF](https://arxiv.org/pdf/2511.02424) / [abs](https://arxiv.org/abs/2511.02424) · production notes [ReAcTree bugs](/blog/reactree-bugs/).

---

## TL;DR

- **Job:** triage a sustained goroutine-growth alert, then compare **24h vs 7d** logs in one Kubernetes namespace for anomalies and cross-links.
- **Winner (wave 1):** xAI hierarchical — ~**141s**, ~**191k** tokens, corr **1.0**, efficiency **1.375**.
- **gpt-5.4 hierarchical** matched quality with ~**255k** tokens vs ~**373k** for single-agent (~**0.68×** tokens — smaller total context bill across the whole tree).
- **Responses reasoning preview** burned **~475–516k** tokens; hierarchical once scored **0.69** correctness (thin Undetermined close).
- **Efficiency without absolute wall is a trap** — see [relative scores](/blog/relative-efficiency-scores-lie/).

### Explain like I'm five

Six detectives get the same crime report and the same flashlight drawer. You time them, count the pages they photocopy, check whether the write-up names a real house, and only then argue about who is “efficient.”

---

## The job (obfuscated)

**Part A.** Firing alert: sustained positive 24h derivative on `go_goroutines` for a control-plane service family, `for` window hours long. Measure the rule, rank loci, close Theory / Unknowns / Do-this-now.

**Part B.** Same session: Loki for namespace `ops-platform`. Summarize last **24h** and a **7d** baseline. Compare volume, errors, new signatures. Say whether Part A has a matching log story — or Unknown with what you could not query.

Correctness = 13-point checklist (Theory, Unknowns, next action, measured alert, numbers, namespace, both windows, compare language, logs/Loki, honesty, Part A/B labels).

Efficiency =

```text
correctness / (0.45·wall/median + 0.45·tokens/median + 0.10·cost/median)
```

Cost: from session traces where present; otherwise estimated from the gpt-5.4 $/token blend for that wave.

---

## Wave 1 leaderboard

| Rank | Combo | Shape | Wall | Tokens | Cost | Corr | Eff |
|-----:|-------|-------|-----:|-------:|-----:|-----:|----:|
| 1 | xAI · hierarchical | ReAcTree | 141s | 191k | ~$0.16 est | 1.00 | **1.375** |
| 2 | xAI · single-agent | ReAct | 157s | 187k | ~$0.15 est | 1.00 | 1.301 |
| 3 | gpt-5.4 · hierarchical | ReAcTree | 148s | 255k | $0.37 | 1.00 | 1.107 |
| 4 | gpt-5.4 · single-agent | ReAct | 154s | 373k | $0.30 | 1.00 | 0.935 |
| 5 | Responses · single-agent | ReAct | 285s | 475k | ~$0.39 est | 1.00 | 0.617 |
| 6 | Responses · hierarchical | ReAcTree | 200s | 516k | ~$0.42 est | **0.69** | 0.480 |

Hierarchical vs single-agent ratios (hierarchical / single-agent):

| Model class | Wall | Tokens | Quality |
|-------------|-----:|-------:|---------|
| xAI | 0.90× | ~1.02× | both full |
| gpt-5.4 | ~0.96× | **0.68×** | both full |
| Responses preview | 0.70× | 1.09× | hierarchical collapsed |

---

## What moved when we added no-progress gates

Second wave: same six cells on a harness that already preferred parent measurement before spawning children, plus **typed query failure handling**, **same-observation halt**, and **same-tool fan-out caps** ([stop retrying dead probes](/blog/stop-retrying-the-same-failed-query/)).

Absolute changes matter more than efficiency deltas:

| Combo | Wall × | Tok × | Corr |
|-------|-------:|------:|------|
| xAI hierarchical | 1.86× | ~1.01× | 1→1 |
| xAI single-agent | 1.74× | 1.27× | 1→1 |
| gpt-5.4 single-agent | 1.72× | 1.49× | 1→1 |
| gpt-5.4 hierarchical | 1.91× | **1.88×** | 1→1 |
| Responses hierarchical | **2.80×** | 1.26× | **0.69→1.00** |
| Responses single-agent | 2.22× | 1.23× | 1→1 |

Caveat: wave 2 kept six Grafana clients hot in parallel for the full run. Contended tools can inflate wall. The quality jump on Responses hierarchical (stub → full Part A/B) is still the headline worth shipping gates for.

---

## Monday rules

1. Publish **wall, tokens, cost, correctness** as four columns. Efficiency is a fifth, labeled relative.
2. Never crown a model on one shape. Single-agent ReAct and hierarchical ReAcTree are different products.
3. Treat “reasoning preview” seats as **expensive explorers** until they prove closes under your gate.
4. When a harness change lands, re-run the **same prompt**. Narrative without a rematch is cosplay.

Related: [What is ReAcTree?](/blog/what-is-reactree/), [hierarchical vs single-agent on this job](/blog/plan-mode-merits-demerits-observability/), [AI SRE benchmarks](/blog/ai-sre-agent-benchmarks-wall-time-tools-tokens/), [reasoning effort is not free](/blog/reasoning-effort-is-not-a-free-upgrade/).

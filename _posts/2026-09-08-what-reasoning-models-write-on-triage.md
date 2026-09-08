---
layout: post
title: "What Reasoning Models Write When You Ask Them to Triage"
date: 2026-09-08 14:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 59
description: "Same alert+logs prompt, three model classes. How their Theories diverge: leak vs measurement artifact, and what that means for operators."
image: /assets/images/og-default.png
tags: [ai-agents, reasoning, sre, incident-response, evaluation, observability, reactree, aiden]
permalink: /blog/what-reasoning-models-write-on-triage/
faqs:
  - question: "Do reasoning models always call a goroutine-growth alert a leak?"
    answer: "No. On the same firing card, some seats wrote probable sustained growth with numbers; a Responses reasoning preview preferred measurement-artifact / sparse-series stories and put the hottest series in a different namespace than the log check."
  - question: "What should an operator look for in the Theory section?"
    answer: "A disposition (probable / correlated / undetermined), measured numbers or explicit Unknowns, a locus (service, namespace, node), and a falsifier. Length without those four is theater."
  - question: "How does hierarchical ReAcTree change the write-up?"
    answer: "When it works, the hierarchical run often compresses the close and keeps the same disposition. When it fails, you get a short Undetermined list without Part B numbers — not a better essay. Shapes: single-agent ReAct vs hierarchical ReAcTree (paper)."
---

Numbers without voice are half a bench. After [six combos on one job](/blog/six-model-mode-combos-alert-logs-bench/), we read the closes.

Same prompt. Same tools. Three cognitive styles showed up in the Theory section. That is the part on-call actually reads.

We compared two orchestration shapes: a **single-agent ReAct loop** (one trajectory) and a **hierarchical ReAcTree planner** (parent decomposes subgoals, may spawn children). Primer: [What is ReAcTree?](/blog/what-is-reactree/) · [PDF](https://arxiv.org/pdf/2511.02424).

---

## TL;DR

- **xAI-class reasoning** wrote **probable leak / sustained growth** with derivative numbers, heap correlation, and an honest gap when Loki dumps were truncated.
- **gpt-5.4** wrote **probable / correlated** with rule confirmation and clear “theory is wrong if…” falsifiers. Verbose, but structured.
- **Responses reasoning preview** often wrote **measurement artifact / sparse series**, relocated the hot metric to another namespace, and treated Part B as mix-shift rather than surge.
- None of these are “wrong” a priori. They are **different priors**. Your harness must force receipts either way.

### Explain like I'm five

Ask three careful kids why the smoke alarm beeped. One says the kitchen is on fire. One says the battery is dying. One says someone burned toast yesterday and the sensor is sticky. Same beep. Different stories. You still check the kitchen.

---

## The shared job

Part A: sustained goroutine-growth alert on a control-plane service.  
Part B: Loki for namespace `ops-platform`, 24h vs 7d, cross-link to Part A.

Required shape: Theory / Unknowns / Do-this-now per part. See [evidence-gated RCA](/checklists/evidence-gated-rca/).

---

## Style A — “Probable leak, here are the slopes”

Typical xAI hierarchical / single-agent closes:

- Disposition: **probable** sustained growth.
- Numbers: `deriv(go_goroutines)` above threshold, per-pod counts, heap bytes.
- Part B: volume / error counts with windows named; linkage **partial** or Unknown when large tool output was truncated.

This is the classic SRE narrative. Operators like it because it sounds like a page they would write. Risk: anchoring on leak language when the series is sparse.

---

## Style B — “Correlated, falsify me”

Typical gpt-5.4 closes:

- Disposition: **probable** or **correlated**.
- Explicit **“theory is wrong if…”** lines.
- Part B: high volume + error slice, **no clean log signature** for the leak — and they say so.

Longer than Style A. Better falsifiers. Costs more tokens ([scorecard](/blog/six-model-mode-combos-alert-logs-bench/)).

---

## Style C — “Artifact until proven dense”

Typical Responses reasoning preview closes:

- Disposition: **confirmed measurement artifact** or **sparse-series**, not demonstrated leak.
- Hottest nonzero series sometimes in a **different namespace** than the log check namespace.
- Part B: lower volume than baseline, higher **error share** — mix shift, not surge.
- Hierarchical failure mode (wave 1): both parts **Undetermined**, ~500 characters, no numbers.

This seat thinks like a skeptical staff engineer. Valuable. Expensive. Dangerous when a hierarchical ReAcTree run quits early without host [no-progress guards](/blog/stop-retrying-the-same-failed-query/).

---

## Merits and demerits by style

| Style | Merit | Demerit |
|-------|-------|---------|
| A Leak-forward | Fast operator-readable close; strong numeric habit | Can overfit “leak” language |
| B Falsifier-heavy | Clean Unknowns; easy to re-query | Token bloated; slower to skim |
| C Artifact-skeptical | Avoids false fire drills | Can under-react; hierarchical can stall undetermined |

---

## What to enforce in the host (not another prompt paragraph)

1. **Force disposition + falsifier** in the completion gate.  
2. **Reject closes** that name neither a locus nor an Unknown with a blocked query.  
3. Do not teach the model your favorite Theory. Teach it **receipts**. Curiosity before confidence still applies ([post](/blog/curiosity-before-confidence/)).

Next: [hierarchical vs single-agent on this job](/blog/plan-mode-merits-demerits-observability/), [tools they actually called](/blog/observability-tools-agents-actually-call/).

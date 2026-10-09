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

The [six-combo scorecard](/blog/six-model-mode-combos-alert-logs-bench/) reports wall time and checklist scores. We also read the final diagnoses: two answers can earn similar checklist marks while giving operators very different hypotheses to verify.

The prompt and tool access were held constant, but each cell ran once. The three patterns below describe these write-ups, not enduring properties of the model families. "Theory" is the proposed explanation of the alert, not a confirmed root cause.

We compared two orchestration shapes: a **single-agent ReAct loop** (one trajectory) and a **hierarchical ReAcTree planner** (parent decomposes subgoals, may spawn children). Primer: [What is ReAcTree?](/blog/what-is-reactree/) · [PDF](https://arxiv.org/pdf/2511.02424).

---

## What the evidence supports

- **xAI-class reasoning** wrote **probable leak / sustained growth** with derivative numbers, heap correlation, and an honest gap when Loki dumps were truncated.
- **gpt-5.4** wrote **probable / correlated** with rule confirmation and clear “theory is wrong if…” falsifiers. Verbose, but structured.
- **Responses reasoning preview** wrote **measurement artifact / sparse series** in these runs, located the hot metric in another namespace, and treated Part B as mix-shift rather than surge.
- Neither a leak nor a measurement artifact follows from the alert alone. The agent needs measurements, and each diagnosis needs a test that could disprove it. A host completion check can require citations or named missing probes, though it cannot itself establish that the cited data is correct.


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

A rising goroutine count can suggest retained work, but a derivative over sparse samples can mislead. Before treating "leak" as the mechanism, inspect the raw series and whether the growth persists across pods and time windows.

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

- Disposition: **measurement artifact** or **sparse-series** as its proposed explanation, rather than a demonstrated leak. That explanation still requires raw-sample verification.
- Hottest nonzero series sometimes in a **different namespace** than the log check namespace.
- Part B: lower volume than baseline, higher **error share** — mix shift, not surge.
- Hierarchical failure mode (wave 1): both parts **Undetermined**, ~500 characters, no numbers.

That alternative diagnosis is useful only if the agent checks sample density and the namespace mismatch. The same seat also produced a ~500-character hierarchical close without numbers in wave 1; [no-progress guards](/blog/stop-retrying-the-same-failed-query/) and completion checks can prevent a blank close, but they do not prove the artifact hypothesis.

---

## Merits and demerits by style

| Style | Merit | Demerit |
|-------|-------|---------|
| A Leak-forward | Direct operator-readable close; strong numeric habit | Can overfit “leak” language |
| B Falsifier-heavy | Clean Unknowns; easy to re-query | Token bloated; slower to skim |
| C Artifact-skeptical | Avoids false fire drills | Can under-react; hierarchical can stall undetermined |

---

## What to enforce in the host (not another prompt paragraph)

1. **Force disposition + falsifier** in the completion gate.  
2. **Reject closes** that name neither a locus nor an Unknown with a blocked query.  
3. Do not hard-code a preferred diagnosis. Require the exact query, observation window, and unresolved alternative for each consequential claim; see [curiosity before confidence](/blog/curiosity-before-confidence/). ([post](/blog/curiosity-before-confidence/)).

Next: [hierarchical vs single-agent on this job](/blog/plan-mode-merits-demerits-observability/), [tools they actually called](/blog/observability-tools-agents-actually-call/).

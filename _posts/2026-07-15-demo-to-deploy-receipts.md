---
layout: post
title: "From Demo to Deploy — Failure Modes with Receipts"
date: 2026-07-15 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 22
description: "Questions for evaluating AI incident-response pilots: recorded evidence, staged checks, approval policies, and test results beyond a fluent demo."
image: /assets/images/og-hitl.png
tags: [ai-agents, production, sre, evaluation, hitl, workflows, aiden, compound-ai, enterprise-agents]
permalink: /blog/demo-to-deploy-receipts/
---

An AI agent is software that uses a model to choose steps and call tools. In a demo, it can turn a clean alert into a fluent root-cause analysis (RCA), a report explaining why an incident happened. That is useful, but it does not establish how the same workflow handles missing data, stale instructions, or a failed tool call.

For a site reliability engineering (SRE) team—the people responsible for keeping services running—those conditions are routine. While shipping [AI agents for SRE](/topics/ai-agents-sre/), we found it more useful to ask for **receipts**: recorded evidence of what the agent checked and whether each step succeeded. This post maps several failure modes to concrete checks. It is a guide to questions for a pilot, not a claim that any checklist guarantees safe deployment.

---

## The Demo Contract (What Quietly Gets Assumed)

Demos assume:

- Telemetry—the measurements and event records used to monitor a system—is complete and labeled as expected
- The “right” runbook is in context
- Tool calls finish fast and return tidy JSON
- The stop condition (“investigation complete”) reflects a checked outcome
- A human will not approve blindly under load

In a real incident, any of these assumptions may fail. A fluent response does not reveal which ones held.

---

## Failure Modes Worth Naming Out Loud

Each mode follows the same shape: **demo illusion**, **production reality**, **receipt**.

### 1. Fluent but wrong

**The demo illusion:** The report looks like an RCA: “The database failed due to high CPU.” That sentence does not say which query was run or how high CPU caused the failure.

**What to check:** A report with all the expected sections can still be wrong. Require evidence before the explanation: predefined stages should record checkable results before a summary is written. See [Evidence-Gated RCA](/blog/evidence-gated-multiplane-rca/) for checks across metrics (numeric measurements), logs (event records), and traces (records of a request across services).

Receipt first (illustrative — not a product schema), narrative second:

```json
{"query_id": "tx_992", "cpu_spike_pct": 98, "blocked_pid": 412, "window": "last_15m"}
```

**The receipt:** evidence fields exist before the summary is generated. Their presence makes the proposed checks inspectable, but a field alone does not show that its value is accurate or causal.

![Diagram of a demo claim passing through stage checks into a receipt, with missing checks requiring a qualified account.](/assets/images/diagrams/july-investigation/demo-to-deploy-receipts.svg)

*Diagram: The arrows move from a polished demo claim through recorded stage checks to an inspectable receipt; missing checks instead feed a qualified operator account, and even a filled receipt does not prove causation.*

### 2. Open loops that quit early

**The demo illusion:** The agent calls a tool and marks the investigation complete without showing its stopping criteria.

**What to check:** A loop without explicit stopping criteria may stop after a cursory search. Make each stage depend on specific required results. [AI incident triage](/blog/ai-incident-triage-sre/) gathers measurements, recent changes, and similar incidents before proposing where to look.

Illustrative gate (shape only):

```json
{"stage": "gather", "required": ["primary_identity", "kpi_value"], "passed": false, "reason": "missing_kpi"}
```

**The receipt:** stage completion criteria a unit test can check. A passing gate records required fields; it does not validate their interpretation.

### 3. Runbook-as-only-navigation

**The demo illusion:** Ship a forty-page notebook per failure mode; the agent “follows the runbook.”

**What to check:** A runbook (documented response procedure) cannot by itself tell the agent which service depends on which, or whether measurements, event logs, and request traces agree. Give it a service map and small tests to verify a suspected fault. See [Agents Need a Map, Not a Script](/blog/agents-need-a-map-not-a-script/) and [Beyond Confluence Runbooks](/blog/beyond-confluence-runbooks/) for the distinction between executable checks and explanatory documentation.

**The receipt:** a record of the relevant service context supplied at launch and the outcomes of diagnostic checks, rather than a placeholder saying a branch ran.

### 4. End-to-end whodunits

**The demo illusion:** One successful run on a clean, predefined test case is enough to claim readiness.

**What to check:** A successful end-to-end run does not identify which stage will fail on noisy data. Test stages separately against known expected outcomes, then test the full workflow under realistic variation — [How We Debug Multi-Stage AI Agent Workflows](/blog/bring-up-agent-workflows-like-hardware/). Compare the expected problem category with the one detected, rather than judging only the final prose.

**The receipt:** pass rates for each stage, alongside end-to-end results and the cases that failed.

### 5. Human-in-the-loop (HITL) theater

**The demo illusion:** Requiring approval for every action guarantees meaningful oversight.

**What to check:** Human-in-the-loop (HITL) review can become perfunctory if every harmless query needs approval. Separate read-only queries from actions that change state, and block actions that should never be allowed — [The HITL Paradox](/blog/hitl-paradox/). The right policy depends on the environment and the consequence of a mistake.

Illustrative tiering (not a product export):

```yaml
tools:
  metrics_query:
    approval: auto          # read-only
  kubectl_scale:
    approval: required
    risk_tier: high         # state change
  shell_rm_rf:
    approval: denied        # hard block
```

**The receipt:** approval volumes, decision times, and review quality. Longer decisions alone do not prove people read more carefully.

### 6. Context death mid-incident

**The demo illusion:** Short, tidy tool responses leave ample room for the incident analysis.

**What to check:** Huge log responses can exhaust the model’s context window (the text it can consider at once). [Tokenomics](/blog/maintaining-tokenomics-with-aiden/) argues for measuring completion, preservation of useful signals, and cost per successful workflow. Summarize bulky output without hiding the event that matters.

Before compression (what the model would have choked on):

```text
{"level":"error","msg":"connection reset","trace_id":"a1b2", ... 3,800 more characters ...}
```

After compression (what still fits in context):

```text
error_count=847 window=15m top_msg="connection reset" sample_trace=a1b2…
```

**The receipt:** compare compressed output with the source to check whether the relevant event survived, then measure how often sessions finish.

### 7. Agents that never improve the org

**The demo illusion:** “It learns from every incident” because it stores longer summaries.

**What to check:** A stored incident summary is not itself an improvement. Track the sequence from observed pattern to proposed change, human review, and an actual workflow or policy update — [The Diary Learning Loop](/blog/diary-learning-loop/).

Illustrative proposal record (shape only):

```json
{"pattern": "deny_tool:deploy_prod", "count_7d": 12, "proposal": "attach_policy:deploy_guard", "status": "pending_review"}
```

**The receipt:** reviewed proposals and resulting approved changes, not merely generated summaries.

---

## A Compact Receipts Checklist

Use these questions when reviewing a pilot that claims to be ready for real incidents.

| Claim | Ask for the receipt |
|---|---|
| “We found the root cause” | Which source records, affected entities, and key performance indicators (KPIs)—measurements such as error rate—were recorded *before* the narrative? |
| “The agent finished” | Which structural gate passed? Would a wrong answer with the same English still pass? |
| “We follow the runbook” | Is there a service-dependency map and diagnostic checks, or only a linear script? |
| “We tested it” | Can each stage pass independently on varied real-world data as well as predefined test cases? |
| “Humans are in the loop” | What is auto-approved, what needs a person, what is hard-denied? |
| “Cost is under control” | Completion rate and cost per *successful task*, not only spend per chat. |
| “It learns” | Show an approved change that altered policy or workflow — not a bigger vector store. |
| “It investigates like an SRE” | Does it establish identity and onset before deploy theories? Show alternatives tested and ruled out, not only one preferred explanation. |

If a pilot cannot show these records, treat its claims as unverified and ask which checks can be demonstrated.

---

## Slide deck outline (internal pitch)

Use this as a four-slide arc for leadership or a sprint review — no conference badge required.

**Slide 1 — The question:** Same alert, two paths. Contrast an unsupported RCA with an investigation that records its checks. Ask which assumptions the demo hid.

**Slide 2 — The risks:** Name four failure modes: convincing unsupported prose, early stopping, reliance on a linear procedure alone, and approvals made without careful review.

**Slide 3 — The checks:** Show a service map, early diagnostic tests, stage-by-stage test results, and explicit criteria for moving between workflow stages.

**Slide 4 — The evidence:** Show checkable records: evidence fields, stage results, approval policy, and compressed logs compared with their source. Keep human judgment in the decision.

Elevator version: *“Before relying on the summary, show what the investigation checked and what remains uncertain.”*

---

## Related reading (deep dives)

- [Evidence-Gated RCA — Prove, Then Narrate](/blog/evidence-gated-multiplane-rca/) — structural gates so narration cannot leapfrog evidence
- [Your RCA Agent Needs a Map](/blog/agents-need-a-map-not-a-script/) — topology and verify-first probes beat runbook-only agents
- [AI Incident Triage for SREs](/blog/ai-incident-triage-sre/) — shrink the first thirty minutes with parallel context gather
- [How We Debug Multi-Stage AI Agent Workflows](/blog/bring-up-agent-workflows-like-hardware/) — stage-by-stage golden gates under live variance
- [The HITL Paradox](/blog/hitl-paradox/) — risk-tiered approvals so review stays real
- [LLM Tokenomics for Production Agents](/blog/maintaining-tokenomics-with-aiden/) — finish rate and compression as an operating model
- [The Diary Learning Loop](/blog/diary-learning-loop/) — digests become human-approved workflow/policy changes
- [The Hypothesis Ladder](/blog/hypothesis-ladder/) — hypothesis-driven debugging: prove first, narrate last
- Topic hubs: [AI agent workflows](/topics/ai-agent-workflows/) · [AI agents for SRE](/topics/ai-agents-sre/)

---


*What receipt do you wish you had asked for before the last agent pilot? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> **StackGen is building AI-assisted incident triage.** Our offering aims to help teams run diagnostics and draft RCA reports; operators should still verify consequential findings. See [ai.stackgen.com](https://ai.stackgen.com).

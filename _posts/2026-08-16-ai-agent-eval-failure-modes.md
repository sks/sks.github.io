---
layout: post
title: "AI Agent Eval Failure Modes: Budget, PII Placeholders, and Self-Reported Passes"
date: 2026-08-16 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 48
description: "AI agent eval failure modes on AppWorld: budget stops before evaluate, PII placeholders poison tool calls, 422 wrong methods, and prose PASS vs judge FAIL."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, reliability, pii, redaction, verification, workflows, aiden, production]
permalink: /blog/ai-agent-eval-failure-modes/
faqs:
  - question: "Why do AI agents fail benchmarks even when the transcript looks successful?"
    answer: "Common modes: iteration budget exhausted before evaluate, PII redaction replacing API method names with placeholders the agent then calls, wrong documented API names (422), and assistant prose claiming PASS while the external judge returns false."
  - question: "What is PII placeholder poison in agent evals?"
    answer: "When redaction turns real tool or method tokens into [HIDDEN:…] strings, the model may copy those placeholders into the next tool call. The API returns 422 — the agent is calling a name that never existed in the docs."
  - question: "Should you use pass_percentage as the winner metric?"
    answer: "No as a sole gate. We saw ~50% pass_percentage with success false, ties when both modes failed, and prose EVALUATE PASS with harness budget_no_eval. Use the external judge's success bit and failure-class logging."
  - question: "What failure classes should you log for tool-using agent evals?"
    answer: "At minimum: budget_no_eval, true judge fail, pii_poison, wrong_method_422, ran_without_judge, create_agent_tools_unavailable, and assistant_asks_clarification in unattended mode."
  - question: "How does this connect to evidence-based verification?"
    answer: "Same contract: systems of record — here AppWorld's evaluate — vote before you trust narration. Self-report is a failure mode, not a tie-breaker."
---

Parts [one](/blog/fair-agent-evals-before-performance/) and [two](/blog/agent-orchestration-tax-evals/) fixed tool fairness and measured **agent orchestration tax**. Both modes still scored **judge pass 0** on every clean cohort we finished.

This post is the failure-mode atlas: what broke, how we labeled it, and why **winner badges** would have lied.

Benchmark: [AppWorld](https://github.com/stonybrooknlp/appworld) ([paper](https://arxiv.org/abs/2407.18901)). Tools: MCP. Judge: their evaluate harness (TGC/SGC). We publish **aggregates only** — AppWorld data is license-protected; see their repo for terms.

---

## TL;DR

- **Head-to-head ties 5/5** on delegation-fit tasks — because **both** modes failed the external judge, not because quality matched.
- **Single-agent dominant mode:** `budget_no_eval` — burned iterations before `evaluate`.
- **Planner dominant modes:** `pii_poison`, `wrong_method_422`, spawn infra hard-fails — more moving parts, more ways to die.
- **Never trust prose PASS** without judge `success: true` — see [Is the task actually done?](/blog/is-the-task-actually-done/) and [evidence-based verification](/blog/evidence-based-verification/).
- **Monday-morning rule:** log failure **class**, not just pass/fail — otherwise you will “optimize” the wrong layer.

### Explain like I'm five

The robot wrote “I finished homework” on the page but never handed it in. The teacher’s gradebook still says missing. You need the gradebook, not the robot’s diary.

---

## Failure-class taxonomy (copy for your harness)

| Class | What it means | Typical fix |
|-------|---------------|-------------|
| `budget_no_eval` | Iteration/token budget hit before external judge | Raise cap or shorten loop; don’t score as partial pass |
| `true_tgc_fail` | Evaluate called; judge `success: false` | Task logic, discovery, API usage |
| `pii_poison` | Redacted placeholder copied into tool `method` | Align redaction policy for eval twins ([PII post](/blog/pii-redaction-ai-agents/)) |
| `wrong_method_422` | Documented API name mismatch | Search docs tool before call; retry on `did_you_mean` |
| `ran_without_judge` | Run ended with no parsed evaluate | Unattended mode + completion gate |
| `create_agent_tools_unavailable` | Spawn hard-failed on missing tool names | Soft-drop or fix registry / AlwaysInclude |
| `assistant_asks_clarification` | Human prompt in unattended eval | Deny clarify tools in benchmark config |

---

## Delegation-fit cohort (n = 5 per mode)

Tasks chosen to reward delegate-then-synthesize: phone → notes → SMS, inbox + contacts + payments, workout note → playlist sizing, batch social payments, trip ledger → settle debts.

### Aggregate failure mix

| Failure class | Single-agent (of 5) | Planner (of 5) |
|---------------|----------------------:|---------------:|
| Budget, no evaluate | **4** | **2** |
| True judge fail | **1** | **0** |
| PII placeholder poison | **0** | **2** |
| Wrong API method (422) | **0** | **1** |
| Other (spawn infra, no judge) | **0** | **2** |

![Failure class counts on five delegation-fit tasks per mode](/assets/images/appworld/failure-modes.svg)

*Caption: Judge pass 0 both modes · head-to-head ties 5/5.*

### Why “tie” is not “good”

Harness winner rule: plan wins only if judge `success` is true for plan and not single-agent (and vice versa). **Both fail → tie.**

Examples from the paired runs:

- **~50% pass_percentage** with `success: false` on both sides — looks “close,” is still a fail.
- Planner transcript claimed **EVALUATE PASS 100%** while harness labeled `budget_no_eval` and judge unknown.
- Single-agent made **partial mutations** (e.g., comments on some payments) and still failed evaluate.

Use [From Vibes to Contracts](/blog/from-vibes-to-contracts-agent-evals/) vocabulary: **correctness, consistency, reliability** are separate gates. Here we could not clear correctness at all.

---

## PII placeholder poison (not unique to one runtime)

When [PII redaction](/blog/pii-redaction-ai-agents/) replaces method names or tool tokens with `[HIDDEN:…]`, models sometimes **call the placeholder as if it were a real API**. AppWorld returns 422 — “no API named …”

This is the same two-view tension as SRE evals: redaction for safety vs pass-through for evidence. For fair A/B, eval twins must document which redaction layers are on. See also [Microsoft Presidio](https://github.com/microsoft/presidio) for a public reference implementation of detect-and-replace redaction.

Planner paths hit **`pii_poison` on 2/5** tasks in this cohort; single-agent hit **0** — not because single-agent is immune, but because fewer hops meant fewer chances to copy redacted tokens into worker spawns.

---

## Budget before evaluate (single-agent’s main killer)

On the fair **ten-task** cohort, single-agent runs ended without judge on **7/10** tasks — fluent progress, then “execution budget” with no evaluate.

Planner paths failed judge more often but **did** reach evaluate more consistently. That is a trade-off, not a win: **fail_judge 10/10** is still fail.

Checklist cross-link: [Is the agent task done?](/checklists/agent-done/)

---

## Spawn infra failures (planner-only)

On **3/5** delegation-fit pairs, planner fairness failed with `create_agent_tools_unavailable` — optional infra names in spawn payload that were not registered in the eval config (notes tooling disabled). Hard-fail spawn wastes the whole subtree.

Lesson: eval configs must match production AlwaysInclude semantics, or spawns become false negatives.

---

## What we changed after these runs (diagnosis, not rescored here)

Without publishing internal wiring: we treated these as harness and policy issues — re-enable note tooling for eval, soft-drop benign extra tool names on spawn, stop duplicate workers after first successful handoff, fill empty worker context from parent goal. **New judge scores after those patches are not in this post** — rerun required.

---

## Lessons learned

1. **Classify failures before comparing modes.** Budget and poison are different fixes.
2. **pass_percentage without success misleads.** Log both; gate on `success`.
3. **Prose PASS is a failure mode** when judge disagrees.
4. **Ties mean both lost** when the external judge is the contract.
5. **Small n, honest ceiling.** Five tasks, zero passes — the right headline is “not ready,” not “planner vs single-agent.”

---

**Next:** [Stop Spawning Duplicate Workers](/blog/stop-duplicate-agent-workers-handoff-gate/) — what changed after a handoff gate fixed fairness 5/5 and cut planner token tax (strict judge pass still 0/5).

## Related reading

### On this site

- [Fair Agent Evals](/blog/fair-agent-evals-before-performance/) · [Orchestration Tax](/blog/agent-orchestration-tax-evals/)
- [PII Redaction in AI Agents](/blog/pii-redaction-ai-agents/)
- [Evidence-Based Verification](/blog/evidence-based-verification/)
- [From Vibes to Contracts](/blog/from-vibes-to-contracts-agent-evals/)
- [Agent done checklist](/checklists/agent-done/)

### Elsewhere

- [AppWorld](https://github.com/stonybrooknlp/appworld) · [paper](https://arxiv.org/abs/2407.18901)
- [Model Context Protocol](https://modelcontextprotocol.io/) · [Langfuse](https://langfuse.com/)
- [Microsoft Presidio](https://github.com/microsoft/presidio) — PII detection/redaction reference
- [Google ADK evaluation](https://google.github.io/adk-docs/evaluate/)
- [LangGraph](https://langchain-ai.github.io/langgraph/) · [CrewAI](https://docs.crewai.com/) · [AutoGen](https://microsoft.github.io/autogen/) · [OpenAI Agents](https://openai.github.io/openai-agents-python/)

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

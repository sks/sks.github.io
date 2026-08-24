---
layout: post
title: "How to Evaluate AI Agents: Ban Clarifying Questions and Zero-Tool \"Success\""
date: 2026-08-24 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 51
description: "Unattended AI agent evaluation fails when the model asks the user or reports done with zero MCP calls. Put those rules in the harness, not the framework."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, benchmarking, appworld, mcp, multi-agent, workflows, production]
permalink: /blog/how-to-evaluate-ai-agents-clarifying-questions-zero-tool-calls/
faqs:
  - question: "Should AI agents ask clarifying questions in benchmark evals?"
    answer: "No in unattended evals. If nobody is at the keyboard, clarify tools stall the run until the wall clock expires. Deny ask_clarifying_question in harness config and fail the run if it still appears in logs."
  - question: "What is zero-tool delegation theater?"
    answer: "A plan-mode worker that emits a success JSON plan but never calls domain MCP tools. The transcript looks green; AppWorld evaluate sees no mutations. Treat zero domain tool calls as a hard harness failure."
  - question: "Where should benchmark policy live — harness or agent framework?"
    answer: "In harness config (TOML, AGENTS.md) for benchmark-specific rules. Do not fork production runtime packages for one benchmark. Promote generic gates to the framework only when every customer needs them."
  - question: "Why can direct MCP score higher than multi-agent plan mode on the same task?"
    answer: "Different layers fail. Direct MCP may hit the apps but fail on API bugs. Plan mode may never reach the apps because of orchestration blockers (clarify stalls, zero-tool workers). Fixing one layer does not fix the other."
  - question: "How do you compare simple vs plan agent runs?"
    answer: "Same task IDs, same stack rebuild, trace UI side-by-side (we use Langfuse): peak and total tokens, domain tool counts, failure class — not assistant prose or screenshots."
---

If a human is not at the keyboard, **“ask a question”** and **“I finished with zero API calls”** are harness failures — not agent features. A direct MCP script can still reach the apps while your planner never leaves the hallway.

This is part of our [AI agent evaluation series](/blog/fair-agent-evals-before-performance/) on [AppWorld](https://github.com/stonybrooknlp/appworld) ([paper](https://arxiv.org/abs/2407.18901)) through [Genie](https://github.com/stackgenhq/genie). Prerequisite: [running AppWorld locally](/blog/running-appworld-locally-genie-agent-eval/). **Next in the pair:** [multi-agent vs single-agent quality and token tax](/blog/multi-agent-vs-single-agent-mcp-tool-tax-pass-at-k/).

---

## TL;DR

- **Unattended evals are not chat.** Clarify tools stall until the timer dies.
- **Zero domain MCP calls = fake pass.** Prose-complete workers are delegation theater.
- **MCP baseline vs plan mode** can fail on different layers — fix orchestration before you tune AppWorld APIs.
- **Benchmark policy belongs in the harness** (TOML + `AGENTS.md`), not AppWorld-specific forks in production Go packages.

### Explain like I'm five

The take-home test has no teacher. Raising your hand wastes time. Saying “I cleaned my room” without opening the closet still fails the checklist.

---

## 30-second setup

**AppWorld** is a controllable multi-app benchmark — fake Spotify, Venmo, phone, notes, and a judge that checks database state, not chat prose.

| Mode | Shape | Who calls domain tools |
|------|-------|------------------------|
| **Simple** (single-agent) | One agent with the full MCP catalog | Root agent |
| **Plan** (multi-agent) | Coordinator + workers | Worker after `create_agent` |

The **judge** is AppWorld’s `/evaluate` endpoint (`success: true` = strict all-tests pass). The transcript is not the gradebook. Same lesson as [evidence-based verification](/blog/evidence-based-verification/).

---

## Ban clarifying questions in unattended evals

On a four-task plan cohort, **3/4 passed** only after we treated `ask_clarifying_question` as an automatic harness failure — not a “maybe retry” signal.

**Spotify playlist from workout note** (`b0a8eae_3`): the coordinator burned ~3 minutes asking for playlist confirmation while the **4-minute wall clock** expired. The judge never ran.

| Signal | Harness action |
|--------|----------------|
| `ask_clarifying_question` in logs | Force `success = false` even if evaluate later passes |
| Coordinator blocked on human-in-the-loop | Same — unattended mode must not wait on UI |

Genie’s persona already says “infer from tools, don’t ask.” Benchmark config must **enforce** it:

```toml
# appworld-plan.toml (harness)
[hitl]
denied_tools = ["ask_clarifying_question"]
```

Match the simple-mode twin. Fail the run if the string still appears in `genie.log`.

See also the [failure modes atlas](/blog/ai-agent-eval-failure-modes/) row `assistant_asks_clarification`.

---

## Zero-tool workers: when delegation is theater

On the same playlist task, a plan worker logged **“task completed with zero tool calls”** while the judge still saw an untouched Spotify player. Delegation looked green; the world state did not move.

What happened:

- Lightweight plan steps defaulted to **structured planning JSON** instead of **tool_calling** when AppWorld tools were on the worker.
- The stage router treated zero-tool prose as **early exit** — later stages never ran.

**Monday-morning rule:** log **domain tool calls per worker** in handoff payloads. If spawn succeeded but MCP mutation count is zero, auto-retry or fail — do not accept coordinator prose as completion.

**Fix (current harness):** force `task_type: tool_calling` in `appworld-plan.toml` + `AGENTS.md`. Fail the run when domain tool count is zero. Framework-level “require domain tools” knobs are the right *idea*; for this eval the enforcement that ships today is **harness policy**.

A clean summary handoff of “I did nothing” is still theater — even when the handoff bytes are tiny ([covered in the companion post](/blog/multi-agent-vs-single-agent-mcp-tool-tax-pass-at-k/)).

---

## Two layers of fail: MCP baseline vs plan mode

Same errand, same judge, two shapes — **Spotify playlist from workout note** (`b0a8eae_3`):

| Mode | Score (pre-fix cohort) | Dominant blocker |
|------|------------------------:|------------------|
| MCP baseline (direct script) | **60%** | AppWorld `show_song` / `search_songs` HTTP 500s; queue duration eval |
| Plan (Genie ReAcTree) | **0%** | Zero-tool workers, clarify stalls, auth loop traps |

That gap is not “MCP is smarter.” It is **layer separation**:

- **AppWorld bugs** (response validation → 500) hurt both paths once tools are actually called.
- **Orchestration bugs** block plan mode from ever reaching Spotify — fixing 500s alone does not fix 0% plan runs.

Run **both** baselines on every regression: MCP proves the world + judge; plan proves your runtime.

**After our fix pass:** Spotify validation 500s removed; plan workers use `tool_calling` via harness TOML. Post-fix plan runs reached Simple Note + supervisor tools; Spotify playback still blocked when the first worker tool pack omitted `list_playlists` — orchestration progressed further, judge still 0% until playlist discovery tools were delegated.

---

## Benchmark policy in the harness, not the framework

Unattended AppWorld policy is easy to put in the wrong layer.

| Policy | Where it lives | Why |
|--------|----------------|-----|
| Deny `ask_clarifying_question` | `appworld-plan.toml` (`hitl.denied_tools`) | Unattended eval ≠ chat |
| Worker must tool-call | `AGENTS.md` / plan TOML `task_type` | Avoid prose-complete theater |
| Login / loop overrides | Harness docs + TOML | Task-world specifics, not core runtime |

**Do not fork Genie production packages** for AppWorld-only guards. Product runtime stays general; the benchmark is opinionated. If a knob only exists to make AppWorld green, keep it in the [example harness](https://github.com/stackgenhq/genie/tree/main/examples/appworld-routing).

Product code can still grow **generic** gates (handoff size, domain tool counts) when they help every customer. AppWorld task IDs in `pkg/` is the smell.

---

## Langfuse as the A/B layer

Compare simple vs plan on the **same task ID** after the same stack rebuild. We use [Langfuse](https://langfuse.com/) traces side-by-side — peak/total tokens, tool counts, failure class — not slideware screenshots.

What to compare per trace:

- Coordinator vs worker peak prompt tokens
- Handoff payload size (bytes, not prose)
- Domain MCP call count per worker
- Judge failure class (`clarifying_question`, `zero_tool_worker`, `budget_no_eval`, …)

Pair with [Anthropic’s agent eval guide](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) for the general framework; our numbers are directional on a small AppWorld slice, not a product scorecard.

---

## Monday-morning checklist

1. Deny clarify tools in benchmark TOML; fail if they appear in logs.
2. Count **domain** MCP calls per worker — zero mutations = fail.
3. Classify failures (`clarifying_question`, `zero_tool_worker`, `pii_poison`, …) before comparing modes.
4. Run MCP baseline **and** plan mode on regressions — different layers.
5. Keep benchmark policy in harness config, not production forks.
6. Compare traces on the same task, not aggregate vibes.

---

## Related reading

- [AI agent eval failure modes](/blog/ai-agent-eval-failure-modes/) — full taxonomy
- [Stop duplicate agent workers](/blog/stop-duplicate-agent-workers-handoff-gate/) — handoff gate sequel
- [Multi-agent vs single-agent: MCP tool tax + pass@k](/blog/multi-agent-vs-single-agent-mcp-tool-tax-pass-at-k/) — when planning is worth the cost
- [Fair agent evals before performance](/blog/fair-agent-evals-before-performance/) — series start
- [Running AppWorld locally](/blog/running-appworld-locally-genie-agent-eval/) — ops prerequisite

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

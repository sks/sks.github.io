---
layout: post
title: "Observability Tools Agents Actually Call on Triage"
date: 2026-09-08 16:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 60
description: "From live combo benches: the short Grafana/Loki tool set that showed up in successful closes — and the dead ends that burned turns."
image: /assets/images/og-default.png
tags: [ai-agents, observability, grafana, sre, mcp, tooling, evaluation, reactree, aiden]
permalink: /blog/observability-tools-agents-actually-call/
faqs:
  - question: "Which Grafana tools mattered on the dual-part alert+logs job?"
    answer: "get_alert_rule, list_firing_instances, observability_query (metrics and LogQL), and execute_command for denser probes. Catalog tools (search_tools, discover_skills) showed up but did not count as measurement."
  - question: "Do agents need dozens of observability tools exposed?"
    answer: "Not for this job. Successful closes clustered on a handful of query primitives. Extra catalog and filesystem tools mostly produced invalid-path and empty-path failures."
  - question: "What failed repeatedly?"
    answer: "Absolute paths into truncated tool-output stores in search_content, empty path on search_file, and transport timeouts on heavy LogQL. Hosts should treat those as typed failures, not successes."
---

If you are wiring an [agent runtime](/blog/what-is-an-ai-agent-runtime/) for SRE, the temptation is a fat tool catalog. Our [six-combo bench](/blog/six-model-mode-combos-alert-logs-bench/) was blunt: the closes that scored full correctness leaned on a **short** observability menu.

We ran both a **single-agent ReAct loop** and a **hierarchical ReAcTree planner** ([what is ReAcTree?](/blog/what-is-reactree/) · [PDF](https://arxiv.org/pdf/2511.02424)). Tool names are easiest to audit on the single-agent stream.

---

## TL;DR

- **Live signal tools that mattered:** alert rule fetch, firing instances, PromQL/LogQL query, occasional execute_command.
- **Context tools that appeared but are not evidence:** `search_tools`, `discover_skills`, `load_skill`, notes.
- **Common dead ends:** empty `search_file` path, absolute paths into truncated tool dumps, LogQL transport timeouts.
- Count **measurement** separately from **catalog**. Mixing them fools first-turn “progress” gates.

### Explain like I'm five

A good detective kit is a flashlight, a notepad, and a door key. Dumping the whole hardware store in their backpack just means they trip on wrenches while the house burns.

---

## The menu that showed up in good closes

Across single-agent seats (where tool names are easiest to audit in the stream):

| Tool family | Role |
|-------------|------|
| `*_get_alert_rule` | Confirm expr, `for`, labels |
| `*_list_firing_instances` | Anchor `fired_at` / current series |
| `*_observability_query` | PromQL slopes + LogQL volume/errors |
| `*_execute_command` | Denser follow-ups when query wrapper is awkward |
| `search_tools` / `discover_skills` | Orientation only |
| `note` / budget checks | Bookkeeping |

Hierarchical ReAcTree streams sometimes collapse tool names in the parent seat when the parent measures first and children dig later. Do not read “0 grafana_* in parent log” as “no measurement happened.” Check child or merged tool spans in your session traces.

---

## Dead ends worth instrumenting

From the same runs:

1. **`search_file` with empty path** — instant reject. Preview reasoning seats hit this early.
2. **`search_content` on absolute `/tmp/...` dump paths** — path policy correctly refuses; agent retries waste turns unless the host returns a relative dump id.
3. **LogQL 504 / transport errors** — look like “try again with different args” to a high-thinking model. Treat typed `failed` / empty envelopes as [upstream failure](/blog/stop-retrying-the-same-failed-query/), not soft success.

---

## Design rules for the catalog

1. **Pin Collect tools by exact name** for evals ([fair agent evals](/blog/fair-agent-evals-before-performance/)).
2. **Separate** retrieval / catalog classes from live-signal classes in your loop detectors.
3. Prefer **one good query primitive** over five overlapping wrappers.
4. Truncated-output tools must accept the **ids your summarizer emits**, not absolute host paths.

Related: [What is ReAcTree?](/blog/what-is-reactree/), [single-agent vs multi-agent](/blog/single-agent-vs-multi-agent/), [loop detection](/blog/ai-agent-loop-detection-salvage/), [empty query ≠ absent signal](/blog/empty-query-not-absent-signal/).

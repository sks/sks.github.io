---
layout: page
title: Multi-step AI agent debugging checklist
permalink: /checklists/agent-debug/
description: "A reusable AI agent debugging checklist: freeze the task, inspect traces and tool evidence, change one host behavior, and replay the same run."
faqs:
  - question: "What should you capture when debugging an AI agent?"
    answer: "Capture the frozen task, model and orchestration configuration, tool calls and typed outcomes, model observations, timing and token usage, and the final claims in one run artifact."
  - question: "Should prompt edits come first when an AI agent fails?"
    answer: "Not by default. First check tool failures, missing observations, retry loops, truncation, and completion gates. Otherwise a prompt edit can hide a host or tool-contract bug."
---

Use this checklist when a multi-step agent returns a plausible answer but the run cannot explain or reproduce it. Full guide: [Best Way to Debug a Multi-Step AI Agent](/blog/best-way-to-debug-multi-step-ai-agent/).

*Use synthetic or approved incident data. Remove secrets and customer identifiers before sharing a trace.*

## 1. Freeze the reproduction

- [ ] Save the exact user task and expected evidence.
- [ ] Record the model, reasoning settings, orchestration shape, and host flags.
- [ ] Record tool versions, permissions, environment, and relevant time windows.
- [ ] Define what counts as success, failure, and an honest partial result.
- [ ] Keep this task unchanged until the comparison is complete.

## 2. Export one run

- [ ] Keep parent and child model calls together under one session or run identifier.
- [ ] Include tool arguments, typed outcomes, errors, and relevant result payloads.
- [ ] Include elapsed time, token usage, retries, and cancellation events.
- [ ] Preserve the final answer beside the observations that supposedly support it.
- [ ] Note missing data explicitly; an empty preview is not proof that no data exists.

## 3. Inspect each step

For every important step, ask:

| Check | Failure signal |
|-------|----------------|
| Decision | Did the model choose an action relevant to the task? |
| Tool outcome | Did the tool succeed semantically, not merely return HTTP 200? |
| Observation | What exact result did the model receive? |
| Progress | Did the step add evidence, or repeat an earlier failed action? |
| Final claim | Can the conclusion cite a specific observation from this run? |

- [ ] Required measurement tools actually ran.
- [ ] Failed and truncated results remained visible as failures or partials.
- [ ] Repeated queries and no-progress loops are identifiable.
- [ ] The final answer names unknowns and blocked measurements.
- [ ] A confident claim does not rely on an observation the model never saw.

## 4. Make one controlled change

- [ ] Fix typed tool failures and misleading success envelopes first.
- [ ] Repair paging, truncation, and observation contracts next.
- [ ] Add no-progress, budget, cancellation, and completion gates where needed.
- [ ] Change prompt or skill prose only after the execution harness is honest.
- [ ] Record exactly one changed variable for the next replay.

## 5. Replay and compare

- [ ] Rerun the same frozen task with equivalent tool access.
- [ ] Compare correctness and evidence coverage before speed.
- [ ] Report absolute wall time, tokens, and cost beside the evidence score.
- [ ] Keep both traces and note environmental differences such as tool contention.
- [ ] Repeat the run before claiming improved reliability.

## Red flags

- Rewriting the system prompt after every run
- Grading only the final prose
- Treating tool invocation as proof of tool success
- Comparing two runs with different prompts or permissions
- Reporting relative speed while correctness or coverage changed

## Related

- [Evidence-gated RCA checklist](/checklists/evidence-gated-rca/)
- [“Is the agent task done?” checklist](/checklists/agent-done/)
- [One zip, one conversation](/blog/one-zip-one-conversation/)
- [How to evaluate an AI agent for root cause analysis](/blog/how-to-evaluate-ai-agent-root-cause-analysis/)

{% include subscribe.html %}

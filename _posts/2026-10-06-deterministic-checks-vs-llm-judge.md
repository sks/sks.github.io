---
layout: post
title: "Deterministic Checks vs LLM-as-a-Judge for Agent Evals"
date: 2026-10-06 19:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 74
description: "Use deterministic graders for facts a model must not invent. Use LLM-as-a-judge for tone and usefulness. Never plant tool scripts in the prompt."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, llm-as-judge, testing, reliability, verification, aiden]
permalink: /blog/deterministic-checks-vs-llm-judge/
faqs:
  - question: "What is the difference between deterministic and model-based graders?"
    answer: "Deterministic graders are code: file exists, number matches, path is real. Model-based graders (LLM-as-a-judge) score meaning: was the write-up useful, honest, complete."
  - question: "When should you use an LLM-as-a-judge?"
    answer: "When the check needs interpretation. Prefer code whenever the answer can be decided without reading for meaning. Calibrate the judge against humans before you trust it in a gate."
  - question: "Should the prompt name the tools the agent must call?"
    answer: "No. Write the task as a user job. Count delegated work from logs and artifacts, not from phrases you planted for a regex to find."
  - question: "What if a jargon filter fails a good answer?"
    answer: "Facts stay in the checker. Tone stays with the judge. Do not ban directory names that appear in a real diff. Do not add a second agent to scrub a path the first one got right."
---

A word filter banned an internal product name and then failed a good coverage note because that name was a directory in the diff. The note was correct. The grader was wrong. That is the whole argument for splitting **deterministic checks** from an **LLM-as-a-judge**.

[Arize's guide](https://arize.com/blog/how-to-build-llm-as-a-judge-evaluators-that-hold-up-in-production/) draws the line cleanly: code when interpretation is unnecessary, a judge when meaning matters. We learned it the hard way.

---

## TL;DR

- Write the task the way a person asks for the work. Do not script tool order.
- Code locks facts a model must not invent: marker, commit, percent, real path, brief size.
- The judge scores whether the investigation write-up was useful and honest.
- Do not assert the same thing in the prompt, a regex, and the judge.
- An empty trace is an export gap when the logs already show the work.

### Explain like I'm five

The teacher checks whether you wrote the date and signed your name. A different teacher reads the essay and says if it makes sense. Do not make the essay grader also check whether you used the word "stapler."

---

## Grade the deliverable, not the script

Outcome-first instructions. Tell the agent what to finish and what not to invent. Do not hand it a scripted checklist of private tool names.

Recursive "at least two delegations" is checked from logs after the fact, never planted in the prompt as a string the model must print. Under truncated logs, presence of a proof artifact (a short handoff receipt in the log) can be enough for the existence check. The judge still reads the write-up.

That is [Ham Vocke's](https://martinfowler.com/articles/practical-test-pyramid.html) arrange / act / assert on **observable behavior**, not call order. Agents find valid paths you did not anticipate. [Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) says the same: grade what the agent produced, not the route it took, unless the route itself is policy.

---

## Checklist: what belongs where

| Check | Deterministic | LLM-as-a-judge |
|-------|---------------|----------------|
| Deliverable file exists | Yes | No |
| Coverage percent matches CI | Yes | No |
| Head SHA is real | Yes | No |
| Changed path appears in the diff | Yes | No |
| Brief stayed under a size bound | Yes | No |
| Write-up is useful and grounded | No | Yes |
| Tone dumps unexplained jargon | Prefer judge | Yes |
| Honesty about gaps | Soft regex optional | Yes |

Decision rule: **if code can decide it, do not call a judge.**

---

## The false fail we hit

A case-insensitive ban on an internal architecture name failed a coverage comment because the summary cited a real path that contained that substring. The fix was not a second scrubbing agent. The fix was:

1. Lock only facts a model must not invent.
2. Mask citations in backticks so quoted paths can appear.
3. Leave tone and "is this unexplained?" to the judge.

Facts in the checker. Voice in the judge. That split also keeps you from duplicating assertions across three layers, which Vocke warns against.

---

## What the judge should see

In priority order:

1. The ask (instruction)
2. The files written
3. The logs
4. The trace export

An empty trace is not an automatic fail when logs already prove the dig. Empty traces are correlation or export gaps. Fail on missing traces only when the rubric requires them.

This pairs with [evidence-based verification](/blog/evidence-based-verification/): systems of record vote before narration. The judge is not the system of record for numbers. Code is.

---

## What to do Monday

1. Split your current rubric into "code can decide" and "needs interpretation."
2. Delete planted tool names from one instruction. Put the count check in logs instead.
3. Calibrate the judge on ten human-labeled examples before using it as a gate.
4. Give the judge an "Unknown / not enough evidence" exit so it does not invent fails.
5. When a regex false-fails, ask whether the check belonged in the judge all along.
6. Store ask + artifact + grade together for rematches ([frozen exams](/blog/same-problem-sre-model-bake-off/)).

---

## Takeaway

**Deterministic graders** catch lies about numbers and files. An **LLM-as-a-judge** catches weak writing. Mixing them into one vibe score is how you punish a correct path citation and bless a fluent fiction.

Previous: [The AI Agent Testing Pyramid](/blog/ai-agent-testing-pyramid/). Next: [How to Test AI Agent Loops Without Overfitting](/blog/test-ai-agent-loops-with-evidence/).

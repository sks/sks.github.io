---
layout: post
title: "AI Agent Evaluation: Why the Grader Must Be Separate"
date: 2026-10-06 09:30:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 72
description: "AI agent evaluation fails when the same model writes and grades. Separate the grader, build for the trial OS, treat the prompt as the interface."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, llm-as-judge, testing, benchmarking, reliability, aiden]
permalink: /blog/ai-agent-evaluation-separate-grader/
faqs:
  - question: "What is AI agent evaluation?"
    answer: "Give the agent a realistic job, collect what it produced, then score that work with graders that are not the same program or model that did the job."
  - question: "Why must the grader be separate from the agent?"
    answer: "A model grading its own prose will reward fluency. Use a different model for the LLM-as-a-judge, and use code for facts that do not need interpretation."
  - question: "Should the eval install copy a laptop binary into the trial?"
    answer: "No. Build the agent for the OS the trial runs. If the agent is missing from a foreign image, fail the install rather than silently shipping the wrong binary."
  - question: "What is the public interface of an agent eval?"
    answer: "The prompt and the deliverable. Do not stuff private tool names into the instruction just so a grader can grep them."
---

We once let the same model write the answer and then score it. The score was kind. The work was not. That is the shortest version of why **AI agent evaluation** needs a separate grader.

This sits next to [From Vibes to Contracts](/blog/from-vibes-to-contracts-agent-evals/) and [How to Evaluate an AI Agent for Root Cause Analysis](/blog/how-to-evaluate-ai-agent-root-cause-analysis/). Those posts cover rubrics and checklists. This one covers who is allowed to mark the paper.

---

## TL;DR

- The program that does the job and the program that grades it must be different.
- The model that writes must not be the model that judges.
- Build the agent inside the trial image for the OS the trial actually runs.
- If the agent is missing from a foreign image, fail the install. Do not quietly copy a laptop binary.
- The prompt is the public interface. Do not name private tools in the instruction.

### Explain like I'm five

Do not let the student grade their own homework. And do not hand them a test that says "use the red pen in drawer three." Hand them the job. Grade what they turned in.

---

## Two programs, two models

[Anthropic's demystifying evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) names three kinds of graders: code-based, model-based, and human. That stack only works if the agent under test is not also the model-based grader.

When we wired live trials through an external container runner, the agent model and the judge model were different by construction. CI fails if they match. A separate analyst model may explain a token bill after the fact, and it may fall back to a plain summary when it is down. None of those models are the agent.

These ideas apply whether you run LangGraph, CrewAI, OpenAI Agents, or an in-house loop. The rule is about who marks the paper, not which framework you use.

Decision rule: **if the same weights wrote the answer and scored it, the score is a mood, not a measurement.**

---

## Build for the trial, not the laptop

A second failure mode looks like infrastructure and feels like evaluation: you grade a different binary than you ship.

Build the agent inside the trial image for the same OS the trial runs. A laptop build will not boot there. If the agent is missing from a foreign dataset image, fail the install. Do not quietly copy a host binary into someone else's task and call the run green.

Treat the installed agent as the unit under test ([Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) applied to packaging). The binary on your desk does not count.

---

## The prompt is the interface

We do not test private methods by renaming them into the instruction. The persona and the ask should read like operator work. The grader may look at logs. The agent should not be told which private APIs to call so the grader can find those strings later.

That rule is the same one behind [evidence-based verification](/blog/evidence-based-verification/): score what the system produced against a system of record, not what the prompt whispered into the answer.

---

## What to do Monday

1. Name the agent model and the judge model in the same place. Fail the suite if they are equal.
2. Put code-based checks on facts (file exists, number matches, id matches). Put the LLM-as-a-judge on prose quality.
3. Build the agent in the trial image. Refuse host-binary install into foreign tasks.
4. Rewrite one task so the instruction never names a private tool.
5. Store the ask, the deliverable, and the grade together. Future you will need all three.

---

## Takeaway

**AI agent evaluation** is not a vibe check with a nicer font. It is a second program, a second model, and a prompt that looks like a user job. Everything else is commentary.

Next: [The AI Agent Testing Pyramid](/blog/ai-agent-testing-pyramid/). Previous context: [From Vibes to Contracts](/blog/from-vibes-to-contracts-agent-evals/).

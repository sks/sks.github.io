---
layout: post
title: "AI Agent Evaluation: Why the Grader Must Be Separate"
date: 2026-10-06 09:30:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 72
description: "Separate the agent from its grader, check facts with code, and run the installed build in the trial environment."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, llm-as-judge, testing, benchmarking, reliability, aiden]
permalink: /blog/ai-agent-evaluation-separate-grader/
faqs:
  - question: "What is AI agent evaluation?"
    answer: "Give an agent a representative task, save its output and evidence, and check the result against explicit criteria using code, a separate model, or human review."
  - question: "Why must the grader be separate from the agent?"
    answer: "An agent grading its own answer can miss errors and reward plausible wording. In these trials we keep the agent and judge models distinct, use code for verifiable facts, and review whether the judge agrees with humans. Separation alone does not make a score reliable."
  - question: "Should the eval install copy a laptop binary into the trial?"
    answer: "No. Build the agent for the OS the trial runs. If the agent is missing from a foreign image, fail the install rather than silently shipping the wrong binary."
  - question: "What is the public interface of an agent eval?"
    answer: "The task prompt and expected deliverable. Do not add private tool names solely to make a grader's string search pass."
---

We once let the model that wrote an answer score that answer. Its score was generous, but the work did not meet the task. That experience changed how we separate the *agent under test* from the *grader*—the code, model, or person checking its work.

[From Vibes to Contracts](/blog/from-vibes-to-contracts-agent-evals/) and [How to Evaluate an AI Agent for Root Cause Analysis](/blog/how-to-evaluate-ai-agent-root-cause-analysis/) discuss rubrics and checklists. Here the question is who applies them, and to which run.

---

![A task is performed by the agent and checked against evidence by an independent grader](/assets/images/diagrams/oct/separate-grader.svg)

*The agent writes the result; code, a separate model, or a person checks it against evidence.*

## Separate the work from the assessment

[Anthropic's demystifying evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) describes code-based, model-based, and human graders. They serve different purposes. A code check can compare an identifier with a record; a model judge can read whether an explanation addresses the user's question; a human can inspect disputed or high-stakes results. A separate judge can still be wrong or share the agent's blind spots, so compare its judgments with human examples before relying on a gate.

In our live trials an external container runner invokes the agent. The agent model and model-based judge are distinct, and CI rejects a configuration that makes them equal. That prevents direct self-grading; it does not prove that the judge is unbiased. A separate analyst model may explain token spend afterward, or fall back to a plain summary when unavailable. Its commentary is not the agent's result or the factual grade.

This distinction applies to LangGraph, CrewAI, OpenAI Agents, and in-house loops alike: record what did the task and what evaluated it. For facts such as whether a file exists or a number matches a source, use code rather than asking either model to remember.

## Run the build you intend to evaluate

An evaluation of the wrong executable says little about the one you ship. Build the agent inside the trial image for the trial's operating system; a laptop binary may not run there. If a foreign dataset image does not contain the agent, fail installation rather than copying a host binary into it and reporting a successful trial.

Treat the installed agent as the unit under test—an application of the [Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) to packaging. Save the build identity with the trial so that a surprising result can be traced back to the executable that produced it.

## Give the agent a user task, not a grading script

The prompt should describe the operator's job and expected deliverable. If the grader needs to know which internal calls occurred, inspect logs after the run. Putting private tool names in the prompt just so a string search finds them tests obedience to that hint, not whether the agent solved the job. A required route is different: if a policy truly requires a tool or approval, state that requirement and verify it separately.

As in [evidence-based verification](/blog/evidence-based-verification/), check claims against a system of record. A polished answer is not proof that the underlying file, incident, or measurement exists.

## A practical setup

1. Record the agent model and judge model together; in this setup, fail configuration if they match. Review judge decisions against human-labeled examples as well.
2. Use code for file existence, numbers, and identifiers; reserve a model judge for interpretation such as clarity and usefulness.
3. Build inside the trial image and reject host-binary installation into foreign tasks. Record the installed build.
4. Rewrite one task to remove private tool hints, unless using a particular tool is itself a user or policy requirement.
5. Save the prompt, deliverable, evidence, and grade together so a later investigation can reconstruct the result.

Separation reduces one source of bias, while build identity and evidence checks reduce two others. None replaces a well-specified task or human review of a questionable grade.

Next: [The AI Agent Testing Pyramid](/blog/ai-agent-testing-pyramid/). Previous context: [From Vibes to Contracts](/blog/from-vibes-to-contracts-agent-evals/).

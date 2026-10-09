---
layout: post
title: "Deterministic Checks vs LLM-as-a-Judge for Agent Evals"
date: 2026-10-06 19:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 74
description: "Check verifiable facts with code and use a calibrated model judge for questions that require reading and interpretation."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, llm-as-judge, testing, reliability, verification, aiden]
permalink: /blog/deterministic-checks-vs-llm-judge/
faqs:
  - question: "What is the difference between deterministic and model-based graders?"
    answer: "A deterministic grader runs a defined code check, such as comparing a number with CI. A model-based grader reads an answer and judges meaning, such as usefulness or whether gaps are explained. Code can be wrong too if its rule is wrong."
  - question: "When should you use an LLM-as-a-judge?"
    answer: "Use one when a criterion requires interpretation. Prefer code for checkable facts and compare the judge with human-labeled examples before using it as a gate."
  - question: "Should the prompt name the tools the agent must call?"
    answer: "Not just to satisfy a grader. Describe the user task and inspect logs or artifacts for required behavior; name a tool when its use really is part of the task or policy."
  - question: "What if a jargon filter fails a good answer?"
    answer: "Check whether it matched a legitimate citation, such as a directory in a diff. Keep verifiable facts in code and let a calibrated judge consider whether terminology is unexplained in context."
---

A filter intended to discourage unexplained internal terminology rejected a correct coverage note: the disallowed product name was also part of a directory path in the diff. The note cited the path accurately. The code check could not tell a citation from needless jargon.

A *deterministic grader* is a program with an explicit rule; it gives the same result for the same inputs. An *LLM-as-a-judge* is a model asked to assess a response against a rubric. [Arize's guide](https://arize.com/blog/how-to-build-llm-as-a-judge-evaluators-that-hold-up-in-production/) explains why interpretation belongs in a judge and checkable facts are often better handled by code. Neither type is automatically correct: a faulty regex is repeatably wrong, and a model judge can be inconsistent.

---

## Start with the deliverable

Tell the agent what the user needs and which claims it must substantiate. Avoid listing private calls only so a grader can search for their names in the answer. If the requirement is “delegate at least twice,” count delegated work in logs after the run rather than requiring the agent to print a phrase. With truncated logs, a short handoff receipt in the log can establish that a delegation occurred, but it cannot prove the quality of the work; inspect the deliverable too.

This is [Ham Vocke's](https://martinfowler.com/articles/practical-test-pyramid.html) arrange / act / assert applied to observable behavior. [Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) similarly recommends evaluating outcomes rather than a particular route unless the route is a requirement. If policy really specifies a call or approval, test that route explicitly.

## Divide the rubric by what can be verified

| Criterion | Check | Caveat |
|-----------|-------|--------|
| Deliverable file exists; brief fits a size limit | Code | Existence and length do not establish quality |
| Coverage percentage, commit SHA, changed path | Code against CI, Git, or the diff | Use the appropriate source of record, not a value copied from the answer |
| Delegation occurred | Logs or a handoff artifact | A missing or truncated log limits what can be concluded |
| Write-up is useful and grounded | Model judge, with human review of samples | Give the judge the task and underlying evidence |
| Jargon is unexplained; gaps are acknowledged | Model judge, possibly narrow code hints | A word's presence alone does not establish misuse or honesty |

In the false failure above, the fix was to limit code to verifiable facts, exempt quoted paths in backticks from the jargon filter, and let the judge decide whether language outside citations needs explanation. Adding another agent to rewrite a correct path would have hidden the grader's mistake.

## Give the judge enough context, and allow uncertainty

Provide the original ask and files written, then logs and the trace export where relevant. The judge needs to distinguish a supported claim from a plausible one. For numbers, code should compare the answer with the system of record; the judge is not that system. This complements [evidence-based verification](/blog/evidence-based-verification/).

An empty trace does not automatically mean the agent did nothing. If logs show the work, the empty export may be a correlation or export problem. Conversely, if the rubric specifically requires a trace, missing it is a failure of that criterion. Make that distinction in the result rather than treating missing evidence as proof of success or failure on every dimension. Let a judge say “not enough evidence” when it cannot decide.

## A small implementation plan

1. Mark each rubric item “code can verify” or “requires interpretation,” and identify its evidence source.
2. Remove planted tool names from one task; check actual calls in logs if calls are a requirement.
3. Compare the judge with a small set of human-labeled examples (for example, ten to start), including borderline answers. Expand and revise before making a consequential gate; ten are not a guarantee of reliability.
4. Preserve an unknown outcome for missing evidence and inspect disagreements or regex false failures.
5. Save the ask, artifact, evidence, and grade for later comparisons using [frozen exams](/blog/same-problem-sre-model-bake-off/).

A precise code check can catch a wrong number quickly. A model judge can read whether a correct number was explained well. The useful split depends on the criterion and the available evidence, not on whether one kind of grader seems more sophisticated.

Previous: [The AI Agent Testing Pyramid](/blog/ai-agent-testing-pyramid/). Next: [How to Test AI Agent Loops Without Overfitting](/blog/test-ai-agent-loops-with-evidence/).

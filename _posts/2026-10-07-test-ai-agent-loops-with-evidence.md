---
layout: post
title: "How to Test AI Agent Loops Without Overfitting"
date: 2026-10-07 08:30:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 75
description: "AI agent loop detection that bans tool names overfits. Cap failures, score new evidence, and unit-test the gate without a live model."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, testing, debugging, reliability, loops, aiden]
permalink: /blog/test-ai-agent-loops-with-evidence/
faqs:
  - question: "How do you do AI agent loop detection without overfitting?"
    answer: "Do not ban repeated tool names. Cap failures, record what each call returned, and treat a repeated observation as non-progress. A new id on the same observation is still not progress."
  - question: "Is a successful HTTP response always evidence?"
    answer: "No. If the body says the query failed, that is an upstream failure, not usable evidence for the next reasoning step."
  - question: "Should loop and evidence rules need a live LLM trial?"
    answer: "No. Stub the model and unit-test the public result. If you feel you must test a private method, the unit is doing too much."
  - question: "What if a later trace lacks the new loop behavior?"
    answer: "Confirm the trial ran the new build. We once chased a logic miss that was an old binary."
---

We added **AI agent loop detection** because a trace looked stuck. It punished repeated tool names even when the result was new. The agent was investigating. We called it a doom loop. The fix was worse than the bug until we threw the name-ban away.

This sits next to [Best Way to Debug a Multi-Step AI Agent](/blog/best-way-to-debug-multi-step-ai-agent/) and the older [loop salvage](/blog/ai-agent-loop-detection-salvage/) post. Those cover reading a zip and keeping the best answer. This one covers how to test the stop rule without overfitting.

---

## TL;DR

- Ban tool-name repetition and you punish valid investigation.
- Keep a failure limit and a record of what each call returned.
- A successful HTTP response whose body says the query failed is not evidence.
- A new id on the same observation is not progress.
- Product-specific metric rules do not belong in the shared runtime.
- Those rules are fast tests. They do not need a live model.

### Explain like I'm five

If a kid looks in the same closet twice and finds a different shoe the second time, that is not "stuck." If they open the closet, see it is empty, and open it again with a new sticky note that says "closet #47," that is still stuck.

---

## What we kept and what we deleted

**Deleted:** middleware that treated same-tool-again as guilt.

**Kept:**

- A hard failure limit so a broken tool cannot spin forever.
- A typed outcome per call: success vs failure, with a coarse failure class (validation, rejected, runtime, upstream).
- A bounded summary of the result.
- An observation fingerprint that ignores transient ids so a new spill label does not look like progress. Example: the same empty pod status with a new UUID still fingerprints as "empty," not as new evidence.

Gates then ask: is the evidence complete? Did the latest feedback get addressed? Is the agent gaining information? Those are public results you can test.

[Vocke](https://martinfowler.com/articles/practical-test-pyramid.html) again: if you need to test a private method, the class is doing too much. Test the public result.

---

## Upstream is not success

An HTTP 200 whose payload says the datasource failed must not count as evidence for the reasoning loop. We call that upstream failure. Without that class, the agent "succeeds" at fetching a broken answer and then builds a story on it.

Same spirit as [evidence-based verification](/blog/evidence-based-verification/): self-report and transport success are not enough.

---

## Keep the runtime general

We tried embedding SRE point solutions into the shared stop logic: which metric family, which cluster phase, which inventory gap. Those belong with the tool producer or the domain skill. The shared runtime keeps truncation markers, dedup, failure limits, and evidence completeness. Domain rules leave.

That is the solitary vs sociable split for tests too (solitary stubs every collaborator; sociable keeps real nearby ones):

| Kind | What you stub | What you assert |
|------|---------------|-----------------|
| Solitary | Model and tools | Classification of a canned result |
| Sociable | Outer network only | Gate refuses complete-with-pending-evidence |

---

## The old-binary false alarm

A later trace lacked the new attributes. We almost rewrote the logic again. The trial was still running the old build. Confirm the binary before you rewrite the theory. That is also a CI honesty problem, covered in the [evals in CI/CD](/blog/ai-agent-evals-cicd-flakes/) post.

---

## What to do Monday

1. Delete any stop rule that fires only because the same tool name appeared twice.
2. Add a failure class for "transport ok, payload failed."
3. Fingerprint observations without transient ids.
4. Unit-test those classifiers with stubbed results. No live model.
5. After a deploy, confirm one live trace shows the new fields before you debug further.
6. Keep domain-specific "which panel did you forget" rules out of the shared loop.

---

## Takeaway

**Loop detection** that overfits tool names trains the agent to rename the same mistake. Score evidence. Cap failures. Unit-test the public gate.

Previous: [Deterministic Checks vs LLM-as-a-Judge](/blog/deterministic-checks-vs-llm-judge/). Next: [Multi-Agent Handoff Testing](/blog/multi-agent-handoff-testing-context-loss/).

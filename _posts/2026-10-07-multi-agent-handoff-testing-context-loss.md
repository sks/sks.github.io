---
layout: post
title: "Multi-Agent Handoff Testing: Catch Context Loss Before Production"
date: 2026-10-07 12:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 76
description: "Multi-agent handoff testing treats the brief as a contract: settled facts, open gaps, no transcript dump. Catch context loss before the parent overflows."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, multi-agent, testing, handoff, context-engineering, aiden]
permalink: /blog/multi-agent-handoff-testing-context-loss/
faqs:
  - question: "How do you test context loss between agents?"
    answer: "Treat the handoff as a contract. Assert required fields survived, open gaps were not silently dropped, the receiver does not re-ask known facts, and hops stay bounded. Mutate one field at a time and expect a fail."
  - question: "What is multi-agent handoff testing?"
    answer: "Tests aimed at the transfer boundary: payload completeness, provenance, permissions, hop budget, and a terminal state. Both agents can look fine while the seam drops context."
  - question: "Should a worker return its full transcript?"
    answer: "No. Return a short brief: what settled, what is still open. Replaying the child transcript is how parents blow the input cap."
  - question: "How does this relate to contract tests?"
    answer: "Ham Vocke's consumer and provider tests apply: the parent consumes a brief, the worker provides it. Test the boundary, not the whole UI of either side."
---

The parent overflowed because the worker sent its diary. That is **context loss** wearing a tuxedo: nothing "missing," everything too present. **Multi-agent handoff testing** exists to catch that seam before production.

Search results from [TestMu](https://www.testmuai.com/blog/agent-handoff-testing/) and [QASkills](https://qaskills.sh/blog/testing-multi-agent-handoff-context-loss) say the same thing we learned the hard way: both agents can behave correctly while the transfer drops or dumps information. Test the boundary.

---

## TL;DR

- A handoff is a short contract, not a transcript dump.
- The brief states what settled and what is still open.
- Once every gap is closed, stop spawning more workers.
- If you trim the brief and drop an open gap, the work is not closed.
- Match the eval to production settings. Slower trials beat grading a different agent.
- Give each worker its own folder. The parent still writes the deliverable where the grader looks.

### Explain like I'm five

When you ask a friend to check the basement, you want "stairs creak, water heater fine, weird smell by the dryer." You do not want them to recite every step they took for twenty minutes while you forget why you asked.

---

## Consumer and provider, parent and worker

Vocke's contract tests map cleanly:

| Role | Obligation |
|------|------------|
| Worker (provider) | Return a bounded brief with settled facts and open gaps |
| Parent (consumer) | Consume the brief, refuse more work when gaps are closed, write the user-facing deliverable |

The worker does not return its transcript. Pointers to notes (keys without full bodies) are enough. Caps on handoff payload size and parent rollup size are product choices; the principle is "bounded," not a magic number in this post.

If trimming the brief would drop an open gap, mark the parent summary unfinished. Silent omission is how you ship false confidence.

Related: [Stop Spawning Duplicate Workers](/blog/stop-duplicate-agent-workers-handoff-gate/).

---

## Input caps are part of the contract

If the prompt does not fit the serving window, shrink tool output once and then refuse. Recursive overflow is usually a transcript dump wearing a handoff costume.

Match the eval to production. Turning summaries off made trials slower. Raise the time budget. Do not grade a summarized twin that you never ship.

---

## Handoff test checklist

Use this as a Monday checklist. Mutate one item at a time and expect a fail.

1. Required fields present in the brief (goal, settled facts, open gaps, stop reason).
2. Open gaps cannot disappear during trim without marking unfinished.
3. Receiver does not re-ask facts already in the brief.
4. Hop count stays inside a budget.
5. After gaps close, further spawn is refused.
6. Parent deliverable lands where the grader looks.
7. Worker files stay in an isolated folder so they cannot clobber the parent root.
8. Oversize prompt: one compact attempt, then refuse.

That is contract testing at the boundary. Replaying the child transcript is the ice-cream cone from the [testing pyramid](/blog/ai-agent-testing-pyramid/) post.

---

## What to do Monday

1. Write down the handoff schema in one page: required fields and forbidden dumps.
2. Add a unit test that a transcript-sized payload is rejected or truncated to the brief shape.
3. Add a mutation test that drops one open gap during trim and asserts "not closed."
4. Cap hops. Log when the cap fires.
5. Run one live trial with production summary settings, even if it is slower.
6. Confirm the parent artifact path is the path the grader reads.

---

## Takeaway

**Multi-agent handoff testing** is not "did the final answer sound good?" It is "did the right short brief cross the seam without losing the open questions or drowning the parent?"

Previous: [How to Test AI Agent Loops](/blog/test-ai-agent-loops-with-evidence/). Next: [AI Agent Evals in CI/CD](/blog/ai-agent-evals-cicd-flakes/).

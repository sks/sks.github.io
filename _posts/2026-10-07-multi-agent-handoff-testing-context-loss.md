---
layout: post
title: "Multi-Agent Handoff Testing: Catch Context Loss Before Production"
date: 2026-10-07 12:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 76
description: "Test the brief passed from a worker to its parent: settled facts, open gaps, size limits, and a clear stop condition."
image: /assets/images/og-default.png
tags: [ai-agents, evaluation, multi-agent, testing, handoff, context-engineering, aiden]
permalink: /blog/multi-agent-handoff-testing-context-loss/
faqs:
  - question: "How do you test context loss between agents?"
    answer: "Check that the handoff preserves required fields and unresolved questions, stays within its size bound, and reaches the receiver. Test whether the receiver avoids re-asking settled facts and stops delegating when gaps are closed."
  - question: "What is multi-agent handoff testing?"
    answer: "Testing the transfer from one agent to another: payload completeness, provenance, permissions where relevant, hop budget, and a clear terminal state. A good final answer alone may not reveal a faulty transfer."
  - question: "Should a worker return its full transcript?"
    answer: "Generally return a bounded brief with settled facts, evidence pointers, and open questions rather than replaying the full transcript. Preserve access to the original evidence when a later audit needs it."
  - question: "How does this relate to contract tests?"
    answer: "The worker provides a brief and the parent consumes it. Specify and test what that boundary requires, including how the parent behaves if a field or piece of evidence is missing."
---

In one run, a worker sent its entire transcript back to the parent agent. The parent exceeded its input limit before it could finish the user's task. The failure was not a missing fact; it was a handoff too large to use. A shorter handoff has the opposite risk: dropping an unresolved question and letting the parent claim the work is complete.

A *handoff* is the information passed from a worker agent to the parent that assigned it a subtask. A *brief* is the bounded summary the parent can act on. Discussions by [TestMu](https://www.testmuai.com/blog/agent-handoff-testing/) and [QASkills](https://qaskills.sh/blog/testing-multi-agent-handoff-context-loss) likewise focus on the transfer boundary: checking each agent separately can miss information lost or dumped between them.

---

![A worker handoff transfers facts, evidence pointers and unresolved gaps](/assets/images/diagrams/oct/handoff.svg)

*The parent should receive both findings and what remains unknown.*

## Specify what crosses the boundary

| Participant | Responsibility |
|-------------|----------------|
| Worker (provider) | Return the goal, settled facts with evidence pointers, open gaps, and why it stopped, within a payload limit |
| Parent (consumer) | Use those facts without re-asking unnecessarily, keep unresolved gaps visible, stop assigning work when they are closed, and write the user-facing deliverable |

This is a *contract test*: it checks what the provider sends and what the consumer requires. A pointer to a note can stand in for its full body in the brief, provided the evidence remains retrievable. The payload and parent-rollup caps depend on the model window and product budget; there is no universal byte count here. [Stop Spawning Duplicate Workers](/blog/stop-duplicate-agent-workers-handoff-gate/) covers the related stop condition.

If shortening a brief would remove an open gap, mark the parent's summary unfinished rather than silently treating the gap as closed. A brief should save context space without converting uncertainty into certainty.

## Input limits and production settings matter

When a prompt exceeds the serving model's input window, shrink tool output once according to your compaction policy, then refuse if it still does not fit. Repeatedly feeding the worker's transcript back into the parent makes overflow likely. Test both the acceptable brief and the refusal path.

Our trials slowed when we turned summaries off to match production. Increasing the trial time budget was preferable to grading a faster, summarized configuration we did not ship. This is a tradeoff: realistic settings cost more time, but different settings answer a different question.

## Test the transfer, one change at a time

1. Supply a brief with goal, settled facts, open gaps, and stop reason. Check that each field reaches the parent.
2. Remove one open gap during trimming and assert that the parent cannot mark the task closed.
3. Give the receiver an already settled fact and check it does not delegate simply to rediscover it.
4. Exercise the hop budget—the limit on parent-to-worker transfers—and check that another spawn is refused when the budget is spent or the gaps are closed. Log when the cap fires.
5. Confirm the parent writes its deliverable at the path the grader reads; keep worker files in isolated folders so they cannot overwrite it.
6. Supply an oversize prompt and verify one compaction attempt followed by refusal if necessary.
7. Run a live trial with production summary settings after the fast contract tests pass.

These checks have different costs. A unit test can verify fields and bounds quickly; a live trial can show whether the parent actually uses the brief. The [testing pyramid](/blog/ai-agent-testing-pyramid/) helps keep the repeated structural checks out of the slow layer.

The desired outcome is a brief the parent can use, not merely a short one. Size, preserved uncertainty, and correct downstream behavior all matter.

Previous: [How to Test AI Agent Loops](/blog/test-ai-agent-loops-with-evidence/). Next: [AI Agent Evals in CI/CD](/blog/ai-agent-evals-cicd-flakes/).

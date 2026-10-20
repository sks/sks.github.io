---
layout: post
title: "Two E2E Feedback Loops: Coverage Gaps vs Failure Fixes"
date: 2026-10-13 14:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 79
description: "A beginner-friendly guide on why your automated testing robot needs two separate jobs: finding missing tests and fixing broken ones."
image: /assets/images/diagrams/oct/e2e-coverage-vs-failure.svg
tags: [ai-agents, evaluation, testing, ci-cd, reliability, aiden]
permalink: /blog/e2e-coverage-and-failure-loops/
faqs:
  - question: "What are the two E2E feedback loops?"
    answer: "Loop A checks for missing tests on brand new code. Loop B investigates and fixes tests that just broke."
  - question: "Why keep coverage scanning separate from failure fixing?"
    answer: "Mixing them up creates chaos. You might not realize if you forgot to test a new feature, or if you just temporarily ignored a broken test from yesterday."
  - question: "What does 'no gap found' mean?"
    answer: "It just means the robot didn't spot any obvious missing tests in the specific new code it checked. It doesn't mean your whole app is perfectly tested!"
  - question: "Is a quick automated check the same as a daily review?"
    answer: "No. A quick check just proves the automation can suggest fixes. A daily review is a thorough, organized look at everything that failed recently."
---

Imagine you have an automated robot helper that checks your software team's work. To be effective, this robot needs two completely separate job descriptions, rather than trying to do everything at once in one messy mega-job. 

When we try to point a single daily process at "making testing smarter," things slip through the cracks. We can't tell if our automation missed a brand new feature or if it simply failed to fix an old test.

*Loop A* turns new product changes into a safety net. *Loop B* turns observed failures into fixes. Keep them completely separate until a human developer steps in to review the work!

**Key takeaways**

- Searching for missing tests and reviewing broken tests happen on different schedules and require different clues.
- Just because the robot says "I didn't find any missing tests today" doesn't mean your app is 100% covered.
- Quick automated guesses aren't a replacement for a solid daily review process.
{: .key-takeaways}

---

![Loop A scans commits into coverage asserts; Loop B correlates failures into fixes and verification](/assets/images/diagrams/oct/e2e-coverage-vs-failure.svg)

*Two paths share a human gate. Conflating them creates blind spots.*

## Job 1: The "New Stuff" Checker (Loop A)

Whenever a developer finishes building a brand new feature, the robot's job is to scan that new code and ask: *"Did we write a test for this new piece?"* 

Here is how that looks in practice:
1. Scheduled tests run as usual.
2. The automation scans the recent code the team just wrote. (It ignores the testing folder itself so it doesn't get confused).
3. It figures out if the changes are real "user-visible" updates (like a new button or API) or just background chores (like updating a read-me file).
4. If it spots a missing test for a real feature, it flags it and drafts a plan to cover it.
5. A human reviewer steps in, validates the plan, and approves the new test.
6. The new test runs for real! 

This "last mile" of checking for missing tests is a hot topic right now. Research like [ChaCo (ICSE 2026)](https://software-lab.org/publications/icse2026_ChaCo.pdf) and Uber’s [AutoCover](https://homes.cs.washington.edu/~rjust/publ/auto_cover_icse_2026.pdf) show how automation can suggest tests for brand new code while a human is still thinking about it. The automation proposes, but the human always approves.

## Job 2: The "Broken Stuff" Fixer (Loop B)

Every night, your team automatically runs all existing tests to make sure the app still works. If a test fails, the robot puts on its detective hat. It looks at the failure and asks: *"Why did this break, and how do we fix it?"*

A reliable daily review path should:
1. Look at a specific window of time (like yesterday).
2. Gather up every single failure, timeout, or cancellation in that window. 
3. Connect the dots between the failed test, the exact code version running, and the error logs. 
4. Figure out what broke: Was it a bug in the app? A broken test? A server glitch?
5. Propose a draft to fix it. 
6. Keep track of the issue so it doesn't get lost.
7. Require a human to review the fix, deploy it, and confirm the test passes again.

Just like [Anthropic's testing guidance](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) suggests, we need to separate making sure old stuff still works from checking if new stuff is covered. 

## The Big Takeaway: Don't Mix the Jobs!

If you tell your automation to look for missing tests *and* fix broken ones at the exact same time, things get chaotic. Here is what happens when teams mix them up:

| What Goes Wrong | Why It Happened |
|---------|----------------|
| The robot says "all good," but bugs still surprise you | Loop A ran, but you never finished looking at Loop B's failures. |
| You see the same broken test every week | The robot's fix was never actually approved and deployed. |
| The robot asks you to test a spelling correction | It forgot to filter out background chores. |

## Try This Split Instead

1. Set up two separate automated jobs: a "coverage scan" and a "failure review." They don't even need to run at the same time.
2. Be very clear about what code the robot is allowed to look at.
3. Timestamp everything so you know exactly when an error happened.
4. Always require a human to adopt and approve a suggested fix.
5. When you fix a bug in the app, make sure a test is attached so it doesn't break again.

The [testing pyramid](/blog/ai-agent-testing-pyramid/) still decides *how* we test. These two loops just help us manage *when* we add new tests and *how* we fix the old ones without getting overwhelmed!

## Further reading

- [Change And Cover (ChaCo)](https://software-lab.org/publications/icse2026_ChaCo.pdf) - How automation can suggest tests for specific code updates.
- [AutoCover at industry scale](https://homes.cs.washington.edu/~rjust/publ/auto_cover_icse_2026.pdf) - How big companies manage robot-generated test suggestions.
- [State of Digital Quality 2026: functional testing](https://www.applause.com/state-of-digital-quality-2026/functional-testing-report/) - Balancing AI helpers with human ownership.

Previous: [Supervised E2E Learning Loop](/blog/supervised-e2e-learning-loop/). Next: [When Is an E2E Finding Actually Closed?](/blog/closing-e2e-findings/).

---
layout: post
title: "Go Platform Architecture at Speed — Without Drowning"
date: 2026-06-22 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 3
description: "Go platform architecture for a production AI agent codebase — patterns that keep rapid development sustainable without drowning in process."
image: /assets/images/og-platform.png
tags: [go, architecture, ddd, engineering, ai-agents]
---

Our first commit was “Hello World.” A few months and hundreds of commits later, the agent platform—the software that runs model calls, tools, and their surrounding services—had production integrations and a test suite. The useful question is which boundaries kept changes manageable, and where our early process fell short.

---

## The Growth Curve

Development moved in clear, recognizable phases: a single agent running a single tool, then deployment on Kubernetes (a container orchestration system), then multi-agent orchestration, then a hardening pass focused on production security, then enterprise integrations, then a stable platform. each phase added new interfaces and dependencies. We tried to keep responsibilities separated, although we documented those boundaries too late.

---

## The Rules That Scaled

We adopted coding conventions in week one. Some made later changes easier; others are preferences rather than universal rules.

The specifics don't matter for this post — what mattered was **consistency at scale**:

- **Consistent call signatures** — similar operations take a `context` for cancellation and a request value, so callers know where to pass inputs.
- **Generated test doubles** — fakes stand in for dependencies in unit tests and fail to compile when an interface changes. They do not replace tests of actual integrations.
- **Explicit dependencies** — methods can hold injected clients, while free functions still work for stateless transformations. Both are testable.
- **Readable control flow** — early returns help when they make error paths clear; they are not a substitute for small functions.
- **Small public APIs** — export only what other packages need; this reduces the number of callers affected by a change.

**Why this matters for agents:** our agent runtime calls models and tools through several integrations. Consistent interfaces make new providers easier to inspect, but reviewers still need to examine each provider’s failure and permission behavior.

---

## Domain Boundaries, Not Layer Soup

We separated packages for tool providers, identity, observability, orchestration, and data access. The intended direction is for orchestration to depend on narrower interfaces, not for a lower-level tool package to import orchestration. Go rejects import cycles, but it does not enforce the direction of an acyclic dependency graph; reviews and package tests still matter.

---

## The Test Pyramid

The test scopes show why fast isolated fakes were not enough to catch failures in compiled, composed workflows.

![Unit tests with fakes lead to composed-workflow integration tests against a mock model and a smaller manual acceptance layer](/assets/images/diagrams/june-foundations/go-platform-test-scopes.svg)

Most of the test suite is fast, isolated unit tests built on generated fakes (test implementations of dependencies). A smaller slice is integration tests that compile and execute full, composed workflows against a mock model — these caught faults that isolated tests missed at the composed-system level (see the [ReAcTree bugs post](/blog/reactree-bugs/) for concrete examples). A final, small slice is manual acceptance testing against real user-facing scenarios.

Our merge checks run linting, formatting, and the test suite. Those checks reduce avoidable regressions but do not establish production correctness.

---

## Patterns That Emerged

**A composable middleware chain** for tool execution — the same idea as HTTP middleware, applied to AI tool calls. Each concern (logging, safety checks, rate limiting, and so on) is its own small, independently testable unit that wraps the next one in the chain. Adding a concern means writing a wrapper and placing it at the right point in the chain. Order matters: an approval check must wrap every path that can execute a tool.

**A provider pattern** for every external integration — model providers, vector stores, document parsers, messaging platforms implement small interfaces and are registered by name. Configuration can choose an implementation, but provider-specific behavior still needs tests and operational review.

**A standard pattern for parallel work** — we use a shared pattern for concurrent independent operations: start bounded work, collect errors, cancel related work when appropriate, and avoid sharing mutable session state. A common pattern makes mistakes easier to spot; it does not make race testing optional.

---

## What We'd Do Differently

1. **Start with integration tests earlier.** We wrote unit tests from day one but didn't add integration tests testing fully composed workflows until well into the project. Some bugs lived in exactly that gap.

2. **Smaller pull requests.** Our early PRs were large. We eventually learned to keep them small — smaller PRs get meaningfully better reviews.

3. **Document package boundaries explicitly.** We relied on "everyone just knows" for longer than we should have. A short written explanation of the dependency graph would have helped onboarding a lot.

---

## The Result

Months later, in this codebase, a new tool provider takes about a day and a middleware layer about an hour. Those are our observed development estimates, not promises for other integrations. We still need integration tests and explicit package documentation alongside the conventions that kept lint issues at zero.

---


*What architecture patterns does your team enforce from day one? I'm curious about the "premature" rules that turned out to be essential. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*



---

I work on AI-assisted incident investigation at StackGen; project information is at [ai.stackgen.com](https://ai.stackgen.com).

---
layout: post
title: "Architecture at Speed Without Drowning"
date: 2026-06-22 10:00:00 -0700
series: "Building an AI Agent Platform in Go"
series_order: 3
description: "From a single Hello World commit to a production Go codebase in a few months — the architecture patterns that made rapid development sustainable."
tags: [go, architecture, ddd, engineering, ai-agents]
---

Our first commit was "Hello World." A few months and hundreds of commits later, we had a production-grade agent platform with a comprehensive test suite. Here's how we got there without drowning in complexity.

---

## The Growth Curve

Development moved in clear, recognizable phases: a single agent running a single tool, then Kubernetes deployment, then multi-agent orchestration, then a hardening pass focused on production security, then enterprise integrations, then a stable platform. Each phase added real surface area without any single part of the codebase growing unmanageably large — because the boundaries between domains were clear from day one.

---

## The Rules That Scaled

We adopted strict coding standards in week one, before the codebase was large enough to need them. This felt premature. It wasn't.

### Rule 1: A Consistent Interface Shape

Every interface method follows the same signature shape: a context parameter first, a request struct second. Always in that order. No exceptions.

**Why this matters at scale:** once you have dozens of packages and well over a hundred interfaces, consistency eliminates cognitive load. You never wonder "does this method take context?" or "which order are the parameters?" Every interface reads the same way.

**The hidden benefit:** adding a field to a request struct is backward-compatible. Adding a new parameter to a function signature is not. Over months of development, we added fields to request structs dozens of times with zero breaking changes downstream.

### Rule 2: Auto-Generated Test Doubles

Every interface gets a code-generation annotation that produces a type-safe fake implementation automatically. No hand-rolled mocks, no manually maintained mock boilerplate — just fakes that break at compile time the moment an interface changes, so a mismatch is caught immediately rather than silently at runtime.

By later months, we had a large and steadily growing set of these generated fakes. Maintaining that many by hand would have been a full-time job on its own.

### Rule 3: No Package-Level Functions

Functions with dependencies or state are methods on structs, not free-floating package functions. Methods enable dependency injection — you can swap a real dependency for a fake in tests. A package-level function that reaches directly into the filesystem or network is much harder to test without resorting to monkey-patching.

**Exception:** genuinely pure, stateless utility functions — string formatting, timestamp parsing, simple math — are exempt. Wrapping something with zero dependencies and zero state in a struct adds ceremony without benefit.

### Rule 4: No Else Blocks

Early returns and guard clauses instead of `if / else`. This sounds pedantic on a small codebase. At scale, it's the difference between code that reads top-to-bottom and nested spaghetti — every `else` avoided is one less indentation level, one less branch to hold in your head while reading.

### Rule 5: Export Only When Necessary

If something is only used within its own package, it stays unexported. We periodically sweep for exported symbols with zero external references and demote them back to private.

**Result:** each package's public surface stays small enough that you can read it in a couple of minutes and understand what the package is actually for.

---

## Domain-Driven Boundaries

The codebase is organized around clear domain boundaries rather than technical layers — data access, application services, tool providers, identity, observability, and so on each live in their own space, with dependencies flowing in one direction only. Lower-level packages never import from higher-level orchestration code; the compiler's import-cycle detection enforces this automatically, which turns a design intention into something that's actually impossible to violate by accident.

---

## The Test Pyramid

Most of the test suite is fast, isolated unit tests built on generated fakes. A smaller slice is integration tests that compile and execute full, composed workflows against a mock model — these are disproportionately valuable, because they catch bugs that only exist at the level of the composed system (see the [ReAcTree bugs post](/blog/reactree-bugs/) for concrete examples). A final, small slice is manual acceptance testing against real user-facing scenarios.

Every change runs linting, formatting, and the full test suite before it can merge. No exceptions, no "we'll fix it later."

---

## Patterns That Emerged

**A composable middleware chain** for tool execution — the same idea as HTTP middleware, applied to AI tool calls. Each concern (logging, safety checks, rate limiting, and so on) is its own small, independently testable unit that wraps the next one in the chain. Adding a new concern means writing one function and inserting it into the chain — no framework, no reflection, no magic.

**A provider pattern** for every external integration — model providers, vector stores, document parsers, messaging platforms all implement the same small interface and get registered by name. Swapping an implementation becomes a matter of changing configuration, not code.

**A standard pattern for parallel work** — every place we run independent operations concurrently uses the same structured-concurrency approach with proper error propagation and safe shared-state handling, rather than ad-hoc goroutine management. One pattern, everywhere, rather than a different flavor of concurrency bug in every package that needed to run things in parallel.

---

## What We'd Do Differently

1. **Start with integration tests earlier.** We wrote unit tests from day one but didn't add integration tests testing fully composed workflows until well into the project. Some bugs lived in exactly that gap.

2. **Smaller pull requests.** Our early PRs were large. We eventually learned to keep them small — smaller PRs get meaningfully better reviews.

3. **Document package boundaries explicitly.** We relied on "everyone just knows" for longer than we should have. A short written explanation of the dependency graph would have helped onboarding a lot.

---

## The Result

The codebase is still fast to work in months later. Adding a new tool provider takes about a day. Adding a new middleware layer takes about an hour. The architecture patterns we chose in week one are still holding, and lint issues are still at zero because the rules were never optional.

---

*What architecture patterns does your team enforce from day one? I'm curious about the "premature" rules that turned out to be essential. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

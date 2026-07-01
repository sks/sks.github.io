---
layout: post
title: "52 Packages in 4 Months — Architecture at Speed Without Drowning"
date: 2026-07-01 03:00:00 -0700
series: "Building an AI Agent Platform in Go"
series_order: 3
description: "From Hello World to 76K lines of Go — the architecture patterns that made rapid development sustainable."
tags: [go, architecture, ddd, engineering, ai-agents]
---

Our first commit was "Hello World." Four months and 400+ commits later, we had 52 Go packages, 76,000 lines of production code, and 70,000 lines of tests. Here's how we got there without drowning in complexity.

---

## The Growth Curve

```
Feb 27  — "Hello World"                     (1 file)
Mar  1  — First agent runs a tool           (8 packages)
Mar  7  — Kubernetes deployment             (18 packages)
Mar 15  — Multi-agent orchestration         (28 packages)
Apr  1  — Production security hardening     (38 packages)
May  1  — Enterprise integrations           (46 packages)
Jun  1  — Stable platform                   (52 packages)
```

That's roughly 3 new packages per week. Each package is a bounded domain — tools, memory, security, orchestration, observability. No package grew unmanageably large because the boundaries were clear from day one.

---

## The Rules That Scaled

We adopted strict coding standards in week one, before the codebase was large enough to need them. This felt premature. It wasn't.

### Rule 1: The 2-Parameter Interface Pattern

Every interface method follows this signature:

```go
type ToolProvider interface {
    GetTools(ctx context.Context, req GetToolsRequest) ([]Tool, error)
    ExecuteTool(ctx context.Context, req ExecuteToolRequest) (*ToolResult, error)
}
```

Always `ctx context.Context` first. Always a request struct second. No exceptions.

**Why this matters at scale:** When you have 52 packages with 100+ interfaces, consistency eliminates cognitive load. You never wonder "does this method take context?" or "which order are the parameters?" Every interface reads the same way.

**The hidden benefit:** Adding fields to a request struct is backward-compatible. Adding parameters to a function signature is not. After 4 months, we'd added fields to request structs dozens of times — zero breaking changes.

### Rule 2: Auto-Generated Test Doubles

Every interface gets a counterfeiter annotation:

```go
//counterfeiter:generate . ToolProvider
type ToolProvider interface { ... }
```

Run `go generate ./...` and you get type-safe fake implementations in `fakes/` directories. No hand-rolled mocks. No `mockgen` boilerplate. Just auto-generated fakes that break at compile time when interfaces change.

By month 4, we had 200+ auto-generated fakes. Maintaining them manually would have been a full-time job.

### Rule 3: No Package-Level Functions

All functions are methods on structs:

```go
// ❌ Package-level function
func FindSLOFiles(directory string) ([]string, error) { ... }

// ✅ Method on struct
func (s *SyncOptions) FindSLOFiles() ([]string, error) { ... }
```

**Why:** Methods on structs enable dependency injection. You can replace `s.fileSystem` with a fake in tests. Package-level functions that call `os.ReadDir` directly are untestable without monkey-patching.

**Exception:** Pure, stateless utility functions (formatting strings, parsing timestamps, mathematical computations) are exempt. If a function has no dependencies and no state, wrapping it in a struct adds ceremony without benefit.

### Rule 4: No Else Blocks

```go
// ❌ Else block
if s.DryRun {
    return dryRunResult
} else {
    return s.execute(ctx)
}

// ✅ Early return
if s.DryRun {
    return dryRunResult
}
return s.execute(ctx)
```

This sounds pedantic. At 76K lines, it's the difference between readable code and nested spaghetti. Every `else` you avoid is one less indentation level, one less branch to hold in your head.

### Rule 5: Export Only When Necessary

If a function is only used within its package, it's lowercase. We periodically grep for exported symbols with zero external references and demote them.

**Result:** Each package's public API surface is small. You can read the exported types in 2 minutes and understand what the package does.

---

## Domain-Driven Design — The Package Map

Our 52 packages follow a layered architecture:

```
pkg/
├── repository/              # Data access interfaces + models
│   ├── repositorymodel/     # Domain models (entities, value objects)
│   └── repositoryfakes/     # Auto-generated fakes
├── service/                 # Application services (orchestration)
│   ├── slo.go
│   └── grafana/
├── tools/                   # Tool providers (shell, web, SCM, MCP)
│   ├── shell/
│   ├── scm/
│   ├── mcp/
│   └── executable/
├── identity/                # User identity and auth
├── pii/                     # PII detection and redaction
├── langfuse/                # Observability integration
├── semanticrouter/          # Semantic classification pipeline
│   └── semanticmiddleware/  # L0 regex → L1 vector → L2 LLM
├── skills/                  # Skill loading and discovery
├── datasource/              # Vector store data connectors
│   └── docparser/           # Document parsing (Docling, Gemini)
└── config/                  # TOML config parsing
```

**Key principle:** Dependencies flow inward. `tools/` depends on `repository/` interfaces, never the reverse. `service/` orchestrates `tools/` and `repository/`, but neither knows about `service/`.

This isn't accidental — it's enforced by Go's import cycle detection. If `tools/shell` tries to import `service/slo`, the compiler rejects it. Go's strictness is a feature.

---

## The Test Pyramid

```
70,000 lines of tests across:

Unit tests          — 85%  (fast, isolated, use fakes)
Integration tests   — 12%  (FakeExpert, compiled plans)
QA test plans       — 3%   (manual acceptance criteria)
```

Every PR runs `make lint`, `make fmt`, and `make test`. All three must pass. No exceptions. No "fix later."

The 12% integration tests are critical — they caught bugs that unit tests missed (see the [ReAcTree bugs post](/blog/2026/07/01/reactree-bugs/) for examples). `FakeExpert` is a mock LLM that returns deterministic responses, letting us test full agent execution without API calls.

---

## Patterns That Emerged

### The Middleware Stack

Tool execution uses HTTP-style middleware:

```go
type ToolMiddleware func(next ToolHandler) ToolHandler

// Stack: panic recovery → logger → audit → loop detection
//        → failure limits → HITL → PII redaction → timeout
//        → rate limit → circuit breaker → execute
```

Each middleware is a `func(next) next` closure. Adding a new layer means writing one function and inserting it into the chain. No framework, no reflection, no magic.

### The Provider Pattern

Every external integration (LLM providers, vector stores, document parsers, messaging platforms) follows:

```go
type Provider interface {
    Name() string
    Configure(ctx context.Context, cfg Config) error
    // domain-specific methods...
}

type Registry struct {
    providers map[string]Provider
}
```

Register providers in `main.go`. Look them up by name at runtime. Switch implementations by changing config, not code.

### The errgroup Standard

All parallel operations use `errgroup`:

```go
g, gctx := errgroup.WithContext(ctx)
var mu sync.Mutex

for _, item := range items {
    g.Go(func() error {
        result, err := process(gctx, item)
        if err != nil {
            return nil // log and continue
        }
        mu.Lock()
        results = append(results, result)
        mu.Unlock()
        return nil
    })
}
return g.Wait()
```

No ad-hoc goroutine management. No `sync.WaitGroup`. One pattern, everywhere.

**A note on loop variables:** If you're on Go 1.22+, you no longer need the `item := item` capture hack — loop variables are now scoped per iteration. Our codebase still has some legacy captures from the pre-1.22 era, but new code omits them.

---

## What We'd Do Differently

1. **Start with integration tests earlier.** We wrote unit tests from day 1 but didn't add integration tests until month 2. Some bugs lived in the gaps.

2. **Smaller PRs.** Our early PRs were 1,000+ lines. By month 3, we'd learned to keep them under 400. Smaller PRs get better reviews.

3. **Document package boundaries explicitly.** We relied on "everyone knows" for the first 2 months. A `PACKAGES.md` explaining the dependency graph would have helped onboarding.

---

## The Result

| Metric | Value |
|--------|-------|
| Packages | 52 |
| Production code | 76,000 lines |
| Test code | 70,000 lines |
| Test coverage | ~80% |
| Interfaces | 100+ |
| Auto-generated fakes | 200+ |
| Lint issues | 0 (enforced) |
| Time | 4 months |

The codebase is still fast to work in. Adding a new tool provider takes a day. Adding a new middleware layer takes an hour. The architecture patterns we chose in week 1 are still holding.

---

*What architecture patterns does your team enforce from day one? I'm curious about the "premature" rules that turned out to be essential. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

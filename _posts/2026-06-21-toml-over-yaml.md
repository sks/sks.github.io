---
layout: post
title: "TOML Over YAML and PKL — How We Stopped Fighting Config and Started Shipping"
date: 2026-06-21 10:00:00 -0700
series: "Building an AI Agent Platform in Go"
series_order: 2
description: "We tried YAML, considered PKL, and landed on TOML for agent configuration. The reason surprised us."
tags: [config, toml, yaml, devops, ai-agents]
---

Configuration is the least exciting topic in software engineering. It's also the one that causes the most production incidents.

When we built our AI agent runtime at StackGen, we needed a config format for defining agents, tools, security policies, memory settings, and model routing. We tried YAML (like everyone else), evaluated PKL (Apple's new config language), and landed on TOML. Here's the decision process.

---

## What We're Configuring

An agent config defines who the agent is, what tools it can use, what security rules apply, how it manages memory, and which models it talks to. A handful of top-level sections, each fairly flat, each typed. Nothing exotic — which is exactly why the format mattered more than we expected.

---

## Why YAML Failed Us

YAML is the lingua franca of DevOps. Kubernetes, Docker Compose, GitHub Actions, Ansible — they all use it. So we started there.

### Problem 1: The implicit typing trap

```yaml
# Is this a string or a boolean?
enabled: yes
country: NO
version: 1.0
```

In YAML, `yes` silently becomes the boolean `true`, and `NO` becomes `false` — the infamous [Norway problem](https://hitchdev.com/strictyaml/why/implicit-typing-removed/). In a security-relevant config — a deny-list, an allow-list, a boolean flag guarding a dangerous capability — that kind of silent coercion is exactly the class of bug you can't afford. A list entry that was meant to be the string `"yes"` becoming the boolean `true` is the kind of thing that turns a config typo into an incident.

*(Yes, the YAML 1.2 spec theoretically fixed the Norway problem in 2009, but the DevOps ecosystem is fractured. Many widely used parsers — including popular Go and Python YAML libraries — still default to YAML 1.1 behavior. You never truly know how a generic parser will interpret your file in production.)*

### Problem 2: Indentation is meaning

A two-space misalignment is invisible to most editors but completely changes what a YAML file means — a key that should be nested under a section silently becomes a sibling instead. We caught this more than once in code review before deciding YAML wasn't worth the cognitive load for something as consequential as agent permissions.

### Problem 3: Multi-line strings are a mess

YAML has **nine** different ways to write multi-line strings. Our agent persona definitions include multi-paragraph system prompts. Every developer used a different style, and diffs were unreadable.

---

## Why PKL Was Interesting but Premature

Apple released [PKL](https://pkl-lang.org/) in 2024 as a "programmable config language." It has static types, schema validation, code reuse, and IDE support. We evaluated it seriously — and it's a genuinely elegant design.

But three things ruled it out for us:

### Problem 1: It requires a build step

PKL files aren't directly readable by Go's standard library. You need the PKL runtime to evaluate them into JSON/YAML/Go structs. That adds a build dependency, a CI step, and a failure mode — a non-starter for a single-binary deployment story.

### Problem 2: The ecosystem is thin

In mid-2026, PKL's Go integration is still maturing. Community tooling and editor support lag behind TOML and YAML. Our engineers would be learning a new language just for config.

### Problem 3: Code-as-config adds complexity

PKL's power — functions, conditionals, loops — is also its risk. Config should be **data**, not programs. When config can have bugs, you need tests for your config, and now you're maintaining two codebases.

### What about CUE?

We also evaluated [CUE](https://cuelang.org/), created by Marcel van Lohuizen (who helped build Borg, Kubernetes' predecessor). CUE is natively written in Go — no JVM build step — with strict types and powerful constraint validation. But CUE's lattice-based type unification is unfamiliar to most engineers, and we needed product engineers writing a working agent config in fifteen minutes, not learning a constraint logic language. TOML wins on approachability.

---

## Why TOML Won

[TOML](https://toml.io/) (Tom's Obvious, Minimal Language) hits the sweet spot:

### 1. Explicit types — no surprises

```toml
enabled = true      # boolean — explicit
country = "NO"      # string — always quoted
version = "1.0"     # string — always quoted
port    = 8080      # integer — unquoted numbers are numbers
```

No implicit type coercion. Strings are always quoted. Booleans are `true`/`false`, never `yes`/`no`. We considered JSON too, but configuration files need comments, and failing a deployment because of a trailing comma is a miserable developer experience.

### 2. Flat structure, obvious nesting

Section headers make hierarchy explicit — you can't accidentally re-parent a key by misaligning whitespace, the way you can in YAML. TOML isn't perfect here: deeply nested arrays of tables get verbose fast. Our configs are relatively flat by design (two to three levels), so we rarely hit that edge case. The trade-off for explicit types was worth it.

### 3. Native Go support

[`pelletier/go-toml/v2`](https://github.com/pelletier/go-toml/v2) decodes directly into typed Go structs with strict validation — misspelled keys, wrong types, missing required fields are all caught at parse time, not at 3am when a tool call hits a bad config path.

### 4. A visual config builder became possible

Because TOML is structured data (not code), we were able to build a visual config builder that generates valid TOML from a web form. That would be effectively impossible with PKL (you'd need to generate valid source code) and fragile with YAML (indentation has to be exact).

### 5. Diff-friendly

TOML diffs cleanly in pull requests — no context collapse, no indentation shifts propagating through the file. Reviewers see exactly what changed.

---

## The Comparison

| Feature | YAML | PKL | TOML |
|---------|------|-----|------|
| Implicit typing | Yes — `yes`→`true`, `NO`→`false` | No — static types | No — explicit types |
| Indentation sensitivity | High — whitespace is meaning | Low — braces | Low — section headers |
| Multi-line strings | Nine different syntaxes | Clean | Clean, triple-quoted |
| Build step required | None | Needs a runtime | None |
| Go library support | Mature | Maturing | Mature |
| Visual builder feasible | Fragile | Effectively no | Yes |
| Learning curve | Everyone knows it | A new language | Roughly fifteen minutes |
| Ecosystem size | Massive | Small | Medium |

---

## Two Layers, Two Config Surfaces

A single-developer CLI tool and a platform managing many agents across many teams have fundamentally different config lifecycle needs — one favors a file a developer edits locally, the other favors something reviewable and governed at the organization level, which is a separate design problem I cover in a [follow-up post on infrastructure-as-code for agent configuration](/blog/terraform-config/). The two surfaces share the same underlying agent runtime; only the config source and audience differ.

---

## Lessons Learned

1. **Config format is an API contract.** Once users adopt it, changing is expensive. Choose carefully upfront.

2. **Implicit behavior is the enemy of production reliability.** YAML's implicit typing has caused more outages than we'd like to admit across the industry. Explicit is always better.

3. **Config should be data, not code.** When config can have bugs, you need tests for config. That's a complexity trap.

4. **Parse-time validation beats runtime validation.** Catching errors when the agent starts is dramatically cheaper than catching them when a tool call hits a bad config path in production.

5. **The "everyone uses it" argument is weak.** Everyone used XML before JSON. Everyone used JSON before YAML. Evaluate on merits.

---

## What's Next

In the next post, I'll cover how we went from a single "Hello World" commit to a substantial, sustainable Go codebase in a few months — and the architecture patterns that made that growth manageable.

---

*What config format does your agent platform use? I'm genuinely curious about the trade-offs others are making. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

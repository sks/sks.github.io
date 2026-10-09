---
layout: post
title: "TOML Over YAML and PKL — How We Stopped Fighting Config and Started Shipping"
date: 2026-06-21 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 2
description: "Why we chose TOML for flat, typed agent configuration after considering YAML, PKL and CUE, and when those alternatives may fit better."
image: /assets/images/og-iac.png
tags: [config, toml, yaml, devops, ai-agents]
---

Configuration is an input to the runtime: a wrong type or misplaced setting can change what an agent is allowed to do. The format should make those errors visible before deployment.

When we built our AI agent runtime at StackGen, we needed a config format for defining agents, tools, security policies, memory settings, and model routing. We tried YAML, evaluated PKL (Apple’s programmable configuration language) and CUE, and chose TOML for this relatively flat, typed configuration. The decision would be different for configurations that need extensive reuse or validation rules.

---

## What We're Configuring

An agent config defines who the agent is, what tools it can use, what security rules apply, how it manages memory, and which models it talks to. A handful of top-level sections, each fairly flat, each typed. Nothing exotic — which is exactly why the format mattered more than we expected.

---

## Why YAML Failed Us

YAML is widely used in development operations (DevOps). Kubernetes, Docker Compose, GitHub Actions, Ansible — they all use it. So we started there.

### Problem 1: The implicit typing trap

```yaml
# Is this a string or a boolean?
enabled: yes
country: NO
version: 1.0
```

Under YAML 1.1 rules, `yes` can become the boolean `true`, and `NO` can become `false` — the [Norway problem](https://hitchdev.com/strictyaml/why/implicit-typing-removed/). In a security-relevant config — a deny-list, an allow-list, a boolean flag guarding a dangerous capability — that interpretation needs to be explicit and tested. A list entry that was meant to be the string `"yes"` becoming the boolean `true` is the kind of thing that turns a config typo into an incident.

*(Yes, the YAML 1.2 spec theoretically fixed the Norway problem in 2009, but the DevOps ecosystem is fractured. Many widely used parsers — including popular Go and Python YAML libraries — still default to YAML 1.1 behavior. The actual parser and schema version determine what production reads; test with the parser you ship.)*

### Problem 2: Indentation is meaning

A misplaced indent can make a key a sibling rather than a child. Schema validation can catch some mistakes, but a syntactically valid file can still express the wrong hierarchy. We caught this more than once in code review before deciding YAML wasn't worth the cognitive load for something as consequential as agent permissions.

### Problem 3: Multi-line strings are a mess

YAML’s multi-line strings are sometimes counted as **nine** style-and-modifier combinations; the exact count depends on what you include. Our agent persona definitions include multi-paragraph system prompts; differing styles made reviews harder. That was a team convention problem as well as a format tradeoff.

---

## Why PKL Was Interesting but Premature

Apple released [PKL](https://pkl-lang.org/) in 2024 as a "programmable config language." It has static types, schema validation, code reuse, and IDE support. We evaluated it seriously — and it's a genuinely elegant design.

But three things ruled it out for us:

### Problem 1: It requires a build step

PKL files aren't directly readable by Go's standard library. You need the PKL runtime to evaluate them into JSON/YAML/Go structs. That adds a build dependency, a CI step, and a failure mode — another dependency in our build and deployment path, though generated config could still be shipped with a binary.

### Problem 2: The ecosystem is thin

At the time of our evaluation, PKL’s Go integration was still maturing. Community tooling and editor support lag behind TOML and YAML. Our engineers would be learning a new language just for config.

### Problem 3: Code-as-config adds complexity

PKL's power — functions, conditionals, loops — is also its risk. Programmable config can reduce duplication, but expressions and shared modules need tests and review. Our config was simple enough that we did not need that flexibility.

### What about CUE?

We also evaluated [CUE](https://cuelang.org/), created by Marcel van Lohuizen (who helped build Borg, Kubernetes' predecessor). CUE is implemented in Go and provides types and constraint validation. But CUE's lattice-based type unification is unfamiliar to most engineers, and we needed product engineers writing a working agent config in fifteen minutes, not learning a constraint logic language. For our small configs, TOML took less explanation.

---

## Why TOML Won

[TOML](https://toml.io/) (Tom's Obvious, Minimal Language) matched our constraints:

### 1. Explicit types — no surprises

```toml
enabled = true      # boolean — explicit
country = "NO"      # string — always quoted
version = "1.0"     # string — always quoted
port    = 8080      # integer — unquoted numbers are numbers
```

TOML makes this distinction explicit in the file: strings are quoted. Booleans are `true`/`false`, never `yes`/`no`. We considered JSON too, but its lack of comments was inconvenient for our hand-edited files.

### 2. Flat structure, obvious nesting

Section headers make hierarchy explicit — you can't accidentally re-parent a key by misaligning whitespace, the way you can in YAML. TOML isn't perfect here: deeply nested arrays of tables get verbose fast. Our configs are relatively flat by design (two to three levels), so we rarely hit that edge case. The trade-off for explicit types was worth it.

### 3. Native Go support

[`pelletier/go-toml/v2`](https://github.com/pelletier/go-toml/v2) decodes into typed Go structs. We add validation for unknown or required fields and invalid values at load time; decoding alone cannot infer every required field or policy invariant.

### 4. A visual config builder became possible

Because TOML is structured data (not code), we were able to build a visual config builder that generates valid TOML from a web form. A builder could also emit YAML or evaluated PKL, but TOML’s data-only structure made our form-to-file path straightforward.

### 5. Diff-friendly

For our shallow sections, TOML diffs are usually easy to review. Large arrays of tables and long prompts can still produce awkward changes.

---

## The Comparison

| Feature | YAML | PKL | TOML |
|---------|------|-----|------|
| Implicit typing | Parser/version-dependent (YAML 1.1 examples) | No — static types | No — explicit types |
| Indentation sensitivity | High — whitespace is meaning | Low — braces | Low — section headers |
| Multi-line strings | Several styles and modifiers | Clean | Clean, triple-quoted |
| Build step required | None | Needs a runtime | None |
| Go library support | Mature | Maturing | Mature |
| Visual builder feasible | Yes, with careful generation | Possible via evaluation/generation | Yes |
| Learning curve | Everyone knows it | A new language | Small syntax to learn |
| Ecosystem size | Massive | Small | Medium |

---

## Two Layers, Two Config Surfaces

A single-developer CLI tool and a platform managing many agents across many teams have fundamentally different config lifecycle needs — one favors a file a developer edits locally, the other favors something reviewable and governed at the organization level, which is a separate design problem I cover in a [follow-up post on infrastructure-as-code for agent configuration](/blog/terraform-config/). The two surfaces share the same underlying agent runtime; only the config source and audience differ.

---

## Lessons Learned

1. **Config format is an API contract.** Once users adopt it, changing is expensive. Choose carefully upfront.

2. **Check parser behavior in production.** YAML versions and implementations differ. Explicit values and schema tests matter more than assuming a format alone prevents errors.

3. **Use programmability when it pays for itself.** Reuse and constraints can justify PKL or CUE in a large configuration estate; they were unnecessary for ours.

4. **Validate before accepting config.** Decode, check required fields and policy constraints, and reject a bad config before an agent uses it.

5. **Fit the data shape.** Existing ecosystem tooling is a real advantage; for our shallow, hand-edited agent files, explicit types mattered more.

---

## What's Next

In the next post, I'll cover how we went from a single "Hello World" commit to a substantial, sustainable Go codebase in a few months — and the architecture patterns that made that growth manageable.

---


*What config format does your agent platform use? I'm genuinely curious about the trade-offs others are making. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*



---

I work on AI-assisted incident investigation at StackGen; project information is at [ai.stackgen.com](https://ai.stackgen.com).

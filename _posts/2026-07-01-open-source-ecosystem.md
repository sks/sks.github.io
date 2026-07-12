---
layout: post
title: "Contributing Back While Building a Commercial Product"
date: 2026-07-01 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 12
description: "We built a proprietary product. We also merged 17 PRs into the agent framework we depend on. Here's how to navigate that tension."
image: /assets/images/og-platform.png
tags: [open-source, community, ai-agents, go, engineering]
---

We built a proprietary product. We also merged 17 PRs into the agent framework we depend on. Here's how to navigate the tension between building commercially and contributing to the open-source ecosystem you rely on.

---

## The Dependency Graph

Our agent runtime is built on [trpc-agent-go](https://github.com/trpc-group/trpc-agent-go) — an open-source Go framework for building AI agents. It provides the core abstractions: tool interfaces, LLM wrappers, streaming, and memory primitives.

We extend it heavily — custom middleware, governance layers, memory management, multi-model orchestration — but the foundation is open source. Without it, we'd have spent months building plumbing instead of features.

That creates an obligation: **if you build on open source, you contribute back.** Not because you have to. Because it makes your product better.

---

## What We Contributed

### To trpc-agent-go (17 merged PRs)

Our contributions fall into three categories:

**Bug fixes we hit in production:**
- Streaming response handling that dropped events under load
- Memory tool state management issues causing data loss
- Context cancellation not propagating to sub-agents
- Rate limiter edge cases with concurrent requests

**Features we needed that benefit everyone:**
- HTTP client override for SSE connections (needed for corporate proxies)
- Enhanced tool metadata for governance (needed for our middleware stack)
- Memory search filtering by type (needed for our multi-type memory model)

**Security patches:**
- Input validation for tool arguments
- PII redaction hooks in the logging layer

**Pattern:** We build features in our private codebase first. When a feature requires changes to the upstream framework, we isolate the framework change, make it generic, and submit it as a PR. Our private code then builds on the merged upstream change.

### To the Broader Ecosystem

| Project | What We Contributed |
|---------|-------------------|
| [Docker MCP Registry](https://github.com/docker/mcp-registry) | Added StackGen to the official MCP server catalog |
| [A2A JS SDK](https://github.com/a2aproject/a2a-js) | Registry fix for agent-to-agent protocol |
| [Kiro Powers](https://github.com/kirodotdev/powers) | Added StackGen IaC power for agent management |
| [mcp-go](https://github.com/mark3labs/mcp-go) | HTTP client override for SSE transport |
| [dex (OIDC)](https://github.com/dexidp/dex) | MCP authentication flow changes |
| [HashiCorp Terraform MCP Server](https://github.com/hashicorp/terraform-mcp-server) | Reviewed and tested early builds |

---

## The Fork Management Problem

When you depend on an open-source project and contribute to it, you often need changes before your PR is merged. This creates a fork management challenge: your product depends on your fork, your fork has pending PRs, upstream merges other changes that conflict with yours, and now you're maintaining merge conflicts while trying to ship features.

**Our approach:**

1. **Keep forks minimal.** Only fork when you have a pending PR. As soon as the PR merges, rebase back to upstream.

2. **One PR per change.** Don't bundle. Bundled PRs take longer to review, have higher conflict risk, and block on the slowest-to-review change.

3. **Match upstream style.** Read their contributing guide. Match their test patterns. Use their naming conventions. PRs that look like they belong get merged faster.

4. **Be responsive.** When maintainers request changes, respond quickly. Stale PRs die.

5. **Design for maintainer latency.** The bottleneck is often the upstream review queue, not your response time. When your roadmap requires a framework change, propose a generic interface or registration hook upstream — then deploy your specific implementation in your private codebase immediately. You ship on time; the upstream PR merges when it merges.

### The Fork Dependency Trap

In Go, depending on an active fork means temporary `replace` directives in your module file — pointing your build at your fork until the upstream change lands. This works for your product but breaks downstream compatibility: Go ignores `replace` blocks in imported modules, so consumers of any library you distribute can't resolve your fork.

**Our mitigation:** Tag structured pseudo-versions on forks so the dependency graph is reproducible. When the upstream PR merges, immediately rebase and drop the replace. The rule: every fork dependency is a countdown timer, not a permanent fixture.

---

## What We Keep Proprietary

Not everything should be open-sourced. Here's our framework:

**Open source** (contributed upstream or to public repos):
- Generic framework improvements (bug fixes, features, performance)
- Interoperability standards (MCP, A2A protocol support)
- Tool integrations that benefit the ecosystem
- Documentation and examples

**Keep proprietary:**
- Our governance middleware stack (competitive advantage)
- Multi-model orchestration logic (competitive advantage)
- Tenant isolation and policy engine (enterprise feature)
- Specific customer integrations and configurations
- Operational knowledge (deployment patterns, scaling recipes)

**The litmus test:** "Would a competitor gain more from seeing this code than the community gains from using it?" If yes, keep it private. If no, contribute it.

**In practice, the boundary is rarely a clean file split.** Our governance middleware is proprietary, but the tool metadata interfaces it depends on are upstream. Our multi-model orchestration is private, but the model provider abstraction is open. The pattern: **open-source the interface abstractions, keep the implementations proprietary.** This turns the dependency into a plugin architecture where your core IP stays behind public hooks.

---

## Why Contributing Back Makes Business Sense

### 1. You fix bugs faster

When you find a bug in the upstream framework, you can either work around it in your code (fragile, compounds over time) or fix it upstream, get it reviewed by maintainers who know the codebase better, and have it maintained by the community going forward. Option B is more work upfront. It's less work over the lifetime of your product.

### 2. Your changes stay compatible

If you fix a bug in your fork but never upstream it, every upstream update requires you to re-apply your patch. After several months, you're maintaining a shadow fork with dozens of patches. Eventually, you stop updating and miss security fixes. By upstreaming, your changes become part of the official release.

### 3. Hiring signal

Engineers evaluate companies by their open-source presence. A track record of quality upstream contributions tells a candidate more about engineering culture than any job listing.

### 4. Community relationships

Maintainers remember contributors. When you need a feature merged urgently, or when you need help debugging a complex issue, having a track record of quality contributions buys goodwill.

---

## The Contribution Checklist

Before submitting a PR to an open-source project:

1. **Read CONTRIBUTING.md** — follow their process exactly
2. **Check existing issues** — your change might already be discussed
3. **Keep it small** — one logical change per PR
4. **Add tests** — match their testing patterns
5. **Write a clear description** — explain why, not just what
6. **Be patient** — maintainers are often volunteers
7. **Respond to feedback** — quickly, professionally, without defensiveness

---

## The Ecosystem We Operate In

The AI agent ecosystem is young. Standards are emerging:

- **MCP** (Model Context Protocol) — standardizing how agents connect to tools
- **A2A** (Agent-to-Agent) — standardizing how agents communicate
- **AG-UI** — standardizing how agents stream events to frontends

Contributing to these standards early means your product is compatible by default. Waiting means you retrofit later.

We adopted MCP for tool connections, A2A for inter-agent communication, and AG-UI for our chat interface. Each integration surfaced bugs and missing features that we contributed back.

---

## Lessons Learned

1. **Contribute upstream first, fork only when necessary.** Forks are a maintenance burden. Upstream PRs are maintained by the community.

2. **Separate generic from specific.** Generic improvements go upstream. Business-specific logic stays private. The line is usually clear.

3. **Small, focused PRs get merged.** Large PRs sit in review for weeks. Split them.

4. **Match their style, not yours.** Contributing is about fitting into their codebase, not reshaping it.

5. **Track your contributions.** A spreadsheet of merged PRs, with links and descriptions, is useful for team recognition, hiring, and marketing.

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

*Do you contribute to the open-source projects your product depends on? I'd love to hear about your approach to the build-vs-contribute tension. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*



---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

---
layout: post
title: "Contributing Back While Building a Commercial Product"
date: 2026-07-01 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 12
description: "Contributing back while building a commercial product: how we shipped a proprietary platform and still merged PRs into the agent framework we depend on."
image: /assets/images/og-platform.png
tags: [open-source, community, ai-agents, go, engineering]
---

We build a proprietary agent product on an open-source Go framework. We merged 17 pull requests (PRs) into that framework while keeping product-specific code private. The boundary is less about whether code is valuable than whether the change belongs in a reusable framework.

---

## The Dependency Graph

Our agent runtime is built on [trpc-agent-go](https://github.com/trpc-group/trpc-agent-go) — an open-source Go framework for building AI agents. It provides the core abstractions: tool interfaces, wrappers around large language models (LLMs), streaming responses, and memory primitives.

We extend it heavily — custom middleware, governance layers, memory management, multi-model orchestration — but the foundation is open source. Without it, we'd have spent months building plumbing instead of features.

Depending on that framework gives us a practical reason to contribute generic fixes upstream. Review and shared maintenance can reduce the cost of carrying a private patch, though contributions still take time and maintainers can decline them.

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
- HTTP client override for server-sent event (SSE) connections (needed for corporate proxies)
- Enhanced tool metadata for governance (needed for our middleware stack)
- Memory search filtering by type (needed for our multi-type memory model)

**Security patches:**
- Input validation for tool arguments
- Personally identifiable information (PII) redaction hooks in the logging layer

Our pattern: We build features in our private codebase first. When a feature requires changes to the upstream framework, we isolate the framework change, make it generic, and submit it as a PR. Our private code then builds on the merged upstream change.

### To the Broader Ecosystem

| Project | What We Contributed |
|---------|-------------------|
| [Docker MCP Registry](https://github.com/docker/mcp-registry) | Added StackGen to the Model Context Protocol (MCP) server catalog |
| [A2A JS SDK](https://github.com/a2aproject/a2a-js) | Registry fix for Agent-to-Agent (A2A) protocol |
| [Kiro Powers](https://github.com/kirodotdev/powers) | Added StackGen IaC power for agent management |
| [mcp-go](https://github.com/mark3labs/mcp-go) | HTTP client override for SSE transport |
| [dex (OpenID Connect, OIDC)](https://github.com/dexidp/dex) | MCP authentication flow changes |
| [HashiCorp Terraform MCP Server](https://github.com/hashicorp/terraform-mcp-server) | Reviewed and tested early builds |

---

## The Fork Management Problem

When you depend on an open-source project and contribute to it, you often need changes before your PR is merged. This creates a fork management challenge: your product depends on your fork, your fork has pending PRs, upstream merges other changes that conflict with yours, and now you're maintaining merge conflicts while trying to ship features.

We used a few rules to keep pending changes manageable:

1. **Keep forks minimal.** Only fork when you have a pending PR. As soon as the PR merges, rebase back to upstream.

2. **One PR per change.** Don't bundle. Bundled PRs take longer to review, have higher conflict risk, and block on the slowest-to-review change.

3. **Match upstream style.** Read their contributing guide. Match their test patterns. Use their naming conventions. Matching upstream conventions makes review easier; it does not guarantee acceptance.

4. **Be responsive.** When maintainers request changes, respond quickly. A delayed response can leave a PR out of date.

5. **Design for maintainer latency.** The bottleneck is often the upstream review queue, not your response time. When your roadmap requires a framework change, propose a generic interface or registration hook upstream — then deploy your specific implementation in your private codebase immediately. This can keep a release moving, but you still own the private implementation and any fork until upstream review is complete.

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

A useful review question is whether the community benefit of a generic change outweighs the reasons to keep it private, including customer confidentiality and product-specific implementation. It is a judgment call, not an automatic test.

**In practice, the boundary is rarely a clean file split.** Our governance middleware is proprietary, but the tool metadata interfaces it depends on are upstream. Our multi-model orchestration is private, but the model provider abstraction is open. In those cases we contribute reusable interface abstractions while keeping our implementations private. The boundary still needs case-by-case review; an interface can expose assumptions about the product.

---

## Why Contributing Back Makes Business Sense

### 1. You fix bugs faster

When you find a bug in the upstream framework, you can either work around it in your code (fragile, compounds over time) or fix it upstream, get it reviewed by maintainers who know the codebase better, and have it maintained by the community going forward. An upstream fix takes more work upfront but can reduce later maintenance if it is accepted.

### 2. Your changes stay compatible

If you fix a bug in your fork but never upstream it, every upstream update requires you to re-apply your patch. After several months, you're maintaining a shadow fork with dozens of patches. A long-lived shadow fork makes updates and security patches harder to keep up with. By upstreaming, your changes become part of the official release.

### 3. Hiring signal

Some candidates examine a company’s open-source work. Reviewed upstream contributions can offer a concrete view of its engineering practices alongside interviews and other evidence.

### 4. Community relationships

Consistent contributions can build useful relationships with maintainers. They do not entitle us to urgent review or support.

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
- **AG-UI** (Agent User Interaction) — a protocol for streaming agent events to user interfaces

Adopting these protocols can reduce later integration work, although implementations and evolving standards still require compatibility testing.

We adopted MCP for tool connections, A2A for inter-agent communication, and AG-UI for our chat interface. Each integration surfaced bugs and missing features that we contributed back.

---

## Decisions we keep revisiting

1. **Contribute upstream first, fork only when necessary.** Forks are a maintenance burden. Upstream PRs are maintained by the community.

2. **Separate generic from specific.** Generic improvements go upstream. Business-specific logic stays private. The line often takes negotiation between product, legal, and maintainer concerns.

3. **Keep PRs focused.** Focused PRs are easier to review; split changes when each part can stand on its own.

4. **Match their style, not yours.** Contributing is about fitting into their codebase, not reshaping it.

5. **Track your contributions.** A spreadsheet of merged PRs, with links and descriptions, is useful for team recognition, hiring, and marketing.

---


*Do you contribute to the open-source projects your product depends on? I'd love to hear about your approach to the build-vs-contribute tension. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*



---

> We build incident-triage agents at StackGen; the SRE offering is at [ai.stackgen.com](https://ai.stackgen.com).

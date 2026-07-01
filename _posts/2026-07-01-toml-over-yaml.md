---
layout: post
title: "TOML Over YAML and PKL — How We Stopped Fighting Config and Started Shipping"
date: 2026-07-01 02:00:00 -0700
series: "Building an AI Agent Platform in Go"
series_order: 2
description: "We tried YAML, considered PKL, and landed on TOML for agent configuration. The reason surprised us."
tags: [config, toml, yaml, devops, ai-agents]
---

Configuration is the least exciting topic in software engineering. It's also the one that causes the most production incidents.

When we built our AI agent runtime at StackGen, we needed a config format for defining agents, tools, security policies, memory settings, and model routing. We tried YAML (like everyone else), evaluated PKL (Apple's new config language), and landed on TOML. Here's the full decision process.

---

## What We're Configuring

An agent config defines:

- **Persona** — who the agent is, what it can do, how it talks
- **Tools** — shell access, web search, GitHub, MCP servers, custom executables
- **Security** — HITL approval rules, denied tools, PII redaction
- **Memory** — vector store, semantic router, episodic memory thresholds
- **Models** — which LLM for planning, which for tool calls, which for efficiency

Here's a real config (redacted):

```toml
agent_name = "sre-copilot"

[persona]
role = "SRE Copilot"
personality_traits = ["precise", "cautious", "methodical"]
accomplishment_confidence_threshold = 0.7

[hitl]
always_allowed = ["web_search", "memory_*", "read_*"]
denied_tools = ["rm", "kubectl delete"]

[vector]
backend = "qdrant"
collection_prefix = "sre"

[semantic_router]
cache_ttl = "5m"

[tools.shell]
enabled = true
timeout = "30s"

[tools.github]
enabled = true
org = "stackgenhq"

[tools.mcp.servers.datadog]
command = "npx"
args = ["-y", "@datadog/mcp-server"]
```

Simple, typed, nested, readable. Now let me show you why the alternatives didn't work.

---

## Why YAML Failed Us

YAML is the lingua franca of DevOps. Kubernetes, Docker Compose, GitHub Actions, Ansible — they all use it. So we started there.

### Problem 1: The implicit typing trap

```yaml
# Is this a string or a boolean?
enabled: yes
country: NO
version: 1.0
port: 8080
```

In YAML:
- `yes` → `true` (boolean)
- `NO` → `false` (boolean) — the infamous [Norway problem](https://hitchdev.com/strictyaml/why/implicit-typing-removed/)
- `1.0` → `1.0` (float, not string)
- `8080` → `8080` (integer)

In our agent config, `denied_tools = ["yes"]` would silently become `denied_tools = [true]`. The agent would happily run `rm -rf /` because the deny list contained a boolean, not a string.

*(Yes, the YAML 1.2 spec theoretically fixed the Norway problem in 2009, but the DevOps ecosystem is fractured. Many widely used parsers — including popular Go and Python YAML libraries — still default to YAML 1.1 behavior. You never truly know how a generic parser will interpret your file in production.)*

### Problem 2: Indentation is meaning

```yaml
tools:
  shell:
    enabled: true
    timeout: 30s   # string? duration? depends on the parser
  github:
  enabled: true    # Oops - this is a sibling of 'tools', not under 'github'
```

That two-space misalignment is invisible to most editors but completely changes the config structure. We caught this three times in code review before deciding YAML wasn't worth the cognitive load.

### Problem 3: Multi-line strings are a mess

YAML has **nine** ways to write multi-line strings (`|`, `>`, `|+`, `|-`, `>+`, `>-`, `|2`, and more). Our agent persona includes multi-paragraph system prompts. Every developer used a different style, and diffs were unreadable.

---

## Why PKL Was Interesting but Premature

Apple released [PKL](https://pkl-lang.org/) in 2024 as a "programmable config language." It has:

- Static types
- Schema validation
- Code reuse (classes, inheritance)
- IDE support (VS Code extension)

We evaluated it seriously:

```pkl
class AgentConfig {
  agent_name: String
  persona: Persona
  hitl: HitlConfig
  tools: Map<String, ToolConfig>
}

class HitlConfig {
  always_allowed: List<String(matches(Regex("[a-z_*]+"))>
  denied_tools: List<String>
}

sre_copilot: AgentConfig = new {
  agent_name = "sre-copilot"
  hitl = new {
    always_allowed = List("web_search", "memory_*")
    denied_tools = List("rm", "kubectl delete")
  }
}
```

The type safety is great. But:

### Problem 1: It requires a build step

PKL files aren't directly readable by Go's standard library. You need the PKL runtime to evaluate them into JSON/YAML/Go structs. That adds a build dependency, a CI step, and a failure mode.

For our single-binary deployment story, adding a PKL runtime (written in Java/Kotlin) was a non-starter.

### Problem 2: The ecosystem is thin

In mid-2026, PKL's Go integration is still maturing. Community tooling and editor support lag behind TOML and YAML. Our engineers would be learning a new language for config.

### Problem 3: Code-as-config adds complexity

PKL's power — functions, conditionals, loops — is also its risk. Config should be **data**, not programs. When config can have bugs, you need tests for your config, and now you're maintaining two codebases.

### What about CUE?

We also evaluated [CUE](https://cuelang.org/), created by Marcel van Lohuizen (who helped build Borg, Kubernetes' predecessor). CUE is natively written in Go — no JVM build step — and it has strict types with powerful constraint validation.

But CUE's learning curve is steep. It uses lattice-based logic for type unification, which is elegant but unfamiliar to most engineers. We needed product engineers to write an agent config in 15 minutes, not learn a constraint logic language. TOML wins on approachability.

---

## Why TOML Won

[TOML](https://toml.io/) (Tom's Obvious, Minimal Language) hits the sweet spot:

### 1. Explicit types — no surprises

```toml
enabled = true          # boolean — explicit
country = "NO"          # string — always quoted
version = "1.0"         # string — always quoted
port = 8080             # integer — unquoted numbers are numbers
timeout = "30s"         # string — we parse durations in Go
```

No implicit type coercion. Strings are always quoted. Booleans are `true`/`false`, never `yes`/`no`. Numbers are numbers.

We skipped JSON entirely — configuration files need comments, and failing a deployment because of a trailing comma is a miserable developer experience. JSONC (JSON with comments) exists, but has no standardized Go parser and isn't widely adopted.

### 2. Flat structure, obvious nesting

```toml
[hitl]
always_allowed = ["web_search", "memory_*"]
denied_tools = ["rm", "kubectl delete"]

[tools.shell]
enabled = true
timeout = "30s"

[tools.github]
enabled = true
org = "stackgenhq"
```

No indentation games. Section headers (`[tools.shell]`) make hierarchy explicit. You can't accidentally re-parent a key by misaligning whitespace.

TOML isn't perfect here — deeply nested arrays of tables (`[[tools.custom.env]]`) get verbose and repetitive fast. If our configs were deeply nested, this would be painful. But agent configs are relatively flat by design (2-3 levels), so we rarely hit this edge case. The trade-off for explicit types was worth it.

### 3. Native Go support

```go
import "github.com/pelletier/go-toml/v2"

type AgentConfig struct {
    AgentName string     `toml:"agent_name"`
    Persona   Persona    `toml:"persona"`
    HITL      HITLConfig `toml:"hitl"`
    Tools     ToolsConfig `toml:"tools"`
}

func LoadConfig(path string) (*AgentConfig, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, err
    }
    var cfg AgentConfig
    err = toml.Unmarshal(data, &cfg)
    return &cfg, err
}
```

[`pelletier/go-toml/v2`](https://github.com/pelletier/go-toml/v2) decodes directly into typed Go structs with strict validation. It's faster and stricter than the older `BurntSushi/toml` — it's what Hugo uses. Misspelled keys, wrong types, missing required fields — all caught at parse time. No runtime surprises.

### 4. Config Builder UI

Because TOML is structured data (not code), we built a visual Config Builder that generates `.genie.toml` from a web form. Users click checkboxes and fill fields; the builder produces valid TOML.

This would be impossible with PKL (you'd need to generate valid source code) and fragile with YAML (indentation must be exact).

### 5. Diff-friendly

TOML diffs cleanly in pull requests:

```diff
 [hitl]
-always_allowed = ["web_search"]
+always_allowed = ["web_search", "memory_*", "read_*"]
 denied_tools = ["rm", "kubectl delete"]
```

No context collapse, no indentation shifts propagating through the file. Reviewers see exactly what changed.

---

## The Comparison

| Feature | YAML | PKL | TOML |
|---------|------|-----|------|
| Implicit typing | ❌ `yes`→`true`, `NO`→`false` | ✅ Static types | ✅ Explicit types |
| Indentation sensitivity | ❌ Whitespace is meaning | ✅ Braces | ✅ Section headers |
| Multi-line strings | ⚠️ 9 different syntaxes | ✅ Clean | ✅ `"""` triple-quote |
| Build step required | ✅ None | ❌ Needs PKL runtime | ✅ None |
| Go library support | ✅ Mature | ⚠️ Maturing | ✅ Mature (pelletier/go-toml/v2) |
| Visual builder possible | ⚠️ Fragile | ❌ Generates code | ✅ Generates data |
| PR review friendly | ⚠️ Indentation noise | ✅ Clean | ✅ Clean |
| Learning curve | ✅ Everyone knows it | ⚠️ New language | ✅ ~15 min |
| Ecosystem size | ✅ Massive | ❌ Small | ⚠️ Medium |

---

## What About HCL? We Went Further — We Built Our Own Terraform Provider

Terraform uses HCL, and we use Terraform for our platform's infrastructure-as-code layer. So why not HCL for agent config too?

The short answer: **different layers need different tools.**

TOML is for **runtime config** — what the agent loads at startup. But when we built Aiden — our multi-tenant agent orchestration platform — we realized we had a second, harder config problem: **how do you manage 20 agents across 5 teams with different policies, models, tools, and Slack channels — and keep it all version-controlled?**

Dashboards don't scale. You click "create agent" in a UI, and three months later nobody remembers who configured what, or why. There's no PR review, no rollback, no audit trail.

So we built a **custom Terraform provider** for Aiden.

### The GitOps Pattern

Teams define their agents, policies, and integrations as `.tf` files in a Git repo:

```hcl
provider "stackgen" {
  base_url = var.stackgen_url
  token    = var.stackgen_token
  project_id = var.project_id
}

# OPA policy — deny destructive shell commands
resource "stackgen_policy" "deny_destructive_shell" {
  name        = "deny-destructive-shell"
  description = "Deny run_shell when arguments look destructive"
  type        = "logic"
  rego_source = file("${path.module}/policies/deny-destructive-shell.rego")
}

# Agent definition — persona, tools, policies, and channel binding
resource "stackgen_agent" "sre_copilot" {
  name     = "sre-copilot"
  persona  = <<-EOT
    You are an SRE copilot. Help with incident triage, 
    runbook execution, and RCA drafting. Prefer safe, 
    read-only operations unless explicitly approved.
  EOT
  tools      = ["websearch", "webfetch", "run_shell", "math"]
  policy_ids = [stackgen_policy.deny_destructive_shell.id]

  platforms = jsonencode({
    slack = { channel = var.slack_channel_sre }
  })
}

# Platform-level settings — model provider, HITL, observability
resource "stackgen_setting" "model_provider" {
  name = "model_provider"
  config = {
    provider   = "anthropic"
    api_key    = var.anthropic_api_key
    model_name = "claude-sonnet-4-20250514"
  }
}

resource "stackgen_setting" "langfuse" {
  name = "langfuse"
  config = {
    public_key = var.langfuse_public_key
    secret_key = var.langfuse_secret_key
    host       = var.langfuse_host
    enabled    = "true"
  }
}
```

Now agent configuration follows the same workflow as any infrastructure change:

```bash
$ terraform plan
# stackgen_agent.sre_copilot will be created
# stackgen_policy.deny_destructive_shell will be created

$ terraform apply
# Apply complete! Resources: 2 added, 0 changed, 0 destroyed.
```

### Why This Matters

The Terraform provider gives us something no dashboard can:

| Capability | Dashboard | YAML files | Terraform |
|-----------|-----------|------------|-----------|
| Version control | ❌ | ✅ | ✅ |
| PR review for changes | ❌ | ✅ | ✅ |
| `plan` before `apply` | ❌ | ❌ | ✅ |
| Drift detection | ❌ | ❌ | ✅ |
| State management | ❌ | ❌ | ✅ |
| Rollback | Manual | Git revert | `terraform apply` to previous state |
| Cross-resource references | N/A | Manual IDs | `policy.id` references |
| Secret management | Varies | ❌ (secrets in files) | ✅ (Vault, env vars) |

The killer feature is **`terraform plan`**. Before changing any agent's persona, tools, or policies, you see exactly what will change. For a platform where misconfigured AI agents can run shell commands on production servers, "see before you apply" is non-negotiable.

### Two Layers, Two Formats

The final architecture has two **parallel** config paths, each serving a different deployment model:

```
CLI / Local Developer Path:
┌─────────────────────────────────────────┐
│  TOML (.genie.toml)                     │
│  Single-user, single-agent              │
│  Developer writes config locally        │
│  → Agent binary reads at startup        │
│  → Parsed directly into Go structs      │
└─────────────────────────────────────────┘

Platform / Multi-Tenant Path:
┌─────────────────────────────────────────┐
│  Terraform (HCL) → Aiden REST API       │
│  Multi-tenant, multi-agent              │
│  Ops teams define agents via GitOps     │
│  → terraform apply → API → PostgreSQL   │
│  → Worker bootstraps agents from DB     │
└─────────────────────────────────────────┘
```

These are not a pipeline — one doesn't generate the other. TOML is for the CLI agent: a developer working locally writes a `.genie.toml`, and the agent binary parses it at startup. The platform path is entirely separate: `terraform apply` calls the Aiden REST API, which persists agent definitions to PostgreSQL. When the worker process starts (or when an agent is created/updated), the agent router loads configurations from the database and bootstraps live agent instances — no TOML involved.

**Why two paths?** The CLI agent is a single binary for one developer. The platform manages 50+ agents across multiple teams. They have fundamentally different lifecycle requirements: file-based config for local simplicity, API-driven config for enterprise governance. The agent runtime is the same Go module in both cases — only the config source differs.

---

## Lessons Learned

1. **Config format is an API contract.** Once users adopt it, changing is expensive. Choose carefully upfront.

2. **Implicit behavior is the enemy of production reliability.** YAML's implicit typing has caused more outages than we'd like to admit across the industry. Explicit is always better.

3. **Config should be data, not code.** When config can have bugs, you need tests for config. That's a complexity trap.

4. **Parse-time validation beats runtime validation.** TOML + Go structs catch errors when the agent starts, not when a tool call hits a bad config path at 3 AM.

5. **The "everyone uses it" argument is weak.** Everyone used XML before JSON. Everyone used JSON before YAML. Evaluate on merits.

---

## What's Next

In the next post, I'll cover how we went from a `single "Hello World" commit` to 52 Go packages and 76K lines of code in 4 months — and the architecture patterns that made that sustainable.

---

*What config format does your agent platform use? I'm genuinely curious about the trade-offs others are making. Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

---
layout: post
title: "Time-based AI agent policies with OPA"
date: 2026-10-25 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 85
description: "Business hours and freeze-window Rego for AI agent tool permissions using input.timestamp and OPA time builtins."
image: /assets/images/diagrams/oct/time-window-clock.svg
tags: [ai-agents, opa, rego, time-based-policy, guardrails, aiden]
permalink: /blog/time-based-ai-agent-policies-opa/
faqs:
  - question: "How do you write time-based AI agent policies with OPA?"
    answer: "Parse input.timestamp with time.parse_rfc3339_ns, then use time.clock and time.weekday. Allow-list windows or deny change actions during freeze hours."
  - question: "Should policies call time.now_ns or use the factsheet timestamp?"
    answer: "Prefer input.timestamp from the platform factsheet so evaluations and opa test fixtures stay deterministic. time.now_ns is useful for skew checks when you also have a trusted clock."
  - question: "What is a tool-hours allowlist?"
    answer: "A logic policy that defaults to deny and only sets allow inside named UTC windows, for example morning and afternoon with a lunch gap."
  - question: "What is a change freeze policy?"
    answer: "A policy that denies deploy, apply, and similar actions during weekday business hours while still allowing reads and status."
---

Same agent. Different risk by the clock.

Time-based AI agent policies use OPA’s time builtins so tool permissions follow business hours, lunch blocks, and change freezes. Official reference: [OPA time builtins](https://openpolicyagent.org/docs/policy-reference/builtins/time). You already have [authorize](/blog/authorize-ai-agent-tool-calls-opa/) and [Terraform attach](/blog/manage-ai-agent-policies-terraform/). This post adds the clock.

**Key takeaways**

- Drive windows from `input.timestamp`, not only wall clock, so tests stay fixed.
- Allow-list hours and freeze windows are different postures: one denies everything off-hours; the other denies change actions on weekdays.
- Put fixed timestamps in `opa test` fixtures so CI does not depend on wall clock.
{: .key-takeaways}

---

![UTC allow morning deny lunch allow afternoon deny off-hours](/assets/images/diagrams/oct/time-window-clock.svg)

*Parse the factsheet clock. Do not invent a second time source in Rego if the platform already sent one.*

## Architecture: time is an input field, not a prompt

Time-based authorization is still the same PDP/PEP loop from [authorize](/blog/authorize-ai-agent-tool-calls-opa/). The only change is which factsheet fields Rego reads.

| Source | Use |
|--------|-----|
| `input.timestamp` | Platform factsheet clock (RFC3339). Prefer this for business hours and freezes so `opa test` fixtures stay fixed. |
| `time.parse_rfc3339_ns` | Turn that string into nanoseconds for `time.clock` / `time.weekday`. |
| `time.now_ns` | Wall clock at evaluate time. Useful for skew or staleness checks; avoid as the only clock in unit tests. |

Two postures share that architecture:

1. **Allow-list hours** (`default allow := false`): every tool is denied unless the hour falls in a window.
2. **Change freeze** (`default allow := true`): most tools pass; change actions fail during weekday business hours.

Both are `logic` policies. Attach them like any other Rego. They do not need a special runtime mode.

## Why prompts fail at “only during business hours”

A persona line that says “do not deploy after 5pm” is advice. An agent investigating an outage at 02:00 will still reach for `kubectl apply` if that tool is available. Time has to be a field on the enforcement input, not a hope in the system prompt.

## Tool-hours allowlist

Opt-in pattern from solutions `tool-hours-allowlist.rego`: default deny; allow only in morning and afternoon UTC windows; lunch is blocked.

```rego
package policy

import rego.v1

default allow := false

factsheet_ts_ns := time.parse_rfc3339_ns(ts) if {
  ts := object.get(input, "timestamp", "")
  ts != ""
}

hour := time.clock(ns)[0] if {
  ns := factsheet_ts_ns
}

in_morning_allow_window if {
  hour >= 9
  hour < 12
}

in_afternoon_allow_window if {
  hour >= 14
  hour < 17
}

allow if {
  in_morning_allow_window
}

allow if {
  in_afternoon_allow_window
}
```

Lab: `samples/aiden-opa-policies/03-business-hours/` with tests for mid-morning, lunch, afternoon, and evening.

## Change freeze window

Different question: during Mon-Fri 09:00-17:59 UTC, block *change* actions, not every tool.

```rego
package policy

import rego.v1

default allow := true

change_actions := {"deploy", "apply", "release", "helm_upgrade", "rollout"}

during_business_hours if {
  ns := time.parse_rfc3339_ns(input.timestamp)
  time.weekday(ns) in {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"}
  hour := time.clock(ns)[0]
  hour >= 9
  hour < 18
}

allow := false if {
  during_business_hours
  input.tool.arguments.action in change_actions
}

allow := false if {
  during_business_hours
  endswith(input.tool.name, "_execute_command")
  contains(lower(input.tool.arguments.command), "kubectl apply")
}
```

Lab: `samples/aiden-opa-policies/04-freeze-and-hitl/freeze/`.

## How do you verify?

```bash
cd samples/aiden-opa-policies
opa test 03-business-hours
opa test 04-freeze-and-hitl/freeze
```

Use fixed RFC3339 strings in tests (`2026-07-16T13:15:00Z` for lunch). Do not call `time.now_ns` inside unit tests if you want green CI at midnight.

Attach either policy with the Terraform pattern from the [previous post](/blog/manage-ai-agent-policies-terraform/): `type = "logic"`, `file(...)` for Rego, then `sg_agent_policy_attachment`.

Next: when to hard deny versus ask a human. [Guardrails and human approval for AI agent tool calls](/blog/ai-agent-guardrails-human-approval/).

---

*Freeze windows belong in Rego, not in a sticky note on the on-call channel.* Labs: [samples/aiden-opa-policies](https://github.com/sks/sks.github.io/tree/main/samples/aiden-opa-policies). To attach on a live tenant: [free account](https://app.stackgen.com/) then [personal access token](https://app.stackgen.com/app/settings/personal-access-tokens).

> Free to try: [create an account](https://app.stackgen.com/), then create a [personal access token](https://app.stackgen.com/app/settings/personal-access-tokens) for Terraform. StackGen / Aiden: [app.stackgen.com](https://app.stackgen.com/).

Previous: [Manage AI agent policies as code with Terraform](/blog/manage-ai-agent-policies-terraform/). Next: [Guardrails and human approval for AI agent tool calls](/blog/ai-agent-guardrails-human-approval/).

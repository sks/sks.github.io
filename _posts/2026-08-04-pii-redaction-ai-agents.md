---
layout: post
title: "PII Redaction for AI Agents — Two Views, One Trace"
date: 2026-08-04 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 32
description: "PII redaction for AI agents needs two views: protected model history and authorized operator visibility when debugging tool calls."
image: /assets/images/og-governance.png
tags: [ai-agents, pii, privacy, security, observability, audit, aiden, production]
permalink: /blog/pii-redaction-ai-agents/
---

**PII redaction for AI agents** is usually treated as one sanitized transcript. We redacted sensitive values from an agent’s working history.

The privacy control did its job. Identifiers became placeholders before the conversation returned to the model. The agent could reason about structure without repeatedly seeing the original value.

Then an operator opened the live trace to debug a failed tool call.

The tool arguments contained placeholders too.

The operator could see that a lookup failed, but not which account, email, or resource the agent actually tried to use. The trace was safe and nearly useless.

> **PII redaction for AI agents has two audiences with different needs: the model and the authorized human operator. Treating them as the same audience breaks either privacy or debuggability.**

---

## The Wrong Mental Model: One Sanitized Transcript

Traditional log redaction often assumes one output: sanitize a message, then send the sanitized version everywhere.

Agent systems reuse the same event in several places:

- Model conversation history
- Live operator interfaces
- Audit records
- Retry and replay paths
- Analytics
- Support exports

Those destinations do not have the same trust boundaries.

The model should receive the least sensitive context required to complete the task. An authorized operator debugging a specific run may need to see the actual target used in a tool call. A broad analytics pipeline may need neither.

One sanitized transcript cannot satisfy all three safely.

---

## The Two-View Principle

The useful abstraction is not “redacted or unredacted.” It is **purpose-bound views**.

| View | Audience | Data state |
|------|----------|------------|
| Model | The LLM and agent loop | Stable placeholder — enough to recognize recurrence, no raw value |
| Operator | Authorized human debugging a run | Original value restored at the presentation boundary for that invocation |
| Broad audit / analytics | Long-lived, widely queried stores | Remains redacted unless a stronger compliance need justifies restricted storage |

The same underlying event can therefore render differently depending on who is asking and why.

---

## Rehydrate Late, Not Early

The safest place to restore a protected value is as close as possible to the authorized viewer.

If rehydration happens before events are written back into session history, the next model turn may receive the sensitive value again. If it happens in a shared event bus, downstream consumers may see data they never requested. If it happens in permanent logs, a temporary debugging need becomes indefinite retention.

Late rendering keeps the boundary narrow:

1. Working history remains protected.
2. The event reaches an authorized presentation path.
3. The presentation layer restores only values that the viewer may access.
4. Other consumers continue receiving the protected form.

This is the privacy equivalent of preparing different API responses from one domain object. The stored truth and the displayed view do not have to be identical.

---

## Placeholders Need Identity Without Meaning

A useful placeholder must let the system recognize recurrence without revealing the underlying value.

The agent may need to know:

- This is the same protected identifier seen earlier
- These are two different protected identifiers
- A tool result refers to the value supplied by the operator

It does not need the original email address or account number to make those distinctions.

At the same time, placeholders should not become a new identifier that leaks across unrelated sessions. Correlation scope matters. A value that is stable forever can become tracking data even when it is not human-readable.

The safe principle is **minimum useful correlation**:

- Stable enough for the current task
- Scoped tightly enough to avoid cross-context tracking
- Meaningless without access to the protected mapping

In practice that means keeping the mapping behind an access-controlled store, scoping markers to the run or session that needs them, and refusing to mint forever-global stand-ins for every sensitive field. The engineering goal is recurrence within the task — not a second customer ID that travels the platform.

---

## Tool Arguments Are Where Privacy Meets Debugging

Agent tool calls are often the most important part of a trace.

When a lookup fails, the operator asks:

- Did the agent use the correct account?
- Was the resource name malformed?
- Did a copied identifier include extra characters?
- Did the model confuse two customers?

If every argument is replaced with an opaque marker, the operator cannot distinguish a bad tool from a bad argument.

But showing all raw arguments to every observer is also wrong. Tool calls can contain credentials, customer data, internal URLs, or incident details.

The answer is not blanket visibility. It is field-aware, role-aware presentation:

- restore only approved categories,
- never restore secrets as a debugging convenience,
- preserve redaction for unauthorized viewers,
- and record that a protected value was revealed.

Operator visibility is a privileged action, not the absence of privacy.

---

## Redaction Must Survive Streaming

Agent interfaces frequently stream tool arguments in pieces. A protected value may arrive across multiple fragments rather than as one complete event.

That creates awkward failure modes:

- one fragment is restored while another remains hidden,
- the UI briefly displays a raw prefix before redaction catches up,
- or the final assembled call differs from what the model history stores.

The public lesson is simple: apply privacy rules to both incremental events and the completed event. Test what the operator sees during the stream, not only the final object.

[Observability for AI agents](/blog/observability/) is only trustworthy when the trace preserves both truth and policy throughout the event lifecycle.

---

## Do Not Confuse PII With Secrets

An authorized support engineer may have a legitimate reason to see a customer identifier. They almost never need a bearer token or private key.

Redaction categories need different reveal policies:

- **Identifiers:** sometimes visible to scoped operators.
- **Personal data:** visible only with a defined support or operational need.
- **Credentials and secrets:** remain hidden; use references, rotation, or vault audit instead.
- **Regulated data:** follow retention and access rules beyond application-level convenience.

“Rehydrate for humans” is not a universal reveal button.

---

## Audit the Reveal, Not Just the Tool Call

If the system can restore protected values, that access deserves its own audit trail.

Record:

- who requested the view,
- which run they were authorized to inspect,
- what category of value was revealed,
- and when the access occurred.

Avoid copying the revealed value into the audit event itself. The audit should prove access happened without becoming another sensitive-data store.

This is part of [defense in depth for tool-wielding agents](/blog/defense-in-depth/): privacy controls must cover observability and support paths, not only model prompts.

---

## Lessons Learned

1. **There is no single transcript.** Model, operator, audit, and analytics views have different trust boundaries.
2. **Rehydrate at the edge.** Restore protected values only for an authorized viewer, as late as possible.
3. **Correlate minimally.** Placeholders should preserve task-local identity without enabling broad tracking.
4. **Treat tool arguments as privileged.** They are essential for debugging and dangerous to expose indiscriminately.
5. **Test streaming states.** Privacy failures can appear before the final event is assembled.
6. **Secrets stay secret.** Human debuggability does not justify revealing credentials.
7. **Audit sensitive reveals.** Visibility into protected data is itself an operational event.

Good agent privacy does not make the system impossible to debug. Good agent observability does not make every sensitive value public. The design has to hold both truths at once.

---

## Related reading

- [Observability for AI agents](/blog/observability/)
- [When your AI agent scorecard lies](/blog/when-agent-observability-lies/)
- [Defense in depth for tool-wielding agents](/blog/defense-in-depth/)
- [The HITL paradox](/blog/hitl-paradox/)

---

**Acknowledgments.** Built with the [StackGen Aiden team](/about/) — the engineers behind the agent runtime and platform this series describes.

*How do you preserve operator debuggability without feeding sensitive data back into the model? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

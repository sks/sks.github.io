---
layout: post
title: "Ungrounded Synthesis Must Read as Hypothesis"
date: 2026-07-24 14:00:00 -0700
series: "Service Rendered Efficiently"
series_order: 8
description: "When grounding fails, the primary chat bubble must show hypothesis language — not a confirmed RCA with a quiet side note."
image: /assets/images/og-default.png
tags: [sre, ai-agents, service, incident-response, aiden, rca, verification]
permalink: /blog/ungrounded-synthesis-as-hypothesis/
faqs:
  - question: "What should happen when an AI RCA fails grounding?"
    answer: "Deliver hypothesis language as the primary message with a clear grounding-failed banner. Do not leave the confident invented narrative as the main bubble with a quiet annotation."
  - question: "Why is fail-closed delivery a service concern?"
    answer: "On-call trusts the primary card. A verification pass that only lives in logs does not protect operators from acting on invented entity names."
  - question: "How does this relate to curiosity before confidence?"
    answer: "Soft prompts do not stop bad RCA. Hard gates refuse confidence; fail-closed delivery is how that refusal shows up in Slack and chat."
---

AI-assisted RCA needs a fail-closed delivery layer, not just a verification pass in logs.

*The incident patterns below are composite and anonymized. Counts are rounded. Names, IDs, and infrastructure details are fictionalized to protect customer confidentiality.*

---

## TL;DR

- Post-check grounding can reject a confident-sounding answer
- Primary chat / Slack bubble must **downgrade to hypothesis**
- Banner + corrected body as the main message — not a side annotation
- Operators must never see “confirmed outage in checkout-svc” when the entity was invented

### Explain like I'm five

If the teacher finds you made up a character in your book report, the grade on the front of the paper should say “guess,” not “correct,” with a tiny note on the back.

---

## The failure mode

The agent emits a fluent root cause. A grounding checker (`is_factual: false`) finds entity names absent from tool evidence. If the product only attaches a quiet correction, humans skim the confident headline and move on.

Service craft means the **delivery** matches the verification result. Same spirit as [curiosity before confidence](/blog/curiosity-before-confidence/) and [be creative, don't invent](/blog/be-creative-do-not-invent/).

---

## If you lead an SRE team

- Reject any workflow where grounding failure is invisible in the primary UI
- Train reviewers: hypothesis banners are success of the safety layer, not embarrassment
- Prefer explicit Unknowns over false confidence every time

## If you ship the agent platform

- Primary delivery modes for grounding failure: hypothesis / corrected body
- Cache and chat history must store the downgraded form
- Do not leave the invented narrative as the default render with a footnote humans miss

---

## Related

- Previous: [Deliver Findings at the Budget Cap](/blog/deliver-findings-at-the-budget-cap/)
- Next: [Empty Query ≠ Absent Signal](/blog/empty-query-not-absent-signal/)
- [Curiosity before confidence](/blog/curiosity-before-confidence/)
- [Evidence-based verification](/blog/evidence-based-verification/)

---

**Acknowledgments.** Grounding delivery lessons from fail-closed verification in the Aiden runtime. Patterns composite.

*Building AI for incident triage without the demo theater? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

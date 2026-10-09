---
layout: post
title: "Ungrounded Synthesis Must Read as Hypothesis"
date: 2026-07-24 14:00:00 -0700
series: "Service Rendered Efficiently"
series_order: 8
description: "If a check finds unsupported details in an AI-written incident analysis, correct the primary message rather than hiding the warning in a note."
image: /assets/images/og-default.png
tags: [sre, ai-agents, service, incident-response, aiden, rca, verification]
permalink: /blog/ungrounded-synthesis-as-hypothesis/
faqs:
  - question: "What should happen when an AI RCA fails grounding?"
    answer: "Show a prominent notice and a corrected primary message distinguishing observations from hypotheses. Remove unsupported names rather than preserving a confident claim with a quiet annotation."
  - question: "Why is fail-closed delivery a service concern?"
    answer: "Responders often act on the primary message. A failed check recorded only in logs leaves unsupported names visible in the main card."
  - question: "How does this relate to curiosity before confidence?"
    answer: "Submission checks can reject unsupported confidence. Delivery should show that result in the main Slack or chat message rather than only in logs."
---

An AI-written root-cause analysis (RCA) may sound certain even when its service names or claims cannot be traced to the data it used. A grounding check compares the answer with tool results; if it fails, the message shown to responders must change, not merely the internal log.

*The incident patterns below are composite and anonymized. Counts are rounded. Names, IDs, and infrastructure details are fictionalized to protect customer confidentiality.*

---

## Make the correction visible

A failed grounding check should prevent the original confident wording from appearing as the main chat or Slack message. Show a prominent notice and a corrected body: what was observed, what remains a hypothesis, and which names could not be verified. The check itself can miss errors, so a pass is not proof of correctness.

---

## The failure mode

For example, suppose the agent names `checkout-svc` as the failed service, but the returned records contain no such entity. A checker returns `is_factual: false`. If the original headline remains the main message and the correction is tucked into a note, a reader may still act on the invented name.

The delivered message should reflect the verification result. This is related to [curiosity before confidence](/blog/curiosity-before-confidence/) and [be creative, don't invent](/blog/be-creative-do-not-invent/): unsupported details should remain uncertain or be removed.

![Grounding flow from candidate synthesis to record check, with unsupported names downgraded in delivered and cached messages.](/assets/images/diagrams/july-investigation/ungrounded-synthesis-as-hypothesis.svg)

*Diagram: The upper arrows compare a candidate narrative to returned records; the lower path shows a failed name check changing the primary message and stored copies to hypothesis wording, or withholding the claim.*

---

## If you lead an SRE team

- Reject any workflow where grounding failure is invisible in the primary UI
- Tell reviewers what the hypothesis notice means: the checker found a gap, not necessarily that the entire investigation was useless
- Keep unknowns visible, then use further checks or human review for decisions with consequences

## If you ship the agent platform

- Render a corrected primary body with hypothesis language when grounding fails; if a safe rewrite is impossible, withhold the unsupported claim
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

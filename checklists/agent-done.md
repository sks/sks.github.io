---
layout: page
title: “Is the agent task done?” checklist
permalink: /checklists/agent-done/
description: "Shareable checklist for AI agent completion — independent checks, typed evidence, budgets, and mutation safety. No proprietary schemas."
faqs:
  - question: "How do you know an AI agent task is actually done?"
    answer: "Treat completion as a product surface: require an independent check with typed tool outcomes, goal-scoped activation so cheap turns stay cheap, and capped retries that do not re-fire unsafe writes."
---

Use this when an agent says “done” and a human action depends on it. Full essay: [Is the Task Actually Done?](/blog/is-the-task-actually-done/).

## Before you accept “done”

- [ ] **Not self-graded** — same model, same turn, same incentive to stop is not enough  
- [ ] **Judge sees evidence** — typed tool outcomes (success vs invoked-but-failed), not only the essay  
- [ ] **Goal-scoped** — completion checks fire when stakes are high, not on every greeting  
- [ ] **Retry budget** — capped attempts and spend; fail open to best candidate if the check cannot run  
- [ ] **Mutation ledger** — retries do not blindly re-run writes  
- [ ] **Human next step is safe** — closing a ticket / paging down assumes the work finished  

## Red flags

- “Done” because a submit tool was *called* (even if it failed)  
- Always-on judges burning tokens on “hi”  
- Infinite repair loops when the verifier disagrees  

## Related

- [Evidence-gated RCA checklist](/checklists/evidence-gated-rca/)  
- [Demo to deploy — receipts](/blog/demo-to-deploy-receipts/)  
- [SRE on-call starter pack](/start/sre-on-call/)  

{% include subscribe.html %}

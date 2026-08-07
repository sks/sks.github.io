---
layout: post
title: "Aiden the Hard Way: Vague GitHub Issues to Review PRs"
date: 2026-08-07 18:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 38
description: "Why GitHub Project board SDLC with Aiden feels hard when you wire every sg_* by hand — and the short OpenTofu module path that skips the assembly."
image: /assets/images/og-default.png
tags: [ai-agents, github, workflows, aiden, terraform, opentofu, sdlc, beginners]
permalink: /blog/from-vague-github-issue-to-pr-with-aiden/
faqs:
  - question: "Can an AI agent run a GitHub Project board SDLC?"
    answer: "Yes, if you keep the board as the source of truth, write evidence as issue comments, and treat Status hops as one step at a time — with humans merging any PR."
  - question: "How do you configure Aiden agents with Terraform or OpenTofu?"
    answer: "Aiden ships a Terraform/OpenTofu provider. You can declare agents, workflows, webhooks, schedules, and policies as sg_* resources — or consume a packaged module that creates those for you."
  - question: "Why did dragging a Project card not trigger my agent webhook?"
    answer: "Repo Issues webhooks fire on issue events, not on Projects v2 Status changes. You need a different signal — for example, a short poll of the board — if humans drag cards."
  - question: "Should the agent merge the PR?"
    answer: "No. Opening a reviewable PR is enough for a first loop. Merge stays a human decision."
---

GitHub Projects are great until the board fills with cards that say “make nav better” and nothing else.

Humans then do unpaid product work in the comments: turn the wish into acceptance criteria (**Specify**), look at the repo (**Research**), write a plan someone could implement (**Plan**), maybe open a PR (**Implement**).

I wanted a boring demo that still felt magical: open a **vague** issue, watch it land on a Project board, and let [Aiden](/blog/aiden-platform/) walk Specify → Research → Plan — then open a **review PR**. No second orchestration product. No “trust me, the agent did homework” without a comment on the issue.

We dogfooded it on this blog’s repo. That closed with [navigation polish PR #31](https://github.com/sks/sks.github.io/pull/31) — agent opened, human merged, Status hopped to **Done**.

---

## Best practices for AI kanban automation

That is [bring-up discipline](/blog/bring-up-agent-workflows-like-hardware/) applied to a kanban:

| Do | Don’t |
| -- | ----- |
| One issue per run | Boil the ocean across the whole board |
| Comment evidence on the issue | Keep findings only in chat |
| Hop Status one column at a time | Jump Specify → Done in silence |
| Open a PR for humans to merge | Auto-merge |

---

## The easy path (follow-up)

If you already have an Aiden tenant, you do **not** need to assemble every secret, model, agent, workflow, webhook, and schedule by hand.

**[Aiden the Easy Way](/blog/aiden-the-easy-way/)** is the adoption guide: all-in-one wrapper, composable module, webhook registration, and apply loop for [sks/aiden-github-project-assistant](https://github.com/sks/aiden-github-project-assistant) (`v0.1.0`).

**Easy Way** = consume the module. **Hard Way** (this post) = understand why those pieces exist.

---

## Why the Hard Way feels tiring

Aiden is not “paste a system prompt into a dashboard.” Agents, workflows, policies, webhooks, and schedules are first-class objects — planable and drift-detectable via the [StackGen Terraform/OpenTofu provider](/blog/terraform-config/).

That is a feature for production. It is also why a naive “show me everything” tutorial feels like eight layers of homework:

1. Tenant + provider
2. Model secret / provider / named model
3. GitHub vault + integration (Projects scopes matter)
4. Guardrails so merge stays human
5. Agent + budget + policy attachment
6. Runbook + workflow stage binding
7. Issues webhook
8. Status poll (because card drag is not an Issues event)

You can wire all of that as flat `sg_*` resources. I did — once — so the module could exist. You should not have to do it for every board.

---

## Lessons that still matter (even with the module)

### Issue opened ≠ card dragged ≠ PR merged

Repo Issues deliveries show `opened` and `ping`. Dragging a Projects v2 card is **not** an `issues` event. Merging a PR is not either.

Match the trigger to the UI gesture:

| Gesture | Signal |
|---------|--------|
| Issue opened | Issues webhook |
| Card drag | Short Project status poll |
| PR merged | Pull request webhook (poll as fallback) |

### Receipts beat chat transcripts

A good stage comment looks like this:

```markdown
### Aiden project assist — Specify

**Issue:** #29
**Status (before):** Specify
**Status (after):** Research
**auto_advance:** true

#### Output
Goal, in/out of scope, acceptance criteria, open questions…

#### Next human step
Review, answer questions, or let the chain continue.
```

If it is not on the issue, it did not happen for the board.

### CLI flag semantics are product

For `gh api`, capital **`-F`** expands `@file`. Lowercase `-f` posts the literal path string. Same class of bug as putting `#42` on a shell command line — everything after `#` disappears.

```bash
gh api "repos/$OWNER/$REPO/issues/$N/comments" -F body=@assist_comment.md
```

### Merge stays human

Autonomy to open a PR. Accountability to land it. Done is a separate hop after a human merges.

---

## What a good run looks like

1. Vague issue opens → lands under Specify (or the agent adds it).
2. Specify / Research / Plan comments appear; Status hops one column at a time.
3. Agent opens a review PR after Plan (when implement is enabled).
4. Human merges → Done comment + Status / issue close.

Our dogfood closed with [PR #31](https://github.com/sks/sks.github.io/pull/31).

---

## Takeaways

1. **Package the capability** — modules for the easy path; `sg_*` for the hard path.
2. **Order still matters** under the hood — secrets → models → integrations → agent → workflow → triggers.
3. **Receipts on GitHub** beat chat.
4. **Wire every gesture you care about** — issues, status poll, PR merge.
5. **Merge stays human.**

**Read next:** [Aiden the Easy Way](/blog/aiden-the-easy-way/) · [Terraform for Agent Configuration](/blog/terraform-config/) · [How to Debug Multi-Step AI Agent Workflows](/blog/bring-up-agent-workflows-like-hardware/) · [AI Agent Runtime vs Platform](/blog/aiden-platform/)

Module: [sks/aiden-github-project-assistant](https://github.com/sks/aiden-github-project-assistant)

---

*Building AI agents that leave receipts on the systems you already use? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> 🚀 **We're building AI-powered SRE at StackGen.** If you're tired of 3 AM pages and want AI agents that triage incidents, run diagnostics, and draft RCA reports — check out [ai.stackgen.com](https://ai.stackgen.com) and try our new SRE offering.

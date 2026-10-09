---
layout: post
title: "Terraform for Agent Configuration — Infrastructure as Code Meets AI Governance"
date: 2026-06-29 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 10
description: "Terraform for AI agent configuration — why we use infrastructure as code, not YAML dashboards, to govern production agents."
image: /assets/images/og-iac.png
tags: [terraform, iac, gitops, ai-agents, governance]
---

An agent's configuration determines which tools it can call, which model it uses, what it can spend, and which approvals it needs. In our platform, those settings became consequential enough that we moved them from a dashboard to Terraform, an infrastructure-as-code (IaC) tool that compares a declared desired state with the current one before applying changes.

This is a choice for our multi-team deployment, not an argument that every local agent needs a Terraform provider.

---

## Why the Dashboard Stopped Working for Us

A form was convenient when we had one agent. As teams and agents multiplied, our dashboard workflow made it hard to answer who changed a tool list, review changes before deployment, recover a known configuration, spot drift from intended settings, or test in staging. Those were shortcomings of our initial workflow, not inherent properties of every dashboard; a dashboard can have audit and review features too.

We built a custom Terraform provider to manage agent personas, tool attachments, governance policies, model routing, budgets, notification channels, and references to secrets. The provider maps those resources to the platform's configuration rather than asking operators to reproduce settings by hand.

## What a Change Looks Like

Agent configuration and its policies live in Git. An engineer opens a pull request (PR), continuous integration (CI) runs `terraform plan`, reviewers inspect the proposed changes, and merging triggers an apply. Git history and Terraform's state record help reconstruct what changed. This is a GitOps workflow: versioned configuration is proposed and reviewed in Git before deployment.

A plan is particularly valuable when adding a production tool or changing an approval policy: it shows the proposed diff before the update. It is not a guarantee that nothing else can change. Provider behavior, values not known until apply, concurrent updates, and differences between plan and apply environments still matter. Reviewers need to understand what the provider will do, not just read a reassuring summary.

If an agent is already working in a durable workflow, we keep the configuration it started with for that execution. A new configuration takes effect on the next invocation. Without that boundary, an active investigation could gain or lose a tool midway through its task.

![Git pull request goes through Terraform plan, review, and apply; a running task keeps its starting configuration while a new invocation uses the applied configuration.](/assets/images/diagrams/june-operations/terraform-config-flow.svg)

The invocation boundary matters: an applied tool or policy change does not rewrite the configuration of a task already running.

## References Between Resources

Terraform's dependency graph lets an agent refer to a governance policy by its resource ID. The policy can be created before the agent that uses it. A plan can also expose a proposed deletion of a referenced policy before apply. That is useful, though the provider and platform still need to validate references and handle external changes; a graph alone does not prevent every orphaned reference.

## Secrets Need Separate Care

Model-provider keys and integration tokens come from secret-management integrations rather than committed configuration files. Keeping them out of Git is only part of the job: Terraform state and plan output may still contain sensitive values depending on the provider and backend. We configure storage accordingly and avoid claiming that Terraform automatically keeps secrets out of persisted state.

## Compared with Other Approaches

| Concern | Our initial dashboard | Plain Git-managed config | Terraform provider |
|---------|-----------------------|--------------------------|--------------------|
| Review and history | Limited in our setup | PR and Git history | PR, Git history, and plan |
| Preview | Form changes had no plan | Diff of files | Resource-level proposed changes |
| Drift checks | Not built in | Requires separate comparison | Plan can expose managed-resource drift |
| Dependencies | IDs managed manually | Usually manual references | Dependency graph and provider references |
| Rollback | Manual | Revert a commit | Revert and apply, subject to current state |
| Secrets | Depends on implementation | Requires care | Still requires careful provider and state configuration |

Terraform did not remove operational responsibility. It made reviewable changes and dependencies practical for our agents across teams. A smaller deployment may reasonably choose validated config files or a dashboard with strong change controls instead.

## What We Would Do Again

Treat tool and policy changes as production changes, preview them, and give reviewers a path to test and roll back. Separate local developer convenience from team-level governance. We migrated after dashboard-driven changes caused avoidable misconfigurations; earlier review could have helped, but we cannot know that it would have prevented every incident.

---

*How do you review changes to production agent tools and policies? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> **StackGen builds AI-assisted SRE (site reliability engineering) tools.** Our offering at [ai.stackgen.com](https://ai.stackgen.com) supports incident triage, diagnostics, and draft root-cause analyses.

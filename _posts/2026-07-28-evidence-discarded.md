---
layout: post
title: "AI Agent Root Cause Analysis — Evidence Discarded After the Lead"
date: 2026-07-28 17:45:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 28
description: "An incident agent can collect a useful metric lead and omit it from the final report; check time windows, unrelated alerts, and transcript-to-summary consistency."
image: /assets/images/og-evidence-rca.png
tags: [ai-agents, sre, root-cause-analysis, incident-response, on-call, evaluation, prompt-engineering, aiden, production, observability]
permalink: /blog/evidence-discarded/
---

A site reliability engineering (SRE) agent—software that helps investigate service incidents—can also fail after finding a useful lead. In an internal test, the agent collected a concentrated metric signal, then concluded that the case could not be investigated. That is distinct from inventing a root cause. The signal supported further investigation, not necessarily a confirmed root-cause analysis (RCA).

The alert card was real. The rule fetch returned the right title and triage queries. A broadened metrics window lit up a clear failure concentration near fire time: integration, environment, reason code, path. A responder reviewing the transcript would at least have had a reason to inspect the corresponding logs (event records).

The agent focused instead on a fingerprint miss and an unrelated firing alert in the same Grafana monitoring view. It asked for a new UID (unique alert-rule identifier) and a Loki data source (a place to query logs). The final Summary repeated the card’s Explore checklist but omitted the metric lead.

**This was not an empty-data case: the report dropped an observed lead.**

That is a different epistemic bug than invention under emptiness, and a different one than [closing RCA before homework](/blog/curiosity-before-confidence/). Invention fills gaps with fiction. Premature confidence skips digs. **Abandon-after-lead** describes that loss between collection and summary. A mismatch in a secondary alert identifier or a quiet current window may warrant a check, but neither automatically erases a relevant measurement from the fire-time window. For [AI agents for SRE](/topics/ai-agents-sre/), the tool log and final report should be reconcilable.

---

## What the transcript showed

The alert rule matched the pasted card. A later query covering the alert’s fire time returned a cluster of failures grouped by integration, environment, reason code, and path. The agent then focused on a missing fingerprint (an identifier for a particular firing alert), an unrelated peer alert, and a log query missing its data-source selection. Its summary repeated the checklist instead of reporting the metric lead and its limits. A lead belongs in the summary even if logs are unavailable and the cause remains unconfirmed.

---

## What is abandon-after-lead in AI agent RCA?

**Abandon-after-lead** means an AI investigator:

1. Successfully loads the alert rule that matches the pasted card  
2. Collects a non-empty metric or log concentration (the lead)  
3. Then closes **undetermined** without mentioning that result—perhaps after a fingerprint miss, an unrelated co-firing alert, a wrong time window, or a missing data-source selection—and asks the operator for a new UID or repeats the checklist

An honest “unknown” can still include a real but inconclusive lead. The problem here is claiming there was no usable evidence while omitting an observed result. Metrics are numeric measurements; logs are event records, and one can be informative even when the other is unavailable.

Contrast with sibling failure modes in this series:

| Failure | One-liner | Post |
| --- | --- | --- |
| Invent under emptiness | Fill gaps with fiction | [Be creative. Don’t invent.](/blog/be-creative-do-not-invent/) |
| Close before checks | Confidence without attempting required checks | [Curiosity before confidence](/blog/curiosity-before-confidence/) |
| Fake done | Submit without a completion check | [Is the task actually done?](/blog/is-the-task-actually-done/) |
| **Abandon after lead** | **Collect a relevant result, then omit it from the summary** | **This post** |

---

## How the lead was lost

Strip the product names. The shape repeats on any alert-card triage agent doing AI incident response:

1. **Paste** — rule UID, fingerprint, fire time, Do-this-next checklist.
2. **Rule fetch succeeds** — title and annotations match the paste.
3. **Fingerprint miss** — instance not currently firing (aging is allowed).
4. **Wrong window** — the first PromQL (Prometheus query language) batch uses wall-clock “now − a few hours” and returns No data.
5. **Broaden** — longer window returns the locus near fire (reason + path + labels).
6. **Peer distraction** — a list of currently firing alerts returns an unrelated alert name during the same period.
7. **Abandon** — dig claims the UID is wrong; coordinator Summary goes undetermined and pastes the checklist back at the human.
8. **Possible follow-on mistake** — a proposed procedure says to stop whenever UIDs mismatch, potentially reinforcing the same error.

The actionable report would say what the metric showed, how tentative that interpretation is, and which log query could test it. Asking for a new identifier without reconciling the matching rule and metric result loses useful work.

---

## Four submission checks for incident triage

Instructions to continue were not enough in this case. We placed checks at the workflow boundary—before a finding is submitted—so the summary has to account for collected results. These checks catch specific omissions; they do not prove a lead is causal. See [curiosity gates for AI RCA](/blog/curiosity-before-confidence/).

| Principle | Expected agent behavior | Hard stop trigger |
| --- | --- | --- |
| **Compare card and rule** | Check the pasted alert name against the loaded rule; investigate a different peer alert separately | Claiming “UID points to a different alert” solely because a peer fired after a matching rule fetch |
| **Query around fire time** | Include fire time and the alert’s lookback/evaluation window; adjust scope when empty | Querying only “now” and declaring the historical signal absent |
| **Account for a lead** | Report the strongest relevant metric/log note with its limits; do not force “probable” if evidence is insufficient | Undetermined that only restates Do-this-next while the lead sits in notes |
| **Retry a missing datasource** | List available data sources and retry once with an explicit logs/metrics source if authorized | Treating “must specify datasource” as a hard blind |

None of this calls for unlimited searching. [Completion checks](/blog/is-the-task-actually-done/) still apply. The difference is whether the final account preserves the lead and its uncertainty, rather than discarding it because of an unrelated alert.

Maps and runbooks still matter ([agents need a map, not a script](/blog/agents-need-a-map-not-a-script/), [beyond Confluence runbooks](/blog/beyond-confluence-runbooks/)). None of them help if synthesis is allowed to forget the map after Collect already walked it.

---

## Why an identity check became a false stop

Fingerprint alignment and firing-instance lists exist for a good reason: agents should not investigate the wrong series. The mistake was treating a secondary identifier mismatch as conclusive even though the rule and metric query agreed.

A useful priority order in this test was:

1. Pasted card + successful rule payload that matches the alertname  
2. Labels and triage PromQL on that card  
3. Fingerprint and peer-alert list as checks for an expired alert or unrelated activity

When (1) and (2) agree, a peer with a different alert name does not by itself overturn the case. Conflicting evidence about the same entity would require another check. It is the observability equivalent of co-firing neighbors: interesting weather, wrong address.

Wrong time windows compound the problem. Some alerts evaluate over hours or a day. Querying only the last two hours after the alert fired may return No data even if the longer window that triggered it contains failures. Re-query around the fire time before describing the signal as absent.

---

## Catch Discarded Evidence Without Re-Running the Model

We already record [agent execution traces](/blog/observability/). A targeted test can compare the tool log with the final report and flag specific omissions — the same spirit as [evidence-gated RCA](/blog/evidence-gated-multiplane-rca/) and [evidence-based verification](/blog/evidence-based-verification/), applied to “did we keep the lead?”

Useful negative test cases (redacted):

- Dig claims wrong-UID after a matching rule title appears in tool output  
- Metrics show a dominant `reason=` / path / cohort, but Summary is undetermined + checklist paste  
- First metrics `from` misses the known fire instant by a wide margin  
- Logs fail on missing datasource with no retry that sets one  

Positive test case: the same alert shape, a query window covering fire time, the lead recorded, a log query retried with a data source, and a tentative explanation that cites the lead.

A transcript fixture is not a substitute for tests against live, changing systems. It can catch a repeated omission cheaply, and it can prevent a [multi-stage AI agent workflow](/topics/ai-agent-workflows/) from encoding an unhelpful stop rule.

---

## Lessons for Production AI SRE Agents

1. **Empty and discarded are different bugs.** Train and gate both.
2. **Match the rule before weighing peer alerts.** A matching rule payload should prompt careful continuation, not an automatic request for a new unique identifier (UID); verify any direct conflict.
3. **Carry leads forward.** If notes contain `reason=…` / `path=…`, the conclusion should discuss their relevance or explain why they were rejected.
4. **Time is part of the query.** Include the alert’s fire time and evaluation window in the first search.
5. **Test omissions in continuous integration (CI).** If a recorded lead disappears from the summary, flag the test before adding a procedure that reinforces the omission.

---

## Related reading

- [AI agent loop detection — don't throw away the answer](/blog/ai-agent-loop-detection-salvage/)
- [AI agent root cause analysis — curiosity before confidence](/blog/curiosity-before-confidence/)
- [Be creative. Don’t invent.](/blog/be-creative-do-not-invent/)
- [Evidence-gated RCA — prove, then narrate](/blog/evidence-gated-multiplane-rca/)
- [The hypothesis ladder for AI SRE root cause analysis](/blog/hypothesis-ladder/)
- [AI incident triage for SREs — what actually helps on-call](/blog/ai-incident-triage-sre/)
- Topic hubs: [AI agents for SRE](/topics/ai-agents-sre/) · [multi-stage AI agent workflows](/topics/ai-agent-workflows/)

Collecting a lead and reporting it responsibly are separate steps. Test both.

---


*Does your AI SRE agent keep the lead — or throw the notebook away when a neighbor’s dog barks? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> **StackGen is building AI-assisted incident triage.** Our offering aims to help teams run diagnostics and draft RCA reports; operators should still verify consequential findings. See [ai.stackgen.com](https://ai.stackgen.com).

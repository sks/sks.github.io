---
layout: post
title: "Claim-Aware Evidence Packing — Don't Accuse Agents of Inventing What You Truncated"
date: 2026-08-10 10:00:00 -0700
series: "Building an Enterprise AI Agent Platform in Go"
series_order: 41
description: "Claim-aware evidence packing: don't accuse AI agents of inventing what you truncated. Why hallucination guards fail when they drop the receipts."
image: /assets/images/og-default.png
tags: [ai-agents, golang, runtime, hallucination, evidence, production]
permalink: /blog/claim-aware-evidence-packing/
faqs:
  - question: "Why do hallucination guards matter in agent systems?"
    answer: "Agents can sound correct while inventing entities, numbers, or tool outcomes. A guard that checks answers against tool evidence catches fluent fiction before it reaches operators."
  - question: "What is claim-aware evidence packing?"
    answer: "When the verifier has a size budget, extract distinctive tokens from the answer and keep tool-result chunks that overlap those tokens, instead of keeping whatever arrived first in the dump."
  - question: "Why fail open when tool evidence is truncated?"
    answer: "If the verifier never saw later rows, calling those claims invented is a false positive. Prefer unverifiable over invented — but treat chronic truncation as a bug, not a permanent bypass."
  - question: "Where should domain-specific payload shaping live?"
    answer: "In integrations or tool wrappers. The shared verifier should stay generic: string membership, budgets, and fail-open policy — not product-specific JSON layouts."
---

A **grounding guard** checks whether an AI agent’s claims are supported by captured tool results. A false accusation of invention can make the guard less useful: reviewers may stop trusting its alerts.

The trap is subtle: you built a verifier that compares the answer to “what tools returned,” but you only fed the verifier a **budgeted slice** of those returns. Truncate the wrong slice and honest citations look invented.

This post covers the truncation failure, a claim-aware way to select evidence within a size budget, and the trade-offs of incomplete evidence and brittle string overlap.

---

## The practical distinction

- Hallucination guards exist so agents cannot invent entities that never appeared in tool evidence.
- Soft evidence budgets are necessary; **head-first truncation** is the common pitfall.
- Pack around **claim tokens** from the answer, not dump order — and be honest that token extraction is heuristic.
- Exclude **procedure / how-to** text from the evidence bag — it burns budget and is not observation.
- If the bag is **truncated**, prefer **unverifiable** over **invented** — but **alarm on chronic truncation** so fail-open does not become a permanent bypass.
- Put **cheap membership checks** in code; leave paraphrase and soft id variants to a model or to wrappers that emit canonical forms.
- Keep the **shared verifier domain-agnostic**; reshape payloads at the integration boundary.

If the verifier did not receive a tool-result row because it was truncated, absence from the verifier input does not establish that the agent invented the row. Preserve relevant chunks where possible, mark incomplete capture, and investigate recurring truncation.

---

## Why a hallucination guard is worth the hassle

Tool-using agents are persuasive. They return polished prose with ids, percentages, and “according to the lookup…” framing. Without a check against captured tool output, a polished answer can conceal unsupported entity claims.

A useful guard asks:

> Do the claims appear in the evidence available to this check, and is that evidence complete enough to judge?

That is narrower than “is the answer good?” or “did the agent dig enough?” In one sentence each:

| Nearby failure | Plain meaning | Not this post’s job |
| --- | --- | --- |
| Invent under emptiness | Fiction fills gaps when tools returned nothing useful | Fail closed on ungrounded entities |
| Abandon after lead | Found a good fact, then ignored it in the write-up | Agent behavior / memory |
| Close before homework | Sounded confident without enough tool calls | Dig / curiosity policy |
| **Torn-notebook accuse** | **Evidence was incomplete, yet we called the answer invented** | **Packing + fail-open policy** |

Mixing those jobs into one “hallucination” button makes the guard noisy. Ops mutes it. You lose the only cheap check you had.

Naming the metric helps: track **false invented** separately from true inventions. If operators mute the guard because it cries wolf, the guard is already dead.

---

## Pitfall 1: head-first truncation

Almost every verifier has a size ceiling. Context is expensive; dumping every tool blob into a second model call does not scale.

Naive policy: keep the **start** of the concatenated tool dump until the budget fills.

What usually sits at the start?

1. **Instructions and procedure text** — how to use a tool, how to investigate.
2. **Warm-up calls** — discovery, listing, scaffolding.

What often sits later?

- The large JSON / table / series that actually contains the id the answer cites.

Head-first truncation can keep procedural text and drop the relevant observation. The judge sees a short “tool results” section, sees an identifier that is absent, and labels the answer a hallucination. In this case, the verifier lacked the relevant row even though the tool returned it.

**Adopt:** a soft ceiling is fine. **Do not** treat chronological head as the packing key.

---

## Pitfall 2: treating procedure as evidence

Anything that teaches *how* to dig is not *what was observed*. If procedure blobs share the same bag as tool observations, they win the budget every time — they are long, early, and look important.

**Adopt:** exclude procedure / discovery-style outputs from the verifier bag, or put them in a channel the grounding judge never sees.

**Do not adopt:** stuffing the full prompt library into the contradiction check “just in case.”

---

## Pattern: claim-aware packing

![Answer claim tokens rank relevant tool observations under a budget; complete and truncated bags produce different verifier decisions](/assets/images/diagrams/aug-runtime/claim-aware-packing.svg)

*If evidence was truncated, absence alone cannot prove an invented claim.*

Once you accept a budget, packing becomes the product.

**Claim-aware packing:** extract a small set of tokens from the **answer**, then prefer tool chunks whose text overlaps those tokens.

Fallback when nothing overlaps: keep **recent** observation chunks, not head procedure — recent facts beat early scaffolding.

If packing still exceeds the ceiling, mark the bag **truncated**.

```go
// Prefer chunks that overlap answer claim tokens.
func packByClaims(results string, tokens []string, maxRunes int) (packed string, truncated bool) {
	// 1. Split results into observation chunks.
	// 2. Keep chunks that contain any claim token.
	// 3. If none match, keep trailing observation chunks.
	// 4. If still over maxRunes, truncate and set truncated=true.
	return packed, truncated
}
```

**Adopt in the verifier / runtime:** token extract + overlap pack + truncation flag.

**Do not adopt there:** parsers for one vendor’s query language, one metrics JSON schema, or one ticket system’s payload shape.

---

## How claim tokens actually get extracted (and where it hurts)

Packing quality depends on which claim tokens are extracted; document and test that step.

A practical natural language processing (NLP) shortcut here is a code extractor that looks like:

1. **Scan the answer** for distinctive shapes: quoted strings, UUIDs, hyphen/underscore ids, dotted names (`svc.api`), long alphanumeric runs.
2. **Drop stopwords and JSON noise** (`the`, `status`, `null`, `true`, `result`, …) so English filler never becomes a “claim.”
3. **Drop bare numerics / percents** from *hard* membership gates (`90`, `90%`) — ratio↔percent restatements are better left to a model or skipped.
4. **Lowercase for overlap**, keep the original for display if you surface reasons.

Illustrative extract (still a sketch):

```go
// extractClaimTokens is heuristic on purpose: recall of distinctive ids
// beats precision of a full NLP pipeline on the hot path.
func extractClaimTokens(answer string) []string {
	// regex for quoted | uuid | [a-z0-9][a-z0-9._-]{3,}
	// filter stopwords + JSON noise + pure numbers
	// dedupe, cap list size (e.g. 32)
	return nil
}
```

**What this gets right:** many real hallucinations invent *entities* (`ticket-8841`, hostnames, request ids). Those tokens are distinctive and usually appear verbatim in tool JSON.

**What this gets wrong:**

| Miss | Example | Why it hurts |
| --- | --- | --- |
| Format drift | Answer says `user-1234`, tool has `"id": "1234"` | Overlap fails → relevant chunk dropped |
| Soft paraphrase | Answer summarizes a log without repeating the id | Nothing to pack around |
| Over-extraction | Common words slip past the deny-list | Packing prefers the wrong chunks |
| Under-extraction | Exotic id shapes your regex never saw | Fallback to “recent chunks” only |

**Adopt:** ship the heuristic, **measure false invented vs true invented**, and widen regex / noise lists from real misses.

**Mitigate format drift without teaching the runtime your CRM:**

- Prefer **distinctive substrings** (keep `1234` only when long enough / rare enough — short digits are poison).
- Light **normalization** on both sides for overlap only (strip common prefixes like `user-` / `id=` is risky; prefer wrappers emitting a canonical id field the agent must quote).
- Put **canonical ids in tool wrappers** (“always include `canonical_id` in the observation text”) — that is integration work, not verifier cleverness.
- Keep a **model judge** for soft grounding when code membership is ambiguous — code fails closed only on high-confidence entity tokens.

Do not pretend regex + stopwords equals semantic understanding. It is a **budget allocator with a bias toward what the answer named**.

---

## Pattern: fail open when the bag is incomplete — and do not get played

Verification has three honest outcomes:

| Outcome | Meaning | When |
| --- | --- | --- |
| Grounded | Claims appear in evidence | Bag intact, membership holds |
| Invented / contradict | Claims conflict or are absent | Bag intact, check failed |
| Unverifiable | We cannot judge | Bag truncated or capture incomplete |

The torn-notebook bug is treating **unverifiable** as **invented**.

**Adopt:** if capture or packing truncated evidence, do not label a claim invented solely because it is absent from the retained bag. Return an explicit “could not verify” signal; independent contradictions in retained evidence still need review.

**Do not adopt:** “always fail closed; better safe than sorry.” Operators will disable you after a week of false invented pages.

### The risk of fail-open

Returning “unverifiable” avoids a false accusation when the bag is incomplete, but repeated truncation leaves claims unchecked. If large JSON results routinely exceed the budget, the guard cannot reliably establish grounding.

Treat chronic truncation as an **ops bug**, not a policy win:

| Signal | Why |
| --- | --- |
| Truncation rate / run | If this is high, the guard is mostly off |
| Bytes before vs after pack | Shows whether packing helps or you are always over ceiling |
| Top tools by evidence size | Names the noisy wrappers to fix |
| Unverifiable vs invented ratio | Spike in unverifiable ≈ bypass; spike in invented ≈ maybe too strict |

**Adopt beside fail-open:**

1. **Alarm** when truncation or unverifiable exceeds a budget (per workflow, not a global shrug).
2. **Shrink at the edge** — wrappers return compact observations, not raw vendor dumps (this is where domain knowledge belongs).
3. **Hard caps on capture** earlier in the pipeline so packing is a second line of defense, not the only mop.
4. **Never silently equate** unverifiable with success in product UX — show “could not verify” when that is what happened.

Fail-open without telemetry is how you delete the guard while keeping the checkbox.

---

## Pattern: cheap gates in code, judgment in the model

Not every check needs another LLM call.

**Good in code (deterministic, cheap):**

- High-confidence entity token present in tool text?
- Cited tool-call receipt ids exist (when answers emit citations)?
- Budget / truncation flags?

**Better left to a model (or skipped):**

- “90%” vs “0.9 ratio” restatements
- Paraphrase of a log line
- Id shape variants the regex did not unify
- Whether a summary is fair

**Optional later:** when answers cite tool-call ids, verify those ids with **token boundaries** (`call-1` must not match `call-10`). Prefix contains is how you select the wrong receipt and still feel rigorous. Ship citation checks only when agents actually emit citations.

---

## What to adopt where

Layering beats a clever monolith.

| Concern | Where it belongs | Why |
| --- | --- | --- |
| Soft evidence budget | Shared verifier | Every stack hits context limits |
| Claim token extract + packing | Shared verifier | Generic heuristics; no product parsers |
| Fail-open on truncation | Shared verifier | Policy, not domain |
| Truncation / unverifiable SLOs | Shared verifier + ops | Closes the fail-open loophole |
| Procedure vs observation split | Shared verifier + tool taxonomy | How-to text is not evidence |
| Hard entity membership | Shared verifier (code) | Cheap, testable |
| Soft grounding / paraphrase | Model judge | Ambiguous without semantics |
| Compact / canonical ids in payloads | **Integrations / tool wrappers** | Fixes brittle overlap at the source |
| Dig playbooks / SOPs | Agents / workflows | Not the grounding engine |

Rule of thumb:

> **Typed decisions and budgets in the runtime. Domain reshaping and canonical ids at the integration boundary.**

Teaching the shared guard one observability dialect or one ticket schema couples every other use case to that shape — and wrappers often never emit the shape you optimized for.

---

## Pitfall 3: pulling an NLP framework for twenty stopwords

Claim extraction needs a deny-list so “the”, “status”, and “null” do not become claims. Half of that list is English filler. Half is **JSON / tool noise**.

A generic stopword package covers the first half. It does not know your tool envelope. A dependency may add maintenance or hot-path costs that are not justified for a short deny-list; review options such as [bbalet/stopwords](https://github.com/bbalet/stopwords) against your needs.

**Adopt:** a tiny local map you own and review; grow it from false packing hits.

**Do not adopt:** SimHash, HTML strippers, or a multilingual NLP stack inside the hot-path membership filter.

---

## Builder checklist

- [ ] Grounding check against tool evidence — not only a “sounds good” judge  
- [ ] Soft ceiling exists, but packing is **claim-aware**, not only head truncation  
- [ ] Token extraction is documented as **heuristic**; false-invented is measured  
- [ ] Procedure / how-to outputs are out of the evidence bag  
- [ ] Truncated evidence is **unverifiable**, never auto-**invented**  
- [ ] Truncation / unverifiable rates are **alarmed** — fail-open is not a silent bypass  
- [ ] Noisy tools are compacted at the **wrapper**, not excused forever  
- [ ] Brittle id overlap is mitigated (canonical fields, light normalize, or model soft-check)  
- [ ] Shared verifier has **no** product-specific JSON compactors  
- [ ] Stopword / noise lists are local and owned  

Shareable cousin: [Evidence-gated RCA checklist](/checklists/evidence-gated-rca/).

---

## Where to go next

Related reading if you want more of this series (optional, not required):

- [Evidence discarded after the lead](/blog/evidence-discarded/)  
- [Curiosity before confidence](/blog/curiosity-before-confidence/)  
- [Evidence-based verification](/blog/evidence-based-verification/)  
- Hubs: [AI agent runtime](/topics/ai-agent-runtime/) · [Go AI agents](/topics/go-ai-agents/) · [AI agent workflows](/topics/ai-agent-workflows/)

Pack evidence relevant to the claims, expose incomplete capture as unverifiable, monitor truncation, and keep product-specific payload shaping in tool wrappers.

---

*Building a verifier that false-flags true tool rows — or debating where domain reshaping should live? Find me on [GitHub](https://github.com/sks) or [LinkedIn](https://linkedin.com/in/sabithks).*

---

> StackGen develops AI tools for site reliability engineering (SRE), including incident triage and diagnostic workflows. Product details are at [ai.stackgen.com](https://ai.stackgen.com).

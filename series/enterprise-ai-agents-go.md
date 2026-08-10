---
layout: page
title: Building an Enterprise AI Agent Platform in Go
nav_title: Series
permalink: /series/enterprise-ai-agents-go/
description: "A practitioner series on building production AI agents in Go — runtime design, workflows, SRE triage, observability, and enterprise platform lessons from StackGen."
faqs:
  - question: "Why build an enterprise AI agent platform in Go?"
    answer: "Go gives you static typing, simple deployment, and concurrency primitives that map cleanly to multi-stage agent workflows. This series covers when that trade-off beats Python-first AI frameworks in production."
  - question: "Where should I start reading?"
    answer: "Use a starter pack: Go agent runtime (definition, why Go, platform split) or SRE on-call (triage, RCA, observability). Then open the searchable series archive and follow series_order. Each post is self-contained but builds on prior lessons."
  - question: "Who is this series for?"
    answer: "Staff engineers, platform teams, and SREs shipping agentic workflows to production — not tutorial readers looking for a hello-world chatbot."
---

This series documents what we learned building a **production AI agent runtime** and **Aiden** — StackGen's multi-tenant orchestration platform for enterprise SRE and platform teams. Every post is grounded in shipped behavior and production failures, not demo polish.

## Start with a pack

| Pack | For |
|------|-----|
| [Go agent runtime](/start/go-runtime/) | Runtime definition, Go vs Python, platform split |
| [SRE on-call](/start/sre-on-call/) | Triage, RCA, observability |
| [Evidence-gated RCA checklist](/checklists/evidence-gated-rca/) | Operator review of agent write-ups |
| [“Done” checklist](/checklists/agent-done/) | When not to trust agent completion |

## Topic hubs

Dive by theme:

- [AI agent workflows](/topics/ai-agent-workflows/) — multi-stage pipelines, bring-up, evidence-gated RCA
- [AI agents for SRE](/topics/ai-agents-sre/) — incident triage, observability, tokenomics
- [Go AI agents](/topics/go-ai-agents/) — language choice, platform architecture, IaC config
- [AI agent runtime](/topics/ai-agent-runtime/) — loop vs platform

{% assign series_name = "Building an Enterprise AI Agent Platform in Go" %}
{% assign series_posts = site.posts | where_exp: "post", "post.series == series_name" %}
{% assign series_by_order = series_posts | where_exp: "post", "post.series_order" | sort: "series_order" %}
{% assign months = series_posts | group_by_exp: "post", "post.date | date: '%Y-%m'" %}
{% assign series_tags = series_posts | map: "tags" | join: "," | split: "," %}
{% assign tag_counts = series_tags | group_by_exp: "tag", "tag" | sort: "size" | reverse %}

<section class="series-browser" id="series-browser" aria-label="Series archive">

<div class="series-suggest" id="series-suggest">
<h2 class="series-suggest__heading">Suggested for you</h2>
<ul class="series-suggest__cards" id="series-suggest-cards">
{% for post in series_by_order limit: 3 %}
<li class="series-suggest__card">
<span class="series-suggest__label">{% if forloop.first %}Start here{% else %}Then read{% endif %}</span>
<a class="series-suggest__link" href="{{ post.url | relative_url }}">{{ post.title }}</a>
<p class="series-suggest__desc">{{ post.description | strip_html | truncate: 110 }}</p>
</li>
{% endfor %}
</ul>
<p class="series-suggest__progress" id="series-progress" hidden></p>
</div>

<h2 class="series-browser__heading">Every post, month by month</h2>

<div class="series-search" data-js-only hidden>
<label class="series-search__label" for="series-search-input">Search this series</label>
<div class="series-search__row">
<input class="series-search__input" id="series-search-input" type="search" autocomplete="off" placeholder="Try “triage”, “memory”, “observability”…" aria-describedby="series-search-status">
<button class="series-search__clear" id="series-search-clear" type="button" hidden>Clear</button>
</div>
<ul class="series-chips" id="series-chips" aria-label="Popular topics">
{% for tag in tag_counts limit: 8 %}{% if tag.name != "" %}
<li><button class="series-chip" type="button" aria-pressed="false" data-query="{{ tag.name }}">{{ tag.name }} <span class="series-chip__count">{{ tag.size }}</span></button></li>
{% endif %}{% endfor %}
</ul>
<p class="series-search__status" id="series-search-status" role="status" aria-live="polite">{{ series_posts.size }} posts across {{ months.size }} months.</p>
</div>

<div class="series-controls" data-js-only hidden>
<button class="series-control" id="series-expand" type="button">Expand all</button>
<button class="series-control" id="series-collapse" type="button">Collapse all</button>
</div>

{% for month in months %}
{% assign month_label = month.items.first.date | date: "%B %Y" %}
<details class="series-month" data-month="{{ month.name }}" data-label="{{ month_label | downcase }}"{% if forloop.first %} open{% endif %}>
<summary class="series-month__summary">
<span class="series-month__name">{{ month_label }}</span>
<span class="series-month__count" data-total="{{ month.items.size }}">{{ month.items.size }} posts</span>
</summary>
<ul class="series-list">
{% for post in month.items %}
{% capture post_tags %}{{ post.tags | join: " " }}{% endcapture %}
<li class="series-item"
    data-url="{{ post.url | relative_url }}"
    data-order="{{ post.series_order }}"
    data-title="{{ post.title | escape }}"
    data-desc="{{ post.description | strip_html | escape }}"
    data-search="{{ post.title | append: ' ' | append: post.description | append: ' ' | append: post_tags | append: ' ' | append: month_label | strip_html | downcase | escape }}">
<div class="series-item__head">
{% if post.series_order %}<span class="series-item__order">{{ post.series_order }}</span>{% endif %}
<a class="series-item__link" href="{{ post.url | relative_url }}">{{ post.title }}</a>
<span class="series-item__read" hidden>Read</span>
</div>
<p class="series-item__desc">{{ post.description }}</p>
<p class="series-item__meta"><time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%b %-d, %Y" }}</time>{% if post.tags.size > 0 %} · {{ post.tags | join: ", " }}{% endif %}</p>
</li>
{% endfor %}
</ul>
</details>
{% endfor %}

<p class="series-empty" id="series-empty" hidden>No posts match that search. Try a broader term, or <button class="series-empty__reset" id="series-empty-reset" type="button">clear the search</button>.</p>

</section>

<script>{% include series-browser.js %}</script>

## More on this site

Posts outside the numbered series (e.g. cloud entitlements, web→LLM metrics) live on the [homepage](/) archive.

{% include subscribe.html %}

---
layout: page
title: "ClickHouse on AWS: Self-Managed from First Principles"
nav_title: Series
permalink: /series/clickhouse-on-aws/
description: "Self-managed ClickHouse on AWS for engineers starting from first principles: MergeTree internals, engine choices, cluster topology, S3 storage, spot readers, operations, and cost — with the numbers and failure stories behind each choice."
faqs:
  - question: "Who is this ClickHouse series for?"
    answer: "Engineers starting with ClickHouse on AWS — no prior ClickHouse knowledge assumed. Each post defines its terms, uses real numbers from a production log analytics cluster, and links the official docs it builds on."
  - question: "Do I need ClickHouse Cloud to follow along?"
    answer: "No. The series is self-managed from first principles: ReplicatedMergeTree, ClickHouse Keeper, and S3 storage policies on EC2. Post 2 explains what ClickHouse Cloud's SharedMergeTree gives you and when buying it wins."
  - question: "Why EC2 instead of Kubernetes for ClickHouse?"
    answer: "For a small stateful fleet, stable identity under spot churn, Keeper raft discipline, S3-tiered storage, and not paying the cluster tax beat the Altinity operator's conveniences. The final post walks the data flows and the honest reversal condition — if you already run a large EKS fleet, the calculus flips."
---

This series explains the **ClickHouse cluster** behind a log analytics platform I run—self-managed on AWS, starting from first principles. It's written for junior engineers: every term is defined at first use, and every claim carries a number or a link to the official docs. It records not just what we chose but what broke—a $1,700/month EBS leak, a spot-identity race, and deprecated zero-copy replication. Numbers come from a production log analytics cluster; what transfers to your setup is usually the measurement, not our answer.

## Start with a pack

| Pack | For |
|------|-----|
| [ClickHouse on AWS starter pack](/start/clickhouse-aws/) | All nine posts in reading order with one-line takeaways |

## Topic hubs

Dive by theme:

- [ClickHouse on AWS](/topics/clickhouse-aws/) — all posts by topic

{% assign series_name = "ClickHouse on AWS: Self-Managed from First Principles" %}
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

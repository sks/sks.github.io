---
layout: page
title: Series
permalink: /series/
nav_title: Series
description: "Browse every Production Notes series and post: enterprise AI agents in Go, ClickHouse on AWS, Service Rendered Efficiently, and standalone engineering notes."
faqs:
  - question: "How many series does this site have?"
    answer: "Three: Building an Enterprise AI Agent Platform in Go, ClickHouse on AWS, and Service Rendered Efficiently. Each series card below shows its current post count and complete reading order."
  - question: "How do I read a series from beginning to end?"
    answer: "Choose Start with post 1 or open the full reading order. Every article ends with a Next in series link, so you can continue without returning to the archive."
  - question: "Where do standalone posts live?"
    answer: "Standalone production notes appear on this page below the series. The newest notes section also includes recent posts from every series and standalone topics."
---

Find a focused learning path or jump straight to the newest field notes. Every series lists all of its posts and starts with post 1—no manual table or month-by-month hunting required.

{% assign visible_posts = site.posts | where_exp: "post", "post.sitemap != false" %}
{% assign latest_posts = visible_posts | slice: 0, 6 %}

## Newest production notes

<div class="series-latest-grid">
{% for post in latest_posts %}
  <article class="series-latest-card">
    <p class="series-card__meta"><time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%b %-d, %Y" }}</time>{% if post.series %} · {{ post.series }}{% else %} · Standalone note{% endif %}</p>
    <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
    <p>{{ post.description | strip_html | truncate: 150 }}</p>
  </article>
{% endfor %}
</div>

## Choose a series

{% assign all_series = site.posts | where_exp: "post", "post.series" | group_by: "series" | sort: "size" | reverse %}

<div class="series-index-grid">
{% for group in all_series %}
  {% assign series_hub = site.pages | where: "nav_title", "Series" | where: "title", group.name | first %}
  {% assign ordered_posts = group.items | where_exp: "post", "post.series_order" | sort: "series_order" %}
  {% assign first_post = ordered_posts | first %}
  {% assign unnumbered_posts = group.items | where_exp: "post", "post.series_order == nil" %}
  <article class="series-index-card">
    <p class="series-card__count">{{ group.size }} posts</p>
    <h3><a href="{{ series_hub.url | relative_url }}">{{ group.name }}</a></h3>
    <p class="series-index-card__desc">{{ series_hub.description }}</p>
    <div class="series-index-card__actions">
      {% if first_post %}<a class="series-button series-button--primary" href="{{ first_post.url | relative_url }}">Start with post 1</a>{% endif %}
      <a class="series-button" href="{{ series_hub.url | relative_url }}#series-browser">Full reading order</a>
    </div>
    <details class="series-index-all">
      <summary>View all {{ group.size }} post titles</summary>
      <ol>
        {% for post in ordered_posts %}
        <li value="{{ post.series_order }}"><a href="{{ post.url | relative_url }}">{{ post.title }}</a></li>
        {% endfor %}
        {% for post in unnumbered_posts %}
        <li><a href="{{ post.url | relative_url }}">{{ post.title }}</a> <span>(related note)</span></li>
        {% endfor %}
      </ol>
    </details>
  </article>
{% endfor %}
</div>

{% assign standalone_posts = visible_posts | where_exp: "post", "post.series == nil" %}
{% if standalone_posts.size > 0 %}
## Standalone production notes

<div class="series-latest-grid">
{% for post in standalone_posts %}
  <article class="series-latest-card">
    <p class="series-card__meta"><time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%b %-d, %Y" }}</time> · Standalone note</p>
    <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
    <p>{{ post.description | strip_html | truncate: 180 }}</p>
  </article>
{% endfor %}
</div>
{% endif %}

## Browse across series

- [AI agent runtime](/topics/ai-agent-runtime/) · [AI agent workflows](/topics/ai-agent-workflows/) · [AI agents for SRE](/topics/ai-agents-sre/) · [Go AI agents](/topics/go-ai-agents/) · [AI incident triage](/topics/ai-incident-triage/)
- [Service Rendered Efficiently](/topics/service-rendered-efficiently/)
- [ClickHouse on AWS](/topics/clickhouse-aws/)

{% include subscribe.html %}

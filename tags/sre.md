---
layout: page
title: "Tag: sre"
permalink: /tags/sre/
---

Posts tagged **sre**:

{% assign tag_posts = site.posts | where_exp: "post", "post.tags contains 'sre'" %}
{% for post in tag_posts %}
- [{{ post.title }}]({{ post.url | relative_url }}) — {{ post.description }}
{% endfor %}

[← All tags](/tags/)

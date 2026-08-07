(function () {
  var INDEX_URL = "/assets/posts-index.json";
  var indexPromise = null;

  function modelContext() {
    if (document.modelContext) {
      return document.modelContext;
    }
    if (typeof navigator !== "undefined" && navigator.modelContext) {
      return navigator.modelContext;
    }
    return null;
  }

  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(INDEX_URL, { credentials: "same-origin" }).then(function (res) {
        if (!res.ok) {
          throw new Error("posts-index fetch failed: " + res.status);
        }
        return res.json();
      });
    }
    return indexPromise;
  }

  function normalize(text) {
    return String(text || "").toLowerCase();
  }

  function formatPosts(posts) {
    if (!posts.length) {
      return "No matching posts.";
    }
    return posts
      .map(function (post, i) {
        return (
          i +
          1 +
          ". " +
          post.title +
          " — " +
          post.url +
          (post.description ? " (" + post.description + ")" : "")
        );
      })
      .join("\n");
  }

  function searchPosts(args) {
    var query = normalize(args && args.query);
    var tag = normalize(args && args.tag);
    var limit = Math.min(Math.max(Number(args && args.limit) || 8, 1), 20);

    return loadIndex().then(function (index) {
      var posts = index.posts || [];
      var matches = posts;
      if (query || tag) {
        matches = posts.filter(function (post) {
          var hay =
            normalize(post.title) +
            " " +
            normalize(post.description) +
            " " +
            normalize((post.tags || []).join(" "));
          if (tag) {
            var tags = (post.tags || []).map(normalize);
            if (tags.indexOf(tag) === -1) {
              return false;
            }
          }
          if (query && hay.indexOf(query) === -1) {
            return false;
          }
          return true;
        });
      }
      return formatPosts(matches.slice(0, limit));
    });
  }

  function listTopicHubs() {
    return loadIndex().then(function (index) {
      var hubs = index.topic_hubs || [];
      var series = index.series;
      var lines = hubs.map(function (hub, i) {
        return i + 1 + ". " + hub.title + " — " + hub.url + " (" + hub.description + ")";
      });
      if (series && series.url) {
        lines.unshift("Series: " + series.title + " — " + series.url);
      }
      return lines.join("\n");
    });
  }

  function openNewsletter() {
    return loadIndex().then(function (index) {
      var url = index.newsletter_url;
      if (!url) {
        return "Newsletter URL is not configured.";
      }
      window.location.assign(url);
      return "Navigating to newsletter: " + url;
    });
  }

  function register() {
    var ctx = modelContext();
    if (!ctx || typeof ctx.registerTool !== "function") {
      return;
    }

    var registerTool = ctx.registerTool.bind(ctx);

    registerTool({
      name: "search_posts",
      description:
        "Search Production Notes blog posts by keyword and/or tag. Returns matching titles, URLs, and short descriptions.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Keyword to match against title, description, or tags.",
          },
          tag: {
            type: "string",
            description: "Optional single lowercase tag filter, e.g. 'sre' or 'ai-agents'.",
          },
          limit: {
            type: "integer",
            description: "Max results to return (1-20). Defaults to 8.",
            minimum: 1,
            maximum: 20,
          },
        },
      },
      annotations: {
        readOnlyHint: true,
      },
      execute: function (args) {
        return searchPosts(args || {});
      },
    });

    registerTool({
      name: "list_topic_hubs",
      description:
        "List topic hubs and the main series index for Production Notes. Use when an agent needs curated entry points by theme.",
      inputSchema: {
        type: "object",
        properties: {},
      },
      annotations: {
        readOnlyHint: true,
      },
      execute: function () {
        return listTopicHubs();
      },
    });

    registerTool({
      name: "open_newsletter",
      description:
        "Open the Production Notes email newsletter subscribe page (Substack). Use when the user wants to subscribe.",
      inputSchema: {
        type: "object",
        properties: {},
      },
      annotations: {
        readOnlyHint: false,
      },
      execute: function () {
        return openNewsletter();
      },
    });
  }

  register();
})();

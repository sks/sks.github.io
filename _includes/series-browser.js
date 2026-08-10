(function () {
  var root = document.getElementById("series-browser");
  if (!root) {
    return;
  }

  var input = document.getElementById("series-search-input");
  var clearBtn = document.getElementById("series-search-clear");
  var status = document.getElementById("series-search-status");
  var empty = document.getElementById("series-empty");
  var emptyReset = document.getElementById("series-empty-reset");
  var expandBtn = document.getElementById("series-expand");
  var collapseBtn = document.getElementById("series-collapse");
  var suggestCards = document.getElementById("series-suggest-cards");
  var progress = document.getElementById("series-progress");
  var toArray = function (nodes) {
    return Array.prototype.slice.call(nodes);
  };

  var months = toArray(root.querySelectorAll(".series-month"));
  var items = toArray(root.querySelectorAll(".series-item"));
  if (!items.length) {
    return;
  }

  var entries = items.map(function (el) {
    var order = parseInt(el.getAttribute("data-order"), 10);
    return {
      el: el,
      url: el.getAttribute("data-url") || "",
      title: el.getAttribute("data-title") || "",
      desc: el.getAttribute("data-desc") || "",
      // Unnumbered posts belong to the series but sit outside the reading order.
      order: isNaN(order) ? Number.MAX_SAFE_INTEGER : order,
      haystack: el.getAttribute("data-search") || ""
    };
  });

  toArray(root.querySelectorAll("[data-js-only]")).forEach(function (el) {
    el.hidden = false;
  });

  var chips = toArray(root.querySelectorAll(".series-chip"));
  var defaultOpen = months.map(function (m) {
    return m.open;
  });
  var activeQuery = "";

  function setStatus(text) {
    if (status) {
      status.textContent = text;
    }
  }

  function applyQuery(raw) {
    var query = (raw || "").trim().toLowerCase();
    var tokens = query ? query.split(/\s+/) : [];
    var active = tokens.length > 0;
    var wasActive = activeQuery !== "";
    var matched = 0;

    entries.forEach(function (entry) {
      var hit = tokens.every(function (token) {
        return entry.haystack.indexOf(token) !== -1;
      });
      entry.el.hidden = !hit;
      if (hit) {
        matched += 1;
      }
    });

    months.forEach(function (month, index) {
      var visible = toArray(month.querySelectorAll(".series-item")).filter(function (el) {
        return !el.hidden;
      }).length;
      var count = month.querySelector(".series-month__count");
      var total = count ? count.getAttribute("data-total") : "";
      month.hidden = active && visible === 0;
      if (count) {
        count.textContent = active ? visible + " of " + total : total + " posts";
      }
      if (active) {
        month.open = visible > 0;
      } else if (wasActive) {
        month.open = defaultOpen[index];
      }
    });

    activeQuery = query;
    chips.forEach(function (chip) {
      chip.setAttribute("aria-pressed", chip.getAttribute("data-query") === query ? "true" : "false");
    });
    setStatus(active
      ? matched + (matched === 1 ? " post matches “" : " posts match “") + query + "”."
      : entries.length + " posts across " + months.length + " months.");

    if (empty) {
      empty.hidden = matched !== 0;
    }
    if (clearBtn) {
      clearBtn.hidden = !active;
    }
  }

  function search(value, focus) {
    if (input) {
      input.value = value;
      if (focus) {
        input.focus();
      }
    }
    applyQuery(value);
  }

  if (input) {
    input.addEventListener("input", function () {
      applyQuery(input.value);
    });
    input.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        search("", true);
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      search("", true);
    });
  }

  if (emptyReset) {
    emptyReset.addEventListener("click", function () {
      search("", true);
    });
  }

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var query = chip.getAttribute("data-query") || "";
      search(activeQuery === query ? "" : query, true);
    });
  });

  if (expandBtn) {
    expandBtn.addEventListener("click", function () {
      months.forEach(function (month) {
        month.open = true;
      });
    });
  }

  if (collapseBtn) {
    collapseBtn.addEventListener("click", function () {
      months.forEach(function (month) {
        month.open = false;
      });
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    var tag = (event.target && event.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || event.target.isContentEditable) {
      return;
    }
    if (input) {
      event.preventDefault();
      input.focus();
    }
  });

  function readHistory() {
    try {
      var parsed = JSON.parse(localStorage.getItem("pn-read"));
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function suggestions() {
    var read = {};
    readHistory().forEach(function (visit) {
      if (visit && visit.url) {
        read[visit.url] = visit.ts || 0;
      }
    });

    var byOrder = entries.slice().sort(function (a, b) {
      return a.order - b.order;
    });
    var unread = byOrder.filter(function (entry) {
      return !read[entry.url];
    });
    var readCount = entries.length - unread.length;

    byOrder.forEach(function (entry) {
      var badge = entry.el.querySelector(".series-item__read");
      if (read[entry.url]) {
        entry.el.classList.add("is-read");
        if (badge) {
          badge.hidden = false;
        }
      }
    });

    var picks = [];
    var used = {};
    function add(label, entry) {
      if (!entry || used[entry.url] || picks.length >= 3) {
        return;
      }
      used[entry.url] = true;
      picks.push({ label: label, entry: entry });
    }

    var lastRead = null;
    byOrder.forEach(function (entry) {
      if (read[entry.url] && (!lastRead || read[entry.url] > read[lastRead.url])) {
        lastRead = entry;
      }
    });

    if (lastRead) {
      var next = byOrder.filter(function (entry) {
        return entry.order > lastRead.order && !read[entry.url];
      })[0];
      add("Pick up where you left off", next || unread[0]);
    } else {
      add("Start here", byOrder[0]);
    }

    var newest = entries[0];
    add(read[newest.url] ? "Latest post" : "New since your last visit", newest);

    // Rotates once a day so repeat visitors see a different deep cut.
    var pool = unread.length ? unread : byOrder;
    var day = Math.floor(Date.now() / 86400000);
    for (var i = 0; i < pool.length && picks.length < 3; i += 1) {
      add("Worth a detour", pool[(day + i) % pool.length]);
    }

    if (suggestCards && picks.length) {
      suggestCards.innerHTML = "";
      picks.forEach(function (pick) {
        var card = document.createElement("li");
        card.className = "series-suggest__card";

        var label = document.createElement("span");
        label.className = "series-suggest__label";
        label.textContent = pick.label;

        var link = document.createElement("a");
        link.className = "series-suggest__link";
        link.href = pick.entry.url;
        link.textContent = pick.entry.title;

        var desc = document.createElement("p");
        desc.className = "series-suggest__desc";
        var text = pick.entry.desc;
        desc.textContent = text.length > 110 ? text.slice(0, 110).replace(/\s+\S*$/, "") + "…" : text;

        card.appendChild(label);
        card.appendChild(link);
        card.appendChild(desc);
        suggestCards.appendChild(card);
      });
    }

    if (progress && readCount > 0) {
      progress.hidden = false;
      progress.textContent = "You've read " + readCount + " of " + entries.length + " posts in this series.";
    }
  }

  var params = new URLSearchParams(window.location.search);
  var initial = params.get("q");
  if (initial) {
    search(initial, false);
  } else {
    applyQuery("");
  }

  suggestions();
})();

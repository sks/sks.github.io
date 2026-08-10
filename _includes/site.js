(function () {
  var STORAGE_KEY = "pn-theme";
  var root = document.documentElement;

  function currentTheme() {
    var theme = root.getAttribute("data-theme");
    if (theme === "light" || theme === "dark") {
      return theme;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function setTheme(theme) {
    root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      /* private mode */
    }
    syncToggle(theme);
  }

  function syncToggle(theme) {
    var btn = document.getElementById("theme-toggle");
    if (!btn) {
      return;
    }
    var next = theme === "dark" ? "light" : "dark";
    btn.setAttribute("aria-label", "Switch to " + next + " theme");
    btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  }

  function initThemeToggle() {
    var btn = document.getElementById("theme-toggle");
    if (!btn) {
      return;
    }
    syncToggle(currentTheme());
    btn.addEventListener("click", function () {
      setTheme(currentTheme() === "dark" ? "light" : "dark");
    });
  }

  function initCopyCode() {
    var blocks = document.querySelectorAll(".post-content pre, .page-content pre");
    Array.prototype.forEach.call(blocks, function (pre) {
      if (pre.closest(".code-block")) {
        return;
      }
      var wrap = document.createElement("div");
      wrap.className = "code-block";
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "copy-code";
      btn.textContent = "Copy";
      btn.setAttribute("aria-label", "Copy code block");
      wrap.appendChild(btn);

      btn.addEventListener("click", function () {
        // textContent avoids layout flush that innerText can trigger.
        var text = pre.textContent || "";
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
          btn.textContent = "Unavailable";
          return;
        }
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = "Copied";
          window.setTimeout(function () {
            btn.textContent = "Copy";
          }, 1600);
        }).catch(function () {
          btn.textContent = "Failed";
          window.setTimeout(function () {
            btn.textContent = "Copy";
          }, 1600);
        });
      });
    });
  }

  function initBackToTop() {
    var btn = document.getElementById("back-to-top");
    if (!btn) {
      return;
    }
    var showAfter = 480;
    var ticking = false;
    function updateVisibility() {
      ticking = false;
      btn.hidden = window.scrollY < showAfter;
    }
    function onScroll() {
      if (ticking) {
        return;
      }
      ticking = true;
      window.requestAnimationFrame(updateVisibility);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    // Read scroll position before later DOM work invalidates layout.
    updateVisibility();
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Local-only reading history; powers the dynamic picks on the series page.
  function initReadingHistory() {
    var canonical = document.querySelector("article.post .u-url");
    if (!canonical) {
      return;
    }
    var url = canonical.getAttribute("href");
    if (!url) {
      return;
    }
    var titleEl = document.querySelector(".post-title");
    var entry = {
      url: url,
      title: titleEl ? titleEl.textContent.trim() : document.title,
      ts: Date.now()
    };
    try {
      var stored = JSON.parse(localStorage.getItem("pn-read"));
      var history = Array.isArray(stored) ? stored : [];
      history = history.filter(function (visit) {
        return visit && visit.url && visit.url !== url;
      });
      history.unshift(entry);
      localStorage.setItem("pn-read", JSON.stringify(history.slice(0, 60)));
    } catch (e) {
      /* private mode or corrupt payload */
    }
  }

  initThemeToggle();
  // Back-to-top reads scrollY; run it before copy-code DOM wraps force a reflow.
  initBackToTop();
  initCopyCode();
  initReadingHistory();
})();

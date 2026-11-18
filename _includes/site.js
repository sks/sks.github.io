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
  initSvgLightbox();
  initReadingHistory();

  function initSvgLightbox() {
    var containers = document.querySelectorAll(".post-content, .page-content");
    if (!containers.length) {
      return;
    }

    var MIN_ZOOM = 0.5;
    var MAX_ZOOM = 6;
    var dialog = null;
    var stage = null;
    var canvas = null;
    var modalImg = null;
    var captionEl = null;
    var zoomResetBtn = null;
    var rawLink = null;
    var activeTrigger = null;
    var tempBlobUrl = null;
    var natW = 1200;
    var natH = 800;
    var fitW = 1200;
    var fitH = 800;
    var zoom = 1;
    var dragState = null;
    var movedDuringPointer = false;
    var pinchStartDist = 0;
    var pinchStartZoom = 1;

    function clamp(v, lo, hi) {
      return Math.min(hi, Math.max(lo, v));
    }

    function isSvgImg(el) {
      if (!el || el.tagName !== "IMG") return false;
      var src = el.getAttribute("src") || "";
      return /\.svg([?#]|$)/i.test(src);
    }

    function decorateTargets(scope) {
      var imgs = scope.querySelectorAll('img[src*=".svg"]');
      Array.prototype.forEach.call(imgs, function (img) {
        if (!isSvgImg(img) || img.hasAttribute("data-pn-zoom")) return;
        img.setAttribute("data-pn-zoom", "1");
        if (!img.closest("a")) {
          img.setAttribute("tabindex", "0");
          img.setAttribute("role", "button");
        }
        if (!img.getAttribute("title")) {
          img.setAttribute("title", "Click to expand and zoom diagram");
        }
      });

      var mermaids = scope.querySelectorAll(".mermaid-figure");
      Array.prototype.forEach.call(mermaids, function (fig) {
        if (fig.hasAttribute("data-pn-zoom")) return;
        fig.setAttribute("data-pn-zoom", "1");
        fig.setAttribute("tabindex", "0");
        fig.setAttribute("role", "button");
        fig.setAttribute("title", "Click to expand and zoom diagram");
      });
    }

    function ensureDialog() {
      if (dialog) return;

      dialog = document.createElement("dialog");
      dialog.className = "pn-lightbox";
      dialog.setAttribute("aria-label", "Expanded architecture diagram viewer");
      dialog.innerHTML =
        '<div class="pn-lightbox__bar">' +
        '  <div class="pn-lightbox__meta">' +
        '    <p class="pn-lightbox__caption"></p>' +
        '    <p class="pn-lightbox__hint">Scroll or pinch to zoom (50%–600%) · Drag to pan · Double-click for 2.5× · Esc to close</p>' +
        "  </div>" +
        '  <div class="pn-lightbox__controls">' +
        '    <button type="button" class="pn-lightbox__btn" data-act="out" aria-label="Zoom out">−</button>' +
        '    <button type="button" class="pn-lightbox__btn" data-act="reset" aria-label="Reset zoom to fit">100%</button>' +
        '    <button type="button" class="pn-lightbox__btn" data-act="in" aria-label="Zoom in">+</button>' +
        '    <button type="button" class="pn-lightbox__btn" data-act="2x" aria-label="Zoom to 200%">200%</button>' +
        '    <a class="pn-lightbox__btn" data-act="raw" target="_blank" rel="noopener" aria-label="Open standalone SVG in new tab">SVG ↗</a>' +
        '    <button type="button" class="pn-lightbox__btn pn-lightbox__btn--close" data-act="close" aria-label="Close diagram viewer">✕</button>' +
        "  </div>" +
        "</div>" +
        '<div class="pn-lightbox__stage">' +
        '  <div class="pn-lightbox__canvas">' +
        '    <img class="pn-lightbox__img" alt="" />' +
        "  </div>" +
        "</div>";

      document.body.appendChild(dialog);
      stage = dialog.querySelector(".pn-lightbox__stage");
      canvas = dialog.querySelector(".pn-lightbox__canvas");
      modalImg = dialog.querySelector(".pn-lightbox__img");
      captionEl = dialog.querySelector(".pn-lightbox__caption");
      zoomResetBtn = dialog.querySelector('[data-act="reset"]');
      rawLink = dialog.querySelector('[data-act="raw"]');

      dialog.querySelector('[data-act="out"]').addEventListener("click", function () {
        setZoom(zoom / 1.25);
      });
      dialog.querySelector('[data-act="in"]').addEventListener("click", function () {
        setZoom(zoom * 1.25);
      });
      zoomResetBtn.addEventListener("click", function () {
        computeFit();
        setZoom(1);
      });
      dialog.querySelector('[data-act="2x"]').addEventListener("click", function () {
        setZoom(2);
      });
      dialog.querySelector('[data-act="close"]').addEventListener("click", closeLightbox);

      dialog.addEventListener("close", cleanupAfterClose);

      // Wheel / trackpad pinch zoom anchored at cursor.
      stage.addEventListener(
        "wheel",
        function (e) {
          e.preventDefault();
          var speed = e.ctrlKey ? 0.01 : 0.0022;
          var factor = Math.exp(-e.deltaY * speed);
          setZoom(zoom * factor, e.clientX, e.clientY);
        },
        { passive: false }
      );

      // Double-click toggles between 1x fit and 2.5x detail at pointer.
      stage.addEventListener("dblclick", function (e) {
        e.preventDefault();
        var target = zoom < 1.8 ? 2.5 : 1;
        setZoom(target, e.clientX, e.clientY);
      });

      // Mouse drag-to-pan + click-backdrop-to-close.
      stage.addEventListener("pointerdown", function (e) {
        if (e.pointerType === "touch" || e.button !== 0) return;
        movedDuringPointer = false;
        dragState = {
          id: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          scrollL: stage.scrollLeft,
          scrollT: stage.scrollTop,
          onBackdrop: e.target === stage || e.target === canvas,
          captured: false
        };
      });

      stage.addEventListener("pointermove", function (e) {
        if (!dragState || e.pointerId !== dragState.id) return;
        var dx = e.clientX - dragState.startX;
        var dy = e.clientY - dragState.startY;
        if (!movedDuringPointer && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
          movedDuringPointer = true;
          stage.classList.add("is-dragging");
          if (!dragState.captured && stage.setPointerCapture) {
            try {
              stage.setPointerCapture(e.pointerId);
              dragState.captured = true;
            } catch (err) {
              /* ignore */
            }
          }
        }
        if (movedDuringPointer) {
          stage.scrollLeft = dragState.scrollL - dx;
          stage.scrollTop = dragState.scrollT - dy;
        }
      });

      function endDrag() {
        if (!dragState) return;
        var shouldClose = !movedDuringPointer && dragState.onBackdrop;
        dragState = null;
        stage.classList.remove("is-dragging");
        if (shouldClose) {
          closeLightbox();
        }
      }

      stage.addEventListener("pointerup", endDrag);
      stage.addEventListener("pointercancel", endDrag);

      // Two-finger touch pinch-to-zoom on mobile/tablet.
      stage.addEventListener(
        "touchstart",
        function (e) {
          if (e.touches.length === 2) {
            pinchStartDist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
            pinchStartZoom = zoom;
          }
        },
        { passive: true }
      );

      stage.addEventListener(
        "touchmove",
        function (e) {
          if (e.touches.length === 2 && pinchStartDist > 0) {
            e.preventDefault();
            var dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
            var midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            var midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            setZoom(pinchStartZoom * (dist / pinchStartDist), midX, midY);
          }
        },
        { passive: false }
      );

      // Keyboard zoom & pan shortcuts while open.
      dialog.addEventListener("keydown", function (e) {
        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          setZoom(zoom * 1.25);
        } else if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          setZoom(zoom / 1.25);
        } else if (e.key === "0") {
          e.preventDefault();
          computeFit();
          setZoom(1);
        } else if (e.key === "ArrowLeft") {
          stage.scrollLeft -= 80;
        } else if (e.key === "ArrowRight") {
          stage.scrollLeft += 80;
        } else if (e.key === "ArrowUp") {
          stage.scrollTop -= 80;
        } else if (e.key === "ArrowDown") {
          stage.scrollTop += 80;
        }
      });

      window.addEventListener("resize", function () {
        if (dialog && dialog.open) {
          computeFit();
          applySize();
        }
      });
    }

    function computeFit() {
      var pad = window.innerWidth < 640 ? 24 : 48;
      var availW = Math.max(200, stage.clientWidth - pad);
      var availH = Math.max(200, stage.clientHeight - pad);
      var scale = Math.min(availW / natW, availH / natH);
      fitW = Math.max(160, natW * scale);
      fitH = Math.max(100, natH * scale);
    }

    function applySize() {
      modalImg.style.width = Math.round(fitW * zoom) + "px";
      modalImg.style.height = Math.round(fitH * zoom) + "px";
      zoomResetBtn.textContent = Math.round(zoom * 100) + "%";
    }

    function setZoom(nextZoom, anchorX, anchorY) {
      var clamped = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      var oldRect = modalImg.getBoundingClientRect();
      var cx =
        typeof anchorX === "number"
          ? anchorX
          : stage.getBoundingClientRect().left + stage.clientWidth / 2;
      var cy =
        typeof anchorY === "number"
          ? anchorY
          : stage.getBoundingClientRect().top + stage.clientHeight / 2;

      var fx = oldRect.width > 0 ? (cx - oldRect.left) / oldRect.width : 0.5;
      var fy = oldRect.height > 0 ? (cy - oldRect.top) / oldRect.height : 0.5;

      zoom = clamped;
      applySize();

      var newRect = modalImg.getBoundingClientRect();
      stage.scrollLeft += newRect.left + fx * newRect.width - cx;
      stage.scrollTop += newRect.top + fy * newRect.height - cy;
    }

    function serializeSvgToUrl(svgEl) {
      var clone = svgEl.cloneNode(true);
      if (!clone.getAttribute("xmlns")) {
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      }
      var vb = clone.getAttribute("viewBox");
      var w = 1200;
      var h = 800;
      if (vb) {
        var parts = vb.trim().split(/[\s,]+/);
        if (parts.length === 4) {
          w = parseFloat(parts[2]) || w;
          h = parseFloat(parts[3]) || h;
        }
      } else {
        var rect = svgEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          w = rect.width;
          h = rect.height;
        }
      }
      clone.setAttribute("width", String(w));
      clone.setAttribute("height", String(h));
      var xml = new XMLSerializer().serializeToString(clone);
      var blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      return { url: URL.createObjectURL(blob), w: w, h: h };
    }

    function openLightbox(src, title, triggerEl, wHint, hHint, isTempBlob) {
      ensureDialog();
      if (tempBlobUrl) {
        URL.revokeObjectURL(tempBlobUrl);
        tempBlobUrl = null;
      }
      if (isTempBlob) {
        tempBlobUrl = src;
      }

      activeTrigger = triggerEl || null;
      captionEl.textContent = title || "Architecture Diagram";
      modalImg.alt = title || "Expanded architecture diagram";
      rawLink.href = src;

      modalImg.onload = function () {
        natW = modalImg.naturalWidth || wHint || 1200;
        natH = modalImg.naturalHeight || hHint || 800;
        zoom = 1;
        computeFit();
        applySize();
        stage.scrollLeft = Math.max(0, (stage.scrollWidth - stage.clientWidth) / 2);
        stage.scrollTop = Math.max(0, (stage.scrollHeight - stage.clientHeight) / 2);
      };

      document.body.classList.add("pn-lightbox-open");
      if (!dialog.open) {
        if (typeof dialog.showModal === "function") {
          dialog.showModal();
        } else {
          dialog.setAttribute("open", "");
        }
      }
      modalImg.src = src;
    }

    function closeLightbox() {
      if (dialog && dialog.open) {
        if (typeof dialog.close === "function") {
          dialog.close();
        } else {
          dialog.removeAttribute("open");
          cleanupAfterClose();
        }
      }
    }

    function cleanupAfterClose() {
      document.body.classList.remove("pn-lightbox-open");
      if (modalImg) {
        modalImg.removeAttribute("src");
      }
      if (tempBlobUrl) {
        URL.revokeObjectURL(tempBlobUrl);
        tempBlobUrl = null;
      }
      if (activeTrigger && typeof activeTrigger.focus === "function") {
        activeTrigger.focus({ preventScroll: true });
      }
      activeTrigger = null;
    }

    function handleActivate(target, event) {
      var img = target.closest ? target.closest("img") : null;
      if (img && isSvgImg(img)) {
        var parentLink = img.closest("a");
        if (parentLink) {
          var href = parentLink.getAttribute("href") || "";
          if (!/\.svg([?#]|$)/i.test(href)) {
            return;
          }
        }
        event.preventDefault();
        openLightbox(
          img.currentSrc || img.src,
          img.getAttribute("alt") || document.title,
          img,
          img.naturalWidth,
          img.naturalHeight,
          false
        );
        return;
      }

      var mermaidFig = target.closest ? target.closest(".mermaid-figure") : null;
      var svgEl = mermaidFig
        ? mermaidFig.querySelector("svg")
        : target.closest
        ? target.closest("svg")
        : null;
      if (svgEl && !svgEl.closest("button, a")) {
        var box = svgEl.getBoundingClientRect();
        if (box.width < 120) return;
        event.preventDefault();
        var titleNode = svgEl.querySelector("title");
        var serialized = serializeSvgToUrl(svgEl);
        openLightbox(
          serialized.url,
          (titleNode && titleNode.textContent) || "Architecture Diagram",
          mermaidFig || svgEl,
          serialized.w,
          serialized.h,
          true
        );
      }
    }

    Array.prototype.forEach.call(containers, function (container) {
      decorateTargets(container);

      container.addEventListener("click", function (e) {
        handleActivate(e.target, e);
      });

      container.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          handleActivate(e.target, e);
        }
      });

      if (window.MutationObserver) {
        var mo = new MutationObserver(function () {
          decorateTargets(container);
        });
        mo.observe(container, { childList: true, subtree: true });
      }
    });
  }
})();

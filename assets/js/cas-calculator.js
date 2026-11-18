(function () {
  var root = document.getElementById("cas-breakeven-calc");
  if (!root) return;

  var ANCHOR = "#interactive-non-cas-vs-cas-cold-storage-calculator";
  var elTb = document.getElementById("calc-tb");
  var elDays = document.getElementById("calc-days");
  var elRep = document.getElementById("calc-rep");
  var elComp = document.getElementById("calc-comp");
  var copyBtn = document.getElementById("calc-copy-link");

  function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  // Hydrate sliders from URL query parameters (?tb=30&days=26&rep=9&comp=15.2) when present.
  try {
    var params = new URLSearchParams(window.location.search);
    if (params.has("tb")) elTb.value = clamp(parseFloat(params.get("tb")) || 30, 1, 100);
    if (params.has("days")) elDays.value = clamp(parseFloat(params.get("days")) || 26, 5, 90);
    if (params.has("rep")) elRep.value = clamp(parseInt(params.get("rep"), 10) || 9, 2, 12);
    if (params.has("comp")) elComp.value = clamp(parseFloat(params.get("comp")) || 15.2, 8, 20);
  } catch (e) {
    /* ignore malformed query strings */
  }

  function buildPermalink() {
    var base = window.location.origin + window.location.pathname;
    var tb = parseFloat(elTb.value);
    var days = parseFloat(elDays.value);
    var rep = parseInt(elRep.value, 10);
    var comp = parseFloat(elComp.value);
    if (tb === 30 && days === 26 && rep === 9 && Math.abs(comp - 15.2) < 0.05) {
      return base + ANCHOR;
    }
    return base + "?tb=" + tb + "&days=" + days + "&rep=" + rep + "&comp=" + comp + ANCHOR;
  }

  function fmtUSD(n) {
    return "$" + Math.round(n).toLocaleString("en-US");
  }

  function update() {
    var tb = parseFloat(elTb.value);
    var days = parseFloat(elDays.value);
    var rep = parseInt(elRep.value, 10);
    var comp = parseFloat(elComp.value);

    document.getElementById("calc-tb-val").textContent = tb + " TB/day";
    document.getElementById("calc-days-val").textContent = days + " days";
    document.getElementById("calc-rep-val").textContent = rep + " replicas";
    document.getElementById("calc-comp-val").textContent = comp.toFixed(1).replace(/\.0$/, "") + "×";

    var poolTB = (tb * days) / comp;
    var stdDays = Math.min(days, 23);
    var iaDays = Math.max(0, days - 23);
    var blendedPerTB = ((stdDays * 23.55) + (iaDays * 12.80)) / days;

    var gen3 = poolTB * blendedPerTB + Math.max(15, tb * 0.75);
    var gen2 = poolTB * blendedPerTB * rep + Math.max(15, tb * 0.65 * rep * 0.35);
    var saveMo = Math.max(0, gen2 - gen3);
    var saveYr = saveMo * 12;

    document.getElementById("calc-pool-out").textContent = poolTB.toFixed(1) + " TB";
    document.getElementById("calc-gen2-out").textContent = fmtUSD(gen2) + "/mo";
    document.getElementById("calc-gen3-out").textContent = fmtUSD(gen3) + "/mo";
    document.getElementById("calc-save-out").textContent = fmtUSD(saveMo) + "/mo";

    var verdict = document.getElementById("calc-verdict");
    if (saveMo < 600) {
      verdict.innerHTML =
        "<strong>Recommended: Gen 2 (Tuned Non-CAS 26.8 LTS).</strong> At <strong>" +
        fmtUSD(saveMo) +
        "/mo</strong> (" +
        fmtUSD(saveYr) +
        "/yr) in cold S3 delta, keep 100% GA upstream LTS, S3 Bucket Versioning, and per-replica blast-radius isolation.";
    } else if (saveMo < 1800) {
      verdict.innerHTML =
        "<strong>Borderline Zone (" +
        fmtUSD(saveYr) +
        "/yr saved):</strong> Start on <strong>Gen 2 (26.8 LTS)</strong> if you require strict LTS/S3 Versioning, or flip <code>cas_config.enabled = true</code> if you rely on elastic Spot readers or Multi-AZ cold queries.";
    } else {
      verdict.innerHTML =
        "<strong>Recommended: Gen 3 (Source-Tuned CAS).</strong> Saving <strong>" +
        fmtUSD(saveYr) +
        "/year</strong> in duplicate cold S3 plus ~3-second zero-copy reader scale-outs decisively justifies Altinity Antalya, 36-byte deterministic UUIDs, and nightly isolated backups.";
    }
  }

  [elTb, elDays, elRep, elComp].forEach(function (el) {
    el.addEventListener("input", update);
  });

  Array.prototype.forEach.call(root.querySelectorAll(".pn-calc__preset[data-tb]"), function (btn) {
    btn.addEventListener("click", function () {
      elTb.value = btn.getAttribute("data-tb");
      elDays.value = btn.getAttribute("data-days");
      elRep.value = btn.getAttribute("data-rep");
      elComp.value = btn.getAttribute("data-comp");
      update();
    });
  });

  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var url = buildPermalink();
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", url);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          copyBtn.textContent = "Copied!";
          window.setTimeout(function () {
            copyBtn.textContent = "Copy Permalink";
          }, 1600);
        });
      }
    });
  }

  update();
})();

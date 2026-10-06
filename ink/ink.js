/* V · Ink, the behaviours. Deferred, after nts.js; the pages read fully
   without it.
     bleed    the world bleed-in takes the ink's form: a blob that spreads
              from the page's entity, slowly (3.2s), hard-edged like print.
              Set on NTS.bleed before nts.js's trigger can fire.
     inked    once a plate's scroll-driven spread is complete, the element
              gets .is-inked and the stylesheet pins it: ink does not
              un-spread when you scroll back up.
     press    a fingertip on open paper (not on a link, a control or an
              entity) leaves a drop of the nearest world's accent that dries.
   Everything checks prefers-reduced-motion. */
(function () {
  "use strict";
  var still = matchMedia("(prefers-reduced-motion: reduce)");

  /* the bleed-in's form: radius profile F (240 steps around), min 0.703 */
  var F = [0.855,0.794,0.89,0.89,0.879,0.869,0.843,0.83,0.866,0.914,0.895,0.941,0.88,0.893,0.875,0.875,0.881,0.868,0.911,0.83,0.933,0.913,0.915,0.907,0.911,0.99,0.857,0.864,0.935,0.777,0.812,0.897,0.901,0.926,0.942,0.877,0.864,0.846,0.822,0.84,0.881,0.847,0.863,0.822,0.841,0.826,0.823,0.816,0.804,0.892,0.786,0.816,0.825,0.832,0.81,0.759,0.844,0.857,0.703,0.887,0.833,0.832,0.812,0.829,0.811,0.865,0.861,0.886,0.904,0.863,0.846,0.854,0.885,0.914,0.882,0.878,0.866,0.903,0.91,0.893,0.94,0.887,0.841,0.835,0.885,0.895,0.886,0.798,0.877,0.747,0.817,0.791,0.862,0.825,0.825,0.807,0.828,0.813,0.792,0.804,0.773,0.81,0.784,0.808,0.831,0.84,0.877,0.887,0.951,0.904,0.892,0.848,0.845,0.865,0.892,0.996,0.93,0.984,0.956,0.926,0.902,0.979,0.92,0.95,0.959,0.938,0.93,0.931,0.916,0.902,0.944,0.898,0.942,0.91,0.921,0.924,0.919,0.926,0.875,0.957,0.873,0.919,0.938,0.949,0.931,0.831,0.948,0.931,0.852,1,0.96,0.885,0.907,0.907,0.895,0.929,0.884,0.849,0.851,0.85,0.84,0.888,0.849,0.842,0.779,0.779,0.799,0.831,0.848,0.736,0.803,0.741,0.722,0.722,0.755,0.809,0.723,0.716,0.888,0.726,0.792,0.788,0.792,0.761,0.78,0.743,0.771,0.77,0.772,0.838,0.883,0.896,0.865,0.812,0.81,0.796,0.827,0.838,0.881,0.919,0.852,0.866,0.882,0.893,0.874,0.894,0.907,0.967,0.849,0.956,0.891,0.939,0.889,0.932,0.926,0.937,0.916,0.937,0.955,0.928,0.94,0.892,0.927,0.928,0.933,0.943,0.913,0.904,0.841,0.886,0.886,0.908,0.892,0.876,0.882,0.827,0.931,0.878,0.871,0.855];
  var FMIN = 0.703, FMAX = 1, N = F.length;
  var NTS = window.NTS = window.NTS || {};
  NTS.bleed = NTS.bleed || {};
  NTS.bleed.duration = 3200;
  NTS.bleed.form = {
    _c: null,
    centre: function (w, h) {
      if (this._c) return this._c;
      var e = document.querySelector(".hero .entity"), cx = w / 2, cy = h / 2;
      if (e) { var r = e.getBoundingClientRect(); if (r.width || r.height) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; } }
      var far = Math.max(Math.hypot(cx, cy), Math.hypot(w - cx, cy), Math.hypot(cx, h - cy), Math.hypot(w - cx, h - cy));
      this._c = { cx: cx, cy: cy, R: far / FMIN + 2 };
      return this._c;
    },
    clip: function (p, w, h) {
      var c = this.centre(w, h), pts = [];
      for (var i = 0; i < N; i++) {
        var th = (i / N) * Math.PI * 2, r = p * c.R * F[i];
        pts.push((c.cx + r * Math.cos(th)).toFixed(1) + "px " + (c.cy + r * Math.sin(th)).toFixed(1) + "px");
      }
      return "polygon(" + pts.join(",") + ")";
    },
    cover: function (b, w, h) {
      var c = this.centre(w, h);
      var dx = Math.max(b.x0 - c.cx, 0, c.cx - b.x1), dy = Math.max(b.y0 - c.cy, 0, c.cy - b.y1);
      var fx = Math.max(Math.abs(b.x0 - c.cx), Math.abs(b.x1 - c.cx)), fy = Math.max(Math.abs(b.y0 - c.cy), Math.abs(b.y1 - c.cy));
      return [Math.hypot(dx, dy) / (c.R * FMAX), Math.hypot(fx, fy) / (c.R * FMIN)];
    }
  };

  /* ink stays: pin a plate once its spread has completed */
  var plates = Array.prototype.slice.call(document.querySelectorAll(".world, .ink-band"));
  if (plates.length && !still.matches && CSS.supports("animation-timeline: view()")) {
    var queued = false;
    var check = function () {
      queued = false;
      plates = plates.filter(function (el) {
        var done = el.getAnimations({ subtree: true }).some(function (a) {
          if (a.animationName !== "ink-spread" || !a.effect || !a.effect.pseudoElement) return false;
          var t = a.effect.getComputedTiming();
          return t.progress !== null && t.progress >= 0.999;
        });
        if (done) el.classList.add("is-inked");
        return !done;
      });
      if (!plates.length) removeEventListener("scroll", onScroll);
    };
    var onScroll = function () { if (!queued) { queued = true; requestAnimationFrame(check); } };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* a fingertip on the paper */
  var main = document.querySelector("main");
  if (main && "PointerEvent" in window) {
    var live = 0;
    main.addEventListener("pointerdown", function (ev) {
      if (!ev.isPrimary || ev.button > 0 || live > 10) return;
      var t = ev.target;
      if (!(t instanceof Element) || t.closest("a, button, summary, details, canvas, pre, input, textarea, select, label, [tabindex], .orb, .nts-penrose, .hearth-stage, .mega")) return;
      var world = t.closest("[data-world]") || document.body;
      var drop = document.createElement("span");
      drop.className = "ink-press";
      drop.setAttribute("aria-hidden", "true");
      drop.style.left = (ev.clientX + scrollX) + "px";
      drop.style.top = (ev.clientY + scrollY) + "px";
      drop.style.color = getComputedStyle(world).getPropertyValue("--w-accent").trim() || "currentColor";
      drop.style.setProperty("--turn", Math.round(Math.random() * 360) + "deg");
      live++;
      drop.addEventListener("animationend", function () { drop.remove(); live--; });
      document.body.appendChild(drop);
    }, { passive: true });
  }
})();

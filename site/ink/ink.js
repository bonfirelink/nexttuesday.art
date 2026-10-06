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

  /* the bleed-in's form: radius profile F (96 steps around), min 0.776 */
  var F = [0.876,0.92,0.907,0.895,0.959,0.932,0.925,0.922,0.943,0.961,0.965,0.917,0.88,0.964,0.934,0.879,0.901,0.887,0.866,0.866,0.867,0.853,0.85,0.847,0.874,0.863,0.887,0.932,0.897,0.936,0.925,0.941,0.954,0.893,0.927,0.871,0.841,0.873,0.855,0.847,0.829,0.847,0.884,0.955,0.931,0.9,0.997,1,0.977,0.994,0.988,0.967,0.965,0.967,0.964,0.959,0.953,0.981,0.945,0.966,0.985,0.942,0.954,0.893,0.903,0.883,0.826,0.861,0.8,0.776,0.796,0.811,0.825,0.814,0.805,0.816,0.91,0.887,0.843,0.912,0.921,0.919,0.945,0.961,0.957,0.967,0.973,0.986,0.972,0.964,0.982,0.921,0.935,0.93,0.912,0.931];
  var FMIN = 0.776, FMAX = 1, N = F.length;
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

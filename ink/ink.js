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

  /* the bleed-in's form: a smooth radius profile F (240 steps around, min 0.878)
     and a fine jitter G of J px, so the edge is ragged like print at any
     scale; cover() allows for both */
  var F = [0.947,0.947,0.947,0.948,0.949,0.95,0.951,0.953,0.955,0.957,0.958,0.96,0.962,0.964,0.965,0.967,0.968,0.969,0.969,0.97,0.97,0.97,0.97,0.97,0.969,0.969,0.968,0.967,0.965,0.964,0.962,0.96,0.959,0.957,0.955,0.953,0.95,0.948,0.946,0.943,0.941,0.938,0.935,0.933,0.93,0.928,0.925,0.923,0.921,0.919,0.917,0.916,0.915,0.914,0.914,0.914,0.914,0.915,0.916,0.918,0.921,0.923,0.926,0.929,0.933,0.937,0.941,0.945,0.948,0.952,0.956,0.959,0.962,0.964,0.966,0.967,0.967,0.967,0.967,0.965,0.963,0.961,0.957,0.954,0.949,0.945,0.94,0.936,0.931,0.926,0.922,0.918,0.914,0.912,0.909,0.908,0.907,0.907,0.908,0.909,0.912,0.915,0.919,0.923,0.928,0.934,0.94,0.946,0.952,0.958,0.964,0.97,0.976,0.981,0.985,0.989,0.993,0.995,0.998,0.999,1,1,1,0.999,0.998,0.996,0.994,0.992,0.99,0.988,0.987,0.985,0.983,0.982,0.981,0.981,0.98,0.98,0.981,0.981,0.982,0.983,0.984,0.984,0.985,0.986,0.986,0.986,0.986,0.985,0.983,0.981,0.979,0.976,0.972,0.968,0.963,0.958,0.953,0.947,0.941,0.935,0.928,0.922,0.916,0.91,0.905,0.9,0.895,0.891,0.887,0.884,0.882,0.88,0.879,0.878,0.879,0.879,0.88,0.882,0.884,0.887,0.89,0.893,0.896,0.899,0.903,0.907,0.91,0.914,0.918,0.921,0.925,0.929,0.932,0.936,0.939,0.942,0.946,0.949,0.952,0.956,0.959,0.962,0.966,0.969,0.972,0.975,0.978,0.98,0.983,0.985,0.987,0.989,0.99,0.991,0.992,0.992,0.992,0.992,0.991,0.989,0.987,0.985,0.983,0.98,0.978,0.975,0.972,0.968,0.965,0.962,0.96,0.957,0.955,0.952,0.951,0.949,0.948,0.947];
  var G = [0.453,-0.01,-0.454,0.105,0.021,-0.268,-0.186,-0.398,0.376,0.503,0.141,0.073,-0.564,0.133,0.131,-0.359,0.7,-0.283,-0.97,0.418,0.361,-0.05,0.212,0.457,0.08,-0.605,-0.526,-0.191,0.402,0.258,-0.212,0.241,0.177,0.275,0.024,-0.679,-0.2,-0.097,0.317,0.379,-0.42,0.304,-0.149,-0.487,1,0.211,-0.703,-0.053,-0.043,-0.336,-0.281,0.416,0.658,0.284,-0.185,-0.521,0.085,0.022,-0.302,-0.103,-0.22,0.486,0.515,-0.026,-0.055,-0.559,0.134,0.199,-0.36,0.602,-0.319,-0.899,0.609,0.442,-0.088,0.186,0.312,-0.123,-0.705,-0.416,0.033,0.504,0.276,-0.231,0.24,0.154,0.109,-0.11,-0.713,-0.092,0.095,0.344,0.356,-0.457,0.246,-0.077,-0.424,0.966,0.061,-0.852,-0.017,0.014,-0.247,-0.088,0.548,0.614,0.058,-0.356,-0.541,0.109,0.06,-0.294,0.006,-0.053,0.533,0.455,-0.219,-0.165,-0.512,0.161,0.266,-0.366,0.514,-0.313,-0.797,0.779,0.469,-0.191,0.118,0.16,-0.28,-0.711,-0.234,0.266,0.56,0.238,-0.286,0.205,0.105,-0.052,-0.196,-0.669,0.058,0.276,0.329,0.294,-0.5,0.194,-0.007,-0.384,0.895,-0.083,-0.952,0.082,0.118,-0.15,0.073,0.596,0.485,-0.191,-0.487,-0.494,0.178,0.126,-0.261,0.114,0.077,0.508,0.337,-0.411,-0.235,-0.417,0.208,0.324,-0.376,0.436,-0.276,-0.684,0.908,0.434,-0.344,0.036,0.035,-0.369,-0.627,-0.009,0.468,0.547,0.139,-0.367,0.152,0.053,-0.183,-0.221,-0.557,0.224,0.419,0.262,0.195,-0.54,0.154,0.062,-0.365,0.801,-0.203,-0.991,0.234,0.244,-0.075,0.176,0.561,0.295,-0.424,-0.549,-0.375,0.283,0.2,-0.227,0.197,0.155,0.416,0.183,-0.573,-0.249,-0.275,0.265,0.365,-0.393,0.367,-0.218,-0.576,0.983,0.343,-0.524,-0.03,-0.037,-0.385,-0.473,0.221,0.607];
  var FMIN = 0.878, FMAX = 1, N = F.length, J = 7;
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
      this._c = { cx: cx, cy: cy, R: (far + J) / FMIN + 2 };
      return this._c;
    },
    clip: function (p, w, h) {
      var c = this.centre(w, h), pts = [];
      for (var i = 0; i < N; i++) {
        var th = (i / N) * Math.PI * 2, r = Math.max(0, p * c.R * F[i] + G[i] * J);
        pts.push((c.cx + r * Math.cos(th)).toFixed(1) + "px " + (c.cy + r * Math.sin(th)).toFixed(1) + "px");
      }
      return "polygon(" + pts.join(",") + ")";
    },
    cover: function (b, w, h) {
      var c = this.centre(w, h);
      var dx = Math.max(b.x0 - c.cx, 0, c.cx - b.x1), dy = Math.max(b.y0 - c.cy, 0, c.cy - b.y1);
      var fx = Math.max(Math.abs(b.x0 - c.cx), Math.abs(b.x1 - c.cx)), fy = Math.max(Math.abs(b.y0 - c.cy), Math.abs(b.y1 - c.cy));
      return [Math.max(0, Math.hypot(dx, dy) - J) / (c.R * FMAX), (Math.hypot(fx, fy) + J) / (c.R * FMIN)];
    }
  };

  /* ink stays: pin a plate once its spread has completed */
  var plates = Array.prototype.slice.call(document.querySelectorAll(".world, .ink-band"));
  if (plates.length && !still.matches && CSS.supports("animation-timeline: view()")) {
    var queued = false;
    var check = function () {
      queued = false;
      plates = plates.filter(function (el) {
        /* pinned once the plate and the text that arrives on it are both complete */
        var spread = false, done = el.getAnimations({ subtree: true }).every(function (a) {
          if (a.animationName !== "ink-spread" && a.animationName !== "arrive") return true;
          if (a.animationName === "ink-spread") spread = true;
          var t = a.effect.getComputedTiming();
          return t.progress !== null && t.progress >= 0.999;
        }) && spread;
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
      if (!(t instanceof Element) || t.closest("a, button, summary, details, canvas, pre, input, textarea, select, label, [tabindex], .orb, .nts-penrose, .hearth-stage, .mega, .entity, .sky, .orrery, .compass, .words-star, svg")) return;
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

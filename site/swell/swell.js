/* II · Swell, the behaviours. Deferred, after nts.js; the page reads fully
   without it (the waves are CSS).
     bleed    the world bleed-in arrives as the same wave, sweeping up the
              viewport: a custom NTS.bleed.form whose clip is the wave's
              polygon and whose cover reads the wave's band at the box
     surge    --surge on :root follows how fast the page is scrolled, so a
              fast scroll deepens the troughs for a moment (the quirk "scroll
              fast, the sea swells"); it decays back to calm
   Everything checks prefers-reduced-motion. */
(function () {
  "use strict";
  var root = document.documentElement;
  var still = matchMedia("(prefers-reduced-motion: reduce)");
  var px = function (el, name) {
    var v = getComputedStyle(el).getPropertyValue(name).trim();
    var probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;width:" + v;
    document.body.appendChild(probe);
    var n = probe.getBoundingClientRect().width;
    probe.remove();
    return n;
  };

  /* the bleed: the world's ground rises as a wave from the bottom of the viewport */
  var NTS = window.NTS = window.NTS || {};
  NTS.bleed = NTS.bleed || {};
  var wave = {
    A: 0, L: 0, stepped: document.body.getAttribute("data-world") === "intersect",
    measure: function () {
      if (!this.L) { this.A = (px(root, "--swell-amp") || 40) * .7; this.L = px(document.body, "--swell-lambda") || 340; }
    },
    /* the edge's height at x, in -1..1: a sine, or INTERSECT's twelve steps */
    s: function (x) {
      var t = x / this.L;
      if (this.stepped) t = (Math.floor(t * 12) + .5) / 12;
      return Math.sin(2 * Math.PI * t);
    },
    /* the extremes of the edge over an x-range: the full swing once the range
       holds a crest or a trough, else the ends */
    swing: function (x0, x1) {
      var L = this.L, lo = 1, hi = -1, k;
      var ends = [this.s(x0), this.s(x1)];
      lo = Math.min(ends[0], ends[1]); hi = Math.max(ends[0], ends[1]);
      if (x1 - x0 >= L) return [-1, 1];
      for (k = Math.floor(x0 / L) - 1; k <= Math.ceil(x1 / L); k++) {
        var c = (k + .25) * L, t = (k + .75) * L;
        if (c >= x0 && c <= x1) hi = 1;
        if (t >= x0 && t <= x1) lo = -1;
      }
      return [lo, hi];
    },
    /* the baseline at progress p travels from below the viewport (crest just
       touching the bottom) to above it (trough just leaving the top) */
    base: function (p, h) { this.measure(); return (h + this.A) - p * (h + 2 * this.A); },
    clip: function (p, w, h) {
      var yb = this.base(p, h), A = this.A, L = this.L, pts = [], n = Math.max(24, Math.ceil(w / L) * (this.stepped ? 48 : 16));
      for (var i = 0; i <= n; i++) {
        var x = w * i / n, y = yb - A * this.s(this.stepped ? x + .001 : x);
        if (this.stepped && i) { var xp = w * (i - 1) / n; pts.push(x.toFixed(1) + "px " + (yb - A * this.s(xp + .001)).toFixed(1) + "px"); }
        pts.push(x.toFixed(1) + "px " + y.toFixed(1) + "px");
      }
      pts.push(w + "px " + (h + 3 * A) + "px", "0px " + (h + 3 * A) + "px");
      return "polygon(" + pts.join(",") + ")";
    },
    /* first touched when the edge's highest point over the box reaches its
       bottom; covered when its lowest point passes the box's top */
    cover: function (b, w, h) {
      this.measure();
      var span = h + 2 * this.A, sw = this.swing(b.x0, b.x1);
      return [(h + this.A - b.y1 - this.A * sw[1]) / span, (h + this.A - b.y0 - this.A * sw[0]) / span];
    }
  };
  NTS.bleed.form = wave;
  /* the crest-first part of a block's crossing is skipped as one jump, so the
     waves on the page itself (masks on real elements) also cross whole */
  NTS.bleed.blocks = ".swell, .sea, .buoy";

  /* the surge */
  if (still.matches) return;
  var lastY = scrollY, lastT = performance.now(), surge = 0, raf = 0;
  var tick = function (now) {
    surge *= Math.pow(.2, (now - lastT) / 1000);
    lastT = now;
    if (surge < .02) { surge = 0; root.style.removeProperty("--surge"); raf = 0; return; }
    root.style.setProperty("--surge", surge.toFixed(3));
    raf = requestAnimationFrame(tick);
  };
  addEventListener("scroll", function () {
    var now = performance.now(), y = scrollY, dt = Math.max(16, now - lastT);
    var v = Math.abs(y - lastY) / dt; /* px per ms */
    lastY = y; lastT = now;
    surge = Math.min(1, Math.max(surge, (v - .6) / 2.4));
    if (surge > 0 && !raf) raf = requestAnimationFrame(tick);
  }, { passive: true });
})();

/* The world pages' bleed-in: the world's ground opens as a
   disc from the page's entity (the hearth, the triangle, the solid), the
   same figure as the apertures that open from their rings. Deferred after
   nts.js, before the bleed can start; it only sets the form, nts.js does
   the crossing. The disc's centre is read from the entity on the first
   call, when the front's box is the viewport's: the entity may be partly
   above the fold by then, so the centre is clamped into the box. */
(function () {
  "use strict";
  var NTS = window.NTS = window.NTS || {};
  NTS.bleed = NTS.bleed || {};
  var c = null;
  function centre(w, h) {
    if (c) return c;
    var el = document.querySelector(".hero .entity .nts-hearth, .hero .entity .nts-penrose, .hero .entity [data-nts-ascii], .hero .entity");
    var x = w / 2, y = h * 0.4;
    if (el) {
      var r = el.getBoundingClientRect();
      if (r.width && r.height) { x = r.left + r.width / 2; y = r.top + r.height / 2; }
    }
    x = Math.max(0, Math.min(w, x)); y = Math.max(0, Math.min(h, y));
    /* the radius that reaches the farthest corner, as a fraction of the box's reference radius */
    var R = Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));
    c = { x: x, y: y, R: R };
    return c;
  }
  NTS.bleed.form = {
    clip: function (p, w, h) {
      var k = centre(w, h);
      return "circle(" + (p * k.R).toFixed(1) + "px at " + k.x.toFixed(1) + "px " + k.y.toFixed(1) + "px)";
    },
    cover: function (b, w, h) {
      var k = centre(w, h);
      var dx = Math.max(b.x0 - k.x, 0, k.x - b.x1), dy = Math.max(b.y0 - k.y, 0, k.y - b.y1);
      var fx = Math.max(Math.abs(b.x0 - k.x), Math.abs(b.x1 - k.x)), fy = Math.max(Math.abs(b.y0 - k.y), Math.abs(b.y1 - k.y));
      return [Math.hypot(dx, dy) / k.R, Math.hypot(fx, fy) / k.R];
    }
  };
  addEventListener("nts:bleed", function (e) { if (e.detail && e.detail.phase === "end") c = null; });
})();

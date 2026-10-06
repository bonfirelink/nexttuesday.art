/* IV · Frame, the world pages' bleed-in form. Deferred, after nts.js and
   before the bleed's timer fires (data-bleed="time"). The world's colour
   arrives as a frame filling in from the viewport's edges: the sides fill
   the page's margins (the gutter, measured from main's .wrap), while the
   top and bottom close in on the middle line; the front is the viewport
   minus that shrinking hole, drawn as an even-odd path. The sides stop at
   the gutter on purpose: a side that kept closing would touch every line
   of text at once and nts.js would have to flip the whole page in one
   jump. cover() tells nts.js when the frame first touches a box and when
   the hole has closed over it, so each text block flips whole as the
   frame reaches it, as with the sweep. */
(function () {
  "use strict";
  var NTS = window.NTS = window.NTS || {};
  NTS.bleed = NTS.bleed || {};
  var gutter = function (w) {
    var wrap = document.querySelector("main .wrap");
    var g = wrap ? (w - wrap.getBoundingClientRect().width) / 2 : 16;
    return Math.max(12, Math.min(g, w / 4));
  };
  NTS.bleed.form = {
    clip: function (p, w, h) {
      var x = Math.min(p * w / 2, gutter(w)), y = p * h / 2;
      return "path(evenodd, 'M0 0H" + w + "V" + h + "H0Z M" + x.toFixed(2) + " " + y.toFixed(2) + "H" + (w - x).toFixed(2) + "V" + (h - y).toFixed(2) + "H" + x.toFixed(2) + "Z')";
    },
    cover: function (b, w, h) {
      var G = gutter(w), hw = w / 2, hh = h / 2;
      var p0 = Math.min(b.y0, h - b.y1) / hh;
      if (b.x0 < G) p0 = Math.min(p0, b.x0 / hw);
      if (b.x1 > w - G) p0 = Math.min(p0, (w - b.x1) / hw);
      p0 = Math.max(0, p0);
      var cy = Math.max(b.y0, Math.min(hh, b.y1));
      var p1 = Math.max(p0, Math.min(cy, h - cy) / hh);
      return [p0, p1];
    }
  };
})();

/* IV · Frame, the world pages' bleed-in form. Deferred, after nts.js and
   before the bleed's timer fires (data-bleed="time"). The world's colour
   arrives as a frame closing in from the viewport's edges: the front is the
   viewport minus a central hole that keeps the viewport's proportions as it
   shrinks to a point,
   drawn as an even-odd path. cover() tells nts.js when the frame first
   touches a box (its edge nearest the viewport's edge) and when the hole
   has closed over it (the box's point nearest the centre), so text blocks
   flip whole as the frame reaches them. */
(function () {
  "use strict";
  var NTS = window.NTS = window.NTS || {};
  NTS.bleed = NTS.bleed || {};
  NTS.bleed.form = {
    clip: function (p, w, h) {
      var x = p * w / 2, y = p * h / 2;
      return "path(evenodd, 'M0 0H" + w + "V" + h + "H0Z M" + x.toFixed(2) + " " + y.toFixed(2) + "H" + (w - x).toFixed(2) + "V" + (h - y).toFixed(2) + "H" + x.toFixed(2) + "Z')";
    },
    cover: function (b, w, h) {
      var depth = function (x, y) { return Math.min(x / (w / 2), (w - x) / (w / 2), y / (h / 2), (h - y) / (h / 2)); };
      var near = Math.max(0, Math.min(depth(b.x0, b.y0), depth(b.x1, b.y1), depth(b.x0, b.y1), depth(b.x1, b.y0)));
      var cx = Math.max(b.x0, Math.min(w / 2, b.x1)), cy = Math.max(b.y0, Math.min(h / 2, b.y1));
      return [near, Math.max(near, depth(cx, cy))];
    }
  };
})();

/* I · Doors: which element is the door. The home page's three cards and the
   world pages' heroes share the view-transition-names "door", "door-view"
   and "door-title", but only one card may carry them at a time, and a hero
   carries them only on the way from or back to this variant's home. Before
   the page is swapped out, the card that leads to the destination (or the
   hero, when the destination is home) is marked; when the new page is
   revealed, the matching element on this side is marked, so the card
   becomes the page and the page folds back into its card. Browsers without
   the Navigation API or cross-document view transitions ignore all of this
   and navigate normally. */
(function () {
  "use strict";
  var re = /\/(embers|not-not-philo|intersect)\/(index\.html)?$/;
  var root = location.pathname.replace(re, "/").replace(/index\.html$/, "");
  var isHome = document.body.hasAttribute("data-nts-home");
  var hero = isHome ? null : document.querySelector(".hero");
  var onWorld = !isHome && !!hero && re.test(location.pathname);
  function pathOf(url) {
    try { return new URL(url, location.href).pathname; } catch (e) { return ""; }
  }
  function worldOf(url) {
    var m = re.exec(pathOf(url));
    return m ? (m[1] === "not-not-philo" ? "philo" : m[1]) : null;
  }
  function homeIs(url) { return pathOf(url).replace(/index\.html$/, "") === root; }
  function mark(url) {
    document.querySelectorAll(".is-door").forEach(function (c) { c.classList.remove("is-door"); });
    if (!url) return null;
    var el = isHome
      ? document.querySelector('.door-card[data-door="' + worldOf(url) + '"]')
      : (onWorld && homeIs(url) ? hero : null);
    if (el) el.classList.add("is-door");
    return el;
  }
  mark(null);
  if (!("navigation" in window)) return;
  addEventListener("pageswap", function (e) {
    if (!e.viewTransition || !e.activation || !e.activation.entry) return;
    mark(e.activation.entry.url);
  });
  addEventListener("pagereveal", function (e) {
    if (!e.viewTransition) return;
    var from = navigation.activation && navigation.activation.from;
    if (mark(from && from.url)) {
      var clear = function () { mark(null); };
      e.viewTransition.finished.then(clear, clear);
    }
  });
})();

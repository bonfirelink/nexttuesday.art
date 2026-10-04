/* I · Doors: which card is the door. The home page's three cards and the
   world pages' heroes share one view-transition-name, "door", but only one
   card may carry it at a time. Before the page is swapped out, the card
   that leads to the destination gets it; when the home page is revealed on
   the way back, the card of the page we came from gets it, so the hero folds
   back into its card. Browsers without the Navigation API or cross-document
   view transitions ignore all of this and navigate normally. */
(function () {
  "use strict";
  var re = /\/(embers|not-not-philo|intersect)\/(index\.html)?$/;
  function worldOf(url) {
    try {
      var m = re.exec(new URL(url, location.href).pathname);
      return m ? (m[1] === "not-not-philo" ? "philo" : m[1]) : null;
    } catch (e) { return null; }
  }
  function mark(world) {
    document.querySelectorAll(".door-card.is-door").forEach(function (c) { c.classList.remove("is-door"); });
    var card = world && document.querySelector('.door-card[data-door="' + world + '"]');
    if (card) card.classList.add("is-door");
    return card;
  }
  mark(null);
  if (!("navigation" in window)) return;
  addEventListener("pageswap", function (e) {
    if (!e.viewTransition || !e.activation || !e.activation.entry) return;
    mark(worldOf(e.activation.entry.url));
  });
  addEventListener("pagereveal", function (e) {
    if (!e.viewTransition) return;
    var from = navigation.activation && navigation.activation.from;
    if (mark(from && worldOf(from.url))) {
      e.viewTransition.finished.then(function () { mark(null); }, function () { mark(null); });
    }
  });
})();

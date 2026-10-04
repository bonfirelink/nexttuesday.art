/* V · Quiet: the index. Each initiative is a line, and its world waits
   behind it. A line is awake while any reason holds: a pointer hovering
   it, focus on it, a press, or (on a touch screen) the line holding the
   middle of the screen as you scroll. Asleep, its fragment is taken out
   of the document so the world kits' own observers pause it; it comes
   back a frame before the wake, and the kits refit on the resize event.
   A tap always goes in: on the way, the line's name takes the shared
   view-transition name so the next page's title can carry it. */
(function () {
  "use strict";
  var lines = document.querySelectorAll(".idx-line");
  if (!lines.length) return;
  var touch = matchMedia("(hover: none)");
  var hover = matchMedia("(hover: hover)");
  var idx = lines[0].closest(".idx");
  if (idx) idx.classList.add("is-managed");

  lines.forEach(function (l) {
    var world = l.querySelector(".idx-world");
    var name = l.querySelector(".idx-name");
    var reasons = {}, hideTimer = 0;
    function update() {
      var awake = Object.keys(reasons).some(function (k) { return reasons[k]; });
      if (awake) {
        clearTimeout(hideTimer);
        if (world && !world.classList.contains("is-shown")) {
          world.classList.add("is-shown");
          dispatchEvent(new Event("resize"));
          requestAnimationFrame(function () { l.classList.add("is-awake"); });
        } else l.classList.add("is-awake");
      } else {
        l.classList.remove("is-awake");
        clearTimeout(hideTimer);
        hideTimer = setTimeout(function () { if (world) world.classList.remove("is-shown"); }, 1300);
      }
    }
    function set(k, v) { if (!!reasons[k] === !!v) return; reasons[k] = !!v; update(); }
    l.__set = set;

    if (hover.matches) {
      l.addEventListener("pointerenter", function () { set("hover", true); });
      l.addEventListener("pointerleave", function () { set("hover", false); });
    }
    l.addEventListener("focus", function () { set("focus", true); });
    l.addEventListener("blur", function () { set("focus", false); });
    l.addEventListener("pointerdown", function (e) { if (e.button === 0) set("press", true); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (t) {
      l.addEventListener(t, function () { set("press", false); });
    });
    l.addEventListener("click", function (e) {
      if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      lines.forEach(function (o) { var n = o.querySelector(".idx-name"); if (n) n.style.viewTransitionName = ""; });
      if (name) name.style.viewTransitionName = "nts-world-title";
    });
  });

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.__set("scroll", e.isIntersecting && touch.matches); });
    }, { rootMargin: "-49% 0px -49% 0px", threshold: 0 });
    lines.forEach(function (l) { io.observe(l); });
  }

  // a page restored from the back/forward cache must not keep the name
  addEventListener("pageshow", function () {
    lines.forEach(function (l) { var n = l.querySelector(".idx-name"); if (n) n.style.viewTransitionName = ""; });
  });
})();

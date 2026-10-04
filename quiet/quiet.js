/* V · Quiet: the index. Each initiative is a line, and its world waits
   behind it. On a screen with a pointer that hovers, the stylesheet wakes
   the line on hover and focus. On a touch screen the line that holds the
   middle of the screen is awake while it is there, and a press wakes it
   too. A tap always goes in: on the way, the line's name takes the shared
   view-transition name so the next page's title can carry it. */
(function () {
  "use strict";
  var lines = document.querySelectorAll(".idx-line");
  if (!lines.length) return;
  var touch = matchMedia("(hover: none)");

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle("is-awake", e.isIntersecting && touch.matches); });
    }, { rootMargin: "-40% 0px -40% 0px", threshold: 0 });
    lines.forEach(function (l) { io.observe(l); });
  }

  lines.forEach(function (l) {
    var name = l.querySelector(".idx-name");
    l.addEventListener("pointerdown", function (e) { if (e.button === 0) l.classList.add("is-pressed"); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (t) {
      l.addEventListener(t, function () { l.classList.remove("is-pressed"); });
    });
    l.addEventListener("click", function () { if (name) name.style.viewTransitionName = "nts-world-title"; });
  });

  // back/forward cache: a page restored from it must not keep the name
  addEventListener("pageshow", function () {
    lines.forEach(function (l) { var n = l.querySelector(".idx-name"); if (n) n.style.viewTransitionName = ""; });
  });
})();

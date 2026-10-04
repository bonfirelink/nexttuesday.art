/* Strata, the script side. Deferred; the stack works without it.
     tall plates  a plate taller than the viewport sticks with its bottom at
                  the viewport's bottom (--plate-top), so it scrolls through
                  before the next plate arrives and nothing is cut off
     --cover      where the browser has no scroll-driven animations, the
                  cover progress of each plate (0..1) is set on scroll and
                  strata.css reads it; .is-under hides a fully covered plate
     going in     on the way to a world page, the tapped plate's fragment and
                  the plate itself take the view-transition names the world
                  page's hero carries, so the plate becomes the page */
(function () {
  "use strict";
  var plates = [].slice.call(document.querySelectorAll(".stack .plate"));
  var header = document.querySelector(".nts-header");
  var barTop = function () { return header ? header.offsetHeight : 52; };

  if (plates.length) {
    var raf = 0;
    var fit = function () {
      raf = 0;
      var room = innerHeight - barTop();
      plates.forEach(function (p) {
        var over = p.offsetHeight - room;
        if (over > 0) { p.style.setProperty("--plate-top", (barTop() - over) + "px"); p.classList.add("is-tall"); }
        else { p.style.removeProperty("--plate-top"); p.classList.remove("is-tall"); }
      });
    };
    var ask = function () { if (!raf) raf = requestAnimationFrame(fit); };
    fit();
    addEventListener("resize", ask);
    if ("ResizeObserver" in window) { var ro = new ResizeObserver(ask); plates.forEach(function (p) { ro.observe(p); }); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(ask);

    var native = window.CSS && CSS.supports && CSS.supports("animation-timeline: view()") && CSS.supports("timeline-scope: --a");
    if (!native) {
      var slots = plates.map(function (p) { return p.parentElement; });
      var tick = 0;
      var cover = function () {
        tick = 0;
        var V = innerHeight, t = barTop();
        for (var i = 0; i < plates.length - 1; i++) {
          var y = slots[i + 1].getBoundingClientRect().top;
          var c = Math.min(1, Math.max(0, (V - y) / (V - t)));
          plates[i].style.setProperty("--cover", c.toFixed(3));
          plates[i].classList.toggle("is-under", c >= 1);
        }
      };
      var onScroll = function () { if (!tick) tick = requestAnimationFrame(cover); };
      addEventListener("scroll", onScroll, { passive: true });
      addEventListener("resize", onScroll);
      cover();
    }
  }

  /* going in */
  addEventListener("pageswap", function (e) {
    if (!e.viewTransition || !e.activation || !e.activation.entry) return;
    var m;
    try { m = new URL(e.activation.entry.url).pathname.match(/\/(embers|not-not-philo|intersect)\/(index\.html)?$/); } catch (err) { return; }
    if (!m) return;
    var world = { embers: "embers", "not-not-philo": "philo", intersect: "intersect" }[m[1]];
    var frag = document.querySelector('[data-nts-fragment="' + world + '"]');
    if (!frag) return;
    var plate = frag.closest(".plate");
    if (plate && getComputedStyle(plate).visibility === "hidden") return;
    frag.style.viewTransitionName = "entity";
    if (plate) plate.style.viewTransitionName = "plate";
  });
})();

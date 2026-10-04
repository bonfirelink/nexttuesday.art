/* II · Tide: the scripted side of the flow. Deferred, loaded before nts.js
   so its listeners register first; every page reads fully without it.
     the rise   where the browser has no CSS view timelines, a rAF on
                scroll sets --tide-p on each .tide (the water rising) and
                --rise-p on each .rise (the figure surfacing); the
                stylesheet turns them into transforms under html.tide-raf
     night      on a world page arriving by day, the shared crossing is
                caught before anything repaints: the day tokens stay while
                a wave of the world's night rises over the viewport, the
                tokens flip under it, and the wave passes out of the top.
                The world scripts hear nts:night once, at the flip.
   Reduced motion: the line stands still and night is there from the start
   (nts-head.js), so neither part runs. */
(function () {
  "use strict";
  var d = document.documentElement;
  var still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var native = !!(window.CSS && CSS.supports && CSS.supports("animation-timeline: view()"));

  /* the rise, without view timelines */
  if (!native && !still) {
    var tides = [].slice.call(document.querySelectorAll(".tide"));
    var rises = [].slice.call(document.querySelectorAll(".rise"));
    if (tides.length || rises.length) {
      d.classList.add("tide-raf");
      var ticking = false;
      var clamp = function (p) { return p < 0 ? 0 : p > 1 ? 1 : p; };
      var update = function () {
        ticking = false;
        var vh = innerHeight;
        tides.forEach(function (t) {
          var r = t.parentElement.getBoundingClientRect();
          t.style.setProperty("--tide-p", clamp((vh - r.bottom) / (vh * 0.45)).toFixed(3));
        });
        rises.forEach(function (e) {
          var r = e.getBoundingClientRect();
          e.style.setProperty("--rise-p", clamp((vh - r.top) / ((r.height || 1) * 0.95)).toFixed(3));
        });
      };
      var ask = function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
      addEventListener("scroll", ask, { passive: true });
      addEventListener("resize", ask);
      update();
    }
  }

  /* night rises */
  if (d.hasAttribute("data-nightfall") && d.getAttribute("data-theme") === "day" && !still) {
    var caught = false;
    addEventListener("nts:night", function (e) {
      if (caught) return;
      caught = true;
      e.stopImmediatePropagation();
      d.setAttribute("data-theme", "day");
      var wave = document.createElement("div");
      wave.className = "night-tide" + (document.body.getAttribute("data-world") === "intersect" ? " grainy" : "");
      wave.setAttribute("aria-hidden", "true");
      wave.innerHTML = '<i class="ripples"></i><i class="water"></i>';
      document.body.appendChild(wave);
      var flipped = false;
      var flip = function () {
        if (flipped) return;
        flipped = true;
        d.setAttribute("data-theme", "night");
        dispatchEvent(new CustomEvent("nts:night"));
      };
      var done = function () { flip(); if (wave.parentNode) wave.parentNode.removeChild(wave); };
      setTimeout(flip, 900);               /* the wave covers the viewport at half its run */
      wave.addEventListener("animationend", done);
      setTimeout(done, 2600);              /* if the animation never ran */
    }, true);
  }
})();

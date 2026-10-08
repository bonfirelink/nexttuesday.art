/* The orrery's behaviours, on the home page. Deferred; the page reads fully
   without it (the sky turns in CSS, the worlds are plain sections).
     compass   .compass shows once the orrery has scrolled away, and its
               data-near names the body whose section holds the middle of
               the viewport (sections carry data-orbit-body); a tap goes
               back to the sun (a plain #top link: the stylesheet
               scrolls smoothly when motion is welcome); it steps aside
               (.is-aside) while the footer is in view
     falling   on a cross-document view transition, the body you tapped
               (its bead if the sky is on screen, else its orb) is named
               "orb", so it grows into the world page's entity; coming back,
               the entity shrinks into the same body (named in nts-head.js)
   Everything checks prefers-reduced-motion. */
(function () {
  "use strict";

  /* compass */
  var compass = document.querySelector(".compass");
  var sky = document.querySelector(".orrery");
  if (compass && sky && "IntersectionObserver" in window) {
    var names = { sun: "the great sigil", embers: "EMBERS", philo: "NOT NOT PHILO", intersect: "INTERSECT", star: "what is yet to come" };
    /* paused while hidden (orrery.css), the dots fall behind their beads: as
       the compass shows they take the beads' time again, so each dot sits
       where its bead is */
    var shown = false;
    var rejoin = function () {
      var now = compass.classList.contains("is-on") && !compass.classList.contains("is-aside");
      if (now && !shown) {
        ["star", "embers", "philo", "intersect"].forEach(function (b) {
          var bead = sky.querySelector('.bead[data-body="' + b + '"]');
          var orbit = compass.querySelector(".c-" + b);
          if (!bead || !orbit) return;
          var t = null;
          bead.getAnimations().forEach(function (a) { if (a.animationName === "orbit") t = a.currentTime; });
          if (t === null) return;
          orbit.getAnimations({ subtree: true }).forEach(function (a) { if (a.animationName === "c-turn") a.currentTime = t; });
        });
      }
      shown = now;
    };
    var away = new IntersectionObserver(function (es) {
      es.forEach(function (e) { compass.classList.toggle("is-on", !e.isIntersecting && e.boundingClientRect.bottom < 0); });
      rejoin();
    }, { threshold: 0 });
    away.observe(sky);
    var near = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var b = e.target.getAttribute("data-orbit-body");
        compass.setAttribute("data-near", b);
        compass.setAttribute("aria-label", "Near " + (names[b] || b) + ". Back to the great sigil");
      });
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
    document.querySelectorAll("[data-orbit-body]").forEach(function (s) { near.observe(s); });
    /* the footer holds the page's last lines where the compass sits: it steps
       aside from just before the footer's top reaches the compass until the
       footer leaves again. The footer is not under the compass's transform,
       so this cannot feed back into itself. */
    var foot = document.querySelector(".nts-footer");
    if (foot) {
      var footWatch = null, footTimer = 0;
      /* "in view" starts when the footer's top reaches the compass's bottom
         edge, so the root's bottom margin is that edge's distance from the
         viewport bottom: the compass's computed `bottom` (the inset varies by
         width). Read at setup and again after a resize settles. */
      var watchFooter = function () {
        if (footWatch) footWatch.disconnect();
        var gap = parseFloat(getComputedStyle(compass).bottom) || 0;
        footWatch = new IntersectionObserver(function (es) {
          compass.classList.toggle("is-aside", es[es.length - 1].isIntersecting);
          rejoin();
        }, { rootMargin: "0px 0px -" + gap + "px 0px", threshold: 0 });
        footWatch.observe(foot);
      };
      watchFooter();
      addEventListener("resize", function () { clearTimeout(footTimer); footTimer = setTimeout(watchFooter, 150); });
    }
  }

  /* falling in (coming back is named in nts-head.js, which owns the world
     list and the body lookup) */
  var NTS = window.NTS;
  addEventListener("pageswap", function (e) {
    if (!e.viewTransition || !e.activation || !e.activation.entry || !NTS || !NTS.world) return;
    var w = NTS.world(e.activation.entry.url), el = w && NTS.body(w);
    if (!el) return;
    el.style.viewTransitionName = "orb";
    var clear = function () { el.style.viewTransitionName = ""; };
    e.viewTransition.finished.then(clear, clear);
  });
})();

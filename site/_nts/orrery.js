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
               the entity shrinks into the same body
   Everything checks prefers-reduced-motion. */
(function () {
  "use strict";

  /* compass */
  var compass = document.querySelector(".compass");
  var sky = document.querySelector(".orrery");
  if (compass && sky && "IntersectionObserver" in window) {
    var names = { sun: "the great sigil", embers: "EMBERS", philo: "NOT NOT PHILO", intersect: "INTERSECT", star: "what is yet to come" };
    var away = new IntersectionObserver(function (es) {
      es.forEach(function (e) { compass.classList.toggle("is-on", !e.isIntersecting && e.boundingClientRect.bottom < 0); });
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
        }, { rootMargin: "0px 0px -" + gap + "px 0px", threshold: 0 });
        footWatch.observe(foot);
      };
      watchFooter();
      addEventListener("resize", function () { clearTimeout(footTimer); footTimer = setTimeout(watchFooter, 150); });
    }
  }

  /* falling in, and back */
  var WORLD = { "embers": "embers", "not-not-philo": "philo", "intersect": "intersect", "events": "star" };
  function bodyOf(href) {
    var u; try { u = new URL(href, location.href); } catch (err) { return null; }
    if (u.origin !== location.origin) return null;
    var m = /\/(embers|not-not-philo|intersect|events)\/(index\.html)?$/.exec(u.pathname);
    return m ? WORLD[m[1]] : null;
  }
  function onScreen(el) { var r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; }
  function bodyEl(body) {
    var bead = document.querySelector('.bead[data-body="' + body + '"] .face');
    var orb = document.querySelector('.orb[data-body="' + body + '"]');
    if (bead && onScreen(bead)) return bead;
    if (orb && onScreen(orb)) return orb;
    return bead || orb;
  }
  function name(el, vt) {
    if (!el) return;
    el.style.viewTransitionName = "orb";
    if (vt && vt.finished) vt.finished.then(function () { el.style.viewTransitionName = ""; }, function () { el.style.viewTransitionName = ""; });
  }
  addEventListener("pageswap", function (e) {
    if (!e.viewTransition || !e.activation || !e.activation.entry) return;
    var b = bodyOf(e.activation.entry.url);
    if (b) name(bodyEl(b), e.viewTransition);
  });
  addEventListener("pagereveal", function (e) {
    if (!e.viewTransition || !("navigation" in window) || !navigation.activation || !navigation.activation.from) return;
    var b = bodyOf(navigation.activation.from.url);
    if (b) name(bodyEl(b), e.viewTransition);
  });
})();

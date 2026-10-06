/* The orrery's behaviours, on the home page. Deferred; the page reads fully
   without it (the sky turns in CSS, the worlds are plain sections).
     compass   .compass shows once the orrery has scrolled away, and its
               data-near names the body whose section holds the middle of
               the viewport (sections carry data-orbit-body); a tap goes
               back to the sun (a plain #top link: the stylesheet
               scrolls smoothly when motion is welcome); on phones it
               steps aside (.is-aside) while the words band is in view or any text
               would sit under it
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
    /* phones: the compass steps aside whenever visible text would sit under
       it (or the words band is in view); checked once per frame, only while shown */
    if (matchMedia("(max-width: 639px)").matches) {
      var words = document.querySelector(".words");
      var wordsIn = false, queued = false;
      var TEXT = "p, h1, h2, h3, h4, li, a, button, blockquote, figcaption, dt, dd, .lede, .label";
      var hits = function (r, b) { return r.width > 0 && r.height > 0 && r.right > b.left && r.left < b.right && r.bottom > b.top && r.top < b.bottom; };
      var under = function () {
        var c = compass.getBoundingClientRect(), pad = 8;
        var b = { left: c.left - pad, right: c.right + pad, top: c.top - pad, bottom: c.bottom + pad };
        var els = document.querySelectorAll(TEXT), rg = document.createRange();
        for (var i = 0; i < els.length; i++) {
          var el = els[i];
          if (compass.contains(el) || !hits(el.getBoundingClientRect(), b)) continue;
          if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
          var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n;
          while ((n = tw.nextNode())) {
            if (!/\S/.test(n.nodeValue)) continue;
            rg.selectNodeContents(n);
            var rs = rg.getClientRects();
            for (var k = 0; k < rs.length; k++) if (hits(rs[k], b)) return true;
          }
        }
        return false;
      };
      var check = function () {
        queued = false;
        if (!compass.classList.contains("is-on")) return;
        compass.classList.toggle("is-aside", wordsIn || under());
      };
      var queue = function () { if (!queued) { queued = true; requestAnimationFrame(check); } };
      addEventListener("scroll", queue, { passive: true });
      addEventListener("resize", queue);
      /* text that fades or slides in changes what sits under the compass without a scroll */
      document.addEventListener("transitionend", queue, true);
      document.addEventListener("animationend", queue, true);
      new MutationObserver(queue).observe(compass, { attributes: true, attributeFilter: ["class"] });
      if (words) new IntersectionObserver(function (es) { wordsIn = es[es.length - 1].isIntersecting; queue(); }, { threshold: 0 }).observe(words);
      queue();
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

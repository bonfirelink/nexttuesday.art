/* The shared behaviours. Deferred; every page reads fully without it.
     header     .nts-header gets .is-scrolled once the page has moved
     draw-in    [data-nts-draw] gets .is-in on entering view (the stylesheet
                then draws strokes, fades, scales the rules); data-nts-draw
                children of one container stagger by --draw-delay
     night-fall on html[data-nightfall][data-theme="day"], the first real
                scroll past a third of the viewport sets data-theme="night",
                and it stays; on a page whose <body data-nts-home>, links to
                a world page set the sessionStorage flag that nts-head.js
                reads on the other side
     mega-sigil .mega-btn tap toggles .is-aligned on .mega: the layers freeze
                where they are and turn to their aligned pose, the hole
                opens, and the .turn secret shows; tap again to resume
   Everything checks prefers-reduced-motion. */
(function () {
  "use strict";
  var still = matchMedia("(prefers-reduced-motion: reduce)");
  var d = document.documentElement;

  /* header */
  var header = document.querySelector(".nts-header");
  if (header) {
    var onScroll = function () { header.classList.toggle("is-scrolled", scrollY > 8); };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* draw-in */
  var targets = document.querySelectorAll("[data-nts-draw], .rule.draw");
  if (targets.length) {
    if (!("IntersectionObserver" in window) || still.matches) {
      targets.forEach(function (t) { t.classList.add("is-in"); });
    } else {
      // siblings that enter together stagger a little
      var groups = new Map();
      targets.forEach(function (t) {
        var p = t.parentElement; if (!p) return;
        var n = groups.get(p) || 0; groups.set(p, n + 1);
        if (n) t.style.setProperty("--draw-delay", Math.min(n, 6) * 140 + "ms");
      });
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        });
      }, { rootMargin: "0px 0px -12% 0px", threshold: 0.05 });
      targets.forEach(function (t) { io.observe(t); });
    }
  }

  /* night-fall: the crossing */
  if (d.hasAttribute("data-nightfall") && d.getAttribute("data-theme") === "day") {
    var start = scrollY, armed = false, fell = false;
    var fall = function () {
      if (fell) return;
      fell = true;
      d.setAttribute("data-theme", "night");
      dispatchEvent(new CustomEvent("nts:night"));
    };
    var watch = function () {
      if (!armed) { armed = true; start = scrollY; return; }
      if (scrollY - start > innerHeight * 0.33) { fall(); removeEventListener("scroll", watch); }
    };
    addEventListener("scroll", watch, { passive: true });
  }
  /* night-fall: the flag, set when leaving for a world page */
  if (document.body.hasAttribute("data-nts-home")) {
    var worldRe = /\/(embers|not-not-philo|intersect)\/(index\.html)?$/;
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a || a.target === "_blank") return;
      var u;
      try { u = new URL(a.getAttribute("href"), location.href); } catch (err) { return; }
      if (u.origin !== location.origin || !worldRe.test(u.pathname)) return;
      try { sessionStorage.setItem("nts:from", "home"); } catch (err) { /* private mode */ }
    }, true);
  }

  /* mega-sigil */
  document.querySelectorAll(".mega-btn").forEach(function (btn) {
    var mega = btn.querySelector(".mega");
    if (!mega) return;
    var turn = btn.parentElement && btn.parentElement.querySelector(".turn");
    var layers = mega.querySelectorAll("[class^='l-']");
    var aligned = false, timer = 0;
    function angleOf(el) {
      var m = getComputedStyle(el).transform;
      if (!m || m === "none") return 0;
      var v = m.match(/matrix\(([^)]+)\)/);
      if (!v) return 0;
      var a = v[1].split(",").map(Number);
      return Math.atan2(a[1], a[0]) * 180 / Math.PI;
    }
    function toggle() {
      aligned = !aligned;
      btn.setAttribute("aria-pressed", String(aligned));
      if (turn) turn.classList.toggle("is-open", aligned);
      if (aligned) {
        // freeze each layer where the animation left it, then turn it home
        layers.forEach(function (l) { l.style.transform = "rotate(" + angleOf(l).toFixed(2) + "deg)"; });
        mega.classList.add("is-aligned");
        void mega.offsetWidth;
        layers.forEach(function (l) { l.style.transform = "rotate(0deg)"; });
      } else {
        mega.classList.remove("is-aligned");
        clearTimeout(timer);
        timer = setTimeout(function () { layers.forEach(function (l) { l.style.transform = ""; }); }, 50);
      }
    }
    var hold = 0, held = false;
    btn.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      held = false;
      hold = setTimeout(function () { held = true; toggle(); }, 480);
    });
    var release = function () { clearTimeout(hold); };
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("pointerleave", release);
    btn.addEventListener("click", function () { if (held) { held = false; return; } toggle(); });
    btn.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  });
})();

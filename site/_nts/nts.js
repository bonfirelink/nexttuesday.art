/* The shared behaviours. Deferred; every page reads fully without it.
     header     .nts-header gets .is-scrolled once the page has moved
     draw-in    [data-nts-draw] gets .is-in on entering view (the stylesheet
                then draws strokes, fades, scales the rules); data-nts-draw
                children of one container stagger by --draw-delay
     bleed      on html[data-bleed-state="before"] (nts-head.js: a world
                page reached from home), the world's night opens over the
                hero as a disc from its entity, driven by the scroll, and
                settles once the hero is half gone; see the block below.
                On a page whose <body data-nts-home>, links to a world page
                set the sessionStorage flag that nts-head.js reads
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
    /* a sentinel the height of the threshold at the very top of the page: the
       header is marked once it has scrolled out of view, with no scroll
       listener and no layout read */
    var sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:8px;pointer-events:none;visibility:hidden";
    if ("IntersectionObserver" in window) {
      document.body.appendChild(sentinel);
      new IntersectionObserver(function (es) {
        header.classList.toggle("is-scrolled", !es[es.length - 1].isIntersecting);
      }, { threshold: 0 }).observe(sentinel);
    } else {
      var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 8); };
      addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
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

  /* apertures latch open.
     An aperture follows the scroll (--ecl-p, apertures.css) only until its
     disc is complete; then .is-open pins it open for the rest of the visit.
     The complete point is where animation-range ends (--ecl-open-end, in
     vh, read once at load, the one home of the value): the element's top that far above the
     viewport's bottom edge, so an observer whose root is cut by the same
     share there fires exactly then (55% if the property is unreadable). Elements already past it (loaded
     scrolled, or tall ones) report a top above that line and latch at once. */
  var apertures = document.querySelectorAll(".ecl");
  if (apertures.length && "IntersectionObserver" in window && CSS.supports("animation-timeline", "view()")) {
    var end = /^\s*([\d.]+)vh\s*$/.exec(getComputedStyle(document.documentElement).getPropertyValue("--ecl-open-end"));
    var latch = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.boundingClientRect.top > e.rootBounds.bottom) return;
        e.target.classList.add("is-open");
        latch.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -" + (end ? +end[1] : 55) + "% 0px", threshold: 0 });
    apertures.forEach(function (a) { latch.observe(a); });
  }

  /* the world bleed-in, driven by the scroll, crossing only the hero.
     The world's night is a copy of the hero in the world's colours, on its
     own ground (.nts-night, over the hero, under the header), shown through
     a disc that opens from the entity's centre: 0 at the top, the whole
     hero once it is half scrolled away, smoothstepped; scrolling back up
     closes it. The disc is a circle scaled with transform and the copy
     inside it is scaled back by the inverse, so the edge passes through
     words and figures cleanly and every frame is the compositor's alone:
     a scroll timeline drives both (a paused animation set from the scroll
     where timelines are missing, still transform-only). The hero itself
     stays in the NTS colours under it (.nts-bleed-old); everything below
     the hero is in the world from the start, so nothing there is crossed.
     The few parts outside the hero (the header, a fixed layer such as a
     grain) keep .nts-bleed-old until the disc's edge passes their centre,
     and crossfade (--dur-bleed-fade). When the disc is complete the world
     settles for good: the state is "world", the copy goes.
     Live figures in the hero draw their night into their twin in the copy:
       NTS.bleed.twin(el)   the copy of a hero element, while the copy exists
       NTS.bleed.progress() the disc's progress, 0..1, from the scroll alone
     Events on window: "nts:bleed" with detail { phase: "start" | "end",
     world }, when the copy is made and when it goes. */
  var NTS = window.NTS = window.NTS || {};
  var bleed = NTS.bleed = NTS.bleed || {};
  bleed.twin = function () { return null; };
  bleed.progress = function () { return d.getAttribute("data-bleed-state") === "before" ? 0 : 1; };
  if (d.getAttribute("data-bleed-state") === "before") {
    var hero = document.querySelector("main .hero");
    if (still.matches || !hero || !hero.animate) d.setAttribute("data-bleed-state", "world");
    /* after every deferred script, so the figures are mounted and copied
       as they are, and are listening for "start" */
    else document.addEventListener("DOMContentLoaded", function () { cross(hero); });
  }
  function cross(hero) {
    var all = function (list) { return Array.prototype.slice.call(list); };
    var ease = function (f) { f = Math.max(0, Math.min(1, f)); return f * f * (3 - 2 * f); };
    var world = document.body.getAttribute("data-world");
    var entity = hero.querySelector(".entity") || hero;
    var timeline = typeof ScrollTimeline === "function" ? new ScrollTimeline({ source: d, axis: "block" }) : null;
    var toggles = all(document.body.children).filter(function (el) { return !el.matches("main, footer, script, style, .nts-sprite, .compass"); });

    /* 1. the copy: the hero cloned as it is now, paired element by element
       for twin(); CSS animations in it run in step with the original's */
    var layer = document.createElement("div"), disc = document.createElement("div"), inner = document.createElement("div");
    layer.className = "nts-night"; disc.className = "nts-night-disc"; inner.className = "nts-night-in";
    layer.setAttribute("aria-hidden", "true"); layer.setAttribute("inert", "");
    inner.setAttribute("data-world", world);
    var copy = hero.cloneNode(true), from = [hero].concat(all(hero.querySelectorAll("*"))), to = [copy].concat(all(copy.querySelectorAll("*")));
    var twins = new Map();
    from.forEach(function (el, i) { twins.set(el, to[i]); });
    to.forEach(function (el) {
      if (el.tagName === "SCRIPT") { el.remove(); return; }
      el.removeAttribute("id"); el.removeAttribute("tabindex"); el.removeAttribute("aria-labelledby");
      if (el.matches("[data-nts-draw], .rule.draw")) el.classList.add("is-in");
    });
    inner.appendChild(copy); disc.appendChild(inner); layer.appendChild(disc); document.body.appendChild(layer);
    d.setAttribute("data-bleed-state", "in");
    hero.classList.add("nts-bleed-old");
    var old = toggles.map(function (el) { el.classList.add("nts-bleed-old"); return true; });
    from.forEach(function (el, i) {
      if (!el.getAnimations || !to[i].isConnected) return;
      var a = el.getAnimations(), b = to[i].getAnimations();
      if (a.length === b.length) a.forEach(function (x, k) { if (x.startTime !== null) b[k].startTime = x.startTime; });
    });

    /* 2. the geometry, in document px, read once (and again on a resize):
       the disc's centre and full radius, the scroll at which it is complete,
       and for each part outside the hero the scroll at which the edge passes
       its centre */
    var g = { end: 1 }, at = [], anims = [];
    var measure = function () {
      var sy = scrollY, hr = hero.getBoundingClientRect(), er = entity.getBoundingClientRect();
      var W = d.clientWidth, top = hr.top + sy, bottom = hr.bottom + sy;
      var cx = er.left + er.width / 2, cy = er.top + er.height / 2 + sy;
      var end = Math.max(top + hr.height / 2, innerHeight * 0.25);
      /* complete: every corner of what is in view of the hero at "end" */
      var R = Math.ceil(Math.max(Math.hypot(cx, bottom - cy), Math.hypot(W - cx, bottom - cy), Math.hypot(cx, end - cy), Math.hypot(W - cx, end - cy))) + 2;
      g = { end: end };
      layer.style.cssText = "width:" + W + "px;height:" + Math.ceil(bottom) + "px";
      disc.style.cssText = "left:" + (cx - R) + "px;top:" + (cy - R) + "px;width:" + 2 * R + "px;height:" + 2 * R + "px";
      inner.style.cssText = "left:" + (R - cx) + "px;top:" + (R - cy) + "px;width:" + W + "px;height:" + Math.ceil(bottom) + "px;transform-origin:" + cx + "px " + cy + "px";
      copy.style.cssText = "position:absolute;box-sizing:border-box;margin:0;left:" + hr.left + "px;top:" + top + "px;width:" + hr.width + "px;height:" + hr.height + "px";
      at = toggles.map(function (el) {
        var r = el.getBoundingClientRect();
        if (!r.width && !r.height) return 0;
        var fixed = /fixed|sticky/.test(getComputedStyle(el).position), x = r.left + r.width / 2, y = r.top + r.height / 2 + (fixed ? 0 : sy);
        for (var k = 0; k <= 100; k++) {
          var s = end * k / 100;
          if (ease(k / 100) * R >= Math.hypot(x - cx, (fixed ? y + s : y) - cy)) return s;
        }
        return end;
      });
      /* the disc's scale and the copy's inverse, keyframed where the scale
         has grown by 4% (or 2% of the way) so the two stay each other's
         inverse between keyframes to well under a pixel */
      var K = [{ offset: 0, transform: "scale(0)" }], J = [{ offset: 0, transform: "none" }], lastS = 0, lastU = 0;
      for (var i = 1; i <= 500; i++) {
        var u = i / 500, s = ease(u);
        if (i === 500 || (s >= 0.002 && (!lastS || s / lastS >= 1.04 || u - lastU >= 0.02))) {
          K.push({ offset: u, transform: "scale(" + s.toFixed(5) + ")" });
          J.push({ offset: u, transform: "scale(" + (1 / s).toFixed(5) + ")" });
          lastS = s; lastU = u;
        }
      }
      anims.forEach(function (a) { a.cancel(); });
      var opt = timeline ? { timeline: timeline, rangeStart: "0px", rangeEnd: end + "px", fill: "both" } : { duration: 1000, fill: "both" };
      anims = [disc.animate(K, opt), inner.animate(J, opt)];
      if (!timeline) anims.forEach(function (a) { a.pause(); });
    };
    measure();
    bleed.twin = function (el) { return twins.get(el) || null; };
    bleed.progress = function () { return ease(scrollY / g.end); };

    /* 3. the scroll only compares numbers: no reads of the layout, no
       styles but the classes that change */
    var raf = 0, settled = false;
    var update = function () {
      raf = 0;
      if (settled) return;
      var y = scrollY;
      if (!timeline) { var f = Math.max(0, Math.min(1, y / g.end)) * 1000; anims.forEach(function (a) { a.currentTime = f; }); }
      toggles.forEach(function (el, i) { var o = y < at[i]; if (o !== old[i]) { old[i] = o; el.classList.toggle("nts-bleed-old", o); } });
      if (y >= g.end) settle();
    };
    var schedule = function () { if (!raf) raf = requestAnimationFrame(update); };
    var resized = 0;
    var resize = function () { if (!resized) resized = requestAnimationFrame(function () { resized = 0; if (!settled) { measure(); update(); } }); };
    var ro = "ResizeObserver" in window ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(hero);
    var settle = function () {
      settled = true;
      removeEventListener("scroll", schedule); removeEventListener("resize", resize);
      if (ro) ro.disconnect();
      anims.forEach(function (a) { a.cancel(); });
      layer.remove();
      hero.classList.remove("nts-bleed-old");
      toggles.forEach(function (el) { el.classList.remove("nts-bleed-old"); });
      d.setAttribute("data-bleed-state", "world");
      bleed.twin = function () { return null; };
      bleed.progress = function () { return 1; };
      dispatchEvent(new CustomEvent("nts:bleed", { detail: { phase: "end", world: world } }));
    };
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", resize);
    dispatchEvent(new CustomEvent("nts:bleed", { detail: { phase: "start", world: world } }));
    update();
  }
  /* the bleed's flag, set when leaving home for a world page */
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
    var scope = btn.closest("section, header, main") || document;
    var turn = scope.querySelector(".turn");
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
  /* falling in: a world's hero entity is the `orb` of the cross-document view
     transition only when the other page is not a world page (the home orb
     becomes it, and it becomes the orb again going back). World to world is
     the plain root crossfade: the two entities never morph. */
  (function () {
    var WORLD = /\/(embers|not-not-philo|intersect|events)\/(index\.html)?$/;
    function orb(other, vt) {
      var ent = document.querySelector(".hero .entity");
      if (!ent || !vt || WORLD.test(new URL(other, location.href).pathname)) return;
      ent.style.viewTransitionName = "orb";
      var clear = function () { ent.style.viewTransitionName = ""; };
      vt.finished.then(clear, clear);
    }
    addEventListener("pageswap", function (e) {
      if (e.viewTransition && e.activation && e.activation.entry) orb(e.activation.entry.url, e.viewTransition);
    });
    addEventListener("pagereveal", function (e) {
      if (e.viewTransition && window.navigation && navigation.activation && navigation.activation.from) orb(navigation.activation.from.url, e.viewTransition);
    });
  })();
})();

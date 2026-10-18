/* The shared behaviours. Deferred; every page reads fully without it.
     header     .nts-header gets .is-scrolled once the page has moved
     draw-in    [data-nts-draw] gets .is-in on entering view (the stylesheet
                then draws strokes, fades, scales the rules); data-nts-draw
                children of one container stagger by --draw-delay
     bleed      on html[data-bleed-state="before"] (nts-head.js: a world
                page reached from home), the world's night opens over the
                hero as a disc from its entity: a timed burst fired by the
                first scroll of 20px, which settles when it finishes; see
                the block below.
                Links to a world page set the sessionStorage flag that
                nts-head.js reads, on every page but a world page whose
                bleed has settled
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

  /* apertures: the disc's radius, and the latch.
     The disc (apertures.css) is clipped to a circle of radius --ecl-r, the
     card's farthest corner from the ring point at its top centre, measured
     by a ResizeObserver: read only when a card changes size, never while
     the page scrolls.
     An aperture follows the scroll only until its disc is complete; then
     .is-open pins it open for the rest of the visit.
     The complete point is where animation-range ends (--ecl-open-end, in
     vh, read once at load, the one home of the value): the element's top that far above the
     viewport's bottom edge, so an observer whose root is cut by the same
     share there fires exactly then (55% if the property is unreadable). Elements already past it (loaded
     scrolled, or tall ones) report a top above that line and latch at once. */
  var apertures = document.querySelectorAll(".ecl");
  var latching = apertures.length && "IntersectionObserver" in window && CSS.supports("animation-timeline", "view()");

  /* the live pictures in apertures (the home's world windows): one at a time.
     A figure asks NTS.live.join(host, set) whether it may animate, and
     set(on) tells it when that changes; between, it holds its last frame.
     Live is the one figure whose window is open (.is-open: while its disc
     still opens, a figure holds still) and whose host is nearest the middle
     of the viewport: the most of it inside the middle band (the 40% of the
     viewport's height around its centre), else, when no host reaches the
     band, the one most in view if at least half of it is. Everything is
     read from IntersectionObserver entries, so nothing is measured while
     the page scrolls. A figure outside an aperture, or without
     IntersectionObserver, is not held: join returns true. */
  var live = (function () {
    var items = new Map(), current = null, band = null, view = null, steps = [];
    for (var i = 0; i <= 20; i++) steps.push(i / 20);
    function pick() {
      var best = null, top = 0;
      items.forEach(function (it) {
        if (latching && !still.matches && !it.ecl.classList.contains("is-open")) return;
        var s = it.band > 0 ? 1 + it.band : it.ratio >= 0.5 ? it.ratio : 0;
        if (s > top) { top = s; best = it; }
      });
      if (best === current) return;
      if (current) current.set(false);
      current = best;
      if (best) best.set(true);
    }
    function take(key) {
      return function (es) {
        es.forEach(function (e) {
          var it = items.get(e.target);
          if (it) it[key] = !e.isIntersecting ? 0 : key === "band" ? e.intersectionRect.height : e.intersectionRatio;
        });
        pick();
      };
    }
    function join(host, set) {
      var ecl = host.closest && host.closest(".ecl");
      if (!ecl || !("IntersectionObserver" in window)) return true;
      if (!band) {
        band = new IntersectionObserver(take("band"), { rootMargin: "-30% 0px -30% 0px", threshold: steps });
        view = new IntersectionObserver(take("ratio"), { threshold: [0, 0.25, 0.5, 0.75, 1] });
      }
      items.set(host, { ecl: ecl, set: set, band: 0, ratio: 0 });
      band.observe(host); view.observe(host);
      return false;
    }
    (window.NTS = window.NTS || {}).live = { join: join };
    return { pick: pick };
  })();

  if (latching) {
    var end = /^\s*([\d.]+)vh\s*$/.exec(getComputedStyle(document.documentElement).getPropertyValue("--ecl-open-end"));
    var radius = "ResizeObserver" in window ? new ResizeObserver(function (es) {
      es.forEach(function (e) {
        var box = e.borderBoxSize && e.borderBoxSize[0], w = box ? box.inlineSize : e.contentRect.width, h = box ? box.blockSize : e.contentRect.height;
        e.target.style.setProperty("--ecl-r", Math.ceil(Math.hypot(w / 2, h)) + "px");
      });
    }) : null;
    var latch = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.boundingClientRect.top > e.rootBounds.bottom) return;
        e.target.classList.add("is-open");
        latch.unobserve(e.target);
        live.pick();
        var win = e.target.querySelector(".ecl-win");
        if (radius && win) radius.unobserve(win);
      });
    }, { rootMargin: "0px 0px -" + (end ? +end[1] : 55) + "% 0px", threshold: 0 });
    apertures.forEach(function (a) {
      latch.observe(a);
      var win = a.querySelector(".ecl-win");
      if (radius && win) radius.observe(win);
    });
  }

  /* the world bleed-in: a timed burst fired by the first scroll, crossing
     only the hero.
     The world's night is a copy of the hero in the world's colours, on its
     own ground (.nts-night, over the hero, under the header), shown through
     a disc that opens from the entity's centre. Nothing moves until the page
     has been scrolled FIRE_AT px; then the disc opens on its own over
     DURATION along a "snap" ease (a short held seed, a hard open that runs
     past full, beyond the screen, and comes back, so what is seen ends at
     speed) and never closes: scrolling back does nothing. The disc is a
     circle scaled with transform and the copy inside it is scaled back by the
     inverse, so the edge passes through words and figures cleanly and every
     frame is the compositor's alone. It is one animation pair on the
     document timeline with the ease in its keyframes, never driven by the
     scroll: on iOS Safari a touch pan gives script the scroll in bursts, and
     a disc whose size follows it pops for single frames, whatever draws the
     circle (scroll timeline, per-frame script, rounded clip, clip-path or
     mask). The hero itself stays in the NTS colours under it
     (.nts-bleed-old); everything below the hero is in the world from the
     start, so nothing there is crossed.
     The few parts outside the hero (the header, a fixed layer that is not
     the ground's own texture) keep .nts-bleed-old until the disc covers them
     whole for good, and crossfade (--dur-bleed-fade), the part alone: what is
     inside it inherits the fade. When the animation ends the world settles
     for good: the state is "world", the copy goes.
     Live figures in the hero draw their night into their twin in the copy:
       NTS.bleed.twin(el)   the copy of a hero element, while the copy exists
       NTS.bleed.progress() the disc's progress, 0..1; 0 until it fires
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
    var FIRE_AT = 20, DURATION = 2000;
    /* the grid, over the run, on which a part's crossing time is found */
    var CUT_STEPS = 1000;
    var all = function (list) { return Array.prototype.slice.call(list); };
    var world = document.body.getAttribute("data-world");
    var entity = hero.querySelector(".entity") || hero;
    /* the disc's size as a share of its full radius, over 0..1 of the run */
    var snap = function (u) {
      if (u < 0.2) return 0.03 * (u / 0.2) * (u / 0.2);
      if (u < 0.75) { var f = (u - 0.2) / 0.55; return 0.03 + 1.05 * (1 - Math.pow(1 - f, 3)); }
      var h = (u - 0.75) / 0.25; return 1.08 - 0.08 * h * h * (3 - 2 * h);
    };
    var toggles = all(document.body.children).filter(function (el) { return !el.matches("main, footer, script, style, .nts-sprite"); });

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
    toggles.forEach(function (el) { el.classList.add("nts-bleed-old"); });
    from.forEach(function (el, i) {
      if (!el.getAnimations || !to[i].isConnected) return;
      var a = el.getAnimations(), b = to[i].getAnimations();
      if (a.length === b.length) a.forEach(function (x, k) { if (x.startTime !== null) b[k].startTime = x.startTime; });
    });

    /* 2. the geometry, in document px, read once and again on a resize
       before the disc fires: its centre and its full radius, which reaches
       the farthest corner of what is in view of the layer */
    var g = { cx: 0, cy: 0, R: 0 }, anims = [], timers = [], fired = false;
    var measure = function () {
      var sy = scrollY, hr = hero.getBoundingClientRect(), er = entity.getBoundingClientRect();
      var W = d.clientWidth, top = hr.top + sy, bottom = hr.bottom + sy;
      var cx = er.left + er.width / 2, cy = er.top + er.height / 2 + sy;
      var view = Math.min(sy + innerHeight, bottom + 2);
      var R = Math.ceil(Math.hypot(Math.max(cx, W - cx), Math.max(Math.abs(sy - cy), Math.abs(view - cy)))) + 2;
      g = { cx: cx, cy: cy, R: R };
      /* the layer runs 2px past the hero's foot, over the ground below that
         is the same dark: its own scaled bottom edge would otherwise land
         inside the last row of the hero and let the hero's paper show */
      var foot = Math.ceil(bottom) + 2;
      layer.style.cssText = "width:" + W + "px;height:" + foot + "px";
      disc.style.cssText = "left:" + (cx - R) + "px;top:" + (cy - R) + "px;width:" + 2 * R + "px;height:" + 2 * R + "px";
      inner.style.cssText = "left:" + (R - cx) + "px;top:" + (R - cy) + "px;width:" + W + "px;height:" + foot + "px;transform-origin:" + cx + "px " + cy + "px";
      copy.style.cssText = "position:absolute;box-sizing:border-box;margin:0;left:" + hr.left + "px;top:" + top + "px;width:" + hr.width + "px;height:" + hr.height + "px";
    };
    measure();
    bleed.twin = function (el) { return twins.get(el) || null; };
    bleed.progress = function () { return fired ? Math.min(1, snap(Math.min(1, (anims[0].currentTime || 0) / DURATION))) : 0; };

    /* 3. the scroll only compares one number against the trigger */
    var raf = 0, resized = 0;
    var update = function () {
      raf = 0;
      if (!fired && scrollY >= FIRE_AT) fire();
    };
    var schedule = function () { if (!raf) raf = requestAnimationFrame(update); };
    var resize = function () { if (!resized) resized = requestAnimationFrame(function () { resized = 0; if (!fired) measure(); }); };
    var ro = "ResizeObserver" in window ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(hero);
    /* fired: measured again from where the page is now, then left alone;
       each part outside the hero crosses once the disc's radius has reached
       its farthest corner for good (after the last time it is short of it,
       as the ease runs past full and back), by timer from the animation's start */
    var fire = function () {
      fired = true;
      removeEventListener("scroll", schedule); removeEventListener("resize", resize);
      if (ro) ro.disconnect();
      /* the parts' boxes are read before measure() writes the layer's styles */
      var sy = scrollY, rects = toggles.map(function (el) { return el.getBoundingClientRect(); });
      measure();
      var cuts = rects.map(function (r) {
        var k = CUT_STEPS;
        var far = !r.width && !r.height ? 0 : Math.hypot(Math.max(g.cx - r.left, r.right - g.cx), Math.max(Math.abs(r.top + sy - g.cy), Math.abs(r.bottom + sy - g.cy)));
        while (k > 0 && snap((k - 1) / CUT_STEPS) * g.R >= far) k--;
        return DURATION * k / CUT_STEPS;
      });
      /* the disc's scale and the copy's inverse, keyframed where the scale has
         changed by 4% (or 2% of the way, or turns back) so the two stay each
         other's inverse between keyframes to well under a pixel */
      var K = [{ offset: 0, transform: "scale(0)" }], J = [{ offset: 0, transform: "none" }], lastS = 0, lastU = 0;
      for (var i = 1; i <= DURATION; i++) {
        var u = i / DURATION, s = snap(u);
        var turn = i < DURATION && (snap((i + 1) / DURATION) - s) * (s - snap((i - 1) / DURATION)) < 0;
        if (i === DURATION || (s >= 0.002 && (!lastS || turn || s / lastS >= 1.04 || lastS / s >= 1.04 || u - lastU >= 0.02))) {
          K.push({ offset: u, transform: "scale(" + s.toFixed(5) + ")" });
          J.push({ offset: u, transform: "scale(" + (1 / s).toFixed(5) + ")" });
          lastS = s; lastU = u;
        }
      }
      var opt = { duration: DURATION, fill: "both" };
      anims = [disc.animate(K, opt), inner.animate(J, opt)];
      anims[0].onfinish = settle;
      anims[0].ready.then(function () {
        var elapsed = anims[0].currentTime || 0;
        /* the timer only wakes the check: the animation's time is the frame
           being shown, which can trail the clock by a frame or more when the
           main thread is busy, so a part crosses in the first frame whose
           time has reached its cut, not when the clock says so */
        var reveal = function (el, cut) {
          if (!layer.isConnected) return;
          if ((anims[0].currentTime || 0) >= cut) el.classList.remove("nts-bleed-old");
          else requestAnimationFrame(function () { reveal(el, cut); });
        };
        toggles.forEach(function (el, i) {
          timers.push(setTimeout(function () { reveal(el, cuts[i]); }, Math.max(0, cuts[i] - elapsed)));
        });
      });
    };
    var settle = function () {
      timers.forEach(clearTimeout);
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
  /* the bleed's flag, set when a link to a world page is clicked on any page
     that is not a world page, or on a world page whose own bleed has not
     settled (the next world opens beige too). A world page is one that runs
     the bleed (it carries data-bleed-state); the events page is on NTS.world's
     list but runs none, so it counts as an ordinary page here. A link inside
     a block already in the destination world's colours (its closest
     [data-world] is that world's key) opens the world directly: the flag is
     "direct", which also stops the referrer fallback in nts-head.js */
  document.addEventListener("click", function (e) {
    if (d.getAttribute("data-bleed-state") === "world") return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.target === "_blank") return;
    var w = window.NTS.world(a.getAttribute("href"));
    if (!w || w === "events") return;
    var blk = a.closest("[data-world]");
    var direct = !!blk && blk.getAttribute("data-world") === window.NTS.key(w);
    try { sessionStorage.setItem("nts:from", direct ? "direct" : "home"); } catch (err) { /* private mode */ }
  }, true);

  /* leaving a world: its hero entity is the `orb` of the cross-document view
     transition only when the next page is not a world page (it becomes the
     home orb again). World to world is the plain root crossfade: the two
     entities never morph. The arriving side is named in nts-head.js. */
  (function () {
    function orb(other, vt) {
      var ent = document.querySelector(".hero .entity");
      if (!ent || !vt || window.NTS.world(other)) return;
      ent.style.viewTransitionName = "orb";
      var clear = function () { ent.style.viewTransitionName = ""; };
      vt.finished.then(clear, clear);
    }
    addEventListener("pageswap", function (e) {
      if (e.viewTransition && e.activation && e.activation.entry) orb(e.activation.entry.url, e.viewTransition);
    });
  })();
  /* grab: what the worlds' figures share to take a press only on the figure.
       SLACK                px of forgiveness around an outline (fingers)
       hull(points)         the convex hull of [x, y] points
       near(poly, x, y, s)  inside the polygon, or within s px (default SLACK)
                            of its edge
       watch(el, test)      test(clientX, clientY) says whether a point is on
                            the figure. Returns { down(e), up() }: down says
                            whether a press may start a drag (and shows the
                            grabbing cursor), up ends it. Over the figure, a
                            mouse or pen puts .is-grab on el for the grab
                            cursor; .is-grabbing while pressed. The test runs
                            on pointer events only, on geometry the figure
                            already holds. */
  (function () {
    var SLACK = 14;
    function near(poly, x, y, s) {
      var r = s === undefined ? SLACK : s, r2 = r * r, inside = false, n = poly.length, i, j, a, b;
      for (i = 0, j = n - 1; i < n; j = i++) {
        a = poly[i]; b = poly[j];
        if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
        var dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
        var t = l ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l)) : 0;
        var ex = a[0] + t * dx - x, ey = a[1] + t * dy - y;
        if (ex * ex + ey * ey <= r2) return true;
      }
      return inside;
    }
    function hull(pts) {
      var p = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }), out = [], k, i, lo;
      if (p.length < 3) return p;
      function turn(a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
      for (i = 0; i < p.length; i++) { while (out.length > 1 && turn(out[out.length - 2], out[out.length - 1], p[i]) <= 0) out.pop(); out.push(p[i]); }
      lo = out.length + 1;
      for (i = p.length - 2; i >= 0; i--) { while (out.length >= lo && turn(out[out.length - 2], out[out.length - 1], p[i]) <= 0) out.pop(); out.push(p[i]); }
      out.pop();
      return out;
    }
    function watch(el, test) {
      var over = false, down = false;
      function show(on) { if (on !== over) { over = on; el.classList.toggle("is-grab", on); } }
      el.addEventListener("pointermove", function (e) {
        if (down || e.pointerType === "touch") return;
        show(test(e.clientX, e.clientY));
      });
      el.addEventListener("pointerleave", function () { if (!down) show(false); });
      return {
        down: function (e) {
          if (!test(e.clientX, e.clientY)) return false;
          down = true; el.classList.add("is-grabbing"); show(true);
          return true;
        },
        up: function () { down = false; el.classList.remove("is-grabbing"); },
      };
    }
    (window.NTS = window.NTS || {}).grab = { SLACK: SLACK, near: near, hull: hull, watch: watch };
  })();
})();

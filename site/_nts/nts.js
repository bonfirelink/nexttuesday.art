/* The shared behaviours. Deferred; every page reads fully without it.
     header     .nts-header gets .is-scrolled once the page has moved
     draw-in    [data-nts-draw] gets .is-in on entering view (the stylesheet
                then draws strokes, fades, scales the rules); data-nts-draw
                children of one container stagger by --draw-delay
     bleed      on html[data-bleed-state="before"] (nts-head.js: a world
                page reached from home), the world's colours bleed in once,
                on the first real scroll past a third of the viewport
                (data-bleed="scroll") or after a moment ("time"), as a front
                that crosses the viewport; see the block below for the form
                and the hooks. On a page whose <body data-nts-home>, links
                to a world page set the sessionStorage flag that nts-head.js
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

  /* the world bleed-in.
     The world's ground arrives as a front: a layer (.nts-bleed-front, the
     viewport's box at the moment it starts) clipped to a shape that grows
     with progress p in 0..1, while the tokens flip at once underneath and
     every element holds its old colours with a zero-length delayed
     transition until the front reaches it. Text blocks are crossed in one
     jump: the front's progress is warped so the intervals they cover take
     no time, which is what keeps every frame readable. Elements outside
     the viewport switch with the body's own background, at the end.
     Hooks, all on window.NTS.bleed, to be set before the bleed starts:
       form      "sweep" (default, top to bottom), "disc" (from the centre),
                 or an object { clip(p, w, h) -> a clip-path value for the
                 front at progress p; cover(box, w, h) -> [p0, p1], the
                 progress at which the front first touches and fully covers
                 a box {x0, y0, x1, y1} in front coordinates }. One object
                 defines both, so the switching stays in step with the shape.
       blocks    extra selector for elements to cross in one jump (by
                 default: anything with its own text, .lift, .trace-bead,
                 .nts-header, [data-bleed-block])
       duration  ms; else --dur-bleed from the stylesheet
     Events on window: "nts:bleed" with detail { phase: "start"|"end",
     world, duration, at(el) -> ms until the front reaches el }, for canvases
     and anything that paints its own colours. */
  var NTS = window.NTS = window.NTS || {};
  NTS.bleed = NTS.bleed || {};
  NTS.bleed.forms = {
    sweep: {
      clip: function (p) { return "inset(0 0 " + ((1 - p) * 100).toFixed(3) + "% 0)"; },
      cover: function (b, w, h) { return [b.y0 / h, b.y1 / h]; }
    },
    disc: {
      clip: function (p) { return "circle(" + (p * 100).toFixed(3) + "% at 50% 50%)"; },
      cover: function (b, w, h) {
        var R = Math.sqrt(w * w + h * h) / Math.SQRT2, cx = w / 2, cy = h / 2;
        var dx = Math.max(b.x0 - cx, 0, cx - b.x1), dy = Math.max(b.y0 - cy, 0, cy - b.y1);
        var fx = Math.max(Math.abs(b.x0 - cx), Math.abs(b.x1 - cx)), fy = Math.max(Math.abs(b.y0 - cy), Math.abs(b.y1 - cy));
        return [Math.hypot(dx, dy) / R, Math.hypot(fx, fy) / R];
      }
    }
  };
  if (d.getAttribute("data-bleed-state") === "before") {
    var BLOCKS = "h1, h2, h3, h4, h5, h6, p, li, dt, dd, summary, figcaption, blockquote, th, td, pre, label, .lift, .trace-bead, .nts-header, [data-bleed-block]";
    var PROPS = ["color", "background-color", "border-color", "outline-color", "text-decoration-color", "text-shadow", "box-shadow", "fill", "stroke"];
    var ease = function (x) { return 1 - Math.pow(1 - x, 3); };
    var unease = function (u) { return 1 - Math.cbrt(1 - u); };
    var XHTML = "http://www.w3.org/1999/xhtml";
    var hasText = function (el) {
      for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && /\S/.test(n.nodeValue)) return true;
      return false;
    };
    var running = false;
    var bleed = function () {
      if (running) return;
      running = true;
      var form = NTS.bleed.form || "sweep";
      if (typeof form === "string") form = NTS.bleed.forms[form] || NTS.bleed.forms.sweep;
      var dur = +NTS.bleed.duration || parseFloat(getComputedStyle(d).getPropertyValue("--dur-bleed")) * 1000 || 1600;
      var w = innerWidth, h = innerHeight, world = document.body.getAttribute("data-world");
      var blocks = NTS.bleed.blocks ? BLOCKS + ", " + NTS.bleed.blocks : BLOCKS;
      var flip = function () {
        d.setAttribute("data-bleed-state", "world");
        dispatchEvent(new CustomEvent("nts:bleed", { detail: { phase: "end", world: world, duration: 0, at: function () { return 0; } } }));
      };
      if (still.matches || !dur) { flip(); return; }

      /* 1. measure: which elements are crossed whole, and where everything is */
      var items = [], spans = [];
      var box = function (r) { return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }; };
      Array.prototype.forEach.call(document.body.getElementsByTagName("*"), function (el) {
        if (el.namespaceURI !== XHTML && el.parentNode.namespaceURI !== XHTML) return;
        var tag = el.tagName.toLowerCase();
        if (tag === "script" || tag === "style" || tag === "template") return;
        var r = el.getBoundingClientRect();
        if (!r.width && !r.height) return;
        var b = box(r), whole = el.matches(blocks) || hasText(el);
        var it = { el: el, b: b, whole: whole };
        if (r.bottom <= 0 || r.top >= h) it.p = 2; /* off-screen: with the body, at the end */
        else {
          var c = form.cover(b, w, h);
          var p0 = Math.max(0, Math.min(1, c[0])), p1 = Math.max(0, Math.min(1, c[1]));
          if (whole) { spans.push([p0, p1]); it.p = p0; } else it.p = (p0 + p1) / 2;
        }
        items.push(it);
      });
      /* 2. the warp: merge the text intervals; the front jumps across them */
      spans.sort(function (a, b) { return a[0] - b[0]; });
      var merged = [];
      spans.forEach(function (sp) {
        var last = merged[merged.length - 1];
        if (last && sp[0] <= last[1]) last[1] = Math.max(last[1], sp[1]); else merged.push([sp[0], sp[1]]);
      });
      var gaps = 1;
      merged.forEach(function (m) { gaps -= m[1] - m[0]; });
      if (gaps < 0.05) gaps = 0.05;
      var gapAt = function (p) { /* progress -> how much open ground lies before it */
        var g = p;
        for (var i = 0; i < merged.length; i++) {
          if (merged[i][0] >= p) break;
          g -= Math.min(merged[i][1], p) - merged[i][0];
        }
        return Math.max(0, Math.min(gaps, g));
      };
      var frontAt = function (g) { /* open ground crossed -> progress */
        var p = g;
        for (var i = 0; i < merged.length; i++) { if (p >= merged[i][0] - 1e-6) p += merged[i][1] - merged[i][0]; else break; }
        return Math.min(1, p);
      };
      var timeAt = function (p) { return p > 1 ? dur : Math.round(unease(gapAt(p) / gaps) * dur); };
      var at = function (el) {
        var r = el.getBoundingClientRect(), c = form.cover(box(r), w, h);
        return timeAt((Math.max(0, Math.min(1, c[0])) + Math.max(0, Math.min(1, c[1]))) / 2);
      };
      /* 3. hold every element's colours until the front reaches it: an
         inline snapshot of what it shows now, released on the front's
         schedule. Explicit values, not delayed transitions: a child inherits
         its parent's animated value, so a transition held on a container
         would hold its text past the front. color is held only where an
         element has text of its own or sets its own colour; the rest is
         inherited and follows its holder. */
      var SURF = ["background-color", "border-color", "box-shadow", "text-shadow", "text-decoration-color"];
      var hold = function (el, t, withColor) {
        var cs = getComputedStyle(el), keep = { el: el, t: t, props: [] };
        (withColor ? ["color"].concat(SURF) : SURF).forEach(function (pr) {
          keep.props.push([pr, el.style.getPropertyValue(pr), el.style.getPropertyPriority(pr), cs.getPropertyValue(pr)]);
        });
        keep.tr = el.style.transition;
        return keep;
      };
      var held = items.map(function (it) {
        var own = it.whole && hasText(it.el);
        if (!own) { var pc = it.el.parentElement; own = !pc || getComputedStyle(it.el).color !== getComputedStyle(pc).color; }
        return hold(it.el, timeAt(it.p), own);
      });
      held.push(hold(document.body, dur, false));
      held.forEach(function (k) {
        k.props.forEach(function (q) { k.el.style.setProperty(q[0], q[3]); });
        k.el.style.transition = "none";
      });
      var release = function (k) {
        k.props.forEach(function (q) { if (q[1]) k.el.style.setProperty(q[0], q[1], q[2]); else k.el.style.removeProperty(q[0]); });
        k.done = true;
      };
      held.sort(function (x, y) { return x.t - y.t; });
      /* 4. the front, then the flip */
      var front = document.createElement("div");
      front.className = "nts-bleed-front";
      front.setAttribute("aria-hidden", "true");
      front.style.top = scrollY + "px"; front.style.height = h + "px";
      front.style.clipPath = form.clip(0, w, h);
      document.body.prepend(front);
      void getComputedStyle(document.body).color;
      d.setAttribute("data-bleed-state", "in");
      dispatchEvent(new CustomEvent("nts:bleed", { detail: { phase: "start", world: world, duration: dur, at: at } }));
      var t0 = performance.now(), next = 0;
      var tick = function (now) {
        var el = now - t0, u = Math.min(1, el / dur);
        front.style.clipPath = form.clip(frontAt(ease(u) * gaps), w, h);
        while (next < held.length && held[next].t <= el) release(held[next++]);
        if (u < 1) { requestAnimationFrame(tick); return; }
        while (next < held.length) release(held[next++]);
        void getComputedStyle(document.body).color;
        held.forEach(function (k) { k.el.style.transition = k.tr; });
        front.remove();
        flip();
      };
      requestAnimationFrame(tick);
    };
    if (d.getAttribute("data-bleed") === "time") {
      setTimeout(bleed, +d.getAttribute("data-bleed-after") || 2400);
    } else {
      var start = scrollY, armed = false;
      var watch = function () {
        if (!armed) { armed = true; start = scrollY; return; }
        if (scrollY - start > innerHeight * 0.33) { removeEventListener("scroll", watch); bleed(); }
      };
      addEventListener("scroll", watch, { passive: true });
    }
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
})();

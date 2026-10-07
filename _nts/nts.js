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
    /* a sentinel the height of the threshold at the very top of the page: the
       header is marked once it has scrolled out of view, with no scroll
       listener and no layout read */
    var sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:8px;pointer-events:none;visibility:hidden";
    document.body.appendChild(sentinel);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        header.classList.toggle("is-scrolled", !es[es.length - 1].isIntersecting);
      }, { threshold: 0 }).observe(sentinel);
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

  /* the world bleed-in.
     The world's ground arrives as a front: a layer (.nts-bleed-front,
     fixed to the viewport while it runs) clipped to a shape that grows
     with progress p in 0..1, while the tokens flip at once underneath and
     every element holds an inline snapshot of its old colours until the
     front reaches it. Text blocks are crossed in one jump: the front's
     progress is warped so the intervals they cover take no time, which is
     what keeps every frame readable. Positions are read on every frame, so
     a scroll that keeps moving after the trigger carries elements across
     the front and they switch (or switch back) where they are. Elements
     still outside the viewport switch with the body's own background, at
     the end. An image made of text ([role=img]) is crossed like ground.
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

      /* 1. measure, once: the elements, and which are crossed whole. Their
         geometry is read again on every frame (4.), since a scroll that is
         still moving carries them past the front. An image made of text
         ([role=img] with text of its own, INTERSECT's ASCII solid) is not a
         text block: the front crosses it like ground, through two copies of
         its glyphs (3.). */
      var IMG = "[role='img']";
      var clamp = function (x) { return Math.max(0, Math.min(1, x)); };
      var spanOf = function (el, w, h) { /* [p0, p1] of the visible part of el, or null off-screen */
        var r = el.getBoundingClientRect();
        if ((!r.width && !r.height) || r.bottom <= 0 || r.top >= h || r.right <= 0 || r.left >= w) return null;
        var c = form.cover({ x0: Math.max(0, r.left), y0: Math.max(0, r.top), x1: Math.min(w, r.right), y1: Math.min(h, r.bottom) }, w, h);
        return [clamp(c[0]), clamp(c[1])];
      };
      /* text on a surface of its own (an ancestor with an opaque
         background, which covers the front) switches with that surface,
         since that is the ground it is read on; only text on open ground
         follows the front. */
      var opaque = function (el) { var m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g); return !!m && (m.length < 4 || +m[3] >= 0.5); };
      var items = [], index = new Map();
      Array.prototype.forEach.call(document.body.getElementsByTagName("*"), function (el) {
        if (el.namespaceURI !== XHTML && el.parentNode.namespaceURI !== XHTML) return;
        var tag = el.tagName.toLowerCase();
        if (tag === "script" || tag === "style" || tag === "template") return;
        var r = el.getBoundingClientRect();
        if (!r.width && !r.height) return;
        var on = -1;
        for (var a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          if (index.has(a) && items[index.get(a)].surface) { on = index.get(a); break; }
        }
        var glyphs = on < 0 && el.matches(IMG) && hasText(el);
        index.set(el, items.length);
        items.push({ el: el, glyphs: glyphs, whole: !glyphs && (el.matches(blocks) || hasText(el)), surface: opaque(el), on: on });
      });
      /* 2. the warp: merge the text intervals; the front jumps across them.
         open is the share of the run that is open ground. */
      var mergeOf = function (spans) {
        var merged = [];
        spans.filter(Boolean).sort(function (a, b) { return a[0] - b[0]; }).forEach(function (sp) {
          var last = merged[merged.length - 1];
          if (last && sp[0] <= last[1]) last[1] = Math.max(last[1], sp[1]); else merged.push([sp[0], sp[1]]);
        });
        return merged;
      };
      var openOf = function (merged) {
        var g = 1;
        merged.forEach(function (m) { g -= m[1] - m[0]; });
        return Math.max(0.05, g);
      };
      var textSpans = function (w, h) {
        return items.map(function (it) { return it.whole && it.on < 0 ? spanOf(it.el, w, h) : null; });
      };
      var frontAt = function (g, merged) { /* open ground crossed -> progress */
        var p = g;
        for (var i = 0; i < merged.length; i++) { if (p >= merged[i][0] - 1e-6) p += merged[i][1] - merged[i][0]; else break; }
        return Math.min(1, p);
      };
      /* at(el): the front's schedule as measured at the start */
      var merged0 = mergeOf(textSpans(w, h)), open0 = openOf(merged0);
      var gapAt = function (p) { /* progress -> how much open ground lies before it */
        var g = p;
        for (var i = 0; i < merged0.length; i++) {
          if (merged0[i][0] >= p) break;
          g -= Math.min(merged0[i][1], p) - merged0[i][0];
        }
        return Math.max(0, Math.min(open0, g));
      };
      var at = function (el) {
        var s = spanOf(el, w, h);
        return s ? Math.round(unease(gapAt((s[0] + s[1]) / 2) / open0) * dur) : dur;
      };
      /* 3. hold every element's colours until the front reaches it: an
         inline snapshot of what it shows now, released (or put back) on
         every frame by where the element is against the front. Explicit
         values, not delayed transitions: a child inherits its parent's
         animated value, so a transition held on a container would hold its
         text past the front. color is held only where an element has text
         of its own or sets its own colour; the rest is inherited and
         follows its holder. */
      var SURF = ["background-color", "border-color", "box-shadow", "text-shadow", "text-decoration-color"];
      var hold = function (el, withColor) {
        var cs = getComputedStyle(el), keep = { el: el, props: [] };
        (withColor ? ["color"].concat(SURF) : SURF).forEach(function (pr) {
          keep.props.push([pr, el.style.getPropertyValue(pr), el.style.getPropertyPriority(pr), cs.getPropertyValue(pr)]);
        });
        keep.tr = el.style.transition;
        return keep;
      };
      var held = items.map(function (it) {
        var own = (it.whole || it.glyphs) && hasText(it.el);
        if (!own) { var pc = it.el.parentElement; own = !pc || getComputedStyle(it.el).color !== getComputedStyle(pc).color; }
        return hold(it.el, own);
      });
      var ends = [hold(document.body, false), hold(d, false)];
      var put = function (k) { k.props.forEach(function (q) { k.el.style.setProperty(q[0], q[3]); }); k.done = false; };
      var release = function (k) {
        k.props.forEach(function (q) { if (q[1]) k.el.style.setProperty(q[0], q[1], q[2]); else k.el.style.removeProperty(q[0]); });
        k.done = true;
      };
      held.concat(ends).forEach(function (k) { put(k); k.el.style.transition = "none"; });
      /* an image of text on open ground: its own glyphs are hidden while
         the front runs, and two copies follow its box and its text on every
         frame: one in its old colours under the front, one in the world's
         colours over the page, in a layer clipped like the front. */
      var COPY = ["font-family", "font-size", "font-weight", "font-style", "font-stretch", "font-variation-settings", "font-feature-settings", "font-kerning", "line-height", "letter-spacing", "word-spacing", "white-space", "text-align", "text-indent", "tab-size", "padding-top", "padding-right", "padding-bottom", "padding-left", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width"];
      var glyphs = [];
      var copyOf = function (el, cs, clips, under) {
        var layer = document.createElement("div"), box = document.createElement("div"), copy = document.createElement("pre");
        layer.className = "nts-bleed-glyphs" + (under ? " under" : ""); layer.setAttribute("aria-hidden", "true");
        COPY.forEach(function (pr) { copy.style.setProperty(pr, cs.getPropertyValue(pr)); });
        box.appendChild(copy); layer.appendChild(box);
        return { el: el, layer: layer, box: box, copy: copy, clips: clips, under: under };
      };
      items.forEach(function (it) {
        if (!it.glyphs) return;
        var cs = getComputedStyle(it.el), clips = [];
        for (var a = it.el.parentElement; a && a !== document.body; a = a.parentElement) {
          var ac = getComputedStyle(a);
          if (ac.overflowX !== "visible" || ac.overflowY !== "visible") clips.push(a);
        }
        var lo = copyOf(it.el, cs, clips, true), hi = copyOf(it.el, cs, clips, false);
        lo.copy.style.color = cs.color; lo.copy.style.textShadow = cs.textShadow;
        document.body.prepend(lo.layer); document.body.appendChild(hi.layer);
        glyphs.push(lo, hi);
      });
      var place = function (gl, clip) {
        var r = gl.el.getBoundingClientRect(), x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
        gl.clips.forEach(function (a) {
          var c = a.getBoundingClientRect();
          x0 = Math.max(x0, c.left); y0 = Math.max(y0, c.top); x1 = Math.min(x1, c.right); y1 = Math.min(y1, c.bottom);
        });
        var g = gl.box.style, c = gl.copy.style;
        g.left = x0 + "px"; g.top = y0 + "px"; g.width = Math.max(0, x1 - x0) + "px"; g.height = Math.max(0, y1 - y0) + "px";
        c.left = (r.left - x0) + "px"; c.top = (r.top - y0) + "px"; c.width = r.width + "px"; c.height = r.height + "px";
        if (gl.copy.textContent !== gl.el.textContent) gl.copy.textContent = gl.el.textContent;
        if (!gl.under) gl.layer.style.clipPath = clip;
      };
      /* 4. the front, fixed to the viewport while it runs, then the flip */
      var front = document.createElement("div");
      front.className = "nts-bleed-front";
      front.setAttribute("aria-hidden", "true");
      front.style.clipPath = form.clip(0, w, h);
      document.body.prepend(front);
      void getComputedStyle(document.body).color;
      d.setAttribute("data-bleed-state", "in");
      /* the upper copy takes what the element would show in the world */
      glyphs.forEach(function (gl) {
        if (!gl.under) {
          var k = held[index.get(gl.el)];
          release(k);
          var cs = getComputedStyle(gl.el);
          gl.copy.style.color = cs.color; gl.copy.style.textShadow = cs.textShadow;
          put(k);
          gl.el.style.setProperty("color", "transparent"); gl.el.style.setProperty("text-shadow", "none");
        }
        place(gl, front.style.clipPath);
      });
      dispatchEvent(new CustomEvent("nts:bleed", { detail: { phase: "start", world: world, duration: dur, at: at } }));
      var t0 = performance.now(), p = 0;
      var tick = function (now) {
        var u = Math.min(1, (now - t0) / dur), vw = innerWidth, vh = innerHeight;
        if (u < 1) {
          /* where the front is: the warp on the text where it is now, never
             backwards, and never resting inside a text block */
          var merged = mergeOf(textSpans(vw, vh));
          p = Math.max(p, frontAt(ease(u) * openOf(merged), merged));
          merged.forEach(function (m) { if (p >= m[0] - 1e-6 && p < m[1]) p = m[1]; });
          var clip = form.clip(p, vw, vh);
          front.style.clipPath = clip;
          glyphs.forEach(function (gl) { place(gl, clip); });
          /* each element shows the world once the front has reached it
             (text blocks: touched, so crossed; the rest: half covered), and
             its old colours while it is ahead of the front; text on a
             surface goes with the surface */
          items.forEach(function (it, i) {
            if (it.glyphs) return;
            var k = held[i], reached;
            if (it.whole && it.on >= 0) reached = held[it.on].done;
            else {
              var s = spanOf(it.el, vw, vh);
              if (!s) return;
              reached = it.whole ? p >= s[0] - 1e-6 : p >= (s[0] + s[1]) / 2;
            }
            if (reached && !k.done) release(k); else if (!reached && k.done) put(k);
          });
          requestAnimationFrame(tick); return;
        }
        held.concat(ends).forEach(function (k) { if (!k.done) release(k); });
        void getComputedStyle(document.body).color;
        held.concat(ends).forEach(function (k) { k.el.style.transition = k.tr; });
        glyphs.forEach(function (gl) { gl.layer.remove(); });
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

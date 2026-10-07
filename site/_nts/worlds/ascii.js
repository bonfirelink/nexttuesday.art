/* INTERSECT's entity: a solid of sacred geometry rendered as characters,
   the way donut.c renders its torus. Points are sampled on the surface,
   rotated, projected through a z-buffer, and lit; the light at each cell
   picks a character from a ramp. Flat figures precess rather than spin, so
   they never collapse into a line.
   Figures: "tetra" (the solid of fire; INTERSECT's own, the ASCII triangle),
   "heptagram" (a ring, a {7/3} star of tubes, seven nodes), "seed" (seven
   rings, the seed of life).
   A <pre data-nts-ascii="tetra"> holds a baked still frame as its text (see
   tools/gen-stills.mjs), so the page reads with scripts off; this replaces
   it with a live one. <div data-nts-fragment="intersect"> gets a small
   non-interactive one. Capped at 30 fps (15 for fragments), paused
   off-screen and in hidden tabs; under prefers-reduced-motion it draws one
   frame and only turns when dragged. Runs in node too (module.exports). */
(function () {
  "use strict";
  var RAMP = " .,:;-=+*#%@", TAU = Math.PI * 2;
  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function torus(out, cx, cy, R, r, steps) {
    var sa = steps || Math.round(R * 520), sb = Math.max(8, Math.round(r * 180));
    for (var i = 0; i < sa; i++) {
      var th = (i / sa) * TAU, ct = Math.cos(th), st = Math.sin(th);
      for (var j = 0; j < sb; j++) {
        var ph = (j / sb) * TAU, cp = Math.cos(ph), sp = Math.sin(ph);
        out.push(cx + (R + r * cp) * ct, cy + (R + r * cp) * st, r * sp, cp * ct, cp * st, sp);
      }
    }
  }
  function capsule(out, a, b, r) {
    var d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(d[0], d[1], d[2]);
    d = norm(d);
    var helper = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    var u = norm(cross(d, helper)), v = cross(d, u);
    var sa = Math.round(len * 110), sb = Math.max(8, Math.round(r * 180));
    for (var i = 0; i <= sa; i++) {
      var t = (i / sa) * len;
      for (var j = 0; j < sb; j++) {
        var ph = (j / sb) * TAU, cp = Math.cos(ph), sp = Math.sin(ph);
        var nx = cp * u[0] + sp * v[0], ny = cp * u[1] + sp * v[1], nz = cp * u[2] + sp * v[2];
        out.push(a[0] + d[0] * t + r * nx, a[1] + d[1] * t + r * ny, a[2] + d[2] * t + r * nz, nx, ny, nz);
      }
    }
  }
  function sphere(out, c, r) {
    var sa = Math.round(r * 300), sb = sa * 2;
    for (var i = 1; i < sa; i++) {
      var th = (i / sa) * Math.PI, st = Math.sin(th), ct = Math.cos(th);
      for (var j = 0; j < sb; j++) {
        var ph = (j / sb) * TAU, nx = st * Math.cos(ph), ny = st * Math.sin(ph), nz = ct;
        out.push(c[0] + r * nx, c[1] + r * ny, c[2] + r * nz, nx, ny, nz);
      }
    }
  }
  function triangle(out, a, b, c, n) {
    var steps = 70;
    for (var i = 0; i <= steps; i++) for (var j = 0; j <= steps - i; j++) {
      var u = i / steps, v = j / steps, w = 1 - u - v;
      out.push(a[0] * u + b[0] * v + c[0] * w, a[1] * u + b[1] * v + c[1] * w, a[2] * u + b[2] * v + c[2] * w, n[0], n[1], n[2]);
    }
  }
  var FIGURES = {
    heptagram: function () {
      var out = [], R = 0.86, i, verts = [];
      torus(out, 0, 0, 1, 0.07);
      for (i = 0; i < 7; i++) { var a = -Math.PI / 2 + (i / 7) * TAU; verts.push([R * Math.cos(a), R * Math.sin(a), 0]); }
      for (i = 0; i < 7; i++) capsule(out, verts[i], verts[(i + 3) % 7], 0.045);
      for (i = 0; i < 7; i++) sphere(out, verts[i], 0.085);
      return { pts: out, flat: true };
    },
    tetra: function () {
      var out = [], s = 1 / Math.sqrt(3);
      var V = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(function (v) { return [v[0] * s, v[1] * s, v[2] * s]; });
      [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]].forEach(function (f) {
        var a = V[f[0]], b = V[f[1]], c = V[f[2]];
        triangle(out, a, b, c, norm([a[0] + b[0] + c[0], a[1] + b[1] + c[1], a[2] + b[2] + c[2]]));
      });
      var faceEnd = out.length / 6;
      [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]].forEach(function (e) { capsule(out, V[e[0]], V[e[1]], 0.032); });
      return { pts: out, flat: false, faceEnd: faceEnd };
    },
    seed: function () {
      var out = [], R = 0.5, r = 0.04;
      torus(out, 0, 0, R, r);
      for (var i = 0; i < 6; i++) { var a = (i / 6) * TAU; torus(out, R * Math.cos(a), R * Math.sin(a), R, r); }
      return { pts: out, flat: true };
    }
  };
  function mul(a, b) {
    var o = new Array(9);
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    return o;
  }
  /* One frame as lines of text (trailing spaces trimmed). cols/rows: the
     cell grid; aspect: cell width over height; pose: {phi, alpha, spin} for
     flat figures, {ax, ay} for solids. */
  function lines(fig, cols, rows, aspect, pose, zoom) {
    var pts = fig.pts, n = pts.length / 6, faceEnd = fig.faceEnd || 0;
    var K2 = 6, K1 = (zoom || 0.9) * (cols / 2) * K2, cx = cols / 2, cy = rows / 2;
    var L = norm([0.25, 0.55, -0.8]);
    var zb = new Float32Array(cols * rows), chars = new Array(cols * rows), k, m;
    for (k = 0; k < cols * rows; k++) chars[k] = " ";
    if (fig.flat) {
      var cs = Math.cos(pose.spin), ss = Math.sin(pose.spin), ca = Math.cos(pose.alpha), sa = Math.sin(pose.alpha), cp = Math.cos(pose.phi), sp = Math.sin(pose.phi);
      m = mul([cp, -sp, 0, sp, cp, 0, 0, 0, 1], mul([1, 0, 0, 0, ca, -sa, 0, sa, ca], [cs, -ss, 0, ss, cs, 0, 0, 0, 1]));
    } else {
      var cxr = Math.cos(pose.ax), sxr = Math.sin(pose.ax), cyr = Math.cos(pose.ay), syr = Math.sin(pose.ay);
      m = mul([1, 0, 0, 0, cxr, -sxr, 0, sxr, cxr], [cyr, 0, syr, 0, 1, 0, -syr, 0, cyr]);
    }
    for (k = 0; k < n; k++) {
      var i = k * 6, x = pts[i], y = pts[i + 1], z = pts[i + 2], nx = pts[i + 3], ny = pts[i + 4], nz = pts[i + 5];
      var X = m[0] * x + m[1] * y + m[2] * z, Y = m[3] * x + m[4] * y + m[5] * z, Z = m[6] * x + m[7] * y + m[8] * z;
      var NX = m[0] * nx + m[1] * ny + m[2] * nz, NY = m[3] * nx + m[4] * ny + m[5] * nz, NZ = m[6] * nx + m[7] * ny + m[8] * nz;
      if (NZ > 0.35) continue;
      var ooz = 1 / (Z + K2);
      var xp = (cx + K1 * X * ooz) | 0, yp = (cy - K1 * Y * ooz * aspect) | 0;
      if (xp < 0 || xp >= cols || yp < 0 || yp >= rows) continue;
      var idx = yp * cols + xp;
      if (ooz > zb[idx]) {
        zb[idx] = ooz;
        var lum = NX * L[0] + NY * L[1] + NZ * L[2] + 1.0 * (ooz * K2 - 1);
        if (k < faceEnd) {
          var h = Math.sin(xp * 12.9898 + yp * 78.233) * 43758.5453; h -= Math.floor(h);
          var density = Math.max(0.04, Math.min(0.6, (lum + 0.15) * 0.45));
          chars[idx] = h < density ? (lum > 0.85 ? ":" : ".") : " ";
        } else {
          chars[idx] = RAMP[lum > 0 ? 1 + Math.min(10, (lum * 11) | 0) : 1];
        }
      }
    }
    var out = [];
    for (var r = 0; r < rows; r++) out.push(chars.slice(r * cols, (r + 1) * cols).join("").replace(/\s+$/, ""));
    return out;
  }
  /* the same frame as one string, as a <pre> holds it */
  function render(fig, cols, rows, aspect, pose, zoom) { return lines(fig, cols, rows, aspect, pose, zoom).join("\n"); }
  var built = {};
  function figure(name) { if (!built[name]) built[name] = FIGURES[name](); return built[name]; }
  var api = { render: render, lines: lines, figure: figure, RAMP: RAMP, FIGURES: Object.keys(FIGURES) };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  if (typeof document === "undefined") return;
  window.NTS = window.NTS || {}; window.NTS.ascii = api;

  /* Draws the live solid on a canvas over the <pre>'s box, one fillText
     per line, in the pre's own face, size, colour and glow (its computed
     color and text-shadow, read when the colours can change, never per
     frame): writing the text into the pre instead made the page lay out
     every frame. The pre stays the box, the target of drag and keys, and
     the accessible element (role, label); its baked still text moves into a
     span that is hidden once the canvas draws. GLOW: "canvas" blurs each
     line's shadow in the canvas (as text-shadow does per line), "css" puts
     the text-shadow on the canvas element as a drop-shadow filter. */
  var GLOW = window.NTS_ASCII_GLOW || "canvas";
  function look(el) {
    var cs = getComputedStyle(el), m = /^(.*?)\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+([\d.]+)px)?/.exec(cs.textShadow || "");
    return { fill: cs.color, font: cs.fontStyle + " " + cs.fontWeight + " ", family: cs.fontFamily, glow: m ? { c: m[1], x: +m[2], y: +m[3], b: +(m[4] || 0) } : null };
  }
  function mount(pre, name, cols, lite) {
    if (!FIGURES[name]) return;
    var canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.setAttribute("aria-hidden", "true");
    var baked = document.createElement("span");
    baked.className = "ascii-still";
    while (pre.firstChild) baked.appendChild(pre.firstChild);
    pre.appendChild(baked); pre.appendChild(canvas);
    var fig = figure(name);
    var still = matchMedia("(prefers-reduced-motion: reduce)");
    var rows = 0, aspect = 0.6, FPS = lite ? 15 : 30, size = 0, base = 0, dpr = 1, day = null, night = null;
    var pose = { phi: 0.6, alpha: 0.52, spin: 0.3, ax: -0.5, ay: 0.4 };
    var speed = 1, dragging = false, lastX = 0, lastY = 0, visible = true, held = false, raf = 0, last = 0, acc = 0, tAcc = 0;
    /* Sizes the glyphs so `cols` cells span the box. The box is reserved by
       CSS (a square), so nothing here changes the layout. The cell ratio
       comes from the loaded face: a fallback face measures differently (and
       a face still in its block period measures nothing), so the ratio is
       clamped to what a monospace face can be and the size to a sane range,
       and fit() runs again once the face is in. The probe is read with
       offsetWidth: getBoundingClientRect would include the scale of a
       transformed ancestor (the home's windows are scaled). The baseline
       sits where a line box of line-height 1 puts it: half the leading
       above the face's ascent. */
    var fitted = 0, gaveUp = false;
    function fit() {
      var w = pre.clientWidth; if (!w) return;
      var probe = document.createElement("span");
      probe.textContent = "M".repeat(100);
      probe.style.cssText = "position:absolute;visibility:hidden;font-size:100px;line-height:1;letter-spacing:0";
      pre.appendChild(probe);
      var cw = probe.offsetWidth / 10000; pre.removeChild(probe);
      var ratio = Math.min(0.7, Math.max(0.5, cw || 0.6));
      size = Math.min(24, Math.max(3, w / cols / ratio)); aspect = ratio; rows = Math.max(1, Math.floor(w / size)); fitted = w;
      dpr = Math.min(3, devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round((pre.clientHeight || w) * dpr);
      if (twin) { twin.width = canvas.width; twin.height = canvas.height; }
      day = look(pre);
      /* the baseline as the pre's lines put it: a line of the face at this
         size, line-height 1, in a probe outside any transformed ancestor */
      var line = document.createElement("div"), mark = document.createElement("span");
      line.style.cssText = "position:absolute;left:0;top:0;visibility:hidden;white-space:pre;font:" + day.font + size + "px " + day.family + ";line-height:1";
      mark.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
      line.textContent = "M"; line.appendChild(mark); document.body.appendChild(line);
      base = mark.getBoundingClientRect().top - line.getBoundingClientRect().top; document.body.removeChild(line);
      if (!(base > 0)) base = size * 0.8;
    }
    function glow(c, el, st) {
      if (GLOW === "css") { el.style.filter = st.glow ? "drop-shadow(" + st.glow.x + "px " + st.glow.y + "px " + st.glow.b + "px " + st.glow.c + ")" : ""; return; }
    }
    function paint(c, el, st, ls) {
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, el.width, el.height);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.font = st.font + size + "px " + st.family; c.fillStyle = st.fill; c.textBaseline = "alphabetic";
      if (GLOW === "canvas" && st.glow) { c.shadowColor = st.glow.c; c.shadowBlur = st.glow.b * dpr; c.shadowOffsetX = st.glow.x * dpr; c.shadowOffsetY = st.glow.y * dpr; } else c.shadowColor = "transparent";
      for (var r = 0; r < ls.length; r++) if (ls[r]) c.fillText(ls[r], 0, r * size + base);
    }
    var pending = 0, live = false, family = getComputedStyle(pre).fontFamily, fonts = document.fonts;
    /* Before the face is in (or given up on) nothing is measured; while it
       is still loading later, a refit would measure the fallback. */
    function faceReady() { try { return !fonts || !fonts.check || fonts.check("400 100px " + family, "M"); } catch (e) { return true; } }
    function refit() {
      if (pending || !live || !(faceReady() || gaveUp)) return;
      pending = requestAnimationFrame(function () { pending = 0; fit(); glow(ctx, canvas, day); if (rows) draw(); });
    }
    /* while a world bleed-in's disc opens, the glyphs also go to the
       canvas's twin in the disc's copy (NTS.bleed.twin), in the colours the
       twin pre computes (the world's); each only while some of it is in view */
    var twin = null, tctx = null;
    function twinUp() {
      var B = window.NTS && window.NTS.bleed, tp = B && B.twin(pre), tc = B && B.twin(canvas);
      if (!tp || !tc) return;
      tp.classList.add("is-live");
      twin = tc; tctx = twin.getContext("2d"); night = look(tp);
      twin.width = canvas.width; twin.height = canvas.height; glow(tctx, twin, night);
    }
    addEventListener("nts:bleed", function (e) {
      if (e.detail.phase === "start") { twinUp(); if (live && twin) draw(); }
      else if (e.detail.phase === "end") { twin = tctx = night = null; if (live) { day = look(pre); glow(ctx, canvas, day); draw(); } }
    });
    function draw() {
      var ls = lines(fig, cols, rows, aspect, pose, lite ? 1.25 : 0.9), q = twin ? window.NTS.bleed.progress() : 0;
      if (q < 1) paint(ctx, canvas, day, ls);
      if (twin && q > 0) paint(tctx, twin, night, ls);
    }
    function frame(t) {
      raf = 0;
      if (!visible || held || document.hidden) return;
      var dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t; acc += dt; tAcc += dt;
      if (!dragging) { pose.phi += dt * 0.55 * speed; pose.spin += dt * 0.22 * speed; pose.ax += dt * 0.35 * speed; pose.ay += dt * 0.6 * speed; pose.alpha = 0.52 + 0.14 * Math.sin(tAcc * 0.4); }
      if (speed > 1) speed = Math.max(1, speed - dt * 2.5);
      if (acc >= 1 / FPS) { acc = acc % (1 / FPS); draw(); }
      raf = requestAnimationFrame(frame);
    }
    function start() { if (still.matches || raf || !live || !visible || held || document.hidden) return; last = 0; raf = requestAnimationFrame(frame); }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    if (!lite) {
      pre.addEventListener("pointerdown", function (e) { dragging = true; lastX = e.clientX; lastY = e.clientY; pre.setPointerCapture(e.pointerId); });
      pre.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        var dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
        pose.phi += dx * 0.01; pose.spin += dx * 0.004; pose.alpha = Math.max(0.3, Math.min(1.0, pose.alpha + dy * 0.006));
        pose.ay += dx * 0.01; pose.ax += dy * 0.01;
        if (still.matches && live) draw();
      });
      var release = function () { dragging = false; speed = 1; };
      pre.addEventListener("pointerup", release); pre.addEventListener("pointercancel", release); pre.addEventListener("lostpointercapture", release);
      pre.stoke = function () { speed = 4; };
      pre.addEventListener("keydown", function (e) {
        var k = e.key, d = k === "ArrowLeft" ? -1 : k === "ArrowRight" ? 1 : 0, v = k === "ArrowUp" ? -1 : k === "ArrowDown" ? 1 : 0;
        if (!d && !v) return;
        e.preventDefault();
        pose.phi += d * 0.25; pose.spin += d * 0.1; pose.ay += d * 0.25; pose.ax += v * 0.25;
        pose.alpha = Math.max(0.3, Math.min(1.0, pose.alpha + v * 0.08));
        if (still.matches && live) draw();
      });
    }
    /* in an aperture (the home's windows), NTS.live says when it may animate;
       held, it keeps its last frame (start resets the clock) */
    held = !(window.NTS && window.NTS.live ? window.NTS.live.join(pre.closest("[data-nts-fragment]") || pre, function (on) { held = !on; if (on) start(); else stop(); }) : true);
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); else stop(); }, { threshold: 0.05 }).observe(pre);
    document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });
    if ("ResizeObserver" in window) new ResizeObserver(function () { if (Math.abs(pre.clientWidth - fitted) > 0.5) refit(); }).observe(pre);
    else addEventListener("resize", refit);
    function go() {
      live = true; pre.classList.add("is-live");
      fit(); glow(ctx, canvas, day);
      if (!twin) twinUp();
      if (twin) glow(tctx, twin, night);
      draw(); start();
    }
    if (!fonts || !fonts.load) { go(); return; }
    /* The first measure waits for the face (at most 3 s, for a blocked
       network); until then the baked still stays on screen. */
    Promise.race([fonts.load("400 100px " + family, "M"), new Promise(function (r) { setTimeout(r, 3000); })]).catch(function () {}).then(function () {
      gaveUp = !faceReady();
      go();
      fonts.addEventListener("loadingdone", refit);
    });
  }
  function init() {
    document.querySelectorAll("pre[data-nts-ascii]").forEach(function (pre) { mount(pre, pre.getAttribute("data-nts-ascii"), +pre.getAttribute("data-cols") || 84, false); });
    document.querySelectorAll("[data-nts-fragment='intersect']").forEach(function (host) {
      var pre = host.querySelector("pre");
      if (!pre) { pre = document.createElement("pre"); pre.setAttribute("aria-hidden", "true"); host.appendChild(pre); }
      host.classList.add("is-live");
      mount(pre, host.getAttribute("data-figure") || "tetra", +host.getAttribute("data-cols") || 48, true);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

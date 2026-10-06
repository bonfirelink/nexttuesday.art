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
  /* One frame as a string. cols/rows: the cell grid; aspect: cell width over
     height; pose: {phi, alpha, spin} for flat figures, {ax, ay} for solids. */
  function render(fig, cols, rows, aspect, pose, zoom) {
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
    var lines = [];
    for (var r = 0; r < rows; r++) lines.push(chars.slice(r * cols, (r + 1) * cols).join("").replace(/\s+$/, ""));
    return lines.join("\n");
  }
  var built = {};
  function figure(name) { if (!built[name]) built[name] = FIGURES[name](); return built[name]; }
  var api = { render: render, figure: figure, RAMP: RAMP, FIGURES: Object.keys(FIGURES) };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  if (typeof document === "undefined") return;
  window.NTS = window.NTS || {}; window.NTS.ascii = api;

  function mount(pre, name, cols, lite) {
    if (!FIGURES[name]) return;
    var fig = figure(name);
    var still = matchMedia("(prefers-reduced-motion: reduce)");
    var rows = 0, aspect = 0.6, FPS = lite ? 15 : 30;
    var pose = { phi: 0.6, alpha: 0.52, spin: 0.3, ax: -0.5, ay: 0.4 };
    var speed = 1, dragging = false, lastX = 0, lastY = 0, visible = true, raf = 0, last = 0, acc = 0, tAcc = 0;
    function fit() {
      var w = pre.clientWidth; if (!w) return;
      pre.style.fontSize = "100px"; pre.style.lineHeight = "1";
      var probe = document.createElement("span"); probe.textContent = "MMMMMMMMMM"; pre.appendChild(probe);
      var cw = probe.getBoundingClientRect().width / 10; pre.removeChild(probe);
      var ratio = cw / 100 || 0.6, fs = w / cols / ratio;
      pre.style.fontSize = fs + "px"; aspect = ratio; rows = Math.round(cols * ratio); pre.style.height = rows * fs + "px";
    }
    function draw() { pre.textContent = render(fig, cols, rows, aspect, pose, lite ? 1.25 : 0.9); }
    function frame(t) {
      raf = 0;
      if (!visible || document.hidden) return;
      var dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t; acc += dt; tAcc += dt;
      if (!dragging) { pose.phi += dt * 0.55 * speed; pose.spin += dt * 0.22 * speed; pose.ax += dt * 0.35 * speed; pose.ay += dt * 0.6 * speed; pose.alpha = 0.52 + 0.14 * Math.sin(tAcc * 0.4); }
      if (speed > 1) speed = Math.max(1, speed - dt * 2.5);
      if (acc >= 1 / FPS) { acc = acc % (1 / FPS); draw(); }
      raf = requestAnimationFrame(frame);
    }
    function start() { if (still.matches || raf || !visible || document.hidden) return; last = 0; raf = requestAnimationFrame(frame); }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    if (!lite) {
      pre.addEventListener("pointerdown", function (e) { dragging = true; lastX = e.clientX; lastY = e.clientY; pre.setPointerCapture(e.pointerId); });
      pre.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        var dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
        pose.phi += dx * 0.01; pose.spin += dx * 0.004; pose.alpha = Math.max(0.3, Math.min(1.0, pose.alpha + dy * 0.006));
        pose.ay += dx * 0.01; pose.ax += dy * 0.01;
        if (still.matches) draw();
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
        if (still.matches) draw();
      });
    }
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); else stop(); }, { threshold: 0.05 }).observe(pre);
    document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });
    var timer = 0;
    addEventListener("resize", function () { clearTimeout(timer); timer = setTimeout(function () { fit(); draw(); }, 120); });
    fit(); draw(); pre.classList.add("is-live"); start();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fit(); draw(); });
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

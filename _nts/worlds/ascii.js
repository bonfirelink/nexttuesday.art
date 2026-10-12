/* INTERSECT's entity: a solid of sacred geometry rendered as characters,
   the way donut.c renders its torus. Points are sampled on the surface,
   rotated, projected through a z-buffer, and lit; the light at each cell
   picks a character from a ramp. Flat figures precess rather than spin, so
   they never collapse into a line.
   Figures: "tetra" (the solid of fire; INTERSECT's own, the ASCII triangle),
   "heptagram" (a ring, a {7/3} star of tubes, seven nodes), "seed" (seven
   rings, the seed of life).
   A <pre data-nts-ascii="tetra"> holds a baked still frame as its text (see
   tools/gen-stills.mjs), so the page reads with scripts off; this draws a
   live one on a canvas over it (see mount). <div data-nts-fragment="intersect">
   gets a small non-interactive one. Capped at 30 fps (15 for fragments),
   paused off-screen, in hidden tabs and while NTS.live holds it (the home's
   windows); under prefers-reduced-motion it draws one frame and only turns
   when dragged. Runs in node too (module.exports). */
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
  /* the figure's rotation at a pose: {phi, alpha, spin} for flat figures,
     {ax, ay} for solids */
  function turn(fig, pose) {
    if (fig.flat) {
      var cs = Math.cos(pose.spin), ss = Math.sin(pose.spin), ca = Math.cos(pose.alpha), sa = Math.sin(pose.alpha), cp = Math.cos(pose.phi), sp = Math.sin(pose.phi);
      return mul([cp, -sp, 0, sp, cp, 0, 0, 0, 1], mul([1, 0, 0, 0, ca, -sa, 0, sa, ca], [cs, -ss, 0, ss, cs, 0, 0, 0, 1]));
    }
    var cxr = Math.cos(pose.ax), sxr = Math.sin(pose.ax), cyr = Math.cos(pose.ay), syr = Math.sin(pose.ay);
    return mul([1, 0, 0, 0, cxr, -sxr, 0, sxr, cxr], [cyr, 0, syr, 0, 1, 0, -syr, 0, cyr]);
  }
  /* A solid's faces (its points before faceEnd) write depth but no glyph:
     they hide the edges behind them and leave the edges in front to carry
     the figure. They sit FACE_BACK further back, so an edge in front wins
     against its own faces, which meet it at its depth. */
  var K2 = 6, CULL = 0.35, FACE_BACK = 0.05;
  /* How large a figure draws at zoom 1 across the poses it can take: its
     silhouette's span (the larger side of its bounding box) averaged over
     them, in widths of the box the zoom refers to, and its furthest reach
     from the centre at any rotation, in half-widths. A solid's ax and ay
     both grow without bound (the clock and a drag add to them), so the span
     samples the whole torus of pairs; a flat figure spins and precesses
     freely and tilts within the drag's clamp. Points are thinned for the
     span (the surfaces are dense), culled as lines() culls them, and only
     those that draw count (a solid's edges, not its faces). The
     reach is a bound, not a sample: a point at distance r from the centre
     projects at most r*K2/sqrt(K2^2 - r^2) from it, whatever the rotation.
     Once per figure. */
  function extent(fig) {
    if (fig.extent) return fig.extent;
    var pts = fig.pts, n = pts.length / 6, S = 16, sum = 0, far = 0;
    for (var i = 0; i < S; i++) for (var j = 0; j < S; j++) {
      var a = (i / S) * TAU, b = (j / S) * TAU;
      var m = turn(fig, fig.flat ? { phi: a, spin: b, alpha: 0.3 + 0.7 * j / (S - 1) } : { ax: a, ay: b });
      var x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for (var k = fig.faceEnd || 0; k < n; k += 5) {
        var q = k * 6, x = pts[q], y = pts[q + 1], z = pts[q + 2];
        if (m[6] * pts[q + 3] + m[7] * pts[q + 4] + m[8] * pts[q + 5] > CULL) continue;
        var o = K2 / (m[6] * x + m[7] * y + m[8] * z + K2), X = (m[0] * x + m[1] * y + m[2] * z) * o, Y = (m[3] * x + m[4] * y + m[5] * z) * o;
        if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
      }
      sum += Math.max(x1 - x0, y1 - y0) / 2;
    }
    for (k = 0; k < n; k++) { var r = Math.hypot(pts[k * 6], pts[k * 6 + 1], pts[k * 6 + 2]); far = Math.max(far, r * K2 / Math.sqrt(K2 * K2 - r * r)); }
    return (fig.extent = { span: sum / (S * S), reach: far });
  }
  /* The zoom at which the figure's mean span is `span` box widths, at most
     the one at which its furthest reach stays within `room` half-widths
     (the space drawn around the box: a glyph past it would be cut off).
     The spans are geometric; the glyphs' own width adds about 5%. The hero
     then spans its ring about as the other worlds' figures do (their mean
     over a turn is a little over the ring, as is the solid's), overshooting
     it at its widest poses onto the canvas drawn around the ring; the
     fragment keeps the size it had, its window cutting its widest poses as
     the other worlds' fragments are cut by theirs. */
  var SPAN = { hero: 0.97, fragment: 1.015 };
  /* the pose a figure starts in, which the baked stills show too (see
     tools/gen-stills.mjs): at the page's fit the solid keeps a glyph clear
     of its still's grid, which has no room around the box to overshoot */
  var POSE = { phi: 0.6, alpha: 0.52, spin: 0.3, ax: -0.1, ay: 0.25 };
  function fitZoom(fig, span, room) {
    var e = extent(fig);
    return Math.min(span / e.span, (room || Infinity) / e.reach);
  }
  /* One frame as lines of text (trailing spaces trimmed). cols/rows: the
     cell grid; aspect: cell width over height; pose: see turn(); zoom: the
     figure's scale in widths of `unit` columns (default cols), centred on
     the grid, so a grid wider than the box draws around it. */
  var buf = null;
  function lines(fig, cols, rows, aspect, pose, zoom, unit) {
    var pts = fig.pts, n = pts.length / 6, faceEnd = fig.faceEnd || 0;
    var K1 = (zoom || 0.9) * ((unit || cols) / 2) * K2, cx = cols / 2, cy = rows / 2;
    var L = norm([0.25, 0.55, -0.8]);
    var size = cols * rows, k, m = turn(fig, pose);
    /* the depth and glyph buffers are kept between frames of one grid size
       (every frame allocated them anew, for the collector to take back) */
    if (!buf || buf.size !== size) buf = { size: size, zb: new Float32Array(size), chars: new Array(size) };
    var zb = buf.zb, chars = buf.chars;
    zb.fill(0);
    for (k = 0; k < size; k++) chars[k] = " ";
    for (k = 0; k < n; k++) {
      var i = k * 6, x = pts[i], y = pts[i + 1], z = pts[i + 2], nx = pts[i + 3], ny = pts[i + 4], nz = pts[i + 5];
      var X = m[0] * x + m[1] * y + m[2] * z, Y = m[3] * x + m[4] * y + m[5] * z, Z = m[6] * x + m[7] * y + m[8] * z;
      var NX = m[0] * nx + m[1] * ny + m[2] * nz, NY = m[3] * nx + m[4] * ny + m[5] * nz, NZ = m[6] * nx + m[7] * ny + m[8] * nz;
      if (NZ > CULL) continue;
      var ooz = 1 / (Z + K2 + (k < faceEnd ? FACE_BACK : 0));
      var xp = (cx + K1 * X * ooz) | 0, yp = (cy - K1 * Y * ooz * aspect) | 0;
      if (xp < 0 || xp >= cols || yp < 0 || yp >= rows) continue;
      var idx = yp * cols + xp;
      if (ooz > zb[idx]) {
        zb[idx] = ooz;
        var lum = NX * L[0] + NY * L[1] + NZ * L[2] + 1.0 * (ooz * K2 - 1);
        chars[idx] = k < faceEnd ? " " : RAMP[lum > 0 ? 1 + Math.min(10, (lum * 11) | 0) : 1];
      }
    }
    var out = [];
    for (var r = 0; r < rows; r++) out.push(chars.slice(r * cols, (r + 1) * cols).join("").replace(/\s+$/, ""));
    return out;
  }
  /* the same frame as one string, as a <pre> holds it */
  function render(fig, cols, rows, aspect, pose, zoom, unit) { return lines(fig, cols, rows, aspect, pose, zoom, unit).join("\n"); }
  var built = {};
  function figure(name) { if (!built[name]) built[name] = FIGURES[name](); return built[name]; }
  var api = { render: render, lines: lines, figure: figure, fit: fitZoom, SPAN: SPAN, POSE: POSE, RAMP: RAMP, FIGURES: Object.keys(FIGURES) };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  if (typeof document === "undefined") return;
  window.NTS = window.NTS || {}; window.NTS.ascii = api;

  /* Draws the live solid on a canvas over the <pre>'s box, one fillText
     per line, in the pre's own face, size and colour (its computed color,
     read when the colours can change, never per frame): writing the text
     into the pre instead made the page lay out every frame. The pre stays
     the box, the target of drag and keys, and the accessible element (role,
     label); its baked still text moves into a span that is hidden once the
     canvas draws. */
  function look(el) {
    var cs = getComputedStyle(el);
    return { fill: cs.color, font: cs.fontStyle + " " + cs.fontWeight + " ", family: cs.fontFamily };
  }
  function mount(pre, name, cols, lite) {
    var G = window.NTS.grab;
    if (!FIGURES[name] || !G) return;
    var canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.setAttribute("aria-hidden", "true");
    var baked = document.createElement("span");
    baked.className = "ascii-still";
    while (pre.firstChild) baked.appendChild(pre.firstChild);
    pre.appendChild(baked); pre.appendChild(canvas);
    var fig = figure(name);
    var still = matchMedia("(prefers-reduced-motion: reduce)");
    var rows = 0, grid = cols, aspect = 0.6, FPS = lite ? 15 : 30, size = 0, base = 0, dpr = 1, day = null, night = null;
    /* the canvas may be larger than the pre (CSS sets its overhang): the
       grid covers the canvas, centred on the pre; ox/oy place it on the
       canvas, gx/gy on the pre; zoom fits the figure to the pre's box */
    var ox = 0, oy = 0, gx = 0, gy = 0, zoom = 1, sx = 1, cellW = 0, idealW = 0, unit = cols, kx = 1, ky = 1;
    /* the baseline of grid row r, on a whole pixel of the bitmap */
    function lineY(r) { return Math.round((oy + r * size + base) * ky) / ky; }
    var pose = { phi: POSE.phi, alpha: POSE.alpha, spin: POSE.spin, ax: POSE.ax, ay: POSE.ay };
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
      var w = parseFloat(getComputedStyle(pre).width) || pre.clientWidth; if (!w) return;
      var probe = document.createElement("span");
      probe.textContent = "M".repeat(100);
      probe.style.cssText = "position:absolute;visibility:hidden;font-size:100px;line-height:1;letter-spacing:0";
      pre.appendChild(probe);
      var cw = probe.offsetWidth / 10000; pre.removeChild(probe);
      var ratio = Math.min(0.7, Math.max(0.5, cw || 0.6));
      size = Math.min(24, Math.max(3, w / cols / ratio)); fitted = pre.clientWidth;
      dpr = Math.min(3, devicePixelRatio || 1);
      /* The bitmap is the canvas's layout box (computed, fractional, without
         a transformed ancestor's scale) at the density, and kx/ky are its
         pixels per CSS pixel. The cell is a whole number of those pixels and
         each line starts on one (lineY, ox): at a fractional cell each glyph
         fell at its own sub-pixel phase and the same glyph drew up to a
         fifth heavier in one place than another. The figure keeps its size:
         lines() is given the box's width in snapped cells (unit). */
      /* The canvas's CSS size is then set to the bitmap's over the density,
         a fraction of a pixel off the box CSS gives it, so the screen shows
         the bitmap 1:1 (a box a fraction wider resampled it, and the glyph
         phase drifted along a line). */
      var h = parseFloat(getComputedStyle(pre).height) || w, ccs;
      canvas.style.width = canvas.style.height = ""; ccs = getComputedStyle(canvas);
      var cW = parseFloat(ccs.width) || w, cH = parseFloat(ccs.height) || h;
      canvas.width = Math.max(1, Math.round(cW * dpr)); canvas.height = Math.max(1, Math.round(cH * dpr));
      cW = canvas.width / dpr; cH = canvas.height / dpr;
      canvas.style.width = cW + "px"; canvas.style.height = cH + "px";
      if (twin) { twin.width = canvas.width; twin.height = canvas.height; twin.style.width = canvas.style.width; twin.style.height = canvas.style.height; }
      kx = ky = dpr;
      var cell = Math.max(1, Math.round(ratio * size * kx)) / kx;
      idealW = ratio * size; cellW = cell; aspect = cell / size; unit = cols * idealW / cell;
      /* the page's grid stops a glyph short of its canvas's edge; a
         fragment's covers its box, its window cutting the edge glyphs */
      grid = lite ? Math.ceil(cW / cell) : Math.floor(cW / cell); rows = Math.max(1, lite ? Math.ceil(cH / size) : Math.floor(cH / size));
      ox = Math.round((cW - grid * cell) / 2 * kx) / kx; oy = (cH - rows * size) / 2; gx = ox - (cW - w) / 2; gy = oy - (cH - h) / 2;
      /* the room around the pre, in its half-widths, keeps a glyph clear of
         the canvas's edge on every side (a glyph's cell is the one its
         position falls in, so a reach of half the grid less a cell and a half) */
      zoom = fitZoom(fig, lite ? SPAN.fragment : SPAN.hero, lite ? undefined : Math.min(grid - 3, (rows - 3) / aspect) / unit);
      day = look(pre);
      /* the canvas sets a small face on whole-pixel advances (4px for a
         3.68px cell), which drifts a line of glyphs off its cells: the
         text is scaled across to the cell width instead */
      ctx.font = day.font + size + "px " + day.family;
      var adv = ctx.measureText("M".repeat(50)).width / 50;
      sx = adv > 0 ? cell / adv : 1;
      /* the baseline as the pre's lines put it: a line of the face at this
         size, line-height 1, in a probe outside any transformed ancestor */
      var line = document.createElement("div"), mark = document.createElement("span");
      line.style.cssText = "position:absolute;left:0;top:0;visibility:hidden;white-space:pre;font:" + day.font + size + "px " + day.family + ";line-height:1";
      mark.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
      line.textContent = "M"; line.appendChild(mark); document.body.appendChild(line);
      base = mark.getBoundingClientRect().top - line.getBoundingClientRect().top; document.body.removeChild(line);
      if (!(base > 0)) base = size * 0.8;
    }
    function paint(c, el, st, ls) {
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, el.width, el.height);
      c.setTransform(kx * sx, 0, 0, ky, 0, 0);
      c.font = st.font + size + "px " + st.family; c.fillStyle = st.fill; c.textBaseline = "alphabetic";
      for (var r = 0; r < ls.length; r++) if (ls[r]) c.fillText(ls[r], ox / sx, lineY(r));
    }
    /* the face the glyphs are drawn in: the pre's own family and weight */
    var pending = 0, live = false, cs0 = getComputedStyle(pre), face = cs0.fontWeight + " 100px " + cs0.fontFamily, fonts = document.fonts;
    /* Before the face is in (or given up on) nothing is measured; while it
       is still loading later, a refit would measure the fallback. */
    function faceReady() { try { return !fonts || !fonts.check || fonts.check(face, "M"); } catch (e) { return true; } }
    function refit() {
      if (pending || !live || !(faceReady() || gaveUp)) return;
      pending = requestAnimationFrame(function () { pending = 0; fit(); if (rows) draw(); });
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
      twin.width = canvas.width; twin.height = canvas.height; twin.style.width = canvas.style.width; twin.style.height = canvas.style.height;
    }
    addEventListener("nts:bleed", function (e) {
      if (e.detail.phase === "start") { twinUp(); if (live && twin) draw(); }
      else if (e.detail.phase === "end") { twin = tctx = night = null; if (live) { day = look(pre); draw(); } }
    });
    /* the lines last drawn, and the convex hull of their glyphs (made when a
       press or the pointer asks, from the ends of each row) */
    var shown = null, outline = null;
    function onFigure(px, py) {
      if (!shown || !size) return false;
      if (!outline) {
        var cw = cellW, pts = [];
        for (var r = 0; r < shown.length; r++) {
          var a = shown[r].search(/\S/);
          if (a < 0) continue;
          pts.push([gx + (a + 0.5) * cw, gy + (r + 0.5) * size], [gx + (shown[r].length - 0.5) * cw, gy + (r + 0.5) * size]);
        }
        outline = G.hull(pts);
      }
      var b = pre.getBoundingClientRect(), k = b.width ? pre.clientWidth / b.width : 1;
      return outline.length > 2 && G.near(outline, (px - b.left) * k, (py - b.top) * k, G.SLACK * k);
    }
    function draw() {
      var ls = lines(fig, grid, rows, aspect, pose, zoom, unit), q = twin ? window.NTS.bleed.progress() : 0;
      shown = ls; outline = null;
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
    /* the paint's metrics, for checks: cells, line origin, scale, face */
    pre.ntsCells = function () { return { cell: cellW, ideal: idealW, unit: unit, cols: cols, grid: grid, zoom: zoom, ox: ox, size: size, base: base, sx: sx, kx: kx, ky: ky, dpr: dpr, font: day.font + size + "px " + day.family, line: lineY }; };
    if (!lite) {
      var grab = G.watch(pre, onFigure);
      pre.addEventListener("pointerdown", function (e) { if (!grab.down(e)) return; dragging = true; lastX = e.clientX; lastY = e.clientY; pre.setPointerCapture(e.pointerId); });
      pre.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        var dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
        pose.phi += dx * 0.01; pose.spin += dx * 0.004; pose.alpha = Math.max(0.3, Math.min(1.0, pose.alpha + dy * 0.006));
        /* the solid faces -z: +ay swings its front left and +ax lifts it, so the front follows the pointer with both negated */
        pose.ay -= dx * 0.01; pose.ax -= dy * 0.01;
        if (still.matches && live) draw();
      });
      var release = function () { dragging = false; speed = 1; grab.up(); };
      pre.addEventListener("pointerup", release); pre.addEventListener("pointercancel", release); pre.addEventListener("lostpointercapture", release);
      pre.stoke = function () { speed = 4; };
      pre.ntsPose = function () { return [pose.ax, pose.ay]; };
      pre.addEventListener("keydown", function (e) {
        var k = e.key, d = k === "ArrowLeft" ? -1 : k === "ArrowRight" ? 1 : 0, v = k === "ArrowUp" ? -1 : k === "ArrowDown" ? 1 : 0;
        if (!d && !v) return;
        e.preventDefault();
        pose.phi += d * 0.25; pose.spin += d * 0.1; pose.ay -= d * 0.25; pose.ax -= v * 0.25;
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
      fit();
      if (!twin) twinUp();
      draw(); start();
    }
    if (!fonts || !fonts.load) { go(); return; }
    /* The first measure waits for the face (at most 3 s, for a blocked
       network); until then the baked still stays on screen. */
    Promise.race([fonts.load(face, "M"), new Promise(function (r) { setTimeout(r, 3000); })]).catch(function () {}).then(function () {
      gaveUp = !faceReady();
      go();
      fonts.addEventListener("loadingdone", refit);
    });
  }
  function init() {
    document.querySelectorAll("pre[data-nts-ascii]").forEach(function (pre) { mount(pre, pre.getAttribute("data-nts-ascii"), +pre.getAttribute("data-cols") || 52, false); });
    document.querySelectorAll("[data-nts-fragment='intersect']").forEach(function (host) {
      var pre = host.querySelector("pre");
      if (!pre) { pre = document.createElement("pre"); pre.setAttribute("aria-hidden", "true"); host.appendChild(pre); }
      host.classList.add("is-live");
      mount(pre, host.getAttribute("data-figure") || "tetra", +host.getAttribute("data-cols") || 52, true);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

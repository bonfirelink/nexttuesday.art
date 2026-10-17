/* The hearth: a tetrahedron, Plato's solid of fire, drawn only by the heat
   it puts into a stack of horizontal lines. Each line is cast straight into
   the turning solid; where it crosses a face it ripples, harder and hotter
   on the faces turned from the light, and calms at the edges so the outline
   reads. Hot lines run thicker and climb a heat ramp. Stoke it and it sheds
   embers.
   After "Wavy Cube" by Jon Kantner (jkantner), codepen.io/jkantner/pen/bNpaQJN
   (MIT): the scan-line idea, lighting-to-amplitude mapping and edge fade are
   his; the solid, the ray test, the heat ramp, the embers and the interaction
   are this page's own.

   Mounts on every <canvas class="nts-hearth"> (the page entity: drag to
   turn, tap to stoke; a press counts only on the solid, NTS.grab) and on
   every <div data-nts-fragment="embers"> (a small, cheap, non-interactive
   one for the home page). Decorative only. Under prefers-reduced-motion it
   draws one still frame. Paused off-screen and in hidden tabs. Draws its day
   palette while the page waits for the world to bleed in
   (html[data-bleed-state="before"]), night after. While the bleed-in's disc
   opens over the hero, the night goes to the twins in the disc's copy
   (NTS.bleed.twin) and the day stays here, each drawn only while some of it
   is in view, at the hearth's own frame rate: the disc shows one or the
   other, so the lines change with the ground under them and nothing is
   redrawn because the page scrolled.

   Cost. On the page the hearth is two layers. The canvas itself keeps no
   pixels: it takes the pointer and the keys, and shows the straight lines
   as its CSS background, one line period drawn once per size and palette,
   repeated, with the box around the solid masked off (embers.css). Over it,
   a small live canvas covers the box, up to the top of the hero where the
   embers rise and a little to each side (wider while a stoke's burst is in
   the air); it is the only thing cleared and redrawn each frame. Both use a
   resolution whose pixels meet the screen's on a common grid, and every
   size and edge is snapped to it, so the lines run on unbroken across the
   box's edge; its top and bottom fall between two lines. On a touch screen
   the hearth draws at 1.5x and 24fps. The fragment, all box, is one canvas.
   On each line the ray test runs only inside the solid's outline. Each
   colour is one path of chained polylines, which strokes to the same union
   as separate segments with round caps, for a fraction of the rasterising.

   Tuning, by data attribute on the canvas or the fragment:
     data-spacing  px between lines (14; fragments 9)
     data-wave     ripple frequency, rad/px (0.42)
     data-amp      ripple height, in line spacings (0.55)
     data-speed    ripple travel (5)
     data-spin     resting turn, rad/s (0.32)
     data-size     circumradius, as a share of the shorter side (0.6)
     data-cx/cy    centre, as a share of width/height (0.5, 0.5)
     data-anchor   a selector: the solid's centre and size are taken from
                   that element's box instead of the canvas's, so the lines
                   can fill a larger canvas around a solid of a set size
     data-fps      frame rate cap (60; fragments 24; 24 on a touch screen),
                   lifted to 60 while a stoke is hot
     data-max-px   budget in device pixels for what is redrawn each frame
                   (the live canvas on the page): the resolution drops below
                   the DPR to stay within it (no budget)
     data-embers   "off" to shed none
     data-stoke    starting heat, 0..1 (0) */
(() => {
  "use strict";
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const TAU = Math.PI * 2;
  const FACES = [[-1, -1, -1], [-1, 1, 1], [1, -1, 1], [1, 1, -1]].map((v) => v.map((c) => c / Math.sqrt(3)));
  const INRADIUS = 1 / Math.sqrt(3), EDGE_SIN = Math.sqrt(1 - 1 / 9);
  const NIGHT = {
    ramp: ["#6e1030", "#a3163c", "#e51d47", "#f03a3c", "#f2591b", "#ff7a3d", "#ffa05a", "#ffc082", "#ffd9a8", "#ffe9d0", "#fff4e6"],
    embers: ["#fff4e6", "#ffe9d0", "#ffc082", "#ff7a3d", "#f2591b", "#e51d47", "#a3163c"],
    halo: [[242, 89, 27], [229, 29, 71]], glow: "242, 89, 27", composite: "lighter",
  };
  const DAY = {
    ramp: ["#4a1a3a", "#6e1030", "#a3163c", "#c0103a", "#e51d47", "#ef3a32", "#f2591b", "#f57a1b", "#f59a1b", "#f5b31b", "#f5c24a"],
    embers: ["#f5b31b", "#f2591b", "#e51d47", "#c0103a", "#a3163c", "#6e1030", "#4a1a3a"],
    halo: [[242, 89, 27], [229, 29, 71]], glow: "229, 29, 71", composite: "multiply",
  };
  const NB = NIGHT.ramp.length;
  const MAX_HEAT = 1.6;
  const COARSE = 12; // px between samples where a line is flat
  const LINE_WIDTH = 0.9; // a plain line's stroke, in the live canvas and the still lines alike
  const BOX_SLACK = 5; // px around the circumcircle and the ripple: the glow's half width and its edge
  const EMBER_ROOM = 40, BURST_ROOM = 170; // px the live canvas reaches beyond the box at each side: resting embers drift, a burst flies wide
  const BURST_FPS = 60;
  const TOUCH = { fps: 24, dpr: 1.5 };
  const G = window.NTS && window.NTS.grab;
  const theme = () => (document.documentElement.getAttribute("data-bleed-state") === "before" ? DAY : NIGHT);
  const baseColour = (el) => getComputedStyle(el).getPropertyValue("--hearth-base").trim() || "rgba(229, 29, 71, 0.3)";

  function rotate(v, cy, sy, cx, sx) {
    const x = v[0] * cy + v[2] * sy, z = -v[0] * sy + v[2] * cy;
    return [x, v[1] * cx - z * sx, v[1] * sx + z * cx];
  }
  /* The largest resolution up to `want` whose pixels meet the screen's on a
     common grid: dpr = D * m / n, so every `unit` css px (n / D) is a whole
     number of screen pixels (n) and of backing pixels (m). */
  function gridResolution(want, D) {
    let dpr = 0, n = 1;
    for (let k = 1; k <= 8; k++) {
      const m = Math.floor((want * k) / D + 1e-9);
      if (m && (D * m) / k > dpr + 1e-9) { dpr = (D * m) / k; n = k; }
    }
    return { dpr, unit: n / D };
  }
  /* Where the line at height y crosses the outline of the points (vx, vy),
     as [lo, hi], or null: the outline is their convex hull, so its span on
     the line is the span of the line's crossings with the segments between
     every two of them. */
  function rowSpan(vx, vy, y) {
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < vx.length; k++) for (let m = k + 1; m < vx.length; m++) {
      const ya = vy[k], yb = vy[m];
      if ((y - ya) * (y - yb) > 0 || ya === yb) continue;
      const x = vx[k] + ((y - ya) / (yb - ya)) * (vx[m] - vx[k]);
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
    return lo <= hi ? [lo, hi] : null;
  }
  /* How many line periods the still lines' tile holds: the fewest that make
     a whole number of grid steps, so the tile is whole screen and backing
     pixels and repeats without stretching (1 at the usual densities). */
  function tilePeriods(spacing, unit) {
    for (let n = 1; n <= 64; n++) { const steps = (n * spacing) / unit; if (Math.abs(steps - Math.round(steps)) < 1e-6) return n; }
    return 1;
  }
  /* The still lines' tile, as a data URL: `width` css px wide, `periods`
     line periods tall, the first line at `phase` (with a neighbour beyond
     each end, for the antialiasing that crosses the tile's edge), stroked
     as the live canvas strokes a plain line at the same resolution. */
  function lineTile(dpr, width, spacing, periods, phase, colour) {
    const k = document.createElement("canvas");
    k.width = Math.round(width * dpr); k.height = Math.round(spacing * periods * dpr);
    const g = k.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineWidth = LINE_WIDTH; g.strokeStyle = colour; g.beginPath();
    for (let i = -1; i <= periods; i++) { const y = phase + i * spacing; g.moveTo(-1, y); g.lineTo(width + 1, y); }
    g.stroke();
    return k.toDataURL();
  }
  /* The polylines of one draw for one colour: (move flag, x, y) triples in a
     buffer kept across draws, so a frame allocates nothing. */
  const run = () => ({ a: new Float64Array(3 * 512), n: 0 });
  function addPoint(r, move, x, y) {
    if (r.n + 3 > r.a.length) { const b = new Float64Array(r.a.length * 2); b.set(r.a); r.a = b; }
    r.a[r.n++] = move; r.a[r.n++] = x; r.a[r.n++] = y;
  }
  function strokeRun(c, r) {
    if (!r.n) return;
    const a = r.a;
    c.beginPath();
    for (let i = 0; i < r.n; i += 3) a[i] ? c.moveTo(a[i + 1], a[i + 2]) : c.lineTo(a[i + 1], a[i + 2]);
    c.stroke();
  }

  function mount(canvas, host, lite) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const d = host.dataset;
    const num = (k, f) => (d[k] !== undefined && d[k] !== "" ? +d[k] : f);
    /* a touch screen: high density on a small GPU */
    const touch = !lite && matchMedia("(pointer: coarse)").matches;
    const o = {
      spacing: num("spacing", lite ? 9 : 14), wave: num("wave", 0.42), amp: num("amp", lite ? 0.65 : 0.55),
      speed: num("speed", 5), spin: num("spin", lite ? 0.4 : 0.32), size: num("size", lite ? 0.78 : 0.6),
      cx: num("cx", 0.5), cy: num("cy", 0.5), embers: !lite && d.embers !== "off", stoke0: num("stoke", lite ? 0.25 : 0),
      step: lite ? 2.5 : 1.5, fps: Math.min(num("fps", lite ? 24 : 60), touch ? TOUCH.fps : Infinity),
      interactive: !lite && d.interactive !== "off", maxPx: num("maxPx", Infinity), maxDpr: touch ? TOUCH.dpr : 2,
    };
    const anchor = d.anchor ? document.querySelector(d.anchor) : null;
    let ax = 0, ay = 0, aw = 0, ah = 0;
    /* the page's live canvas, just over this one (the fragment draws on itself) */
    let liveCanvas = null;
    if (!lite) {
      liveCanvas = document.createElement("canvas");
      liveCanvas.className = "nts-hearth-live"; liveCanvas.setAttribute("aria-hidden", "true");
      canvas.after(liveCanvas);
    }
    /* while the bleed-in's disc opens: the copies the night goes to */
    let twin = null, liveTwin = null;
    let w = 0, h = 0, dpr = 1, unit = 1, yaw = 0.6, pitch = 0.5, pitchDrag = 0, spin = o.spin;
    let t = 0, tilt = 0, stoke = o.stoke0, last = 0, raf = 0, acc = 0, visible = false, skip = 1;
    let dragging = false, lastX = 0, lastY = 0, lastT = 0, moved = 0;
    /* the box (x0, y0, x1, y1) and the live canvas's rect, in css px of the
       hearth canvas; burstRoom while a stoke's burst is in the air */
    let box = null, layer = { x: 0, y: 0, w: 0, h: 0 }, burstRoom = false;
    /* where a palette is drawn: the element showing the still lines, the
       context the live frames go to, the palette, the base colour */
    const surface = (stillEl, c, palette, base) => ({ stillEl, c, palette, base });
    const main = surface(canvas, (liveCanvas || canvas).getContext("2d"), theme(), baseColour(host));
    let night = null;
    const embers = [], hot = [];
    const runs = Array.from({ length: NB + 2 }, run), baseRun = runs[NB], glowRun = runs[NB + 1];
    const nx = new Float64Array(4), ny = new Float64Array(4), nz = new Float64Array(4), vx = new Float64Array(4), vy = new Float64Array(4);

    const geom = () => ({ gcx: ax + o.cx * aw, gcy: ay + o.cy * ah, size: Math.min(aw, ah) * o.size / Math.sqrt(3) });
    const maxRipple = () => o.spacing * o.amp * (1 + MAX_HEAT * 0.9);
    const frameRate = () => (stoke > o.stoke0 + 0.15 ? BURST_FPS : o.fps);
    function rows() {
      const lines = Math.max(3, Math.floor((h - 8) / o.spacing));
      return { lines, top: (h - (lines - 1) * o.spacing) / 2, end: Math.floor(w / o.step) * o.step };
    }

    function measure() {
      const cr = canvas.getBoundingClientRect(), r = liveCanvas ? canvas.parentElement.getBoundingClientRect() : cr;
      w = Math.round(r.width); h = Math.round(r.height);
      if (!w || !h) return;
      if (anchor) { const a = anchor.getBoundingClientRect(); ax = a.left - cr.left; ay = a.top - cr.top; aw = a.width; ah = a.height; }
      else { ax = 0; ay = 0; aw = w; ah = h; }
      chooseResolution();
      if (liveCanvas) {
        for (const el of [canvas, twin]) if (el) { el.style.width = w + "px"; el.style.height = h + "px"; el.width = el.height = 0; }
      } else {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        main.c.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (twin) { twin.width = canvas.width; twin.height = canvas.height; night.c.setTransform(dpr, 0, 0, dpr, 0, 0); }
      }
      placeBox(); placeLayer(); showStillLines(main); if (night) showStillLines(night); draw();
    }
    /* the budget covers what is redrawn: on the page the live canvas, about
       the box's width with the resting room and down from the top to the
       box's bottom; there the resolution is snapped to the screen's grid and
       the hero's size to whole grid steps */
    function chooseResolution() {
      const D = window.devicePixelRatio || 1;
      let area = w * h;
      if (liveCanvas) {
        const { gcy, size } = geom(), R = size * Math.sqrt(3) + o.step + BOX_SLACK;
        area = Math.min(w, 2 * (R + EMBER_ROOM)) * Math.max(1, Math.min(h, gcy + R + maxRipple() + BOX_SLACK));
      }
      dpr = Math.min(D, o.maxDpr, Math.sqrt(o.maxPx / area));
      if (!liveCanvas) return;
      ({ dpr, unit } = gridResolution(dpr, D));
      w = Math.floor(w / unit) * unit; h = Math.floor(h / unit) * unit;
    }
    /* the box holds all that moves with the solid: the circumcircle, the
       ripple at its hottest above and below, the glow and the halo (1.3
       sizes, inside the circumcircle's 1.73); its top and bottom fall midway
       between two lines, so no line crosses them */
    function placeBox() {
      if (!liveCanvas) { box = { x0: 0, y0: 0, x1: w, y1: h }; return; }
      const { gcx, gcy, size } = geom(), R = size * Math.sqrt(3) + o.step + BOX_SLACK, v = maxRipple() + BOX_SLACK;
      const { top } = rows(), sp = o.spacing;
      const between = (y, round) => top + (round((y - top) / sp - 0.5) + 0.5) * sp;
      const snap = (x, round, max) => Math.max(0, Math.min(max, round(x / unit) * unit));
      box = {
        x0: snap(gcx - R, Math.floor, w), y0: snap(between(gcy - R - v, Math.floor), Math.floor, h),
        x1: snap(gcx + R, Math.ceil, w), y1: snap(between(gcy + R + v, Math.ceil), Math.ceil, h),
      };
    }
    /* the live canvas spans the box, up to the top for the embers' rise and
       out to the sides for their drift */
    function placeLayer() {
      if (!liveCanvas) { layer = { x: 0, y: 0, w, h }; return; }
      /* the burst's room can take the backing store over data-max-px, for the burst's second or two */
      const room = burstRoom ? BURST_ROOM : EMBER_ROOM;
      const x = Math.max(0, Math.floor((box.x0 - room) / unit) * unit);
      layer = { x, y: 0, w: Math.min(w, Math.ceil((box.x1 + room) / unit) * unit) - x, h: box.y1 };
      for (const el of [liveCanvas, liveTwin]) {
        if (!el) continue;
        el.style.left = layer.x + "px"; el.style.top = layer.y + "px"; el.style.width = layer.w + "px"; el.style.height = layer.h + "px";
        el.width = Math.round(layer.w * dpr); el.height = Math.round(layer.h * dpr);
        el.getContext("2d").setTransform(dpr, 0, 0, dpr, -layer.x * dpr, -layer.y * dpr);
      }
    }
    /* the still lines: the element's background tile, the rows it shows
       (the tile repeats past the first and last lines, which the mask cuts
       off half a gap out) and the box's hole, as custom properties the rules
       in embers.css read */
    function showStillLines(S) {
      if (!liveCanvas || !box) return;
      const { lines, top } = rows(), sp = o.spacing, tileW = unit * 8, st = S.stillEl.style;
      const phase = top - Math.floor(top / sp) * sp, key = [dpr, unit, sp, phase, S.base].join(" ");
      /* encoding the tile is the costly part: only when it would change */
      if (S.tileKey !== key) {
        const periods = tilePeriods(sp, unit);
        S.tileKey = key;
        st.setProperty("--hearth-lines", `url(${lineTile(dpr, tileW, sp, periods, phase, S.base)})`);
        st.setProperty("--hearth-tile", `${tileW}px ${sp * periods}px`);
      }
      st.setProperty("--hearth-rows", `0 ${top - sp / 2}px / 100% ${lines * sp}px`);
      st.setProperty("--hearth-box", `${box.x0}px ${box.y0}px / ${box.x1 - box.x0}px ${box.y1 - box.y0}px`);
      S.stillEl.classList.add("is-split");
    }

    /* on the solid: the outline is the hull of its four vertices (the face
       normals, turned, scaled to the circumradius), with the shared slack;
       the four in face order cross over themselves at some turns, and the
       inside test would then miss the solid's middle */
    function onFigure(px, py) {
      const r = canvas.getBoundingClientRect(), { gcx, gcy, size } = geom(), p = pitch + pitchDrag;
      const R = size * Math.sqrt(3), c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(p), sp = Math.sin(p);
      const points = FACES.map((f) => { const v = rotate(f, c, s, cp, sp); return [gcx - v[0] * R, gcy - v[1] * R]; });
      return G.near(G.hull(points), px - r.left, py - r.top);
    }
    /* the anchor can move without either observed box resizing (the hero's
       text settling above it): a press reads it again, so the solid it aims
       at is the one drawn */
    function followAnchor() {
      if (!anchor || !w) return;
      const cr = canvas.getBoundingClientRect(), a = anchor.getBoundingClientRect();
      const moved = Math.abs(a.left - cr.left - ax) > 0.5 || Math.abs(a.top - cr.top - ay) > 0.5 || Math.abs(a.width - aw) > 0.5 || Math.abs(a.height - ah) > 0.5;
      if (moved) measure();
    }
    /* the lines in the box, over its width, into the runs; the hot samples
       the embers are shed from into `hot` */
    function traceLines() {
      const { gcx, gcy, size } = geom();
      const dist = INRADIUS * size, Rv = size * Math.sqrt(3);
      const cy = Math.cos(yaw), sy = Math.sin(yaw), p = pitch + pitchDrag, cx = Math.cos(p), sx = Math.sin(p);
      /* the turned face normals, and the vertices opposite them */
      for (let k = 0; k < 4; k++) { const v = rotate(FACES[k], cy, sy, cx, sx); nx[k] = v[0]; ny[k] = v[1]; nz[k] = v[2]; vx[k] = gcx - v[0] * Rv; vy[k] = gcy - v[1] * Rv; }
      const fade = Math.min(12, size * 0.1), heat = Math.min(MAX_HEAT, stoke);
      const amp = o.spacing * o.amp * (1 + heat * 0.9), spacing = o.spacing, step = o.step;
      const { lines, top, end } = rows();
      const x0 = Math.max(0, Math.floor((box.x0 - 8) / COARSE) * COARSE), x1 = Math.min(end, Math.ceil((box.x1 + 8) / COARSE) * COARSE);
      const i0 = Math.max(0, Math.ceil((box.y0 - top) / spacing)), i1 = Math.min(lines - 1, Math.floor((box.y1 - top) / spacing));
      for (const r of runs) r.n = 0;
      hot.length = 0;
      for (let i = i0; i <= i1; i++) {
        const y0 = top + i * spacing, py = y0 - gcy;
        /* the solid can only cross this line inside its outline (two steps wider) */
        const span = rowSpan(vx, vy, y0);
        const a = span ? Math.max(0, Math.floor(span[0] / step - 2) * step) : Infinity, z = span ? Math.ceil(span[1] / step + 2) * step : -Infinity;
        /* each face's plane along this line, less its x term */
        const c0 = dist - (ny[0] * py + nz[0] * 1e4), c1 = dist - (ny[1] * py + nz[1] * 1e4);
        const c2 = dist - (ny[2] * py + nz[2] * 1e4), c3 = dist - (ny[3] * py + nz[3] * 1e4);
        let first = true, lb = -2, lg = 0, px = 0, pyy = 0, sxp = x0;
        for (;;) {
          let y = y0, bucket = -1;
          if (sxp >= a && sxp <= z) {
            const qx = sxp - gcx;
            let tIn = -Infinity, tOut = Infinity, face = -1;
            for (let k = 0; k < 4; k++) {
              const denom = -nz[k], numr = (k === 0 ? c0 : k === 1 ? c1 : k === 2 ? c2 : c3) - nx[k] * qx;
              if (Math.abs(denom) < 1e-6) { if (numr < 0) { tIn = Infinity; break; } continue; }
              const tt = numr / denom;
              if (denom < 0) { if (tt > tIn) { tIn = tt; face = k; } } else if (tt < tOut) tOut = tt;
            }
            if (face >= 0 && tIn <= tOut) {
              const pz = 1e4 - tIn;
              let edge = Infinity;
              for (let k = 0; k < 4; k++) {
                if (k === face) continue;
                const gap = (dist - (nx[k] * qx + ny[k] * py + nz[k] * pz)) / EDGE_SIN;
                if (gap < edge) edge = gap;
              }
              let e = Math.max(0, Math.min(1, edge / fade)); e = e * (2 - e);
              let al = Math.max(0, Math.min(1, 0.95 - nz[face] * 0.75)); al = al * al * (3 - 2 * al);
              const k = Math.min(1, al * e + heat * 0.45 * e);
              y += Math.sin(sxp * o.wave - t * o.speed + i * 0.7) * amp * k;
              const hk = Math.min(1, k * (0.75 + heat * 0.6) + heat * 0.2 * e);
              bucket = k < 0.03 ? -1 : Math.min(NB - 1, Math.floor(hk * (NB - 1) + 0.5));
              /* about one hot sample in 12.5 is kept for shedding */
              if (o.embers && hk > 0.5 && hot.length < 240 && --skip <= 0) { hot.push(sxp, y, hk); skip = 1 + ((Math.random() * 24) | 0); }
            }
          }
          if (!first) {
            const r = bucket < 0 ? baseRun : runs[bucket];
            if (bucket !== lb) { addPoint(r, 1, px, pyy); lb = bucket; }
            addPoint(r, 0, sxp, y);
            if (bucket >= 3 && !lite) { if (!lg) addPoint(glowRun, 1, px, pyy); addPoint(glowRun, 0, sxp, y); lg = 1; } else lg = 0;
          }
          first = false; px = sxp; pyy = y;
          if (sxp >= x1) break;
          sxp = Math.min(x1, sxp < a ? Math.min(a, sxp + COARSE) : sxp < z ? sxp + step : sxp + COARSE);
        }
      }
    }
    /* one geometry, stroked in one palette: the lines and the halo kept to
       the box, the embers free over the whole live canvas */
    function paint(S) {
      const c = S.c, P = S.palette, { gcx, gcy, size } = geom(), heat = Math.min(MAX_HEAT, stoke);
      c.clearRect(layer.x, layer.y, layer.w, layer.h);
      c.save(); c.beginPath(); c.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0); c.clip();
      if (!lite) {
        const rr = size * 1.3, halo = c.createRadialGradient(gcx, gcy, 0, gcx, gcy, rr);
        halo.addColorStop(0, `rgba(${P.halo[0]}, ${0.12 + heat * 0.16})`);
        halo.addColorStop(0.5, `rgba(${P.halo[1]}, ${0.06 + heat * 0.08})`);
        halo.addColorStop(1, `rgba(${P.halo[1]}, 0)`);
        c.fillStyle = halo; c.fillRect(gcx - rr, gcy - rr, rr * 2, rr * 2);
      }
      c.lineCap = "round"; c.lineJoin = "round";
      c.lineWidth = LINE_WIDTH; c.strokeStyle = S.base; strokeRun(c, baseRun);
      if (!lite) { c.lineWidth = 7; c.strokeStyle = `rgba(${P.glow}, ${0.12 + heat * 0.1})`; strokeRun(c, glowRun); }
      for (let k = 0; k < NB; k++) {
        c.lineWidth = (lite ? 1 : 1.1) + (k / (NB - 1)) * 1.6; c.strokeStyle = P.ramp[k]; strokeRun(c, runs[k]);
      }
      c.restore();
      drawEmbers(c, P);
    }
    function draw() {
      if (!w || !h || !box) return;
      traceLines();
      /* the disc shows the night inside, the day outside */
      if (!night) { paint(main); return; }
      const q = window.NTS.bleed.progress();
      if (q < 1) paint(main);
      if (q > 0) paint(night);
    }

    function shed(count, burst) {
      if (!o.embers || hot.length < 3) return;
      const nn = hot.length / 3;
      for (let i = 0; i < count && embers.length < 220; i++) {
        const j = Math.floor(Math.random() * nn) * 3;
        const speed = burst ? 60 + Math.random() * 140 : 18 + Math.random() * 40;
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * (burst ? 1.6 : 0.7);
        embers.push({ x: hot[j], y: hot[j + 1], vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: 1, decay: burst ? 0.35 + Math.random() * 0.5 : 0.18 + Math.random() * 0.25, r: 0.8 + Math.random() * (burst ? 2.2 : 1.4), ph: Math.random() * TAU, burst });
      }
    }
    function stepEmbers(dt) {
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i];
        e.life -= e.decay * dt;
        if (e.life <= 0 || e.y < -10) { embers.splice(i, 1); continue; }
        e.vy -= 55 * dt; e.vx += Math.sin(t * 3 + e.ph) * 40 * dt; e.vx *= 1 - 0.9 * dt;
        e.x += e.vx * dt; e.y += e.vy * dt;
      }
    }
    function drawEmbers(c, P) {
      if (!embers.length) return;
      c.save(); c.globalCompositeOperation = P.composite;
      for (const e of embers) {
        const col = P.embers[Math.min(P.embers.length - 1, Math.floor((1 - e.life) * P.embers.length))];
        const r = e.r * (0.4 + e.life * 0.8);
        c.globalAlpha = Math.min(1, e.life * 1.6) * 0.3; c.fillStyle = col;
        c.beginPath(); c.arc(e.x, e.y, r * 3, 0, TAU); c.fill();
        c.globalAlpha = Math.min(1, e.life * 1.6);
        c.beginPath(); c.arc(e.x, e.y, r, 0, TAU); c.fill();
      }
      c.restore();
    }
    /* the live canvas widens for a stoke's burst and narrows once it has died down */
    function setBurstRoom(on) {
      if (!liveCanvas || on === burstRoom) return;
      burstRoom = on; placeLayer();
    }

    function frame(now) {
      raf = 0;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
      last = now; t += dt; if (!dragging) tilt += dt;
      if (!dragging) { spin += (o.spin - spin) * Math.min(1, dt * 1.5); pitchDrag *= Math.exp(-dt * 0.8); }
      if (!dragging) yaw = (yaw + spin * dt) % TAU;
      pitch = 0.5 + Math.sin(tilt * 0.23) * 0.35;
      stoke = o.stoke0 + (stoke - o.stoke0) * Math.exp(-dt * 1.4);
      if (o.embers && Math.random() < dt * (1.5 + stoke * 14)) shed(1 + Math.floor(stoke * 2), false);
      stepEmbers(dt);
      /* a resized canvas is blank: it is drawn at once */
      if (burstRoom && !embers.some((e) => e.burst)) { setBurstRoom(false); draw(); acc = 0; }
      acc += dt;
      /* a burst of embers after a stoke is fast; the rest of the motion is
         slow enough for the frame cap */
      const fps = frameRate();
      if (acc >= 1 / fps) { acc = acc % (1 / fps); draw(); }
      schedule();
    }
    function schedule() { if (!raf && visible && held !== true && !document.hidden && !still.matches) raf = requestAnimationFrame(frame); }
    function halt() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }
    function stokeIt() {
      stoke = Math.min(MAX_HEAT, stoke + 0.85);
      if (o.embers) setBurstRoom(true);
      draw(); shed(26 + Math.floor(stoke * 16), true);
      if (still.matches) { setBurstRoom(false); draw(); embers.length = 0; stoke = o.stoke0; }
    }
    canvas.ntsPose = () => [yaw, pitch + pitchDrag];
    /* heat, frame-rate cap, resolution, box (x, y, w, h in css px of the
       canvas), line spacing and the first line's height, for the tests */
    canvas.ntsHearth = () => ({
      heat: stoke, fps: frameRate(), dpr, spacing: o.spacing, firstLine: rows().top,
      box: box ? [box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0] : null,
    });
    if (o.interactive) {
      const hand = G.watch(canvas, onFigure);
      canvas.addEventListener("pointerdown", (e) => { followAnchor(); if (!hand.down(e)) return; dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const dx = e.clientX - lastX, dy = e.clientY - lastY, dtm = Math.max(8, e.timeStamp - lastT);
        moved += Math.abs(dx) + Math.abs(dy);
        /* the bright faces read as the front (the nearest are drawn faintest), so they follow the pointer: the geometric back, hence the signs */
        yaw -= dx * 0.012; pitchDrag = Math.max(-0.9, Math.min(0.9, pitchDrag + dy * 0.006));
        spin = Math.max(-6, Math.min(6, (-dx * 0.012) / (dtm / 1000)));
        lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp;
        if (still.matches) draw();
      });
      const release = () => { hand.up(); if (!dragging) return; dragging = false; if (moved < 8) stokeIt(); };
      canvas.addEventListener("pointerup", release);
      canvas.addEventListener("pointercancel", release);
      canvas.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); stokeIt(); }
        if (e.key === "ArrowLeft") { yaw += 0.2; if (still.matches) draw(); }
        if (e.key === "ArrowRight") { yaw -= 0.2; if (still.matches) draw(); }
      });
    }
    /* in an aperture (the home's windows), NTS.live says when this one may
       animate; held, it keeps its last frame (halt resets the clock, so it
       resumes where it stopped) */
    let held = null;
    held = !(window.NTS && window.NTS.live ? window.NTS.live.join(host, (on) => { held = !on; on ? schedule() : halt(); }) : true);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; visible ? schedule() : halt(); }).observe(canvas);
    } else visible = true;
    document.addEventListener("visibilitychange", () => { document.hidden ? halt() : schedule(); });
    still.addEventListener?.("change", () => { halt(); draw(); schedule(); });
    /* the bleed-in: the night goes to the copies while the disc opens; once
       the world settles, this pair takes the night itself, at once */
    addEventListener("nts:bleed", (e) => {
      const B = window.NTS && window.NTS.bleed;
      if (e.detail.phase === "start") {
        const tw = B && B.twin(canvas);
        if (!tw) return;
        twin = tw;
        let c;
        if (liveCanvas) {
          twin.width = twin.height = 0; twin.style.width = canvas.style.width; twin.style.height = canvas.style.height;
          /* the copy is made after every deferred script, so it holds the live canvas too */
          liveTwin = B.twin(liveCanvas);
          c = liveTwin.getContext("2d");
        } else {
          twin.width = canvas.width; twin.height = canvas.height;
          c = twin.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        main.palette = DAY; main.base = baseColour(host); night = surface(twin, c, NIGHT, baseColour(twin));
        placeLayer(); showStillLines(main); showStillLines(night); draw();
      } else if (e.detail.phase === "end") {
        twin = liveTwin = night = null; main.palette = theme(); main.base = baseColour(host); showStillLines(main); draw();
      }
    });
    /* on the page this canvas is sized from the hero it fills */
    if ("ResizeObserver" in window) { const ro = new ResizeObserver(measure); ro.observe(liveCanvas ? canvas.parentElement : canvas); if (anchor) ro.observe(anchor); }
    else addEventListener("resize", measure);
    if (still.matches) stoke = Math.max(stoke, 0.5);
    measure(); schedule();
  }

  document.querySelectorAll("canvas.nts-hearth").forEach((c) => mount(c, c, false));
  document.querySelectorAll("[data-nts-fragment='embers']").forEach((host) => {
    const c = document.createElement("canvas");
    c.setAttribute("aria-hidden", "true");
    host.appendChild(c);
    host.classList.add("is-live");
    mount(c, host, true);
  });
})();

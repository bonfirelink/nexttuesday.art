/* NOT NOT PHILO's figure: Reutersvärd's impossible triangle of nine cubes,
   going round. Every 3 s all nine glide one place back along the loop together
   (in the tick's last second) and rest the rest of the time.

   Straight on, where two cubes overlap the one further along the loop is in
   front, all the way round: a cycle no depth order can paint, so a cube
   painted after one that should cover it is clipped at that cube's edge.
   All nine are alike, so every tick shows the same picture.

   Turned, the nine are the top turn of an endless staircase (the screw):
   every cube descends one place per tick, the one stepping off the bottom
   fades out, the one arriving at the top comes in from the turn above, and the
   turns underneath fade into the ground, every other turn a shade paler so
   neighbouring turns part. Between 1° and 6° off the straight view the
   loop's order dissolves into true depth.

   The model is a world of unit steps along x, y and z, seen isometrically,
   turned 30° so one edge is level and drawn mirrored (the 1934 drawing's way
   round); y is up on screen. Pure geometry and painting, no DOM: the clock,
   the size and the interaction come from outside. A classic script: in the
   browser it sets window.NTS.cubes, and where there is a module object it
   also fills module.exports, so node can run it. */
(function () {
  "use strict";
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
  const add = (a, b, k = 1) => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];
  const lerp = (a, b, f) => add(a, add(b, a, -1), f);
  /* the rotation by angle t about unit axis ax */
  const axisAngle = (ax, t) => {
    const c = Math.cos(t), s = Math.sin(t), u = 1 - c, [x, y, z] = ax;
    return [
      [c + x * x * u, x * y * u - z * s, x * z * u + y * s],
      [y * x * u + z * s, c + y * y * u, y * z * u - x * s],
      [z * x * u - y * s, z * y * u + x * s, c + z * z * u],
    ];
  };
  const mm = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  const tx = (M, p) => [dot(M[0], p), dot(M[1], p), dot(M[2], p)];
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(x));
  const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const mod = (a, n) => ((a % n) + n) % n;

  /* a cube's edge, in steps of the staircase: neighbours overlap by about a third */
  const CUBE = 0.7;
  /* the view: isometric, turned 30°; TOWARD points at the viewer */
  const TOWARD = norm([1, 1, 1]), UPV = norm(add([0, 0, 1], TOWARD, -TOWARD[2])), RV = cross(UPV, TOWARD);
  const C30 = Math.cos(Math.PI / 6), S30 = Math.sin(Math.PI / 6);
  const RIGHT = add(RV.map((v) => v * C30), UPV, -S30), UP = add(RV.map((v) => v * S30), UPV, C30);
  const cam = (p) => [dot(p, RIGHT), dot(p, UP), dot(p, TOWARD)];
  /* light from above in the picture: the faces in view, by how much each
     faces it, are the top, side and dark tones */
  const LIGHT = norm([-0.15, 0.85, 0.5]);

  /* The staircase: place j of the loop (0 the tip, 1-2 the right side, 3 a
     corner, 4-5 the bottom, 6 a corner, 7-8 the left side) is one step along
     x, y or z from the last, climbing toward the viewer. Seen straight on,
     place 9 stands exactly in front of place 0, which closes the loop; TURN is
     that step from 0 to 9, one whole turn of the screw. */
  const TURN = [3, 3, 3];
  function base(j) {
    const leg = Math.floor(j / 3), i = j % 3;
    return leg === 0 ? [i, 0, 0] : leg === 1 ? [3, i, 0] : leg === 2 ? [3, 3, i] : TURN;
  }
  /* place h on the endless staircase, any number of turns up or down */
  function helix(h) {
    const turns = Math.floor(h / 9), j = h - 9 * turns, i = Math.floor(j);
    return add(lerp(base(i), base(i + 1), j - i), TURN, turns);
  }
  /* straight on, the cube crossing from place 8 to the tip goes straight to place 0 */
  const loopAt = (h) => (h < 8 ? helix(h) : lerp(base(8), base(0), h - 8));

  /* a cube's corners and faces (axis k, side ±1, normal, outline), in camera units */
  const SHAPE = (() => {
    const half = (bit) => (bit ? 0.5 : -0.5);
    const corners = [];
    for (let m = 0; m < 8; m++) corners.push(cam([half(m & 1), half(m & 2), half(m & 4)]));
    const faces = [];
    for (let k = 0; k < 3; k++) for (const side of [1, -1]) {
      const normal = [0, 0, 0]; normal[k] = side;
      const i1 = (k + 1) % 3, i2 = (k + 2) % 3;
      const at = (u, v) => { const p = [0, 0, 0]; p[k] = side * 0.5; p[i1] = u; p[i2] = v; return cam(p); };
      faces.push({ k, side, n: cam(normal), quad: [at(-0.5, -0.5), at(0.5, -0.5), at(0.5, 0.5), at(-0.5, 0.5)] });
    }
    return { corners, faces, axes: [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(cam) };
  })();

  /* the convex hull of points in the plane (monotone chain) */
  function hull(pts) {
    pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const chain = (list) => {
      const h = [];
      for (const p of list) {
        while (h.length > 1 && turn(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
        h.push(p);
      }
      h.pop();
      return h;
    };
    return chain(pts).concat(chain(pts.slice().reverse()));
  }
  /* the pivot: the closed picture's centre, halfway up the top turn; reach: its
     furthest corner from the centre, in model units */
  const PIVOT = (() => {
    const pts = [];
    for (let j = 0; j < 9; j++) {
      const c = cam(base(j));
      for (const q of SHAPE.corners) pts.push([c[0] + CUBE * q[0], c[1] + CUBE * q[1]]);
    }
    const H = hull(pts);
    let area2 = 0, gx = 0, gy = 0;
    H.forEach((p, i) => {
      const q = H[(i + 1) % H.length], k = p[0] * q[1] - q[0] * p[1];
      area2 += k; gx += (p[0] + q[0]) * k; gy += (p[1] + q[1]) * k;
    });
    gx /= 3 * area2; gy /= 3 * area2;
    let reach = 0;
    for (const p of pts) reach = Math.max(reach, Math.hypot(p[0] - gx, p[1] - gy));
    return { g: [gx, gy, 4 / Math.sqrt(3)], reach };
  })();
  /* a convex polygon with every edge moved out by d (each corner along the
     sum of its two edges' outward normals, scaled to keep the edges d out) */
  function outset(poly, d) {
    const n = poly.length;
    const c = poly.reduce((s, p) => [s[0] + p[0] / n, s[1] + p[1] / n], [0, 0]);
    const outward = (a, b) => {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, e = [(b[1] - a[1]) / l, (a[0] - b[0]) / l];
      const mid = [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1]];
      return e[0] * mid[0] + e[1] * mid[1] < 0 ? [-e[0], -e[1]] : e;
    };
    return poly.map((p, i) => {
      const a = outward(poly[(i + n - 1) % n], p), b = outward(p, poly[(i + 1) % n]);
      const k = d / (1 + a[0] * b[0] + a[1] * b[1]);
      return [p[0] + k * (a[0] + b[0]), p[1] + k * (a[1] + b[1])];
    });
  }

  /* ---------- the motion ---------- */
  /* a tick every TICK s, all nine moving one place in its last GLIDE s */
  const TICK = 3, GLIDE = 1;
  /* places moved by time t: a whole number while the cubes rest */
  function phase(t) {
    const k = Math.floor(t / TICK), u = t - k * TICK;
    return k + ease((u - (TICK - GLIDE)) / GLIDE);
  }
  /* turns of the screw drawn below the top one, and how fast they fade */
  const TURNS = 4, FADE_POW = 0.8;

  /* The cubes at time t. Place h runs 0 to 9 on the top turn and below 0 on
     the turns underneath; in each tick a cube moves from h to h - 1 (the glide
     runs backward), and at the next tick places are counted again from the top.
     Straight on only the top turn is drawn, the crossing cube on loopAt's path;
     turned, the screw. The fades are by place, so the turn below the screw
     fades out at the bottom and the next one comes in at the top. */
  function cubesAt(t, screw) {
    const p = -phase(t), k = Math.floor(p), s = p - k, out = [];
    for (let m = screw ? -9 * TURNS : 0; m <= 8; m++) {
      const h = m + s;
      let alpha = 1, fade = 0;
      if (screw && h > 8) alpha = 1 - (h - 8);
      if (h < -9 * TURNS + 1) alpha = h + 9 * TURNS;
      if (h < 0) fade = clamp01(-h / (9 * TURNS + 1)) ** FADE_POW;
      out.push({ h, x: mod(h, 9), P: screw ? helix(h) : loopAt(h), alpha, fade });
    }
    return out.filter((c) => c.alpha > 0.01 && c.fade < 0.985);
  }

  /* ---------- colours ---------- */
  const parse = (c) => {
    c = String(c).trim();
    let m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    m = /^#([0-9a-f]{3})$/i.exec(c);
    if (m) return [0, 1, 2].map((i) => parseInt(m[1][i] + m[1][i], 16));
    m = c.match(/[\d.]+/g);
    return m && m.length >= 3 ? m.slice(0, 3).map(Number) : null;
  };
  /* the three tones (top, side, dark), thinned toward the ground in 24
     steps; a colour at full strength is passed on as given */
  const palettes = new WeakMap();
  function shader(col) {
    let shade = palettes.get(col);
    if (!shade) {
      const g = parse(col.ground), cache = new Map();
      shade = (which, f) => {
        const q = Math.round(f * 24);
        if (!q || !g) return col[which];
        const key = which + q;
        let v = cache.get(key);
        if (!v) {
          const a = parse(col[which]) || g;
          v = `rgb(${a.map((x, i) => Math.round(x + ((g[i] - x) * q) / 24)).join(",")})`;
          cache.set(key, v);
        }
        return v;
      };
      palettes.set(col, shade);
    }
    return shade;
  }

  /* ---------- the drawing ---------- */
  /* which of two cubes is in front by a plane between them: 0, 1, or -1 when none parts them */
  function apart(pa, pb, toward) {
    for (let k = 0; k < 3; k++) {
      if (pa[k] + CUBE / 2 <= pb[k] - CUBE / 2 + 1e-9) return toward[k] > 0 ? 1 : 0;
      if (pb[k] + CUBE / 2 <= pa[k] - CUBE / 2 + 1e-9) return toward[k] > 0 ? 0 : 1;
    }
    return -1;
  }
  /* a polygon's bounding box, [x0, x1, y0, y1] */
  function bounds(poly) {
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  }
  const boxesMeet = (a, b) => !(a[1] < b[0] || b[1] < a[0] || a[3] < b[2] || b[3] < a[2]);

  /* The tone of place h's turn: 0 on the top turn, 1 on the next one down, and
     so on by parity, blending over the step from the turn's place 8 to 9 so a
     cube crossing from one turn to the next changes tone smoothly. */
  const turnTone = (h) => {
    const k = Math.floor(h / 9), j = h - 9 * k, par = (n) => mod(n, 2);
    return j > 8 ? par(k) + (par(k + 1) - par(k)) * smooth(j - 8) : par(k);
  };
  /* a cube's fade with the turns' tones in it; the cubes past the tip keep their own */
  const paler = (c) => (c.h > 8 ? c.fade : 1 - (1 - c.fade) * (1 - 0.3 * turnTone(c.h)));

  /* The cubes in px, and for each cube the cubes drawn over it: by the loop
     ("loop", straight on) or by depth ("depth", turned). */
  function layout(cubes, M, cx, cy, scale, rule, shade) {
    const toward = SHAPE.axes.map((e) => dot(M[2], e));
    const corners = SHAPE.corners.map((p) => tx(M, p));
    const normals = SHAPE.faces.map((f) => tx(M, f.n));
    const quads = SHAPE.faces.map((f) => f.quad.map((p) => tx(M, p)));
    /* the faces in view, lightest first: top, side, and the last one dark */
    const shown = [];
    SHAPE.faces.forEach((f, fi) => {
      const n = normals[fi];
      if (n[2] > 0.02) shown.push([fi, dot([-n[0], n[1], n[2]], LIGHT)]);
    });
    shown.sort((a, b) => b[1] - a[1]);
    const TONES = ["top", "side", "dark"];
    const tone = (r) => TONES[r === shown.length - 1 ? 2 : Math.min(r, 1)];
    const items = cubes.map((c) => {
      const v = tx(M, add(cam(c.P), PIVOT.g, -1));
      const toPx = (p) => [cx - (v[0] + CUBE * p[0]) * scale, cy - (v[1] + CUBE * p[1]) * scale];
      /* turned, every other turn of the screw is a shade paler (the top turn is
         not), so neighbouring turns part where their faces would merge */
      const fade = rule === "depth" ? paler(c) : c.fade;
      const faces = shown.map(([fi], r) => ({ poly: quads[fi].map(toPx), fill: shade(tone(r), fade) }));
      const h = hull(corners.map(toPx));
      return {
        c, z: v[2], brk: rule === "loop" ? c.x : v[2], alpha: c.alpha,
        /* the cube's shape a hair inside its edge, in the top tone, laid
           under the faces so no ground shows in the seams between them */
        core: outset(h, -0.75), coreFill: shade("top", fade),
        hull: h, faces,
      };
    });
    const boxes = items.map((it) => bounds(it.hull));
    const over = items.map(() => []);
    for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
      if (!boxesMeet(boxes[a], boxes[b])) continue;
      let top;
      if (rule === "loop") top = mod(cubes[b].x - cubes[a].x, 9) < 4.5 ? b : a;
      else {
        const o = apart(cubes[a].P, cubes[b].P, toward);
        top = o === 0 ? a : o === 1 ? b : items[a].z > items[b].z ? a : b;
      }
      over[top === a ? b : a].push(top);
    }
    return { items, over };
  }

  /* The order to paint in: back to front where the order allows; where it goes
     round in a loop, it is broken at the cube with the lowest brk (straight
     on, the cube nearest the tip). */
  function paintOrder({ items, over }) {
    const n = items.length, under = items.map(() => []);
    over.forEach((tops, b) => tops.forEach((t) => under[t].push(b)));
    const done = new Uint8Array(n), order = [];
    const lowest = (ok, key) => {
      let pick = -1, best = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && ok(i) && items[i][key] < best) { pick = i; best = items[i][key]; }
      return pick;
    };
    while (order.length < n) {
      let pick = lowest((i) => under[i].every((j) => done[j]), "z");
      if (pick < 0) pick = lowest(() => true, "brk");
      done[pick] = 1; order.push(pick);
    }
    return order;
  }

  /* Paints cubes over each other in paintOrder. A cube painted after one that
     should cover it (where a loop was broken) is clipped at that cube's edge.
     ids paints each cube flat in its own colour, rgb(index + 1, 90, 40). The
     seam core goes under the faces only at full opacity: a fading cube would
     show it through the faces, compounding their alpha and shifting the side
     and dark tones toward the top one. */
  function composite(ctx, layer, ids) {
    const { items, over } = layer, painted = new Uint8Array(items.length);
    const trace = (poly) => {
      ctx.beginPath();
      poly.forEach((p, k) => ctx[k ? "lineTo" : "moveTo"](p[0], p[1]));
      ctx.closePath();
    };
    const clipOut = (poly) => {
      ctx.beginPath();
      ctx.rect(-1e4, -1e4, 2e4, 2e4);
      poly.forEach((p, k) => ctx[k ? "lineTo" : "moveTo"](p[0], p[1]));
      ctx.closePath();
      ctx.clip("evenodd");
    };
    for (const i of paintOrder(layer)) {
      const it = items[i], covers = over[i].filter((j) => painted[j]);
      if (covers.length) { ctx.save(); for (const j of covers) clipOut(items[j].hull); }
      if (ids) { trace(it.hull); ctx.fillStyle = `rgb(${i + 1},90,40)`; ctx.fill(); }
      else {
        ctx.globalAlpha = it.alpha;
        if (it.alpha >= 1) { trace(it.core); ctx.fillStyle = it.coreFill; ctx.fill(); }
        for (const f of it.faces) { trace(f.poly); ctx.fillStyle = f.fill; ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      if (covers.length) ctx.restore();
      painted[i] = 1;
    }
  }

  /* how far the drawing has gone from the loop's order to true depth, by degrees off the straight view */
  const handover = (deg) => smooth((deg - 1) / (6 - 1));
  const view = (yaw, pitch) => mm(axisAngle([1, 0, 0], pitch), axisAngle([0, 1, 0], -yaw));
  const degOff = (M) => (Math.acos(Math.min(1, Math.abs(M[2][2]))) * 180) / Math.PI;
  /* turned, the figure draws back, so more of the screw fits around it */
  const ZOOM = 1;

  /* What paint draws at time t and a turn: the straight-on layer (the top
     turn in the loop's order) and the turned one (the screw in depth), each
     with its weight. */
  function frame(t, yaw, pitch, cx, cy, sc, col, opts = {}) {
    const M = view(yaw, pitch), deg = degOff(M), w = handover(deg), shade = shader(col);
    const scale = sc / (1 + ZOOM * Math.sin((deg * Math.PI) / 180)), layers = [];
    if (w < 1) layers.push({ weight: 1, ...layout(cubesAt(t, false), M, cx, cy, scale, "loop", shade) });
    if (w > 0) layers.push({ weight: w, ...layout(cubesAt(t, true), M, cx, cy, scale, "depth", shade) });
    return { layers };
  }

  /* A second canvas per target, for the turned layer while it dissolves in;
     emptied (0 x 0) once the dissolve is over. */
  const spare = new WeakMap();
  function spareFor(ctx) {
    let s = spare.get(ctx);
    if (!s) { s = ctx.canvas.ownerDocument.createElement("canvas").getContext("2d"); spare.set(ctx, s); }
    if (s.canvas.width !== ctx.canvas.width || s.canvas.height !== ctx.canvas.height) {
      s.canvas.width = ctx.canvas.width; s.canvas.height = ctx.canvas.height;
    }
    return s;
  }
  function releaseSpare(ctx) {
    const s = spare.get(ctx);
    if (s) { s.canvas.width = s.canvas.height = 0; spare.delete(ctx); }
  }

  /* Paints the figure at clock t (seconds), turned by yaw/pitch from the
     straight view, with the closed picture's centre at (cx, cy) and sc px per
     model unit, onto ctx (its current transform). col: { top, side, dark, ground }.
     Returns the hulls of the cubes drawn, in model units about the centre, y
     up (what a press is tested against). */
  function paint(ctx, col, t, yaw, pitch, cx, cy, sc, opts = {}) {
    const { layers } = frame(t, yaw, pitch, cx, cy, sc, col, opts);
    const [first, second] = layers;
    composite(ctx, first, opts.ids);
    if (second) {
      const back = spareFor(ctx);
      back.setTransform(1, 0, 0, 1, 0, 0);
      back.clearRect(0, 0, back.canvas.width, back.canvas.height);
      back.setTransform(ctx.getTransform());
      composite(back, second, opts.ids);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = second.weight;
      ctx.drawImage(back.canvas, 0, 0);
      ctx.restore();
    } else releaseSpare(ctx);
    const top = second && second.weight >= 0.5 ? second : first;
    return top.items.map((it) => ({ poly: it.hull.map(([x, y]) => [(x - cx) / sc, (cy - y) / sc]) }));
  }

  /* ---------- the turn ---------- */
  /* The views the figure rests in, as [yaw, pitch] in rad. Each looks along a
     line between two cubes of the staircase, so one cube covers the other
     exactly: the view's axis, in camera axes, is the step between them. paint's
     M = Rx(pitch)Ry(-yaw) has the viewing axis as its third row,
     (cos p sin y, sin p, cos p cos y), which gives yaw and pitch back. */
  const along = (d) => {
    let v = norm(cam(d));
    if (v[2] < 0) v = v.map((x) => -x);
    return [Math.atan2(v[0], v[2]), Math.asin(v[1])];
  };
  /* left (the default), straight, right: by yaw. Left looks along [2,1,1], where
     place 3 covers place -9 (a turn and three places below) exactly; right along
     [1,3,2], where place 8 covers place 2. */
  const POSES = [along([2, 1, 1]), [0, 0], along([1, 3, 2])];
  /* Turning is a single parameter, the yaw u; the pitch follows it on a cubic
     Hermite curve through the three poses (slopes from the neighbouring
     knots), continued in a straight line past the ends. */
  const SLOPE = POSES.map((q, i) => {
    const a = POSES[Math.max(0, i - 1)], b = POSES[Math.min(2, i + 1)];
    return (b[1] - a[1]) / (b[0] - a[0]);
  });
  function pitchAt(u) {
    if (u <= POSES[0][0]) return POSES[0][1] + SLOPE[0] * (u - POSES[0][0]);
    if (u >= POSES[2][0]) return POSES[2][1] + SLOPE[2] * (u - POSES[2][0]);
    const i = u < POSES[1][0] ? 0 : 1, [x0, y0] = POSES[i], [x1, y1] = POSES[i + 1];
    const h = x1 - x0, t = (u - x0) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * SLOPE[i] + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * SLOPE[i + 1];
  }
  /* A soft edge: past the end poses the figure gives at most 9° more, harder the further you pull. */
  const SOFT = (9 * Math.PI) / 180;
  const soften = (u) => {
    const lo = POSES[0][0], hi = POSES[2][0];
    return u < lo ? lo - SOFT * (1 - Math.exp((u - lo) / SOFT)) : u > hi ? hi + SOFT * (1 - Math.exp((hi - u) / SOFT)) : u;
  };
  /* The wheel: a drag d (px, y down) by a pointer at r from the pivot turns by
     the part of d along the circle round the pivot, anticlockwise on screen
     toward the right pose; 0.011 rad a px. */
  const wheel = (r, d) => (-(r[0] * d[1] - r[1] * d[0]) / (Math.hypot(r[0], r[1]) || 1)) * 0.011;
  /* Which pose a release lands on (an index into POSES): the one nearest where
     the press began, or the next one in the direction moved when the drag
     covered more than a third of the gap to it. */
  function landing(u0, u) {
    let i0 = 0;
    POSES.forEach((q, i) => { if (Math.abs(q[0] - u0) < Math.abs(POSES[i0][0] - u0)) i0 = i; });
    const i1 = Math.max(0, Math.min(2, i0 + Math.sign(u - u0))), gap = Math.abs(POSES[i1][0] - POSES[i0][0]);
    return gap > 0 && Math.abs(u - u0) > gap / 3 ? i1 : i0;
  }
  /* A tap on the straight figure picks the pose it turns to: right where it is
     on the right leg (the tip's cube to the bottom-right corner's) or on the
     bottom's right three, left anywhere else. (x, y): model units about the
     centre, y up, as paint's hulls. */
  let straight = null;
  function tapPose(x, y) {
    if (!straight) {
      const items = layout(cubesAt(0, false), view(0, 0), 0, 0, 1, "loop", () => "").items, at = [];
      items.forEach((it) => {
        const poly = it.hull.map(([a, b]) => [a, -b]), n = poly.length;
        at[Math.round(it.c.h)] = { poly, mid: poly.reduce((m, p) => [m[0] + p[0] / n, m[1] + p[1] / n], [0, 0]) };
      });
      straight = at;
    }
    const inside = (poly) => {
      const side = poly.map((a, i) => { const b = poly[(i + 1) % poly.length]; return (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); });
      return side.every((v) => v >= 0) || side.every((v) => v <= 0);
    };
    /* place 6 is drawn over place 5, so where they overlap the tap is on 6 */
    if ([3, 4, 5].some((j) => inside(straight[j].poly)) && !inside(straight[6].poly)) return 2;
    const leg = (a, b) => {
      const [p, q] = [straight[a % 9].mid, straight[b % 9].mid], vx = q[0] - p[0], vy = q[1] - p[1];
      const t = clamp01(((x - p[0]) * vx + (y - p[1]) * vy) / (vx * vx + vy * vy));
      return Math.hypot(x - p[0] - vx * t, y - p[1] - vy * t);
    };
    const d = [leg(0, 3), leg(3, 6), leg(6, 9)];
    /* the tip's own cube is on both legs: it takes the default, left */
    return d[0] < d[1] - 1e-9 && d[0] < d[2] - 1e-9 ? 2 : 0;
  }
  const turn = { POSES, pitchAt, soften, wheel, landing, tapPose };

  /* REST: where the rest pose's furthest point sits from the centre of the
     figure's box, as a share of the box's half-size, on the page entity and in
     the home's fragment. The live canvas and the baked stills both size the
     rest pose from REACH and REST, so the still and the first live frame match. */
  const REST = { page: 0.952, fragment: 1.17 };
  const api = { paint, frame, composite, cubesAt, phase, turn, REACH: PIVOT.reach, REST, TICK, GLIDE, TURNS };
  if (typeof window !== "undefined") { window.NTS = window.NTS || {}; window.NTS.cubes = api; }
  if (typeof module !== "undefined") module.exports = api;
})();

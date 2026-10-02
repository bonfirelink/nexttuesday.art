/* The hearth: a tetrahedron, Plato's solid of fire, drawn only by the heat
   shimmer it puts into a stack of horizontal lines. Each line is cast
   straight into the turning solid (orthographic rays); where it crosses a
   face it ripples, harder and hotter on faces turned from the light, and
   calms near the edges so the solid's outline reads.
   Inspired by "Wavy Cube" by Jon Kantner (jkantner),
   https://codepen.io/jkantner/pen/bNpaQJN (MIT). The scan-line idea, the
   lighting-to-amplitude mapping and the edge fade come from it; the solid,
   the ray test, the colours and the interaction are this page's own.
   Decorative only: the page is complete without it. Drag to turn it, tap to
   stoke it. Under prefers-reduced-motion it draws one still frame. */
(() => {
  const canvas = document.querySelector("canvas.hearth");
  const ctx = canvas && canvas.getContext && canvas.getContext("2d");
  if (!ctx) return;

  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const TAU = Math.PI * 2;
  const STEP = 1.5; // px between samples along a line
  const SPACING = 13; // px between lines
  const WAVE = 0.42; // ripple frequency, rad/px

  // Unit face normals of a regular tetrahedron with vertices (±1,±1,±1), an
  // even count of minus signs; each face sits at distance INRADIUS * size.
  const FACES = [[-1, -1, -1], [-1, 1, 1], [1, -1, 1], [1, 1, -1]].map((v) =>
    v.map((c) => c / Math.sqrt(3)));
  const INRADIUS = 1 / Math.sqrt(3);
  // Faces meet at cos = -1/3; this turns a plane distance into an in-face one.
  const EDGE_SIN = Math.sqrt(1 - 1 / 9);

  // Stroke styles from cool (no heat) to white-hot: paper lines, then fire.
  const HEAT = ["rgba(253, 237, 240, 0.5)", "#e51d47", "#ff7a5c", "#ffe9d0"];

  let w = 0, h = 0, dpr = 1;
  let yaw = 0.6, pitch = 0.5, spin = 0.3; // spin: rad/s about the vertical
  let t = 0, stoke = 0, last = 0, raf = 0;
  let visible = false;
  let dragging = false, lastX = 0, lastT = 0, moved = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.round(r.width);
    h = Math.round(r.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function rotate(v, cy, sy, cx, sx) {
    // about Y (yaw), then about X (pitch)
    const x = v[0] * cy + v[2] * sy;
    const z = -v[0] * sy + v[2] * cy;
    return [x, v[1] * cx - z * sx, v[1] * sx + z * cx];
  }

  function draw() {
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);

    const size = Math.min(w, h) * 0.62 / Math.sqrt(3);
    const d = INRADIUS * size;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cx = Math.cos(pitch), sx = Math.sin(pitch);
    const n = FACES.map((f) => rotate(f, cy, sy, cx, sx));
    const fade = Math.min(10, size * 0.12);
    const amp = SPACING * 0.55 * (1 + stoke);

    const lines = Math.max(3, Math.floor((h - 24) / SPACING));
    const top = (h - (lines - 1) * SPACING) / 2;
    const paths = HEAT.map(() => new Path2D());
    const glow = new Path2D();

    for (let i = 0; i < lines; i++) {
      const y0 = top + i * SPACING;
      const py = y0 - h / 2;
      let prev = -1, px = 0, pyy = 0;
      for (let sxp = 12; sxp <= w - 12; sxp += STEP) {
        const qx = sxp - w / 2;
        // A ray from the viewer along -z through (qx, py): enter through the
        // last plane it crosses inward, leave through the first outward.
        let tIn = -Infinity, tOut = Infinity, face = -1;
        for (let k = 0; k < 4; k++) {
          const nk = n[k];
          const denom = -nk[2];
          const num = d - (nk[0] * qx + nk[1] * py + nk[2] * 1e4);
          if (Math.abs(denom) < 1e-6) {
            if (num < 0) { tIn = Infinity; break; }
            continue;
          }
          const tt = num / denom;
          if (denom < 0) { if (tt > tIn) { tIn = tt; face = k; } }
          else if (tt < tOut) tOut = tt;
        }
        // A slow swell on every line, like heat over the whole floor.
        let y = y0 + Math.sin(sxp * 0.013 + t * 0.5 + i * 0.9) * 1.1;
        let bucket = 0;
        if (face >= 0 && tIn <= tOut) {
          const pz = 1e4 - tIn;
          const nf = n[face];
          let edge = Infinity;
          for (let k = 0; k < 4; k++) {
            if (k === face) continue;
            const nk = n[k];
            const gap = (d - (nk[0] * qx + nk[1] * py + nk[2] * pz)) / EDGE_SIN;
            if (gap < edge) edge = gap;
          }
          let e = Math.max(0, Math.min(1, edge / fade));
          e = e * (2 - e);
          // Lit faces (normal towards the viewer) stay calm; turned ones seethe.
          let a = Math.max(0, Math.min(1, 0.95 - nf[2] * 0.75));
          a = a * a * (3 - 2 * a);
          const k = a * e;
          y += Math.sin(sxp * WAVE - t * 5 + i * 0.7) * amp * k;
          bucket = k < 0.04 ? 0 : k < 0.4 ? 1 : k < 0.75 ? 2 : 3;
        }
        if (prev >= 0) {
          paths[bucket].moveTo(px, pyy);
          paths[bucket].lineTo(sxp, y);
          if (bucket) { glow.moveTo(px, pyy); glow.lineTo(sxp, y); }
        }
        prev = bucket; px = sxp; pyy = y;
      }
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(229, 29, 71, 0.18)";
    ctx.stroke(glow);
    for (let b = 0; b < HEAT.length; b++) {
      ctx.lineWidth = b ? 1.5 : 1;
      ctx.strokeStyle = HEAT[b];
      ctx.stroke(paths[b]);
    }
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
    last = now;
    t += dt;
    if (!dragging) {
      // drift back to the resting spin after a drag or a flick
      spin += (0.3 - spin) * Math.min(1, dt * 1.5);
    }
    yaw = (yaw + spin * dt) % TAU;
    pitch = 0.5 + Math.sin(t * 0.23) * 0.35;
    stoke *= Math.exp(-dt * 1.8);
    draw();
    schedule();
  }

  function schedule() {
    if (!raf && visible && !document.hidden && !still.matches) {
      raf = requestAnimationFrame(frame);
    }
  }

  function halt() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  }

  // Drag sideways to turn it; a tap stokes the fire. Vertical pans still
  // scroll the page (touch-action: pan-y in the CSS).
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    moved = 0;
    lastX = e.clientX;
    lastT = e.timeStamp;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dtm = Math.max(8, e.timeStamp - lastT);
    moved += Math.abs(dx);
    yaw += dx * 0.012;
    spin = Math.max(-6, Math.min(6, (dx * 0.012) / (dtm / 1000)));
    lastX = e.clientX;
    lastT = e.timeStamp;
    if (still.matches) draw();
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    if (moved < 6) {
      stoke = Math.min(1.2, stoke + 0.8);
      if (still.matches) { draw(); stoke = 0; }
    }
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      visible ? schedule() : halt();
    }).observe(canvas);
  } else {
    visible = true;
  }
  document.addEventListener("visibilitychange", () => {
    document.hidden ? halt() : schedule();
  });
  still.addEventListener?.("change", () => { halt(); draw(); schedule(); });
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener("resize", resize);

  resize();
  schedule();
})();

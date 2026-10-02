/* The riso portal: the layers of the portal turn at their own speeds as you
   scroll, and settle into one aligned figure when you turn it (a tap, or a
   long press). The EMBERS page draws the hearth, a tetrahedron made of heat
   in a stack of lines. Everything here is decorative: the pages read fully
   with scripts off. */
(() => {
  document.documentElement.classList.remove("no-js");
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- the portal ---------- */
  const btn = document.querySelector(".portal-btn");
  const portal = btn && btn.querySelector(".portal");
  if (portal) {
    const turn = document.querySelector(".turn");
    // degrees per scrolled pixel, each layer its own
    const SPEED = { ticks: 0.045, hept: -0.08, waves: 0.025, knot: 0.12, stars: -0.03 };
    const REST = { ticks: 0, hept: -14, waves: 0, knot: 26, stars: 0 };
    let aligned = false, raf = 0, turning = 0;

    const set = (y) => {
      for (const k in SPEED) {
        const deg = aligned ? 0 : REST[k] + y * SPEED[k];
        portal.style.setProperty(`--r-${k}`, deg.toFixed(2) + "deg");
      }
    };
    const onScroll = () => {
      if (raf || aligned) return;
      raf = requestAnimationFrame(() => { raf = 0; set(window.scrollY); });
    };
    addEventListener("scroll", onScroll, { passive: true });

    const toggle = () => {
      aligned = !aligned;
      portal.classList.add("is-turning");
      portal.classList.toggle("is-aligned", aligned);
      btn.setAttribute("aria-pressed", String(aligned));
      turn && turn.classList.toggle("is-open", aligned);
      set(window.scrollY);
      clearTimeout(turning);
      turning = setTimeout(() => portal.classList.remove("is-turning"), 2300);
    };

    // A long press turns it too; the click after a long press is ignored.
    let hold = 0, held = false;
    btn.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      held = false;
      hold = setTimeout(() => { held = true; toggle(); }, 480);
    });
    const release = () => { clearTimeout(hold); };
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("pointerleave", release);
    btn.addEventListener("click", () => { if (held) { held = false; return; } toggle(); });

    set(window.scrollY);
  }

  /* ---------- the hearth (EMBERS) ----------
     A tetrahedron, Plato's solid of fire, shown only by the heat it puts into
     a stack of horizontal lines. Inspired by "Wavy Cube" by Jon Kantner
     (codepen.io/jkantner, MIT): the scan-line idea, the lighting-to-amplitude
     mapping and the edge fade. The solid, the colours and the interaction are
     this page's own. Drag sideways to turn it, tap to stoke it. */
  const wrap = document.querySelector(".hearth-wrap");
  const canvas = wrap && document.createElement("canvas");
  const ctx = canvas && canvas.getContext && canvas.getContext("2d");
  if (wrap && ctx) {
    canvas.setAttribute("aria-hidden", "true");
    wrap.appendChild(canvas);
    wrap.classList.add("has-canvas");

    const TAU = Math.PI * 2, STEP = 1.5, SPACING = 11, WAVE = 0.42;
    const FACES = [[-1, -1, -1], [-1, 1, 1], [1, -1, 1], [1, 1, -1]].map((v) => v.map((c) => c / Math.sqrt(3)));
    const INRADIUS = 1 / Math.sqrt(3), EDGE_SIN = Math.sqrt(1 - 1 / 9);
    // cool (the paper's own cobalt tint) to white-hot, the riso inks
    const HEAT = ["rgba(207, 203, 242, .55)", "#ff4a55", "#f5b31b", "#f4ecdc"];

    let w = 0, h = 0, dpr = 1;
    let yaw = 0.6, pitch = 0.5, spin = 0.3, t = 0, stoke = 0, last = 0, raf = 0;
    let visible = false, dragging = false, lastX = 0, lastT = 0, moved = 0;

    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = Math.round(r.width); h = Math.round(r.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    function rotate(v, cy, sy, cx, sx) {
      const x = v[0] * cy + v[2] * sy, z = -v[0] * sy + v[2] * cy;
      return [x, v[1] * cx - z * sx, v[1] * sx + z * cx];
    }
    function draw() {
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);
      const size = Math.min(w, h) * 0.62 / Math.sqrt(3), d = INRADIUS * size;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
      const n = FACES.map((f) => rotate(f, cy, sy, cx, sx));
      const fade = Math.min(10, size * 0.12), amp = SPACING * 0.55 * (1 + stoke);
      const lines = Math.max(3, Math.floor((h - 8) / SPACING)), top = (h - (lines - 1) * SPACING) / 2;
      const paths = HEAT.map(() => new Path2D());
      for (let i = 0; i < lines; i++) {
        const y0 = top + i * SPACING, py = y0 - h / 2;
        let prev = -1, px = 0, pyy = 0;
        for (let sxp = 0; sxp <= w; sxp += STEP) {
          const qx = sxp - w / 2;
          let tIn = -Infinity, tOut = Infinity, face = -1;
          for (let k = 0; k < 4; k++) {
            const nk = n[k], denom = -nk[2], num = d - (nk[0] * qx + nk[1] * py + nk[2] * 1e4);
            if (Math.abs(denom) < 1e-6) { if (num < 0) { tIn = Infinity; break; } continue; }
            const tt = num / denom;
            if (denom < 0) { if (tt > tIn) { tIn = tt; face = k; } } else if (tt < tOut) tOut = tt;
          }
          let y = y0 + Math.sin(sxp * 0.013 + t * 0.5 + i * 0.9) * 1.1, bucket = 0;
          if (face >= 0 && tIn <= tOut) {
            const pz = 1e4 - tIn, nf = n[face];
            let edge = Infinity;
            for (let k = 0; k < 4; k++) {
              if (k === face) continue;
              const nk = n[k], gap = (d - (nk[0] * qx + nk[1] * py + nk[2] * pz)) / EDGE_SIN;
              if (gap < edge) edge = gap;
            }
            let e = Math.max(0, Math.min(1, edge / fade)); e = e * (2 - e);
            let a = Math.max(0, Math.min(1, 0.95 - nf[2] * 0.75)); a = a * a * (3 - 2 * a);
            const k = a * e;
            y += Math.sin(sxp * WAVE - t * 5 + i * 0.7) * amp * k;
            bucket = k < 0.04 ? 0 : k < 0.4 ? 1 : k < 0.75 ? 2 : 3;
          }
          if (prev >= 0) { paths[bucket].moveTo(px, pyy); paths[bucket].lineTo(sxp, y); }
          prev = bucket; px = sxp; pyy = y;
        }
      }
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (let b = 0; b < HEAT.length; b++) { ctx.lineWidth = b ? 1.6 : 1.1; ctx.strokeStyle = HEAT[b]; ctx.stroke(paths[b]); }
    }
    function frame(now) {
      raf = 0;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
      last = now; t += dt;
      if (!dragging) spin += (0.3 - spin) * Math.min(1, dt * 1.5);
      yaw = (yaw + spin * dt) % TAU;
      pitch = 0.5 + Math.sin(t * 0.23) * 0.35;
      stoke *= Math.exp(-dt * 1.8);
      draw(); schedule();
    }
    function schedule() { if (!raf && visible && !document.hidden && !still.matches) raf = requestAnimationFrame(frame); }
    function halt() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }

    canvas.addEventListener("pointerdown", (e) => { dragging = true; moved = 0; lastX = e.clientX; lastT = e.timeStamp; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dtm = Math.max(8, e.timeStamp - lastT);
      moved += Math.abs(dx); yaw += dx * 0.012;
      spin = Math.max(-6, Math.min(6, (dx * 0.012) / (dtm / 1000)));
      lastX = e.clientX; lastT = e.timeStamp;
      if (still.matches) draw();
    });
    const release = () => {
      if (!dragging) return;
      dragging = false;
      if (moved < 6) { stoke = Math.min(1.2, stoke + 0.8); if (still.matches) { draw(); stoke = 0; } }
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);

    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; visible ? schedule() : halt(); }).observe(canvas);
    } else visible = true;
    document.addEventListener("visibilitychange", () => { document.hidden ? halt() : schedule(); });
    still.addEventListener && still.addEventListener("change", () => { halt(); draw(); schedule(); });
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas); else addEventListener("resize", resize);
    resize(); schedule();
  }
})();

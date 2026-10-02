/* The hearth: a tetrahedron, Plato's solid of fire, drawn only by the heat it
   puts into a stack of horizontal lines. Each line is cast straight into the
   turning solid; where it crosses a face it ripples, harder and hotter on the
   faces turned from the light, and calms at the edges so the outline reads.
   Hot lines run thicker and climb a heat ramp from ember red to cream. Stoke
   it and it sheds embers.
   After "Wavy Cube" by Jon Kantner (jkantner), codepen.io/jkantner/pen/bNpaQJN
   (MIT): the scan-line idea, lighting-to-amplitude mapping and edge fade are
   his; the solid, the ray test, the heat ramp, the embers and the interaction
   are this page's own.
   Decorative only: every page is complete without it. Drag to turn, tap to
   stoke. Under prefers-reduced-motion it draws one still frame. Each
   <canvas class="hearth"> is tuned by data attributes:
     data-spacing  px between lines (14)
     data-wave     ripple frequency, rad/px (0.42)
     data-amp      ripple height, in line spacings (0.55)
     data-speed    ripple travel (5)
     data-spin     resting turn, rad/s (0.32)
     data-size     circumradius, as a share of the shorter side (0.6)
     data-cx/cy    centre, as a share of width/height (0.5, 0.5)
     data-wide     "cx,cy,size" used instead once the canvas is 900px wide
     data-embers   "off" to shed none
     data-stoke    starting heat, 0..1 (0)
     data-base     colour of the calm lines */
(() => {
  "use strict";
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const TAU = Math.PI * 2;
  const STEP = 1.5;

  // Unit face normals of a regular tetrahedron with vertices (±1,±1,±1), an
  // even count of minus signs; each face sits at distance INRADIUS * size.
  const FACES = [[-1, -1, -1], [-1, 1, 1], [1, -1, 1], [1, 1, -1]].map((v) =>
    v.map((c) => c / Math.sqrt(3)));
  const INRADIUS = 1 / Math.sqrt(3);
  const EDGE_SIN = Math.sqrt(1 - 1 / 9);

  // The heat ramp, cold to white-hot. Stroke colours per bucket.
  const RAMP = [
    "#6e1030", "#a3163c", "#e51d47", "#f03a3c", "#f2591b", "#ff7a3d",
    "#ffa05a", "#ffc082", "#ffd9a8", "#ffe9d0", "#fff4e6",
  ];
  const EMBER_RAMP = ["#fff4e6", "#ffe9d0", "#ffc082", "#ff7a3d", "#f2591b", "#e51d47", "#a3163c"];

  function mount(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const d = canvas.dataset;
    const num = (k, f) => (d[k] !== undefined && d[k] !== "" ? +d[k] : f);
    const o = {
      spacing: num("spacing", 14),
      wave: num("wave", 0.42),
      amp: num("amp", 0.55),
      speed: num("speed", 5),
      spin: num("spin", 0.32),
      size: num("size", 0.6),
      cx: num("cx", 0.5),
      cy: num("cy", 0.5),
      wide: d.wide ? d.wide.split(",").map(Number) : null,
      embers: d.embers !== "off",
      base: d.base || "rgba(229, 29, 71, 0.26)",
      interactive: d.interactive !== "off",
      stoke0: num("stoke", 0),
    };

    let w = 0, h = 0, dpr = 1;
    let yaw = 0.6, pitch = 0.5, pitchDrag = 0, spin = o.spin;
    let t = 0, stoke = o.stoke0, last = 0, raf = 0;
    let visible = false;
    let dragging = false, lastX = 0, lastY = 0, lastT = 0, moved = 0;
    const embers = [];
    const hot = []; // sampled hot points from the last frame, for shedding

    function geom() {
      let cx = o.cx, cy = o.cy, size = o.size;
      if (o.wide && w >= 900) [cx, cy, size] = o.wide;
      return { cx: cx * w, cy: cy * h, size: Math.min(w, h) * size / Math.sqrt(3) };
    }

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
      const x = v[0] * cy + v[2] * sy;
      const z = -v[0] * sy + v[2] * cy;
      return [x, v[1] * cx - z * sx, v[1] * sx + z * cx];
    }

    function draw() {
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);
      const g = geom();
      const size = g.size;
      const dist = INRADIUS * size;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const p = pitch + pitchDrag;
      const cx = Math.cos(p), sx = Math.sin(p);
      const n = FACES.map((f) => rotate(f, cy, sy, cx, sx));
      const fade = Math.min(12, size * 0.1);
      const heat = Math.min(1.6, stoke);
      const amp = o.spacing * o.amp * (1 + heat * 0.9);
      const spacing = o.spacing;

      // A breath of warmth behind the solid, stronger when stoked.
      const halo = ctx.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, size * 1.3);
      halo.addColorStop(0, `rgba(242, 89, 27, ${0.12 + heat * 0.16})`);
      halo.addColorStop(0.5, `rgba(229, 29, 71, ${0.06 + heat * 0.08})`);
      halo.addColorStop(1, "rgba(229, 29, 71, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);

      const lines = Math.max(3, Math.floor((h - 8) / spacing));
      const top = (h - (lines - 1) * spacing) / 2;
      const paths = RAMP.map(() => new Path2D());
      const basePath = new Path2D();
      const glow = new Path2D();
      hot.length = 0;

      for (let i = 0; i < lines; i++) {
        const y0 = top + i * spacing;
        const py = y0 - g.cy;
        let prev = -2, px = 0, pyy = 0;
        for (let sxp = 0; sxp <= w; sxp += STEP) {
          const qx = sxp - g.cx;
          let tIn = -Infinity, tOut = Infinity, face = -1;
          for (let k = 0; k < 4; k++) {
            const nk = n[k];
            const denom = -nk[2];
            const num = dist - (nk[0] * qx + nk[1] * py + nk[2] * 1e4);
            if (Math.abs(denom) < 1e-6) {
              if (num < 0) { tIn = Infinity; break; }
              continue;
            }
            const tt = num / denom;
            if (denom < 0) { if (tt > tIn) { tIn = tt; face = k; } }
            else if (tt < tOut) tOut = tt;
          }
          // A slow swell on every line, so the stack breathes with the solid.
          let y = y0 + Math.sin(sxp * 0.011 + t * 0.45 + i * 0.9) * 1.3;
          let bucket = -1;
          if (face >= 0 && tIn <= tOut) {
            const pz = 1e4 - tIn;
            const nf = n[face];
            let edge = Infinity;
            for (let k = 0; k < 4; k++) {
              if (k === face) continue;
              const nk = n[k];
              const gap = (dist - (nk[0] * qx + nk[1] * py + nk[2] * pz)) / EDGE_SIN;
              if (gap < edge) edge = gap;
            }
            let e = Math.max(0, Math.min(1, edge / fade));
            e = e * (2 - e);
            // Lit faces (normal towards the viewer) stay calm; turned ones seethe.
            let a = Math.max(0, Math.min(1, 0.95 - nf[2] * 0.75));
            a = a * a * (3 - 2 * a);
            const k = a * e;
            y += Math.sin(sxp * o.wave - t * o.speed + i * 0.7) * amp * k;
            // Heat climbs the ramp with k, and the whole solid runs hotter when stoked.
            const hk = Math.min(1, k * (0.75 + heat * 0.6) + heat * 0.12 * e);
            bucket = k < 0.03 ? -1 : Math.min(RAMP.length - 1, Math.floor(hk * (RAMP.length - 1) + 0.5));
            if (hk > 0.55 && hot.length < 240 && Math.random() < 0.08) hot.push(sxp, y, hk);
          }
          if (prev !== -2) {
            const path = bucket < 0 ? basePath : paths[bucket];
            path.moveTo(px, pyy);
            path.lineTo(sxp, y);
            if (bucket >= 3) { glow.moveTo(px, pyy); glow.lineTo(sxp, y); }
          }
          prev = bucket; px = sxp; pyy = y;
        }
      }

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = o.base;
      ctx.stroke(basePath);
      ctx.lineWidth = 7;
      ctx.strokeStyle = `rgba(242, 89, 27, ${0.12 + heat * 0.1})`;
      ctx.stroke(glow);
      for (let b = 0; b < RAMP.length; b++) {
        const f = b / (RAMP.length - 1);
        ctx.lineWidth = 1.1 + f * 1.6;
        ctx.strokeStyle = RAMP[b];
        ctx.stroke(paths[b]);
      }

      drawEmbers();
    }

    function shed(count, burst) {
      if (!o.embers || hot.length < 3) return;
      const n = hot.length / 3;
      for (let i = 0; i < count && embers.length < 220; i++) {
        const j = Math.floor(Math.random() * n) * 3;
        const speed = burst ? 60 + Math.random() * 140 : 18 + Math.random() * 40;
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * (burst ? 1.6 : 0.7);
        embers.push({
          x: hot[j], y: hot[j + 1],
          vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
          life: 1, decay: burst ? 0.35 + Math.random() * 0.5 : 0.18 + Math.random() * 0.25,
          r: 0.8 + Math.random() * (burst ? 2.2 : 1.4),
          ph: Math.random() * TAU,
        });
      }
    }

    function stepEmbers(dt) {
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i];
        e.life -= e.decay * dt;
        if (e.life <= 0 || e.y < -10) { embers.splice(i, 1); continue; }
        e.vy -= 55 * dt;                       // embers rise
        e.vx += Math.sin(t * 3 + e.ph) * 40 * dt; // and wander
        e.vx *= 1 - 0.9 * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
      }
    }

    function drawEmbers() {
      if (!embers.length) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const e of embers) {
        const c = EMBER_RAMP[Math.min(EMBER_RAMP.length - 1, Math.floor((1 - e.life) * EMBER_RAMP.length))];
        const r = e.r * (0.4 + e.life * 0.8);
        ctx.globalAlpha = Math.min(1, e.life * 1.6) * 0.3;
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r * 3, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = Math.min(1, e.life * 1.6);
        ctx.beginPath();
        ctx.arc(e.x, e.y, r, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    function frame(now) {
      raf = 0;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
      last = now;
      t += dt;
      if (!dragging) {
        spin += (o.spin - spin) * Math.min(1, dt * 1.5);
        pitchDrag *= Math.exp(-dt * 0.8);
      }
      yaw = (yaw + spin * dt) % TAU;
      pitch = 0.5 + Math.sin(t * 0.23) * 0.35;
      stoke = o.stoke0 + (stoke - o.stoke0) * Math.exp(-dt * 1.4);
      // A steady trickle of embers, more when stoked.
      if (o.embers && Math.random() < dt * (1.5 + stoke * 14)) shed(1 + Math.floor(stoke * 2), false);
      stepEmbers(dt);
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

    function stokeIt() {
      stoke = Math.min(1.6, stoke + 0.85);
      // Two frames of heat before the burst, so there are hot points to shed from.
      draw();
      shed(26 + Math.floor(stoke * 16), true);
      if (still.matches) { draw(); embers.length = 0; stoke = o.stoke0; }
    }

    if (o.interactive) {
      canvas.addEventListener("pointerdown", (e) => {
        dragging = true;
        moved = 0;
        lastX = e.clientX;
        lastY = e.clientY;
        lastT = e.timeStamp;
        canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        const dtm = Math.max(8, e.timeStamp - lastT);
        moved += Math.abs(dx) + Math.abs(dy);
        yaw += dx * 0.012;
        pitchDrag = Math.max(-0.9, Math.min(0.9, pitchDrag + dy * 0.006));
        spin = Math.max(-6, Math.min(6, (dx * 0.012) / (dtm / 1000)));
        lastX = e.clientX;
        lastY = e.clientY;
        lastT = e.timeStamp;
        if (still.matches) draw();
      });
      const release = () => {
        if (!dragging) return;
        dragging = false;
        if (moved < 8) stokeIt();
      };
      canvas.addEventListener("pointerup", release);
      canvas.addEventListener("pointercancel", release);
      canvas.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); stokeIt(); }
        if (e.key === "ArrowLeft") { yaw -= 0.2; if (still.matches) draw(); }
        if (e.key === "ArrowRight") { yaw += 0.2; if (still.matches) draw(); }
      });
    }

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

    if (still.matches) stoke = Math.max(stoke, 0.5); // one warm still frame
    resize();
    schedule();
  }

  document.querySelectorAll("canvas.hearth").forEach(mount);
})();

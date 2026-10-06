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
   turn, tap to stoke) and on every <div data-nts-fragment="embers"> (a small,
   cheap, non-interactive one for the home page). Decorative only. Under
   prefers-reduced-motion it draws one still frame. DPR capped at 2, paused
   off-screen and in hidden tabs. Draws its day palette while the page waits
   for the world to bleed in (html[data-bleed-state="before"]), night after.
   Tuning, by data attribute on the canvas or the fragment:
     data-spacing  px between lines (14; fragments 9)
     data-wave     ripple frequency, rad/px (0.42)
     data-amp      ripple height, in line spacings (0.55)
     data-speed    ripple travel (5)
     data-spin     resting turn, rad/s (0.32)
     data-size     circumradius, as a share of the shorter side (0.6)
     data-cx/cy    centre, as a share of width/height (0.5, 0.5)
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
  const theme = () => (document.documentElement.getAttribute("data-bleed-state") === "before" ? DAY : NIGHT);
  const baseColour = (el) => getComputedStyle(el).getPropertyValue("--hearth-base").trim() || "rgba(229, 29, 71, 0.3)";

  function mount(canvas, host, lite) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const d = host.dataset;
    const num = (k, f) => (d[k] !== undefined && d[k] !== "" ? +d[k] : f);
    const o = {
      spacing: num("spacing", lite ? 9 : 14), wave: num("wave", 0.42), amp: num("amp", lite ? 0.65 : 0.55),
      speed: num("speed", 5), spin: num("spin", lite ? 0.4 : 0.32), size: num("size", lite ? 0.78 : 0.6),
      cx: num("cx", 0.5), cy: num("cy", 0.5), embers: !lite && d.embers !== "off", stoke0: num("stoke", lite ? 0.25 : 0),
      step: lite ? 2.5 : 1.5, fps: lite ? 24 : 60, interactive: !lite && d.interactive !== "off",
    };
    let w = 0, h = 0, dpr = 1, yaw = 0.6, pitch = 0.5, pitchDrag = 0, spin = o.spin;
    let t = 0, stoke = o.stoke0, last = 0, raf = 0, acc = 0, visible = false;
    let dragging = false, lastX = 0, lastY = 0, lastT = 0, moved = 0;
    let pal = theme(), base = baseColour(host);
    const embers = [], hot = [];

    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.round(r.width); h = Math.round(r.height);
      if (!w || !h) return;
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
      const gcx = o.cx * w, gcy = o.cy * h, size = Math.min(w, h) * o.size / Math.sqrt(3);
      const dist = INRADIUS * size;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), p = pitch + pitchDrag, cx = Math.cos(p), sx = Math.sin(p);
      const n = FACES.map((f) => rotate(f, cy, sy, cx, sx));
      const fade = Math.min(12, size * 0.1), heat = Math.min(1.6, stoke);
      const amp = o.spacing * o.amp * (1 + heat * 0.9), spacing = o.spacing, RAMP = pal.ramp;
      if (!lite) {
        const halo = ctx.createRadialGradient(gcx, gcy, 0, gcx, gcy, size * 1.3);
        halo.addColorStop(0, `rgba(${pal.halo[0]}, ${0.12 + heat * 0.16})`);
        halo.addColorStop(0.5, `rgba(${pal.halo[1]}, ${0.06 + heat * 0.08})`);
        halo.addColorStop(1, `rgba(${pal.halo[1]}, 0)`);
        ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h);
      }
      const lines = Math.max(3, Math.floor((h - 8) / spacing)), top = (h - (lines - 1) * spacing) / 2;
      const paths = RAMP.map(() => new Path2D()), basePath = new Path2D(), glow = new Path2D();
      hot.length = 0;
      for (let i = 0; i < lines; i++) {
        const y0 = top + i * spacing, py = y0 - gcy;
        let prev = -2, px = 0, pyy = 0;
        for (let sxp = 0; sxp <= w; sxp += o.step) {
          const qx = sxp - gcx;
          let tIn = -Infinity, tOut = Infinity, face = -1;
          for (let k = 0; k < 4; k++) {
            const nk = n[k], denom = -nk[2], numr = dist - (nk[0] * qx + nk[1] * py + nk[2] * 1e4);
            if (Math.abs(denom) < 1e-6) { if (numr < 0) { tIn = Infinity; break; } continue; }
            const tt = numr / denom;
            if (denom < 0) { if (tt > tIn) { tIn = tt; face = k; } } else if (tt < tOut) tOut = tt;
          }
          let y = y0 + Math.sin(sxp * 0.011 + t * 0.45 + i * 0.9) * 1.3, bucket = -1;
          if (face >= 0 && tIn <= tOut) {
            const pz = 1e4 - tIn, nf = n[face];
            let edge = Infinity;
            for (let k = 0; k < 4; k++) {
              if (k === face) continue;
              const nk = n[k], gap = (dist - (nk[0] * qx + nk[1] * py + nk[2] * pz)) / EDGE_SIN;
              if (gap < edge) edge = gap;
            }
            let e = Math.max(0, Math.min(1, edge / fade)); e = e * (2 - e);
            let a = Math.max(0, Math.min(1, 0.95 - nf[2] * 0.75)); a = a * a * (3 - 2 * a);
            const k = Math.min(1, a * e + heat * 0.45 * e);
            y += Math.sin(sxp * o.wave - t * o.speed + i * 0.7) * amp * k;
            const hk = Math.min(1, k * (0.75 + heat * 0.6) + heat * 0.2 * e);
            bucket = k < 0.03 ? -1 : Math.min(RAMP.length - 1, Math.floor(hk * (RAMP.length - 1) + 0.5));
            if (o.embers && hk > 0.5 && hot.length < 240 && Math.random() < 0.08) hot.push(sxp, y, hk);
          }
          if (prev !== -2) {
            const path = bucket < 0 ? basePath : paths[bucket];
            path.moveTo(px, pyy); path.lineTo(sxp, y);
            if (bucket >= 3 && !lite) { glow.moveTo(px, pyy); glow.lineTo(sxp, y); }
          }
          prev = bucket; px = sxp; pyy = y;
        }
      }
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.lineWidth = 0.9; ctx.strokeStyle = base; ctx.stroke(basePath);
      if (!lite) { ctx.lineWidth = 7; ctx.strokeStyle = `rgba(${pal.glow}, ${0.12 + heat * 0.1})`; ctx.stroke(glow); }
      for (let b = 0; b < RAMP.length; b++) {
        const f = b / (RAMP.length - 1);
        ctx.lineWidth = (lite ? 1 : 1.1) + f * 1.6; ctx.strokeStyle = RAMP[b]; ctx.stroke(paths[b]);
      }
      drawEmbers();
    }
    function shed(count, burst) {
      if (!o.embers || hot.length < 3) return;
      const nn = hot.length / 3;
      for (let i = 0; i < count && embers.length < 220; i++) {
        const j = Math.floor(Math.random() * nn) * 3;
        const speed = burst ? 60 + Math.random() * 140 : 18 + Math.random() * 40;
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * (burst ? 1.6 : 0.7);
        embers.push({ x: hot[j], y: hot[j + 1], vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: 1, decay: burst ? 0.35 + Math.random() * 0.5 : 0.18 + Math.random() * 0.25, r: 0.8 + Math.random() * (burst ? 2.2 : 1.4), ph: Math.random() * TAU });
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
    function drawEmbers() {
      if (!embers.length) return;
      ctx.save(); ctx.globalCompositeOperation = pal.composite;
      for (const e of embers) {
        const c = pal.embers[Math.min(pal.embers.length - 1, Math.floor((1 - e.life) * pal.embers.length))];
        const r = e.r * (0.4 + e.life * 0.8);
        ctx.globalAlpha = Math.min(1, e.life * 1.6) * 0.3; ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(e.x, e.y, r * 3, 0, TAU); ctx.fill();
        ctx.globalAlpha = Math.min(1, e.life * 1.6);
        ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    function frame(now) {
      raf = 0;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
      last = now; t += dt;
      if (!dragging) { spin += (o.spin - spin) * Math.min(1, dt * 1.5); pitchDrag *= Math.exp(-dt * 0.8); }
      yaw = (yaw + spin * dt) % TAU;
      pitch = 0.5 + Math.sin(t * 0.23) * 0.35;
      stoke = o.stoke0 + (stoke - o.stoke0) * Math.exp(-dt * 1.4);
      if (o.embers && Math.random() < dt * (1.5 + stoke * 14)) shed(1 + Math.floor(stoke * 2), false);
      stepEmbers(dt);
      acc += dt;
      if (acc >= 1 / o.fps) { acc = acc % (1 / o.fps); draw(); }
      schedule();
    }
    function schedule() { if (!raf && visible && !document.hidden && !still.matches) raf = requestAnimationFrame(frame); }
    function halt() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }
    function stokeIt() {
      stoke = Math.min(1.6, stoke + 0.85);
      draw(); shed(26 + Math.floor(stoke * 16), true);
      if (still.matches) { draw(); embers.length = 0; stoke = o.stoke0; }
    }
    if (o.interactive) {
      canvas.addEventListener("pointerdown", (e) => { dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const dx = e.clientX - lastX, dy = e.clientY - lastY, dtm = Math.max(8, e.timeStamp - lastT);
        moved += Math.abs(dx) + Math.abs(dy);
        yaw += dx * 0.012; pitchDrag = Math.max(-0.9, Math.min(0.9, pitchDrag + dy * 0.006));
        spin = Math.max(-6, Math.min(6, (dx * 0.012) / (dtm / 1000)));
        lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp;
        if (still.matches) draw();
      });
      const release = () => { if (!dragging) return; dragging = false; if (moved < 8) stokeIt(); };
      canvas.addEventListener("pointerup", release);
      canvas.addEventListener("pointercancel", release);
      canvas.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); stokeIt(); }
        if (e.key === "ArrowLeft") { yaw -= 0.2; if (still.matches) draw(); }
        if (e.key === "ArrowRight") { yaw += 0.2; if (still.matches) draw(); }
      });
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; visible ? schedule() : halt(); }).observe(canvas);
    } else visible = true;
    document.addEventListener("visibilitychange", () => { document.hidden ? halt() : schedule(); });
    still.addEventListener?.("change", () => { halt(); draw(); schedule(); });
    addEventListener("nts:bleed", (e) => { if (e.detail.phase === "start") setTimeout(() => { pal = theme(); base = baseColour(host); draw(); }, e.detail.at(host)); });
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas); else addEventListener("resize", resize);
    if (still.matches) stoke = Math.max(stoke, 0.5);
    resize(); schedule();
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

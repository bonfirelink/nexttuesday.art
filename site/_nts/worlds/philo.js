/* NOT NOT PHILO's entity on canvas. Needs penrose.js loaded first.
   Mounts on every <div class="nts-penrose"> (the page entity: rests closed,
   tilts slowly open on an axis that drifts, closes again; a drag tilts it
   by hand) and on every <div data-nts-fragment="philo"> (small, slower,
   not interactive). The host keeps its still <img>/<svg> for scripts off;
   the canvas is appended and the host gets .is-live. Colours come from the
   host's computed --penrose-ink, --penrose-cut and --penrose-ground, so
   a world bleed-in recolours it as the front reaches it. 30 fps, 15 for the
   fragment; one closed frame under prefers-reduced-motion. */
(() => {
  "use strict";
  const P = window.NTS && window.NTS.penrose;
  if (!P) return;
  const { frame, CLOSED } = P;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  function mount(host, lite) {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const TILT = lite ? 0.55 : 0.72, PERIOD = lite ? 16 : 22, DRIFT = (2 * Math.PI) / 95, FPS = lite ? 15 : 30;
    let w = 0, h = 0, dpr = 1, scale = 1, cx = 0, cy = 0, bbox = null;
    let col = { ink: "#2b2d3e", cut: "#e5174a", ground: "#e6e6e8" };
    function colours() {
      const cs = getComputedStyle(host);
      col = {
        ink: cs.getPropertyValue("--penrose-ink").trim() || col.ink,
        cut: cs.getPropertyValue("--penrose-cut").trim() || col.cut,
        ground: cs.getPropertyValue("--penrose-ground").trim() || col.ground,
      };
    }
    function measure() {
      if (!bbox) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const psi of [0, 1, 2, 3, 4, 5]) for (const theta of [0, TILT, -TILT]) {
          for (const f of frame({ theta, psi, phi: CLOSED.phi })) for (const [x, y] of f.poly) {
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
        bbox = { x0, y0, x1, y1 };
      }
      const rect = host.getBoundingClientRect();
      dpr = Math.min(2, devicePixelRatio || 1);
      w = Math.round(rect.width); h = Math.round(rect.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      const span = Math.max(bbox.x1 - bbox.x0, bbox.y1 - bbox.y0);
      scale = (Math.min(w, h) * (lite ? 0.9 : 0.96)) / span;
      cx = w / 2 - ((bbox.x0 + bbox.x1) / 2) * scale;
      cy = h / 2 + ((bbox.y0 + bbox.y1) / 2) * scale;
    }
    function draw(pose) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "butt";
      for (const f of frame(pose)) {
        ctx.beginPath();
        f.poly.forEach(([x, y], i) => ctx[i ? "lineTo" : "moveTo"](cx + x * scale, cy - y * scale));
        ctx.closePath();
        ctx.fillStyle = col.ground; ctx.fill();
        ctx.save(); ctx.clip();
        ctx.strokeStyle = f.role === "cut" ? col.cut : col.ink;
        ctx.lineWidth = Math.max(0.5, f.width * scale);
        ctx.beginPath();
        for (const [x1, y1, x2, y2] of f.lines) { ctx.moveTo(cx + x1 * scale, cy - y1 * scale); ctx.lineTo(cx + x2 * scale, cy - y2 * scale); }
        ctx.stroke(); ctx.restore();
      }
    }
    let t0 = performance.now(), last = 0, raf = 0, visible = true, hidden = document.hidden;
    const hand = { active: false, x: 0, y: 0, dTheta: 0, dPsi: 0 };
    function pose(now) {
      const t = (now - t0) / 1000, s = Math.sin((2 * Math.PI * t) / PERIOD);
      return { theta: TILT * s * s * s + hand.dTheta, psi: DRIFT * t + hand.dPsi, phi: CLOSED.phi };
    }
    function tick(now) {
      raf = 0;
      if (!visible || hidden) return;
      if (now - last >= 1000 / FPS) { last = now; draw(pose(now)); }
      if (!hand.active) hand.dTheta *= 0.985;
      raf = requestAnimationFrame(tick);
    }
    function start() { if (!raf && visible && !hidden && !reduce.matches) raf = requestAnimationFrame(tick); }
    function redraw() { draw(reduce.matches ? CLOSED : pose(performance.now())); }

    colours(); measure();
    host.classList.add("is-live");
    redraw(); start();
    reduce.addEventListener?.("change", () => { if (reduce.matches) { cancelAnimationFrame(raf); raf = 0; draw(CLOSED); } else start(); });
    /* without IntersectionObserver the host counts as always visible */
    if ("IntersectionObserver" in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) start(); }, { threshold: 0.05 }).observe(host);
    document.addEventListener("visibilitychange", () => { hidden = document.hidden; if (!hidden) start(); });
    addEventListener("nts:bleed", (e) => { if (e.detail.phase === "start") setTimeout(() => { colours(); redraw(); }, e.detail.at(host)); });
    let timer = 0;
    addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(() => { measure(); redraw(); }, 120); });
    if (!lite) {
      host.addEventListener("pointerdown", (e) => { hand.active = true; hand.x = e.clientX; hand.y = e.clientY; host.setPointerCapture(e.pointerId); });
      host.addEventListener("pointermove", (e) => {
        if (!hand.active) return;
        hand.dTheta += (e.clientX - hand.x) / 140; hand.dPsi += (e.clientY - hand.y) / 400;
        hand.x = e.clientX; hand.y = e.clientY;
        if (reduce.matches) draw({ ...CLOSED, theta: hand.dTheta, psi: hand.dPsi });
      });
      const release = () => { hand.active = false; };
      host.addEventListener("pointerup", release);
      host.addEventListener("pointercancel", release);
      host.addEventListener("keydown", (e) => {
        const d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0, v = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
        if (!d && !v) return;
        e.preventDefault();
        hand.dTheta += d * 0.35; hand.dPsi += v * 0.3;
        if (reduce.matches) draw({ ...CLOSED, theta: hand.dTheta, psi: hand.dPsi });
      });
    }
  }
  document.querySelectorAll(".nts-penrose").forEach((h) => mount(h, false));
  document.querySelectorAll("[data-nts-fragment='philo']").forEach((h) => mount(h, true));
})();

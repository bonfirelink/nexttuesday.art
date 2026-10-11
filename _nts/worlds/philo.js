/* NOT NOT PHILO's entity on canvas. Needs penrose.js loaded first.
   Mounts on every <div class="nts-penrose"> (the page entity: rests closed,
   tilts slowly open on an axis that drifts, closes again; a drag tilts it
   by hand) and on every <div data-nts-fragment="philo"> (small, slower,
   not interactive). The host keeps its still <img>/<svg> for scripts off;
   the canvas is appended and the host gets .is-live. Colours come from the
   host's computed --penrose-ink, --penrose-cut and --penrose-ground. While
   a world bleed-in's disc opens, the world's set goes to the canvas's twin
   in the disc's copy (NTS.bleed.twin) and the NTS set stays here, each
   drawn only while some of it is in view. 30 fps, 15 for the
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
    const TILT = lite ? 0.55 : 0.72, PERIOD = lite ? 16 : 22, DRIFT = (2 * Math.PI) / 95, FPS = lite ? 15 : 30, REST = lite ? 0.982 : 0.952;
    let w = 0, h = 0, dpr = 1, scale = 1, cx = 0, cy = 0, reach = 0;
    let col = { ink: "#2b2d3e", cut: "#e5174a", ground: "#e6e6e8" };
    function read(el) {
      const cs = getComputedStyle(el);
      return {
        ink: cs.getPropertyValue("--penrose-ink").trim() || col.ink,
        cut: cs.getPropertyValue("--penrose-cut").trim() || col.cut,
        ground: cs.getPropertyValue("--penrose-ground").trim() || col.ground,
      };
    }
    function colours() { col = read(host); }
    function measure() {
      if (!reach) for (const f of frame(CLOSED)) for (const [x, y] of f.poly) reach = Math.max(reach, Math.abs(x), Math.abs(y));
      /* layout sizes, not getBoundingClientRect: a rect includes the scale
         of a transformed ancestor (the home's windows as they open, an orb
         as it opens), and the drawing is in the canvas's own units */
      dpr = Math.min(2, devicePixelRatio || 1);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      if (twin) { twin.width = canvas.width; twin.height = canvas.height; }
      /* the model's pivot is the closed triangle's centre (penrose.js), so it
         goes on the canvas's centre, which is the host's. The size is set
         from the host (the canvas outgrows it on the page entity) and the
         rest pose, so that the rest pose is as large against its circle as
         the other worlds' figures, which fill theirs (widest side about 1.0
         of the ring, 0.92 of the orb): the rest pose's furthest point sits
         at REST of the host's half-size. A tilted pose reaches further and
         overshoots, as the others do at their circle's edge. */
      const host0 = Math.min(host.clientWidth, host.clientHeight);
      scale = (host0 * REST) / (2 * reach);
      cx = w / 2; cy = h / 2;
    }
    /* while the bleed-in's disc opens: the twin canvas and the world's set */
    let twin = null, tctx = null, night = null;
    function draw(pose) {
      if (!twin) { paint(ctx, col, pose); return; }
      const q = window.NTS.bleed.progress();
      if (q < 1) paint(ctx, col, pose);
      if (q > 0) paint(tctx, night, pose);
    }
    function paint(ctx, col, pose) {
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
    /* the figure's own clock runs only while it animates, so a figure held
       still (off screen, or by NTS.live) resumes from the frame it shows */
    let clock = 0, prev = 0, last = 0, raf = 0, visible = true, hidden = document.hidden, held = false;
    const hand = { active: false, x: 0, y: 0, dTheta: 0, dPsi: 0 };
    function pose() {
      const t = clock, s = Math.sin((2 * Math.PI * t) / PERIOD);
      return { theta: TILT * s * s * s + hand.dTheta, psi: DRIFT * t + hand.dPsi, phi: CLOSED.phi };
    }
    function tick(now) {
      raf = 0;
      if (!visible || hidden || held) return;
      /* a pressed figure holds its pose and only the drag moves it, as in the other worlds */
      if (!hand.active) clock += prev ? Math.min(0.1, (now - prev) / 1000) : 0;
      prev = now;
      if (now - last >= 1000 / FPS) { last = now; draw(pose()); }
      if (!hand.active) hand.dTheta *= 0.985;
      raf = requestAnimationFrame(tick);
    }
    function start() { if (!raf && visible && !hidden && !held && !reduce.matches) { prev = 0; raf = requestAnimationFrame(tick); } }
    function redraw() { draw(reduce.matches ? CLOSED : pose()); }

    /* in an aperture (the home's windows), NTS.live says when it may animate */
    held = !(window.NTS && window.NTS.live ? window.NTS.live.join(host, (on) => { held = !on; if (on) start(); }) : true);
    colours(); measure();
    host.classList.add("is-live");
    redraw(); start();
    reduce.addEventListener?.("change", () => { if (reduce.matches) { cancelAnimationFrame(raf); raf = 0; draw(CLOSED); } else start(); });
    /* without IntersectionObserver the host counts as always visible */
    if ("IntersectionObserver" in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) start(); }, { threshold: 0.05 }).observe(host);
    document.addEventListener("visibilitychange", () => { hidden = document.hidden; if (!hidden) start(); });
    addEventListener("nts:bleed", (e) => {
      const B = window.NTS && window.NTS.bleed;
      if (e.detail.phase === "start") {
        const th = B && B.twin(host), tc = B && B.twin(canvas);
        if (!th || !tc) return;
        twin = tc; tctx = twin.getContext("2d"); night = read(th);
        twin.width = canvas.width; twin.height = canvas.height;
        redraw();
      } else if (e.detail.phase === "end") { twin = tctx = night = null; colours(); redraw(); }
    });
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

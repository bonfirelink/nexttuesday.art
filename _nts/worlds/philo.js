/* NOT NOT PHILO's entity on canvas. Needs cubes.js loaded first.
   Mounts on every <div class="nts-penrose"> (the page entity: the nine
   cubes go round, seen straight on; a drag, pressed on the figure, or the
   arrow keys turn it to show the screw, and it settles back) and on every
   <div data-nts-fragment="philo"> (small, slower,
   not interactive). The host keeps its still <img>/<svg> for scripts off;
   the canvas is appended and the host gets .is-live. Colours come from the
   host's computed --penrose-ink, --penrose-cut and --penrose-ground. While
   a world bleed-in's disc opens, the world's set goes to the canvas's twin
   in the disc's copy (NTS.bleed.twin) and the NTS set stays here, each
   drawn only while some of it is in view. 30 fps, 15 for the
   fragment; one closed frame under prefers-reduced-motion. */
(() => {
  "use strict";
  const B = window.NTS && window.NTS.cubes, G = window.NTS && window.NTS.grab;
  if (!B || !G) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  function mount(host, lite) {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const FPS = lite ? 15 : 30, REST = lite ? B.REST.fragment : B.REST.page;
    let w = 0, h = 0, dpr = 1, scale = 1, cx = 0, cy = 0;
    let col = { ink: "#2b2d3e", cut: "#e81e4c", ground: "#e6e6e8" };
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
      /* layout sizes, not getBoundingClientRect: a rect includes the scale
         of a transformed ancestor (the home's windows as they open, an orb
         as it opens), and the drawing is in the canvas's own units */
      dpr = Math.min(2, devicePixelRatio || 1);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      if (twin) { twin.width = canvas.width; twin.height = canvas.height; }
      /* the model's pivot is the closed triangle's centre (cubes.js), so it
         goes on the canvas's centre, which is the host's. The size is set
         from the host (the canvas outgrows it on the page entity) and the
         rest pose, so that the rest pose is as large against its circle as
         the other worlds' figures, which fill theirs (widest side about 1.0
         of the ring, 0.92 of the orb): the rest pose's furthest point sits
         at REST of the host's half-size. A tilted pose reaches further and
         overshoots, as the others do at their circle's edge. */
      const host0 = Math.min(host.clientWidth, host.clientHeight);
      scale = (host0 * REST) / (2 * B.REACH);
      cx = w / 2; cy = h / 2;
    }
    /* while the bleed-in's disc opens: the twin canvas and the world's set */
    let twin = null, tctx = null, night = null;
    /* what the last frame showed: the motion's phase (whole while the cubes
       rest) and the turn; a frame that would show the same is skipped */
    let drawn = "";
    const shows = (pose) => `${B.phase(pose.t)} ${pose.yaw} ${pose.pitch}`;
    function draw(pose) {
      drawn = shows(pose);
      if (!twin) { paint(ctx, col, pose); return; }
      const q = window.NTS.bleed.progress();
      if (q < 1) paint(ctx, col, pose);
      if (q > 0) paint(tctx, night, pose);
    }
    /* the pieces last drawn, in model units: what a press is tested against */
    let shown = [];
    function paint(ctx, col, pose) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      shown = B.paint(ctx, col, pose.t, pose.yaw, pose.pitch, cx, cy, scale);
    }
    /* the figure's own clock runs only while it animates, so a figure held
       still (off screen, or by NTS.live) resumes from the frame it shows */
    let clock = 0, prev = 0, last = 0, raf = 0, visible = true, hidden = document.hidden, held = false;
    const hand = { active: false, x: 0, y: 0, yaw: 0, pitch: 0, released: -1e9 };
    function pose() { return { t: clock, yaw: hand.yaw, pitch: hand.pitch }; }
    function tick(now) {
      raf = 0;
      if (!visible || hidden || held) return;
      /* a pressed figure holds its pose and only the drag moves it, as in the other worlds */
      const dt = prev ? Math.min(0.1, (now - prev) / 1000) : 0;
      if (!hand.active) clock += dt;
      prev = now;
      /* the bleed-in's twin changes under the figure, so it is drawn every frame */
      if (now - last >= 1000 / FPS) { last = now; const p = pose(); if (twin || shows(p) !== drawn) draw(p); }
      /* a turned figure settles back to the straight view, 0.7 s to 1/e */
      if (!hand.active && now - hand.released > 1200 && (hand.yaw || hand.pitch)) {
        const k = Math.exp(-dt / 0.7);
        hand.yaw *= k; hand.pitch *= k;
        /* 2e-3 rad is under half a pixel at the figure's reach */
        if (Math.abs(hand.yaw) < 2e-3 && Math.abs(hand.pitch) < 2e-3) hand.yaw = hand.pitch = 0;
      }
      raf = requestAnimationFrame(tick);
    }
    /* a stopped figure's canvas may have been discarded (a hidden tab, memory
       pressure), so the first frame after a start always paints */
    function start() { if (!raf && visible && !hidden && !held && !reduce.matches) { prev = 0; drawn = ""; raf = requestAnimationFrame(tick); } }
    function redraw() { draw(reduce.matches ? { t: 0, yaw: hand.yaw, pitch: hand.pitch } : pose()); }

    /* in an aperture (the home's windows), NTS.live says when it may animate */
    held = !(window.NTS && window.NTS.live ? window.NTS.live.join(host, (on) => { held = !on; if (on) start(); }) : true);
    colours(); measure();
    host.classList.add("is-live");
    redraw(); start();
    reduce.addEventListener?.("change", () => { if (reduce.matches) { cancelAnimationFrame(raf); raf = 0; hand.yaw = hand.pitch = 0; draw({ t: 0, yaw: 0, pitch: 0 }); } else start(); });
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
    /* on the figure: inside one of its drawn pieces or within the slack of
       its edge, tested in model units (no per-frame work) */
    function onFigure(px, py) {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !scale) return false;
      const k = w / r.width, x = ((px - r.left) * k - cx) / scale, y = (cy - (py - r.top) * k) / scale;
      for (const f of shown) if (G.near(f.poly, x, y, (G.SLACK * k) / scale)) return true;
      return false;
    }
    if (!lite) {
      const grab = G.watch(host, onFigure);
      host.addEventListener("pointerdown", (e) => { if (!grab.down(e)) return; hand.active = true; hand.x = e.clientX; hand.y = e.clientY; host.setPointerCapture(e.pointerId); });
      host.addEventListener("pointermove", (e) => {
        if (!hand.active) return;
        hand.yaw += (e.clientX - hand.x) * 0.011; hand.pitch += (e.clientY - hand.y) * 0.011;
        hand.x = e.clientX; hand.y = e.clientY;
        if (reduce.matches) redraw();
      });
      const release = () => { hand.active = false; hand.released = performance.now(); grab.up(); };
      host.addEventListener("pointerup", release);
      host.addEventListener("pointercancel", release);
      host.addEventListener("keydown", (e) => {
        const d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0, v = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
        if (!d && !v) return;
        e.preventDefault();
        hand.yaw += d * 0.15; hand.pitch += v * 0.15; hand.released = performance.now(); if (!raf) redraw();
      });
    }
  }
  document.querySelectorAll(".nts-penrose").forEach((h) => mount(h, false));
  document.querySelectorAll("[data-nts-fragment='philo']").forEach((h) => mount(h, true));
})();

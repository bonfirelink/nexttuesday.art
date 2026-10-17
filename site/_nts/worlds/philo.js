/* NOT NOT PHILO's entity on canvas. Needs cubes.js loaded first.
   Mounts on every <div class="nts-penrose"> (the page entity: the nine
   cubes go round, seen straight on; a drag, pressed on the figure, turns it
   like a wheel to show the screw and it stays on the pose it is let go on,
   a tap flips it between poses; the cubes keep moving meanwhile)
   and on every <div data-nts-fragment="philo"> (small, slower, not
   interactive). The host keeps its still <img>/<svg> for scripts off;
   the canvas is appended and the host gets .is-live. Colours come from the
   host's computed --penrose-top, -side, -dark and -ground. While
   a world bleed-in's disc opens, the world's set goes to the canvas's twin
   in the disc's copy (NTS.bleed.twin) and the NTS set stays here, each
   drawn only while some of it is in view. 30 fps, the fragment
   too; one closed frame under prefers-reduced-motion. */
(() => {
  "use strict";
  const B = window.NTS && window.NTS.cubes, G = window.NTS && window.NTS.grab;
  if (!B || !G) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  /* The first glide comes FIRST_GLIDE_IN s after the figure goes live, not
     after a whole rest: about when a page transition into it has ended. The
     clock starts that far before the glide, still in the rest, so the first
     frame is the rest pose as the stills draw it. */
  const FIRST_GLIDE_IN = 0.5;

  function mount(host, lite) {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const FPS = 30, REST = lite ? B.REST.fragment : B.REST.page;
    let w = 0, h = 0, dpr = 1, scale = 1, cx = 0, cy = 0;
    /* the fallback tones are the PHILO world's tones in philo.css; tests/static/philo-tokens.spec.mjs keeps them in step */
    let col = { top: "#f5f5f7", side: "#a6a7b2", dark: "#53566b", ground: "#e6e6e8" };
    function read(el) {
      const cs = getComputedStyle(el);
      return {
        top: cs.getPropertyValue("--penrose-top").trim() || col.top,
        side: cs.getPropertyValue("--penrose-side").trim() || col.side,
        dark: cs.getPropertyValue("--penrose-dark").trim() || col.dark,
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
      /* the model's pivot is the closed picture's centre (cubes.js), so it
         goes on the canvas's centre, which is the host's. The size is set
         from the host (the canvas outgrows it on the page entity) and the
         rest pose, so that the rest pose is as large against its circle as
         the other worlds' figures, which fill theirs (widest side about 1.0
         of the ring, 0.92 of the orb): the rest pose's furthest point sits
         at REST of the host's half-size. A turned pose reaches further and
         overshoots, as the others do at their circle's edge. */
      const host0 = Math.min(host.clientWidth, host.clientHeight);
      scale = (host0 * REST) / (2 * B.REACH);
      cx = w / 2; cy = h / 2;
    }
    /* while the bleed-in's disc opens: the twin canvas and the world's set */
    let twin = null, tctx = null, night = null;
    /* the bleed-in's twin host: cloned while straight, it follows host's .is-turned */
    let twinHost = null;
    /* what the last frame showed: the motion's phase (whole while the cubes
       rest) and the turn; a frame that would show the same is skipped */
    let drawn = "";
    const shows = (pose) => `${B.phase(pose.t)} ${pose.yaw} ${pose.pitch}`;
    /* .is-turned is on while the pose is off the straight view (see philo.css);
       toggled only when that changes */
    let turned = false;
    function markTurned(off) { turned = off; host.classList.toggle("is-turned", off); if (twinHost) twinHost.classList.toggle("is-turned", off); }
    function draw(pose) {
      drawn = shows(pose);
      const off = pose.yaw !== 0;
      if (off !== turned) markTurned(off);
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
    let clock = B.TICK - B.GLIDE - FIRST_GLIDE_IN, prev = 0, last = 0, raf = 0, visible = true, hidden = document.hidden, held = false;
    /* The turn is one number, the yaw u (rad); the pitch follows it (cubes.js).
       raw is where the hand has taken u, shown that with the soft edge. After a
       release u runs to the pose chosen (aim), a critically damped spring. */
    const T = B.turn;
    const hand = { active: false, x: 0, y: 0, mx: 0, my: 0, raw: 0, u: 0, v: 0, aim: null, from: 0, travel: 0, px: 0, py: 0 };
    function pose() { return { t: clock, yaw: hand.u, pitch: T.pitchAt(hand.u) }; }
    const OMEGA = 13;
    function spring(dt) {
      const to = T.POSES[hand.aim][0];
      for (let left = dt; left > 0; left -= 1 / 120) {
        const h = Math.min(left, 1 / 120);
        hand.v += (-OMEGA * OMEGA * (hand.u - to) - 2 * OMEGA * hand.v) * h;
        hand.u += hand.v * h;
      }
      /* 2e-3 rad is under half a pixel at the figure's reach */
      if (Math.abs(hand.u - to) < 2e-3 && Math.abs(hand.v) < 5e-3) { hand.u = to; hand.v = 0; hand.aim = null; }
      hand.raw = hand.u;
    }
    function tick(now) {
      raf = 0;
      if (!visible || hidden || held) return;
      const dt = prev ? Math.min(0.1, (now - prev) / 1000) : 0;
      clock += dt;
      prev = now;
      /* the bleed-in's twin changes under the figure, so it is drawn every frame; a frame's
         timestamp jitters by a few ms, and without the slack a draw due at 33.3 ms slips a whole frame */
      if (now - last >= 1000 / FPS - 3) { last = now; const p = pose(); if (twin || shows(p) !== drawn) draw(p); }
      if (hand.aim !== null) spring(dt);
      raf = requestAnimationFrame(tick);
    }
    /* a stopped figure's canvas may have been discarded (a hidden tab, memory
       pressure), so the first frame after a start always paints */
    function start() { if (!raf && visible && !hidden && !held && !reduce.matches) { prev = 0; drawn = ""; raf = requestAnimationFrame(tick); } }
    function redraw() { draw(reduce.matches ? { ...pose(), t: 0 } : pose()); }

    /* in an aperture (the home's windows), NTS.live says when it may animate */
    held = !(window.NTS && window.NTS.live ? window.NTS.live.join(host, (on) => { held = !on; if (on) start(); }) : true);
    colours(); measure();
    host.classList.add("is-live");
    redraw(); start();
    reduce.addEventListener?.("change", () => { if (reduce.matches) { cancelAnimationFrame(raf); raf = 0; hand.u = hand.raw = hand.v = 0; hand.aim = null; draw({ t: 0, yaw: 0, pitch: 0 }); } else start(); });
    /* without IntersectionObserver the host counts as always visible */
    if ("IntersectionObserver" in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) start(); }, { threshold: 0.05 }).observe(host);
    document.addEventListener("visibilitychange", () => { hidden = document.hidden; if (!hidden) start(); });
    addEventListener("nts:bleed", (e) => {
      const B = window.NTS && window.NTS.bleed;
      if (e.detail.phase === "start") {
        const th = B && B.twin(host), tc = B && B.twin(canvas);
        if (!th || !tc) return;
        twinHost = th;
        twin = tc; tctx = twin.getContext("2d"); night = read(th);
        twin.width = canvas.width; twin.height = canvas.height;
        redraw();
      } else if (e.detail.phase === "end") { twin = tctx = night = twinHost = null; colours(); redraw(); }
    });
    let timer = 0;
    addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(() => { measure(); redraw(); }, 120); });
    /* a point in model units about the figure's centre, y up, from the canvas's box */
    const toModel = (r, px, py) => { const k = w / r.width; return [((px - r.left) * k - cx) / scale, (cy - (py - r.top) * k) / scale]; };
    /* on the figure: inside one of its drawn pieces or within the slack of
       its edge, tested in model units (no per-frame work) */
    function onFigure(px, py) {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !scale) return false;
      const [x, y] = toModel(r, px, py);
      for (const f of shown) if (G.near(f.poly, x, y, (G.SLACK * w) / r.width / scale)) return true;
      return false;
    }
    /* a gesture turns u like a wheel: the part of each move along the circle
       round the figure's centre (the pivot, in client px, read once at the press) */
    function turnBy(dx, dy) {
      hand.travel += Math.hypot(dx, dy);
      hand.raw += T.wheel([hand.x - hand.mx, hand.y - hand.my], [dx, dy]);
      hand.u = T.soften(hand.raw);
      if (reduce.matches) redraw();
    }
    function letGo(cancelled) {
      hand.active = false;
      /* under 6 px of travel is a tap: from a turned pose back to straight, from straight to the pose
         the tap's place picks; a longer drag lands by how far it went */
      const here = T.landing(hand.from, hand.from);
      const to = hand.travel < 6 && !cancelled ? (here !== 1 ? 1 : T.tapPose(hand.px, hand.py)) : T.landing(hand.from, hand.u);
      hand.raw = hand.u; hand.v = 0; hand.aim = to;
      if (reduce.matches) { hand.u = hand.raw = T.POSES[to][0]; hand.aim = null; redraw(); }
    }
    if (!lite) {
      const grab = G.watch(host, onFigure);
      host.addEventListener("pointerdown", (e) => {
        if (!grab.down(e)) return;
        const r = canvas.getBoundingClientRect();
        hand.active = true; hand.aim = null; hand.v = 0; hand.raw = hand.u; hand.from = hand.u; hand.travel = 0;
        hand.x = e.clientX; hand.y = e.clientY; hand.mx = r.left + r.width / 2; hand.my = r.top + r.height / 2;
        [hand.px, hand.py] = toModel(r, e.clientX, e.clientY);
        host.setPointerCapture(e.pointerId);
      });
      /* The wheel turns by vertical motion too, which the page would take for a scroll. A touch that
         starts on the figure is cancelled here so the page doesn't pan for it (the pointer events go
         on); one that starts elsewhere in the box still scrolls. touch-action can't say this: it is
         fixed per element, not per pixel. */
      host.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1 && onFigure(e.touches[0].clientX, e.touches[0].clientY)) e.preventDefault();
      }, { passive: false });
      host.addEventListener("pointermove", (e) => {
        if (!hand.active) return;
        turnBy(e.clientX - hand.x, e.clientY - hand.y);
        hand.x = e.clientX; hand.y = e.clientY;
      });
      const release = (cancelled) => { if (hand.active) letGo(cancelled); grab.up(); };
      host.addEventListener("pointerup", () => release(false));
      /* a cancelled touch is no tap: it lands by how far it went */
      host.addEventListener("pointercancel", () => release(true));
    }
  }
  document.querySelectorAll(".nts-penrose").forEach((h) => mount(h, false));
  document.querySelectorAll("[data-nts-fragment='philo']").forEach((h) => mount(h, true));
})();

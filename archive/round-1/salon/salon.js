/* The home page's entity: the impossible object, engraved live on a canvas.
   It rests closed, tilts slowly open on an axis that drifts round the
   screen, and closes again. A drag turns it by hand. Without JavaScript the
   page shows entity.svg, the same drawing at the closed pose; with
   prefers-reduced-motion the canvas draws that one frame and stops. */
import { frame, CLOSED } from '/archive/round-1/salon/entity.js';

const host = document.querySelector('.entity');
if (host) {
  const canvas = host.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const INK = '#2b2d3e', CUT = '#e5174a', GROUND = '#e6e6e8';
  const TILT = 0.72;          // radians, how far it opens
  const PERIOD = 22;          // seconds, closed to open to closed
  const DRIFT = 2 * Math.PI / 95; // the tilt axis turns once in 95 s

  let w = 0, h = 0, dpr = 1, scale = 1, cx = 0, cy = 0;
  let bbox = null;

  function measure() {
    // Fit the closed figure, with room for the open poses.
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
    scale = (Math.min(w, h) * 0.96) / span;
    cx = w / 2 - ((bbox.x0 + bbox.x1) / 2) * scale;
    cy = h / 2 + ((bbox.y0 + bbox.y1) / 2) * scale;
  }

  function draw(pose) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'butt';
    for (const f of frame(pose)) {
      ctx.beginPath();
      f.poly.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](cx + x * scale, cy - y * scale));
      ctx.closePath();
      ctx.fillStyle = GROUND;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = f.role === 'cut' ? CUT : INK;
      ctx.lineWidth = Math.max(0.5, f.width * scale);
      ctx.beginPath();
      for (const [x1, y1, x2, y2] of f.lines) {
        ctx.moveTo(cx + x1 * scale, cy - y1 * scale);
        ctx.lineTo(cx + x2 * scale, cy - y2 * scale);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // Motion: theta = TILT * sin^3, which dwells closed and swings open.
  let t0 = performance.now(), last = 0, raf = 0, visible = true, hidden = document.hidden;
  let hand = { active: false, x: 0, y: 0, dTheta: 0, dPsi: 0 };
  function pose(now) {
    const t = (now - t0) / 1000;
    const s = Math.sin((2 * Math.PI * t) / PERIOD);
    return { theta: TILT * s * s * s + hand.dTheta, psi: DRIFT * t + hand.dPsi, phi: CLOSED.phi };
  }
  function tick(now) {
    raf = 0;
    if (!visible || hidden) return;
    if (now - last >= 1000 / 30) { last = now; draw(pose(now)); }
    if (!hand.active) hand.dTheta *= 0.985;
    raf = requestAnimationFrame(tick);
  }
  function start() { if (!raf && visible && !hidden && !reduce.matches) raf = requestAnimationFrame(tick); }

  measure();
  host.dataset.live = '';
  if (reduce.matches) {
    draw(CLOSED);
  } else {
    draw(pose(performance.now()));
    start();
  }
  reduce.addEventListener('change', () => { if (reduce.matches) { cancelAnimationFrame(raf); raf = 0; draw(CLOSED); } else start(); });

  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) start();
  }, { threshold: 0.05 }).observe(host);
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; if (!hidden) start(); });

  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { measure(); draw(reduce.matches ? CLOSED : pose(performance.now())); }, 120);
  });

  // By hand: a horizontal drag tilts it; let go and it settles back.
  host.addEventListener('pointerdown', (e) => {
    hand.active = true; hand.x = e.clientX; hand.y = e.clientY;
    host.setPointerCapture(e.pointerId);
  });
  host.addEventListener('pointermove', (e) => {
    if (!hand.active) return;
    hand.dTheta += (e.clientX - hand.x) / 140;
    hand.dPsi += (e.clientY - hand.y) / 400;
    hand.x = e.clientX; hand.y = e.clientY;
    if (reduce.matches) draw({ ...CLOSED, theta: hand.dTheta, psi: hand.dPsi });
  });
  const release = () => { hand.active = false; };
  host.addEventListener('pointerup', release);
  host.addEventListener('pointercancel', release);
}

/* III · Frequency: the seams' wave paths, and the bleed as a line screen.
   Runs deferred, after nts.js. Each <div class="seam" data-line="…"> gets
   an inline SVG of fine lines (one path per line, its own envelope in
   --env); signal.css flattens or swells them with --sig, which the scroll
   drives. The lines travel only while the seam is near the screen.
   The bleed form: the world's ground comes in as horizontal lines that
   thicken from the top down until they merge, the same ramp as the seams.
   Decorative only: the page is complete without it. */
(() => {
  "use strict";
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const W = 1000, L = 250; // viewBox width, wavelength (travel moves one L)

  /* the bleed form: a front that sweeps down with a line-screen edge. N
     stripes; stripe i fills from its top over a span of T in progress,
     starting at i/N of the remaining run, so about T*N stripes are
     thickening at any moment (the seams' ramp, moving). T is kept short so
     the warp that jumps text blocks across keeps enough open ground. */
  const N = 24, T = 0.07;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const fillAt = (p, i) => clamp((p - (i / N) * (1 - T)) / T);
  window.NTS = window.NTS || {};
  NTS.bleed = NTS.bleed || {};
  NTS.bleed.form = {
    clip(p) {
      const pts = [];
      for (let i = 0; i < N; i++) {
        const f = fillAt(p, i);
        if (f <= 0) continue;
        const y0 = ((i / N) * 100).toFixed(3), y1 = ((i / N + f / N) * 100).toFixed(3);
        pts.push(`0 ${y0}%`, `100% ${y0}%`, `100% ${y1}%`, `0 ${y1}%`);
      }
      return pts.length ? `polygon(${pts.join(",")})` : "inset(0 0 100% 0)";
    },
    cover(b, w, h) {
      const i0 = Math.max(0, Math.min(N - 1, Math.floor((b.y0 / h) * N)));
      const i1 = Math.max(0, Math.min(N - 1, Math.floor(((b.y1 - 0.01) / h) * N)));
      const f0 = clamp((b.y0 - (i0 / N) * h) / (h / N));
      return [(i0 / N) * (1 - T) + f0 * T, (i1 / N) * (1 - T) + T];
    }
  };

  /* the lines of each world */
  const LINE = {
    nts: { n: 11, amp: 0.5, shape: "sine", dash: true },
    embers: { n: 13, amp: 0.5, shape: "sine", hot: 2 },
    philo: { n: 15, amp: 5, shape: "arc", dasharray: "9 4" },
    intersect: { n: 15, amp: 0.3, shape: "sine", dasharray: ["2 2.7", "1 3.3", "5 2.1", "3 3.9", "1 2 4 2.6", "6 1.7"] }
  };
  const fmt = (v) => (Math.round(v * 10) / 10).toString();
  function wave(base, A, phase, shape) {
    if (shape === "arc") return `M${-L} ${fmt(base)}Q${W / 2} ${fmt(base - 2 * A)} ${W + L} ${fmt(base)}`;
    if (shape === "step") {
      // a stepped row, two pulses per wavelength, the pulse widths uneven
      // so the rows read as characters rather than a grid
      let d = `M${-L} ${fmt(base + A)}`, up = false;
      const run = [L * 0.14, L * 0.22, L * 0.1, L * 0.3, L * 0.08, L * 0.16];
      for (let x = -L, k = 0; x < W + L; x += run[k++ % run.length]) {
        up = !up;
        d += `H${fmt(x)}V${fmt(up ? base - A : base + A)}`;
      }
      return d + `H${W + L}`;
    }
    const pts = [];
    for (let x = -L; x <= W + L; x += 12.5) pts.push(`${x} ${fmt(base + A * Math.sin((2 * Math.PI * x) / L + phase))}`);
    return "M" + pts.join("L");
  }
  function build(seam) {
    const kind = seam.getAttribute("data-line") || "nts";
    const o = LINE[kind] || LINE.nts;
    const thin = seam.classList.contains("thin");
    const n = thin ? Math.max(5, Math.round(o.n * 0.6)) : o.n;
    const pitch = 10, H = n * pitch, A = o.amp * pitch;
    const home = document.body.hasAttribute("data-nts-home");
    const out = seam.classList.contains("out");
    if (!thin && !seam.querySelector(".ground")) seam.insertAdjacentHTML("afterbegin", '<i class="ground"></i>');
    let d = "";
    for (let i = 0; i < n; i++) {
      const base = pitch * (i + 0.5);
      const env = 0.2 + 0.8 * Math.sin((Math.PI * (i + 0.5)) / n);
      const cls = [];
      // the home's dashes: the orbit's dash on the paper side of the seam
      if (home && o.dash === undefined && !thin && (out ? i >= n / 2 : i < n / 2)) cls.push("dash");
      if (o.dash) cls.push("dash");
      if (o.hot && Math.abs(i - (n - 1) / 2) < o.hot / 2 + 0.01) cls.push("hot");
      d += `<path class="${cls.join(" ")}" style="--env:${env.toFixed(3)}"${o.dasharray ? ` stroke-dasharray="${Array.isArray(o.dasharray) ? o.dasharray[i % o.dasharray.length] : o.dasharray}" stroke-dashoffset="${fmt(i * 7.3)}"` : ""} d="${wave(base, A, i * 0.9, o.shape)}"/>`;
    }
    seam.insertAdjacentHTML("beforeend", `<svg class="signal" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><g>${d}</g></svg>`);
    seam.classList.add("is-live");
  }
  const seams = document.querySelectorAll(".seam");
  seams.forEach(build);
  if (!still.matches && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle("is-near", e.isIntersecting)), { rootMargin: "20% 0px" });
    seams.forEach((s) => io.observe(s));
  }
  document.addEventListener("visibilitychange", () => {
    seams.forEach((s) => s.classList.toggle("is-hidden", document.hidden));
  });
})();

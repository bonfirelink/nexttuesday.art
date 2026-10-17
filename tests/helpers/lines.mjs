// The on-screen width, in CSS px, of every line of the home emblem and of the
// beads: an SVG stroke is its computed stroke-width times the scale of its
// screen CTM (rotation taken out); the beam is read at its full size (it
// rests scaled down); CSS rings are their border width. Sigils are read from
// the sprite's symbol, whose stroke every <use> clone inherits.
export const measureLines = (page) =>
  page.evaluate(() => {
    const q = (s) => {
      const el = document.querySelector(s);
      if (!el) throw new Error(`no ${s}`);
      return el;
    };
    const sw = (el) => parseFloat(getComputedStyle(el).strokeWidth);
    const ctm = (el) => { const m = el.getScreenCTM(); return Math.hypot(m.a, m.b); };
    const stroke = (s) => { const el = q(s); return sw(el) * ctm(el); };
    // a keyline is the ink between two rings: the key ring's inner edge to the first band's
    const inner = (c) => c.r.baseVal.value - sw(c) / 2;
    const beam = q(".e-bm.run .e-beam"), beamC = beam.querySelector("circle");
    // a <use> clone takes the symbol's own width if it sets one, else inherits the <use>'s
    const sigil = (bead) => {
      const svg = q(`.orrery .bead[data-body="${bead}"] .nts-sigil`), use = svg.querySelector("use"), sym = q(use.getAttribute("href"));
      const own = sym.getAttribute("stroke-width") || sym.style.strokeWidth;
      return ((own ? parseFloat(own) : sw(use)) * svg.getBoundingClientRect().width) / 64;
    };
    return {
      north: stroke(".e-north path"),
      keyline: (inner(q(".e-bands circle:not(.k-dot)")) - inner(q(".e-key circle"))) * ctm(q(".e-key circle")),
      outline: stroke(".e-tet.run path.k-run"),
      outlineEdge: stroke(".e-tet.run path.k-stop"),
      eye: stroke(".e-tet.run circle.eye"),
      seam: stroke(".e-tet.run path:not([class])"),
      ringDots: stroke(".e-ring circle"),
      rays: stroke(".e-rays"),
      beam: (sw(beamC) * beam.offsetWidth) / 20,
      orbit66: stroke(".e-o66 > svg circle"),
      orbit78: stroke(".e-o78 > svg circle"),
      orbit84: stroke(".e-o84 > svg circle"),
      orbit96: stroke(".e-o96 > svg circle"),
      halo: stroke(".st .halo"),
      dot: stroke(".st circle:not(.hit):not(.halo)"),
      // the chalk's passes: main, mid, fine
      chalk: stroke(".he svg .chalk"),
      chalkMid: stroke(".he svg .chalk-mid"),
      chalkFine: stroke(".he svg .chalk-fine"),
      pulse: parseFloat(getComputedStyle(q(".e-pulse")).borderTopWidth),
      sigilEmbers: sigil("embers"),
      sigilPhilo: sigil("philo"),
      sigilIntersect: sigil("intersect"),
      starBead: stroke('.bead[data-body="star"] .nts-sigil path'),
      hint: parseFloat(getComputedStyle(q(".orrery .o-embers .bead"), "::after").borderTopWidth),
      emblem: q(".orrery").getBoundingClientRect().width,
      bead: q(".orrery .o-embers .bead").getBoundingClientRect().width,
    };
  });

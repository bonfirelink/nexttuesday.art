// O1 every bead is one component (.bead-face), the same in every place;
// O2 every world defines the depth pair the discs, orbs and lifts read;
// O3 the home's three orbs are one portal: opening one moves and fades its
// layers (transform, opacity) and nothing else, the same parts on every
// world, and the orb itself never rises; O4 under reduced motion the
// portal still opens, by fading alone; O5 at rest the window a world's
// figure shows through is as wide as it was before the lid: the lid rides a
// ring outside it; O6 at rest the figure is exactly as on a plain disc: no
// transform and no clip but the disc's own round edge, so a live figure
// costs no more to composite than before the lid.
import { test, expect } from "../helpers/fixtures.mjs";
import { VIEWPORTS, open } from "../helpers/behaviour.mjs";

// The resting window's diameter in CSS px per viewport width: the whole disc,
// as it was before the orbs had a lid. Measured inside the limb that rims it.
const RESTING_WINDOW = { 390: 239, 1440: 352 };
const WINDOW_TOL = 1; // px
const EDGE_DIFF = 30; // summed RGB difference from the bare ground that marks the limb
const LIMB_OUTSIDE = 0.5; // px the window's limb reaches past the window's edge
const GROUND_AT = 5; // px outside the window where the scan starts, on the bare ground before the orbit

const WORLDS = [
  { body: "embers", path: "/embers/" },
  { body: "philo", path: "/not-not-philo/" },
  { body: "intersect", path: "/intersect/" },
];

// The look of a bead: its face, edge and sigil; the moat's colour is the
// ground it sits on, which differs, so only its shape is compared; the face is
// compared apart, since it is lifted on the world's own ground.
const bead = (s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const cs = getComputedStyle(el), sig = el.querySelector(".nts-sigil");
  const shape = (v) => v.replace(/(rgba?|color)\([^)]*\)/g, "C");
  // a colour at 8 bits, however it computed (rgb(), or color(srgb …) from a color-mix())
  const rgb8 = (c) => { const x = new OffscreenCanvas(1, 1).getContext("2d"); x.fillStyle = c; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return `rgb(${d[0]}, ${d[1]}, ${d[2]})`; };
  const sc = getComputedStyle(sig);
  return {
    image: shape(cs.backgroundImage), face: rgb8(cs.backgroundImage.match(/(rgba?|color)\([^)]*\)/)[0]), background: cs.backgroundColor, radius: cs.borderTopLeftRadius,
    bg: (() => { const sec = el.closest(".ecl"); if (!sec) return null; const q = document.createElement("i"); q.style.backgroundColor = "var(--ecl-bg)"; sec.appendChild(q); const c = rgb8(getComputedStyle(q).backgroundColor); q.remove(); return c; })(),
    border: cs.borderTopWidth, moat: shape(cs.boxShadow), sigil: sc.color,
    ratio: Math.round((sig.getBoundingClientRect().width / el.getBoundingClientRect().width) * 100) / 100,
  };
};

// The fixed colours of each world's bead, whatever the page's ground.
const FACE = { embers: "rgb(11, 7, 9)", philo: "rgb(230, 230, 232)", intersect: "rgb(10, 10, 10)" };
const TEXT = { embers: "#ffe9d0", philo: "#2b2d3e", intersect: "#e9e2cf" }; // the world's own text colour
const SIGIL = { embers: "rgb(229, 29, 71)", philo: "rgb(229, 23, 74)", intersect: "rgb(233, 226, 207)" };
const BAND = { embers: ".embers-summon .ecl-ring", philo: ".philo-volumes .ecl-ring", intersect: ".intersect-corr .ecl-ring" };

for (const { body, path } of WORLDS) {
  test(`O1 the ${body} bead is one build in every place: emblem, window, hero (night and before), events, band`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => { try { sessionStorage.removeItem("nts:from"); } catch {} });
    await open(page, "/");
    const emblem = await page.evaluate(bead, `.bead[data-body="${body}"] .bead-face[data-of="${body}"]`);
    expect(emblem, "the emblem bead is a .bead-face").not.toBeNull();
    const win = await page.evaluate(bead, `.world.ecl[data-world="${body}"] > .ecl-ring.bead-face[data-of="${body}"]`);
    {
      const g = await page.evaluate((q) => {
        const ring = document.querySelector(q), probe = document.createElement("i");
        probe.style.color = "var(--w-bg)";
        document.querySelector("main").appendChild(probe);
        const ground = getComputedStyle(probe).color;
        probe.remove();
        return { ground, moat: getComputedStyle(ring).boxShadow.match(/rgba?\([^)]*\)/)[0] };
      }, `.world.ecl[data-world="${body}"] > .ecl-ring`);
      expect(g.moat, "the window ring's moat is the page ground").toBe(g.ground);
    }
    await open(page, "/events/");
    const events = await page.evaluate(bead, `.mini-orrery a.trace-bead.bead-face[data-of="${body}"]`);
    await open(page, path);
    const night = await page.evaluate(bead, `.trace .trace-bead.bead-face[data-of="${body}"]`);
    const band = await page.evaluate(bead, `${BAND[body]}.bead-face[data-of="${body}"]`);
    const groundOf = (sel) => page.evaluate((q) => {
      const ring = document.querySelector(q), probe = document.createElement("i");
      probe.style.color = "var(--ecl-out)";
      ring.closest(".ecl").appendChild(probe);
      const out = getComputedStyle(probe).color;
      probe.remove();
      return { out, moat: getComputedStyle(ring).boxShadow.match(/rgba?\([^)]*\)/)[0], page: getComputedStyle(document.querySelector("main")).getPropertyValue("--ground") };
    }, sel);
    for (const q of [BAND[body], ...(body === "philo" ? [".philo-next .ecl-ring"] : [])]) {
      const g = await groundOf(q);
      expect(g.moat, `${q}: the moat is its section's --ecl-out`).toBe(g.out);
    }
    const bands = { embers: [band], philo: [band, await page.evaluate(bead, `.philo-next .ecl-ring.bead-face[data-of="philo"]`)], intersect: [band] }[body];
    const arrived = await page.context().newPage();
    // the light state lasts only until the bleed-in starts: read the bead at DOMContentLoaded
    const sels = [`.trace .trace-bead.bead-face[data-of="${body}"]`, ...bands.map((_, i) => (i ? ".philo-next" : BAND[body].split(" ")[0]) + " .ecl-ring.bead-face")];
    await arrived.addInitScript(({ src, sels }) => {
      try { sessionStorage.setItem("nts:from", "home"); } catch {}
      document.addEventListener("DOMContentLoaded", () => {
        window.__before = { state: document.documentElement.dataset.bleedState, looks: sels.map((q) => (0, eval)(src)(q)) };
      });
    }, { src: bead.toString(), sels });
    await open(arrived, path);
    const { state, looks } = await arrived.evaluate(() => window.__before);
    const [before, ...bandsBefore] = looks;
    expect(state, "arrived in the light state").toBe("before");
    // what a visitor sees: the bleed is "in" at once, the hero light under the night's opening disc
    await expect.poll(() => arrived.evaluate(() => document.documentElement.dataset.bleedState)).toBe("in");
    await arrived.evaluate(() => window.scrollTo(0, 0));
    await arrived.waitForTimeout(1500);
    const light = await arrived.evaluate(bead, `main .hero .nts-bleed-old .trace .trace-bead.bead-face, main .hero.nts-bleed-old .trace .trace-bead.bead-face`);
    const nightCopy = await arrived.evaluate(bead, `.nts-night .trace .trace-bead.bead-face`);
    await arrived.close();

    // the same bead in every place, but for its face
    const places = { win, events, night, before, ...Object.fromEntries(bandsBefore.map((b, i) => ["bandBefore" + i, b])), ...Object.fromEntries(bands.map((b, i) => ["band" + i, b])) };
    const { face: baseFace, bg: _bg, ...rest } = emblem;
    const lifted = await page.evaluate(([t, f]) => {
      const p = document.createElement("i");
      p.style.backgroundImage = `radial-gradient(color-mix(in srgb, ${t} 10%, ${f}), red)`;
      document.body.appendChild(p);
      const c = getComputedStyle(p).backgroundImage.match(/(rgba?|color)\([^)]*\)/)[0];
      p.remove();
      const x = new OffscreenCanvas(1, 1).getContext("2d"); x.fillStyle = c; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data;
      return `rgb(${d[0]}, ${d[1]}, ${d[2]})`;
    }, [TEXT[body], FACE[body]]);
    expect(lifted, "the lift is a step, not nothing").not.toBe(baseFace);
    // the base face on the beige, the home and /events/ and before the bleed; lifted on the world's own ground
    expect(light, "the light hero's bead").not.toBeNull();
    expect(nightCopy, "the night copy's bead").not.toBeNull();
    expect(light.face, "bleed in: the hero is still light, so its bead is the plain face, as its moat").toBe(baseFace);
    expect(nightCopy.face, "bleed in: the night copy is the world's ground, so its bead is lifted").toBe(lifted);
    // the face: lifted on the hero's own ground (the night copy, the direct landing), plain in the light,
    // and on a band ring (a seam inside a world page) the band it opens, --ecl-bg. The EMBERS summon
    // ring is the exception: its band is the sigil's own colour, so the ring keeps its world's plain face.
    const SUMMON = body === "embers";
    const bandNames = bands.map((_, i) => "band" + i);
    for (const [place, l] of Object.entries(places)) {
      expect(l, `${place} is a bead`).not.toBeNull();
      const { face, bg, ...r } = l;
      expect(r, place).toEqual(rest);
      const isBand = /^band(Before)?\d$/.test(place);
      const want = isBand && !SUMMON ? l.bg : place === "night" ? lifted : baseFace;
      expect(face, `${place}: face`).toBe(want);
    }
    // and in its world's fixed colours: the face in the gradient's centre, the sigil in its own
    expect(emblem.face).toBe(FACE[body]);
    expect(emblem.image).toContain("radial-gradient");
    expect(emblem.sigil).toBe(SIGIL[body]);
    expect(emblem.border).toBe("0px");
    expect(emblem.ratio).toBeCloseTo(0.58, 1);
  });
}

test("O2 every world and the NTS ground define --w-rim and --w-cast", async ({ page }) => {
  await open(page, "/");
  const tokens = await page.evaluate(() =>
    [document.body, ...document.querySelectorAll("section[data-world]")].map((el) => {
      const cs = getComputedStyle(el);
      return { world: el.dataset.world, rim: cs.getPropertyValue("--w-rim").trim(), cast: cs.getPropertyValue("--w-cast").trim() };
    })
  );
  expect(tokens.map((t) => t.world)).toEqual(["nts", "embers", "philo", "intersect"]);
  for (const t of tokens) {
    expect(t.rim, `${t.world} --w-rim`).not.toBe("");
    expect(t.cast, `${t.world} --w-cast`).not.toBe("");
  }
  // a dark ground carries its depth on the lip, so its rim is its own, not the paper's
  const nts = tokens[0];
  for (const t of tokens.filter((t) => t.world === "embers" || t.world === "intersect")) expect(t.rim).not.toBe(nts.rim);
});

// The transitions an orb's opening runs, by part: the orb, the fragment (the
// disc) and the figure in it, with the pseudo-element; caught as they start
// (transitionrun), so a slow machine can't miss a short one.
async function openOrb(page, body) {
  const orb = page.locator(`.orb[data-body="${body}"]`);
  await orb.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(800);
  const before = await orb.boundingBox();
  await page.evaluate((b) => {
    const el = document.querySelector(`.orb[data-body="${b}"]`);
    const part = (t) => (t === el ? "orb" : t.parentElement === el ? "fragment" : "figure");
    window.__runs = new Set();
    el.addEventListener("transitionrun", (e) => window.__runs.add(`${part(e.target)}${e.pseudoElement} ${e.propertyName}`));
  }, body);
  await orb.hover();
  await page.waitForTimeout(1000);
  return page.evaluate(([b, before]) => {
    const el = document.querySelector(`.orb[data-body="${b}"]`);
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return { parts: [...window.__runs].sort(), transform: cs.transform, translate: cs.translate, dy: r.top - before.y, dx: r.left - before.x };
  }, [body, before]);
}

test("O3 the home's orbs open as one portal, by transform and opacity, without rising", async ({ page }) => {
  await open(page, "/");
  const opened = [];
  for (const { body } of WORLDS) {
    const o = await openOrb(page, body);
    expect(o.parts.length, `${body}: the opening runs`).toBeGreaterThan(0);
    for (const p of o.parts) expect(p, `${body}: compositor-only`).toMatch(/ (transform|opacity)$/);
    expect(o.transform, `${body}: the orb does not lift`).toBe("none");
    expect(o.translate, `${body}: the orb does not lift`).toBe("none");
    expect(Math.abs(o.dy) + Math.abs(o.dx), `${body}: the orb stays put`).toBeLessThan(0.5);
    opened.push(o.parts);
  }
  expect(opened[1]).toEqual(opened[0]);
  expect(opened[2]).toEqual(opened[0]);
});

test("O4 under reduced motion the portal opens by fading alone", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "/");
  for (const { body } of WORLDS) {
    const o = await openOrb(page, body);
    expect(o.parts.length, `${body}: the opening still shows`).toBeGreaterThan(0);
    for (const p of o.parts) expect(p, `${body}: no motion`).toMatch(/ opacity$/);
  }
});

for (const vp of VIEWPORTS) {
  test(`O5 at rest each orb's window is as wide as before the lid at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page, "/");
    await page.mouse.move(1, 1);
    for (const { body } of WORLDS) {
      const sel = `.orb[data-body="${body}"]`;
      await page.evaluate((s) => { document.querySelector(s).scrollIntoView({ block: "center" }); }, sel);
      await page.waitForTimeout(800);
      // the world's window may still be opening as it scrolls in: measure until it settles
      const measure = async () => {
        // one row of pixels through the centre, from the bare ground on each side
        const g = await page.evaluate(([s, out]) => {
          const o = document.querySelector(s).getBoundingClientRect();
          return { x: Math.floor(o.left) - out, w: Math.ceil(o.width) + 2 * out + 1, y: Math.round(o.top + o.height / 2) };
        }, [sel, GROUND_AT]);
        const png = await page.screenshot({ clip: { x: g.x, y: g.y, width: g.w, height: 1 }, scale: "css" });
        return page.evaluate(async ([b64, diff, limb]) => {
          const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
          const c = new OffscreenCanvas(bmp.width, 1), ctx = c.getContext("2d");
          ctx.drawImage(bmp, 0, 0);
          const px = ctx.getImageData(0, 0, bmp.width, 1).data;
          const at = (i) => [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]];
          const far = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > diff;
          const groundL = at(0), groundR = at(bmp.width - 1);
          let l = 0; while (l < bmp.width && !far(at(l), groundL)) l++;
          let r = bmp.width - 1; while (r > 0 && !far(at(r), groundR)) r--;
          return r - l + 1 - 2 * limb;
        }, [png.toString("base64"), EDGE_DIFF, LIMB_OUTSIDE]);
      };
      await expect.poll(measure, { message: `${body}: the resting window, ${RESTING_WINDOW[vp.name]}px before the lid`, timeout: 10_000 })
        .toBeGreaterThanOrEqual(RESTING_WINDOW[vp.name] - WINDOW_TOL);
      expect(await measure(), `${body}: the resting window`).toBeLessThanOrEqual(RESTING_WINDOW[vp.name] + WINDOW_TOL);
    }
  });
}

test("O6 at rest the figure is neither transformed nor clipped beyond the disc's edge", async ({ page }) => {
  await open(page, "/");
  await page.mouse.move(1, 1);
  const parts = await page.evaluate(() =>
    [...document.querySelectorAll(".orb > [data-nts-fragment], .orb > [data-nts-fragment] *")].map((el) => {
      const cs = getComputedStyle(el);
      return { el: `${el.closest(".orb").dataset.body} ${el.tagName.toLowerCase()}`, transform: cs.transform, clip: cs.clipPath, mask: cs.maskImage };
    })
  );
  for (const p of parts) expect(p, p.el).toMatchObject({ transform: "none", clip: "none", mask: "none" });
});

// O7 a body on the orrery keeps its focus ring round its face: the ring is
// drawn by the box that lifts, so the face never sits off-centre in it.
// O8 a bead's edge is flat: a ring of one colour and one thickness all
// round, resting or lifted, drawn by the face's gradient.
const BODIES = ["embers", "philo", "intersect", "star"];

async function focusBody(page, body) {
  const sel = `.bead[data-body="${body}"]`;
  await page.locator(sel).focus();
  await page.keyboard.press("Shift");
  return sel;
}

for (const vp of VIEWPORTS) {
  test(`O7 a focused body's ring is round its face at ${vp.name}`, async ({ page, freeze }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page, "/");
    await freeze(page, 1000);
    for (const body of BODIES) {
      for (const hover of vp.width > 900 ? [false, true] : [false]) {
        const sel = await focusBody(page, body);
        if (hover) await page.hover(sel); else await page.mouse.move(1, 1);
        await page.waitForTimeout(600);
        const g = await page.evaluate((s) => {
          const bead = document.querySelector(s), face = bead.querySelector(".face");
          const ringed = [bead, ...bead.querySelectorAll("*")].filter((el) => {
            const cs = getComputedStyle(el);
            return cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
          });
          const c = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
          return { focused: bead.matches(":focus-visible"), rings: ringed.length, ring: ringed[0] && c(ringed[0]), face: c(face) };
        }, sel);
        const what = `${body}${hover ? " hovered" : ""}`;
        expect(g.focused, `${what}: keyboard focus`).toBe(true);
        expect(g.rings, `${what}: one focus ring`).toBe(1);
        expect(Math.abs(g.ring[0] - g.face[0]), `${what}: ring centred on the face (x)`).toBeLessThan(0.5);
        expect(Math.abs(g.ring[1] - g.face[1]), `${what}: ring centred on the face (y)`).toBeLessThan(0.5);
      }
    }
  });
}

// O8 is measured at 4 device px per CSS px, on eight rays round the face.
const RAYS = 8;
const GROUND_TOL = 12; // summed RGB difference: the ground just outside the face is the ground, no fringe
const RING_TOL = 45; // summed RGB difference: the ring is its colour (antialiased over under a device px or two)
const gap = (p, q) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]);
const EDGE_TOL = 10; // summed RGB distance of the edge pixel from the ground-to-face blend
// How far a pixel lies from the straight blend of two colours: the edge pixel is part ground, part
// face; a fringe of the ring's colour is off that line.
const offLine = (p, a, b) => {
  const d = b.map((v, i) => v - a[i]), n = d.reduce((x, v) => x + v * v, 0);
  const t = Math.min(1, Math.max(0, d.reduce((x, v, i) => x + v * (p[i] - a[i]), 0) / n));
  return gap(p, a.map((v, i) => v + t * d[i]));
};
const SHAPES = new Map();

test.describe("O8", () => {
  test.use({ deviceScaleFactor: 4 });
  for (const vp of VIEWPORTS) {
    test(`O8 a bead's edge is a flat ring inside the face and leaves no fringe outside it, at ${vp.name}`, async ({ page, freeze }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await open(page, "/");
      await freeze(page, 1000);
      for (const body of BODIES.filter((b) => b !== "star")) {
        for (const hover of vp.width > 900 ? [false, true] : [false]) {
          const sel = `.bead[data-body="${body}"]`;
          if (hover) await page.hover(sel); else await page.mouse.move(1, 1);
          await page.waitForTimeout(600);
          const g = await page.evaluate((s) => {
            const el = document.querySelector(s + " .bead-face"), cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            const probe = document.createElement("i");
            probe.style.color = `color-mix(in srgb, ${cs.color} 72%, ${cs.getPropertyValue("--of-face")})`;
            document.body.appendChild(probe);
            const ring = getComputedStyle(probe).color;
            probe.remove();
            const px = (c) => { const x = new OffscreenCanvas(1, 1).getContext("2d"); x.fillStyle = c; x.fillRect(0, 0, 1, 1); return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3); };
            return {
              image: cs.backgroundImage, shadow: cs.boxShadow, border: cs.borderTopWidth, radius: cs.borderTopLeftRadius,
              face: px(cs.getPropertyValue("--of-face")), ring: px(ring), sigil: px(cs.color), ground: px(cs.boxShadow.match(/rgba?\([^)]*\)/g).pop()), // the moat is the last shadow
              rect: { x: r.left, y: r.top, w: r.width, h: r.height },
            };
          }, sel);
          const what = `${body}${hover ? " lifted" : ""}`;
          expect(g.image, `${what}: the edge is a radial ring inside the face`).toMatch(/^radial-gradient\(circle closest-side,/);
          expect(g.border, `${what}: no border`).toBe("0px");
          expect(g.radius, `${what}: round`).toBe("50%");
          expect(g.shadow, `${what}: no inset shadow`).not.toContain("inset");
          // the stops, colours apart, are the same at rest and lifted, in every world
          const shape = g.image.replace(/(rgba?|color)\([^)]*\)/g, "C");
          if (!SHAPES.has("stops")) SHAPES.set("stops", shape);
          expect(shape, `${what}: gradient stops`).toBe(SHAPES.get("stops"));

          const { x, y, w, h } = g.rect, m = 8;
          const png = await page.screenshot({ clip: { x: x - m, y: y - m, width: w + 2 * m, height: h + 2 * m } });
          const found = await page.evaluate(async ([b64, rays, cssR, margin, dpr]) => {
            const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
            const c = new OffscreenCanvas(bmp.width, bmp.height), ctx = c.getContext("2d");
            ctx.drawImage(bmp, 0, 0);
            const cx = bmp.width / 2, cy = bmp.height / 2;
            const at = (r, k) => {
              const a = ((k + 0.5) / rays) * 2 * Math.PI;
              return [...ctx.getImageData(Math.round(cx + Math.cos(a) * r * dpr), Math.round(cy + Math.sin(a) * r * dpr), 1, 1).data].slice(0, 3);
            };
            const out = { outside: [], edge: [], ring: [] };
            for (let k = 0; k < rays; k++) {
              out.outside.push(at(cssR + 1.5, k));
              out.edge.push(at(cssR + 0.25, k)); 
              out.ring.push(at(cssR - 3.6, k));
            }
            return out;
          }, [png.toString("base64"), RAYS, w / 2, m, 4]);
          for (let k = 0; k < RAYS; k++) {
            // the cast of a lifted bead darkens the ground below it; the fringe is judged at rest
            if (!hover) expect(offLine(found.edge[k], g.ground, g.face), `${what}: ray ${k}, no fringe at the face's edge (${found.edge[k]}, between ${g.ground} and ${g.face})`).toBeLessThanOrEqual(EDGE_TOL);
            if (!hover) expect(gap(found.outside[k], g.ground), `${what}: ray ${k}, the ground just outside the face (${found.outside[k]} against ${g.ground})`).toBeLessThanOrEqual(GROUND_TOL);
            expect(gap(found.ring[k], hover ? g.sigil : g.ring), `${what}: ray ${k}, the ring inside the face (${found.ring[k]} against ${hover ? g.sigil + ', lit' : g.ring})`).toBeLessThanOrEqual(RING_TOL);
          }
        }
      }
    });
  }
});

// O9 a body's moat is a round shadow of the face no wider than the body plus a small gap,
// and the star, a thin glyph, has none: a fill behind it would cut the grid
// and its orbit in a patch.
for (const vp of VIEWPORTS) {
  test(`O9 a body's moat is round and snug at ${vp.name}`, async ({ page, freeze }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page, "/");
    await freeze(page, 1000);
    const moats = await page.evaluate(() =>
      [...document.querySelectorAll(".orrery .bead")].map((b) => {
        // the moat is the face's own shadow: a spread, round with the face
        const fc = b.querySelector(".face"), cs = getComputedStyle(fc), face = fc.getBoundingClientRect();
        const spread = cs.boxShadow.match(/rgba?\([^)]*\) 0px 0px 0px (\d+(?:\.\d+)?)px/);
        const filled = !!spread;
        const w = face.width + 2 * (spread ? parseFloat(spread[1]) : 0);
        return { body: b.dataset.body, filled, w, h: w, r: cs.borderTopLeftRadius, face: face.width, orrery: b.closest(".orrery").getBoundingClientRect().width };
      })
    );
    expect(moats.length).toBe(4);
    for (const m of moats) {
      if (m.body === "star") { expect(m.filled, "the star has no moat").toBe(false); continue; }
      expect(m.filled, `${m.body} has a moat`).toBe(true);
      expect(Math.abs(m.w - m.h), `${m.body} moat is square-boxed`).toBeLessThan(0.5);
      expect(m.r, `${m.body} moat is round`).toBe("50%");
      expect(m.w, `${m.body} moat is the body plus a small gap`).toBeLessThanOrEqual(m.face + 0.03 * m.orrery);
    }
  });
}

// O10 the events star stays out of the bead build and keeps its size: its
// glyph is square, 66% of its body. Values measured on the build before the
// bead (390 px: 29 px, 1440 px: 41.1 px).
const STAR = { 390: 29.0, 1440: 41.1 };
for (const vp of VIEWPORTS) {
  test(`O10 the events star's glyph is square and its old size at ${vp.name}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page, "/");
    const g = await page.evaluate(() => {
      const b = document.querySelector('.bead[data-body="star"]'), r = b.querySelector(".nts-sigil").getBoundingClientRect();
      return { w: r.width, h: r.height, bead: b.querySelector(".bead-face") !== null };
    });
    expect(g.bead, "the star is not a bead-face").toBe(false);
    expect(g.w, "width").toBeCloseTo(STAR[vp.width], 0);
    expect(g.h, "height").toBeCloseTo(STAR[vp.width], 0);
  });
}

// O11 the rings that open NTS's own bands are the bead of the band they open:
// the gradient seal, no border, round, a moat; their face is the band's ground
// (--ecl-bg), their sigil and seal the band's marks (--ecl-fg), the events'
// in the ochre.
test("O11 the NTS band rings are beads in their band's colours", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const probe = (page, sels) => page.evaluate((qs) => qs.map(([ring, sec, sigil]) => {
    const el = document.querySelector(ring), cs = getComputedStyle(el), sc = document.querySelector(sec);
    const col = (v) => { const p = document.createElement("i"); p.style.backgroundImage = `linear-gradient(${v},${v})`; sc.appendChild(p); const c = getComputedStyle(p).backgroundImage.match(/(rgba?|color)\([^)]*\)/)[0]; p.remove(); return c; };
    const bg = cs.backgroundImage;
    const n8 = (c) => { const x = new OffscreenCanvas(1, 1).getContext("2d"); x.fillStyle = c; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return `rgb(${d[0]}, ${d[1]}, ${d[2]})`; };
    return {
      ring, radius: cs.borderTopLeftRadius, border: cs.borderTopWidth, seal: /^radial-gradient\(circle closest-side,/.test(bg), face: n8(bg.match(/(rgba?|color)\([^)]*\)/)[0]),
      want: n8(col("var(--ecl-bg)")), sigil: getComputedStyle(el.querySelector(".nts-sigil")).color, wantSigil: col(sigil), ratio: Math.round(el.querySelector(".nts-sigil").getBoundingClientRect().width / el.getBoundingClientRect().width * 100) / 100,
      moat: cs.boxShadow.match(/rgba?\([^)]*\)/g).pop(), wantMoat: col("var(--ecl-out)"),
    };
  }), sels);
  const rows = [
    ...(await (async () => { await open(page, "/"); return probe(page, [["#words > .ecl-ring", "#words", "var(--ecl-fg)"], ["#yet-to-come > .ecl-ring", "#yet-to-come", "var(--code-events)"]]); })()),
    ...(await (async () => { await open(page, "/events/"); return probe(page, [["#ledger > .ecl-ring", "#ledger", "var(--code-events)"]]); })()),
  ];
  expect(rows.length).toBe(3);
  for (const r of rows) {
    expect(r.seal, `${r.ring}: gradient seal`).toBe(true);
    expect(r.border, `${r.ring}: no border`).toBe("0px");
    expect(r.radius, `${r.ring}: round`).toBe("50%");
    expect(r.face, `${r.ring}: the band's ground is the face`).toBe(r.want);
    expect(r.sigil, `${r.ring}: sigil`).toBe(r.wantSigil);
    expect(r.moat, `${r.ring}: moat is --ecl-out`).toBe(r.wantMoat);
    expect(r.ratio, `${r.ring}: sigil at 58%`).toBeCloseTo(0.58, 1);
  }
});

// O12 the seal lights: under the pointer or the keyboard no ring comes at the
// face's edge; a layer fades in (opacity, nothing layout-bound) that turns the
// seal full sigil colour; the keyboard also gets an ink outline clear of the moat.
test("O12 a bead lights its seal on hover and takes an outline on focus", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "/");
  const sel = '.bead[data-body="embers"]';
  const info = () => page.evaluate((s) => {
    const f = document.querySelector(s + " .bead-face"), a = getComputedStyle(f, "::after"), c = getComputedStyle(f);
    return { opacity: parseFloat(a.opacity), shadow: a.boxShadow, border: c.borderTopWidth, image: a.backgroundImage, tr: a.transitionProperty, ftr: c.transitionProperty };
  }, sel);
  await page.mouse.move(1, 1);
  const rest = await info();
  expect(rest.opacity).toBe(0);
  await page.evaluate((s) => document.getAnimations().forEach((x) => x.pause()), sel); // hold the orbit still
  await page.hover(sel, { force: true });
  await page.waitForTimeout(700);
  const lit = await info();
  expect(lit.opacity, "the hover layer fades in").toBe(1);
  expect(lit.shadow, "no inset ring at the edge").not.toContain("inset");
  expect(lit.border, "no border").toBe("0px");
  expect(lit.image, "the layer is the seal, drawn full").toContain("radial-gradient");
  expect(lit.tr, "only opacity transitions on the layer").toBe("opacity");
  expect(lit.ftr, "the face lifts by transform alone").toBe("transform");
  await page.mouse.move(1, 1);
  await page.locator(sel).focus();
  await page.keyboard.press("Shift");
  const o = await page.evaluate((s) => { const c = getComputedStyle(document.querySelector(s + " .bead-face")); return { style: c.outlineStyle, w: c.outlineWidth, off: c.outlineOffset }; }, sel);
  expect(o).toEqual({ style: "solid", w: "2px", off: "5px" });
});

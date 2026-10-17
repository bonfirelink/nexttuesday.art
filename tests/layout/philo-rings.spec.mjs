// L2. The PHILO ring plate spans the screen, is centred on the orbit and fades out before the hero's edges.
import { test, expect } from "../helpers/fixtures.mjs";
import { rectOf, probeLength, openPage } from "../helpers/geometry.mjs";

test.use({ reducedMotion: "reduce" });

for (const [width, height] of [[390, 844], [1024, 768], [1440, 800]]) {
  test(`L2 PHILO ring plate is centred on the orbit and spans the screen at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openPage(page, "/not-not-philo/");

    // the plate is the hero's ::before box; its centre is the point the CSS resolves --cx/--cy to
    const hero = await rectOf(page, ".philo-rings");
    const trace = await rectOf(page, ".trace", ".philo-rings");
    const cx = hero.x + (await probeLength(page, ".philo-rings", "var(--cx)", "left"));
    const cy = hero.y + (await probeLength(page, ".philo-rings", "var(--cy)", "top"));
    expect(cx, "plate centre x vs orbit centre").toBeCloseTo(trace.cx, 0);
    expect(cy, "plate centre y vs orbit centre").toBeCloseTo(trace.cy, 0);

    expect(hero.x, "plate left edge").toBeCloseTo(0, 0);
    expect(hero.w, "plate width vs viewport").toBeCloseTo(width, 0);

    const fade = await page.evaluate(() => getComputedStyle(document.querySelector(".philo-rings"), "::after").backgroundImage);
    expect(fade, "fade over the plate's top and bottom").toContain("linear-gradient");

    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, "horizontal overflow").toBeLessThanOrEqual(0);
  });
}

// L2b. The plate is phased so one ring would fall on the trace, and that ring is cut out of it: the orbit runs over clear ground.
// The phase and the trace's radius are read resolved (--ph, --tr); the gradient's stops and the mask's second layer (the cut-out band) from the plate's computed style.
const PITCH = 9;
const stops = (layer) => [...layer.matchAll(/rgba?\([^)]*\)\s+(-?[\d.]+)px/g)].map((m) => ({ at: parseFloat(m[1]), opaque: !/rgba\([^)]*,\s*0\)/.test(m[0]) }));

// 387 puts --ph above 8px (the line would have to wrap past the pitch); 1024x500 is the 92svh cap of --tr.
for (const [width, height] of [[390, 844], [387, 844], [900, 700], [1024, 768], [1024, 500], [1440, 800]]) {
  test(`L2b PHILO ring plate leaves the ring on the trace out at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openPage(page, "/not-not-philo/");

    const trace = await rectOf(page, ".trace-ring", ".philo-rings");
    const R = trace.w / 2;
    const tr = await probeLength(page, ".philo-rings", "var(--tr)");
    const ph = await probeLength(page, ".philo-rings", "var(--ph)");
    expect(tr, "--tr vs the trace's outer radius").toBeCloseTo(R, 0);

    // the trace's 1px line is [R - 1, R]; a ring line starts every pitch from --ph
    const off = (((R - 1 - ph) % PITCH) + PITCH) % PITCH;
    expect(Math.min(off, PITCH - off), "a plate ring would fall on the trace's line").toBeLessThan(0.5);

    const { bg, mask } = await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector(".philo-rings"), "::before");
      return { bg: s.backgroundImage, mask: s.maskImage };
    });
    const ring = stops(bg).map((s) => s.at);
    expect(ring.length, `the ring gradient has stops: ${bg}`).toBeGreaterThanOrEqual(3);
    expect(ring, "the ring gradient's stops never decrease").toEqual([...ring].sort((a, b) => a - b));
    expect(ring.at(-1) - ring[0], "the ring gradient repeats every pitch").toBeCloseTo(PITCH, 3);

    const hole = stops(mask.split(/\),\s*radial-gradient\(/)[1] ?? "").filter((s) => !s.opaque);
    expect(hole.length, `the mask has a cut-out band: ${mask}`).toBeGreaterThanOrEqual(1);
    const [lo, hi] = [hole[0].at, hole.at(-1).at];
    expect(Math.abs((lo + hi) / 2 - (R - 0.5)), "cut-out band centre vs the trace line's centre").toBeLessThanOrEqual(0.5);
    // wide enough to take out the ring on the trace, narrow enough to keep its neighbours (a pitch either side)
    expect(lo, "band starts inside the trace's line").toBeLessThanOrEqual(R - 2);
    expect(hi, "band ends outside the trace's line").toBeGreaterThanOrEqual(R + 1);
    expect(hi - lo, "band is narrower than two pitches less the lines").toBeLessThan(2 * PITCH - 2);
  });
}

// L5. On every world hero the figure paints above the dashed orbit trace.
// Hit-testing lists the elements under a point in paint order, topmost first, once nothing
// opts out of it; the ring's centre lies in the ring's box and in the figure's.
// The PHILO test also checks the ring stays above the hero's fade and plate. It reads layers, not pixels:
// it doesn't cover how visible the dashes are.
import { test, expect } from "../helpers/fixtures.mjs";
import { openPage } from "../helpers/geometry.mjs";

const WORLDS = [
  { name: "EMBERS", path: "/embers/", figure: ".hero canvas.nts-hearth", live: [] },
  { name: "PHILO", path: "/not-not-philo/", figure: ".hero .nts-penrose", live: [".hero .nts-penrose"] },
  { name: "INTERSECT", path: "/intersect/", figure: ".hero pre[data-nts-ascii]", live: [".hero pre[data-nts-ascii]"] },
];

test.use({ reducedMotion: "reduce" });

for (const [width, height] of [[390, 844], [1440, 900]]) {
  for (const w of WORLDS) {
    test(`L5 ${w.name} figure paints above the orbit trace at ${width}`, async ({ page, freeze, settle }) => {
      await page.setViewportSize({ width, height });
      await openPage(page, w.path, { live: w.live });
      await freeze(page);
      await settle(page);
      const order = await page.evaluate((figure) => {
        const style = document.createElement("style");
        style.textContent = "* { pointer-events: auto !important; }";
        document.head.append(style);
        const ring = document.querySelector(".hero .trace-ring");
        const r = ring.getBoundingClientRect();
        const stack = document.elementsFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        style.remove();
        const fig = document.querySelector(figure);
        return { fig: stack.findIndex((e) => fig === e || fig.contains(e)), ring: stack.indexOf(ring) };
      }, w.figure);
      expect(order.fig, `${w.path} figure is under the ring's centre`).toBeGreaterThanOrEqual(0);
      expect(order.ring, `${w.path} ring is under its own centre`).toBeGreaterThanOrEqual(0);
      expect(order.fig, `${w.path} figure above the trace ring`).toBeLessThan(order.ring);

      if (w.name === "PHILO") {
        // the hero's plate and fade are pseudo-elements, which hit-testing can't list: their layers are read
        const z = await page.evaluate(() => {
          const hero = document.querySelector(".philo-rings");
          const n = (v) => Number(v);
          return { plate: n(getComputedStyle(hero, "::before").zIndex), fade: n(getComputedStyle(hero, "::after").zIndex), ring: n(getComputedStyle(document.querySelector(".hero .trace")).zIndex) };
        });
        expect(z.plate, `${w.path} plate under the fade`).toBeLessThan(z.fade);
        expect(z.fade, `${w.path} fade under the ring, which the fade must not dim`).toBeLessThan(z.ring);
      }
    });
  }
}

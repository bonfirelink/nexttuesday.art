// L3. On every world hero the figure paints above the dashed orbit trace.
import { test, expect } from "../helpers/fixtures.mjs";
import { openPage } from "../helpers/geometry.mjs";

const WORLDS = [
  { path: "/embers/", figure: ".hero canvas.nts-hearth", live: [] },
  { path: "/not-not-philo/", figure: ".hero .nts-penrose", live: [".hero .nts-penrose"] },
  { path: "/intersect/", figure: ".hero pre[data-nts-ascii]", live: [".hero pre[data-nts-ascii]"] },
];

test.use({ reducedMotion: "reduce" });

for (const [width, height] of [[390, 844], [1440, 900]]) {
  test(`L3 figure paints above the orbit trace at ${width}`, async ({ page, freeze, settle }) => {
    await page.setViewportSize({ width, height });
    for (const w of WORLDS) {
      await openPage(page, w.path, { live: w.live });
      await freeze(page);
      await settle(page);
      // hit-testing lists the elements under a point in paint order, topmost first,
      // once nothing opts out of it; the ring's centre lies in the ring's box and the figure's
      const order = await page.evaluate((figure) => {
        const style = document.createElement("style");
        style.textContent = "* { pointer-events: auto !important; }";
        document.head.append(style);
        const r = document.querySelector(".hero .trace-ring").getBoundingClientRect();
        const stack = document.elementsFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        style.remove();
        const fig = document.querySelector(figure);
        const at = (el) => stack.findIndex((e) => el === e || el.contains(e));
        return { fig: at(fig), ring: stack.indexOf(document.querySelector(".hero .trace-ring")) };
      }, w.figure);
      expect(order.fig, `${w.path} figure is under the ring's centre`).toBeGreaterThanOrEqual(0);
      expect(order.ring, `${w.path} ring is under its own centre`).toBeGreaterThanOrEqual(0);
      expect(order.fig, `${w.path} figure above the trace ring`).toBeLessThan(order.ring);
    }
  });
}

// The hero label is a solid band, and the selection colours of the page (the
// world's, or the palette's before the world bleeds in) equal the band's own:
// selected text would show no highlight. Each world's label inverts them, on
// the band and on the text that is visible in it (the long form, or the short
// form with its abbr on a phone), in both phases.
import { test, expect } from "../helpers/fixtures.mjs";
import { open } from "../helpers/behaviour.mjs";
import { style } from "../helpers/palette.mjs";

const LABELS = [
  ["/embers/", ".embers-hero .embers-label"],
  ["/not-not-philo/", ".philo-hero .label"],
  ["/intersect/", ".intersect-hero .label"],
];

for (const [width, probes] of [[1440, ["", " .label-long"]], [390, ["", " .label-short", " .label-short abbr"]]]) {
  for (const [path, label] of LABELS) {
    for (const phase of ["home", "world"]) {
      test(`${path} label selection shows at ${width}px, ${phase === "home" ? "on arrival from the home" : "once the world has bled in"}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        if (phase === "home") await page.addInitScript(() => { try { sessionStorage.setItem("nts:from", "home"); } catch {} });
        await open(page, path);
        if (phase === "home") expect(await page.evaluate(() => document.documentElement.dataset.bleedState), "arrival state").toMatch(/^(before|in)$/);
        if (phase === "world") await page.waitForFunction(() => document.documentElement.dataset.bleedState === "world");
        const own = await style(page, label, "backgroundColor");
        for (const part of probes) {
          const selected = await style(page, label + part, "backgroundColor", "::selection");
          expect(selected, `${part || "band"}: selection ground differs from the label's`).not.toBe(own);
          expect(await style(page, label + part, "color", "::selection"), `${part || "band"}: selected text differs from its ground`).not.toBe(selected);
        }
      });
    }
  }
}

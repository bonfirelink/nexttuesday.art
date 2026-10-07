import { test, expect } from "../helpers/fixtures.mjs";
import { WORLDS, recordBleed, clickWorldLink } from "../helpers/transitions.mjs";

test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

for (const world of WORLDS) {
  test(`R1 ${world} arrives in world under reduced motion`, async ({ page }) => {
    await page.addInitScript(recordBleed);
    await page.goto(process.env.NTS_BASE + "/", { waitUntil: "load" });
    await clickWorldLink(page, world);
    await page.waitForLoadState("load");
    const dcl = await page.evaluate(() => window.__bleed.dcl);
    expect(dcl.state, "state at DOMContentLoaded").toBe("world");
    expect(dcl.night, "no copy at DOMContentLoaded").toBe(false);
    expect(await page.locator(".nts-night").count()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.getAttribute("data-bleed-state"))).toBe("world");
  });
}

// The home has no compass: no small sun badge appears once the orrery has
// scrolled away.
import { test, expect } from "../helpers/fixtures.mjs";
import { VIEWPORTS, open, scrollTo } from "../helpers/behaviour.mjs";

for (const vp of VIEWPORTS) {
  test.describe(`no compass at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("the home has no .compass, at the top or scrolled away", async ({ page, settle }) => {
      await open(page);
      await expect(page.locator(".compass")).toHaveCount(0);
      await scrollTo(page, settle, 2 * vp.height);
      await expect(page.locator(".compass")).toHaveCount(0);
    });
  });
}

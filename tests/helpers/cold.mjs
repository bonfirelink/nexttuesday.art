// A page in a brand-new browser context (no cache, no storage) for tests that compare
// cold loads. Routing is the fixtures' installer: fonts from tests/fonts/ (optionally
// held for `fontDelay` ms), any other external request is recorded and aborted.
import { installFontRoutes } from "./fixtures.mjs";

/** A page in a fresh context made from `browser`; returns { page, external, close }. */
export async function coldPage(browser, { fontDelay = 0, ...contextOptions } = {}) {
  const context = await browser.newContext(contextOptions);
  const external = [];
  await installFontRoutes(context, { fontDelay, external });
  const page = await context.newPage();
  return { page, external, close: () => context.close() };
}

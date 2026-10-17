// A headless Chromium for one-off scripts: the binary comes from $CHROMIUM, launched with
// --no-sandbox. To load pages the way the suite does (fonts from the offline cache, any other
// external host blocked), route each context with installFontRoutes.
//
//   import { launch } from "./tools/browser.mjs";
//   import { installFontRoutes } from "./tests/helpers/fixtures.mjs";
//   const browser = await launch(); const context = await browser.newContext(); await installFontRoutes(context);
//   // installFontRoutes lets only $NTS_BASE's host through: set it to the URL's host first
import { chromium } from "@playwright/test";

export async function launch({ args = [] } = {}) {
  if (!process.env.CHROMIUM) throw new Error("$CHROMIUM unset; set it to a Chromium binary");
  return chromium.launch({ executablePath: process.env.CHROMIUM, args: ["--no-sandbox", ...args] });
}

import { defineConfig } from "@playwright/test";
import { execFileSync } from "node:child_process";

function chromiumPath() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  try {
    return execFileSync("which", ["chromium"], { encoding: "utf8" }).trim();
  } catch {
    throw new Error(
      "No Chromium found: $CHROMIUM is unset and `chromium` is not on PATH. " +
        "Run the tests inside the project's dev shell (it exports CHROMIUM)."
    );
  }
}

const executablePath = chromiumPath();
const base = {
  viewport: { width: 1440, height: 900 },
  launchOptions: { executablePath, args: ["--no-sandbox"] },
  trace: "retain-on-failure",
  screenshot: "only-on-failure",
};

// Tiers are tags in test titles: @slow, @perf, @visual; untagged is fast.
const dirs = "{layout,behaviour,transitions,motion}";
export default defineConfig({
  testDir: "tests",
  retries: 0,
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/helpers/global-setup.mjs",
  use: base,
  projects: [
    { name: "static", testMatch: "static/**/*.spec.mjs" },
    { name: "fast", testMatch: ["smoke.spec.mjs", `${dirs}/**/*.spec.mjs`], grepInvert: /@slow|@perf|@visual/ },
    { name: "slow", testMatch: [`${dirs}/**/*.spec.mjs`], grep: /@slow/ },
    { name: "visual", testMatch: "visual/**/*.spec.mjs", grep: /@visual/ },
    { name: "live", testMatch: "live/**/*.spec.mjs" },
    // Alone, one worker, after the others, so their CPU use can't distort traces.
    {
      name: "perf",
      testMatch: "perf/**/*.spec.mjs",
      grep: /@perf/,
      workers: 1,
      fullyParallel: false,
      dependencies: ["static", "fast", "slow", "visual"],
    },
  ],
});

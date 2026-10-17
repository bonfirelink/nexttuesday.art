import { defineConfig } from "@playwright/test";
import { execFileSync } from "node:child_process";

function chromiumPath() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  try {
    return execFileSync("which", ["chromium"], { encoding: "utf8" }).trim();
  } catch {
    throw new Error(
      "No Chromium found: $CHROMIUM is unset and `chromium` is not on PATH. " +
        "Install Chromium or point CHROMIUM at a binary."
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

// Tiers are tags in test titles: @slow, @perf; untagged is fast.
const dirs = "{layout,behaviour,transitions,motion}";
export default defineConfig({
  testDir: "tests",
  retries: 0,
  fullyParallel: true,
  // One run must not saturate the machine; `--workers` overrides.
  workers: 4,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/helpers/global-setup.mjs",
  use: base,
  projects: [
    { name: "static", testMatch: "static/**/*.spec.mjs" },
    { name: "fast", testMatch: ["smoke.spec.mjs", `${dirs}/**/*.spec.mjs`], grepInvert: /@slow|@perf/ },
    { name: "slow", testMatch: [`${dirs}/**/*.spec.mjs`], grep: /@slow/ },
    // Alone, one worker, after the others, so their CPU use can't distort traces.
    {
      name: "perf",
      testMatch: "perf/**/*.spec.mjs",
      grep: /@perf/,
      workers: 1,
      fullyParallel: false,
      dependencies: ["static", "fast", "slow"],
    },
  ],
});

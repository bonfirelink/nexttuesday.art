// B1. The bleed's trigger and length in nts.js (FIRE_AT, DURATION) are the
// ones the bleed tests use (BLEED_FIRE_AT, BLEED_MS in
// tests/helpers/transitions.mjs): one number, two places, kept in step here.
import { test, expect } from "../helpers/fixtures.mjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BLEED_FIRE_AT, BLEED_MS } from "../helpers/transitions.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("B1: the bleed's trigger and duration in nts.js are the tests'", () => {
  const src = readFileSync(path.join(root, "site/_nts/nts.js"), "utf8");
  const m = /var FIRE_AT = (\d+), DURATION = (\d+);/.exec(src);
  expect(m, "FIRE_AT and DURATION declared in cross()").not.toBeNull();
  expect(+m[1], "FIRE_AT").toBe(BLEED_FIRE_AT);
  expect(+m[2], "DURATION").toBe(BLEED_MS);
});

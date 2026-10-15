// K1. The scripts-off stills in site/_nts/parts are what the figures draw now:
// regenerated in memory, they match the committed files byte for byte.
import { test, expect } from "../helpers/fixtures.mjs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("K1: the stills match the figures (gen-stills --check)", () => {
  const r = spawnSync(process.execPath, [path.join(root, "tools/gen-stills.mjs"), "--check"], { cwd: root, encoding: "utf8" });
  expect(r.status, `a still is stale; run \`node tools/gen-stills.mjs\`, then \`node tools/sync.mjs\`, and commit.\n${r.stdout}${r.stderr}`).toBe(0);
});

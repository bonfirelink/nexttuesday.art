import { test, expect } from "../helpers/fixtures.mjs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("S1: sync is clean (generated regions match their sources)", () => {
  const r = spawnSync(process.execPath, ["tools/sync.mjs", "--check"], { cwd: root, encoding: "utf8" });
  expect(
    r.status,
    `tools/sync.mjs --check would change files; run \`node tools/sync.mjs\` and commit the result.\n${r.stdout}${r.stderr}`
  ).toBe(0);
});

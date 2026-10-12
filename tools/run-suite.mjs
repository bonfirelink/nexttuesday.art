#!/usr/bin/env node
// Runs `playwright test <args>`, or the shell command in NTS_SUITE_CMD instead.
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function startChild() {
  if (process.env.NTS_SUITE_CMD) {
    return spawn(process.env.NTS_SUITE_CMD, args, { cwd: root, stdio: "inherit", shell: true });
  }
  const bin = path.join(root, "node_modules/.bin", process.platform === "win32" ? "playwright.cmd" : "playwright");
  return spawn(bin, ["test", ...args], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
}

const child = startChild();

// An interrupt goes to the child; its exit then ends this process.
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => child.kill(sig));
}
child.on("error", (e) => {
  console.error(`run-suite: ${e.message}`);
  process.exit(1);
});
child.on("close", (code, signal) => {
  process.exit(code ?? 128 + (os.constants.signals[signal] ?? 0));
});

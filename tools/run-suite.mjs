#!/usr/bin/env node
// Runs `playwright test <args>` under a machine-wide exclusive lock, so suites
// started by several agents queue instead of competing for CPU (timing-based
// tests fail on a loaded machine).
//
// The lock is a file created with O_EXCL (atomic on every platform Node runs
// on, no flock binary) holding the owner's pid. A lock whose pid is dead is
// stale and gets taken over, so a crash or kill -9 never blocks the queue.
//
//   NTS_SUITE_LOCK=0       skip the lock (CI, deliberate parallel runs)
//   NTS_SUITE_LOCK_FILE    lock path (default: per-repo file in $XDG_RUNTIME_DIR
//                          or the OS temp dir, shared by all worktrees)
//   NTS_SUITE_CMD          run this shell command instead of playwright
import { spawn, execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const POLL_MS = 250;

function lockPath() {
  if (process.env.NTS_SUITE_LOCK_FILE) return process.env.NTS_SUITE_LOCK_FILE;
  let common = root;
  try {
    // Every worktree of the repo shares one git common dir.
    common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {}
  const id = crypto.createHash("sha1").update(common).digest("hex").slice(0, 10);
  const dir = process.env.XDG_RUNTIME_DIR || os.tmpdir();
  return path.join(dir, `nexttuesday-art-suite-${id}.lock`);
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

function readOwner(file) {
  try {
    const o = JSON.parse(fs.readFileSync(file, "utf8"));
    return Number.isInteger(o.pid) ? o : null;
  } catch {
    return null; // missing, or caught between create and write
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Removes the lock if its owner is dead. A second O_EXCL file serializes
// takers, so two waiters cannot both delete and one remove the other's new lock.
function breakStale(file) {
  const guard = file + ".break";
  let fd;
  try {
    fd = fs.openSync(guard, "wx");
  } catch {
    try {
      if (Date.now() - fs.statSync(guard).mtimeMs > 10_000) fs.unlinkSync(guard);
    } catch {}
    return;
  }
  try {
    const o = readOwner(file);
    if (o && !alive(o.pid)) fs.unlinkSync(file);
  } catch {}
  fs.closeSync(fd);
  try { fs.unlinkSync(guard); } catch {}
}

async function acquire(file) {
  let told = false;
  for (;;) {
    try {
      const fd = fs.openSync(file, "wx");
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, worktree: root, since: new Date().toISOString() }));
      fs.closeSync(fd);
      return;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
    const o = readOwner(file);
    if (o && !alive(o.pid)) {
      breakStale(file);
      continue;
    }
    if (o && !told) {
      console.error(`waiting for another suite run (pid ${o.pid}, worktree ${o.worktree}, since ${o.since})`);
      told = true;
    }
    await sleep(POLL_MS);
  }
}

function release(file) {
  const o = readOwner(file);
  if (o && o.pid === process.pid) {
    try { fs.unlinkSync(file); } catch {}
  }
}

function startChild() {
  if (process.env.NTS_SUITE_CMD) {
    return spawn(process.env.NTS_SUITE_CMD, args, { cwd: root, stdio: "inherit", shell: true });
  }
  const bin = path.join(root, "node_modules/.bin", process.platform === "win32" ? "playwright.cmd" : "playwright");
  return spawn(bin, ["test", ...args], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
}

const locked = process.env.NTS_SUITE_LOCK !== "0";
const file = locked ? lockPath() : null;
let child = null;

// While queued, an interrupt just leaves; once running, it goes to the child,
// whose exit then releases the lock.
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    if (child) child.kill(sig);
    else process.exit(128 + os.constants.signals[sig]);
  });
}
process.on("exit", () => file && release(file));

if (file) await acquire(file);
child = startChild();
child.on("error", (e) => {
  console.error(`run-suite: ${e.message}`);
  process.exit(1);
});
child.on("close", (code, signal) => {
  process.exit(code ?? 128 + (os.constants.signals[signal] ?? 0));
});

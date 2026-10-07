---
name: nexttuesday-art-change-start
description: Start one small site refinement (a tweak, fix or removal on nexttuesday.art) in its own worktree with a running preview, test-first, ending in one commit. Use when asked to change something on the site; stops before merge and push.
---

# Start a change

One change, one worktree, one preview, one commit. `<name>` is a short lowercase slug (`compass-moon`). The working branch is `eclipse` today and `main` later; `NTS_BRANCH=<branch>` points the script at it.

## Steps

1. **Create.** `tools/change-start.sh <name>` from any checkout. It makes branch and worktree `<name>` off the working branch, locks the worktree, runs `devshell up`, checks that `devshell url` prints `http://<name>.nexttuesday-art.localhost:18000/` and writes the preview note (`devshell note --status working "<name>: in progress" --step "Open <url>"`). It stops with an error on a name that exists as a branch or tag; on a failure after the worktree exists (`devshell up`, URL mismatch) it prints the commands that undo the worktree. Done when it prints the worktree path and the preview URL.
2. **Work only in that worktree.** Use its absolute path for edits and `git -C`; reach other worktrees by `git -C` and absolute paths only. Run `git rev-parse --show-toplevel` before every commit: it must print your worktree.
3. **Read INTERNALS.md** for the files that own the thing you change.
4. **Red.** Write or adjust the test that describes the change and run it; it fails on the current code for the stated reason. A bug report gets a test that reproduces it before any fix.
5. **Change.** Edit; after any edit to a page or to `_nts/content`, run `node tools/sync.mjs`.
6. **Green.** The new test passes, then the full suite passes. Run `npm ci` once in a fresh worktree, then `npm test`. A test that goes red elsewhere is a regression to fix; its tolerance stays as it is, and an assertion stays in, unskipped. Say so in your report for any test whose expectation you had to change, with the old and new values.
   - Before the suite is merged into the working branch (`ls tests/` is empty or missing), the gate is `node tools/sync.mjs --check` plus a manual walk of the affected pages in the preview: no console errors or failed requests, no horizontal scroll at 390 px wide, with and without `prefers-reduced-motion`.
7. **Commit once**, with the attribution lines your session was given (never a model name you typed yourself). Commit work in progress early, and batch shell commands into few calls: turn limits end runs with uncommitted work. Squash to one commit (`git reset --soft "$(git merge-base HEAD refs/heads/<base>)"` then commit) before reporting.
8. **Leave the preview running** for review, and rewrite its note in the worktree: `devshell note --status ready "<what the change does>" --step "Open <url>" ...` (one `--step` per thing to look at). Report: branch tip SHA, files changed, the suite's one-line summary (or the fallback checks run), preview URL.

## Boundaries

- Never touch `main`, `site`, the working branch or any tag; no merge and no push (a separate step lands approved changes).
- Bind servers to `127.0.0.1` and `$DEVSHELL_PORT` only, never `0.0.0.0`.
- Before/after screenshots, performance traces and publishing are separate skills.

---
name: nexttuesday-art-change-merge
description: Land an approved change branch into the working branch and clean up its worktree. Use only after the change was approved; publishing is a separate skill.
---

# Merge an approved change

Landing means: rebased, checked, fast-forwarded into the working branch, worktree and branch gone. The working branch is `main`; `NTS_BRANCH` overrides it.

## Gate

The approval of this change is in your brief. Without it, stop and say so.

Only one merge runs at a time, because two merges race on the working branch. If another merge session is active, wait for its report.

## Steps

1. Run `tools/merge-change.sh <branch>` from the working branch's worktree or the main checkout (the branch's own worktree is about to be removed). For several approved branches, run it once per branch, in sequence. Done when it prints `merged <branch> into <base> at <sha>`.
   The script refuses `main`, `site`, `site-publish` and the working branch, a branch locked for something other than its own change, a dirty branch worktree or dirty working-branch worktree, rebases the branch in its own worktree, runs `npm test` (or `node tools/sync.mjs --check` when the branch has no test script) on the rebased branch, fast-forwards the working branch, runs `devshell down`, then removes the worktree and deletes the branch.
2. On `rebase failed`, the script has already aborted the rebase. Resolve by hand with `git -C <worktree>`, never `cd` into another worktree. Keep both sides' intent: the change's edit and what the working branch gained. Rebase, run the check yourself, then rerun the script. Done when it succeeds; report exactly which files conflicted and how each was resolved.
3. On a failed check, nothing was merged. Report the failure; fix only if the brief says to.
4. Verify the landed result in the working-branch preview (`devshell url` in its worktree): `/` and `/embers/` answer 200, and the change's visible marker is present in the HTML.
5. Kill every background process you started (browsers, `http.server`, dev servers). Done when `pgrep -u "$USER" -af chromium` and your own server names show none of yours.
6. Log the merge where the project keeps its log, if the session has one: one line with date, branch, resulting SHA.
7. Report: branch, resulting SHA, check result, conflicts and their resolution, anything left behind.

## Why the script uses `refs/heads/`

Branch names can collide with tags (a round tag and its branch share a name). A bare name in `git log` or `rev-parse` then resolves to the tag, so the script spells `refs/heads/<name>` throughout. Do the same in any command you add.

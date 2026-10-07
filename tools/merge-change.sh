#!/usr/bin/env bash
# Lands an approved change branch into the working branch and cleans up.
# Usage: tools/merge-change.sh <branch>     (working branch: $NTS_BRANCH, default eclipse)
#
# Order matters: the branch is rebased and checked in its own worktree first,
# so a failing check or a conflict leaves the working branch untouched.
# Branch names may collide with tags, so every ref is spelled refs/heads/<name>.
set -eu

b=${1:?usage: merge-change.sh <branch>}
base=${NTS_BRANCH:-eclipse}
die() { echo "merge-change: $*" >&2; exit 1; }

# Path of the worktree that has refs/heads/$1 checked out, or nothing.
worktree_of() {
  git worktree list --porcelain | awk -v ref="refs/heads/$1" '
    /^worktree /{p=substr($0,10)} $0=="branch " ref{print p}'
}

case $b in
  main|site|site-publish|"$base") die "refusing: $b is not a change branch" ;;
esac

# Lock reason of the worktree at $1, empty when unlocked or locked without one.
lock_reason_of() {
  git worktree list --porcelain | awk -v wt="$1" '
    /^worktree /{p=substr($0,10)} p==wt && /^locked/{sub(/^locked ?/,""); print}'
}

git show-ref --verify --quiet "refs/heads/$b" || die "no branch refs/heads/$b"
git show-ref --verify --quiet "refs/heads/$base" || die "no working branch refs/heads/$base"
bwt=$(worktree_of "$b"); [ -n "$bwt" ] || die "$b has no worktree"
swt=$(worktree_of "$base"); [ -n "$swt" ] || die "$base has no worktree"

main=$(git worktree list --porcelain | awk 'NR==1{print substr($0,10)}')
[ "$bwt" != "$main" ] || die "$b is checked out in the main checkout"
case $bwt in "$main"/.claude/worktrees/*) ;; *) die "$bwt is not under $main/.claude/worktrees/" ;; esac

# A lock is someone's claim; only the change's own lock may be released.
reason=$(lock_reason_of "$bwt")
if [ -n "$reason" ]; then
  case $reason in
    *": $b,"*|"nexttuesday refinements: $b"*) ;;
    *) die "$bwt is locked for something else ($reason); ask whoever locked it" ;;
  esac
fi

[ -z "$(git -C "$bwt" status --porcelain)" ] || die "uncommitted changes in $bwt"
[ -z "$(git -C "$swt" status --porcelain)" ] || die "uncommitted changes in $swt"

echo "== rebase $b onto $base"
if ! git -C "$bwt" rebase "refs/heads/$base"; then
  git -C "$bwt" rebase --abort || true
  die "rebase failed (conflict); rebase aborted, $b is unchanged. Resolve by hand in $bwt, then rerun."
fi

echo "== check on the rebased $b"
test_script=
[ -f "$bwt/package.json" ] && test_script=$(cd "$bwt" && node -p 'require("./package.json").scripts?.test ?? ""')
if [ -n "$test_script" ]; then
  # NTS_BASE is the suite's URL under test; unset so it never leaks in.
  (cd "$bwt" && env -u NTS_BASE npm test) || die "npm test failed; nothing merged"
else
  (cd "$bwt" && node tools/sync.mjs --check) || die "sync check failed; nothing merged"
fi

echo "== fast-forward $base to $b"
git -C "$swt" merge --ff-only "refs/heads/$b" || die "ff-only merge into $base failed; $base moved? rerun"

echo "== clean up"
cd "$swt" # the branch worktree is about to disappear
if command -v devshell >/dev/null 2>&1; then
  (cd "$bwt" && devshell down) || echo "warning: devshell down failed" >&2
fi
git worktree unlock "$bwt" 2>/dev/null || true
git worktree remove "$bwt"
# branch -d/-D only take branch names, so a same-named tag cannot interfere.
# -d refuses when the working branch is not what HEAD/upstream tracks; the ancestor check is the real test.
if ! git branch -d "$b" 2>/dev/null; then
  git merge-base --is-ancestor "refs/heads/$b" "refs/heads/$base" || die "$b is not merged into $base; branch kept"
  git branch -D "$b"
fi

echo "merged $b into $base at $(git rev-parse --short "refs/heads/$base")"

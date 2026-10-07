#!/usr/bin/env bash
# Begin one refinement: a worktree of its own on a new branch off the working
# branch, locked, with its preview running.
#   tools/change-start.sh <name>
# NTS_BASE overrides the working branch (default eclipse).
# <name> becomes the branch, the worktree folder and the preview host, so it
# must be a short lowercase slug.
set -eu

name=${1:-}
base=${NTS_BASE:-eclipse}
project=nexttuesday-art

case $name in
  ''|-*|*[!a-z0-9-]*) echo "usage: $0 <name>  (lowercase letters, digits, dashes)" >&2; exit 2 ;;
esac

# The main checkout owns .claude/worktrees, whichever worktree this runs from.
common=$(git rev-parse --path-format=absolute --git-common-dir)
main=$(dirname "$common")
path=$main/.claude/worktrees/$name

# A tag or branch of the same name makes plain `git log <name>` ambiguous.
for ref in refs/heads/$name refs/tags/$name; do
  if git -C "$main" show-ref --verify --quiet "$ref"; then
    echo "error: $ref already exists; pick another name" >&2; exit 1
  fi
done
git -C "$main" show-ref --verify --quiet "refs/heads/$base" ||
  { echo "error: working branch $base not found" >&2; exit 1; }
[ ! -e "$path" ] || { echo "error: $path already exists" >&2; exit 1; }

git -C "$main" worktree add -b "$name" "$path" "refs/heads/$base"
git -C "$main" worktree lock --reason "nexttuesday refinements: $name, $(date +%F)" "$path"

# A failure from here on leaves a locked worktree behind: say how to undo it.
recover() {
  [ $? -eq 0 ] && return
  cat >&2 <<MSG
failed after creating the worktree; to undo it:
  (cd "$path" && devshell down)
  git -C "$main" worktree unlock "$path"
  git -C "$main" worktree remove --force "$path"
  git -C "$main" branch -D "$name"
MSG
}
trap recover EXIT

# devshell loads the shell of the checkout it runs in.
(cd "$path" && devshell up)
url=$(cd "$path" && devshell url)
want=http://$name.$project.localhost:18000/
if [ "$url" != "$want" ]; then
  echo "error: preview URL is $url, expected $want" >&2; exit 1
fi

echo "worktree: $path"
echo "branch:   $name (from $base)"
echo "preview:  $url"

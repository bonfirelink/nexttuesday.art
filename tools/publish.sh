#!/usr/bin/env bash
# Publish the working branch: subtree-split site/ and fast-forward the `site`
# branch that GitHub Pages serves, then verify the live site. It runs no test
# suite: run `npm run test:publish` on the commit first. The sync check and
# the git safety checks do run.
#
#   tools/publish.sh [--dry-run]
#   tools/publish.sh --live-only
#
#   --dry-run    everything up to (not including) moving `site` and pushing
#   --live-only  skip the publish, run the live check once (read-only): the
#                latest Pages build is `built` for the commit origin/site
#                points at, and every page answers 200. Exits non-zero while
#                that is not yet so, for a caller to retry.
#
# After its push a full run polls the same check until it passes or its
# tries run out.
#
# NTS_BRANCH names the working branch (default main). The script never
# forces a push: a non-fast-forward split stops it.
set -euo pipefail

BASE=${NTS_BRANCH:-main}
# This machine's DNS cannot resolve the domain: pin it to a GitHub Pages IP.
RESOLVE=nexttuesday.art:443:185.199.108.153
# the home and every initiative's page, from the registry (site.json)
REG=$(node -e 'for (const i of require(process.argv[1]).initiatives) console.log("/" + i.slug + "/")' "$(git rev-parse --show-toplevel)/site/_nts/content/site.json") || { echo "publish: cannot read the initiatives from site.json" >&2; exit 1; }
PAGES=(/ $REG)
TRIES=10
WAIT=30

dry=0 live_only=0
while [ $# -gt 0 ]; do
  case $1 in
    --dry-run) dry=1 ;;
    --live-only) live_only=1 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

die() { echo "publish: $*" >&2; exit 1; }

# owner/name of the GitHub repo: from gh, else from the origin URL.
repo_slug() {
  gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null && return 0
  git remote get-url origin | sed -E 's#^(git@[^:]+:|https?://[^/]+/)##; s#\.git$##'
}

# One pass: the Pages build is done for the commit `site` points at, and every
# page answers 200. Returns 1, saying what it saw, if not yet; 2 if the build
# errored (waiting will not help).
live_check_once() {
  local slug build status commit want p code bad=0
  git fetch -q origin site || { echo "live: cannot fetch origin/site"; return 1; }
  want=$(git rev-parse refs/remotes/origin/site)
  slug=$(repo_slug) || { echo "live: cannot work out the GitHub repo"; return 1; }
  build=$(gh api "repos/$slug/pages/builds/latest" --jq '.status + " " + .commit') || { echo "live: gh api failed for the pages build"; return 1; }
  status=${build%% *} commit=${build#* }
  echo "pages build: ${status:-<empty>} @ ${commit:0:7} (want built @ ${want:0:7})"
  [ "$status" = errored ] && { echo "live: the Pages build errored"; return 2; }
  [ "$status" = built ] && [ "$commit" = "$want" ] || return 1
  for p in "${PAGES[@]}"; do
    code=$(curl -sS -o /dev/null --max-time 20 -w '%{http_code}' --resolve "$RESOLVE" "https://nexttuesday.art$p" || echo 000)
    echo "live: $code $p"
    [ "$code" = 200 ] || bad=1
  done
  [ "$bad" = 0 ] || { echo "live: a page did not answer 200"; return 1; }
}

live_checks() {
  local try rc
  for ((try = 1; try <= TRIES; try++)); do
    echo "live check (try $try/$TRIES)"
    rc=0; live_check_once || rc=$?
    [ "$rc" = 0 ] && { echo "live: up"; return 0; }
    [ "$rc" = 2 ] && die "the Pages build errored"
    [ "$try" -lt "$TRIES" ] && sleep "$WAIT"
  done
  die "live site not up after $TRIES tries"
}

if [ "$live_only" = 1 ]; then
  rc=0; live_check_once || rc=$?
  [ "$rc" = 0 ] || die "$([ "$rc" = 2 ] && echo "the Pages build errored" || echo "live site not up yet")"
  echo "live: up"
  exit 0
fi

git rev-parse --git-dir >/dev/null 2>&1 || die "not in a git repo"
cd "$(git rev-parse --show-toplevel)"

git show-ref --verify --quiet "refs/heads/$BASE" || die "no branch $BASE"

# Find the worktree that holds the working branch (it is where the checks run).
base_wt=$(git worktree list --porcelain | awk -v b="refs/heads/$BASE" '
  $1 == "worktree" { p = substr($0, 10) } $1 == "branch" && $2 == b { print p }')
[ -n "$base_wt" ] || die "$BASE is not checked out in any worktree; the checks need one"
[ -z "$(git -C "$base_wt" status --porcelain)" ] || die "$BASE worktree ($base_wt) has uncommitted changes"

# A checked-out `site` would have its working tree desync when the branch moves.
if git worktree list --porcelain | grep -qx 'branch refs/heads/site'; then
  die "site is checked out in a worktree; remove that worktree first"
fi

git fetch origin site
git show-ref --verify --quiet refs/remotes/origin/site || die "no origin/site after fetch"

sha=$(git rev-parse "refs/heads/$BASE")
echo "publishing $BASE @ $sha"

# The suite is not run here; the cheap sync check still is.
(cd "$base_wt" && node tools/sync.mjs --check)
[ "$(git rev-parse "refs/heads/$BASE")" = "$sha" ] || die "$BASE moved while the checks ran"

# A stale site-publish from an earlier run would make the split ambiguous.
git show-ref --verify --quiet refs/heads/site-publish && git branch -D site-publish >/dev/null
cleanup() { git show-ref --verify --quiet refs/heads/site-publish && git branch -D site-publish >/dev/null || true; }
trap cleanup EXIT

git subtree split --prefix=site -b site-publish "refs/heads/$BASE" 2>&1 | tr "\r" "\n" | tail -n 1 >/dev/null
split=$(git rev-parse refs/heads/site-publish)
git merge-base --is-ancestor refs/remotes/origin/site refs/heads/site-publish \
  || die "origin/site is not an ancestor of the split: site diverged, push would not fast-forward"

if [ "$split" = "$(git rev-parse refs/remotes/origin/site)" ]; then
  echo "nothing to publish: site/ at $BASE equals origin/site"
  exit 0
fi

echo "split $split fast-forwards origin/site $(git rev-parse --short refs/remotes/origin/site)"
git diff --stat refs/remotes/origin/site refs/heads/site-publish | tail -n 5

if [ "$dry" = 1 ]; then
  echo "dry run: site not moved, nothing pushed"
  exit 0
fi

git branch -f site refs/heads/site-publish
cleanup
git push origin refs/heads/site:refs/heads/site
echo "published site @ $split (from $BASE @ $sha)"

live_checks

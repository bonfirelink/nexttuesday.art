#!/usr/bin/env bash
# Publish the working branch: subtree-split site/ and fast-forward the `site`
# branch that GitHub Pages serves, then verify the live site.
#
#   tools/publish.sh [--dry-run] [--marker TEXT] [--gone TEXT]
#   tools/publish.sh --live-only [--marker TEXT] [--gone TEXT]
#
#   --dry-run    everything up to (not including) moving `site` and pushing
#   --live-only  skip the publish, only run the live checks (read-only)
#   --marker     text that must appear on https://nexttuesday.art/ once live
#   --gone       text that must disappear from it
#
# NTS_BASE names the working branch (default eclipse). The script never
# forces a push: a non-fast-forward split stops it.
set -euo pipefail

BASE=${NTS_BASE:-eclipse}
# This machine's DNS cannot resolve the domain: pin it to a GitHub Pages IP.
RESOLVE=nexttuesday.art:443:185.199.108.153
PAGES=(/ /embers/ /not-not-philo/ /intersect/ /events/)
TRIES=10
WAIT=30

dry=0 live_only=0 marker="" gone=""
while [ $# -gt 0 ]; do
  case $1 in
    --dry-run) dry=1 ;;
    --live-only) live_only=1 ;;
    --marker) marker=${2:?--marker needs text}; shift ;;
    --gone) gone=${2:?--gone needs text}; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

die() { echo "publish: $*" >&2; exit 1; }
fetch_home() { curl -sS --max-time 20 --resolve "$RESOLVE" https://nexttuesday.art/; }

# owner/name of the GitHub repo: from gh, else from the origin URL.
repo_slug() {
  gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null && return 0
  git remote get-url origin | sed -E 's#^(git@[^:]+:|https?://[^/]+/)##; s#\.git$##'
}

live_checks() {
  local try body ok=0
  if [ -n "$marker$gone" ]; then
    for ((try = 1; try <= TRIES; try++)); do
      body=$(fetch_home || true)
      ok=1
      if [ -n "$marker" ] && ! grep -qF -- "$marker" <<<"$body"; then ok=0; fi
      if [ -n "$gone" ] && grep -qF -- "$gone" <<<"$body"; then ok=0; fi
      [ "$ok" = 1 ] && break
      echo "live: change not there yet (try $try/$TRIES)"
      [ "$try" -lt "$TRIES" ] && sleep "$WAIT"
    done
    [ "$ok" = 1 ] || die "live site never showed the change after $TRIES tries"
    echo "live: change is up"
  fi
  local p code bad=0
  if [ -z "$marker$gone" ]; then
    echo "WARNING: no --marker or --gone: the 200 checks may be hitting the old site" >&2
  fi
  for p in "${PAGES[@]}"; do
    code=$(curl -sS -o /dev/null --max-time 20 -w '%{http_code}' --resolve "$RESOLVE" "https://nexttuesday.art$p" || echo 000)
    echo "live: $code $p"
    [ "$code" = 200 ] || bad=1
  done
  [ "$bad" = 0 ] || die "a page did not answer 200"
  # The Pages build outlives the push: wait for it rather than report a stale status.
  local slug status=""
  slug=$(repo_slug) || die "cannot work out the GitHub repo (gh repo view and origin URL both failed)"
  for ((try = 1; try <= TRIES; try++)); do
    status=$(gh api "repos/$slug/pages/builds/latest" --jq .status) || die "gh api failed for pages build status"
    echo "pages build: ${status:-<empty>} (try $try/$TRIES)"
    case $status in
      built) return 0 ;;
      errored|"") die "pages build status is '${status:-empty}'" ;;
    esac
    [ "$try" -lt "$TRIES" ] && sleep "$WAIT"
  done
  die "pages build still '$status' after $TRIES tries"
}

if [ "$live_only" = 1 ]; then live_checks; exit 0; fi

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

# Publish suite on the exact commit that gets split.
if [ -f "$base_wt/package.json" ] && grep -q '"test:publish"' "$base_wt/package.json"; then
  (cd "$base_wt" && npm run test:publish)
else
  echo "WARNING: no test:publish script; only the sync check ran, the suite did not" >&2
  (cd "$base_wt" && node tools/sync.mjs --check)
fi
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

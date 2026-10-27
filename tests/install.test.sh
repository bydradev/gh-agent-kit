#!/usr/bin/env bash
# Tests for install.sh against scratch targets, from a scratch clone of this
# repository (install.sh refuses uncommitted kit files, so it runs from
# committed history: commit before running locally; CI checks out with full
# history).
#
#   bash tests/install.test.sh
set -euo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
export GIT_AUTHOR_NAME=Test GIT_AUTHOR_EMAIL=test@example.com
export GIT_COMMITTER_NAME=Test GIT_COMMITTER_EMAIL=test@example.com
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1

failures=0
passes=0
current=""
it() { current=$1; }
ok() { passes=$((passes + 1)); }
fail() {
  failures=$((failures + 1))
  echo "not ok - $current: $*" >&2
}
check() { if "$@"; then ok; else fail "$*"; fi; }
contains() { grep -qF -- "$2" "$1"; }

# The kit as committed, with full history.
kit="$work/kit"
git clone -q --no-hardlinks "$repo" "$kit"
git -C "$kit" checkout -q "$(git -C "$repo" rev-parse HEAD)"
head=$(git -C "$kit" rev-parse HEAD)
manifest_paths() { sed -n '/^#/d; /^$/d; s/^seed //; p' "$kit/kit-manifest.txt"; }

n=0
# Sets t to a new, empty git repository.
new_target() {
  n=$((n + 1))
  t="$work/target$n"
  mkdir -p "$t"
  git -C "$t" init -q -b main
}
install() { "$kit/install.sh" "$@" > "$work/out" 2>&1; }

it "a fresh install copies every manifest file and writes the lock"
new_target
check install "$t"
while IFS= read -r p; do
  check cmp -s "$kit/$p" "$t/$p"
done < <(manifest_paths)
check test -x "$t/.github/scripts/sync-labels.sh"
check contains "$t/.github/gh-agent-kit.lock" '"source": "github.com/bydradev/gh-agent-kit",'
check contains "$t/.github/gh-agent-kit.lock" "\"ref\": \"$head\","
check contains "$t/.github/gh-agent-kit.lock" '"dirty": false,'
check contains "$t/.github/gh-agent-kit.lock" '"seeds": [".github/security-review-instructions.md"],'
check test ! -e "$t/.github/agent-kit.lock"

it "a second install changes nothing, the lock included"
cp "$t/.github/gh-agent-kit.lock" "$work/lock.before"
check install "$t"
check cmp -s "$work/lock.before" "$t/.github/gh-agent-kit.lock"
check contains "$work/out" "unchanged  .github/gh-agent-kit.lock"
check test -z "$(grep -E '^(updated|added|linked|removed|wrote) ' "$work/out")"

it "a seed file is the target's own; any other kit file is replaced"
echo "our rules" > "$t/.github/security-review-instructions.md"
echo "edited" >> "$t/.github/workflows/pr-review.yml"
chmod -x "$t/.github/scripts/sync-labels.sh"
check install "$t"
check contains "$work/out" "kept       .github/security-review-instructions.md"
check test "$(cat "$t/.github/security-review-instructions.md")" = "our rules"
check cmp -s "$kit/.github/workflows/pr-review.yml" "$t/.github/workflows/pr-review.yml"
check test -x "$t/.github/scripts/sync-labels.sh"

it "a hard link to a kit file keeps its old content"
new_target
check install "$t"
echo "edited" >> "$t/.github/workflows/pr-review.yml"
ln "$t/.github/workflows/pr-review.yml" "$work/hardlink"
check install "$t"
check contains "$work/hardlink" "edited"

it "the installer refuses a bad target"
check test "$(install "$work/missing"; echo $?)" = 2
mkdir -p "$work/plain"
check test "$(install "$work/plain"; echo $?)" = 2
check contains "$work/out" "is not a git repository"
check test "$(install "$kit"; echo $?)" = 2
check contains "$work/out" "the target is this clone"

it "a subdirectory of a target installs at its top"
new_target
mkdir -p "$t/sub/dir"
check install "$t/sub/dir"
check test -f "$t/.github/gh-agent-kit.lock"
check test ! -e "$t/sub/dir/.github"

it "a symlink or non-file on a managed path is refused before anything is written"
new_target
mkdir -p "$work/elsewhere" "$t/.github"
ln -s "$work/elsewhere" "$t/.github/workflows"
check test "$(install "$t"; echo $?)" = 2
check contains "$work/out" "is a symlink"
check test -z "$(ls -A "$work/elsewhere")"
check test ! -e "$t/.github/scripts"
new_target
mkdir -p "$t/.github/workflows/pr-review.yml"
check test "$(install "$t"; echo $?)" = 2
check contains "$work/out" "exists and is not a regular file"
check test ! -e "$t/.github/scripts"
new_target
mkdir -p "$t/.github"
ln -s "$work/elsewhere/lock" "$t/.github/gh-agent-kit.lock"
check test "$(install "$t"; echo $?)" = 2
check test ! -e "$work/elsewhere/lock"

it "a dirty kit clone is refused, or recorded with KIT_ALLOW_DIRTY=1"
new_target
echo "# local" >> "$kit/.github/workflows/pr-review.yml"
check test "$(install "$t"; echo $?)" = 2
check contains "$work/out" "uncommitted changes to kit files"
check test ! -e "$t/.github"
check env KIT_ALLOW_DIRTY=1 "$kit/install.sh" "$t" > "$work/out" 2>&1
check contains "$t/.github/gh-agent-kit.lock" '"dirty": true,'
git -C "$kit" checkout -q -- .github/workflows/pr-review.yml

it "skills are linked into a real .claude/skills, and a link of the target's own stays"
new_target
mkdir -p "$t/.claude/skills"
ln -s ../../elsewhere "$t/.claude/skills/github-issue-e2e"
check install "$t"
check test "$(readlink "$t/.claude/skills/github-pr-review")" = "../../.agents/skills/github-pr-review"
check test "$(readlink "$t/.claude/skills/github-issue-e2e")" = "../../elsewhere"
check contains "$work/out" "kept       .claude/skills/github-issue-e2e (not the kit's symlink"

it "a target without .claude/skills gets the directory and the links"
new_target
check install "$t"
check test -d "$t/.claude/skills"
check test ! -L "$t/.claude/skills"
check test "$(readlink "$t/.claude/skills/github-pr-review")" = "../../.agents/skills/github-pr-review"
check test -f "$t/.claude/skills/github-issue-triage/SKILL.md"
check contains "$work/out" "added      .claude/skills"
check grep -qx ".claude/skills/github-pr-review" "$work/out"
check install "$t"
check test -z "$(grep -E '^(added|linked) ' "$work/out")"

it "a .claude that is a file or a symlink is left alone, and the install goes on"
new_target
echo "not a directory" > "$t/.claude"
check install "$t"
check test "$(cat "$t/.claude")" = "not a directory"
check contains "$work/out" "kept       .claude/skills (not a directory"
check test -f "$t/.agents/skills/github-pr-review/SKILL.md"
new_target
mkdir "$t/.claude"
echo "not a directory" > "$t/.claude/skills"
check install "$t"
check test "$(cat "$t/.claude/skills")" = "not a directory"
check contains "$work/out" "kept       .claude/skills (not a directory"
check test -f "$t/.github/gh-agent-kit.lock"
new_target
mkdir -p "$work/claude-elsewhere"
ln -s "$work/claude-elsewhere" "$t/.claude"
check install "$t"
check test -z "$(ls -A "$work/claude-elsewhere")"
check contains "$work/out" "kept       .claude/skills (a symlink"

# Every path in a target with its mode, size, time and checksum, so a check
# can show that nothing was written.
snapshot() {
  (cd "$1" && find . -path ./.git -prune -o -print | LC_ALL=C sort | while IFS= read -r f; do
    ls -ld -- "$f"
    if [ -f "$f" ] && [ ! -L "$f" ]; then cksum < "$f"; fi
  done)
}
check_mode() { "$kit/install.sh" --check "$@" > "$work/out" 2>&1; }

it "--check on a current target exits 0 and writes nothing"
new_target
mkdir -p "$t/.claude/skills"
check install "$t"
snapshot "$t" > "$work/before"
check test "$(check_mode "$t"; echo $?)" = 0
check contains "$work/out" "Check: the target is current"
snapshot "$t" > "$work/after"
check cmp -s "$work/before" "$work/after"

it "--check on an empty target exits 1, lists the install and writes nothing"
new_target
snapshot "$t" > "$work/before"
check test "$(check_mode "$t"; echo $?)" = 1
check contains "$work/out" "added      .github/workflows/pr-review.yml"
check contains "$work/out" "added      .claude/skills"
check contains "$work/out" "linked     .claude/skills/github-pr-review"
check contains "$work/out" "wrote      .github/gh-agent-kit.lock"
check contains "$work/out" "nothing was written"
snapshot "$t" > "$work/after"
check cmp -s "$work/before" "$work/after"

it "--check reports an edited file and a lost exec bit without fixing them"
new_target
check install "$t"
echo "edited" >> "$t/.github/workflows/pr-review.yml"
chmod -x "$t/.github/scripts/sync-labels.sh"
snapshot "$t" > "$work/before"
check test "$(check_mode "$t"; echo $?)" = 1
check contains "$work/out" "updated    .github/workflows/pr-review.yml"
check contains "$work/out" "updated    .github/scripts/sync-labels.sh (made executable)"
check contains "$work/out" "make the 2 change(s) above"
snapshot "$t" > "$work/after"
check cmp -s "$work/before" "$work/after"
check install "$t"
check contains "$work/out" "updated    .github/scripts/sync-labels.sh (made executable)"
check test -x "$t/.github/scripts/sync-labels.sh"

it "keeps an existing directory's mode, and --check agrees"
new_target
check install "$t"
chmod 0700 "$t/.github/workflows"
check test "$(check_mode "$t"; echo $?)" = 0
check install "$t"
check test "$(stat -c %a "$t/.github/workflows")" = 700

it "--check exits 2 where an install would be refused, and on bad arguments"
new_target
mkdir -p "$t/.github"
ln -s "$work/elsewhere" "$t/.github/workflows"
check test "$(check_mode "$t"; echo $?)" = 2
check contains "$work/out" "is a symlink"
check test "$(check_mode "$t" extra; echo $?)" = 2
check contains "$work/out" "usage:"
check test "$("$kit/install.sh" --check > "$work/out" 2>&1; echo $?)" = 2

# A later kit commit that drops a file and a seed from the manifest.
git -C "$kit" checkout -q -b dropped
sed -i.bak '/^\.github\/ISSUE_TEMPLATE\/config\.yml$/d; /^seed \.github\/security-review-instructions\.md$/d' "$kit/kit-manifest.txt"
rm -f "$kit/kit-manifest.txt.bak"
git -C "$kit" commit -q -am "drop a file and a seed"
dropped=$(git -C "$kit" rev-parse HEAD)

it "an update removes a file the kit dropped and keeps a dropped seed"
new_target
git -C "$kit" checkout -q "$head"
check install "$t"
git -C "$kit" checkout -q "$dropped"
snapshot "$t" > "$work/before"
check test "$(check_mode "$t"; echo $?)" = 1
check contains "$work/out" "removed    .github/ISSUE_TEMPLATE/config.yml (no longer in the kit)"
snapshot "$t" > "$work/after"
check cmp -s "$work/before" "$work/after"
check install "$t"
check test ! -e "$t/.github/ISSUE_TEMPLATE/config.yml"
check contains "$work/out" "removed    .github/ISSUE_TEMPLATE/config.yml (no longer in the kit)"
check test -f "$t/.github/security-review-instructions.md"
check contains "$work/out" "kept       .github/security-review-instructions.md (a seed file the kit no longer ships"
check contains "$t/.github/gh-agent-kit.lock" "\"ref\": \"$dropped\","

it "a lock whose ref is not in the clone's history removes nothing"
new_target
git -C "$kit" checkout -q "$head"
check install "$t"
sed -i.bak "s/\"ref\": \"$head\"/\"ref\": \"$(printf '1%.0s' {1..40})\"/" "$t/.github/gh-agent-kit.lock"
rm -f "$t/.github/gh-agent-kit.lock.bak"
git -C "$kit" checkout -q "$dropped"
check install "$t"
check contains "$work/out" "is not in the history of this clone's commit"
check test -f "$t/.github/ISSUE_TEMPLATE/config.yml"
git -C "$kit" checkout -q "$head"

# Before the rename to gh-agent-kit the installer wrote
# .github/agent-kit.lock and .github/agent-kit/LICENSE. This repository's
# history starts after the rename, so the clone gets a kit commit with the
# licence at its old path (before_rename) and one that moves it back
# (after_rename), and old_install leaves a target as an install from
# before_rename did: the licence at the old path, the lock under its old
# name and with the kit's old name as its source.
mkdir -p "$kit/.github/agent-kit"
git -C "$kit" mv .github/gh-agent-kit/LICENSE .github/agent-kit/LICENSE
sed -i.bak 's/^\.github\/gh-agent-kit\/LICENSE$/.github\/agent-kit\/LICENSE/' "$kit/kit-manifest.txt"
rm -f "$kit/kit-manifest.txt.bak"
git -C "$kit" commit -q -am "the licence at its path before the rename"
before_rename=$(git -C "$kit" rev-parse HEAD)
after_rename=$(git -C "$kit" commit-tree -p "$before_rename" -m "the licence at its path after the rename" "$head^{tree}")
git -C "$kit" checkout -q "$after_rename"
old_install() {
  git -C "$kit" checkout -q "$before_rename" \
    && "$kit/install.sh" "$1" \
    && mv "$1/.github/gh-agent-kit.lock" "$1/.github/agent-kit.lock" \
    && sed -i.bak 's/"source": "github.com\/bydradev\/gh-agent-kit"/"source": "github.com\/bydradev\/github-agent-kit"/' "$1/.github/agent-kit.lock" \
    && rm -f "$1/.github/agent-kit.lock.bak"
  local status=$?
  git -C "$kit" checkout -q "$after_rename"
  return "$status"
}

it "an install from before the rename is migrated to the new lock and licence path"
new_target
check old_install "$t" > "$work/out" 2>&1
check test -f "$t/.github/agent-kit.lock"
check test -f "$t/.github/agent-kit/LICENSE"
git -C "$t" add -A && git -C "$t" commit -q -m "kit before the rename"
check test "$(check_mode "$t"; echo $?)" = 1
check contains "$work/out" "removed    .github/agent-kit.lock (replaced by .github/gh-agent-kit.lock)"
check test -f "$t/.github/agent-kit.lock"
check test -f "$t/.github/agent-kit/LICENSE"
check test ! -e "$t/.github/gh-agent-kit.lock"
check install "$t"
check test ! -e "$t/.github/agent-kit.lock"
check test ! -e "$t/.github/agent-kit"
check test -f "$t/.github/gh-agent-kit/LICENSE"
check contains "$t/.github/gh-agent-kit.lock" '"source": "github.com/bydradev/gh-agent-kit",'
check contains "$work/out" "removed    .github/agent-kit.lock (replaced by .github/gh-agent-kit.lock)"
check contains "$work/out" ".github/agent-kit/LICENSE"

it "a migration whose old ref the clone cannot check still removes the old licence copy"
new_target
check old_install "$t" > "$work/out" 2>&1
sed -i.bak "s/\"ref\": \"[0-9a-f]*\"/\"ref\": \"$(printf '1%.0s' {1..40})\"/" "$t/.github/agent-kit.lock"
rm -f "$t/.github/agent-kit.lock.bak"
check install "$t"
check test ! -e "$t/.github/agent-kit/LICENSE"
check test ! -e "$t/.github/agent-kit.lock"

it "a migration whose old ref the clone cannot check keeps an edited old licence copy"
new_target
check old_install "$t" > "$work/out" 2>&1
sed -i.bak "s/\"ref\": \"[0-9a-f]*\"/\"ref\": \"$(printf '1%.0s' {1..40})\"/" "$t/.github/agent-kit.lock"
rm -f "$t/.github/agent-kit.lock.bak"
echo "ours" >> "$t/.github/agent-kit/LICENSE"
check install "$t"
check contains "$t/.github/agent-kit/LICENSE" "ours"
check contains "$work/out" "kept       .github/agent-kit/LICENSE (not the kit's licence text"
check test ! -e "$t/.github/agent-kit.lock"

it "a migration whose old ref the clone cannot check removes the old licence copy after the kit's licence text changed"
new_target
check old_install "$t" > "$work/out" 2>&1
sed -i.bak "s/\"ref\": \"[0-9a-f]*\"/\"ref\": \"$(printf '1%.0s' {1..40})\"/" "$t/.github/agent-kit.lock"
rm -f "$t/.github/agent-kit.lock.bak"
echo "appendix" >> "$kit/.github/gh-agent-kit/LICENSE"
git -C "$kit" commit -qam "licence text changes"
check install "$t"
check test ! -e "$t/.github/agent-kit/LICENSE"
check test ! -e "$t/.github/agent-kit.lock"
git -C "$kit" reset -q --hard HEAD~1

it "a target with both locks is refused"
new_target
check old_install "$t" > "$work/out" 2>&1
cp "$t/.github/agent-kit.lock" "$t/.github/gh-agent-kit.lock"
check test "$(install "$t"; echo $?)" = 2
check contains "$work/out" "has both .github/gh-agent-kit.lock and .github/agent-kit.lock"
check test -f "$t/.github/agent-kit/LICENSE"

echo "$passes passed, $failures failed"
[ "$failures" -eq 0 ]

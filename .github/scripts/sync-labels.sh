#!/usr/bin/env bash
# Create or update the agent work-tracking labels on a repository.
# Idempotent: re-running updates colours and descriptions in place.
#
#   .github/scripts/sync-labels.sh                       # current repository
#   .github/scripts/sync-labels.sh owner/repo
#   .github/scripts/sync-labels.sh --migrate [owner/repo]
#
# Labels an earlier release of the kit used and this one dropped are listed,
# never deleted, unless --migrate is given: it first takes the label off
# every issue and pull request carrying one, adding its replacement (docs
# to chore, unless the issue already has a type; blocked to needs-operator,
# on open issues only; ready has none, since agent:approved alone approves
# now), then deletes the dropped label.
set -euo pipefail

migrate=0
if [ "${1:-}" = "--migrate" ]; then
  migrate=1
  shift
fi
repo="${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"

# name|colour|description
labels='
bug|d73a4a|Something is wrong
feature|a2eeef|New behaviour or capability
chore|cfd3d7|Maintenance, tooling, dependencies, documentation
P0|b60205|Critical: data loss, security, broken main or release path
P1|d93f0b|High: wrong behaviour on a realistic path or an unmet requirement
P2|fbca04|Medium: limited impact; fix or give a reason
P3|c2e0c6|Low: optional improvement
needs-triage|ededed|Waiting for the triage bot
triaged|bfd4f2|Assessed and planned by the bot; stays while in-progress is added
in-progress|1d76db|An agent has claimed it; see the claim comment
needs-operator|f9d0c4|A question or decision only the operator can answer
agent:approved|5319e7|Operator authority to implement; only the operator sets this
requested|0e8a16|The operator asked for this directly; the issue records the request
'

# dropped|replacement (empty: none)
dropped='
docs|chore
blocked|needs-operator
ready|
'

# The loops read their lists on descriptor 3, so a command in the body
# that reads standard input cannot swallow the rest of the list.
while IFS='|' read -r -u 3 name colour description; do
  [ -z "$name" ] && continue
  # --force updates an existing label in place, so no listing (and no page
  # limit) is involved.
  gh label create "$name" --repo "$repo" --color "$colour" --description "$description" --force >/dev/null
  echo "synced  $name"
done 3<<< "$labels"

while IFS='|' read -r -u 3 name replacement; do
  [ -z "$name" ] && continue
  # A label the repository does not have is a 404 and nothing to do; any
  # other failure stops the script rather than pass for "absent".
  if ! err=$(gh api "repos/$repo/labels/$name" --silent 2>&1); then
    case "$err" in
      *"HTTP 404"*) continue ;;
      *) echo "error: could not read the label $name: $err" >&2; exit 1 ;;
    esac
  fi
  if [ "$migrate" -eq 0 ]; then
    echo "dropped $name (still on the repository; run with --migrate to move its issues${replacement:+ to $replacement} and delete it)"
    continue
  fi
  # Every issue and pull request carrying it, open or closed, on every
  # page (the issues endpoint lists both), read in full before any change.
  # Whether it has a type is read from the label array itself, so a label
  # whose name merely contains "bug" or a comma is not taken for one.
  items=$(gh api --paginate "repos/$repo/issues?labels=$name&state=all&per_page=100" \
    --jq '.[] | "\(.number) \(.state) \(any(.labels[].name; . == "bug" or . == "feature" or . == "chore"))"')
  while read -r -u 4 n state typed; do
    [ -n "$n" ] || continue
    add=$replacement
    case "$name" in
      # A closed issue keeps no open-looking state label.
      blocked) [ "$state" = open ] || add="" ;;
      # An issue that already has a type keeps it alone.
      docs) [ "$typed" = false ] || add="" ;;
    esac
    # The replacement first, so a failure never leaves the issue with
    # neither label.
    if [ -n "$add" ]; then
      gh api --method POST "repos/$repo/issues/$n/labels" -f "labels[]=$add" --silent
    fi
    gh api --method DELETE "repos/$repo/issues/$n/labels/$name" --silent
    echo "moved   #$n off $name${add:+ to $add}"
  done 4<<< "$items"
  gh api --method DELETE "repos/$repo/labels/$name" --silent
  echo "deleted $name"
done 3<<< "$dropped"

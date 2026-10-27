#!/usr/bin/env bash
# Create or update the agent work-tracking labels on a repository.
# Idempotent: re-running updates colours and descriptions in place.
#
#   .github/scripts/sync-labels.sh            # current repository
#   .github/scripts/sync-labels.sh owner/repo
set -euo pipefail

repo="${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"

# name|colour|description
labels='
bug|d73a4a|Something is wrong
feature|a2eeef|New behaviour or capability
chore|cfd3d7|Maintenance, tooling, dependencies
docs|0075ca|Documentation only
P0|b60205|Critical: data loss, security, broken main or release path
P1|d93f0b|High: wrong behaviour on a realistic path or an unmet requirement
P2|fbca04|Medium: limited impact; fix or give a reason
P3|c2e0c6|Low: optional improvement
needs-triage|ededed|Waiting for the triage bot
triaged|bfd4f2|Assessed and planned by the bot; stays while ready, in-progress or blocked are added
ready|0e8a16|Operator-approved spec; may be picked up once agent:approved is set
in-progress|1d76db|An agent has claimed it; see the claim comment
blocked|e4e669|Cannot proceed; the comment says why
needs-operator|f9d0c4|A question or decision only the operator can answer
agent:approved|5319e7|Operator authority to implement; only the operator sets this
'

while IFS='|' read -r name colour description; do
  [ -z "$name" ] && continue
  # --force updates an existing label in place, so no listing (and no page
  # limit) is involved.
  gh label create "$name" --repo "$repo" --color "$colour" --description "$description" --force >/dev/null
  echo "synced  $name"
done <<< "$labels"

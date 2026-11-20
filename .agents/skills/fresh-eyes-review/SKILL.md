---
name: fresh-eyes-review
description: Use before completing substantial work, readying a branch or PR for review, or handling review findings.
---
<!-- gh-repo-bootstrapper: template-owned; sha256=316e5788c82ebc9fea1c7934a2b76cc2015a2d34e9c31084283875d4824190a8 -->

# Independent fresh-eyes review

For substantial work, use a different agent or person from the implementer.
Review each substantial phase before completion and the whole change before
declaring the branch or PR ready. One review serves both when it covers the
whole change at the proposed base and head for the same requested outcome.
Get an independent follow-up on later material changes, including review
fixes. A small edit that leaves the assessment valid needs no new round.
For rebases and other follow-ups, apply `review-guidelines`.

Prefer a stronger reasoning model and, where practical, another model family.
Give the reviewer the requested outcome, requirements, diff or changed files,
base and head commits, and validation results. For follow-ups, include the last
report and subsequent commits. The reviewer assesses the evidence independently
using `review-guidelines` (`.agents/skills/review-guidelines/SKILL.md`).

## Handling findings

These rules apply to the findings of every review, whoever started it. Treat
review findings as unverified until assessed against the repository and the
requested outcome: a finding is a claim, whatever its source or severity.

- Reproduce or trace each finding on the current code before changing
  anything.
- If it holds, fix the root cause, check similar code elsewhere, and, where
  practical, add a test that fails without the fix. Reply with the finding's
  ID, the commit, and how you checked it.
- If it does not hold, reply with the ID and the evidence, such as the guard,
  the test or the documented trade-off. Never change code just to satisfy a
  reviewer.
- If a fix would cost more than the risk it removes, say so. You may decline a
  P2 or P3 with that reason; a P0 or P1 is the operator's to accept or defer.
- Severity is the reviewer's estimate: dispute it with evidence, never quietly
  downgrade it.

Resolve valid blocking findings before completion or PR readiness.
`review-guidelines` defines which P0 and P1 findings block.

After three review rounds with blocking findings still open, stop and escalate
to the operator rather than starting another round: list the open findings,
what each round changed, and your recommendation.

OpenCode's free-tier models on its own provider currently refuse an agent whose
shell is denied, as this repository's OpenCode reviewer's is, with "can only be
used from within OpenCode" (OpenCode issue 49723, open on 2026-10-22). Run that
reviewer with another model or use another reviewer; don't loosen its
permissions.

## Cross-family review recipe

This recipe works in any harness. Save the diff, the requested outcome, the
relevant requirements, and the validation results to the session's scratch
directory (see the
`worktrees-and-scratch` skill). Save the base branch's `review-guidelines`
there too, or the head copy when the base branch has none, since a change can
edit the skill that reviews it. Write the reviewer prompt to a file there,
telling the reviewer to follow that saved copy instead of the worktree's, then
run the reviewer read-only from inside a git worktree:

```sh
git diff <base>...HEAD > <scratch>/review.diff
if git cat-file -e <base>:.agents/skills/review-guidelines/SKILL.md 2>/dev/null; then
  git show <base>:.agents/skills/review-guidelines/SKILL.md
else
  cat .agents/skills/review-guidelines/SKILL.md
fi > <scratch>/review-guidelines.md
codex exec --sandbox read-only --ephemeral -o <out> - < <prompt>
```

When the implementer is Codex, use another installed harness in read-only mode
instead, such as `claude -p`, the Antigravity CLI, or OMO. Read `<out>`, assess
each finding as *Handling findings* says, and delete the scratch files when the
review is done.

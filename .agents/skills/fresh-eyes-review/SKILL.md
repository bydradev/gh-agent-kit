---
name: fresh-eyes-review
description: >-
  Use before declaring substantial work complete or a branch or pull request ready for review, after review fixes cause material changes, or when handling the findings of any review. Covers who reviews, what to hand the reviewer, how to verify, fix or dispute findings, when to review and re-review, and a cross-family recipe using a read-only reviewer from another model family. The reviewer follows `review-guidelines`.
---
<!-- gh-repo-bootstrapper: template-owned; sha256=1c0fc2c70eead72ba511e275330344d7fbeb4e24ae0ea4153e3133ecc161ebee -->

# Independent fresh-eyes review

Before substantial changes are considered complete or ready for review, perform
an independent fresh-eyes review of the resulting change.

The review must be performed by a different agent or reviewer from the one that
implemented the work. When model choice is available, prefer a stronger
reasoning model and, where practical, a different model family from the
implementation agent.

Provide the reviewer with the user's requested outcome, relevant repository
requirements and specifications, the resulting diff or changed files with
their base and head commits, and available validation results; for a follow-up
review, also the last report and the commits since. The reviewer should independently assess the change rather
than rely on the implementing agent's conclusions.

The reviewer follows the `review-guidelines` skill
(`.agents/skills/review-guidelines/SKILL.md`): what to check, initial and
follow-up reviews, severities P0 to P3, finding IDs, statuses and the report
format.

Perform fresh-eyes review at meaningful quality gates: after a substantial
implementation phase before it is considered complete, and before a completed
branch or pull request is declared ready for review. Do not require a new review
for every small edit or intermediate push.

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

Resolve valid blocking findings (`review-guidelines` says which P0 and P1
findings block) before declaring the work complete.

If resolving review findings results in material changes, perform another
independent fresh-eyes review of those changes before completion.

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

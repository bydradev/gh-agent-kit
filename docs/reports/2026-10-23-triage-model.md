# Triage model backtest (2026-10-23)

Can Haiku 5.5 at effort `high` replace Sonnet 5.5 at `medium` for
`issue-triage`? **No. Keep Sonnet 5.5 at `medium`**, the kit's default
(`KIT_TRIAGE_MODEL` and `KIT_TRIAGE_EFFORT` unset; Claude Code runs Sonnet
5.5 at `medium` when no effort is given,
<https://code.claude.com/docs/en/model-config>, read 2026-10-23).

On a decision rule fixed before any run, Haiku 5.5 at `high` fails five of
the six tests. It is about nine times cheaper per run, never errored and
never left an issue in an illegal state, but it gets the labels wrong in a
consistent direction: it rates priority one level higher than the operator
accepted in 26 of 63 runs, reads hardening and follow-up chores as bugs,
and plans where Sonnet stopped to ask. Its plans are as accurate line by
line but cover less of what the fix needed. The failure is
not only plan quality, so a split (Haiku for labels, Sonnet for plans) does
not help: the labels are its weakest part.

| Measure | Haiku 5.5 | Rule | Sonnet replay |
| --- | --- | --- | --- |
| Priority matches production | 12 of 21 | 18 | 21 |
| Type matches production | 16 of 21 | 20 | 18 |
| Issues the grader would approve | 15 of 19 | 17 | 18 |
| Median cost per run | $0.011 | | $0.098 |

## The arms

- **S0, production:** the 21 billed triage runs on Sonnet 5.5, as they
  ran. It is the reference, since the operator changed no type or priority
  label it set.
- **S, Sonnet replay:** one replay per case on Sonnet 5.5 at the kit's
  default effort, shown so the harness noise is visible.
- **H, Haiku 5.5 at `high`:** three replays per case; its value per case is
  the majority of the three.

## The fixed decision rule

| Test | Threshold | Haiku | Sonnet replay | Result |
| --- | --- | --- | --- | --- |
| Type matches S0 | at least 20 of 21 | 16 | 18 | fail |
| Priority matches S0, never more than one level off | at least 18 of 21 | 12, at most 1 off | 21 | fail |
| Plan or questions matches S0 | at least 20 of 21 | 19 | 21 | fail |
| Illegal end states; refusals or errors in 63 runs | 0; at most 1 | 0; 0 | 0; 0 | pass |
| Cases with a wrong reference that would mislead an implementer | at most 2 | 6 (all trials), 3 (trial 1) | 3 | fail |
| Issues rated "would approve" (as written or small edits); mean coverage within 0.5 of S0 | at least 17 of 19; gap at most 0.5 | 15; 3.57 against 4.33 | 18; 4.10 | fail |

Outcome counts a "Triage (revised)" plan as a plan: on kit E's second run
S0 headed its plan "Triage" while both replays headed theirs "Triage
(revised)", and on kit I the Sonnet replay did the same. Approval is
counted on the last run per issue (kit C's edited run, kit E's run after
the answers).

## What Haiku does differently

### It inflates priority, every time in the same direction

26 of 63 Haiku runs set priority one level above S0 and none set it lower;
the Sonnet replay matched all 21. Six cases went P3 to P2 and three went P2
to P1. The majority P1 calls are all on security-flavoured issues (kit C,
kit Q and pilot B), where Haiku reads a gap in a gate as "the
weakened or skipped check case of P1". On kit G it overrides the reporter
in so many words: "The reporter suggests P3, but a stale pass on a required
check is a limited-impact defect (P2)".

### It reads chores as bugs

15 of 63 Haiku runs labelled a chore as a bug, and on four issues
(kit C, kit N, kit O and pilot B) all three trials did. The
Sonnet replay disagreed with S0 on three issues too (kit C as feature,
kit N and kit O as bug), so part of this is a genuinely blurry line in
the type table; Haiku crosses it more often and more consistently.

### It plans where it should ask

Production asked questions on two issues, kit E and kit J, and the
operator's later answers show both were real decisions. The Sonnet replay
asked on both. Haiku asked in 2 of 6 trials, so its majority was a plan on
both, and the grader marked both plans as the wrong call (kit E's plan
decides what the issue reserved for the operator).

### Its plans are accurate but thinner

Graded blind against each closing pull request (or, for kit Q and
pilot A, open then, against the issue and the repository), Haiku's
trial 1 matched the Sonnet replay on factual accuracy (4.52 each, S0 4.71)
but scored lower on coverage (3.57 against 4.10 and 4.33) and on risks
(3.67 against 3.90 and 4.38). It was ranked last of three in 13 of 21
cases, first in 2. Four Haiku plans needed large edits (kit D,
kit J, kit M and kit P), against one for the
Sonnet replay (kit G). On kit M all three Haiku trials pointed the
implementer at the wrong workflow step, an existing *Close the pending
verdict when the review did not finish* step instead of the one the issue
describes.

## Cost and effort

| Arm | Runs | Median cost | Total | Median turns | Median output tokens |
| --- | --- | --- | --- | --- | --- |
| Production Sonnet 5.5 (S0) | 21 | $0.118 | $2.45 | 17 | not recorded |
| Sonnet 5.5 replay (S) | 21 | $0.098 | $2.08 | 16 | 3,041 |
| Haiku 5.5 at `high` (H) | 63 | $0.011 | $0.70 | 19 | 8,171 |

Haiku writes about 2.7 times as many output tokens and takes a few more
turns, but its price still makes a run about nine times cheaper. At the
volume then (21 runs in two days) the saving is roughly $1 a day, which is
small next to an operator correcting two in five priority labels.

## Thresholds in hindsight

- The type bar (20 of 21) is stricter than Sonnet's own replay (18 of 21).
  Set at 18, Haiku still fails with 16.
- Coverage against S0 favours S0, because each closing pull request was
  built from S0's approved plan (17 of the 19 issues have one). Against
  the Sonnet replay the gap is 0.52 (86 against 75 over 21 cases), still
  over 0.5.
- The wrong-reference test counts all 63 Haiku plans against 21 Sonnet
  plans. On trial 1 alone the two tie at 3 cases each, so that test does
  not separate the models; without it Haiku still fails four of six.
- The priority result alone decides it under any reasonable bar: 12 of 21
  against 21 of 21 is not noise.

The verdict stays on the fixed rule, and none of these adjustments would
change it.

## How it was run

- Every billed triage run to that date (21 runs on 19 issues, in the
  kit's original repository and in the private repository the kit was
  extracted from) was
  replayed at its own commit with the pinned CLI 2.1.306, its own
  workflow flags, skill and MCP server, against a stub `gh` that answers
  from the world frozen at the run's start time. No model call reached live
  GitHub.
- The harness was validated first: a 3-case Sonnet check reproduced S0's
  type, priority and outcome on 3 of 3. Across all 84 trials there were 0
  stub misses, 0 errors and 0 illegal end states (each commit's own state
  check).
- Grading was blind. Three fresh agents graded S0, S and Haiku trial 1
  under shuffled letters (7 cases each); a fourth fact-checked Haiku trials
  2 and 3 separately, so that marking them accuracy-only in the same
  packets could not hint which letter was Haiku.
- Known limits: kit C's original body is a reconstruction, since its edit
  history was not available to the harness; kit E may have seen a
  slightly later body; and `search` is emulated rather than GitHub's index.
- Spend: $2.78 of a $12 cap ($2.08 Sonnet, $0.70 Haiku).

## Every case

One row per replayed triage run: 21 runs on 19 issues, in the order they
ran (kit C and kit E each ran twice). The kit's own issues are named kit A to
kit Q, in the order they were opened in the kit's original repository,
which stays private. The two issues from the private repository the kit
was extracted from are named pilot A and pilot B, and their titles are
left out.

- **Issue:** every run started when `needs-triage` was added, except
  kit C's second run, which started when its body was edited.
- **Production (S0 in the text above):** the type and priority Sonnet 5.5
  set when the run happened. Every other column is compared with it.
- **Sonnet replay (S):** one replay on Sonnet 5.5, to show how much the
  same model varies.
- **Haiku run 1 to 3 (trials 1 to 3):** three replays on Haiku 5.5 at
  `high`.
- **Bold:** the labels, or the choice to ask, differ from production.
- **(asks)** and **(plan):** on kit E's first run and kit J, production
  asked the operator questions instead of posting a plan. (asks) marks a
  run that asked too, and (plan) one that posted a plan instead.

### Labels

<!-- The label cells use &nbsp; so each label stays on one line and the
five label columns render at the same width. -->

| Issue | Title | Production | Sonnet replay | Haiku run 1 | Haiku run 2 | Haiku run 3 |
| --- | --- | --- | --- | --- | --- | --- |
| pilot A | (private) | docs&nbsp;P3 | docs&nbsp;P3 | **docs&nbsp;P2** | **docs&nbsp;P2** | **docs&nbsp;P2** |
| pilot B | (private) | chore&nbsp;P2 | chore&nbsp;P2 | **bug&nbsp;P1** | **bug&nbsp;P1** | **bug&nbsp;P1** |
| kit A | range_diff: handle an empty range, unchanged aggregate diffs and an unreachable old_base | bug&nbsp;P2 | bug&nbsp;P2 | bug&nbsp;P2 | bug&nbsp;P2 | bug&nbsp;P2 |
| kit B | CLI download in the review and triage workflows fails on a short rate limit | bug&nbsp;P2 | bug&nbsp;P2 | bug&nbsp;P2 | bug&nbsp;P2 | bug&nbsp;P2 |
| kit C | Apply the write-access screen to triage comments and linked issue bodies | chore&nbsp;P2 | **feature&nbsp;P2** | **bug&nbsp;P1** | **bug&nbsp;P2** | **bug&nbsp;P1** |
| kit C, second run (edited) | Apply the write-access screen to comments in triage mode | chore&nbsp;P2 | chore&nbsp;P2 | chore&nbsp;P2 | chore&nbsp;P2 | chore&nbsp;P2 |
| kit D | Test the update check's comparison and notice steps in CI | chore&nbsp;P3 | chore&nbsp;P3 | **chore&nbsp;P2** | chore&nbsp;P3 | **chore&nbsp;P2** |
| kit E | Out-of-scope findings filed by the reviewer never get triaged | bug&nbsp;P2&nbsp;(asks) | bug&nbsp;P2&nbsp;(asks) | **bug&nbsp;P2&nbsp;(plan)** | bug&nbsp;P2&nbsp;(asks) | **bug&nbsp;P2&nbsp;(plan)** |
| kit F | Workflows point target repositories at a docs/setup.md they do not have | bug&nbsp;P3 | bug&nbsp;P3 | **bug&nbsp;P2** | bug&nbsp;P3 | **bug&nbsp;P2** |
| kit G | A failed re-review can leave an earlier pr-review verdict standing | bug&nbsp;P3 | bug&nbsp;P3 | **bug&nbsp;P2** | **bug&nbsp;P2** | **bug&nbsp;P2** |
| kit H | Update check misses a path moving between seed and managed | bug&nbsp;P3 | bug&nbsp;P3 | bug&nbsp;P3 | bug&nbsp;P3 | bug&nbsp;P3 |
| kit I | Screen the other issues and pull requests triage reads | chore&nbsp;P2 | chore&nbsp;P2 | chore&nbsp;P2 | chore&nbsp;P2 | **bug&nbsp;P2** |
| kit E, second run | Out-of-scope findings filed by the reviewer never get triaged | bug&nbsp;P2 | bug&nbsp;P2 | bug&nbsp;P2 | bug&nbsp;P2 | bug&nbsp;P2 |
| kit J | security-scan: pinned action validates API access with a retired model, which turns off its finding filter | bug&nbsp;P2&nbsp;(asks) | bug&nbsp;P2&nbsp;(asks) | **bug&nbsp;P2&nbsp;(plan)** | **bug&nbsp;P1&nbsp;(plan)** | bug&nbsp;P2&nbsp;(asks) |
| kit K | range_diff: say so plainly when the last reviewed head is gone from the checkout | chore&nbsp;P3 | chore&nbsp;P3 | **bug&nbsp;P3** | **bug&nbsp;P3** | chore&nbsp;P3 |
| kit L | Workflows fail when an unrelated apt source on the runner is down | bug&nbsp;P3 | bug&nbsp;P3 | **bug&nbsp;P2** | **bug&nbsp;P2** | **bug&nbsp;P2** |
| kit M | Test pr-review's no-verdict step with the update check's step harness | chore&nbsp;P3 | chore&nbsp;P3 | chore&nbsp;P3 | chore&nbsp;P3 | chore&nbsp;P3 |
| kit N | Count closes_this_issue only from pull requests by authors with write access | chore&nbsp;P3 | **bug&nbsp;P3** | **bug&nbsp;P3** | **bug&nbsp;P2** | **bug&nbsp;P3** |
| kit O | Count only closing pull requests by authors with write access in the triage stale-check backstop | chore&nbsp;P3 | **bug&nbsp;P3** | **bug&nbsp;P2** | **bug&nbsp;P3** | **bug&nbsp;P2** |
| kit P | pr-review's diff tools honour the head's .gitattributes, so a pull request can hide a file's change from the reviewer | bug&nbsp;P2 | bug&nbsp;P2 | **bug&nbsp;P1** | bug&nbsp;P2 | bug&nbsp;P2 |
| kit Q | pr-review's base-rule restore misses CLAUDE.md imports, quoted paths and symlinks | bug&nbsp;P2 | bug&nbsp;P2 | **bug&nbsp;P1** | **bug&nbsp;P1** | **bug&nbsp;P1** |

### Plan grades

The blind grader's marks for the triage comments from production, the
Sonnet replay and Haiku run 1: a plan, or the questions where the run asked
(kit E's first run and kit J). Each is judged against the pull request
that closed the issue, or the issue and the repository for the two then
open. Coverage is 1 to 5: how much of what the fix needed the comment
anticipated. Approval is whether the operator would accept the comment as
written, with small edits or only with large edits.

| Issue | Coverage: production | Coverage: Sonnet replay | Coverage: Haiku run 1 | Approval: production | Approval: Sonnet replay | Approval: Haiku run 1 |
| --- | --- | --- | --- | --- | --- | --- |
| pilot A | 4 | 5 | 4 | as written | as written | as written |
| pilot B | 3 | 3 | 3 | small edits | small edits | small edits |
| kit A | 3 | 3 | 3 | small edits | small edits | small edits |
| kit B | 5 | 4 | 4 | as written | small edits | small edits |
| kit C | 5 | 4 | 3 | as written | small edits | small edits |
| kit C, second run (edited) | 4 | 4 | 4 | small edits | small edits | small edits |
| kit D | 4 | 5 | 3 | small edits | as written | large edits |
| kit E | 5 | 3 | 4 | as written | small edits | small edits |
| kit F | 4 | 5 | 4 | small edits | small edits | small edits |
| kit G | 5 | 3 | 4 | small edits | large edits | small edits |
| kit H | 5 | 5 | 4 | as written | as written | small edits |
| kit I | 4 | 4 | 4 | as written | small edits | small edits |
| kit E, second run | 5 | 5 | 5 | small edits | as written | as written |
| kit J | 4 | 3 | 2 | as written | small edits | large edits |
| kit K | 4 | 4 | 3 | as written | as written | small edits |
| kit L | 5 | 5 | 4 | as written | as written | as written |
| kit M | 4 | 4 | 2 | as written | as written | large edits |
| kit N | 4 | 5 | 3 | small edits | as written | small edits |
| kit O | 5 | 3 | 4 | small edits | small edits | as written |
| kit P | 4 | 4 | 4 | small edits | small edits | large edits |
| kit Q | 5 | 5 | 4 | as written | as written | small edits |

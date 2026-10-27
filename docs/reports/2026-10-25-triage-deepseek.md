# DeepSeek V4.1 Flash triage backtest (2026-10-25)

Can DeepSeek V4.1 Flash on OpenCode Go replace Sonnet 5.5 at `medium` for
`issue-triage`? **No, on the fixed rule: keep Sonnet 5.5 as the default.**
DeepSeek V4.1 Flash is the default model only when a repository chooses
OpenCode Go for triage (`KIT_TRIAGE_PROVIDER=opencode-go`). It is the
closest of the three Go models tested for triage; Qwen3.8 Flash and
MiniMax M3.1 Flash did worse
([the 2026-10-26 report](2026-10-26-triage-go-models.md)).

It fails one of the six tests: priority. It rates priority one level
higher than the operator accepted in 17 of 63 runs and never lower, the
direction Haiku 5.5 erred in too
([the 2026-10-23 backtest](2026-10-23-triage-model.md)). Everything else
held up: it asked questions on exactly the two issues where production
asked, never errored, never left an issue in an illegal state, and blind
graders ranked its plans first in 11 of 21 cases. A run costs about a
sixth of a Sonnet run at Go's list price, but takes about four times as
long.

| Measure | DeepSeek V4.1 Flash | Rule | Sonnet replay |
| --- | --- | --- | --- |
| Priority matches production | 14 of 21 | 18 | 21 |
| Type matches production | 18 of 21 | 18 (was 20) | 18 |
| Issues the graders would approve | 18 of 19 | 17 | 18 |
| Median cost per run | $0.015 (Go list) | | $0.098 |

## How it was run

The harness, the 21 frozen cases, the stub `gh` and the production (S0)
and Sonnet replay (S) results are the Haiku backtest's. 19 cases are the kit's own
issues (kit A to kit Q) and 2 are from a private repository (pilot A and
pilot B), named as in that report. The new arm, D, ran each case three times
with `--model deepseek-v4.1-flash` and no `--effort`, through the pinned
Claude Code CLI (2.1.306) with the environment `pr-review.yml` used for
`KIT_REVIEW_PROVIDER=opencode-go` at the time: Go's Anthropic Messages
endpoint, the key as `ANTHROPIC_AUTH_TOKEN`, every model alias on
DeepSeek, experimental betas and tool search off. Its value per case is
the majority of its three trials.

Go's endpoint table lists DeepSeek V4.1 Flash on the OpenAI-style endpoint
only (opencode.ai/docs/go, read 2026-10-25), but it answered on the
Anthropic endpoint in probes before the batch and in all 63 runs.

All 63 runs succeeded with no stub misses, no illegal end states and one
comment each. No model call reached live GitHub. One first trial stopped
at the harness's budget cap, which the CLI applies at Opus prices to a
model it does not know; it was discarded as a harness fault and re-run
with a higher cap.

Grading was blind, as for Haiku, with fresh graders: three on S0, S and
DeepSeek's first trial under shuffled letters (7 cases each), and a
fourth fact-checking trials 2 and 3.

## The fixed decision rule

The rule is the Haiku backtest's, with one change: after the results the
operator moved the type bar from 20 to 18 of 21, the Sonnet replay's own
score, since a bar Sonnet itself misses is not a fair test. Haiku still
fails it (16).

| Test | Threshold | DeepSeek | Sonnet replay | Result |
| --- | --- | --- | --- | --- |
| Type matches S0 | at least 18 of 21 (was 20) | 18 | 18 | pass |
| Priority matches S0, never more than one level off | at least 18 of 21 | 14, at most 1 off | 21 | fail |
| Plan or questions matches S0 | at least 20 of 21 | 21 | 21 | pass |
| Illegal end states; refusals or errors in 63 runs | 0; at most 1 | 0; 0 | 0; 0 | pass |
| Cases with a wrong reference that would mislead an implementer | at most 2 | 2 (both in trial 1) | 1 | pass |
| Issues rated "would approve" (as written or small edits); mean coverage within 0.5 of S0 | at least 17 of 19; gap at most 0.5 | 18; 4.33 against 4.14 | 18; 3.90 | pass |

As before, outcome counts a "Triage (revised)" plan as a plan, and
approval is counted on the last run per issue (kit C's edited run,
kit E's run after the answers).

## What DeepSeek does differently

### It raises priority one level, never lowers it

17 of 63 runs set priority one level above S0. Five issues went P3 to P2
(pilot A and kit D in all three trials, kit F, G and L in two),
and two went P2 to P1 (kit C's first run in all three trials, pilot B
in two). Its reasons quote real rows of the priority table, so each
reading is defensible on its own, but the operator accepted the lower
level every time. Haiku made the same error, so the skill's priority
guidance, not only the model, is part of it.

### Its type calls are about as good as Sonnet's

11 of 63 runs disagreed with S0 on type. On kit C (feature) and kit N
(bug) the Sonnet replay made the same call; only kit K (bug, where S0
and the replay said chore) is DeepSeek's own.

### It asks where Sonnet asked

All six trials on kit E and kit J posted "Triage: questions", as
production and the Sonnet replay did. Haiku asked in only 2 of these 6.

### Its plans graded best of the three

Graded blind against each closing pull request, DeepSeek's first trial
scored 4.76 on accuracy (S0 4.86, Sonnet replay 4.76), 4.33 on coverage
(4.14 and 3.90) and 4.38 on risks (4.14 and 3.90). It was ranked first in
11 of 21 cases and last in 6. Trials 2 and 3 averaged 4.90 on accuracy
with no misleading reference. One plan needed large edits (kit D's first
trial moves a step's shell into a new installed script the issue did not
ask for). The two misleading references, both in the first trial: kit M
lists two cases as recording nothing where the step does record, and
kit N says `docs/labels.md` needs no change where the fix changed it.

These graders gave S0 4.14 on coverage where the Haiku run's gave it 4.33,
so compare arms within one report, not across the two.

## Cost and time

| Arm | Runs | Median cost | Total | Median turns | Median output tokens | Median time |
| --- | --- | --- | --- | --- | --- | --- |
| Production Sonnet 5.5 (S0) | 21 | $0.118 | $2.45 | 17 | not recorded | not recorded |
| Sonnet 5.5 replay (S) | 21 | $0.098 | $2.08 | 16 | 3,041 | 31 s |
| Haiku 5.5 at `high` (H) | 63 | $0.011 | $0.70 | 19 | 8,171 | 45 s |
| DeepSeek V4.1 Flash on Go (D) | 63 | $0.015 | $1.08 | 32 | 11,649 | 115 s |

DeepSeek's cost is its token counts at Go's off-peak list price ($0.15
input, $0.60 output, $0.003 cached read per million tokens,
opencode.ai/docs/go, read 2026-10-25; the runs were on a Sunday, off-peak
all day). Go drew its allowance at 1.5 times list on probe calls, so the
63 runs used about $1.60 of it. At production's pace then (21 runs in two
days, about 300 a month) triage would use about $8 of Go Plus's $160
monthly allowance, which reviews on the same model share. The CLI prices
the model at Opus rates, so its own cost line reads about 55 times Go's
figure.

## Before relying on it

- Data: triage sends issue text through Go to DeepSeek. Its
  zero-retention agreement on Go renews monthly, and it needs the
  workspace's Global regions setting.
- Go's terms bar "processes that run or are activated while you are not
  logged into the Services"; that question is open for every Go job.
- 52 of 63 DeepSeek comments used em dashes; no Claude arm did. The triage
  skill has no rule on them.
- A priority calibration note in the triage skill could fix the one
  failing test for both Haiku and DeepSeek; re-running this arm costs
  about $1 of allowance.

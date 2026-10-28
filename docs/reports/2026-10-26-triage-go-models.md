# Triage models on OpenCode Go (2026-10-26)

Can a cheaper OpenCode Go model replace Sonnet 5.5 for `issue-triage`?
**Not yet: keep Sonnet 5.5 as the default.** Three Go models were
backtested. None passes the decision rule. DeepSeek V4.1 Flash comes
closest and stays the default for `KIT_TRIAGE_PROVIDER=opencode-go`.
Qwen3.8 Flash and MiniMax M3.1 Flash, tested here, both do worse.

All three rate priority one level higher than the operator accepted, and
never lower, as Haiku 5.5 did
([the 2026-10-23 backtest](2026-10-23-triage-model.md)). Qwen3.8 Flash and
MiniMax M3.1 Flash also miss the type bar, and each left an issue
untriaged in 2 of 63 runs.

| Measure | Rule | DeepSeek V4.1 Flash | Qwen3.8 Flash | MiniMax M3.1 Flash | Sonnet replay |
| --- | --- | --- | --- | --- | --- |
| Priority matches production | 18 of 21 | 14 | 11 | 11 | 21 |
| Runs with priority one level high (of 63) | | 17 | 28 | 28 | |
| Type matches production | 18 of 21 | 18 | 17 | 17 | 18 |
| Runs that left the issue untriaged (of 63) | 0 | 0 | 2 | 2 | 0 |
| Issues the graders would approve (of 19) | 17 | 18 | 18 | 16 | 18 |
| Median cost per run | | $0.015 | $0.022 | $0.046 | $0.098 |

The DeepSeek figures come from
[its own report](2026-10-25-triage-deepseek.md). The Sonnet replay's cost
is at Anthropic API prices; the Go models' costs are at Go list prices.

## The decision rule

This is the rule from the Haiku backtest, with the type bar at 18 of 21.
The operator lowered it from 20 on 2026-10-25. Each model's value for a
case is the majority of its three trials, compared with production (S0).

| Test | Threshold | DeepSeek V4.1 Flash | Qwen3.8 Flash | MiniMax M3.1 Flash |
| --- | --- | --- | --- | --- |
| Type matches S0 | at least 18 of 21 | 18, pass | 17, fail | 17, fail |
| Priority matches S0, never more than one level off | at least 18 of 21 | 14, fail | 11, fail | 11, fail |
| Plan or questions matches S0 | at least 20 of 21 | 21, pass | 20, pass | 20, pass |
| Illegal end states; refusals or errors in 63 runs | 0; at most 1 | 0; 0, pass | 2; 0, fail | 2; 2, fail |
| Cases with a wrong reference that would mislead an implementer | at most 2 | 2, pass | 2, pass | 2, pass |
| Issues rated "would approve"; mean coverage within 0.5 of S0 | at least 17 of 19; gap at most 0.5 | 18; 4.33 against 4.14, pass | 18; 3.90 against 4.33, pass | 16; 4.05 against 4.38, fail |

Each model's plans were graded blind by its own set of four fresh
graders. Every packet also held S0's and the Sonnet replay's plans, so
compare coverage with S0 within each column. The three grader sets rated
S0's coverage between 4.14 and 4.38.

## The models

### Qwen3.8 Flash (`qwen3.8-flash`)

- **Priority:** 28 of 63 runs were one level high. All three runs
  over-rated each of the seven issues DeepSeek over-rated. Pilot A, kit
  D, F, G and L went from P3 to P2, and pilot B and kit C went
  from P2 to P1. Kit N (three runs), kit H (two), and kit E and O
  (one each) also went up a level.
- **Gave up on kit A in two of three runs.** Each of those runs called a
  tool that does not exist (`submit_triage`) and read the error as "the
  triage server is not connected". It then stopped without posting a
  comment or changing labels. The server log shows the server connected
  and answering, and the third run on the same case worked. These two
  runs also cost it kit A's type match. Leaving them aside, its type
  calls match DeepSeek's.
- **Plans:** close to the Sonnet replay. The graders would approve 18 of
  19, with accuracy 4.76. One plan needed large edits (kit D).

### MiniMax M3.1 Flash (`minimax-m3.1-flash`)

- **Priority:** also 28 of 63 runs one level high. The seven issues
  above were over-rated in all three runs, and kit O also was. Kit H
  and N were over-rated in two runs each.
- **Planned instead of asking on kit J**, in all three runs. Production
  asked the operator to choose there. The graders marked the plan as
  needing large edits.
- **Two runs hit the 40-turn limit.** The kit K run posted nothing. The
  kit M run posted its plan and labels but never removed
  `needs-triage`.
- **Plans:** the graders would approve 16 of 19. Three first-trial plans
  needed large edits (kit G, J and P).
- **Output:** the most of the three models, with a median of 19,700 output
  tokens and up to 119,000 in one run. Its cost per run therefore varies
  the most: median $0.046, highest $0.44.

## Cost and allowance

| Model | Median per run at list | 63 runs at list | Allowance used per list $ | Median per run in allowance | Go Plus monthly allowance | Median turns | Median time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DeepSeek V4.1 Flash | $0.015 | $1.08 | 1.5x | $0.023 | $160 | 32 | 115 s |
| Qwen3.8 Flash | $0.022 | $1.43 | 2.67x | $0.060 | $90 | 25 | 240 s |
| MiniMax M3.1 Flash | $0.046 | $5.28 | 3x | $0.14 | $80 | 37 | 196 s |

The Sonnet replay took a median of 16 turns and 31 s per run.

- **List prices** (opencode.ai/v2/docs/console/go, read 2026-10-25), per
  million tokens of input, output and cached reads:
  - Qwen3.8 Flash: $0.15, $0.47, $0.016, and $0.20 per million tokens
    written to the cache.
  - MiniMax M3.1 Flash: $0.15, $0.60, $0.015.
- **Allowance multipliers** are the ratio of the `allowance` to the
  `list_cost` that Go reported on probe calls.
- **Monthly estimate:** at about 300 triage runs a month and each model's
  mean cost, MiniMax M3.1 Flash would use about $75 of its $80 monthly
  allowance. Qwen3.8 Flash would use about $18 of $90, and DeepSeek about
  $8 of $160. Reviews on the same model draw on the same allowance.

## How it was run

- **Setup:** the same harness, 21 frozen cases, stub `gh`, production
  (S0) runs and Sonnet replay as the earlier two backtests, with the cases
  named as in the Haiku backtest. Each model was
  its own arm on Go's Anthropic Messages endpoint. The arm used the
  environment that `KIT_REVIEW_PROVIDER=opencode-go` sets and passed no
  `--effort`, so the CLI sent its own default for a model it does not
  know, `high` (found 2026-10-27).
- **Runs:** 63 per model, at most 3 at a time, with no stub misses and no
  live GitHub calls or writes.
- **Cost cap:** the CLI does not know these models, so it prices them at
  Opus rates. Its `--max-budget-usd` cap therefore stops a run far below
  the Go cost the cap is meant to limit.
  - DeepSeek's $5 cap is about $0.14 at MiniMax M3.1 Flash's Go prices.
  - Five MiniMax runs hit it. They were set aside as harness stops and
    re-run with a $20 cap.
  - Production triage sets no cost cap, only the turn limit.
- **Pause:** MiniMax M3.1 Flash was paused for about three hours, because
  the review comparison was drawing on the same 5-hour allowance. No limit
  error occurred.

## Before relying on any of them

- **Fix priority first.** It is the one test all four cheaper models fail.
  A priority note in the triage skill could fix it, and DeepSeek V4.1 Flash
  is the model to re-test it on.
- **Data:** triage sends the issue text through Go to the model's
  provider. Qwen3.8 Flash and MiniMax M3.1 Flash have zero retention on Go.
  DeepSeek's zero-retention agreement renews monthly, and DeepSeek needs
  the workspace's Global regions setting.
- **Go's endpoint table** lists MiniMax M3.1 Flash, like DeepSeek V4.1
  Flash, on the OpenAI-style endpoint only. Both answered on the Anthropic
  endpoint in every run.
- **Em dashes:** Qwen3.8 Flash used them in 61 of 63 comments and MiniMax
  M3.1 Flash in 58. The Claude models used none.

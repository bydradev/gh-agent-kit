# Model backtests

Which models can run the kit's review, scan and triage, and what does
each cost? Between 2026-10-23 and 2026-10-26 the three workflows that use
a model were replayed on past work with cheaper models, and every answer
was compared with what the default model had done. This page puts the
results side by side. The four [dated reports](#the-reports) have the
method, the rules and every case.

**In short:**

- **Reviews and scans: Opus 5.5 stays the default.** On OpenCode Go,
  DeepSeek V4.1 Flash came closest. It found 10 of Opus's 14 findings (one
  of them in part), raised none that were wrong, and cost about a tenth as
  much per review (off-peak, at Go's list price). It is also the only Go
  model tested that fits a Go Plus subscription at the volume measured.
- **Triage: Sonnet 5.5 stays the default.** No cheaper model passed: each
  one set priority one level too high on several issues. DeepSeek V4.1
  Flash came closest, passing five of six tests at about a sixth of
  Sonnet's cost per run (at Go's list price).

## Pull request review

12 pull requests that Opus 5.5 had reviewed: 8 from the kit and 4 from a
private repository. Opus's 14 findings on them are the reference, and
every other model's findings were checked against the reviewed commit.

| Model | Provider | Opus's findings found (of 14) | Wrong findings | Blocked or passed as Opus did (of 12) | Median time | Median cost |
| --- | --- | --- | --- | --- | --- | --- |
| **Opus 5.5** (default) | Anthropic API | reference | | reference | 1.7 min | $0.55 |
| **DeepSeek V4.1 Flash** (default on Go) | OpenCode Go | 9, and 1 in part | 0 | 10 | 6.6 min | $0.051 |
| MiniMax M3 | OpenCode Go | 11, and 1 in part | 0 | 7 | 9.6 min | $0.270 |
| Qwen3.8 Flash | OpenCode Go | 12, and 1 in part | 0 | 7 | 14.8 min | $0.066 |
| MiniMax M3.1 Flash | OpenCode Go | 9, and 1 in part | 2 | 7 | 15.8 min | $0.136 |

- **The Go models block more often.** They rate severity higher than Opus
  did, often raising one of its P2 or P3 findings to a blocking P1.
  DeepSeek blocked 2 pull requests that Opus passed, and each of the
  others blocked 5. One of those blocks for every model, on private 3,
  rests partly on the replay showing today's pull request text.
- **Qwen3.8 Flash found the most** but was slow, a median of 15 minutes
  and up to 25 a review, and its findings beyond Opus's were mostly
  nitpicks.
- **MiniMax M3.1 Flash** made two confident claims that were wrong, and
  one review took 36 minutes.
- **Times are not like for like.** Opus ran on GitHub's runners; the Go
  models ran in a container, where nearly all of the time is the model's.

## Security scan

9 of the kit's pull requests, each scanned, with the scan's verification
step checking any candidate finding. None of them held a known
vulnerability, so this measures false alarms, answer format and cost, not
how many real problems a model catches.

| Model | Provider | Valid answers (of 9) | Findings reported | Median cost |
| --- | --- | --- | --- | --- |
| **Opus 5.5** (default) | Anthropic API | 9 | 0 | $0.18 |
| **DeepSeek V4.1 Flash** (default on Go) | OpenCode Go | 9 | 0 | $0.007 |
| MiniMax M3 | OpenCode Go | 8 | 0 | $0.085 |
| Qwen3.8 Flash | OpenCode Go | 9 | 0 | $0.016 |
| MiniMax M3.1 Flash | OpenCode Go | 9 | 2: one debatable, one not a security issue | $0.018 |

MiniMax M3's missing answer was one scan that replied in text instead of
the required format, which the kit treats as a failed run. The scan now
defaults to effort `xhigh` on the Anthropic API; what a scan costs at that
level is not measured yet.

## Issue triage

21 past triage runs on 19 issues: 17 from the kit and 2 from a private
repository. Production's labels, set by Sonnet 5.5, are the reference,
since the operator changed none of them. Sonnet 5.5 was replayed once per
case to show how much the same model varies. Every other model ran each
case three times, and its majority answer counts.

| Model | Tests passed (of 6) | Priority matches (of 21) | Type matches (of 21) | Plans the graders would approve (of 19) | Runs that left the issue untriaged |
| --- | --- | --- | --- | --- | --- |
| **Sonnet 5.5** (default), replayed | reference | 21 | 18 | 18 | 0 of 21 |
| Haiku 5.5 | 1 | 12 | 16 | 15 | 0 of 63 |
| **DeepSeek V4.1 Flash** (default on Go) | 5 | 14 | 18 | 18 | 0 of 63 |
| Qwen3.8 Flash | 3 | 11 | 17 | 18 | 2 of 63 |
| MiniMax M3.1 Flash | 2 | 11 | 17 | 16 | 2 of 63 |

What each run took:

| Model | Provider | Effort | Median cost per run | Median time per run |
| --- | --- | --- | --- | --- |
| **Sonnet 5.5** (default) | Anthropic API | `medium`, not set | $0.098 | 31 s |
| Haiku 5.5 | Anthropic API | `high`, set | $0.011 | 45 s |
| **DeepSeek V4.1 Flash** (default on Go) | OpenCode Go | `high`, not set | $0.015 | 115 s |
| Qwen3.8 Flash | OpenCode Go | `high`, not set | $0.022 | 240 s |
| MiniMax M3.1 Flash | OpenCode Go | `high`, not set | $0.046 | 196 s |

- **Every cheaper model raises priority, and never lowers it.** One level
  too high in 26 of Haiku's 63 runs, 17 of DeepSeek's and 28 each of Qwen's
  and MiniMax's. The same direction across four models points at the
  triage skill's priority guidance as well as the models.
- **Asking when it should.** On the two issues where production stopped
  to ask the operator, DeepSeek asked in all 6 of its runs and Haiku in
  only 2. MiniMax M3.1 Flash planned instead of asking on one of them in
  all 3 runs. Haiku's plans were as accurate line by line, but covered
  less of what the fix needed.
- **The six tests** were fixed before the first run: type, priority,
  asking or planning, no errors or broken end states, no misleading
  references, and plans the graders would approve. The type bar was
  lowered from 20 to 18 of 21, Sonnet's own replay score, after the
  DeepSeek results; Haiku fails it either way.
- **Each model's plans were graded blind** by its own set of graders, so
  compare the approval counts loosely. A grader would approve a plan as
  written or with small edits.

## What a month costs

The Anthropic API bills each run. OpenCode Go is a monthly subscription
($10 for Go, $40 for Go Plus) that gives each model its own dollar
allowance, of which at most 20% can be used per 5 hours and 50% per week
([Go's page](https://opencode.ai/v2/docs/console/go/), read 2026-10-28).
Go counts a run against the allowance at a multiple of its list price:
1.5 times for DeepSeek V4.1 Flash, 1.33 for MiniMax M3, 2.67 for Qwen3.8
Flash and 3 for MiniMax M3.1 Flash.

**Reviews and scans** at the maintainer's measured volume: 644 pushes in
30 days across three repositories, 431 in the busiest week and 69 in the
busiest 5 hours, each push getting one review and one scan.

| Model | Pushes Go Plus allows per 30 days | Per week | Per 5 hours | Fits the measured volume |
| --- | --- | --- | --- | --- |
| **DeepSeek V4.1 Flash** | 1,546 | 773 | 309 | yes, off-peak |
| MiniMax M3 | 324 | 162 | 65 | no |
| Qwen3.8 Flash | 404 | 202 | 81 | no |
| MiniMax M3.1 Flash | 136 | 68 | 27 | no |

The review report worked these out from the costs of the runs, at Go's
multiplier for each model, so they are lower than the medians above
would give.

On the Anthropic API there is no cap but every push is billed: at Opus's
median costs ($0.55 a review and $0.18 a scan) those 644 pushes come to
about $470. A scan at the current `xhigh` default may cost more; that is
not measured yet. DeepSeek V4.1 Flash costs double at peak hours (weekdays
01:00 to 04:00 and 06:00 to 10:00 UTC); with every push at peak, Go Plus
holds 773 a month and 386 a week, so the busiest week measured would hit
the weekly limit. The $10 Go plan gives DeepSeek V4.1 Flash an $80
allowance, half of Go Plus's, so off-peak it holds about 773 pushes a
month and 386 a week: enough for the month measured, but not its busiest
week.

**Triage** at the pace it ran then, about 300 runs a month, using each
model's mean cost per run: Sonnet 5.5 about $35 (its billed production
runs; about $30 at the replay's cost) and Haiku 5.5 about $3.30 on the
Anthropic API. On Go Plus, DeepSeek V4.1 Flash would use about $8
of its $160 allowance, Qwen3.8 Flash about $18 of $90, and MiniMax M3.1
Flash about $75 of $80. Jobs on the same Go model share its allowance.

## How the backtests were run

- **Same software as production.** Each replay used the kit's pinned
  Claude Code CLI (2.1.306) with the workflow's own settings and skill
  (and, for the review and triage, the kit's MCP server), at the commit
  the original run used.
- **Frozen GitHub.** A stub `gh` answered reads as GitHub stood when the
  original run started and recorded writes instead of posting them. No
  model call reached live GitHub.
- **Prices.** Claude models' costs are Anthropic API prices from the run
  logs. Go models' costs are each run's tokens at Go's list prices
  (DeepSeek's off-peak), read 2026-10-25 and 2026-10-26.
- **Effort.** Where no level was set, Claude Code sent its own default:
  `medium` for Sonnet 5.5 and `high` for a model it does not know, as the
  Go models are. A later test (2026-10-27) found no consistent difference
  between levels on DeepSeek V4.1 Flash in 11 runs; on the other Go models
  the level's effect is untested.
- **Names.** The kit's original repository stays private, as do the other
  repositories the cases come from, so cases are named kit A, private 1,
  pilot A and so on.

## Limits

- **Small samples.** 12 reviews, 9 scans and 21 triage cases, all from one
  maintainer's work. Your pull requests and issues may differ.
- **One review per model and pull request,** so a single review can move a
  count.
- **No known vulnerability in the scan sample,** so it says nothing about
  how many real problems each model catches.
- **Triage ran in Claude Code only.** Triage on Go can also run in
  OpenCode's own CLI (`KIT_TRIAGE_RUNNER=opencode`), which has no
  backtest yet.
- **Prices and allowances change.** Check
  [Go's page](https://opencode.ai/v2/docs/console/go/) and
  [Anthropic's pricing](https://platform.claude.com/docs/en/about-claude/pricing)
  before relying on the figures here.
- **Before using Go,** read [OpenCode Go](../setup.md#opencode-go) in the
  setup guide: the endpoint DeepSeek V4.1 Flash answers on, its region
  setting and data retention, and Go's terms on unattended use.

## The reports

| Date | Report | Question | Answer |
| --- | --- | --- | --- |
| 2026-10-23 | [Triage model backtest](2026-10-23-triage-model.md) | Can Haiku 5.5 at `high` replace Sonnet 5.5 for triage? | No: it fails five of six tests |
| 2026-10-25 | [Review and scan models on OpenCode Go](2026-10-25-review-models.md) | Which Go model can review and scan instead of Opus 5.5? | DeepSeek V4.1 Flash, for both |
| 2026-10-25 | [DeepSeek V4.1 Flash triage backtest](2026-10-25-triage-deepseek.md) | Can DeepSeek V4.1 Flash replace Sonnet 5.5 for triage? | No: it fails on priority only |
| 2026-10-26 | [Triage models on OpenCode Go](2026-10-26-triage-go-models.md) | Can Qwen3.8 Flash or MiniMax M3.1 Flash replace Sonnet 5.5 for triage? | No: both do worse than DeepSeek |

# Review and scan models on OpenCode Go (2026-10-25)

Which OpenCode Go model can run `pr-review` and `security-scan` instead of
Opus 5.5? **DeepSeek V4.1 Flash (`deepseek-v4.1-flash`) for both.** It is
the only one of the four tested that reviews close to Opus and fits the Go
Plus allowance at the maintainer's volume. Opus 5.5 stays the kit's default
and the better reviewer: Go is an opt-in for cost.

Each model reviewed the same 12 pull requests and scanned the same 9 as Opus
had on the Anthropic API, and every finding was checked against the head
commit. Opus's findings are the reference.

| Measure | Opus 5.5 | DeepSeek V4.1 Flash | MiniMax M3 | Qwen3.8 Flash | MiniMax M3.1 Flash |
| --- | --- | --- | --- | --- | --- |
| Opus findings found (of 14): fully, partly | 14 | 9, 1 | 11, 1 | 12, 1 | 9, 1 |
| Invalid findings | | 0 | 0 | 0 | 2 |
| Blocks or passes as Opus did (of 12) | | 10 | 7 | 7 | 7 |
| Median review time | 1.7 min | 6.6 min | 9.6 min | 14.8 min | 15.8 min |
| Median review cost | $0.55 | $0.051 | $0.270 | $0.066 | $0.136 |
| Scans with a valid answer (of 9) | 9 | 9 | 8 | 9 | 9 |
| Scan findings reported | 0 | 0 | 0 | 0 | 2 |
| Median scan cost | $0.18 | $0.007 | $0.085 | $0.016 | $0.018 |
| Pushes Go Plus allows per 30 days, week, 5 hours | | 1,546, 773, 309 | 324, 162, 65 | 404, 202, 81 | 136, 68, 27 |

Opus's costs are Anthropic API prices; the others are Go list prices
(DeepSeek's off-peak). The last row is one review and one scan per push. The
volume to hold, measured over the 30 days to 2026-10-23 across three of
the maintainer's repositories, is 644 pushes in 30 days, 431 in
the busiest week and 69 in the busiest 5 hours: only DeepSeek fits.

## The models

- **DeepSeek V4.1 Flash.** Found both Opus P1s and 5 of its 7 P2s, raised 8
  valid findings Opus did not and none that were wrong. It rates severity
  high: it blocked 2 pull requests Opus passed, kit A and private 3, by
  raising an Opus P2 to P1 (on private 3 partly because of the replay, see
  *Limits*). Two reviews used 78 and 79 of the 80-turn limit, so a larger
  pull request can hit the cap.
- **MiniMax M3.** As thorough as DeepSeek or more (all six Opus findings on
  kit A and B, where DeepSeek found three, and about a dozen valid
  extras), but it writes long reviews: about five times DeepSeek's cost per
  review and twelve times per scan. One scan answered in text instead of
  the schema, which the kit fails closed.
- **Qwen3.8 Flash.** The closest to Opus on findings (it missed one P3 and
  half-matched one P2), the only one of the three later models to pass kit
  B as Opus did, and with no invalid findings. But it is slow (median 15
  minutes a review, up to 25),
  its own findings beyond Opus's were mostly nitpicks (six about the PR
  body's footers), and its allowance fits about 400 pushes a month.
- **MiniMax M3.1 Flash.** Some strong extras, but two confident wrong P1s:
  on kit E it claimed the title check crashes on a footer (it does not:
  `footer[0]` is the matched string), and on kit C that GitHub evaluates
  the verdict check on the merge commit. It thinks at length (one review took
  36 minutes and 323k output tokens) and has the smallest allowance. Its
  verification kept 2 scan findings on kit H that no other model
  reported, one debatable and one not a security issue.

The three later models each blocked 5 reviews Opus passed. One of them,
the same pull request for all three, is an artifact of the replay (see
*Limits*); the other four come from raising an Opus P2 or P3 to P1, or, for
M3.1 Flash, one wrong P1.

## Using DeepSeek on Go

Set `KIT_REVIEW_PROVIDER` and `KIT_SECURITY_PROVIDER` to `opencode-go` and
`KIT_REVIEW_MODEL` and `KIT_SECURITY_MODEL` to `deepseek-v4.1-flash`;
[`docs/setup.md`](../setup.md#opencode-go) has the rest. Before relying on
it:

- **Endpoint.** Go's endpoint table lists DeepSeek V4.1 Flash on the
  OpenAI-style endpoint only, but it answered on the Anthropic endpoint,
  which Claude Code uses, for every run here. Go could stop that without
  notice; a dispatched run shows it.
- **Peak hours.** DeepSeek costs double on weekdays 01:00 to 04:00 and
  06:00 to 10:00 UTC. With every push at peak, Go Plus holds 773 pushes a
  month and 386 a week, so the busiest week measured (431) would hit the
  weekly limit.
- **Region.** The workspace must allow Global under Settings, Privacy.
  DeepSeek's zero-retention agreement with OpenCode renews monthly (the
  current one runs to 2026-10-31).
- **One allowance.** With both jobs on DeepSeek they share its allowance,
  which the capacity above already counts.

## How it was run

- Each run replayed a pull request at the head and base Opus reviewed, with
  the kit's pinned Claude Code 2.1.306 and the workflow's own settings,
  rules, skills and MCP server. A stub `gh` answered reads as GitHub stood
  when Opus reported (later comments, reviews and check runs hidden, and
  Opus's own inline findings too) and recorded every write instead of
  posting it.
- The 12 reviews are 8 kit pull requests and 4 from a private repository
  (private 1 to 4 below). The 9 scans are kit pull requests. Kit pull
  requests are named kit A to kit J, in the order they were opened in the
  kit's original repository, which stays private.
- Times are the CLI's own run time. For Opus they come from its run logs,
  the *Run the review* and *Run the scan* steps, on GitHub's runners; the
  Go models ran in a container, where the time is almost all model time.
- Costs are each run's tokens at Go's list prices: per million input,
  output and cached-read tokens, DeepSeek V4.1 Flash $0.15, $0.60 and
  $0.003 off-peak (double at peak), MiniMax M3 $0.30, $1.20 and $0.06,
  Qwen3.8 Flash $0.15, $0.47 and $0.016 (cache writes $0.20), MiniMax M3.1
  Flash $0.15, $0.60 and $0.015 ([Go](https://opencode.ai/v2/docs/console/go/),
  read 2026-10-26). The run log's `cost_usd` is at Claude prices and was
  not used.
- Go counts each request against a model's allowance at a multiple of its
  list price, read from the `opencode.allowance` and `opencode.list_cost`
  fields of Go's responses: 1.5 for DeepSeek V4.1 Flash, 1.33 for MiniMax
  M3, 2.67 for Qwen3.8 Flash and 3 for MiniMax M3.1 Flash. Go Plus allows
  $160, $180, $90 and $80 a month for these models, with 20% of it per 5
  hours and 50% per week (same page).
- Not tested: Qwen3.7 Plus (the scan's former Go default), DeepSeek V4 Pro
  and the other models that answer on the Anthropic endpoint (Kimi K3,
  Qwen3.8 Max and others), and the GLM models, which answer only on the
  OpenAI-style one.

## Limits

- The replay shows today's pull request titles and bodies and today's
  `main`, not those Opus saw. Findings that rest on them are not counted:
  kit E's only Opus finding (the body's `User-visible:` line, since
  fixed). Every block on private 3 rests partly on them. DeepSeek raised
  Opus's P2 to P1 partly because today's title names a later release; the
  finding is Opus's and counts as found. The three later models blocked
  because today's body names a later version than the reviewed lock; that
  finding counts as an artifact, not as invalid. The blocks count in the
  table either way.
- One run per model and pull request, so one review can move a count.
- The scan sample has no known vulnerability, so it measures false
  positives, cost and the answer's format, not recall.
- The models ran without effort settings: the CLI sends effort only to
  models it knows.

## Every case

One row per pull request: the verdict (**No blocking**, **Changes
required**, **Operator decision**), then Opus findings found out of Opus's
total, a partial match counting as half.

| Pull request | Opus 5.5 | DeepSeek V4.1 Flash | MiniMax M3 | Qwen3.8 Flash | MiniMax M3.1 Flash |
| --- | --- | --- | --- | --- | --- |
| private 1 | No blocking, 2 | No blocking, 2 of 2 | No blocking, 2 of 2 | Changes required, 1 of 2 | No blocking, 1 of 2 |
| private 2 | No blocking, 1 | No blocking, 0 of 1 | No blocking, 0 of 1 | No blocking, 1 of 1 | No blocking, 0 of 1 |
| private 3 | No blocking, 1 | Changes required, 1 of 1 | Changes required, ½ of 1 | Changes required, 1 of 1 | Changes required, ½ of 1 |
| private 4 | No blocking, 0 | No blocking | No blocking | No blocking | No blocking |
| kit A | No blocking, 3 | Changes required, 2 of 3 | Changes required, 3 of 3 | Changes required, 3 of 3 | Changes required, 2 of 3 |
| kit B | No blocking, 3 | No blocking, 1 of 3 | Changes required, 3 of 3 | No blocking, 3 of 3 | Changes required, 3 of 3 |
| kit C | Changes required, 1 | Changes required, 1 of 1 | Changes required, 1 of 1 | Changes required, 1 of 1 | Changes required, 1 of 1 |
| kit D | No blocking, 1 | No blocking, 1 of 1 | Changes required, 1 of 1 | Changes required, 1 of 1 | Changes required, 1 of 1 |
| kit E | No blocking, 1 (not comparable) | No blocking | No blocking | No blocking | Changes required |
| kit F | No blocking, 1 | No blocking, ½ of 1 | Changes required, 0 of 1 | Changes required, ½ of 1 | No blocking, 0 of 1 |
| kit G | No blocking, 0 | No blocking | No blocking | No blocking | No blocking |
| kit I | Operator decision, 1 | Changes required, 1 of 1 | Changes required, 1 of 1 | Changes required, 1 of 1 | Changes required, 1 of 1 |

Changes required and Operator decision both block. Scans: every model
returned no findings on all 9, except MiniMax M3 on kit J (no valid
answer) and MiniMax M3.1 Flash on kit H (two findings).

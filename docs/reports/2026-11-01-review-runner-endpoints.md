# Review runners on Go's two endpoints (2026-11-01)

On 2026-10-28 DeepSeek V4.1 Flash reviewed slowly in Claude Code: on
[kit pull request 23](https://github.com/bydradev/gh-agent-kit/pull/23)
it reached the 30-minute limit at peak and took 28 minutes off-peak,
where OpenCode's CLI took about 7 ([OpenCode Go](../setup.md#opencode-go)).
Claude Code reaches Go through Go's Anthropic-style endpoint, which Go
translates for this model, and sends a larger prompt; OpenCode's CLI uses
the OpenAI-style endpoint. Which of the two mattered? This test reran that
review in both CLIs, plus OpenCode's CLI pointed at the Anthropic endpoint,
with every request's input and output tokens logged.

**Neither stopped Claude Code this time.** It went through the Anthropic
endpoint with a first prompt 2.5 times OpenCode's and finished in under 6
minutes, with the same verdict as on 2026-10-28. Why the 2026-10-28 runs
were slow is still not known. OpenCode's CLI on the Anthropic endpoint was
the slow one, with no verdict at 30 minutes, most likely because its
Anthropic client sends none of the model's earlier reasoning back. OpenCode's
CLI on its usual OpenAI-style endpoint, the kit's runner on Go, was the
fastest and cheapest.

| Run | Endpoint | Time | Model requests | First request's input tokens | Output tokens a request, median (max) | Output tokens in all | Verdict | Go allowance used |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code (the `claude-code` runner) | Anthropic | 5 min 51 s | 21 | 14,294 | 1,389 (21,437) | 54,071 | No blocking findings | $0.066 |
| OpenCode's CLI (the `opencode` runner) | OpenAI-style | 3 min 53 s | 21 | 5,632 | 343 (8,409) | 31,667 | No blocking findings | $0.044 |
| OpenCode's CLI | Anthropic | no verdict at 30 min | 39 | 5,619 | 4,791 (20,128) | 195,345 | none | $0.163 |
| OpenCode's CLI with Claude Code's thinking fields | Anthropic | no verdict at 30 min | 36 | 5,621 | 5,542 (30,000) | 228,894 | none | $0.189 |
| For comparison: Claude Code on GitHub's runner, 2026-10-28 10:08 UTC | Anthropic | 27 min 48 s | not logged (47 turns) | not logged | not logged | 235,817 | No blocking findings | not logged |

Input tokens include cached ones. Output tokens include the model's
thinking: 28,835 of OpenCode's 31,667 on the OpenAI-style endpoint were
reasoning. Claude Code counts 32 turns for its 21 requests. The crossover
counts include the requests a reset or the limit cut off (see *Limits*);
the medians leave them out.
OpenCode's
session title, one more short request in each OpenCode run, is left out.
The allowance is what Go reported in its responses; a request cut off at
the limit reports none, so the two runs that timed out used somewhat more.
All four used $0.46 of the allowance, or $0.39 at list price. The last row is
the [review step of that day's off-peak
run](https://github.com/bydradev/gh-agent-kit/actions/runs/40648116161/attempts/2)
and its log's summary lines; the earlier attempt of the same run, at peak,
was cancelled at the 30-minute limit.

## What it shows

- **Nearly all the time is the model's.** Model requests took 349 of
  Claude Code's 351 seconds and 225 of the 233 OpenCode's CLI took on the
  OpenAI-style endpoint. Tool calls, the MCP server and the CLIs
  themselves took the rest.
- **The larger prompt and Go's translation did not stop Claude Code.** Its
  first request carried 14,294 input tokens to OpenCode's 5,632, most of
  the difference being tool definitions: 30 tools in 44,000 characters to
  OpenCode's 19 in 14,000. It went through the same translated endpoint as
  the slow crossover and finished.
- **The 2026-10-28 slowness did not come back.** DeepSeek wrote a median
  1,389 tokens a request in Claude Code. On 2026-10-28 it thought 10,000 to
  34,000 tokens a turn in a local run at peak, and the off-peak run on
  GitHub's runner wrote 235,817 output tokens in 47 turns, over four times
  this run's 54,071. The pinned CLI, its flags and its Go settings were
  the same. What differed: a Sunday rather than a Wednesday, a local machine
  rather than GitHub's runner, and GitHub stubbed (see *How it was run*).
  Which of these, or a change on Go's side, explains it was not tested.
- **The crossover changes the client, not only the endpoint.** On the
  Anthropic endpoint OpenCode 1.19.3 uses its bundled Anthropic client,
  which sends an earlier reasoning part back only as a signed thinking
  block and otherwise drops it with the warning "unsupported reasoning
  metadata" (the pinned binary's code, read 2026-11-01). Go's Anthropic
  endpoint sent no signature in any of the 97 responses recorded. So none
  of the two crossover runs' 73 later requests carried the model's earlier
  reasoning. Claude Code sent its earlier thinking blocks back unsigned,
  and Go took them, in all 20 of its later requests; OpenCode's CLI on the
  OpenAI-style endpoint sent `reasoning_content` back in 19 of 20.
- **Without its earlier reasoning DeepSeek thought far longer.** It wrote
  about 14 times as much a request (median 4,791 tokens to 343) and took a
  median 32 seconds a request to 3. It was still calling tools at the
  limit, 51 and 43 calls in, not stuck. Adding Claude Code's thinking
  fields (`thinking` adaptive, effort `high`) made no clear difference.
  The dropped reasoning is the likely cause, not a proven one: one run
  each, and the client changed with it.

For the kit this changes no setting: OpenCode's CLI on Go's OpenAI-style
endpoint, the default runner on Go, was the fastest and cheapest. It does
mean that OpenCode's CLI pointed at Go's Anthropic endpoint for DeepSeek
V4.1 Flash, which the kit never does, was slower here than Claude Code.

## How it was run

- Kit pull request 23 at head `36a5dc2` with base `main` at `ec6b29e`, as
  reviewed on 2026-10-28: two changed files, the review's and triage's
  skills, +88 and -120 lines.
- The kit's pinned Claude Code 2.1.306 and OpenCode 1.19.3, with the review
  job's CLI flags, tool lists, permissions, environment and inline
  configuration (v0.4.1; Claude Code's flags and Go settings are the same
  as on 2026-10-28), the
  base branch's review skill, rules and MCP server as the workflow restores
  them, this repository's `KIT_REVIEW_MAX_TURNS` of 120, no effort setting,
  and the 30-minute default of `KIT_REVIEW_TIMEOUT_MINUTES`. DeepSeek V4.1
  Flash on Go for all four.
- The crossover pointed OpenCode's model at Go's Anthropic endpoint through
  a per-model provider override in the inline configuration
  (`@ai-sdk/anthropic`); the kit has no setting for this. The fourth run
  added Claude Code's two thinking fields as model options.
- Every model request went through a local recording proxy, which logged
  the endpoint, the request's size, its timing and the usage Go returned,
  and never the key.
- Run locally, not on GitHub's runner. A stub `gh` answered reads from a
  copy of the pull request made on 2026-11-01, set back to its state on
  2026-10-28 (open, at that head), and recorded writes instead of posting
  them. Claude Code ran without its subprocess environment scrub, and so
  without bubblewrap; the review gives the model no shell either way.
- From 13:36 UTC on Sunday 2026-11-01, off-peak. The first two runs ran
  side by side, the two crossovers one after the other.

## Limits

- **One run each, on one pull request,** so no spread, and a run on another
  day could differ, as Claude Code's did from 2026-10-28.
- **A stall in each crossover.** One streamed response in each was reset
  partway, and OpenCode's CLI sent the same request again about 5 minutes
  later, logging nothing between. Most likely the reset came from upstream
  and the recording proxy did not pass it on, so the CLI waited out an
  idle timeout. Even so, each had spent 23 to 25 minutes in model requests
  without a verdict, against under 4 minutes for the whole review on the
  OpenAI-style endpoint. Neither of the first two runs had a reset.
- **Not the workflow's own steps.** The runs called the CLIs directly, so
  without the review's carry-on after a capacity refusal. Go refused no
  request.
- **Not tested:** Claude Code with its earlier thinking left out, the same
  runs at peak or on GitHub's runner, and other pull requests.

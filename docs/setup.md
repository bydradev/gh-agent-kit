# Setting up the kit in a repository

The kit is a set of files copied into a repository, pinned to a commit of
this one. Nothing runs from this repository at your repository's run time:
every workflow, script and skill is in your tree, reviewed like any other
change.

Setting up takes five steps:

1. [Install the files](#1-install-the-files)
2. [Create the labels](#2-create-the-labels)
3. [Add the secret and the settings](#3-add-the-secret-and-the-settings)
4. [Merge the install pull request](#4-merge-the-install-pull-request)
5. [Check the first runs](#5-check-the-first-runs)

The rest is reference: [Costs](#costs), [OpenCode Go](#opencode-go),
[What each run may do](#what-each-run-may-do), [The verdict
check](#the-verdict-check), [The scan's instructions
file](#the-scans-instructions-file), [The lock file](#the-lock-file),
[Updates](#updates) and [The pinned CLI](#the-pinned-cli) (and
OpenCode's, for triage).

## 1. Install the files

From a clone of this repository, checked out at the latest release
(`git checkout vX.Y.Z`, as [Updates](#updates) does for an update):

```sh
./install.sh /path/to/your-repo
```

The script copies the files in `kit-manifest.txt` into the target, adds a
`.claude/skills/<name>` symlink to `.agents/skills/<name>` for each skill,
so Claude Code finds the skills other agents read from `.agents/skills`, and
writes `.github/gh-agent-kit.lock` with this repository's commit. It creates
`.claude/skills` when the target has none, but links nothing through a
symlinked `.claude` or `.claude/skills` or when either is a file, and
nothing over a name the target already uses: a symlink or file the target
put there stays, and only the kit's own symlink is removed when a skill is
dropped. Run it again from a clone checked out at a newer release to update
([Updates](#updates)); it replaces the kit's files
and nothing else, and prints the diff of what changed. Commit the result on a
branch and open a pull request, as you would for any change.

To see whether a target is behind without changing it:

```sh
./install.sh --check /path/to/your-repo
```

It prints what an install would do, with the same words, and writes
nothing: it exits 0 when the target is current, 1 when an install would
change something (a file, a skill link, a removal or the lock) and 2 when an
install would be refused. A script that lost its executable bit counts as
a change, and an install reports it as `updated ... (made executable)`.

The installed files are Apache-2.0. A copy of the licence is one of them,
`.github/gh-agent-kit/LICENSE`, so a target that redistributes the files
gives its recipients the copy the licence's section 4 asks for without
further work; the lock's `source` names this repository.

The Bug and Task forms tell a reporter not to file a security issue there
and to follow the repository's security policy instead, so a public target
should have one: a `SECURITY.md`, or private vulnerability reporting
turned on.

A repository with issue forms of its own can keep them:

```sh
./install.sh --issue-forms=own /path/to/your-repo
```

The kit's Bug and Task forms and its `config.yml` are then not copied, and
no install replaces or removes a file in `.github/ISSUE_TEMPLATE/`, one an
earlier install copied included. The lock records the choice
([The lock file](#the-lock-file)), so later installs and `--check` keep it
without the option, and the update check leaves the kit's forms out;
`--issue-forms=kit` installs them again, over any files of the same names.
An installer from a release without the option ignores the choice and
writes the kit's forms, so update such a target from a release that has
it.
Triage does not need the kit's forms: a new issue starts it whether or not
its form adds `needs-triage`. Name your own forms in the first bullet of
the *Work tracking* block below, in place of the Task and Bug forms.

Then add the *Work tracking* block from
[`docs/agents-md-block.md`](agents-md-block.md) to the *Project specifics*
section of your `AGENTS.md`, in the same pull request, so agents working in
the repository know the rules the labels encode.

## 2. Create the labels

From your repository:

```sh
.github/scripts/sync-labels.sh owner/repo
```

Creates or updates the fifteen labels in [`labels.md`](labels.md). Safe to
re-run.

## 3. Add the secret and the settings

A setting is a repository variable or a line of
[`.github/gh-agent-kit.yml`](#the-settings-file) (*Settings*, *Secrets and
variables*, *Actions* holds the variables and the secrets). Secrets stay
secrets: the file holds settings only.

| Name | Kind | Value | Effect |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | Secret | An Anthropic Console API key | The review, scan and triage workflows need it once turned on (not when their provider is `opencode-go`); without it a run fails before the model starts, naming the missing secret |
| `KIT_REVIEW_MODE` | Setting | `push`, `open`, `off` or unset | `push`: review every push; `open`: review once when a pull request opens or leaves draft; `off` or unset: off |
| `KIT_SECURITY_SCAN` | Setting | `push`, `open`, `off` or unset | Same modes for the security scan |
| `KIT_ISSUE_TRIAGE` | Setting | `on`, `off` or unset | `on`: triage issues and run the weekly sweep; `off` or unset: off |
| `KIT_UPDATE_CHECK` | Setting | `on`, `off` or unset | `on`: the weekly update check ([Updates](#updates)); `off` or unset: off |
| `OPENCODE_API_KEY` | Secret, optional | An OpenCode API key from a workspace with a Go subscription | Needed only with `KIT_REVIEW_PROVIDER`, `KIT_SECURITY_PROVIDER` or `KIT_TRIAGE_PROVIDER` set to `opencode-go`; that run fails before the model starts without it, naming the missing secret. It never stands in for `ANTHROPIC_API_KEY` while the provider is `anthropic` |

The workflows' models, effort, budgets and size limits are settings too,
so a repository tunes cost without editing the kit's files. Each is
optional; unset means the default. A value outside its range, a switch's
included, fails the run with an error naming the setting, its allowed
values and where the value came from (the variable, or the file's line)
instead of running with something else, so a misspelt switch cannot leave
its workflow off unnoticed. Values are matched exactly: `Push` fails too.

| Setting | Default | Range | Effect |
| --- | --- | --- | --- |
| `KIT_REVIEW_PROVIDER` | `anthropic` | `anthropic` or `opencode-go` | Where the reviewer's model runs: the Anthropic API on `ANTHROPIC_API_KEY`, or [OpenCode Go](#opencode-go) on `OPENCODE_API_KEY` |
| `KIT_REVIEW_MODEL` | `claude-opus-5-5`, or `deepseek-v4.1-flash` on `opencode-go` | a `claude-` model name, or on `opencode-go` a Go model id | The reviewer's model |
| `KIT_REVIEW_EFFORT` | unset | `low`, `medium`, `high`, `xhigh` or `max` | The reviewer's effort level, passed as `--effort`; unset passes none, so the CLI's default for the model applies; on `opencode-go`, see [OpenCode Go](#opencode-go) |
| `KIT_REVIEW_MAX_TURNS` | `80` | 1 to 500 | The reviewer's turn limit; a run that reaches it fails |
| `KIT_REVIEW_TIMEOUT_MINUTES` | `30` | 1 to 360 | The review job's time limit (GitHub-hosted jobs stop at 6 hours) |
| `KIT_REVIEW_MAX_FILES` | `300` | 1 to 300 | A larger pull request is refused, not reviewed |
| `KIT_REVIEW_MAX_LINES` | `20000` | 1 to 20,000 | The same for changed lines |
| `KIT_SECURITY_PROVIDER` | `anthropic` | `anthropic` or `opencode-go` | Where the scanner's model runs, the same way as `KIT_REVIEW_PROVIDER` |
| `KIT_SECURITY_MODEL` | `claude-opus-5-5`, or `deepseek-v4.1-flash` on `opencode-go` | a `claude-` model name, or on `opencode-go` a Go model id | The scanner's model, for the scan and its verification |
| `KIT_SECURITY_EFFORT` | `xhigh`, or unset on `opencode-go` | `low`, `medium`, `high`, `xhigh` or `max` | The scanner's effort level, for the scan and its verification, passed as `--effort`; on `opencode-go` unset passes none, as for the reviewer |
| `KIT_SECURITY_MAX_TURNS` | `80` | 1 to 500 | The turn limit of each of the two runs; a run that reaches it fails |
| `KIT_SECURITY_TIMEOUT_MINUTES` | `30` | 1 to 360 | The scan job's time limit, both runs included; a scan that reaches it fails the run |
| `KIT_SECURITY_MAX_FILES` | `300` | 1 to 300 | A larger pull request is refused, not scanned |
| `KIT_SECURITY_MAX_LINES` | `20000` | 1 to 20,000 | The same for changed lines |
| `KIT_TRIAGE_PROVIDER` | `anthropic` | `anthropic` or `opencode-go` | Where the triage model runs, the same way as `KIT_REVIEW_PROVIDER` |
| `KIT_TRIAGE_RUNNER` | `claude-code` | `claude-code`, or `opencode` with `KIT_TRIAGE_PROVIDER=opencode-go` | The program that runs triage: Claude Code, or [OpenCode's CLI](#opencode-cli-for-triage), which reaches every Go model its pinned release lists |
| `KIT_TRIAGE_MODEL` | `claude-sonnet-5-5`, or `deepseek-v4.1-flash` on `opencode-go` | a `claude-` model name, or on `opencode-go` a Go model id | The triage model, for single issues and the sweep |
| `KIT_TRIAGE_EFFORT` | unset | `low`, `medium`, `high`, `xhigh` or `max`; unset with the `opencode` runner | The triage effort level, the same way |
| `KIT_TRIAGE_MAX_TURNS` | `40` | 1 to 500 | The triage turn limit |
| `KIT_TRIAGE_TIMEOUT_MINUTES` | `15` | 1 to 360 | The triage job's time limit |

The size limits can only be lowered. The workflows check the change
against the pull request's own file and line counts, which stop being exact
past GitHub's diff limits (300 files, 20,000 lines), so a larger change
could be read in part.

### Keys, providers and runners

The review, the scan and triage each have their own provider setting,
which says where the model runs: `anthropic` (the default) on the
`ANTHROPIC_API_KEY` secret, or `opencode-go` on the `OPENCODE_API_KEY`
secret. Triage alone also has a runner setting, the program that runs its
model: Claude Code (the default) or OpenCode's CLI. The review and the
scan always run in Claude Code. Each workflow uses only the secret its
provider names, so both secrets can be set at once. The rows assume the
workflow is turned on (`KIT_REVIEW_MODE`, `KIT_SECURITY_SCAN` or
`KIT_ISSUE_TRIAGE`).

| Secret | Provider and runner settings | What runs |
| --- | --- | --- |
| `ANTHROPIC_API_KEY`, with or without `OPENCODE_API_KEY` | unset (the defaults) | Claude Code on the Anthropic API: the review on `claude-opus-5-5` and triage on `claude-sonnet-5-5`, both at Claude Code's default effort, `medium`, and the scan on `claude-opus-5-5` at `xhigh` |
| `OPENCODE_API_KEY` only | unset (the defaults) | Nothing: the provider is still `anthropic`, so each run fails for want of `ANTHROPIC_API_KEY` |
| `OPENCODE_API_KEY` | the workflow's provider (`KIT_REVIEW_PROVIDER`, `KIT_SECURITY_PROVIDER` or `KIT_TRIAGE_PROVIDER`) set to `opencode-go` | Claude Code on [OpenCode Go](#opencode-go)'s Anthropic-style endpoint, on `deepseek-v4.1-flash` unless the workflow's model setting names another Go model; the scan's `xhigh` default does not apply, and effort works as that section says |
| `OPENCODE_API_KEY` | `KIT_TRIAGE_PROVIDER=opencode-go` and `KIT_TRIAGE_RUNNER=opencode` | Triage in [OpenCode's CLI](#opencode-cli-for-triage), on any Go model its pinned release lists; `KIT_TRIAGE_EFFORT` must stay unset. With `KIT_TRIAGE_PROVIDER` unset or `anthropic`, the settings step refuses this runner and names both settings |

Create the Anthropic key in the Anthropic Console under the organisation
whose credit should pay for the runs, with one key per repository, so
spend shows per repository and a leaked key revokes one place.

### The settings file

`.github/gh-agent-kit.yml` holds settings as lines of `NAME: value`, with
the names above, so a repository's settings are committed and reviewed like
its code instead of set by hand on each repository:

```yaml
# The kit's settings; a repository variable of the same name wins.
KIT_REVIEW_MODE: open
KIT_SECURITY_SCAN: open
KIT_ISSUE_TRIAGE: on
KIT_REVIEW_MAX_TURNS: 120
```

- **A variable wins.** Setting by setting, a repository variable overrides
  the file, so a variable still changes a setting at once, without a pull
  request (`KIT_REVIEW_MODE` set to `off`, say). Each run's settings job
  logs every value and where it came from. When moving from variables to
  the file, delete each variable the file now sets.
- **Read from the default branch.** The workflows read the file on the
  repository's default branch, never a pull request's head, so a pull
  request cannot change its own settings through the file; a change to
  the file applies once it merges, as a change to a variable applies once
  saved. (A pull request from a branch of this repository still runs its
  own copy of the workflows, as [The verdict check](#the-verdict-check) says.)
- **Read strictly.** Only `NAME: value` lines, comments (`#`) and blank
  lines; a value is one word or number, quoted or not. A name the kit does
  not read (a typo, or a secret's name), a name set twice, an indented
  line, a list or a mapping (or a byte-order mark before the first line)
  fails every workflow's run, naming the line but never printing it, until
  the file is fixed. The review and the scan then fail too, recording no
  verdict and a scan that did not complete, even when switched off: the
  settings that would switch them off are unknown.
- **Yours, not the kit's.** `install.sh` neither seeds nor overwrites it,
  and the update check never reports it.

Each workflow runs a short `settings` job first: a job's `if:` and
`timeout-minutes` can read only repository variables and earlier jobs'
outputs (GitHub's context availability table,
<https://docs.github.com/en/actions/reference/workflows-and-actions/contexts>,
read 2026-10-26), so the settings job reads the file and the variables,
checks every value and passes them on, and the workflow's main job runs
only when its switch is on. It runs on every event the workflow would
otherwise consider, the workflow switched off included: a few seconds of
runner time, free on public repositories; on private ones GitHub rounds
each job's time to a whole minute
(<https://docs.github.com/en/billing/reference/actions-runner-pricing>,
read 2026-10-26), so with every workflow off a pull request event can
still cost up to two billed minutes and an issue event one.

## 4. Merge the install pull request

Merge the pull request from step 1. Issue forms, workflows that run on
issue events, on a schedule (the weekly sweep and the update check) or by
hand (*Run workflow*), and the settings file work only from the default
branch (GitHub's "Events that trigger workflows" and "Configuring issue
templates for your repository", read 2026-10-27), so an issue opened
before the merge starts nothing.

## 5. Check the first runs

- With `KIT_ISSUE_TRIAGE` set to `on`, open a Task issue through the form:
  the `issue-triage` workflow runs, and the issue gets a type, a priority
  and `triaged` (or `needs-operator`), and a `## Triage` comment.
- Open a pull request: the `pr-review` workflow posts a
  `## Review R1` comment and inline findings and sets the
  `pr-review verdict` check on the head. A passing verdict is not an
  approval: the kit never approves or merges a pull request, so merging
  stays your decision ([The verdict check](#the-verdict-check)).
- On the same pull request, the `security-scan` workflow posts a
  `Security scan` record comment and inline comments for findings on the
  changed lines (at most 30 a run, each once per line and finding). The
  record says:
  - whether the scan completed, and what it found: "completed, no
    findings", or the first 30 findings with their severity and place,
    descriptions shortened, and the rest in the run's log;
  - how many candidate findings the verification run kept (the ones it
    dropped are listed with its reasons in the run's log, under *Apply the
    verification*);
  - the first 20 files without a text diff, which the scan did not inspect
    (the run's log lists them all).

  A run that fails, or is cancelled on the head the pull request still has
  (its time limit included), says so at the top of that comment, with a
  link to its log. It still lists the findings, and any files the scan did
  not inspect, when the scan itself finished (marked unverified when the
  verification did not).

Each run's log ends with the result: subtype, turns, cost in dollars (the
review's and the scan's also token counts: input, cache read, cache write,
output), any errors and the model's last message, so a failed run says why.

## Costs

Observed on a small Next.js repository with Opus for review and Sonnet for
triage (2026-10-21): a first full review of a pull request about $0.80, a
follow-up review of a further push $0.30 to $0.60, and a triage run about
$0.10. Check the Console's usage page for your own key after the first
runs.

The security scan is two runs of the CLI, the scan and, when it found
candidates, their verification. One scan on Opus at the CLI's default effort
that found nothing cost $0.36 in 8 turns (on the pull request that added the
scan, 2026-10-23). The scan now defaults to `xhigh`, which reads and reasons
more and so costs more per run; neither that nor the verification has been
measured yet, so read each run's cost in its log, and set
`KIT_SECURITY_EFFORT` lower to trade depth for cost.

Models, effort and turn limits are the settings in step 3. Effort trades
thoroughness for tokens within one model: a lower level costs less per run,
a higher one reads and reasons more. With no effort set, Claude Code uses
its default for the model: `medium` on Opus 5.5, Sonnet 5.5 and Haiku 5.5,
`xhigh` on Opus 4.7 and `high` on the other Claude models that take effort
(<https://code.claude.com/docs/en/model-config>, read 2026-10-27), and
`high` on a Go model it does not know ([OpenCode Go](#opencode-go)). The
pinned CLI (2.1.306) takes the five levels above and ignores any other
value with a warning (checked against that release's binary on 2026-10-22),
which is why the settings step refuses one instead. Which levels a model
accepts is Anthropic's list for that model: Opus 5.5, Opus 5, Sonnet 5.5,
Sonnet 5 and Haiku 5.5 take all five, while Opus 4.6 and Sonnet 4.6 have no
`xhigh`. Claude Code runs a level the model lacks at the highest level
below it, so `xhigh` runs as `high` on Opus 4.6
(<https://platform.claude.com/docs/en/build-with-claude/effort> and
<https://code.claude.com/docs/en/model-config>, read 2026-10-23).
`--max-budget-usd` is also available on the pinned CLI and can be added to
each workflow's *Run the …* step.

## OpenCode Go

[OpenCode Go](https://opencode.ai/v2/docs/console/go/) is a monthly
subscription ($10 Go, $40 Go Plus) to open models, each with its own dollar
allowance: 20% of the month's per 5 hours, 50% per week. `KIT_REVIEW_PROVIDER=opencode-go`
runs the review on it, `KIT_SECURITY_PROVIDER=opencode-go` the scan and
its verification, and `KIT_TRIAGE_PROVIDER=opencode-go` triage, through
the same pinned Claude Code CLI and the same tool restrictions; only the
model endpoint and key change. Set the `OPENCODE_API_KEY` secret to a key
from the workspace with the subscription, and `KIT_REVIEW_MODEL`,
`KIT_SECURITY_MODEL` or `KIT_TRIAGE_MODEL` to a Go model id. All three
default to `deepseek-v4.1-flash`. For the review and the scan it is the
only model tested that reviews close to Opus and fits Go Plus at the
volume measured, 644 pushes a month
([the 2026-10-25 report](reports/2026-10-25-review-models.md)). For triage
it is the closest of the three Go models backtested (63 runs on 21 issues
each). It matched Sonnet 5.5 on issue type and on whether to ask questions
or plan, but set priority one level high in 17 runs
([the 2026-10-25 triage report](reports/2026-10-25-triage-deepseek.md)).
Qwen3.8 Flash and MiniMax M3.1 Flash did worse: both raised priority in
28 runs and left an issue untriaged in 2
([the 2026-10-26 triage report](reports/2026-10-26-triage-go-models.md)). Jobs on the same model share its allowance.

What to know first (read 2026-10-23 unless a date is given):

- Claude Code speaks only the Anthropic Messages API, so the model must
  answer on Go's Anthropic endpoint. On 2026-10-25 14 did, among them
  `deepseek-v4.1-flash`, `minimax-m3`, `qwen3.8-flash` and `qwen3.7-plus`;
  the GLM models did not. [Go's endpoint table](https://opencode.ai/v2/docs/console/go/)
  lists DeepSeek V4.1 Flash on the OpenAI-style endpoint only (read
  2026-10-26), so Go could stop serving it on the Anthropic one without
  notice: check a model with a dispatched run first. The settings steps
  refuse the `-contributor` models.
- DeepSeek V4.1 Flash costs double at peak, weekdays 01:00 to 04:00 and
  06:00 to 10:00 UTC; the workspace must allow Global under Settings,
  Privacy; and its zero-retention agreement renews monthly (Go's page, read
  2026-10-26). Two of the 12 reviews it was tested on used 78 and 79 of the
  80 turns, so raise `KIT_REVIEW_MAX_TURNS` for larger pull requests.
- The scan's answer comes back through a tool the CLI adds to the session
  ([structured outputs](https://code.claude.com/docs/en/agent-sdk/structured-outputs)),
  so the scan model needs tool use. On Go nothing constrains the model to
  the schema while it writes (the API's schema constraint is one of the
  experimental features turned off); the CLI checks the answer and asks
  again, and a model that never gets it right fails the run.
- The run sends the pull request's files and diffs (for triage, the
  issue and the files it reads) to OpenCode and the model's host. Go's page gives each model's retention: most are 0 days
  and not used for training, Claude Haiku 5.5 is kept 30 days, and the
  `-contributor` models train on prompts.
- Go is "designed for OpenCode and other coding agents" and monitors
  traffic for abuse; its page says nothing about CI, and OpenCode's
  [terms](https://opencode.ai/legal/terms-of-service) bar "processes
  that run or are activated while you are not logged into the Services".
  Settle that with OpenCode before relying on it.
- The run log's `cost_usd` is Claude Code's figure at Claude prices, not
  what Go charges; the `tokens` line after it, at the model's prices on
  Go's page, is.
- Claude Code sends an effort level to Go with every request, whatever the
  model: the level `KIT_REVIEW_EFFORT`, `KIT_SECURITY_EFFORT` or
  `KIT_TRIAGE_EFFORT` sets, or with none set its own default, `medium` for
  `claude-haiku-5-5` and `high` for a model it does not know, such as
  `deepseek-v4.1-flash` (the pinned CLI's requests, recorded on 2026-10-27
  with the environment the workflows give it). Its docs suggest it would
  not: `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT`, which the workflows do not set,
  sends effort "even when Claude Code does not recognize the model ID"
  ([Claude Code's environment
  variables](https://code.claude.com/docs/en/env-vars), read 2026-10-27).
- What the level does depends on the model. Claude Haiku 5.5 acts on it:
  `high` used about 1.5 times the output tokens of `low` (three runs
  each), and `max` about 6 times (one run). Go accepted `low`, `high`,
  `xhigh` and `max` for DeepSeek V4.1 Flash without an error, but 11 runs
  showed no consistent change in its token use;
  [DeepSeek's own API](https://api-docs.deepseek.com/guides/thinking_mode)
  takes `low`, `high` and `max` and runs `medium` and `xhigh` as `high`
  (read 2026-10-27). So set a level for `claude-haiku-5-5` as you would on
  the Anthropic API; for DeepSeek V4.1 Flash it makes no reliable
  difference. (Tested on 2026-10-27 through Go with the pinned CLI, one
  turn and no tools, on a counting problem that needs reasoning.)
- The scan's `xhigh` default applies only on the Anthropic API: on Go the
  scan runs at the CLI's default unless `KIT_SECURITY_EFFORT` is set.

### OpenCode CLI for triage

Claude Code reaches only the Go models served on Go's Anthropic endpoint.
`KIT_TRIAGE_RUNNER=opencode`, with `KIT_TRIAGE_PROVIDER=opencode-go`, runs
triage in [OpenCode's CLI](https://opencode.ai/docs/cli/) instead, which
takes any Go model its pinned release lists, including the ones Go serves
only on its OpenAI-style endpoints (GLM, Kimi, MiMo and others in
[Go's endpoint table](https://opencode.ai/v2/docs/console/go/)).
`opencode models opencode-go` prints that list. The run does not fetch a
newer list, so a model Go added after the pinned release (1.19.3 lacks
`minimax-m3.1-flash`, for one) fails the run until the pin moves. The
skill, the MCP server, its tools and the checks after the run are the
same; the workflow holds OpenCode to what the Claude Code run allows (all
read 2026-10-26):

- Its configuration is given inline, which outranks a project's own
  ([config](https://opencode.ai/docs/config/)), and the checkout's
  `opencode.json`, `.opencode` directory, plugins, `.claude` directory and
  instruction files are not loaded; its home and data directories are an
  empty directory under the runner's temp directory.
- Every [permission](https://opencode.ai/docs/permissions/) is denied but
  reads, searches and file listing inside the checkout and the run's MCP
  tools. A denied tool is not offered to the model at all, so it has no
  shell, no file-writing tool and no network tool. OpenCode's search
  tools take a path and are checked only against their pattern, so before
  the run `.git` moves out of the checkout and every symlink in it is
  removed, as for the security scan.
- The MCP server starts with only its own variables, so it never sees the
  Go key.
- `KIT_TRIAGE_MAX_TURNS` is OpenCode's step limit; a run that uses every
  step fails, as on Claude Code. `KIT_TRIAGE_EFFORT` must stay unset:
  OpenCode's own effort names differ per model, so it is not passed on.
- The run log's `cost_usd (Go prices)` and `tokens` lines are OpenCode's
  own figures at Go's prices.
- OpenCode installs its plugin package from npm into its own config
  directory in the background on each run; no setting was found to turn
  that off. No plugin is loaded, so none of it runs.

Not yet measured in OpenCode's CLI: how well any model triages there (only
a sweep on DeepSeek V4.1 Flash has run), and how its runs compare with
Claude Code's on the same model. The terms question above applies here
too.

## What each run may do

### Reads and writes

In the review and triage runs the model has no shell, no file-writing tool
and no network tool, and reads files only inside the checkout, outside
`.git`. Every GitHub read and write goes through the MCP server in
`.github/scripts/mcp-server.mjs`, which runs from a root-owned copy outside
the checkout, holds the job token in its own environment only, and offers
named tools:

| Run | Reads | Writes |
| --- | --- | --- |
| Review | The pull request, its conversation, reviews, inline comments, checks, linked issues, files, diffs, commits (a base commit an earlier report recorded is fetched by sha when the checkout no longer has it); a comment, review or linked issue by an author without write access, other than a GitHub App, is listed with its text withheld | Inline review comments on the reviewed head (at most 40), one report comment, and backlog issues for findings outside the pull request's scope (at most 5, one per finding, in the Task form's layout and labelled `needs-operator`), all refused once the head moves; the workflow, not the model, then sets the verdict check |
| Triage (one issue) | The issue, its comments, other issues and pull requests, repository metadata; a comment on the issue, another issue, or the title of an issue or pull request it lists, by an author without write access, other than a GitHub App, is listed with its text withheld, and a pull request by such an author never counts as closing the issue | Named label moves on that issue (never `ready` or `agent:approved`), one comment |
| Sweep | The list of eligible issues the workflow computed | One `issue-triage` dispatch per listed issue, on the current branch |
| Scan and verification | The checkout, the base's rules in it, and the diff, file list and (for the verification) candidate findings the workflow wrote to a directory of its own; no GitHub access | Nothing: each run answers with structured output, which the workflow checks and then posts as at most 30 inline comments on the scanned head and one record comment |

### Issues the reviewer files

An issue the reviewer files is opened by `github-actions[bot]`, and the
triage workflow leaves bot-authored issues alone (the issue's author needs
write access before a model reads its text), so it waits under
`needs-operator` for the operator: triage it by hand, or close it.
Re-applying `needs-triage` starts no run on it, since its author stays the
bot; an agent picks up only an issue with the triage bot's plan, so for
agent work open the finding as an issue of your own, which triage plans,
and close this one.

Its text is the reviewer's, written after reading the pull request's
conversation. A comment by an author without write access reaches the
reviewer with its text withheld, but a GitHub App's comment, or one by
anyone with write access, can still shape it. The server opens it with a
fixed line naming the pull request and the finding, strips HTML comments
from the reviewer's text and escapes headings in every form GitHub renders
(`#`, also after a quote or list marker, a `---` or `===` underline, and
`<h1>` to `<h6>`), so the text cannot pose as the form or another finding's
issue. Check the finding against the code yourself before you mark the issue
`ready` or `agent:approved`.

### The security scan

The security scan needs no MCP server: the workflow writes the pull
request's diff (`git diff` with the base's `.gitattributes`, so a head that
marks its own files `-diff` cannot hide their content) and changed-file list
to a directory outside the checkout, and the model reads those and the
checkout with `Read`, `Grep` and `Glob` only, with reads outside the two
places, and in `.git`, `/proc` and `/dev`, denied. It never sees a GitHub
token, the pull request's conversation or its title and body. Its answer is
structured output against a schema the workflow wrote; a second run in a
fresh session judges each candidate against the code, and only the
candidates it keeps (or gives no verdict on, marked unverified) are posted.
The workflow posts them on the job token, every field the model wrote shown
as plain text, so a finding cannot mention anyone, link, or add markup.

Before the scan, every `CLAUDE.md` and `CLAUDE.local.md` in the checkout is
removed, so Claude Code loads no project memory (and no file a `CLAUDE.md`
imports) from the head, and the skill has the scanner read the base's
`AGENTS.md` files itself; every symlink is removed too, so a link the head
commits cannot lead the model's reads to a runner file; the change to the
link is still in the diff.

Dependency files get no special handling: a changed manifest or lockfile
is read in the diff like any other text file, so a secret or a new install
script in one is checked like any other change. The scanner has no network
and the workflow installs none of the repository's dependencies, so it
cannot look up advisories or read a new package's code. The skill leaves
outdated and known-vulnerable versions to a dependency scanner such as
Dependabot, unless the change adds a dependency fetched without a pin (a
download or action without a commit or a checksum, for one). Dependabot's
own pull requests are neither scanned nor reviewed. A lockfile large
enough to take a pull request past the size limits fails the scan rather
than being read in part, and one the base's `.gitattributes` marks `-diff`
or binary passes unread, as below.

The scanner reads text diffs only: a changed file git shows without one,
with the base's attributes (a binary, for one), passes unread, and the
record names it as not inspected, with a warning in the run's log, so a
green `security-scan` check covers the text diff and the record says what it
left out.

### Other guards

The workflows also:

- refuse an issue or pull request event whose author or actor lacks write
  access, and any bot actor (the sweep's own dispatches run on the job
  token and are exempt). Triage refuses an issue event as a skip: the run
  ends green with a notice naming the login and its access, before any
  checkout, install or model call, so an outside contributor's issue
  leaves no failed run. A dispatch by hand of an issue whose author lacks
  write access still fails, since someone asked for that run, and the
  sweep leaves such issues out;
- keep the reviewer from reading the text of a comment, review or inline
  comment, or of an issue the pull request closes, whose author lacks write
  access to the repository, since anyone who can read it can comment on a
  pull request or open an issue: the server lists such an item with its
  text withheld and the reason. GitHub Apps (Codex, the kit's own reports)
  count as trusted, since only the account's owner or a repository admin
  installs one. A linked issue in another repository, and its comments,
  are judged by access to this one;
- keep the triage bot from reading the text of a comment on the issue it
  triages whose author lacks write access, by the same rule: the comment is
  listed with its text withheld and the reason. The bot's own plans are
  posted by `github-actions[bot]`, an App, and the operator's answers by an
  author with write access, so re-triage still reads both. The other issues
  and pull requests it reads for its duplicate check are screened the same
  way: another issue's title and body, and the title of each issue `search`
  or pull request `open_prs` lists, are withheld when their author lacks
  write access (a fork's pull request among them), while the number,
  labels and author stay. Such a pull request never counts as closing the
  issue either, so a closing keyword in its body cannot hold off the
  stale-claim comment;
- run only on same-repository heads, never on forks, and skip Dependabot
  and Release Please pull requests;
- read the reviewer's and the scanner's skills, the review guidelines,
  every `AGENTS.md`, the scan's instructions file and the server from the
  base branch, so a pull request cannot change the instructions that
  review it. A file the base lacks keeps the pull request's copy (on the
  pull request that first installs the kit, the kit's own skills and
  server), except an `AGENTS.md` or the instructions file, which is
  removed. The reviewer runs with `--restricted`, which loads no project
  memory, and as a second guard every `CLAUDE.md` and `CLAUDE.local.md` in
  the checkout is removed first, so no file a `CLAUDE.md` imports is read
  from the head; every symlink is removed too, so a link the head commits
  cannot lead the reviewer's reads to a runner file;
- remove `.claude`, `.mcp.json` and similar executable configuration from
  the checkout, and run the CLI with `--restricted` and
  `--strict-mcp-config`;
- refuse pull requests a run could not read whole: at GitHub's diff limits
  (300 files or 20,000 lines), or lower limits the repository set, and when
  GitHub cut the diff or the checkout shows fewer changed files than the
  pull request reports, and for the scan when the checkout's own diff
  against the base is beyond those limits (files without a text
  diff are the exception above: passed unread and named in the record);
- fail the run when the model ended in error or posted no report, so a
  skipped review never shows as a green check.

## The verdict check

After the report check passes, `pr-review` records the verdict as a check
run named `pr-review verdict` on the reviewed head, from the heading of the
report this run posted (an addendum's heading carries the verdict that
stands after it; an addendum without one, from a base branch whose skill
predates that, keeps the verdict of the report before it):

| Verdict | Check conclusion |
| --- | --- |
| No blocking findings | `success` |
| Changes required | `failure` |
| Operator decision needed, or none stated | `action_required` |

The check is set in progress on the head as soon as the run decides to
review (after its skip checks), so a new review of a head that already has
a verdict (after a title, base or closing-reference edit, or on a dispatch)
holds a required check until its own verdict replaces the old one. A run
that fails or is cancelled after that leaves `action_required`, "No
verdict: the review did not finish". So does a run that fails before it
decides (in the checkout, the base fetch or a skip check), so an earlier
verdict never outlasts a failed re-review. A run the write-access check
refuses, a run a skip check stops and a run cancelled before it decides
(a newer run of the pull request took over, or someone stopped it) leave
the verdict as it was. Only a report's heading counts: its first line that
starts `## Review R`.

The `pr-review` check itself says whether the run worked; this one says
what the reviewer concluded. Branch protection (or a ruleset) can require
it, which is each repository's own decision. Before requiring it, know
that:

- a head with no review has no verdict check, so a required one blocks the
  merge until a review runs: in mode `open` a later push is not reviewed,
  so use mode `push`. Dispatching `pr-review` for the push sets a verdict
  check too, but whether a required check accepts one a dispatched run
  sets is not verified (`docs/branch-protection-runbook.md`: a dispatched
  run's own checks never count). A pull request the workflow skips
  (Dependabot, Release Please, a fork, a draft) never gets one;
- it gates mistakes, not people: a pull request runs its own copy of
  `pr-review.yml`, and any workflow on the job token can create a check run
  under the same GitHub Actions app, so someone with write access can set
  it; protect the workflows with a code owner review if that matters;
- the verdict is the model's, and the model reads the pull request's
  conversation. The server withholds the text of a comment, review or
  linked issue whose author lacks write access ([What each run may
  do](#what-each-run-may-do)), so only people with write access and GitHub
  Apps can put words in front of it there; the skill tells it never to
  follow instructions it reads, but that is a rule the model keeps, not a
  boundary the workflow enforces, so their comments are part of what
  decides the check;
- with a merge queue, do not require it: `pr-review` has no `merge_group`
  trigger, so the queue's merge-group commit never gets the check and every
  queued pull request waits for it;
- a verdict is not an approval: a passing check says the reviewer found
  nothing blocking, not that anyone agreed to merge.

## The scan's instructions file

The `github-security-scan` skill sends the scanner, and the verification,
to `.github/security-review-instructions.md` for repository-specific focus,
read from the base branch like the skill and `AGENTS.md`. `install.sh` seeds
a generic copy when the target has none and never overwrites one: replace
its bullets with the *Code review rules* of your `AGENTS.md`, the things a
security reviewer of this repository should look at first. Without the file
the scanner works from the skill and `AGENTS.md` alone and says nothing.

## The lock file

`install.sh` writes `.github/gh-agent-kit.lock` with these fields:

- `source`: the kit repository;
- `ref`: the kit commit the files came from;
- `installed`: the time of the install, in UTC;
- `issue_forms`: `own` when the target keeps its own issue forms
  (`--issue-forms=own`), else `kit`; a lock without it, from an earlier
  release, counts as `kit`, and one the installer cannot read is refused
  unless `--issue-forms` decides;
- `dirty`: true when the installer's clone had uncommitted or untracked kit
  files, ignored ones included, the manifest among them;
- `paths`: the files this install manages, none in
  `.github/ISSUE_TEMPLATE/` when `issue_forms` is `own`;
- `seeds`: the ones among them copied only when missing.

Commit it with the install: it is how the next update, and anyone reading
the target, knows which kit commit the files came from.

An update removes a managed file the kit has
since dropped when the lock lists it and the manifest at the lock's ref, read
from the installer's clone, listed it too; a file that manifest marked as a
seed is the target's own by then and stays (the lock's `seeds` list is for the
reader, not the installer). That needs the lock's ref in the history of the
clone's commit (a full clone, or that commit fetched); from a shallow clone,
or with a ref that is not an ancestor, nothing is removed and the installer
says so. A target that keeps its own issue forms loses none of them this
way. The lock is rewritten only when the ref, the path list or
`issue_forms` changes.

The installer refuses to write through a symlink anywhere on a managed path,
and replaces a file by writing a new one and renaming it over the old, so a
hard link to the old file elsewhere keeps its content.

## Updates

`kit-update-check.yml` is off until the setting `KIT_UPDATE_CHECK` is
`on`; then it runs every Monday and on demand
(*Run workflow*).
It reads the lock, fetches the kit its `source` names as a bare clone, and
compares the kit's files at the lock's `ref` with those at the kit's latest
release, its highest `vX.Y.Z` tag (a pre-release such as `v1.2.0-rc.1` is
not one): a file the release changed (content or executable bit), added or
dropped, or moved between seed and managed. Changes on the kit's default
branch that no release carries yet are not reported, and a lock at or past
the latest release, installed from a later commit, counts as current. No
code from the kit runs: the clone is read with `git` only, so the
repository still runs only files it has reviewed and committed. A seed
file's content is the repository's own, so a seed counts only when the kit
adds one or moves one between seed and managed, and local edits to the
kit's files are not checked (`install.sh --check` shows those). With the
lock's `issue_forms` set to `own`, the kit's files in
`.github/ISSUE_TEMPLATE/` never count.

When the release is ahead, the workflow opens one issue labelled
`needs-operator` listing those files, and edits that issue on later runs
rather than opening another; when the lock is current again, it comments
and closes the issue. It never updates the files itself: to update, check
out the release in a clone of the kit (`git checkout vX.Y.Z`), run
`install.sh` from it and open a pull request with the result, as for the
first install. The issue is opened with the job token, so it starts no
other workflow, and triage skips it as bot-authored.

Closing the issue by hand while the release is still ahead only lasts until
the next run, which opens a new one; unset `KIT_UPDATE_CHECK` instead.
Without a lock (the kit's own repository, for one) the run notes that there
is nothing to check and stops, and a kit with no release tag ends the run
with a warning and no issue.

The check fetches the kit anonymously, so the lock's source must be a
public repository; one the job cannot read ends the run with a warning and
no issue.

A repository whose Dependabot updates `github-actions` gets bumps to the
action pins in the kit's workflows too. Merge them as you would for its
own workflows. Until the next install, `install.sh --check` lists those
workflows as files it would update; the install then writes the release's
pins back, and Dependabot proposes any newer one again. The kit's own
Dependabot keeps each release's pins current.

## The pinned CLI

The *Install Claude Code* step in the review, scan and triage workflows
downloads one release of Claude Code from Anthropic's release bucket and
checks its SHA-256 against the value in the step. The value comes from that release's
`manifest.json`, whose signature was verified with Anthropic's published key
(`https://downloads.claude.ai/keys/claude-code.asc`, fingerprint
`31DD DE24 DDFA B679 F42D 7BD2 BAA9 29FF 1A7E CACE`). Dependabot does not
move this pin. To move it:

```sh
v=<new version>
curl -fsSLO "https://downloads.claude.ai/claude-code-releases/$v/manifest.json"
curl -fsSLO "https://downloads.claude.ai/claude-code-releases/$v/manifest.json.sig"
curl -fsSLO https://downloads.claude.ai/keys/claude-code.asc
gpg --with-colons --import-options show-only --import claude-code.asc \
  | awk -F: '$1 == "fpr" { print $10 }'
# Stop unless that prints 31DDDE24DDFAB679F42D7BD2BAA929FF1A7ECACE, the
# fingerprint above: the key and the manifest come from the same host, so
# a key that differs makes the signature check worthless.
gpg --import claude-code.asc
# The signature must come from that key, not merely from an imported one:
# VALIDSIG's last field is the primary key's fingerprint.
gpg --status-fd 1 --verify manifest.json.sig manifest.json \
  | awk '/^\[GNUPG:\] VALIDSIG / && $NF == "31DDDE24DDFAB679F42D7BD2BAA929FF1A7ECACE" { ok = 1 } END { exit !ok }' \
  && echo "signed by the pinned key"
jq -r '.platforms["linux-x64"].checksum' manifest.json
```

Then change `VERSION` and `SHA256` in the three workflows in one pull
request.

The *Install OpenCode* step in the triage workflow, used only with
`KIT_TRIAGE_RUNNER=opencode`, downloads one release of OpenCode's
`opencode-linux-x64.tar.gz` from
[its GitHub releases](https://github.com/anomalyco/opencode/releases) and
checks the binary's SHA-256 against the value in the step. OpenCode
publishes no signed checksum, so the value was taken from the release
asset and compared with the binary in npm's `opencode-linux-x64` package
of the same version. To move it, pick a release at least 7 days old, then:

```sh
v=<new version>
curl -fsSLO "https://github.com/anomalyco/opencode/releases/download/v$v/opencode-linux-x64.tar.gz"
tar -xzf opencode-linux-x64.tar.gz opencode && sha256sum opencode
npm pack "opencode-linux-x64@$v" && tar -xzf "opencode-linux-x64-$v.tgz" package/bin/opencode \
  && sha256sum package/bin/opencode
# Stop unless both print the same checksum.
```

Then change `VERSION` and `SHA256` in *Install OpenCode*.

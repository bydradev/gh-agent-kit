# gh-agent-kit

GitHub Issues as the backlog for coding agents, with AI triage, pull
request review and security scanning in GitHub Actions.

The kit is four GitHub Actions workflows, an MCP server, four skills, issue
forms and a label script. `install.sh` copies them into your repository as
plain files, pinned to a commit of this one, so you review them like any
other change. Until a setting turns a workflow on, it runs only a short
settings check.

The kit was extracted from a working pilot and ships as tagged releases.
It runs on GitHub-hosted Ubuntu runners; [How it runs](#how-it-runs) says
which program and which model each workflow uses.

## What you get

- **Issue triage.** Each new issue, and each issue edited, reopened or
  re-labelled `needs-triage`, gets a type, a priority and a plan comment
  that ties each acceptance criterion to a phase and to how it is proved,
  or a `needs-operator` question when the model cannot decide it. A
  weekly sweep triages the untriaged backlog and warns about stale claims.
  The bot never approves work: `ready` and `agent:approved` are the
  operator's.
- **Pull request review.** A model reviews each pull request against the
  repository's own review guidelines, posts inline findings and a numbered
  report that marks each acceptance criterion of the issues it closes as
  met, not met or not checkable from the change, and sets a
  `pr-review verdict` check. It runs once when the pull request opens, or
  on every push; a later review covers only what changed since the last
  one.
- **Security scan.** A model scans each pull request's change for
  vulnerabilities, once or on every push. A second run, in a fresh session,
  checks each candidate against the code and drops the ones it rejects; the
  rest are posted on the changed lines (marked unverified when it gave no
  verdict), with a record of what was scanned. Known-vulnerable
  dependencies are left to a dependency scanner such as Dependabot
  ([The security scan](docs/setup.md#the-security-scan)).
- **An update notice.** A weekly check opens one issue when the kit's
  latest release has changed files your repository installed from it, and
  closes it once you are current. It reads the kit as data and runs none of
  its code.
- **An implementation skill** (`github-issue-e2e`) for the coding agent
  that picks up an approved issue: claim, branch, implement, validate,
  review, open the pull request that closes it, and report each acceptance
  criterion on the issue with its evidence.

The review and the scan follow the base branch's copies of their skills,
the review guidelines and every `AGENTS.md`, and the review uses the
base's MCP server, never the change's copies. A skill or server the base
lacks comes from the change, as on the pull request that first installs
the kit. The workflow files are the exception: a pull request runs its
own copy of them ([The verdict check](docs/setup.md#the-verdict-check)).

## Quick start

1. Install the files from the latest release into your repository, on a
   branch:

   ```sh
   git clone https://github.com/bydradev/gh-agent-kit
   tag=$(git -C gh-agent-kit tag -l --sort=-v:refname | grep -xE 'v[0-9]+\.[0-9]+\.[0-9]+' | head -n 1)
   git -C gh-agent-kit checkout "${tag:?no release tag found}" &&
     ./gh-agent-kit/install.sh /path/to/your-repo
   ```

   Add the *Work tracking* block from
   [`docs/agents-md-block.md`](docs/agents-md-block.md) to your
   `AGENTS.md`, then commit both and open a pull request.

   This README and `docs/` describe the default branch, which can be
   ahead of the latest release; the copies in your checkout describe the
   release you installed.

   `./gh-agent-kit/install.sh --check /path/to/your-repo` shows what an
   install or update would change, and changes nothing.

2. From your repository, create the labels with
   `.github/scripts/sync-labels.sh owner/repo`.
3. Add the `ANTHROPIC_API_KEY` repository secret. A workflow on
   [OpenCode Go](docs/setup.md#opencode-go) needs the `OPENCODE_API_KEY`
   secret instead, and its provider setting (`KIT_REVIEW_PROVIDER`,
   `KIT_SECURITY_PROVIDER` or `KIT_TRIAGE_PROVIDER`) set to `opencode-go`.
   Then turn on the workflows you want with these settings, each a
   repository variable or a line of
   [`.github/gh-agent-kit.yml`](docs/setup.md#the-settings-file):

   | Setting | Turns on with | Workflow |
   | --- | --- | --- |
   | `KIT_REVIEW_MODE` | `open` (once per pull request) or `push` (every push) | `pr-review` |
   | `KIT_SECURITY_SCAN` | `open` or `push` | `security-scan` |
   | `KIT_ISSUE_TRIAGE` | `on` | `issue-triage`, the weekly sweep included |
   | `KIT_UPDATE_CHECK` | `on` | `kit-update-check` |

   Unset, or `off`, leaves a workflow off; any other value, a capitalised
   one included, fails its run.

4. Merge the pull request: issue forms, workflows that run on issues, on a
   schedule or by hand, and the settings file work only from the default
   branch.
5. Open an issue and a pull request, and check the first runs. A passing
   `pr-review verdict` check means the reviewer found nothing blocking,
   not that anyone agreed to merge: the kit never approves or merges a
   pull request, so that decision stays yours.

[`docs/setup.md`](docs/setup.md) walks through each step in full.

## How it runs

Three of the workflows use a model, through one of two programs and on one
of two hosts:

| Workflow | Program | Model host | Default model |
| --- | --- | --- | --- |
| `pr-review` | Claude Code CLI | Anthropic API, or OpenCode Go | `claude-opus-5-5`; `deepseek-v4.1-flash` on Go |
| `security-scan` | Claude Code CLI | Anthropic API, or OpenCode Go | `claude-opus-5-5` at effort `xhigh`; `deepseek-v4.1-flash` on Go |
| `issue-triage` | Claude Code CLI, or OpenCode's CLI on Go | Anthropic API, or OpenCode Go | `claude-sonnet-5-5`; `deepseek-v4.1-flash` on Go |
| `kit-update-check` | none: `git` and `gh` only | none | none |

- **OpenCode Go** is OpenCode's monthly model subscription. Claude Code
  reaches the Go models served on Go's Anthropic-style endpoint. With
  `KIT_TRIAGE_PROVIDER=opencode-go`, `KIT_TRIAGE_RUNNER=opencode` runs
  triage in OpenCode's own CLI instead, which reaches the Go models its
  pinned release lists ([OpenCode Go](docs/setup.md#opencode-go)).
- **Codex** runs no workflow. Like any coding agent, it can follow the
  implementation skill. Codex and OpenCode read skills from
  `.agents/skills`, and Claude Code from `.claude/skills`, where
  `install.sh` links each kit skill
  ([Codex](https://learn.chatgpt.com/docs/build-skills),
  [OpenCode](https://opencode.ai/docs/skills/),
  [Claude Code](https://code.claude.com/docs/en/skills), read 2026-10-27).

Every model, effort level, turn and time limit and size limit is a setting
([`docs/setup.md`](docs/setup.md#3-add-the-secret-and-the-settings) lists
them). Each default was backtested against cheaper models on the same past
work ([reports](docs/reports/)):

- **Reviews and scans.** Opus 5.5 was the better reviewer and stays the
  default. On Go, DeepSeek V4.1 Flash found 10 of Opus's 14 findings (one
  in part), raised none that were wrong and cost about a tenth as much
  (off-peak; DeepSeek costs double at peak hours); it rates severity
  higher, so it blocks more often. It was also the only Go model tested
  that fit Go Plus's allowance at the maintainer's measured volume of 644
  pushes a month.
- **Triage.** No cheaper model passed: every one set priority one level
  too high in 17 to 28 of its 63 runs. DeepSeek V4.1 Flash came closest and
  is the default on Go. Haiku 5.5 at effort `high`
  (`KIT_TRIAGE_MODEL=claude-haiku-5-5`, `KIT_TRIAGE_EFFORT=high`) costs
  about a ninth as much as Sonnet 5.5 but failed five of six tests.

## What the model can do

In the review and triage runs the model has no shell, no file writes and
no network. Its GitHub reads and writes are named tools of the kit's MCP
server, which limits writes to the one issue or pull request the run is
for and refuses a review's writes once the head moves. The reviewer may
also file up to five backlog issues for findings outside the change, and
the sweep only dispatches triage runs. The scan's model has no GitHub
access at all: it reads the checkout and the diff the workflow wrote, and
the workflow posts what it found.
[`docs/setup.md`](docs/setup.md#what-each-run-may-do) has the details.

## Requirements in the target repository

- An `AGENTS.md` with a *Project specifics* section, a
  `docs/current-work.md`, and the `review-guidelines`, `fresh-eyes-review`,
  `pull-requests` and `worktrees-and-scratch` skills under
  `.agents/skills`. Repositories created by
  [gh-repo-bootstrapper](https://github.com/bydradev/gh-repo-bootstrapper)
  have all of these. The implementation skill also follows the validation
  skill the target's `AGENTS.md` names, if any.
- Issues and pull requests from collaborators with write access: the
  workflows refuse events from anyone else.
- An Anthropic API key with credit (or an OpenCode Go key for the review,
  the scan and triage), `git` for the install and `gh` for the label
  script.

## Documentation

- [`docs/setup.md`](docs/setup.md): install, secrets and settings, costs,
  OpenCode Go, what each run may do, the verdict check, the scan's
  instructions file, the lock file, updates and the pinned CLIs.
- [`docs/labels.md`](docs/labels.md): the fifteen labels, the issue
  lifecycle and who sets what.
- [`docs/agents-md-block.md`](docs/agents-md-block.md): the *Work tracking*
  rules to add to your `AGENTS.md`.
- [`docs/reports/`](docs/reports/): the dated tests behind the default
  models (see [How it runs](#how-it-runs)).
- `.agents/skills/github-pr-review`, `github-security-scan`,
  `github-issue-triage` and `github-issue-e2e`: what the reviewer, the
  scanner, the triage bot and an implementing agent follow.

For work on this repository itself: [`AGENTS.md`](AGENTS.md) (branch,
commit, pull request and validation workflow),
[`docs/branch-protection-runbook.md`](docs/branch-protection-runbook.md)
and [`docs/current-work.md`](docs/current-work.md) (dated status and
decisions).

## Layout

The kit's files sit in this repository at the paths they take in a target,
so this repository runs them on itself. `kit-manifest.txt` lists these
fifteen, and `install.sh` copies them:

```text
.github/workflows/pr-review.yml
.github/workflows/security-scan.yml
.github/workflows/issue-triage.yml
.github/workflows/kit-update-check.yml
.github/scripts/mcp-server.mjs
.github/scripts/sync-labels.sh
.github/ISSUE_TEMPLATE/{bug,task,config}.yml
.github/security-review-instructions.md   (seed: copied once, then yours)
.agents/skills/{github-pr-review,github-security-scan}/SKILL.md
.agents/skills/{github-issue-triage,github-issue-e2e}/SKILL.md
.github/gh-agent-kit/LICENSE              (a copy of this repository's LICENSE)
```

## Contributing and licence

Issues and pull requests are welcome; see [`CONTRIBUTING.md`](CONTRIBUTING.md)
(one change per pull request, Conventional Commit titles) and
[`SECURITY.md`](SECURITY.md) for private vulnerability reporting. Everything
here is [Apache-2.0](LICENSE) except the code of conduct, which keeps its CC
BY-SA 4.0 licence. The files `install.sh` copies stay Apache-2.0 in the
target, and a copy of the licence ships with them as
`.github/gh-agent-kit/LICENSE`.

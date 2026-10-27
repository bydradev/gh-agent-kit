# gh-agent-kit

GitHub Issues as the backlog for coding agents, with Claude doing the
triage, the pull request review and the security scan.

The kit is four GitHub Actions workflows, one small MCP server and four
skills. `install.sh` copies them into your repository as plain files, pinned
to a commit of this one, so you review them like any other change. Every
workflow stays off until a setting turns it on.

The kit was extracted from a working pilot and ships as tagged releases.
It runs on GitHub-hosted Ubuntu runners, through the Claude Code CLI on an
Anthropic API key (the review, the scan and triage can use an OpenCode Go
key instead).

## What you get

- **Issue triage.** Each new issue, and each issue edited, reopened or
  re-labelled `needs-triage`, gets a type, a priority and a plan comment, or
  a `needs-operator` question when Claude cannot decide it. A weekly sweep
  triages the untriaged backlog and warns about stale claims. The bot never
  approves work: `ready` and `agent:approved` are the operator's.
- **Pull request review.** Claude reviews each pull request against the
  repository's own review guidelines, posts inline findings and a numbered
  report, and sets a `pr-review verdict` check. It runs once when the pull
  request opens, or on every push; a later review covers only what changed
  since the last one.
- **Security scan.** Claude scans each pull request's change for
  vulnerabilities, once or on every push. A second run checks each
  candidate in a fresh session and drops the false positives; the rest are
  posted on the changed lines, with a record of what was scanned.
- **An update notice.** A weekly check opens one issue when the kit's
  latest release has changed files your repository installed from it, and
  closes it once you are current. It reads the kit as data and runs none of its code.
- **An implementation skill** (`github-issue-e2e`) for an agent picking up
  an approved issue: claim, branch, implement, validate, review, and open
  the pull request that closes it.

The review and the scan read their rules from the base branch, never from
the change under review.

## Quick start

1. Install the files from the latest release into your repository, then
   commit them on a branch and open a pull request:

   ```sh
   git clone https://github.com/bydradev/gh-agent-kit
   tag=$(git -C gh-agent-kit tag -l --sort=-v:refname | grep -xE 'v[0-9]+\.[0-9]+\.[0-9]+' | head -n 1)
   git -C gh-agent-kit checkout "${tag:?no release tag found}" &&
     ./gh-agent-kit/install.sh /path/to/your-repo
   ```

   This README and `docs/` describe the default branch, which can be
   ahead of the latest release; the copies in your checkout describe the
   release you installed.

   `./gh-agent-kit/install.sh --check /path/to/your-repo` shows what an
   install or update would change, and changes nothing.

2. Create the labels with `.github/scripts/sync-labels.sh owner/repo`.
3. Add the `ANTHROPIC_API_KEY` repository secret (or `OPENCODE_API_KEY`
   for a review, scan or triage on [OpenCode Go](docs/setup.md#opencode-go)).
4. Turn on the workflows you want with these settings, each a repository
   variable or a line of
   [`.github/gh-agent-kit.yml`](docs/setup.md#the-settings-file):

   | Setting | Values | Workflow |
   | --- | --- | --- |
   | `KIT_REVIEW_MODE` | `open` (once per pull request) or `push` (every push) | `pr-review` |
   | `KIT_SECURITY_SCAN` | `open` or `push` | `security-scan` |
   | `KIT_ISSUE_TRIAGE` | `on` | `issue-triage`, the weekly sweep included |
   | `KIT_UPDATE_CHECK` | `on` | `kit-update-check` |

5. Open an issue and a pull request, and check the first runs.

[`docs/setup.md`](docs/setup.md) walks through each step in full.

## Models

| Workflow | Default | On OpenCode Go | Effort |
| --- | --- | --- | --- |
| `pr-review` | `claude-opus-5-5` | `deepseek-v4.1-flash` | the CLI's default, `medium` on Opus 5.5 |
| `security-scan` | `claude-opus-5-5` | `deepseek-v4.1-flash` | `xhigh` (none on OpenCode Go, where effort is untested) |
| `issue-triage` | `claude-sonnet-5-5` | `deepseek-v4.1-flash` | the CLI's default, `medium` |

Each is a setting (`KIT_*_MODEL`, `KIT_*_EFFORT`, `KIT_*_PROVIDER`
and, for triage, `KIT_TRIAGE_RUNNER`), alongside the turn, time and size
limits;
[`docs/setup.md`](docs/setup.md#3-add-the-secret-and-the-settings) lists
them all. Claude Code's docs give `medium` as the default effort for Opus
5.5, Sonnet 5.5 and Haiku 5.5
(<https://code.claude.com/docs/en/model-config>, read 2026-10-23).

Each default was tested against cheaper models on the same past work:

| Job | Use | Tested against it | Report |
| --- | --- | --- | --- |
| Review and scan | Opus 5.5; on OpenCode Go, DeepSeek V4.1 Flash | DeepSeek V4.1 Flash, MiniMax M3, Qwen3.8 Flash and MiniMax M3.1 Flash, on OpenCode Go | [2026-10-25](docs/reports/2026-10-25-review-models.md) |
| Triage | Sonnet 5.5; on OpenCode Go, DeepSeek V4.1 Flash | Haiku 5.5 at effort `high`; DeepSeek V4.1 Flash, Qwen3.8 Flash and MiniMax M3.1 Flash, on OpenCode Go | [2026-10-23](docs/reports/2026-10-23-triage-model.md), [2026-10-25](docs/reports/2026-10-25-triage-deepseek.md), [2026-10-26](docs/reports/2026-10-26-triage-go-models.md) |

**Reviews and scans.** Opus 5.5 found the most real problems. DeepSeek
V4.1 Flash found 10 of Opus's 14 findings (one in part) and raised none
that were wrong, at about a tenth of the cost; it rates severity higher, so
it blocks more often. It is the only model tested that fits the Go Plus
allowance at 644 pushes a month (off-peak; DeepSeek costs double at peak
hours). The others either cost about five times as
much (MiniMax M3), fit only about 400 pushes a month (Qwen3.8 Flash), or
made wrong blocking findings (MiniMax M3.1 Flash).

**Triage.** No cheaper model passed. Every one set priority one level
too high, and never too low, in 17 to 28 of its 63 runs:

- **Haiku 5.5** costs about a ninth as much per run, but failed five of
  six tests. It also labelled chores as bugs in 15 runs.
- **DeepSeek V4.1 Flash** on Go costs about a sixth as much and failed
  only on priority. It is the default when triage runs on Go.
- **Qwen3.8 Flash** and **MiniMax M3.1 Flash** on Go also missed the type
  bar, and each left an issue untriaged in 2 runs.

A repository that weighs cost differently can set
`KIT_TRIAGE_MODEL=claude-haiku-5-5` with `KIT_TRIAGE_EFFORT=high`, or
`KIT_TRIAGE_PROVIDER=opencode-go`. Both are configurations that were
tested.

### Providers

Every run uses Claude through the Claude Code CLI by default. The review,
the scan and triage can instead run on an OpenCode Go model through the
same CLI (`KIT_REVIEW_PROVIDER`, `KIT_SECURITY_PROVIDER` and
`KIT_TRIAGE_PROVIDER`, see [OpenCode Go](docs/setup.md#opencode-go)).
Triage can also run in OpenCode's own CLI, for Go models Claude Code
cannot reach (`KIT_TRIAGE_RUNNER`, see
[OpenCode CLI for triage](docs/setup.md#opencode-cli-for-triage)).

The provider-specific parts are small and marked: the *Install Claude
Code* and *Run the …* steps of each workflow, the scan's *Verify the
candidate findings* step, and the two key secrets. Everything else (the
gates, the MCP server, the skills, the reports, the `KIT_*` settings) is
provider-free, so adding another CLI means adding its own install and run
steps and key.

## What the model can do

In the review and triage runs the model has no shell, no file writes and
no network. Its GitHub reads and writes are named tools of the kit's MCP
server, which limits writes to the one issue or pull request and refuses
them once the head moves. The scan's model has no GitHub access at all: it
reads the checkout and the diff the workflow wrote, and the workflow posts
what it found. [`docs/setup.md`](docs/setup.md#what-each-run-may-do) has
the details.

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
  the scan and triage), and `gh` and `jq` locally for the label script.

## Documentation

- [`docs/setup.md`](docs/setup.md): install, secrets and settings, costs,
  OpenCode Go, what each run may do, the verdict check, the lock file,
  updates and the pinned CLI.
- [`docs/labels.md`](docs/labels.md): the fifteen labels, the issue
  lifecycle and who sets what.
- [`docs/agents-md-block.md`](docs/agents-md-block.md): the *Work tracking*
  rules to add to your `AGENTS.md`.
- [`docs/reports/`](docs/reports/): the dated tests behind the default
  models (see [Models](#models)).
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

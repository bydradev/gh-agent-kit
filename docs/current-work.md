# Current work

Dated status for whoever picks this repository up next: work in progress,
decisions and when they were made, and anything deliberately not set up yet.
`AGENTS.md` holds the durable rules; status that can go stale belongs here.

Date each entry, and delete it once it no longer applies.

## In progress

### Public release (2026-10-26, public since 2026-10-27)

The operator chose to publish the kit as a new public repository named
`gh-agent-kit`, made from one squashed commit of the original repository's
tree after its last release, with the original renamed and kept private.
The pull request, issue and version numbers these docs cited were the
original repository's, so they were reworded before the squash. This
repository went public on 2026-10-27.

It numbers its releases afresh from 0.1.0 (the operator's choice,
2026-10-27). The root commit set Release Please's `initial-version` to
`0.1.0` and left `.release-please-manifest.json` empty, so with no earlier
release to bump from Release Please proposed 0.1.0 as the first release
(release-please v17.6.0, the version release-please-action v5.0.0 depends
on, `src/strategies/base.ts`, read 2026-10-27). v0.1.0 was released on
2026-10-27. Release Please ignores `initial-version` once a release exists,
so the setting can stay.

Set when it went public, on 2026-10-27:

- branch protection on `main`: the `validate-title`, `tests` and
  `public-content` checks, conversation resolution, and admins included;
- private vulnerability reporting, which `SECURITY.md` names as the only
  reporting channel;
- gh-repo-bootstrapper's `bootstrap.py --configure-only`: the Actions
  policy, with fork pull request approval for all outside contributors,
  secret scanning, push protection and CodeQL default setup (Dependabot
  alerts were already on);
- by hand, Dependabot malware alerts on, and the auto-triage preset that
  dismisses low-impact alerts for development-scoped dependencies off.

Added later the same day: a *Code scanning* ruleset on the default branch,
with no bypass, so a merge waits for CodeQL's results and is blocked by a
security alert of medium severity or higher, or by an error-level alert.

The one target repository installed from the original repository, whose
lock named a commit outside this repository's history, was reinstalled
from v0.1.0 on 2026-10-27.

### Settings in a repository file (2026-10-26)

Every `KIT_*` setting can now be a line of `.github/gh-agent-kit.yml`,
read from the default branch, as well as a repository variable; a variable
wins (`docs/setup.md`, *The settings file*). Each workflow gained a
`settings` job ahead of its main job. On 2026-10-27 this repository's
three settings moved from variables into the file with the same values
(`KIT_REVIEW_MODE: push`, `KIT_SECURITY_SCAN: open`,
`KIT_ISSUE_TRIAGE: on`); the operator deletes those variables once the
file is on `main`. Still to do: confirm on a real run that a switched-off
workflow's run no longer reads as a successful review in the review's skip
steps.

### Security scan on the pinned CLI (2026-10-23)

The operator chose to replace `anthropics/claude-code-security-review` with
a scan on the kit's pinned Claude Code CLI: the action's filter calls a
retired model on every run, and its own CLI (2.1.197, held back by Node 18)
rejects current models such as `claude-opus-5-5`. `security-scan.yml` now
runs a scan and a verification run that follow `github-security-scan`, with
no MCP server and no GitHub access for the model. In the same change triage
became opt-in, like the other switches (`KIT_ISSUE_TRIAGE=on`): every
installed repository needs that variable set before it updates, or triage
stops (this one has it, 2026-10-23). Measured once: a scan with no
candidates cost $0.36 (on the pull request that made this change). Not yet
measured: the verification's cost, and how often it drops a real finding. On
the operator's ask (2026-10-23) the scan now defaults to effort `xhigh` on
the Anthropic API, for the scan and the verification; on OpenCode Go it
still passes no effort, since effort there is untested. The cost of an
`xhigh` scan is not measured yet either.

### OpenCode Go provider (2026-10-23, updated 2026-10-26)

`KIT_REVIEW_PROVIDER` and `KIT_SECURITY_PROVIDER` can run the review and
the scan on an OpenCode Go model through the same CLI
(`docs/setup.md`, *OpenCode Go*). On 2026-10-25 four Go models replayed 12
reviews and 9 scans against Opus 5.5
([report](reports/2026-10-25-review-models.md)); both Go defaults are now
`deepseek-v4.1-flash`, the only one that fit Go Plus at the measured
volume. The operator keeps this repository on Opus. Still open: OpenCode's
terms bar "processes that run or are activated while you are not logged
into the Services" while Go's docs say nothing about CI, which is the
operator's call; and Go's endpoint table lists DeepSeek V4.1 Flash only on
the OpenAI-style endpoint, though it answers on the Anthropic one.

On the operator's ask (2026-10-26) `KIT_TRIAGE_PROVIDER` does the same for
triage, defaulting to `deepseek-v4.1-flash` on Go. It is the closest of
the three Go models backtested for triage, short only on priority: one
level high in 17 of 63 runs
(`docs/reports/2026-10-25-triage-deepseek.md`). Qwen3.8 Flash and MiniMax
M3.1 Flash also missed the type bar and left issues untriaged
(`docs/reports/2026-10-26-triage-go-models.md`).
`KIT_TRIAGE_RUNNER=opencode` runs triage in OpenCode's own CLI
(1.19.3), for Go models Claude Code cannot reach (`docs/setup.md`,
*OpenCode CLI for triage*). Tried once (2026-10-26): a sweep on DeepSeek
V4.1 Flash through the workflow's run step, the kit's MCP server and a stub
`gh` read the skill, listed the eligible issue and dispatched it, in 4 steps
for $0.001. Not yet run: a single-issue triage on OpenCode, and the triage
backtest on it. The next step for triage on Go is a priority note in the
skill, re-tested on DeepSeek.

### Documentation and reports (2026-10-23)

The operator chose to keep long-form documentation in `docs/`, reviewed in
pull requests like the code, rather than in a GitHub Wiki, with dated
assessments in `docs/reports/` and a short summary in the README. A GitHub
Pages site for the reports was planned for once the repository went
public; on 2026-10-27 the operator dropped it, so the reports stay as
Markdown in `docs/reports/`.

### Renamed to gh-agent-kit (2026-10-22)

The operator renamed the repository from github-agent-kit on 2026-10-22,
following gh-repo-bootstrapper's `gh-` pattern, and chose to rename the
lock and the licence directory with it (`.github/gh-agent-kit.lock`,
`.github/gh-agent-kit/`); `install.sh` migrates a target's old lock. The MCP
server keeps the name `agent-kit`.

GitHub redirects the old name, web and `git clone`, `fetch` and `push`
alike, until a new repository takes it, so never create one named
github-agent-kit; the docs and a target's lock do not rely on the redirect
([Renaming a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository),
read 2026-10-22).

### Kit extracted from a private pilot (2026-10-22)

The workflows, MCP server, skills, label script and issue forms were extracted
from a pilot in a private repository of the maintainer's, with the MCP server
renamed to `agent-kit`. Set on 2026-10-22: the `ANTHROPIC_API_KEY` secret, the
`KIT_REVIEW_MODE` (`push`, `open` by 2026-10-23) and `KIT_SECURITY_SCAN`
(`open`) variables, and the labels from `sync-labels.sh`; the kit's workflows
review and scan this repository's pull requests. Added on 2026-10-22, aligned
with gh-repo-bootstrapper: the Apache-2.0 `LICENSE`, `CONTRIBUTING.md`,
`SECURITY.md` and `CODE_OF_CONDUCT.md` (the DCO sign-off and its `dco` check
were dropped on 2026-10-27, the operator's choice: the licence already covers
contributions). The install into the pilot repository is done. The reviewer
notes recorded on the pull request that added the kit were taken up in one
follow-up pull request. The kit's original repository stays private; the
public kit is a new repository (*Public release* above).

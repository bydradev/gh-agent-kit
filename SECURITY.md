# Security policy

## Reporting a vulnerability

GitHub private vulnerability reporting is the sole security channel for this
repository. Open the repository's **Security** tab and choose **Report a
vulnerability**. Do not open a public issue for anything exploitable or for
information that would make exploitation easier.

A proof of concept may be included in the private advisory when it is needed
to reproduce and confirm the report. A suggested fix is welcome there too. A
fix that is merged follows [`CONTRIBUTING.md`](CONTRIBUTING.md).

The maintainer reads and answers reports as time allows, best effort, with
no set response time, and keeps the reporter updated in the advisory until
the report is fixed or declined.

## Supported versions

Security fixes land on `main` and ship in the next release; earlier releases
get no backports. A repository that installs the kit pins a kit commit in
`.github/gh-agent-kit.lock`, so it has a fix only once it re-runs
`install.sh` from a clone checked out at that release's tag
([`docs/setup.md`](docs/setup.md#updates)). The `kit-update-check` workflow,
when it is on, opens an issue once the kit's latest release has changed
files since the lock's commit; changes on `main` that no release carries
are not reported. The advisory for a fixed vulnerability is published with
the release that fixes it and names that release.

## Scope

The kit is a set of GitHub Actions workflows, an MCP server and skills that a
repository installs and runs with its own model key (the `ANTHROPIC_API_KEY`
secret, or `OPENCODE_API_KEY` for a review, scan or triage on OpenCode Go)
and the job's `GITHUB_TOKEN`. The model reads pull requests and issues, including
text written by anyone who can open one; the review and triage models write
comments and labels through the server, and the workflow posts the scan's
findings. Findings here matter in every repository that installs the kit, so
the most useful things to report:

- A way for a pull request or issue to run code with the API key or the job
  token: a hook, MCP server or setting the checkout supplies, a path the
  reviewer's rules or the server are read from that the change under review
  controls, or a gate (write access, same-repository head, draft) that a
  pull request event can pass without the access it claims.
- A write the server allows that the documented permission model does not:
  a label the bot may not set, a second report or comment in one run, or a
  report posted after the head or base moved, the pull request closed, or
  the run went stale.
- A workflow that interpolates untrusted text (a title, body, branch name or
  label) into a shell command or a workflow expression, or that grants
  `GITHUB_TOKEN` more than the documented permissions.
- An `install.sh` path that writes outside the target repository, follows a
  symlink or hard link out of it, or removes a file the target owns on the
  strength of a lock entry alone.
- A gap between what the record comment, the report or the setup guide says
  was checked and what the run actually read.

The installed files are copied into the target repository by `install.sh`;
report a finding against this repository, not against each target.

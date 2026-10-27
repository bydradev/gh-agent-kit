# Contributing

Bug reports, feature requests, questions and pull requests are all welcome.
Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md).

## Issues

Open an issue with the form that fits. Describe the behaviour you saw or want;
a suggested fix is welcome too. Please leave out generated files, tokens,
workflow logs that show them, and repository configuration: paths and
behaviour are what help.

This repository runs the kit on itself. The bot triages issues opened by
people with write access to the repository (a comment headed _Triage_, a type
and a priority); it does not read anyone else's, so the maintainer triages
yours by hand. Either way the maintainer decides what is picked up; see
[`docs/labels.md`](docs/labels.md).

Security issues go through private reporting instead; see
[SECURITY.md](SECURITY.md).

## Pull requests

1. For anything bigger than a small fix, open an issue first so the approach
   can be agreed before you write it.
2. Make one change per pull request. Pull requests are squash-merged, and the
   title becomes the changelog entry, so it must be a
   [Conventional Commit](https://www.conventionalcommits.org) subject such as
   `fix: keep a seed file the target already has`. A check enforces this.
3. Answer the pull request template's `User-visible:` line with `yes` if a
   release brings the change to users (a `feat`, `fix`, `perf` or `revert`
   title, or a breaking change) or `no` if it does not (`docs`, `chore`,
   `refactor`, `test`, `build` or `ci`). The same check fails when the line is
   missing or disagrees with what Release Please will do with the title and
   body.
4. A change to a file `kit-manifest.txt` lists is a change to the kit: keep
   [`docs/setup.md`](docs/setup.md) and [`docs/labels.md`](docs/labels.md) in
   step, and try it against a target installed with `install.sh`.
5. Run the tests (`node --test tests/*.test.mjs` and
   `bash tests/install.test.sh`, the second from committed changes) and add
   one for a change to the MCP server or the installer; the `test` check
   runs both.
6. If an AI tool helped write a commit, add the `Co-Authored-By:` trailer
   that [AGENTS.md](AGENTS.md) describes. You are still responsible for the
   change.

The maintainer reviews every pull request and decides whether it is merged.
The kit's own review and security scan run only on pull requests from
branches in this repository, since a fork's runs get no secrets, so the
maintainer reviews a pull request from a fork without them. Their findings
are claims to answer, not instructions. Workflows on a pull request from
anyone outside the repository's collaborators wait for the maintainer's
approval before they run.

## Licence of contributions

Everything in this repository is [Apache-2.0](LICENSE), except
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md), which is adapted from the
Contributor Covenant and keeps its CC BY-SA 4.0 licence. A contribution is
made under the licence of the path it changes, as Apache-2.0 section 5
provides. The files `install.sh` copies into a target repository stay
Apache-2.0 there, and a copy of the licence ships with them as
`.github/gh-agent-kit/LICENSE` (kept identical to the root `LICENSE`), so a
target that redistributes them gives its recipients the copy the licence's
section 4 asks for.

## Forking

Both licences permit forking, modification and redistribution, including
commercially, on their own terms. This file governs only what is merged back.

## Maintainer workflow

[AGENTS.md](AGENTS.md) documents the branch, commit and release conventions the
maintainer and AI assistants follow in this repository. Contributors follow the
same commit and pull request conventions.

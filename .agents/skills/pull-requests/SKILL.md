---
name: pull-requests
description: >-
  Use before committing or preparing, editing, readying, unblocking or merging a pull request. Covers commit attribution and Release Please squash messages.
---
<!-- gh-repo-bootstrapper: template-owned; sha256=ca61266512056bbff0f2074ecda4f3861a0b9b423716a1dbbe5681f3e62f1fa7 -->

# Pull requests (squash-merge + Release Please)

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org):
`type(scope): subject`. Scope is optional. Use `feat`, `fix`, `chore`,
`docs`, `refactor`, `perf`, `test`, `build`, `ci` or `revert` and a lowercase
imperative subject with no trailing period.

For a commit an AI tool materially wrote or changed, keep its harness's
`Co-Authored-By:` trailer naming the actual model. If absent, add
`Co-Authored-By: <Tool> (<model>) <address>` with the running model.
Tool addresses: Codex `noreply@openai.com`, Antigravity CLI
`224641728+gemini-cli-robot@users.noreply.github.com`, OpenCode
`noreply@opencode.ai`, OMP `noreply@omp.sh`, OMO `noreply@omo.dev`.

## Standard pull requests

Standard PRs are squash-merged and parsed by Release Please, so write them
merge-ready:

- **Attribution:** end the PR body with a `---` rule and one footer,
  `*Prepared with the assistance of <Tool> (<model>).*`, replacing any harness
  footer. Keep co-author trailers in commits only.

- **Title:** one Conventional Commit subject naming one concrete change, not a
  label summarizing several bundled changes (e.g. not
  `fix: address review follow-ups (path handling, branch protection, clone retry)`,
  which is a summary, not a change). If a PR bundles multiple distinct fixes,
  title it after the single most significant one and list the rest as extra
  changelog entries below, or split the PR. The title becomes the squash
  subject, the changelog entry, and the version-bump signal.
- **User-visible line:** the body carries one line of its own, at column 0,
  reading `User-visible: yes` or `User-visible: no`. Decide it from the diff,
  then choose the type that agrees; never change the answer to fit a type.
  `yes`: what the released project does, outputs or ships changes (help
  text included), typed `feat`, `fix`, `perf` or `revert`, or breaking (`!`
  or a `BREAKING CHANGE:` footer). `no`: docs readers get as soon as it
  merges, CI, tests, refactors and tooling, typed `docs`, `chore`,
  `refactor`, `test`, `build` or `ci`. The required title check reads the
  body too: include released extra entries and breaking-change notes in
  your decision. Keep `BEGIN_COMMIT_OVERRIDE` out of prose, give breaking
  footers a description, and use a numeric `Release-As:` version. Follow
  the check's diagnostic for formatting errors. Editing the body reruns it.
  Release Please and Dependabot PRs are exempt from this check.
- **Body:** optional prose describing the title's change, then any *extra*
  changelog entries: each a short, imperative, commit-subject-length line at
  column 0 with a bare type token (`fix: short subject`), blank-line separated,
  with any longer explanation on an *optional description line underneath*,
  not packed into the entry line itself. Release Please parses each entry line
  as its own commit subject and will truncate a long one mid-sentence in the
  rendered changelog. A PR body alone never reaches the branch (Release Please
  reads the squash commit), so these lines must also be carried into the merge
  message; see *Squash merges* below. No `-`/`*` bullets, and don't repeat the
  title as an entry.
- **CLI-authored bodies:** create multi-paragraph Markdown in a file passed to
  `gh pr create` or `gh pr edit` with `--body-file`; a shell-quoted `\n` is
  literal text. Before marking a standard PR ready, read it back with
  `gh pr view <n> --json body --jq .body` and verify the paragraphs render.
- **Squash merges:** the squash commit message is all Release Please reads.
  Whatever performs the merge must be given that message, which replaces the
  one GitHub would have generated: the PR's prose, then each extra entry line
  at column 0 and blank-line separated, then any `Release-As:` footer and the
  applicable `Co-Authored-By:` trailers, one per line. The title check judged
  the PR body, so carry its extra entries, `Release-As:` footer and any
  breaking-change note over unchanged: a message that drops or edits them
  changes what Release Please releases. The exception is a PR body with a
  `BEGIN_COMMIT_OVERRIDE` block: Release Please reads the commit from that
  block in the PR body, not from the message, so leave the block in the body
  unchanged. Do not pass an empty message, and do not assume the PR
  description is included. With `gh`, for example:

  ```sh
  gh pr merge <n> --squash --delete-branch --body-file <merge-body.md>
  ```

  With the GitHub MCP server's `merge_pull_request`, pass
  `merge_method: squash` and the message as `commit_message`. A one-line
  message is correct only when the PR body has no extra entry lines,
  `Release-As:` footer or breaking-change notes. Verify the resulting commit
  message after merging (`git log -1 --format=%B`): a dropped entry line is
  otherwise invisible until the release PR is regenerated.
- **Applicable trailers:** a trailer belongs to a commit an AI tool materially
  wrote or changed, as described under *Commits*.
  Carry the squashed commits' trailers into the merge message with their
  addresses unchanged. Merging a change you did not write, such as a
  Dependabot PR, adds no trailer. Never take the address for a trailer or
  sign-off from the account the merge runs under, which a harness may give an
  agent: it can be a private address, and the history keeps it. A sign-off of
  your own uses a noreply address, such as GitHub's
  `ID+login@users.noreply.github.com`.
- **Rendered entries:** only `feat` (or its `feature` alias), `fix`, `perf`,
  and `revert` entries render: with no `changelog-sections` configured,
  release-please leaves the section list to the preset it depends on, whose
  defaults hide `docs`, `style`, `chore`, `refactor`, `test`, `build`, and `ci`
  and define no `deps` type at all, so a `docs:`, `ci:`, or `deps:` extra is
  absent from the changelog even when it is delivered.

## Release Please pull requests

Release Please PRs are bot-generated release artifacts, not standard PRs.

- Do not edit their generated title or body merely to apply the standard-PR
  formatting rules.
- When merge is authorized and the required checks and branch-protection
  requirements are satisfied, squash merge using GitHub's default title and
  body content. Do not supply a custom squash title or body, and add no
  co-author trailer: you did not write the release commit.

## Blocked pull requests

When required status checks block a pull request (most often a release PR),
follow `docs/branch-protection-runbook.md` (repository root) and the
`AGENTS.md` rule on the required check set.

## Sources

- Which entries render and release, and how a squash body and override block
  are read: release-please v17.6.0 and v17.11.2 with
  conventional-changelog-conventionalcommits 6.1.0, checked 2026-10-18 and
  2026-10-23.
- How a release PR body is read back: release-please v17.6.0 with
  node-html-parser 6.1.11 and 6.1.13, checked 2026-10-22.
- GitHub's default squash message (dashes, then trailers): 24 squash commits
  on gh-repo-bootstrapper's `main`, checked 2026-10-23.
- `merge_pull_request` parameters: the `github/github-mcp-server` README,
  checked 2026-10-16.

<!-- gh-repo-bootstrapper: template-owned; sha256=1c33eda8b821e29602439de8a01138da63bdbbf0e8887cd26716b1d084833bcd -->
# Branch protection runbook

Use this when a required check blocks a pull request, most often a release
PR. The live branch-protection rule is the source of truth for required
checks: read it with the commands below, never from another repository.

## Before relying on protection

- The rule must require a pull request, apply to administrators, and require
  only checks the current CI reports. Prove the names and App IDs on a real
  pull request whose current merge result reports every required check.
- A reusable workflow's job reports as `{caller job} / {reusable job}`:
  `test / build` and `test / e2e` for Next.js, `test / test` for Python, Swift
  and Rust, not the job name inside `test.yml`.
- Release Please uses this repository's GitHub App token, so its PRs start
  checks without approval; the workflow's own `GITHUB_TOKEN` only reads
  (`contents: read`, plus `pull-requests: read` on the release job of a
  repository whose release waits for tests, for the guard that lists merged
  release pull requests). The operator sets variable
  `RELEASE_PLEASE_CLIENT_ID` and secret `RELEASE_PLEASE_APP_KEY`; never put
  either in source, logs, issues or pull requests. Trust release automation
  once its first release PR reports every required check.

## A check fails on code that `main` already fixed

**Check:** compare the head and base the failing run tested (its checkout log
reads `Merge <head> into <base>`) with the PR's current head and the `main`
tip. By default Release Please updates its PR only when the release notes
change, so its checks can test an old base.

**Action:** if both match, the failure is real: fix it. If the head differs,
read the run for the current head instead. If the base differs, the result is
stale. Do not re-run: a re-run reuses the original event's commit and ref, so
it tests the same stale tree. Waiting may not help, and a fresh event, such as
a close and reopen, can still capture the stale merge ref. After one, read
`mergeable` and `merge_commit_sha` together (a read can start a recompute;
`null` means read again) and check the merge commit's parents. If it is still
stale and `update-branch` is not authorized, try another fresh event. When
authorized, `update-branch` merges `main` into the PR branch and starts new
runs; Release Please later replaces that merge commit.

## A required check stays pending

**Check:** compare the live rule's required checks with the names
`gh pr checks` lists; a check that never reported is missing from it.

- A job skipped by its own `if:` reports `skipped`, which satisfies a required
  check; `pr-title-check.yml` relies on this for Release Please's PRs. A job
  skipped because a job it needs failed may also pass, though nothing ran.
- A check that never reports stays pending forever. A workflow skipped by a
  path, branch or commit-message filter never reports, and `pull_request`
  workflows do not run while the PR has a merge conflict.
- The rule may require a name the current CI never reports. Do not make a
  required job skip itself or add a stand-in that reports its name to satisfy
  the rule. Correcting a name in the rule is a protection change: ask the
  operator.
- Runs on a PR created or updated with `GITHUB_TOKEN` wait for approval:
  check the PR's author and its runs. Someone with write access selects
  **Approve workflows to run**; the App token avoids the wait.

**Action:** make the workflow report, and keep the check required.

## The checks list shows an old failure

**Check:** find the commit GitHub evaluates: the PR's test merge commit
(`merge_commit_sha`) when it has a status, otherwise its head commit. List
that commit's check runs and its commit statuses (newest first, with who set
each) with the commands below.

GitHub counts the latest check run per name from the same App on that commit,
and the latest commit status per context, so a failure followed by a success
of the same kind does not block. Nothing else replaces a failure: a commit
status and a check run with the same name must both pass, a result from
another App or integration does not satisfy a check the rule ties to an App,
and results on an earlier commit do not count. A workflow job's check
counts only when its run was triggered by `push`, `pull_request`,
`pull_request_review`, `pull_request_target`, `deployment` or
`deployment_status` (`merge_group` for a merge queue), and a
`workflow_dispatch` run's checks never count. The run ID is in the check's
details URL (`.../actions/runs/<run-id>/job/...`), and
`gh run view <run-id> --json event` shows the event.

**Action:** if a failure still counts under those rules, it is real: fix it,
or read the section above when `main` already fixed it. `mergeStateStatus`
confirms whether the PR is still blocked.

## Unresolved conversations block the merge

**Check:** when the live rule requires conversation resolution
(`required_conversation_resolution.enabled`), every unresolved review thread
blocks the merge, for administrators too when the rule applies to them
(`enforce_admins`). List the PR's unresolved threads with the commands below.

**Action:** answer each finding with the fix or the evidence, as
`fresh-eyes-review` says, then resolve its thread. A reviewer resolves only
its own threads, and a disputed P0 or P1 finding is the operator's to
resolve. Never resolve a thread without answering it just to unblock a merge.

## Still blocked

A stuck PR is a pause state, not authority to weaken protection: the rule
binds administrators, the operator included. Repair or retrigger the workflow
through its supported mechanism. Never drop a required check, use an admin
bypass, or disable protection to land a change.

If the rule itself still blocks after materially distinct attempts, stop and
ask for explicit operator authorization. An approved temporary change must:

1. save the complete live rule and an exact restoration payload first;
2. name the single PR and the reason;
3. record the before state, the change, the merge or repair, and the after
   state;
4. restore protection immediately; and
5. independently re-query the complete rule, App IDs included, and diff it.

Making the protected path work is always preferred; a temporary change is
never the normal release procedure.

## Commands

```sh
R=repos/<owner>/<repo>; O=<owner>/<repo>
gh api $R/branches/main/protection
gh api $R/branches/main/protection --jq '.required_status_checks.checks[] | [.context, .app_id] | @tsv'
gh pr checks <n> -R $O
gh api --paginate "$R/commits/<sha>/check-runs?per_page=100" --jq '.check_runs[] | [.name, .app.id, .conclusion, .details_url] | @tsv'
gh api --paginate "$R/commits/<sha>/statuses?per_page=100" --jq '.[] | [.context, .state, .creator.login] | @tsv'
gh run view <run-id> -R $O --json event
gh pr view <n> -R $O --json mergeStateStatus
gh api $R/pulls/<n> --jq '[.head.sha, .mergeable, .merge_commit_sha] | @tsv'
gh api $R/commits/<merge-sha> --jq '[.parents[].sha]'
gh api graphql --paginate -f o=<owner> -f r=<repo> -F n=<n> -f query='query($o:String!,$r:String!,$n:Int!,$endCursor:String){repository(owner:$o,name:$r){pullRequest(number:$n){reviewThreads(first:100,after:$endCursor){pageInfo{hasNextPage endCursor} nodes{isResolved path comments(first:1){nodes{author{login}}}}}}}}' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved | not) | [.path, .comments.nodes[0].author.login] | @tsv'
gh api $R/commits/main --jq .sha
gh run view <run-id> -R $O --log | grep -m1 'HEAD is now at'
gh api -X PUT $R/pulls/<n>/update-branch  # changes the PR branch; only when authorized
```

## Sources

Checked 2026-10-16, "Troubleshooting required status checks" again on
2026-10-17, and conversation resolution and review threads on 2026-10-23:

- docs.github.com: "About protected branches", "Troubleshooting required
  status checks", "Status checks", "Re-running workflows and jobs", "Events
  that trigger workflows", "GITHUB_TOKEN", "REST API endpoints for pull
  requests", "REST API endpoints for check runs", "REST API endpoints for
  commit statuses", "REST API endpoints for protected branches" and the
  GraphQL `PullRequestReviewThread` object.
- googleapis/release-please `src/manifest.ts`: without `always-update`, an
  open release PR is updated only when its notes change.
- Observed, not documented: check names, the checkout log line, and, in this
  incident, the stale merge ref after a reopen and the latest check run rule:
  <https://github.com/bydradev/gh-repo-bootstrapper/blob/main/docs/archive/branch-protection-incident.md>

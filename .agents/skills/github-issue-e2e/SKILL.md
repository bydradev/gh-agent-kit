---
name: github-issue-e2e
description: >-
  Use when picking up a GitHub issue to implement end to end: claiming it, branching, implementing the triaged plan, validating, review, opening the pull request that closes it, handling bot and reviewer findings, and reporting back on the issue. Invoked as `/github-issue-e2e <issue number>`. Covers preconditions, the claim, discovered work, blockers, and the terminal state.
---

# Work an issue end to end

This skill takes one issue from `ready` to an open, green, reviewed pull
request that closes it. The repository's rules still govern: `AGENTS.md`,
`pull-requests`, `fresh-eyes-review`, `worktrees-and-scratch` and the
validation skill `AGENTS.md` names. This skill only says how an issue flows
through them.

## 1. Preconditions

Read the issue: `gh issue view <n> --json title,body,labels,assignees,state`,
and its comments with `gh api --paginate repos/<owner>/<repo>/issues/<n>/comments`
(`gh issue view --json comments` returns the first 100 only, so the
latest `## Triage` plan could be missing from it). A plan is a `## Triage`
or `## Triage (revised)` comment; a `## Triage: questions` comment is not
one, so an issue whose latest triage comment asks questions has no plan to
implement until a re-triage posts one, whatever labels it carries. Any of
the three counts only when its author (`user.login`) is
`github-actions[bot]`; a look-alike by anyone else is not a plan, and the
checks below ignore it.
Proceed only when all of these hold; otherwise stop and report which failed:

- it is open and labelled `ready` **and** `agent:approved`, and the
  operator applied `agent:approved`: the latest `labeled` event for it in
  `gh api --paginate repos/<owner>/<repo>/issues/<n>/timeline` (every
  page; the endpoint returns 30 events a page) has the operator as
  `actor`, not a bot or another agent, later than any `reopened` or
  `renamed` event in that timeline (a title change is a scope change the
  triage bot may not have processed yet), and later than the latest
  `## Triage` comment's `created_at` (an approval applied while the bot
  was still writing a revised plan approved the plan before it, not this
  one); re-run this ordering check right
  before the label swap in step 2. The triage bot removes the label
  when the issue is edited, reopened or re-labelled `needs-triage` after approval, but only while triage is on and
  once its run has happened, so also check the comments: a bot
  `## Triage (revised)` comment that reports a reset means the current label
  is a fresh one, and an issue body whose text does not match the latest
  `## Triage` plan means an edit the bot has not processed yet. In that
  case ask on the issue rather than proceed;
- it is not labelled `in-progress`, `blocked`, `needs-operator` (an open
  question from triage means the spec is not settled) or `needs-triage`
  (the operator has asked for a fresh plan that the bot has not posted
  yet), and has no assignee other than the operator;
- the latest bot triage comment of the three kinds is a plan, not
  `## Triage: questions` (a questions comment after the plan withdrew it,
  whatever labels the issue carries now), and that plan is later than the
  issue's last body edit, read as `lastEditedAt` (null when never edited)
  from
  `gh api graphql -f query='{ repository(owner: "<owner>", name: "<repo>") { issue(number: <n>) { lastEditedAt } } }'`
  (`updatedAt` is not it: labels and comments move that too), and later
  than the latest `renamed` and `reopened` events in the timeline (a plan
  older than either describes the earlier scope, even when the approval is
  newer). An approved issue with no plan, or a body edited, retitled or
  reopened after the plan or after the approval, has no settled scope to
  check an edit against: ask on the issue rather than proceed.

`agent:approved` is the operator's authorization for the scope the issue
describes. It authorizes nothing else: no merge, deployment, external
mutation, or change outside that scope.

## 2. Claim

- Look for earlier work first: a branch matching the convention,
  `git ls-remote --heads origin "*/<n>-*"`, or an open PR whose body closes
  exactly that number, in any form GitHub links (`#<n>`, `<owner>/<repo>#<n>`
  or the issue URL): `gh api --paginate
  "repos/<owner>/<repo>/pulls?state=open&per_page=100" --jq '.[] | select(.body
  // "" | test("\\b(close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved):?\\s+((<owner>/<repo>)?#|https://github\\.com/<owner>/<repo>/issues/)<n>\\b";
  "i")) | .number'`, with a dot in the owner or repository name written as
  `\\.`, reads every open PR, so no closing PR falls past a listing limit (a
  PR that merely mentions the number is not prior work). A branch whose pull
  request was merged or closed is finished work, not prior work: the
  repository squash-merges, so its commits are not on the default branch,
  and a new PR from it would carry the old patch again. Check with
  `gh pr list --head <branch> --state all --json number,state`; resume
  only a branch with no PR or an open one. For a finished branch (an
  issue reopened after its PR merged), start a fresh branch from the
  current default branch with a different slug. If unfinished work exists,
  continue on it
  and post a resume comment instead of a new claim; never start a second
  branch for the same unfinished attempt.
- Comment first: `Claimed by <tool> (<model>) on <date>; session <link if any>.`
  A resume comment is a claim too and follows the same rule. Note the URL
  `gh issue comment` prints, then re-read the comments. If another claim or
  resume comment was posted after the latest `labeled` event for `ready` in
  the issue timeline and before yours (compare comment URLs or IDs, not
  authors, since agents share the operator's credentials), back off: delete
  nothing, reply that you yield, and stop. The earlier claim owns the issue,
  unless it is abandoned: a claim or resume comment on an issue that is
  still `ready` ten minutes later was interrupted before its label swap, and
  a later agent may claim over it, saying so in its own claim comment.
- Swap `ready` for `in-progress`: `gh issue edit <n> --add-label in-progress --remove-label ready`,
  after re-fetching the issue and re-running step 1 in full on it: the
  current labels must still include `ready` and `agent:approved` and
  exclude the rejected ones (an approval withdrawn since your first read
  leaves the old `labeled` event in the timeline but not the label), and
  no `reopened` or `renamed` event may postdate the approval.
  If more than ten minutes passed between your claim comment and the swap,
  re-read the comments once more: a claim posted over yours in that window
  wins, and you yield as above. When you are resuming after an operator
  answer, read the answer before continuing.
- Otherwise branch from the repository's default branch, read with
  `gh repo view <owner>/<repo> --json defaultBranchRef -q .defaultBranchRef.name`
  (never assume `main`; the checks above mean the same branch), as
  `<type>/<n>-<short-slug>`, type from the issue's type label
  (`feature` → `feat`).

## 3. Implement

- Follow the latest bot-authored `## Triage` plan, phase by phase. The plan
  is input: where
  the code disagrees with it, follow the code and say so in the PR.
- Keep to the issue's scope. Work you discover becomes a new issue through
  the Task or Bug form, or `gh issue create --label needs-triage --title
  "..." --body-file <file>` with the form's headings, referenced from the
  PR. Do not do it, and do not
  keep it in memory or a markdown note.
- Stop and ask when the plan's *Risks and stop-and-ask items* or `AGENTS.md`
  say so. Ask on the issue: comment with the question and your
  recommendation, then release the claim so the answer can be picked up by
  any agent: push the branch as it stands (`AGENTS.md` allows the push) and
  name it in the comment, add `blocked`, swap `in-progress` back to
  `ready`, and end the session. (`needs-operator` is the triage bot's label
  and would block the resume.) The operator answers on the issue and
  removes `blocked`; the next run passes the preconditions again and finds
  your branch and comment.

## 4. Validate, review, open the PR

- Before the PR, re-fetch the issue and repeat step 1's freshness and
  authorization checks: the current body, `lastEditedAt`, the latest
  `## Triage` plan, and the ordering of approval against `reopened` and
  `renamed` events and the plan. The labels differ from step 1 by your
  own claim: expect `agent:approved` and `in-progress` present, `ready`
  absent, and no `blocked`, `needs-operator` or `needs-triage` (the last
  is the operator asking for a fresh plan: stop and release the claim as
  the bot's revised plan will say). The label alone is
  not enough: an edit after approval withdraws it only once the triage
  bot runs, so an issue whose body or plan no longer matches what you
  implemented is withdrawn even while `agent:approved` is still there. If
  the approval is gone or stale,
  the operator or the triage bot withdrew the approval (an edit after
  approval does that): push the branch, comment where you stopped and name
  the branch, remove `in-progress` and stop. Do not restore `ready` or add
  `blocked`: the issue is back at `triaged` with a revised plan, and the
  operator re-approves it from there.

- Run the validation the repository's validation skill names for the
  changed area, plus each phase's named check from the plan.
- Run `fresh-eyes-review` before the PR leaves draft; resolve blocking
  findings.
- Open the PR with the `pull-requests` skill. The body's *Why* section
  carries `Closes #<n>`. Mention any new issues you opened.

## 5. Handle review findings on the PR

Automated reviewers (the `pr-review` and `security-scan`
workflows, and any other review bot the repository configures) and people
comment on the PR. Every
finding is a claim handled under `fresh-eyes-review` *Handling findings*:
reproduce it, then fix with a commit or refute with evidence, replying on the
thread with the finding's ID. Consolidate duplicates across reviewers in one
reply that names each ID. Before pushing any fix, re-fetch the issue and
repeat the step 4 check (with its claimed-state labels): `agent:approved`
must still be present, no `reopened` or `renamed` event or body edit may
postdate it, and the latest `## Triage`
plan must be the one the PR implemented. An edit to the issue after the PR
opened withdraws the approval and revises the plan, and a fix pushed then
would implement superseded acceptance criteria: stop as step 4 says,
comment on the PR and the issue where you stopped, remove `in-progress`,
and leave the PR for the operator to re-approve. After fixes, the kit's code review re-runs on
push when `KIT_REVIEW_MODE` is `push`; in `open` mode request another
round with `gh workflow run pr-review.yml -f pr=<pr>`. The kit's
security scan re-scans only in `push` mode. Another review bot follows
its own settings and `AGENTS.md` says how to re-run it. Three rounds with a blocking finding still open means stop
and escalate on the issue, as `fresh-eyes-review` says.

## 6. Terminal state and report

Done means: the PR is open and not draft, its checks pass, and no blocking
finding is open. Merging is the operator's; never merge. Then comment on the
issue:

```markdown
## Ready for review
- PR: #<pr>
- Checks run: <list>; not run: <list and why>
- Deviations from the plan: <or none>
- Caveats for the operator: <or none>
- New issues: #<a>, #<b>
```

Leave `in-progress` on; the PR's `Closes #<n>` closes the issue on merge.
Review rounds that arrive on the open PR afterwards are worked from the PR
(step 5) with its approval re-check, not by re-running step 1 on the issue.
If you must stop before the terminal state, push the branch and say where
you stopped in a comment that names it, release the claim (remove
`in-progress`, restore `ready`, add `blocked` when an answer is needed) so
any agent can take it, and clean up
worktrees and scratch as `worktrees-and-scratch` says. Before the terminal
state, a claim never outlives its session.

# Labels and the issue lifecycle

The kit uses thirteen labels in three groups. `sync-labels.sh` creates them
with these names, colours and descriptions; the triage bot, which runs only
while `KIT_ISSUE_TRIAGE` is `on`, reads and sets them; the operator holds
`agent:approved`, which authorises work, and an agent records a request the
operator made directly with `requested`. Releases before this one also had
`ready`, `blocked` and `docs`; `sync-labels.sh --migrate` moves issues off
them and deletes them ([Create the
labels](setup.md#2-create-the-labels)).

## Types (one per triaged issue)

| Label | Meaning |
| --- | --- |
| `bug` | Something is wrong |
| `feature` | New behaviour or capability |
| `chore` | Maintenance, tooling, dependencies, documentation |

## Priorities (one per triaged issue)

| Label | Meaning |
| --- | --- |
| `P0` | Critical: data loss, security, broken main or release path |
| `P1` | High: wrong behaviour on a realistic path or an unmet requirement |
| `P2` | Medium: limited impact; fix or give a reason |
| `P3` | Low: optional improvement |

## State

`needs-triage` and `needs-operator` mean the bot or the operator owes the
issue something. `triaged` is sticky: it records that the bot has assessed
the issue and stays until the issue closes or is sent back to the bot.
`in-progress` layers on top of it while an agent holds the issue.

| Label | Meaning | Set by | Removed by |
| --- | --- | --- | --- |
| `needs-triage` | Waiting for the triage bot | The issue forms; the operator, to ask for a fresh plan or to vouch for an issue `github-actions[bot]` opened | The bot, when it has posted its triage |
| `triaged` | Assessed and planned by the bot; stays while `in-progress` is added | The bot | The bot, when it swaps it for `needs-operator` or re-triages; nobody else needs to |
| `needs-operator` | A question or decision only the operator can answer | The bot, instead of `triaged`; an agent that hands an issue back with a question (its comment asks it); `kit-update-check`, on its update notice; the reviewer's `file_issue`, on each issue it files | The operator, by answering and re-applying `needs-triage` (or, after an agent's question, by answering and removing it); the bot, when a re-triage plans the issue; `kit-update-check` closes its notice once the copy is current. On an issue `file_issue` filed (author `github-actions[bot]`), the operator adds `needs-triage` to vouch for its text and have it planned, or closes it |
| `in-progress` | An agent has claimed the issue; the claim comment names it | The agent | The agent (on handing back), the bot (on a reopen) or the close |
| `agent:approved` | Operator authority to implement the plan as written | The operator only | The bot on a re-triage; the operator |
| `requested` | The operator asked an agent for this work directly; the issue's `### Operator request` section quotes the request, which stands in for `agent:approved` | The agent that filed the issue, never the bot | Nobody, except the filing agent, which removes and re-adds it to record the operator's answer to triage's questions (`github-issue-file` step 7): it records where the work came from |

## The lifecycle

```text
  issue opened (form adds needs-triage)
        │
        ▼
  ┌─ triage bot ─────────────────────────────────────────────┐
  │ reads the issue, checks the repository, posts "## Triage" │
  └───────────────┬───────────────────────────┬──────────────┘
                  │ plan is clear             │ a decision is missing
                  ▼                           ▼
             triaged + type + P?        needs-operator + type + P?
                  │                           │ operator answers,
                  │                           │ re-applies needs-triage
                  │                           └──────────► (back to the bot)
                  │ operator reads the plan
                  ▼
            agent:approved              ← set by the operator, by hand
                  │
                  ▼ an agent runs github-issue-e2e
             in-progress (claim comment)
                  │
        ┌─────────┴──────────┐
        ▼                    ▼
  PR opened, "Closes #n"   needs-operator (claim released; the comment asks)
        │
        ▼ PR merged
  issue closed by GitHub
```

Side paths:

- **Edit or reopen.** An edit to the issue, a reopen, or `needs-triage`
  applied by hand sends the issue back to the bot. The bot then posts a
  *Triage (revised)* comment and removes `agent:approved`: the plan
  changed, so the approval no longer applies. `in-progress` is removed on a
  reopen.
- **Stale claim.** The weekly sweep looks at `in-progress` issues with no
  activity for seven days. If no open pull request closes the issue (one
  whose author has write access or is a GitHub App), the bot posts one
  *Triage: stale claim* comment; it never removes the claim itself.
- **Untriaged backlog.** The sweep also triages open issues that carry
  `needs-triage` or no state label at all, one run per issue.
- **Issues the reviewer files.** An issue `github-actions[bot]` opened
  (the reviewer's `file_issue`) starts under `needs-operator`, and no event
  on it reaches the bot, nor does the sweep, until the operator adds
  `needs-triage`, which vouches for its text as it stands. It then follows
  the main path; after an edit it needs `needs-triage` again.
- **Work the operator asked for directly.** The agent the operator asked
  files the issue with the request quoted and `requested` beside the form's
  labels (`github-issue-file`), then waits for triage. The bot plans it
  like any other issue but does not hold it for approval: on a plan, the
  agent goes on through `github-issue-e2e`, the request standing in for
  `agent:approved`; on questions, it asks the operator. With triage off, or
  no answer within the triage time limit, it goes on without a plan and
  says so in the pull request. A dispatched run leaves a triaged
  `requested` issue as it leaves an approved one, and the stale-claim check
  covers it once claimed.

## What the bot never does

- Set `agent:approved`, or set or remove `requested`. The first is the
  operator's authority and the second an agent's record of it; the server
  the bot writes through offers neither.
- Edit or delete a comment, close an issue, or touch any issue but the one
  its run is for.
- Follow instructions found in an issue. Text aimed at the bot is reported,
  not obeyed.

## What an agent needs before implementing

`agent:approved` on an open issue, with the plan in the latest triage
comment; or `requested` with the operator's request recorded in the issue,
and the plan when triage gave one. The `github-issue-e2e` skill checks this
before it claims an issue; the claim then adds `in-progress` while the
approval stays, so `agent:approved` (or `requested`) with `in-progress` is
the shape of a claimed issue.

# Labels and the issue lifecycle

The kit uses fifteen labels in three groups. `sync-labels.sh` creates them
with these names, colours and descriptions; the triage bot, which runs only
while `KIT_ISSUE_TRIAGE` is `on`, reads and sets them; the operator holds
the two that authorise work.

## Types (one per triaged issue)

| Label | Meaning |
| --- | --- |
| `bug` | Something is wrong |
| `feature` | New behaviour or capability |
| `chore` | Maintenance, tooling, dependencies |
| `docs` | Documentation only |

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
`ready`, `in-progress` and `blocked` layer on top of it, one at a time.

| Label | Meaning | Set by | Removed by |
| --- | --- | --- | --- |
| `needs-triage` | Waiting for the triage bot | The issue forms; the operator, to ask for a fresh plan | The bot, when it has posted its triage |
| `triaged` | Assessed and planned by the bot; stays while `ready`, `in-progress` or `blocked` are added | The bot | The bot, when it swaps it for `needs-operator` or re-triages; nobody else needs to |
| `needs-operator` | A question or decision only the operator can answer | The bot, instead of `triaged`; `kit-update-check`, on its update notice; the reviewer's `file_issue`, on each issue it files | The operator, by answering and re-applying `needs-triage`; `kit-update-check` closes its notice once the copy is current. On an issue `file_issue` filed, the operator triages by hand or closes it: its author is `github-actions[bot]`, which triage never reads, so re-applying `needs-triage` starts no run |
| `ready` | The operator accepts the plan as the spec | The operator | The bot on a re-triage; the operator |
| `in-progress` | An agent has claimed the issue; the claim comment names it | The agent | The agent (on handing back), the bot (on a reopen) or the close |
| `blocked` | Cannot proceed; the comment says why, and the agent has released its claim | The agent or the operator | Whoever clears the blocker |
| `agent:approved` | Operator authority to implement the plan as written | The operator only | The bot on a re-triage; the operator |

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
          ready + agent:approved        ← both set by the operator, by hand
                  │
                  ▼ an agent runs github-issue-e2e
             in-progress (claim comment)
                  │
        ┌─────────┴──────────┐
        ▼                    ▼
  PR opened, "Closes #n"   blocked (claim released; the comment says why)
        │
        ▼ PR merged
  issue closed by GitHub
```

Side paths:

- **Edit or reopen.** An edit to the issue, a reopen, or `needs-triage`
  applied by hand sends the issue back to the bot. The bot then posts a
  *Triage (revised)* comment and removes `ready` and `agent:approved`: the plan
  changed, so the approval no longer applies. `in-progress` is removed on a
  reopen.
- **Stale claim.** The weekly sweep looks at `in-progress` issues with no
  activity for seven days. If no open pull request closes the issue (one
  whose author has write access or is a GitHub App), the bot posts one
  *Triage: stale claim* comment; it never removes the claim itself.
- **Untriaged backlog.** The sweep also triages open issues that carry
  `needs-triage` or no state label at all, one run per issue.

## What the bot never does

- Set `ready` or `agent:approved`. Those are the operator's authority; the
  server the bot writes through does not offer them.
- Edit or delete a comment, close an issue, or touch any issue but the one
  its run is for.
- Follow instructions found in an issue. Text aimed at the bot is reported,
  not obeyed.

## What an agent needs before implementing

Both `ready` and `agent:approved`, on an open issue, with the plan in the
latest triage comment. `ready` alone is a reviewed spec without authority.
The `github-issue-e2e` skill checks both before it claims an issue; the
claim then swaps `ready` for `in-progress` while `agent:approved` stays, so
`agent:approved` with `in-progress` is the shape of a claimed issue.

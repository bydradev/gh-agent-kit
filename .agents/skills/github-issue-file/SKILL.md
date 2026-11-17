---
name: github-issue-file
description: >-
  Use when filing a GitHub issue as an agent: work found while doing something else, or any other issue the repository's rules ask for. Covers keeping security problems out of public issues, searching for a duplicate first, choosing the issue form (the kit's Task or Bug, or the repository's own), writing the form's headings in the body, adding the form's labels, creating the issue, and what to do after.
---

# File an issue

`AGENTS.md` (its *Work tracking* section) says when to file an issue; this
skill says how. An issue filed from the command line or the API skips the
repository's issue forms: nothing adds the form's labels or headings, and
the triage bot then plans from a body that lacks the fields it reads. So
write what the form would have written. The repository's rules on issue
text still apply, a public repository's rules on public content included.

## 1. Keep security problems out of issues

A vulnerability, an exposed secret or anything else an attacker could use
never goes in an issue, a comment or a pull request: they are public on a
public repository and visible to every collaborator on a private one. Stop
and tell the operator what you found, in your session only, and point them
to the repository's private vulnerability reporting (its security policy,
under the **Security** tab). Do not file the report yourself unless the
operator asks you to.

## 2. Search for a duplicate first

Search the repository's issues, open and closed, with the words the title
would use:

```sh
gh api -X GET search/issues -f q='repo:<owner>/<repo> is:issue <terms>' \
  --jq '.items[] | "#\(.number) \(.state) \(.title)"'
```

Read any match that could be the same work. An open one that already covers
it gets no new issue: reference it instead, and comment on it only to add
what it lacks (a new reproduction, another affected file). A closed one that
the work shows was not fixed is referenced from the new issue. A related
but different issue is named under *References*.

## 3. Choose the form

Read `.github/gh-agent-kit.lock`. When its `issue_forms` is `kit` (or the
lock has no such field), the repository uses the kit's forms:

| Form | For | Headings, in order | Labels |
| --- | --- | --- | --- |
| Bug | something behaves wrongly | What happens, What should happen, Steps to reproduce, References, Severity you expect | `needs-triage`, `bug` |
| Task | a feature, chore or docs change | Outcome, Acceptance criteria, References, Out of scope, Size | `needs-triage` |

When it is `own`, or there is no lock (the kit's own repository, say), use
the repository's forms in `.github/ISSUE_TEMPLATE/` (every `.yml` there but
`config.yml`). Pick the form that fits from its `name` and `description`;
its headings are the `attributes.label` of each field that is not
`type: markdown`, in the form's order, and its labels are its `labels`
list. Add `needs-triage` when
the form does not. `AGENTS.md` may say which of the form's fields stands in
for the kit's *Acceptance criteria* or *What should happen*; fill that one
as this skill says for those.

## 4. Write the body

One `### <heading>` per field, in the form's order, each followed by a
blank line and its text, as GitHub writes a submitted form. Fill every
required field; write `_No response_` under an optional one you leave
empty, as GitHub does. A dropdown takes one of its options, copied exactly.

Write it so that triage can plan without asking:

- *Outcome* or *What happens*: one or two sentences, with the exact input,
  command, file or page.
- *Acceptance criteria*: checkable statements, one per `- [ ]` line, each
  something a reviewer can verify. For a bug, *What should happen* is the
  criterion: make it as checkable.
- *References*: the files (with line numbers where they help), runs, pull
  requests and issues the work starts from, including the pull request or
  issue you were working on when you found it.
- *Out of scope*: what a reader might assume is included and is not.
- *Size* and *Severity you expect*: your estimate, which triage may change.

Title it with what is wrong or what will be true, in the words the
repository's existing issues use.

## 5. Create it

```sh
gh issue create --repo <owner>/<repo> --title "<title>" --body-file <file> \
  --label needs-triage [--label <each other form label>]
```

Where `gh issue create` fails on an API error (some tokens and proxies
allow GitHub's REST API only), the REST API does the same:

```sh
gh api repos/<owner>/<repo>/issues -f title="<title>" -F body=@<file> \
  -f 'labels[]=needs-triage' [-f 'labels[]=<each other form label>']
```

Write the body to a scratch file as `worktrees-and-scratch` says, and
remove it once the issue exists.

## 6. After filing

- Note the issue's number and link. Name it in the pull request you are
  working on (as a new issue, not one the pull request closes) or in your
  report to the operator.
- Do not start on it. Filing is not approval: the issue is worked only
  once `AGENTS.md`'s conditions for taking up an issue hold, through
  `github-issue-e2e`.
- Do not add `agent:approved` or any label but the form's: triage sets the
  rest, and approval is the operator's.

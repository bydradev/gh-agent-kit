# Rule inventory (2026-11-26)

Does every rule in the kit's workflows, MCP server and installer have a
test that fails when that rule alone is switched off? Issue #83 answered
that for guard lines: each `exit 1`, `return fail(`, `throw` and installer
`exit` or `die`. Issue #94 asks it rule by rule, so a condition that shares
a guard line with others, a skip, a route and an output each count on their
own. This page lists every rule found, how it was switched off, and the test
that catches it, or why none does.

The work comes in phases, one pull request each, the security-critical
files first:

| Phase | Files | Pinned `main` commit |
| --- | --- | --- |
| 1 | `.github/scripts/mcp-server.mjs`, `.github/workflows/pr-review.yml` | `1ddf71c` |
| 2 | `.github/workflows/security-scan.yml` | `05436e8` |
| 3 | `.github/workflows/issue-triage.yml`, `.github/workflows/pr-issue-link.yml`, `.github/workflows/kit-update-check.yml` | `7bb6abf` |

Phase 1's files are the same at both commits. Phase 1's sections stand as
they merged. Phase 2's review found kinds of line the script had skipped (a
command starting with `find`, a restore by `git checkout`, a skip that ends
a command list), which add five rows to `pr-review.yml`; they are listed in
a section of their own after phase 2's.

The files of phases 1 and 2 are the same at phase 3's commit, so their
sections stand as they merged too. Phase 3's review found four kinds of
rule the script had skipped (an `awk` program's conditions and
statements, each command of a `{ }` group written to a file, a job's
`outputs:`, and each failure statement), which add rows to `pr-review.yml` and `security-scan.yml`;
they are listed in sections of their own after phase 3's.

After phase 3's commit, #108 changed the settings read step of all five
workflows and added rules to `pr-review.yml`. Those rules are not in the
sections below; phase 4 counts them, against the later commit it pins.

**In short (phase 1):** of 1,209 rules, 1,149 are caught by a test, 11
of them by a time limit (the test never ends: an endless loop, or a
reply it waits for never comes). The 60 left are listed
with the reason:

| Reason | `pr-review.yml` | `mcp-server.mjs` |
| --- | --- | --- |
| Equivalent: switching it off changes nothing the code can do | 8 | 17 |
| Unreachable: no input reaches the other branch | 1 | 5 |
| Not a rule: a message's wording, a count only the log shows, a cache, or removing a scratch file | 16 | 4 |
| Left untested: runner provisioning only a GitHub runner can run | 9 | 0 |

The tests this phase added cover, among others: which events and states run each
pr-review job and step, as GitHub evaluates each `if:`; the report check's
fallback for a base server older than the run marker; the verdict's choice
of report; the open-mode push skip's filters; the server's start-up checks;
the git tools' argument checks; paging and body cuts; the vouch for a
`github-actions[bot]` issue (#100); file_issue's earlier-issue lookup; the
sweep's eligibility; and the JSON-RPC loop's replies.

**In short (phase 2):** of 917 rules in `security-scan.yml`, 856 are
caught by a test, 11 of them by a time limit and 105 through a copy of
their step (see *How it was checked*). The 61 left are listed with the
reason:

| Reason | `security-scan.yml` |
| --- | --- |
| Equivalent: switching it off changes nothing the code can do | 19 |
| Unreachable: no input reaches the other branch | 14 |
| Not a rule: a log line, a field or count only the log shows, or removing a scratch file | 18 |
| Left untested: runner provisioning only a GitHub runner can run | 10 |

Of the five rows phase 2 added to `pr-review.yml`, four are caught; the
fifth is equivalent.

The tests this phase added cover, among others: which events and states
run each scan job and step, as GitHub evaluates each `if:`; the skip's
clean-up of a re-run's notice and the comments it reads; the base rules
and public-content check the scan takes from the base; the limits; the
OpenCode checkout steps; a stream's last result; the hold's marker and
its fallback to the candidates; the summary's lines and limits; the
inline comments' filters; both records' outcomes and modes; and the
OpenCode scan's answer, export, retry and wait rules. One older test
passed without running its step (a re-run with no results file) and now
runs it.

**In short (phase 3):** of 971 rules in the three workflows, 919 are
caught by a test, 7 of them by a time limit and 156 through a copy of
their step. The 52 left are listed with the reason:

| Reason | `issue-triage.yml` | `pr-issue-link.yml` | `kit-update-check.yml` |
| --- | --- | --- | --- |
| Equivalent: switching it off changes nothing the code can do | 12 | 1 | 5 |
| Unreachable: no input reaches the other branch | 5 | 0 | 0 |
| Not a rule: a field or count only the log shows, or removing a downloaded file | 20 | 0 | 0 |
| Left untested: runner provisioning only a GitHub runner can run | 9 | 0 | 0 |

Of the rows phase 3 added to the earlier phases' files, all 72 in
`pr-review.yml` are caught, and 95 of 98 in `security-scan.yml`; the
other three are not rules (the commas between the file names a message
lists).

The tests this phase added cover, among others: which events and states
run each triage, link and update-check job and step, as GitHub evaluates
each `if:`; a labeled event's own label among the issue's labels; the
triage run's turn and time limits; the OpenCode run's variants, its
events file, the step that ends it and a refusal read from its last
error; the gate's reading of who removed or added a label, and of an
issue renamed after it was labelled; the sweep's list of issues and the
records it truncates; the run's start record; the MCP configuration's
vouched hash and the token file's mode; `.git` put back after OpenCode;
the state check for a closed or claimed issue; the stale-claim backstop's
look-alike comments; a stopped sweep that passes nothing on; each job
output, as GitHub evaluates it, against what its step wrote; the update
check's fences and markers in `AGENTS.md`, a lock or an `AGENTS.md`
that is a symlink, and the notice's choice of issue; the issue-link
check's fences; the scan's line count over renamed paths; that each
guard stops its step, printing its own error alone; and that the review's
skip steps fail when a lookup fails. The
pass-on step's test now runs it in every workflow that has it.

## What counts as a rule

A rule is each operand of a condition that decides a failure, a skip, a
route or a written output (a label, verdict, comment, output, environment
variable or file). The wording of a log line or message is not one. In
practice, each of these is switched off on its own:

- **JavaScript** (the server): every `if`, `while`, `for` and `?:` test,
  forced to `true` and to `false`; every operand of an `&&` or `||` chain in
  such a test, or in an expression of comparisons and predicates, set to
  the value that makes it decide nothing (`true` under `&&`, `false` under
  `||`), and the same for each operand of such an expression kept in a
  variable; the predicate passed to `filter`, `find`, `findIndex`, `some` or
  `every`, set the same ways; every `continue` or `break`; and every
  statement that writes a file, the run's state or a reply
  (`fs.appendFileSync`, `fs.writeFileSync`, `fs.rmSync`, `record(...)`,
  `process.stdout.write`) or writes to GitHub, removed.
- **Workflows**: every job and step `if:`, forced to `true` and to `false`,
  and each operand of its `&&` and `||` chains, set as above; from phase 3,
  each entry of a job's `outputs:`, emptied.
- **Shell** (each step's `run:`, a one-line `run:` included, a command
  continued with `\` read as one line): every `if`, `elif` and `while` condition, forced to `true`
  and to `false`, and each operand of its `&&`, `||` and `[[ ]]` chains, and of a
  `{ }` group's or a subshell's list within them;
  the condition of a command list such as `[ -z "$x" ] && exit 1`; every
  `case` arm, `*)` included, given a pattern nothing matches; each jq `select()`
  predicate and each of its `and` and `or` operands, and each jq `if` and
  `elif` condition (one over several lines too) and each of its `and` and
  `or` operands, forced to `true` and to `false`;
  every `continue`, `break`, `exit 0` and `return 0`; every command that
  writes `GITHUB_OUTPUT` or `GITHUB_ENV`, creates (`touch`), removes
  (`rm`, through `xargs` too), moves, copies, installs or restores
  (`git checkout <ref> -- <path>`) a file, or writes to GitHub (`gh issue`, `gh pr`, `gh label`, or
  a POST, PATCH, PUT or DELETE, inside a `$( )` too), made a no-op; and
  every redirect of a command's output to a file, pointed at `/dev/null`,
  so the command still runs and keeps its exit status. From phase 3, also
  each `exit 1`, `return 1` and `return 2` (the guard lines #83 counted
  once, and those added since), made a no-op; each command of a `{ }`
  group whose output goes to a file, made a no-op on its own; and in an `awk` program, each pattern and each `if` and
  `while` condition, forced to true (`1`) and to false (`0`), each operand
  of its `&&` and `||` chains, set as above, and each `next`, `exit`,
  `print` and `printf`, made a no-op, as is the print of a pattern with
  no action (given an empty one) and `awk 1` (made `awk 0`).

## How it was checked

A script, kept out of the repository, read each file and wrote one mutant
per rule above. Each mutant was applied alone to a worktree at the pinned
commit holding this phase's tests, and the test files that exercise the
file ran one at a time, in a Linux container (Node 24, bash 5, git 2.47,
jq) so the tests that need bash 4 ran too. The files that name the
mutant's workflow step ran first (a step's tests read it by name), then
the rest, with this phase's new test files ahead of the older ones. The
first file with a failing assertion caught the mutant, and the row names
that test; an older test may catch the same rule.

An assertion that only reads source text does not count: one in a test
that reads the workflow or the server without running anything (such as
"the five workflows run the same read step"), or one that compares a step
with its copy in another workflow. A file whose only failures were such
assertions was passed over. A mutant that only they caught is listed with
the rules left. A mutant whose file did not end within 180 seconds counts
as caught by a time limit, apart from the others.

Each kill was then checked again: the mutant applied once more and only
the file that caught it run again. A kill counts when the same test fails
again (its line may have moved, since tests were added after the sweep).
A kill that did not reproduce was swept again from the start. A mutant that no file caught is listed with its reason.

In phase 3 the container at first held only the worktree, not the
repository's git directory, so the two tests that run git (one installs
the kit with `install.sh`) failed whatever the mutant, and most of
`kit-update-check.yml`'s rows named one of them. The container now holds
the git directory too, every test passes in it before any mutant is
applied, and `kit-update-check.yml` was swept again. No row of phases 1
and 2 names either test.

Some steps are copies that a test holds byte for byte to another step:
the settings read step of every workflow, held to `pr-review.yml`'s; the
OpenCode verification, held to the OpenCode scan below its prompt line;
and the scan settings job's early skip, held to the scan job's skip. A
rule in such a step that no test catches counts as caught when the same
rule in its twin is, and its row names the twin. The comparison itself
still counts for neither.


The `if:` tests use an evaluator in `tests/helpers/expression.mjs` that
follows the expressions reference for the forms `pr-review.yml` and
`security-scan.yml` use
(literals, comparisons, `!`, `&&`, `||`, property access, `contains`,
`startsWith`, `endsWith`, `fromJSON` and the status functions), not every
form GitHub accepts. Phase 3 added the object filter (`labels.*.name`)
that `issue-triage.yml` uses, from the same reference (read 2026-11-28),
applied to each item as the runner applies it (`actions/runner`,
`Operators/Index.cs`, read 2026-11-28): an item's property is kept, a
present `null` included, and an item without it is left out. The same
evaluator gives a job output's value, which the job-output tests compare
with what the step wrote.

In phase 3 the copy rule covers the settings read step of all five
workflows that have one, held to `pr-review.yml`'s. A `{ }` group whose
output goes to a file is switched off twice over: the whole group made a
no-op, as the group's write, and each command in it made a no-op on its
own, as the rule list above says.

## What this does not cover

- The content of a pattern (a regular expression, a glob, a jq path) or
  of a string; only the conditions around them.
- A value an expression computes outside a condition: a `${{ }}` default,
  a `??` fallback, a value chosen with `&&` and `||` that is not a
  condition.
- A rule in a script a step writes with a here-document.
- Whether a mutant is equivalent is a judgement, given with its reason.

## Rules by file

| File | Rules | Caught | Left, with the reason |
| --- | --- | --- | --- |
| `.github/workflows/pr-review.yml` | 603 | 569 | 34 |
| `.github/scripts/mcp-server.mjs` | 606 | 580 | 26 |
| `.github/workflows/security-scan.yml` | 917 | 856 | 61 |
| `.github/workflows/pr-review.yml`, rows found in phase 2 | 5 | 4 | 1 |
| `.github/workflows/issue-triage.yml` | 678 | 632 | 46 |
| `.github/workflows/pr-issue-link.yml` | 97 | 96 | 1 |
| `.github/workflows/kit-update-check.yml` | 196 | 191 | 5 |
| `.github/workflows/pr-review.yml`, rows found in phase 3 | 72 | 72 | 0 |
| `.github/workflows/security-scan.yml`, rows found in phase 3 | 98 | 95 | 3 |

### `.github/workflows/pr-review.yml`

603 rules: 569 caught (4 of them by a time limit), 34 left with the reason given.

<details><summary>Every rule of <code>.github/workflows/pr-review.yml</code></summary>

| Line | Kind | Rule | Switched off as | Caught by, or why not |
| --- | --- | --- | --- | --- |
| 66 | if: \|\| operand | `github.event_name == 'workflow_dispatch'` | `false` | `pr-review-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people, and for a dispatch" |
| 66 | if: whole | `github.event_name == 'workflow_dispatch' \|\| (github.event.pull_request.draft == …` | `true` | `pr-review-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people, and for a dispatch" |
| 66 | if: whole | `github.event_name == 'workflow_dispatch' \|\| (github.event.pull_request.draft == …` | `false` | `pr-review-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people, and for a dispatch" |
| 67 | if: \|\| operand | `(github.event.pull_request.draft == false && github.event.pull_request.head.repo…` | `false` | `pr-review-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people, and for a dispatch" |
| 67 | if: && operand | `github.event.pull_request.draft == false` | `true` | `pr-review-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people, and for a dispatch" |
| 68 | if: && operand | `github.event.pull_request.head.repo.full_name == github.repository` | `true` | `pr-review-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people, and for a dispatch" |
| 69 | if: && operand | `github.event.pull_request.user.login != 'dependabot[bot]'` | `true` | `pr-review-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people, and for a dispatch" |
| 70 | if: && operand | `!(startsWith(github.head_ref, 'release-please--') && github.event.pull_request.u…` | `true` | `pr-review-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people, and for a dispatch" |
| 70 | if: && operand | `startsWith(github.head_ref, 'release-please--')` | `true` | `pr-review-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people, and for a dispatch" |
| 71 | if: && operand | `github.event.pull_request.user.type == 'Bot'` | `true` | `pr-review-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people, and for a dispatch" |
| 72 | if: && operand | `(github.event.action != 'edited' \|\| github.event.changes.body != null \|\| github.…` | `true` | `pr-review-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people, and for a dispatch" |
| 72 | if: \|\| operand | `github.event.action != 'edited'` | `false` | `pr-review-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people, and for a dispatch" |
| 72 | if: \|\| operand | `github.event.changes.body != null` | `false` | `pr-review-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people, and for a dispatch" |
| 72 | if: \|\| operand | `github.event.changes.base != null` | `false` | `pr-review-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people, and for a dispatch" |
| 72 | if: \|\| operand | `github.event.changes.title != null` | `false` | `pr-review-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people, and for a dispatch" |
| 142 | sh if whole | `content=$(gh api "repos/$REPO/contents/$file" \ --jq 'if .type != "file" then er…` | `true` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 142 | sh if whole | `content=$(gh api "repos/$REPO/contents/$file" \ --jq 'if .type != "file" then er…` | `false` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 143 | jq if whole | `.type != "file"` | `true` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 143 | jq if whole | `.type != "file"` | `false` | `kit-settings.test.mjs`: "the read step refuses a path that is not a file, and reads a last line with no newline" |
| 143 | jq elif whole | `.size > 16384` | `true` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 143 | jq elif whole | `.size > 16384` | `false` | `kit-settings.test.mjs`: "a file that cannot be read fails the run instead of using the defaults" |
| 146 | sh elif whole | `grep -q 'HTTP 404' "$err"` | `true` | `kit-settings.test.mjs`: "a file that cannot be read fails the run instead of using the defaults" |
| 146 | sh elif whole | `grep -q 'HTTP 404' "$err"` | `false` | `kit-settings.test.mjs`: "no file leaves the variables and the defaults" |
| 161 | sh while \|\| operand | `IFS= read -r l` | `false` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 161 | sh while whole | `IFS= read -r l \|\| [ -n "$l" ]` | `true` | `kit-settings.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 161 | sh while whole | `IFS= read -r l \|\| [ -n "$l" ]` | `false` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 161 | sh while \|\| operand | `[ -n "$l" ]` | `false` | Not caught, equivalent: the lines come from a here-string, which always ends its last line with a newline (bash 5.2, checked 2026-11-27), so `read` never ends on an unterminated line here |
| 164 | sh if \|\| operand | `[[ "$l" =~ ^[[:space:]]*(#.*)?$ ]]` | `false` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 164 | sh if whole | `[[ "$l" =~ ^[[:space:]]*(#.*)?$ ]] \|\| { [ "$l" = "---" ] && [ "${#at[@]}" -eq 0 …` | `true` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 164 | sh if whole | `[[ "$l" =~ ^[[:space:]]*(#.*)?$ ]] \|\| { [ "$l" = "---" ] && [ "${#at[@]}" -eq 0 …` | `false` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 164 | sh if \|\| operand | `{ [ "$l" = "---" ] && [ "${#at[@]}" -eq 0 ]; }` | `false` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 164 | sh if && operand | `[ "$l" = "---" ]` | `true` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 164 | sh if && operand | `[ "${#at[@]}" -eq 0 ]` | `true` | `kit-settings.test.mjs`: "a --- is skipped only before the first setting" |
| 165 | sh skip statement | `continue` | `:` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 167 | sh if whole | `! [[ "$l" =~ ^([A-Z][A-Z0-9_]*):(.*)$ ]]` | `true` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 167 | sh if whole | `! [[ "$l" =~ ^([A-Z][A-Z0-9_]*):(.*)$ ]]` | `false` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 172 | sh if whole | `[[ " ${known[*]} " != *" $name "* ]]` | `true` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 172 | sh if whole | `[[ " ${known[*]} " != *" $name "* ]]` | `false` | `kit-settings.test.mjs`: "a line the kit does not read fails the run, naming the line but never printing it" |
| 174 | sh case arm | `*KEY* \| *TOKEN* \| *SECRET* \| *PASSWORD*` | `__mutant_never__` | `kit-settings.test.mjs`: "a line the kit does not read fails the run, naming the line but never printing it" |
| 176 | sh case arm | `KIT_*` | `__mutant_never__` | `kit-settings.test.mjs`: "a line the kit does not read fails the run, naming the line but never printing it" |
| 178 | sh case arm | `*` | `__mutant_never__` | `kit-settings.test.mjs`: "a line the kit does not read fails the run, naming the line but never printing it" |
| 183 | sh if whole | `[ -n "${at[$name]:-}" ]` | `true` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 183 | sh if whole | `[ -n "${at[$name]:-}" ]` | `false` | `kit-settings.test.mjs`: "a line the kit does not read fails the run, naming the line but never printing it" |
| 187 | sh if whole | `! [[ "$rest" =~ $pair ]]` | `true` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 187 | sh if whole | `! [[ "$rest" =~ $pair ]]` | `false` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 201 | sh if whole | `[ -n "$v" ]` | `true` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 201 | sh if whole | `[ -n "$v" ]` | `false` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 203 | sh elif whole | `[ -n "${value[$name]:-}" ]` | `true` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 203 | sh elif whole | `[ -n "${value[$name]:-}" ]` | `false` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 209 | sh if whole | `! [[ "$v" =~ ^$word*$ ]]` | `true` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 209 | sh if whole | `! [[ "$v" =~ ^$word*$ ]]` | `false` | `kit-settings.test.mjs`: "a variable that is not one word fails before it reaches GITHUB_ENV" |
| 216 | sh case arm | `KIT_REVIEW_MODE \| KIT_SECURITY_SCAN` | `__mutant_never__` | `kit-settings.test.mjs`: "a switch takes only its states, so a typo fails instead of turning a workflow off" |
| 217 | sh case arm | `KIT_ISSUE_TRIAGE \| KIT_UPDATE_CHECK \| KIT_ISSUE_LINK_CHECK` | `__mutant_never__` | `kit-settings.test.mjs`: "a switch takes only its states, so a typo fails instead of turning a workflow off" |
| 218 | sh case arm | `*` | `__mutant_never__` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 220 | sh if && operand | `[ -n "$states" ]` | `true` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 220 | sh if whole | `[ -n "$states" ] && [ -n "$v" ] && [[ " $states " != *" $v "* ]]` | `true` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 220 | sh if whole | `[ -n "$states" ] && [ -n "$v" ] && [[ " $states " != *" $v "* ]]` | `false` | `kit-settings.test.mjs`: "a switch takes only its states, so a typo fails instead of turning a workflow off" |
| 220 | sh if && operand | `[ -n "$v" ]` | `true` | `kit-settings.test.mjs`: "a switch takes only its states, so a typo fails instead of turning a workflow off" |
| 220 | sh if && operand | `[[ " $states " != *" $v "* ]]` | `true` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 224 | sh output statement | (before `echo "$name=$v" >> "$GITHUB_ENV"`) | `: ` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 225 | sh output statement | (before `echo "FROM_$name=$from" >> "$GITHUB_ENV"`) | `: ` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 234 | if: \|\| operand | `env.KIT_REVIEW_MODE == 'push'` | `false` | `pr-review-conditions.test.mjs`: "the settings job reads the review settings only in a mode that reviews" |
| 234 | if: whole | `env.KIT_REVIEW_MODE == 'push' \|\| env.KIT_REVIEW_MODE == 'open'` | `true` | `pr-review-conditions.test.mjs`: "the settings job reads the review settings only in a mode that reviews" |
| 234 | if: whole | `env.KIT_REVIEW_MODE == 'push' \|\| env.KIT_REVIEW_MODE == 'open'` | `false` | `pr-review-conditions.test.mjs`: "the settings job reads the review settings only in a mode that reviews" |
| 234 | if: \|\| operand | `env.KIT_REVIEW_MODE == 'open'` | `false` | `pr-review-conditions.test.mjs`: "the settings job reads the review settings only in a mode that reviews" |
| 250 | sh list condition | `[ -n "$value" ]` | `true` | `pr-review-step-rules.test.mjs`: "a number setting must be digits, at most six of them, and is written to GITHUB_ENV" |
| 250 | sh list condition | `[ -n "$value" ]` | `false` | `pr-review-step-rules.test.mjs`: "a number setting must be digits, at most six of them, and is written to GITHUB_ENV" |
| 251 | sh if \|\| operand | `! [[ "$value" =~ ^[1-9][0-9]*$ ]]` | `false` | `pr-review-step-rules.test.mjs`: "a number setting must be digits, at most six of them, and is written to GITHUB_ENV" |
| 251 | sh if whole | `! [[ "$value" =~ ^[1-9][0-9]*$ ]] \|\| [ "${#value}" -gt 6 ] \|\| [ "$value" -gt "$m…` | `true` | `pr-review-step-rules.test.mjs`: "a number setting must be digits, at most six of them, and is written to GITHUB_ENV" |
| 251 | sh if whole | `! [[ "$value" =~ ^[1-9][0-9]*$ ]] \|\| [ "${#value}" -gt 6 ] \|\| [ "$value" -gt "$m…` | `false` | `pr-review-step-rules.test.mjs`: "a number setting must be digits, at most six of them, and is written to GITHUB_ENV" |
| 251 | sh if \|\| operand | `[ "${#value}" -gt 6 ]` | `false` | `pr-review-step-rules.test.mjs`: "a number setting must be digits, at most six of them, and is written to GITHUB_ENV" |
| 251 | sh if \|\| operand | `[ "$value" -gt "$max" ]` | `false` | `kit-settings.test.mjs`: "a value out of range names where it came from" |
| 255 | sh output statement | (before `echo "$name=$value" >> "$GITHUB_ENV"`) | `: ` | `pr-review-step-rules.test.mjs`: "a number setting must be digits, at most six of them, and is written to GITHUB_ENV" |
| 261 | sh list condition | `[ -n "$value" ]` | `true` | `pr-review-step-rules.test.mjs`: "a number setting must be digits, at most six of them, and is written to GITHUB_ENV" |
| 261 | sh list condition | `[ -n "$value" ]` | `false` | `model-provider.test.mjs`: "pr-review.yml: the provider sets which model names the settings step takes" |
| 262 | sh if whole | `! [[ "$value" =~ ^claude-[a-z0-9.-]+$ ]]` | `true` | `pr-review-step-rules.test.mjs`: "a number setting must be digits, at most six of them, and is written to GITHUB_ENV" |
| 262 | sh if whole | `! [[ "$value" =~ ^claude-[a-z0-9.-]+$ ]]` | `false` | `model-provider.test.mjs`: "pr-review.yml: the provider sets which model names the settings step takes" |
| 266 | sh output statement | (before `echo "$name=$value" >> "$GITHUB_ENV"`) | `: ` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 283 | sh list condition | `[ -n "$value" ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 283 | sh list condition | `[ -n "$value" ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 284 | sh if whole | `! [[ "$value" =~ ^[a-z0-9][a-z0-9.-]*$ ]]` | `true` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 284 | sh if whole | `! [[ "$value" =~ ^[a-z0-9][a-z0-9.-]*$ ]]` | `false` | `model-provider.test.mjs`: "pr-review.yml: the provider sets which model names the settings step takes" |
| 288 | sh if whole | `[[ "$value" == *-contributor ]]` | `true` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 288 | sh if whole | `[[ "$value" == *-contributor ]]` | `false` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 292 | sh output statement | (before `echo "$name=$value" >> "$GITHUB_ENV"`) | `: ` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 309 | sh case arm | `''` | `__mutant_never__` | `pr-review-step-rules.test.mjs`: "a number setting must be digits, at most six of them, and is written to GITHUB_ENV" |
| 311 | sh list condition | `[ "$PROVIDER" != opencode-go ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 311 | sh list condition | `[ "$PROVIDER" != opencode-go ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 312 | sh case arm | `claude-code` | `__mutant_never__` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 314 | sh if whole | `[ "$PROVIDER" = opencode-go ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 314 | sh if whole | `[ "$PROVIDER" = opencode-go ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 317 | sh case arm | `opencode` | `__mutant_never__` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 318 | sh if whole | `[ "$PROVIDER" != opencode-go ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 318 | sh if whole | `[ "$PROVIDER" != opencode-go ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 323 | sh case arm | `*` | `__mutant_never__` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 327 | sh output statement | (before `echo "KIT_REVIEW_RUNNER=$runner" >> "$GITHUB_ENV"`) | `: ` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 330 | sh case arm | `''\|anthropic` | `__mutant_never__` | `pr-review-step-rules.test.mjs`: "a number setting must be digits, at most six of them, and is written to GITHUB_ENV" |
| 331 | sh output statement | (before `echo "KIT_REVIEW_PROVIDER=anthropic" >> "$GITHUB_ENV"`) | `: ` | `model-provider.test.mjs`: "pr-review.yml: the provider sets which model names the settings step takes" |
| 334 | sh case arm | `opencode-go` | `__mutant_never__` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 335 | sh output statement | (before `echo "KIT_REVIEW_PROVIDER=opencode-go" >> "$GITHUB_ENV"`) | `: ` | `model-provider.test.mjs`: "pr-review.yml: the provider sets which model names the settings step takes" |
| 338 | sh case arm | `*` | `__mutant_never__` | `model-provider.test.mjs`: "pr-review.yml: the provider sets which model names the settings step takes" |
| 350 | sh if && operand | `[ -n "$value" ]` | `true` | `pr-review-step-rules.test.mjs`: "a number setting must be digits, at most six of them, and is written to GITHUB_ENV" |
| 350 | sh if whole | `[ -n "$value" ] && ! [[ "$value" =~ ^(low\|medium\|high\|xhigh\|max)$ ]]` | `true` | `pr-review-step-rules.test.mjs`: "a number setting must be digits, at most six of them, and is written to GITHUB_ENV" |
| 350 | sh if whole | `[ -n "$value" ] && ! [[ "$value" =~ ^(low\|medium\|high\|xhigh\|max)$ ]]` | `false` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 350 | sh if && operand | `! [[ "$value" =~ ^(low\|medium\|high\|xhigh\|max)$ ]]` | `true` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 354 | sh output statement | (before `echo "$name=$value" >> "$GITHUB_ENV"`) | `: ` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 383 | if: && operand | `github.event.action == 'edited'` | `true` | `pr-review-conditions.test.mjs`: "the early skip's in-flight check runs only for a first-attempt edit of the body alone" |
| 383 | if: whole | `github.event.action == 'edited' && github.event.changes.base == null && github.e…` | `true` | `pr-review-conditions.test.mjs`: "the early skip's in-flight check runs only for a first-attempt edit of the body alone" |
| 383 | if: whole | `github.event.action == 'edited' && github.event.changes.base == null && github.e…` | `false` | `pr-review-conditions.test.mjs`: "the early skip's in-flight check runs only for a first-attempt edit of the body alone" |
| 383 | if: && operand | `github.event.changes.base == null` | `true` | `pr-review-conditions.test.mjs`: "the early skip's in-flight check runs only for a first-attempt edit of the body alone" |
| 384 | if: && operand | `github.event.changes.title == null` | `true` | `pr-review-conditions.test.mjs`: "the early skip's in-flight check runs only for a first-attempt edit of the body alone" |
| 384 | if: && operand | `github.run_attempt == 1` | `true` | `pr-review-conditions.test.mjs`: "the early skip's in-flight check runs only for a first-attempt edit of the body alone" |
| 385 | if: && operand | `(env.KIT_REVIEW_MODE == 'push' \|\| env.KIT_REVIEW_MODE == 'open')` | `true` | `pr-review-conditions.test.mjs`: "the early skip's in-flight check runs only for a first-attempt edit of the body alone" |
| 385 | if: \|\| operand | `env.KIT_REVIEW_MODE == 'push'` | `false` | `pr-review-conditions.test.mjs`: "the early skip's in-flight check runs only for a first-attempt edit of the body alone" |
| 385 | if: \|\| operand | `env.KIT_REVIEW_MODE == 'open'` | `false` | `pr-review-conditions.test.mjs`: "the early skip's in-flight check runs only for a first-attempt edit of the body alone" |
| 399 | sh if whole | `busy=$( { gh api --method GET "repos/$REPO/actions/workflows/$WORKFLOW_FILE/runs…` | `true` | `pr-review-body-edit.test.mjs`: "the early skip goes ahead when only this run is in flight" |
| 399 | sh if whole | `busy=$( { gh api --method GET "repos/$REPO/actions/workflows/$WORKFLOW_FILE/runs…` | `false` | `pr-review-body-edit.test.mjs`: "the early skip goes ahead when only this run is in flight" |
| 403 | jq select and operand | `.id != $self` | `true` | `pr-review-body-edit.test.mjs`: "the early skip goes ahead when only this run is in flight" |
| 403 | jq select whole | `.id != $self and .status != "completed"` | `true` | `pr-review-body-edit.test.mjs`: "the early skip goes ahead when only this run is in flight" |
| 403 | jq select whole | `.id != $self and .status != "completed"` | `false` | `pr-review-body-edit.test.mjs`: "a run in flight on the branch defers the early skip" |
| 403 | jq select and operand | `.status != "completed"` | `true` | `pr-review-body-edit.test.mjs`: "the early skip goes ahead when only this run is in flight" |
| 404 | sh if whole | `[ "$busy" -eq 0 ]` | `true` | `pr-review-body-edit.test.mjs`: "a run in flight on the branch defers the early skip" |
| 404 | sh if whole | `[ "$busy" -eq 0 ]` | `false` | `pr-review-body-edit.test.mjs`: "the early skip goes ahead when only this run is in flight" |
| 406 | sh skip statement | `exit 0` | `:` | `pr-review-body-edit.test.mjs`: "the early skip goes ahead when only this run is in flight" |
| 412 | sh output statement | (before `echo "DEFER=true" >> "$GITHUB_ENV"`) | `: ` | `pr-review-body-edit.test.mjs`: "a run in flight on the branch defers the early skip" |
| 415 | if: && operand | `steps.inflight.outcome == 'success'` | `true` | `pr-review-conditions.test.mjs`: "the early skip runs only when the in-flight check succeeded and did not defer" |
| 415 | if: whole | `steps.inflight.outcome == 'success' && env.DEFER != 'true' && github.event.actio…` | `true` | `pr-review-conditions.test.mjs`: "the early skip runs only when the in-flight check succeeded and did not defer" |
| 415 | if: whole | `steps.inflight.outcome == 'success' && env.DEFER != 'true' && github.event.actio…` | `false` | `pr-review-conditions.test.mjs`: "the early skip runs only when the in-flight check succeeded and did not defer" |
| 415 | if: && operand | `env.DEFER != 'true'` | `true` | `pr-review-conditions.test.mjs`: "the early skip runs only when the in-flight check succeeded and did not defer" |
| 416 | if: && operand | `github.event.action == 'edited'` | `true` | `pr-review-conditions.test.mjs`: "the early skip runs only when the in-flight check succeeded and did not defer" |
| 416 | if: && operand | `github.event.changes.base == null` | `true` | `pr-review-conditions.test.mjs`: "the early skip runs only when the in-flight check succeeded and did not defer" |
| 417 | if: && operand | `github.event.changes.title == null` | `true` | `pr-review-conditions.test.mjs`: "the early skip runs only when the in-flight check succeeded and did not defer" |
| 417 | if: && operand | `github.run_attempt == 1` | `true` | `pr-review-conditions.test.mjs`: "the early skip runs only when the in-flight check succeeded and did not defer" |
| 418 | if: && operand | `(env.KIT_REVIEW_MODE == 'push' \|\| env.KIT_REVIEW_MODE == 'open')` | `true` | `pr-review-conditions.test.mjs`: "the early skip runs only when the in-flight check succeeded and did not defer" |
| 418 | if: \|\| operand | `env.KIT_REVIEW_MODE == 'push'` | `false` | `pr-review-conditions.test.mjs`: "the early skip runs only when the in-flight check succeeded and did not defer" |
| 418 | if: \|\| operand | `env.KIT_REVIEW_MODE == 'open'` | `false` | `pr-review-conditions.test.mjs`: "the early skip runs only when the in-flight check succeeded and did not defer" |
| 456 | jq select and operand | `.status == \"completed\"` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy: only the latest completed, unskipped other run counts, and its review job's conclusion" |
| 456 | jq select whole | `.status == \"completed\" and .conclusion != \"skipped\" and .id != $GITHUB_RUN_I…` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy: only the latest completed, unskipped other run counts, and its review job's conclusion" |
| 456 | jq select whole | `.status == \"completed\" and .conclusion != \"skipped\" and .id != $GITHUB_RUN_I…` | `false` | `pr-review-body-edit.test.mjs`: "the early copy skips, run without a checkout" |
| 456 | jq select and operand | `.conclusion != \"skipped\"` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy: only the latest completed, unskipped other run counts, and its review job's conclusion" |
| 456 | jq select and operand | `.id != $GITHUB_RUN_ID` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy: only the latest completed, unskipped other run counts, and its review job's conclusion" |
| 459 | jq select whole | `.name == "pr-review"` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy: only the latest completed, unskipped other run counts, and its review job's conclusion" |
| 459 | jq select whole | `.name == "pr-review"` | `false` | `pr-review-body-edit.test.mjs`: "the early copy skips, run without a checkout" |
| 460 | sh if whole | `[ "$conclusion" != skipped ]` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy: only the latest completed, unskipped other run counts, and its review job's conclusion" |
| 460 | sh if whole | `[ "$conclusion" != skipped ]` | `false` | `pr-review-body-edit.test.mjs`: "the early copy skips, run without a checkout" |
| 462 | sh skip statement | `return 0` | `:` | `pr-review-body-edit.test.mjs`: "the early copy skips, run without a checkout" |
| 472 | jq select and operand | `.user.login == "github-actions[bot]"` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy: the last report is the bot's latest comment headed as a review" |
| 472 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| contains("## Review R"))` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy: the last report is the bot's latest comment headed as a review" |
| 472 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| contains("## Review R"))` | `false` | `pr-review-body-edit.test.mjs`: "the early copy skips, run without a checkout" |
| 472 | jq select and operand | `(.body \| contains("## Review R"))` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy: the last report is the bot's latest comment headed as a review" |
| 492 | sh if \|\| operand | `[ -z "$reviewed" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy: a last report without one of its four lines reviews" |
| 492 | sh if whole | `[ -z "$reviewed" ] \|\| [ -z "$base_reviewed" ] \|\| [ -z "$title_reviewed" ] \|\| [ -…` | `true` | `pr-review-body-edit.test.mjs`: "the early copy skips, run without a checkout" |
| 492 | sh if whole | `[ -z "$reviewed" ] \|\| [ -z "$base_reviewed" ] \|\| [ -z "$title_reviewed" ] \|\| [ -…` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy: a last report without one of its four lines reviews" |
| 492 | sh if \|\| operand | `[ -z "$base_reviewed" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy: a last report without one of its four lines reviews" |
| 492 | sh if \|\| operand | `[ -z "$title_reviewed" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy: a last report without one of its four lines reviews" |
| 492 | sh if \|\| operand | `[ -z "$head_reviewed" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy: a last report without one of its four lines reviews" |
| 494 | sh elif && operand | `[ "$head_reviewed" != "$HEAD" ]` | `true` | `pr-review-body-edit.test.mjs`: "the early copy skips, run without a checkout" |
| 494 | sh elif whole | `[ "$head_reviewed" != "$HEAD" ] && [ "$MODE" != "open" ]` | `true` | `pr-review-body-edit.test.mjs`: "the early copy skips, run without a checkout" |
| 494 | sh elif whole | `[ "$head_reviewed" != "$HEAD" ] && [ "$MODE" != "open" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy: a later head reviews in mode push, and in mode open counts the reviewed head's run" |
| 494 | sh elif && operand | `[ "$MODE" != "open" ]` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy: a later head reviews in mode push, and in mode open counts the reviewed head's run" |
| 496 | sh elif whole | `[ "$base_reviewed" != "$base_cmp at $base_now" ]` | `true` | `pr-review-body-edit.test.mjs`: "the early copy skips, run without a checkout" |
| 496 | sh elif whole | `[ "$base_reviewed" != "$base_cmp at $base_now" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy: a moved base, another title or other closing references review" |
| 498 | sh elif whole | `[ "$title_reviewed" != "$title_now" ]` | `true` | `pr-review-body-edit.test.mjs`: "the early copy skips, run without a checkout" |
| 498 | sh elif whole | `[ "$title_reviewed" != "$title_now" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy: a moved base, another title or other closing references review" |
| 500 | sh elif whole | `[ "$(printf '%s' "$reviewed" \| sed 's/^Closes reviewed:[[:space:]]*//' \| tr ',' …` | `true` | `pr-review-body-edit.test.mjs`: "the early copy skips, run without a checkout" |
| 500 | sh elif whole | `[ "$(printf '%s' "$reviewed" \| sed 's/^Closes reviewed:[[:space:]]*//' \| tr ',' …` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy: a moved base, another title or other closing references review" |
| 509 | sh if whole | `[ "$head_reviewed" != "$HEAD" ]` | `true` | Not caught, equivalent: when the heads match, lookup is set to the head it already holds; only a log line differs |
| 509 | sh if whole | `[ "$head_reviewed" != "$HEAD" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy: a later head reviews in mode push, and in mode open counts the reviewed head's run" |
| 514 | sh if whole | `[ "$earlier" = "success" ]` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy: only the latest completed, unskipped other run counts, and its review job's conclusion" |
| 514 | sh if whole | `[ "$earlier" = "success" ]` | `false` | `pr-review-body-edit.test.mjs`: "the early copy skips, run without a checkout" |
| 515 | sh output statement | (before `echo "RUN=false" >> "$GITHUB_ENV"`) | `: ` | `pr-review-body-edit.test.mjs`: "the early copy skips, run without a checkout" |
| 527 | sh output statement | (before `printf '%s=%s\n' "$name" "${!name}" >> "$GITHUB_OUTPUT"`) | `: ` | `pr-review-body-edit.test.mjs`: "the settings job passes the early skip on, and only a skip" |
| 529 | sh if whole | `[ "${RUN:-}" = false ]` | `true` | `pr-review-body-edit.test.mjs`: "the settings job passes the early skip on, and only a skip" |
| 529 | sh if whole | `[ "${RUN:-}" = false ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job passes the early skip on, and only a skip" |
| 530 | sh output statement | (before `echo "SKIP=true" >> "$GITHUB_OUTPUT"`) | `: ` | `pr-review-body-edit.test.mjs`: "the settings job passes the early skip on, and only a skip" |
| 554 | if: whole | `${{ !cancelled() && (needs.settings.result == 'failure' \|\| (needs.settings.outpu…` | `true` | `pr-review-conditions.test.mjs`: "the review job runs after the settings job failed or chose a mode that reviews, and not once cancelled" |
| 554 | if: whole | `${{ !cancelled() && (needs.settings.result == 'failure' \|\| (needs.settings.outpu…` | `false` | `pr-review-conditions.test.mjs`: "the review job runs after the settings job failed or chose a mode that reviews, and not once cancelled" |
| 554 | if: && operand | `!cancelled()` | `true` | `pr-review-conditions.test.mjs`: "the review job runs after the settings job failed or chose a mode that reviews, and not once cancelled" |
| 554 | if: && operand | `(needs.settings.result == 'failure' \|\| (needs.settings.outputs.SKIP != 'true' &&…` | `true` | `pr-review-conditions.test.mjs`: "the review job runs after the settings job failed or chose a mode that reviews, and not once cancelled" |
| 554 | if: \|\| operand | `needs.settings.result == 'failure'` | `false` | `pr-review-conditions.test.mjs`: "the review job runs after the settings job failed or chose a mode that reviews, and not once cancelled" |
| 554 | if: \|\| operand | `(needs.settings.outputs.SKIP != 'true' && (needs.settings.outputs.KIT_REVIEW_MOD…` | `false` | `pr-review-conditions.test.mjs`: "the review job runs after the settings job failed or chose a mode that reviews, and not once cancelled" |
| 554 | if: && operand | `needs.settings.outputs.SKIP != 'true'` | `true` | `pr-review-conditions.test.mjs`: "the review job runs after the settings job failed or chose a mode that reviews, and not once cancelled" |
| 554 | if: && operand | `(needs.settings.outputs.KIT_REVIEW_MODE == 'push' \|\| needs.settings.outputs.KIT_…` | `true` | `pr-review-conditions.test.mjs`: "the review job runs after the settings job failed or chose a mode that reviews, and not once cancelled" |
| 554 | if: \|\| operand | `needs.settings.outputs.KIT_REVIEW_MODE == 'push'` | `false` | `pr-review-conditions.test.mjs`: "the review job runs after the settings job failed or chose a mode that reviews, and not once cancelled" |
| 554 | if: \|\| operand | `needs.settings.outputs.KIT_REVIEW_MODE == 'open'` | `false` | `pr-review-conditions.test.mjs`: "the review job runs after the settings job failed or chose a mode that reviews, and not once cancelled" |
| 583 | if: whole | `github.event_name == 'pull_request'` | `true` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 583 | if: whole | `github.event_name == 'pull_request'` | `false` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 593 | sh case arm | `admin\|write` | `__mutant_never__` | `workflow-guards.test.mjs`: "pr-review.yml: the gate refuses an author or actor without write access" |
| 594 | sh case arm | `*` | `__mutant_never__` | `workflow-guards.test.mjs`: "pr-review.yml: the gate refuses an author or actor without write access" |
| 604 | if: whole | `needs.settings.result == 'failure'` | `true` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 604 | if: whole | `needs.settings.result == 'failure'` | `false` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 624 | if: whole | `github.event_name == 'workflow_dispatch'` | `true` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 624 | if: whole | `github.event_name == 'workflow_dispatch'` | `false` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 629 | sh case arm | `''\|*[!0-9]*` | `__mutant_never__` | `pr-review-steps.test.mjs`: "pr-review.yml: a dispatch checks out a pull request of this repository, and refuses a fork's before fetching it" |
| 631 | sh if whole | `[ "$(gh pr view "$PR" --json isCrossRepository --jq .isCrossRepository)" = "true…` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: a dispatch checks out a pull request of this repository, and refuses a fork's before fetching it" |
| 631 | sh if whole | `[ "$(gh pr view "$PR" --json isCrossRepository --jq .isCrossRepository)" = "true…` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: a dispatch checks out a pull request of this repository, and refuses a fork's before fetching it" |
| 639 | sh output statement | (before `echo "BASE=$(gh pr view "$PR" --json baseRefName --jq .baseR`) | `: ` | `pr-review-steps.test.mjs`: "pr-review.yml: a dispatch checks out a pull request of this repository, and refuses a fork's before fetching it" |
| 640 | sh output statement | (before `echo "HEAD_SHA=$(git rev-parse HEAD)" >> "$GITHUB_ENV"`) | `: ` | `pr-review-steps.test.mjs`: "pr-review.yml: a dispatch checks out a pull request of this repository, and refuses a fork's before fetching it" |
| 649 | sh output statement | (before `rm -rf -- .claude .mcp.json .claude.json CLAUDE.local.md .gi`) | `: ` | `workflow-guards.test.mjs`: "pr-review.yml: the head's executable Claude configuration is removed" |
| 686 | sh if whole | `git cat-file -e "origin/$BASE:$f" 2>/dev/null` | `true` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 686 | sh if whole | `git cat-file -e "origin/$BASE:$f" 2>/dev/null` | `false` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 690 | sh while whole | `[ "${rest#*/}" != "$rest" ]` | `true` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 690 | sh while whole | `[ "${rest#*/}" != "$rest" ]` | `false` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 692 | sh list condition | `[ -L "$dir" ]` | `false` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 692 | sh list condition | `[ -L "$dir" ]` | `true` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 692 | sh output statement | (before `rm -f -- "$dir"`) | `: ` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 694 | sh output statement | (before `rm -rf -- "$f"`) | `: ` | Not caught, equivalent: git checkout replaces a file, directory or symlink at the path itself (git 2.54, checked 2026-11-26), so the removal before it changes nothing |
| 699 | sh list condition | `git cat-file -e "origin/$BASE:$f" 2>/dev/null` | `true` | `pr-review-rules.test.mjs`: "the reviewer's rules and server come from the base, and no CLAUDE.md is left to load" |
| 699 | sh list condition | `git cat-file -e "origin/$BASE:$f" 2>/dev/null` | `false` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 699 | sh output statement | (before `rm -f -- "$f"`) | `: ` | `pr-review-rules.test.mjs`: "the reviewer's rules and server come from the base, and no CLAUDE.md is left to load" |
| 702 | sh if whole | `[ -L "$p" ]` | `true` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 702 | sh if whole | `[ -L "$p" ]` | `false` | `pr-review-rules.test.mjs`: "a first adoption whose server is a symlink is refused before root copies it" |
| 707 | sh output statement | (before `sudo install -d -o root -g root -m 0755 /opt/agent-kit`) | `: ` | Left untested: runner provisioning (sudo install into /opt/agent-kit on the GitHub runner); every review run exercises it |
| 708 | sh output statement | (before `sudo install -o root -g root -m 0755 .github/scripts/mcp-ser`) | `: ` | `pr-review-step-rules.test.mjs`: "a base with both public-content checks installs only the Node one" |
| 717 | sh list condition | `[ -n "$entry" ]` | `true` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 717 | sh list condition | `[ -n "$entry" ]` | `false` | `pr-review-step-rules.test.mjs`: "a base with both public-content checks installs only the Node one" |
| 719 | sh case arm | `100644\|100755` | `__mutant_never__` | `pr-review-step-rules.test.mjs`: "a base with both public-content checks installs only the Node one" |
| 720 | sh case arm | `*` | `__mutant_never__` | `public-content-install.test.mjs`: "pr-review fails on a base check committed as a symlink" |
| 723 | sh file write | `"$tmp"` | `/dev/null` | `pr-review-step-rules.test.mjs`: "a base with both public-content checks installs only the Node one" |
| 727 | sh file write | `"$RUNNER_TEMP/public-content-empty"` | `/dev/null` | `pr-review-step-rules.test.mjs`: "a base with both public-content checks installs only the Node one" |
| 729 | sh case arm | `*.py` | `__mutant_never__` | `public-content-install.test.mjs`: "pr-review takes a base's Python check" |
| 730 | sh case arm | `*` | `__mutant_never__` | `pr-review-step-rules.test.mjs`: "a base with both public-content checks installs only the Node one" |
| 732 | sh if whole | `! env -i PATH="$PATH" "${run[@]}" "$tmp" --text="$RUNNER_TEMP/public-content-emp…` | `true` | `pr-review-step-rules.test.mjs`: "a base with both public-content checks installs only the Node one" |
| 732 | sh if whole | `! env -i PATH="$PATH" "${run[@]}" "$tmp" --text="$RUNNER_TEMP/public-content-emp…` | `false` | `public-content-install.test.mjs`: "a check that fails on an empty text stops either workflow before the model runs" |
| 736 | sh output statement | (before `rm -f -- "$RUNNER_TEMP/public-content-empty"`) | `: ` | Not a rule: removes a scratch file in RUNNER_TEMP, which the runner discards |
| 738 | sh output statement | (before `sudo install -o root -g root -m 0644 "$tmp" "$dest"`) | `: ` | `pr-review-step-rules.test.mjs`: "a base with both public-content checks installs only the Node one" |
| 739 | sh output statement | (before `rm -f -- "$tmp"`) | `: ` | Not a rule: removes a scratch copy in RUNNER_TEMP, which the runner discards |
| 740 | sh output statement | (before `echo "PUBLIC_CONTENT_CHECK=$dest" >> "$GITHUB_ENV"`) | `: ` | `pr-review-step-rules.test.mjs`: "a base with both public-content checks installs only the Node one" |
| 741 | sh skip statement | `break` | `:` | `pr-review-step-rules.test.mjs`: "a base with both public-content checks installs only the Node one" |
| 753 | sh output statement | (before `rm -f -- "$link"`) | `: ` | `pr-review-rules.test.mjs`: "every symlink in the checkout is removed, a directory link inside it too" |
| 783 | if: && operand | `github.event.action == 'edited'` | `true` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 783 | if: whole | `github.event.action == 'edited' && github.event.changes.base == null && github.e…` | `true` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 783 | if: whole | `github.event.action == 'edited' && github.event.changes.base == null && github.e…` | `false` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 783 | if: && operand | `github.event.changes.base == null` | `true` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 783 | if: && operand | `github.event.changes.title == null` | `true` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 820 | jq select and operand | `.status == \"completed\"` | `true` | `pr-review-body-edit.test.mjs`: "the review job's step: only the latest completed, unskipped other run counts, and its review job's conclusion" |
| 820 | jq select whole | `.status == \"completed\" and .conclusion != \"skipped\" and .id != $GITHUB_RUN_I…` | `true` | `pr-review-body-edit.test.mjs`: "the review job's step: only the latest completed, unskipped other run counts, and its review job's conclusion" |
| 820 | jq select whole | `.status == \"completed\" and .conclusion != \"skipped\" and .id != $GITHUB_RUN_I…` | `false` | `pr-review-body-edit.test.mjs`: "an edit that keeps the closing references skips the review" |
| 820 | jq select and operand | `.conclusion != \"skipped\"` | `true` | `pr-review-body-edit.test.mjs`: "the review job's step: only the latest completed, unskipped other run counts, and its review job's conclusion" |
| 820 | jq select and operand | `.id != $GITHUB_RUN_ID` | `true` | `pr-review-body-edit.test.mjs`: "the review job's step: only the latest completed, unskipped other run counts, and its review job's conclusion" |
| 823 | jq select whole | `.name == "pr-review"` | `true` | `pr-review-body-edit.test.mjs`: "the review job's step: only the latest completed, unskipped other run counts, and its review job's conclusion" |
| 823 | jq select whole | `.name == "pr-review"` | `false` | `pr-review-body-edit.test.mjs`: "an edit that keeps the closing references skips the review" |
| 824 | sh if whole | `[ "$conclusion" != skipped ]` | `true` | `pr-review-body-edit.test.mjs`: "the review job's step: only the latest completed, unskipped other run counts, and its review job's conclusion" |
| 824 | sh if whole | `[ "$conclusion" != skipped ]` | `false` | `pr-review-body-edit.test.mjs`: "an edit that keeps the closing references skips the review" |
| 826 | sh skip statement | `return 0` | `:` | `pr-review-body-edit.test.mjs`: "an edit that keeps the closing references skips the review" |
| 836 | jq select and operand | `.user.login == "github-actions[bot]"` | `true` | `pr-review-body-edit.test.mjs`: "the review job's step: the last report is the bot's latest comment headed as a review" |
| 836 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| contains("## Review R"))` | `true` | `pr-review-body-edit.test.mjs`: "the review job's step: the last report is the bot's latest comment headed as a review" |
| 836 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| contains("## Review R"))` | `false` | `pr-review-body-edit.test.mjs`: "an edit that keeps the closing references skips the review" |
| 836 | jq select and operand | `(.body \| contains("## Review R"))` | `true` | `pr-review-body-edit.test.mjs`: "the review job's step: the last report is the bot's latest comment headed as a review" |
| 856 | sh if \|\| operand | `[ -z "$reviewed" ]` | `false` | `pr-review-body-edit.test.mjs`: "the review job's step: a last report without one of its four lines reviews" |
| 856 | sh if whole | `[ -z "$reviewed" ] \|\| [ -z "$base_reviewed" ] \|\| [ -z "$title_reviewed" ] \|\| [ -…` | `true` | `pr-review-body-edit.test.mjs`: "an edit that keeps the closing references skips the review" |
| 856 | sh if whole | `[ -z "$reviewed" ] \|\| [ -z "$base_reviewed" ] \|\| [ -z "$title_reviewed" ] \|\| [ -…` | `false` | `pr-review-body-edit.test.mjs`: "the review job's step: a last report without one of its four lines reviews" |
| 856 | sh if \|\| operand | `[ -z "$base_reviewed" ]` | `false` | `pr-review-body-edit.test.mjs`: "the review job's step: a last report without one of its four lines reviews" |
| 856 | sh if \|\| operand | `[ -z "$title_reviewed" ]` | `false` | `pr-review-body-edit.test.mjs`: "the review job's step: a last report without one of its four lines reviews" |
| 856 | sh if \|\| operand | `[ -z "$head_reviewed" ]` | `false` | `pr-review-body-edit.test.mjs`: "the review job's step: a last report without one of its four lines reviews" |
| 858 | sh elif && operand | `[ "$head_reviewed" != "$HEAD" ]` | `true` | `pr-review-body-edit.test.mjs`: "an edit that keeps the closing references skips the review" |
| 858 | sh elif whole | `[ "$head_reviewed" != "$HEAD" ] && [ "$MODE" != "open" ]` | `true` | `pr-review-body-edit.test.mjs`: "an edit that keeps the closing references skips the review" |
| 858 | sh elif whole | `[ "$head_reviewed" != "$HEAD" ] && [ "$MODE" != "open" ]` | `false` | `pr-review-body-edit.test.mjs`: "the review job's step: a later head reviews in mode push, and in mode open counts the reviewed head's run" |
| 858 | sh elif && operand | `[ "$MODE" != "open" ]` | `true` | `pr-review-body-edit.test.mjs`: "the review job's step: a later head reviews in mode push, and in mode open counts the reviewed head's run" |
| 860 | sh elif whole | `[ "$base_reviewed" != "$base_cmp at $base_now" ]` | `true` | `pr-review-body-edit.test.mjs`: "an edit that keeps the closing references skips the review" |
| 860 | sh elif whole | `[ "$base_reviewed" != "$base_cmp at $base_now" ]` | `false` | `pr-review-body-edit.test.mjs`: "a base branch that moved since the last report reviews" |
| 862 | sh elif whole | `[ "$title_reviewed" != "$title_now" ]` | `true` | `pr-review-body-edit.test.mjs`: "an edit that keeps the closing references skips the review" |
| 862 | sh elif whole | `[ "$title_reviewed" != "$title_now" ]` | `false` | `pr-review-body-edit.test.mjs`: "the title compared is the event's, read from the event file" |
| 864 | sh elif whole | `[ "$(printf '%s' "$reviewed" \| sed 's/^Closes reviewed:[[:space:]]*//' \| tr ',' …` | `true` | `pr-review-body-edit.test.mjs`: "an edit that keeps the closing references skips the review" |
| 864 | sh elif whole | `[ "$(printf '%s' "$reviewed" \| sed 's/^Closes reviewed:[[:space:]]*//' \| tr ',' …` | `false` | `pr-review-body-edit.test.mjs`: "an edit that changes a closing reference reviews" |
| 873 | sh if whole | `[ "$head_reviewed" != "$HEAD" ]` | `true` | Not caught, equivalent: when the heads match, lookup is set to the head it already holds; only a log line differs |
| 873 | sh if whole | `[ "$head_reviewed" != "$HEAD" ]` | `false` | `pr-review-body-edit.test.mjs`: "the review job's step: a later head reviews in mode push, and in mode open counts the reviewed head's run" |
| 878 | sh if whole | `[ "$earlier" = "success" ]` | `true` | `pr-review-body-edit.test.mjs`: "the review job's step: only the latest completed, unskipped other run counts, and its review job's conclusion" |
| 878 | sh if whole | `[ "$earlier" = "success" ]` | `false` | `pr-review-body-edit.test.mjs`: "an edit that keeps the closing references skips the review" |
| 879 | sh output statement | (before `echo "RUN=false" >> "$GITHUB_ENV"`) | `: ` | `pr-review-body-edit.test.mjs`: "an edit that keeps the closing references skips the review" |
| 896 | if: && operand | `github.event.action == 'synchronize'` | `true` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 896 | if: whole | `github.event.action == 'synchronize' && env.KIT_REVIEW_MODE == 'open'` | `true` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 896 | if: whole | `github.event.action == 'synchronize' && env.KIT_REVIEW_MODE == 'open'` | `false` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 896 | if: && operand | `env.KIT_REVIEW_MODE == 'open'` | `true` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 914 | jq select and operand | `.status == \"completed\"` | `true` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 914 | jq select whole | `.status == \"completed\" and .conclusion != \"skipped\" and .id != $GITHUB_RUN_I…` | `true` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 914 | jq select whole | `.status == \"completed\" and .conclusion != \"skipped\" and .id != $GITHUB_RUN_I…` | `false` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 914 | jq select and operand | `.conclusion != \"skipped\"` | `true` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 914 | jq select and operand | `.id != $GITHUB_RUN_ID` | `true` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 917 | jq select whole | `.name == "pr-review"` | `true` | `kit-settings.test.mjs`: "a run whose review job was skipped does not stand for a review" |
| 917 | jq select whole | `.name == "pr-review"` | `false` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 918 | sh if whole | `[ "$conclusion" != skipped ]` | `true` | `kit-settings.test.mjs`: "a run whose review job was skipped does not stand for a review" |
| 918 | sh if whole | `[ "$conclusion" != skipped ]` | `false` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 920 | sh skip statement | `return 0` | `:` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 927 | jq select and operand | `.user.login == "github-actions[bot]"` | `true` | `pr-review-step-rules.test.mjs`: "the push skip reads the head only from the bot's reports, and reviews when there is none" |
| 927 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| contains("## Review R"))` | `true` | `pr-review-step-rules.test.mjs`: "the push skip reads the head only from the bot's reports, and reviews when there is none" |
| 927 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| contains("## Review R"))` | `false` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 927 | jq select and operand | `(.body \| contains("## Review R"))` | `true` | `pr-review-step-rules.test.mjs`: "the push skip reads the head only from the bot's reports, and reviews when there is none" |
| 929 | sh if whole | `[ -z "$last_head" ]` | `true` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 929 | sh if whole | `[ -z "$last_head" ]` | `false` | `pr-review-step-rules.test.mjs`: "the push skip reads the head only from the bot's reports, and reviews when there is none" |
| 931 | sh skip statement | `exit 0` | `:` | `pr-review-step-rules.test.mjs`: "the push skip reads the head only from the bot's reports, and reviews when there is none" |
| 934 | sh if whole | `[ "$earlier" = "success" ]` | `true` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 934 | sh if whole | `[ "$earlier" = "success" ]` | `false` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 935 | sh output statement | (before `echo "RUN=false" >> "$GITHUB_ENV"`) | `: ` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 949 | if: whole | `env.RUN != 'false'` | `true` | `pr-review-conditions.test.mjs`: "every review step after the skips runs unless a skip set RUN to false" |
| 949 | if: whole | `env.RUN != 'false'` | `false` | `pr-review-conditions.test.mjs`: "every review step after the skips runs unless a skip set RUN to false" |
| 959 | sh output statement | (before `gh api -X POST "repos/$REPO/check-runs" --input - --jq .id)`) | `: ` | `pr-review-step-rules.test.mjs`: "the verdict and start steps write what the later steps read" |
| 960 | sh output statement | (before `echo "VERDICT_CHECK_ID=$id" >> "$GITHUB_ENV"`) | `: ` | `pr-review-step-rules.test.mjs`: "the verdict and start steps write what the later steps read" |
| 971 | if: whole | `env.RUN != 'false'` | `true` | `pr-review-conditions.test.mjs`: "every review step after the skips runs unless a skip set RUN to false" |
| 971 | if: whole | `env.RUN != 'false'` | `false` | `pr-review-conditions.test.mjs`: "every review step after the skips runs unless a skip set RUN to false" |
| 979 | sh if \|\| operand | `[ "$changed" -gt "$KIT_REVIEW_MAX_FILES" ]` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: a pull request beyond the diff limits, or with files the checkout lacks, is refused" |
| 979 | sh if whole | `[ "$changed" -gt "$KIT_REVIEW_MAX_FILES" ] \|\| [ "$lines" -gt "$KIT_REVIEW_MAX_LI…` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: a pull request beyond the diff limits, or with files the checkout lacks, is refused" |
| 979 | sh if whole | `[ "$changed" -gt "$KIT_REVIEW_MAX_FILES" ] \|\| [ "$lines" -gt "$KIT_REVIEW_MAX_LI…` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: a pull request beyond the diff limits, or with files the checkout lacks, is refused" |
| 979 | sh if \|\| operand | `[ "$lines" -gt "$KIT_REVIEW_MAX_LINES" ]` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: a pull request beyond the diff limits, or with files the checkout lacks, is refused" |
| 984 | sh if whole | `[ "$local_count" -lt "$changed" ]` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: a pull request beyond the diff limits, or with files the checkout lacks, is refused" |
| 984 | sh if whole | `[ "$local_count" -lt "$changed" ]` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: a pull request beyond the diff limits, or with files the checkout lacks, is refused" |
| 995 | sh if whole | `git config --local --list \| grep -qiE 'extraheader\|includeif'` | `true` | `workflow-guards.test.mjs`: "pr-review.yml: a checkout whose git config references credentials fails the run" |
| 995 | sh if whole | `git config --local --list \| grep -qiE 'extraheader\|includeif'` | `false` | `workflow-guards.test.mjs`: "pr-review.yml: a checkout whose git config references credentials fails the run" |
| 1005 | if: && operand | `env.RUN != 'false'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1005 | if: whole | `env.RUN != 'false' && env.KIT_REVIEW_RUNNER != 'opencode'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1005 | if: whole | `env.RUN != 'false' && env.KIT_REVIEW_RUNNER != 'opencode'` | `false` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1005 | if: && operand | `env.KIT_REVIEW_RUNNER != 'opencode'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1012 | sh list \|\| operand | `sudo apt-get update -qq` | `false` | Left untested: runner provisioning (apt-get on the GitHub runner); every Claude Code review run exercises it |
| 1012 | sh list whole | `sudo apt-get update -qq \|\| sudo apt-get update -qq` | `true` | Left untested: runner provisioning (apt-get on the GitHub runner); every Claude Code review run exercises it |
| 1012 | sh list whole | `sudo apt-get update -qq \|\| sudo apt-get update -qq` | `false` | Left untested: runner provisioning (apt-get on the GitHub runner); every Claude Code review run exercises it |
| 1012 | sh list \|\| operand | `sudo apt-get update -qq` | `false` | Left untested: runner provisioning (apt-get on the GitHub runner); every Claude Code review run exercises it |
| 1015 | sh if whole | `[ -f /proc/sys/kernel/apparmor_restrict_unprivileged_userns ]` | `true` | Left untested: runner provisioning (the runner's AppArmor setting); every Claude Code review run exercises it |
| 1015 | sh if whole | `[ -f /proc/sys/kernel/apparmor_restrict_unprivileged_userns ]` | `false` | Left untested: runner provisioning (the runner's AppArmor setting); every Claude Code review run exercises it |
| 1019 | if: whole | `env.RUN != 'false'` | `true` | `pr-review-conditions.test.mjs`: "every review step after the skips runs unless a skip set RUN to false" |
| 1019 | if: whole | `env.RUN != 'false'` | `false` | `pr-review-conditions.test.mjs`: "every review step after the skips runs unless a skip set RUN to false" |
| 1024 | sh output statement | (before `echo "STARTED=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$GITHUB_EN`) | `: ` | `pr-review-step-rules.test.mjs`: "the verdict and start steps write what the later steps read" |
| 1028 | sh output statement | (before `echo "LAST_COMMENT_ID=${last:-0}" >> "$GITHUB_ENV"`) | `: ` | `pr-review-step-rules.test.mjs`: "the verdict and start steps write what the later steps read" |
| 1058 | if: whole | `env.RUN != 'false'` | `true` | `pr-review-conditions.test.mjs`: "every review step after the skips runs unless a skip set RUN to false" |
| 1058 | if: whole | `env.RUN != 'false'` | `false` | `pr-review-conditions.test.mjs`: "every review step after the skips runs unless a skip set RUN to false" |
| 1074 | sh case arm | `*[!0-9a-f]*\|''` | `__mutant_never__` | `workflow-fail-closed.test.mjs`: "pr-review.yml: the run stops before its settings without a head sha or a base branch" |
| 1077 | sh list condition | `[ -n "$base" ]` | `true` | `workflow-fail-closed.test.mjs`: "pr-review.yml: the run stops before its settings without a head sha or a base branch" |
| 1077 | sh list condition | `[ -n "$base" ]` | `false` | `pr-review-step-rules.test.mjs`: "the settings step hands both runners the denied and allowed tool lists" |
| 1078 | sh file write | `"$RUNNER_TEMP/claude-settings.json"` | `/dev/null` | `pr-review-step-rules.test.mjs`: "the settings step hands both runners the denied and allowed tool lists" |
| 1088 | sh file write | `"$RUNNER_TEMP/gh-token"` | `/dev/null` | `pr-review-step-rules.test.mjs`: "the settings step hands both runners the denied and allowed tool lists" |
| 1091 | sh if whole | `[ -n "${PUBLIC_CONTENT_CHECK:-}" ]` | `true` | `public-content-install.test.mjs`: "pr-review.yml: without a check the server's configuration is as before" |
| 1091 | sh if whole | `[ -n "${PUBLIC_CONTENT_CHECK:-}" ]` | `false` | `public-content-install.test.mjs`: "pr-review.yml: the server gets the check and a private file of the names, never the names inline" |
| 1092 | sh file write | `"$RUNNER_TEMP/private-repo-names"` | `/dev/null` | `pr-review-step-rules.test.mjs`: "with a public-content check, the settings step writes the private names for the server alone" |
| 1095 | jq if whole | `$check == ""` | `true` | `public-content-install.test.mjs`: "pr-review.yml: the server gets the check and a private file of the names, never the names inline" |
| 1095 | jq if whole | `$check == ""` | `false` | `public-content-install.test.mjs`: "pr-review.yml: without a check the server's configuration is as before" |
| 1096 | sh output statement | (before `echo "MCP_CONFIG=$mcp" >> "$GITHUB_ENV"`) | `: ` | `public-content-install.test.mjs`: "pr-review.yml: the server gets the check and a private file of the names, never the names inline" |
| 1097 | sh output statement | (before `echo "REVIEW_ALLOWED=Read,Grep,Glob,mcp__agent-kit__inline_c`) | `: ` | `pr-review-step-rules.test.mjs`: "the settings step hands both runners the denied and allowed tool lists" |
| 1098 | sh output statement | (before `echo "REVIEW_DENIED=Bash,Edit,Write,NotebookEdit,WebFetch,We`) | `: ` | `pr-review-step-rules.test.mjs`: "the settings step hands both runners the denied and allowed tool lists" |
| 1117 | if: && operand | `env.RUN != 'false'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1117 | if: whole | `env.RUN != 'false' && env.KIT_REVIEW_RUNNER != 'opencode'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1117 | if: whole | `env.RUN != 'false' && env.KIT_REVIEW_RUNNER != 'opencode'` | `false` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1117 | if: && operand | `env.KIT_REVIEW_RUNNER != 'opencode'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1132 | sh output statement | (before `sudo install -o root -g root -m 0755 "$RUNNER_TEMP/claude" /`) | `: ` | Left untested: runner provisioning (sudo install into /opt/agent-kit on the GitHub runner); every review run exercises it |
| 1133 | sh output statement | (before `rm -f -- "$RUNNER_TEMP/claude"`) | `: ` | Not a rule: removes the downloaded binary from RUNNER_TEMP after installing it |
| 1144 | if: && operand | `env.RUN != 'false'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1144 | if: whole | `env.RUN != 'false' && env.KIT_REVIEW_RUNNER == 'opencode'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1144 | if: whole | `env.RUN != 'false' && env.KIT_REVIEW_RUNNER == 'opencode'` | `false` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1144 | if: && operand | `env.KIT_REVIEW_RUNNER == 'opencode'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1146 | sh output statement | (before `rm -rf -- .opencode opencode.json opencode.jsonc`) | `: ` | `review-opencode.test.mjs`: "pr-review.yml: the checkout's OpenCode configuration goes before OpenCode first runs" |
| 1155 | if: && operand | `env.RUN != 'false'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1155 | if: whole | `env.RUN != 'false' && env.KIT_REVIEW_RUNNER == 'opencode'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1155 | if: whole | `env.RUN != 'false' && env.KIT_REVIEW_RUNNER == 'opencode'` | `false` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1155 | if: && operand | `env.KIT_REVIEW_RUNNER == 'opencode'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1166 | sh output statement | (before `sudo install -o root -g root -m 0755 "$RUNNER_TEMP/opencode-`) | `: ` | Left untested: runner provisioning (sudo install into /opt/agent-kit on the GitHub runner); every review run exercises it |
| 1167 | sh output statement | (before `rm -rf -- "$RUNNER_TEMP/opencode.tar.gz" "$RUNNER_TEMP/openc`) | `: ` | Not a rule: removes the downloaded archive from RUNNER_TEMP after installing it |
| 1198 | if: && operand | `env.RUN != 'false'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1198 | if: whole | `env.RUN != 'false' && env.KIT_REVIEW_RUNNER == 'claude-code'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1198 | if: whole | `env.RUN != 'false' && env.KIT_REVIEW_RUNNER == 'claude-code'` | `false` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1198 | if: && operand | `env.KIT_REVIEW_RUNNER == 'claude-code'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1209 | sh if whole | `[ "$KIT_REVIEW_PROVIDER" = opencode-go ]` | `true` | `pr-review-step-rules.test.mjs`: "the review step reads the last result from a stream that Claude Code wrote as an array" |
| 1209 | sh if whole | `[ "$KIT_REVIEW_PROVIDER" = opencode-go ]` | `false` | `model-provider.test.mjs`: "pr-review.yml, Run the review: OpenCode Go gets its key as a bearer token, and nothing else" |
| 1210 | sh if whole | `[ -z "$OPENCODE_API_KEY" ]` | `true` | `model-provider.test.mjs`: "pr-review.yml, Run the review: OpenCode Go gets its key as a bearer token, and nothing else" |
| 1210 | sh if whole | `[ -z "$OPENCODE_API_KEY" ]` | `false` | `model-provider.test.mjs`: "pr-review.yml, Run the review: OpenCode Go without its key fails before the CLI starts" |
| 1222 | sh elif whole | `[ -z "$ANTHROPIC_API_KEY" ]` | `true` | `pr-review-step-rules.test.mjs`: "the review step reads the last result from a stream that Claude Code wrote as an array" |
| 1222 | sh elif whole | `[ -z "$ANTHROPIC_API_KEY" ]` | `false` | `model-provider.test.mjs`: "pr-review.yml, Run the review: the Anthropic provider without its key fails before the CLI starts" |
| 1224 | sh list condition | `[ -z "$OPENCODE_API_KEY" ]` | `true` | `model-provider.test.mjs`: "pr-review.yml, Run the review: the Anthropic provider without its key fails before the CLI starts" |
| 1224 | sh list condition | `[ -z "$OPENCODE_API_KEY" ]` | `false` | `model-provider.test.mjs`: "pr-review.yml, Run the review: the Anthropic provider without its key fails before the CLI starts" |
| 1231 | sh list condition | `[ -z "$KIT_REVIEW_EFFORT" ]` | `true` | `model-provider.test.mjs`: "pr-review.yml, Run the review: the effort level reaches the CLI, and none when unset" |
| 1231 | sh list condition | `[ -z "$KIT_REVIEW_EFFORT" ]` | `false` | `model-provider.test.mjs`: "pr-review.yml, Run the review: the effort level reaches the CLI, and none when unset" |
| 1232 | sh list condition | `/opt/agent-kit/claude -p "$PROMPT" \ --output-format json \ --model "$KIT_REVIEW…` | `true` | `pr-review-step-rules.test.mjs`: "the review step reads the last result from a stream that Claude Code wrote as an array" |
| 1232 | sh list condition | `/opt/agent-kit/claude -p "$PROMPT" \ --output-format json \ --model "$KIT_REVIEW…` | `false` | `pr-review-step-rules.test.mjs`: "the review step reads the last result from a stream that Claude Code wrote as an array" |
| 1245 | sh file write | `"$RESULT"` | `/dev/null` | `pr-review-step-rules.test.mjs`: "the review step reads the last result from a stream that Claude Code wrote as an array" |
| 1246 | sh if whole | `[ ! -s "$RESULT" ]` | `true` | `pr-review-step-rules.test.mjs`: "the review step reads the last result from a stream that Claude Code wrote as an array" |
| 1246 | sh if whole | `[ ! -s "$RESULT" ]` | `false` | `model-provider.test.mjs`: "pr-review.yml, Run the review: a run that ends in error, or with no result, fails" |
| 1251 | jq if whole | `type == "array"` | `true` | `model-provider.test.mjs`: "pr-review.yml, Run the review: the effort level reaches the CLI, and none when unset" |
| 1251 | jq if whole | `type == "array"` | `false` | `pr-review-step-rules.test.mjs`: "the review step reads the last result from a stream that Claude Code wrote as an array" |
| 1251 | jq select whole | `.type == "result"` | `true` | `pr-review-step-rules.test.mjs`: "the review step reads the last result from a stream that Claude Code wrote as an array" |
| 1251 | jq select whole | `.type == "result"` | `false` | `pr-review-step-rules.test.mjs`: "the review step reads the last result from a stream that Claude Code wrote as an array" |
| 1258 | sh list condition | `[ "$closed" != true ]` | `true` | `model-provider.test.mjs`: "pr-review.yml, Run the review: a run closed on a private name withholds its last message and fails" |
| 1258 | sh list condition | `[ "$closed" != true ]` | `false` | `model-provider.test.mjs`: "pr-review.yml, Run the review: a run closed on a private name withholds its last message and fails" |
| 1263 | sh list condition | `[ "$KIT_REVIEW_PROVIDER" != opencode-go ]` | `true` | `model-provider.test.mjs`: "pr-review.yml, Run the review: OpenCode Go gets its key as a bearer token, and nothing else" |
| 1263 | sh list condition | `[ "$KIT_REVIEW_PROVIDER" != opencode-go ]` | `false` | `model-provider.test.mjs`: "pr-review.yml, Run the review: the Anthropic provider passes the Anthropic key only" |
| 1270 | sh if whole | `[ "$closed" = true ]` | `true` | `pr-review-step-rules.test.mjs`: "the review step reads the last result from a stream that Claude Code wrote as an array" |
| 1270 | sh if whole | `[ "$closed" = true ]` | `false` | `model-provider.test.mjs`: "pr-review.yml, Run the review: a run closed on a private name withholds its last message and fails" |
| 1274 | sh if \|\| operand | `[ "$status" -ne 0 ]` | `false` | `model-provider.test.mjs`: "pr-review.yml, Run the review: a run that ends in error, or with no result, fails" |
| 1274 | sh if whole | `[ "$status" -ne 0 ] \|\| [ "$(jq -r '.is_error' <<<"$result")" != "false" ] \|\| [ "…` | `true` | `pr-review-step-rules.test.mjs`: "the review step reads the last result from a stream that Claude Code wrote as an array" |
| 1274 | sh if whole | `[ "$status" -ne 0 ] \|\| [ "$(jq -r '.is_error' <<<"$result")" != "false" ] \|\| [ "…` | `false` | `model-provider.test.mjs`: "pr-review.yml, Run the review: a run that ends in error, or with no result, fails" |
| 1274 | sh if \|\| operand | `[ "$(jq -r '.is_error' <<<"$result")" != "false" ]` | `false` | `model-provider.test.mjs`: "pr-review.yml, Run the review: a run that ends in error, or with no result, fails" |
| 1274 | sh if \|\| operand | `[ "$(jq -r '.subtype' <<<"$result")" != "success" ]` | `false` | `model-provider.test.mjs`: "pr-review.yml, Run the review: a run that ends in error, or with no result, fails" |
| 1288 | if: && operand | `env.RUN != 'false'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1288 | if: whole | `env.RUN != 'false' && env.KIT_REVIEW_RUNNER == 'opencode'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1288 | if: whole | `env.RUN != 'false' && env.KIT_REVIEW_RUNNER == 'opencode'` | `false` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1288 | if: && operand | `env.KIT_REVIEW_RUNNER == 'opencode'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1290 | sh output statement | (before `mv -- .git "$RUNNER_TEMP/checkout-git"`) | `: ` | `review-opencode.test.mjs`: "pr-review.yml: .git leaves the checkout for OpenCode, the server still reads it, and it comes back" |
| 1327 | if: && operand | `env.RUN != 'false'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1327 | if: whole | `env.RUN != 'false' && env.KIT_REVIEW_RUNNER == 'opencode'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1327 | if: whole | `env.RUN != 'false' && env.KIT_REVIEW_RUNNER == 'opencode'` | `false` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1327 | if: && operand | `env.KIT_REVIEW_RUNNER == 'opencode'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1333 | sh if whole | `[ -z "$OPENCODE_API_KEY" ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1333 | sh if whole | `[ -z "$OPENCODE_API_KEY" ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: no key fails before the CLI starts" |
| 1343 | jq if or operand | `. == "Read"` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1343 | jq if whole | `. == "Read" or . == "Grep" or . == "Glob"` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: everything is denied but reads and the review's server tools" |
| 1343 | jq if whole | `. == "Read" or . == "Grep" or . == "Glob"` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1343 | jq if or operand | `. == "Grep"` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1343 | jq if or operand | `. == "Glob"` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1344 | jq elif whole | `startswith("mcp__agent-kit__")` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: everything is denied but reads and the review's server tools" |
| 1344 | jq elif whole | `startswith("mcp__agent-kit__")` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1381 | sh list condition | `oc "$list" models opencode-go --verbose > "$RUNNER_TEMP/opencode-models" \ 2> "$…` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1381 | sh list condition | `oc "$list" models opencode-go --verbose > "$RUNNER_TEMP/opencode-models" \ 2> "$…` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1381 | sh file write | `"$RUNNER_TEMP/opencode-models"` | `/dev/null` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1383 | sh if whole | `[ "$listed" -ne 0 ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1383 | sh if whole | `[ "$listed" -ne 0 ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a model the pinned CLI does not list fails before the run" |
| 1389 | sh if whole | `! jq -e 'type == "object"' >/dev/null 2>&1 <<<"$info"` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1389 | sh if whole | `! jq -e 'type == "object"' >/dev/null 2>&1 <<<"$info"` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a model the pinned CLI does not list fails before the run" |
| 1394 | sh if whole | `[ -n "$KIT_REVIEW_EFFORT" ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1394 | sh if whole | `[ -n "$KIT_REVIEW_EFFORT" ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: an effort level is a variant the model offers" |
| 1395 | sh if whole | `! jq -e --arg v "$KIT_REVIEW_EFFORT" '.variants // {} \| has($v)' >/dev/null <<<"…` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: an effort level is a variant the model offers" |
| 1395 | sh if whole | `! jq -e --arg v "$KIT_REVIEW_EFFORT" '.variants // {} \| has($v)' >/dev/null <<<"…` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: an effort level is a variant the model offers" |
| 1396 | jq if whole | `length == 0` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: an effort level is a variant the model offers" |
| 1396 | jq if whole | `length == 0` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: an effort level is a variant the model offers" |
| 1423 | sh list \|\| operand | `[ -n "${AGENT_KIT_STARTED:-}" ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a carried-on step keeps its start, and a run without GITHUB_ENV writes none" |
| 1423 | sh list whole | `[ -n "${AGENT_KIT_STARTED:-}" ] \|\| [ -z "${GITHUB_ENV:-}" ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1423 | sh list whole | `[ -n "${AGENT_KIT_STARTED:-}" ] \|\| [ -z "${GITHUB_ENV:-}" ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a carried-on step keeps its start, and a run without GITHUB_ENV writes none" |
| 1423 | sh list \|\| operand | `[ -z "${GITHUB_ENV:-}" ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a carried-on step keeps its start, and a run without GITHUB_ENV writes none" |
| 1423 | sh output statement | (before `echo "AGENT_KIT_STARTED=$started" >> "$GITHUB_ENV"`) | `: ` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1425 | sh file write | `"$RESULT"` | `/dev/null` | Not caught, equivalent: the job's RUNNER_TEMP starts empty and no earlier step writes this file, so it starts empty either way |
| 1431 | sh while whole | `:` | `true` | Not caught, equivalent: `while :` and `while true` are the same loop |
| 1431 | sh while whole | `:` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1433 | sh list condition | `oc "$run_config" run --print-logs --format json -m "opencode-go/$KIT_REVIEW_MODE…` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1433 | sh list condition | `oc "$run_config" run --print-logs --format json -m "opencode-go/$KIT_REVIEW_MODE…` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1434 | sh file write | `"$RUNNER_TEMP/opencode-attempt.jsonl"` | `/dev/null` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1436 | sh file write | `"$RUNNER_TEMP/opencode-attempt-events.jsonl"` | `/dev/null` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1437 | sh file write | `"$RESULT"` | `/dev/null` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1440 | jq select whole | `.type == "error"` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the refusal is the attempt's last error, and the last step is its last step_finish" |
| 1440 | jq select whole | `.type == "error"` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1441 | jq select whole | `test("ttft_admission_refused\|at capacity")` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: another error, no session or no steps left end the run" |
| 1441 | jq select whole | `test("ttft_admission_refused\|at capacity")` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1442 | jq if whole | `. > 3600` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1442 | jq if whole | `. > 3600` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the waits grow 60, 120, 180 s, a served step starts the row again, and a named wait is longer or an hour at most" |
| 1445 | jq select whole | `.type == "step_start"` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1445 | jq select whole | `.type == "step_start"` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1446 | sh if \|\| operand | `[ -z "$pause" ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1446 | sh if whole | `[ -z "$pause" ] \|\| [ -z "$session" ] \|\| [ "$left" -le 0 ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1446 | sh if whole | `[ -z "$pause" ] \|\| [ -z "$session" ] \|\| [ "$left" -le 0 ]` | `false` | `review-opencode.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 1446 | sh if \|\| operand | `[ -z "$session" ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: another error, no session or no steps left end the run" |
| 1446 | sh if \|\| operand | `[ "$left" -le 0 ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: another error, no session or no steps left end the run" |
| 1447 | sh skip statement | `break` | `:` | `review-opencode.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 1450 | sh if whole | `[ "$(jq -s 'map(select(.type == "step_finish")) \| length' "$RUNNER_TEMP/opencode…` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the waits grow 60, 120, 180 s, a served step starts the row again, and a named wait is longer or an hour at most" |
| 1450 | sh if whole | `[ "$(jq -s 'map(select(.type == "step_finish")) \| length' "$RUNNER_TEMP/opencode…` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the waits grow 60, 120, 180 s, a served step starts the row again, and a named wait is longer or an hour at most" |
| 1450 | jq select whole | `.type == "step_finish"` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the waits grow 60, 120, 180 s, a served step starts the row again, and a named wait is longer or an hour at most" |
| 1450 | jq select whole | `.type == "step_finish"` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the waits grow 60, 120, 180 s, a served step starts the row again, and a named wait is longer or an hour at most" |
| 1455 | sh list condition | `[ "$pause" -le "$delay" ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the waits grow 60, 120, 180 s, a served step starts the row again, and a named wait is longer or an hour at most" |
| 1455 | sh list condition | `[ "$pause" -le "$delay" ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1457 | sh if whole | `[ "$delay" -gt "$remaining" ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1457 | sh if whole | `[ "$delay" -gt "$remaining" ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1459 | sh skip statement | `break` | `:` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1474 | sh if whole | `[ -z "$events" ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1474 | sh if whole | `[ -z "$events" ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a failed, unfinished or exhausted run fails the step" |
| 1475 | sh if whole | `[ "$closed" = true ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a closed run withholds its errors only when it had some, and a run with no events shows the log" |
| 1475 | sh if whole | `[ "$closed" = true ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run closed on a private name withholds its message and log" |
| 1487 | jq select whole | `.type == "step_start"` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1487 | jq select whole | `.type == "step_start"` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1488 | jq select whole | `.type == "step_finish"` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the refusal is the attempt's last error, and the last step is its last step_finish" |
| 1488 | jq select whole | `.type == "step_finish"` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1489 | jq select whole | `.type == "step_finish"` | `true` | Not a rule: the cost and token counts go only to the run log |
| 1489 | jq select whole | `.type == "step_finish"` | `false` | Not a rule: the cost and token counts go only to the run log |
| 1490 | jq select whole | `.type == "step_finish"` | `true` | Not a rule: the cost and token counts go only to the run log |
| 1490 | jq select whole | `.type == "step_finish"` | `false` | Not a rule: the cost and token counts go only to the run log |
| 1491 | jq select whole | `.type == "step_finish"` | `true` | Not a rule: the cost and token counts go only to the run log |
| 1491 | jq select whole | `.type == "step_finish"` | `false` | Not a rule: the cost and token counts go only to the run log |
| 1492 | jq select whole | `.type == "step_finish"` | `true` | Not a rule: the cost and token counts go only to the run log |
| 1492 | jq select whole | `.type == "step_finish"` | `false` | Not a rule: the cost and token counts go only to the run log |
| 1493 | jq select whole | `.type == "step_finish"` | `true` | Not a rule: the cost and token counts go only to the run log |
| 1493 | jq select whole | `.type == "step_finish"` | `false` | Not a rule: the cost and token counts go only to the run log |
| 1494 | jq select whole | `.type == "step_finish"` | `true` | Not a rule: the cost and token counts go only to the run log |
| 1494 | jq select whole | `.type == "step_finish"` | `false` | Not a rule: the cost and token counts go only to the run log |
| 1495 | jq select whole | `.type == "error"` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1495 | jq select whole | `.type == "error"` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a failed, unfinished or exhausted run fails the step" |
| 1496 | jq select whole | `.type == "text"` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1496 | jq select whole | `.type == "text"` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1498 | sh list condition | `[ "$closed" != true ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run closed on a private name withholds its message and log" |
| 1498 | sh list condition | `[ "$closed" != true ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1498 | jq if whole | `.errors == ""` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a closed run withholds its errors only when it had some, and a run with no events shows the log" |
| 1498 | jq if whole | `.errors == ""` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a closed run withholds its errors only when it had some, and a run with no events shows the log" |
| 1505 | sh if whole | `[ "$closed" = true ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1505 | sh if whole | `[ "$closed" = true ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run closed on a private name withholds its message and log" |
| 1509 | sh if \|\| operand | `[ "$status" -ne 0 ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a failed, unfinished or exhausted run fails the step" |
| 1509 | sh if whole | `[ "$status" -ne 0 ] \|\| [ -n "$(jq -r '.errors' <<<"$summary")" ] \|\| [ "$(jq -r '…` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1509 | sh if whole | `[ "$status" -ne 0 ] \|\| [ -n "$(jq -r '.errors' <<<"$summary")" ] \|\| [ "$(jq -r '…` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a failed, unfinished or exhausted run fails the step" |
| 1509 | sh if \|\| operand | `[ -n "$(jq -r '.errors' <<<"$summary")" ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a failed, unfinished or exhausted run fails the step" |
| 1509 | sh if \|\| operand | `[ "$(jq -r '.reason' <<<"$summary")" != "stop" ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a failed, unfinished or exhausted run fails the step" |
| 1522 | sh if whole | `[ "$(jq -r '.steps' <<<"$summary")" -ge "$KIT_REVIEW_MAX_TURNS" ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1522 | sh if whole | `[ "$(jq -r '.steps' <<<"$summary")" -ge "$KIT_REVIEW_MAX_TURNS" ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a failed, unfinished or exhausted run fails the step" |
| 1529 | if: && operand | `always()` | `true` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1529 | if: whole | `always() && env.KIT_REVIEW_RUNNER == 'opencode'` | `true` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1529 | if: whole | `always() && env.KIT_REVIEW_RUNNER == 'opencode'` | `false` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1529 | if: && operand | `env.KIT_REVIEW_RUNNER == 'opencode'` | `true` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1531 | sh if && operand | `[ -d "$RUNNER_TEMP/checkout-git" ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml: .git comes back only when it was moved out and nothing took its place" |
| 1531 | sh if whole | `[ -d "$RUNNER_TEMP/checkout-git" ] && [ ! -e .git ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml: .git leaves the checkout for OpenCode, the server still reads it, and it comes back" |
| 1531 | sh if whole | `[ -d "$RUNNER_TEMP/checkout-git" ] && [ ! -e .git ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml: .git leaves the checkout for OpenCode, the server still reads it, and it comes back" |
| 1531 | sh if && operand | `[ ! -e .git ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml: .git comes back only when it was moved out and nothing took its place" |
| 1532 | sh output statement | (before `mv -- "$RUNNER_TEMP/checkout-git" .git`) | `: ` | `review-opencode.test.mjs`: "pr-review.yml: .git leaves the checkout for OpenCode, the server still reads it, and it comes back" |
| 1535 | if: whole | `always()` | `true` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1535 | if: whole | `always()` | `false` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1536 | sh output statement | (before `rm -f -- "$RUNNER_TEMP/gh-token" "$RUNNER_TEMP/private-repo-`) | `: ` | `pr-review-step-rules.test.mjs`: "the token file and the private names are removed after the run" |
| 1544 | if: whole | `env.RUN != 'false'` | `true` | `pr-review-conditions.test.mjs`: "every review step after the skips runs unless a skip set RUN to false" |
| 1544 | if: whole | `env.RUN != 'false'` | `false` | `pr-review-conditions.test.mjs`: "every review step after the skips runs unless a skip set RUN to false" |
| 1555 | jq select and operand | `.user.login == \"github-actions[bot]\"` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: the report check passes a report whose reviewed lines match the pull request" |
| 1555 | jq select whole | `.user.login == \"github-actions[bot]\" and (.body \| contains(\"<!-- pr-review ru…` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: the report check passes a report whose reviewed lines match the pull request" |
| 1555 | jq select whole | `.user.login == \"github-actions[bot]\" and (.body \| contains(\"<!-- pr-review ru…` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: the report check passes a report whose reviewed lines match the pull request" |
| 1555 | jq select and operand | `(.body \| contains(\"<!-- pr-review run $GITHUB_RUN_ID.$GITHUB_RUN_ATTEMPT -->\")…` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: the run fails when it posted no report" |
| 1555 | jq select and operand | `(.body \| contains(\"## Review R\"))` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: the run fails when it posted no report" |
| 1561 | sh if && operand | `[ -z "$reports" ]` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: a report with this run's marker counts whatever the server, and the current server allows no fallback" |
| 1561 | sh if whole | `[ -z "$reports" ] && ! grep -q 'GITHUB_RUN_ATTEMPT' /opt/agent-kit/mcp-server.mj…` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: the report check passes a report whose reviewed lines match the pull request" |
| 1561 | sh if whole | `[ -z "$reports" ] && ! grep -q 'GITHUB_RUN_ATTEMPT' /opt/agent-kit/mcp-server.mj…` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: with a base server that writes no marker, the report is the bot's first one after the start" |
| 1561 | sh if && operand | `! grep -q 'GITHUB_RUN_ATTEMPT' /opt/agent-kit/mcp-server.mjs` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: a report with this run's marker counts whatever the server, and the current server allows no fallback" |
| 1567 | sh list condition | `grep -q 'pr-review run' /opt/agent-kit/mcp-server.mjs` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: with a base server that writes the run id alone, the report must carry it" |
| 1567 | sh list condition | `grep -q 'pr-review run' /opt/agent-kit/mcp-server.mjs` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: with a base server that writes no marker, the report is the bot's first one after the start" |
| 1569 | jq select and operand | `.id > $LAST_COMMENT_ID` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: with a base server that writes no marker, the report is the bot's first one after the start" |
| 1569 | jq select whole | `.id > $LAST_COMMENT_ID and .created_at >= \"$STARTED\" and .user.login == \"gith…` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: with a base server that writes no marker, the report is the bot's first one after the start" |
| 1569 | jq select whole | `.id > $LAST_COMMENT_ID and .created_at >= \"$STARTED\" and .user.login == \"gith…` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: with a base server that writes no marker, the report is the bot's first one after the start" |
| 1569 | jq select and operand | `.created_at >= \"$STARTED\"` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: with a base server that writes no marker, the report is the bot's first one after the start" |
| 1569 | jq select and operand | `.user.login == \"github-actions[bot]\"` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: with a base server that writes no marker, the report is the bot's first one after the start" |
| 1569 | jq select and operand | `(.body \| contains(\"## Review R\"))` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: with a base server that writes no marker, the report is the bot's first one after the start" |
| 1569 | jq select and operand | `$legacy` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: with a base server that writes the run id alone, the report must carry it" |
| 1570 | sh list condition | `[ -z "$reports" ]` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: with a base server that writes no marker, the report is the bot's first one after the start" |
| 1570 | sh list condition | `[ -z "$reports" ]` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: with a base server that writes no marker, the report is the bot's first one after the start" |
| 1572 | sh if whole | `[ -z "$reports" ]` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: the report check passes a report whose reviewed lines match the pull request" |
| 1572 | sh if whole | `[ -z "$reports" ]` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: the run fails when it posted no report" |
| 1584 | sh if \|\| operand | `[ "$closes" -ne 1 ]` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: the run fails on a missing, doubled or malformed reviewed line" |
| 1584 | sh if whole | `[ "$closes" -ne 1 ] \|\| [ "$bases" -ne 1 ] \|\| [ "$titles" -ne 1 ] \|\| [ "$heads" -…` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: the report check passes a report whose reviewed lines match the pull request" |
| 1584 | sh if whole | `[ "$closes" -ne 1 ] \|\| [ "$bases" -ne 1 ] \|\| [ "$titles" -ne 1 ] \|\| [ "$heads" -…` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: the run fails on a missing, doubled or malformed reviewed line" |
| 1584 | sh if \|\| operand | `[ "$bases" -ne 1 ]` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: the run fails on a missing, doubled or malformed reviewed line" |
| 1584 | sh if \|\| operand | `[ "$titles" -ne 1 ]` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: a doubled title line fails the report check too" |
| 1584 | sh if \|\| operand | `[ "$heads" -ne 1 ]` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: the run fails on a missing, doubled or malformed reviewed line" |
| 1601 | sh if && operand | `[ "$got_base_sha" != "$base_now" ]` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: an unmoved base is compared without asking for merge bases" |
| 1601 | sh if whole | `[ "$got_base_sha" != "$base_now" ] && [ "$got_base_sha" != "" ]` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: an unmoved base is compared without asking for merge bases" |
| 1601 | sh if whole | `[ "$got_base_sha" != "$base_now" ] && [ "$got_base_sha" != "" ]` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: a base commit that moved is accepted only when the merge base did not" |
| 1601 | sh if && operand | `[ "$got_base_sha" != "" ]` | `true` | Not caught, unreachable: the line check above already requires a 40-character SHA on the Base reviewed line |
| 1604 | sh if whole | `[ "$mb_reviewed" = "$mb_now" ]` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: a base commit that moved is accepted only when the merge base did not" |
| 1604 | sh if whole | `[ "$mb_reviewed" = "$mb_now" ]` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: a base commit that moved is accepted only when the merge base did not" |
| 1622 | sh if \|\| operand | `[ "$got_closes" != "$want_closes" ]` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: the run fails when the reviewed lines do not describe the pull request" |
| 1622 | sh if whole | `[ "$got_closes" != "$want_closes" ] \|\| [ "$got_base" != "$want_base" ] \|\| [ "$go…` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: the report check passes a report whose reviewed lines match the pull request" |
| 1622 | sh if whole | `[ "$got_closes" != "$want_closes" ] \|\| [ "$got_base" != "$want_base" ] \|\| [ "$go…` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: the run fails when the reviewed lines do not describe the pull request" |
| 1622 | sh if \|\| operand | `[ "$got_base" != "$want_base" ]` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: the run fails when the reviewed lines do not describe the pull request" |
| 1622 | sh if \|\| operand | `[ "$got_title" != "$want_title" ]` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: the run fails when the reviewed lines do not describe the pull request" |
| 1622 | sh if \|\| operand | `[ "$got_head" != "$want_head" ]` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: the run fails when the reviewed lines do not describe the pull request" |
| 1638 | if: whole | `env.RUN != 'false'` | `true` | `pr-review-conditions.test.mjs`: "every review step after the skips runs unless a skip set RUN to false" |
| 1638 | if: whole | `env.RUN != 'false'` | `false` | `pr-review-conditions.test.mjs`: "every review step after the skips runs unless a skip set RUN to false" |
| 1649 | jq select and operand | `.user.login == "github-actions[bot]"` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: the verdict comes from the bot's report, not a comment with its marker" |
| 1649 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| contains("## Review R"))` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: the verdict comes from the bot's report, not a comment with its marker" |
| 1649 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| contains("## Review R"))` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: the verdict check passes only on No blocking findings" |
| 1649 | jq select and operand | `(.body \| contains("## Review R"))` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: the verdict is this run's report, not a later one or a bot comment that is no report" |
| 1662 | sh while whole | `IFS= read -r line` | `true` | `pr-review-steps.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 1662 | sh while whole | `IFS= read -r line` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: the verdict check passes only on No blocking findings" |
| 1663 | sh list condition | `[ -n "$line" ]` | `true` | Not caught, equivalent: an empty line comes only from an empty listing, which leaves no report either way |
| 1663 | sh list condition | `[ -n "$line" ]` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: the verdict check passes only on No blocking findings" |
| 1666 | sh if whole | `grep -qF "<!-- pr-review run $GITHUB_RUN_ID.$GITHUB_RUN_ATTEMPT -->" <<<"$body"` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: the verdict is the report's first heading, and a bare addendum keeps the last one" |
| 1666 | sh if whole | `grep -qF "<!-- pr-review run $GITHUB_RUN_ID.$GITHUB_RUN_ATTEMPT -->" <<<"$body"` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: the verdict is this run's report, not a later one or a bot comment that is no report" |
| 1669 | sh skip statement | `break` | `:` | `pr-review-steps.test.mjs`: "pr-review.yml: the verdict is this run's report, not a later one or a bot comment that is no report" |
| 1676 | sh if whole | `[ -n "$(stated "$top")" ]` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: a bare addendum keeps only a stated verdict, through earlier bare addenda" |
| 1676 | sh if whole | `[ -n "$(stated "$top")" ]` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: the verdict is the report's first heading, and a bare addendum keeps the last one" |
| 1679 | sh elif whole | `! bare "$top"` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: a bare addendum keeps only a stated verdict, through earlier bare addenda" |
| 1679 | sh elif whole | `! bare "$top"` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: a bare addendum keeps only a stated verdict, through earlier bare addenda" |
| 1685 | sh if whole | `[ -n "$(stated "$top")" ]` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: the verdict check passes only on No blocking findings" |
| 1685 | sh if whole | `[ -n "$(stated "$top")" ]` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: the verdict check passes only on No blocking findings" |
| 1688 | sh elif whole | `bare "$top"` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: the verdict is the report's first heading, and a bare addendum keeps the last one" |
| 1688 | sh elif whole | `bare "$top"` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: the verdict is the report's first heading, and a bare addendum keeps the last one" |
| 1692 | sh case arm | `"No blocking findings"` | `__mutant_never__` | `pr-review-steps.test.mjs`: "pr-review.yml: the verdict check passes only on No blocking findings" |
| 1693 | sh case arm | `"Changes required"` | `__mutant_never__` | `pr-review-steps.test.mjs`: "pr-review.yml: the verdict check passes only on No blocking findings" |
| 1694 | sh case arm | `*` | `__mutant_never__` | `pr-review-steps.test.mjs`: "pr-review.yml: the verdict check passes only on No blocking findings" |
| 1697 | sh list condition | `[ -z "$url" ]` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: the verdict is this run's report, not a later one or a bot comment that is no report" |
| 1697 | sh list condition | `[ -z "$url" ]` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: a verdict with no report of this run links no report" |
| 1701 | sh output statement | (before `gh api -X PATCH "repos/$REPO/check-runs/$VERDICT_CHECK_ID" -`) | `: ` | `pr-review-steps.test.mjs`: "pr-review.yml: the verdict check passes only on No blocking findings" |
| 1706 | if: && operand | `(failure() \|\| cancelled())` | `true` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1706 | if: whole | `(failure() \|\| cancelled()) && env.VERDICT_CHECK_ID != ''` | `true` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1706 | if: whole | `(failure() \|\| cancelled()) && env.VERDICT_CHECK_ID != ''` | `false` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1706 | if: \|\| operand | `failure()` | `false` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1706 | if: \|\| operand | `cancelled()` | `false` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1706 | if: && operand | `env.VERDICT_CHECK_ID != ''` | `true` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1714 | sh output statement | (before `gh api -X PATCH "repos/$REPO/check-runs/$VERDICT_CHECK_ID" -`) | `: ` | `pr-review-step-rules.test.mjs`: "a review that did not finish completes its pending verdict as action_required" |
| 1725 | if: && operand | `failure()` | `true` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1725 | if: whole | `failure() && env.VERDICT_CHECK_ID == '' && env.RUN != 'false'` | `true` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1725 | if: whole | `failure() && env.VERDICT_CHECK_ID == '' && env.RUN != 'false'` | `false` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1725 | if: && operand | `env.VERDICT_CHECK_ID == ''` | `true` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1725 | if: && operand | `env.RUN != 'false'` | `true` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1734 | sh if whole | `[ -n "$head" ]` | `true` | `pr-review-no-verdict.test.mjs`: "a dispatch that checked its head out records on that head, without reading the pull request" |
| 1734 | sh if whole | `[ -n "$head" ]` | `false` | `pr-review-no-verdict.test.mjs`: "an event by writers records no verdict on the event's head" |
| 1740 | sh case arm | `*'[bot]'` | `__mutant_never__` | `pr-review-no-verdict.test.mjs`: "an event on a bot's pull request keeps the verdict without a lookup" |
| 1740 | sh skip statement | `exit 0` | `:` | `pr-review-no-verdict.test.mjs`: "an event on a bot's pull request keeps the verdict without a lookup" |
| 1744 | sh case arm | `admin\|write` | `__mutant_never__` | `pr-review-no-verdict.test.mjs`: "an event by writers records no verdict on the event's head" |
| 1745 | sh case arm | `*` | `__mutant_never__` | `pr-review-no-verdict.test.mjs`: "an event by an actor without write access keeps the verdict" |
| 1745 | sh skip statement | `exit 0` | `:` | `pr-review-no-verdict.test.mjs`: "an event by an actor without write access keeps the verdict" |
| 1748 | sh elif whole | `[ -n "${HEAD_SHA:-}" ]` | `true` | `pr-review-no-verdict.test.mjs`: "a dispatch that failed before its checkout records on the pull request's head" |
| 1748 | sh elif whole | `[ -n "${HEAD_SHA:-}" ]` | `false` | `pr-review-no-verdict.test.mjs`: "a dispatch that checked its head out records on that head, without reading the pull request" |
| 1757 | sh case arm | `''\|*[!0-9]*` | `__mutant_never__` | `pr-review-no-verdict.test.mjs`: "a dispatch whose pr input is not a number records nothing and calls nothing" |
| 1757 | sh skip statement | `exit 0` | `:` | `pr-review-no-verdict.test.mjs`: "a dispatch whose pr input is not a number records nothing and calls nothing" |
| 1759 | sh if whole | `! pr=$(gh pr view "$PR" -R "$REPO" --json headRefOid,isCrossRepository)` | `true` | `pr-review-no-verdict.test.mjs`: "a dispatch that failed before its checkout records on the pull request's head" |
| 1759 | sh if whole | `! pr=$(gh pr view "$PR" -R "$REPO" --json headRefOid,isCrossRepository)` | `false` | `pr-review-no-verdict.test.mjs`: "a dispatch that failed before its checkout records on the pull request's head" |
| 1761 | sh skip statement | `exit 0` | `:` | Not caught, equivalent: with the pull request unread, the fork check below also records nothing |
| 1763 | sh if whole | `[ "$(jq -r .isCrossRepository <<<"$pr")" != "false" ]` | `true` | `pr-review-no-verdict.test.mjs`: "a dispatch that failed before its checkout records on the pull request's head" |
| 1763 | sh if whole | `[ "$(jq -r .isCrossRepository <<<"$pr")" != "false" ]` | `false` | `pr-review-no-verdict.test.mjs`: "a dispatch for a fork's pull request records nothing" |
| 1765 | sh skip statement | `exit 0` | `:` | `pr-review-no-verdict.test.mjs`: "a dispatch for a fork's pull request records nothing" |
| 1772 | sh output statement | (before `gh api -X POST "repos/$REPO/check-runs" --input - --jq '"rec`) | `: ` | `pr-review-no-verdict.test.mjs`: "an event by writers records no verdict on the event's head" |

</details>

### `.github/scripts/mcp-server.mjs`

606 rules: 580 caught (7 of them by a time limit), 26 left with the reason given.

<details><summary>Every rule of <code>.github/scripts/mcp-server.mjs</code></summary>

| Line | Kind | Rule | Switched off as | Caught by, or why not |
| --- | --- | --- | --- | --- |
| 22 | js if test | `env.GH_TOKEN_FILE` | `true` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 22 | js if test | `env.GH_TOKEN_FILE` | `false` | `mcp-server-rules.test.mjs`: "the server reads the job token from GH_TOKEN_FILE and gives it to gh" |
| 31 | js && operand (expression) | `typeof s === "string"` | `true` | Not caught, equivalent: digits() reads only environment values, a string or undefined, and the pattern refuses undefined too |
| 31 | js && operand (expression) | `/^[0-9]+$/.test(s)` | `true` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 33 | js && operand (expression) | `typeof s === "string"` | `true` | Not caught, equivalent: repoName() reads only GITHUB_REPOSITORY, a string or undefined, and the pattern refuses undefined too |
| 34 | js && operand (expression) | `/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(s)` | `true` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 35 | js && operand (expression) | `!s.split("/").some((part) => /^\.+$/.test(part))` | `true` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 35 | js callback test | `/^\.+$/.test(part)` | `true` | `mcp-server-rules.test.mjs`: "the server reads the job token from GH_TOKEN_FILE and gives it to gh" |
| 35 | js callback test | `/^\.+$/.test(part)` | `false` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 39 | js && operand (expression) | `typeof s === "string"` | `true` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 40 | js \|\| operand (expression) | `s === 'origin/${env.BASE}'` | `false` | `mcp-server-rules.test.mjs`: "the git tools take the fetched base whatever its name, and a plain range" |
| 40 | js && operand (expression) | `s === 'origin/${env.BASE}' \|\| (/^[A-Za-z0-9_./:-]+$/.test(s) && !s.startsWith("-…` | `true` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 41 | js && operand (expression) | `/^[A-Za-z0-9_./:-]+$/.test(s)` | `true` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 41 | js \|\| operand (expression) | `/^[A-Za-z0-9_./:-]+$/.test(s) && !s.startsWith("-") && !s.includes("..")` | `false` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 41 | js && operand (expression) | `!s.startsWith("-")` | `true` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 41 | js && operand (expression) | `!s.includes("..")` | `true` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 44 | js if test | `typeof s !== "string"` | `true` | `mcp-server-rules.test.mjs`: "the git tools take the fetched base whatever its name, and a plain range" |
| 44 | js if test | `typeof s !== "string"` | `false` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 49 | js && operand (expression) | `typeof s === "string"` | `true` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 50 | js && operand (expression) | `s.length > 0` | `true` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 51 | js && operand (expression) | `!s.startsWith("-")` | `true` | `mcp-server.test.mjs`: "inline_comment checks its arguments and posts on the reviewed head" |
| 52 | js && operand (expression) | `!s.startsWith("/")` | `true` | `mcp-server.test.mjs`: "diff and show refuse paths and refs that could reach outside the checkout" |
| 53 | js && operand (expression) | `!s.split("/").includes("..")` | `true` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 54 | js && operand (expression) | `!s.startsWith(".git/")` | `true` | `mcp-server.test.mjs`: "inline_comment checks its arguments and posts on the reviewed head" |
| 55 | js && operand (expression) | `s !== ".git"` | `true` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 84 | js ternary test | `path.includes("?")` | `true` | `mcp-server-rules.test.mjs`: "a listing reads only the pages it needs and starts at 0 for a start it cannot use" |
| 84 | js ternary test | `path.includes("?")` | `false` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 94 | js && operand (ternary) | `Number.isInteger(start)` | `true` | `mcp-server-rules.test.mjs`: "a listing reads only the pages it needs and starts at 0 for a start it cannot use" |
| 94 | js ternary test | `Number.isInteger(start) && start >= 0` | `true` | `mcp-server-rules.test.mjs`: "a listing reads only the pages it needs and starts at 0 for a start it cannot use" |
| 94 | js ternary test | `Number.isInteger(start) && start >= 0` | `false` | `mcp-server-rules.test.mjs`: "a listing reads only the pages it needs and starts at 0 for a start it cannot use" |
| 94 | js && operand (ternary) | `start >= 0` | `true` | `mcp-server-rules.test.mjs`: "a listing reads only the pages it needs and starts at 0 for a start it cannot use" |
| 99 | js while test | `more` | `true` | `mcp-server-rules.test.mjs`: "a listing reads only the pages it needs and starts at 0 for a start it cannot use" |
| 99 | js while test | `more` | `false` | `mcp-server-rules.test.mjs`: "a listing reads only the pages it needs and starts at 0 for a start it cannot use" |
| 103 | js if test | `slice.length === 0` | `true` | `mcp-server-rules.test.mjs`: "a listing reads only the pages it needs and starts at 0 for a start it cannot use" |
| 103 | js if test | `slice.length === 0` | `false` | Not caught, equivalent: a page's slice is empty only when the API page is, which already ends the loop |
| 112 | js if test | `size + cost > LIMIT` | `true` | `mcp-server-rules.test.mjs`: "a listing reads only the pages it needs and starts at 0 for a start it cannot use" |
| 112 | js if test | `size + cost > LIMIT` | `false` | `mcp-server-rules.test.mjs`: "a listing cuts a body too long for a page of its own, and names the tool that reads it whole" |
| 113 | js if test | `items.length > 0` | `true` | `mcp-server-rules.test.mjs`: "a listing never cuts what is not a text body" |
| 113 | js if test | `items.length > 0` | `false` | `mcp-server-rules.test.mjs`: "a listing cuts a body too long for a page of its own, and names the tool that reads it whole" |
| 114 | js if test | `typeof item.body === "string"` | `true` | `mcp-server-rules.test.mjs`: "a listing never cuts what is not a text body" |
| 114 | js if test | `typeof item.body === "string"` | `false` | `mcp-server-rules.test.mjs`: "a listing cuts a body too long for a page of its own, and names the tool that reads it whole" |
| 115 | js ternary test | `item.id` | `true` | Not caught, unreachable: every listing that carries a body (comments, inline comments, reviews) carries the item's id |
| 115 | js ternary test | `item.id` | `false` | `mcp-server-rules.test.mjs`: "a listing cuts a body too long for a page of its own, and names the tool that reads it whole" |
| 116 | js ternary test | `item.state !== undefined` | `true` | `mcp-server-rules.test.mjs`: "a listing cuts a body too long for a page of its own, and names the tool that reads it whole" |
| 116 | js ternary test | `item.state !== undefined` | `false` | `mcp-server-rules.test.mjs`: "a listing cuts a body too long for a page of its own, and names the tool that reads it whole" |
| 128 | js ternary test | `more` | `true` | `mcp-server-rules.test.mjs`: "a listing reads only the pages it needs and starts at 0 for a start it cannot use" |
| 128 | js ternary test | `more` | `false` | Not caught, equivalent: the loop ends only with more false or an empty page, so next_start is null either way |
| 141 | js \|\| operand (if) | `!Number.isInteger(id)` | `false` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 141 | js if test | `!Number.isInteger(id) \|\| id <= 0` | `true` | `review-screen.test.mjs`: "comment_body withholds a body whole" |
| 141 | js if test | `!Number.isInteger(id) \|\| id <= 0` | `false` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 141 | js \|\| operand (if) | `id <= 0` | `false` | `mcp-server-refusals.test.mjs`: "the review's tools refuse bad arguments and spent limits, and write nothing" |
| 143 | js if test | `!ofThisRepo(c)` | `true` | `review-screen.test.mjs`: "comment_body withholds a body whole" |
| 143 | js if test | `!ofThisRepo(c)` | `false` | `review-screen.test.mjs`: "the review's issue tools refuse an issue transferred to another repository" |
| 153 | js ternary test | `reason` | `true` | `review-screen.test.mjs`: "comment_body withholds a body whole" |
| 153 | js ternary test | `reason` | `false` | `review-screen.test.mjs`: "comment_body withholds a body whole" |
| 175 | js ternary test | `typeof value === "string"` | `true` | `mcp-server-rules.test.mjs`: "a listing reads only the pages it needs and starts at 0 for a start it cannot use" |
| 175 | js ternary test | `typeof value === "string"` | `false` | `mcp-server-rules.test.mjs`: "the git tools take the fetched base whatever its name, and a plain range" |
| 176 | js if test | `s.length > LIMIT` | `true` | `mcp-server-rules.test.mjs`: "the git tools take the fetched base whatever its name, and a plain range" |
| 176 | js if test | `s.length > LIMIT` | `false` | `mcp-server-rules.test.mjs`: "a listing never cuts what is not a text body" |
| 178 | js && operand (ternary) | `Number.isInteger(page)` | `true` | `mcp-server-rules.test.mjs`: "a long text is served from page 1 for a page it cannot use" |
| 178 | js ternary test | `Number.isInteger(page) && page > 0` | `true` | `mcp-server-rules.test.mjs`: "a listing never cuts what is not a text body" |
| 178 | js ternary test | `Number.isInteger(page) && page > 0` | `false` | `mcp-server-rules.test.mjs`: "a long text is served from page 1 for a page it cannot use" |
| 178 | js && operand (ternary) | `page > 0` | `true` | `mcp-server-rules.test.mjs`: "a long text is served from page 1 for a page it cannot use" |
| 179 | js ternary test | `p < pages` | `true` | `mcp-server-rules.test.mjs`: "a long text is served from page 1 for a page it cannot use" |
| 179 | js ternary test | `p < pages` | `false` | `mcp-server-rules.test.mjs`: "a long text is served from page 1 for a page it cannot use" |
| 198 | js && operand (if) | `env.STATE_FILE` | `true` | Not caught, equivalent: fs.existsSync(undefined) is false, so an unset STATE_FILE is never read |
| 198 | js if test | `env.STATE_FILE && fs.existsSync(env.STATE_FILE)` | `true` | `mcp-server-rules.test.mjs`: "the server reads the job token from GH_TOKEN_FILE and gives it to gh" |
| 198 | js if test | `env.STATE_FILE && fs.existsSync(env.STATE_FILE)` | `false` | `mcp-server.test.mjs`: "with STATE_FILE, a carried-on run's new server keeps the run's report and inline limits" |
| 198 | js && operand (if) | `fs.existsSync(env.STATE_FILE)` | `true` | `mcp-server.test.mjs`: "with STATE_FILE, a carried-on run's new server keeps the run's report and inline limits" |
| 202 | js if test | `env.STATE_FILE` | `true` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 202 | js if test | `env.STATE_FILE` | `false` | `mcp-server.test.mjs`: "with STATE_FILE, a carried-on run's new server keeps the run's report and inline limits" |
| 202 | js output statement | `fs.writeFileSync(env.STATE_FILE, JSON.stringify(runState) + "\n");` | `void 0;` | `mcp-server.test.mjs`: "with STATE_FILE, a carried-on run's new server keeps the run's report and inline limits" |
| 220 | js ternary test | `env.PRIVATE_REPO_NAMES_FILE` | `true` | `mcp-server-rules.test.mjs`: "the server reads the job token from GH_TOKEN_FILE and gives it to gh" |
| 220 | js ternary test | `env.PRIVATE_REPO_NAMES_FILE` | `false` | `public-content-guard.test.mjs`: "a bare private name is refused only when PRIVATE_REPO_NAMES reaches the check" |
| 242 | js if test | `!check` | `true` | `public-content-guard.test.mjs`: "post_report is refused, unposted, while the check finds something, and posts once reworded" |
| 242 | js if test | `!check` | `false` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 243 | js if test | `runState.closed` | `true` | `mcp-server-rules.test.mjs`: "with no private names configured, the public-content check gets no PRIVATE_REPO_NAMES at all, and no text is left on disk" |
| 243 | js if test | `runState.closed` | `false` | `public-content-guard.test.mjs`: "a private name says nothing of where it was and closes the run's posts, across a new server" |
| 249 | js if test | `!fs.existsSync(check)` | `true` | `mcp-server-rules.test.mjs`: "with no private names configured, the public-content check gets no PRIVATE_REPO_NAMES at all, and no text is left on disk" |
| 249 | js if test | `!fs.existsSync(check)` | `false` | `public-content-guard.test.mjs`: "a configured check that cannot run refuses every post" |
| 259 | js ternary test | `value.includes("\u200b")` | `true` | Not caught, equivalent: a text without zero-width spaces would be checked twice as itself, and the two findings merge |
| 259 | js ternary test | `value.includes("\u200b")` | `false` | `public-content-guard.test.mjs`: "zero-width spaces neither hide a detail from the check nor join one into allowed text" |
| 268 | js output statement | `fs.writeFileSync(file, value, { mode: 0o600 });` | `void 0;` | `public-content-guard.test.mjs`: "post_report is refused, unposted, while the check finds something, and posts once reworded" |
| 271 | js ternary test | `python` | `true` | `mcp-server-rules.test.mjs`: "with no private names configured, the public-content check gets no PRIVATE_REPO_NAMES at all, and no text is left on disk" |
| 271 | js ternary test | `python` | `false` | `public-content-guard.test.mjs`: "a Python check runs with python3 -I" |
| 272 | js ternary test | `python` | `true` | `mcp-server-rules.test.mjs`: "with no private names configured, the public-content check gets no PRIVATE_REPO_NAMES at all, and no text is left on disk" |
| 272 | js ternary test | `python` | `false` | `public-content-guard.test.mjs`: "a Python check runs with python3 -I" |
| 280 | js ternary test | `privateRepoNames` | `true` | `mcp-server-rules.test.mjs`: "with no private names configured, the public-content check gets no PRIVATE_REPO_NAMES at all, and no text is left on disk" |
| 280 | js ternary test | `privateRepoNames` | `false` | `public-content-guard.test.mjs`: "a bare private name is refused only when PRIVATE_REPO_NAMES reaches the check" |
| 284 | js if test | `r.status === 0` | `true` | `public-content-guard.test.mjs`: "post_report is refused, unposted, while the check finds something, and posts once reworded" |
| 284 | js if test | `r.status === 0` | `false` | `mcp-server-rules.test.mjs`: "with no private names configured, the public-content check gets no PRIVATE_REPO_NAMES at all, and no text is left on disk" |
| 285 | js if test | `r.status !== 1` | `true` | `public-content-guard.test.mjs`: "post_report is refused, unposted, while the check finds something, and posts once reworded" |
| 285 | js if test | `r.status !== 1` | `false` | `public-content-guard.test.mjs`: "a configured check that cannot run refuses every post" |
| 286 | js ternary test | `r.error` | `true` | `public-content-guard.test.mjs`: "a configured check that cannot run refuses every post" |
| 286 | js ternary test | `r.error` | `false` | Not a rule: the wording of the reason in the could-not-run message; the post is refused either way |
| 293 | js if test | `hits.length === 0` | `true` | `public-content-guard.test.mjs`: "post_report is refused, unposted, while the check finds something, and posts once reworded" |
| 293 | js if test | `hits.length === 0` | `false` | `public-content-guard.test.mjs`: "an exit 1 without a line the check names, and a long list of findings" |
| 294 | js if test | `hits.some(([, , kind]) => kind === PRIVATE_NAME)` | `true` | `public-content-guard.test.mjs`: "post_report is refused, unposted, while the check finds something, and posts once reworded" |
| 294 | js if test | `hits.some(([, , kind]) => kind === PRIVATE_NAME)` | `false` | `public-content-guard.test.mjs`: "a bare private name is refused only when PRIVATE_REPO_NAMES reaches the check" |
| 294 | js callback test | `kind === PRIVATE_NAME` | `true` | `public-content-guard.test.mjs`: "post_report is refused, unposted, while the check finds something, and posts once reworded" |
| 294 | js callback test | `kind === PRIVATE_NAME` | `false` | `public-content-guard.test.mjs`: "a bare private name is refused only when PRIVATE_REPO_NAMES reaches the check" |
| 295 | js output statement | `record({ closed: true });` | `void 0;` | `public-content-guard.test.mjs`: "a private name says nothing of where it was and closes the run's posts, across a new server" |
| 303 | js ternary test | `CONTENT_KINDS.has(kind)` | `true` | `public-content-guard.test.mjs`: "the check's own output never reaches the model, and it gets no token" |
| 303 | js ternary test | `CONTENT_KINDS.has(kind)` | `false` | `public-content-guard.test.mjs`: "post_report is refused, unposted, while the check finds something, and posts once reworded" |
| 306 | js if test | `found.length === 0` | `true` | `public-content-guard.test.mjs`: "post_report is refused, unposted, while the check finds something, and posts once reworded" |
| 306 | js if test | `found.length === 0` | `false` | `mcp-server-rules.test.mjs`: "with no private names configured, the public-content check gets no PRIVATE_REPO_NAMES at all, and no text is left on disk" |
| 310 | js ternary test | `found.length > CONTENT_SHOWN` | `true` | Not a rule: the wording of the refusal (an "and 0 more" tail); the post is refused either way |
| 310 | js ternary test | `found.length > CONTENT_SHOWN` | `false` | `public-content-guard.test.mjs`: "an exit 1 without a line the check names, and a long list of findings" |
| 316 | js output statement | `fs.rmSync(dir, { recursive: true, force: true });` | `void 0;` | `mcp-server-rules.test.mjs`: "with no private names configured, the public-content check gets no PRIVATE_REPO_NAMES at all, and no text is left on disk" |
| 336 | js callback test | `m[1] === '${repo}#${pr}'` | `true` | `file-issue.test.mjs`: "file_issue reads the filed issues once a run and matches only this pull request's" |
| 336 | js callback test | `m[1] === '${repo}#${pr}'` | `false` | `mcp-server-rules.test.mjs`: "file_issue finds an earlier issue for the finding on any page, not in a pull request, and names the first listed" |
| 367 | js for test | `prev !== out` | `true` | `mcp-server-rules.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 367 | js for test | `prev !== out` | `false` | `file-issue.test.mjs`: "file_issue keeps the reviewer's text from forging headings or another finding's marker" |
| 393 | js ternary test | `references` | `true` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 393 | js ternary test | `references` | `false` | `file-issue.test.mjs`: "file_issue keeps the reviewer's text from forging headings or another finding's marker" |
| 394 | js ternary test | `out_of_scope` | `true` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 394 | js ternary test | `out_of_scope` | `false` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 419 | js if test | `p.state !== "open"` | `true` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 419 | js if test | `p.state !== "open"` | `false` | `mcp-server.test.mjs`: "post_report and inline_comment refuse when the pull request was closed" |
| 420 | js ternary test | `p.merged` | `true` | `mcp-server.test.mjs`: "post_report and inline_comment refuse when the pull request was closed" |
| 420 | js ternary test | `p.merged` | `false` | `mcp-server.test.mjs`: "post_report and inline_comment refuse when the pull request was merged" |
| 421 | js if test | `p.draft` | `true` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 421 | js if test | `p.draft` | `false` | `mcp-server.test.mjs`: "post_report and inline_comment refuse when the pull request was back in draft" |
| 423 | js if test | `p.base.ref !== env.BASE` | `true` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 423 | js if test | `p.base.ref !== env.BASE` | `false` | `mcp-server.test.mjs`: "post_report and inline_comment refuse when the pull request was retargeted" |
| 425 | js if test | `p.head.sha !== env.HEAD_SHA` | `true` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 425 | js if test | `p.head.sha !== env.HEAD_SHA` | `false` | `mcp-server.test.mjs`: "post_report and inline_comment refuse when the pull request was pushed to" |
| 433 | js if test | `p.base.sha === local` | `true` | `mcp-server.test.mjs`: "a base push that moves the merge base makes the run stale" |
| 433 | js if test | `p.base.sha === local` | `false` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 437 | js if test | `reviewed !== live` | `true` | `mcp-server.test.mjs`: "a base push that keeps the merge base leaves the run current" |
| 437 | js if test | `reviewed !== live` | `false` | `mcp-server.test.mjs`: "a base push that moves the merge base makes the run stale" |
| 464 | js if test | `!/^[0-9a-f]{40}$/.test(sha)` | `true` | `mcp-server.test.mjs`: "range_diff fetches an old_base a report recorded when the checkout lacks it" |
| 464 | js if test | `!/^[0-9a-f]{40}$/.test(sha)` | `false` | `mcp-server.test.mjs`: "range_diff fetches only a commit a Claude report names as its base" |
| 469 | js for test | `!found` | `true` | `mcp-server.test.mjs`: "range_diff finds the report that recorded an old_base on any page, reading no page past it" |
| 469 | js for test | `!found` | `false` | `mcp-server.test.mjs`: "range_diff fetches an old_base a report recorded when the checkout lacks it" |
| 473 | js && operand (callback) | `c.user` | `true` | `mcp-server.test.mjs`: "range_diff finds the report that recorded an old_base on any page, reading no page past it" |
| 473 | js callback test | `c.user && c.user.login === "github-actions[bot]" && recorded.test(c.body \|\| "") …` | `true` | `mcp-server.test.mjs`: "range_diff fetches only a commit a Claude report names as its base" |
| 473 | js callback test | `c.user && c.user.login === "github-actions[bot]" && recorded.test(c.body \|\| "") …` | `false` | `mcp-server.test.mjs`: "range_diff fetches an old_base a report recorded when the checkout lacks it" |
| 474 | js && operand (callback) | `c.user.login === "github-actions[bot]"` | `true` | `mcp-server.test.mjs`: "range_diff fetches only a commit a Claude report names as its base" |
| 475 | js && operand (callback) | `recorded.test(c.body \|\| "")` | `true` | `mcp-server.test.mjs`: "range_diff fetches only a commit a Claude report names as its base" |
| 476 | js && operand (callback) | `posted.test(c.body \|\| "")` | `true` | `mcp-server.test.mjs`: "range_diff fetches only a commit a Claude report names as its base" |
| 478 | js if test | `raw.length < 100` | `true` | `mcp-server.test.mjs`: "range_diff finds the report that recorded an old_base on any page, reading no page past it" |
| 478 | js if test | `raw.length < 100` | `false` | `mcp-server.test.mjs`: "range_diff fetches only a commit a Claude report names as its base" |
| 480 | js if test | `!found` | `true` | `mcp-server.test.mjs`: "range_diff fetches an old_base a report recorded when the checkout lacks it" |
| 480 | js if test | `!found` | `false` | `mcp-server.test.mjs`: "range_diff fetches only a commit a Claude report names as its base" |
| 515 | js ternary test | `hasCommit(sha)` | `true` | Not caught, equivalent in practice: git fetch of a sha exits 0 only once it has the commit |
| 515 | js ternary test | `hasCommit(sha)` | `false` | `mcp-server.test.mjs`: "range_diff fetches an old_base a report recorded when the checkout lacks it" |
| 535 | js callback test | `l.startsWith('${name}: ')` | `true` | `mcp-server.test.mjs`: "post_report posts once, with the run marker, when the run is current" |
| 535 | js callback test | `l.startsWith('${name}: ')` | `false` | `mcp-server.test.mjs`: "post_report posts once, with the run marker, when the run is current" |
| 542 | js callback test | `l.startsWith('${name}:')` | `true` | `mcp-server.test.mjs`: "post_report posts once, with the run marker, when the run is current" |
| 542 | js callback test | `l.startsWith('${name}:')` | `false` | `mcp-server.test.mjs`: "post_report posts once, with the run marker, when the run is current" |
| 543 | js callback test | `re.test(l)` | `true` | `mcp-server.test.mjs`: "post_report posts once, with the run marker, when the run is current" |
| 543 | js callback test | `re.test(l)` | `false` | `mcp-server.test.mjs`: "post_report posts once, with the run marker, when the run is current" |
| 544 | js \|\| operand (if) | `prefixed !== 1` | `false` | `mcp-server.test.mjs`: "post_report refuses a malformed Head reviewed line beside a valid one and posts nothing" |
| 544 | js if test | `prefixed !== 1 \|\| valid !== 1` | `true` | `mcp-server.test.mjs`: "post_report posts once, with the run marker, when the run is current" |
| 544 | js if test | `prefixed !== 1 \|\| valid !== 1` | `false` | `mcp-server.test.mjs`: "post_report refuses a missing Head reviewed line and posts nothing" |
| 544 | js \|\| operand (if) | `valid !== 1` | `false` | `mcp-server.test.mjs`: "post_report refuses a short base sha and posts nothing" |
| 554 | js if test | `r === undefined` | `true` | `mcp-server-rules.test.mjs`: "the issue tools name a repo option that is not text as another repository's, and an author without a login as unknown" |
| 554 | js if test | `r === undefined` | `false` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 555 | js && operand (if) | `typeof r === "string"` | `true` | `mcp-server-rules.test.mjs`: "the issue tools name a repo option that is not text as another repository's, and an author without a login as unknown" |
| 555 | js if test | `typeof r === "string" && r.toLowerCase() === repo.toLowerCase()` | `true` | `mcp-server-rules.test.mjs`: "the issue tools name a repo option that is not text as another repository's, and an author without a login as unknown" |
| 555 | js if test | `typeof r === "string" && r.toLowerCase() === repo.toLowerCase()` | `false` | `review-screen.test.mjs`: "the review's issue tools refuse another repository" |
| 555 | js && operand (if) | `r.toLowerCase() === repo.toLowerCase()` | `true` | `review-screen.test.mjs`: "the review's issue tools refuse another repository" |
| 573 | js ternary test | `typeof api === "string"` | `true` | `mcp-server.test.mjs`: "info reports edited_after_approval false for no approval" |
| 573 | js ternary test | `typeof api === "string"` | `false` | `review-screen.test.mjs`: "the review's issue tools refuse an issue transferred to another repository" |
| 575 | js ternary test | `typeof page === "string"` | `true` | `mcp-server.test.mjs`: "info reports edited_after_approval false for no approval" |
| 575 | js ternary test | `typeof page === "string"` | `false` | `review-screen.test.mjs`: "triage refuses an issue transferred to another repository" |
| 578 | js if test | `m === undefined` | `true` | `review-screen.test.mjs`: "the review's issue tools refuse an issue transferred to another repository" |
| 578 | js if test | `m === undefined` | `false` | `mcp-server.test.mjs`: "info reports edited_after_approval false for no approval" |
| 585 | js if test | `!ofThisRepo(c)` | `true` | `review-screen.test.mjs`: "the review's issue tools refuse an issue transferred to another repository" |
| 585 | js if test | `!ofThisRepo(c)` | `false` | `review-screen.test.mjs`: "the review's issue tools refuse an issue transferred to another repository" |
| 610 | js \|\| operand (if) | `!user` | `false` | `review-screen.test.mjs`: "conversation withholds bodies by authors without write access" |
| 610 | js if test | `!user \|\| typeof user.login !== "string"` | `true` | `mcp-server-rules.test.mjs`: "a listing cuts a body too long for a page of its own, and names the tool that reads it whole" |
| 610 | js if test | `!user \|\| typeof user.login !== "string"` | `false` | `mcp-server-rules.test.mjs`: "the issue tools name a repo option that is not text as another repository's, and an author without a login as unknown" |
| 610 | js \|\| operand (if) | `typeof user.login !== "string"` | `false` | `mcp-server-rules.test.mjs`: "the issue tools name a repo option that is not text as another repository's, and an author without a login as unknown" |
| 611 | js if test | `user.type === "Bot"` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue labelled by someone without write access is withheld by read_issue, search and issue" |
| 611 | js if test | `user.type === "Bot"` | `false` | `mcp-server-rules.test.mjs`: "a listing cuts a body too long for a page of its own, and names the tool that reads it whole" |
| 613 | js if test | `!access.has(login)` | `true` | `review-screen.test.mjs`: "conversation withholds bodies by authors without write access" |
| 613 | js if test | `!access.has(login)` | `false` | `mcp-server.test.mjs`: "open_prs finds this repository's mentions of the issue and which pull requests close it" |
| 619 | js if test | `/^[A-Za-z0-9-]+(_[A-Za-z0-9]+)?$/.test(login)` | `true` | `review-screen.test.mjs`: "conversation withholds bodies by authors without write access" |
| 619 | js if test | `/^[A-Za-z0-9-]+(_[A-Za-z0-9]+)?$/.test(login)` | `false` | `mcp-server.test.mjs`: "open_prs finds this repository's mentions of the issue and which pull requests close it" |
| 623 | js \|\| operand (ternary) | `permission === "admin"` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for by the operator is shown by read_issue, search and issue" |
| 623 | js ternary test | `permission === "admin" \|\| permission === "write"` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue labelled by someone without write access is withheld by read_issue, search and issue" |
| 623 | js ternary test | `permission === "admin" \|\| permission === "write"` | `false` | `mcp-server.test.mjs`: "open_prs finds this repository's mentions of the issue and which pull requests close it" |
| 623 | js \|\| operand (ternary) | `permission === "write"` | `false` | `mcp-server.test.mjs`: "open_prs finds this repository's mentions of the issue and which pull requests close it" |
| 627 | js if test | `/HTTP 404/.test(String(e.stderr))` | `true` | `review-screen.test.mjs`: "conversation withholds bodies by authors without write access" |
| 627 | js if test | `/HTTP 404/.test(String(e.stderr))` | `false` | `review-screen.test.mjs`: "conversation withholds bodies by authors without write access" |
| 637 | js ternary test | `reason` | `true` | `mcp-server-rules.test.mjs`: "a listing cuts a body too long for a page of its own, and names the tool that reads it whole" |
| 637 | js ternary test | `reason` | `false` | `mcp-server-rules.test.mjs`: "the issue tools name a repo option that is not text as another repository's, and an author without a login as unknown" |
| 654 | js && operand (if) | `i.user` | `true` | `review-screen.test.mjs`: "open_prs counts a closing pull request only from an author with write access" |
| 654 | js if test | `i.user && i.user.type !== "Bot" && typeof i.author_association === "string" && !…` | `true` | `mcp-server-rules.test.mjs`: "open_prs reads every page of open pull requests, and comment refuses a body that is not text" |
| 654 | js if test | `i.user && i.user.type !== "Bot" && typeof i.author_association === "string" && !…` | `false` | `review-screen.test.mjs`: "triage search and open_prs withhold titles by authors without write access" |
| 655 | js && operand (if) | `i.user.type !== "Bot"` | `true` | `review-screen.test.mjs`: "triage search and open_prs withhold titles by authors without write access" |
| 656 | js && operand (if) | `typeof i.author_association === "string"` | `true` | `review-screen.test.mjs`: "triage search and open_prs withhold titles by authors without write access" |
| 657 | js && operand (if) | `!ASSOCIATED.has(i.author_association)` | `true` | `review-screen.test.mjs`: "triage search and open_prs withhold titles by authors without write access" |
| 659 | js if test | `userOwned === undefined` | `true` | Not a rule: a cache of the repository owner's type; looking it up again gives the same answer |
| 659 | js if test | `userOwned === undefined` | `false` | `review-screen.test.mjs`: "triage search and open_prs withhold titles by authors without write access" |
| 666 | js if test | `userOwned` | `true` | `review-screen.test.mjs`: "triage looks every listed author up in an organization's repository" |
| 666 | js if test | `userOwned` | `false` | `review-screen.test.mjs`: "triage search and open_prs withhold titles by authors without write access" |
| 676 | js ternary test | `reason` | `true` | `mcp-server-rules.test.mjs`: "search keeps next_start when a page fills before the results end" |
| 676 | js ternary test | `reason` | `false` | `review-screen.test.mjs`: "triage search and open_prs withhold titles by authors without write access" |
| 730 | js \|\| operand (if) | `before.title !== after.title` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue whose text changes while the vouch is read is withheld by read_issue, search and issue" |
| 730 | js if test | `before.title !== after.title \|\| before.body !== after.body \|\| before.lastEditedA…` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue never vouched for is withheld by read_issue, search and issue" |
| 730 | js if test | `before.title !== after.title \|\| before.body !== after.body \|\| before.lastEditedA…` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue whose text changes while the vouch is read is withheld by read_issue, search and issue" |
| 731 | js \|\| operand (if) | `before.body !== after.body` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue whose body changes while the vouch is read is withheld by read_issue, search and issue" |
| 732 | js \|\| operand (if) | `before.lastEditedAt !== after.lastEditedAt` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue whose last edit moves while the vouch is read is withheld by read_issue, search and issue" |
| 733 | js \|\| operand (if) | `JSON.stringify(before.labels) !== JSON.stringify(after.labels)` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue whose triaged label is removed while the vouch is read is withheld by read_issue, search and issue" |
| 740 | js callback test | `e.event === type` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for by the operator is shown by read_issue, search and issue" |
| 740 | js callback test | `e.event === type` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue retitled after the vouch is withheld by read_issue, search and issue" |
| 750 | js callback test | `(e.event === "labeled" \|\| e.event === "unlabeled") && e.label && e.label.name ==…` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue labelled with another label by the operator is withheld by read_issue, search and issue" |
| 750 | js callback test | `(e.event === "labeled" \|\| e.event === "unlabeled") && e.label && e.label.name ==…` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for by the operator is shown by read_issue, search and issue" |
| 750 | js \|\| operand (callback) | `e.event === "labeled"` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for by the operator is shown by read_issue, search and issue" |
| 750 | js && operand (callback) | `e.event === "labeled" \|\| e.event === "unlabeled"` | `true` | Not caught, equivalent: an event of another type that carries the label is neither labeled nor unlabeled, so both filters after this one drop it |
| 750 | js \|\| operand (callback) | `e.event === "unlabeled"` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for, then asked about by triage is withheld by read_issue, search and issue" |
| 751 | js && operand (callback) | `e.label` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for, with a label event that carries no label is shown by read_issue, search and issue" |
| 752 | js && operand (callback) | `e.label.name === "needs-triage"` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue labelled with another label by the operator is withheld by read_issue, search and issue" |
| 755 | js for test | `k >= 0` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue never vouched for is withheld by read_issue, search and issue" |
| 755 | js for test | `k >= 0` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for by the operator is shown by read_issue, search and issue" |
| 757 | js && operand (if) | `e.event === "labeled"` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for, then withdrawn by a person is withheld by read_issue, search and issue" |
| 757 | js if test | `e.event === "labeled" && e.actor && e.actor.type !== "Bot" && !withheldReason(e.…` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for, then asked about by triage is withheld by read_issue, search and issue" |
| 757 | js if test | `e.event === "labeled" && e.actor && e.actor.type !== "Bot" && !withheldReason(e.…` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for by the operator is shown by read_issue, search and issue" |
| 757 | js && operand (if) | `e.actor` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue labelled by an actor GitHub no longer names is withheld by read_issue, search and issue" |
| 757 | js && operand (if) | `e.actor.type !== "Bot"` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue labelled by a bot is withheld by read_issue, search and issue" |
| 757 | js && operand (if) | `!withheldReason(e.actor)` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue labelled by someone without write access is withheld by read_issue, search and issue" |
| 759 | js skip statement | `break;` | `;` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue withdrawn, then vouched for again is shown by read_issue, search and issue" |
| 762 | js \|\| operand (if) | `at === -1` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue never vouched for is withheld by read_issue, search and issue" |
| 762 | js if test | `at === -1 \|\| !(marks[at].created_at > changedAt)` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for by the operator is shown by read_issue, search and issue" |
| 762 | js if test | `at === -1 \|\| !(marks[at].created_at > changedAt)` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue never vouched for is withheld by read_issue, search and issue" |
| 762 | js \|\| operand (if) | `!(marks[at].created_at > changedAt)` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue edited after the vouch is withheld by read_issue, search and issue" |
| 763 | js callback test | `e.event === "unlabeled"` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for, then given needs-triage again by the bot is shown by read_issue, search and issue" |
| 763 | js callback test | `e.event === "unlabeled"` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for, then asked about by triage is withheld by read_issue, search and issue" |
| 764 | js if test | `later.some((e) => !(e.actor && e.actor.login === KIT_BOT))` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for by the operator is shown by read_issue, search and issue" |
| 764 | js if test | `later.some((e) => !(e.actor && e.actor.login === KIT_BOT))` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue planned by triage, then its needs-triage removed by a person is withheld by read_issue, search and issue" |
| 764 | js callback test | `!(e.actor && e.actor.login === KIT_BOT)` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for, then planned by triage, which removes needs-triage is shown by read_issue, search and issue" |
| 764 | js callback test | `!(e.actor && e.actor.login === KIT_BOT)` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue planned by triage, then its needs-triage removed by a person is withheld by read_issue, search and issue" |
| 764 | js && operand (callback) | `e.actor` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for, then unlabelled by an account GitHub no longer names is withheld by read_issue, search and issue" |
| 764 | js && operand (callback) | `e.actor.login === KIT_BOT` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue planned by triage, then its needs-triage removed by a person is withheld by read_issue, search and issue" |
| 766 | js if test | `later.length` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for by the operator is shown by read_issue, search and issue" |
| 766 | js if test | `later.length` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for, then asked about by triage is withheld by read_issue, search and issue" |
| 779 | js && operand (callback) | `c.user` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue planned by triage among comments by no one, without a body, or not triage's is shown by read_issue, search and issue" |
| 779 | js callback test | `c.user && c.user.login === KIT_BOT && typeof c.body === "string" && TRIAGE_HEADI…` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue planned by a look-alike comment from someone else is withheld by read_issue, search and issue" |
| 779 | js callback test | `c.user && c.user.login === KIT_BOT && typeof c.body === "string" && TRIAGE_HEADI…` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for, then planned by triage, which removes needs-triage is shown by read_issue, search and issue" |
| 780 | js && operand (callback) | `c.user.login === KIT_BOT` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue planned by a look-alike comment from someone else is withheld by read_issue, search and issue" |
| 781 | js && operand (callback) | `typeof c.body === "string"` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue planned by triage among comments by no one, without a body, or not triage's is shown by read_issue, search and issue" |
| 782 | js && operand (callback) | `TRIAGE_HEADING.test(c.body)` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue planned by triage among comments by no one, without a body, or not triage's is shown by read_issue, search and issue" |
| 785 | js && operand (expression) | `answer` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue whose needs-triage the bot removed without an answer is withheld by read_issue, search and issue" |
| 785 | js && operand (expression) | `!TRIAGE_HEADING.exec(answer.body)[1]` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue planned, then asked about by a later triage is withheld by read_issue, search and issue" |
| 785 | js && operand (expression) | `answer.created_at > changedAt` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for, then answered by a plan older than its last edit is withheld by read_issue, search and issue" |
| 786 | js \|\| operand (if) | `!labels.includes("triaged")` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue planned by triage but no longer triaged is withheld by read_issue, search and issue" |
| 786 | js if test | `!labels.includes("triaged") \|\| !plan` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue never vouched for is withheld by read_issue, search and issue" |
| 786 | js if test | `!labels.includes("triaged") \|\| !plan` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for, then asked about by triage is withheld by read_issue, search and issue" |
| 786 | js \|\| operand (if) | `!plan` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue planned, then asked about by a later triage is withheld by read_issue, search and issue" |
| 798 | js ternary test | `isKitBotIssue(i)` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue never vouched for is withheld by read_issue, search and issue" |
| 798 | js ternary test | `isKitBotIssue(i)` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue never vouched for is withheld by read_issue, search and issue" |
| 890 | js if test | `refused` | `true` | `mcp-server-rules.test.mjs`: "diff for one path shows that path alone, and the issue tools take only an integer number" |
| 890 | js if test | `refused` | `false` | `mcp-server-rules.test.mjs`: "the issue tools name a repo option that is not text as another repository's, and an author without a login as unknown" |
| 891 | js \|\| operand (if) | `!Number.isInteger(number)` | `false` | `mcp-server-rules.test.mjs`: "diff for one path shows that path alone, and the issue tools take only an integer number" |
| 891 | js if test | `!Number.isInteger(number) \|\| number <= 0` | `true` | `mcp-server-refusals.test.mjs`: "the review's tools refuse bad arguments and spent limits, and write nothing" |
| 891 | js if test | `!Number.isInteger(number) \|\| number <= 0` | `false` | `mcp-server-rules.test.mjs`: "diff for one path shows that path alone, and the issue tools take only an integer number" |
| 891 | js \|\| operand (if) | `number <= 0` | `false` | `mcp-server-refusals.test.mjs`: "the review's tools refuse bad arguments and spent limits, and write nothing" |
| 894 | js if test | `!ofThisRepo(i)` | `true` | `mcp-server-refusals.test.mjs`: "the review's tools refuse bad arguments and spent limits, and write nothing" |
| 894 | js if test | `!ofThisRepo(i)` | `false` | `review-screen.test.mjs`: "the review's issue tools refuse an issue transferred to another repository" |
| 895 | js if test | `isPr(i)` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue never vouched for is withheld by read_issue, search and issue" |
| 895 | js if test | `isPr(i)` | `false` | `mcp-server-refusals.test.mjs`: "the review's tools refuse bad arguments and spent limits, and write nothing" |
| 909 | js ternary test | `reason` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue never vouched for is withheld by read_issue, search and issue" |
| 909 | js ternary test | `reason` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue never vouched for is withheld by read_issue, search and issue" |
| 932 | js if test | `refused` | `true` | `mcp-server-rules.test.mjs`: "diff for one path shows that path alone, and the issue tools take only an integer number" |
| 932 | js if test | `refused` | `false` | `review-screen.test.mjs`: "the review's issue tools refuse another repository" |
| 933 | js \|\| operand (if) | `!Number.isInteger(number)` | `false` | `mcp-server-rules.test.mjs`: "diff for one path shows that path alone, and the issue tools take only an integer number" |
| 933 | js if test | `!Number.isInteger(number) \|\| number <= 0` | `true` | `review-screen.test.mjs`: "the review's issue tools refuse an issue transferred to another repository" |
| 933 | js if test | `!Number.isInteger(number) \|\| number <= 0` | `false` | `mcp-server-rules.test.mjs`: "diff for one path shows that path alone, and the issue tools take only an integer number" |
| 933 | js \|\| operand (if) | `number <= 0` | `false` | `mcp-server-refusals.test.mjs`: "the review's tools refuse bad arguments and spent limits, and write nothing" |
| 959 | js if test | `refused` | `true` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 959 | js if test | `refused` | `false` | `review-screen.test.mjs`: "the review's issue tools refuse another repository" |
| 960 | js if test | `kind === "review"` | `true` | `mcp-server-refusals.test.mjs`: "the review's tools refuse bad arguments and spent limits, and write nothing" |
| 960 | js if test | `kind === "review"` | `false` | `review-screen.test.mjs`: "comment_body withholds a body whole" |
| 962 | js if test | `kind === "issue"` | `true` | `mcp-server-refusals.test.mjs`: "the review's tools refuse bad arguments and spent limits, and write nothing" |
| 962 | js if test | `kind === "issue"` | `false` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 963 | js if test | `kind === "inline"` | `true` | `mcp-server-refusals.test.mjs`: "the review's tools refuse bad arguments and spent limits, and write nothing" |
| 963 | js if test | `kind === "inline"` | `false` | `review-screen.test.mjs`: "comment_body withholds a body whole" |
| 985 | js && operand (if) | `path !== undefined` | `true` | `mcp-server-rules.test.mjs`: "diff for one path shows that path alone, and the issue tools take only an integer number" |
| 985 | js if test | `path !== undefined && !pathArg(path)` | `true` | `mcp-server-rules.test.mjs`: "diff for one path shows that path alone, and the issue tools take only an integer number" |
| 985 | js if test | `path !== undefined && !pathArg(path)` | `false` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 985 | js && operand (if) | `!pathArg(path)` | `true` | `mcp-server-rules.test.mjs`: "diff for one path shows that path alone, and the issue tools take only an integer number" |
| 989 | js if test | `path !== undefined` | `true` | `mcp-server-rules.test.mjs`: "diff for one path shows that path alone, and the issue tools take only an integer number" |
| 989 | js if test | `path !== undefined` | `false` | `mcp-server-rules.test.mjs`: "diff for one path shows that path alone, and the issue tools take only an integer number" |
| 1003 | js if test | `!refName(ref)` | `true` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 1003 | js if test | `!refName(ref)` | `false` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 1004 | js && operand (if) | `path !== undefined` | `true` | `mcp-server.test.mjs`: "diff, files and show read the base's attributes, not the head's" |
| 1004 | js if test | `path !== undefined && !pathArg(path)` | `true` | `mcp-server-rules.test.mjs`: "the git tools take the fetched base whatever its name, and a plain range" |
| 1004 | js if test | `path !== undefined && !pathArg(path)` | `false` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 1004 | js && operand (if) | `!pathArg(path)` | `true` | `mcp-server-rules.test.mjs`: "the git tools take the fetched base whatever its name, and a plain range" |
| 1006 | js ternary test | `path !== undefined` | `true` | `mcp-server.test.mjs`: "diff, files and show read the base's attributes, not the head's" |
| 1006 | js ternary test | `path !== undefined` | `false` | `mcp-server-rules.test.mjs`: "the git tools take the fetched base whatever its name, and a plain range" |
| 1019 | js if test | `!rangeArg(range)` | `true` | `mcp-server-rules.test.mjs`: "the git tools take the fetched base whatever its name, and a plain range" |
| 1019 | js if test | `!rangeArg(range)` | `false` | `mcp-server-rules.test.mjs`: "the git tools refuse a ref, range or path that is not plain, before running git" |
| 1042 | js && operand (expression) | `typeof h === "string"` | `true` | `mcp-server-rules.test.mjs`: "range_diff takes only text shas, and sees an old commit the base now holds as no change" |
| 1042 | js && operand (expression) | `/^[0-9a-f]{7,40}$/.test(h)` | `true` | `mcp-server.test.mjs`: "range_diff takes commit shas only" |
| 1043 | js if test | `![old_head, new_head].every(sha)` | `true` | `mcp-server-rules.test.mjs`: "range_diff takes only text shas, and sees an old commit the base now holds as no change" |
| 1043 | js if test | `![old_head, new_head].every(sha)` | `false` | `mcp-server-rules.test.mjs`: "range_diff takes only text shas, and sees an old commit the base now holds as no change" |
| 1044 | js && operand (if) | `old_base !== undefined` | `true` | `mcp-server.test.mjs`: "range_diff compares hidden changes by content" |
| 1044 | js if test | `old_base !== undefined && !sha(old_base)` | `true` | `mcp-server-rules.test.mjs`: "range_diff takes only text shas, and sees an old commit the base now holds as no change" |
| 1044 | js if test | `old_base !== undefined && !sha(old_base)` | `false` | `mcp-server.test.mjs`: "range_diff takes commit shas only" |
| 1044 | js && operand (if) | `!sha(old_base)` | `true` | `mcp-server-rules.test.mjs`: "range_diff takes only text shas, and sees an old commit the base now holds as no change" |
| 1049 | js if test | `count('${base}..${new_head}') === 0` | `true` | `mcp-server-rules.test.mjs`: "range_diff takes only text shas, and sees an old commit the base now holds as no change" |
| 1049 | js if test | `count('${base}..${new_head}') === 0` | `false` | `mcp-server.test.mjs`: "range_diff says so when the last reviewed head is gone from the checkout" |
| 1055 | js if test | `!hasCommit(old_head)` | `true` | `mcp-server-rules.test.mjs`: "range_diff takes only text shas, and sees an old commit the base now holds as no change" |
| 1055 | js if test | `!hasCommit(old_head)` | `false` | `mcp-server.test.mjs`: "range_diff says so when the last reviewed head is gone from the checkout" |
| 1059 | js && operand (if) | `old_base !== undefined` | `true` | `mcp-server.test.mjs`: "range_diff compares hidden changes by content" |
| 1059 | js if test | `old_base !== undefined && !hasCommit(old_base)` | `true` | `mcp-server-rules.test.mjs`: "range_diff takes only text shas, and sees an old commit the base now holds as no change" |
| 1059 | js if test | `old_base !== undefined && !hasCommit(old_base)` | `false` | `mcp-server.test.mjs`: "range_diff fetches an old_base a report recorded when the checkout lacks it" |
| 1059 | js && operand (if) | `!hasCommit(old_base)` | `true` | `mcp-server-rules.test.mjs`: "range_diff takes only text shas, and sees an old commit the base now holds as no change" |
| 1061 | js if test | `why` | `true` | `mcp-server.test.mjs`: "range_diff fetches an old_base a report recorded when the checkout lacks it" |
| 1061 | js if test | `why` | `false` | `mcp-server.test.mjs`: "range_diff fetches only a commit a Claude report names as its base" |
| 1082 | js if test | `gitDiff(from, "diff", ['${from}...${old_head}']) === gitDiff(base, "diff", ['${b…` | `true` | `mcp-server.test.mjs`: "range_diff compares hidden changes by content" |
| 1082 | js if test | `gitDiff(from, "diff", ['${from}...${old_head}']) === gitDiff(base, "diff", ['${b…` | `false` | `mcp-server-rules.test.mjs`: "range_diff takes only text shas, and sees an old commit the base now holds as no change" |
| 1094 | js callback test | `c.trim()` | `true` | Not caught, equivalent: each side's log yields exactly one empty entry (after its last NUL, or the empty output), and the two match each other and cancel |
| 1094 | js callback test | `c.trim()` | `false` | `mcp-server.test.mjs`: "range_diff shows the series when only commit messages changed" |
| 1097 | js ternary test | `nl === -1` | `true` | `mcp-server-rules.test.mjs`: "range_diff takes only text shas, and sees an old commit the base now holds as no change" |
| 1097 | js ternary test | `nl === -1` | `false` | Not caught, unreachable: git log --format=%H%n%B always puts a newline after the sha |
| 1099 | js ternary test | `/^[0-9a-f]{40}$/.test(sha)` | `true` | Not caught, unreachable: each entry git log -z --format=%H%n%B writes starts with a full sha |
| 1099 | js ternary test | `/^[0-9a-f]{40}$/.test(sha)` | `false` | `mcp-server-rules.test.mjs`: "range_diff takes only text shas, and sees an old commit the base now holds as no change" |
| 1100 | js ternary test | `nl === -1` | `true` | `mcp-server.test.mjs`: "range_diff shows the series when only commit messages changed" |
| 1100 | js ternary test | `nl === -1` | `false` | Not caught, unreachable: git log --format=%H%n%B always puts a newline after the sha |
| 1105 | js callback test | `c.message === message` | `true` | `mcp-server.test.mjs`: "range_diff shows the series when only commit messages changed" |
| 1105 | js callback test | `c.message === message` | `false` | `mcp-server-rules.test.mjs`: "range_diff takes only text shas, and sees an old commit the base now holds as no change" |
| 1106 | js if test | `i === -1` | `true` | `mcp-server-rules.test.mjs`: "range_diff takes only text shas, and sees an old commit the base now holds as no change" |
| 1106 | js if test | `i === -1` | `false` | `mcp-server.test.mjs`: "range_diff shows the series when only commit messages changed" |
| 1111 | js if test | `sha === null` | `true` | `mcp-server-rules.test.mjs`: "range_diff takes only text shas, and sees an old commit the base now holds as no change" |
| 1111 | js if test | `sha === null` | `false` | Not caught, equivalent: git merge-base given no sha fails, which also answers not in the base |
| 1119 | js callback test | `!inBase(c.sha)` | `true` | `mcp-server-rules.test.mjs`: "range_diff takes only text shas, and sees an old commit the base now holds as no change" |
| 1119 | js callback test | `!inBase(c.sha)` | `false` | `mcp-server.test.mjs`: "range_diff shows the series when only commit messages changed" |
| 1120 | js && operand (if) | `added.length === 0` | `true` | `mcp-server.test.mjs`: "range_diff with an unchanged diff and an empty old range says everything is new" |
| 1120 | js if test | `added.length === 0 && dropped.length === 0` | `true` | `mcp-server.test.mjs`: "range_diff shows the series when only commit messages changed" |
| 1120 | js if test | `added.length === 0 && dropped.length === 0` | `false` | `mcp-server-rules.test.mjs`: "range_diff takes only text shas, and sees an old commit the base now holds as no change" |
| 1120 | js && operand (if) | `dropped.length === 0` | `true` | `mcp-server.test.mjs`: "range_diff shows the series when a squash dropped a commit message" |
| 1127 | js ternary test | `cs.length === 0` | `true` | `mcp-server.test.mjs`: "range_diff shows the series when only commit messages changed" |
| 1127 | js ternary test | `cs.length === 0` | `false` | Not a rule: the wording of an empty commit list in range_diff's answer |
| 1135 | js if test | `oldEmpty` | `true` | `mcp-server.test.mjs`: "range_diff shows the series when only commit messages changed" |
| 1135 | js if test | `oldEmpty` | `false` | `mcp-server.test.mjs`: "range_diff with an unchanged diff and an empty old range says everything is new" |
| 1145 | js if test | `oldEmpty` | `true` | `mcp-server.test.mjs`: "range_diff compares hidden changes by content" |
| 1145 | js if test | `oldEmpty` | `false` | `mcp-server.test.mjs`: "range_diff says so when the last reviewed range was empty" |
| 1166 | js if test | `runState.inline >= INLINE_LIMIT` | `true` | `mcp-server-rules.test.mjs`: "file_issue and inline_comment refuse arguments of the wrong type, and a blank title" |
| 1166 | js if test | `runState.inline >= INLINE_LIMIT` | `false` | `mcp-server.test.mjs`: "with STATE_FILE, a carried-on run's new server keeps the run's report and inline limits" |
| 1170 | js if test | `!pathArg(path)` | `true` | `mcp-server-rules.test.mjs`: "file_issue and inline_comment refuse arguments of the wrong type, and a blank title" |
| 1170 | js if test | `!pathArg(path)` | `false` | `mcp-server.test.mjs`: "inline_comment checks its arguments and posts on the reviewed head" |
| 1171 | js \|\| operand (if) | `!Number.isInteger(line)` | `false` | `mcp-server-rules.test.mjs`: "file_issue and inline_comment refuse arguments of the wrong type, and a blank title" |
| 1171 | js if test | `!Number.isInteger(line) \|\| line < 1` | `true` | `mcp-server-rules.test.mjs`: "file_issue and inline_comment refuse arguments of the wrong type, and a blank title" |
| 1171 | js if test | `!Number.isInteger(line) \|\| line < 1` | `false` | `mcp-server-rules.test.mjs`: "file_issue and inline_comment refuse arguments of the wrong type, and a blank title" |
| 1171 | js \|\| operand (if) | `line < 1` | `false` | `mcp-server.test.mjs`: "inline_comment checks its arguments and posts on the reviewed head" |
| 1172 | js \|\| operand (if) | `typeof body !== "string"` | `false` | `mcp-server-rules.test.mjs`: "file_issue and inline_comment refuse arguments of the wrong type, and a blank title" |
| 1172 | js if test | `typeof body !== "string" \|\| body.trim() === ""` | `true` | `mcp-server-rules.test.mjs`: "with no private names configured, the public-content check gets no PRIVATE_REPO_NAMES at all, and no text is left on disk" |
| 1172 | js if test | `typeof body !== "string" \|\| body.trim() === ""` | `false` | `mcp-server-rules.test.mjs`: "file_issue and inline_comment refuse arguments of the wrong type, and a blank title" |
| 1172 | js \|\| operand (if) | `body.trim() === ""` | `false` | `mcp-server.test.mjs`: "inline_comment checks its arguments and posts on the reviewed head" |
| 1175 | js if test | `why` | `true` | `mcp-server-rules.test.mjs`: "with no private names configured, the public-content check gets no PRIVATE_REPO_NAMES at all, and no text is left on disk" |
| 1175 | js if test | `why` | `false` | `mcp-server.test.mjs`: "post_report and inline_comment refuse when the pull request was closed" |
| 1176 | js output call | `gh( [ "api", "-X", "POST", 'repos/${repo}/pulls/${pr}/comments', "--input", "-",…` | `"{}"` | `mcp-server.test.mjs`: "with STATE_FILE, a carried-on run's new server keeps the run's report and inline limits" |
| 1195 | js output statement | `record({ inline: runState.inline + 1 });` | `void 0;` | `mcp-server.test.mjs`: "with STATE_FILE, a carried-on run's new server keeps the run's report and inline limits" |
| 1224 | js \|\| operand (if) | `typeof finding !== "string"` | `false` | `mcp-server-rules.test.mjs`: "file_issue and inline_comment refuse arguments of the wrong type, and a blank title" |
| 1224 | js if test | `typeof finding !== "string" \|\| !FINDING_ID.test(finding)` | `true` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 1224 | js if test | `typeof finding !== "string" \|\| !FINDING_ID.test(finding)` | `false` | `mcp-server-rules.test.mjs`: "file_issue and inline_comment refuse arguments of the wrong type, and a blank title" |
| 1224 | js \|\| operand (if) | `!FINDING_ID.test(finding)` | `false` | `file-issue.test.mjs`: "file_issue checks its arguments and stops at five a run" |
| 1226 | js \|\| operand (if) | `typeof title !== "string"` | `false` | `mcp-server-rules.test.mjs`: "file_issue and inline_comment refuse arguments of the wrong type, and a blank title" |
| 1226 | js if test | `typeof title !== "string" \|\| !title.trim() \|\| title.length > 120 \|\| /[\r\n]/.tes…` | `true` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 1226 | js if test | `typeof title !== "string" \|\| !title.trim() \|\| title.length > 120 \|\| /[\r\n]/.tes…` | `false` | `mcp-server-rules.test.mjs`: "file_issue and inline_comment refuse arguments of the wrong type, and a blank title" |
| 1226 | js \|\| operand (if) | `!title.trim()` | `false` | `mcp-server-rules.test.mjs`: "file_issue and inline_comment refuse arguments of the wrong type, and a blank title" |
| 1226 | js \|\| operand (if) | `title.length > 120` | `false` | `file-issue.test.mjs`: "file_issue checks its arguments and stops at five a run" |
| 1226 | js \|\| operand (if) | `/[\r\n]/.test(title)` | `false` | `file-issue.test.mjs`: "file_issue checks its arguments and stops at five a run" |
| 1229 | js \|\| operand (if) | `typeof value !== "string"` | `false` | `mcp-server-rules.test.mjs`: "file_issue and inline_comment refuse arguments of the wrong type, and a blank title" |
| 1229 | js if test | `typeof value !== "string" \|\| !value.trim()` | `true` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 1229 | js if test | `typeof value !== "string" \|\| !value.trim()` | `false` | `mcp-server-rules.test.mjs`: "file_issue and inline_comment refuse arguments of the wrong type, and a blank title" |
| 1229 | js \|\| operand (if) | `!value.trim()` | `false` | `file-issue.test.mjs`: "file_issue checks its arguments and stops at five a run" |
| 1232 | js && operand (if) | `value !== undefined` | `true` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 1232 | js if test | `value !== undefined && typeof value !== "string"` | `true` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 1232 | js if test | `value !== undefined && typeof value !== "string"` | `false` | `mcp-server-refusals.test.mjs`: "the review's tools refuse bad arguments and spent limits, and write nothing" |
| 1232 | js && operand (if) | `typeof value !== "string"` | `true` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 1233 | js && operand (if) | `size !== undefined` | `true` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 1233 | js if test | `size !== undefined && !SIZES.includes(size)` | `true` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 1233 | js if test | `size !== undefined && !SIZES.includes(size)` | `false` | `file-issue.test.mjs`: "file_issue checks its arguments and stops at five a run" |
| 1233 | js && operand (if) | `!SIZES.includes(size)` | `true` | `file-issue.test.mjs`: "file_issue opens a Task-form issue labelled needs-operator with the finding's marker" |
| 1235 | js if test | `!filedByFinding` | `true` | `file-issue.test.mjs`: "file_issue reads the filed issues once a run and matches only this pull request's" |
| 1235 | js if test | `!filedByFinding` | `false` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 1243 | js if test | `isPr(i)` | `true` | `mcp-server-rules.test.mjs`: "file_issue finds an earlier issue for the finding on any page, not in a pull request, and names the first listed" |
| 1243 | js if test | `isPr(i)` | `false` | `mcp-server-rules.test.mjs`: "file_issue finds an earlier issue for the finding on any page, not in a pull request, and names the first listed" |
| 1245 | js if test | `!found.has(id)` | `true` | `mcp-server-rules.test.mjs`: "file_issue finds an earlier issue for the finding on any page, not in a pull request, and names the first listed" |
| 1245 | js if test | `!found.has(id)` | `false` | `mcp-server-rules.test.mjs`: "file_issue finds an earlier issue for the finding on any page, not in a pull request, and names the first listed" |
| 1247 | js if test | `raw.length < 100` | `true` | `mcp-server-rules.test.mjs`: "file_issue finds an earlier issue for the finding on any page, not in a pull request, and names the first listed" |
| 1247 | js if test | `raw.length < 100` | `false` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 1252 | js if test | `earlier` | `true` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 1252 | js if test | `earlier` | `false` | `mcp-server-rules.test.mjs`: "file_issue finds an earlier issue for the finding on any page, not in a pull request, and names the first listed" |
| 1253 | js if test | `runState.issues >= ISSUE_LIMIT` | `true` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 1253 | js if test | `runState.issues >= ISSUE_LIMIT` | `false` | `mcp-server-refusals.test.mjs`: "the review's per-run limits hold from the state file" |
| 1262 | js callback test | `value !== undefined` | `true` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 1262 | js callback test | `value !== undefined` | `false` | `public-content-guard.test.mjs`: "inline_comment and file_issue are checked, file_issue field by field" |
| 1265 | js if test | `why` | `true` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 1265 | js if test | `why` | `false` | `file-issue.test.mjs`: "file_issue is refused once the run is stale" |
| 1266 | js output call | `gh( ["api", "-X", "POST", 'repos/${repo}/issues', "--input", "-", "--jq", ".html…` | `"{}"` | `mcp-server-rules.test.mjs`: "file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty" |
| 1270 | js output statement | `record({ issues: runState.issues + 1 });` | `void 0;` | `file-issue.test.mjs`: "file_issue checks its arguments and stops at five a run" |
| 1285 | js if test | `runState.report` | `true` | `mcp-server-rules.test.mjs`: "post_report refuses a body that is not text" |
| 1285 | js if test | `runState.report` | `false` | `mcp-server.test.mjs`: "post_report posts once, with the run marker, when the run is current" |
| 1286 | js \|\| operand (if) | `typeof body !== "string"` | `false` | `mcp-server-rules.test.mjs`: "post_report refuses a body that is not text" |
| 1286 | js if test | `typeof body !== "string" \|\| body.trim() === ""` | `true` | `mcp-server.test.mjs`: "post_report posts once, with the run marker, when the run is current" |
| 1286 | js if test | `typeof body !== "string" \|\| body.trim() === ""` | `false` | `mcp-server-rules.test.mjs`: "post_report refuses a body that is not text" |
| 1286 | js \|\| operand (if) | `body.trim() === ""` | `false` | `mcp-server-refusals.test.mjs`: "the review's tools refuse bad arguments and spent limits, and write nothing" |
| 1291 | js if test | `problem` | `true` | `mcp-server.test.mjs`: "post_report posts once, with the run marker, when the run is current" |
| 1291 | js if test | `problem` | `false` | `mcp-server.test.mjs`: "post_report refuses a missing Head reviewed line and posts nothing" |
| 1296 | js if test | `named !== diffedBase` | `true` | `mcp-server.test.mjs`: "post_report posts once, with the run marker, when the run is current" |
| 1296 | js if test | `named !== diffedBase` | `false` | `mcp-server.test.mjs`: "post_report refuses a Base reviewed line naming another base than the one diffed" |
| 1303 | js if test | `why` | `true` | `mcp-server.test.mjs`: "post_report posts once, with the run marker, when the run is current" |
| 1303 | js if test | `why` | `false` | `mcp-server.test.mjs`: "post_report and inline_comment refuse when the pull request was closed" |
| 1313 | js if test | `bare(reviewedTitle) !== bare(title)` | `true` | `mcp-server.test.mjs`: "post_report posts once, with the run marker, when the run is current" |
| 1313 | js if test | `bare(reviewedTitle) !== bare(title)` | `false` | `no-mentions.test.mjs`: "post_report refuses a Title reviewed line that is not the pull request's title" |
| 1317 | js output call | `gh( [ "api", "-X", "POST", 'repos/${repo}/issues/${pr}/comments', "-F", "body=@-…` | `"{}"` | `mcp-server.test.mjs`: "post_report posts once, with the run marker, when the run is current" |
| 1332 | js output statement | `record({ report: true });` | `void 0;` | `mcp-server.test.mjs`: "post_report posts once, with the run marker, when the run is current" |
| 1344 | js && operand (ternary) | `env.DISPATCH_LOG` | `true` | Not caught, equivalent: fs.existsSync(undefined) is false, so an unset DISPATCH_LOG is never read |
| 1344 | js ternary test | `env.DISPATCH_LOG && fs.existsSync(env.DISPATCH_LOG)` | `true` | `mcp-server-rules.test.mjs`: "the server reads the job token from GH_TOKEN_FILE and gives it to gh" |
| 1344 | js ternary test | `env.DISPATCH_LOG && fs.existsSync(env.DISPATCH_LOG)` | `false` | `mcp-server.test.mjs`: "dispatch queues a run once per eligible issue still eligible now, and starts none" |
| 1344 | js && operand (ternary) | `fs.existsSync(env.DISPATCH_LOG)` | `true` | `mcp-server-rules.test.mjs`: "a sweep starts before its dispatch log exists, and its first dispatch writes it" |
| 1352 | js if test | `!ofThisRepo(i)` | `true` | `mcp-server-rules.test.mjs`: "info gives empty dates for an issue never approved, reopened or retitled" |
| 1352 | js if test | `!ofThisRepo(i)` | `false` | `review-screen.test.mjs`: "triage refuses an issue transferred to another repository" |
| 1353 | js if test | `isPr(i)` | `true` | `mcp-server-rules.test.mjs`: "info gives empty dates for an issue never approved, reopened or retitled" |
| 1353 | js if test | `isPr(i)` | `false` | `mcp-server.test.mjs`: "comment posts once with the run marker and never on a pull request" |
| 1370 | js && operand (expression) | `vouchedSha !== ""` | `true` | `mcp-server-vouched.test.mjs`: "without a vouch hash, the issue is shown as before" |
| 1370 | js && operand (expression) | `String(i.number) === String(n)` | `true` | `mcp-server-vouched.test.mjs`: "a title or body edited after the vouch is not shown" |
| 1370 | js && operand (expression) | `textSha(i) !== vouchedSha` | `true` | `mcp-server-vouched.test.mjs`: "the vouched text is shown as it is" |
| 1373 | js if test | `state !== "open"` | `true` | `mcp-server.test.mjs`: "remove_label takes agent:approved off only on a fresh triage or a later edit" |
| 1373 | js if test | `state !== "open"` | `false` | `mcp-server.test.mjs`: "nothing is written on an issue closed since the run started" |
| 1375 | js callback test | `l.name === name` | `true` | `mcp-server.test.mjs`: "remove_label takes agent:approved off only on a fresh triage or a later edit" |
| 1375 | js callback test | `l.name === name` | `false` | `mcp-server.test.mjs`: "remove_label takes agent:approved off only on a fresh triage or a later edit" |
| 1385 | js && operand (callback) | `e.event === "labeled"` | `true` | `mcp-server.test.mjs`: "info reports edited_after_approval true for another label, or the approval removed, after the edit" |
| 1385 | js callback test | `e.event === "labeled" && e.label && e.label.name === "agent:approved"` | `true` | `mcp-server.test.mjs`: "info reports edited_after_approval true for another label, or the approval removed, after the edit" |
| 1385 | js callback test | `e.event === "labeled" && e.label && e.label.name === "agent:approved"` | `false` | `mcp-server.test.mjs`: "info reports edited_after_approval true for an edit in the approval's second" |
| 1385 | js && operand (callback) | `e.label` | `true` | `mcp-server.test.mjs`: "info reports edited_after_approval true for another label, or the approval removed, after the edit" |
| 1385 | js && operand (callback) | `e.label.name === "agent:approved"` | `true` | `mcp-server.test.mjs`: "info reports edited_after_approval true for another label, or the approval removed, after the edit" |
| 1387 | js ternary test | `approvals.length` | `true` | `mcp-server-rules.test.mjs`: "info gives empty dates for an issue never approved, reopened or retitled" |
| 1387 | js ternary test | `approvals.length` | `false` | `mcp-server.test.mjs`: "info reports edited_after_approval true for an edit in the approval's second" |
| 1389 | js callback test | `e.event === type` | `true` | `mcp-server.test.mjs`: "info reports edited_after_approval false for an edit before the approval" |
| 1389 | js callback test | `e.event === type` | `false` | `mcp-server.test.mjs`: "info reports edited_after_approval true for a reopen after the approval" |
| 1390 | js ternary test | `at.length` | `true` | `mcp-server-rules.test.mjs`: "info gives empty dates for an issue never approved, reopened or retitled" |
| 1390 | js ternary test | `at.length` | `false` | `mcp-server.test.mjs`: "info reports edited_after_approval true for a reopen after the approval" |
| 1413 | js && operand (ternary) | `Number.isInteger(start)` | `true` | `mcp-server-rules.test.mjs`: "search starts at 0 for a start it cannot use, from the start it is given otherwise" |
| 1413 | js ternary test | `Number.isInteger(start) && start >= 0` | `true` | `mcp-server-rules.test.mjs`: "search starts at 0 for a start it cannot use, from the start it is given otherwise" |
| 1413 | js ternary test | `Number.isInteger(start) && start >= 0` | `false` | `mcp-server-rules.test.mjs`: "search starts at 0 for a start it cannot use, from the start it is given otherwise" |
| 1413 | js && operand (ternary) | `start >= 0` | `true` | Not caught, equivalent: a negative start passes the 1,000 check either way, and paged() then starts it at 0 |
| 1414 | js if test | `from >= 1000` | `true` | `mcp-server-rules.test.mjs`: "search starts at 0 for a start it cannot use, from the start it is given otherwise" |
| 1414 | js if test | `from >= 1000` | `false` | Not caught, equivalent: from 1,000 the pages past the tenth are empty without a call, and the result is the same empty, truncated listing |
| 1419 | js ternary test | `page > 10` | `true` | `mcp-server-rules.test.mjs`: "search starts at 0 for a start it cannot use, from the start it is given otherwise" |
| 1419 | js ternary test | `page > 10` | `false` | `mcp-server-rules.test.mjs`: "search fails when GitHub cut it short, and ends at the 1,000th result without asking for more" |
| 1432 | js if test | `r.incomplete_results` | `true` | `mcp-server-rules.test.mjs`: "search starts at 0 for a start it cannot use, from the start it is given otherwise" |
| 1432 | js if test | `r.incomplete_results` | `false` | `mcp-server-rules.test.mjs`: "search fails when GitHub cut it short, and ends at the 1,000th result without asking for more" |
| 1441 | js && operand (if) | `r.next_start !== null` | `true` | Not caught, equivalent: null is never at least 1,000, so the guard on null changes nothing |
| 1441 | js if test | `r.next_start !== null && r.next_start >= 1000` | `true` | `mcp-server-rules.test.mjs`: "search keeps next_start when a page fills before the results end" |
| 1441 | js if test | `r.next_start !== null && r.next_start >= 1000` | `false` | Not caught, unreachable: no page past the tenth is read, so next_start never reaches 1,000 |
| 1441 | js && operand (if) | `r.next_start >= 1000` | `true` | `mcp-server-rules.test.mjs`: "search keeps next_start when a page fills before the results end" |
| 1442 | js && operand (if) | `r.next_start === null` | `true` | Not caught, equivalent: a page that reaches the 1,000th result has its next_start set to null just above |
| 1442 | js if test | `r.next_start === null && from + r.count >= 1000` | `true` | `mcp-server-rules.test.mjs`: "search starts at 0 for a start it cannot use, from the start it is given otherwise" |
| 1442 | js if test | `r.next_start === null && from + r.count >= 1000` | `false` | `mcp-server-rules.test.mjs`: "search fails when GitHub cut it short, and ends at the 1,000th result without asking for more" |
| 1442 | js && operand (if) | `from + r.count >= 1000` | `true` | `mcp-server-rules.test.mjs`: "search starts at 0 for a start it cannot use, from the start it is given otherwise" |
| 1464 | js if test | `unvouched(i)` | `true` | `mcp-server-vouched.test.mjs`: "the vouched text is shown as it is" |
| 1464 | js if test | `unvouched(i)` | `false` | `mcp-server-vouched.test.mjs`: "a title or body edited after the vouch is not shown" |
| 1506 | js ternary test | `kind === "issue"` | `true` | `mcp-server-rules.test.mjs`: "triage's reads refuse a kind, terms or number of the wrong type" |
| 1506 | js ternary test | `kind === "issue"` | `false` | `review-screen.test.mjs`: "triage comment_body withholds a body whole" |
| 1520 | js \|\| operand (if) | `typeof terms !== "string"` | `false` | `mcp-server-rules.test.mjs`: "triage's reads refuse a kind, terms or number of the wrong type" |
| 1520 | js if test | `typeof terms !== "string" \|\| terms.trim() === ""` | `true` | `mcp-server-rules.test.mjs`: "search starts at 0 for a start it cannot use, from the start it is given otherwise" |
| 1520 | js if test | `typeof terms !== "string" \|\| terms.trim() === ""` | `false` | `mcp-server-rules.test.mjs`: "triage's reads refuse a kind, terms or number of the wrong type" |
| 1520 | js \|\| operand (if) | `terms.trim() === ""` | `false` | `mcp-server-refusals.test.mjs`: "triage's tools refuse bad arguments, labels it may not move and a second comment" |
| 1525 | js if test | `/(^\|[^A-Za-z0-9_])(repo\|org\|user\|owner):/i.test(terms)` | `true` | `mcp-server-rules.test.mjs`: "search starts at 0 for a start it cannot use, from the start it is given otherwise" |
| 1525 | js if test | `/(^\|[^A-Za-z0-9_])(repo\|org\|user\|owner):/i.test(terms)` | `false` | `review-screen.test.mjs`: "triage search refuses scope qualifiers and fails on another repository's issue" |
| 1536 | js ternary test | `typeof i.repository_url === "string"` | `true` | `review-screen.test.mjs`: "triage search refuses scope qualifiers and fails on another repository's issue" |
| 1536 | js ternary test | `typeof i.repository_url === "string"` | `false` | `mcp-server-rules.test.mjs`: "search starts at 0 for a start it cannot use, from the start it is given otherwise" |
| 1537 | js if test | `!url.toLowerCase().endsWith(own)` | `true` | `mcp-server-rules.test.mjs`: "search starts at 0 for a start it cannot use, from the start it is given otherwise" |
| 1537 | js if test | `!url.toLowerCase().endsWith(own)` | `false` | `review-screen.test.mjs`: "triage search refuses scope qualifiers and fails on another repository's issue" |
| 1551 | js if test | `isKitBotIssue(i)` | `true` | `mcp-server-rules.test.mjs`: "search keeps next_start when a page fills before the results end" |
| 1551 | js if test | `isKitBotIssue(i)` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue never vouched for is withheld by read_issue, search and issue" |
| 1553 | js if test | `v.reason` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for by the operator is shown by read_issue, search and issue" |
| 1553 | js if test | `v.reason` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue never vouched for is withheld by read_issue, search and issue" |
| 1557 | js ternary test | `unvouched({ number: i.number, title, body })` | `true` | `mcp-server-rules.test.mjs`: "search keeps next_start when a page fills before the results end" |
| 1557 | js ternary test | `unvouched({ number: i.number, title, body })` | `false` | `mcp-server-vouched.test.mjs`: "a title or body edited after the vouch is not shown" |
| 1561 | js ternary test | `isKitBotIssue(i)` | `true` | `review-screen.test.mjs`: "triage search and open_prs withhold titles by authors without write access" |
| 1561 | js ternary test | `isKitBotIssue(i)` | `false` | Not caught, equivalent: an App's issue gives no listed reason either way (listedReason passes Apps through) |
| 1577 | js \|\| operand (if) | `!Number.isInteger(number)` | `false` | `mcp-server-rules.test.mjs`: "triage's reads refuse a kind, terms or number of the wrong type" |
| 1577 | js if test | `!Number.isInteger(number) \|\| number <= 0` | `true` | `mcp-server-refusals.test.mjs`: "triage's tools refuse bad arguments, labels it may not move and a second comment" |
| 1577 | js if test | `!Number.isInteger(number) \|\| number <= 0` | `false` | `mcp-server-rules.test.mjs`: "triage's reads refuse a kind, terms or number of the wrong type" |
| 1577 | js \|\| operand (if) | `number <= 0` | `false` | `mcp-server-refusals.test.mjs`: "triage's tools refuse bad arguments, labels it may not move and a second comment" |
| 1580 | js if test | `!ofThisRepo(i)` | `true` | `mcp-server-refusals.test.mjs`: "triage's tools refuse bad arguments, labels it may not move and a second comment" |
| 1580 | js if test | `!ofThisRepo(i)` | `false` | `review-screen.test.mjs`: "triage refuses an issue transferred to another repository" |
| 1581 | js if test | `isPr(i)` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue never vouched for is withheld by read_issue, search and issue" |
| 1581 | js if test | `isPr(i)` | `false` | `mcp-server-refusals.test.mjs`: "triage's tools refuse bad arguments, labels it may not move and a second comment" |
| 1585 | js && operand (if) | `!reason` | `true` | `mcp-server-bot-issues.test.mjs`: "read_issue of the run's own issue gives the lookup's reason when it fails" |
| 1585 | js if test | `!reason && unvouched({ number: i.number, title, body })` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue never vouched for is withheld by read_issue, search and issue" |
| 1585 | js if test | `!reason && unvouched({ number: i.number, title, body })` | `false` | `mcp-server-vouched.test.mjs`: "a title or body edited after the vouch is not shown" |
| 1585 | js && operand (if) | `unvouched({ number: i.number, title, body })` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue never vouched for is withheld by read_issue, search and issue" |
| 1595 | js ternary test | `reason` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue never vouched for is withheld by read_issue, search and issue" |
| 1595 | js ternary test | `reason` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue never vouched for is withheld by read_issue, search and issue" |
| 1625 | js if test | `mention.test('${p.title}\n${p.body \|\| ""}')` | `true` | `mcp-server-rules.test.mjs`: "open_prs reads every page of open pull requests, and comment refuses a body that is not text" |
| 1625 | js if test | `mention.test('${p.title}\n${p.body \|\| ""}')` | `false` | `mcp-server-rules.test.mjs`: "open_prs reads every page of open pull requests, and comment refuses a body that is not text" |
| 1626 | js if test | `raw.length < 100` | `true` | `mcp-server-rules.test.mjs`: "open_prs reads every page of open pull requests, and comment refuses a body that is not text" |
| 1626 | js if test | `raw.length < 100` | `false` | `mcp-server-rules.test.mjs`: "open_prs reads every page of open pull requests, and comment refuses a body that is not text" |
| 1663 | js if test | `!LABELS_ADD.includes(label)` | `true` | `mcp-server.test.mjs`: "nothing is written on an issue closed since the run started" |
| 1663 | js if test | `!LABELS_ADD.includes(label)` | `false` | `mcp-server.test.mjs`: "add_label adds only the bot's labels, never needs-triage" |
| 1665 | js output statement | `gh(["issue", "edit", n, "--repo", repo, "--add-label", label]);` | `void 0;` | `mcp-server.test.mjs`: "add_label adds only the bot's labels, never needs-triage" |
| 1679 | js if test | `LABELS_RESET.includes(label)` | `true` | `mcp-server.test.mjs`: "remove_label takes agent:approved off only on a fresh triage or a later edit" |
| 1679 | js if test | `LABELS_RESET.includes(label)` | `false` | `mcp-server.test.mjs`: "remove_label takes agent:approved off only on a fresh triage or a later edit" |
| 1684 | js \|\| operand (expression) | `["edited", "reopened", "labeled"].includes(event)` | `false` | `mcp-server.test.mjs`: "remove_label takes agent:approved off only on a fresh triage or a later edit" |
| 1685 | js && operand (expression) | `event === "dispatch"` | `true` | `mcp-server.test.mjs`: "remove_label takes agent:approved off only on a fresh triage or a later edit" |
| 1685 | js \|\| operand (expression) | `event === "dispatch" && hasLabel(issue(), "needs-triage")` | `false` | `mcp-server.test.mjs`: "remove_label takes agent:approved off only on a fresh triage or a later edit" |
| 1685 | js && operand (expression) | `hasLabel(issue(), "needs-triage")` | `true` | `mcp-server.test.mjs`: "remove_label takes agent:approved off only on a fresh triage or a later edit" |
| 1686 | js && operand (if) | `!retriage` | `true` | `mcp-server.test.mjs`: "remove_label takes agent:approved off only on a fresh triage or a later edit" |
| 1686 | js if test | `!retriage && !editedAfterApproval().edited_after_approval` | `true` | `mcp-server.test.mjs`: "remove_label takes agent:approved off only on a fresh triage or a later edit" |
| 1686 | js if test | `!retriage && !editedAfterApproval().edited_after_approval` | `false` | `mcp-server.test.mjs`: "remove_label takes agent:approved off only on a fresh triage or a later edit" |
| 1686 | js && operand (if) | `!editedAfterApproval().edited_after_approval` | `true` | `mcp-server.test.mjs`: "remove_label takes agent:approved off only on a fresh triage or a later edit" |
| 1690 | js if test | `label === "in-progress"` | `true` | `mcp-server.test.mjs`: "remove_label takes agent:approved off only on a fresh triage or a later edit" |
| 1690 | js if test | `label === "in-progress"` | `false` | `mcp-server.test.mjs`: "remove_label takes agent:approved off only on a fresh triage or a later edit" |
| 1691 | js if test | `event !== "reopened"` | `true` | `mcp-server.test.mjs`: "remove_label takes agent:approved off only on a fresh triage or a later edit" |
| 1691 | js if test | `event !== "reopened"` | `false` | `mcp-server.test.mjs`: "remove_label takes in-progress off only after a reopen" |
| 1693 | js if test | `!LABELS_REMOVE.includes(label)` | `true` | `mcp-server.test.mjs`: "nothing is written on an issue closed since the run started" |
| 1693 | js if test | `!LABELS_REMOVE.includes(label)` | `false` | `mcp-server.test.mjs`: "remove_label takes agent:approved off only on a fresh triage or a later edit" |
| 1697 | js output statement | `gh(["issue", "edit", n, "--repo", repo, "--remove-label", label]);` | `void 0;` | `mcp-server.test.mjs`: "remove_label takes agent:approved off only on a fresh triage or a later edit" |
| 1711 | js if test | `runState.comment` | `true` | `mcp-server-rules.test.mjs`: "open_prs reads every page of open pull requests, and comment refuses a body that is not text" |
| 1711 | js if test | `runState.comment` | `false` | `mcp-server.test.mjs`: "comment posts once with the run marker and never on a pull request" |
| 1712 | js \|\| operand (if) | `typeof body !== "string"` | `false` | `mcp-server-rules.test.mjs`: "open_prs reads every page of open pull requests, and comment refuses a body that is not text" |
| 1712 | js if test | `typeof body !== "string" \|\| body.trim() === ""` | `true` | `mcp-server.test.mjs`: "nothing is written on an issue closed since the run started" |
| 1712 | js if test | `typeof body !== "string" \|\| body.trim() === ""` | `false` | `mcp-server-rules.test.mjs`: "open_prs reads every page of open pull requests, and comment refuses a body that is not text" |
| 1712 | js \|\| operand (if) | `body.trim() === ""` | `false` | `mcp-server-refusals.test.mjs`: "triage refuses an empty comment" |
| 1716 | js if test | `why` | `true` | `mcp-server.test.mjs`: "comment posts once with the run marker and never on a pull request" |
| 1716 | js if test | `why` | `false` | `public-content-guard.test.mjs`: "triage's comment is checked, and refusing it leaves the run's one comment unspent" |
| 1717 | js output call | `gh( [ "api", "-X", "POST", 'repos/${repo}/issues/${n}/comments', "-F", "body=@-"…` | `"{}"` | `mcp-server.test.mjs`: "comment posts once with the run marker and never on a pull request" |
| 1731 | js output statement | `record({ comment: true });` | `void 0;` | `mcp-server.test.mjs`: "comment posts once with the run marker and never on a pull request" |
| 1752 | js \|\| operand (if) | `!Number.isInteger(number)` | `false` | `mcp-server-rules.test.mjs`: "a sweep dispatches an issue still open and untriaged, or claimed and idle for a week, and nothing else" |
| 1752 | js if test | `!Number.isInteger(number) \|\| number <= 0` | `true` | `mcp-server-rules.test.mjs`: "a sweep starts before its dispatch log exists, and its first dispatch writes it" |
| 1752 | js if test | `!Number.isInteger(number) \|\| number <= 0` | `false` | `mcp-server-rules.test.mjs`: "a sweep dispatches an issue still open and untriaged, or claimed and idle for a week, and nothing else" |
| 1752 | js \|\| operand (if) | `number <= 0` | `false` | `mcp-server-refusals.test.mjs`: "the sweep's dispatch refuses a bad number, one off the list, and a second dispatch" |
| 1755 | js if test | `!eligible.includes(String(number))` | `true` | `mcp-server-rules.test.mjs`: "a sweep starts before its dispatch log exists, and its first dispatch writes it" |
| 1755 | js if test | `!eligible.includes(String(number))` | `false` | `mcp-server.test.mjs`: "dispatch queues a run once per eligible issue still eligible now, and starts none" |
| 1757 | js if test | `dispatched.has(number)` | `true` | `mcp-server-rules.test.mjs`: "a sweep starts before its dispatch log exists, and its first dispatch writes it" |
| 1757 | js if test | `dispatched.has(number)` | `false` | `mcp-server.test.mjs`: "dispatch queues a run once per eligible issue still eligible now, and starts none" |
| 1766 | js callback test | `STATE_LABELS.includes(l)` | `true` | `mcp-server-rules.test.mjs`: "a sweep dispatches an issue still open and untriaged, or claimed and idle for a week, and nothing else" |
| 1766 | js callback test | `STATE_LABELS.includes(l)` | `false` | `mcp-server-rules.test.mjs`: "a sweep dispatches an issue still open and untriaged, or claimed and idle for a week, and nothing else" |
| 1768 | js && operand (expression) | `i.state === "open"` | `true` | `mcp-server-rules.test.mjs`: "a sweep dispatches an issue still open and untriaged, or claimed and idle for a week, and nothing else" |
| 1769 | js \|\| operand (expression) | `labels.includes("needs-triage")` | `false` | `mcp-server.test.mjs`: "dispatch queues a run once per eligible issue still eligible now, and starts none" |
| 1769 | js && operand (expression) | `labels.includes("needs-triage") \|\| state.length === 0 \|\| (labels.includes("in-pr…` | `true` | `mcp-server-rules.test.mjs`: "a sweep dispatches an issue still open and untriaged, or claimed and idle for a week, and nothing else" |
| 1770 | js \|\| operand (expression) | `state.length === 0` | `false` | `mcp-server-rules.test.mjs`: "a sweep dispatches an issue still open and untriaged, or claimed and idle for a week, and nothing else" |
| 1771 | js && operand (expression) | `labels.includes("in-progress")` | `true` | `mcp-server-rules.test.mjs`: "a sweep dispatches an issue still open and untriaged, or claimed and idle for a week, and nothing else" |
| 1771 | js \|\| operand (expression) | `labels.includes("in-progress") && idleDays >= 7` | `false` | `mcp-server-rules.test.mjs`: "a sweep dispatches an issue still open and untriaged, or claimed and idle for a week, and nothing else" |
| 1771 | js && operand (expression) | `idleDays >= 7` | `true` | `mcp-server-rules.test.mjs`: "a sweep dispatches an issue still open and untriaged, or claimed and idle for a week, and nothing else" |
| 1772 | js ternary test | `stillEligible` | `true` | `mcp-server-rules.test.mjs`: "a sweep dispatches an issue still open and untriaged, or claimed and idle for a week, and nothing else" |
| 1772 | js ternary test | `stillEligible` | `false` | `mcp-server-rules.test.mjs`: "a sweep dispatches an issue still open and untriaged, or claimed and idle for a week, and nothing else" |
| 1774 | js ternary test | `i.state !== "open"` | `true` | `mcp-server-rules.test.mjs`: "a sweep dispatches an issue still open and untriaged, or claimed and idle for a week, and nothing else" |
| 1774 | js ternary test | `i.state !== "open"` | `false` | `mcp-server-rules.test.mjs`: "a sweep dispatches an issue still open and untriaged, or claimed and idle for a week, and nothing else" |
| 1776 | js ternary test | `labels.includes("in-progress")` | `true` | `mcp-server-rules.test.mjs`: "a sweep dispatches an issue still open and untriaged, or claimed and idle for a week, and nothing else" |
| 1776 | js ternary test | `labels.includes("in-progress")` | `false` | `mcp-server-rules.test.mjs`: "a sweep dispatches an issue still open and untriaged, or claimed and idle for a week, and nothing else" |
| 1779 | js if test | `skip` | `true` | `mcp-server-rules.test.mjs`: "a sweep dispatches an issue still open and untriaged, or claimed and idle for a week, and nothing else" |
| 1779 | js if test | `skip` | `false` | `mcp-server-rules.test.mjs`: "a sweep dispatches an issue still open and untriaged, or claimed and idle for a week, and nothing else" |
| 1781 | js output statement | `fs.appendFileSync(env.DISPATCH_LOG, '${number}\n');` | `void 0;` | `mcp-server.test.mjs`: "dispatch queues a run once per eligible issue still eligible now, and starts none" |
| 1788 | js output statement | `fs.appendFileSync(env.DISPATCH_QUEUE, '${number}\n');` | `void 0;` | `mcp-server-rules.test.mjs`: "a sweep dispatches an issue still open and untriaged, or claimed and idle for a week, and nothing else" |
| 1790 | js output statement | `fs.appendFileSync(env.DISPATCH_LOG, '${number}\n');` | `void 0;` | `mcp-server-rules.test.mjs`: "a sweep starts before its dispatch log exists, and its first dispatch writes it" |
| 1799 | js if test | `mode === "review"` | `true` | `mcp-server-rules.test.mjs`: "a sweep starts before its dispatch log exists, and its first dispatch writes it" |
| 1799 | js if test | `mode === "review"` | `false` | `mcp-server-rules.test.mjs`: "the server reads the job token from GH_TOKEN_FILE and gives it to gh" |
| 1801 | js \|\| operand (if) | `!digits(pr)` | `false` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 1801 | js if test | `!digits(pr) \|\| !repoName(repo) \|\| !/^[0-9a-f]{40}$/.test(env.HEAD_SHA \|\| "") \|\| …` | `true` | `mcp-server-rules.test.mjs`: "the server reads the job token from GH_TOKEN_FILE and gives it to gh" |
| 1801 | js if test | `!digits(pr) \|\| !repoName(repo) \|\| !/^[0-9a-f]{40}$/.test(env.HEAD_SHA \|\| "") \|\| …` | `false` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 1802 | js \|\| operand (if) | `!repoName(repo)` | `false` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 1803 | js \|\| operand (if) | `!/^[0-9a-f]{40}$/.test(env.HEAD_SHA \|\| "")` | `false` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 1804 | js \|\| operand (if) | `!env.BASE` | `false` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 1805 | js \|\| operand (if) | `!digits(env.GITHUB_RUN_ID)` | `false` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 1806 | js \|\| operand (if) | `!digits(env.GITHUB_RUN_ATTEMPT)` | `false` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 1812 | js if test | `mode === "triage"` | `true` | `mcp-server-rules.test.mjs`: "a sweep starts before its dispatch log exists, and its first dispatch writes it" |
| 1812 | js if test | `mode === "triage"` | `false` | `mcp-server-rules.test.mjs`: "search starts at 0 for a start it cannot use, from the start it is given otherwise" |
| 1814 | js \|\| operand (if) | `!digits(n)` | `false` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 1814 | js if test | `!digits(n) \|\| !repoName(repo) \|\| !digits(env.GITHUB_RUN_ID) \|\| !digits(env.GITHU…` | `true` | `mcp-server-rules.test.mjs`: "search starts at 0 for a start it cannot use, from the start it is given otherwise" |
| 1814 | js if test | `!digits(n) \|\| !repoName(repo) \|\| !digits(env.GITHUB_RUN_ID) \|\| !digits(env.GITHU…` | `false` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 1815 | js \|\| operand (if) | `!repoName(repo)` | `false` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 1816 | js \|\| operand (if) | `!digits(env.GITHUB_RUN_ID)` | `false` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 1817 | js \|\| operand (if) | `!digits(env.GITHUB_RUN_ATTEMPT)` | `false` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 1823 | js if test | `mode === "sweep"` | `true` | `mcp-server-refusals.test.mjs`: "the server refuses an unknown mode" |
| 1823 | js if test | `mode === "sweep"` | `false` | `mcp-server-rules.test.mjs`: "a sweep starts before its dispatch log exists, and its first dispatch writes it" |
| 1825 | js \|\| operand (if) | `!repoName(repo)` | `false` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 1825 | js if test | `!repoName(repo) \|\| !env.ELIGIBLE_ISSUES \|\| !env.DISPATCH_LOG \|\| !env.DISPATCH_QU…` | `true` | `mcp-server-rules.test.mjs`: "a sweep starts before its dispatch log exists, and its first dispatch writes it" |
| 1825 | js if test | `!repoName(repo) \|\| !env.ELIGIBLE_ISSUES \|\| !env.DISPATCH_LOG \|\| !env.DISPATCH_QU…` | `false` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 1826 | js \|\| operand (if) | `!env.ELIGIBLE_ISSUES` | `false` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 1827 | js \|\| operand (if) | `!env.DISPATCH_LOG` | `false` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 1828 | js \|\| operand (if) | `!env.DISPATCH_QUEUE` | `false` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 1829 | js \|\| operand (if) | `!env.GITHUB_REF_NAME` | `false` | `mcp-server-rules.test.mjs`: "each mode refuses to start on a malformed number, repository or run setting" |
| 1844 | js output statement | `process.stdout.write( JSON.stringify(msg) .replace(/\u2028/g, "\\u2028") .replac…` | `void 0;` | `mcp-server-rules.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 1864 | js while test | `(end = pendingInput.indexOf("\n")) !== -1` | `true` | `mcp-server-rules.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 1864 | js while test | `(end = pendingInput.indexOf("\n")) !== -1` | `false` | `mcp-server-rules.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 1871 | js if test | `!line.trim()` | `true` | `mcp-server-rules.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 1871 | js if test | `!line.trim()` | `false` | Not caught, equivalent: a blank line fails JSON.parse just below, which also drops it |
| 1879 | js if test | `method === "initialize"` | `true` | `mcp-server-rules.test.mjs`: "the server reads the job token from GH_TOKEN_FILE and gives it to gh" |
| 1879 | js if test | `method === "initialize"` | `false` | `mcp-server.test.mjs`: "tools/list names every review tool and an unknown tool is an error" |
| 1885 | js \|\| operand (if) | `method === "notifications/initialized"` | `false` | `mcp-server-rules.test.mjs`: "the server answers each request once, a notification never, and an unknown method as one" |
| 1885 | js if test | `method === "notifications/initialized" \|\| method === "ping"` | `true` | `mcp-server-rules.test.mjs`: "the server reads the job token from GH_TOKEN_FILE and gives it to gh" |
| 1885 | js if test | `method === "notifications/initialized" \|\| method === "ping"` | `false` | `mcp-server-rules.test.mjs`: "the server answers each request once, a notification never, and an unknown method as one" |
| 1885 | js \|\| operand (if) | `method === "ping"` | `false` | `mcp-server-rules.test.mjs`: "the server answers each request once, a notification never, and an unknown method as one" |
| 1886 | js if test | `id !== undefined` | `true` | `mcp-server-rules.test.mjs`: "the server answers each request once, a notification never, and an unknown method as one" |
| 1886 | js if test | `id !== undefined` | `false` | `mcp-server-rules.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 1887 | js if test | `method === "tools/list"` | `true` | `mcp-server-rules.test.mjs`: "the server reads the job token from GH_TOKEN_FILE and gives it to gh" |
| 1887 | js if test | `method === "tools/list"` | `false` | `mcp-server.test.mjs`: "tools/list names every review tool and an unknown tool is an error" |
| 1895 | js if test | `method === "tools/call"` | `true` | `mcp-server-rules.test.mjs`: "the server answers each request once, a notification never, and an unknown method as one" |
| 1895 | js if test | `method === "tools/call"` | `false` | `mcp-server-rules.test.mjs`: "the server reads the job token from GH_TOKEN_FILE and gives it to gh" |
| 1898 | js if test | `!t` | `true` | `mcp-server-rules.test.mjs`: "the server reads the job token from GH_TOKEN_FILE and gives it to gh" |
| 1898 | js if test | `!t` | `false` | `mcp-server.test.mjs`: "tools/list names every review tool and an unknown tool is an error" |
| 1906 | js ternary test | `typeof e.stderr === "string"` | `true` | `mcp-server-rules.test.mjs`: "search fails when GitHub cut it short, and ends at the 1,000th result without asking for more" |
| 1906 | js ternary test | `typeof e.stderr === "string"` | `false` | `mcp-server-rules.test.mjs`: "the server answers each request once, a notification never, and an unknown method as one" |
| 1914 | js if test | `id !== undefined` | `true` | `mcp-server-rules.test.mjs`: "the server answers each request once, a notification never, and an unknown method as one" |
| 1914 | js if test | `id !== undefined` | `false` | `mcp-server-rules.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |

</details>

### `.github/workflows/security-scan.yml`

917 rules: 856 caught (11 of them by a time limit, 105 through a copy of their step), 61 left with the reason given.

<details><summary>Every rule of <code>.github/workflows/security-scan.yml</code></summary>

| Line | Kind | Rule | Switched off as | Caught by, or why not |
| --- | --- | --- | --- | --- |
| 68 | if: && operand | `github.event.pull_request.draft == false` | `true` | `security-scan-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people" |
| 68 | if: whole | `github.event.pull_request.draft == false && github.event.pull_request.head.repo.…` | `true` | `security-scan-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people" |
| 68 | if: whole | `github.event.pull_request.draft == false && github.event.pull_request.head.repo.…` | `false` | `security-scan-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people" |
| 69 | if: && operand | `github.event.pull_request.head.repo.full_name == github.repository` | `true` | `security-scan-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people" |
| 70 | if: && operand | `github.event.pull_request.user.login != 'dependabot[bot]'` | `true` | `security-scan-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people" |
| 71 | if: && operand | `!(startsWith(github.head_ref, 'release-please--') && github.event.pull_request.u…` | `true` | `security-scan-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people" |
| 71 | if: && operand | `startsWith(github.head_ref, 'release-please--')` | `true` | `security-scan-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people" |
| 72 | if: && operand | `github.event.pull_request.user.type == 'Bot'` | `true` | `security-scan-conditions.test.mjs`: "the settings job runs for same-repository, non-draft pull requests by people" |
| 141 | sh if whole | `content=$(gh api "repos/$REPO/contents/$file" \ --jq 'if .type != "file" then er…` | `true` | its copy at `pr-review.yml` line 142, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 141 | sh if whole | `content=$(gh api "repos/$REPO/contents/$file" \ --jq 'if .type != "file" then er…` | `false` | its copy at `pr-review.yml` line 142, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 142 | jq if whole | `.type != "file"` | `true` | its copy at `pr-review.yml` line 143, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 142 | jq if whole | `.type != "file"` | `false` | its copy at `pr-review.yml` line 143, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 142 | jq elif whole | `.size > 16384` | `true` | its copy at `pr-review.yml` line 143, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 142 | jq elif whole | `.size > 16384` | `false` | its copy at `pr-review.yml` line 143, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 145 | sh elif whole | `grep -q 'HTTP 404' "$err"` | `true` | its copy at `pr-review.yml` line 146, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 145 | sh elif whole | `grep -q 'HTTP 404' "$err"` | `false` | its copy at `pr-review.yml` line 146, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 160 | sh while \|\| operand | `IFS= read -r l` | `false` | its copy at `pr-review.yml` line 161, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 160 | sh while whole | `IFS= read -r l \|\| [ -n "$l" ]` | `true` | its copy at `pr-review.yml` line 161, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 160 | sh while whole | `IFS= read -r l \|\| [ -n "$l" ]` | `false` | its copy at `pr-review.yml` line 161, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 160 | sh while \|\| operand | `[ -n "$l" ]` | `false` | Not caught, equivalent: the lines come from a here-string, which always ends its last line with a newline (bash 5.2, checked 2026-11-27), so `read` never ends on an unterminated line here |
| 163 | sh if \|\| operand | `[[ "$l" =~ ^[[:space:]]*(#.*)?$ ]]` | `false` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 163 | sh if whole | `[[ "$l" =~ ^[[:space:]]*(#.*)?$ ]] \|\| { [ "$l" = "---" ] && [ "${#at[@]}" -eq 0 …` | `true` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 163 | sh if whole | `[[ "$l" =~ ^[[:space:]]*(#.*)?$ ]] \|\| { [ "$l" = "---" ] && [ "${#at[@]}" -eq 0 …` | `false` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 163 | sh if \|\| operand | `{ [ "$l" = "---" ] && [ "${#at[@]}" -eq 0 ]; }` | `false` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 163 | sh if && operand | `[ "$l" = "---" ]` | `true` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 163 | sh if && operand | `[ "${#at[@]}" -eq 0 ]` | `true` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 164 | sh skip statement | `continue` | `:` | its copy at `pr-review.yml` line 165, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 166 | sh if whole | `! [[ "$l" =~ ^([A-Z][A-Z0-9_]*):(.*)$ ]]` | `true` | its copy at `pr-review.yml` line 167, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 166 | sh if whole | `! [[ "$l" =~ ^([A-Z][A-Z0-9_]*):(.*)$ ]]` | `false` | its copy at `pr-review.yml` line 167, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 171 | sh if whole | `[[ " ${known[*]} " != *" $name "* ]]` | `true` | its copy at `pr-review.yml` line 172, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 171 | sh if whole | `[[ " ${known[*]} " != *" $name "* ]]` | `false` | its copy at `pr-review.yml` line 172, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 173 | sh case arm | `*KEY* \| *TOKEN* \| *SECRET* \| *PASSWORD*` | `__mutant_never__` | its copy at `pr-review.yml` line 174, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 175 | sh case arm | `KIT_*` | `__mutant_never__` | its copy at `pr-review.yml` line 176, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 177 | sh case arm | `*` | `__mutant_never__` | its copy at `pr-review.yml` line 178, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 182 | sh if whole | `[ -n "${at[$name]:-}" ]` | `true` | its copy at `pr-review.yml` line 183, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 182 | sh if whole | `[ -n "${at[$name]:-}" ]` | `false` | its copy at `pr-review.yml` line 183, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 186 | sh if whole | `! [[ "$rest" =~ $pair ]]` | `true` | its copy at `pr-review.yml` line 187, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 186 | sh if whole | `! [[ "$rest" =~ $pair ]]` | `false` | its copy at `pr-review.yml` line 187, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 200 | sh if whole | `[ -n "$v" ]` | `true` | its copy at `pr-review.yml` line 201, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 200 | sh if whole | `[ -n "$v" ]` | `false` | its copy at `pr-review.yml` line 201, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 202 | sh elif whole | `[ -n "${value[$name]:-}" ]` | `true` | its copy at `pr-review.yml` line 203, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 202 | sh elif whole | `[ -n "${value[$name]:-}" ]` | `false` | its copy at `pr-review.yml` line 203, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 208 | sh if whole | `! [[ "$v" =~ ^$word*$ ]]` | `true` | its copy at `pr-review.yml` line 209, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 208 | sh if whole | `! [[ "$v" =~ ^$word*$ ]]` | `false` | its copy at `pr-review.yml` line 209, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 215 | sh case arm | `KIT_REVIEW_MODE \| KIT_SECURITY_SCAN` | `__mutant_never__` | its copy at `pr-review.yml` line 216, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 216 | sh case arm | `KIT_ISSUE_TRIAGE \| KIT_UPDATE_CHECK \| KIT_ISSUE_LINK_CHECK` | `__mutant_never__` | its copy at `pr-review.yml` line 217, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 217 | sh case arm | `*` | `__mutant_never__` | its copy at `pr-review.yml` line 218, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 219 | sh if && operand | `[ -n "$states" ]` | `true` | its copy at `pr-review.yml` line 220, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 219 | sh if whole | `[ -n "$states" ] && [ -n "$v" ] && [[ " $states " != *" $v "* ]]` | `true` | its copy at `pr-review.yml` line 220, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 219 | sh if whole | `[ -n "$states" ] && [ -n "$v" ] && [[ " $states " != *" $v "* ]]` | `false` | its copy at `pr-review.yml` line 220, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 219 | sh if && operand | `[ -n "$v" ]` | `true` | its copy at `pr-review.yml` line 220, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 219 | sh if && operand | `[[ " $states " != *" $v "* ]]` | `true` | its copy at `pr-review.yml` line 220, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 223 | sh output statement | (before `echo "$name=$v" >> "$GITHUB_ENV"`) | `: ` | its copy at `pr-review.yml` line 224, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 224 | sh output statement | (before `echo "FROM_$name=$from" >> "$GITHUB_ENV"`) | `: ` | its copy at `pr-review.yml` line 225, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 234 | if: \|\| operand | `env.KIT_SECURITY_SCAN == 'push'` | `false` | `security-scan-conditions.test.mjs`: "the scan settings are read only while the scan is on" |
| 234 | if: whole | `env.KIT_SECURITY_SCAN == 'push' \|\| env.KIT_SECURITY_SCAN == 'open'` | `true` | `security-scan-conditions.test.mjs`: "the scan settings are read only while the scan is on" |
| 234 | if: whole | `env.KIT_SECURITY_SCAN == 'push' \|\| env.KIT_SECURITY_SCAN == 'open'` | `false` | `security-scan-conditions.test.mjs`: "the scan settings are read only while the scan is on" |
| 234 | if: \|\| operand | `env.KIT_SECURITY_SCAN == 'open'` | `false` | `security-scan-conditions.test.mjs`: "the scan settings are read only while the scan is on" |
| 250 | sh list condition | `[ -n "$value" ]` | `true` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 250 | sh list condition | `[ -n "$value" ]` | `false` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 251 | sh if \|\| operand | `! [[ "$value" =~ ^[1-9][0-9]*$ ]]` | `false` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 251 | sh if whole | `! [[ "$value" =~ ^[1-9][0-9]*$ ]] \|\| [ "${#value}" -gt 6 ] \|\| [ "$value" -gt "$m…` | `true` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 251 | sh if whole | `! [[ "$value" =~ ^[1-9][0-9]*$ ]] \|\| [ "${#value}" -gt 6 ] \|\| [ "$value" -gt "$m…` | `false` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 251 | sh if \|\| operand | `[ "${#value}" -gt 6 ]` | `false` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 251 | sh if \|\| operand | `[ "$value" -gt "$max" ]` | `false` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 255 | sh output statement | (before `echo "$name=$value" >> "$GITHUB_ENV"`) | `: ` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 261 | sh list condition | `[ -n "$value" ]` | `true` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 261 | sh list condition | `[ -n "$value" ]` | `false` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 262 | sh if whole | `! [[ "$value" =~ ^claude-[a-z0-9.-]+$ ]]` | `true` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 262 | sh if whole | `! [[ "$value" =~ ^claude-[a-z0-9.-]+$ ]]` | `false` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 266 | sh output statement | (before `echo "$name=$value" >> "$GITHUB_ENV"`) | `: ` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 274 | sh list condition | `[ -n "$value" ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 274 | sh list condition | `[ -n "$value" ]` | `false` | `model-provider.test.mjs`: "security-scan.yml: the provider sets which model names the settings step takes" |
| 275 | sh if whole | `! [[ "$value" =~ ^[a-z0-9][a-z0-9.-]*$ ]]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 275 | sh if whole | `! [[ "$value" =~ ^[a-z0-9][a-z0-9.-]*$ ]]` | `false` | `model-provider.test.mjs`: "security-scan.yml: the provider sets which model names the settings step takes" |
| 279 | sh if whole | `[[ "$value" == *-contributor ]]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 279 | sh if whole | `[[ "$value" == *-contributor ]]` | `false` | `model-provider.test.mjs`: "security-scan.yml: the provider sets which model names the settings step takes" |
| 283 | sh output statement | (before `echo "$name=$value" >> "$GITHUB_ENV"`) | `: ` | `scan-opencode.test.mjs`: "security-scan.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 294 | sh list condition | `[ -n "$value" ]` | `true` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 294 | sh list condition | `[ -n "$value" ]` | `false` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 295 | sh if && operand | `[ -n "$value" ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 295 | sh if whole | `[ -n "$value" ] && ! [[ "$value" =~ ^(low\|medium\|high\|xhigh\|max)$ ]]` | `true` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 295 | sh if whole | `[ -n "$value" ] && ! [[ "$value" =~ ^(low\|medium\|high\|xhigh\|max)$ ]]` | `false` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 295 | sh if && operand | `! [[ "$value" =~ ^(low\|medium\|high\|xhigh\|max)$ ]]` | `true` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 299 | sh output statement | (before `echo "$name=$value" >> "$GITHUB_ENV"`) | `: ` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 322 | sh case arm | `''` | `__mutant_never__` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 324 | sh list condition | `[ "$PROVIDER" != opencode-go ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 324 | sh list condition | `[ "$PROVIDER" != opencode-go ]` | `false` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 325 | sh case arm | `claude-code` | `__mutant_never__` | `scan-opencode.test.mjs`: "security-scan.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 327 | sh if whole | `[ "$PROVIDER" = opencode-go ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 327 | sh if whole | `[ "$PROVIDER" = opencode-go ]` | `false` | `scan-opencode.test.mjs`: "security-scan.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 330 | sh case arm | `opencode` | `__mutant_never__` | `scan-opencode.test.mjs`: "security-scan.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 331 | sh if whole | `[ "$PROVIDER" != opencode-go ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 331 | sh if whole | `[ "$PROVIDER" != opencode-go ]` | `false` | `scan-opencode.test.mjs`: "security-scan.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 336 | sh case arm | `*` | `__mutant_never__` | `scan-opencode.test.mjs`: "security-scan.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 340 | sh output statement | (before `echo "KIT_SECURITY_RUNNER=$runner" >> "$GITHUB_ENV"`) | `: ` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 343 | sh case arm | `''\|anthropic` | `__mutant_never__` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 344 | sh output statement | (before `echo "KIT_SECURITY_PROVIDER=anthropic" >> "$GITHUB_ENV"`) | `: ` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 348 | sh case arm | `opencode-go` | `__mutant_never__` | `scan-opencode.test.mjs`: "security-scan.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 349 | sh output statement | (before `echo "KIT_SECURITY_PROVIDER=opencode-go" >> "$GITHUB_ENV"`) | `: ` | `model-provider.test.mjs`: "security-scan.yml: the provider sets which model names the settings step takes" |
| 353 | sh case arm | `*` | `__mutant_never__` | `kit-settings.test.mjs`: "a value out of range names where it came from" |
| 377 | if: && operand | `github.run_attempt == 1` | `true` | `security-scan-conditions.test.mjs`: "the early skip looks at a body or title edit, and at a push in open mode, on a first attempt" |
| 377 | if: whole | `github.run_attempt == 1 && (env.KIT_SECURITY_SCAN == 'push' \|\| env.KIT_SECURITY_…` | `true` | `security-scan-conditions.test.mjs`: "the early skip looks at a body or title edit, and at a push in open mode, on a first attempt" |
| 377 | if: whole | `github.run_attempt == 1 && (env.KIT_SECURITY_SCAN == 'push' \|\| env.KIT_SECURITY_…` | `false` | `security-scan-conditions.test.mjs`: "the early skip looks at a body or title edit, and at a push in open mode, on a first attempt" |
| 378 | if: && operand | `(env.KIT_SECURITY_SCAN == 'push' \|\| env.KIT_SECURITY_SCAN == 'open')` | `true` | `security-scan-conditions.test.mjs`: "the early skip looks at a body or title edit, and at a push in open mode, on a first attempt" |
| 378 | if: \|\| operand | `env.KIT_SECURITY_SCAN == 'push'` | `false` | `security-scan-conditions.test.mjs`: "the early skip looks at a body or title edit, and at a push in open mode, on a first attempt" |
| 378 | if: \|\| operand | `env.KIT_SECURITY_SCAN == 'open'` | `false` | `security-scan-conditions.test.mjs`: "the early skip looks at a body or title edit, and at a push in open mode, on a first attempt" |
| 379 | if: && operand | `((github.event.action == 'edited' && github.event.changes.base == null) \|\| (gith…` | `true` | `security-scan-conditions.test.mjs`: "the early skip looks at a body or title edit, and at a push in open mode, on a first attempt" |
| 379 | if: \|\| operand | `(github.event.action == 'edited' && github.event.changes.base == null)` | `false` | `security-scan-conditions.test.mjs`: "the early skip looks at a body or title edit, and at a push in open mode, on a first attempt" |
| 379 | if: && operand | `github.event.action == 'edited'` | `true` | `security-scan-conditions.test.mjs`: "the early skip looks at a body or title edit, and at a push in open mode, on a first attempt" |
| 379 | if: && operand | `github.event.changes.base == null` | `true` | `security-scan-conditions.test.mjs`: "the early skip looks at a body or title edit, and at a push in open mode, on a first attempt" |
| 380 | if: \|\| operand | `(github.event.action == 'synchronize' && env.KIT_SECURITY_SCAN == 'open')` | `false` | `security-scan-conditions.test.mjs`: "the early skip looks at a body or title edit, and at a push in open mode, on a first attempt" |
| 380 | if: && operand | `github.event.action == 'synchronize'` | `true` | `security-scan-conditions.test.mjs`: "the early skip looks at a body or title edit, and at a push in open mode, on a first attempt" |
| 380 | if: && operand | `env.KIT_SECURITY_SCAN == 'open'` | `true` | `security-scan-conditions.test.mjs`: "the early skip looks at a body or title edit, and at a push in open mode, on a first attempt" |
| 398 | jq select and operand | `.user.login == "github-actions[bot]"` | `true` | `security-scan-skip.test.mjs`: "only the bot's comments that start with the record's marker count, for the record and the notice" |
| 398 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| startswith("<!-- security-scan…` | `true` | `security-scan-skip.test.mjs`: "only the bot's comments that start with the record's marker count, for the record and the notice" |
| 398 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| startswith("<!-- security-scan…` | `false` | `security-scan-skip.test.mjs`: "a re-run that the record covers takes its own not-completed notice down, in both copies" |
| 398 | jq select and operand | `(.body \| startswith("<!-- security-scan-record -->"))` | `true` | `security-scan-skip.test.mjs`: "only the bot's comments that start with the record's marker count, for the record and the notice" |
| 399 | sh list condition | `[ -n "$id" ]` | `true` | `security-scan-skip.test.mjs`: "a record gone by the notice lookup leaves the skip and edits nothing, in both copies" |
| 399 | sh list condition | `[ -n "$id" ]` | `false` | `security-scan-skip.test.mjs`: "a re-run that the record covers takes its own not-completed notice down, in both copies" |
| 399 | sh skip statement | `return 0` | `:` | `security-scan-skip.test.mjs`: "a record gone by the notice lookup leaves the skip and edits nothing, in both copies" |
| 401 | sh list condition | `grep -qxF "<!-- scan-not-completed-run $GITHUB_RUN_ID -->" <<<"$body"` | `true` | `security-scan-skip.test.mjs`: "an edit the record covers skips, in the early copy too, and writes nothing" |
| 401 | sh list condition | `grep -qxF "<!-- scan-not-completed-run $GITHUB_RUN_ID -->" <<<"$body"` | `false` | `security-scan-skip.test.mjs`: "a re-run that the record covers takes its own not-completed notice down, in both copies" |
| 401 | sh skip statement | `return 0` | `:` | `security-scan-skip.test.mjs`: "an edit the record covers skips, in the early copy too, and writes nothing" |
| 403 | sh output statement | (before `gh api --method PATCH "repos/$REPO/issues/comments/$id" -f b`) | `: ` | `security-scan-skip.test.mjs`: "a re-run that the record covers takes its own not-completed notice down, in both copies" |
| 411 | jq select and operand | `.user.login == "github-actions[bot]"` | `true` | `security-scan-skip.test.mjs`: "only the bot's comments that start with the record's marker count, for the record and the notice" |
| 411 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| startswith("<!-- security-scan…` | `true` | `security-scan-skip.test.mjs`: "only the bot's comments that start with the record's marker count, for the record and the notice" |
| 411 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| startswith("<!-- security-scan…` | `false` | `security-scan-skip.test.mjs`: "an edit the record covers skips, in the early copy too, and writes nothing" |
| 411 | jq select and operand | `(.body \| startswith("<!-- security-scan-record -->"))` | `true` | `security-scan-skip.test.mjs`: "only the bot's comments that start with the record's marker count, for the record and the notice" |
| 413 | sh if whole | `[ "$ACTION" = "synchronize" ]` | `true` | `security-scan-skip.test.mjs`: "an edit the record covers skips, in the early copy too, and writes nothing" |
| 413 | sh if whole | `[ "$ACTION" = "synchronize" ]` | `false` | `security-scan-skip.test.mjs`: "a push in mode open skips once a scan has completed, and scans before" |
| 414 | sh if whole | `[ -n "$record" ]` | `true` | `security-scan-skip.test.mjs`: "a push in mode open skips once a scan has completed, and scans before" |
| 414 | sh if whole | `[ -n "$record" ]` | `false` | `security-scan-skip.test.mjs`: "a push in mode open skips once a scan has completed, and scans before" |
| 417 | sh output statement | (before `echo "RUN=false" >> "$GITHUB_ENV"`) | `: ` | `security-scan-skip.test.mjs`: "a push in mode open skips once a scan has completed, and scans before" |
| 421 | sh skip statement | `exit 0` | `:` | `security-scan-skip.test.mjs`: "a push in mode open skips once a scan has completed, and scans before" |
| 434 | sh if && operand | `[ -n "$record" ]` | `true` | Not caught, equivalent: with no record, the recorded base is empty and never equals "$BASE at <sha>" |
| 434 | sh if whole | `[ -n "$record" ] && [ "$rec_base" = "$BASE at $base_now" ]` | `true` | its copy at `security-scan.yml` line 565, which "the settings job's early copy is the scan job's step, byte for byte" holds to this step byte for byte |
| 434 | sh if whole | `[ -n "$record" ] && [ "$rec_base" = "$BASE at $base_now" ]` | `false` | `security-scan-skip.test.mjs`: "an edit the record covers skips, in the early copy too, and writes nothing" |
| 434 | sh if && operand | `[ "$rec_base" = "$BASE at $base_now" ]` | `true` | its copy at `security-scan.yml` line 565, which "the settings job's early copy is the scan job's step, byte for byte" holds to this step byte for byte |
| 435 | sh if \|\| operand | `[ "$MODE" = "open" ]` | `false` | its copy at `security-scan.yml` line 566, which "the settings job's early copy is the scan job's step, byte for byte" holds to this step byte for byte |
| 435 | sh if whole | `[ "$MODE" = "open" ] \|\| [ "$rec_head" = "$HEAD" ]` | `true` | `security-scan-skip.test.mjs`: "only the bot's comments that start with the record's marker count, for the record and the notice" |
| 435 | sh if whole | `[ "$MODE" = "open" ] \|\| [ "$rec_head" = "$HEAD" ]` | `false` | `security-scan-skip.test.mjs`: "an edit the record covers skips, in the early copy too, and writes nothing" |
| 435 | sh if \|\| operand | `[ "$rec_head" = "$HEAD" ]` | `false` | `security-scan-skip.test.mjs`: "an edit the record covers skips, in the early copy too, and writes nothing" |
| 437 | sh if whole | `[ "$covered" -eq 1 ]` | `true` | `security-scan-skip.test.mjs`: "only the bot's comments that start with the record's marker count, for the record and the notice" |
| 437 | sh if whole | `[ "$covered" -eq 1 ]` | `false` | `security-scan-skip.test.mjs`: "an edit the record covers skips, in the early copy too, and writes nothing" |
| 440 | sh output statement | (before `echo "RUN=false" >> "$GITHUB_ENV"`) | `: ` | `security-scan-skip.test.mjs`: "an edit the record covers skips, in the early copy too, and writes nothing" |
| 450 | sh output statement | (before `printf '%s=%s\n' "$name" "${!name}" >> "$GITHUB_OUTPUT"`) | `: ` | `security-scan-skip.test.mjs`: "the settings job passes the early skip on, and only a skip" |
| 452 | sh if whole | `[ "${RUN:-}" = false ]` | `true` | `security-scan-skip.test.mjs`: "the settings job passes the early skip on, and only a skip" |
| 452 | sh if whole | `[ "${RUN:-}" = false ]` | `false` | `security-scan-skip.test.mjs`: "the settings job passes the early skip on, and only a skip" |
| 453 | sh output statement | (before `echo "SKIP=true" >> "$GITHUB_OUTPUT"`) | `: ` | `security-scan-skip.test.mjs`: "the settings job passes the early skip on, and only a skip" |
| 473 | if: whole | `${{ !cancelled() && (needs.settings.result == 'failure' \|\| (needs.settings.outpu…` | `true` | `security-scan-conditions.test.mjs`: "the scan job runs while the scan is on and the early skip found something, and when the settings failed" |
| 473 | if: whole | `${{ !cancelled() && (needs.settings.result == 'failure' \|\| (needs.settings.outpu…` | `false` | `security-scan-conditions.test.mjs`: "the scan job runs while the scan is on and the early skip found something, and when the settings failed" |
| 473 | if: && operand | `!cancelled()` | `true` | `security-scan-conditions.test.mjs`: "the scan job runs while the scan is on and the early skip found something, and when the settings failed" |
| 473 | if: && operand | `(needs.settings.result == 'failure' \|\| (needs.settings.outputs.SKIP != 'true' &&…` | `true` | `security-scan-conditions.test.mjs`: "the scan job runs while the scan is on and the early skip found something, and when the settings failed" |
| 473 | if: \|\| operand | `needs.settings.result == 'failure'` | `false` | `security-scan-conditions.test.mjs`: "the scan job runs while the scan is on and the early skip found something, and when the settings failed" |
| 473 | if: \|\| operand | `(needs.settings.outputs.SKIP != 'true' && (needs.settings.outputs.KIT_SECURITY_S…` | `false` | `security-scan-conditions.test.mjs`: "the scan job runs while the scan is on and the early skip found something, and when the settings failed" |
| 473 | if: && operand | `needs.settings.outputs.SKIP != 'true'` | `true` | `security-scan-conditions.test.mjs`: "the scan job runs while the scan is on and the early skip found something, and when the settings failed" |
| 473 | if: && operand | `(needs.settings.outputs.KIT_SECURITY_SCAN == 'push' \|\| needs.settings.outputs.KI…` | `true` | `security-scan-conditions.test.mjs`: "the scan job runs while the scan is on and the early skip found something, and when the settings failed" |
| 473 | if: \|\| operand | `needs.settings.outputs.KIT_SECURITY_SCAN == 'push'` | `false` | `security-scan-conditions.test.mjs`: "the scan job runs while the scan is on and the early skip found something, and when the settings failed" |
| 473 | if: \|\| operand | `needs.settings.outputs.KIT_SECURITY_SCAN == 'open'` | `false` | `security-scan-conditions.test.mjs`: "the scan job runs while the scan is on and the early skip found something, and when the settings failed" |
| 495 | if: whole | `needs.settings.result == 'failure'` | `true` | `security-scan-conditions.test.mjs`: "the scan job runs while the scan is on and the early skip found something, and when the settings failed" |
| 495 | if: whole | `needs.settings.result == 'failure'` | `false` | `security-scan-conditions.test.mjs`: "the scan job runs while the scan is on and the early skip found something, and when the settings failed" |
| 513 | if: \|\| operand | `(github.event.action == 'edited' && github.event.changes.base == null)` | `false` | `security-scan-conditions.test.mjs`: "the scan job's skip looks at a body or title edit, and at a push in open mode" |
| 513 | if: whole | `(github.event.action == 'edited' && github.event.changes.base == null) \|\| (githu…` | `true` | `security-scan-conditions.test.mjs`: "the scan job's skip looks at a body or title edit, and at a push in open mode" |
| 513 | if: whole | `(github.event.action == 'edited' && github.event.changes.base == null) \|\| (githu…` | `false` | `security-scan-conditions.test.mjs`: "the scan job's skip looks at a body or title edit, and at a push in open mode" |
| 513 | if: && operand | `github.event.action == 'edited'` | `true` | `security-scan-conditions.test.mjs`: "the scan job's skip looks at a body or title edit, and at a push in open mode" |
| 513 | if: && operand | `github.event.changes.base == null` | `true` | `security-scan-conditions.test.mjs`: "the scan job's skip looks at a body or title edit, and at a push in open mode" |
| 513 | if: \|\| operand | `(github.event.action == 'synchronize' && env.KIT_SECURITY_SCAN == 'open')` | `false` | `security-scan-conditions.test.mjs`: "the scan job's skip looks at a body or title edit, and at a push in open mode" |
| 513 | if: && operand | `github.event.action == 'synchronize'` | `true` | `security-scan-conditions.test.mjs`: "the scan job's skip looks at a body or title edit, and at a push in open mode" |
| 513 | if: && operand | `env.KIT_SECURITY_SCAN == 'open'` | `true` | `security-scan-conditions.test.mjs`: "the scan job's skip looks at a body or title edit, and at a push in open mode" |
| 529 | jq select and operand | `.user.login == "github-actions[bot]"` | `true` | `security-scan-skip.test.mjs`: "only the bot's comments that start with the record's marker count, for the record and the notice" |
| 529 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| startswith("<!-- security-scan…` | `true` | `security-scan-skip.test.mjs`: "only the bot's comments that start with the record's marker count, for the record and the notice" |
| 529 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| startswith("<!-- security-scan…` | `false` | `security-scan-skip.test.mjs`: "a re-run that the record covers takes its own not-completed notice down, in both copies" |
| 529 | jq select and operand | `(.body \| startswith("<!-- security-scan-record -->"))` | `true` | `security-scan-skip.test.mjs`: "only the bot's comments that start with the record's marker count, for the record and the notice" |
| 530 | sh list condition | `[ -n "$id" ]` | `true` | `security-scan-skip.test.mjs`: "a record gone by the notice lookup leaves the skip and edits nothing, in both copies" |
| 530 | sh list condition | `[ -n "$id" ]` | `false` | `security-scan-skip.test.mjs`: "a re-run that the record covers takes its own not-completed notice down, in both copies" |
| 530 | sh skip statement | `return 0` | `:` | `security-scan-skip.test.mjs`: "a record gone by the notice lookup leaves the skip and edits nothing, in both copies" |
| 532 | sh list condition | `grep -qxF "<!-- scan-not-completed-run $GITHUB_RUN_ID -->" <<<"$body"` | `true` | `security-scan-skip.test.mjs`: "an edit the record covers skips, in the early copy too, and writes nothing" |
| 532 | sh list condition | `grep -qxF "<!-- scan-not-completed-run $GITHUB_RUN_ID -->" <<<"$body"` | `false` | `security-scan-skip.test.mjs`: "a re-run that the record covers takes its own not-completed notice down, in both copies" |
| 532 | sh skip statement | `return 0` | `:` | `security-scan-skip.test.mjs`: "an edit the record covers skips, in the early copy too, and writes nothing" |
| 534 | sh output statement | (before `gh api --method PATCH "repos/$REPO/issues/comments/$id" -f b`) | `: ` | `security-scan-skip.test.mjs`: "a re-run that the record covers takes its own not-completed notice down, in both copies" |
| 542 | jq select and operand | `.user.login == "github-actions[bot]"` | `true` | `security-scan-skip.test.mjs`: "only the bot's comments that start with the record's marker count, for the record and the notice" |
| 542 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| startswith("<!-- security-scan…` | `true` | `security-scan-skip.test.mjs`: "only the bot's comments that start with the record's marker count, for the record and the notice" |
| 542 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| startswith("<!-- security-scan…` | `false` | `security-scan-skip.test.mjs`: "an edit the record covers skips, in the early copy too, and writes nothing" |
| 542 | jq select and operand | `(.body \| startswith("<!-- security-scan-record -->"))` | `true` | `security-scan-skip.test.mjs`: "only the bot's comments that start with the record's marker count, for the record and the notice" |
| 544 | sh if whole | `[ "$ACTION" = "synchronize" ]` | `true` | `security-scan-skip.test.mjs`: "an edit the record covers skips, in the early copy too, and writes nothing" |
| 544 | sh if whole | `[ "$ACTION" = "synchronize" ]` | `false` | its copy at `security-scan.yml` line 413, which "the settings job's early copy is the scan job's step, byte for byte" holds to this step byte for byte |
| 545 | sh if whole | `[ -n "$record" ]` | `true` | its copy at `security-scan.yml` line 414, which "the settings job's early copy is the scan job's step, byte for byte" holds to this step byte for byte |
| 545 | sh if whole | `[ -n "$record" ]` | `false` | `security-scan-skip.test.mjs`: "a re-run that the record covers takes its own not-completed notice down, in both copies" |
| 548 | sh output statement | (before `echo "RUN=false" >> "$GITHUB_ENV"`) | `: ` | `security-scan-skip.test.mjs`: "a re-run that the record covers takes its own not-completed notice down, in both copies" |
| 552 | sh skip statement | `exit 0` | `:` | `security-scan-skip.test.mjs`: "a re-run that the record covers takes its own not-completed notice down, in both copies" |
| 565 | sh if && operand | `[ -n "$record" ]` | `true` | Not caught, equivalent: with no record, the recorded base is empty and never equals "$BASE at <sha>" |
| 565 | sh if whole | `[ -n "$record" ] && [ "$rec_base" = "$BASE at $base_now" ]` | `true` | `security-scan-skip.test.mjs`: "an edit after the base moved scans" |
| 565 | sh if whole | `[ -n "$record" ] && [ "$rec_base" = "$BASE at $base_now" ]` | `false` | `security-scan-skip.test.mjs`: "an edit the record covers skips, in the early copy too, and writes nothing" |
| 565 | sh if && operand | `[ "$rec_base" = "$BASE at $base_now" ]` | `true` | `security-scan-skip.test.mjs`: "an edit after the base moved scans" |
| 566 | sh if \|\| operand | `[ "$MODE" = "open" ]` | `false` | `security-scan-skip.test.mjs`: "an edit of a later head scans in mode push and skips in mode open" |
| 566 | sh if whole | `[ "$MODE" = "open" ] \|\| [ "$rec_head" = "$HEAD" ]` | `true` | `security-scan-skip.test.mjs`: "an edit of a later head scans in mode push and skips in mode open" |
| 566 | sh if whole | `[ "$MODE" = "open" ] \|\| [ "$rec_head" = "$HEAD" ]` | `false` | `security-scan-skip.test.mjs`: "an edit the record covers skips, in the early copy too, and writes nothing" |
| 566 | sh if \|\| operand | `[ "$rec_head" = "$HEAD" ]` | `false` | `security-scan-skip.test.mjs`: "an edit the record covers skips, in the early copy too, and writes nothing" |
| 568 | sh if whole | `[ "$covered" -eq 1 ]` | `true` | `security-scan-skip.test.mjs`: "an edit after the base moved scans" |
| 568 | sh if whole | `[ "$covered" -eq 1 ]` | `false` | `security-scan-skip.test.mjs`: "an edit the record covers skips, in the early copy too, and writes nothing" |
| 571 | sh output statement | (before `echo "RUN=false" >> "$GITHUB_ENV"`) | `: ` | `security-scan-skip.test.mjs`: "an edit the record covers skips, in the early copy too, and writes nothing" |
| 582 | if: whole | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 582 | if: whole | `env.RUN != 'false'` | `false` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 592 | sh case arm | `admin\|write` | `__mutant_never__` | `workflow-guards.test.mjs`: "security-scan.yml: the gate refuses an author or actor without write access" |
| 593 | sh case arm | `*` | `__mutant_never__` | `workflow-guards.test.mjs`: "security-scan.yml: the gate refuses an author or actor without write access" |
| 600 | if: whole | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 600 | if: whole | `env.RUN != 'false'` | `false` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 611 | if: whole | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 611 | if: whole | `env.RUN != 'false'` | `false` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 614 | sh output statement | (before `rm -rf -- .claude .mcp.json .claude.json CLAUDE.local.md .gi`) | `: ` | `workflow-guards.test.mjs`: "security-scan.yml: the head's executable Claude configuration is removed" |
| 627 | if: whole | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 627 | if: whole | `env.RUN != 'false'` | `false` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 636 | sh output statement | (before `xargs -0 -r rm -rf --`) | `: ` | `security-scan.test.mjs`: "the scan's rules come from the base, and no CLAUDE.md is left to load" |
| 646 | sh if whole | `git cat-file -e "origin/$BASE:$f" 2>/dev/null` | `true` | `security-scan.test.mjs`: "the scan's rules come from the base, and no CLAUDE.md is left to load" |
| 646 | sh if whole | `git cat-file -e "origin/$BASE:$f" 2>/dev/null` | `false` | `security-scan.test.mjs`: "the scan's rules come from the base, and no CLAUDE.md is left to load" |
| 650 | sh while whole | `[ "${rest#*/}" != "$rest" ]` | `true` | `security-scan.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 650 | sh while whole | `[ "${rest#*/}" != "$rest" ]` | `false` | `security-scan.test.mjs`: "a head that made a rule's parent a symlink cannot take the restore elsewhere" |
| 652 | sh list condition | `[ -L "$dir" ]` | `false` | `security-scan.test.mjs`: "a head that made a rule's parent a symlink cannot take the restore elsewhere" |
| 652 | sh list condition | `[ -L "$dir" ]` | `true` | `security-scan.test.mjs`: "the scan's rules come from the base, and no CLAUDE.md is left to load" |
| 652 | sh output statement | (before `rm -f -- "$dir"`) | `: ` | `security-scan.test.mjs`: "a head that made a rule's parent a symlink cannot take the restore elsewhere" |
| 654 | sh output statement | (before `rm -rf -- "$f"`) | `: ` | Not caught, equivalent: git checkout replaces a file, directory or symlink at the path itself (git 2.54, checked 2026-11-26), so the removal before it changes nothing |
| 655 | sh output statement | (before `git checkout "origin/$BASE" -- "$f"`) | `: ` | `security-scan.test.mjs`: "the scan's rules come from the base, and no CLAUDE.md is left to load" |
| 659 | sh list condition | `git cat-file -e "origin/$BASE:$f" 2>/dev/null` | `true` | `security-scan.test.mjs`: "the scan's rules come from the base, and no CLAUDE.md is left to load" |
| 659 | sh list condition | `git cat-file -e "origin/$BASE:$f" 2>/dev/null` | `false` | `security-scan.test.mjs`: "the scan's rules come from the base, and no CLAUDE.md is left to load" |
| 659 | sh output statement | (before `rm -f -- "$f"`) | `: ` | `security-scan.test.mjs`: "the scan's rules come from the base, and no CLAUDE.md is left to load" |
| 664 | sh if whole | `! git cat-file -e "origin/$BASE:.github/security-review-instructions.md" 2>/dev/…` | `true` | `security-scan.test.mjs`: "a base that ships scan instructions keeps its own copy" |
| 664 | sh if whole | `! git cat-file -e "origin/$BASE:.github/security-review-instructions.md" 2>/dev/…` | `false` | `security-scan.test.mjs`: "the scan's rules come from the base, and no CLAUDE.md is left to load" |
| 665 | sh output statement | (before `rm -f -- .github/security-review-instructions.md`) | `: ` | `security-scan.test.mjs`: "the scan's rules come from the base, and no CLAUDE.md is left to load" |
| 680 | if: whole | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 680 | if: whole | `env.RUN != 'false'` | `false` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 686 | sh skip statement | `break` | `:` | `security-scan-log-content.test.mjs`: "a base that cannot be read leaves the check unusable, naming the first path" |
| 687 | sh list condition | `[ -n "$entry" ]` | `true` | `security-scan-public-content.test.mjs`: "a check only the head has is ignored, and the findings go as before" |
| 687 | sh list condition | `[ -n "$entry" ]` | `false` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 687 | sh skip statement | `continue` | `:` | `security-scan-public-content.test.mjs`: "the hold clears its marker when there is nothing to hold: no result, no check, or no finding" |
| 690 | sh if && operand | `[ "$mode" != 100644 ]` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 690 | sh if whole | `[ "$mode" != 100644 ] && [ "$mode" != 100755 ]` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 690 | sh if whole | `[ "$mode" != 100644 ] && [ "$mode" != 100755 ]` | `false` | `security-scan-public-content.test.mjs`: "an exit 1 without a finding line, and a base check that is a symlink, cannot run" |
| 690 | sh if && operand | `[ "$mode" != 100755 ]` | `true` | `security-scan-log-content.test.mjs`: "an executable check is a regular file too, and the .mjs check wins over the .py one" |
| 692 | sh elif whole | `! git show "origin/$BASE:$f" > "$check"` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 692 | sh elif whole | `! git show "origin/$BASE:$f" > "$check"` | `false` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 692 | sh file write | `"$check"` | `/dev/null` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 695 | sh skip statement | `break` | `:` | `security-scan-log-content.test.mjs`: "an executable check is a regular file too, and the .mjs check wins over the .py one" |
| 698 | sh if whole | `[ -z "$check" ]` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 698 | sh if whole | `[ -z "$check" ]` | `false` | `security-scan-public-content.test.mjs`: "a check only the head has is ignored, and the findings go as before" |
| 699 | sh file write | `"$state"` | `/dev/null` | `security-scan-public-content.test.mjs`: "a check only the head has is ignored, and the findings go as before" |
| 701 | sh elif whole | `[ -n "$why" ]` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 701 | sh elif whole | `[ -n "$why" ]` | `false` | `security-scan-public-content.test.mjs`: "an exit 1 without a finding line, and a base check that is a symlink, cannot run" |
| 702 | sh file write | `"$state"` | `/dev/null` | `security-scan-public-content.test.mjs`: "an exit 1 without a finding line, and a base check that is a symlink, cannot run" |
| 705 | sh file write | `"$state"` | `/dev/null` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 708 | sh file write | `"$RUNNER_TEMP/public-content-guard.sh"` | `/dev/null` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 833 | if: whole | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 833 | if: whole | `env.RUN != 'false'` | `false` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 841 | sh if \|\| operand | `[ "$CHANGED" -gt "$KIT_SECURITY_MAX_FILES" ]` | `false` | `security-scan.test.mjs`: "the limits step refuses a large pull request and a checkout that misses files" |
| 841 | sh if whole | `[ "$CHANGED" -gt "$KIT_SECURITY_MAX_FILES" ] \|\| [ "$lines" -gt "$KIT_SECURITY_MA…` | `true` | `security-scan.test.mjs`: "the limits step refuses a large pull request and a checkout that misses files" |
| 841 | sh if whole | `[ "$CHANGED" -gt "$KIT_SECURITY_MAX_FILES" ] \|\| [ "$lines" -gt "$KIT_SECURITY_MA…` | `false` | `security-scan.test.mjs`: "the limits step refuses a large pull request and a checkout that misses files" |
| 841 | sh if \|\| operand | `[ "$lines" -gt "$KIT_SECURITY_MAX_LINES" ]` | `false` | `security-scan.test.mjs`: "the limits step refuses a large pull request and a checkout that misses files" |
| 851 | sh if \|\| operand | `[ "$local_count" -gt "$KIT_SECURITY_MAX_FILES" ]` | `false` | `security-scan.test.mjs`: "the limits step refuses a large pull request and a checkout that misses files" |
| 851 | sh if whole | `[ "$local_count" -gt "$KIT_SECURITY_MAX_FILES" ] \|\| [ "$local_lines" -gt "$KIT_S…` | `true` | `security-scan.test.mjs`: "the limits step refuses a large pull request and a checkout that misses files" |
| 851 | sh if whole | `[ "$local_count" -gt "$KIT_SECURITY_MAX_FILES" ] \|\| [ "$local_lines" -gt "$KIT_S…` | `false` | `security-scan.test.mjs`: "the limits step refuses a large pull request and a checkout that misses files" |
| 851 | sh if \|\| operand | `[ "$local_lines" -gt "$KIT_SECURITY_MAX_LINES" ]` | `false` | `security-scan.test.mjs`: "the limits step refuses a large pull request and a checkout that misses files" |
| 855 | sh if whole | `[ "$local_count" -lt "$CHANGED" ]` | `true` | `security-scan.test.mjs`: "the limits step refuses a large pull request and a checkout that misses files" |
| 855 | sh if whole | `[ "$local_count" -lt "$CHANGED" ]` | `false` | `security-scan.test.mjs`: "the limits step refuses a large pull request and a checkout that misses files" |
| 868 | if: whole | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 868 | if: whole | `env.RUN != 'false'` | `false` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 871 | sh output statement | (before `rm -f -- "$link"`) | `: ` | `security-scan.test.mjs`: "every symlink in the checkout is removed, a directory link inside it too" |
| 878 | if: whole | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 878 | if: whole | `env.RUN != 'false'` | `false` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 880 | sh if whole | `git config --local --list \| grep -qiE 'extraheader\|includeif'` | `true` | `workflow-guards.test.mjs`: "security-scan.yml: a checkout whose git config references credentials fails the run" |
| 880 | sh if whole | `git config --local --list \| grep -qiE 'extraheader\|includeif'` | `false` | `workflow-guards.test.mjs`: "security-scan.yml: a checkout whose git config references credentials fails the run" |
| 890 | if: && operand | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 890 | if: whole | `env.RUN != 'false' && env.KIT_SECURITY_RUNNER != 'opencode'` | `true` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 890 | if: whole | `env.RUN != 'false' && env.KIT_SECURITY_RUNNER != 'opencode'` | `false` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 890 | if: && operand | `env.KIT_SECURITY_RUNNER != 'opencode'` | `true` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 897 | sh list \|\| operand | `sudo apt-get update -qq` | `false` | Left untested: runner provisioning (apt-get on the GitHub runner); every Claude Code scan run exercises it |
| 897 | sh list whole | `sudo apt-get update -qq \|\| sudo apt-get update -qq` | `true` | Left untested: runner provisioning (apt-get on the GitHub runner); every Claude Code scan run exercises it |
| 897 | sh list whole | `sudo apt-get update -qq \|\| sudo apt-get update -qq` | `false` | Left untested: runner provisioning (apt-get on the GitHub runner); every Claude Code scan run exercises it |
| 897 | sh list \|\| operand | `sudo apt-get update -qq` | `false` | Left untested: runner provisioning (apt-get on the GitHub runner); every Claude Code scan run exercises it |
| 900 | sh if whole | `[ -f /proc/sys/kernel/apparmor_restrict_unprivileged_userns ]` | `true` | Left untested: runner provisioning (the runner's AppArmor setting); every Claude Code scan run exercises it |
| 900 | sh if whole | `[ -f /proc/sys/kernel/apparmor_restrict_unprivileged_userns ]` | `false` | Left untested: runner provisioning (the runner's AppArmor setting); every Claude Code scan run exercises it |
| 915 | if: whole | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 915 | if: whole | `env.RUN != 'false'` | `false` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 923 | sh file write | `"$input/diff.patch"` | `/dev/null` | `security-scan.test.mjs`: "the scan's inputs take .gitattributes from the base, so a head cannot hide a file" |
| 924 | sh file write | `"$input/files.txt"` | `/dev/null` | `security-scan.test.mjs`: "the scan's inputs take .gitattributes from the base, so a head cannot hide a file" |
| 925 | sh output statement | (before `echo "SCAN_INPUT=$input" >> "$GITHUB_ENV"`) | `: ` | `security-scan.test.mjs`: "the scan's inputs take .gitattributes from the base, so a head cannot hide a file" |
| 927 | sh file write | `"$RUNNER_TEMP/claude-settings.json"` | `/dev/null` | `security-scan.test.mjs`: "the scan's inputs take .gitattributes from the base, so a head cannot hide a file" |
| 937 | sh output statement | (before `echo "SCAN_ALLOWED=Read,Grep,Glob" >> "$GITHUB_ENV"`) | `: ` | `security-scan.test.mjs`: "the scan's inputs take .gitattributes from the base, so a head cannot hide a file" |
| 938 | sh output statement | (before `echo "SCAN_DENIED=Bash,Edit,Write,NotebookEdit,WebFetch,WebS`) | `: ` | `security-scan.test.mjs`: "the scan's inputs take .gitattributes from the base, so a head cannot hide a file" |
| 968 | if: && operand | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 968 | if: whole | `env.RUN != 'false' && env.KIT_SECURITY_RUNNER != 'opencode'` | `true` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 968 | if: whole | `env.RUN != 'false' && env.KIT_SECURITY_RUNNER != 'opencode'` | `false` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 968 | if: && operand | `env.KIT_SECURITY_RUNNER != 'opencode'` | `true` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 983 | sh output statement | (before `sudo install -d -o root -g root -m 0755 /opt/agent-kit`) | `: ` | Left untested: runner provisioning (sudo install into /opt/agent-kit on the GitHub runner); every scan run exercises it |
| 984 | sh output statement | (before `sudo install -o root -g root -m 0755 "$RUNNER_TEMP/claude" /`) | `: ` | Left untested: runner provisioning (sudo install into /opt/agent-kit on the GitHub runner); every scan run exercises it |
| 985 | sh output statement | (before `rm -f -- "$RUNNER_TEMP/claude"`) | `: ` | Not a rule: removes the downloaded binary from RUNNER_TEMP after installing it |
| 995 | if: && operand | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 995 | if: whole | `env.RUN != 'false' && env.KIT_SECURITY_RUNNER == 'opencode'` | `true` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 995 | if: whole | `env.RUN != 'false' && env.KIT_SECURITY_RUNNER == 'opencode'` | `false` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 995 | if: && operand | `env.KIT_SECURITY_RUNNER == 'opencode'` | `true` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 997 | sh output statement | (before `rm -rf -- .opencode opencode.json opencode.jsonc`) | `: ` | `scan-opencode.test.mjs`: "security-scan.yml: OpenCode's configuration goes, and .git leaves the checkout and comes back once" |
| 1001 | if: && operand | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 1001 | if: whole | `env.RUN != 'false' && env.KIT_SECURITY_RUNNER == 'opencode'` | `true` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 1001 | if: whole | `env.RUN != 'false' && env.KIT_SECURITY_RUNNER == 'opencode'` | `false` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 1001 | if: && operand | `env.KIT_SECURITY_RUNNER == 'opencode'` | `true` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 1012 | sh output statement | (before `sudo install -d -o root -g root -m 0755 /opt/agent-kit`) | `: ` | Left untested: runner provisioning (sudo install into /opt/agent-kit on the GitHub runner); every scan run exercises it |
| 1013 | sh output statement | (before `sudo install -o root -g root -m 0755 "$RUNNER_TEMP/opencode-`) | `: ` | Left untested: runner provisioning (sudo install into /opt/agent-kit on the GitHub runner); every scan run exercises it |
| 1014 | sh output statement | (before `rm -rf -- "$RUNNER_TEMP/opencode.tar.gz" "$RUNNER_TEMP/openc`) | `: ` | Not a rule: removes the downloaded archive from RUNNER_TEMP after installing it |
| 1024 | if: && operand | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 1024 | if: whole | `env.RUN != 'false' && env.KIT_SECURITY_RUNNER == 'opencode'` | `true` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 1024 | if: whole | `env.RUN != 'false' && env.KIT_SECURITY_RUNNER == 'opencode'` | `false` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 1024 | if: && operand | `env.KIT_SECURITY_RUNNER == 'opencode'` | `true` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 1026 | sh output statement | (before `mv -- .git "$RUNNER_TEMP/checkout-git"`) | `: ` | `scan-opencode.test.mjs`: "security-scan.yml: OpenCode's configuration goes, and .git leaves the checkout and comes back once" |
| 1051 | if: && operand | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 1051 | if: whole | `env.RUN != 'false' && env.KIT_SECURITY_RUNNER == 'claude-code'` | `true` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 1051 | if: whole | `env.RUN != 'false' && env.KIT_SECURITY_RUNNER == 'claude-code'` | `false` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 1051 | if: && operand | `env.KIT_SECURITY_RUNNER == 'claude-code'` | `true` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 1065 | sh if whole | `[ "$KIT_SECURITY_PROVIDER" = opencode-go ]` | `true` | `security-scan-log-content.test.mjs`: "Run the scan: with a base check, the model's last message waits for the check, and is withheld when it refuses it" |
| 1065 | sh if whole | `[ "$KIT_SECURITY_PROVIDER" = opencode-go ]` | `false` | `model-provider.test.mjs`: "security-scan.yml, Run the scan: OpenCode Go gets its key as a bearer token, and nothing else" |
| 1066 | sh if whole | `[ -z "$OPENCODE_API_KEY" ]` | `true` | `model-provider.test.mjs`: "security-scan.yml, Run the scan: OpenCode Go gets its key as a bearer token, and nothing else" |
| 1066 | sh if whole | `[ -z "$OPENCODE_API_KEY" ]` | `false` | `model-provider.test.mjs`: "security-scan.yml, Run the scan: OpenCode Go without its key fails before the CLI starts" |
| 1078 | sh elif whole | `[ -z "$ANTHROPIC_API_KEY" ]` | `true` | `security-scan-log-content.test.mjs`: "Run the scan: with a base check, the model's last message waits for the check, and is withheld when it refuses it" |
| 1078 | sh elif whole | `[ -z "$ANTHROPIC_API_KEY" ]` | `false` | `model-provider.test.mjs`: "security-scan.yml, Run the scan: the Anthropic provider without its key fails before the CLI starts" |
| 1080 | sh list condition | `[ -z "$OPENCODE_API_KEY" ]` | `true` | `model-provider.test.mjs`: "security-scan.yml, Run the scan: the Anthropic provider without its key fails before the CLI starts" |
| 1080 | sh list condition | `[ -z "$OPENCODE_API_KEY" ]` | `false` | `model-provider.test.mjs`: "security-scan.yml, Run the scan: the Anthropic provider without its key fails before the CLI starts" |
| 1087 | sh list condition | `[ -z "$KIT_SECURITY_EFFORT" ]` | `true` | `model-provider.test.mjs`: "security-scan.yml, Run the scan: the effort level reaches the CLI, and none when unset" |
| 1087 | sh list condition | `[ -z "$KIT_SECURITY_EFFORT" ]` | `false` | `model-provider.test.mjs`: "security-scan.yml, Run the scan: the effort level reaches the CLI, and none when unset" |
| 1088 | sh list condition | `/opt/agent-kit/claude -p "$prompt" \ --output-format json \ --json-schema "$(cat…` | `true` | `security-scan-log-content.test.mjs`: "Run the scan: with a base check, the model's last message waits for the check, and is withheld when it refuses it" |
| 1088 | sh list condition | `/opt/agent-kit/claude -p "$prompt" \ --output-format json \ --json-schema "$(cat…` | `false` | `security-scan-log-content.test.mjs`: "Run the scan: with a base check, the model's last message waits for the check, and is withheld when it refuses it" |
| 1102 | sh file write | `"$RESULT"` | `/dev/null` | `security-scan-log-content.test.mjs`: "Run the scan: with a base check, the model's last message waits for the check, and is withheld when it refuses it" |
| 1103 | sh if whole | `[ ! -s "$RESULT" ]` | `true` | `security-scan-log-content.test.mjs`: "Run the scan: with a base check, the model's last message waits for the check, and is withheld when it refuses it" |
| 1103 | sh if whole | `[ ! -s "$RESULT" ]` | `false` | `model-provider.test.mjs`: "security-scan.yml, Run the scan: a run that ends in error, or with no result, fails" |
| 1108 | jq if whole | `type == "array"` | `true` | `security-scan-log-content.test.mjs`: "Run the scan: with a base check, the model's last message waits for the check, and is withheld when it refuses it" |
| 1108 | jq if whole | `type == "array"` | `false` | `security-scan-log-content.test.mjs`: "a stream's last result decides the run, whatever event follows it" |
| 1108 | jq select whole | `.type == "result"` | `true` | `security-scan-log-content.test.mjs`: "a stream's last result decides the run, whatever event follows it" |
| 1108 | jq select whole | `.type == "result"` | `false` | `security-scan-log-content.test.mjs`: "a stream's last result decides the run, whatever event follows it" |
| 1116 | sh list condition | `[ "$KIT_SECURITY_PROVIDER" != opencode-go ]` | `true` | `model-provider.test.mjs`: "security-scan.yml, Run the scan: OpenCode Go gets its key as a bearer token, and nothing else" |
| 1116 | sh list condition | `[ "$KIT_SECURITY_PROVIDER" != opencode-go ]` | `false` | `security-scan-log-content.test.mjs`: "Run the scan: with a base check that passes it, the summary is printed with commands stopped" |
| 1117 | sh file write | `"$HELD.summary"` | `/dev/null` | `security-scan-log-content.test.mjs`: "Run the scan: with a base check, the model's last message waits for the check, and is withheld when it refuses it" |
| 1119 | sh if \|\| operand | `[ "$status" -ne 0 ]` | `false` | `model-provider.test.mjs`: "security-scan.yml, Run the scan: a run that ends in error, or with no result, fails" |
| 1119 | sh if whole | `[ "$status" -ne 0 ] \|\| [ "$(jq -r '.is_error' <<<"$result")" != "false" ] \|\| [ "…` | `true` | `security-scan-log-content.test.mjs`: "Run the scan: with a base check, the model's last message waits for the check, and is withheld when it refuses it" |
| 1119 | sh if whole | `[ "$status" -ne 0 ] \|\| [ "$(jq -r '.is_error' <<<"$result")" != "false" ] \|\| [ "…` | `false` | `model-provider.test.mjs`: "security-scan.yml, Run the scan: a run that ends in error, or with no result, fails" |
| 1119 | sh if \|\| operand | `[ "$(jq -r '.is_error' <<<"$result")" != "false" ]` | `false` | `model-provider.test.mjs`: "security-scan.yml, Run the scan: a run that ends in error, or with no result, fails" |
| 1119 | sh if \|\| operand | `[ "$(jq -r '.subtype' <<<"$result")" != "success" ]` | `false` | `model-provider.test.mjs`: "security-scan.yml, Run the scan: a run that ends in error, or with no result, fails" |
| 1143 | if: && operand | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 1143 | if: whole | `env.RUN != 'false' && env.KIT_SECURITY_RUNNER == 'opencode'` | `true` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 1143 | if: whole | `env.RUN != 'false' && env.KIT_SECURITY_RUNNER == 'opencode'` | `false` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 1143 | if: && operand | `env.KIT_SECURITY_RUNNER == 'opencode'` | `true` | `security-scan-conditions.test.mjs`: "each runner installs and runs only its own CLI" |
| 1153 | sh if whole | `[ -z "$OPENCODE_API_KEY" ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1153 | sh if whole | `[ -z "$OPENCODE_API_KEY" ]` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the model and effort are checked before the server starts" |
| 1192 | sh list condition | `oc "$list" models opencode-go --verbose > "$RUNNER_TEMP/opencode-models" \ 2> "$…` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1192 | sh list condition | `oc "$list" models opencode-go --verbose > "$RUNNER_TEMP/opencode-models" \ 2> "$…` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1192 | sh file write | `"$RUNNER_TEMP/opencode-models"` | `/dev/null` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1194 | sh if whole | `[ "$listed" -ne 0 ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1194 | sh if whole | `[ "$listed" -ne 0 ]` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the model and effort are checked before the server starts" |
| 1200 | sh if whole | `! jq -e 'type == "object"' >/dev/null 2>&1 <<<"$info"` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1200 | sh if whole | `! jq -e 'type == "object"' >/dev/null 2>&1 <<<"$info"` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the model and effort are checked before the server starts" |
| 1204 | sh if && operand | `[ -n "$KIT_SECURITY_EFFORT" ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1204 | sh if whole | `[ -n "$KIT_SECURITY_EFFORT" ] && ! jq -e --arg v "$KIT_SECURITY_EFFORT" '.varian…` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1204 | sh if whole | `[ -n "$KIT_SECURITY_EFFORT" ] && ! jq -e --arg v "$KIT_SECURITY_EFFORT" '.varian…` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the model and effort are checked before the server starts" |
| 1204 | sh if && operand | `! jq -e --arg v "$KIT_SECURITY_EFFORT" '.variants // {} \| has($v)' >/dev/null <<…` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the server is local, behind a password, and the prompt carries the schema" |
| 1205 | jq if whole | `length == 0` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the model and effort are checked before the server starts" |
| 1205 | jq if whole | `length == 0` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the model and effort are checked before the server starts" |
| 1214 | sh file write | `"$RUNNER_TEMP/opencode-serve.log"` | `/dev/null` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1220 | sh list condition | `[ -z "$url" ]` | `true` | `scan-opencode.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 1220 | sh list condition | `[ -z "$url" ]` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1220 | sh skip statement | `break` | `:` | `scan-opencode.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 1221 | sh list condition | `kill -0 "$server" 2>/dev/null` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a server that exits ends the wait for its address" |
| 1221 | sh list condition | `kill -0 "$server" 2>/dev/null` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1221 | sh skip statement | `break` | `:` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a server that exits ends the wait for its address" |
| 1224 | sh if whole | `[ -z "$url" ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1224 | sh if whole | `[ -z "$url" ]` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a server that does not start shows its log, with commands stopped" |
| 1239 | jq if whole | `$variant == ""` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the server is local, behind a password, and the prompt carries the schema" |
| 1239 | jq if whole | `$variant == ""` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the server is local, behind a password, and the prompt carries the schema" |
| 1262 | jq select whole | `.type == "text"` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer is the last text part, whatever part follows it" |
| 1262 | jq select whole | `.type == "text"` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1264 | jq select and operand | `. != null` | `true` | Not caught, equivalent: null never fits the schema, whose type is object, so `fits` alone drops it |
| 1264 | jq select whole | `. != null and fits($schema[0])` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer is checked against every keyword of the scan's and the verification's schemas" |
| 1264 | jq select whole | `. != null and fits($schema[0])` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1264 | jq select and operand | `fits($schema[0])` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer is checked against every keyword of the scan's and the verification's schemas" |
| 1282 | sh list condition | `api -X POST -d "$(ask "$1")" "$url/session/$session/message" > "$RUNNER_TEMP/ope…` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1282 | sh list condition | `api -X POST -d "$(ask "$1")" "$url/session/$session/message" > "$RUNNER_TEMP/ope…` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1282 | sh file write | `"$RUNNER_TEMP/opencode-answer.json"` | `/dev/null` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1284 | sh file write | `"$RUNNER_TEMP/opencode-structured.json"` | `/dev/null` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1306 | sh list \|\| operand | `[ -n "${AGENT_KIT_STARTED:-}" ]` | `false` | its copy at `security-scan.yml` line 1723, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1306 | sh list whole | `[ -n "${AGENT_KIT_STARTED:-}" ] \|\| [ -z "${GITHUB_ENV:-}" ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1306 | sh list whole | `[ -n "${AGENT_KIT_STARTED:-}" ] \|\| [ -z "${GITHUB_ENV:-}" ]` | `false` | its copy at `security-scan.yml` line 1723, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1306 | sh list \|\| operand | `[ -z "${GITHUB_ENV:-}" ]` | `false` | Not caught, unreachable on a runner: GitHub always sets GITHUB_ENV; the guard only lets the step run outside Actions |
| 1306 | sh output statement | (before `echo "AGENT_KIT_STARTED=$started" >> "$GITHUB_ENV"`) | `: ` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1312 | jq select whole | `test("ttft_admission_refused\|at capacity")` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: errors are not asked again" |
| 1312 | jq select whole | `test("ttft_admission_refused\|at capacity")` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1313 | jq if whole | `. > 3600` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1313 | jq if whole | `. > 3600` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a named wait past an hour waits an hour" |
| 1320 | jq select whole | `.type == "step-finish"` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: only served steps start the row again, not other parts" |
| 1320 | jq select whole | `.type == "step-finish"` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a step served between refusals starts the row again" |
| 1332 | sh while && operand | `[ "$status" -eq 0 ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a failed request is not waited on, even when it says at capacity" |
| 1332 | sh while whole | `[ "$status" -eq 0 ] && pause=$(refusal_pause) && [ -n "$pause" ]` | `true` | `scan-opencode.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 1332 | sh while whole | `[ "$status" -eq 0 ] && pause=$(refusal_pause) && [ -n "$pause" ]` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1332 | sh while && operand | `pause=$(refusal_pause)` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1332 | sh while && operand | `[ -n "$pause" ]` | `true` | `scan-opencode.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 1334 | sh if && operand | `[ -n "$now" ]` | `true` | Not caught, equivalent: an empty count makes `[ "" -gt n ]` fail as a test, so the && list is false either way |
| 1334 | sh if whole | `[ -n "$now" ] && [ "$now" -gt "$served" ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1334 | sh if whole | `[ -n "$now" ] && [ "$now" -gt "$served" ]` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a step served between refusals starts the row again" |
| 1334 | sh if && operand | `[ "$now" -gt "$served" ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a step served between refusals starts the row again" |
| 1340 | sh list condition | `[ "$pause" -le "$delay" ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the waits are 60, 120 and 180 s for refusals in a row, or the named seconds when longer" |
| 1340 | sh list condition | `[ "$pause" -le "$delay" ]` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1342 | sh if whole | `[ "$delay" -gt "$remaining" ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1342 | sh if whole | `[ "$delay" -gt "$remaining" ]` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the scan stops on a refusal when the wait would not fit in the job's time limit" |
| 1344 | sh skip statement | `break` | `:` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the scan stops on a refusal when the wait would not fit in the job's time limit" |
| 1354 | sh list && operand | `[ "$status" -eq 0 ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a request that failed is not asked for again" |
| 1354 | sh list whole | `[ "$status" -eq 0 ] && [ ! -s "$RUNNER_TEMP/opencode-structured.json" ] \ && jq …` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the server is local, behind a password, and the prompt carries the schema" |
| 1354 | sh list whole | `[ "$status" -eq 0 ] && [ ! -s "$RUNNER_TEMP/opencode-structured.json" ] \ && jq …` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: no object is taken from among other text" |
| 1354 | sh list && operand | `[ ! -s "$RUNNER_TEMP/opencode-structured.json" ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the server is local, behind a password, and the prompt carries the schema" |
| 1355 | sh list && operand | `jq -e '.info != null and .info.error == null' "$RUNNER_TEMP/opencode-answer.json…` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: errors are not asked again" |
| 1355 | sh skip statement | `break` | `:` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the server is local, behind a password, and the prompt carries the schema" |
| 1361 | sh list condition | `jq -e . "$RUNNER_TEMP/opencode-answer.json" >/dev/null 2>&1` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: an answer that is not JSON reads as no answer" |
| 1361 | sh list condition | `jq -e . "$RUNNER_TEMP/opencode-answer.json" >/dev/null 2>&1` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1361 | sh file write | `"$RUNNER_TEMP/opencode-answer.json"` | `/dev/null` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: an answer that is not JSON reads as no answer" |
| 1366 | sh if \|\| operand | `! oc "$config" export "$session" > "$RUNNER_TEMP/opencode-session.json" 2>/dev/n…` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1366 | sh if whole | `! oc "$config" export "$session" > "$RUNNER_TEMP/opencode-session.json" 2>/dev/n…` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1366 | sh if whole | `! oc "$config" export "$session" > "$RUNNER_TEMP/opencode-session.json" 2>/dev/n…` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1366 | sh file write | `"$RUNNER_TEMP/opencode-session.json"` | `/dev/null` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1367 | sh if \|\| operand | `! jq -e '.messages \| type == "array"' "$RUNNER_TEMP/opencode-session.json" >/dev…` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: an export without a message list counts nothing" |
| 1369 | sh file write | `"$RUNNER_TEMP/opencode-session.json"` | `/dev/null` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: no answer, an error or the turn limit fails the step" |
| 1377 | jq select whole | `.info.role == "assistant"` | `true` | Not a rule: the assistant messages feed only the run log's turn count, cost, tokens and last text; the turn limit counts its own way |
| 1377 | jq select whole | `.info.role == "assistant"` | `false` | Not a rule: the assistant messages feed only the run log's turn count, cost, tokens and last text; the turn limit counts its own way |
| 1379 | jq if whole | `$a.info == null` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1379 | jq if whole | `$a.info == null` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: no answer, an error or the turn limit fails the step" |
| 1379 | jq if whole | `$a == {}` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: no answer, an error or the turn limit fails the step" |
| 1379 | jq if whole | `$a == {}` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: an answer that is not JSON reads as no answer" |
| 1380 | jq if whole | `$structured == null` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1380 | jq if whole | `$structured == null` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: an answer that is not JSON or does not fit the schema is asked for again" |
| 1382 | jq if and operand | `$status == 0` | `true` | Not a rule: the subtype goes only to the run log; is_error, worked out apart, decides the step |
| 1382 | jq if whole | `$status == 0 and $error == null` | `true` | Not a rule: the subtype goes only to the run log; is_error, worked out apart, decides the step |
| 1382 | jq if whole | `$status == 0 and $error == null` | `false` | Not a rule: the subtype goes only to the run log; is_error, worked out apart, decides the step |
| 1382 | jq if and operand | `$error == null` | `true` | Not a rule: the subtype goes only to the run log; is_error, worked out apart, decides the step |
| 1384 | jq select whole | `.type == "step-start"` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1384 | jq select whole | `.type == "step-start"` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1392 | jq if whole | `$error == null` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: an answer that is not JSON or does not fit the schema is asked for again" |
| 1392 | jq if whole | `$error == null` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1393 | jq select whole | `.type == "text"` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer is the last text part, whatever part follows it" |
| 1393 | jq select whole | `.type == "text"` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1402 | sh file write | `"$HELD.summary"` | `/dev/null` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1404 | sh if whole | `[ "$(jq -r '.is_error' <<<"$result")" != "false" ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1404 | sh if whole | `[ "$(jq -r '.is_error' <<<"$result")" != "false" ]` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: an answer that is not JSON or does not fit the schema is asked for again" |
| 1412 | sh file write | `"$HELD.server"` | `/dev/null` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: an answer that is not JSON or does not fit the schema is asked for again" |
| 1421 | jq if whole | `$m.info.role == "user"` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the step limit counts the run's steps, not the asking again" |
| 1421 | jq if whole | `$m.info.role == "user"` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the step limit counts the run's steps, not the asking again" |
| 1422 | jq if and operand | `$m.info.role == "assistant"` | `true` | Not caught, equivalent: OpenCode stores a user message with no step-start parts, so counting it adds nothing |
| 1422 | jq if whole | `$m.info.role == "assistant" and . >= 0 and $kinds[.] == "run"` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the step limit counts the run's steps, not the asking again" |
| 1422 | jq if whole | `$m.info.role == "assistant" and . >= 0 and $kinds[.] == "run"` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the step limit counts the run's steps, not the asking again" |
| 1422 | jq if and operand | `. >= 0` | `true` | Not caught, unreachable: a session opens with the prompt, a user message, so no assistant message comes before index 0 |
| 1422 | jq if and operand | `$kinds[.] == "run"` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the step limit counts the run's steps, not the asking again" |
| 1423 | jq select whole | `.type == "step-start"` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the step limit counts the run's steps, not the asking again" |
| 1423 | jq select whole | `.type == "step-start"` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the step limit counts the run's steps, not the asking again" |
| 1424 | sh if whole | `[ "$turns" -ge "$KIT_SECURITY_MAX_TURNS" ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1424 | sh if whole | `[ "$turns" -ge "$KIT_SECURITY_MAX_TURNS" ]` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the step limit counts the run's steps, not the asking again" |
| 1436 | if: whole | `${{ always() && env.RUN != 'false' && (steps.scan.outcome != 'skipped' \|\| steps.…` | `true` | `security-scan-log-content.test.mjs`: "the check is found before any model runs, and the secret reaches no step that runs one" |
| 1436 | if: whole | `${{ always() && env.RUN != 'false' && (steps.scan.outcome != 'skipped' \|\| steps.…` | `false` | `security-scan-log-content.test.mjs`: "the check is found before any model runs, and the secret reaches no step that runs one" |
| 1436 | if: && operand | `always()` | `true` | `security-scan-log-content.test.mjs`: "the check is found before any model runs, and the secret reaches no step that runs one" |
| 1436 | if: && operand | `env.RUN != 'false'` | `true` | `security-scan-log-content.test.mjs`: "the check is found before any model runs, and the secret reaches no step that runs one" |
| 1436 | if: && operand | `(steps.scan.outcome != 'skipped' \|\| steps.scan_opencode.outcome != 'skipped')` | `true` | `security-scan-log-content.test.mjs`: "the check is found before any model runs, and the secret reaches no step that runs one" |
| 1436 | if: \|\| operand | `steps.scan.outcome != 'skipped'` | `false` | `security-scan-log-content.test.mjs`: "the check is found before any model runs, and the secret reaches no step that runs one" |
| 1436 | if: \|\| operand | `steps.scan_opencode.outcome != 'skipped'` | `false` | `security-scan-log-content.test.mjs`: "the check is found before any model runs, and the secret reaches no step that runs one" |
| 1453 | if: whole | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 1453 | if: whole | `env.RUN != 'false'` | `false` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 1459 | jq if whole | `type == "array"` | `true` | `security-scan.test.mjs`: "the collect step numbers the scan's candidates" |
| 1459 | jq if whole | `type == "array"` | `false` | `security-scan.test.mjs`: "the collect step reads the stream's last result" |
| 1459 | jq select whole | `.type == "result"` | `true` | `security-scan.test.mjs`: "the collect step reads the stream's last result" |
| 1459 | jq select whole | `.type == "result"` | `false` | `security-scan.test.mjs`: "the collect step reads the stream's last result" |
| 1460 | sh if whole | `! jq -e ' .structured_output \| type == "object" and (.files_reviewed \| type == "…` | `true` | `security-scan.test.mjs`: "the collect step numbers the scan's candidates" |
| 1460 | sh if whole | `! jq -e ' .structured_output \| type == "object" and (.files_reviewed \| type == "…` | `false` | `security-scan.test.mjs`: "the collect step refuses an answer that is not the schema's" |
| 1479 | sh output statement | (before `echo "CANDIDATES=$count" >> "$GITHUB_ENV"`) | `: ` | `security-scan.test.mjs`: "the collect step numbers the scan's candidates" |
| 1488 | if: && operand | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "a verification runs on its runner only when the scan found candidates" |
| 1488 | if: whole | `env.RUN != 'false' && env.KIT_SECURITY_RUNNER == 'claude-code' && env.CANDIDATES…` | `true` | `security-scan-conditions.test.mjs`: "a verification runs on its runner only when the scan found candidates" |
| 1488 | if: whole | `env.RUN != 'false' && env.KIT_SECURITY_RUNNER == 'claude-code' && env.CANDIDATES…` | `false` | `security-scan-conditions.test.mjs`: "a verification runs on its runner only when the scan found candidates" |
| 1488 | if: && operand | `env.KIT_SECURITY_RUNNER == 'claude-code'` | `true` | `security-scan-conditions.test.mjs`: "a verification runs on its runner only when the scan found candidates" |
| 1488 | if: && operand | `env.CANDIDATES != ''` | `true` | `security-scan-conditions.test.mjs`: "a verification runs on its runner only when the scan found candidates" |
| 1488 | if: && operand | `env.CANDIDATES != '0'` | `true` | `security-scan-conditions.test.mjs`: "a verification runs on its runner only when the scan found candidates" |
| 1501 | sh if whole | `[ "$KIT_SECURITY_PROVIDER" = opencode-go ]` | `true` | `security-scan-log-content.test.mjs`: "Verify the candidate findings: with a base check, the model's last message waits for the check, and is withheld when it refuses it" |
| 1501 | sh if whole | `[ "$KIT_SECURITY_PROVIDER" = opencode-go ]` | `false` | `model-provider.test.mjs`: "security-scan.yml, Verify the candidate findings: OpenCode Go gets its key as a bearer token, and nothing else" |
| 1502 | sh if whole | `[ -z "$OPENCODE_API_KEY" ]` | `true` | `model-provider.test.mjs`: "security-scan.yml, Verify the candidate findings: OpenCode Go gets its key as a bearer token, and nothing else" |
| 1502 | sh if whole | `[ -z "$OPENCODE_API_KEY" ]` | `false` | `model-provider.test.mjs`: "security-scan.yml, Verify the candidate findings: OpenCode Go without its key fails before the CLI starts" |
| 1514 | sh elif whole | `[ -z "$ANTHROPIC_API_KEY" ]` | `true` | `security-scan-log-content.test.mjs`: "Verify the candidate findings: with a base check, the model's last message waits for the check, and is withheld when it refuses it" |
| 1514 | sh elif whole | `[ -z "$ANTHROPIC_API_KEY" ]` | `false` | `model-provider.test.mjs`: "security-scan.yml, Verify the candidate findings: the Anthropic provider without its key fails before the CLI starts" |
| 1516 | sh list condition | `[ -z "$OPENCODE_API_KEY" ]` | `true` | `model-provider.test.mjs`: "security-scan.yml, Verify the candidate findings: the Anthropic provider without its key fails before the CLI starts" |
| 1516 | sh list condition | `[ -z "$OPENCODE_API_KEY" ]` | `false` | `model-provider.test.mjs`: "security-scan.yml, Verify the candidate findings: the Anthropic provider without its key fails before the CLI starts" |
| 1523 | sh list condition | `[ -z "$KIT_SECURITY_EFFORT" ]` | `true` | `model-provider.test.mjs`: "security-scan.yml, Verify the candidate findings: the effort level reaches the CLI, and none when unset" |
| 1523 | sh list condition | `[ -z "$KIT_SECURITY_EFFORT" ]` | `false` | `model-provider.test.mjs`: "security-scan.yml, Verify the candidate findings: the effort level reaches the CLI, and none when unset" |
| 1524 | sh list condition | `/opt/agent-kit/claude -p "$prompt" \ --output-format json \ --json-schema "$(cat…` | `true` | `security-scan-log-content.test.mjs`: "Verify the candidate findings: with a base check, the model's last message waits for the check, and is withheld when it refuses it" |
| 1524 | sh list condition | `/opt/agent-kit/claude -p "$prompt" \ --output-format json \ --json-schema "$(cat…` | `false` | `security-scan-log-content.test.mjs`: "Verify the candidate findings: with a base check, the model's last message waits for the check, and is withheld when it refuses it" |
| 1538 | sh file write | `"$RESULT"` | `/dev/null` | `security-scan-log-content.test.mjs`: "Verify the candidate findings: with a base check, the model's last message waits for the check, and is withheld when it refuses it" |
| 1539 | sh if whole | `[ ! -s "$RESULT" ]` | `true` | `security-scan-log-content.test.mjs`: "Verify the candidate findings: with a base check, the model's last message waits for the check, and is withheld when it refuses it" |
| 1539 | sh if whole | `[ ! -s "$RESULT" ]` | `false` | `model-provider.test.mjs`: "security-scan.yml, Verify the candidate findings: a run that ends in error, or with no result, fails" |
| 1543 | jq if whole | `type == "array"` | `true` | `security-scan-log-content.test.mjs`: "Verify the candidate findings: with a base check, the model's last message waits for the check, and is withheld when it refuses it" |
| 1543 | jq if whole | `type == "array"` | `false` | `security-scan-log-content.test.mjs`: "a stream's last result decides the run, whatever event follows it" |
| 1543 | jq select whole | `.type == "result"` | `true` | `security-scan-log-content.test.mjs`: "a stream's last result decides the run, whatever event follows it" |
| 1543 | jq select whole | `.type == "result"` | `false` | `security-scan-log-content.test.mjs`: "a stream's last result decides the run, whatever event follows it" |
| 1549 | sh list condition | `[ "$KIT_SECURITY_PROVIDER" != opencode-go ]` | `true` | `model-provider.test.mjs`: "security-scan.yml, Verify the candidate findings: OpenCode Go gets its key as a bearer token, and nothing else" |
| 1549 | sh list condition | `[ "$KIT_SECURITY_PROVIDER" != opencode-go ]` | `false` | `security-scan-log-content.test.mjs`: "Verify the candidate findings: with a base check that passes it, the summary is printed with commands stopped" |
| 1550 | sh file write | `"$HELD.summary"` | `/dev/null` | `security-scan-log-content.test.mjs`: "Verify the candidate findings: with a base check, the model's last message waits for the check, and is withheld when it refuses it" |
| 1552 | sh if \|\| operand | `[ "$status" -ne 0 ]` | `false` | `model-provider.test.mjs`: "security-scan.yml, Verify the candidate findings: a run that ends in error, or with no result, fails" |
| 1552 | sh if whole | `[ "$status" -ne 0 ] \|\| [ "$(jq -r '.is_error' <<<"$result")" != "false" ] \|\| [ "…` | `true` | `security-scan-log-content.test.mjs`: "Verify the candidate findings: with a base check, the model's last message waits for the check, and is withheld when it refuses it" |
| 1552 | sh if whole | `[ "$status" -ne 0 ] \|\| [ "$(jq -r '.is_error' <<<"$result")" != "false" ] \|\| [ "…` | `false` | `model-provider.test.mjs`: "security-scan.yml, Verify the candidate findings: a run that ends in error, or with no result, fails" |
| 1552 | sh if \|\| operand | `[ "$(jq -r '.is_error' <<<"$result")" != "false" ]` | `false` | `model-provider.test.mjs`: "security-scan.yml, Verify the candidate findings: a run that ends in error, or with no result, fails" |
| 1552 | sh if \|\| operand | `[ "$(jq -r '.subtype' <<<"$result")" != "success" ]` | `false` | `model-provider.test.mjs`: "security-scan.yml, Verify the candidate findings: a run that ends in error, or with no result, fails" |
| 1560 | if: && operand | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "a verification runs on its runner only when the scan found candidates" |
| 1560 | if: whole | `env.RUN != 'false' && env.KIT_SECURITY_RUNNER == 'opencode' && env.CANDIDATES !=…` | `true` | `security-scan-conditions.test.mjs`: "a verification runs on its runner only when the scan found candidates" |
| 1560 | if: whole | `env.RUN != 'false' && env.KIT_SECURITY_RUNNER == 'opencode' && env.CANDIDATES !=…` | `false` | `security-scan-conditions.test.mjs`: "a verification runs on its runner only when the scan found candidates" |
| 1560 | if: && operand | `env.KIT_SECURITY_RUNNER == 'opencode'` | `true` | `security-scan-conditions.test.mjs`: "a verification runs on its runner only when the scan found candidates" |
| 1560 | if: && operand | `env.CANDIDATES != ''` | `true` | `security-scan-conditions.test.mjs`: "a verification runs on its runner only when the scan found candidates" |
| 1560 | if: && operand | `env.CANDIDATES != '0'` | `true` | `security-scan-conditions.test.mjs`: "a verification runs on its runner only when the scan found candidates" |
| 1570 | sh if whole | `[ -z "$OPENCODE_API_KEY" ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1570 | sh if whole | `[ -z "$OPENCODE_API_KEY" ]` | `false` | its copy at `security-scan.yml` line 1153, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1609 | sh list condition | `oc "$list" models opencode-go --verbose > "$RUNNER_TEMP/opencode-models" \ 2> "$…` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1609 | sh list condition | `oc "$list" models opencode-go --verbose > "$RUNNER_TEMP/opencode-models" \ 2> "$…` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1609 | sh file write | `"$RUNNER_TEMP/opencode-models"` | `/dev/null` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1611 | sh if whole | `[ "$listed" -ne 0 ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1611 | sh if whole | `[ "$listed" -ne 0 ]` | `false` | its copy at `security-scan.yml` line 1194, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1617 | sh if whole | `! jq -e 'type == "object"' >/dev/null 2>&1 <<<"$info"` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1617 | sh if whole | `! jq -e 'type == "object"' >/dev/null 2>&1 <<<"$info"` | `false` | its copy at `security-scan.yml` line 1200, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1621 | sh if && operand | `[ -n "$KIT_SECURITY_EFFORT" ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1621 | sh if whole | `[ -n "$KIT_SECURITY_EFFORT" ] && ! jq -e --arg v "$KIT_SECURITY_EFFORT" '.varian…` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1621 | sh if whole | `[ -n "$KIT_SECURITY_EFFORT" ] && ! jq -e --arg v "$KIT_SECURITY_EFFORT" '.varian…` | `false` | its copy at `security-scan.yml` line 1204, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1621 | sh if && operand | `! jq -e --arg v "$KIT_SECURITY_EFFORT" '.variants // {} \| has($v)' >/dev/null <<…` | `true` | its copy at `security-scan.yml` line 1204, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1622 | jq if whole | `length == 0` | `true` | its copy at `security-scan.yml` line 1205, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1622 | jq if whole | `length == 0` | `false` | its copy at `security-scan.yml` line 1205, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1631 | sh file write | `"$RUNNER_TEMP/opencode-serve.log"` | `/dev/null` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1637 | sh list condition | `[ -z "$url" ]` | `true` | its copy at `security-scan.yml` line 1220, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1637 | sh list condition | `[ -z "$url" ]` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1637 | sh skip statement | `break` | `:` | its copy at `security-scan.yml` line 1220, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1638 | sh list condition | `kill -0 "$server" 2>/dev/null` | `true` | its copy at `security-scan.yml` line 1221, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1638 | sh list condition | `kill -0 "$server" 2>/dev/null` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1638 | sh skip statement | `break` | `:` | its copy at `security-scan.yml` line 1221, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1641 | sh if whole | `[ -z "$url" ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1641 | sh if whole | `[ -z "$url" ]` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a server that does not start shows its log, with commands stopped" |
| 1656 | jq if whole | `$variant == ""` | `true` | its copy at `security-scan.yml` line 1239, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1656 | jq if whole | `$variant == ""` | `false` | its copy at `security-scan.yml` line 1239, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1679 | jq select whole | `.type == "text"` | `true` | its copy at `security-scan.yml` line 1262, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1679 | jq select whole | `.type == "text"` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1681 | jq select and operand | `. != null` | `true` | Not caught, equivalent: null never fits the schema, whose type is object, so `fits` alone drops it |
| 1681 | jq select whole | `. != null and fits($schema[0])` | `true` | its copy at `security-scan.yml` line 1264, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1681 | jq select whole | `. != null and fits($schema[0])` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1681 | jq select and operand | `fits($schema[0])` | `true` | its copy at `security-scan.yml` line 1264, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1699 | sh list condition | `api -X POST -d "$(ask "$1")" "$url/session/$session/message" > "$RUNNER_TEMP/ope…` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1699 | sh list condition | `api -X POST -d "$(ask "$1")" "$url/session/$session/message" > "$RUNNER_TEMP/ope…` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1699 | sh file write | `"$RUNNER_TEMP/opencode-answer.json"` | `/dev/null` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1701 | sh file write | `"$RUNNER_TEMP/opencode-structured.json"` | `/dev/null` | `scan-opencode.test.mjs`: "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" |
| 1723 | sh list \|\| operand | `[ -n "${AGENT_KIT_STARTED:-}" ]` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1723 | sh list whole | `[ -n "${AGENT_KIT_STARTED:-}" ] \|\| [ -z "${GITHUB_ENV:-}" ]` | `true` | its copy at `security-scan.yml` line 1306, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1723 | sh list whole | `[ -n "${AGENT_KIT_STARTED:-}" ] \|\| [ -z "${GITHUB_ENV:-}" ]` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1723 | sh list \|\| operand | `[ -z "${GITHUB_ENV:-}" ]` | `false` | Not caught, unreachable on a runner: GitHub always sets GITHUB_ENV; the guard only lets the step run outside Actions |
| 1723 | sh output statement | (before `echo "AGENT_KIT_STARTED=$started" >> "$GITHUB_ENV"`) | `: ` | its copy at `security-scan.yml` line 1306, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1729 | jq select whole | `test("ttft_admission_refused\|at capacity")` | `true` | its copy at `security-scan.yml` line 1312, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1729 | jq select whole | `test("ttft_admission_refused\|at capacity")` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1730 | jq if whole | `. > 3600` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1730 | jq if whole | `. > 3600` | `false` | its copy at `security-scan.yml` line 1313, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1737 | jq select whole | `.type == "step-finish"` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: only served steps start the row again, not other parts" |
| 1737 | jq select whole | `.type == "step-finish"` | `false` | its copy at `security-scan.yml` line 1320, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1749 | sh while && operand | `[ "$status" -eq 0 ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a failed request is not waited on, even when it says at capacity" |
| 1749 | sh while whole | `[ "$status" -eq 0 ] && pause=$(refusal_pause) && [ -n "$pause" ]` | `true` | `scan-opencode.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 1749 | sh while whole | `[ "$status" -eq 0 ] && pause=$(refusal_pause) && [ -n "$pause" ]` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1749 | sh while && operand | `pause=$(refusal_pause)` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1749 | sh while && operand | `[ -n "$pause" ]` | `true` | `scan-opencode.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 1751 | sh if && operand | `[ -n "$now" ]` | `true` | Not caught, equivalent: an empty count makes `[ "" -gt n ]` fail as a test, so the && list is false either way |
| 1751 | sh if whole | `[ -n "$now" ] && [ "$now" -gt "$served" ]` | `true` | its copy at `security-scan.yml` line 1334, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1751 | sh if whole | `[ -n "$now" ] && [ "$now" -gt "$served" ]` | `false` | its copy at `security-scan.yml` line 1334, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1751 | sh if && operand | `[ "$now" -gt "$served" ]` | `true` | its copy at `security-scan.yml` line 1334, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1757 | sh list condition | `[ "$pause" -le "$delay" ]` | `true` | its copy at `security-scan.yml` line 1340, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1757 | sh list condition | `[ "$pause" -le "$delay" ]` | `false` | its copy at `security-scan.yml` line 1340, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1759 | sh if whole | `[ "$delay" -gt "$remaining" ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1759 | sh if whole | `[ "$delay" -gt "$remaining" ]` | `false` | its copy at `security-scan.yml` line 1342, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1761 | sh skip statement | `break` | `:` | its copy at `security-scan.yml` line 1344, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1771 | sh list && operand | `[ "$status" -eq 0 ]` | `true` | its copy at `security-scan.yml` line 1354, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1771 | sh list whole | `[ "$status" -eq 0 ] && [ ! -s "$RUNNER_TEMP/opencode-structured.json" ] \ && jq …` | `true` | its copy at `security-scan.yml` line 1354, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1771 | sh list whole | `[ "$status" -eq 0 ] && [ ! -s "$RUNNER_TEMP/opencode-structured.json" ] \ && jq …` | `false` | its copy at `security-scan.yml` line 1354, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1771 | sh list && operand | `[ ! -s "$RUNNER_TEMP/opencode-structured.json" ]` | `true` | its copy at `security-scan.yml` line 1354, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1772 | sh list && operand | `jq -e '.info != null and .info.error == null' "$RUNNER_TEMP/opencode-answer.json…` | `true` | its copy at `security-scan.yml` line 1355, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1772 | sh skip statement | `break` | `:` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a failed request is not waited on, even when it says at capacity" |
| 1778 | sh list condition | `jq -e . "$RUNNER_TEMP/opencode-answer.json" >/dev/null 2>&1` | `true` | its copy at `security-scan.yml` line 1361, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1778 | sh list condition | `jq -e . "$RUNNER_TEMP/opencode-answer.json" >/dev/null 2>&1` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1778 | sh file write | `"$RUNNER_TEMP/opencode-answer.json"` | `/dev/null` | its copy at `security-scan.yml` line 1361, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1783 | sh if \|\| operand | `! oc "$config" export "$session" > "$RUNNER_TEMP/opencode-session.json" 2>/dev/n…` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, OpenCode runs: with a base check, the model's text and the server's log wait for the check" |
| 1783 | sh if whole | `! oc "$config" export "$session" > "$RUNNER_TEMP/opencode-session.json" 2>/dev/n…` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, OpenCode runs: with a base check, the model's text and the server's log wait for the check" |
| 1783 | sh if whole | `! oc "$config" export "$session" > "$RUNNER_TEMP/opencode-session.json" 2>/dev/n…` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" |
| 1783 | sh file write | `"$RUNNER_TEMP/opencode-session.json"` | `/dev/null` | `scan-opencode.test.mjs`: "security-scan.yml, OpenCode runs: with a base check, the model's text and the server's log wait for the check" |
| 1784 | sh if \|\| operand | `! jq -e '.messages \| type == "array"' "$RUNNER_TEMP/opencode-session.json" >/dev…` | `false` | its copy at `security-scan.yml` line 1367, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1786 | sh file write | `"$RUNNER_TEMP/opencode-session.json"` | `/dev/null` | its copy at `security-scan.yml` line 1369, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1794 | jq select whole | `.info.role == "assistant"` | `true` | Not a rule: the assistant messages feed only the run log's turn count, cost, tokens and last text; the turn limit counts its own way |
| 1794 | jq select whole | `.info.role == "assistant"` | `false` | Not a rule: the assistant messages feed only the run log's turn count, cost, tokens and last text; the turn limit counts its own way |
| 1796 | jq if whole | `$a.info == null` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1796 | jq if whole | `$a.info == null` | `false` | its copy at `security-scan.yml` line 1379, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1796 | jq if whole | `$a == {}` | `true` | its copy at `security-scan.yml` line 1379, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1796 | jq if whole | `$a == {}` | `false` | its copy at `security-scan.yml` line 1379, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1797 | jq if whole | `$structured == null` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1797 | jq if whole | `$structured == null` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, OpenCode runs: with a base check, the model's text and the server's log wait for the check" |
| 1799 | jq if and operand | `$status == 0` | `true` | Not a rule: the subtype goes only to the run log; is_error, worked out apart, decides the step |
| 1799 | jq if whole | `$status == 0 and $error == null` | `true` | Not a rule: the subtype goes only to the run log; is_error, worked out apart, decides the step |
| 1799 | jq if whole | `$status == 0 and $error == null` | `false` | Not a rule: the subtype goes only to the run log; is_error, worked out apart, decides the step |
| 1799 | jq if and operand | `$error == null` | `true` | Not a rule: the subtype goes only to the run log; is_error, worked out apart, decides the step |
| 1801 | jq select whole | `.type == "step-start"` | `true` | its copy at `security-scan.yml` line 1384, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1801 | jq select whole | `.type == "step-start"` | `false` | its copy at `security-scan.yml` line 1384, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1809 | jq if whole | `$error == null` | `true` | its copy at `security-scan.yml` line 1392, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1809 | jq if whole | `$error == null` | `false` | its copy at `security-scan.yml` line 1392, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1810 | jq select whole | `.type == "text"` | `true` | its copy at `security-scan.yml` line 1393, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1810 | jq select whole | `.type == "text"` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, OpenCode runs: with a base check, the model's text and the server's log wait for the check" |
| 1819 | sh file write | `"$HELD.summary"` | `/dev/null` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1821 | sh if whole | `[ "$(jq -r '.is_error' <<<"$result")" != "false" ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1821 | sh if whole | `[ "$(jq -r '.is_error' <<<"$result")" != "false" ]` | `false` | `scan-opencode.test.mjs`: "security-scan.yml, OpenCode runs: with a base check, the model's text and the server's log wait for the check" |
| 1829 | sh file write | `"$HELD.server"` | `/dev/null` | `scan-opencode.test.mjs`: "security-scan.yml, OpenCode runs: with a base check, the model's text and the server's log wait for the check" |
| 1838 | jq if whole | `$m.info.role == "user"` | `true` | its copy at `security-scan.yml` line 1421, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1838 | jq if whole | `$m.info.role == "user"` | `false` | its copy at `security-scan.yml` line 1421, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1839 | jq if and operand | `$m.info.role == "assistant"` | `true` | Not caught, equivalent: OpenCode stores a user message with no step-start parts, so counting it adds nothing |
| 1839 | jq if whole | `$m.info.role == "assistant" and . >= 0 and $kinds[.] == "run"` | `true` | its copy at `security-scan.yml` line 1422, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1839 | jq if whole | `$m.info.role == "assistant" and . >= 0 and $kinds[.] == "run"` | `false` | its copy at `security-scan.yml` line 1422, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1839 | jq if and operand | `. >= 0` | `true` | Not caught, unreachable: a session opens with the prompt, a user message, so no assistant message comes before index 0 |
| 1839 | jq if and operand | `$kinds[.] == "run"` | `true` | its copy at `security-scan.yml` line 1422, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1840 | jq select whole | `.type == "step-start"` | `true` | its copy at `security-scan.yml` line 1423, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1840 | jq select whole | `.type == "step-start"` | `false` | its copy at `security-scan.yml` line 1423, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1841 | sh if whole | `[ "$turns" -ge "$KIT_SECURITY_MAX_TURNS" ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1841 | sh if whole | `[ "$turns" -ge "$KIT_SECURITY_MAX_TURNS" ]` | `false` | its copy at `security-scan.yml` line 1424, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1853 | if: whole | `${{ always() && env.RUN != 'false' && (steps.verify.outcome != 'skipped' \|\| step…` | `true` | `security-scan-log-content.test.mjs`: "the check is found before any model runs, and the secret reaches no step that runs one" |
| 1853 | if: whole | `${{ always() && env.RUN != 'false' && (steps.verify.outcome != 'skipped' \|\| step…` | `false` | `security-scan-log-content.test.mjs`: "the check is found before any model runs, and the secret reaches no step that runs one" |
| 1853 | if: && operand | `always()` | `true` | `security-scan-log-content.test.mjs`: "the check is found before any model runs, and the secret reaches no step that runs one" |
| 1853 | if: && operand | `env.RUN != 'false'` | `true` | `security-scan-log-content.test.mjs`: "the check is found before any model runs, and the secret reaches no step that runs one" |
| 1853 | if: && operand | `(steps.verify.outcome != 'skipped' \|\| steps.verify_opencode.outcome != 'skipped'…` | `true` | `security-scan-log-content.test.mjs`: "the check is found before any model runs, and the secret reaches no step that runs one" |
| 1853 | if: \|\| operand | `steps.verify.outcome != 'skipped'` | `false` | `security-scan-log-content.test.mjs`: "the check is found before any model runs, and the secret reaches no step that runs one" |
| 1853 | if: \|\| operand | `steps.verify_opencode.outcome != 'skipped'` | `false` | `security-scan-log-content.test.mjs`: "the check is found before any model runs, and the secret reaches no step that runs one" |
| 1863 | if: && operand | `always()` | `true` | `security-scan-conditions.test.mjs`: ".git comes back for OpenCode, even after a failure" |
| 1863 | if: whole | `always() && env.KIT_SECURITY_RUNNER == 'opencode'` | `true` | `security-scan-conditions.test.mjs`: ".git comes back for OpenCode, even after a failure" |
| 1863 | if: whole | `always() && env.KIT_SECURITY_RUNNER == 'opencode'` | `false` | `security-scan-conditions.test.mjs`: ".git comes back for OpenCode, even after a failure" |
| 1863 | if: && operand | `env.KIT_SECURITY_RUNNER == 'opencode'` | `true` | `security-scan-conditions.test.mjs`: ".git comes back for OpenCode, even after a failure" |
| 1865 | sh if && operand | `[ -d "$RUNNER_TEMP/checkout-git" ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml: OpenCode's configuration goes, and .git leaves the checkout and comes back once" |
| 1865 | sh if whole | `[ -d "$RUNNER_TEMP/checkout-git" ] && [ ! -e .git ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml: OpenCode's configuration goes, and .git leaves the checkout and comes back once" |
| 1865 | sh if whole | `[ -d "$RUNNER_TEMP/checkout-git" ] && [ ! -e .git ]` | `false` | `scan-opencode.test.mjs`: "security-scan.yml: OpenCode's configuration goes, and .git leaves the checkout and comes back once" |
| 1865 | sh if && operand | `[ ! -e .git ]` | `true` | `scan-opencode.test.mjs`: "security-scan.yml: OpenCode's configuration goes, and .git leaves the checkout and comes back once" |
| 1866 | sh output statement | (before `mv -- "$RUNNER_TEMP/checkout-git" .git`) | `: ` | `scan-opencode.test.mjs`: "security-scan.yml: OpenCode's configuration goes, and .git leaves the checkout and comes back once" |
| 1877 | if: whole | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 1877 | if: whole | `env.RUN != 'false'` | `false` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 1885 | sh if whole | `[ "$(jq '.findings \| length' "$candidates")" -eq 0 ]` | `true` | `security-scan.test.mjs`: "the verification drops only candidates it has a verdict on and keeps none of" |
| 1885 | sh if whole | `[ "$(jq '.findings \| length' "$candidates")" -eq 0 ]` | `false` | `security-scan.test.mjs`: "no candidates need no verification, and a malformed verification fails" |
| 1886 | sh file write | `"$RESULTS"` | `/dev/null` | `security-scan.test.mjs`: "no candidates need no verification, and a malformed verification fails" |
| 1888 | sh skip statement | `exit 0` | `:` | `security-scan.test.mjs`: "no candidates need no verification, and a malformed verification fails" |
| 1890 | jq if whole | `type == "array"` | `true` | `security-scan.test.mjs`: "the verification drops only candidates it has a verdict on and keeps none of" |
| 1890 | jq if whole | `type == "array"` | `false` | `security-scan.test.mjs`: "the verification's stream is read for its last result" |
| 1890 | jq select whole | `.type == "result"` | `true` | `security-scan.test.mjs`: "the verification's stream is read for its last result" |
| 1890 | jq select whole | `.type == "result"` | `false` | `security-scan.test.mjs`: "the verification's stream is read for its last result" |
| 1891 | sh if whole | `! jq -e ' .structured_output \| type == "object" and (.verdicts \| type == "array"…` | `true` | `security-scan.test.mjs`: "the verification drops only candidates it has a verdict on and keeps none of" |
| 1891 | sh if whole | `! jq -e ' .structured_output \| type == "object" and (.verdicts \| type == "array"…` | `false` | `security-scan.test.mjs`: "no candidates need no verification, and a malformed verification fails" |
| 1901 | sh file write | `"$RUNNER_TEMP/verdicts.json"` | `/dev/null` | `security-scan.test.mjs`: "the verification drops only candidates it has a verdict on and keeps none of" |
| 1906 | jq select whole | `.id == $f.id` | `true` | `security-scan.test.mjs`: "the verification drops only candidates it has a verdict on and keeps none of" |
| 1906 | jq select whole | `.id == $f.id` | `false` | `security-scan.test.mjs`: "the verification drops only candidates it has a verdict on and keeps none of" |
| 1907 | jq select whole | `.keep` | `true` | `security-scan.test.mjs`: "the verification drops only candidates it has a verdict on and keeps none of" |
| 1907 | jq select whole | `.keep` | `false` | `security-scan.test.mjs`: "the verification drops only candidates it has a verdict on and keeps none of" |
| 1908 | jq if whole | `($mine \| length) == 0` | `true` | `security-scan.test.mjs`: "the verification drops only candidates it has a verdict on and keeps none of" |
| 1908 | jq if whole | `($mine \| length) == 0` | `false` | `security-scan.test.mjs`: "the verification drops only candidates it has a verdict on and keeps none of" |
| 1910 | jq elif whole | `$kept != null` | `true` | `security-scan.test.mjs`: "the verification drops only candidates it has a verdict on and keeps none of" |
| 1910 | jq elif whole | `$kept != null` | `false` | `security-scan.test.mjs`: "the verification drops only candidates it has a verdict on and keeps none of" |
| 1915 | jq select whole | `._excluded \| not` | `true` | `security-scan.test.mjs`: "the verification drops only candidates it has a verdict on and keeps none of" |
| 1915 | jq select whole | `._excluded \| not` | `false` | `security-scan.test.mjs`: "the verification drops only candidates it has a verdict on and keeps none of" |
| 1916 | jq select whole | `._excluded` | `true` | `security-scan.test.mjs`: "the verification drops only candidates it has a verdict on and keeps none of" |
| 1916 | jq select whole | `._excluded` | `false` | `security-scan.test.mjs`: "the verification drops only candidates it has a verdict on and keeps none of" |
| 1920 | jq select whole | `._excluded` | `true` | `security-scan.test.mjs`: "the verification drops only candidates it has a verdict on and keeps none of" |
| 1920 | jq select whole | `._excluded` | `false` | `security-scan.test.mjs`: "the verification drops only candidates it has a verdict on and keeps none of" |
| 1921 | jq select whole | `._excluded \| not` | `true` | `security-scan.test.mjs`: "the verification drops only candidates it has a verdict on and keeps none of" |
| 1921 | jq select whole | `._excluded \| not` | `false` | `security-scan.test.mjs`: "the verification drops only candidates it has a verdict on and keeps none of" |
| 1927 | sh if whole | `[ -n "$dropped" ]` | `true` | Not a rule: only whether the log shows an empty group of dropped candidates |
| 1927 | sh if whole | `[ -n "$dropped" ]` | `false` | `security-scan.test.mjs`: "the verification drops only candidates it has a verdict on and keeps none of" |
| 1950 | if: whole | `${{ always() && env.RUN != 'false' && (steps.scan.outcome != 'skipped' \|\| steps.…` | `true` | `security-scan-conditions.test.mjs`: "the log, hold and summary steps run after either runner's step, even when it failed" |
| 1950 | if: whole | `${{ always() && env.RUN != 'false' && (steps.scan.outcome != 'skipped' \|\| steps.…` | `false` | `security-scan-conditions.test.mjs`: "the log, hold and summary steps run after either runner's step, even when it failed" |
| 1950 | if: && operand | `always()` | `true` | `security-scan-conditions.test.mjs`: "the log, hold and summary steps run after either runner's step, even when it failed" |
| 1950 | if: && operand | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "the log, hold and summary steps run after either runner's step, even when it failed" |
| 1950 | if: && operand | `(steps.scan.outcome != 'skipped' \|\| steps.scan_opencode.outcome != 'skipped')` | `true` | `security-scan-conditions.test.mjs`: "the log, hold and summary steps run after either runner's step, even when it failed" |
| 1950 | if: \|\| operand | `steps.scan.outcome != 'skipped'` | `false` | `security-scan-conditions.test.mjs`: "the log, hold and summary steps run after either runner's step, even when it failed" |
| 1950 | if: \|\| operand | `steps.scan_opencode.outcome != 'skipped'` | `false` | `security-scan-conditions.test.mjs`: "the log, hold and summary steps run after either runner's step, even when it failed" |
| 1960 | sh output statement | (before `touch -- "$pending"`) | `: ` | `security-scan-log-content.test.mjs`: "without the guard, the hold step fails and leaves its marker, and the run and print steps fail before printing" |
| 1964 | sh if \|\| operand | `[ ! -s "$RESULTS" ]` | `false` | Not caught, equivalent: jq -e on a missing or empty file fails too, so the other operand takes the same branch |
| 1964 | sh if whole | `[ ! -s "$RESULTS" ] \ \|\| ! jq -e 'type == "object" and has("findings") and .anal…` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 1964 | sh if whole | `[ ! -s "$RESULTS" ] \ \|\| ! jq -e 'type == "object" and has("findings") and .anal…` | `false` | `security-scan-public-content.test.mjs`: "when the verification did not finish, the candidates are checked" |
| 1965 | sh if \|\| operand | `! jq -e 'type == "object" and has("findings") and .analysis_summary.review_compl…` | `false` | `security-scan-public-content.test.mjs`: "results that are not a completed scan send the hold to the candidates" |
| 1967 | sh if \|\| operand | `[ -z "${SCAN_INPUT:-}" ]` | `false` | Not caught, equivalent: with SCAN_INPUT unset the candidates path is /candidates.json, which does not exist, so the next test holds anyway |
| 1967 | sh if whole | `[ -z "${SCAN_INPUT:-}" ] \|\| [ ! -s "$source" ]` | `true` | `security-scan-public-content.test.mjs`: "when the verification did not finish, the candidates are checked" |
| 1967 | sh if whole | `[ -z "${SCAN_INPUT:-}" ] \|\| [ ! -s "$source" ]` | `false` | `security-scan-public-content.test.mjs`: "the hold clears its marker when there is nothing to hold: no result, no check, or no finding" |
| 1967 | sh if \|\| operand | `[ ! -s "$source" ]` | `false` | `security-scan-public-content.test.mjs`: "the hold clears its marker when there is nothing to hold: no result, no check, or no finding" |
| 1969 | sh output statement | (before `rm -f -- "$pending"`) | `: ` | `security-scan-public-content.test.mjs`: "the hold clears its marker when there is nothing to hold: no result, no check, or no finding" |
| 1970 | sh skip statement | `exit 0` | `:` | `security-scan-public-content.test.mjs`: "the hold clears its marker when there is nothing to hold: no result, no check, or no finding" |
| 1976 | sh if whole | `[ "$(pc_state)" = none ]` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 1976 | sh if whole | `[ "$(pc_state)" = none ]` | `false` | `security-scan-public-content.test.mjs`: "a check only the head has is ignored, and the findings go as before" |
| 1978 | sh output statement | (before `rm -f -- "$pending"`) | `: ` | `security-scan-public-content.test.mjs`: "the hold clears its marker when there is nothing to hold: no result, no check, or no finding" |
| 1979 | sh skip statement | `exit 0` | `:` | Not caught, equivalent: with no check, pc_check passes every finding, so the step ends with the marker removed and nothing withheld either way; only the log differs |
| 1982 | sh if whole | `[ "$n" -eq 0 ]` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 1982 | sh if whole | `[ "$n" -eq 0 ]` | `false` | `security-scan-public-content.test.mjs`: "the hold clears its marker when there is nothing to hold: no result, no check, or no finding" |
| 1984 | sh output statement | (before `rm -f -- "$pending"`) | `: ` | `security-scan-public-content.test.mjs`: "the hold clears its marker when there is nothing to hold: no result, no check, or no finding" |
| 1985 | sh skip statement | `exit 0` | `:` | Not caught, equivalent: with no findings the loop checks nothing, so the step ends with the marker removed and nothing withheld either way; only the log differs |
| 1990 | sh while && operand | `[ -z "$why" ]` | `true` | `security-scan-public-content.test.mjs`: "a check that cannot run is not run again for the findings after it" |
| 1990 | sh while whole | `[ -z "$why" ] && [ "$i" -lt "$n" ]` | `true` | `security-scan-public-content.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 1990 | sh while whole | `[ -z "$why" ] && [ "$i" -lt "$n" ]` | `false` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 1990 | sh while && operand | `[ "$i" -lt "$n" ]` | `true` | `security-scan-public-content.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 1999 | jq if whole | `type == "object"` | `true` | Not caught, unreachable: the collect step admits only object findings, so every finding the later steps read is one |
| 1999 | jq if whole | `type == "object"` | `false` | `security-scan-public-content.test.mjs`: "a finding withheld for a sign-off line names that kind" |
| 2006 | sh list condition | `pc_check "$text"` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2006 | sh list condition | `pc_check "$text"` | `false` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2007 | sh if whole | `[ "$status" -eq 1 ]` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2007 | sh if whole | `[ "$status" -eq 1 ]` | `false` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2010 | sh elif whole | `[ "$status" -ne 0 ]` | `true` | Not caught, equivalent: pc_check clears PC_WHY and leaves it empty when it passes, so a passing check sets why to empty either way |
| 2010 | sh elif whole | `[ "$status" -ne 0 ]` | `false` | `security-scan-public-content.test.mjs`: "a check that cannot run withholds every finding, and the notice says so" |
| 2015 | sh output statement | (before `rm -f -- "$text"`) | `: ` | Not a rule: removes a scratch file in RUNNER_TEMP, which the runner discards |
| 2016 | sh if whole | `[ -n "$why" ]` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2016 | sh if whole | `[ -n "$why" ]` | `false` | `security-scan-public-content.test.mjs`: "a check that cannot run withholds every finding, and the notice says so" |
| 2018 | sh list && operand | `[ "$n" -eq 1 ]` | `true` | `security-scan-public-content.test.mjs`: "a check that cannot run withholds every finding, and the notice says so" |
| 2018 | sh list whole | `[ "$n" -eq 1 ] && what="the finding's text is"` | `true` | `security-scan-public-content.test.mjs`: "a check that cannot run withholds every finding, and the notice says so" |
| 2018 | sh list whole | `[ "$n" -eq 1 ] && what="the finding's text is"` | `false` | `security-scan-public-content.test.mjs`: "a check that runs past its time limit cannot run" |
| 2018 | sh list && operand | `what="the finding's text is"` | `true` | `security-scan-public-content.test.mjs`: "a check that runs past its time limit cannot run" |
| 2021 | sh elif whole | `[ "${#withheld[@]}" -gt 0 ]` | `true` | `security-scan-public-content.test.mjs`: "findings the check passes are left as they were" |
| 2021 | sh elif whole | `[ "${#withheld[@]}" -gt 0 ]` | `false` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2024 | sh list && operand | `[ "$k" -eq 1 ]` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2024 | sh list whole | `[ "$k" -eq 1 ] && what="1 of the $n findings is"` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2024 | sh list whole | `[ "$k" -eq 1 ] && what="1 of the $n findings is"` | `false` | `security-scan-public-content.test.mjs`: "results that are not a completed scan send the hold to the candidates" |
| 2024 | sh list && operand | `what="1 of the $n findings is"` | `true` | `security-scan-public-content.test.mjs`: "results that are not a completed scan send the hold to the candidates" |
| 2029 | sh output statement | (before `rm -f -- "$pending"`) | `: ` | `security-scan-public-content.test.mjs`: "a check step that did not finish leaves the summary listing no finding's text" |
| 2030 | sh skip statement | `exit 0` | `:` | `security-scan-public-content.test.mjs`: "findings the check passes are left as they were" |
| 2032 | sh file write | `"$RUNNER_TEMP/scan-withheld.md"` | `/dev/null` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2034 | jq if and operand | `(.value \| type == "object")` | `true` | Not caught, unreachable: the collect step admits only object findings, so every finding the later steps read is one |
| 2034 | jq if whole | `(.value \| type == "object") and (.key as $k \| $ids \| any(.[]; . == $k))` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2034 | jq if whole | `(.value \| type == "object") and (.key as $k \| $ids \| any(.[]; . == $k))` | `false` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2034 | jq if and operand | `(.key as $k \| $ids \| any(.[]; . == $k))` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2035 | sh file write | `"$source.tmp"` | `/dev/null` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2036 | sh output statement | (before `mv -- "$source.tmp" "$source"`) | `: ` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2037 | sh output statement | (before `rm -f -- "$pending"`) | `: ` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2050 | if: whole | `${{ always() && env.RUN != 'false' && (steps.scan.outcome != 'skipped' \|\| steps.…` | `true` | `security-scan-conditions.test.mjs`: "the log, hold and summary steps run after either runner's step, even when it failed" |
| 2050 | if: whole | `${{ always() && env.RUN != 'false' && (steps.scan.outcome != 'skipped' \|\| steps.…` | `false` | `security-scan-conditions.test.mjs`: "the log, hold and summary steps run after either runner's step, even when it failed" |
| 2050 | if: && operand | `always()` | `true` | `security-scan-conditions.test.mjs`: "the log, hold and summary steps run after either runner's step, even when it failed" |
| 2050 | if: && operand | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "the log, hold and summary steps run after either runner's step, even when it failed" |
| 2050 | if: && operand | `(steps.scan.outcome != 'skipped' \|\| steps.scan_opencode.outcome != 'skipped')` | `true` | `security-scan-conditions.test.mjs`: "the log, hold and summary steps run after either runner's step, even when it failed" |
| 2050 | if: \|\| operand | `steps.scan.outcome != 'skipped'` | `false` | `security-scan-conditions.test.mjs`: "the log, hold and summary steps run after either runner's step, even when it failed" |
| 2050 | if: \|\| operand | `steps.scan_opencode.outcome != 'skipped'` | `false` | `security-scan-conditions.test.mjs`: "the log, hold and summary steps run after either runner's step, even when it failed" |
| 2057 | sh if \|\| operand | `[ ! -s "$RESULTS" ]` | `false` | Not caught, equivalent: jq -e on a missing or empty file fails too, so the other operand takes the same branch |
| 2057 | sh if whole | `[ ! -s "$RESULTS" ] \ \|\| ! jq -e 'type == "object" and has("findings") and .anal…` | `true` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2057 | sh if whole | `[ ! -s "$RESULTS" ] \ \|\| ! jq -e 'type == "object" and has("findings") and .anal…` | `false` | `security-scan.test.mjs`: "without results the summary lists the scan's candidates as unverified" |
| 2058 | sh if \|\| operand | `! jq -e 'type == "object" and has("findings") and .analysis_summary.review_compl…` | `false` | `security-scan.test.mjs`: "results that are not a completed scan send the summary to the candidates, and their counts stay out" |
| 2060 | sh if \|\| operand | `[ -z "${SCAN_INPUT:-}" ]` | `false` | Not caught, equivalent: with SCAN_INPUT unset the candidates path is /candidates.json, which does not exist, so the next test holds anyway |
| 2060 | sh if whole | `[ -z "${SCAN_INPUT:-}" ] \|\| [ ! -s "$source" ]` | `true` | `security-scan.test.mjs`: "without results the summary lists the scan's candidates as unverified" |
| 2060 | sh if whole | `[ -z "${SCAN_INPUT:-}" ] \|\| [ ! -s "$source" ]` | `false` | `security-scan.test.mjs`: "with neither results nor candidates the summary writes nothing" |
| 2060 | sh if \|\| operand | `[ ! -s "$source" ]` | `false` | `security-scan.test.mjs`: "with neither results nor candidates the summary writes nothing" |
| 2062 | sh skip statement | `exit 0` | `:` | `security-scan.test.mjs`: "with neither results nor candidates the summary writes nothing" |
| 2065 | sh output statement | (before `touch "$RUNNER_TEMP/scan-unverified"`) | `: ` | `security-scan.test.mjs`: "without results the summary lists the scan's candidates as unverified" |
| 2067 | jq select whole | `type == "object"` | `true` | Not caught, unreachable: the collect step admits only object findings, so every finding the later steps read is one |
| 2067 | jq select whole | `type == "object"` | `false` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2070 | jq select and operand | `type == "object"` | `true` | Not caught, unreachable: the collect step admits only object findings, so every finding the later steps read is one |
| 2070 | jq select whole | `type == "object" and (._withheld \| not)` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2070 | jq select whole | `type == "object" and (._withheld \| not)` | `false` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2070 | jq select and operand | `(._withheld \| not)` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2071 | sh if && operand | `[ -e "$RUNNER_TEMP/scan-content-pending" ]` | `true` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2071 | sh if whole | `[ -e "$RUNNER_TEMP/scan-content-pending" ] && [ "$count" -gt 0 ]` | `true` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2071 | sh if whole | `[ -e "$RUNNER_TEMP/scan-content-pending" ] && [ "$count" -gt 0 ]` | `false` | `security-scan-public-content.test.mjs`: "a check step that did not finish leaves the summary listing no finding's text" |
| 2071 | sh if && operand | `[ "$count" -gt 0 ]` | `true` | `security-scan.test.mjs`: "a hold that did not finish withholds every finding, said for one or none" |
| 2073 | sh list && operand | `[ "$count" -eq 1 ]` | `true` | `security-scan-public-content.test.mjs`: "a check step that did not finish leaves the summary listing no finding's text" |
| 2073 | sh list whole | `[ "$count" -eq 1 ] && what="the finding's text is"` | `true` | `security-scan-public-content.test.mjs`: "a check step that did not finish leaves the summary listing no finding's text" |
| 2073 | sh list whole | `[ "$count" -eq 1 ] && what="the finding's text is"` | `false` | `security-scan.test.mjs`: "a hold that did not finish withholds every finding, said for one or none" |
| 2073 | sh list && operand | `what="the finding's text is"` | `true` | `security-scan.test.mjs`: "a hold that did not finish withholds every finding, said for one or none" |
| 2075 | sh file write | `"$RUNNER_TEMP/scan-withheld.md"` | `/dev/null` | `security-scan-public-content.test.mjs`: "a check step that did not finish leaves the summary listing no finding's text" |
| 2082 | jq select and operand | `type == "object"` | `true` | Not caught, unreachable: the collect step admits only object findings, so every finding the later steps read is one |
| 2082 | jq select whole | `type == "object" and (._withheld \| not)` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2082 | jq select whole | `type == "object" and (._withheld \| not)` | `false` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2082 | jq select and operand | `(._withheld \| not)` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2086 | jq if whole | `$sev == ""` | `true` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2086 | jq if whole | `$sev == ""` | `false` | `security-scan.test.mjs`: "a finding without a rating, a line or a description is listed without them" |
| 2087 | jq if whole | `$line` | `true` | `security-scan.test.mjs`: "a finding without a rating, a line or a description is listed without them" |
| 2087 | jq if whole | `$line` | `false` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2088 | jq if whole | `$what == ""` | `true` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2088 | jq if whole | `$what == ""` | `false` | `security-scan.test.mjs`: "a finding without a rating, a line or a description is listed without them" |
| 2089 | jq if or operand | `$unverified == "true"` | `false` | `security-scan.test.mjs`: "without results the summary lists the scan's candidates as unverified" |
| 2089 | jq if whole | `$unverified == "true" or ._filter_metadata.verified == false` | `true` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2089 | jq if whole | `$unverified == "true" or ._filter_metadata.verified == false` | `false` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2089 | jq if or operand | `._filter_metadata.verified == false` | `false` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2092 | sh if whole | `[ "$shown" -gt 0 ]` | `true` | `security-scan-public-content.test.mjs`: "a check that cannot run withholds every finding, and the notice says so" |
| 2092 | sh if whole | `[ "$shown" -gt 0 ]` | `false` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2094 | sh list condition | `[ "$shown" -eq "$count" ]` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2094 | sh list condition | `[ "$shown" -eq "$count" ]` | `false` | Not a rule: the wording of the log group's heading |
| 2103 | sh list condition | `[ "$shown" -le 30 ]` | `true` | `security-scan.test.mjs`: "the record lists 30 findings and 20 unread files, and points to the log for the rest" |
| 2103 | sh list condition | `[ "$shown" -le 30 ]` | `false` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2117 | sh if whole | `! git --attr-source="origin/$BASE" diff --no-ext-diff --no-textconv --numstat --…` | `true` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2117 | sh if whole | `! git --attr-source="origin/$BASE" diff --no-ext-diff --no-textconv --numstat --…` | `false` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2117 | sh file write | `"$numstat"` | `/dev/null` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2122 | sh while whole | `IFS= read -r -d '' e` | `true` | `security-scan.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 2122 | sh while whole | `IFS= read -r -d '' e` | `false` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2123 | sh if whole | `[[ "$e" == $'-\t-\t'* ]]` | `true` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2123 | sh if whole | `[[ "$e" == $'-\t-\t'* ]]` | `false` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2132 | sh if whole | `[ -n "$unread" ]` | `true` | `security-scan.test.mjs`: "a deleted file counts as a changed file with a text diff" |
| 2132 | sh if whole | `[ -n "$unread" ]` | `false` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2135 | sh list condition | `[ "$n" -le 20 ]` | `true` | `security-scan.test.mjs`: "the record lists 30 findings and 20 unread files, and points to the log for the rest" |
| 2135 | sh list condition | `[ "$n" -le 20 ]` | `false` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2153 | sh if && operand | `[ -n "$reviewed" ]` | `true` | Not caught, equivalent: an empty count makes `[ ... -lt "" ]` fail as a test, so the && list is false either way |
| 2153 | sh if whole | `[ -n "$reviewed" ] && [ -n "$text_files" ] && [ "$reviewed" -lt "$text_files" ]` | `true` | `security-scan.test.mjs`: "a deleted file counts as a changed file with a text diff" |
| 2153 | sh if whole | `[ -n "$reviewed" ] && [ -n "$text_files" ] && [ "$reviewed" -lt "$text_files" ]` | `false` | `security-scan.test.mjs`: "the record says when the scanner reports reading fewer files than changed" |
| 2153 | sh if && operand | `[ -n "$text_files" ]` | `true` | Not caught, equivalent: an empty count makes `[ ... -lt "" ]` fail as a test, so the && list is false either way |
| 2153 | sh if && operand | `[ "$reviewed" -lt "$text_files" ]` | `true` | `security-scan.test.mjs`: "a deleted file counts as a changed file with a text diff" |
| 2159 | sh list condition | `[ -z "$coverage" ]` | `true` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2159 | sh list condition | `[ -z "$coverage" ]` | `false` | `security-scan.test.mjs`: "a deleted file counts as a changed file with a text diff" |
| 2159 | sh file write | `"$RUNNER_TEMP/scan-coverage.md"` | `/dev/null` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2160 | sh file write | `"$RUNNER_TEMP/scan-count"` | `/dev/null` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2161 | sh if whole | `[ "$shown" -gt 0 ]` | `true` | `security-scan.test.mjs`: "a scan with no candidates claims no verification run" |
| 2161 | sh if whole | `[ "$shown" -gt 0 ]` | `false` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2162 | sh file write | `"$RUNNER_TEMP/scan-findings.md"` | `/dev/null` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2164 | sh if && operand | `[ "$source" = "$RESULTS" ]` | `true` | `security-scan.test.mjs`: "results that are not a completed scan send the summary to the candidates, and their counts stay out" |
| 2164 | sh if whole | `[ "$source" = "$RESULTS" ] && [ "$(jq '.filtering_summary.total_original_finding…` | `true` | `security-scan.test.mjs`: "a scan with no candidates claims no verification run" |
| 2164 | sh if whole | `[ "$source" = "$RESULTS" ] && [ "$(jq '.filtering_summary.total_original_finding…` | `false` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2164 | sh if && operand | `[ "$(jq '.filtering_summary.total_original_findings' "$RESULTS")" -gt 0 ]` | `true` | `security-scan.test.mjs`: "a scan with no candidates claims no verification run" |
| 2165 | jq if whole | `.total_original_findings == 1` | `true` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2165 | jq if whole | `.total_original_findings == 1` | `false` | `security-scan.test.mjs`: "a finding without a rating, a line or a description is listed without them" |
| 2165 | sh file write | `"$RUNNER_TEMP/scan-filtering.md"` | `/dev/null` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2169 | if: whole | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 2169 | if: whole | `env.RUN != 'false'` | `false` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 2173 | sh if whole | `[ ! -s "$RESULTS" ]` | `true` | `security-scan.test.mjs`: "the run fails without a results file or a completed review in it" |
| 2173 | sh if whole | `[ ! -s "$RESULTS" ]` | `false` | `security-scan.test.mjs`: "the run fails without a results file or a completed review in it" |
| 2177 | sh if whole | `! jq -e 'type == "object" and has("findings") and .analysis_summary.review_compl…` | `true` | `security-scan.test.mjs`: "the run fails without a results file or a completed review in it" |
| 2177 | sh if whole | `! jq -e 'type == "object" and has("findings") and .analysis_summary.review_compl…` | `false` | `security-scan.test.mjs`: "the run fails without a results file or a completed review in it" |
| 2190 | if: whole | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 2190 | if: whole | `env.RUN != 'false'` | `false` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 2199 | jq select and operand | `type == "object"` | `true` | Not caught, unreachable: the collect step admits only object findings, so every finding the later steps read is one |
| 2199 | jq select whole | `type == "object" and ._withheld` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2199 | jq select whole | `type == "object" and ._withheld` | `false` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2199 | jq select and operand | `._withheld` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2200 | sh list condition | `[ "$withheld" -eq 0 ]` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2200 | sh list condition | `[ "$withheld" -eq 0 ]` | `false` | Not a rule: a log line counting the withheld findings |
| 2201 | sh list condition | `[ "$(jq '[.findings[] \| select(type != "object" or (._withheld \| not))] \| length…` | `true` | `security-scan.test.mjs`: "a withheld finding gets no inline comment, and an unverified one says so" |
| 2201 | sh list condition | `[ "$(jq '[.findings[] \| select(type != "object" or (._withheld \| not))] \| length…` | `false` | `security-scan.test.mjs`: "each finding goes on its line as plain text, once" |
| 2201 | jq select or operand | `type != "object"` | `false` | Not caught, unreachable: the collect step admits only object findings, so every finding the later steps read is one |
| 2201 | jq select whole | `type != "object" or (._withheld \| not)` | `true` | `security-scan.test.mjs`: "a withheld finding gets no inline comment, and an unverified one says so" |
| 2201 | jq select whole | `type != "object" or (._withheld \| not)` | `false` | `security-scan.test.mjs`: "each finding goes on its line as plain text, once" |
| 2201 | jq select or operand | `(._withheld \| not)` | `false` | `security-scan.test.mjs`: "each finding goes on its line as plain text, once" |
| 2201 | sh skip statement | `exit 0` | `:` | `security-scan.test.mjs`: "a withheld finding gets no inline comment, and an unverified one says so" |
| 2205 | jq select whole | `.user.login == "github-actions[bot]"` | `true` | `security-scan.test.mjs`: "a key quoted in a comment's text, or by another author, does not stop a comment" |
| 2205 | jq select whole | `.user.login == "github-actions[bot]"` | `false` | `security-scan.test.mjs`: "each finding goes on its line as plain text, once" |
| 2208 | sh while whole | `IFS= read -r f` | `true` | `security-scan.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 2208 | sh while whole | `IFS= read -r f` | `false` | `security-scan.test.mjs`: "each finding goes on its line as plain text, once" |
| 2209 | sh list condition | `[ -n "$f" ]` | `true` | Not caught, unreachable: `jq -c` prints one non-empty line per finding, so no line is empty |
| 2209 | sh list condition | `[ -n "$f" ]` | `false` | `security-scan.test.mjs`: "each finding goes on its line as plain text, once" |
| 2209 | sh skip statement | `continue` | `:` | Not caught, unreachable: `jq -c` prints one non-empty line per finding, so no line is empty |
| 2212 | sh if whole | `grep -qxF "$key" <<<"$existing"` | `true` | `security-scan.test.mjs`: "each finding goes on its line as plain text, once" |
| 2212 | sh if whole | `grep -qxF "$key" <<<"$existing"` | `false` | `security-scan.test.mjs`: "the same finding twice in one run is posted once" |
| 2214 | sh skip statement | `continue` | `:` | `security-scan.test.mjs`: "the same finding twice in one run is posted once" |
| 2219 | jq if whole | `._filter_metadata.verified == false` | `true` | `security-scan.test.mjs`: "each finding goes on its line as plain text, once" |
| 2219 | jq if whole | `._filter_metadata.verified == false` | `false` | `security-scan.test.mjs`: "a withheld finding gets no inline comment, and an unverified one says so" |
| 2224 | sh if whole | `jq -n --arg body "$body" --arg commit "$HEAD" --arg path "$path" --argjson line …` | `true` | `security-scan.test.mjs`: "each finding goes on its line as plain text, once" |
| 2224 | sh if whole | `jq -n --arg body "$body" --arg commit "$HEAD" --arg path "$path" --argjson line …` | `false` | `security-scan.test.mjs`: "each finding goes on its line as plain text, once" |
| 2226 | sh output statement | (before `gh api -X POST "repos/$REPO/pulls/$PR/comments" --input - --`) | `: ` | `security-scan.test.mjs`: "each finding goes on its line as plain text, once" |
| 2234 | jq select or operand | `type != "object"` | `false` | Not caught, unreachable: the collect step admits only object findings, so every finding the later steps read is one |
| 2234 | jq select whole | `type != "object" or (._withheld \| not)` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2234 | jq select whole | `type != "object" or (._withheld \| not)` | `false` | `security-scan.test.mjs`: "each finding goes on its line as plain text, once" |
| 2234 | jq select or operand | `(._withheld \| not)` | `false` | `security-scan.test.mjs`: "each finding goes on its line as plain text, once" |
| 2242 | if: whole | `env.RUN != 'false'` | `true` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 2242 | if: whole | `env.RUN != 'false'` | `false` | `security-scan-conditions.test.mjs`: "each step after the skip runs unless the skip set RUN to false" |
| 2259 | sh if whole | `[ "$live" != "$scanned" ]` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2259 | sh if whole | `[ "$live" != "$scanned" ]` | `false` | `workflow-fail-closed.test.mjs`: "security-scan.yml: a base that moved the pull request's diff after the scan records nothing" |
| 2262 | sh if whole | `[ "$mb_scanned" != "$mb_live" ]` | `true` | `workflow-fail-closed.test.mjs`: "security-scan.yml: a base that moved the pull request's diff after the scan records nothing" |
| 2262 | sh if whole | `[ "$mb_scanned" != "$mb_live" ]` | `false` | `workflow-fail-closed.test.mjs`: "security-scan.yml: a base that moved the pull request's diff after the scan records nothing" |
| 2273 | sh if whole | `[ -s "$RUNNER_TEMP/$f" ]` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2273 | sh if whole | `[ -s "$RUNNER_TEMP/$f" ]` | `false` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2278 | sh if whole | `[ "$count" -eq 0 ]` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2278 | sh if whole | `[ "$count" -eq 0 ]` | `false` | `security-scan.test.mjs`: "the record names no findings, one finding or several, with or without their list" |
| 2281 | sh list && operand | `[ "$count" -eq 1 ]` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2281 | sh list whole | `[ "$count" -eq 1 ] && noun=finding` | `true` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2281 | sh list whole | `[ "$count" -eq 1 ] && noun=finding` | `false` | `security-scan.test.mjs`: "the record names no findings, one finding or several, with or without their list" |
| 2281 | sh list && operand | `noun=finding` | `true` | `security-scan.test.mjs`: "the record names no findings, one finding or several, with or without their list" |
| 2284 | sh if whole | `[ -s "$RUNNER_TEMP/scan-findings.md" ]` | `true` | `security-scan.test.mjs`: "the record names no findings, one finding or several, with or without their list" |
| 2284 | sh if whole | `[ -s "$RUNNER_TEMP/scan-findings.md" ]` | `false` | `security-scan-public-content.test.mjs`: "a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not" |
| 2297 | jq select and operand | `.user.login == "github-actions[bot]"` | `true` | `security-scan.test.mjs`: "the record and the notice update only the bot's own record comment" |
| 2297 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| startswith("<!-- security-scan…` | `true` | `security-scan.test.mjs`: "the record and the notice update only the bot's own record comment" |
| 2297 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| startswith("<!-- security-scan…` | `false` | `security-scan.test.mjs`: "the record and the notice update only the bot's own record comment" |
| 2297 | jq select and operand | `(.body \| startswith("<!-- security-scan-record -->"))` | `true` | `security-scan.test.mjs`: "the record and the notice update only the bot's own record comment" |
| 2298 | sh if whole | `[ -n "$id" ]` | `true` | `security-scan.test.mjs`: "the record and the notice update only the bot's own record comment" |
| 2298 | sh if whole | `[ -n "$id" ]` | `false` | `security-scan.test.mjs`: "the record and the notice update only the bot's own record comment" |
| 2299 | sh output statement | (before `gh api --method PATCH "repos/$REPO/issues/comments/$id" -f b`) | `: ` | `security-scan.test.mjs`: "the record and the notice update only the bot's own record comment" |
| 2301 | sh output statement | (before `gh api --method POST "repos/$REPO/issues/$PR/comments" -f bo`) | `: ` | `security-scan.test.mjs`: "the record names no findings, one finding or several, with or without their list" |
| 2312 | if: \|\| operand | `failure()` | `false` | `security-scan-conditions.test.mjs`: "the not-completed record is written only when the job failed or was cancelled" |
| 2312 | if: whole | `failure() \|\| cancelled()` | `true` | `security-scan-conditions.test.mjs`: "the not-completed record is written only when the job failed or was cancelled" |
| 2312 | if: whole | `failure() \|\| cancelled()` | `false` | `security-scan-conditions.test.mjs`: "the not-completed record is written only when the job failed or was cancelled" |
| 2312 | if: \|\| operand | `cancelled()` | `false` | `security-scan-conditions.test.mjs`: "the not-completed record is written only when the job failed or was cancelled" |
| 2322 | sh if whole | `[ "$JOB_STATUS" = cancelled ]` | `true` | `security-scan.test.mjs`: "a run that stopped in the verification lists the candidates as unverified" |
| 2322 | sh if whole | `[ "$JOB_STATUS" = cancelled ]` | `false` | `security-scan.test.mjs`: "a cancelled run leaves the record to a newer head's run, and records its own head's" |
| 2324 | sh if whole | `[ "$live" != "$HEAD" ]` | `true` | `security-scan.test.mjs`: "a cancelled run leaves the record to a newer head's run, and records its own head's" |
| 2324 | sh if whole | `[ "$live" != "$HEAD" ]` | `false` | `security-scan.test.mjs`: "a cancelled run leaves the record to a newer head's run, and records its own head's" |
| 2326 | sh skip statement | `exit 0` | `:` | `security-scan.test.mjs`: "a cancelled run leaves the record to a newer head's run, and records its own head's" |
| 2330 | jq select and operand | `.user.login == "github-actions[bot]"` | `true` | `security-scan.test.mjs`: "the record and the notice update only the bot's own record comment" |
| 2330 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| startswith("<!-- security-scan…` | `true` | `security-scan.test.mjs`: "the record and the notice update only the bot's own record comment" |
| 2330 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| startswith("<!-- security-scan…` | `false` | `kit-settings.test.mjs`: "the scan's notice names no mode when the settings job failed" |
| 2330 | jq select and operand | `(.body \| startswith("<!-- security-scan-record -->"))` | `true` | `security-scan.test.mjs`: "the record and the notice update only the bot's own record comment" |
| 2335 | sh if whole | `[ -n "$id" ]` | `true` | `security-scan.test.mjs`: "a run that stopped in the verification lists the candidates as unverified" |
| 2335 | sh if whole | `[ -n "$id" ]` | `false` | `kit-settings.test.mjs`: "the scan's notice names no mode when the settings job failed" |
| 2343 | sh if whole | `printf '%s\n' "$previous" \| grep -q '^Security scan record: scanned head '` | `true` | `security-scan.test.mjs`: "the notice says how to scan again in each mode, and keeps the last record below it" |
| 2343 | sh if whole | `printf '%s\n' "$previous" \| grep -q '^Security scan record: scanned head '` | `false` | `kit-settings.test.mjs`: "the scan's notice names no mode when the settings job failed" |
| 2344 | sh if whole | `[ "$MODE" = "push" ]` | `true` | `kit-settings.test.mjs`: "the scan's notice names no mode when the settings job failed" |
| 2344 | sh if whole | `[ "$MODE" = "push" ]` | `false` | `security-scan.test.mjs`: "the notice says how to scan again in each mode, and keeps the last record below it" |
| 2347 | sh elif whole | `[ "$MODE" = "open" ]` | `true` | `kit-settings.test.mjs`: "the scan's notice names no mode when the settings job failed" |
| 2347 | sh elif whole | `[ "$MODE" = "open" ]` | `false` | `security-scan.test.mjs`: "the notice says how to scan again in each mode, and keeps the last record below it" |
| 2366 | sh if whole | `[ -s "$RUNNER_TEMP/scan-count" ]` | `true` | `kit-settings.test.mjs`: "the scan's notice names no mode when the settings job failed" |
| 2366 | sh if whole | `[ -s "$RUNNER_TEMP/scan-count" ]` | `false` | `security-scan.test.mjs`: "a run that stopped in the verification lists the candidates as unverified" |
| 2368 | sh list && operand | `[ "$count" -eq 1 ]` | `true` | `security-scan-public-content.test.mjs`: "a check that cannot run withholds every finding, and the notice says so" |
| 2368 | sh list whole | `[ "$count" -eq 1 ] && noun=finding` | `true` | `security-scan-public-content.test.mjs`: "a check that cannot run withholds every finding, and the notice says so" |
| 2368 | sh list whole | `[ "$count" -eq 1 ] && noun=finding` | `false` | `security-scan.test.mjs`: "the notice counts the findings in the singular and plural, and says what was not covered" |
| 2368 | sh list && operand | `noun=finding` | `true` | `security-scan.test.mjs`: "the notice counts the findings in the singular and plural, and says what was not covered" |
| 2369 | sh if whole | `[ -e "$RUNNER_TEMP/scan-unverified" ]` | `true` | `security-scan-public-content.test.mjs`: "a check that cannot run withholds every finding, and the notice says so" |
| 2369 | sh if whole | `[ -e "$RUNNER_TEMP/scan-unverified" ]` | `false` | `security-scan.test.mjs`: "a run that stopped in the verification lists the candidates as unverified" |
| 2370 | sh list && operand | `[ "$count" -eq 1 ]` | `true` | `security-scan.test.mjs`: "the notice counts the findings in the singular and plural, and says what was not covered" |
| 2370 | sh list whole | `[ "$count" -eq 1 ] && noun="unverified candidate finding"` | `true` | `security-scan.test.mjs`: "a run that stopped in the verification lists the candidates as unverified" |
| 2370 | sh list whole | `[ "$count" -eq 1 ] && noun="unverified candidate finding"` | `false` | `security-scan.test.mjs`: "a run that stopped in the verification lists the candidates as unverified" |
| 2370 | sh list && operand | `noun="unverified candidate finding"` | `true` | `security-scan.test.mjs`: "a run that stopped in the verification lists the candidates as unverified" |
| 2375 | sh if whole | `[ -s "$RUNNER_TEMP/scan-findings.md" ]` | `true` | `security-scan-public-content.test.mjs`: "a check that cannot run withholds every finding, and the notice says so" |
| 2375 | sh if whole | `[ -s "$RUNNER_TEMP/scan-findings.md" ]` | `false` | `security-scan.test.mjs`: "a run that stopped in the verification lists the candidates as unverified" |
| 2380 | sh if whole | `[ -s "$RUNNER_TEMP/scan-withheld.md" ]` | `true` | `security-scan.test.mjs`: "a run that stopped in the verification lists the candidates as unverified" |
| 2380 | sh if whole | `[ -s "$RUNNER_TEMP/scan-withheld.md" ]` | `false` | `security-scan-public-content.test.mjs`: "a check that cannot run withholds every finding, and the notice says so" |
| 2385 | sh if whole | `[ -s "$RUNNER_TEMP/scan-coverage.md" ]` | `true` | `security-scan.test.mjs`: "a run that stopped in the verification lists the candidates as unverified" |
| 2385 | sh if whole | `[ -s "$RUNNER_TEMP/scan-coverage.md" ]` | `false` | `security-scan.test.mjs`: "the notice counts the findings in the singular and plural, and says what was not covered" |
| 2405 | sh if whole | `[ -n "$id" ]` | `true` | `security-scan.test.mjs`: "a run that stopped in the verification lists the candidates as unverified" |
| 2405 | sh if whole | `[ -n "$id" ]` | `false` | `kit-settings.test.mjs`: "the scan's notice names no mode when the settings job failed" |
| 2406 | sh output statement | (before `gh api --method PATCH "repos/$REPO/issues/comments/$id" -f b`) | `: ` | `kit-settings.test.mjs`: "the scan's notice names no mode when the settings job failed" |
| 2408 | sh output statement | (before `gh api --method POST "repos/$REPO/issues/$PR/comments" -f bo`) | `: ` | `security-scan.test.mjs`: "a run that stopped in the verification lists the candidates as unverified" |

</details>

### `.github/workflows/pr-review.yml`, rows found in phase 2

5 rules: 4 caught (0 of them by a time limit), 1 left with the reason given.

<details><summary>Every rule of <code>.github/workflows/pr-review.yml</code></summary>

| Line | Kind | Rule | Switched off as | Caught by, or why not |
| --- | --- | --- | --- | --- |
| 677 | sh output statement | (before `xargs -0 -r rm -rf --`) | `: ` | `pr-review-rules.test.mjs`: "the reviewer's rules and server come from the base, and no CLAUDE.md is left to load" |
| 695 | sh output statement | (before `git checkout "origin/$BASE" -- "$f"`) | `: ` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 717 | sh skip statement | `continue` | `:` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 1663 | sh skip statement | `continue` | `:` | Not caught, equivalent: an empty line comes only from an empty listing, which leaves no report either way |
| 1742 | sh skip statement | `continue` | `:` | `pr-review-no-verdict.test.mjs`: "a failed access lookup still records, as the refusal step did not refuse" |

</details>

### `.github/workflows/issue-triage.yml`

678 rules: 632 caught (4 of them by a time limit, 52 through a copy of their step), 46 left with the reason given.

<details><summary>Every rule of <code>.github/workflows/issue-triage.yml</code></summary>

| Line | Kind | Rule | Switched off as | Caught by, or why not |
| --- | --- | --- | --- | --- |
| 72 | if: \|\| operand | `github.event_name != 'issues'` | `false` | `issue-triage-conditions.test.mjs`: "the settings job runs on a sweep, a dispatch, and the issue events triage reads" |
| 72 | if: whole | `github.event_name != 'issues' \|\| (github.event.issue.state == 'open' && (github.…` | `true` | `issue-triage-conditions.test.mjs`: "the settings job runs on a sweep, a dispatch, and the issue events triage reads" |
| 72 | if: whole | `github.event_name != 'issues' \|\| (github.event.issue.state == 'open' && (github.…` | `false` | `issue-triage-conditions.test.mjs`: "the settings job runs on a sweep, a dispatch, and the issue events triage reads" |
| 73 | if: \|\| operand | `(github.event.issue.state == 'open' && (github.event.issue.user.type != 'Bot' \|\|…` | `false` | `issue-triage-conditions.test.mjs`: "the settings job runs on a sweep, a dispatch, and the issue events triage reads" |
| 73 | if: && operand | `github.event.issue.state == 'open'` | `true` | `issue-triage-conditions.test.mjs`: "the settings job runs on a sweep, a dispatch, and the issue events triage reads" |
| 74 | if: && operand | `(github.event.issue.user.type != 'Bot' \|\| (github.event.issue.user.login == 'git…` | `true` | `issue-triage-conditions.test.mjs`: "the settings job runs on a sweep, a dispatch, and the issue events triage reads" |
| 74 | if: \|\| operand | `github.event.issue.user.type != 'Bot'` | `false` | `issue-triage-conditions.test.mjs`: "the settings job runs on a sweep, a dispatch, and the issue events triage reads" |
| 75 | if: \|\| operand | `(github.event.issue.user.login == 'github-actions[bot]' && (github.event.action …` | `false` | `issue-triage-conditions.test.mjs`: "the settings job runs on a sweep, a dispatch, and the issue events triage reads" |
| 75 | if: && operand | `github.event.issue.user.login == 'github-actions[bot]'` | `true` | `issue-triage-conditions.test.mjs`: "the settings job runs on a sweep, a dispatch, and the issue events triage reads" |
| 76 | if: && operand | `(github.event.action == 'edited' \|\| (github.event.action == 'labeled' && github.…` | `true` | `issue-triage-conditions.test.mjs`: "the settings job runs on a sweep, a dispatch, and the issue events triage reads" |
| 76 | if: \|\| operand | `github.event.action == 'edited'` | `false` | `issue-triage-conditions.test.mjs`: "the settings job runs on a sweep, a dispatch, and the issue events triage reads" |
| 77 | if: \|\| operand | `(github.event.action == 'labeled' && github.event.label.name == 'needs-triage')` | `false` | `issue-triage-conditions.test.mjs`: "the settings job runs on a sweep, a dispatch, and the issue events triage reads" |
| 77 | if: && operand | `github.event.action == 'labeled'` | `true` | `issue-triage-gate.test.mjs`: "issue-triage.yml: the settings job passes a bot's issue only on a vouching needs-triage or an edit" |
| 77 | if: && operand | `github.event.label.name == 'needs-triage'` | `true` | Not caught, equivalent: a labeled event passes only when the label is needs-triage, by the condition after it (`github.event.action != 'labeled' || github.event.label.name == 'needs-triage'`), so dropping the same test inside the github-actions[bot] branch changes nothing |
| 78 | if: && operand | `(github.event.action != 'labeled' \|\| github.event.label.name == 'needs-triage')` | `true` | `issue-triage-conditions.test.mjs`: "the settings job runs on a sweep, a dispatch, and the issue events triage reads" |
| 78 | if: \|\| operand | `github.event.action != 'labeled'` | `false` | `issue-triage-conditions.test.mjs`: "the settings job runs on a sweep, a dispatch, and the issue events triage reads" |
| 78 | if: \|\| operand | `github.event.label.name == 'needs-triage'` | `false` | `issue-triage-conditions.test.mjs`: "the settings job runs on a sweep, a dispatch, and the issue events triage reads" |
| 79 | if: && operand | `(github.event.action != 'opened' \|\| !contains(github.event.issue.labels.*.name, …` | `true` | `issue-triage-conditions.test.mjs`: "the settings job runs on a sweep, a dispatch, and the issue events triage reads" |
| 79 | if: \|\| operand | `github.event.action != 'opened'` | `false` | `issue-triage-conditions.test.mjs`: "the settings job runs on a sweep, a dispatch, and the issue events triage reads" |
| 79 | if: \|\| operand | `!contains(github.event.issue.labels.*.name, 'needs-triage')` | `false` | `issue-triage-conditions.test.mjs`: "the settings job runs on a sweep, a dispatch, and the issue events triage reads" |
| 98 | job output | `${{ steps.pass.outputs.KIT_ISSUE_TRIAGE }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 99 | job output | `${{ steps.pass.outputs.KIT_TRIAGE_PROVIDER }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 100 | job output | `${{ steps.pass.outputs.KIT_TRIAGE_RUNNER }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 101 | job output | `${{ steps.pass.outputs.KIT_TRIAGE_MODEL }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 102 | job output | `${{ steps.pass.outputs.KIT_TRIAGE_EFFORT }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 103 | job output | `${{ steps.pass.outputs.KIT_TRIAGE_MAX_TURNS }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 104 | job output | `${{ steps.pass.outputs.KIT_TRIAGE_TIMEOUT_MINUTES }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 136 | sh if whole | `content=$(gh api "repos/$REPO/contents/$file" \ --jq 'if .type != "file" then er…` | `true` | its copy at `pr-review.yml` line 142, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 136 | sh if whole | `content=$(gh api "repos/$REPO/contents/$file" \ --jq 'if .type != "file" then er…` | `false` | its copy at `pr-review.yml` line 142, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 137 | jq if whole | `.type != "file"` | `true` | its copy at `pr-review.yml` line 143, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 137 | jq if whole | `.type != "file"` | `false` | its copy at `pr-review.yml` line 143, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 137 | jq elif whole | `.size > 16384` | `true` | its copy at `pr-review.yml` line 143, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 137 | jq elif whole | `.size > 16384` | `false` | its copy at `pr-review.yml` line 143, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 140 | sh elif whole | `grep -q 'HTTP 404' "$err"` | `true` | its copy at `pr-review.yml` line 146, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 140 | sh elif whole | `grep -q 'HTTP 404' "$err"` | `false` | its copy at `pr-review.yml` line 146, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 145 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 151, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 155 | sh while \|\| operand | `IFS= read -r l` | `false` | its copy at `pr-review.yml` line 161, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 155 | sh while whole | `IFS= read -r l \|\| [ -n "$l" ]` | `true` | its copy at `pr-review.yml` line 161, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 155 | sh while whole | `IFS= read -r l \|\| [ -n "$l" ]` | `false` | its copy at `pr-review.yml` line 161, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 155 | sh while \|\| operand | `[ -n "$l" ]` | `false` | Not caught, equivalent: the lines come from a here-string, which always ends its last line with a newline (bash 5.2, checked 2026-11-27), so `read` never ends on an unterminated line here |
| 158 | sh if \|\| operand | `[[ "$l" =~ ^[[:space:]]*(#.*)?$ ]]` | `false` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 158 | sh if whole | `[[ "$l" =~ ^[[:space:]]*(#.*)?$ ]] \|\| { [ "$l" = "---" ] && [ "${#at[@]}" -eq 0 …` | `true` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 158 | sh if whole | `[[ "$l" =~ ^[[:space:]]*(#.*)?$ ]] \|\| { [ "$l" = "---" ] && [ "${#at[@]}" -eq 0 …` | `false` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 158 | sh if \|\| operand | `{ [ "$l" = "---" ] && [ "${#at[@]}" -eq 0 ]; }` | `false` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 158 | sh if && operand | `[ "$l" = "---" ]` | `true` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 158 | sh if && operand | `[ "${#at[@]}" -eq 0 ]` | `true` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 159 | sh skip statement | `continue` | `:` | its copy at `pr-review.yml` line 165, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 161 | sh if whole | `! [[ "$l" =~ ^([A-Z][A-Z0-9_]*):(.*)$ ]]` | `true` | its copy at `pr-review.yml` line 167, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 161 | sh if whole | `! [[ "$l" =~ ^([A-Z][A-Z0-9_]*):(.*)$ ]]` | `false` | its copy at `pr-review.yml` line 167, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 163 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 169, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 166 | sh if whole | `[[ " ${known[*]} " != *" $name "* ]]` | `true` | its copy at `pr-review.yml` line 172, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 166 | sh if whole | `[[ " ${known[*]} " != *" $name "* ]]` | `false` | its copy at `pr-review.yml` line 172, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 168 | sh case arm | `*KEY* \| *TOKEN* \| *SECRET* \| *PASSWORD*` | `__mutant_never__` | its copy at `pr-review.yml` line 174, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 170 | sh case arm | `KIT_*` | `__mutant_never__` | its copy at `pr-review.yml` line 176, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 172 | sh case arm | `*` | `__mutant_never__` | its copy at `pr-review.yml` line 178, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 175 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 181, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 177 | sh if whole | `[ -n "${at[$name]:-}" ]` | `true` | its copy at `pr-review.yml` line 183, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 177 | sh if whole | `[ -n "${at[$name]:-}" ]` | `false` | its copy at `pr-review.yml` line 183, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 179 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 185, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 181 | sh if whole | `! [[ "$rest" =~ $pair ]]` | `true` | its copy at `pr-review.yml` line 187, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 181 | sh if whole | `! [[ "$rest" =~ $pair ]]` | `false` | its copy at `pr-review.yml` line 187, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 183 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 189, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 195 | sh if whole | `[ -n "$v" ]` | `true` | its copy at `pr-review.yml` line 201, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 195 | sh if whole | `[ -n "$v" ]` | `false` | its copy at `pr-review.yml` line 201, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 197 | sh elif whole | `[ -n "${value[$name]:-}" ]` | `true` | its copy at `pr-review.yml` line 203, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 197 | sh elif whole | `[ -n "${value[$name]:-}" ]` | `false` | its copy at `pr-review.yml` line 203, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 203 | sh if whole | `! [[ "$v" =~ ^$word*$ ]]` | `true` | its copy at `pr-review.yml` line 209, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 203 | sh if whole | `! [[ "$v" =~ ^$word*$ ]]` | `false` | its copy at `pr-review.yml` line 209, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 205 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 211, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 210 | sh case arm | `KIT_REVIEW_MODE \| KIT_SECURITY_SCAN` | `__mutant_never__` | its copy at `pr-review.yml` line 216, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 211 | sh case arm | `KIT_ISSUE_TRIAGE \| KIT_UPDATE_CHECK \| KIT_ISSUE_LINK_CHECK` | `__mutant_never__` | its copy at `pr-review.yml` line 217, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 212 | sh case arm | `*` | `__mutant_never__` | its copy at `pr-review.yml` line 218, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 214 | sh if && operand | `[ -n "$states" ]` | `true` | its copy at `pr-review.yml` line 220, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 214 | sh if whole | `[ -n "$states" ] && [ -n "$v" ] && [[ " $states " != *" $v "* ]]` | `true` | its copy at `pr-review.yml` line 220, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 214 | sh if whole | `[ -n "$states" ] && [ -n "$v" ] && [[ " $states " != *" $v "* ]]` | `false` | its copy at `pr-review.yml` line 220, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 214 | sh if && operand | `[ -n "$v" ]` | `true` | its copy at `pr-review.yml` line 220, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 214 | sh if && operand | `[[ " $states " != *" $v "* ]]` | `true` | its copy at `pr-review.yml` line 220, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 216 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 222, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 218 | sh output statement | (before `echo "$name=$v" >> "$GITHUB_ENV"`) | `: ` | its copy at `pr-review.yml` line 224, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 219 | sh output statement | (before `echo "FROM_$name=$from" >> "$GITHUB_ENV"`) | `: ` | its copy at `pr-review.yml` line 225, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 227 | if: whole | `env.KIT_ISSUE_TRIAGE == 'on'` | `true` | `issue-triage-conditions.test.mjs`: "the settings are read, and the triage job runs, only while triage is on" |
| 227 | if: whole | `env.KIT_ISSUE_TRIAGE == 'on'` | `false` | `issue-triage-conditions.test.mjs`: "the settings are read, and the triage job runs, only while triage is on" |
| 241 | sh list condition | `[ -n "$value" ]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 241 | sh list condition | `[ -n "$value" ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml: the turn and time limits default, and a value out of range fails" |
| 242 | sh if \|\| operand | `! [[ "$value" =~ ^[1-9][0-9]*$ ]]` | `false` | `kit-settings.test.mjs`: "a value out of range names where it came from" |
| 242 | sh if whole | `! [[ "$value" =~ ^[1-9][0-9]*$ ]] \|\| [ "${#value}" -gt 6 ] \|\| [ "$value" -gt "$m…` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 242 | sh if whole | `! [[ "$value" =~ ^[1-9][0-9]*$ ]] \|\| [ "${#value}" -gt 6 ] \|\| [ "$value" -gt "$m…` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml: the turn and time limits default, and a value out of range fails" |
| 242 | sh if \|\| operand | `[ "${#value}" -gt 6 ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml: the turn and time limits default, and a value out of range fails" |
| 242 | sh if \|\| operand | `[ "$value" -gt "$max" ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml: the turn and time limits default, and a value out of range fails" |
| 244 | sh failure statement | `exit 1` | `:` | `triage-opencode.test.mjs`: "issue-triage.yml: the turn and time limits default, and a value out of range fails" |
| 246 | sh output statement | (before `echo "$name=$value" >> "$GITHUB_ENV"`) | `: ` | `triage-opencode.test.mjs`: "issue-triage.yml: the turn and time limits default, and a value out of range fails" |
| 252 | sh list condition | `[ -n "$value" ]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 252 | sh list condition | `[ -n "$value" ]` | `false` | `model-provider.test.mjs`: "issue-triage.yml: the provider sets which model names the settings step takes" |
| 253 | sh if whole | `! [[ "$value" =~ ^claude-[a-z0-9.-]+$ ]]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 253 | sh if whole | `! [[ "$value" =~ ^claude-[a-z0-9.-]+$ ]]` | `false` | `model-provider.test.mjs`: "issue-triage.yml: the provider sets which model names the settings step takes" |
| 255 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "issue-triage.yml: the provider sets which model names the settings step takes" |
| 257 | sh output statement | (before `echo "$name=$value" >> "$GITHUB_ENV"`) | `: ` | `model-provider.test.mjs`: "issue-triage.yml: the provider sets which model names the settings step takes" |
| 274 | sh list condition | `[ -n "$value" ]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 274 | sh list condition | `[ -n "$value" ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 275 | sh if whole | `! [[ "$value" =~ ^[a-z0-9][a-z0-9.-]*$ ]]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 275 | sh if whole | `! [[ "$value" =~ ^[a-z0-9][a-z0-9.-]*$ ]]` | `false` | `model-provider.test.mjs`: "issue-triage.yml: the provider sets which model names the settings step takes" |
| 277 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "issue-triage.yml: the provider sets which model names the settings step takes" |
| 279 | sh if whole | `[[ "$value" == *-contributor ]]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 279 | sh if whole | `[[ "$value" == *-contributor ]]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 281 | sh failure statement | `exit 1` | `:` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 283 | sh output statement | (before `echo "$name=$value" >> "$GITHUB_ENV"`) | `: ` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 294 | sh if && operand | `[ -n "$value" ]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 294 | sh if whole | `[ -n "$value" ] && ! [[ "$value" =~ ^(low\|medium\|high\|xhigh\|max)$ ]]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 294 | sh if whole | `[ -n "$value" ] && ! [[ "$value" =~ ^(low\|medium\|high\|xhigh\|max)$ ]]` | `false` | `model-provider.test.mjs`: "issue-triage.yml: the provider sets which model names the settings step takes" |
| 294 | sh if && operand | `! [[ "$value" =~ ^(low\|medium\|high\|xhigh\|max)$ ]]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 296 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "issue-triage.yml: the provider sets which model names the settings step takes" |
| 298 | sh output statement | (before `echo "$name=$value" >> "$GITHUB_ENV"`) | `: ` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 315 | sh case arm | `''` | `__mutant_never__` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 317 | sh list condition | `[ "$PROVIDER" != opencode-go ]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 317 | sh list condition | `[ "$PROVIDER" != opencode-go ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 318 | sh case arm | `claude-code` | `__mutant_never__` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 320 | sh if whole | `[ "$PROVIDER" = opencode-go ]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml: the turn and time limits default, and a value out of range fails" |
| 320 | sh if whole | `[ "$PROVIDER" = opencode-go ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 323 | sh case arm | `opencode` | `__mutant_never__` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 324 | sh if whole | `[ "$PROVIDER" != opencode-go ]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 324 | sh if whole | `[ "$PROVIDER" != opencode-go ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 326 | sh failure statement | `exit 1` | `:` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 329 | sh case arm | `*` | `__mutant_never__` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 331 | sh failure statement | `exit 1` | `:` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 333 | sh output statement | (before `echo "KIT_TRIAGE_RUNNER=$runner" >> "$GITHUB_ENV"`) | `: ` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 336 | sh case arm | `''\|anthropic` | `__mutant_never__` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 337 | sh output statement | (before `echo "KIT_TRIAGE_PROVIDER=anthropic" >> "$GITHUB_ENV"`) | `: ` | `model-provider.test.mjs`: "issue-triage.yml: the provider sets which model names the settings step takes" |
| 340 | sh case arm | `opencode-go` | `__mutant_never__` | `triage-opencode.test.mjs`: "issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 341 | sh output statement | (before `echo "KIT_TRIAGE_PROVIDER=opencode-go" >> "$GITHUB_ENV"`) | `: ` | `model-provider.test.mjs`: "issue-triage.yml: the provider sets which model names the settings step takes" |
| 344 | sh case arm | `*` | `__mutant_never__` | `model-provider.test.mjs`: "issue-triage.yml: the provider sets which model names the settings step takes" |
| 346 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "issue-triage.yml: the provider sets which model names the settings step takes" |
| 358 | sh output statement | (before `printf '%s=%s\n' "$name" "${!name}" >> "$GITHUB_OUTPUT"`) | `: ` | `kit-settings.test.mjs`: "each workflow's pass step hands every setting on as an output" |
| 368 | if: whole | `needs.settings.outputs.KIT_ISSUE_TRIAGE == 'on'` | `true` | `issue-triage-conditions.test.mjs`: "the settings are read, and the triage job runs, only while triage is on" |
| 368 | if: whole | `needs.settings.outputs.KIT_ISSUE_TRIAGE == 'on'` | `false` | `issue-triage-conditions.test.mjs`: "the settings are read, and the triage job runs, only while triage is on" |
| 371 | job output | `${{ steps.queue.outputs.issues }}` | `''` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the triage job hands the passed-on queue to the dispatch job" |
| 434 | if: whole | `env.TRIAGE_ISSUE != ''` | `true` | `issue-triage-conditions.test.mjs`: "the gate runs for one issue, and the steps after it unless it skipped" |
| 434 | if: whole | `env.TRIAGE_ISSUE != ''` | `false` | `issue-triage-conditions.test.mjs`: "the gate runs for one issue, and the steps after it unless it skipped" |
| 449 | sh if whole | `[ "$EVENT" = "issues" ]` | `true` | `issue-triage-gate.test.mjs`: "a dispatch checks only the author, so a reader's dispatch of a write author's issue passes" |
| 449 | sh if whole | `[ "$EVENT" = "issues" ]` | `false` | `issue-triage-gate.test.mjs`: "an author and actor with write access pass, with no skip" |
| 451 | sh if && operand | `[ "$author" = "github-actions[bot]" ]` | `true` | `issue-triage-gate.test.mjs`: "another bot's issue is refused as before, needs-triage or not" |
| 451 | sh if whole | `[ "$author" = "github-actions[bot]" ] && [ "$type" = Bot ]` | `true` | `issue-triage-gate.test.mjs`: "an author and actor with write access pass, with no skip" |
| 451 | sh if whole | `[ "$author" = "github-actions[bot]" ] && [ "$type" = Bot ]` | `false` | `issue-triage-gate.test.mjs`: "needs-triage added to a github-actions[bot] issue checks the labeller, not the author" |
| 451 | sh if && operand | `[ "$type" = Bot ]` | `true` | Not caught, unreachable: only a GitHub App's account has a login ending in `[bot]` (a person's login takes letters, digits and hyphens), so an author named github-actions[bot] is always of type Bot |
| 452 | sh if && operand | `[ "$EVENT" = "issues" ]` | `true` | `issue-triage-gate.test.mjs`: "a dispatch of a github-actions[bot] issue runs when needs-triage is newer than every edit" |
| 452 | sh if whole | `[ "$EVENT" = "issues" ] && { [ "$ACTION" != labeled ] \|\| [ "$LABEL" != needs-tri…` | `true` | `issue-triage-gate.test.mjs`: "needs-triage added to a github-actions[bot] issue checks the labeller, not the author" |
| 452 | sh if whole | `[ "$EVENT" = "issues" ] && { [ "$ACTION" != labeled ] \|\| [ "$LABEL" != needs-tri…` | `false` | `issue-triage-gate.test.mjs`: "any other event on a github-actions[bot] issue is skipped with a notice" |
| 452 | sh if && operand | `{ [ "$ACTION" != labeled ] \|\| [ "$LABEL" != needs-triage ]; }` | `true` | `issue-triage-gate.test.mjs`: "needs-triage added to a github-actions[bot] issue checks the labeller, not the author" |
| 452 | sh if \|\| operand | `[ "$ACTION" != labeled ]` | `false` | Not caught, unreachable: the label is set only on labeled and unlabeled events, and the workflow does not run on unlabeled (`types: [opened, edited, reopened, labeled]`), so an action other than labeled always comes with an empty label, which the other operand already refuses |
| 452 | sh if \|\| operand | `[ "$LABEL" != needs-triage ]` | `false` | `issue-triage-gate.test.mjs`: "any other event on a github-actions[bot] issue is skipped with a notice" |
| 454 | sh output statement | (before `echo "skip=true" >> "$GITHUB_OUTPUT"`) | `: ` | `issue-triage-gate.test.mjs`: "any other event on a github-actions[bot] issue is skipped with a notice" |
| 455 | sh skip statement | `exit 0` | `:` | `issue-triage-gate.test.mjs`: "any other event on a github-actions[bot] issue is skipped with a notice" |
| 471 | jq select or operand | `.event == "labeled"` | `false` | `issue-triage-gate.test.mjs`: "needs-triage added to a github-actions[bot] issue checks the labeller, not the author" |
| 471 | jq select whole | `.event == "labeled" or .event == "unlabeled" or .event == "renamed" or .event ==…` | `true` | Not caught, equivalent: the awk lines that read the list keep only the labeled, unlabeled, renamed and reopened rows, by their first field, so the other events a wider select lets through are never read |
| 471 | jq select whole | `.event == "labeled" or .event == "unlabeled" or .event == "renamed" or .event ==…` | `false` | `issue-triage-gate.test.mjs`: "needs-triage added to a github-actions[bot] issue checks the labeller, not the author" |
| 471 | jq select or operand | `.event == "unlabeled"` | `false` | `issue-triage-gate.test.mjs`: "a dispatch of a github-actions[bot] issue without a vouching needs-triage ends green with a notice" |
| 471 | jq select or operand | `.event == "renamed"` | `false` | `issue-triage-gate.test.mjs`: "a dispatch of a github-actions[bot] issue without a vouching needs-triage ends green with a notice" |
| 471 | jq select or operand | `.event == "reopened"` | `false` | `issue-triage-gate.test.mjs`: "a dispatch of a github-actions[bot] issue without a vouching needs-triage ends green with a notice" |
| 475 | awk pattern && operand | `($1 == "labeled" \|\| $1 == "unlabeled")` | `1` | Not caught, equivalent: the timeline is filtered to labeled, unlabeled, renamed and reopened events, and only the first two carry a label name, so $3 == "needs-triage" alone selects the same events |
| 475 | awk pattern whole | `($1 == "labeled" \|\| $1 == "unlabeled") && $3 == "needs-triage"` | `1` | `issue-triage-gate.test.mjs`: "a dispatch of a github-actions[bot] issue without a vouching needs-triage ends green with a notice" |
| 475 | awk pattern whole | `($1 == "labeled" \|\| $1 == "unlabeled") && $3 == "needs-triage"` | `0` | `issue-triage-gate.test.mjs`: "needs-triage added to a github-actions[bot] issue checks the labeller, not the author" |
| 475 | awk pattern \|\| operand | `$1 == "labeled"` | `0` | `issue-triage-gate.test.mjs`: "needs-triage added to a github-actions[bot] issue checks the labeller, not the author" |
| 475 | awk pattern \|\| operand | `$1 == "unlabeled"` | `0` | `issue-triage-gate.test.mjs`: "a dispatch of a github-actions[bot] issue without a vouching needs-triage ends green with a notice" |
| 475 | awk pattern && operand | `$3 == "needs-triage"` | `1` | `issue-triage-gate.test.mjs`: "a dispatch of a github-actions[bot] issue without a vouching needs-triage ends green with a notice" |
| 475 | awk implicit print | (before `' <<<"$events" \| tail -n 1)`) | ` {}` | `issue-triage-gate.test.mjs`: "needs-triage added to a github-actions[bot] issue checks the labeller, not the author" |
| 476 | sh list condition | `[ "$(cut -f 1 <<<"$vouch")" = labeled ]` | `true` | `issue-triage-gate.test.mjs`: "a dispatch of a github-actions[bot] issue without a vouching needs-triage ends green with a notice" |
| 476 | sh list condition | `[ "$(cut -f 1 <<<"$vouch")" = labeled ]` | `false` | `issue-triage-gate.test.mjs`: "needs-triage added to a github-actions[bot] issue checks the labeller, not the author" |
| 479 | awk pattern \|\| operand | `$1 == "renamed"` | `0` | `issue-triage-gate.test.mjs`: "a dispatch of a github-actions[bot] issue without a vouching needs-triage ends green with a notice" |
| 479 | awk pattern whole | `$1 == "renamed" \|\| $1 == "reopened"` | `1` | `issue-triage-gate.test.mjs`: "needs-triage added to a github-actions[bot] issue checks the labeller, not the author" |
| 479 | awk pattern whole | `$1 == "renamed" \|\| $1 == "reopened"` | `0` | `issue-triage-gate.test.mjs`: "a dispatch of a github-actions[bot] issue without a vouching needs-triage ends green with a notice" |
| 479 | awk pattern \|\| operand | `$1 == "reopened"` | `0` | `issue-triage-gate.test.mjs`: "a dispatch of a github-actions[bot] issue without a vouching needs-triage ends green with a notice" |
| 479 | awk output statement | `print $2` | `;` | `issue-triage-gate.test.mjs`: "a dispatch of a github-actions[bot] issue without a vouching needs-triage ends green with a notice" |
| 480 | sh list condition | `[[ -z "$edited" \|\| "$edited" < "$later" ]]` | `true` | `issue-triage-gate.test.mjs`: "a label run finds the issue edited after the label it came from, and is skipped" |
| 480 | sh list condition | `[[ -z "$edited" \|\| "$edited" < "$later" ]]` | `false` | `issue-triage-gate.test.mjs`: "a dispatch of a github-actions[bot] issue without a vouching needs-triage ends green with a notice" |
| 480 | sh list [[ \|\| ]] operand | `-z "$edited"` | `-z x` | Not caught, equivalent: with no edit, `[[ "" < "$later" ]]` is true whenever there is a later event, and when there is none, `later` becomes the empty edit time it already is |
| 480 | sh list [[ \|\| ]] operand | `"$edited" < "$later"` | `-z x` | `issue-triage-gate.test.mjs`: "a dispatch of a github-actions[bot] issue without a vouching needs-triage ends green with a notice" |
| 481 | sh if \|\| operand | `! grep -qxF needs-triage <<<"$labels"` | `false` | `issue-triage-gate.test.mjs`: "a dispatch of a github-actions[bot] issue without a vouching needs-triage ends green with a notice" |
| 481 | sh if whole | `! grep -qxF needs-triage <<<"$labels" \|\| [ -z "$by" ] \|\| ! [[ "$at" > "$later" ]…` | `true` | `issue-triage-gate.test.mjs`: "needs-triage added to a github-actions[bot] issue checks the labeller, not the author" |
| 481 | sh if whole | `! grep -qxF needs-triage <<<"$labels" \|\| [ -z "$by" ] \|\| ! [[ "$at" > "$later" ]…` | `false` | `issue-triage-gate.test.mjs`: "a label run finds the issue edited after the label it came from, and is skipped" |
| 481 | sh if \|\| operand | `[ -z "$by" ]` | `false` | `issue-triage-gate.test.mjs`: "a dispatch of a github-actions[bot] issue without a vouching needs-triage ends green with a notice" |
| 481 | sh if \|\| operand | `! [[ "$at" > "$later" ]]` | `false` | `issue-triage-gate.test.mjs`: "a label run finds the issue edited after the label it came from, and is skipped" |
| 481 | sh file write | `"$later"` | `/dev/null` | `issue-triage-gate.test.mjs`: "a label run finds the issue edited after the label it came from, and is skipped" |
| 483 | sh output statement | (before `echo "skip=true" >> "$GITHUB_OUTPUT"`) | `: ` | `issue-triage-gate.test.mjs`: "a label run finds the issue edited after the label it came from, and is skipped" |
| 484 | sh skip statement | `exit 0` | `:` | `issue-triage-gate.test.mjs`: "a label run finds the issue edited after the label it came from, and is skipped" |
| 489 | sh if && operand | `[ "$EVENT" = "issues" ]` | `true` | `issue-triage-gate.test.mjs`: "a dispatch of a github-actions[bot] issue runs when needs-triage is newer than every edit" |
| 489 | sh if whole | `[ "$EVENT" = "issues" ] && [ "$ACTOR" != "$by" ]` | `true` | `issue-triage-gate.test.mjs`: "needs-triage added to a github-actions[bot] issue checks the labeller, not the author" |
| 489 | sh if whole | `[ "$EVENT" = "issues" ] && [ "$ACTOR" != "$by" ]` | `false` | `issue-triage-gate.test.mjs`: "a label run checks its own sender as well as the latest labeller" |
| 489 | sh if && operand | `[ "$ACTOR" != "$by" ]` | `true` | `issue-triage-gate.test.mjs`: "needs-triage added to a github-actions[bot] issue checks the labeller, not the author" |
| 493 | sh if whole | `permission=$(gh api --method GET "repos/$REPO/collaborators/$login/permission" -…` | `true` | `issue-triage-gate.test.mjs`: "an author and actor with write access pass, with no skip" |
| 493 | sh if whole | `permission=$(gh api --method GET "repos/$REPO/collaborators/$login/permission" -…` | `false` | `issue-triage-gate.test.mjs`: "an author and actor with write access pass, with no skip" |
| 495 | sh elif whole | `grep -q 'HTTP 404' "$RUNNER_TEMP/permission-error"` | `true` | `issue-triage-gate.test.mjs`: "a lookup that fails for another reason fails the run, on any event" |
| 495 | sh elif whole | `grep -q 'HTTP 404' "$RUNNER_TEMP/permission-error"` | `false` | `issue-triage-gate.test.mjs`: "an issue event for an author without write access is skipped with a notice" |
| 499 | sh failure statement | `exit 1` | `:` | `issue-triage-gate.test.mjs`: "a lookup that fails for another reason fails the run, on any event" |
| 502 | sh case arm | `admin\|write` | `__mutant_never__` | `issue-triage-gate.test.mjs`: "an author and actor with write access pass, with no skip" |
| 503 | sh case arm | `*` | `__mutant_never__` | `issue-triage-gate.test.mjs`: "an issue event for an author without write access is skipped with a notice" |
| 504 | sh if whole | `[ "$vouched" = true ]` | `true` | `issue-triage-gate.test.mjs`: "an issue event for an author without write access is skipped with a notice" |
| 504 | sh if whole | `[ "$vouched" = true ]` | `false` | `issue-triage-gate.test.mjs`: "needs-triage added to a github-actions[bot] issue checks the labeller, not the author" |
| 506 | sh output statement | (before `echo "skip=true" >> "$GITHUB_OUTPUT"`) | `: ` | `issue-triage-gate.test.mjs`: "needs-triage added to a github-actions[bot] issue checks the labeller, not the author" |
| 507 | sh skip statement | `exit 0` | `:` | `issue-triage-gate.test.mjs`: "needs-triage added to a github-actions[bot] issue checks the labeller, not the author" |
| 509 | sh if whole | `[ "$EVENT" = "issues" ]` | `true` | `issue-triage-gate.test.mjs`: "a dispatch of an issue whose author lacks write access still fails" |
| 509 | sh if whole | `[ "$EVENT" = "issues" ]` | `false` | `issue-triage-gate.test.mjs`: "an issue event for an author without write access is skipped with a notice" |
| 511 | sh output statement | (before `echo "skip=true" >> "$GITHUB_OUTPUT"`) | `: ` | `issue-triage-gate.test.mjs`: "an issue event for an author without write access is skipped with a notice" |
| 512 | sh skip statement | `exit 0` | `:` | `issue-triage-gate.test.mjs`: "an issue event for an author without write access is skipped with a notice" |
| 515 | sh failure statement | `exit 1` | `:` | `issue-triage-gate.test.mjs`: "a dispatch of an issue whose author lacks write access still fails" |
| 521 | sh if whole | `[ "$vouched" = true ]` | `true` | `issue-triage-gate.test.mjs`: "an author and actor with write access pass, with no skip" |
| 521 | sh if whole | `[ "$vouched" = true ]` | `false` | `issue-triage-gate.test.mjs`: "needs-triage added to a github-actions[bot] issue checks the labeller, not the author" |
| 525 | if: whole | `steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "the gate runs for one issue, and the steps after it unless it skipped" |
| 525 | if: whole | `steps.gate.outputs.skip != 'true'` | `false` | `issue-triage-conditions.test.mjs`: "the gate runs for one issue, and the steps after it unless it skipped" |
| 545 | if: whole | `steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "the gate runs for one issue, and the steps after it unless it skipped" |
| 545 | if: whole | `steps.gate.outputs.skip != 'true'` | `false` | `issue-triage-conditions.test.mjs`: "the gate runs for one issue, and the steps after it unless it skipped" |
| 550 | sh case arm | `*[!0-9]*` | `__mutant_never__` | `workflow-fail-closed.test.mjs`: "issue-triage.yml: an issue input that is not a number is refused before anything else" |
| 550 | sh failure statement | `exit 1` | `:` | `workflow-fail-closed.test.mjs`: "issue-triage.yml: an issue input that is not a number is refused before anything else" |
| 552 | sh output statement | (before `echo "DISPATCH_LOG=$RUNNER_TEMP/dispatched" >> "$GITHUB_ENV"`) | `: ` | `issue-triage-steps.test.mjs`: "the tools step gives a triage run its tools and a sweep only the dispatch tools" |
| 553 | sh output statement | (before `echo "DISPATCH_QUEUE=$RUNNER_TEMP/dispatch-queue" >> "$GITHU`) | `: ` | `issue-triage-steps.test.mjs`: "the tools step gives a triage run its tools and a sweep only the dispatch tools" |
| 554 | sh output statement | (before `echo "ELIGIBLE_ISSUES=$RUNNER_TEMP/eligible-issues" >> "$GIT`) | `: ` | `issue-triage-steps.test.mjs`: "the tools step gives a triage run its tools and a sweep only the dispatch tools" |
| 555 | sh output statement | (before `sudo install -d -o root -g root -m 0755 /opt/agent-kit`) | `: ` | Left untested: runner provisioning (sudo install -d /opt/agent-kit on the GitHub runner); every triage run exercises it |
| 556 | sh output statement | (before `sudo install -o root -g root -m 0755 .github/scripts/mcp-ser`) | `: ` | `issue-triage-steps.test.mjs`: "the tools step gives a triage run its tools and a sweep only the dispatch tools" |
| 560 | sh output statement | (before `echo "DENIED=Bash,Edit,Write,NotebookEdit,WebFetch,WebSearch`) | `: ` | `issue-triage-steps.test.mjs`: "the tools step gives a triage run its tools and a sweep only the dispatch tools" |
| 561 | sh if whole | `[ -n "$ISSUE" ]` | `true` | `issue-triage-steps.test.mjs`: "the tools step gives a triage run its tools and a sweep only the dispatch tools" |
| 561 | sh if whole | `[ -n "$ISSUE" ]` | `false` | `issue-triage-steps.test.mjs`: "the tools step gives a triage run its tools and a sweep only the dispatch tools" |
| 562 | sh output statement | (before `echo "MCP_MODE=triage" >> "$GITHUB_ENV"`) | `: ` | `issue-triage-steps.test.mjs`: "the tools step gives a triage run its tools and a sweep only the dispatch tools" |
| 563 | sh output statement | (before `echo "ALLOWED=Read,Grep,Glob,mcp__agent-kit__view,mcp__agent`) | `: ` | `issue-triage-steps.test.mjs`: "the tools step gives a triage run its tools and a sweep only the dispatch tools" |
| 565 | sh output statement | (before `echo "MCP_MODE=sweep" >> "$GITHUB_ENV"`) | `: ` | `issue-triage-steps.test.mjs`: "the tools step gives a triage run its tools and a sweep only the dispatch tools" |
| 566 | sh output statement | (before `echo "ALLOWED=mcp__agent-kit__list_eligible,mcp__agent-kit__`) | `: ` | `issue-triage-steps.test.mjs`: "the tools step gives a triage run its tools and a sweep only the dispatch tools" |
| 576 | if: whole | `steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "the gate runs for one issue, and the steps after it unless it skipped" |
| 576 | if: whole | `steps.gate.outputs.skip != 'true'` | `false` | `issue-triage-conditions.test.mjs`: "the gate runs for one issue, and the steps after it unless it skipped" |
| 582 | sh if whole | `! gh api "repos/$REPO/contents/$f" > "$RUNNER_TEMP/public-content.json" 2> "$RUN…` | `true` | `public-content-install.test.mjs`: "triage installs the default branch's check from the contents API" |
| 582 | sh if whole | `! gh api "repos/$REPO/contents/$f" > "$RUNNER_TEMP/public-content.json" 2> "$RUN…` | `false` | `public-content-install.test.mjs`: "triage installs the default branch's check from the contents API" |
| 582 | sh file write | `"$RUNNER_TEMP/public-content.json"` | `/dev/null` | `public-content-install.test.mjs`: "triage installs the default branch's check from the contents API" |
| 583 | sh if whole | `grep -q 'HTTP 404' "$RUNNER_TEMP/public-content.err"` | `true` | `public-content-install.test.mjs`: "triage fails rather than post unchecked when the check cannot be read whole" |
| 583 | sh if whole | `grep -q 'HTTP 404' "$RUNNER_TEMP/public-content.err"` | `false` | `public-content-install.test.mjs`: "triage takes the Python check when there is no Node one, and none when neither exists" |
| 586 | sh failure statement | `exit 1` | `:` | `public-content-install.test.mjs`: "issue-triage.yml: a failed read of the default branch's check fails the step" |
| 588 | jq if whole | `type == "object"` | `true` | `public-content-install.test.mjs`: "triage fails rather than post unchecked when the check cannot be read whole" |
| 588 | jq if whole | `type == "object"` | `false` | `public-content-install.test.mjs`: "triage installs the default branch's check from the contents API" |
| 589 | sh if whole | `[ "$type" != "file base64" ]` | `true` | `public-content-install.test.mjs`: "triage installs the default branch's check from the contents API" |
| 589 | sh if whole | `[ "$type" != "file base64" ]` | `false` | `public-content-install.test.mjs`: "triage fails rather than post unchecked when the check cannot be read whole" |
| 591 | sh failure statement | `exit 1` | `:` | `public-content-install.test.mjs`: "triage fails rather than post unchecked when the check cannot be read whole" |
| 594 | sh file write | `"$tmp"` | `/dev/null` | `public-content-install.test.mjs`: "triage installs the default branch's check from the contents API" |
| 598 | sh file write | `"$RUNNER_TEMP/public-content-empty"` | `/dev/null` | `public-content-install.test.mjs`: "triage runs the check on an empty file, then leaves none of its files behind" |
| 600 | sh case arm | `*.py` | `__mutant_never__` | `public-content-install.test.mjs`: "triage takes the Python check when there is no Node one, and none when neither exists" |
| 601 | sh case arm | `*` | `__mutant_never__` | `public-content-install.test.mjs`: "triage installs the default branch's check from the contents API" |
| 603 | sh if whole | `! env -i PATH="$PATH" "${run[@]}" "$tmp" --text="$RUNNER_TEMP/public-content-emp…` | `true` | `public-content-install.test.mjs`: "triage installs the default branch's check from the contents API" |
| 603 | sh if whole | `! env -i PATH="$PATH" "${run[@]}" "$tmp" --text="$RUNNER_TEMP/public-content-emp…` | `false` | `public-content-install.test.mjs`: "a check that fails on an empty text stops either workflow before the model runs" |
| 605 | sh failure statement | `exit 1` | `:` | `public-content-install.test.mjs`: "a check that fails on an empty text stops either workflow before the model runs" |
| 607 | sh output statement | (before `rm -f -- "$RUNNER_TEMP/public-content-empty"`) | `: ` | `public-content-install.test.mjs`: "triage runs the check on an empty file, then leaves none of its files behind" |
| 609 | sh output statement | (before `sudo install -o root -g root -m 0644 "$tmp" "$dest"`) | `: ` | `public-content-install.test.mjs`: "triage installs the default branch's check from the contents API" |
| 610 | sh output statement | (before `rm -f -- "$tmp"`) | `: ` | `public-content-install.test.mjs`: "triage runs the check on an empty file, then leaves none of its files behind" |
| 611 | sh output statement | (before `echo "PUBLIC_CONTENT_CHECK=$dest" >> "$GITHUB_ENV"`) | `: ` | `public-content-install.test.mjs`: "triage installs the default branch's check from the contents API" |
| 612 | sh skip statement | `break` | `:` | `public-content-install.test.mjs`: "triage installs the default branch's check from the contents API" |
| 614 | sh output statement | (before `rm -f -- "$RUNNER_TEMP/public-content.json" "$RUNNER_TEMP/pu`) | `: ` | `public-content-install.test.mjs`: "triage runs the check on an empty file, then leaves none of its files behind" |
| 620 | if: whole | `env.TRIAGE_ISSUE == ''` | `true` | `issue-triage-conditions.test.mjs`: "the state check runs for one issue, and the sweep's steps for a sweep" |
| 620 | if: whole | `env.TRIAGE_ISSUE == ''` | `false` | `issue-triage-conditions.test.mjs`: "the state check runs for one issue, and the sweep's steps for a sweep" |
| 628 | jq select and operand | `.pull_request == null` | `true` | `issue-triage-steps.test.mjs`: "the sweep lists needs-triage, unlabelled and stale in-progress issues, not pull requests or bots'" |
| 628 | jq select whole | `.pull_request == null and .user.type != "Bot"` | `true` | `issue-triage-steps.test.mjs`: "the sweep lists needs-triage, unlabelled and stale in-progress issues, not pull requests or bots'" |
| 628 | jq select whole | `.pull_request == null and .user.type != "Bot"` | `false` | `issue-triage-steps.test.mjs`: "the sweep lists needs-triage, unlabelled and stale in-progress issues, not pull requests or bots'" |
| 628 | jq select and operand | `.user.type != "Bot"` | `true` | `issue-triage-steps.test.mjs`: "the sweep lists needs-triage, unlabelled and stale in-progress issues, not pull requests or bots'" |
| 633 | sh file write | `"$DISPATCH_LOG"` | `/dev/null` | `issue-triage-steps.test.mjs`: "the sweep starts each run's records empty" |
| 634 | sh file write | `"$DISPATCH_QUEUE"` | `/dev/null` | `issue-triage-steps.test.mjs`: "the sweep starts each run's records empty" |
| 637 | sh file write | `"$ELIGIBLE_ISSUES"` | `/dev/null` | `issue-triage-steps.test.mjs`: "the sweep starts each run's records empty" |
| 638 | sh while whole | `IFS= read -r n` | `true` | `issue-triage-steps.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 638 | sh while whole | `IFS= read -r n` | `false` | `issue-triage-steps.test.mjs`: "the sweep lists needs-triage, unlabelled and stale in-progress issues, not pull requests or bots'" |
| 639 | sh list condition | `[ -n "$n" ]` | `true` | Not caught, unreachable: the list comes from `sort -n` over jq's numbers, one a line, so it holds no empty line |
| 639 | sh list condition | `[ -n "$n" ]` | `false` | `issue-triage-steps.test.mjs`: "the sweep lists needs-triage, unlabelled and stale in-progress issues, not pull requests or bots'" |
| 639 | sh skip statement | `continue` | `:` | Not caught, unreachable: the list comes from `sort -n` over jq's numbers, one a line, so it holds no empty line |
| 652 | sh if whole | `permission=$(gh api --method GET "repos/$REPO/collaborators/$author/permission" …` | `true` | `issue-triage-steps.test.mjs`: "the sweep lists needs-triage, unlabelled and stale in-progress issues, not pull requests or bots'" |
| 652 | sh if whole | `permission=$(gh api --method GET "repos/$REPO/collaborators/$author/permission" …` | `false` | `issue-triage-steps.test.mjs`: "the sweep lists needs-triage, unlabelled and stale in-progress issues, not pull requests or bots'" |
| 654 | sh elif whole | `grep -q 'HTTP 404' "$RUNNER_TEMP/permission-error"` | `true` | `workflow-fail-closed.test.mjs`: "issue-triage.yml: the sweep fails when an author's permission cannot be read, other than a 404" |
| 654 | sh elif whole | `grep -q 'HTTP 404' "$RUNNER_TEMP/permission-error"` | `false` | `workflow-fail-closed.test.mjs`: "issue-triage.yml: the sweep fails when an author's permission cannot be read, other than a 404" |
| 658 | sh failure statement | `exit 1` | `:` | `workflow-fail-closed.test.mjs`: "issue-triage.yml: the sweep fails when an author's permission cannot be read, other than a 404" |
| 661 | sh case arm | `admin\|write` | `__mutant_never__` | `issue-triage-steps.test.mjs`: "the sweep lists needs-triage, unlabelled and stale in-progress issues, not pull requests or bots'" |
| 662 | sh case arm | `*` | `__mutant_never__` | `workflow-fail-closed.test.mjs`: "issue-triage.yml: the sweep fails when an author's permission cannot be read, other than a 404" |
| 662 | sh skip statement | `continue` | `:` | `workflow-fail-closed.test.mjs`: "issue-triage.yml: the sweep fails when an author's permission cannot be read, other than a 404" |
| 664 | sh if && operand | `grep -qxF -- in-progress <<<"$labels"` | `true` | `issue-triage-steps.test.mjs`: "the sweep lists needs-triage, unlabelled and stale in-progress issues, not pull requests or bots'" |
| 664 | sh if whole | `grep -qxF -- in-progress <<<"$labels" && ! grep -qxF -- needs-triage <<<"$labels…` | `true` | `issue-triage-steps.test.mjs`: "the sweep lists needs-triage, unlabelled and stale in-progress issues, not pull requests or bots'" |
| 664 | sh if whole | `grep -qxF -- in-progress <<<"$labels" && ! grep -qxF -- needs-triage <<<"$labels…` | `false` | `issue-triage-steps.test.mjs`: "a stale in-progress issue already warned by the bot is not dispatched again" |
| 664 | sh if && operand | `! grep -qxF -- needs-triage <<<"$labels"` | `true` | `issue-triage-steps.test.mjs`: "a stale in-progress issue already warned by the bot is not dispatched again" |
| 666 | jq select and operand | `.user.login == "github-actions[bot]"` | `true` | `issue-triage-steps.test.mjs`: "a stale in-progress issue already warned by the bot is not dispatched again" |
| 666 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| split("\n") \| index("## Triage…` | `true` | `issue-triage-steps.test.mjs`: "a stale in-progress issue already warned by the bot is not dispatched again" |
| 666 | jq select whole | `.user.login == "github-actions[bot]" and (.body \| split("\n") \| index("## Triage…` | `false` | `issue-triage-steps.test.mjs`: "a stale in-progress issue already warned by the bot is not dispatched again" |
| 666 | jq select and operand | `(.body \| split("\n") \| index("## Triage: stale claim")) != null` | `true` | `issue-triage-steps.test.mjs`: "a stale in-progress issue already warned by the bot is not dispatched again" |
| 667 | sh list condition | `[ "$warned" -eq 0 ]` | `true` | `issue-triage-steps.test.mjs`: "a stale in-progress issue already warned by the bot is not dispatched again" |
| 667 | sh list condition | `[ "$warned" -eq 0 ]` | `false` | `issue-triage-steps.test.mjs`: "the sweep lists needs-triage, unlabelled and stale in-progress issues, not pull requests or bots'" |
| 667 | sh skip statement | `continue` | `:` | `issue-triage-steps.test.mjs`: "a stale in-progress issue already warned by the bot is not dispatched again" |
| 669 | sh file write | `"$ELIGIBLE_ISSUES"` | `/dev/null` | `issue-triage-steps.test.mjs`: "the sweep lists needs-triage, unlabelled and stale in-progress issues, not pull requests or bots'" |
| 687 | if: whole | `steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "the gate runs for one issue, and the steps after it unless it skipped" |
| 687 | if: whole | `steps.gate.outputs.skip != 'true'` | `false` | `issue-triage-conditions.test.mjs`: "the gate runs for one issue, and the steps after it unless it skipped" |
| 693 | sh file write | `"$RUNNER_TEMP/claude-settings.json"` | `/dev/null` | `issue-triage-steps.test.mjs`: "the server's configuration carries the vouched hash only when the gate set one, and the token in a private file" |
| 703 | sh file write | `"$RUNNER_TEMP/gh-token"` | `/dev/null` | `issue-triage-steps.test.mjs`: "the server's configuration carries the vouched hash only when the gate set one, and the token in a private file" |
| 706 | sh if whole | `[ -n "${PUBLIC_CONTENT_CHECK:-}" ]` | `true` | `public-content-install.test.mjs`: "issue-triage.yml: without a check the server's configuration is as before" |
| 706 | sh if whole | `[ -n "${PUBLIC_CONTENT_CHECK:-}" ]` | `false` | `public-content-install.test.mjs`: "issue-triage.yml: the server gets the check and a private file of the names, never the names inline" |
| 707 | sh file write | `"$RUNNER_TEMP/private-repo-names"` | `/dev/null` | `public-content-install.test.mjs`: "issue-triage.yml: the server gets the check and a private file of the names, never the names inline" |
| 711 | jq if whole | `$check == ""` | `true` | `public-content-install.test.mjs`: "issue-triage.yml: the server gets the check and a private file of the names, never the names inline" |
| 711 | jq if whole | `$check == ""` | `false` | `public-content-install.test.mjs`: "issue-triage.yml: without a check the server's configuration is as before" |
| 711 | jq if whole | `$vouched == ""` | `true` | `issue-triage-steps.test.mjs`: "the server's configuration carries the vouched hash only when the gate set one, and the token in a private file" |
| 711 | jq if whole | `$vouched == ""` | `false` | `issue-triage-steps.test.mjs`: "the server's configuration carries the vouched hash only when the gate set one, and the token in a private file" |
| 712 | sh output statement | (before `echo "MCP_CONFIG=$mcp" >> "$GITHUB_ENV"`) | `: ` | `issue-triage-steps.test.mjs`: "the server's configuration carries the vouched hash only when the gate set one, and the token in a private file" |
| 719 | if: && operand | `env.KIT_TRIAGE_RUNNER != 'opencode'` | `true` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 719 | if: whole | `env.KIT_TRIAGE_RUNNER != 'opencode' && steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 719 | if: whole | `env.KIT_TRIAGE_RUNNER != 'opencode' && steps.gate.outputs.skip != 'true'` | `false` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 719 | if: && operand | `steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 726 | sh list \|\| operand | `sudo apt-get update -qq` | `false` | Left untested: runner provisioning (apt-get on the GitHub runner); every Claude Code triage run exercises it |
| 726 | sh list whole | `sudo apt-get update -qq \|\| sudo apt-get update -qq` | `true` | Left untested: runner provisioning (apt-get on the GitHub runner); every Claude Code triage run exercises it |
| 726 | sh list whole | `sudo apt-get update -qq \|\| sudo apt-get update -qq` | `false` | Left untested: runner provisioning (apt-get on the GitHub runner); every Claude Code triage run exercises it |
| 726 | sh list \|\| operand | `sudo apt-get update -qq` | `false` | Left untested: runner provisioning (apt-get on the GitHub runner); every Claude Code triage run exercises it |
| 729 | sh if whole | `[ -f /proc/sys/kernel/apparmor_restrict_unprivileged_userns ]` | `true` | Left untested: runner provisioning (the runner's AppArmor setting); every Claude Code triage run exercises it |
| 729 | sh if whole | `[ -f /proc/sys/kernel/apparmor_restrict_unprivileged_userns ]` | `false` | Left untested: runner provisioning (the runner's AppArmor setting); every Claude Code triage run exercises it |
| 740 | if: whole | `steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "the gate runs for one issue, and the steps after it unless it skipped" |
| 740 | if: whole | `steps.gate.outputs.skip != 'true'` | `false` | `issue-triage-conditions.test.mjs`: "the gate runs for one issue, and the steps after it unless it skipped" |
| 745 | sh output statement | (before `echo "STARTED=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$GITHUB_EN`) | `: ` | `issue-triage-steps.test.mjs`: "a dispatched run records a re-triage and a stale claim; other runs record neither" |
| 747 | sh if && operand | `[ -n "$TRIAGE_ISSUE" ]` | `true` | `issue-triage-steps.test.mjs`: "a dispatched run records a re-triage and a stale claim; other runs record neither" |
| 747 | sh if whole | `[ -n "$TRIAGE_ISSUE" ] && [ "${{ github.event_name }}" = "workflow_dispatch" ]` | `true` | `issue-triage-steps.test.mjs`: "a dispatched run records a re-triage and a stale claim; other runs record neither" |
| 747 | sh if whole | `[ -n "$TRIAGE_ISSUE" ] && [ "${{ github.event_name }}" = "workflow_dispatch" ]` | `false` | `issue-triage-steps.test.mjs`: "a dispatched run records a re-triage and a stale claim; other runs record neither" |
| 747 | sh if && operand | `[ "${{ github.event_name }}" = "workflow_dispatch" ]` | `true` | `issue-triage-steps.test.mjs`: "a dispatched run records a re-triage and a stale claim; other runs record neither" |
| 750 | sh list condition | `[ "$has_nt" = "true" ]` | `false` | `issue-triage-steps.test.mjs`: "a dispatched run records a re-triage and a stale claim; other runs record neither" |
| 750 | sh list condition | `[ "$has_nt" = "true" ]` | `true` | `issue-triage-steps.test.mjs`: "a dispatched run records a re-triage and a stale claim; other runs record neither" |
| 751 | sh if && operand | `[ "$has_ip" = "true" ]` | `true` | `issue-triage-steps.test.mjs`: "a dispatched run records a re-triage and a stale claim; other runs record neither" |
| 751 | sh if whole | `[ "$has_ip" = "true" ] && [ "$(date -u -d "$updated" +%s)" -le "$(( $(date -u +%…` | `true` | `issue-triage-steps.test.mjs`: "a dispatched run records a re-triage and a stale claim; other runs record neither" |
| 751 | sh if whole | `[ "$has_ip" = "true" ] && [ "$(date -u -d "$updated" +%s)" -le "$(( $(date -u +%…` | `false` | `issue-triage-steps.test.mjs`: "a dispatched run records a re-triage and a stale claim; other runs record neither" |
| 751 | sh if && operand | `[ "$(date -u -d "$updated" +%s)" -le "$(( $(date -u +%s) - 7 * 86400 ))" ]` | `true` | `issue-triage-steps.test.mjs`: "a dispatched run records a re-triage and a stale claim; other runs record neither" |
| 755 | sh output statement | (before `echo "RETRIAGE=$retriage" >> "$GITHUB_ENV"`) | `: ` | `issue-triage-steps.test.mjs`: "a dispatched run records a re-triage and a stale claim; other runs record neither" |
| 756 | sh output statement | (before `echo "STALE=$stale" >> "$GITHUB_ENV"`) | `: ` | `issue-triage-steps.test.mjs`: "a dispatched run records a re-triage and a stale claim; other runs record neither" |
| 765 | if: && operand | `env.KIT_TRIAGE_RUNNER != 'opencode'` | `true` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 765 | if: whole | `env.KIT_TRIAGE_RUNNER != 'opencode' && steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 765 | if: whole | `env.KIT_TRIAGE_RUNNER != 'opencode' && steps.gate.outputs.skip != 'true'` | `false` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 765 | if: && operand | `steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 780 | sh output statement | (before `sudo install -o root -g root -m 0755 "$RUNNER_TEMP/claude" /`) | `: ` | Left untested: runner provisioning (sudo install into /opt/agent-kit on the GitHub runner); every triage run on that runner exercises it |
| 781 | sh output statement | (before `rm -f -- "$RUNNER_TEMP/claude"`) | `: ` | Not a rule: removes the downloaded binary from RUNNER_TEMP after installing it |
| 791 | if: && operand | `env.KIT_TRIAGE_RUNNER == 'opencode'` | `true` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 791 | if: whole | `env.KIT_TRIAGE_RUNNER == 'opencode' && steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 791 | if: whole | `env.KIT_TRIAGE_RUNNER == 'opencode' && steps.gate.outputs.skip != 'true'` | `false` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 791 | if: && operand | `steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 793 | sh output statement | (before `rm -rf -- .opencode opencode.json opencode.jsonc`) | `: ` | `triage-opencode.test.mjs`: "issue-triage.yml: the checkout's OpenCode configuration goes before OpenCode first runs" |
| 804 | if: && operand | `env.KIT_TRIAGE_RUNNER == 'opencode'` | `true` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 804 | if: whole | `env.KIT_TRIAGE_RUNNER == 'opencode' && steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 804 | if: whole | `env.KIT_TRIAGE_RUNNER == 'opencode' && steps.gate.outputs.skip != 'true'` | `false` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 804 | if: && operand | `steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 815 | sh output statement | (before `sudo install -o root -g root -m 0755 "$RUNNER_TEMP/opencode-`) | `: ` | Left untested: runner provisioning (sudo install into /opt/agent-kit on the GitHub runner); every triage run on that runner exercises it |
| 816 | sh output statement | (before `rm -rf -- "$RUNNER_TEMP/opencode.tar.gz" "$RUNNER_TEMP/openc`) | `: ` | Not a rule: removes the downloaded archive from RUNNER_TEMP after installing it |
| 837 | if: && operand | `env.KIT_TRIAGE_RUNNER == 'claude-code'` | `true` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 837 | if: whole | `env.KIT_TRIAGE_RUNNER == 'claude-code' && steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 837 | if: whole | `env.KIT_TRIAGE_RUNNER == 'claude-code' && steps.gate.outputs.skip != 'true'` | `false` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 837 | if: && operand | `steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 848 | sh if whole | `[ "$KIT_TRIAGE_PROVIDER" = opencode-go ]` | `true` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: the effort level reaches the CLI, and none when unset" |
| 848 | sh if whole | `[ "$KIT_TRIAGE_PROVIDER" = opencode-go ]` | `false` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: OpenCode Go gets its key as a bearer token, and nothing else" |
| 849 | sh if whole | `[ -z "$OPENCODE_API_KEY" ]` | `true` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: OpenCode Go gets its key as a bearer token, and nothing else" |
| 849 | sh if whole | `[ -z "$OPENCODE_API_KEY" ]` | `false` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: OpenCode Go without its key fails before the CLI starts" |
| 851 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: OpenCode Go without its key fails before the CLI starts" |
| 861 | sh elif whole | `[ -z "$ANTHROPIC_API_KEY" ]` | `true` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: the effort level reaches the CLI, and none when unset" |
| 861 | sh elif whole | `[ -z "$ANTHROPIC_API_KEY" ]` | `false` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: the Anthropic provider without its key fails before the CLI starts" |
| 863 | sh list condition | `[ -z "$OPENCODE_API_KEY" ]` | `true` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: the Anthropic provider without its key fails before the CLI starts" |
| 863 | sh list condition | `[ -z "$OPENCODE_API_KEY" ]` | `false` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: the Anthropic provider without its key fails before the CLI starts" |
| 865 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: the Anthropic provider without its key fails before the CLI starts" |
| 870 | sh list condition | `[ -z "$KIT_TRIAGE_EFFORT" ]` | `true` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: the effort level reaches the CLI, and none when unset" |
| 870 | sh list condition | `[ -z "$KIT_TRIAGE_EFFORT" ]` | `false` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: the effort level reaches the CLI, and none when unset" |
| 871 | sh list condition | `/opt/agent-kit/claude -p "$PROMPT" \ --output-format json \ --model "$KIT_TRIAGE…` | `true` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: the effort level reaches the CLI, and none when unset" |
| 871 | sh list condition | `/opt/agent-kit/claude -p "$PROMPT" \ --output-format json \ --model "$KIT_TRIAGE…` | `false` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: the effort level reaches the CLI, and none when unset" |
| 884 | sh file write | `"$RESULT"` | `/dev/null` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: the effort level reaches the CLI, and none when unset" |
| 885 | sh if whole | `[ ! -s "$RESULT" ]` | `true` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: the effort level reaches the CLI, and none when unset" |
| 885 | sh if whole | `[ ! -s "$RESULT" ]` | `false` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: a run that ends in error, or with no result, fails" |
| 887 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: a run that ends in error, or with no result, fails" |
| 890 | jq if whole | `type == "array"` | `true` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: the effort level reaches the CLI, and none when unset" |
| 890 | jq if whole | `type == "array"` | `false` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: a stream's last result decides the run" |
| 890 | jq select whole | `.type == "result"` | `true` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: a stream's last result decides the run" |
| 890 | jq select whole | `.type == "result"` | `false` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: a stream's last result decides the run" |
| 897 | sh list condition | `[ "$closed" != true ]` | `true` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: a run closed on a private name withholds its last message and fails" |
| 897 | sh list condition | `[ "$closed" != true ]` | `false` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: a run closed on a private name withholds its last message and fails" |
| 902 | sh list condition | `[ "$KIT_TRIAGE_PROVIDER" != opencode-go ]` | `true` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: OpenCode Go gets its key as a bearer token, and nothing else" |
| 902 | sh list condition | `[ "$KIT_TRIAGE_PROVIDER" != opencode-go ]` | `false` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: the Anthropic provider passes the Anthropic key only" |
| 909 | sh if whole | `[ "$closed" = true ]` | `true` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: the effort level reaches the CLI, and none when unset" |
| 909 | sh if whole | `[ "$closed" = true ]` | `false` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: a run closed on a private name withholds its last message and fails" |
| 911 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: a run closed on a private name withholds its last message and fails" |
| 913 | sh if \|\| operand | `[ "$status" -ne 0 ]` | `false` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: a run that ends in error, or with no result, fails" |
| 913 | sh if whole | `[ "$status" -ne 0 ] \|\| [ "$(jq -r '.is_error' <<<"$result")" != "false" ] \|\| [ "…` | `true` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: the effort level reaches the CLI, and none when unset" |
| 913 | sh if whole | `[ "$status" -ne 0 ] \|\| [ "$(jq -r '.is_error' <<<"$result")" != "false" ] \|\| [ "…` | `false` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: a run that ends in error, or with no result, fails" |
| 913 | sh if \|\| operand | `[ "$(jq -r '.is_error' <<<"$result")" != "false" ]` | `false` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: a run that ends in error, or with no result, fails" |
| 913 | sh if \|\| operand | `[ "$(jq -r '.subtype' <<<"$result")" != "success" ]` | `false` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: a run that ends in error, or with no result, fails" |
| 915 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "issue-triage.yml, Run the triage: a run that ends in error, or with no result, fails" |
| 928 | if: && operand | `env.KIT_TRIAGE_RUNNER == 'opencode'` | `true` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 928 | if: whole | `env.KIT_TRIAGE_RUNNER == 'opencode' && steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 928 | if: whole | `env.KIT_TRIAGE_RUNNER == 'opencode' && steps.gate.outputs.skip != 'true'` | `false` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 928 | if: && operand | `steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 930 | sh output statement | (before `mv -- .git "$RUNNER_TEMP/checkout-git"`) | `: ` | `triage-opencode.test.mjs`: "issue-triage.yml: before OpenCode runs, .git and the symlinks leave the checkout" |
| 932 | sh output statement | (before `rm -f -- "$link"`) | `: ` | `triage-opencode.test.mjs`: "issue-triage.yml: before OpenCode runs, .git and the symlinks leave the checkout" |
| 978 | if: && operand | `env.KIT_TRIAGE_RUNNER == 'opencode'` | `true` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 978 | if: whole | `env.KIT_TRIAGE_RUNNER == 'opencode' && steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 978 | if: whole | `env.KIT_TRIAGE_RUNNER == 'opencode' && steps.gate.outputs.skip != 'true'` | `false` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 978 | if: && operand | `steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "each runner installs and runs only its own CLI, unless the gate skipped" |
| 984 | sh if whole | `[ -z "$OPENCODE_API_KEY" ]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 984 | sh if whole | `[ -z "$OPENCODE_API_KEY" ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: no key fails before the CLI starts" |
| 986 | sh failure statement | `exit 1` | `:` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: no key fails before the CLI starts" |
| 994 | jq if or operand | `. == "Read"` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 994 | jq if whole | `. == "Read" or . == "Grep" or . == "Glob"` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: everything is denied but reads and the run's server tools" |
| 994 | jq if whole | `. == "Read" or . == "Grep" or . == "Glob"` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 994 | jq if or operand | `. == "Grep"` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 994 | jq if or operand | `. == "Glob"` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 995 | jq elif whole | `startswith("mcp__agent-kit__")` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: everything is denied but reads and the run's server tools" |
| 995 | jq elif whole | `startswith("mcp__agent-kit__")` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1032 | sh list condition | `oc "$list" models opencode-go --verbose > "$RUNNER_TEMP/opencode-models" \ 2> "$…` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1032 | sh list condition | `oc "$list" models opencode-go --verbose > "$RUNNER_TEMP/opencode-models" \ 2> "$…` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1032 | sh file write | `"$RUNNER_TEMP/opencode-models"` | `/dev/null` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1034 | sh if whole | `[ "$listed" -ne 0 ]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1034 | sh if whole | `[ "$listed" -ne 0 ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the model must be listed and an effort level one of its variants" |
| 1037 | sh failure statement | `exit 1` | `:` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the model must be listed and an effort level one of its variants" |
| 1039 | awk pattern whole | `$0 == want` | `1` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1039 | awk pattern whole | `$0 == want` | `0` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1039 | awk skip statement | `next` | `;` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1039 | awk pattern && operand | `on` | `1` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1039 | awk pattern whole | `on && /^[^ {}"]+\/[^ ]+$/` | `1` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1039 | awk pattern whole | `on && /^[^ {}"]+\/[^ ]+$/` | `0` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: an effort level the model offers becomes its variant, and one it lacks names those it has" |
| 1039 | awk pattern && operand | `/^[^ {}"]+\/[^ ]+$/` | `1` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1039 | awk skip statement | `exit` | `;` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: an effort level the model offers becomes its variant, and one it lacks names those it has" |
| 1039 | awk pattern whole | `on` | `1` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1039 | awk pattern whole | `on` | `0` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1039 | awk implicit print | (before `' "$RUNNER_TEMP/opencode-models")`) | ` {}` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1040 | sh if whole | `! jq -e 'type == "object"' >/dev/null 2>&1 <<<"$info"` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1040 | sh if whole | `! jq -e 'type == "object"' >/dev/null 2>&1 <<<"$info"` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the model must be listed and an effort level one of its variants" |
| 1042 | sh failure statement | `exit 1` | `:` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the model must be listed and an effort level one of its variants" |
| 1045 | sh if whole | `[ -n "$KIT_TRIAGE_EFFORT" ]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1045 | sh if whole | `[ -n "$KIT_TRIAGE_EFFORT" ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the model must be listed and an effort level one of its variants" |
| 1046 | sh if whole | `! jq -e --arg v "$KIT_TRIAGE_EFFORT" '.variants // {} \| has($v)' >/dev/null <<<"…` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: an effort level the model offers becomes its variant, and one it lacks names those it has" |
| 1046 | sh if whole | `! jq -e --arg v "$KIT_TRIAGE_EFFORT" '.variants // {} \| has($v)' >/dev/null <<<"…` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the model must be listed and an effort level one of its variants" |
| 1047 | jq if whole | `length == 0` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: an effort level the model offers becomes its variant, and one it lacks names those it has" |
| 1047 | jq if whole | `length == 0` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the model must be listed and an effort level one of its variants" |
| 1048 | sh failure statement | `exit 1` | `:` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the model must be listed and an effort level one of its variants" |
| 1074 | sh list \|\| operand | `[ -n "${AGENT_KIT_STARTED:-}" ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1074 | sh list whole | `[ -n "${AGENT_KIT_STARTED:-}" ] \|\| [ -z "${GITHUB_ENV:-}" ]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1074 | sh list whole | `[ -n "${AGENT_KIT_STARTED:-}" ] \|\| [ -z "${GITHUB_ENV:-}" ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1074 | sh list \|\| operand | `[ -z "${GITHUB_ENV:-}" ]` | `false` | Not caught, unreachable on a runner: GitHub always sets GITHUB_ENV; the guard only lets the step run outside Actions |
| 1074 | sh output statement | (before `echo "AGENT_KIT_STARTED=$started" >> "$GITHUB_ENV"`) | `: ` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1076 | sh file write | `"$RESULT"` | `/dev/null` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the events file starts empty, so an earlier run's events are not read" |
| 1082 | sh while whole | `:` | `true` | Not caught, equivalent: `while true` and `while :` are the same loop |
| 1082 | sh while whole | `:` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1084 | sh list condition | `oc "$run_config" run --print-logs --format json -m "opencode-go/$KIT_TRIAGE_MODE…` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1084 | sh list condition | `oc "$run_config" run --print-logs --format json -m "opencode-go/$KIT_TRIAGE_MODE…` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1085 | sh file write | `"$RUNNER_TEMP/opencode-attempt.jsonl"` | `/dev/null` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1087 | sh file write | `"$RUNNER_TEMP/opencode-attempt-events.jsonl"` | `/dev/null` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1088 | sh file write | `"$RESULT"` | `/dev/null` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1091 | jq select whole | `.type == "error"` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the refusal read is the attempt's last error, not its last event" |
| 1091 | jq select whole | `.type == "error"` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the refusal read is the attempt's last error, not its last event" |
| 1092 | jq select whole | `test("ttft_admission_refused\|at capacity")` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: other errors, no session or no steps left end the run" |
| 1092 | jq select whole | `test("ttft_admission_refused\|at capacity")` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the refusal read is the attempt's last error, not its last event" |
| 1093 | jq if whole | `. > 3600` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the refusal read is the attempt's last error, not its last event" |
| 1093 | jq if whole | `. > 3600` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run stops on a refusal when the wait would not fit in the job's time limit" |
| 1096 | jq select whole | `.type == "step_start"` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1096 | jq select whole | `.type == "step_start"` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1097 | sh if \|\| operand | `[ -z "$pause" ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the refusal read is the attempt's last error, not its last event" |
| 1097 | sh if whole | `[ -z "$pause" ] \|\| [ -z "$session" ] \|\| [ "$left" -le 0 ]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the refusal read is the attempt's last error, not its last event" |
| 1097 | sh if whole | `[ -z "$pause" ] \|\| [ -z "$session" ] \|\| [ "$left" -le 0 ]` | `false` | `triage-opencode.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 1097 | sh if \|\| operand | `[ -z "$session" ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: other errors, no session or no steps left end the run" |
| 1097 | sh if \|\| operand | `[ "$left" -le 0 ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: other errors, no session or no steps left end the run" |
| 1098 | sh skip statement | `break` | `:` | `triage-opencode.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 1101 | sh if whole | `[ "$(jq -s 'map(select(.type == "step_finish")) \| length' "$RUNNER_TEMP/opencode…` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the waits are 60, 120 and 180 s for refusals in a row, or the named seconds when longer" |
| 1101 | sh if whole | `[ "$(jq -s 'map(select(.type == "step_finish")) \| length' "$RUNNER_TEMP/opencode…` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a step served between refusals starts the row again" |
| 1101 | jq select whole | `.type == "step_finish"` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the waits are 60, 120 and 180 s for refusals in a row, or the named seconds when longer" |
| 1101 | jq select whole | `.type == "step_finish"` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a step served between refusals starts the row again" |
| 1106 | sh list condition | `[ "$pause" -le "$delay" ]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the waits are 60, 120 and 180 s for refusals in a row, or the named seconds when longer" |
| 1106 | sh list condition | `[ "$pause" -le "$delay" ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the refusal read is the attempt's last error, not its last event" |
| 1108 | sh if whole | `[ "$delay" -gt "$remaining" ]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the refusal read is the attempt's last error, not its last event" |
| 1108 | sh if whole | `[ "$delay" -gt "$remaining" ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run stops on a refusal when the wait would not fit in the job's time limit" |
| 1110 | sh skip statement | `break` | `:` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run stops on a refusal when the wait would not fit in the job's time limit" |
| 1125 | sh if whole | `[ -z "$events" ]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1125 | sh if whole | `[ -z "$events" ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a failed, unfinished or exhausted run fails the step" |
| 1126 | sh if whole | `[ "$closed" = true ]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a run with no events shows OpenCode's log, with commands stopped" |
| 1126 | sh if whole | `[ "$closed" = true ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a run the server closed on a private name withholds its text, errors and log, and fails" |
| 1131 | awk implicit print | `1` | `0` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a run with no events shows OpenCode's log, with commands stopped" |
| 1135 | sh failure statement | `exit 1` | `:` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a failed, unfinished or exhausted run fails the step" |
| 1138 | jq select whole | `.type == "step_start"` | `true` | Not a rule: the step count goes only to the run log; the turn limit counts the steps its own way, and the last step's reason, read apart, decides the step |
| 1138 | jq select whole | `.type == "step_start"` | `false` | Not a rule: the step count goes only to the run log; the turn limit counts the steps its own way, and the last step's reason, read apart, decides the step |
| 1139 | jq select whole | `.type == "step_finish"` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the last step is the last step_finish, whatever event follows it" |
| 1139 | jq select whole | `.type == "step_finish"` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1140 | jq select whole | `.type == "step_finish"` | `true` | Not a rule: the step_finish parts' cost and tokens go only to the run log; the last step's reason, read apart, decides the step |
| 1140 | jq select whole | `.type == "step_finish"` | `false` | Not a rule: the step_finish parts' cost and tokens go only to the run log; the last step's reason, read apart, decides the step |
| 1141 | jq select whole | `.type == "step_finish"` | `true` | Not a rule: the step_finish parts' cost and tokens go only to the run log; the last step's reason, read apart, decides the step |
| 1141 | jq select whole | `.type == "step_finish"` | `false` | Not a rule: the step_finish parts' cost and tokens go only to the run log; the last step's reason, read apart, decides the step |
| 1142 | jq select whole | `.type == "step_finish"` | `true` | Not a rule: the step_finish parts' cost and tokens go only to the run log; the last step's reason, read apart, decides the step |
| 1142 | jq select whole | `.type == "step_finish"` | `false` | Not a rule: the step_finish parts' cost and tokens go only to the run log; the last step's reason, read apart, decides the step |
| 1143 | jq select whole | `.type == "step_finish"` | `true` | Not a rule: the step_finish parts' cost and tokens go only to the run log; the last step's reason, read apart, decides the step |
| 1143 | jq select whole | `.type == "step_finish"` | `false` | Not a rule: the step_finish parts' cost and tokens go only to the run log; the last step's reason, read apart, decides the step |
| 1144 | jq select whole | `.type == "step_finish"` | `true` | Not a rule: the step_finish parts' cost and tokens go only to the run log; the last step's reason, read apart, decides the step |
| 1144 | jq select whole | `.type == "step_finish"` | `false` | Not a rule: the step_finish parts' cost and tokens go only to the run log; the last step's reason, read apart, decides the step |
| 1145 | jq select whole | `.type == "step_finish"` | `true` | Not a rule: the step_finish parts' cost and tokens go only to the run log; the last step's reason, read apart, decides the step |
| 1145 | jq select whole | `.type == "step_finish"` | `false` | Not a rule: the step_finish parts' cost and tokens go only to the run log; the last step's reason, read apart, decides the step |
| 1146 | jq select whole | `.type == "error"` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1146 | jq select whole | `.type == "error"` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a failed, unfinished or exhausted run fails the step" |
| 1147 | jq select whole | `.type == "text"` | `true` | Not a rule: the last text goes only to the run log; the errors and the last step's reason, read apart, decide the step |
| 1147 | jq select whole | `.type == "text"` | `false` | Not a rule: the last text goes only to the run log; the errors and the last step's reason, read apart, decide the step |
| 1149 | sh list condition | `[ "$closed" != true ]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a run the server closed on a private name withholds its text, errors and log, and fails" |
| 1149 | sh list condition | `[ "$closed" != true ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1149 | jq if whole | `.errors == ""` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a run the server closed on a private name withholds its text, errors and log, and fails" |
| 1149 | jq if whole | `.errors == ""` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a run the server closed on a private name withholds its text, errors and log, and fails" |
| 1156 | sh if whole | `[ "$closed" = true ]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1156 | sh if whole | `[ "$closed" = true ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a run the server closed on a private name withholds its text, errors and log, and fails" |
| 1158 | sh failure statement | `exit 1` | `:` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a run the server closed on a private name withholds its text, errors and log, and fails" |
| 1160 | sh if \|\| operand | `[ "$status" -ne 0 ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a failed, unfinished or exhausted run fails the step" |
| 1160 | sh if whole | `[ "$status" -ne 0 ] \|\| [ -n "$(jq -r '.errors' <<<"$summary")" ] \|\| [ "$(jq -r '…` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1160 | sh if whole | `[ "$status" -ne 0 ] \|\| [ -n "$(jq -r '.errors' <<<"$summary")" ] \|\| [ "$(jq -r '…` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a failed, unfinished or exhausted run fails the step" |
| 1160 | sh if \|\| operand | `[ -n "$(jq -r '.errors' <<<"$summary")" ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a failed, unfinished or exhausted run fails the step" |
| 1160 | sh if \|\| operand | `[ "$(jq -r '.reason' <<<"$summary")" != "stop" ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a failed, unfinished or exhausted run fails the step" |
| 1168 | awk implicit print | `1` | `0` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a run that ends in error shows what the CLI printed, with commands stopped" |
| 1171 | sh failure statement | `exit 1` | `:` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a failed, unfinished or exhausted run fails the step" |
| 1173 | sh if whole | `[ "$(jq -r '.steps' <<<"$summary")" -ge "$KIT_TRIAGE_MAX_TURNS" ]` | `true` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration" |
| 1173 | sh if whole | `[ "$(jq -r '.steps' <<<"$summary")" -ge "$KIT_TRIAGE_MAX_TURNS" ]` | `false` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a failed, unfinished or exhausted run fails the step" |
| 1175 | sh failure statement | `exit 1` | `:` | `triage-opencode.test.mjs`: "issue-triage.yml, Run the triage on OpenCode: a failed, unfinished or exhausted run fails the step" |
| 1180 | if: && operand | `always()` | `true` | `issue-triage-conditions.test.mjs`: "the clean-up steps run even after a failure, unless the gate skipped" |
| 1180 | if: whole | `always() && env.KIT_TRIAGE_RUNNER == 'opencode' && steps.gate.outputs.skip != 't…` | `true` | `issue-triage-conditions.test.mjs`: "the clean-up steps run even after a failure, unless the gate skipped" |
| 1180 | if: whole | `always() && env.KIT_TRIAGE_RUNNER == 'opencode' && steps.gate.outputs.skip != 't…` | `false` | `issue-triage-conditions.test.mjs`: "the clean-up steps run even after a failure, unless the gate skipped" |
| 1180 | if: && operand | `env.KIT_TRIAGE_RUNNER == 'opencode'` | `true` | `issue-triage-conditions.test.mjs`: "the clean-up steps run even after a failure, unless the gate skipped" |
| 1180 | if: && operand | `steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "the clean-up steps run even after a failure, unless the gate skipped" |
| 1182 | sh if && operand | `[ -d "$RUNNER_TEMP/checkout-git" ]` | `true` | `issue-triage-steps.test.mjs`: ".git comes back only when it was moved out and nothing took its place" |
| 1182 | sh if whole | `[ -d "$RUNNER_TEMP/checkout-git" ] && [ ! -e .git ]` | `true` | `issue-triage-steps.test.mjs`: ".git comes back only when it was moved out and nothing took its place" |
| 1182 | sh if whole | `[ -d "$RUNNER_TEMP/checkout-git" ] && [ ! -e .git ]` | `false` | `issue-triage-steps.test.mjs`: ".git comes back only when it was moved out and nothing took its place" |
| 1182 | sh if && operand | `[ ! -e .git ]` | `true` | `issue-triage-steps.test.mjs`: ".git comes back only when it was moved out and nothing took its place" |
| 1183 | sh output statement | (before `mv -- "$RUNNER_TEMP/checkout-git" .git`) | `: ` | `issue-triage-steps.test.mjs`: ".git comes back only when it was moved out and nothing took its place" |
| 1186 | if: && operand | `always()` | `true` | `issue-triage-conditions.test.mjs`: "the clean-up steps run even after a failure, unless the gate skipped" |
| 1186 | if: whole | `always() && steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "the clean-up steps run even after a failure, unless the gate skipped" |
| 1186 | if: whole | `always() && steps.gate.outputs.skip != 'true'` | `false` | `issue-triage-conditions.test.mjs`: "the clean-up steps run even after a failure, unless the gate skipped" |
| 1186 | if: && operand | `steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "the clean-up steps run even after a failure, unless the gate skipped" |
| 1187 | sh output statement | (before `rm -f -- "$RUNNER_TEMP/gh-token" "$RUNNER_TEMP/private-repo-`) | `: ` | `issue-triage-steps.test.mjs`: "the token and the private names are removed" |
| 1199 | if: && operand | `env.TRIAGE_ISSUE != ''` | `true` | `issue-triage-conditions.test.mjs`: "the state check runs for one issue, and the sweep's steps for a sweep" |
| 1199 | if: whole | `env.TRIAGE_ISSUE != '' && steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "the state check runs for one issue, and the sweep's steps for a sweep" |
| 1199 | if: whole | `env.TRIAGE_ISSUE != '' && steps.gate.outputs.skip != 'true'` | `false` | `issue-triage-conditions.test.mjs`: "the state check runs for one issue, and the sweep's steps for a sweep" |
| 1199 | if: && operand | `steps.gate.outputs.skip != 'true'` | `true` | `issue-triage-conditions.test.mjs`: "the state check runs for one issue, and the sweep's steps for a sweep" |
| 1210 | jq if and operand | `.author.is_bot` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: the run fails without a comment of its own" |
| 1210 | jq if whole | `.author.is_bot and .author.login != "app/github-actions"` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: the run fails without a comment of its own" |
| 1210 | jq if whole | `.author.is_bot and .author.login != "app/github-actions"` | `false` | `issue-triage-backstop.test.mjs`: "a vouched github-actions[bot] issue gets the full check; another bot's is exempt" |
| 1210 | jq if and operand | `.author.login != "app/github-actions"` | `true` | `issue-triage-backstop.test.mjs`: "a vouched github-actions[bot] issue gets the full check; another bot's is exempt" |
| 1215 | sh if \|\| operand | `[ "$state" = "CLOSED" ]` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: a closed issue, or an issue event on a claimed one, is left as it is" |
| 1215 | sh if whole | `[ "$state" = "CLOSED" ] \|\| [ "$bot" = "true" ]` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: the run fails without a comment of its own" |
| 1215 | sh if whole | `[ "$state" = "CLOSED" ] \|\| [ "$bot" = "true" ]` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: a closed issue, or an issue event on a claimed one, is left as it is" |
| 1215 | sh if \|\| operand | `[ "$bot" = "true" ]` | `false` | `issue-triage-backstop.test.mjs`: "a vouched github-actions[bot] issue gets the full check; another bot's is exempt" |
| 1216 | sh skip statement | `exit 0` | `:` | `issue-triage-state.test.mjs`: "issue-triage.yml: a closed issue, or an issue event on a claimed one, is left as it is" |
| 1231 | sh case arm | `edited\|reopened\|labeled` | `__mutant_never__` | `issue-triage-state.test.mjs`: "issue-triage.yml: a fresh triage drops the approval, and a reopen the claim" |
| 1232 | sh case arm | `*` | `__mutant_never__` | `issue-triage-state.test.mjs`: "issue-triage.yml: a closed issue, or an issue event on a claimed one, is left as it is" |
| 1233 | sh if whole | `[ "$RETRIAGE" = "true" ]` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: a closed issue, or an issue event on a claimed one, is left as it is" |
| 1233 | sh if whole | `[ "$RETRIAGE" = "true" ]` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: a fresh triage drops the approval, and a reopen the claim" |
| 1235 | sh elif && operand | `has in-progress` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: the run fails without a comment of its own" |
| 1235 | sh elif whole | `has in-progress && [ "$EVENT" != "workflow_dispatch" ]` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: the run fails without a comment of its own" |
| 1235 | sh elif whole | `has in-progress && [ "$EVENT" != "workflow_dispatch" ]` | `false` | Not caught, equivalent: STALE is true only on a dispatch (the start record sets it there alone), so an issue event on an in-progress issue ends at the next branch's `exit 0` instead |
| 1235 | sh elif && operand | `[ "$EVENT" != "workflow_dispatch" ]` | `true` | `issue-triage-backstop.test.mjs`: "a closing pull request by an author with write access passes the stale check" |
| 1236 | sh skip statement | `exit 0` | `:` | `issue-triage-state.test.mjs`: "issue-triage.yml: a closed issue, or an issue event on a claimed one, is left as it is" |
| 1237 | sh elif && operand | `[ "$EVENT" = "workflow_dispatch" ]` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: only a dispatch skips the check on an approved or planned requested issue" |
| 1237 | sh elif whole | `[ "$EVENT" = "workflow_dispatch" ] && ! has in-progress \ && { has agent:approve…` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: the run fails without a comment of its own" |
| 1237 | sh elif whole | `[ "$EVENT" = "workflow_dispatch" ] && ! has in-progress \ && { has agent:approve…` | `false` | `issue-triage-backstop.test.mjs`: "a dispatch leaves an approved or a planned requested issue as it is" |
| 1237 | sh elif && operand | `! has in-progress` | `true` | `issue-triage-backstop.test.mjs`: "a closing pull request by an author with write access passes the stale check" |
| 1238 | sh elif && operand | `{ has agent:approved \|\| { has requested && has triaged; }; }` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: only a dispatch skips the check on an approved or planned requested issue" |
| 1238 | sh elif \|\| operand | `has agent:approved` | `false` | `issue-triage-backstop.test.mjs`: "a dispatch leaves an approved or a planned requested issue as it is" |
| 1238 | sh elif \|\| operand | `{ has requested && has triaged; }` | `false` | `issue-triage-backstop.test.mjs`: "a dispatch leaves an approved or a planned requested issue as it is" |
| 1238 | sh elif && operand | `has requested` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: only a dispatch skips the check on an approved or planned requested issue" |
| 1238 | sh elif && operand | `has triaged` | `true` | `issue-triage-backstop.test.mjs`: "a dispatch leaves an approved or a planned requested issue as it is" |
| 1244 | sh skip statement | `exit 0` | `:` | `issue-triage-backstop.test.mjs`: "a dispatch leaves an approved or a planned requested issue as it is" |
| 1245 | sh elif && operand | `has in-progress` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: the run fails without a comment of its own" |
| 1245 | sh elif whole | `has in-progress && [ "$STALE" != "true" ]` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: the run fails without a comment of its own" |
| 1245 | sh elif whole | `has in-progress && [ "$STALE" != "true" ]` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: only a dispatch skips the check on an approved or planned requested issue" |
| 1245 | sh elif && operand | `[ "$STALE" != "true" ]` | `true` | `issue-triage-backstop.test.mjs`: "a closing pull request by an author with write access passes the stale check" |
| 1247 | sh skip statement | `exit 0` | `:` | `issue-triage-state.test.mjs`: "issue-triage.yml: only a dispatch skips the check on an approved or planned requested issue" |
| 1248 | sh elif whole | `has in-progress` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: a triaged or questioned issue in its right state passes" |
| 1248 | sh elif whole | `has in-progress` | `false` | `issue-triage-backstop.test.mjs`: "a closing pull request by an author with write access passes the stale check" |
| 1261 | jq select whole | `.body != null` | `true` | `issue-triage-backstop.test.mjs`: "a mention, another issue's number or no body does not count" |
| 1261 | jq select whole | `.body != null` | `false` | `issue-triage-backstop.test.mjs`: "a closing pull request by an author with write access passes the stale check" |
| 1261 | jq select whole | `.body \| test(\"\\\\b(close\|closes\|closed\|fix\|fixes\|fixed\|resolve\|resolves\|resolv…` | `true` | `issue-triage-backstop.test.mjs`: "a mention, another issue's number or no body does not count" |
| 1261 | jq select whole | `.body \| test(\"\\\\b(close\|closes\|closed\|fix\|fixes\|fixed\|resolve\|resolves\|resolv…` | `false` | `issue-triage-backstop.test.mjs`: "a closing pull request by an author with write access passes the stale check" |
| 1269 | sh while whole | `read -r account login` | `true` | `issue-triage-backstop.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 1269 | sh while whole | `read -r account login` | `false` | `issue-triage-backstop.test.mjs`: "a closing pull request by an author with write access passes the stale check" |
| 1270 | sh list condition | `[ -n "$account" ]` | `true` | Not a rule: with no closing pull request the list is one empty line, which would only print a 'malformed author' line; nothing counts either way |
| 1270 | sh list condition | `[ -n "$account" ]` | `false` | `issue-triage-backstop.test.mjs`: "a closing pull request by an author with write access passes the stale check" |
| 1270 | sh skip statement | `continue` | `:` | Not a rule: with no closing pull request the list is one empty line, which would only print a 'malformed author' line; nothing counts either way |
| 1271 | sh if && operand | `[ "$account" = Bot ]` | `true` | `issue-triage-backstop.test.mjs`: "a closing pull request by an author with write access passes the stale check" |
| 1271 | sh if whole | `[ "$account" = Bot ] && [ -n "$login" ]` | `true` | `issue-triage-backstop.test.mjs`: "a closing pull request by an author with write access passes the stale check" |
| 1271 | sh if whole | `[ "$account" = Bot ] && [ -n "$login" ]` | `false` | `issue-triage-backstop.test.mjs`: "a closing pull request by a GitHub App passes without a lookup" |
| 1271 | sh if && operand | `[ -n "$login" ]` | `true` | `issue-triage-backstop.test.mjs`: "an unknown author or a malformed login counts as no access, without a lookup" |
| 1274 | sh skip statement | `break` | `:` | Not caught, equivalent: once a pull request counts, nothing later in the loop sets the count back or fails the step, so going on changes only the log |
| 1276 | sh if whole | `! [[ "$login" =~ ^[A-Za-z0-9-]+(_[A-Za-z0-9]+)?$ ]]` | `true` | `issue-triage-backstop.test.mjs`: "a closing pull request by an author with write access passes the stale check" |
| 1276 | sh if whole | `! [[ "$login" =~ ^[A-Za-z0-9-]+(_[A-Za-z0-9]+)?$ ]]` | `false` | `issue-triage-backstop.test.mjs`: "an unknown author or a malformed login counts as no access, without a lookup" |
| 1278 | sh skip statement | `continue` | `:` | `issue-triage-backstop.test.mjs`: "an unknown author or a malformed login counts as no access, without a lookup" |
| 1281 | sh if whole | `! permission=$(gh api --method GET "repos/$REPO/collaborators/$login/permission"…` | `true` | `issue-triage-backstop.test.mjs`: "a closing pull request by an author with write access passes the stale check" |
| 1281 | sh if whole | `! permission=$(gh api --method GET "repos/$REPO/collaborators/$login/permission"…` | `false` | `issue-triage-backstop.test.mjs`: "a closing pull request by an author with write access passes the stale check" |
| 1283 | sh skip statement | `continue` | `:` | Not caught, equivalent: with the lookup failed, the permission is empty and the case below counts it as no access, as the `continue` does; only the log line differs |
| 1286 | sh case arm | `admin\|write` | `__mutant_never__` | `issue-triage-backstop.test.mjs`: "a closing pull request by an author with write access passes the stale check" |
| 1286 | sh skip statement | `break` | `:` | Not caught, equivalent: once a pull request counts, nothing later in the loop sets the count back or fails the step, so going on changes only the log |
| 1287 | sh case arm | `*` | `__mutant_never__` | `issue-triage-backstop.test.mjs`: "a closing pull request by an author without write access fails the stale check" |
| 1291 | jq select and operand | `.user.login == \"github-actions[bot]\"` | `true` | `issue-triage-backstop.test.mjs`: "no closing pull request and no stale-claim comment fails the stale check" |
| 1291 | jq select whole | `.user.login == \"github-actions[bot]\" and (.body \| split(\"\\n\") \| index(\"## …` | `true` | `issue-triage-backstop.test.mjs`: "no closing pull request and no stale-claim comment fails the stale check" |
| 1291 | jq select whole | `.user.login == \"github-actions[bot]\" and (.body \| split(\"\\n\") \| index(\"## …` | `false` | `issue-triage-backstop.test.mjs`: "a stale-claim comment passes even when only an untrusted author's pull request closes" |
| 1291 | jq select and operand | `(.body \| split(\"\\n\") \| index(\"## Triage: stale claim\")) != null` | `true` | `issue-triage-backstop.test.mjs`: "no closing pull request and no stale-claim comment fails the stale check" |
| 1293 | sh if \|\| operand | `[ "$closing" -gt 0 ]` | `false` | `issue-triage-backstop.test.mjs`: "a closing pull request by an author with write access passes the stale check" |
| 1293 | sh if whole | `[ "$closing" -gt 0 ] \|\| [ "$warned" -gt 0 ]` | `true` | `issue-triage-backstop.test.mjs`: "a closing pull request by an author without write access fails the stale check" |
| 1293 | sh if whole | `[ "$closing" -gt 0 ] \|\| [ "$warned" -gt 0 ]` | `false` | `issue-triage-backstop.test.mjs`: "a closing pull request by an author with write access passes the stale check" |
| 1293 | sh if \|\| operand | `[ "$warned" -gt 0 ]` | `false` | `issue-triage-backstop.test.mjs`: "a stale-claim comment passes even when only an untrusted author's pull request closes" |
| 1294 | sh skip statement | `exit 0` | `:` | `issue-triage-backstop.test.mjs`: "a closing pull request by an author with write access passes the stale check" |
| 1297 | sh failure statement | `exit 1` | `:` | `issue-triage-backstop.test.mjs`: "a closing pull request by an author without write access fails the stale check" |
| 1306 | jq select and operand | `.user.login == \"github-actions[bot]\"` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: the run fails without a comment of its own" |
| 1306 | jq select whole | `.user.login == \"github-actions[bot]\" and (.body \| contains(\"<!-- issue-triage…` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: the run fails without a comment of its own" |
| 1306 | jq select whole | `.user.login == \"github-actions[bot]\" and (.body \| contains(\"<!-- issue-triage…` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: a triaged or questioned issue in its right state passes" |
| 1306 | jq select and operand | `(.body \| contains(\"<!-- issue-triage run $GITHUB_RUN_ID.$GITHUB_RUN_ATTEMPT -->…` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: the run fails without a comment of its own" |
| 1307 | sh if whole | `[ -z "$posted" ]` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: a triaged or questioned issue in its right state passes" |
| 1307 | sh if whole | `[ -z "$posted" ]` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: the run fails without a comment of its own" |
| 1309 | sh failure statement | `exit 1` | `:` | `issue-triage-state.test.mjs`: "issue-triage.yml: the run fails without a comment of its own" |
| 1311 | sh failure statement | `exit 1` | `:` | `issue-triage-state.test.mjs`: "issue-triage.yml: the comment's heading must match the state the issue ends in" |
| 1314 | sh if whole | `has needs-operator` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: a triaged or questioned issue in its right state passes" |
| 1314 | sh if whole | `has needs-operator` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: a triaged or questioned issue in its right state passes" |
| 1315 | sh list condition | `grep -qx '## Triage: questions' <<<"$posted"` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: the comment's heading must match the state the issue ends in" |
| 1315 | sh list condition | `grep -qx '## Triage: questions' <<<"$posted"` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: a triaged or questioned issue in its right state passes" |
| 1317 | sh list condition | `grep -qxE '## Triage( \(revised\))?' <<<"$posted"` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: the comment's heading must match the state the issue ends in" |
| 1317 | sh list condition | `grep -qxE '## Triage( \(revised\))?' <<<"$posted"` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: a triaged or questioned issue in its right state passes" |
| 1319 | sh list condition | `has needs-triage` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: needs-triage must go, and triaged and needs-operator are one or the other" |
| 1319 | sh list condition | `has needs-triage` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: a triaged or questioned issue in its right state passes" |
| 1320 | sh if && operand | `! has triaged` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: a triaged or questioned issue in its right state passes" |
| 1320 | sh if whole | `! has triaged && ! has needs-operator` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: a triaged or questioned issue in its right state passes" |
| 1320 | sh if whole | `! has triaged && ! has needs-operator` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: needs-triage must go, and triaged and needs-operator are one or the other" |
| 1320 | sh if && operand | `! has needs-operator` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: a triaged or questioned issue in its right state passes" |
| 1321 | sh if && operand | `has triaged` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: a triaged or questioned issue in its right state passes" |
| 1321 | sh if whole | `has triaged && has needs-operator` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: a triaged or questioned issue in its right state passes" |
| 1321 | sh if whole | `has triaged && has needs-operator` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: needs-triage must go, and triaged and needs-operator are one or the other" |
| 1321 | sh if && operand | `has needs-operator` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: a triaged or questioned issue in its right state passes" |
| 1325 | sh list condition | `[ "$(count 'bug\|feature\|chore')" -eq 1 ]` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: the issue carries exactly one type and one priority" |
| 1325 | sh list condition | `[ "$(count 'bug\|feature\|chore')" -eq 1 ]` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: a triaged or questioned issue in its right state passes" |
| 1326 | sh list condition | `[ "$(count 'P[0-3]')" -eq 1 ]` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: the issue carries exactly one type and one priority" |
| 1326 | sh list condition | `[ "$(count 'P[0-3]')" -eq 1 ]` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: a triaged or questioned issue in its right state passes" |
| 1330 | sh if \|\| operand | `[ "$ACTION" = edited ]` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: a fresh triage drops the approval, and a reopen the claim" |
| 1330 | sh if whole | `[ "$ACTION" = edited ] \|\| [ "$ACTION" = reopened ] \|\| [ "$ACTION" = labeled ] \|\|…` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: a fresh triage drops the approval, and a reopen the claim" |
| 1330 | sh if whole | `[ "$ACTION" = edited ] \|\| [ "$ACTION" = reopened ] \|\| [ "$ACTION" = labeled ] \|\|…` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: a fresh triage drops the approval, and a reopen the claim" |
| 1330 | sh if \|\| operand | `[ "$ACTION" = reopened ]` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: a fresh triage drops the approval, and a reopen the claim" |
| 1330 | sh if \|\| operand | `[ "$ACTION" = labeled ]` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: a fresh triage drops the approval, and a reopen the claim" |
| 1330 | sh if \|\| operand | `[ "$RETRIAGE" = true ]` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: a fresh triage drops the approval, and a reopen the claim" |
| 1331 | sh list condition | `has agent:approved` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: a fresh triage drops the approval, and a reopen the claim" |
| 1331 | sh list condition | `has agent:approved` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: a triaged or questioned issue in its right state passes" |
| 1333 | sh if && operand | `[ "$ACTION" = "reopened" ]` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: only a reopen must drop the claim" |
| 1333 | sh if whole | `[ "$ACTION" = "reopened" ] && has in-progress` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: a triaged or questioned issue in its right state passes" |
| 1333 | sh if whole | `[ "$ACTION" = "reopened" ] && has in-progress` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: a fresh triage drops the approval, and a reopen the claim" |
| 1333 | sh if && operand | `has in-progress` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: a fresh triage drops the approval, and a reopen the claim" |
| 1338 | if: whole | `env.TRIAGE_ISSUE == ''` | `true` | `issue-triage-conditions.test.mjs`: "the state check runs for one issue, and the sweep's steps for a sweep" |
| 1338 | if: whole | `env.TRIAGE_ISSUE == ''` | `false` | `issue-triage-conditions.test.mjs`: "the state check runs for one issue, and the sweep's steps for a sweep" |
| 1341 | sh if whole | `[ -n "$missing" ]` | `true` | `issue-triage-state.test.mjs`: "issue-triage.yml: the sweep fails when it left an eligible issue undispatched" |
| 1341 | sh if whole | `[ -n "$missing" ]` | `false` | `issue-triage-state.test.mjs`: "issue-triage.yml: the sweep fails when it left an eligible issue undispatched" |
| 1343 | sh failure statement | `exit 1` | `:` | `issue-triage-state.test.mjs`: "issue-triage.yml: the sweep fails when it left an eligible issue undispatched" |
| 1352 | if: whole | `${{ !cancelled() && env.TRIAGE_ISSUE == '' }}` | `true` | `issue-triage-conditions.test.mjs`: "the state check runs for one issue, and the sweep's steps for a sweep" |
| 1352 | if: whole | `${{ !cancelled() && env.TRIAGE_ISSUE == '' }}` | `false` | `issue-triage-conditions.test.mjs`: "the state check runs for one issue, and the sweep's steps for a sweep" |
| 1352 | if: && operand | `!cancelled()` | `true` | `issue-triage-conditions.test.mjs`: "the state check runs for one issue, and the sweep's steps for a sweep" |
| 1352 | if: && operand | `env.TRIAGE_ISSUE == ''` | `true` | `issue-triage-conditions.test.mjs`: "the state check runs for one issue, and the sweep's steps for a sweep" |
| 1354 | sh list && operand | `[ -n "${DISPATCH_QUEUE:-}" ]` | `true` | Not caught, equivalent: with no queue named, `[ -f "" ]` is false, so the step ends at the same `exit 0` |
| 1354 | sh list whole | `[ -n "${DISPATCH_QUEUE:-}" ] && [ -f "$DISPATCH_QUEUE" ]` | `true` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: a sweep that stopped before its queue passes nothing on" |
| 1354 | sh list whole | `[ -n "${DISPATCH_QUEUE:-}" ] && [ -f "$DISPATCH_QUEUE" ]` | `false` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the sweep's queue is passed on as issue numbers, once each" |
| 1354 | sh list && operand | `[ -f "$DISPATCH_QUEUE" ]` | `true` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: a sweep that stopped before its queue passes nothing on" |
| 1354 | sh skip statement | `exit 0` | `:` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: a sweep that stopped before its queue passes nothing on" |
| 1357 | sh case arm | `*[!0-9\ ]*` | `__mutant_never__` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the sweep's queue is passed on as issue numbers, once each" |
| 1357 | sh failure statement | `exit 1` | `:` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the sweep's queue is passed on as issue numbers, once each" |
| 1360 | sh list condition | `grep -qx "$n" "$ELIGIBLE_ISSUES"` | `true` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the sweep's queue is passed on as issue numbers, once each" |
| 1360 | sh list condition | `grep -qx "$n" "$ELIGIBLE_ISSUES"` | `false` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the sweep's queue is passed on as issue numbers, once each" |
| 1360 | sh failure statement | `exit 1` | `:` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the sweep's queue is passed on as issue numbers, once each" |
| 1363 | sh output statement | (before `echo "issues=$queue" >> "$GITHUB_OUTPUT"`) | `: ` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the sweep's queue is passed on as issue numbers, once each" |
| 1381 | if: whole | `${{ !cancelled() && needs.triage.outputs.dispatch != '' }}` | `true` | `issue-triage-conditions.test.mjs`: "the dispatch job runs when the sweep passed issues on, even after a failure" |
| 1381 | if: whole | `${{ !cancelled() && needs.triage.outputs.dispatch != '' }}` | `false` | `issue-triage-conditions.test.mjs`: "the dispatch job runs when the sweep passed issues on, even after a failure" |
| 1381 | if: && operand | `!cancelled()` | `true` | `issue-triage-conditions.test.mjs`: "the dispatch job runs when the sweep passed issues on, even after a failure" |
| 1381 | if: && operand | `needs.triage.outputs.dispatch != ''` | `true` | `issue-triage-conditions.test.mjs`: "the dispatch job runs when the sweep passed issues on, even after a failure" |
| 1398 | sh case arm | `*[!0-9]*` | `__mutant_never__` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job refuses anything but issue numbers" |
| 1398 | sh failure statement | `exit 1` | `:` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job refuses anything but issue numbers" |
| 1403 | sh if whole | `! now=$(gh api "repos/$REPO/issues/$n" --jq '(.labels \| map(.name)) as $l \| if .…` | `true` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job starts one run per queued issue" |
| 1403 | sh if whole | `! now=$(gh api "repos/$REPO/issues/$n" --jq '(.labels \| map(.name)) as $l \| if .…` | `false` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job starts one run per queued issue" |
| 1404 | jq if whole | `.state != "open"` | `true` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job starts one run per queued issue" |
| 1404 | jq if whole | `.state != "open"` | `false` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job leaves an issue that changed since it was queued" |
| 1405 | jq elif or operand | `($l \| index("needs-triage")) != null` | `false` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job starts one run per queued issue" |
| 1405 | jq elif whole | `($l \| index("needs-triage")) != null or ($l - ["needs-triage","triaged","in-prog…` | `true` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job leaves an issue that changed since it was queued" |
| 1405 | jq elif whole | `($l \| index("needs-triage")) != null or ($l - ["needs-triage","triaged","in-prog…` | `false` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job starts one run per queued issue" |
| 1406 | jq elif or operand | `($l - ["needs-triage","triaged","in-progress","needs-operator"] \| length) == ($l…` | `false` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job starts one run per queued issue" |
| 1407 | jq elif or operand | `(($l \| index("in-progress")) != null and (now - (.updated_at \| fromdate)) > 7 * …` | `false` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job leaves an issue that changed since it was queued" |
| 1409 | jq select or operand | `. == "triaged"` | `false` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job leaves an issue that changed since it was queued" |
| 1409 | jq select whole | `. == "triaged" or . == "in-progress" or . == "needs-operator"` | `true` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job leaves an issue that changed since it was queued" |
| 1409 | jq select whole | `. == "triaged" or . == "in-progress" or . == "needs-operator"` | `false` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job leaves an issue that changed since it was queued" |
| 1409 | jq select or operand | `. == "in-progress"` | `false` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job leaves an issue that changed since it was queued" |
| 1409 | jq select or operand | `. == "needs-operator"` | `false` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job leaves an issue that changed since it was queued" |
| 1412 | sh skip statement | `continue` | `:` | Not caught, equivalent: with the lookup failed the issue is already among the failures, and `now` is empty, so the next check skips it with a log line; the step fails the same |
| 1414 | sh if whole | `[ "$now" != "eligible" ]` | `true` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job starts one run per queued issue" |
| 1414 | sh if whole | `[ "$now" != "eligible" ]` | `false` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job leaves an issue that changed since it was queued" |
| 1416 | sh skip statement | `continue` | `:` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job leaves an issue that changed since it was queued" |
| 1418 | sh if whole | `gh workflow run issue-triage.yml --repo "$REPO" --ref "$GITHUB_REF_NAME" -f "iss…` | `true` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job starts one run per queued issue" |
| 1418 | sh if whole | `gh workflow run issue-triage.yml --repo "$REPO" --ref "$GITHUB_REF_NAME" -f "iss…` | `false` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job starts one run per queued issue" |
| 1424 | sh if whole | `[ -n "$failed" ]` | `true` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job starts one run per queued issue" |
| 1424 | sh if whole | `[ -n "$failed" ]` | `false` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job tries every issue, then fails naming those it could not start" |
| 1426 | sh failure statement | `exit 1` | `:` | `issue-triage-dispatch.test.mjs`: "issue-triage.yml: the dispatch job tries every issue, then fails naming those it could not start" |

</details>

### `.github/workflows/pr-issue-link.yml`

97 rules: 96 caught (1 of them by a time limit, 52 through a copy of their step), 1 left with the reason given.

<details><summary>Every rule of <code>.github/workflows/pr-issue-link.yml</code></summary>

| Line | Kind | Rule | Switched off as | Caught by, or why not |
| --- | --- | --- | --- | --- |
| 47 | if: && operand | `github.event.pull_request.user.login != 'dependabot[bot]'` | `true` | `pr-issue-link-conditions.test.mjs`: "pr-issue-link: the settings job skips Dependabot's and Release Please's pull requests" |
| 47 | if: whole | `github.event.pull_request.user.login != 'dependabot[bot]' && !(startsWith(github…` | `true` | `pr-issue-link-conditions.test.mjs`: "pr-issue-link: the settings job skips Dependabot's and Release Please's pull requests" |
| 47 | if: whole | `github.event.pull_request.user.login != 'dependabot[bot]' && !(startsWith(github…` | `false` | `pr-issue-link-conditions.test.mjs`: "pr-issue-link: the settings job skips Dependabot's and Release Please's pull requests" |
| 48 | if: && operand | `!(startsWith(github.head_ref, 'release-please--') && github.event.pull_request.u…` | `true` | `pr-issue-link-conditions.test.mjs`: "pr-issue-link: the settings job skips Dependabot's and Release Please's pull requests" |
| 48 | if: && operand | `startsWith(github.head_ref, 'release-please--')` | `true` | `pr-issue-link-conditions.test.mjs`: "pr-issue-link: the settings job skips Dependabot's and Release Please's pull requests" |
| 49 | if: && operand | `github.event.pull_request.user.type == 'Bot'` | `true` | `pr-issue-link-conditions.test.mjs`: "pr-issue-link: the settings job skips Dependabot's and Release Please's pull requests" |
| 62 | job output | `${{ steps.pass.outputs.KIT_ISSUE_LINK_CHECK }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 94 | sh if whole | `content=$(gh api "repos/$REPO/contents/$file" \ --jq 'if .type != "file" then er…` | `true` | its copy at `pr-review.yml` line 142, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 94 | sh if whole | `content=$(gh api "repos/$REPO/contents/$file" \ --jq 'if .type != "file" then er…` | `false` | its copy at `pr-review.yml` line 142, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 95 | jq if whole | `.type != "file"` | `true` | its copy at `pr-review.yml` line 143, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 95 | jq if whole | `.type != "file"` | `false` | its copy at `pr-review.yml` line 143, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 95 | jq elif whole | `.size > 16384` | `true` | its copy at `pr-review.yml` line 143, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 95 | jq elif whole | `.size > 16384` | `false` | its copy at `pr-review.yml` line 143, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 98 | sh elif whole | `grep -q 'HTTP 404' "$err"` | `true` | its copy at `pr-review.yml` line 146, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 98 | sh elif whole | `grep -q 'HTTP 404' "$err"` | `false` | its copy at `pr-review.yml` line 146, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 103 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 151, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 113 | sh while \|\| operand | `IFS= read -r l` | `false` | its copy at `pr-review.yml` line 161, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 113 | sh while whole | `IFS= read -r l \|\| [ -n "$l" ]` | `true` | its copy at `pr-review.yml` line 161, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 113 | sh while whole | `IFS= read -r l \|\| [ -n "$l" ]` | `false` | its copy at `pr-review.yml` line 161, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 113 | sh while \|\| operand | `[ -n "$l" ]` | `false` | Not caught, equivalent: the lines come from a here-string, which always ends its last line with a newline (bash 5.2, checked 2026-11-27), so `read` never ends on an unterminated line here |
| 116 | sh if \|\| operand | `[[ "$l" =~ ^[[:space:]]*(#.*)?$ ]]` | `false` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 116 | sh if whole | `[[ "$l" =~ ^[[:space:]]*(#.*)?$ ]] \|\| { [ "$l" = "---" ] && [ "${#at[@]}" -eq 0 …` | `true` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 116 | sh if whole | `[[ "$l" =~ ^[[:space:]]*(#.*)?$ ]] \|\| { [ "$l" = "---" ] && [ "${#at[@]}" -eq 0 …` | `false` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 116 | sh if \|\| operand | `{ [ "$l" = "---" ] && [ "${#at[@]}" -eq 0 ]; }` | `false` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 116 | sh if && operand | `[ "$l" = "---" ]` | `true` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 116 | sh if && operand | `[ "${#at[@]}" -eq 0 ]` | `true` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 117 | sh skip statement | `continue` | `:` | its copy at `pr-review.yml` line 165, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 119 | sh if whole | `! [[ "$l" =~ ^([A-Z][A-Z0-9_]*):(.*)$ ]]` | `true` | its copy at `pr-review.yml` line 167, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 119 | sh if whole | `! [[ "$l" =~ ^([A-Z][A-Z0-9_]*):(.*)$ ]]` | `false` | its copy at `pr-review.yml` line 167, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 121 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 169, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 124 | sh if whole | `[[ " ${known[*]} " != *" $name "* ]]` | `true` | its copy at `pr-review.yml` line 172, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 124 | sh if whole | `[[ " ${known[*]} " != *" $name "* ]]` | `false` | its copy at `pr-review.yml` line 172, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 126 | sh case arm | `*KEY* \| *TOKEN* \| *SECRET* \| *PASSWORD*` | `__mutant_never__` | its copy at `pr-review.yml` line 174, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 128 | sh case arm | `KIT_*` | `__mutant_never__` | its copy at `pr-review.yml` line 176, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 130 | sh case arm | `*` | `__mutant_never__` | its copy at `pr-review.yml` line 178, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 133 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 181, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 135 | sh if whole | `[ -n "${at[$name]:-}" ]` | `true` | its copy at `pr-review.yml` line 183, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 135 | sh if whole | `[ -n "${at[$name]:-}" ]` | `false` | its copy at `pr-review.yml` line 183, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 137 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 185, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 139 | sh if whole | `! [[ "$rest" =~ $pair ]]` | `true` | its copy at `pr-review.yml` line 187, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 139 | sh if whole | `! [[ "$rest" =~ $pair ]]` | `false` | its copy at `pr-review.yml` line 187, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 141 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 189, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 153 | sh if whole | `[ -n "$v" ]` | `true` | its copy at `pr-review.yml` line 201, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 153 | sh if whole | `[ -n "$v" ]` | `false` | its copy at `pr-review.yml` line 201, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 155 | sh elif whole | `[ -n "${value[$name]:-}" ]` | `true` | its copy at `pr-review.yml` line 203, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 155 | sh elif whole | `[ -n "${value[$name]:-}" ]` | `false` | its copy at `pr-review.yml` line 203, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 161 | sh if whole | `! [[ "$v" =~ ^$word*$ ]]` | `true` | its copy at `pr-review.yml` line 209, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 161 | sh if whole | `! [[ "$v" =~ ^$word*$ ]]` | `false` | its copy at `pr-review.yml` line 209, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 163 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 211, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 168 | sh case arm | `KIT_REVIEW_MODE \| KIT_SECURITY_SCAN` | `__mutant_never__` | its copy at `pr-review.yml` line 216, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 169 | sh case arm | `KIT_ISSUE_TRIAGE \| KIT_UPDATE_CHECK \| KIT_ISSUE_LINK_CHECK` | `__mutant_never__` | its copy at `pr-review.yml` line 217, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 170 | sh case arm | `*` | `__mutant_never__` | its copy at `pr-review.yml` line 218, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 172 | sh if && operand | `[ -n "$states" ]` | `true` | its copy at `pr-review.yml` line 220, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 172 | sh if whole | `[ -n "$states" ] && [ -n "$v" ] && [[ " $states " != *" $v "* ]]` | `true` | its copy at `pr-review.yml` line 220, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 172 | sh if whole | `[ -n "$states" ] && [ -n "$v" ] && [[ " $states " != *" $v "* ]]` | `false` | its copy at `pr-review.yml` line 220, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 172 | sh if && operand | `[ -n "$v" ]` | `true` | its copy at `pr-review.yml` line 220, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 172 | sh if && operand | `[[ " $states " != *" $v "* ]]` | `true` | its copy at `pr-review.yml` line 220, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 174 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 222, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 176 | sh output statement | (before `echo "$name=$v" >> "$GITHUB_ENV"`) | `: ` | its copy at `pr-review.yml` line 224, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 177 | sh output statement | (before `echo "FROM_$name=$from" >> "$GITHUB_ENV"`) | `: ` | its copy at `pr-review.yml` line 225, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 185 | sh output statement | (before `printf '%s=%s\n' "$name" "${!name}" >> "$GITHUB_OUTPUT"`) | `: ` | `kit-settings.test.mjs`: "each workflow's pass step hands every setting on as an output" |
| 195 | if: whole | `${{ !cancelled() && (needs.settings.result == 'failure' \|\| needs.settings.output…` | `true` | `pr-issue-link-conditions.test.mjs`: "pr-issue-link: the link job runs while the check is on, and when the settings failed" |
| 195 | if: whole | `${{ !cancelled() && (needs.settings.result == 'failure' \|\| needs.settings.output…` | `false` | `pr-issue-link-conditions.test.mjs`: "pr-issue-link: the link job runs while the check is on, and when the settings failed" |
| 195 | if: && operand | `!cancelled()` | `true` | `pr-issue-link-conditions.test.mjs`: "pr-issue-link: the link job runs while the check is on, and when the settings failed" |
| 195 | if: && operand | `(needs.settings.result == 'failure' \|\| needs.settings.outputs.KIT_ISSUE_LINK_CHE…` | `true` | `pr-issue-link-conditions.test.mjs`: "pr-issue-link: the link job runs while the check is on, and when the settings failed" |
| 195 | if: \|\| operand | `needs.settings.result == 'failure'` | `false` | `pr-issue-link-conditions.test.mjs`: "pr-issue-link: the link job runs while the check is on, and when the settings failed" |
| 195 | if: \|\| operand | `needs.settings.outputs.KIT_ISSUE_LINK_CHECK == 'on'` | `false` | `pr-issue-link-conditions.test.mjs`: "pr-issue-link: the link job runs while the check is on, and when the settings failed" |
| 208 | if: whole | `needs.settings.result == 'failure'` | `true` | `pr-issue-link-conditions.test.mjs`: "pr-issue-link: the link job runs while the check is on, and when the settings failed" |
| 208 | if: whole | `needs.settings.result == 'failure'` | `false` | `pr-issue-link-conditions.test.mjs`: "pr-issue-link: the link job runs while the check is on, and when the settings failed" |
| 211 | sh failure statement | `exit 1` | `:` | `workflow-fail-closed.test.mjs`: "pr-issue-link.yml: a settings job that failed fails the job after it" |
| 230 | awk if \|\| operand | `c == "'"` | `0` | `pr-issue-link.test.mjs`: "a mention, a keyword without a number, a bare No issue, a template hint or fenced code fails" |
| 230 | awk if whole | `c == "'" \|\| c == "~"` | `1` | `pr-issue-link.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 230 | awk if whole | `c == "'" \|\| c == "~"` | `0` | `pr-issue-link.test.mjs`: "a mention, a keyword without a number, a bare No issue, a template hint or fenced code fails" |
| 230 | awk if \|\| operand | `c == "~"` | `0` | `pr-issue-link.test.mjs`: "a mention, a keyword without a number, a bare No issue, a template hint or fenced code fails" |
| 230 | awk while whole | `substr(l, n + 1, 1) == c` | `1` | `pr-issue-link.test.mjs`: "a closing keyword before an issue passes, in each form GitHub links" |
| 230 | awk while whole | `substr(l, n + 1, 1) == c` | `0` | `pr-issue-link.test.mjs`: "a mention, a keyword without a number, a bare No issue, a template hint or fenced code fails" |
| 232 | awk if whole | `fence` | `1` | `pr-issue-link.test.mjs`: "a closing keyword before an issue passes, in each form GitHub links" |
| 232 | awk if whole | `fence` | `0` | `pr-issue-link.test.mjs`: "a mention, a keyword without a number, a bare No issue, a template hint or fenced code fails" |
| 233 | awk if && operand | `c == fc` | `1` | `pr-issue-link.test.mjs`: "a mention, a keyword without a number, a bare No issue, a template hint or fenced code fails" |
| 233 | awk if whole | `c == fc && n >= fl && rest ~ /^[ \t]*$/` | `1` | `pr-issue-link.test.mjs`: "a mention, a keyword without a number, a bare No issue, a template hint or fenced code fails" |
| 233 | awk if whole | `c == fc && n >= fl && rest ~ /^[ \t]*$/` | `0` | `pr-issue-link.test.mjs`: "a closing keyword before an issue passes, in each form GitHub links" |
| 233 | awk if && operand | `n >= fl` | `1` | `pr-issue-link.test.mjs`: "a mention, a keyword without a number, a bare No issue, a template hint or fenced code fails" |
| 233 | awk if && operand | `rest ~ /^[ \t]*$/` | `1` | `pr-issue-link.test.mjs`: "a mention, a keyword without a number, a bare No issue, a template hint or fenced code fails" |
| 234 | awk skip statement | `next` | `;` | `pr-issue-link.test.mjs`: "a mention, a keyword without a number, a bare No issue, a template hint or fenced code fails" |
| 236 | awk if && operand | `n >= 3` | `1` | `pr-issue-link.test.mjs`: "a closing keyword before an issue passes, in each form GitHub links" |
| 236 | awk if whole | `n >= 3 && !(c == "'" && index(rest, "'"))` | `1` | `pr-issue-link.test.mjs`: "a closing keyword before an issue passes, in each form GitHub links" |
| 236 | awk if whole | `n >= 3 && !(c == "'" && index(rest, "'"))` | `0` | `pr-issue-link.test.mjs`: "a mention, a keyword without a number, a bare No issue, a template hint or fenced code fails" |
| 236 | awk if && operand | `!(c == "'" && index(rest, "'"))` | `1` | `pr-issue-link.test.mjs`: "a closing keyword before an issue passes, in each form GitHub links" |
| 236 | awk if && operand | `c == "'"` | `1` | `pr-issue-link.test.mjs`: "a mention, a keyword without a number, a bare No issue, a template hint or fenced code fails" |
| 236 | awk if && operand | `index(rest, "'")` | `1` | `pr-issue-link.test.mjs`: "a mention, a keyword without a number, a bare No issue, a template hint or fenced code fails" |
| 236 | awk skip statement | `next` | `;` | `pr-issue-link.test.mjs`: "a mention, a keyword without a number, a bare No issue, a template hint or fenced code fails" |
| 237 | awk output statement | `print` | `;` | `pr-issue-link.test.mjs`: "a closing keyword before an issue passes, in each form GitHub links" |
| 243 | sh if whole | `grep -qiE -- "$close$target" <<< "$text"` | `true` | `pr-issue-link.test.mjs`: "a No issue line with a reason passes, plain, bold, emphasised or as a list item" |
| 243 | sh if whole | `grep -qiE -- "$close$target" <<< "$text"` | `false` | `pr-issue-link.test.mjs`: "a closing keyword before an issue passes, in each form GitHub links" |
| 247 | sh elif whole | `grep -qiE -- '^[[:space:]]*([-*+][[:space:]]+)?(\*\*\|__)?No issue:((\*\*\|__)[[:s…` | `true` | `pr-issue-link.test.mjs`: "a mention, a keyword without a number, a bare No issue, a template hint or fenced code fails" |
| 247 | sh elif whole | `grep -qiE -- '^[[:space:]]*([-*+][[:space:]]+)?(\*\*\|__)?No issue:((\*\*\|__)[[:s…` | `false` | `pr-issue-link.test.mjs`: "a No issue line with a reason passes, plain, bold, emphasised or as a list item" |
| 251 | sh failure statement | `exit 1` | `:` | `pr-issue-link.test.mjs`: "a mention, a keyword without a number, a bare No issue, a template hint or fenced code fails" |

</details>

### `.github/workflows/kit-update-check.yml`

196 rules: 191 caught (2 of them by a time limit, 52 through a copy of their step), 5 left with the reason given.

<details><summary>Every rule of <code>.github/workflows/kit-update-check.yml</code></summary>

| Line | Kind | Rule | Switched off as | Caught by, or why not |
| --- | --- | --- | --- | --- |
| 69 | job output | `${{ steps.pass.outputs.KIT_UPDATE_CHECK }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 101 | sh if whole | `content=$(gh api "repos/$REPO/contents/$file" \ --jq 'if .type != "file" then er…` | `true` | its copy at `pr-review.yml` line 142, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 101 | sh if whole | `content=$(gh api "repos/$REPO/contents/$file" \ --jq 'if .type != "file" then er…` | `false` | its copy at `pr-review.yml` line 142, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 102 | jq if whole | `.type != "file"` | `true` | its copy at `pr-review.yml` line 143, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 102 | jq if whole | `.type != "file"` | `false` | its copy at `pr-review.yml` line 143, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 102 | jq elif whole | `.size > 16384` | `true` | its copy at `pr-review.yml` line 143, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 102 | jq elif whole | `.size > 16384` | `false` | its copy at `pr-review.yml` line 143, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 105 | sh elif whole | `grep -q 'HTTP 404' "$err"` | `true` | its copy at `pr-review.yml` line 146, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 105 | sh elif whole | `grep -q 'HTTP 404' "$err"` | `false` | its copy at `pr-review.yml` line 146, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 110 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 151, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 120 | sh while \|\| operand | `IFS= read -r l` | `false` | its copy at `pr-review.yml` line 161, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 120 | sh while whole | `IFS= read -r l \|\| [ -n "$l" ]` | `true` | its copy at `pr-review.yml` line 161, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 120 | sh while whole | `IFS= read -r l \|\| [ -n "$l" ]` | `false` | its copy at `pr-review.yml` line 161, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 120 | sh while \|\| operand | `[ -n "$l" ]` | `false` | Not caught, equivalent: the lines come from a here-string, which always ends its last line with a newline (bash 5.2, checked 2026-11-27), so `read` never ends on an unterminated line here |
| 123 | sh if \|\| operand | `[[ "$l" =~ ^[[:space:]]*(#.*)?$ ]]` | `false` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 123 | sh if whole | `[[ "$l" =~ ^[[:space:]]*(#.*)?$ ]] \|\| { [ "$l" = "---" ] && [ "${#at[@]}" -eq 0 …` | `true` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 123 | sh if whole | `[[ "$l" =~ ^[[:space:]]*(#.*)?$ ]] \|\| { [ "$l" = "---" ] && [ "${#at[@]}" -eq 0 …` | `false` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 123 | sh if \|\| operand | `{ [ "$l" = "---" ] && [ "${#at[@]}" -eq 0 ]; }` | `false` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 123 | sh if && operand | `[ "$l" = "---" ]` | `true` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 123 | sh if && operand | `[ "${#at[@]}" -eq 0 ]` | `true` | its copy at `pr-review.yml` line 164, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 124 | sh skip statement | `continue` | `:` | its copy at `pr-review.yml` line 165, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 126 | sh if whole | `! [[ "$l" =~ ^([A-Z][A-Z0-9_]*):(.*)$ ]]` | `true` | its copy at `pr-review.yml` line 167, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 126 | sh if whole | `! [[ "$l" =~ ^([A-Z][A-Z0-9_]*):(.*)$ ]]` | `false` | its copy at `pr-review.yml` line 167, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 128 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 169, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 131 | sh if whole | `[[ " ${known[*]} " != *" $name "* ]]` | `true` | its copy at `pr-review.yml` line 172, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 131 | sh if whole | `[[ " ${known[*]} " != *" $name "* ]]` | `false` | its copy at `pr-review.yml` line 172, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 133 | sh case arm | `*KEY* \| *TOKEN* \| *SECRET* \| *PASSWORD*` | `__mutant_never__` | its copy at `pr-review.yml` line 174, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 135 | sh case arm | `KIT_*` | `__mutant_never__` | its copy at `pr-review.yml` line 176, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 137 | sh case arm | `*` | `__mutant_never__` | its copy at `pr-review.yml` line 178, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 140 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 181, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 142 | sh if whole | `[ -n "${at[$name]:-}" ]` | `true` | its copy at `pr-review.yml` line 183, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 142 | sh if whole | `[ -n "${at[$name]:-}" ]` | `false` | its copy at `pr-review.yml` line 183, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 144 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 185, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 146 | sh if whole | `! [[ "$rest" =~ $pair ]]` | `true` | its copy at `pr-review.yml` line 187, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 146 | sh if whole | `! [[ "$rest" =~ $pair ]]` | `false` | its copy at `pr-review.yml` line 187, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 148 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 189, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 160 | sh if whole | `[ -n "$v" ]` | `true` | its copy at `pr-review.yml` line 201, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 160 | sh if whole | `[ -n "$v" ]` | `false` | its copy at `pr-review.yml` line 201, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 162 | sh elif whole | `[ -n "${value[$name]:-}" ]` | `true` | its copy at `pr-review.yml` line 203, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 162 | sh elif whole | `[ -n "${value[$name]:-}" ]` | `false` | its copy at `pr-review.yml` line 203, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 168 | sh if whole | `! [[ "$v" =~ ^$word*$ ]]` | `true` | its copy at `pr-review.yml` line 209, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 168 | sh if whole | `! [[ "$v" =~ ^$word*$ ]]` | `false` | its copy at `pr-review.yml` line 209, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 170 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 211, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 175 | sh case arm | `KIT_REVIEW_MODE \| KIT_SECURITY_SCAN` | `__mutant_never__` | its copy at `pr-review.yml` line 216, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 176 | sh case arm | `KIT_ISSUE_TRIAGE \| KIT_UPDATE_CHECK \| KIT_ISSUE_LINK_CHECK` | `__mutant_never__` | its copy at `pr-review.yml` line 217, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 177 | sh case arm | `*` | `__mutant_never__` | its copy at `pr-review.yml` line 218, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 179 | sh if && operand | `[ -n "$states" ]` | `true` | its copy at `pr-review.yml` line 220, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 179 | sh if whole | `[ -n "$states" ] && [ -n "$v" ] && [[ " $states " != *" $v "* ]]` | `true` | its copy at `pr-review.yml` line 220, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 179 | sh if whole | `[ -n "$states" ] && [ -n "$v" ] && [[ " $states " != *" $v "* ]]` | `false` | its copy at `pr-review.yml` line 220, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 179 | sh if && operand | `[ -n "$v" ]` | `true` | its copy at `pr-review.yml` line 220, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 179 | sh if && operand | `[[ " $states " != *" $v "* ]]` | `true` | its copy at `pr-review.yml` line 220, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 181 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 222, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 183 | sh output statement | (before `echo "$name=$v" >> "$GITHUB_ENV"`) | `: ` | its copy at `pr-review.yml` line 224, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 184 | sh output statement | (before `echo "FROM_$name=$from" >> "$GITHUB_ENV"`) | `: ` | its copy at `pr-review.yml` line 225, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 192 | sh output statement | (before `printf '%s=%s\n' "$name" "${!name}" >> "$GITHUB_OUTPUT"`) | `: ` | `kit-settings.test.mjs`: "each workflow's pass step hands every setting on as an output" |
| 197 | if: whole | `needs.settings.outputs.KIT_UPDATE_CHECK == 'on'` | `true` | `kit-update-check-conditions.test.mjs`: "the check runs while it is on, and the notice step once it has a state" |
| 197 | if: whole | `needs.settings.outputs.KIT_UPDATE_CHECK == 'on'` | `false` | `kit-update-check-conditions.test.mjs`: "the check runs while it is on, and the notice step once it has a state" |
| 216 | sh if \|\| operand | `[ -L "$lock" ]` | `false` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 216 | sh if whole | `[ -L "$lock" ] \|\| [ ! -f "$lock" ]` | `true` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 216 | sh if whole | `[ -L "$lock" ] \|\| [ ! -f "$lock" ]` | `false` | `kit-update-check.test.mjs`: "the compare step checks the lock before it fetches anything" |
| 216 | sh if \|\| operand | `[ ! -f "$lock" ]` | `false` | `kit-update-check.test.mjs`: "the compare step checks the lock before it fetches anything" |
| 218 | sh skip statement | `exit 0` | `:` | `kit-update-check.test.mjs`: "the compare step checks the lock before it fetches anything" |
| 222 | sh if whole | `! [[ "$source" =~ ^github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]` | `true` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 222 | sh if whole | `! [[ "$source" =~ ^github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]` | `false` | `kit-update-check.test.mjs`: "the compare step checks the lock before it fetches anything" |
| 224 | sh failure statement | `exit 1` | `:` | `kit-update-check.test.mjs`: "the compare step checks the lock before it fetches anything" |
| 226 | sh if whole | `! [[ "$ref" =~ ^[0-9a-f]{40}$ ]]` | `true` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 226 | sh if whole | `! [[ "$ref" =~ ^[0-9a-f]{40}$ ]]` | `false` | `kit-update-check.test.mjs`: "the compare step checks the lock before it fetches anything" |
| 228 | sh failure statement | `exit 1` | `:` | `kit-update-check.test.mjs`: "the compare step checks the lock before it fetches anything" |
| 230 | sh if whole | `! GIT_TERMINAL_PROMPT=0 git clone --bare --quiet "https://$source.git" kit.git 2…` | `true` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 230 | sh if whole | `! GIT_TERMINAL_PROMPT=0 git clone --bare --quiet "https://$source.git" kit.git 2…` | `false` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 233 | sh skip statement | `exit 0` | `:` | `kit-update-check.test.mjs`: "the compare step warns and stops when it cannot fetch the kit" |
| 241 | sh if whole | `[ -z "$tag" ]` | `true` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 241 | sh if whole | `[ -z "$tag" ]` | `false` | `kit-update-check.test.mjs`: "the compare step warns and stops when the kit has no release" |
| 243 | sh skip statement | `exit 0` | `:` | `kit-update-check.test.mjs`: "the compare step warns and stops when the kit has no release" |
| 247 | sh file write | `"$report"` | `/dev/null` | `kit-update-check.test.mjs`: "the compare step leaves out the kit's issue forms when the lock keeps its own" |
| 248 | sh if whole | `[ "$ref" = "$release" ]` | `true` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 248 | sh if whole | `[ "$ref" = "$release" ]` | `false` | Not caught, equivalent: with the lock at the release, the next branch asks whether the release is an ancestor of the lock's ref, and git counts a commit as its own ancestor, so that branch skips the comparison the same way |
| 250 | sh elif whole | `! kit cat-file -e "$ref^{commit}" 2> /dev/null` | `true` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 250 | sh elif whole | `! kit cat-file -e "$ref^{commit}" 2> /dev/null` | `false` | `kit-update-check.test.mjs`: "the compare step says so when the lock's ref is not in the kit's history" |
| 251 | sh file write | `"$report"` | `/dev/null` | `kit-update-check.test.mjs`: "the compare step says so when the lock's ref is not in the kit's history" |
| 252 | sh elif whole | `kit merge-base --is-ancestor "$release" "$ref"` | `true` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 252 | sh elif whole | `kit merge-base --is-ancestor "$release" "$ref"` | `false` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 272 | sh skip statement | `return 0` | `:` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 272 | sh failure statement | `return 1` | `:` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 275 | sh if whole | `skip "$p"` | `true` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 275 | sh if whole | `skip "$p"` | `false` | `kit-update-check.test.mjs`: "the compare step leaves out the kit's issue forms when the lock keeps its own" |
| 276 | sh skip statement | `continue` | `:` | Not caught, equivalent: the continue ends the loop body's only statement, an if chain, so the next file comes next without it too |
| 277 | sh elif whole | `! has "$p" "${was[@]}"` | `true` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 277 | sh elif whole | `! has "$p" "${was[@]}"` | `false` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 278 | sh file write | `"$report"` | `/dev/null` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 279 | sh elif && operand | `[ "$line" = "$p" ]` | `true` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 279 | sh elif whole | `[ "$line" = "$p" ] && [ "$(entry "$ref" "$p")" != "$(entry "$release" "$p")" ]` | `true` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 279 | sh elif whole | `[ "$line" = "$p" ] && [ "$(entry "$ref" "$p")" != "$(entry "$release" "$p")" ]` | `false` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 279 | sh elif && operand | `[ "$(entry "$ref" "$p")" != "$(entry "$release" "$p")" ]` | `true` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 280 | sh file write | `"$report"` | `/dev/null` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 283 | sh list condition | `has "seed $p" "${before[@]}"` | `false` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 283 | sh list condition | `has "seed $p" "${before[@]}"` | `true` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 284 | sh list condition | `[ "$line" = "$p" ]` | `true` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 284 | sh list condition | `[ "$line" = "$p" ]` | `false` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 285 | sh list condition | `[ "$was_seed" = "$now_seed" ]` | `true` | `kit-update-check.test.mjs`: "the compare step reports a file moving between seed and managed" |
| 285 | sh list condition | `[ "$was_seed" = "$now_seed" ]` | `false` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 285 | sh file write | `"$report"` | `/dev/null` | `kit-update-check.test.mjs`: "the compare step reports a file moving between seed and managed" |
| 289 | sh if && operand | `! skip "$p"` | `true` | `kit-update-check.test.mjs`: "the compare step leaves out the kit's issue forms when the lock keeps its own" |
| 289 | sh if whole | `! skip "$p" && ! has "$p" "${now[@]#seed }" && ! has "$p" "${seeds[@]}"` | `true` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 289 | sh if whole | `! skip "$p" && ! has "$p" "${now[@]#seed }" && ! has "$p" "${seeds[@]}"` | `false` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 289 | sh if && operand | `! has "$p" "${now[@]#seed }"` | `true` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 289 | sh if && operand | `! has "$p" "${seeds[@]}"` | `true` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 290 | sh file write | `"$report"` | `/dev/null` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 307 | sh if \|\| operand | `[ "$ref" = "$release" ]` | `false` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 307 | sh if whole | `[ "$ref" = "$release" ] \|\| ! kit cat-file -e "$ref^{commit}" 2> /dev/null \ \|\| !…` | `true` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 307 | sh if whole | `[ "$ref" = "$release" ] \|\| ! kit cat-file -e "$ref^{commit}" 2> /dev/null \ \|\| !…` | `false` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 307 | sh if \|\| operand | `! kit cat-file -e "$ref^{commit}" 2> /dev/null` | `false` | Not caught, equivalent: for a ref not in the kit's history, the next operand (git merge-base --is-ancestor) fails too, so the release's block is read for the same refs |
| 308 | sh if \|\| operand | `! kit merge-base --is-ancestor "$release" "$ref"` | `false` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 311 | sh if whole | `[ -n "$want" ]` | `true` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 311 | sh if whole | `[ -n "$want" ]` | `false` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 314 | sh if && operand | `[ -f "$agents" ]` | `true` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 314 | sh if whole | `[ -f "$agents" ] && [ ! -L "$agents" ]` | `true` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 314 | sh if whole | `[ -f "$agents" ] && [ ! -L "$agents" ]` | `false` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 314 | sh if && operand | `[ ! -L "$agents" ]` | `true` | `kit-update-check.test.mjs`: "the compare step reads no AGENTS.md through a symlink" |
| 321 | awk if \|\| operand | `c == "'"` | `0` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 321 | awk if whole | `c == "'" \|\| c == "~"` | `1` | `kit-update-check.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 321 | awk if whole | `c == "'" \|\| c == "~"` | `0` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 321 | awk if \|\| operand | `c == "~"` | `0` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 321 | awk while whole | `substr(l, n + 1, 1) == c` | `1` | `kit-update-check.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 321 | awk while whole | `substr(l, n + 1, 1) == c` | `0` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 323 | awk if whole | `fence` | `1` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 323 | awk if whole | `fence` | `0` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 324 | awk if && operand | `c == fc` | `1` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 324 | awk if whole | `c == fc && n >= fl && rest ~ /^[ \t]*$/` | `1` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 324 | awk if whole | `c == fc && n >= fl && rest ~ /^[ \t]*$/` | `0` | `kit-update-check.test.mjs`: "the compare step finds the block install.sh writes current" |
| 324 | awk if && operand | `n >= fl` | `1` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 324 | awk if && operand | `rest ~ /^[ \t]*$/` | `1` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 325 | awk if whole | `open` | `1` | `kit-update-check.test.mjs`: "the compare step finds the block install.sh writes current" |
| 325 | awk if whole | `open` | `0` | `kit-update-check.test.mjs`: "the compare step keeps a fence inside the block" |
| 326 | awk skip statement | `next` | `;` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 328 | awk if && operand | `n >= 3` | `1` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 328 | awk if whole | `n >= 3 && !(c == "'" && index(rest, "'"))` | `1` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 328 | awk if whole | `n >= 3 && !(c == "'" && index(rest, "'"))` | `0` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 328 | awk if && operand | `!(c == "'" && index(rest, "'"))` | `1` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 328 | awk if && operand | `c == "'"` | `1` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 328 | awk if && operand | `index(rest, "'")` | `1` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 330 | awk pattern whole | `$0 == s` | `1` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 330 | awk pattern whole | `$0 == s` | `0` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 330 | awk if whole | `!ends` | `1` | Not caught, equivalent: the block is printed only when there is one end and it came while the block was open, so an end before the start already makes it no block, whether the start opens it or not |
| 330 | awk if whole | `!ends` | `0` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 331 | awk pattern whole | `open` | `1` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 331 | awk pattern whole | `open` | `0` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 332 | awk pattern whole | `$0 == e` | `1` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 332 | awk pattern whole | `$0 == e` | `0` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 332 | awk if whole | `open` | `1` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 332 | awk if whole | `open` | `0` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 333 | awk if && operand | `starts == 1` | `1` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 333 | awk if whole | `starts == 1 && ends == 1 && closed` | `1` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 333 | awk if whole | `starts == 1 && ends == 1 && closed` | `0` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 333 | awk if && operand | `ends == 1` | `1` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 333 | awk if && operand | `closed` | `1` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 333 | awk output statement | `printf "%s", block;` | `{}` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 333 | awk if \|\| operand | `starts` | `0` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 333 | awk if whole | `starts \|\| ends` | `1` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 333 | awk if whole | `starts \|\| ends` | `0` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 333 | awk if \|\| operand | `ends` | `0` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 333 | awk output statement | `print "malformed"` | `;` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 336 | sh if whole | `[ -z "$have" ]` | `true` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 336 | sh if whole | `[ -z "$have" ]` | `false` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 337 | sh file write | `"$report"` | `/dev/null` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 338 | sh elif whole | `[ "$have" != "$want" ]` | `true` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 338 | sh elif whole | `[ "$have" != "$want" ]` | `false` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 339 | sh file write | `"$report"` | `/dev/null` | `kit-update-check.test.mjs`: "the compare step reports a missing or differing Work tracking block" |
| 343 | sh if whole | `[ -s "$report" ]` | `true` | `kit-update-check.test.mjs`: "the compare step leaves out the kit's issue forms when the lock keeps its own" |
| 343 | sh if whole | `[ -s "$report" ]` | `false` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 344 | sh output statement | `{ echo "state=$state"; echo "ref=$release"; echo "tag=$tag"; echo "source=$sourc…` | `:` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 344 | sh group command | `echo "state=$state"` | `:` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 344 | sh group command | `echo "ref=$release"` | `:` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 344 | sh group command | `echo "tag=$tag"` | `:` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 344 | sh group command | `echo "source=$source"` | `:` | `kit-update-check.test.mjs`: "the compare step reports each changed, added and removed file" |
| 350 | if: whole | `steps.check.outputs.state != ''` | `true` | `kit-update-check-conditions.test.mjs`: "the check runs while it is on, and the notice step once it has a state" |
| 350 | if: whole | `steps.check.outputs.state != ''` | `false` | `kit-update-check-conditions.test.mjs`: "the check runs while it is on, and the notice step once it has a state" |
| 362 | jq select and operand | `.pull_request == null` | `true` | `kit-update-check.test.mjs`: "the notice step opens one issue when behind and none is open" |
| 362 | jq select whole | `.pull_request == null and .user.login == \"github-actions[bot]\"` | `true` | `kit-update-check.test.mjs`: "the notice step opens one issue when behind and none is open" |
| 362 | jq select whole | `.pull_request == null and .user.login == \"github-actions[bot]\"` | `false` | `kit-update-check.test.mjs`: "the notice step updates the open notice instead of opening another" |
| 362 | jq select and operand | `.user.login == \"github-actions[bot]\"` | `true` | `kit-update-check.test.mjs`: "the notice step opens one issue when behind and none is open" |
| 362 | jq select and operand | `.body != null` | `true` | `kit-update-check.test.mjs`: "the notice step takes only a bot issue that starts with the marker, one without a body included" |
| 362 | jq select whole | `.body != null and (.body \| startswith(\"$marker\"))` | `true` | `kit-update-check.test.mjs`: "the notice step takes only a bot issue that starts with the marker, one without a body included" |
| 362 | jq select whole | `.body != null and (.body \| startswith(\"$marker\"))` | `false` | `kit-update-check.test.mjs`: "the notice step updates the open notice instead of opening another" |
| 362 | jq select and operand | `(.body \| startswith(\"$marker\"))` | `true` | `kit-update-check.test.mjs`: "the notice step takes only a bot issue that starts with the marker, one without a body included" |
| 364 | sh if whole | `[ "$STATE" = current ]` | `true` | `kit-update-check.test.mjs`: "the notice step opens one issue when behind and none is open" |
| 364 | sh if whole | `[ "$STATE" = current ]` | `false` | `kit-update-check.test.mjs`: "the notice step closes the open notice once current" |
| 365 | sh if whole | `[ -n "$open" ]` | `true` | `kit-update-check.test.mjs`: "the notice step leaves a look-alike alone and writes nothing when current" |
| 365 | sh if whole | `[ -n "$open" ]` | `false` | `kit-update-check.test.mjs`: "the notice step closes the open notice once current" |
| 366 | sh output statement | (before `gh api --method POST "repos/$REPO/issues/$open/comments" \`) | `: ` | `kit-update-check.test.mjs`: "the notice step closes the open notice once current" |
| 368 | sh output statement | (before `gh api --method PATCH "repos/$REPO/issues/$open" -f state=cl`) | `: ` | `kit-update-check.test.mjs`: "the notice step closes the open notice once current" |
| 371 | sh skip statement | `exit 0` | `:` | `kit-update-check.test.mjs`: "the notice step closes the open notice once current" |
| 384 | sh if whole | `[ -n "$open" ]` | `true` | `kit-update-check.test.mjs`: "the notice step opens one issue when behind and none is open" |
| 384 | sh if whole | `[ -n "$open" ]` | `false` | `kit-update-check.test.mjs`: "the notice step updates the open notice instead of opening another" |
| 385 | sh output statement | (before `gh api --method PATCH "repos/$REPO/issues/$open" -f title="$`) | `: ` | `kit-update-check.test.mjs`: "the notice step updates the open notice instead of opening another" |
| 388 | sh output statement | (before `gh api --method POST "repos/$REPO/issues" -f title="$title" `) | `: ` | `kit-update-check.test.mjs`: "the notice step opens one issue when behind and none is open" |

</details>

### `.github/workflows/pr-review.yml`, rows found in phase 3

72 rules: 72 caught (0 of them by a time limit), 0 left with the reason given.

<details><summary>Every rule of <code>.github/workflows/pr-review.yml</code></summary>

| Line | Kind | Rule | Switched off as | Caught by, or why not |
| --- | --- | --- | --- | --- |
| 100 | job output | `${{ steps.pass.outputs.KIT_REVIEW_MODE }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 101 | job output | `${{ steps.pass.outputs.KIT_REVIEW_PROVIDER }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 102 | job output | `${{ steps.pass.outputs.KIT_REVIEW_RUNNER }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 103 | job output | `${{ steps.pass.outputs.KIT_REVIEW_MODEL }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 104 | job output | `${{ steps.pass.outputs.KIT_REVIEW_EFFORT }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 105 | job output | `${{ steps.pass.outputs.KIT_REVIEW_MAX_TURNS }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 106 | job output | `${{ steps.pass.outputs.KIT_REVIEW_TIMEOUT_MINUTES }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 107 | job output | `${{ steps.pass.outputs.KIT_REVIEW_MAX_FILES }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 108 | job output | `${{ steps.pass.outputs.KIT_REVIEW_MAX_LINES }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 110 | job output | `${{ steps.pass.outputs.SKIP }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 151 | sh failure statement | `exit 1` | `:` | `kit-settings.test.mjs`: "a file that cannot be read fails the run instead of using the defaults" |
| 169 | sh failure statement | `exit 1` | `:` | `kit-settings.test.mjs`: "a --- is skipped only before the first setting" |
| 181 | sh failure statement | `exit 1` | `:` | `kit-settings.test.mjs`: "a line the kit does not read fails the run, naming the line but never printing it" |
| 185 | sh failure statement | `exit 1` | `:` | `kit-settings.test.mjs`: "a line the kit does not read fails the run, naming the line but never printing it" |
| 189 | sh failure statement | `exit 1` | `:` | `kit-settings.test.mjs`: "a line the kit does not read fails the run, naming the line but never printing it" |
| 211 | sh failure statement | `exit 1` | `:` | `kit-settings.test.mjs`: "a variable that is not one word fails before it reaches GITHUB_ENV" |
| 222 | sh failure statement | `exit 1` | `:` | `kit-settings.test.mjs`: "a switch takes only its states, so a typo fails instead of turning a workflow off" |
| 253 | sh failure statement | `exit 1` | `:` | `pr-review-step-rules.test.mjs`: "a number setting must be digits, at most six of them, and is written to GITHUB_ENV" |
| 264 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "pr-review.yml: the provider sets which model names the settings step takes" |
| 286 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "pr-review.yml: the provider sets which model names the settings step takes" |
| 290 | sh failure statement | `exit 1` | `:` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 320 | sh failure statement | `exit 1` | `:` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 325 | sh failure statement | `exit 1` | `:` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 340 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "pr-review.yml: the provider sets which model names the settings step takes" |
| 352 | sh failure statement | `exit 1` | `:` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 456 | sh failure statement | `return 1` | `:` | `pr-review-body-edit.test.mjs`: "an edit skip fails when it cannot list the runs or read a run's jobs" |
| 459 | sh failure statement | `return 1` | `:` | `pr-review-body-edit.test.mjs`: "an edit skip fails when it cannot list the runs or read a run's jobs" |
| 594 | sh failure statement | `exit 1` | `:` | `workflow-guards.test.mjs`: "pr-review.yml: the gate refuses an author or actor without write access" |
| 607 | sh failure statement | `exit 1` | `:` | `workflow-fail-closed.test.mjs`: "pr-review.yml: a settings job that failed fails the job after it" |
| 629 | sh failure statement | `exit 1` | `:` | `pr-review-steps.test.mjs`: "pr-review.yml: a dispatch checks out a pull request of this repository, and refuses a fork's before fetching it" |
| 633 | sh failure statement | `exit 1` | `:` | `pr-review-steps.test.mjs`: "pr-review.yml: a dispatch checks out a pull request of this repository, and refuses a fork's before fetching it" |
| 704 | sh failure statement | `exit 1` | `:` | `pr-review-rules.test.mjs`: "a first adoption whose server is a symlink is refused before root copies it" |
| 720 | sh failure statement | `exit 1` | `:` | `public-content-install.test.mjs`: "pr-review fails on a base check committed as a symlink" |
| 734 | sh failure statement | `exit 1` | `:` | `public-content-install.test.mjs`: "a check that fails on an empty text stops either workflow before the model runs" |
| 820 | sh failure statement | `return 1` | `:` | `pr-review-body-edit.test.mjs`: "an edit skip fails when it cannot list the runs or read a run's jobs" |
| 823 | sh failure statement | `return 1` | `:` | `pr-review-body-edit.test.mjs`: "an edit skip fails when it cannot list the runs or read a run's jobs" |
| 914 | sh failure statement | `return 1` | `:` | `pr-review-step-rules.test.mjs`: "the push skip fails when it cannot list the runs or read a run's jobs" |
| 917 | sh failure statement | `return 1` | `:` | `pr-review-step-rules.test.mjs`: "the push skip fails when it cannot list the runs or read a run's jobs" |
| 981 | sh failure statement | `exit 1` | `:` | `pr-review-steps.test.mjs`: "pr-review.yml: a pull request beyond the diff limits, or with files the checkout lacks, is refused" |
| 986 | sh failure statement | `exit 1` | `:` | `pr-review-steps.test.mjs`: "pr-review.yml: a pull request beyond the diff limits, or with files the checkout lacks, is refused" |
| 997 | sh failure statement | `exit 1` | `:` | `workflow-guards.test.mjs`: "pr-review.yml: a checkout whose git config references credentials fails the run" |
| 1074 | sh failure statement | `exit 1` | `:` | `workflow-fail-closed.test.mjs`: "pr-review.yml: the run stops before its settings without a head sha or a base branch" |
| 1077 | sh failure statement | `exit 1` | `:` | `workflow-fail-closed.test.mjs`: "pr-review.yml: the run stops before its settings without a head sha or a base branch" |
| 1212 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "pr-review.yml, Run the review: OpenCode Go without its key fails before the CLI starts" |
| 1226 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "pr-review.yml, Run the review: the Anthropic provider without its key fails before the CLI starts" |
| 1248 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "pr-review.yml, Run the review: a run that ends in error, or with no result, fails" |
| 1272 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "pr-review.yml, Run the review: a run closed on a private name withholds its last message and fails" |
| 1276 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "pr-review.yml, Run the review: a run that ends in error, or with no result, fails" |
| 1335 | sh failure statement | `exit 1` | `:` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: no key fails before the CLI starts" |
| 1386 | sh failure statement | `exit 1` | `:` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a model the pinned CLI does not list fails before the run" |
| 1388 | awk pattern whole | `$0 == want` | `1` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1388 | awk pattern whole | `$0 == want` | `0` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1388 | awk skip statement | `next` | `;` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1388 | awk pattern && operand | `on` | `1` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1388 | awk pattern whole | `on && /^[^ {}"]+\/[^ ]+$/` | `1` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1388 | awk pattern whole | `on && /^[^ {}"]+\/[^ ]+$/` | `0` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1388 | awk pattern && operand | `/^[^ {}"]+\/[^ ]+$/` | `1` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1388 | awk skip statement | `exit` | `;` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1388 | awk pattern whole | `on` | `1` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1388 | awk pattern whole | `on` | `0` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1388 | awk implicit print | (before `' "$RUNNER_TEMP/opencode-models")`) | ` {}` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1391 | sh failure statement | `exit 1` | `:` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a model the pinned CLI does not list fails before the run" |
| 1397 | sh failure statement | `exit 1` | `:` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: an effort level is a variant the model offers" |
| 1480 | awk implicit print | `1` | `0` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a closed run withholds its errors only when it had some, and a run with no events shows the log" |
| 1484 | sh failure statement | `exit 1` | `:` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a failed, unfinished or exhausted run fails the step" |
| 1507 | sh failure statement | `exit 1` | `:` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run closed on a private name withholds its message and log" |
| 1517 | awk implicit print | `1` | `0` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run that ends in error shows OpenCode's log, with commands stopped" |
| 1520 | sh failure statement | `exit 1` | `:` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a failed, unfinished or exhausted run fails the step" |
| 1524 | sh failure statement | `exit 1` | `:` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a failed, unfinished or exhausted run fails the step" |
| 1574 | sh failure statement | `exit 1` | `:` | `pr-review-steps.test.mjs`: "pr-review.yml: the run fails when it posted no report" |
| 1586 | sh failure statement | `exit 1` | `:` | `pr-review-steps.test.mjs`: "pr-review.yml: the run fails on a missing, doubled or malformed reviewed line" |
| 1624 | sh failure statement | `exit 1` | `:` | `pr-review-steps.test.mjs`: "pr-review.yml: the run fails when the reviewed lines do not describe the pull request" |

</details>

### `.github/workflows/security-scan.yml`, rows found in phase 3

98 rules: 95 caught (0 of them by a time limit, 12 through a copy of their step), 3 left with the reason given.

<details><summary>Every rule of <code>.github/workflows/security-scan.yml</code></summary>

| Line | Kind | Rule | Switched off as | Caught by, or why not |
| --- | --- | --- | --- | --- |
| 99 | job output | `${{ steps.pass.outputs.KIT_SECURITY_SCAN }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 100 | job output | `${{ steps.pass.outputs.KIT_SECURITY_PROVIDER }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 101 | job output | `${{ steps.pass.outputs.KIT_SECURITY_RUNNER }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 102 | job output | `${{ steps.pass.outputs.KIT_SECURITY_MODEL }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 103 | job output | `${{ steps.pass.outputs.KIT_SECURITY_EFFORT }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 104 | job output | `${{ steps.pass.outputs.KIT_SECURITY_MAX_TURNS }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 105 | job output | `${{ steps.pass.outputs.KIT_SECURITY_TIMEOUT_MINUTES }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 106 | job output | `${{ steps.pass.outputs.KIT_SECURITY_MAX_FILES }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 107 | job output | `${{ steps.pass.outputs.KIT_SECURITY_MAX_LINES }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 109 | job output | `${{ steps.pass.outputs.SKIP }}` | `''` | `kit-settings.test.mjs`: "each settings job hands on every value its pass step wrote" |
| 150 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 151, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 168 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 169, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 180 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 181, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 184 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 185, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 188 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 189, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 210 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 211, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 221 | sh failure statement | `exit 1` | `:` | its copy at `pr-review.yml` line 222, which "the five workflows run the same read step, over names it knows" holds to this step byte for byte |
| 253 | sh failure statement | `exit 1` | `:` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 264 | sh failure statement | `exit 1` | `:` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 277 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "security-scan.yml: the provider sets which model names the settings step takes" |
| 281 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "security-scan.yml: the provider sets which model names the settings step takes" |
| 297 | sh failure statement | `exit 1` | `:` | `security-scan.test.mjs`: "the settings step applies the defaults and refuses values out of range" |
| 333 | sh failure statement | `exit 1` | `:` | `scan-opencode.test.mjs`: "security-scan.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 338 | sh failure statement | `exit 1` | `:` | `scan-opencode.test.mjs`: "security-scan.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 355 | sh failure statement | `exit 1` | `:` | `kit-settings.test.mjs`: "a value out of range names where it came from" |
| 498 | sh failure statement | `exit 1` | `:` | `workflow-fail-closed.test.mjs`: "security-scan.yml: a settings job that failed fails the job after it" |
| 593 | sh failure statement | `exit 1` | `:` | `workflow-guards.test.mjs`: "security-scan.yml: the gate refuses an author or actor without write access" |
| 816 | awk implicit print | `1` | `0` | `security-scan-log-content.test.mjs`: "Run the scan: with a base check that passes it, the summary is printed with commands stopped" |
| 843 | sh failure statement | `exit 1` | `:` | `security-scan.test.mjs`: "the limits step refuses a large pull request and a checkout that misses files" |
| 850 | awk pattern && operand | `NF >= 2` | `1` | `security-scan.test.mjs`: "the limits step counts a rename's lines, not its paths" |
| 850 | awk pattern whole | `NF >= 2 && $1 ~ /^[0-9]+$/` | `1` | `security-scan.test.mjs`: "the limits step counts a rename's lines, not its paths" |
| 850 | awk pattern whole | `NF >= 2 && $1 ~ /^[0-9]+$/` | `0` | `security-scan.test.mjs`: "the limits step refuses a large pull request and a checkout that misses files" |
| 850 | awk pattern && operand | `$1 ~ /^[0-9]+$/` | `1` | `security-scan.test.mjs`: "the limits step counts a rename's lines, not its paths" |
| 850 | awk output statement | `print n + 0` | `;` | `security-scan.test.mjs`: "the limits step refuses a large pull request and a checkout that misses files" |
| 853 | sh failure statement | `exit 1` | `:` | `security-scan.test.mjs`: "the limits step refuses a large pull request and a checkout that misses files" |
| 857 | sh failure statement | `exit 1` | `:` | `security-scan.test.mjs`: "the limits step refuses a large pull request and a checkout that misses files" |
| 882 | sh failure statement | `exit 1` | `:` | `workflow-guards.test.mjs`: "security-scan.yml: a checkout whose git config references credentials fails the run" |
| 1068 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "security-scan.yml, Run the scan: OpenCode Go without its key fails before the CLI starts" |
| 1082 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "security-scan.yml, Run the scan: the Anthropic provider without its key fails before the CLI starts" |
| 1105 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "security-scan.yml, Run the scan: a run that ends in error, or with no result, fails" |
| 1121 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "security-scan.yml, Run the scan: a run that ends in error, or with no result, fails" |
| 1155 | sh failure statement | `exit 1` | `:` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the model and effort are checked before the server starts" |
| 1197 | sh failure statement | `exit 1` | `:` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the model and effort are checked before the server starts" |
| 1199 | awk pattern whole | `$0 == want` | `1` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1199 | awk pattern whole | `$0 == want` | `0` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1199 | awk skip statement | `next` | `;` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1199 | awk pattern && operand | `on` | `1` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1199 | awk pattern whole | `on && /^[^ {}"]+\/[^ ]+$/` | `1` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1199 | awk pattern whole | `on && /^[^ {}"]+\/[^ ]+$/` | `0` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1199 | awk pattern && operand | `/^[^ {}"]+\/[^ ]+$/` | `1` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1199 | awk skip statement | `exit` | `;` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1199 | awk pattern whole | `on` | `1` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1199 | awk pattern whole | `on` | `0` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1199 | awk implicit print | (before `' "$RUNNER_TEMP/opencode-models")`) | ` {}` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape" |
| 1202 | sh failure statement | `exit 1` | `:` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the model and effort are checked before the server starts" |
| 1206 | sh failure statement | `exit 1` | `:` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the model and effort are checked before the server starts" |
| 1227 | awk implicit print | `1` | `0` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a server that does not start shows its log, with commands stopped" |
| 1230 | sh failure statement | `exit 1` | `:` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a server that does not start shows its log, with commands stopped" |
| 1410 | sh group command | (before `echo "OpenCode's server log, its last 50 lines:"`) | `: ` | `scan-opencode.test.mjs`: "security-scan.yml, OpenCode runs: with a base check, the model's text and the server's log wait for the check" |
| 1411 | sh group command | (before `tail -n 50 "$RUNNER_TEMP/opencode-serve.log" \| awk 1`) | `: ` | `scan-opencode.test.mjs`: "security-scan.yml, OpenCode runs: with a base check, the model's text and the server's log wait for the check" |
| 1411 | awk implicit print | `1` | `0` | `scan-opencode.test.mjs`: "security-scan.yml, OpenCode runs: with a base check, the model's text and the server's log wait for the check" |
| 1415 | sh failure statement | `exit 1` | `:` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: an answer that is not JSON or does not fit the schema is asked for again" |
| 1426 | sh failure statement | `exit 1` | `:` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: the step limit counts the run's steps, not the asking again" |
| 1473 | sh failure statement | `exit 1` | `:` | `security-scan.test.mjs`: "the collect step refuses an answer that is not the schema's" |
| 1504 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "security-scan.yml, Verify the candidate findings: OpenCode Go without its key fails before the CLI starts" |
| 1518 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "security-scan.yml, Verify the candidate findings: the Anthropic provider without its key fails before the CLI starts" |
| 1541 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "security-scan.yml, Verify the candidate findings: a run that ends in error, or with no result, fails" |
| 1554 | sh failure statement | `exit 1` | `:` | `model-provider.test.mjs`: "security-scan.yml, Verify the candidate findings: a run that ends in error, or with no result, fails" |
| 1572 | sh failure statement | `exit 1` | `:` | its copy at `security-scan.yml` line 1155, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1614 | sh failure statement | `exit 1` | `:` | its copy at `security-scan.yml` line 1197, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1616 | awk pattern whole | `$0 == want` | `1` | `scan-opencode.test.mjs`: "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" |
| 1616 | awk pattern whole | `$0 == want` | `0` | `scan-opencode.test.mjs`: "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" |
| 1616 | awk skip statement | `next` | `;` | `scan-opencode.test.mjs`: "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" |
| 1616 | awk pattern && operand | `on` | `1` | `scan-opencode.test.mjs`: "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" |
| 1616 | awk pattern whole | `on && /^[^ {}"]+\/[^ ]+$/` | `1` | `scan-opencode.test.mjs`: "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" |
| 1616 | awk pattern whole | `on && /^[^ {}"]+\/[^ ]+$/` | `0` | `scan-opencode.test.mjs`: "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" |
| 1616 | awk pattern && operand | `/^[^ {}"]+\/[^ ]+$/` | `1` | `scan-opencode.test.mjs`: "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" |
| 1616 | awk skip statement | `exit` | `;` | `scan-opencode.test.mjs`: "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" |
| 1616 | awk pattern whole | `on` | `1` | `scan-opencode.test.mjs`: "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" |
| 1616 | awk pattern whole | `on` | `0` | `scan-opencode.test.mjs`: "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" |
| 1616 | awk implicit print | (before `' "$RUNNER_TEMP/opencode-models")`) | ` {}` | `scan-opencode.test.mjs`: "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" |
| 1619 | sh failure statement | `exit 1` | `:` | its copy at `security-scan.yml` line 1202, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1623 | sh failure statement | `exit 1` | `:` | its copy at `security-scan.yml` line 1206, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1644 | awk implicit print | `1` | `0` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a server that does not start shows its log, with commands stopped" |
| 1647 | sh failure statement | `exit 1` | `:` | `scan-opencode.test.mjs`: "security-scan.yml, Run the scan on OpenCode: a server that does not start shows its log, with commands stopped" |
| 1827 | sh group command | (before `echo "OpenCode's server log, its last 50 lines:"`) | `: ` | `scan-opencode.test.mjs`: "security-scan.yml, OpenCode runs: with a base check, the model's text and the server's log wait for the check" |
| 1828 | sh group command | (before `tail -n 50 "$RUNNER_TEMP/opencode-serve.log" \| awk 1`) | `: ` | `scan-opencode.test.mjs`: "security-scan.yml, OpenCode runs: with a base check, the model's text and the server's log wait for the check" |
| 1828 | awk implicit print | `1` | `0` | `scan-opencode.test.mjs`: "security-scan.yml, OpenCode runs: with a base check, the model's text and the server's log wait for the check" |
| 1832 | sh failure statement | `exit 1` | `:` | `scan-opencode.test.mjs`: "security-scan.yml, OpenCode runs: with a base check, the model's text and the server's log wait for the check" |
| 1843 | sh failure statement | `exit 1` | `:` | its copy at `security-scan.yml` line 1426, which "security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt" holds to this step byte for byte |
| 1898 | sh failure statement | `exit 1` | `:` | `security-scan.test.mjs`: "no candidates need no verification, and a malformed verification fails" |
| 2134 | awk pattern whole | `NR > 1` | `1` | Not a rule: the comma between the file names a message lists |
| 2134 | awk pattern whole | `NR > 1` | `0` | Not a rule: the comma between the file names a message lists |
| 2134 | awk output statement | `printf ", "` | `;` | Not a rule: the comma between the file names a message lists |
| 2134 | awk output statement | `printf "'%s'", $0` | `;` | `security-scan.test.mjs`: "the summary lists the kept findings, the verification's count and unread files" |
| 2175 | sh failure statement | `exit 1` | `:` | `security-scan.test.mjs`: "the run fails without a results file or a completed review in it" |
| 2179 | sh failure statement | `exit 1` | `:` | `security-scan.test.mjs`: "the run fails without a results file or a completed review in it" |
| 2264 | sh failure statement | `exit 1` | `:` | `workflow-fail-closed.test.mjs`: "security-scan.yml: a base that moved the pull request's diff after the scan records nothing" |

</details>

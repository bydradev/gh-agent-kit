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

**In short (phase 1):** of 1,068 rules, 1,028 are caught by a test, 10
of them by a time limit (the test never ends: an endless loop, or a
reply it waits for never comes). The 40 left are listed
with the reason:

| Reason | `pr-review.yml` | `mcp-server.mjs` |
| --- | --- | --- |
| Equivalent: switching it off changes nothing the code can do | 5 | 15 |
| Unreachable: no input reaches the other branch | 1 | 5 |
| Not a rule: a message's wording, a cache, or removing a scratch file | 4 | 4 |
| Left untested: runner provisioning only a GitHub runner can run | 6 | 0 |

The tests this phase added cover, among others: which events and states run each
pr-review job and step, as GitHub evaluates each `if:`; the report check's
fallback for a base server older than the run marker; the verdict's choice
of report; the open-mode push skip's filters; the server's start-up checks;
the git tools' argument checks; paging and body cuts; the vouch for a
`github-actions[bot]` issue (#100); file_issue's earlier-issue lookup; the
sweep's eligibility; and the JSON-RPC loop's replies.

## What counts as a rule

A rule is each operand of a condition that decides a failure, a skip, a
route or a written output (a label, verdict, comment, output, environment
variable or file). The wording of a log line or message is not one. In
practice, each of these is switched off on its own:

- **JavaScript** (the server): every `if`, `while`, `for` and `?:` test,
  forced to `true` and to `false`; every operand of an `&&` or `||` chain in
  such a test, or in an expression of comparisons and predicates, set to
  the value that makes it decide nothing (`true` under `&&`, `false` under
  `||`); every `continue` or `break`; and every statement that writes a
  file or the run's state (`fs.appendFileSync`, `fs.writeFileSync`,
  `fs.rmSync`, `record(...)`) or writes to GitHub, removed.
- **Workflows**: every job and step `if:`, forced to `true` and to `false`,
  and each operand of its `&&` and `||` chains, set as above.
- **Shell** (each step's `run:`, a command continued with `\` read as
  one line): every `if`, `elif` and `while` condition, forced to `true`
  and to `false`, and each operand of its `&&`, `||` and `[[ ]]` chains;
  the condition of a command list such as `[ -z "$x" ] && exit 1`; every
  `case` arm but `*)`, given a pattern nothing matches; each `and` and `or`
  operand of a jq `select()`, and each jq `if` and `elif` condition, forced
  to `true` and to `false`;
  every `continue`, `break`, `exit 0` and `return 0`; and every line that
  writes `GITHUB_OUTPUT` or `GITHUB_ENV`, removes or moves a file, or
  writes to GitHub (`gh issue`, `gh pr`, `gh label`, or a POST, PATCH, PUT
  or DELETE).

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

The `if:` tests use an evaluator in `tests/helpers/expression.mjs` that
follows the expressions reference for the forms `pr-review.yml` uses
(literals, comparisons, `!`, `&&`, `||`, property access, `contains`,
`startsWith`, `endsWith`, `fromJSON` and the status functions), not every
form GitHub accepts.

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
| `.github/workflows/pr-review.yml` | 526 | 510 | 16 |
| `.github/scripts/mcp-server.mjs` | 542 | 518 | 24 |

### `.github/workflows/pr-review.yml`

526 rules: 510 caught (4 of them by a time limit), 16 left with the reason given.

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
| 224 | sh output statement | (the line's start) | `: ` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
| 225 | sh output statement | (the line's start) | `: ` | `kit-settings.test.mjs`: "the file sets what no variable does, and a variable wins" |
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
| 255 | sh output statement | (the line's start) | `: ` | `pr-review-step-rules.test.mjs`: "a number setting must be digits, at most six of them, and is written to GITHUB_ENV" |
| 261 | sh list condition | `[ -n "$value" ]` | `true` | `pr-review-step-rules.test.mjs`: "a number setting must be digits, at most six of them, and is written to GITHUB_ENV" |
| 261 | sh list condition | `[ -n "$value" ]` | `false` | `model-provider.test.mjs`: "pr-review.yml: the provider sets which model names the settings step takes" |
| 262 | sh if whole | `! [[ "$value" =~ ^claude-[a-z0-9.-]+$ ]]` | `true` | `pr-review-step-rules.test.mjs`: "a number setting must be digits, at most six of them, and is written to GITHUB_ENV" |
| 262 | sh if whole | `! [[ "$value" =~ ^claude-[a-z0-9.-]+$ ]]` | `false` | `model-provider.test.mjs`: "pr-review.yml: the provider sets which model names the settings step takes" |
| 266 | sh output statement | (the line's start) | `: ` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 283 | sh list condition | `[ -n "$value" ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 283 | sh list condition | `[ -n "$value" ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 284 | sh if whole | `! [[ "$value" =~ ^[a-z0-9][a-z0-9.-]*$ ]]` | `true` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 284 | sh if whole | `! [[ "$value" =~ ^[a-z0-9][a-z0-9.-]*$ ]]` | `false` | `model-provider.test.mjs`: "pr-review.yml: the provider sets which model names the settings step takes" |
| 288 | sh if whole | `[[ "$value" == *-contributor ]]` | `true` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 288 | sh if whole | `[[ "$value" == *-contributor ]]` | `false` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 292 | sh output statement | (the line's start) | `: ` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
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
| 327 | sh output statement | (the line's start) | `: ` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 330 | sh case arm | `''\|anthropic` | `__mutant_never__` | `pr-review-step-rules.test.mjs`: "a number setting must be digits, at most six of them, and is written to GITHUB_ENV" |
| 331 | sh output statement | (the line's start) | `: ` | `model-provider.test.mjs`: "pr-review.yml: the provider sets which model names the settings step takes" |
| 334 | sh case arm | `opencode-go` | `__mutant_never__` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 335 | sh output statement | (the line's start) | `: ` | `model-provider.test.mjs`: "pr-review.yml: the provider sets which model names the settings step takes" |
| 338 | sh case arm | `*` | `__mutant_never__` | `model-provider.test.mjs`: "pr-review.yml: the provider sets which model names the settings step takes" |
| 350 | sh if && operand | `[ -n "$value" ]` | `true` | `pr-review-step-rules.test.mjs`: "a number setting must be digits, at most six of them, and is written to GITHUB_ENV" |
| 350 | sh if whole | `[ -n "$value" ] && ! [[ "$value" =~ ^(low\|medium\|high\|xhigh\|max)$ ]]` | `true` | `pr-review-step-rules.test.mjs`: "a number setting must be digits, at most six of them, and is written to GITHUB_ENV" |
| 350 | sh if whole | `[ -n "$value" ] && ! [[ "$value" =~ ^(low\|medium\|high\|xhigh\|max)$ ]]` | `false` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 350 | sh if && operand | `! [[ "$value" =~ ^(low\|medium\|high\|xhigh\|max)$ ]]` | `true` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
| 354 | sh output statement | (the line's start) | `: ` | `review-opencode.test.mjs`: "pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider" |
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
| 403 | jq select and operand | `.status != "completed"` | `true` | `pr-review-body-edit.test.mjs`: "the early skip goes ahead when only this run is in flight" |
| 404 | sh if whole | `[ "$busy" -eq 0 ]` | `true` | `pr-review-body-edit.test.mjs`: "a run in flight on the branch defers the early skip" |
| 404 | sh if whole | `[ "$busy" -eq 0 ]` | `false` | `pr-review-body-edit.test.mjs`: "the early skip goes ahead when only this run is in flight" |
| 406 | sh skip statement | `exit 0` | `:` | `pr-review-body-edit.test.mjs`: "the early skip goes ahead when only this run is in flight" |
| 412 | sh output statement | (the line's start) | `: ` | `pr-review-body-edit.test.mjs`: "a run in flight on the branch defers the early skip" |
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
| 456 | jq select and operand | `.status == \"completed\"` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 456 | jq select and operand | `.conclusion != \"skipped\"` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 456 | jq select and operand | `.id != $GITHUB_RUN_ID` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 460 | sh if whole | `[ "$conclusion" != skipped ]` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 460 | sh if whole | `[ "$conclusion" != skipped ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 462 | sh skip statement | `return 0` | `:` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 472 | jq select and operand | `.user.login == "github-actions[bot]"` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 472 | jq select and operand | `(.body \| contains("## Review R"))` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 492 | sh if \|\| operand | `[ -z "$reviewed" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 492 | sh if whole | `[ -z "$reviewed" ] \|\| [ -z "$base_reviewed" ] \|\| [ -z "$title_reviewed" ] \|\| [ -…` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 492 | sh if whole | `[ -z "$reviewed" ] \|\| [ -z "$base_reviewed" ] \|\| [ -z "$title_reviewed" ] \|\| [ -…` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 492 | sh if \|\| operand | `[ -z "$base_reviewed" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 492 | sh if \|\| operand | `[ -z "$title_reviewed" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 492 | sh if \|\| operand | `[ -z "$head_reviewed" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 494 | sh elif && operand | `[ "$head_reviewed" != "$HEAD" ]` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 494 | sh elif whole | `[ "$head_reviewed" != "$HEAD" ] && [ "$MODE" != "open" ]` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 494 | sh elif whole | `[ "$head_reviewed" != "$HEAD" ] && [ "$MODE" != "open" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 494 | sh elif && operand | `[ "$MODE" != "open" ]` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 496 | sh elif whole | `[ "$base_reviewed" != "$base_cmp at $base_now" ]` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 496 | sh elif whole | `[ "$base_reviewed" != "$base_cmp at $base_now" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 498 | sh elif whole | `[ "$title_reviewed" != "$title_now" ]` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 498 | sh elif whole | `[ "$title_reviewed" != "$title_now" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 500 | sh elif whole | `[ "$(printf '%s' "$reviewed" \| sed 's/^Closes reviewed:[[:space:]]*//' \| tr ',' …` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 500 | sh elif whole | `[ "$(printf '%s' "$reviewed" \| sed 's/^Closes reviewed:[[:space:]]*//' \| tr ',' …` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 509 | sh if whole | `[ "$head_reviewed" != "$HEAD" ]` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 509 | sh if whole | `[ "$head_reviewed" != "$HEAD" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 514 | sh if whole | `[ "$earlier" = "success" ]` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 514 | sh if whole | `[ "$earlier" = "success" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 515 | sh output statement | (the line's start) | `: ` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 527 | sh output statement | (the line's start) | `: ` | `pr-review-body-edit.test.mjs`: "the settings job passes the early skip on, and only a skip" |
| 529 | sh if whole | `[ "${RUN:-}" = false ]` | `true` | `pr-review-body-edit.test.mjs`: "the settings job passes the early skip on, and only a skip" |
| 529 | sh if whole | `[ "${RUN:-}" = false ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job passes the early skip on, and only a skip" |
| 530 | sh output statement | (the line's start) | `: ` | `pr-review-body-edit.test.mjs`: "the settings job passes the early skip on, and only a skip" |
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
| 639 | sh output statement | (the line's start) | `: ` | `pr-review-steps.test.mjs`: "pr-review.yml: a dispatch checks out a pull request of this repository, and refuses a fork's before fetching it" |
| 640 | sh output statement | (the line's start) | `: ` | `pr-review-steps.test.mjs`: "pr-review.yml: a dispatch checks out a pull request of this repository, and refuses a fork's before fetching it" |
| 686 | sh if whole | `git cat-file -e "origin/$BASE:$f" 2>/dev/null` | `true` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 686 | sh if whole | `git cat-file -e "origin/$BASE:$f" 2>/dev/null` | `false` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 690 | sh while whole | `[ "${rest#*/}" != "$rest" ]` | `true` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 690 | sh while whole | `[ "${rest#*/}" != "$rest" ]` | `false` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 692 | sh list condition | `[ -L "$dir" ]` | `false` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 692 | sh list condition | `[ -L "$dir" ]` | `true` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 692 | sh output statement | (the line's start) | `: ` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 694 | sh output statement | (the line's start) | `: ` | Not caught, equivalent: git checkout replaces a file, directory or symlink at the path itself (git 2.54, checked 2026-11-26), so the removal before it changes nothing |
| 699 | sh list condition | `git cat-file -e "origin/$BASE:$f" 2>/dev/null` | `true` | `pr-review-rules.test.mjs`: "the reviewer's rules and server come from the base, and no CLAUDE.md is left to load" |
| 699 | sh list condition | `git cat-file -e "origin/$BASE:$f" 2>/dev/null` | `false` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 699 | sh output statement | (the line's start) | `: ` | `pr-review-rules.test.mjs`: "the reviewer's rules and server come from the base, and no CLAUDE.md is left to load" |
| 702 | sh if whole | `[ -L "$p" ]` | `true` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 702 | sh if whole | `[ -L "$p" ]` | `false` | `pr-review-rules.test.mjs`: "a first adoption whose server is a symlink is refused before root copies it" |
| 717 | sh list condition | `[ -n "$entry" ]` | `true` | `pr-review-step-rules.test.mjs`: "a rule whose parent the head made a symlink is restored without touching the link's target" |
| 717 | sh list condition | `[ -n "$entry" ]` | `false` | `pr-review-step-rules.test.mjs`: "a base with both public-content checks installs only the Node one" |
| 719 | sh case arm | `100644\|100755` | `__mutant_never__` | `pr-review-step-rules.test.mjs`: "a base with both public-content checks installs only the Node one" |
| 720 | sh case arm | `*` | `__mutant_never__` | `public-content-install.test.mjs`: "pr-review fails on a base check committed as a symlink" |
| 729 | sh case arm | `*.py` | `__mutant_never__` | `public-content-install.test.mjs`: "pr-review takes a base's Python check" |
| 730 | sh case arm | `*` | `__mutant_never__` | `pr-review-step-rules.test.mjs`: "a base with both public-content checks installs only the Node one" |
| 732 | sh if whole | `! env -i PATH="$PATH" "${run[@]}" "$tmp" --text="$RUNNER_TEMP/public-content-emp…` | `true` | `pr-review-step-rules.test.mjs`: "a base with both public-content checks installs only the Node one" |
| 732 | sh if whole | `! env -i PATH="$PATH" "${run[@]}" "$tmp" --text="$RUNNER_TEMP/public-content-emp…` | `false` | `public-content-install.test.mjs`: "a check that fails on an empty text stops either workflow before the model runs" |
| 736 | sh output statement | (the line's start) | `: ` | Not a rule: removes a scratch file in RUNNER_TEMP, which the runner discards |
| 739 | sh output statement | (the line's start) | `: ` | Not a rule: removes a scratch copy in RUNNER_TEMP, which the runner discards |
| 740 | sh output statement | (the line's start) | `: ` | `pr-review-step-rules.test.mjs`: "a base with both public-content checks installs only the Node one" |
| 741 | sh skip statement | `break` | `:` | `pr-review-step-rules.test.mjs`: "a base with both public-content checks installs only the Node one" |
| 753 | sh output statement | (the line's start) | `: ` | `pr-review-rules.test.mjs`: "every symlink in the checkout is removed, a directory link inside it too" |
| 783 | if: && operand | `github.event.action == 'edited'` | `true` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 783 | if: whole | `github.event.action == 'edited' && github.event.changes.base == null && github.e…` | `true` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 783 | if: whole | `github.event.action == 'edited' && github.event.changes.base == null && github.e…` | `false` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 783 | if: && operand | `github.event.changes.base == null` | `true` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 783 | if: && operand | `github.event.changes.title == null` | `true` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 820 | jq select and operand | `.status == \"completed\"` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 820 | jq select and operand | `.conclusion != \"skipped\"` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 820 | jq select and operand | `.id != $GITHUB_RUN_ID` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 824 | sh if whole | `[ "$conclusion" != skipped ]` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 824 | sh if whole | `[ "$conclusion" != skipped ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 826 | sh skip statement | `return 0` | `:` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 836 | jq select and operand | `.user.login == "github-actions[bot]"` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 836 | jq select and operand | `(.body \| contains("## Review R"))` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 856 | sh if \|\| operand | `[ -z "$reviewed" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 856 | sh if whole | `[ -z "$reviewed" ] \|\| [ -z "$base_reviewed" ] \|\| [ -z "$title_reviewed" ] \|\| [ -…` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 856 | sh if whole | `[ -z "$reviewed" ] \|\| [ -z "$base_reviewed" ] \|\| [ -z "$title_reviewed" ] \|\| [ -…` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 856 | sh if \|\| operand | `[ -z "$base_reviewed" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 856 | sh if \|\| operand | `[ -z "$title_reviewed" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 856 | sh if \|\| operand | `[ -z "$head_reviewed" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 858 | sh elif && operand | `[ "$head_reviewed" != "$HEAD" ]` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 858 | sh elif whole | `[ "$head_reviewed" != "$HEAD" ] && [ "$MODE" != "open" ]` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 858 | sh elif whole | `[ "$head_reviewed" != "$HEAD" ] && [ "$MODE" != "open" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 858 | sh elif && operand | `[ "$MODE" != "open" ]` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 860 | sh elif whole | `[ "$base_reviewed" != "$base_cmp at $base_now" ]` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 860 | sh elif whole | `[ "$base_reviewed" != "$base_cmp at $base_now" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 862 | sh elif whole | `[ "$title_reviewed" != "$title_now" ]` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 862 | sh elif whole | `[ "$title_reviewed" != "$title_now" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 864 | sh elif whole | `[ "$(printf '%s' "$reviewed" \| sed 's/^Closes reviewed:[[:space:]]*//' \| tr ',' …` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 864 | sh elif whole | `[ "$(printf '%s' "$reviewed" \| sed 's/^Closes reviewed:[[:space:]]*//' \| tr ',' …` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 873 | sh if whole | `[ "$head_reviewed" != "$HEAD" ]` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 873 | sh if whole | `[ "$head_reviewed" != "$HEAD" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 878 | sh if whole | `[ "$earlier" = "success" ]` | `true` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 878 | sh if whole | `[ "$earlier" = "success" ]` | `false` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 879 | sh output statement | (the line's start) | `: ` | `pr-review-body-edit.test.mjs`: "the settings job's early copy is the review job's step, byte for byte" |
| 896 | if: && operand | `github.event.action == 'synchronize'` | `true` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 896 | if: whole | `github.event.action == 'synchronize' && env.KIT_REVIEW_MODE == 'open'` | `true` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 896 | if: whole | `github.event.action == 'synchronize' && env.KIT_REVIEW_MODE == 'open'` | `false` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 896 | if: && operand | `env.KIT_REVIEW_MODE == 'open'` | `true` | `pr-review-conditions.test.mjs`: "the review job's event steps run for their own events" |
| 914 | jq select and operand | `.status == \"completed\"` | `true` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 914 | jq select and operand | `.conclusion != \"skipped\"` | `true` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 914 | jq select and operand | `.id != $GITHUB_RUN_ID` | `true` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 918 | sh if whole | `[ "$conclusion" != skipped ]` | `true` | `kit-settings.test.mjs`: "a run whose review job was skipped does not stand for a review" |
| 918 | sh if whole | `[ "$conclusion" != skipped ]` | `false` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 920 | sh skip statement | `return 0` | `:` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 927 | jq select and operand | `.user.login == "github-actions[bot]"` | `true` | `pr-review-step-rules.test.mjs`: "the push skip reads the head only from the bot's reports, and reviews when there is none" |
| 927 | jq select and operand | `(.body \| contains("## Review R"))` | `true` | `pr-review-step-rules.test.mjs`: "the push skip reads the head only from the bot's reports, and reviews when there is none" |
| 929 | sh if whole | `[ -z "$last_head" ]` | `true` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 929 | sh if whole | `[ -z "$last_head" ]` | `false` | `pr-review-step-rules.test.mjs`: "the push skip reads the head only from the bot's reports, and reviews when there is none" |
| 931 | sh skip statement | `exit 0` | `:` | `pr-review-step-rules.test.mjs`: "the push skip reads the head only from the bot's reports, and reviews when there is none" |
| 934 | sh if whole | `[ "$earlier" = "success" ]` | `true` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 934 | sh if whole | `[ "$earlier" = "success" ]` | `false` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 935 | sh output statement | (the line's start) | `: ` | `pr-review-step-rules.test.mjs`: "the push skip counts only completed, unskipped runs other than this one" |
| 949 | if: whole | `env.RUN != 'false'` | `true` | `pr-review-conditions.test.mjs`: "every review step after the skips runs unless a skip set RUN to false" |
| 949 | if: whole | `env.RUN != 'false'` | `false` | `pr-review-conditions.test.mjs`: "every review step after the skips runs unless a skip set RUN to false" |
| 960 | sh output statement | (the line's start) | `: ` | `pr-review-step-rules.test.mjs`: "the verdict and start steps write what the later steps read" |
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
| 1024 | sh output statement | (the line's start) | `: ` | `pr-review-step-rules.test.mjs`: "the verdict and start steps write what the later steps read" |
| 1028 | sh output statement | (the line's start) | `: ` | `pr-review-step-rules.test.mjs`: "the verdict and start steps write what the later steps read" |
| 1058 | if: whole | `env.RUN != 'false'` | `true` | `pr-review-conditions.test.mjs`: "every review step after the skips runs unless a skip set RUN to false" |
| 1058 | if: whole | `env.RUN != 'false'` | `false` | `pr-review-conditions.test.mjs`: "every review step after the skips runs unless a skip set RUN to false" |
| 1074 | sh case arm | `*[!0-9a-f]*\|''` | `__mutant_never__` | `workflow-fail-closed.test.mjs`: "pr-review.yml: the run stops before its settings without a head sha or a base branch" |
| 1077 | sh list condition | `[ -n "$base" ]` | `true` | `workflow-fail-closed.test.mjs`: "pr-review.yml: the run stops before its settings without a head sha or a base branch" |
| 1077 | sh list condition | `[ -n "$base" ]` | `false` | `pr-review-step-rules.test.mjs`: "the settings step hands both runners the denied and allowed tool lists" |
| 1091 | sh if whole | `[ -n "${PUBLIC_CONTENT_CHECK:-}" ]` | `true` | `public-content-install.test.mjs`: "pr-review.yml: without a check the server's configuration is as before" |
| 1091 | sh if whole | `[ -n "${PUBLIC_CONTENT_CHECK:-}" ]` | `false` | `public-content-install.test.mjs`: "pr-review.yml: the server gets the check and a private file of the names, never the names inline" |
| 1095 | jq if whole | `$check == ""` | `true` | `public-content-install.test.mjs`: "pr-review.yml: the server gets the check and a private file of the names, never the names inline" |
| 1095 | jq if whole | `$check == ""` | `false` | `public-content-install.test.mjs`: "pr-review.yml: without a check the server's configuration is as before" |
| 1096 | sh output statement | (the line's start) | `: ` | `public-content-install.test.mjs`: "pr-review.yml: the server gets the check and a private file of the names, never the names inline" |
| 1097 | sh output statement | (the line's start) | `: ` | `pr-review-step-rules.test.mjs`: "the settings step hands both runners the denied and allowed tool lists" |
| 1098 | sh output statement | (the line's start) | `: ` | `pr-review-step-rules.test.mjs`: "the settings step hands both runners the denied and allowed tool lists" |
| 1117 | if: && operand | `env.RUN != 'false'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1117 | if: whole | `env.RUN != 'false' && env.KIT_REVIEW_RUNNER != 'opencode'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1117 | if: whole | `env.RUN != 'false' && env.KIT_REVIEW_RUNNER != 'opencode'` | `false` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1117 | if: && operand | `env.KIT_REVIEW_RUNNER != 'opencode'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1133 | sh output statement | (the line's start) | `: ` | Not a rule: removes the downloaded binary from RUNNER_TEMP after installing it |
| 1144 | if: && operand | `env.RUN != 'false'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1144 | if: whole | `env.RUN != 'false' && env.KIT_REVIEW_RUNNER == 'opencode'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1144 | if: whole | `env.RUN != 'false' && env.KIT_REVIEW_RUNNER == 'opencode'` | `false` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1144 | if: && operand | `env.KIT_REVIEW_RUNNER == 'opencode'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1146 | sh output statement | (the line's start) | `: ` | `review-opencode.test.mjs`: "pr-review.yml: the checkout's OpenCode configuration goes before OpenCode first runs" |
| 1155 | if: && operand | `env.RUN != 'false'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1155 | if: whole | `env.RUN != 'false' && env.KIT_REVIEW_RUNNER == 'opencode'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1155 | if: whole | `env.RUN != 'false' && env.KIT_REVIEW_RUNNER == 'opencode'` | `false` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1155 | if: && operand | `env.KIT_REVIEW_RUNNER == 'opencode'` | `true` | `pr-review-conditions.test.mjs`: "each runner's steps run only for that runner, and not after a skip" |
| 1167 | sh output statement | (the line's start) | `: ` | Not a rule: removes the downloaded archive from RUNNER_TEMP after installing it |
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
| 1246 | sh if whole | `[ ! -s "$RESULT" ]` | `true` | `pr-review-step-rules.test.mjs`: "the review step reads the last result from a stream that Claude Code wrote as an array" |
| 1246 | sh if whole | `[ ! -s "$RESULT" ]` | `false` | `model-provider.test.mjs`: "pr-review.yml, Run the review: a run that ends in error, or with no result, fails" |
| 1251 | jq if whole | `type == "array"` | `true` | `model-provider.test.mjs`: "pr-review.yml, Run the review: the effort level reaches the CLI, and none when unset" |
| 1251 | jq if whole | `type == "array"` | `false` | `pr-review-step-rules.test.mjs`: "the review step reads the last result from a stream that Claude Code wrote as an array" |
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
| 1290 | sh output statement | (the line's start) | `: ` | `review-opencode.test.mjs`: "pr-review.yml: .git leaves the checkout for OpenCode, the server still reads it, and it comes back" |
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
| 1423 | sh output statement | (the line's start) | `: ` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1431 | sh while whole | `:` | `true` | Not caught, equivalent: `while :` and `while true` are the same loop |
| 1431 | sh while whole | `:` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1433 | sh list condition | `oc "$run_config" run --print-logs --format json -m "opencode-go/$KIT_REVIEW_MODE…` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1433 | sh list condition | `oc "$run_config" run --print-logs --format json -m "opencode-go/$KIT_REVIEW_MODE…` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1442 | jq if whole | `. > 3600` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1442 | jq if whole | `. > 3600` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the waits grow 60, 120, 180 s, a served step starts the row again, and a named wait is longer or an hour at most" |
| 1446 | sh if \|\| operand | `[ -z "$pause" ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1446 | sh if whole | `[ -z "$pause" ] \|\| [ -z "$session" ] \|\| [ "$left" -le 0 ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1446 | sh if whole | `[ -z "$pause" ] \|\| [ -z "$session" ] \|\| [ "$left" -le 0 ]` | `false` | `review-opencode.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 1446 | sh if \|\| operand | `[ -z "$session" ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: another error, no session or no steps left end the run" |
| 1446 | sh if \|\| operand | `[ "$left" -le 0 ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: another error, no session or no steps left end the run" |
| 1447 | sh skip statement | `break` | `:` | `review-opencode.test.mjs`: the test never ends (an endless loop, or a reply it waits for never comes), caught by the time limit |
| 1450 | sh if whole | `[ "$(jq -s 'map(select(.type == "step_finish")) \| length' "$RUNNER_TEMP/opencode…` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the waits grow 60, 120, 180 s, a served step starts the row again, and a named wait is longer or an hour at most" |
| 1450 | sh if whole | `[ "$(jq -s 'map(select(.type == "step_finish")) \| length' "$RUNNER_TEMP/opencode…` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the waits grow 60, 120, 180 s, a served step starts the row again, and a named wait is longer or an hour at most" |
| 1455 | sh list condition | `[ "$pause" -le "$delay" ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the waits grow 60, 120, 180 s, a served step starts the row again, and a named wait is longer or an hour at most" |
| 1455 | sh list condition | `[ "$pause" -le "$delay" ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1457 | sh if whole | `[ "$delay" -gt "$remaining" ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1457 | sh if whole | `[ "$delay" -gt "$remaining" ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1459 | sh skip statement | `break` | `:` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session" |
| 1474 | sh if whole | `[ -z "$events" ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration" |
| 1474 | sh if whole | `[ -z "$events" ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a failed, unfinished or exhausted run fails the step" |
| 1475 | sh if whole | `[ "$closed" = true ]` | `true` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a closed run withholds its errors only when it had some, and a run with no events shows the log" |
| 1475 | sh if whole | `[ "$closed" = true ]` | `false` | `review-opencode.test.mjs`: "pr-review.yml, Run the review on OpenCode: a run closed on a private name withholds its message and log" |
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
| 1532 | sh output statement | (the line's start) | `: ` | `review-opencode.test.mjs`: "pr-review.yml: .git leaves the checkout for OpenCode, the server still reads it, and it comes back" |
| 1535 | if: whole | `always()` | `true` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1535 | if: whole | `always()` | `false` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1544 | if: whole | `env.RUN != 'false'` | `true` | `pr-review-conditions.test.mjs`: "every review step after the skips runs unless a skip set RUN to false" |
| 1544 | if: whole | `env.RUN != 'false'` | `false` | `pr-review-conditions.test.mjs`: "every review step after the skips runs unless a skip set RUN to false" |
| 1555 | jq select and operand | `.user.login == \"github-actions[bot]\"` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: the report check passes a report whose reviewed lines match the pull request" |
| 1555 | jq select and operand | `(.body \| contains(\"<!-- pr-review run $GITHUB_RUN_ID.$GITHUB_RUN_ATTEMPT -->\")…` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: the run fails when it posted no report" |
| 1555 | jq select and operand | `(.body \| contains(\"## Review R\"))` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: the run fails when it posted no report" |
| 1561 | sh if && operand | `[ -z "$reports" ]` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: a report with this run's marker counts whatever the server, and the current server allows no fallback" |
| 1561 | sh if whole | `[ -z "$reports" ] && ! grep -q 'GITHUB_RUN_ATTEMPT' /opt/agent-kit/mcp-server.mj…` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: the report check passes a report whose reviewed lines match the pull request" |
| 1561 | sh if whole | `[ -z "$reports" ] && ! grep -q 'GITHUB_RUN_ATTEMPT' /opt/agent-kit/mcp-server.mj…` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: with a base server that writes no marker, the report is the bot's first one after the start" |
| 1561 | sh if && operand | `! grep -q 'GITHUB_RUN_ATTEMPT' /opt/agent-kit/mcp-server.mjs` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: a report with this run's marker counts whatever the server, and the current server allows no fallback" |
| 1567 | sh list condition | `grep -q 'pr-review run' /opt/agent-kit/mcp-server.mjs` | `false` | `pr-review-steps.test.mjs`: "pr-review.yml: with a base server that writes the run id alone, the report must carry it" |
| 1567 | sh list condition | `grep -q 'pr-review run' /opt/agent-kit/mcp-server.mjs` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: with a base server that writes no marker, the report is the bot's first one after the start" |
| 1569 | jq select and operand | `.id > $LAST_COMMENT_ID` | `true` | `pr-review-steps.test.mjs`: "pr-review.yml: with a base server that writes no marker, the report is the bot's first one after the start" |
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
| 1701 | sh output statement | (the line's start) | `: ` | `pr-review-steps.test.mjs`: "pr-review.yml: the verdict check passes only on No blocking findings" |
| 1706 | if: && operand | `(failure() \|\| cancelled())` | `true` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1706 | if: whole | `(failure() \|\| cancelled()) && env.VERDICT_CHECK_ID != ''` | `true` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1706 | if: whole | `(failure() \|\| cancelled()) && env.VERDICT_CHECK_ID != ''` | `false` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1706 | if: \|\| operand | `failure()` | `false` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1706 | if: \|\| operand | `cancelled()` | `false` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1706 | if: && operand | `env.VERDICT_CHECK_ID != ''` | `true` | `pr-review-conditions.test.mjs`: "the clean-up steps run after a failure, and the verdict steps only on theirs" |
| 1714 | sh output statement | (the line's start) | `: ` | `pr-review-step-rules.test.mjs`: "a review that did not finish completes its pending verdict as action_required" |
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
| 1772 | sh output statement | (the line's start) | `: ` | `pr-review-no-verdict.test.mjs`: "an event by writers records no verdict on the event's head" |

</details>

### `.github/scripts/mcp-server.mjs`

542 rules: 518 caught (6 of them by a time limit), 24 left with the reason given.

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
| 295 | js output statement | `record({ closed: true });` | `void 0;` | `public-content-guard.test.mjs`: "a private name says nothing of where it was and closes the run's posts, across a new server" |
| 303 | js ternary test | `CONTENT_KINDS.has(kind)` | `true` | `public-content-guard.test.mjs`: "the check's own output never reaches the model, and it gets no token" |
| 303 | js ternary test | `CONTENT_KINDS.has(kind)` | `false` | `public-content-guard.test.mjs`: "post_report is refused, unposted, while the check finds something, and posts once reworded" |
| 306 | js if test | `found.length === 0` | `true` | `public-content-guard.test.mjs`: "post_report is refused, unposted, while the check finds something, and posts once reworded" |
| 306 | js if test | `found.length === 0` | `false` | `mcp-server-rules.test.mjs`: "with no private names configured, the public-content check gets no PRIVATE_REPO_NAMES at all, and no text is left on disk" |
| 310 | js ternary test | `found.length > CONTENT_SHOWN` | `true` | Not a rule: the wording of the refusal (an "and 0 more" tail); the post is refused either way |
| 310 | js ternary test | `found.length > CONTENT_SHOWN` | `false` | `public-content-guard.test.mjs`: "an exit 1 without a line the check names, and a long list of findings" |
| 316 | js output statement | `fs.rmSync(dir, { recursive: true, force: true });` | `void 0;` | `mcp-server-rules.test.mjs`: "with no private names configured, the public-content check gets no PRIVATE_REPO_NAMES at all, and no text is left on disk" |
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
| 478 | js if test | `raw.length < 100` | `true` | `mcp-server.test.mjs`: "range_diff finds the report that recorded an old_base on any page, reading no page past it" |
| 478 | js if test | `raw.length < 100` | `false` | `mcp-server.test.mjs`: "range_diff fetches only a commit a Claude report names as its base" |
| 480 | js if test | `!found` | `true` | `mcp-server.test.mjs`: "range_diff fetches an old_base a report recorded when the checkout lacks it" |
| 480 | js if test | `!found` | `false` | `mcp-server.test.mjs`: "range_diff fetches only a commit a Claude report names as its base" |
| 515 | js ternary test | `hasCommit(sha)` | `true` | Not caught, equivalent in practice: git fetch of a sha exits 0 only once it has the commit |
| 515 | js ternary test | `hasCommit(sha)` | `false` | `mcp-server.test.mjs`: "range_diff fetches an old_base a report recorded when the checkout lacks it" |
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
| 750 | js \|\| operand (expression) | `e.event === "labeled"` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for by the operator is shown by read_issue, search and issue" |
| 750 | js \|\| operand (expression) | `e.event === "unlabeled"` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for, then asked about by triage is withheld by read_issue, search and issue" |
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
| 764 | js if test | `later.some((e) => !(e.actor && e.actor.login === KIT_BOT))` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for by the operator is shown by read_issue, search and issue" |
| 764 | js if test | `later.some((e) => !(e.actor && e.actor.login === KIT_BOT))` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue planned by triage, then its needs-triage removed by a person is withheld by read_issue, search and issue" |
| 766 | js if test | `later.length` | `true` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for by the operator is shown by read_issue, search and issue" |
| 766 | js if test | `later.length` | `false` | `mcp-server-bot-issues.test.mjs`: "a github-actions[bot] issue vouched for, then asked about by triage is withheld by read_issue, search and issue" |
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
| 1097 | js ternary test | `nl === -1` | `true` | `mcp-server-rules.test.mjs`: "range_diff takes only text shas, and sees an old commit the base now holds as no change" |
| 1097 | js ternary test | `nl === -1` | `false` | Not caught, unreachable: git log --format=%H%n%B always puts a newline after the sha |
| 1099 | js ternary test | `/^[0-9a-f]{40}$/.test(sha)` | `true` | Not caught, unreachable: each entry git log -z --format=%H%n%B writes starts with a full sha |
| 1099 | js ternary test | `/^[0-9a-f]{40}$/.test(sha)` | `false` | `mcp-server-rules.test.mjs`: "range_diff takes only text shas, and sees an old commit the base now holds as no change" |
| 1100 | js ternary test | `nl === -1` | `true` | `mcp-server.test.mjs`: "range_diff shows the series when only commit messages changed" |
| 1100 | js ternary test | `nl === -1` | `false` | Not caught, unreachable: git log --format=%H%n%B always puts a newline after the sha |
| 1106 | js if test | `i === -1` | `true` | `mcp-server-rules.test.mjs`: "range_diff takes only text shas, and sees an old commit the base now holds as no change" |
| 1106 | js if test | `i === -1` | `false` | `mcp-server.test.mjs`: "range_diff shows the series when only commit messages changed" |
| 1111 | js if test | `sha === null` | `true` | `mcp-server-rules.test.mjs`: "range_diff takes only text shas, and sees an old commit the base now holds as no change" |
| 1111 | js if test | `sha === null` | `false` | Not caught, equivalent: git merge-base given no sha fails, which also answers not in the base |
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
| 1387 | js ternary test | `approvals.length` | `true` | `mcp-server-rules.test.mjs`: "info gives empty dates for an issue never approved, reopened or retitled" |
| 1387 | js ternary test | `approvals.length` | `false` | `mcp-server.test.mjs`: "info reports edited_after_approval true for an edit in the approval's second" |
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


// Which events and states run each issue-triage job and step: every if: in
// issue-triage.yml, evaluated as GitHub evaluates it, against cases that
// hold each of its conditions true and false while the others let it decide.
import assert from "node:assert/strict";
import test from "node:test";
import { ifOf, runs } from "./helpers/expression.mjs";

const FILE = "issue-triage.yml";

const person = { login: "dev", type: "User" };
const bot = { login: "github-actions[bot]", type: "Bot" };

// An issues event's context.
function issue({ action = "labeled", label = "needs-triage", user = person, state = "open", labels = [] } = {}) {
  return {
    github: {
      event_name: "issues",
      event: {
        action,
        label: action === "labeled" ? { name: label } : undefined,
        issue: { state, user, labels: labels.map((name) => ({ name })) },
      },
    },
  };
}

function check(where, cases) {
  const condition = ifOf(FILE, where);
  assert.notEqual(condition, "", `${JSON.stringify(where)} has an if:`);
  for (const [name, c, want] of cases) {
    assert.equal(
      runs(condition, c),
      want,
      `${where.job ?? where.step ?? where.uses}: ${name} should ${want ? "run" : "be skipped"}`,
    );
  }
}

test("the settings job runs on a sweep, a dispatch, and the issue events triage reads", () => {
  check({ job: "settings" }, [
    ["a sweep", { github: { event_name: "schedule" } }, true],
    ["a dispatch", { github: { event_name: "workflow_dispatch" } }, true],
    ["needs-triage added by a person", issue(), true],
    ["another label added", issue({ label: "bug" }), false],
    ["a closed issue", issue({ state: "closed" }), false],
    ["an issue opened without needs-triage", issue({ action: "opened" }), true],
    ["an issue opened with needs-triage", issue({ action: "opened", labels: ["needs-triage"] }), false],
    ["an issue opened with other labels", issue({ action: "opened", labels: ["bug"] }), true],
    ["an edit", issue({ action: "edited" }), true],
    ["a reopen", issue({ action: "reopened" }), true],
    ["another bot's issue", issue({ user: { login: "ci[bot]", type: "Bot" } }), false],
    ["another bot's issue, edited", issue({ action: "edited", user: { login: "ci[bot]", type: "Bot" } }), false],
    ["github-actions[bot]'s issue, needs-triage added", issue({ user: bot }), true],
    ["github-actions[bot]'s issue, edited", issue({ action: "edited", user: bot }), true],
    ["github-actions[bot]'s issue, another label added", issue({ user: bot, label: "bug" }), false],
    ["github-actions[bot]'s issue, opened", issue({ action: "opened", user: bot }), false],
    ["github-actions[bot]'s issue, reopened", issue({ action: "reopened", user: bot }), false],
  ]);
});

test("the settings are read, and the triage job runs, only while triage is on", () => {
  check({ step: "Read the triage settings" }, [
    ["on", { env: { KIT_ISSUE_TRIAGE: "on" } }, true],
    ["off", { env: { KIT_ISSUE_TRIAGE: "off" } }, false],
  ]);
  check({ job: "triage" }, [
    ["on", { needs: { settings: { outputs: { KIT_ISSUE_TRIAGE: "on" } } } }, true],
    ["off", { needs: { settings: { outputs: { KIT_ISSUE_TRIAGE: "off" } } } }, false],
    ["the settings job failed", { needs: { settings: { result: "failure", outputs: {} } }, status: "failure" }, false],
  ]);
});

test("the gate runs for one issue, and the steps after it unless it skipped", () => {
  check({ step: "Refuse an issue whose author, or an issue event whose actor, lacks write access" }, [
    ["one issue", { env: { TRIAGE_ISSUE: "7" } }, true],
    ["a sweep", { env: { TRIAGE_ISSUE: "" } }, false],
  ]);
  const gated = [
    { uses: "actions/checkout@" },
    { step: "Scope the bot's tools to this run" },
    { step: "Install the default branch's public-content check" },
    { step: "Write the model's settings and the MCP server's configuration" },
    { step: "Record when the run started" },
  ];
  for (const where of gated)
    check(where, [
      ["no gate (a sweep)", {}, true],
      ["the gate passed", { steps: { gate: { outputs: { skip: "false" } } } }, true],
      ["the gate skipped", { steps: { gate: { outputs: { skip: "true" } } } }, false],
    ]);
});

test("each runner installs and runs only its own CLI, unless the gate skipped", () => {
  const claude = ["Install subprocess isolation dependencies", "Install Claude Code", "Run the triage"];
  const opencode = [
    "Remove the checkout's OpenCode configuration",
    "Install OpenCode",
    "Hide .git and the checkout's symlinks from OpenCode",
    "Run the triage on OpenCode",
  ];
  for (const step of [...claude, ...opencode]) {
    const own = claude.includes(step) ? "claude-code" : "opencode";
    const other = own === "opencode" ? "claude-code" : "opencode";
    check({ step }, [
      ["its runner", { env: { KIT_TRIAGE_RUNNER: own } }, true],
      ["the other runner", { env: { KIT_TRIAGE_RUNNER: other } }, false],
      ["its runner, gate skipped", { env: { KIT_TRIAGE_RUNNER: own }, steps: { gate: { outputs: { skip: "true" } } } }, false],
    ]);
  }
});

test("the clean-up steps run even after a failure, unless the gate skipped", () => {
  const skipped = { gate: { outputs: { skip: "true" } } };
  check({ step: "Put .git back in the checkout" }, [
    ["OpenCode", { env: { KIT_TRIAGE_RUNNER: "opencode" } }, true],
    ["OpenCode after a failure", { env: { KIT_TRIAGE_RUNNER: "opencode" }, status: "failure" }, true],
    ["OpenCode, cancelled", { env: { KIT_TRIAGE_RUNNER: "opencode" }, status: "cancelled" }, true],
    ["Claude Code", { env: { KIT_TRIAGE_RUNNER: "claude-code" } }, false],
    ["OpenCode, gate skipped", { env: { KIT_TRIAGE_RUNNER: "opencode" }, steps: skipped }, false],
  ]);
  check({ step: "Remove the token file" }, [
    ["a success", {}, true],
    ["a failure", { status: "failure" }, true],
    ["gate skipped", { steps: skipped }, false],
  ]);
});

test("the state check runs for one issue, and the sweep's steps for a sweep", () => {
  check({ step: "Fail when the run left the issue in the wrong state" }, [
    ["one issue", { env: { TRIAGE_ISSUE: "7" } }, true],
    ["a sweep", { env: { TRIAGE_ISSUE: "" } }, false],
    ["one issue, gate skipped", { env: { TRIAGE_ISSUE: "7" }, steps: { gate: { outputs: { skip: "true" } } } }, false],
    ["one issue, after a failure", { env: { TRIAGE_ISSUE: "7" }, status: "failure" }, false],
  ]);
  for (const step of ["List the issues a sweep dispatches", "Fail when the sweep left an eligible issue undispatched"])
    check({ step }, [
      ["a sweep", { env: { TRIAGE_ISSUE: "" } }, true],
      ["one issue", { env: { TRIAGE_ISSUE: "7" } }, false],
      ["a sweep after a failure", { env: { TRIAGE_ISSUE: "" }, status: "failure" }, false],
    ]);
  check({ step: "Pass the sweep's dispatches on" }, [
    ["a sweep", { env: { TRIAGE_ISSUE: "" } }, true],
    ["a sweep after a failure", { env: { TRIAGE_ISSUE: "" }, status: "failure" }, true],
    ["a cancelled sweep", { env: { TRIAGE_ISSUE: "" }, status: "cancelled" }, false],
    ["one issue", { env: { TRIAGE_ISSUE: "7" } }, false],
  ]);
});

test("the dispatch job runs when the sweep passed issues on, even after a failure", () => {
  const triage = (dispatch, status) => ({ needs: { triage: { outputs: { dispatch } } }, status });
  check({ job: "dispatch" }, [
    ["issues passed on", triage("3 5"), true],
    ["issues passed on, the triage job failed", triage("3 5", "failure"), true],
    ["none", triage(""), false],
    ["cancelled", triage("3 5", "cancelled"), false],
  ]);
});

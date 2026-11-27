// Which events and states run each security-scan job and step: every if: in
// security-scan.yml, evaluated as GitHub evaluates it, against cases that
// hold each of its conditions true and false while the others let it decide.
import assert from "node:assert/strict";
import test from "node:test";
import { ifOf, runs } from "./helpers/expression.mjs";

const FILE = "security-scan.yml";

const pr = (over = {}) => ({
  draft: false,
  head: { repo: { full_name: "o/r" } },
  user: { login: "dev", type: "User" },
  ...over,
});

// A pull request event's context; over replaces whole top-level parts.
function ctx({ action = "opened", changes = null, pull = pr(), github = {}, env = {}, ...rest } = {}) {
  return {
    github: {
      event_name: "pull_request",
      repository: "o/r",
      head_ref: "fix/1-x",
      run_attempt: "1",
      event: { action, pull_request: pull, changes },
      ...github,
    },
    env: { KIT_SECURITY_SCAN: "push", KIT_SECURITY_RUNNER: "claude-code", ...env },
    ...rest,
  };
}
const body = { body: { from: "old" } };
const base = { base: { ref: { from: "dev" } } };

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

test("the settings job runs for same-repository, non-draft pull requests by people", () => {
  check({ job: "settings" }, [
    ["an opened pull request", ctx(), true],
    ["a draft", ctx({ pull: pr({ draft: true }) }), false],
    ["a fork's head", ctx({ pull: pr({ head: { repo: { full_name: "fork/r" } } }) }), false],
    ["Dependabot's", ctx({ pull: pr({ user: { login: "dependabot[bot]", type: "Bot" } }) }), false],
    [
      "Release Please's",
      ctx({
        github: { head_ref: "release-please--branches--main" },
        pull: pr({ user: { login: "rp[bot]", type: "Bot" } }),
      }),
      false,
    ],
    ["a person's release-please-- branch", ctx({ github: { head_ref: "release-please--x" } }), true],
    ["a bot's other branch", ctx({ pull: pr({ user: { login: "x[bot]", type: "Bot" } }) }), true],
  ]);
});

test("the scan settings are read only while the scan is on", () => {
  check({ step: "Read the scan settings" }, [
    ["push mode", ctx(), true],
    ["open mode", ctx({ env: { KIT_SECURITY_SCAN: "open" } }), true],
    ["the scan off", ctx({ env: { KIT_SECURITY_SCAN: "off" } }), false],
  ]);
});

test("the early skip looks at a body or title edit, and at a push in open mode, on a first attempt", () => {
  const open = { KIT_SECURITY_SCAN: "open" };
  check({ step: "Skip an edit or a push that a recorded scan already covers, before the scan job" }, [
    ["a body edit in push mode", ctx({ action: "edited", changes: body }), true],
    ["a body edit in open mode", ctx({ action: "edited", changes: body, env: open }), true],
    ["a body edit with the scan off", ctx({ action: "edited", changes: body, env: { KIT_SECURITY_SCAN: "off" } }), false],
    ["a body edit on a re-run", ctx({ action: "edited", changes: body, github: { run_attempt: "2" } }), false],
    ["a base change", ctx({ action: "edited", changes: base }), false],
    ["a push in open mode", ctx({ action: "synchronize", env: open }), true],
    ["a push in push mode", ctx({ action: "synchronize" }), false],
    ["an opened pull request", ctx({ env: open }), false],
  ]);
});

test("the scan job runs while the scan is on and the early skip found something, and when the settings failed", () => {
  const settings = (result, outputs = {}) => ({ settings: { result, outputs } });
  check({ job: "security" }, [
    ["push mode", { needs: settings("success", { KIT_SECURITY_SCAN: "push" }) }, true],
    ["open mode", { needs: settings("success", { KIT_SECURITY_SCAN: "open" }) }, true],
    ["the scan off", { needs: settings("success", { KIT_SECURITY_SCAN: "off" }) }, false],
    ["the early skip", { needs: settings("success", { KIT_SECURITY_SCAN: "push", SKIP: "true" }) }, false],
    ["the settings job failed", { needs: settings("failure"), status: "failure" }, true],
    ["a cancelled run", { needs: settings("success", { KIT_SECURITY_SCAN: "push" }), status: "cancelled" }, false],
  ]);
  check({ step: "Fail when the settings job failed" }, [
    ["the settings job failed", { needs: settings("failure") }, true],
    ["the settings job passed", { needs: settings("success") }, false],
  ]);
});

test("the scan job's skip looks at a body or title edit, and at a push in open mode", () => {
  check({ step: "Skip an edit or a push that a recorded scan already covers" }, [
    ["a body edit", ctx({ action: "edited", changes: body }), true],
    ["a base change", ctx({ action: "edited", changes: base }), false],
    ["a push in open mode", ctx({ action: "synchronize", env: { KIT_SECURITY_SCAN: "open" } }), true],
    ["a push in push mode", ctx({ action: "synchronize" }), false],
    ["an opened pull request in open mode", ctx({ env: { KIT_SECURITY_SCAN: "open" } }), false],
  ]);
});

test("each step after the skip runs unless the skip set RUN to false", () => {
  const where = [
    { step: "Refuse a pull request event from an author or actor without write access" },
    { uses: "actions/checkout@" },
    { step: "Remove executable Claude configuration from the checkout" },
    { step: "Use the base branch's scan rules" },
    { step: "Find the base's public-content check" },
    { step: "Refuse pull requests beyond the scan's limits" },
    { step: "Remove the checkout's symlinks" },
    { step: "Verify the checkout holds no credentials" },
    { step: "Write the scan's inputs and the model's settings" },
    { step: "Collect the scan's candidate findings" },
    { step: "Apply the verification" },
    { step: "Fail when the scan did not run" },
    { step: "Comment on the findings' lines" },
    { step: "Record the completed scan" },
  ];
  for (const w of where)
    check(w, [
      ["no skip", ctx(), true],
      ["RUN true", ctx({ env: { RUN: "true" } }), true],
      ["the skip", ctx({ env: { RUN: "false" } }), false],
    ]);
});

test("each runner installs and runs only its own CLI", () => {
  const claude = [
    "Install subprocess isolation dependencies",
    "Install Claude Code",
    "Run the scan",
  ];
  const opencode = [
    "Remove the checkout's OpenCode configuration",
    "Install OpenCode",
    "Move .git out of the checkout for OpenCode",
    "Run the scan on OpenCode",
  ];
  for (const step of [...claude, ...opencode]) {
    const own = claude.includes(step) ? "claude-code" : "opencode";
    const other = own === "opencode" ? "claude-code" : "opencode";
    check({ step }, [
      ["its runner", ctx({ env: { KIT_SECURITY_RUNNER: own } }), true],
      ["the other runner", ctx({ env: { KIT_SECURITY_RUNNER: other } }), false],
      ["its runner after the skip", ctx({ env: { KIT_SECURITY_RUNNER: own, RUN: "false" } }), false],
    ]);
  }
});

test("a verification runs on its runner only when the scan found candidates", () => {
  for (const [step, own, other] of [
    ["Verify the candidate findings", "claude-code", "opencode"],
    ["Verify the candidate findings on OpenCode", "opencode", "claude-code"],
  ])
    check({ step }, [
      ["3 candidates", ctx({ env: { KIT_SECURITY_RUNNER: own, CANDIDATES: "3" } }), true],
      ["none", ctx({ env: { KIT_SECURITY_RUNNER: own, CANDIDATES: "0" } }), false],
      ["no count", ctx({ env: { KIT_SECURITY_RUNNER: own, CANDIDATES: "" } }), false],
      ["the other runner", ctx({ env: { KIT_SECURITY_RUNNER: other, CANDIDATES: "3" } }), false],
      ["after the skip", ctx({ env: { KIT_SECURITY_RUNNER: own, CANDIDATES: "3", RUN: "false" } }), false],
    ]);
});

test("the log, hold and summary steps run after either runner's step, even when it failed", () => {
  const steps = (a, b) => ({ scan: { outcome: a }, scan_opencode: { outcome: b }, verify: { outcome: a }, verify_opencode: { outcome: b } });
  for (const step of [
    "Print the scan run's log",
    "Hold the findings to the base's public-content check",
    "Summarise the scan's findings",
    "Print the verification run's log",
  ])
    check({ step }, [
      ["Claude Code's step ran", ctx({ steps: steps("success", "skipped") }), true],
      ["OpenCode's step ran", ctx({ steps: steps("skipped", "success") }), true],
      ["Claude Code's step failed", ctx({ steps: steps("failure", "skipped"), status: "failure" }), true],
      ["neither ran", ctx({ steps: steps("skipped", "skipped") }), false],
      ["after the skip", ctx({ steps: steps("success", "skipped"), env: { RUN: "false" } }), false],
    ]);
});

test(".git comes back for OpenCode, even after a failure", () => {
  check({ step: "Put .git back in the checkout" }, [
    ["OpenCode", ctx({ env: { KIT_SECURITY_RUNNER: "opencode" } }), true],
    ["OpenCode after a failure", ctx({ env: { KIT_SECURITY_RUNNER: "opencode" }, status: "failure" }), true],
    ["OpenCode after the skip", ctx({ env: { KIT_SECURITY_RUNNER: "opencode", RUN: "false" } }), true],
    ["Claude Code", ctx(), false],
  ]);
});

test("the not-completed record is written only when the job failed or was cancelled", () => {
  check({ step: "Record that the scan did not complete" }, [
    ["a failure", ctx({ status: "failure" }), true],
    ["a cancel", ctx({ status: "cancelled" }), true],
    ["a success", ctx(), false],
  ]);
});

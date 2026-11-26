// Which events and states run each pr-review job and step: every if: in
// pr-review.yml, evaluated as GitHub evaluates it, against cases that hold
// each of its conditions true and false while the others let it decide.
import assert from "node:assert/strict";
import test from "node:test";
import { ifOf, runs } from "./helpers/expression.mjs";

const FILE = "pr-review.yml";

const pr = (over = {}) => ({
  draft: false,
  head: { repo: { full_name: "o/r" } },
  user: { login: "dev", type: "User" },
  ...over,
});

// A pull request event's context; over replaces whole top-level parts.
function ctx({
  action = "opened",
  changes = null,
  pull = pr(),
  github = {},
  env = {},
  ...rest
} = {}) {
  return {
    github: {
      event_name: "pull_request",
      repository: "o/r",
      head_ref: "fix/1-x",
      run_attempt: "1",
      event: { action, pull_request: pull, changes },
      ...github,
    },
    env: { KIT_REVIEW_MODE: "push", RUN: "true", KIT_REVIEW_RUNNER: "claude-code", ...env },
    ...rest,
  };
}
const dispatch = (over = {}) =>
  ctx({ github: { event_name: "workflow_dispatch", event: { inputs: { pr: "5" } } }, ...over });
const body = { body: { from: "old" } };

function check(where, cases) {
  const condition = ifOf(FILE, where);
  assert.notEqual(condition, "", `${JSON.stringify(where)} has an if:`);
  for (const [name, c, want] of cases) {
    assert.equal(
      runs(condition, c),
      want,
      `${where.job ?? where.step}: ${name} should ${want ? "run" : "be skipped"}`,
    );
  }
}

test("the settings job runs for same-repository, non-draft pull requests by people, and for a dispatch", () => {
  check({ job: "settings" }, [
    ["an opened pull request", ctx(), true],
    ["a dispatch", dispatch(), true],
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
    [
      "a person's release-please-- branch",
      ctx({ github: { head_ref: "release-please--x" } }),
      true,
    ],
    ["a bot's other branch", ctx({ pull: pr({ user: { login: "x[bot]", type: "Bot" } }) }), true],
    ["a body edit", ctx({ action: "edited", changes: body }), true],
    ["a base change", ctx({ action: "edited", changes: { base: { ref: { from: "dev" } } } }), true],
    ["a title change", ctx({ action: "edited", changes: { title: { from: "old" } } }), true],
    ["an edit that changed none of them", ctx({ action: "edited", changes: {} }), false],
  ]);
});

test("the review job runs after the settings job failed or chose a mode that reviews, and not once cancelled", () => {
  const needs = (result, outputs, status = "success") => ({
    status,
    needs: { settings: { result, outputs } },
  });
  check({ job: "review" }, [
    ["the settings job failed", needs("failure", {}), true],
    ["the run was cancelled", needs("failure", {}, "cancelled"), false],
    ["mode push", needs("success", { SKIP: "", KIT_REVIEW_MODE: "push" }), true],
    ["mode open", needs("success", { SKIP: "", KIT_REVIEW_MODE: "open" }), true],
    ["mode off", needs("success", { SKIP: "", KIT_REVIEW_MODE: "off" }), false],
    ["the early skip", needs("success", { SKIP: "true", KIT_REVIEW_MODE: "push" }), false],
  ]);
});

test("the settings job reads the review settings only in a mode that reviews", () => {
  check({ step: "Read the review settings" }, [
    ["push", ctx(), true],
    ["open", ctx({ env: { KIT_REVIEW_MODE: "open" } }), true],
    ["off", ctx({ env: { KIT_REVIEW_MODE: "off" } }), false],
  ]);
});

const earlyEdit = (over = {}) => ctx({ action: "edited", changes: body, ...over });
const earlySkipCases = [
  ["a first-attempt body edit in mode push", earlyEdit(), true],
  ["the same in mode open", earlyEdit({ env: { KIT_REVIEW_MODE: "open" } }), true],
  ["mode off", earlyEdit({ env: { KIT_REVIEW_MODE: "off" } }), false],
  ["an opened pull request", ctx(), false],
  [
    "an edit that changed the base",
    earlyEdit({ changes: { ...body, base: { ref: { from: "dev" } } } }),
    false,
  ],
  [
    "an edit that changed the title",
    earlyEdit({ changes: { ...body, title: { from: "old" } } }),
    false,
  ],
  ["a re-run", earlyEdit({ github: { run_attempt: "2" } }), false],
];

test("the early skip's in-flight check runs only for a first-attempt edit of the body alone", () => {
  check({ step: "Defer the early skip while another review is in flight" }, earlySkipCases);
});

test("the early skip runs only when the in-flight check succeeded and did not defer", () => {
  const ok = { steps: { inflight: { outcome: "success" } } };
  check({ step: "Skip a body edit that changed no closing reference, before the review job" }, [
    ...earlySkipCases.map(([n, c, w]) => [n, { ...c, ...ok }, w]),
    [
      "the in-flight check failed",
      { ...earlyEdit(), steps: { inflight: { outcome: "failure" } } },
      false,
    ],
    ["a review in flight deferred it", { ...earlyEdit({ env: { DEFER: "true" } }), ...ok }, false],
  ]);
});

test("the review job's event steps run for their own events", () => {
  check({ step: "Refuse a pull request event from an author or actor without write access" }, [
    ["a pull request event", ctx(), true],
    ["a dispatch", dispatch(), false],
  ]);
  check({ step: "Fail when the settings job failed" }, [
    ["the settings job failed", { ...ctx(), needs: { settings: { result: "failure" } } }, true],
    ["it succeeded", { ...ctx(), needs: { settings: { result: "success" } } }, false],
  ]);
  check({ step: "Check out the pull request head (dispatch only)" }, [
    ["a dispatch", dispatch(), true],
    ["a pull request event", ctx(), false],
  ]);
  check({ step: "Skip a body edit that changed no closing reference" }, [
    ["a body edit", ctx({ action: "edited", changes: body }), true],
    [
      "an edit that changed the base",
      ctx({ action: "edited", changes: { base: { ref: { from: "dev" } } } }),
      false,
    ],
    [
      "an edit that changed the title",
      ctx({ action: "edited", changes: { title: { from: "old" } } }),
      false,
    ],
    ["an opened pull request", ctx(), false],
  ]);
  check({ step: 'Skip a push in mode "open" once a review succeeded' }, [
    ["a push in mode open", ctx({ action: "synchronize", env: { KIT_REVIEW_MODE: "open" } }), true],
    ["a push in mode push", ctx({ action: "synchronize" }), false],
    ["a reopen in mode open", ctx({ action: "reopened", env: { KIT_REVIEW_MODE: "open" } }), false],
  ]);
});

test("every review step after the skips runs unless a skip set RUN to false", () => {
  for (const step of [
    "Mark the verdict pending",
    "Refuse pull requests beyond GitHub's diff limits",
    "Record when the review started",
    "Write the model's settings and the MCP server's configuration",
    "Fail when no review report was posted",
    "Record the verdict as a check run",
  ]) {
    check({ step }, [
      ["no skip", ctx({ env: { RUN: "" } }), true],
      ["a skip", ctx({ env: { RUN: "false" } }), false],
    ]);
  }
});

test("each runner's steps run only for that runner, and not after a skip", () => {
  const claude = [
    "Install subprocess isolation dependencies",
    "Install Claude Code",
    "Run the review",
  ];
  const opencode = [
    "Remove the checkout's OpenCode configuration",
    "Install OpenCode",
    "Move .git out of the checkout for OpenCode",
    "Run the review on OpenCode",
  ];
  for (const step of claude)
    check({ step }, [
      ["Claude Code", ctx(), true],
      ["OpenCode", ctx({ env: { KIT_REVIEW_RUNNER: "opencode" } }), false],
      ["a skip", ctx({ env: { RUN: "false" } }), false],
    ]);
  for (const step of opencode)
    check({ step }, [
      ["OpenCode", ctx({ env: { KIT_REVIEW_RUNNER: "opencode" } }), true],
      ["Claude Code", ctx(), false],
      ["a skip", ctx({ env: { RUN: "false", KIT_REVIEW_RUNNER: "opencode" } }), false],
    ]);
});

test("the clean-up steps run after a failure, and the verdict steps only on theirs", () => {
  check({ step: "Put .git back in the checkout" }, [
    [
      "OpenCode, after a failure",
      { ...ctx({ env: { KIT_REVIEW_RUNNER: "opencode" } }), status: "failure" },
      true,
    ],
    ["Claude Code", { ...ctx(), status: "failure" }, false],
  ]);
  check({ step: "Remove the token file" }, [
    ["after a failure", { ...ctx(), status: "failure" }, true],
    ["after a cancel", { ...ctx(), status: "cancelled" }, true],
  ]);
  check({ step: "Close the pending verdict when the review did not finish" }, [
    [
      "a failure with a pending verdict",
      { ...ctx({ env: { VERDICT_CHECK_ID: "9" } }), status: "failure" },
      true,
    ],
    [
      "a cancel with a pending verdict",
      { ...ctx({ env: { VERDICT_CHECK_ID: "9" } }), status: "cancelled" },
      true,
    ],
    ["a success", ctx({ env: { VERDICT_CHECK_ID: "9" } }), false],
    [
      "a failure before the verdict was pending",
      { ...ctx({ env: { VERDICT_CHECK_ID: "" } }), status: "failure" },
      false,
    ],
  ]);
  check({ step: "Record no verdict when the review failed before it was pending" }, [
    [
      "a failure before the verdict was pending",
      { ...ctx({ env: { VERDICT_CHECK_ID: "" } }), status: "failure" },
      true,
    ],
    ["a success", ctx({ env: { VERDICT_CHECK_ID: "" } }), false],
    [
      "a failure with a pending verdict",
      { ...ctx({ env: { VERDICT_CHECK_ID: "9" } }), status: "failure" },
      false,
    ],
    [
      "a failure after a skip",
      { ...ctx({ env: { VERDICT_CHECK_ID: "", RUN: "false" } }), status: "failure" },
      false,
    ],
  ]);
});

test("the evaluator reads expressions as GitHub does", () => {
  assert.equal(runs("'ABC' == 'abc'", {}), true);
  assert.equal(runs("github.run_attempt == 1", { github: { run_attempt: "1" } }), true);
  assert.equal(runs("null == 0", {}), true);
  assert.equal(runs("'x' == 0", {}), false);
  assert.equal(runs("env.X", { env: { X: "0" } }), true);
  assert.equal(runs("true", { status: "failure" }), false);
  assert.equal(runs("always()", { status: "failure" }), true);
  assert.equal(runs("${{ !cancelled() }}", { status: "failure" }), true);
  assert.equal(runs("startsWith('Release-Please--x', 'release-please--')", {}), true);
});

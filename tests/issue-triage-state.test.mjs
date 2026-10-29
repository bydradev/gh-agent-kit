// issue-triage's end-state checks, read from the workflow and run against
// the stub gh: "Fail when the run left the issue in the wrong state" on a
// triage (one comment of this run's, headed for the state the issue ends
// in, needs-triage gone, triaged or needs-operator but not both, one type,
// one priority, an approval dropped on a fresh triage) and "Fail when the
// sweep left an eligible issue undispatched". Each test plants one wrong
// end state beside the right one. The stale-check path is in
// issue-triage-backstop.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { stubGh, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const FILE = "issue-triage.yml";
const stateScript = stepScript(FILE, "Fail when the run left the issue in the wrong state");
const sweepScript = stepScript(FILE, "Fail when the sweep left an eligible issue undispatched");

const MARKER = "<!-- issue-triage run 1001.1 -->";
const bot = (body) => ({ user: { login: "github-actions[bot]" }, body });
const PLAN = bot(`## Triage\n\nThe plan.\n\n${MARKER}`);
const QUESTIONS = bot(`## Triage: questions\n\nWhich one?\n\n${MARKER}`);

// Runs the state check on open issue 8 with these labels and comments.
function state(t, { labels, comments = [PLAN], action = "opened", env = {} }) {
  const dir = tempDir(t);
  const stub = stubGh(dir, [
    {
      match: "^issue view 8 --repo acme/widgets --json state,author,labels$",
      json: { state: "OPEN", author: { is_bot: false }, labels: labels.map((name) => ({ name })) },
    },
    { match: "^api --paginate repos/acme/widgets/issues/8/comments --jq", json: comments },
  ]);
  return runStep(dir, stateScript, {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    REPO: "acme/widgets",
    TRIAGE_ISSUE: "8",
    EVENT: "issues",
    ACTION: action,
    RETRIAGE: "false",
    STALE: "false",
    GITHUB_RUN_ID: "1001",
    GITHUB_RUN_ATTEMPT: "1",
    ...env,
  });
}
const passes = (r) => assert.equal(r.status, 0, r.stdout + r.stderr);
const fails = (r, why) => {
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, new RegExp(`::error::issue 8 ended in the wrong state: ${why}`));
};

test("issue-triage.yml: a triaged or questioned issue in its right state passes", (t) => {
  passes(state(t, { labels: ["triaged", "bug", "P2"] }));
  passes(state(t, { labels: ["needs-operator", "feature", "P1"], comments: [QUESTIONS] }));
  // A revised plan on a fresh triage, with the approval gone.
  const revised = bot(`## Triage (revised)\n\nThe new plan.\n\n${MARKER}`);
  passes(state(t, { labels: ["triaged", "chore", "P3"], comments: [revised], action: "edited" }));
});

test("issue-triage.yml: the run fails without a comment of its own", (t) => {
  // No comment, another run's, and one with this run's marker that is not
  // the bot's.
  const forged = { user: { login: "mallory" }, body: `## Triage\n\nThe plan.\n\n${MARKER}` };
  for (const comments of [[], [bot(`## Triage\n\n<!-- issue-triage run 999.1 -->`)], [forged]]) {
    const r = state(t, { labels: ["triaged", "bug", "P2"], comments });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(
      r.stdout,
      /::error::triage posted no comment on issue 8 \(labels: triaged bug P2\)/,
    );
  }
});

test("issue-triage.yml: the comment's heading must match the state the issue ends in", (t) => {
  fails(
    state(t, { labels: ["triaged", "bug", "P2"], comments: [QUESTIONS] }),
    "triaged without a '## Triage' or '## Triage \\(revised\\)' comment",
  );
  fails(
    state(t, { labels: ["needs-operator", "bug", "P2"], comments: [PLAN] }),
    "needs-operator without a '## Triage: questions' comment",
  );
});

test("issue-triage.yml: needs-triage must go, and triaged and needs-operator are one or the other", (t) => {
  fails(
    state(t, { labels: ["needs-triage", "triaged", "bug", "P2"] }),
    "needs-triage is still set",
  );
  fails(
    state(t, { labels: ["triaged", "needs-operator", "bug", "P2"], comments: [QUESTIONS] }),
    "both triaged and needs-operator are set",
  );
  fails(state(t, { labels: ["bug", "P2"] }), "neither triaged nor needs-operator is set");
});

test("issue-triage.yml: the issue carries exactly one type and one priority", (t) => {
  for (const labels of [
    ["triaged", "P2"],
    ["triaged", "bug", "docs", "P2"],
  ])
    fails(state(t, { labels }), "a triaged or needs-operator issue carries one type label");
  for (const labels of [
    ["triaged", "bug"],
    ["triaged", "bug", "P1", "P2"],
  ])
    fails(state(t, { labels }), "a triaged or needs-operator issue carries one priority label");
});

test("issue-triage.yml: a fresh triage drops the approval, and a reopen the claim", (t) => {
  for (const action of ["edited", "reopened", "labeled"]) {
    fails(
      state(t, { labels: ["triaged", "bug", "P2", "agent:approved"], action }),
      `agent:approved survived a ${action} event`,
    );
    fails(
      state(t, { labels: ["triaged", "bug", "P2", "ready"], action }),
      `ready survived a ${action} event`,
    );
  }
  // A dispatch of an issue that carried needs-triage is a fresh triage too.
  fails(
    state(t, {
      labels: ["triaged", "bug", "P2", "agent:approved"],
      action: "",
      env: { EVENT: "workflow_dispatch", RETRIAGE: "true" },
    }),
    "agent:approved survived a  event",
  );
  fails(
    state(t, { labels: ["triaged", "bug", "P2", "in-progress"], action: "reopened" }),
    "in-progress survived a reopened event",
  );
  // On an opened event the approval is not this run's to drop, and a
  // reopen that leaves no claim passes.
  passes(state(t, { labels: ["triaged", "bug", "P2", "agent:approved"] }));
  passes(state(t, { labels: ["triaged", "bug", "P2"], action: "reopened" }));
});

function sweep(t, eligible, handled) {
  const dir = tempDir(t);
  const env = { ELIGIBLE_ISSUES: path.join(dir, "eligible"), DISPATCH_LOG: path.join(dir, "log") };
  fs.writeFileSync(env.ELIGIBLE_ISSUES, eligible.map((n) => `${n}\n`).join(""));
  fs.writeFileSync(env.DISPATCH_LOG, handled.map((n) => `${n}\n`).join(""));
  return runStep(dir, sweepScript, env);
}

test("issue-triage.yml: the sweep fails when it left an eligible issue undispatched", (t) => {
  passes(sweep(t, [8, 12, 15], [12, 8, 15]));
  passes(sweep(t, [], []));
  const r = sweep(t, [8, 12, 15], [8]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /::error::the sweep did not dispatch triage for issue\(s\): 12 15/);
});

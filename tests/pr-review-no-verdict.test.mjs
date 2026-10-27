// pr-review's "Record no verdict when the review failed before it was
// pending" step, read from the workflow and run against the stub gh: which
// head gets the action_required check, or that none is recorded.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { stubGh, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const script = stepScript(
  "pr-review.yml",
  "Record no verdict when the review failed before it was pending",
);
const EVENT_HEAD = "e".repeat(40);
const CHECKED_OUT = "c".repeat(40);
const LIVE_HEAD = "1".repeat(40);

const permission = (login, value) => ({
  match: `^api --method GET repos/acme/widgets/collaborators/${login}/permission --jq`,
  json: { permission: value },
});
const ACCESS = [
  permission("dra", "admin"),
  permission("maintainer", "write"),
  permission("reader", "read"),
  permission("outsider", "none"),
  {
    match: "^api --method GET repos/acme/widgets/collaborators/flaky/permission",
    stderr: "gh: Server Error (HTTP 502)\n",
    status: 1,
  },
];
const prView = (body) => ({ match: "^pr view 7 -R acme/widgets --json ", ...body });
const RECORD = { match: "^api -X POST repos/acme/widgets/check-runs ", stdout: "recorded\n" };

// Runs the step; returns its result, the gh calls and the check it posted.
function noVerdict(t, env, rules = []) {
  const dir = tempDir(t);
  const stub = stubGh(dir, [...ACCESS, ...rules, RECORD]);
  const r = runStep(dir, script, {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    REPO: "acme/widgets",
    GITHUB_SERVER_URL: "https://github.com",
    GITHUB_RUN_ID: "1001",
    GITHUB_RUN_ATTEMPT: "1",
    EVENT_HEAD: "",
    AUTHOR: "",
    ACTOR: "",
    PR: "",
    ...env,
  });
  assert.equal(r.status, 0, r.stderr);
  const calls = fs
    .readFileSync(stub.log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const posts = calls.filter((c) => c.args.join(" ").includes("check-runs"));
  assert.ok(posts.length <= 1, "at most one check is recorded");
  return {
    r,
    calls: calls.map((c) => c.args.join(" ")),
    check: posts.length ? JSON.parse(posts[0].stdin) : null,
  };
}

const recordedOn = (check, head) => {
  assert.ok(check, "a check is recorded");
  assert.deepEqual(
    [check.name, check.head_sha, check.status, check.conclusion, check.output.title],
    [
      "pr-review verdict",
      head,
      "completed",
      "action_required",
      "No verdict: the review did not finish",
    ],
  );
  assert.equal(check.details_url, "https://github.com/acme/widgets/actions/runs/1001/attempts/1");
};

test("an event by writers records no verdict on the event's head", (t) => {
  const { check } = noVerdict(t, { EVENT_HEAD, AUTHOR: "maintainer", ACTOR: "dra" });
  recordedOn(check, EVENT_HEAD);
});

test("an event by an actor without write access keeps the verdict", (t) => {
  const { check, r } = noVerdict(t, { EVENT_HEAD, AUTHOR: "dra", ACTOR: "reader" });
  assert.equal(check, null);
  assert.match(r.stdout, /reader has 'read' access, not write: the event was refused/);
});

test("an event by an author without write access keeps the verdict", (t) => {
  const { check, r } = noVerdict(t, { EVENT_HEAD, AUTHOR: "outsider", ACTOR: "dra" });
  assert.equal(check, null);
  assert.match(r.stdout, /outsider has 'none' access, not write: the event was refused/);
});

test("an event on a bot's pull request keeps the verdict without a lookup", (t) => {
  const { check, calls } = noVerdict(t, { EVENT_HEAD, AUTHOR: "dependabot[bot]", ACTOR: "dra" });
  assert.equal(check, null);
  assert.deepEqual(calls, []);
});

test("an event a bot started keeps the verdict, the bot not looked up", (t) => {
  const { check, calls } = noVerdict(t, {
    EVENT_HEAD,
    AUTHOR: "maintainer",
    ACTOR: "github-actions[bot]",
  });
  assert.equal(check, null);
  assert.deepEqual(calls, [
    "api --method GET repos/acme/widgets/collaborators/maintainer/permission --jq .permission",
  ]);
});

test("a failed access lookup still records, as the refusal step did not refuse", (t) => {
  const { check, calls } = noVerdict(t, { EVENT_HEAD, AUTHOR: "flaky", ACTOR: "dra" });
  recordedOn(check, EVENT_HEAD);
  assert.equal(calls.filter((c) => c.includes("/permission")).length, 2);
});

test("a dispatch that checked its head out records on that head, without reading the pull request", (t) => {
  const { check, calls } = noVerdict(t, { PR: "7", HEAD_SHA: CHECKED_OUT }, [
    prView({ stdout: { headRefOid: LIVE_HEAD, isCrossRepository: false } }),
  ]);
  recordedOn(check, CHECKED_OUT);
  assert.ok(!calls.some((c) => c.startsWith("pr view")));
});

test("a dispatch that failed before its checkout records on the pull request's head", (t) => {
  const { check } = noVerdict(t, { PR: "7" }, [
    prView({ stdout: { headRefOid: LIVE_HEAD, isCrossRepository: false } }),
  ]);
  recordedOn(check, LIVE_HEAD);
});

test("a dispatch for a fork's pull request records nothing", (t) => {
  const { check, r } = noVerdict(t, { PR: "7" }, [
    prView({ stdout: { headRefOid: LIVE_HEAD, isCrossRepository: true } }),
  ]);
  assert.equal(check, null);
  assert.match(r.stdout, /comes from a fork; nothing to record/);
});

test("a dispatch whose pr input is not a number records nothing and calls nothing", (t) => {
  for (const PR of ["", "7a", "../7"]) {
    const { check, calls } = noVerdict(t, { PR });
    assert.equal(check, null, PR);
    assert.deepEqual(calls, [], PR);
  }
});

test("a dispatch whose pull request cannot be read records nothing, with a warning", (t) => {
  const { check, r } = noVerdict(t, { PR: "7" }, [
    prView({ stderr: "gh: Not Found (HTTP 404)\n", status: 1 }),
  ]);
  assert.equal(check, null);
  assert.match(r.stdout, /::warning::pull request 7 could not be read/);
});

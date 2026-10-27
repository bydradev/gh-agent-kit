// issue-triage's "Fail when the run left the issue in the wrong state" step,
// read from the workflow and run against the stub gh, on its stale-check
// path: a dispatched run on an idle in-progress issue passes only when a
// closing pull request by an author with write access, or by a GitHub App,
// is open, or a stale-claim comment exists.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { stubGh, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const script = stepScript(
  "issue-triage.yml",
  "Fail when the run left the issue in the wrong state",
);

const user = (login, type = "User") => ({ login, type });
const permission = (login, value) => ({
  match: `^api --method GET repos/acme/widgets/collaborators/${login}/permission --jq`,
  json: { permission: value },
});
const ACCESS = [
  permission("dra", "admin"),
  permission("maintainer", "write"),
  permission("reader", "read"),
  permission("outsider", "none"),
  permission("zed", "write"),
  {
    match: "^api --method GET repos/acme/widgets/collaborators/stranger/permission",
    stderr: "gh: Not Found (HTTP 404)\n",
    status: 1,
  },
  {
    match: "^api --method GET repos/acme/widgets/collaborators/flaky/permission",
    stderr: "gh: Server Error (HTTP 502)\n",
    status: 1,
  },
];
const pr = (number, author, body = "Closes #8") => ({ number, body, user: author });
const STALE_CLAIM = {
  user: user("github-actions[bot]", "Bot"),
  body: "## Triage: stale claim\n\nStill on it?",
  created_at: "2026-10-23T00:00:00Z",
};

// Runs the step on in-progress issue 8 as a dispatched stale check; returns
// its result and the gh calls it made.
function backstop(t, { pulls, comments = [] }) {
  const dir = tempDir(t);
  const stub = stubGh(dir, [
    ...ACCESS,
    {
      match: "^issue view 8 --repo acme/widgets --json state,author,labels$",
      json: {
        state: "OPEN",
        author: { is_bot: false },
        labels: [{ name: "in-progress" }, { name: "agent:approved" }],
      },
    },
    { match: "^api --method GET repos/acme/widgets --jq", json: { default_branch: "main" } },
    {
      match:
        "^api --paginate --method GET repos/acme/widgets/pulls -f state=open -f base=main -F per_page=100 --jq",
      json: pulls,
    },
    { match: "^api --paginate repos/acme/widgets/issues/8/comments --jq", json: comments },
  ]);
  const r = runStep(dir, script, {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    REPO: "acme/widgets",
    TRIAGE_ISSUE: "8",
    EVENT: "workflow_dispatch",
    ACTION: "",
    RETRIAGE: "false",
    STALE: "true",
  });
  const calls = fs
    .readFileSync(stub.log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l).args.join(" "));
  return { ...r, lookups: calls.filter((c) => c.includes("/collaborators/")) };
}

const FAILED =
  /::error::the stale check on in-progress issue 8 found no closing pull request by an author with write access or a GitHub App and posted no/;
const lookup = (login) =>
  `api --method GET repos/acme/widgets/collaborators/${login}/permission --jq .permission`;

test("a closing pull request by an author with write access passes the stale check", (t) => {
  for (const login of ["maintainer", "dra"]) {
    const r = backstop(t, { pulls: [pr(20, user(login))] });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(r.lookups, [lookup(login)]);
  }
});

test("a closing pull request by a GitHub App passes without a lookup", (t) => {
  const r = backstop(t, { pulls: [pr(20, user("dependabot[bot]", "Bot"))] });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(r.lookups, []);
});

test("a closing pull request by an author without write access fails the stale check", (t) => {
  for (const [login, said] of [
    ["reader", "closing pull request by reader, 'read' access: does not count"],
    ["outsider", "closing pull request by outsider, 'none' access: does not count"],
    [
      "stranger",
      "closing pull request by stranger: the access lookup failed, so it does not count",
    ],
    ["flaky", "closing pull request by flaky: the access lookup failed, so it does not count"],
  ]) {
    const r = backstop(t, { pulls: [pr(20, user(login))] });
    assert.equal(r.status, 1, `${login}: ${r.stdout}${r.stderr}`);
    assert.ok(r.stdout.includes(`${said}\n`), r.stdout);
    assert.match(r.stdout, FAILED);
    assert.deepEqual(r.lookups, [lookup(login)]);
  }
});

test("an unknown author or a malformed login counts as no access, without a lookup", (t) => {
  const r = backstop(t, {
    pulls: [pr(20, null), pr(21, user("bad/../login")), pr(22, { login: "", type: "Bot" })],
  });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.equal(
    r.stdout.split("closing pull request by an unknown or malformed author: does not count").length,
    4,
    r.stdout,
  );
  assert.match(r.stdout, FAILED);
  assert.deepEqual(r.lookups, []);
});

test("a mention, another issue's number or no body does not count", (t) => {
  // The listing is already filtered to the default branch by the query.
  const r = backstop(t, {
    pulls: [
      pr(20, user("maintainer"), "see #8"),
      pr(21, user("maintainer"), "Closes #80"),
      pr(22, user("maintainer"), null),
    ],
  });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(r.lookups, []);
});

test("one trusted author among untrusted ones passes, each author looked up once", (t) => {
  const r = backstop(t, {
    pulls: [
      pr(20, user("reader")),
      pr(21, user("reader"), "Fixes acme/widgets#8"),
      pr(22, user("zed"), "Resolves https://github.com/acme/widgets/issues/8"),
    ],
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(r.lookups, [lookup("reader"), lookup("zed")]);
});

test("a stale-claim comment passes even when only an untrusted author's pull request closes", (t) => {
  const r = backstop(t, { pulls: [pr(20, user("stranger"))], comments: [STALE_CLAIM] });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("no closing pull request and no stale-claim comment fails the stale check", (t) => {
  const r = backstop(t, { pulls: [] });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, FAILED);
});

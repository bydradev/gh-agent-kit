// sync-labels.sh against the stub gh: the thirteen labels, the dropped
// ones listed and left alone without --migrate, and with it every issue
// moved off them (replacement first) before the label is deleted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { root, stubGh, tempDir } from "./helpers/server.mjs";

const SCRIPT = path.join(root, ".github/scripts/sync-labels.sh");
const KIT_LABELS = [
  "bug",
  "feature",
  "chore",
  "P0",
  "P1",
  "P2",
  "P3",
  "needs-triage",
  "triaged",
  "in-progress",
  "needs-operator",
  "agent:approved",
  "requested",
];
const missing = { stderr: "gh: Not Found (HTTP 404)\n", status: 1 };
const issue = (number, state, labels) => ({
  number,
  state,
  labels: labels.map((name) => ({ name })),
});

function sync(t, rules, ...args) {
  const dir = tempDir(t);
  const stub = stubGh(dir, [
    { match: "^label create ", stdout: "" },
    ...rules,
    { match: "^api --method (POST|DELETE) ", stdout: "" },
  ]);
  const r = spawnSync("bash", [SCRIPT, ...args, "acme/widgets"], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
      GH_STUB_RULES: stub.rulesFile,
      GH_STUB_LOG: stub.log,
    },
  });
  const calls = fs
    .readFileSync(stub.log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l).args.join(" "));
  return { ...r, calls, writes: calls.filter((c) => /^api --method (POST|DELETE) /.test(c)) };
}

test("it syncs the thirteen labels and only lists the dropped ones without --migrate", (t) => {
  const r = sync(t, [
    { match: "^api repos/acme/widgets/labels/docs ", stdout: "" },
    { match: "^api repos/acme/widgets/labels/(blocked|ready) ", ...missing },
  ]);
  assert.equal(r.status, 0, r.stderr);
  const created = r.calls.filter((c) => c.startsWith("label create ")).map((c) => c.split(" ")[2]);
  assert.deepEqual(created, KIT_LABELS);
  assert.match(
    r.stdout,
    /^dropped docs \(still on the repository; run with --migrate to move its issues to chore and delete it\)$/m,
  );
  assert.doesNotMatch(r.stdout, /dropped (blocked|ready)/);
  assert.deepEqual(r.writes, []);
});

test("--migrate moves every issue off a dropped label, then deletes it", (t) => {
  const r = sync(
    t,
    [
      { match: "^api repos/acme/widgets/labels/(docs|blocked|ready) ", stdout: "" },
      {
        match: "^api --paginate repos/acme/widgets/issues\\?labels=docs&state=all&per_page=100 ",
        json: [
          issue(1, "open", ["docs", "P2"]),
          issue(2, "closed", ["docs", "feature"]),
          // A label that only contains a type's name is not a type.
          issue(6, "open", ["docs", "not,bug"]),
        ],
      },
      {
        match: "^api --paginate repos/acme/widgets/issues\\?labels=blocked&state=all&per_page=100 ",
        json: [issue(3, "open", ["blocked", "triaged"]), issue(4, "closed", ["blocked"])],
      },
      {
        match: "^api --paginate repos/acme/widgets/issues\\?labels=ready&state=all&per_page=100 ",
        json: [issue(5, "open", ["ready", "agent:approved"])],
      },
    ],
    "--migrate",
  );
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.writes, [
    // docs: chore is added only where the issue has no type yet.
    "api --method POST repos/acme/widgets/issues/1/labels -f labels[]=chore --silent",
    "api --method DELETE repos/acme/widgets/issues/1/labels/docs --silent",
    "api --method DELETE repos/acme/widgets/issues/2/labels/docs --silent",
    "api --method POST repos/acme/widgets/issues/6/labels -f labels[]=chore --silent",
    "api --method DELETE repos/acme/widgets/issues/6/labels/docs --silent",
    "api --method DELETE repos/acme/widgets/labels/docs --silent",
    // blocked: needs-operator only on an open issue.
    "api --method POST repos/acme/widgets/issues/3/labels -f labels[]=needs-operator --silent",
    "api --method DELETE repos/acme/widgets/issues/3/labels/blocked --silent",
    "api --method DELETE repos/acme/widgets/issues/4/labels/blocked --silent",
    "api --method DELETE repos/acme/widgets/labels/blocked --silent",
    // ready: no replacement; agent:approved stays.
    "api --method DELETE repos/acme/widgets/issues/5/labels/ready --silent",
    "api --method DELETE repos/acme/widgets/labels/ready --silent",
  ]);
  assert.match(r.stdout, /^deleted ready$/m);
});

test("a label it cannot read stops the script instead of passing for absent", (t) => {
  const r = sync(
    t,
    [
      {
        match: "^api repos/acme/widgets/labels/docs ",
        stderr: "gh: Server Error (HTTP 502)\n",
        status: 1,
      },
    ],
    "--migrate",
  );
  assert.equal(r.status, 1);
  assert.match(r.stderr, /could not read the label docs: gh: Server Error \(HTTP 502\)/);
  assert.deepEqual(r.writes, []);
});

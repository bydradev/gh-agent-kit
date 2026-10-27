// issue-triage's access gate, "Refuse an issue whose author, or an issue
// event whose actor, lacks write access", read from the workflow and run
// against the stub gh: an issue event for an author or actor without write
// access ends green as a skip, with a notice, while a dispatch by hand of
// such an issue still fails. The steps after the gate are checked to honour
// its skip, so a skipped event costs no checkout, install or model call.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { root, stubGh, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const GATE = "Refuse an issue whose author, or an issue event whose actor, lacks write access";
const script = stepScript("issue-triage.yml", GATE);

const permission = (login, value) => ({
  match: `^api --method GET repos/acme/widgets/collaborators/${login}/permission --jq`,
  json: { permission: value },
});
const ACCESS = [
  permission("dra", "admin"),
  permission("maintainer", "write"),
  permission("reader", "read"),
  permission("triager", "triage"),
  permission("outsider", "none"),
  {
    match: "^api --method GET repos/acme/widgets/collaborators/ghost/permission",
    stderr: "gh: Not Found (HTTP 404)\n",
    status: 1,
  },
  {
    match: "^api --method GET repos/acme/widgets/collaborators/flaky/permission",
    stderr: "gh: Server Error (HTTP 502)\n",
    status: 1,
  },
];

// Runs the gate on issue 8, written by `author`, for an event of `event`
// (issues or workflow_dispatch) by `actor`; returns its result, the outputs
// it wrote and the permission lookups it made.
function gate(t, { author, event, actor = "dra" }) {
  const dir = tempDir(t);
  const stub = stubGh(dir, [
    ...ACCESS,
    {
      match: "^api --method GET repos/acme/widgets/issues/8 --jq \\.user\\.login$",
      json: { user: { login: author } },
    },
  ]);
  const output = path.join(dir, "github-output");
  fs.writeFileSync(output, "");
  const r = runStep(dir, script, {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    GITHUB_OUTPUT: output,
    RUNNER_TEMP: dir,
    REPO: "acme/widgets",
    TRIAGE_ISSUE: "8",
    EVENT: event,
    ACTOR: actor,
  });
  const lookups = fs
    .readFileSync(stub.log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l).args.join(" "))
    .filter((c) => c.includes("/collaborators/"))
    .map((c) => c.match(/collaborators\/([^/]+)\//)[1]);
  return { ...r, output: fs.readFileSync(output, "utf8"), lookups };
}

test("an author and actor with write access pass, with no skip", (t) => {
  for (const [author, actor] of [
    ["dra", "dra"],
    ["maintainer", "dra"],
    ["dra", "maintainer"],
  ]) {
    const r = gate(t, { author, event: "issues", actor });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(r.output, "");
    assert.doesNotMatch(r.stdout, /::(notice|error)::/);
    assert.deepEqual(r.lookups, [author, actor]);
  }
});

test("an issue event for an author without write access is skipped with a notice", (t) => {
  for (const [author, access] of [
    ["reader", "read"],
    ["triager", "triage"],
    ["outsider", "none"],
    ["ghost", "none"],
  ]) {
    const r = gate(t, { author, event: "issues" });
    assert.equal(r.status, 0, `${author}: ${r.stdout}${r.stderr}`);
    assert.ok(
      r.stdout.includes(
        `::notice::${author} has '${access}' access to acme/widgets, not write; not triaged\n`,
      ),
      r.stdout,
    );
    assert.doesNotMatch(r.stdout, /::error::/);
    assert.equal(r.output, "skip=true\n");
    // The actor is not looked up once the author is refused.
    assert.deepEqual(r.lookups, [author]);
  }
});

test("an issue event by an actor without write access is skipped with a notice", (t) => {
  const r = gate(t, { author: "dra", event: "issues", actor: "reader" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(
    r.stdout.includes(
      "::notice::reader has 'read' access to acme/widgets, not write; not triaged\n",
    ),
    r.stdout,
  );
  assert.equal(r.output, "skip=true\n");
  assert.deepEqual(r.lookups, ["dra", "reader"]);
});

test("a dispatch of an issue whose author lacks write access still fails", (t) => {
  for (const [author, access] of [
    ["reader", "read"],
    ["ghost", "none"],
  ]) {
    const r = gate(t, { author, event: "workflow_dispatch", actor: "reader" });
    assert.equal(r.status, 1, `${author}: ${r.stdout}${r.stderr}`);
    assert.ok(
      r.stdout.includes(
        `::error::${author} has '${access}' access to acme/widgets, not write; not triaged\n`,
      ),
      r.stdout,
    );
    assert.equal(r.output, "");
    // A dispatch's actor is not checked.
    assert.deepEqual(r.lookups, [author]);
  }
});

test("a dispatch checks only the author, so a reader's dispatch of a write author's issue passes", (t) => {
  const r = gate(t, { author: "maintainer", event: "workflow_dispatch", actor: "reader" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.output, "");
  assert.deepEqual(r.lookups, ["maintainer"]);
});

test("a lookup that fails for another reason fails the run, on any event", (t) => {
  for (const event of ["issues", "workflow_dispatch"]) {
    const r = gate(t, { author: "flaky", event });
    assert.equal(r.status, 1, `${event}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /HTTP 502/);
    assert.equal(r.output, "");
  }
});

// Every step after the gate either runs only on a sweep (the gate runs only
// on a single issue) or checks the gate's skip in its if:, so a skipped
// event runs nothing else.
const SKIP = "steps.gate.outputs.skip != 'true'";
test("every step after the gate honours its skip", () => {
  const lines = fs
    .readFileSync(path.join(root, ".github/workflows/issue-triage.yml"), "utf8")
    .split("\n");
  const start = lines.findIndex((l) => l.trim() === `- name: ${GATE}`);
  assert.notEqual(start, -1);
  assert.equal(lines[start + 1].trim(), "id: gate");
  // The gate is the triage job's first step, so a refused event costs no
  // checkout or install (the settings job before it reads no issue text).
  const job = lines.indexOf("  triage:");
  assert.notEqual(job, -1);
  const first = lines.findIndex((l, i) => i > job && /^ {6}- \w+:/.test(l));
  assert.equal(first, start, `the first step is ${lines[first]?.trim()}, not the gate`);
  const steps = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (!/^ {6}- \w+:/.test(lines[i])) continue;
    let cond = null;
    for (let j = i + 1; j < lines.length && !/^ {6}(- |#)/.test(lines[j]); j++) {
      const m = lines[j].match(/^ {8}if: (.*)$/);
      if (m) cond = m[1];
    }
    steps.push({ step: lines[i].trim(), cond });
  }
  assert.ok(steps.length >= 10, `only ${steps.length} steps found after the gate`);
  for (const { step, cond } of steps) {
    assert.ok(
      cond === "env.TRIAGE_ISSUE == ''" || cond === SKIP || (cond ?? "").endsWith(` && ${SKIP}`),
      `${step} runs after a skip (if: ${cond})`,
    );
  }
});

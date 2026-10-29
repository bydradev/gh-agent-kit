// issue-triage's sweep dispatches: the server in the triage job only queues
// them, "Pass the sweep's dispatches on" hands the queue to the dispatch
// job, and that job, the only one holding actions: write, starts one run
// per queued issue. The steps are read from the workflow and run against
// the stub gh.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { root, stubGh, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const FILE = "issue-triage.yml";
const passOn = stepScript(FILE, "Pass the sweep's dispatches on");
const start = stepScript(FILE, "Start a triage run for each issue the sweep queued");

const outputs = (file) =>
  Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split(/=(.*)/s).slice(0, 2)),
  );

function pass(t, queue) {
  const dir = tempDir(t);
  const output = path.join(dir, "github-output");
  fs.writeFileSync(output, "");
  const env = { GITHUB_OUTPUT: output };
  if (queue !== undefined) {
    env.DISPATCH_QUEUE = path.join(dir, "dispatch-queue");
    fs.writeFileSync(env.DISPATCH_QUEUE, queue);
  }
  const r = runStep(dir, passOn, env);
  return { ...r, outputs: outputs(output) };
}

test("issue-triage.yml: the sweep's queue is passed on as issue numbers, once each", (t) => {
  const r = pass(t, "12\n8\n12\n");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.outputs.issues, "8 12 ");
  assert.match(r.stdout, /queued: 8 12/);

  const none = pass(t, "");
  assert.equal(none.status, 0, none.stdout + none.stderr);
  assert.equal(none.outputs.issues, "");
  // A sweep that stopped before it listed anything has no queue.
  const missing = pass(t, undefined);
  assert.equal(missing.status, 0, missing.stdout + missing.stderr);
  assert.deepEqual(missing.outputs, {});

  const bad = pass(t, "8\n9; rm -rf /\n");
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /::error::the dispatch queue holds something other than issue numbers/);
  assert.deepEqual(bad.outputs, {});
});

function dispatch(t, queue, rules) {
  const dir = tempDir(t);
  const stub = stubGh(dir, rules);
  const r = runStep(dir, start, {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    GH_TOKEN: "job-token",
    REPO: "acme/widgets",
    GITHUB_REF_NAME: "main",
    QUEUE: queue,
  });
  const calls = fs
    .readFileSync(stub.log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l).args.join(" "));
  return { ...r, calls };
}

const run = (n) => `workflow run issue-triage.yml --repo acme/widgets --ref main -f issue=${n}`;

test("issue-triage.yml: the dispatch job starts one run per queued issue", (t) => {
  const r = dispatch(t, "8 12 ", [{ match: "^workflow run ", stdout: "" }]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(r.calls, [run(8), run(12)]);
  assert.match(r.stdout, /dispatched issue-triage.yml for #8 on main/);
  assert.match(r.stdout, /dispatched issue-triage.yml for #12 on main/);
});

test("issue-triage.yml: the dispatch job tries every issue, then fails naming those it could not start", (t) => {
  const r = dispatch(t, "8 12 15", [
    { match: "issue=12$", stderr: "HTTP 502\n", status: 1 },
    { match: "^workflow run ", stdout: "" },
  ]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(r.calls, [run(8), run(12), run(15)]);
  assert.match(r.stdout, /::error::could not dispatch triage for #12$/m);
});

test("issue-triage.yml: the dispatch job refuses anything but issue numbers", (t) => {
  const r = dispatch(t, "8 -f", [{ match: "^workflow run ", stdout: "" }]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /::error::'-f' is not an issue number/);
  assert.deepEqual(r.calls, [run(8)]);
});

// The job layout, read from the file: the workflow's own permissions, which
// the settings and triage jobs run with (the settings job narrows them),
// hold no actions: write, and the dispatch job, which runs no model, is the
// one job that does.
test("issue-triage.yml: only the dispatch job can start workflow runs", () => {
  const lines = fs.readFileSync(path.join(root, ".github/workflows", FILE), "utf8").split("\n");
  const block = (start) => {
    const indent = lines[start].match(/^\s*/)[0].length;
    const end = lines.findIndex(
      (l, i) =>
        i > start &&
        l.trim() !== "" &&
        !l.trim().startsWith("#") &&
        l.match(/^\s*/)[0].length <= indent,
    );
    return lines.slice(start, end === -1 ? lines.length : end);
  };
  const top = block(lines.indexOf("permissions:"));
  assert.deepEqual(
    top
      .slice(1)
      .map((l) => l.trim())
      .filter(Boolean),
    ["contents: read", "issues: write", "pull-requests: read"],
  );
  const writers = lines
    .map((l, i) => [l.trim(), i])
    .filter(([l]) => /^actions:\s*write\b/.test(l))
    .map(([, i]) => i);
  assert.equal(writers.length, 1, "one actions: write");
  const job = block(lines.indexOf("  dispatch:"));
  assert.ok(job.includes(lines[writers[0]]), "the actions: write is the dispatch job's");
  assert.ok(job.some((l) => l.trim() === "needs: triage"));
  assert.ok(!job.some((l) => /claude|opencode|mcp-server/.test(l.replace(/#.*/, ""))));
  // The triage job has no permissions of its own, so it runs with the
  // workflow's.
  const triage = block(lines.indexOf("  triage:"));
  assert.ok(!triage.some((l) => /^    permissions:/.test(l)));
  // The queue reaches the dispatch job: the step writes issues=, the
  // triage job's output reads it under the step's id, and the dispatch
  // job runs on that output and hands it to its step. A broken link would
  // skip the job with every check green.
  const step = triage.findIndex((l) => l.trim() === "- name: Pass the sweep's dispatches on");
  assert.equal(triage[step + 1].trim(), "id: queue");
  assert.ok(passOn.includes('echo "issues=$queue" >> "$GITHUB_OUTPUT"'), passOn);
  assert.ok(triage.includes("      dispatch: ${{ steps.queue.outputs.issues }}"));
  assert.ok(
    job.includes("    if: ${{ !cancelled() && needs.triage.outputs.dispatch != '' }}"),
    job.join("\n"),
  );
  assert.ok(job.includes("          QUEUE: ${{ needs.triage.outputs.dispatch }}"));
});

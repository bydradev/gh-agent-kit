// pr-review's "Skip a body edit that changed no closing reference" step,
// read from the workflow and run against the stub gh: it reads the title and
// body from the event file, not from step env, and skips only when the
// closing references, the base branch's commit (read from the API) and the
// title match the last report and that report's run succeeded. The settings
// job runs the same script before the review job, after a step that defers
// it while another run is in flight, and passes the skip on.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ghCalls, root, stubGh, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const FILE = "pr-review.yml";
const script = stepScript(FILE, "Skip a body edit that changed no closing reference");
const earlyScript = stepScript(
  FILE,
  "Skip a body edit that changed no closing reference, before the review job",
);
const deferScript = stepScript(FILE, "Defer the early skip while another review is in flight");
const passScript = stepScript(FILE, "Pass the settings on");
const HEAD = "a".repeat(40);
const BASE_SHA = "b".repeat(40);

function report(base, { closes = "#5", title = "fix: keep the cache warm" } = {}) {
  return [
    "## Review R1",
    "",
    "No findings.",
    "",
    `Closes reviewed: ${closes}`,
    `Base reviewed: main at ${base}`,
    `Title reviewed: ${title}`,
    `Head reviewed: ${HEAD}`,
  ].join("\n");
}

// Runs the step on an edited event with this title and body; returns its
// output and what it wrote to GITHUB_ENV.
function bodyEdit(t, { title, body, reported = {}, baseNow = BASE_SHA, env = {}, run = script }) {
  const dir = tempDir(t);
  const stub = stubGh(dir, [
    {
      match: "^api --paginate repos/acme/widgets/issues/7/comments --jq ",
      json: [
        { user: { login: "someone" }, body: "Fixes #9" },
        { user: { login: "github-actions[bot]" }, body: report(BASE_SHA, reported) },
      ],
    },
    {
      match: "^api --method GET repos/acme/widgets/git/ref/heads/main --jq ",
      json: { object: { sha: baseNow } },
    },
    {
      match:
        "^api --method GET repos/acme/widgets/actions/workflows/pr-review\\.yml/runs\\?head_sha=",
      json: {
        workflow_runs: [
          {
            id: 55,
            status: "completed",
            conclusion: "success",
            updated_at: "2026-10-26T10:00:00Z",
          },
        ],
      },
    },
    {
      match: "^api repos/acme/widgets/actions/runs/55/jobs --jq ",
      json: { jobs: [{ name: "pr-review", conclusion: "success" }] },
    },
  ]);
  const event = path.join(dir, "event.json");
  fs.writeFileSync(event, JSON.stringify({ pull_request: { title, body } }));
  const githubEnv = path.join(dir, "github-env");
  fs.writeFileSync(githubEnv, "");
  const r = runStep(dir, run, {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    GITHUB_EVENT_PATH: event,
    GITHUB_ENV: githubEnv,
    GITHUB_RUN_ID: "1001",
    BASE: "main",
    HEAD,
    REPO: "acme/widgets",
    PR: "7",
    WORKFLOW_FILE: "acme/widgets/.github/workflows/pr-review.yml@refs/pull/7/merge",
    MODE: "push",
    ...env,
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return { out: r.stdout, env: fs.readFileSync(githubEnv, "utf8") };
}

test("the settings job's early copy is the review job's step, byte for byte", () => {
  assert.equal(earlyScript, script);
});

test("an edit that keeps the closing references skips the review", (t) => {
  const { out, env } = bodyEdit(t, {
    title: "fix: keep the cache warm",
    body: "Reworded the description.\n\nFixes #5\n",
  });
  assert.match(out, /nothing to review/);
  assert.equal(env, "RUN=false\n");
});

test("an edit that changes a closing reference reviews", (t) => {
  const { out, env } = bodyEdit(t, {
    title: "fix: keep the cache warm",
    body: "Fixes #6\n",
  });
  assert.match(out, /closing references differ/);
  assert.equal(env, "");
});

test("the title compared is the event's, read from the event file", (t) => {
  const { out, env } = bodyEdit(t, { title: "fix: keep the cache cold", body: "Fixes #5" });
  assert.match(out, /title differs/);
  assert.equal(env, "");
});

test("a stale title or body in step env is not read", (t) => {
  const { out, env } = bodyEdit(t, {
    title: "fix: keep the cache warm",
    body: "Fixes #5",
    env: { TITLE: "fix: keep the cache cold", BODY: "Fixes #6" },
  });
  assert.match(out, /nothing to review/);
  assert.equal(env, "RUN=false\n");
});

test("a pull request with no description compares as no closing references", (t) => {
  const { out, env } = bodyEdit(t, {
    title: "fix: keep the cache warm",
    body: null,
    reported: { closes: "none" },
  });
  assert.match(out, /nothing to review/);
  assert.equal(env, "RUN=false\n");
});

test("a base branch that moved since the last report reviews", (t) => {
  const { out, env } = bodyEdit(t, {
    title: "fix: keep the cache warm",
    body: "Fixes #5",
    baseNow: "c".repeat(40),
  });
  assert.match(out, /the base is main at c{40} but the last report reviewed against main at b{40}/);
  assert.equal(env, "");
});

test("the early copy skips, run without a checkout", (t) => {
  const { out, env } = bodyEdit(t, {
    title: "fix: keep the cache warm",
    body: "Reworded.\n\nFixes #5\n",
    run: earlyScript,
  });
  assert.match(out, /nothing to review/);
  assert.equal(env, "RUN=false\n");
});

// Runs the defer step with these answers to its two run listings.
function deferStep(t, { branchRuns = [], headRuns = [], dispatchRuns = [], fail = false }) {
  const dir = tempDir(t);
  const stub = stubGh(dir, [
    {
      match:
        "^api --method GET repos/acme/widgets/actions/workflows/pr-review\\.yml/runs -f branch=feat/cache warm -F per_page=100$",
      ...(fail ? { stderr: "HTTP 502", status: 1 } : { stdout: { workflow_runs: branchRuns } }),
    },
    {
      match: `^api --method GET repos/acme/widgets/actions/workflows/pr-review\\.yml/runs -f head_sha=${HEAD} -F per_page=100$`,
      stdout: { workflow_runs: headRuns },
    },
    {
      match:
        "^api --method GET repos/acme/widgets/actions/workflows/pr-review\\.yml/runs -f event=workflow_dispatch -F per_page=100$",
      stdout: { workflow_runs: dispatchRuns },
    },
  ]);
  const githubEnv = path.join(dir, "github-env");
  fs.writeFileSync(githubEnv, "");
  const r = runStep(dir, deferScript, {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    GITHUB_ENV: githubEnv,
    GITHUB_RUN_ID: "1001",
    REPO: "acme/widgets",
    HEAD_REF: "feat/cache warm",
    HEAD,
    WORKFLOW_FILE: "acme/widgets/.github/workflows/pr-review.yml@refs/pull/7/merge",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return { out: r.stdout, env: fs.readFileSync(githubEnv, "utf8"), calls: ghCalls(stub) };
}

test("the early skip goes ahead when only this run is in flight", (t) => {
  const { out, env, calls } = deferStep(t, {
    branchRuns: [
      { id: 1001, status: "in_progress" },
      { id: 990, status: "completed" },
    ],
    dispatchRuns: [{ id: 980, status: "completed" }],
  });
  assert.match(out, /no other run/);
  assert.equal(env, "");
  assert.equal(calls.length, 3);
});

test("a run in flight on the branch defers the early skip", (t) => {
  const { out, env } = deferStep(t, {
    branchRuns: [
      { id: 1001, status: "in_progress" },
      { id: 999, status: "queued" },
    ],
  });
  assert.match(out, /1 other run\(s\)/);
  assert.equal(env, "DEFER=true\n");
});

test("a run in flight on the head under an older branch name defers the early skip", (t) => {
  const { env } = deferStep(t, { headRuns: [{ id: 997, status: "in_progress" }] });
  assert.equal(env, "DEFER=true\n");
});

test("a dispatched review in flight defers the early skip", (t) => {
  const { env } = deferStep(t, { dispatchRuns: [{ id: 998, status: "in_progress" }] });
  assert.equal(env, "DEFER=true\n");
});

test("a failed run listing defers the early skip", (t) => {
  const { out, env } = deferStep(t, { fail: true });
  assert.match(out, /could not list/);
  assert.equal(env, "DEFER=true\n");
});

// The pass step with these settings and RUN, as the settings job leaves them.
function pass(t, run) {
  const dir = tempDir(t);
  const output = path.join(dir, "github-output");
  fs.writeFileSync(output, "");
  const r = runStep(dir, passScript, {
    GITHUB_OUTPUT: output,
    SETTINGS: "KIT_REVIEW_MODE KIT_REVIEW_MAX_TURNS",
    KIT_REVIEW_MODE: "push",
    KIT_REVIEW_MAX_TURNS: "80",
    ...(run === undefined ? {} : { RUN: run }),
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return fs.readFileSync(output, "utf8");
}

test("the settings job passes the early skip on, and only a skip", (t) => {
  assert.equal(pass(t, "false"), "KIT_REVIEW_MODE=push\nKIT_REVIEW_MAX_TURNS=80\nSKIP=true\n");
  assert.equal(pass(t), "KIT_REVIEW_MODE=push\nKIT_REVIEW_MAX_TURNS=80\n");
});

test("the review job does not start after an early skip, and the settings job runs on ubuntu-slim", () => {
  const text = fs.readFileSync(path.join(root, ".github/workflows", FILE), "utf8");
  const settings = text.slice(text.indexOf("\n  settings:\n"), text.indexOf("\n  review:\n"));
  const review = text.slice(text.indexOf("\n  review:\n"));
  assert.match(settings, /\n    runs-on: ubuntu-slim\n/);
  assert.match(review, /\n    if: .*needs\.settings\.outputs\.SKIP != 'true'/);
  assert.match(settings, /\n      SKIP: \$\{\{ steps\.pass\.outputs\.SKIP \}\}\n/);
});

// A step's if: (folded to one line) and its env: keys, from the workflow text.
function stepMeta(text, name) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.trim() === `- name: ${name}`);
  assert.notEqual(start, -1, `no step named ${name}`);
  const meta = { if: "", env: [] };
  let section = "";
  for (let i = start + 1; i < lines.length && !/^\s+- (name|uses):/.test(lines[i]); i++) {
    const l = lines[i];
    if (/^ {8}if: /.test(l)) ((section = "if"), (meta.if = l.replace(/^ {8}if: (>-)?/, "")));
    else if (/^ {8}env:$/.test(l)) section = "env";
    else if (/^ {8}\S/.test(l)) section = "";
    else if (section === "if") meta.if += " " + l.trim();
    else if (section === "env" && /^ {10}[A-Z_]+:/.test(l)) meta.env.push(l.trim().split(":")[0]);
  }
  meta.if = meta.if.trim();
  return meta;
}

test("the early steps run only on a first attempt's no-op-shaped edit, and the skip only after the guard", () => {
  const text = fs.readFileSync(path.join(root, ".github/workflows", FILE), "utf8");
  const edit =
    "github.event.action == 'edited' && github.event.changes.base == null && " +
    "github.event.changes.title == null && github.run_attempt == 1 && " +
    "(env.KIT_REVIEW_MODE == 'push' || env.KIT_REVIEW_MODE == 'open')";
  const guard = stepMeta(text, "Defer the early skip while another review is in flight");
  assert.equal(guard.if, edit);
  const early = stepMeta(
    text,
    "Skip a body edit that changed no closing reference, before the review job",
  );
  assert.equal(early.if, `steps.inflight.outcome == 'success' && env.DEFER != 'true' && ${edit}`);
  // The job copy reads PR from the job's env; the early copy sets it itself.
  const job = stepMeta(text, "Skip a body edit that changed no closing reference");
  assert.deepEqual([...early.env].sort(), [...job.env, "PR"].sort());
  assert.match(
    text,
    /\n {6}- name: Defer the early skip while another review is in flight\n {8}id: inflight\n {8}continue-on-error: true\n/,
  );
});

test("the last report's title is compared without the server's zero-width spaces", (t) => {
  // The server posts "@dra" in the reviewed title as "@", a zero-width
  // space and "dra", so it notifies no one. A title can hold one already,
  // copied from a filed issue's, and the server adds its own.
  const z = String.fromCharCode(0x200b);
  for (const [title, reported] of [
    ["fix: thank @dra", `fix: thank @${z}dra`],
    [`fix: thank @${z}dra`, `fix: thank @${z}${z}dra`],
    // Taken from its line before the spaces are dropped, so a leading
    // space after one survives.
    [`${z} @demo`, `${z} @${z}demo`],
  ]) {
    const { out, env } = bodyEdit(t, { title, body: "Fixes #5", reported: { title: reported } });
    assert.match(out, /nothing to review/, title);
    assert.equal(env, "RUN=false\n", title);
  }
});

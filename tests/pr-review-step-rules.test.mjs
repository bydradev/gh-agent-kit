// pr-review rules a rule-by-rule mutation sweep found no test for (#94):
// the settings' number check and what it writes, the open-mode push skip's
// filters, the outputs the verdict and start steps write, and the reviewer
// rules step's unlinking of a symlinked parent and its one check. Steps are
// read from the workflow and run with bash; gh and sudo are stubs.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { gitRepo, stubGh, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const FILE = "pr-review.yml";
const HEAD = "a".repeat(40);

// A step run with a gh stub, GITHUB_ENV read back as an object.
function run(t, name, { rules = [], env = {}, dir = tempDir(t) } = {}) {
  const stub = stubGh(dir, rules);
  const envFile = path.join(tempDir(t), "github-env");
  fs.writeFileSync(envFile, "");
  const r = runStep(dir, stepScript(FILE, name), {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    GITHUB_ENV: envFile,
    ...env,
  });
  const text = fs.readFileSync(envFile, "utf8");
  const written = Object.fromEntries(
    text
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split(/=(.*)/s).slice(0, 2)),
  );
  return { ...r, env: written, envText: text, calls: () => fs.readFileSync(stub.log, "utf8") };
}

test("a number setting must be digits, at most six of them, and is written to GITHUB_ENV", (t) => {
  const settings = (env) => run(t, "Read the review settings", { env });
  const ok = settings({ TIMEOUT: "45" });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.equal(ok.env.KIT_REVIEW_TIMEOUT_MINUTES, "45");
  assert.equal(ok.env.KIT_REVIEW_MAX_TURNS, "80");
  for (const value of ["abc", "4x", "99999999999999999999999"]) {
    const bad = settings({ TIMEOUT: value });
    assert.equal(bad.status, 1, `${value}: ${bad.stdout}`);
    assert.match(bad.stdout, /the setting KIT_REVIEW_TIMEOUT_MINUTES must be a whole number from 1 to 360/);
    assert.equal(bad.env.KIT_REVIEW_TIMEOUT_MINUTES, undefined);
  }
});

// The open-mode push skip, with the PR's comments and the workflow's runs on
// the last reviewed head.
const PUSH_SKIP = 'Skip a push in mode "open" once a review succeeded';
const report = (login = "github-actions[bot]", heading = "## Review R1: No blocking findings") => ({
  user: { login },
  body: `${heading}\n\nHead reviewed: ${HEAD}\n`,
});
function pushSkip(t, comments, runs) {
  const r = run(t, PUSH_SKIP, {
    rules: [
      { match: "^api --paginate repos/acme/widgets/issues/7/comments ", json: comments },
      {
        match: `^api --method GET repos/acme/widgets/actions/workflows/pr-review\\.yml/runs\\?head_sha=${HEAD}&per_page=100 `,
        json: {
          workflow_runs: runs.map(({ id, updated, status = "completed", conclusion }) => ({
            id,
            updated_at: updated,
            status,
            conclusion,
          })),
        },
      },
      ...runs.map(({ id, review }) => ({
        match: `^api repos/acme/widgets/actions/runs/${id}/jobs `,
        json: { jobs: [{ name: "pr-review", conclusion: review }] },
      })),
    ],
    env: {
      GITHUB_RUN_ID: "99",
      REPO: "acme/widgets",
      PR: "7",
      WORKFLOW_FILE: "acme/widgets/.github/workflows/pr-review.yml@refs/pull/7/merge",
    },
  });
  return { ...r, skipped: r.envText.includes("RUN=false") };
}
const failedBefore = { id: 1, updated: "2026-10-26T01:00:00Z", conclusion: "failure", review: "failure" };

test("the push skip counts only completed, unskipped runs other than this one", (t) => {
  for (const [name, newer] of [
    ["a run in progress", { id: 2, updated: "2026-10-26T02:00:00Z", status: "in_progress", conclusion: null, review: "success" }],
    ["a skipped run", { id: 2, updated: "2026-10-26T02:00:00Z", conclusion: "skipped", review: "success" }],
    ["this run", { id: 99, updated: "2026-10-26T02:00:00Z", conclusion: "success", review: "success" }],
  ]) {
    const r = pushSkip(t, [report()], [failedBefore, newer]);
    assert.equal(r.status, 0, `${name}: ${r.stdout}${r.stderr}`);
    assert.ok(!r.skipped, `${name} stood for a review: ${r.stdout}`);
    assert.match(r.stdout, /concluded 'failure'; reviewing this head/, name);
  }
  const ok = pushSkip(t, [report()], [{ id: 2, updated: "2026-10-26T02:00:00Z", conclusion: "success", review: "success" }]);
  assert.ok(ok.skipped, ok.stdout);
});

test("the push skip reads the head only from the bot's reports, and reviews when there is none", (t) => {
  const success = [{ id: 2, updated: "2026-10-26T02:00:00Z", conclusion: "success", review: "success" }];
  for (const [name, comments] of [
    ["no comments", []],
    ["a report-shaped comment by a person", [report("mallory")]],
    ["a bot comment that is not a report", [report("github-actions[bot]", "## Security scan")]],
  ]) {
    const r = pushSkip(t, comments, success);
    assert.equal(r.status, 0, `${name}: ${r.stdout}${r.stderr}`);
    assert.ok(!r.skipped, name);
    assert.match(r.stdout, /mode open: no report, or the newest one names no head/, name);
    assert.doesNotMatch(r.calls(), /actions\/workflows/, `${name} looked up runs`);
  }
});

test("the verdict and start steps write what the later steps read", (t) => {
  const pending = run(t, "Mark the verdict pending", {
    rules: [{ match: "^api -X POST repos/acme/widgets/check-runs ", stdout: "4242\n" }],
    env: { REPO: "acme/widgets", EVENT_HEAD: HEAD, GITHUB_RUN_ID: "1", GITHUB_RUN_ATTEMPT: "1", GITHUB_SERVER_URL: "https://github.com" },
  });
  assert.equal(pending.status, 0, pending.stdout + pending.stderr);
  assert.equal(pending.env.VERDICT_CHECK_ID, "4242");

  const started = (comments) =>
    run(t, "Record when the review started", {
      rules: [{ match: "^api --paginate repos/acme/widgets/issues/7/comments ", json: comments }],
      env: { REPO: "acme/widgets", PR: "7" },
    });
  const some = started([{ id: 31 }, { id: 205 }, { id: 9 }]);
  assert.equal(some.status, 0, some.stdout + some.stderr);
  assert.equal(some.env.LAST_COMMENT_ID, "205");
  assert.match(some.env.STARTED, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.equal(started([]).env.LAST_COMMENT_ID, "0");
});

// The reviewer rules step, with sudo stubbed to keep what it installs.
function runRules(t, dir) {
  const bin = tempDir(t);
  const installed = path.join(bin, "installed");
  fs.mkdirSync(installed);
  fs.writeFileSync(
    path.join(bin, "sudo"),
    `#!/bin/bash
[ "$1" = install ] || exit 0
[ "$2" = -d ] && exit 0
args=("$@"); n=\${#args[@]}
cp -- "\${args[n-2]}" "${installed}/$(basename -- "\${args[n-1]}")"
`,
    { mode: 0o755 },
  );
  const temp = tempDir(t);
  const githubEnv = path.join(temp, "github-env");
  fs.writeFileSync(githubEnv, "");
  const step = runStep(dir, stepScript(FILE, "Use the base branch's reviewer rules"), {
    BASE: "main",
    GH_TOKEN: "x",
    PATH: `${bin}:${process.env.PATH}`,
    RUNNER_TEMP: temp,
    GITHUB_ENV: githubEnv,
  });
  return { ...step, env: fs.readFileSync(githubEnv, "utf8"), installed: fs.readdirSync(installed).sort() };
}

test("a rule whose parent the head made a symlink is restored without touching the link's target", (t) => {
  const repo = gitRepo(t);
  repo.commit("AGENTS.md", "base rules\n", "agents");
  repo.commit("sub/AGENTS.md", "base sub rules\n", "sub agents");
  repo.commit(".github/scripts/mcp-server.mjs", "// base server\n", "server");
  repo.git("remote", "add", "origin", repo.dir);
  repo.git("checkout", "-q", "-b", "feature");
  const outside = tempDir(t);
  fs.writeFileSync(path.join(outside, "AGENTS.md"), "a file outside the checkout\n");
  repo.git("rm", "-q", "-r", "sub");
  fs.symlinkSync(outside, path.join(repo.dir, "sub"));
  repo.git("add", "sub");
  repo.git("commit", "-q", "-m", "link sub");
  const step = runRules(t, repo.dir);
  assert.equal(step.status, 0, step.stdout + step.stderr);
  assert.equal(fs.readFileSync(path.join(outside, "AGENTS.md"), "utf8"), "a file outside the checkout\n");
  assert.equal(fs.readFileSync(path.join(repo.dir, "sub/AGENTS.md"), "utf8"), "base sub rules\n");
});

test("a base with both public-content checks installs only the Node one", (t) => {
  const repo = gitRepo(t);
  repo.commit(".github/scripts/mcp-server.mjs", "// base server\n", "server");
  repo.commit(".github/scripts/public-content.mjs", "// node check\n", "node check");
  repo.commit(".github/scripts/check_public_content.py", "# python check\n", "python check");
  repo.git("remote", "add", "origin", repo.dir);
  repo.git("checkout", "-q", "-b", "feature");
  const step = runRules(t, repo.dir);
  assert.equal(step.status, 0, step.stdout + step.stderr);
  assert.deepEqual(step.installed, ["mcp-server.mjs", "public-content.mjs"]);
  assert.equal(step.env.match(/^PUBLIC_CONTENT_CHECK=/gm).length, 1);
  assert.match(step.env, /^PUBLIC_CONTENT_CHECK=\/opt\/agent-kit\/public-content\.mjs$/m);
});

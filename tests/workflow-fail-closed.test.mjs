// Workflow rules that fail a run closed, read from the workflows and run
// with bash: a settings job that failed stops the job after it, a sweep
// input that is not an issue number is refused before it reaches the
// server, and a scan whose base moved under it records nothing. Each test
// plants the case its rule refuses beside one it lets through.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { root, gitRepo, stubGh, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const workflow = (file) =>
  fs.readFileSync(path.join(root, ".github/workflows", file), "utf8").split("\n");

// The step's if:, from the line after its name.
function stepIf(file, name) {
  const lines = workflow(file);
  const at = lines.findIndex((l) => l.trim() === `- name: ${name}`);
  assert.notEqual(at, -1, `${file}: no step named ${name}`);
  return lines[at + 1].trim();
}

for (const [file, what] of [
  ["pr-review.yml", "not reviewed"],
  ["security-scan.yml", "not scanned"],
  ["pr-issue-link.yml", "the issue link was not checked"],
]) {
  test(`${file}: a settings job that failed fails the job after it`, (t) => {
    const name = "Fail when the settings job failed";
    assert.equal(stepIf(file, name), "if: needs.settings.result == 'failure'");
    const r = runStep(tempDir(t), stepScript(file, name), {});
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, new RegExp(`::error::the settings job failed .*; ${what}$`, "m"));
  });
}

test("issue-triage.yml: an issue input that is not a number is refused before anything else", (t) => {
  const script = stepScript("issue-triage.yml", "Scope the bot's tools to this run");
  // The check comes first, so a refused value writes and installs nothing.
  assert.match(
    script.split("\n").find((l) => l.trim() !== "" && !l.trim().startsWith("#")),
    /^case "\$ISSUE" in/,
  );
  for (const issue of ["8; rm -rf /", "8\n9", "-1", "x"]) {
    const dir = tempDir(t);
    const env = path.join(dir, "github-env");
    fs.writeFileSync(env, "");
    const r = runStep(dir, script, { ISSUE: issue, GITHUB_ENV: env, RUNNER_TEMP: dir });
    assert.equal(r.status, 1, JSON.stringify(issue));
    assert.match(r.stdout, /::error::issue must be a number, got '/);
    assert.equal(fs.readFileSync(env, "utf8"), "", JSON.stringify(issue));
  }
});

// The record step in a checkout whose origin/main is the base the scan
// diffed against, with the pull request's live base and the merge base the
// compare API reports for it, and the summary a completed scan leaves.
function record(t, { live, mergeBase }) {
  const repo = gitRepo(t);
  const base = repo.commit("a.txt", "a\n", "base");
  repo.git("checkout", "-q", "-b", "feature");
  const head = repo.commit("b.txt", "b\n", "head");
  repo.git("update-ref", "refs/remotes/origin/main", base);
  const temp = tempDir(t);
  fs.writeFileSync(path.join(temp, "scan-count"), "0\n");
  const stub = stubGh(tempDir(t), [
    { match: "^api --method GET repos/acme/widgets/pulls/7 ", stdout: `${live(base)}\n` },
    {
      match: "^api --method GET repos/acme/widgets/compare/",
      stdout: `${mergeBase(base)}\n`,
    },
    { match: "^api --paginate repos/acme/widgets/issues/7/comments ", json: [] },
    {
      match: "^api --method POST repos/acme/widgets/issues/7/comments ",
      stdout: "https://github.com/acme/widgets/pull/7#c1\n",
    },
  ]);
  const r = runStep(repo.dir, stepScript("security-scan.yml", "Record the completed scan"), {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    REPO: "acme/widgets",
    PR: "7",
    HEAD: head,
    BASE: "main",
    RUNNER_TEMP: temp,
  });
  const posted = fs
    .readFileSync(stub.log, "utf8")
    .split("\n")
    .filter(Boolean)
    .filter((l) => JSON.parse(l).args.includes("POST")).length;
  return { ...r, posted };
}

test("security-scan.yml: a base that moved the pull request's diff after the scan records nothing", (t) => {
  const other = "b".repeat(40);
  const moved = record(t, { live: () => other, mergeBase: () => "c".repeat(40) });
  assert.equal(moved.status, 1, moved.stdout + moved.stderr);
  assert.match(
    moved.stdout,
    /::error::the base main moved to b{40} after this scan diffed against [0-9a-f]{40}/,
  );
  assert.equal(moved.posted, 0);
  // A base push that leaves the merge base where it was keeps the scanned
  // diff exact, and so does a base that has not moved: both record.
  for (const [why, over] of [
    ["same merge base", { live: () => other, mergeBase: (base) => base }],
    ["same base", { live: (base) => base, mergeBase: () => "c".repeat(40) }],
  ]) {
    const kept = record(t, over);
    assert.equal(kept.status, 0, `${why}: ${kept.stdout}${kept.stderr}`);
    assert.equal(kept.posted, 1, why);
  }
});

// The sweep's listing step: every open issue it lists, each issue's author
// and labels, and the author's permission, which may fail.
function sweepList(t, issues, permissions) {
  const dir = tempDir(t);
  const rules = [
    {
      match: "^api --paginate repos/acme/widgets/issues\\?state=open&per_page=100 --jq",
      json: issues.map(([number, login]) => ({
        number,
        user: { login, type: "User" },
        labels: [{ name: "needs-triage" }],
        updated_at: "2026-11-01T00:00:00Z",
      })),
    },
    ...issues.map(([number, login]) => ({
      match: `^api --method GET repos/acme/widgets/issues/${number} --jq`,
      json: { user: { login }, labels: [{ name: "needs-triage" }] },
    })),
    ...Object.entries(permissions).map(([login, answer]) => ({
      match: `^api --method GET repos/acme/widgets/collaborators/${login}/permission --jq`,
      ...answer,
    })),
  ];
  const stub = stubGh(tempDir(t), rules);
  // The step reads its list on stdin in a loop; gh does not read stdin for
  // these GET calls, but the stub would, so it gets none.
  const gh = path.join(stub.bin, "gh");
  fs.writeFileSync(gh, fs.readFileSync(gh, "utf8").replace(/"\$@"\n$/, '"$@" </dev/null\n'));
  const env = {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    REPO: "acme/widgets",
    RUNNER_TEMP: dir,
    DISPATCH_LOG: path.join(dir, "dispatched"),
    DISPATCH_QUEUE: path.join(dir, "dispatch-queue"),
    ELIGIBLE_ISSUES: path.join(dir, "eligible"),
  };
  const r = runStep(dir, stepScript("issue-triage.yml", "List the issues a sweep dispatches"), env);
  const eligible = fs.existsSync(env.ELIGIBLE_ISSUES)
    ? fs.readFileSync(env.ELIGIBLE_ISSUES, "utf8")
    : null;
  return { ...r, eligible };
}

test("issue-triage.yml: the sweep fails when an author's permission cannot be read, other than a 404", (t) => {
  const write = { json: { permission: "write" } };
  const gone = { stderr: "gh: Not Found (HTTP 404)\n", status: 1 };
  const flaky = { stderr: "gh: Bad Gateway (HTTP 502)\n", status: 1 };
  // A 404 counts as no access, so that issue is left out and the rest go on.
  const ok = sweepList(
    t,
    [
      [8, "maint"],
      [9, "gone"],
      [10, "maint"],
    ],
    { maint: write, gone },
  );
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.equal(ok.eligible, "8\n10\n");
  assert.match(ok.stdout, /#9: author gone has 'none' access, not write; not dispatched/);
  // Any other failure fails the sweep, so no issue after it is silently
  // dropped from the list.
  const failed = sweepList(
    t,
    [
      [8, "maint"],
      [9, "flaky"],
      [10, "maint"],
    ],
    {
      maint: write,
      flaky,
    },
  );
  assert.equal(failed.status, 1, failed.stdout + failed.stderr);
  assert.match(failed.stderr, /HTTP 502/);
  assert.equal(failed.eligible, "8\n");
});

test("pr-review.yml: the run stops before its settings without a head sha or a base branch", (t) => {
  const script = stepScript(
    "pr-review.yml",
    "Write the model's settings and the MCP server's configuration",
  );
  const head = "a".repeat(40);
  for (const [env, message] of [
    [{ EVENT_HEAD: "", HEAD_SHA: "", EVENT_BASE: "main" }, /::error::no head sha for this run/],
    [{ EVENT_HEAD: "abc; rm -rf /", EVENT_BASE: "main" }, /::error::no head sha for this run/],
    [
      { EVENT_HEAD: "", HEAD_SHA: head, EVENT_BASE: "", BASE: "" },
      /::error::no base branch for this run/,
    ],
  ]) {
    const temp = tempDir(t);
    const r = runStep(tempDir(t), script, { RUNNER_TEMP: temp, ...env });
    assert.equal(r.status, 1, JSON.stringify(env));
    assert.match(r.stdout, message);
    // Nothing of the run's scope is written: no settings, no token file.
    assert.deepEqual(fs.readdirSync(temp), [], JSON.stringify(env));
  }
});

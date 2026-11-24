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
// compare API reports for it.
function record(t, { live, mergeBase }) {
  const repo = gitRepo(t);
  const base = repo.commit("a.txt", "a\n", "base");
  repo.git("checkout", "-q", "-b", "feature");
  const head = repo.commit("b.txt", "b\n", "head");
  repo.git("update-ref", "refs/remotes/origin/main", base);
  const stub = stubGh(tempDir(t), [
    { match: "^api --method GET repos/acme/widgets/pulls/7 ", stdout: `${live(base)}\n` },
    {
      match: "^api --method GET repos/acme/widgets/compare/",
      stdout: `${mergeBase(base)}\n`,
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
    RUNNER_TEMP: tempDir(t),
  });
  const posted = fs
    .readFileSync(stub.log, "utf8")
    .split("\n")
    .filter(Boolean)
    .some((l) => JSON.parse(l).args.includes("POST"));
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
  assert.equal(moved.posted, false);
  // A base push that leaves the merge base where it was keeps the scanned
  // diff exact, so this check lets the step go on.
  const kept = record(t, { live: () => other, mergeBase: (base) => base });
  assert.doesNotMatch(kept.stdout + kept.stderr, /moved to/);
  const same = record(t, { live: (base) => base, mergeBase: () => "c".repeat(40) });
  assert.doesNotMatch(same.stdout + same.stderr, /moved to/);
});

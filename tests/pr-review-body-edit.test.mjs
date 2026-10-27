// pr-review's "Skip a body edit that changed no closing reference" step,
// read from the workflow and run against the stub gh and a scratch
// repository: it reads the title and body from the event file, not from step
// env, and skips only when the closing references, the base and the title
// match the last report and that report's run succeeded.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { stubGh, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const script = stepScript("pr-review.yml", "Skip a body edit that changed no closing reference");
const HEAD = "a".repeat(40);

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
function bodyEdit(t, { title, body, reported = {}, env = {} }) {
  const dir = tempDir(t);
  const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  git("config", "commit.gpgsign", "false");
  git(
    "-c",
    "user.name=t",
    "-c",
    "user.email=t@example.com",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "base",
  );
  const base = git("rev-parse", "HEAD");
  git("update-ref", "refs/remotes/origin/main", base);
  const stub = stubGh(dir, [
    {
      match: "^api --paginate repos/acme/widgets/issues/7/comments --jq ",
      json: [
        { user: { login: "someone" }, body: "Fixes #9" },
        { user: { login: "github-actions[bot]" }, body: report(base, reported) },
      ],
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
  const r = runStep(dir, script, {
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

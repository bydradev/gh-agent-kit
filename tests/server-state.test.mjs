// The review's and triage's MCP server keep what a run has posted in a file
// under RUNNER_TEMP (STATE_FILE), so that OpenCode's carry-on after a
// capacity refusal, a new CLI process with a new server, cannot post the
// run's one report or comment again. Read from each workflow's settings step,
// run as the job runs it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const STEP = "Write the model's settings and the MCP server's configuration";

function settings(t, file, env) {
  const dir = tempDir(t);
  const githubEnv = path.join(dir, "github-env");
  fs.writeFileSync(githubEnv, "");
  const r = runStep(dir, stepScript(file, STEP), {
    RUNNER_TEMP: dir,
    GITHUB_ENV: githubEnv,
    GITHUB_WORKSPACE: dir,
    GITHUB_RUN_ID: "1001",
    GITHUB_RUN_ATTEMPT: "2",
    GITHUB_REF_NAME: "main",
    GH_TOKEN: "job-token",
    REPO: "acme/widgets",
    ...env,
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const line = fs
    .readFileSync(githubEnv, "utf8")
    .split("\n")
    .find((l) => l.startsWith("MCP_CONFIG="));
  const server = JSON.parse(line.slice("MCP_CONFIG=".length)).mcpServers["agent-kit"];
  return { dir, server };
}

test("pr-review.yml: the review's server keeps the run's posts in a file under RUNNER_TEMP", (t) => {
  const { dir, server } = settings(t, "pr-review.yml", {
    PR: "7",
    EVENT_HEAD: "a".repeat(40),
    EVENT_BASE: "main",
  });
  assert.deepEqual(server.args, ["/opt/agent-kit/mcp-server.mjs", "review"]);
  assert.equal(server.env.STATE_FILE, path.join(dir, "agent-kit-state.json"));
});

test("issue-triage.yml: triage's and the sweep's server keep the run's posts in a file under RUNNER_TEMP", (t) => {
  for (const mode of ["triage", "sweep"]) {
    const { dir, server } = settings(t, "issue-triage.yml", {
      MCP_MODE: mode,
      TRIAGE_ISSUE: mode === "triage" ? "8" : "",
      TRIAGE_EVENT: "issues",
      ELIGIBLE_ISSUES: "eligible",
      DISPATCH_LOG: "dispatched",
    });
    assert.deepEqual(server.args, ["/opt/agent-kit/mcp-server.mjs", mode]);
    assert.equal(server.env.STATE_FILE, path.join(dir, "agent-kit-state.json"));
    assert.equal(server.env.DISPATCH_LOG, "dispatched");
  }
});

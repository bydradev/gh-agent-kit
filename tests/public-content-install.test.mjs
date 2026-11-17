// Where the server's public-content check comes from: pr-review's "Use the
// base branch's reviewer rules" step installs the base's copy, never the
// head's, and issue-triage's "Install the default branch's public-content
// check" reads the default branch's through the contents API. Each settings
// step then names the check, and the file holding PRIVATE_REPO_NAMES, in the
// server's configuration. Steps are read from the workflows and run with
// bash; sudo and gh are stubs.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { gitRepo, stubGh, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const rulesScript = stepScript("pr-review.yml", "Use the base branch's reviewer rules");
const triageScript = stepScript(
  "issue-triage.yml",
  "Install the default branch's public-content check",
);
const SETTINGS = "Write the model's settings and the MCP server's configuration";

// A sudo stub that keeps a copy of each file `sudo install` installs, under
// the destination's base name, in installed/.
function sudoStub(t) {
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
  return { bin, installed };
}

function runRules(t, dir) {
  const sudo = sudoStub(t);
  const temp = tempDir(t);
  const githubEnv = path.join(temp, "github-env");
  fs.writeFileSync(githubEnv, "");
  const step = runStep(dir, rulesScript, {
    BASE: "main",
    GH_TOKEN: "x",
    PATH: `${sudo.bin}:${process.env.PATH}`,
    RUNNER_TEMP: temp,
    GITHUB_ENV: githubEnv,
  });
  const installed = (name) => {
    const f = path.join(sudo.installed, name);
    return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
  };
  return { ...step, env: fs.readFileSync(githubEnv, "utf8"), installed };
}

// A checkout whose origin (the repository itself) has main as the base.
function repoWith(t, baseFiles, headFiles) {
  const repo = gitRepo(t);
  repo.commit(".github/scripts/mcp-server.mjs", "// base server\n", "server");
  for (const [f, content] of Object.entries(baseFiles)) repo.commit(f, content, `base ${f}`);
  repo.git("remote", "add", "origin", repo.dir);
  repo.git("checkout", "-q", "-b", "feature");
  for (const [f, content] of Object.entries(headFiles)) repo.commit(f, content, `head ${f}`);
  return repo;
}

test("pr-review installs the base's check, not the head's change to it", (t) => {
  const repo = repoWith(
    t,
    { ".github/scripts/public-content.mjs": "// base check\n" },
    { ".github/scripts/public-content.mjs": "process.exit(0); // head check\n" },
  );
  const step = runRules(t, repo.dir);
  assert.equal(step.status, 0, step.stdout + step.stderr);
  assert.equal(step.installed("public-content.mjs"), "// base check\n");
  assert.match(step.env, /^PUBLIC_CONTENT_CHECK=\/opt\/agent-kit\/public-content\.mjs$/m);
});

test("pr-review installs no check a base lacks, even when the head adds one", (t) => {
  const repo = repoWith(t, {}, { ".github/scripts/public-content.mjs": "process.exit(0);\n" });
  const step = runRules(t, repo.dir);
  assert.equal(step.status, 0, step.stdout + step.stderr);
  assert.equal(step.installed("public-content.mjs"), null);
  assert.doesNotMatch(step.env, /PUBLIC_CONTENT_CHECK/);
});

test("pr-review takes a base's Python check", (t) => {
  const repo = repoWith(t, { ".github/scripts/check_public_content.py": "# base check\n" }, {});
  const step = runRules(t, repo.dir);
  assert.equal(step.status, 0, step.stdout + step.stderr);
  assert.equal(step.installed("public-content.py"), "# base check\n");
  assert.match(step.env, /^PUBLIC_CONTENT_CHECK=\/opt\/agent-kit\/public-content\.py$/m);
});

test("pr-review fails on a base check committed as a symlink", (t) => {
  const repo = gitRepo(t);
  repo.commit(".github/scripts/mcp-server.mjs", "// base server\n", "server");
  repo.commit("elsewhere.mjs", "// target\n", "target");
  fs.symlinkSync("../../elsewhere.mjs", path.join(repo.dir, ".github/scripts/public-content.mjs"));
  repo.git("add", ".github");
  repo.git("commit", "-q", "-m", "link the check");
  repo.git("remote", "add", "origin", repo.dir);
  repo.git("checkout", "-q", "-b", "feature");
  const step = runRules(t, repo.dir);
  assert.equal(step.status, 1);
  assert.match(
    step.stdout,
    /::error::\.github\/scripts\/public-content\.mjs on main is not a regular file/,
  );
  assert.doesNotMatch(step.env, /PUBLIC_CONTENT_CHECK/);
});

function runTriage(t, rules) {
  const dir = tempDir(t);
  const stub = stubGh(dir, rules);
  const sudo = sudoStub(t);
  const githubEnv = path.join(dir, "github-env");
  fs.writeFileSync(githubEnv, "");
  const step = runStep(dir, triageScript, {
    PATH: `${stub.bin}:${sudo.bin}:${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    REPO: "acme/widgets",
    GH_TOKEN: "x",
    RUNNER_TEMP: dir,
    GITHUB_ENV: githubEnv,
  });
  const installed = (name) => {
    const f = path.join(sudo.installed, name);
    return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
  };
  return { ...step, env: fs.readFileSync(githubEnv, "utf8"), installed };
}
const contents = (f, body) => ({
  match: `^api repos/acme/widgets/contents/${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
  stdout: body,
});
const notFound = (f) => ({
  ...contents(f),
  stdout: "",
  stderr: "gh: Not Found (HTTP 404)\n",
  status: 1,
});
const MJS = ".github/scripts/public-content.mjs";
const PY = ".github/scripts/check_public_content.py";
const file = (text) => ({
  type: "file",
  encoding: "base64",
  content: Buffer.from(text)
    .toString("base64")
    .replace(/(.{60})/g, "$1\n"),
});

test("triage installs the default branch's check from the contents API", (t) => {
  const text = "// default branch check\n".repeat(5);
  const step = runTriage(t, [contents(MJS, file(text))]);
  assert.equal(step.status, 0, step.stdout + step.stderr);
  assert.equal(step.installed("public-content.mjs"), text);
  assert.match(step.env, /^PUBLIC_CONTENT_CHECK=\/opt\/agent-kit\/public-content\.mjs$/m);
});

test("triage takes the Python check when there is no Node one, and none when neither exists", (t) => {
  const py = runTriage(t, [notFound(MJS), contents(PY, file("# check\n"))]);
  assert.equal(py.status, 0, py.stdout + py.stderr);
  assert.equal(py.installed("public-content.py"), "# check\n");
  const none = runTriage(t, [notFound(MJS), notFound(PY)]);
  assert.equal(none.status, 0, none.stdout + none.stderr);
  assert.doesNotMatch(none.env, /PUBLIC_CONTENT_CHECK/);
});

test("triage fails rather than post unchecked when the check cannot be read whole", (t) => {
  for (const [rules, message] of [
    [
      [{ ...contents(MJS), stdout: "", stderr: "gh: Server Error (HTTP 500)\n", status: 1 }],
      /could not read/,
    ],
    [
      [contents(MJS, { type: "symlink", target: "x" })],
      /not a file the contents API returns whole/,
    ],
    [
      [contents(MJS, { type: "file", encoding: "none", content: "" })],
      /not a file the contents API returns whole/,
    ],
    [[contents(MJS, [{ type: "file" }])], /not a file the contents API returns whole/],
  ]) {
    const step = runTriage(t, rules);
    assert.equal(step.status, 1, JSON.stringify(rules));
    assert.match(step.stdout, message);
    assert.doesNotMatch(step.env, /PUBLIC_CONTENT_CHECK/);
  }
});

// Each settings step, run as the job runs it.
function settings(t, wf, env) {
  const dir = tempDir(t);
  const githubEnv = path.join(dir, "github-env");
  fs.writeFileSync(githubEnv, "");
  const r = runStep(dir, stepScript(wf, SETTINGS), {
    RUNNER_TEMP: dir,
    GITHUB_ENV: githubEnv,
    GITHUB_WORKSPACE: dir,
    GITHUB_RUN_ID: "1001",
    GITHUB_RUN_ATTEMPT: "2",
    GITHUB_REF_NAME: "main",
    GH_TOKEN: "job-token",
    REPO: "acme/widgets",
    PR: "7",
    EVENT_HEAD: "a".repeat(40),
    EVENT_BASE: "main",
    MCP_MODE: "triage",
    TRIAGE_ISSUE: "8",
    TRIAGE_EVENT: "issues",
    ...env,
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const line = fs
    .readFileSync(githubEnv, "utf8")
    .split("\n")
    .find((l) => l.startsWith("MCP_CONFIG="));
  return {
    dir,
    line,
    server: JSON.parse(line.slice("MCP_CONFIG=".length)).mcpServers["agent-kit"],
  };
}

for (const wf of ["pr-review.yml", "issue-triage.yml"]) {
  test(`${wf}: the server gets the check and a private file of the names, never the names inline`, (t) => {
    const { dir, line, server } = settings(t, wf, {
      PUBLIC_CONTENT_CHECK: "/opt/agent-kit/public-content.mjs",
      PRIVATE_REPO_NAMES: "skunkworks",
    });
    assert.equal(server.env.PUBLIC_CONTENT_CHECK, "/opt/agent-kit/public-content.mjs");
    const names = path.join(dir, "private-repo-names");
    assert.equal(server.env.PRIVATE_REPO_NAMES_FILE, names);
    assert.equal(fs.readFileSync(names, "utf8"), "skunkworks");
    assert.equal(fs.statSync(names).mode & 0o077, 0);
    assert.doesNotMatch(line, /skunkworks/);
  });

  test(`${wf}: without a check the server's configuration is as before`, (t) => {
    const { dir, server } = settings(t, wf, { PRIVATE_REPO_NAMES: "skunkworks" });
    assert.equal(server.env.PUBLIC_CONTENT_CHECK, undefined);
    assert.equal(server.env.PRIVATE_REPO_NAMES_FILE, undefined);
    assert.ok(!fs.existsSync(path.join(dir, "private-repo-names")));
  });
}

test("a check that fails on an empty text stops either workflow before the model runs", (t) => {
  const repo = repoWith(t, { ".github/scripts/public-content.mjs": "process.exit(2);\n" }, {});
  const review = runRules(t, repo.dir);
  assert.equal(review.status, 1);
  assert.match(
    review.stdout,
    /::error::\.github\/scripts\/public-content\.mjs does not pass on an empty text/,
  );
  assert.equal(review.installed("public-content.mjs"), null);
  assert.doesNotMatch(review.env, /PUBLIC_CONTENT_CHECK/);
  const triage = runTriage(t, [contents(MJS, file("process.exit(2);\n"))]);
  assert.equal(triage.status, 1);
  assert.match(triage.stdout, /does not pass on an empty text/);
  assert.doesNotMatch(triage.env, /PUBLIC_CONTENT_CHECK/);
});

// issue-triage's set-up steps, read from the workflow and run with bash
// against stubs: the tools each run is given, the sweep's list of issues it
// may dispatch, the start record a dispatched run reads, and the MCP
// server's configuration.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { stubGh, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const FILE = "issue-triage.yml";
const envOf = (file) =>
  Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split(/=(.*)/s).slice(0, 2)),
  );

// A sudo stub that copies what `sudo install` installs into installed/.
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

test("the tools step gives a triage run its tools and a sweep only the dispatch tools", (t) => {
  for (const [issue, mode, allowed] of [
    ["8", "triage", /^Read,Grep,Glob,mcp__agent-kit__view,.*,mcp__agent-kit__comment$/],
    ["", "sweep", /^mcp__agent-kit__list_eligible,mcp__agent-kit__dispatch$/],
  ]) {
    const dir = tempDir(t);
    fs.mkdirSync(path.join(dir, ".github/scripts"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".github/scripts/mcp-server.mjs"), "// the server\n");
    const sudo = sudoStub(t);
    const githubEnv = path.join(dir, "github-env");
    fs.writeFileSync(githubEnv, "");
    const r = runStep(dir, stepScript(FILE, "Scope the bot's tools to this run"), {
      PATH: `${sudo.bin}${path.delimiter}${process.env.PATH}`,
      ISSUE: issue,
      GITHUB_ENV: githubEnv,
      RUNNER_TEMP: "/rt",
      GITHUB_WORKSPACE: "/w",
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const env = envOf(githubEnv);
    assert.deepEqual(Object.keys(env), ["DISPATCH_LOG", "DISPATCH_QUEUE", "ELIGIBLE_ISSUES", "DENIED", "MCP_MODE", "ALLOWED"], mode);
    assert.equal(env.DISPATCH_LOG, "/rt/dispatched");
    assert.equal(env.DISPATCH_QUEUE, "/rt/dispatch-queue");
    assert.equal(env.ELIGIBLE_ISSUES, "/rt/eligible-issues");
    assert.match(env.DENIED, /^Bash,Edit,Write,.*,Read\(\/\/w\/\.git\/\*\*\)$/);
    assert.equal(env.MCP_MODE, mode);
    assert.match(env.ALLOWED, allowed, mode);
    assert.equal(fs.readFileSync(path.join(sudo.installed, "mcp-server.mjs"), "utf8"), "// the server\n");
  }
});

const DAY = 86400 * 1000;
const ago = (days) => new Date(Date.now() - days * DAY).toISOString().replace(/\.\d+Z$/, "Z");

// The sweep's listing step over these open issues ({ number, login, type,
// labels, updated, pr }) with these comments per issue, every author with
// write access unless permissions says otherwise.
function sweep(t, issues, { comments = {}, permissions = {}, files = {} } = {}) {
  const dir = tempDir(t);
  const rules = [
    {
      match: "^api --paginate repos/acme/widgets/issues\\?state=open&per_page=100 --jq",
      json: issues.map(({ number, login = "maint", type = "User", labels = [], updated = ago(1), pr }) => ({
        number,
        user: { login, type },
        labels: labels.map((name) => ({ name })),
        updated_at: updated,
        ...(pr ? { pull_request: { url: "x" } } : {}),
      })),
    },
    ...issues.map(({ number, login = "maint", labels = [] }) => ({
      match: `^api --method GET repos/acme/widgets/issues/${number} --jq`,
      json: { user: { login }, labels: labels.map((name) => ({ name })) },
    })),
    ...Object.entries(comments).map(([number, list]) => ({
      match: `^api --paginate repos/acme/widgets/issues/${number}/comments --jq`,
      json: list,
    })),
    ...Object.entries(permissions).map(([login, permission]) => ({
      match: `^api --method GET repos/acme/widgets/collaborators/${login}/permission --jq`,
      json: { permission },
    })),
    { match: "^api --method GET repos/acme/widgets/collaborators/[^/]+/permission --jq", json: { permission: "write" } },
  ];
  const stub = stubGh(dir, rules);
  // The step reads its list on stdin; the stub must not.
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
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(env[name], text);
  const r = runStep(dir, stepScript(FILE, "List the issues a sweep dispatches"), env);
  const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null);
  const calls = fs
    .readFileSync(stub.log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l).args.join(" "));
  return { ...r, eligible: read(env.ELIGIBLE_ISSUES), log: read(env.DISPATCH_LOG), queue: read(env.DISPATCH_QUEUE), calls };
}

test("the sweep lists needs-triage, unlabelled and stale in-progress issues, not pull requests or bots'", (t) => {
  const r = sweep(t, [
    { number: 1, labels: ["needs-triage"] },
    { number: 2, labels: ["bug"] },
    { number: 3, labels: ["triaged"] },
    { number: 4, labels: ["in-progress"], updated: ago(8) },
    { number: 5, labels: ["in-progress"], updated: ago(6) },
    { number: 6, labels: ["needs-triage"], pr: true },
    { number: 7, labels: ["needs-triage"], login: "ci[bot]", type: "Bot" },
    { number: 8, labels: ["needs-operator"] },
  ], { comments: { 4: [] } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.eligible, "1\n2\n4\n");
  assert.match(r.stdout, /^eligible: 1 2 4 $/m);
});

test("the sweep starts each run's records empty", (t) => {
  const r = sweep(t, [{ number: 1, labels: ["needs-triage"] }], {
    files: { DISPATCH_LOG: "old\n", DISPATCH_QUEUE: "old\n", ELIGIBLE_ISSUES: "old\n" },
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.log, "");
  assert.equal(r.queue, "");
  assert.equal(r.eligible, "1\n");
});

test("a stale in-progress issue already warned by the bot is not dispatched again", (t) => {
  const warning = (login, body) => ({ id: 1, user: { login }, body });
  const stale = (number, labels = ["in-progress"]) => ({ number, labels, updated: ago(8) });
  const r = sweep(t, [stale(1), stale(2), stale(3), stale(4), stale(5, ["in-progress", "needs-triage"])], {
    comments: {
      1: [warning("github-actions[bot]", "## Triage: stale claim\n\nNo activity.")],
      2: [warning("someone", "## Triage: stale claim\n")],
      3: [warning("github-actions[bot]", "Quoting: ## Triage: stale claim")],
      4: [],
    },
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.eligible, "2\n3\n4\n5\n");
  // needs-triage on it asks for a fresh triage, so its comments are not read.
  assert.equal(r.calls.filter((c) => c.includes("issues/5/comments")).length, 0);
});

// GNU date reads -d; macOS's does not, and the runner's is GNU's.
const gnuDate = spawnSync("date", ["-u", "-d", "2026-01-01T00:00:00Z", "+%s"]).status === 0;

// The start record, for an event (workflow_dispatch or issues) on issue
// TRIAGE_ISSUE whose labels and last update the API returns.
function started(t, { event, issue = "8", labels = [], updated = ago(1) }) {
  const dir = tempDir(t);
  const stub = stubGh(dir, [
    {
      match: "^api --method GET repos/acme/widgets/issues/8 --jq",
      json: { labels: labels.map((name) => ({ name })), updated_at: updated },
    },
  ]);
  const githubEnv = path.join(dir, "github-env");
  fs.writeFileSync(githubEnv, "");
  const script = stepScript(FILE, "Record when the run started").replaceAll("${{ github.event_name }}", event);
  const r = runStep(dir, script, {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    REPO: "acme/widgets",
    TRIAGE_ISSUE: issue,
    GITHUB_ENV: githubEnv,
  });
  return { ...r, env: envOf(githubEnv), calls: fs.readFileSync(stub.log, "utf8").split("\n").filter(Boolean).length };
}

test("a dispatched run records a re-triage and a stale claim; other runs record neither", { skip: !gnuDate && "needs GNU date" }, (t) => {
  for (const [name, over, retriage, stale, calls] of [
    ["a dispatch of a needs-triage issue", { event: "workflow_dispatch", labels: ["needs-triage"] }, "true", "false", 1],
    ["a dispatch of a stale in-progress issue", { event: "workflow_dispatch", labels: ["in-progress"], updated: ago(8) }, "false", "true", 1],
    ["a dispatch of a recent in-progress issue", { event: "workflow_dispatch", labels: ["in-progress"], updated: ago(6) }, "false", "false", 1],
    ["a dispatch of an old issue not in progress", { event: "workflow_dispatch", labels: ["bug"], updated: ago(8) }, "false", "false", 1],
    ["an issue event", { event: "issues", labels: ["needs-triage", "in-progress"], updated: ago(8) }, "false", "false", 0],
    ["a sweep", { event: "workflow_dispatch", issue: "" }, "false", "false", 0],
  ]) {
    const r = started(t, over);
    assert.equal(r.status, 0, `${name}: ${r.stdout}${r.stderr}`);
    assert.match(r.env.STARTED ?? "", /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/, name);
    assert.equal(r.env.RETRIAGE, retriage, name);
    assert.equal(r.env.STALE, stale, name);
    assert.equal(r.calls, calls, name);
  }
});

test("the server's configuration carries the vouched hash only when the gate set one, and the token in a private file", (t) => {
  for (const vouched of ["", "abc123"]) {
    const dir = tempDir(t);
    const githubEnv = path.join(dir, "github-env");
    fs.writeFileSync(githubEnv, "");
    const r = runStep(dir, stepScript(FILE, "Write the model's settings and the MCP server's configuration"), {
      GH_TOKEN: "tok",
      RUNNER_TEMP: dir,
      GITHUB_ENV: githubEnv,
      REPO: "acme/widgets",
      MCP_MODE: "triage",
      TRIAGE_ISSUE: "8",
      VOUCHED_TEXT_SHA256: vouched,
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const env = JSON.parse(envOf(githubEnv).MCP_CONFIG).mcpServers["agent-kit"].env;
    assert.equal(env.VOUCHED_TEXT_SHA256, vouched || undefined, JSON.stringify(vouched));
    const token = path.join(dir, "gh-token");
    assert.equal(fs.readFileSync(token, "utf8"), "tok");
    assert.equal(fs.statSync(token).mode & 0o777, 0o600);
  }
});

test(".git comes back only when it was moved out and nothing took its place", (t) => {
  const script = stepScript(FILE, "Put .git back in the checkout");
  for (const [name, saved, present, want] of [
    ["moved out", true, false, { git: "saved", temp: false }],
    ["never moved", false, false, { git: null, temp: false }],
    ["a .git there already", true, true, { git: "present", temp: true }],
  ]) {
    const dir = tempDir(t);
    const temp = path.join(dir, "temp");
    fs.mkdirSync(temp);
    if (saved) fs.mkdirSync(path.join(temp, "checkout-git")), fs.writeFileSync(path.join(temp, "checkout-git", "HEAD"), "saved");
    if (present) fs.mkdirSync(path.join(dir, ".git")), fs.writeFileSync(path.join(dir, ".git", "HEAD"), "present");
    const r = runStep(dir, script, { RUNNER_TEMP: temp });
    assert.equal(r.status, 0, `${name}: ${r.stdout}${r.stderr}`);
    const head = path.join(dir, ".git", "HEAD");
    assert.equal(fs.existsSync(head) ? fs.readFileSync(head, "utf8") : null, want.git, name);
    assert.equal(fs.existsSync(path.join(temp, "checkout-git")), want.temp, name);
    assert.equal(fs.existsSync(path.join(dir, ".git", "checkout-git")), false, name);
  }
});

test("the token and the private names are removed", (t) => {
  const dir = tempDir(t);
  for (const f of ["gh-token", "private-repo-names", "other"]) fs.writeFileSync(path.join(dir, f), "x");
  const r = runStep(dir, stepScript(FILE, "Remove the token file"), { RUNNER_TEMP: dir });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(fs.readdirSync(dir).filter((f) => f !== "step.sh").sort(), ["other"]);
});

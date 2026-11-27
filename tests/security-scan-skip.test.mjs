// security-scan's "Skip an edit or a push that a recorded scan already
// covers" step, read from the workflow and run against the stub gh. The
// settings job runs the same script before the scan job and passes the
// skip on, so a covered event starts no scan job.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ghCalls, root, stubGh, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const FILE = "security-scan.yml";
const script = stepScript(FILE, "Skip an edit or a push that a recorded scan already covers");
const earlyScript = stepScript(
  FILE,
  "Skip an edit or a push that a recorded scan already covers, before the scan job",
);
const passScript = stepScript(FILE, "Pass the settings on");
const HEAD = "a".repeat(40);
const BASE_SHA = "b".repeat(40);

function record(head, base) {
  return [
    "<!-- security-scan-record -->",
    "## Security scan",
    "",
    `Security scan record: scanned head ${head} against main at ${base} on 2026-11-16.`,
  ].join("\n");
}

// Runs a copy of the step on this event; returns its output, what it wrote
// to GITHUB_ENV and the gh calls it made. A comment is its body (the bot's,
// id 70) or { id, login, body }; each id reads as its latest comment.
function skipStep(t, { run = script, action = "edited", mode = "push", comments = [], baseNow = BASE_SHA }) {
  const dir = tempDir(t);
  const list = comments.map((c) => ({
    id: 70,
    login: "github-actions[bot]",
    ...(typeof c === "string" ? { body: c } : c),
  }));
  const byId = new Map(list.map((c) => [c.id, c.body]));
  if (!byId.size) byId.set(70, "");
  const stub = stubGh(dir, [
    {
      match: "^api --paginate repos/acme/widgets/issues/7/comments --jq ",
      json: list.map(({ id, login, body }) => ({ id, user: { login }, body })),
    },
    ...[...byId].map(([id, body]) => ({
      match: `^api repos/acme/widgets/issues/comments/${id} --jq `,
      json: { body },
    })),
    {
      match: "^api --method PATCH repos/acme/widgets/issues/comments/",
      stdout: "https://github.com/acme/widgets/pull/7#issuecomment-1\n",
    },
    {
      match: "^api --method GET repos/acme/widgets/git/ref/heads/main --jq ",
      json: { object: { sha: baseNow } },
    },
  ]);
  const githubEnv = path.join(dir, "github-env");
  fs.writeFileSync(githubEnv, "");
  const r = runStep(dir, run, {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    GITHUB_ENV: githubEnv,
    GITHUB_RUN_ID: "1001",
    REPO: "acme/widgets",
    PR: "7",
    HEAD,
    BASE: "main",
    ACTION: action,
    MODE: mode,
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return { out: r.stdout, env: fs.readFileSync(githubEnv, "utf8"), calls: ghCalls(stub) };
}

test("the settings job's early copy is the scan job's step, byte for byte", () => {
  assert.equal(earlyScript, script);
});

test("an edit the record covers skips, in the early copy too, and writes nothing", (t) => {
  for (const run of [script, earlyScript]) {
    const { out, env, calls } = skipStep(t, { run, comments: [record(HEAD, BASE_SHA)] });
    assert.match(out, /nothing to scan/);
    assert.equal(env, "RUN=false\n");
    assert.ok(calls.every((c) => !c.args.includes("PATCH")), "no comment is edited");
  }
});

test("an edit after the base moved scans", (t) => {
  const { out, env } = skipStep(t, {
    comments: [record(HEAD, BASE_SHA)],
    baseNow: "c".repeat(40),
  });
  assert.match(out, /does not cover/);
  assert.equal(env, "");
});

test("an edit of a later head scans in mode push and skips in mode open", (t) => {
  const older = record("d".repeat(40), BASE_SHA);
  assert.equal(skipStep(t, { comments: [older] }).env, "");
  assert.equal(skipStep(t, { comments: [older], mode: "open" }).env, "RUN=false\n");
});

test("a push in mode open skips once a scan has completed, and scans before", (t) => {
  const done = skipStep(t, {
    run: earlyScript,
    action: "synchronize",
    mode: "open",
    comments: [record("d".repeat(40), BASE_SHA)],
  });
  assert.match(done.out, /a push is not scanned/);
  assert.equal(done.env, "RUN=false\n");
  const none = skipStep(t, { run: earlyScript, action: "synchronize", mode: "open" });
  assert.match(none.out, /no scan has completed/);
  assert.equal(none.env, "");
});

// A record carrying the not-completed notice of this run (1001) or another.
function withNotice(head, base, run = "1001") {
  return [
    "<!-- security-scan-record -->",
    "<!-- scan-not-completed -->",
    `<!-- scan-not-completed-run ${run} -->`,
    "### Security scan: the latest run did not complete",
    "<!-- /scan-not-completed -->",
    record(head, base).split("\n").slice(1).join("\n"),
  ].join("\n");
}
const patches = (calls) => calls.filter((c) => c.args.includes("PATCH"));

test("a re-run that the record covers takes its own not-completed notice down, in both copies", (t) => {
  for (const run of [script, earlyScript])
    for (const [action, mode] of [["edited", "push"], ["synchronize", "open"]]) {
      const own = skipStep(t, { run, action, mode, comments: [withNotice(HEAD, BASE_SHA)] });
      assert.equal(own.env, "RUN=false\n");
      assert.match(own.out, /removed this run's not-completed notice/);
      const [patch] = patches(own.calls);
      assert.ok(patch, `${action}: the notice comes down`);
      assert.deepEqual(patch.args.slice(0, 4), ["api", "--method", "PATCH", "repos/acme/widgets/issues/comments/70"]);
      assert.equal(patch.args[5], `body=${record(HEAD, BASE_SHA)}`);
      // Another run's notice stays: a later scan replaces it.
      const other = skipStep(t, { run, action, mode, comments: [withNotice(HEAD, BASE_SHA, "1000")] });
      assert.equal(other.env, "RUN=false\n");
      assert.deepEqual(patches(other.calls), []);
    }
});

test("only the bot's comments that start with the record's marker count, for the record and the notice", (t) => {
  for (const run of [script, earlyScript]) {
    // The notice is on the bot's record; a later look-alike by someone
    // else, or a bot comment that only quotes a record, is not touched.
    const r = skipStep(t, {
      run,
      comments: [
        { id: 70, body: withNotice(HEAD, BASE_SHA) },
        { id: 71, login: "mallory", body: withNotice(HEAD, BASE_SHA) },
        { id: 72, body: `Quoted:\n${withNotice(HEAD, BASE_SHA)}` },
      ],
    });
    assert.equal(r.env, "RUN=false\n");
    assert.deepEqual(
      patches(r.calls).map((c) => c.args[3]),
      ["repos/acme/widgets/issues/comments/70"],
    );
    // Neither look-alike stands for a scan of this head.
    for (const fake of [
      { id: 71, login: "mallory", body: record(HEAD, BASE_SHA) },
      { id: 72, body: `Quoted:\n${record(HEAD, BASE_SHA).split("\n").slice(1).join("\n")}` },
    ]) {
      const f = skipStep(t, { run, comments: [record("d".repeat(40), BASE_SHA), fake] });
      assert.match(f.out, /does not cover/);
      assert.equal(f.env, "");
    }
  }
});

// The pass step with these settings and RUN, as the settings job leaves them.
function pass(t, run) {
  const dir = tempDir(t);
  const output = path.join(dir, "github-output");
  fs.writeFileSync(output, "");
  const r = runStep(dir, passScript, {
    GITHUB_OUTPUT: output,
    SETTINGS: "KIT_SECURITY_SCAN",
    KIT_SECURITY_SCAN: "open",
    ...(run === undefined ? {} : { RUN: run }),
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return fs.readFileSync(output, "utf8");
}

test("the settings job passes the early skip on, and only a skip", (t) => {
  assert.equal(pass(t, "false"), "KIT_SECURITY_SCAN=open\nSKIP=true\n");
  assert.equal(pass(t), "KIT_SECURITY_SCAN=open\n");
});

test("the scan job does not start after an early skip, and the settings job runs on ubuntu-slim", () => {
  const text = fs.readFileSync(path.join(root, ".github/workflows", FILE), "utf8");
  const settings = text.slice(text.indexOf("\n  settings:\n"), text.indexOf("\n  security:\n"));
  const scan = text.slice(text.indexOf("\n  security:\n"));
  assert.match(settings, /\n    runs-on: ubuntu-slim\n/);
  assert.match(scan, /\n    if: .*needs\.settings\.outputs\.SKIP != 'true'/);
  assert.match(settings, /\n      SKIP: \$\{\{ steps\.pass\.outputs\.SKIP \}\}\n/);
});

test("the early step runs only on a first attempt, with the job copy's env", () => {
  const text = fs.readFileSync(path.join(root, ".github/workflows", FILE), "utf8");
  const meta = (name) => {
    const at = text.indexOf(`\n      - name: ${name}\n`);
    assert.notEqual(at, -1, `no step named ${name}`);
    const rest = text.slice(at + 1).split("\n");
    const end = rest.findIndex((l) => /^ {8}run: \|$/.test(l));
    const head = rest.slice(1, end).join("\n");
    const cond = (head.match(/^ {8}if: (?:>-)?([\s\S]*?)(?=\n {8}\S)/m) ?? ["", ""])[1]
      .replace(/\s+/g, " ")
      .trim();
    const env = [...head.matchAll(/^ {10}([A-Z_]+):/gm)].map((m) => m[1]).sort();
    return { cond, env };
  };
  const job = meta("Skip an edit or a push that a recorded scan already covers");
  const early = meta("Skip an edit or a push that a recorded scan already covers, before the scan job");
  assert.equal(
    early.cond,
    "github.run_attempt == 1 && (env.KIT_SECURITY_SCAN == 'push' || env.KIT_SECURITY_SCAN == 'open') && " +
      `(${job.cond})`,
  );
  assert.deepEqual(early.env, job.env);
});

test("a record gone by the notice lookup leaves the skip and edits nothing, in both copies", (t) => {
  for (const run of [script, earlyScript]) {
    const dir = tempDir(t);
    const stub = stubGh(dir, [
      {
        match: "^api --paginate repos/acme/widgets/issues/7/comments --jq .*security-scan-record.*\\| \\.body'?$",
        json: [{ id: 70, user: { login: "github-actions[bot]" }, body: withNotice(HEAD, BASE_SHA) }],
      },
      // Deleted between the two reads.
      { match: "^api --paginate repos/acme/widgets/issues/7/comments", json: [] },
      { match: "^api --method GET repos/acme/widgets/git/ref/heads/main --jq ", json: { object: { sha: BASE_SHA } } },
    ]);
    const githubEnv = path.join(dir, "github-env");
    fs.writeFileSync(githubEnv, "");
    const r = runStep(dir, run, {
      PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
      GH_STUB_RULES: stub.rulesFile,
      GH_STUB_LOG: stub.log,
      GITHUB_ENV: githubEnv,
      GITHUB_RUN_ID: "1001",
      REPO: "acme/widgets",
      PR: "7",
      HEAD,
      BASE: "main",
      ACTION: "edited",
      MODE: "push",
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(fs.readFileSync(githubEnv, "utf8"), "RUN=false\n");
    assert.deepEqual(
      ghCalls(stub).filter((c) => c.args.some((a) => /issues\/comments\//.test(a))),
      [],
    );
  }
});

test("a failed notice lookup leaves no skip behind", (t) => {
  const dir = tempDir(t);
  const stub = stubGh(dir, [
    {
      match: "^api --paginate repos/acme/widgets/issues/7/comments --jq .*security-scan-record.*\\| \\.body'?$",
      json: [{ id: 70, user: { login: "github-actions[bot]" }, body: record(HEAD, BASE_SHA) }],
    },
    { match: "^api --paginate repos/acme/widgets/issues/7/comments", stderr: "HTTP 502", status: 1 },
    {
      match: "^api --method GET repos/acme/widgets/git/ref/heads/main --jq ",
      json: { object: { sha: BASE_SHA } },
    },
  ]);
  const githubEnv = path.join(dir, "github-env");
  fs.writeFileSync(githubEnv, "");
  const r = runStep(dir, earlyScript, {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    GITHUB_ENV: githubEnv,
    GITHUB_RUN_ID: "1001",
    REPO: "acme/widgets",
    PR: "7",
    HEAD,
    BASE: "main",
    ACTION: "edited",
    MODE: "push",
  });
  assert.notEqual(r.status, 0);
  assert.equal(fs.readFileSync(githubEnv, "utf8"), "");
});

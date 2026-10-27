// The settings job of each workflow: its first step, which reads
// .github/gh-agent-kit.yml from the default branch and the repository
// variables, run against the stub gh; the checks that the four copies of
// it agree with each other, with the workflows' jobs and with the setup
// guide; the validation steps' errors naming a setting's source; and the
// review's skip steps, which now look past runs whose review job was
// skipped.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { ghCalls, root, stubGh, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const READ = "Read the settings file and variables";
const WORKFLOWS = {
  "pr-review.yml": { job: "review", switch: "KIT_REVIEW_MODE" },
  "security-scan.yml": { job: "security", switch: "KIT_SECURITY_SCAN" },
  "issue-triage.yml": { job: "triage", switch: "KIT_ISSUE_TRIAGE" },
  "kit-update-check.yml": { job: "check", switch: "KIT_UPDATE_CHECK" },
};
const CONTENTS = "^api repos/acme/widgets/contents/\\.github/gh-agent-kit\\.yml ";

function workflow(file) {
  return fs.readFileSync(path.join(root, ".github/workflows", file), "utf8");
}

// The names listed under the settings job's SETTINGS.
function settingsNames(text) {
  const m = text.match(/\n {6}SETTINGS: >-\n((?: {8}KIT_\w+\n)+)/);
  assert.ok(m, "no SETTINGS list");
  return m[1].trim().split(/\s+/);
}

function knownNames() {
  const m = stepScript("pr-review.yml", READ).match(/^known=\(\n([\s\S]*?)\n\)$/m);
  assert.ok(m, "no known list");
  return m[1].trim().split(/\s+/);
}

// The read step against a stub gh that serves `file` (a string), a 404
// (null) or the given rule.
function read(
  t,
  { file = null, vars = {}, settings = "KIT_REVIEW_MODE KIT_REVIEW_MAX_TURNS", rule } = {},
) {
  const dir = tempDir(t);
  const contents =
    rule ??
    (file === null
      ? { match: CONTENTS, stderr: "gh: Not Found (HTTP 404)\n", status: 1 }
      : {
          match: CONTENTS,
          json: {
            type: "file",
            size: Buffer.byteLength(file),
            content: Buffer.from(file).toString("base64"),
          },
        });
  const stub = stubGh(dir, [contents]);
  const envFile = path.join(dir, "github-env");
  fs.writeFileSync(envFile, "");
  const r = runStep(dir, stepScript("pr-review.yml", READ), {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    GITHUB_ENV: envFile,
    REPO: "acme/widgets",
    VARS: JSON.stringify(vars),
    SETTINGS: settings,
  });
  const env = Object.fromEntries(
    fs
      .readFileSync(envFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split(/=(.*)/s).slice(0, 2)),
  );
  return { ...r, env, calls: ghCalls(stub) };
}

test("the four workflows run the same read step, over names it knows", () => {
  const script = stepScript("pr-review.yml", READ);
  const known = knownNames();
  for (const [file, { job, switch: name }] of Object.entries(WORKFLOWS)) {
    assert.equal(
      stepScript(file, READ),
      script,
      `${file}'s read step differs from pr-review.yml's`,
    );
    const text = workflow(file);
    const names = settingsNames(text);
    assert.equal(names[0], name, `${file}: the switch comes first`);
    for (const n of names) {
      assert.ok(known.includes(n), `${file}: ${n} is not in the known list`);
      // Each is an output of the settings job and, but for the update
      // check, which reads only its switch, in the main job's env.
      assert.ok(
        text.includes(`      ${n}: \${{ steps.pass.outputs.${n} }}\n`),
        `${file}: no output ${n}`,
      );
      if (file !== "kit-update-check.yml")
        assert.ok(
          text.includes(`      ${n}: \${{ needs.settings.outputs.${n} }}\n`),
          `${file}: ${n} not in the job env`,
        );
    }
    // The main job waits for the settings and takes its switch from them.
    const main = text.slice(text.indexOf(`\n  ${job}:\n`));
    assert.match(
      main,
      /\n {4}needs: settings\n(?: {4}#.*\n)* {4}if: (\$\{\{ !cancelled\(\) && \(needs\.settings\.result == 'failure' \|\| )?needs\.settings\.outputs\./,
      file,
    );
    // A newer run cancels an older one still reading its settings, so the
    // older one's main job cannot start after the newer one's.
    if (file !== "kit-update-check.yml")
      assert.match(
        text,
        new RegExp(
          `\n {4}name: ${file.slice(0, -4)} settings\n(?: {4}#.*\n)* {4}concurrency:\n {6}group: ${file.slice(0, -4)}-settings-`,
        ),
        file,
      );
    assert.doesNotMatch(text, /vars\.KIT_/, `${file} still reads a KIT_ variable directly`);
  }
  // Together the workflows read every name the step knows.
  const used = Object.keys(WORKFLOWS).flatMap((f) => settingsNames(workflow(f)));
  assert.deepEqual([...used].sort(), [...known].sort());
});

test("the setup guide lists exactly the settings the step knows", () => {
  const guide = fs.readFileSync(path.join(root, "docs/setup.md"), "utf8");
  const listed = new Set();
  for (const m of guide.matchAll(/^\| `(KIT_\w+)` \| (?!Secret)/gm)) listed.add(m[1]);
  assert.deepEqual([...listed].sort(), [...knownNames()].sort());
});

test("the file sets what no variable does, and a variable wins", (t) => {
  const file = [
    "# kit settings",
    "---",
    "KIT_REVIEW_MODE: open # on open only",
    'KIT_REVIEW_MAX_TURNS: "120"',
    "KIT_REVIEW_EFFORT:",
    "KIT_REVIEW_MODEL: 'claude-opus-5-5'\r",
    "",
  ].join("\n");
  const r = read(t, {
    file,
    vars: { KIT_REVIEW_MODEL: "claude-sonnet-5-5", OTHER: "x" },
    settings:
      "KIT_REVIEW_MODE KIT_REVIEW_MAX_TURNS KIT_REVIEW_EFFORT KIT_REVIEW_MODEL KIT_REVIEW_PROVIDER",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.env.KIT_REVIEW_MODE, "open");
  assert.equal(r.env.FROM_KIT_REVIEW_MODE, ".github/gh-agent-kit.yml line 3");
  assert.equal(r.env.KIT_REVIEW_MAX_TURNS, "120");
  assert.equal(r.env.KIT_REVIEW_EFFORT, "");
  assert.equal(r.env.FROM_KIT_REVIEW_EFFORT, "unset");
  assert.equal(r.env.KIT_REVIEW_MODEL, "claude-sonnet-5-5");
  assert.equal(r.env.FROM_KIT_REVIEW_MODEL, "the repository variable");
  assert.equal(r.env.KIT_REVIEW_PROVIDER, "");
  assert.equal(r.env.OTHER, undefined, "a name outside SETTINGS is not passed on");
  // Read from the contents API's default ref: no ref, so not a head.
  assert.equal(r.calls.length, 1);
  assert.doesNotMatch(r.calls[0].args.join(" "), /ref=/);
});

test("no file leaves the variables and the defaults", (t) => {
  const r = read(t, { vars: { KIT_REVIEW_MODE: "push" } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /no \.github\/gh-agent-kit\.yml on the default branch/);
  assert.equal(r.env.KIT_REVIEW_MODE, "push");
  assert.equal(r.env.KIT_REVIEW_MAX_TURNS, "");
});

test("a file that cannot be read fails the run instead of using the defaults", (t) => {
  const r = read(t, {
    rule: { match: CONTENTS, stderr: "gh: Server Error (HTTP 500)\n", status: 1 },
  });
  assert.equal(r.status, 1);
  assert.match(
    r.stdout,
    /::error::could not read \.github\/gh-agent-kit\.yml from the default branch/,
  );
  const dir = read(t, { rule: { match: CONTENTS, json: [{ type: "file" }] } });
  assert.equal(dir.status, 1, "a directory at the path is refused");
  const big = read(t, {
    rule: { match: CONTENTS, json: { type: "file", size: 20000, content: "" } },
  });
  assert.equal(big.status, 1, "a file over 16 KiB is refused");
});

test("a line the kit does not read fails the run, naming the line but never printing it", (t) => {
  for (const [file, message] of [
    ["KIT_REVIEW_MODE: open\nANTHROPIC_API_KEY: sk-ant-not-a-key\n", /line 2 names a secret/],
    ["KIT_READ_TOKEN: ghp_not-a-token\n", /line 1 names a secret/],
    ["KIT_REVIEW_MOD: open\n", /line 1: KIT_REVIEW_MOD is not a setting the kit reads/],
    ["DEBUG: on\n", /line 1 is not a kit setting/],
    ["review:\n  mode: open\n", /line 1 is not a NAME: value line/],
    ["  KIT_REVIEW_MODE: open\n", /line 1 is not a NAME: value line/],
    [
      "KIT_REVIEW_MODE: open\nKIT_REVIEW_MODE: push\n",
      /sets KIT_REVIEW_MODE twice, on lines 1 and 2/,
    ],
    ["KIT_REVIEW_MODE:open\n", /line 1: KIT_REVIEW_MODE must be one word or number/],
    ["KIT_REVIEW_MODE: open#x\n", /line 1: KIT_REVIEW_MODE must be one word or number/],
    ["KIT_REVIEW_MODE: [open]\n", /line 1: KIT_REVIEW_MODE must be one word or number/],
    ["KIT_REVIEW_MODE: open push\n", /line 1: KIT_REVIEW_MODE must be one word or number/],
    ['KIT_REVIEW_MODE: "open\\n"\n', /line 1: KIT_REVIEW_MODE must be one word or number/],
  ]) {
    const r = read(t, { file });
    assert.equal(r.status, 1, file);
    assert.match(r.stdout, message, file);
    for (const secret of ["sk-ant-not-a-key", "ghp_not-a-token"])
      assert.ok(
        !r.stdout.includes(secret) && !r.stderr.includes(secret),
        `${file} printed a value`,
      );
  }
});

test("a variable that is not one word fails before it reaches GITHUB_ENV", (t) => {
  const r = read(t, { vars: { KIT_REVIEW_MODE: "open\nBASH_ENV=/tmp/x" } });
  assert.equal(r.status, 1);
  assert.match(
    r.stdout,
    /the setting KIT_REVIEW_MODE must be one word or number.*\(the repository variable\)/,
  );
  assert.equal(r.env.BASH_ENV, undefined);
});

test("a value out of range names where it came from", (t) => {
  for (const [file, step, env, message] of [
    [
      "pr-review.yml",
      "Read the review settings",
      { MAX_TURNS: "9999", FROM_KIT_REVIEW_MAX_TURNS: ".github/gh-agent-kit.yml line 4" },
      /the setting KIT_REVIEW_MAX_TURNS must be a whole number from 1 to 500, not '9999' \(\.github\/gh-agent-kit\.yml line 4\)/,
    ],
    [
      "security-scan.yml",
      "Read the scan settings",
      { PROVIDER: "openai", FROM_KIT_SECURITY_PROVIDER: "the repository variable" },
      /the setting KIT_SECURITY_PROVIDER must be anthropic, opencode-go or unset, not 'openai' \(the repository variable\)/,
    ],
    [
      "issue-triage.yml",
      "Read the triage settings",
      { TIMEOUT: "0", FROM_KIT_TRIAGE_TIMEOUT_MINUTES: ".github/gh-agent-kit.yml line 2" },
      /the setting KIT_TRIAGE_TIMEOUT_MINUTES must be a whole number from 1 to 360, not '0' \(\.github\/gh-agent-kit\.yml line 2\)/,
    ],
  ]) {
    const dir = tempDir(t);
    const envFile = path.join(dir, "github-env");
    fs.writeFileSync(envFile, "");
    const r = runStep(dir, stepScript(file, step), { GITHUB_ENV: envFile, ...env });
    assert.equal(r.status, 1, file);
    assert.match(r.stdout, message, file);
  }
});

test("the pass step hands every setting on as an output", (t) => {
  const dir = tempDir(t);
  const out = path.join(dir, "github-output");
  fs.writeFileSync(out, "");
  const r = runStep(dir, stepScript("security-scan.yml", "Pass the settings on"), {
    GITHUB_OUTPUT: out,
    SETTINGS: "KIT_SECURITY_SCAN KIT_SECURITY_MODEL KIT_SECURITY_EFFORT",
    KIT_SECURITY_SCAN: "open",
    KIT_SECURITY_MODEL: "claude-opus-5-5",
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(
    fs.readFileSync(out, "utf8"),
    "KIT_SECURITY_SCAN=open\nKIT_SECURITY_MODEL=claude-opus-5-5\nKIT_SECURITY_EFFORT=\n",
  );
});

// With a settings job, a run whose review job was skipped (the review off)
// concludes "success", so the skip steps look at the review job itself.
const PUSH_SKIP = 'Skip a push in mode "open" once a review succeeded';
const HEAD = "a".repeat(40);
function pushSkip(t, runs) {
  const dir = tempDir(t);
  const report = `## Review R1: Approve\n\nHead reviewed: ${HEAD}\n`;
  const rules = [
    {
      match: "^api --paginate repos/acme/widgets/issues/7/comments ",
      json: [{ user: { login: "github-actions[bot]" }, body: report }],
    },
    {
      match: `^api --method GET repos/acme/widgets/actions/workflows/pr-review\\.yml/runs\\?head_sha=${HEAD}&per_page=100 `,
      json: {
        workflow_runs: runs.map(({ id, updated, conclusion }) => ({
          id,
          updated_at: updated,
          status: "completed",
          conclusion,
        })),
      },
    },
    ...runs.map(({ id, review }) => ({
      match: `^api repos/acme/widgets/actions/runs/${id}/jobs `,
      json: {
        jobs: [
          { name: "pr-review settings", conclusion: "success" },
          ...(review ? [{ name: "pr-review", conclusion: review }] : []),
        ],
      },
    })),
  ];
  const stub = stubGh(dir, rules);
  const envFile = path.join(dir, "github-env");
  fs.writeFileSync(envFile, "");
  const r = runStep(dir, stepScript("pr-review.yml", PUSH_SKIP), {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    GITHUB_ENV: envFile,
    GITHUB_RUN_ID: "99",
    REPO: "acme/widgets",
    PR: "7",
    WORKFLOW_FILE: "acme/widgets/.github/workflows/pr-review.yml@refs/pull/7/merge",
  });
  return { ...r, skipped: fs.readFileSync(envFile, "utf8").includes("RUN=false") };
}

test("a run whose review job was skipped does not stand for a review", (t) => {
  // The newest run is the review switched off (its review job skipped);
  // the one before it reviewed successfully.
  const off = pushSkip(t, [
    { id: 1, updated: "2026-10-26T01:00:00Z", conclusion: "success", review: "success" },
    { id: 2, updated: "2026-10-26T02:00:00Z", conclusion: "success", review: "skipped" },
  ]);
  assert.equal(off.status, 0, off.stdout + off.stderr);
  assert.ok(off.skipped, off.stdout);

  // The review failed, and a later run with the review off must not turn
  // that into a success.
  const failed = pushSkip(t, [
    { id: 1, updated: "2026-10-26T01:00:00Z", conclusion: "failure", review: "failure" },
    { id: 2, updated: "2026-10-26T02:00:00Z", conclusion: "success", review: null },
  ]);
  assert.equal(failed.status, 0, failed.stdout + failed.stderr);
  assert.ok(!failed.skipped, failed.stdout);
  assert.match(failed.stdout, /concluded 'failure'; reviewing this head/);

  const none = pushSkip(t, [
    { id: 2, updated: "2026-10-26T02:00:00Z", conclusion: "success", review: "skipped" },
  ]);
  assert.ok(!none.skipped);
  assert.match(none.stdout, /concluded 'none'/);
});

// A failed settings job must not leave the review or the scan skipped,
// which branch protection reads as passing and which leaves an earlier
// verdict or record standing: the main job runs and fails first thing.
test("the review and the scan fail, rather than skip, when the settings job fails", () => {
  for (const [file, job, before] of [
    [
      "pr-review.yml",
      "review",
      "Refuse a pull request event from an author or actor without write access",
    ],
    ["security-scan.yml", "security", null],
  ]) {
    const text = workflow(file);
    const main = text.slice(text.indexOf(`\n  ${job}:\n`));
    assert.match(
      main,
      /\n {4}if: \$\{\{ !cancelled\(\) && \(needs\.settings\.result == 'failure' \|\| /,
      file,
    );
    const steps = [...main.matchAll(/^ {6}- (?:name|uses): (.*)$/gm)].map((m) => m[1]);
    const at = steps.indexOf("Fail when the settings job failed");
    assert.equal(at, before ? steps.indexOf(before) + 1 : 0, `${file}: ${steps.slice(0, 3)}`);
    assert.match(
      main,
      /- name: Fail when the settings job failed\n {8}if: needs\.settings\.result == 'failure'\n/,
    );
  }
});

// When the settings job failed, the scan's mode is unknown, so the notice
// says neither mode's rule.
test("the scan's notice names no mode when the settings job failed", (t) => {
  const dir = tempDir(t);
  const temp = path.join(dir, "temp");
  fs.mkdirSync(temp);
  const record = "<!-- security-scan-record -->\nSecurity scan record: scanned head x";
  const stub = stubGh(dir, [
    {
      match: "^api --paginate repos/acme/widgets/issues/7/comments",
      json: [{ id: 5, user: { login: "github-actions[bot]" }, body: record }],
    },
    { match: "^api repos/acme/widgets/issues/comments/5 ", json: { body: record } },
    { match: "^api --method PATCH repos/acme/widgets/issues/comments/5", stdout: "u\n" },
  ]);
  const r = runStep(dir, stepScript("security-scan.yml", "Record that the scan did not complete"), {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    RUNNER_TEMP: temp,
    REPO: "acme/widgets",
    PR: "7",
    HEAD: "b".repeat(40),
    MODE: "",
    JOB_STATUS: "failure",
    GITHUB_RUN_ID: "1",
    RUN_URL: "https://github.com/acme/widgets/actions/runs/1/attempts/1",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const patch = ghCalls(stub).find((c) => c.args.includes("PATCH"));
  const body = patch.args[patch.args.indexOf("-f") + 1];
  assert.match(body, /Fix the settings the run's log names, then re-run it to scan again\./);
  assert.doesNotMatch(body, /mode open|push to scan again/);
});

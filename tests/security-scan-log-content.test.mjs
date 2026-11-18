// The security scan's log and the public-content check: on a repository
// whose base branch ships a check, the model's text the steps before the
// findings' hold would print (the run summaries with the model's last
// message, a schema failure's excerpt, the dropped candidates) reaches the
// log only once the base's check passes it, and a check that cannot run
// withholds it; without a base check the log is as before. The steps that
// run a model never get PRIVATE_REPO_NAMES. Steps are read from the
// workflow and run with bash, the CLI a stub.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { root, tempDir } from "./helpers/server.mjs";
import { publicContentGuard, runStep, stepScript } from "./helpers/workflow.mjs";

const FILE = "security-scan.yml";
const WORKFLOW = fs.readFileSync(path.join(root, ".github/workflows", FILE), "utf8");
const CHECK = fs.readFileSync(path.join(root, ".github/scripts/public-content.mjs"), "utf8");
const MJS = ".github/scripts/public-content.mjs";
// What the check finds, built from parts so this file passes it.
const at = (...parts) => parts.join("");
const HOME_PATH = at("/ho", "me/dra/notes.txt");
const RUN_STEPS = [
  "Run the scan",
  "Run the scan on OpenCode",
  "Verify the candidate findings",
  "Verify the candidate findings on OpenCode",
];

// A step's lines from its name to the next step, and its index.
function step(name) {
  const lines = WORKFLOW.split("\n");
  const start = lines.findIndex(
    (l) => l.trim() === `- name: ${name}` || l.trim() === `name: ${name}`,
  );
  assert.notEqual(start, -1, name);
  let end = start + 1;
  while (end < lines.length && !/^ {6}- (name|id|uses):/.test(lines[end])) end++;
  return { start, block: lines.slice(start, end).join("\n") };
}

// RUNNER_TEMP with the guard for a base holding baseFiles and the symlinks
// baseLinks, and a step runner.
function runner(t, baseFiles = {}, baseLinks = {}) {
  const dir = tempDir(t);
  const temp = path.join(dir, "runner-temp");
  const input = path.join(temp, "scan-input");
  fs.mkdirSync(input, { recursive: true });
  const find = publicContentGuard(t, temp, baseFiles, baseLinks);
  const run = (script, env = {}) =>
    runStep(dir, script, { RUNNER_TEMP: temp, SCAN_INPUT: input, ...env });
  return { dir, temp, input, find, run, file: (name) => path.join(temp, name) };
}

// The Claude Code run step with the CLI a stub that answers a successful
// run whose last message is text.
function claudeRun(r, name, text) {
  for (const f of ["scan-schema.json", "verify-schema.json", "claude-settings.json"]) {
    fs.writeFileSync(r.file(f), "{}");
  }
  const answer = path.join(r.dir, "answer.json");
  fs.writeFileSync(
    answer,
    JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      num_turns: 2,
      total_cost_usd: 0.5,
      usage: {
        input_tokens: 1,
        cache_read_input_tokens: 2,
        cache_creation_input_tokens: 3,
        output_tokens: 4,
      },
      result: text,
    }),
  );
  const stub = path.join(r.dir, "claude");
  fs.writeFileSync(
    stub,
    `#!/bin/bash\nenv > "${path.join(r.dir, "seen-env")}"\ncat "${answer}"\n`,
    { mode: 0o755 },
  );
  return r.run(stepScript(FILE, name).replaceAll("/opt/agent-kit/claude", stub), {
    RESULT: r.file("result.json"),
    HELD: r.file("run-log"),
    CANDIDATES: "1",
    KIT_SECURITY_PROVIDER: "anthropic",
    KIT_SECURITY_MODEL: "the-model",
    KIT_SECURITY_EFFORT: "",
    ANTHROPIC_API_KEY: "ak",
  });
}
const printScan = stepScript(FILE, "Print the scan run's log");
const printVerify = stepScript(FILE, "Print the verification run's log");

test("the check is found before any model runs, and the secret reaches no step that runs one", () => {
  const find = step("Find the base's public-content check").start;
  assert.ok(step("Use the base branch's scan rules").start < find);
  assert.ok(find < step("Move .git out of the checkout for OpenCode").start);
  for (const name of RUN_STEPS) assert.ok(find < step(name).start, name);
  // Each print step follows its runs, with an if that holds when either ran.
  const ifOf = (name) => step(name).block.match(/\n {8}if: (.*)\n/)[1];
  assert.ok(step("Run the scan on OpenCode").start < step("Print the scan run's log").start);
  assert.ok(
    step("Print the scan run's log").start < step("Collect the scan's candidate findings").start,
  );
  assert.ok(
    step("Verify the candidate findings on OpenCode").start <
      step("Print the verification run's log").start,
  );
  assert.ok(step("Print the verification run's log").start < step("Apply the verification").start);
  assert.equal(
    ifOf("Print the scan run's log"),
    "${{ always() && env.RUN != 'false' && (steps.scan.outcome != 'skipped' || steps.scan_opencode.outcome != 'skipped') }}",
  );
  assert.equal(
    ifOf("Print the verification run's log"),
    "${{ always() && env.RUN != 'false' && (steps.verify.outcome != 'skipped' || steps.verify_opencode.outcome != 'skipped') }}",
  );
  // The secret only where the check runs, and no model runs there.
  const names = [...WORKFLOW.matchAll(/^(?: {6}- | {8})name: (.*)$/gm)].map((m) => m[1]);
  const withSecret = names.filter((name) =>
    step(name).block.includes("secrets.PRIVATE_REPO_NAMES"),
  );
  assert.deepEqual(withSecret.sort(), [
    "Apply the verification",
    "Collect the scan's candidate findings",
    "Hold the findings to the base's public-content check",
    "Print the scan run's log",
    "Print the verification run's log",
  ]);
  const code = (name) =>
    step(name)
      .block.split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .join("\n");
  for (const name of RUN_STEPS) assert.doesNotMatch(code(name), /PRIVATE_REPO_NAMES/, name);
});

test("the guard records no check, a usable one, and one that cannot be used", (t) => {
  const none = runner(t);
  assert.equal(fs.readFileSync(none.file("public-content-state"), "utf8"), "none\n");
  const ready = runner(t, { [MJS]: CHECK });
  assert.equal(
    fs.readFileSync(ready.file("public-content-state"), "utf8"),
    `ready\n${ready.file("public-content-check.mjs")}\n`,
  );
  assert.equal(fs.readFileSync(ready.file("public-content-check.mjs"), "utf8"), CHECK);
  // The log says which, never the check's text.
  assert.match(ready.find.stdout, /the base branch's public-content check holds the model's text/);
  // A check that is not a regular file cannot be used, and the state says why.
  const linked = runner(t, { "elsewhere.mjs": CHECK }, { [MJS]: "../../elsewhere.mjs" });
  const why = `${MJS} on main is not a regular file`;
  assert.equal(fs.readFileSync(linked.file("public-content-state"), "utf8"), `unusable\n${why}\n`);
  assert.equal(fs.existsSync(linked.file("public-content-check.mjs")), false);
  assert.ok(
    linked.find.stdout.includes(`the base branch's public-content check cannot be used (${why})`),
  );
  assert.ok(!linked.find.stdout.includes(CHECK.split("\n").find((l) => l.trim())));
});

for (const name of ["Run the scan", "Verify the candidate findings"]) {
  const print = name === "Run the scan" ? printScan : printVerify;

  test(`${name}: with a base check, the model's last message waits for the check, and is withheld when it refuses it`, (t) => {
    const r = runner(t, { [MJS]: CHECK });
    const run = claudeRun(r, name, `Read ${HOME_PATH} and skunkworks.`);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.doesNotMatch(run.stdout, /notes\.txt|skunkworks|^result:/m);
    assert.match(
      run.stdout,
      /the run's log text from the model waits for the repository's public-content check, in the next step/,
    );
    // The CLI ran without the secret, and so did the step.
    assert.doesNotMatch(
      fs.readFileSync(path.join(r.dir, "seen-env"), "utf8"),
      /PRIVATE_REPO_NAMES/,
    );
    const shown = r.run(print, { HELD: r.file("run-log"), PRIVATE_REPO_NAMES: "skunkworks" });
    assert.equal(shown.status, 0, shown.stdout + shown.stderr);
    assert.doesNotMatch(shown.stdout + shown.stderr, /notes\.txt|skunkworks/);
    assert.match(
      shown.stdout,
      /^the run's log text is withheld: the repository's public-content check found in it a local or project-storage path; a private repository name$/m,
    );
    assert.ok(!fs.existsSync(r.file("run-log")));
  });

  test(`${name}: with a base check that passes it, the summary is printed with commands stopped`, (t) => {
    const r = runner(t, { [MJS]: CHECK });
    const run = claudeRun(r, name, "All fine.\n::error::steered");
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.doesNotMatch(run.stdout, /All fine/);
    // The lines the workflow writes go to the log at once.
    assert.match(
      run.stdout,
      /^subtype: success\nis_error: false\nturns: 2\ncost_usd: 0\.5\ntokens: input 1, cache read 2, cache write 3, output 4\n::[0-9a-f]{32}::$/m,
    );
    const shown = r.run(print, { HELD: r.file("run-log"), PRIVATE_REPO_NAMES: "skunkworks" });
    assert.equal(shown.status, 0, shown.stdout + shown.stderr);
    const lines = shown.stdout.split("\n");
    const begin = lines.findIndex((l) => /^::stop-commands::[0-9a-f]{32}$/.test(l));
    assert.notEqual(begin, -1, shown.stdout);
    const end = lines.indexOf(`::${lines[begin].slice("::stop-commands::".length)}::`);
    assert.deepEqual(lines.slice(begin + 1, end), [
      "errors: ",
      "result: All fine.",
      "::error::steered",
    ]);
  });

  test(`${name}: a base check that cannot run withholds the summary`, (t) => {
    const r = runner(t, { [MJS]: "process.exit(2);\n" });
    assert.equal(claudeRun(r, name, "All fine.").status, 0);
    const shown = r.run(print, { HELD: r.file("run-log") });
    assert.equal(shown.status, 0, shown.stdout + shown.stderr);
    assert.match(
      shown.stdout,
      /^::warning::the repository's public-content check could not run \(exit 2\), so the run's log text is withheld$/m,
    );
    assert.doesNotMatch(shown.stdout, /All fine/);
  });

  test(`${name}: without a base check, the run prints its summary and the next step prints nothing`, (t) => {
    const r = runner(t);
    const run = claudeRun(r, name, `Read ${HOME_PATH}.`);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /^result: Read .*notes\.txt\.$/m);
    assert.doesNotMatch(run.stdout, /waits for/);
    const shown = r.run(print, { HELD: r.file("run-log") });
    assert.equal(shown.status, 0, shown.stdout + shown.stderr);
    assert.equal(shown.stdout, "");
  });
}

test("without the guard, the hold step fails and leaves its marker, and the run and print steps fail before printing", (t) => {
  const r = runner(t, { [MJS]: CHECK });
  fs.rmSync(r.file("public-content-guard.sh"));
  fs.writeFileSync(
    r.file("scan-results.json"),
    JSON.stringify({
      findings: [
        {
          file: "app/api.js",
          line: 1,
          category: "x",
          description: HOME_PATH,
          _filter_metadata: { verified: true },
        },
      ],
      analysis_summary: { review_completed: true },
    }),
  );
  const hold = r.run(stepScript(FILE, "Hold the findings to the base's public-content check"), {
    RESULTS: r.file("scan-results.json"),
  });
  assert.equal(hold.status, 1, hold.stdout + hold.stderr);
  assert.ok(fs.existsSync(r.file("scan-content-pending")));
  assert.doesNotMatch(hold.stdout, /notes\.txt/);
  const run = claudeRun(r, "Run the scan", `Read ${HOME_PATH}.`);
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.doesNotMatch(run.stdout, /notes\.txt|^result:/m);
  fs.writeFileSync(r.file("run-log"), `result: Read ${HOME_PATH}.\n`);
  const shown = r.run(printScan, { HELD: r.file("run-log") });
  assert.equal(shown.status, 1, shown.stdout + shown.stderr);
  assert.equal(shown.stdout, "");
});

test("a base check whose state is missing withholds the text", (t) => {
  const r = runner(t, { [MJS]: CHECK });
  fs.rmSync(r.file("public-content-state"));
  fs.writeFileSync(r.file("run-log"), "result: All fine.\n");
  const shown = r.run(printScan, { HELD: r.file("run-log") });
  assert.equal(shown.status, 0, shown.stdout + shown.stderr);
  assert.match(shown.stdout, /could not run \(the step that looks it up left no state\)/);
  assert.doesNotMatch(shown.stdout, /All fine/);
});

// A CLI result object with this structured output.
const result = (structured) => ({
  type: "result",
  subtype: "success",
  is_error: false,
  structured_output: structured,
});

test("a scan answer that fails the schema shows its excerpt only when the check passes it", (t) => {
  const collect = stepScript(FILE, "Collect the scan's candidate findings");
  for (const [baseFiles, text, shown] of [
    [
      { [MJS]: CHECK },
      `see ${HOME_PATH}`,
      /no scan completed: \(withheld: the repository's public-content check found in it a local or project-storage path\)$/m,
    ],
    [{ [MJS]: CHECK }, "plain words", /no scan completed: \{"note":"plain words"\}$/m],
    [
      { [MJS]: "process.exit(2);\n" },
      "plain words",
      /no scan completed: \(withheld: the repository's public-content check could not run: exit 2\)$/m,
    ],
    [{}, `see ${HOME_PATH}`, /no scan completed: \{"note":"see .*notes\.txt"\}$/m],
  ]) {
    const r = runner(t, baseFiles);
    fs.writeFileSync(r.file("scan-result.json"), JSON.stringify(result({ note: text })));
    const step = r.run(collect, {
      RESULT: r.file("scan-result.json"),
      GITHUB_ENV: r.file("github-env"),
    });
    assert.equal(step.status, 1, step.stdout + step.stderr);
    assert.match(step.stdout, shown);
  }
});

test("the verification's schema failure and dropped candidates reach the log only when the check passes them", (t) => {
  const apply = stepScript(FILE, "Apply the verification");
  const finding = (over = {}) => ({
    file: "app/api.js",
    line: 12,
    severity: "HIGH",
    category: "command_injection",
    description: "The branch name reaches a shell command.",
    exploit_scenario: "A collaborator names a branch.",
    recommendation: "Pass the name through an environment variable.",
    confidence: 0.9,
    ...over,
  });
  const setup = (baseFiles, verify) => {
    const r = runner(t, baseFiles);
    fs.writeFileSync(
      path.join(r.input, "candidates.json"),
      JSON.stringify({
        findings: [finding({ id: "F1" }), finding({ id: "F2", line: 40 })],
        analysis_summary: { files_reviewed: 2, review_completed: true },
      }),
    );
    fs.writeFileSync(r.file("verify-result.json"), JSON.stringify(verify));
    return r.run(apply, {
      RESULT: r.file("verify-result.json"),
      RESULTS: r.file("scan-results.json"),
      PRIVATE_REPO_NAMES: "skunkworks",
    });
  };
  const verdicts = (reason) =>
    result({
      verdicts: [
        { id: "F1", keep: true, confidence: 9, reason: "traced" },
        { id: "F2", keep: false, confidence: 2, reason },
      ],
    });

  const refused = setup({ [MJS]: CHECK }, verdicts("Same as in skunkworks."));
  assert.equal(refused.status, 0, refused.stdout + refused.stderr);
  assert.doesNotMatch(refused.stdout, /skunkworks|- F2 /);
  assert.match(
    refused.stdout,
    /^\(withheld: the repository's public-content check found in it a private repository name\)$/m,
  );

  const passed = setup({ [MJS]: CHECK }, verdicts("escaped at the call"));
  assert.equal(passed.status, 0, passed.stdout + passed.stderr);
  assert.match(
    passed.stdout,
    /^- F2 HIGH command_injection in app\/api\.js:40: escaped at the call$/m,
  );

  const none = setup({}, verdicts("Same as in skunkworks."));
  assert.equal(none.status, 0, none.stdout + none.stderr);
  assert.match(
    none.stdout,
    /^- F2 HIGH command_injection in app\/api\.js:40: Same as in skunkworks\.$/m,
  );

  const bad = setup({ [MJS]: CHECK }, result({ verdicts: "see skunkworks" }));
  assert.equal(bad.status, 1, bad.stdout + bad.stderr);
  assert.match(
    bad.stdout,
    /schema asks for: \(withheld: the repository's public-content check found in it a private repository name\)$/m,
  );
  assert.doesNotMatch(bad.stdout, /skunkworks/);
});

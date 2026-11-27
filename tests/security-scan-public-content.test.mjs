// The security scan's public-content step: on a repository whose base
// branch ships a public-content check, each finding's model-written text is
// checked with the base's copy before the inline comments, the summary, the
// log and the record use it, and a refused finding is withheld from all of
// them; a check that cannot run withholds every finding; without a base
// copy the findings go as before. Steps are read from the workflow and run
// with bash, gh a stub.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { gitRepo, root, stubGh, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const FILE = "security-scan.yml";
const HOLD = "Hold the findings to the base's public-content check";
const findScript = stepScript(FILE, "Find the base's public-content check");
const holdScript = stepScript(FILE, HOLD);
const summaryScript = stepScript(FILE, "Summarise the scan's findings");
const commentScript = stepScript(FILE, "Comment on the findings' lines");
const recordScript = stepScript(FILE, "Record the completed scan");
const noticeScript = stepScript(FILE, "Record that the scan did not complete");
const TARGET_CHECK = fs.readFileSync(path.join(root, "tests/fixtures/name-list-check.mjs"), "utf8");
const CHECK = fs.readFileSync(path.join(root, ".github/scripts/public-content.mjs"), "utf8");
// What the check finds, built from parts so this file passes it.
const at = (...parts) => parts.join("");
const HOME_PATH = at("/ho", "me/dra/notes.txt");
const HEAD = "a".repeat(40);

const finding = (over = {}) => ({
  file: "app/api.js",
  line: 12,
  severity: "HIGH",
  category: "command_injection",
  description: "The branch name reaches a shell command.",
  exploit_scenario: "A collaborator names a branch and the job runs it.",
  recommendation: "Pass the name through an environment variable.",
  ...over,
});
const results = (findings) => ({
  findings: findings.map((f, i) => ({ ...f, id: `F${i + 1}`, _filter_metadata: { verified: true } })),
  analysis_summary: { review_completed: true },
  filtering_summary: { total_original_findings: findings.length, excluded_findings: 0, kept_findings: findings.length },
});

// A checkout on a feature branch whose origin/main has baseFiles, the head
// adding headFiles and one text file; RUNNER_TEMP and the scan's input
// directory beside it.
function setup(t, baseFiles = {}, headFiles = {}) {
  const repo = gitRepo(t);
  repo.commit("a.txt", "a\n", "base");
  for (const [f, content] of Object.entries(baseFiles)) repo.commit(f, content, `base ${f}`);
  const base = repo.git("rev-parse", "HEAD");
  repo.git("checkout", "-q", "-b", "feature");
  repo.commit("b.txt", "b\n", "head");
  for (const [f, content] of Object.entries(headFiles)) repo.commit(f, content, `head ${f}`);
  repo.git("update-ref", "refs/remotes/origin/main", base);
  const temp = path.join(tempDir(t), "runner-temp");
  const input = path.join(temp, "scan-input");
  fs.mkdirSync(input, { recursive: true });
  const file = (name) => path.join(temp, name);
  const write = (name, value) => fs.writeFileSync(file(name), JSON.stringify(value));
  const read = (name) => JSON.parse(fs.readFileSync(file(name), "utf8"));
  const text = (name) => (fs.existsSync(file(name)) ? fs.readFileSync(file(name), "utf8") : null);
  const env = {
    RUNNER_TEMP: temp,
    SCAN_INPUT: input,
    RESULTS: file("scan-results.json"),
    BASE: "main",
    RUN_URL: "https://github.com/acme/widgets/actions/runs/1/attempts/1",
  };
  const run = (script, more = {}) => runStep(repo.dir, script, { ...env, ...more });
  // The hold step, after the step that finds the check, as the job runs
  // them (the job runs that one before the scan).
  const hold = (more = {}) => {
    const find = run(findScript);
    assert.equal(find.status, 0, find.stdout + find.stderr);
    return run(holdScript, more);
  };
  return { repo, temp, input, file, write, read, text, run, hold };
}
const MJS = ".github/scripts/public-content.mjs";
const PY = ".github/scripts/check_public_content.py";

test("the step runs where the summary does, after the verification and before the summary", () => {
  const text = fs.readFileSync(path.join(root, ".github/workflows", FILE), "utf8");
  const stepAt = (name) => text.indexOf(`- name: ${name}\n`);
  const ifOf = (name) => text.slice(stepAt(name)).match(/\n {8}if: (.*)\n/)[1];
  assert.ok(stepAt("Apply the verification") < stepAt(HOLD));
  assert.ok(stepAt(HOLD) < stepAt("Summarise the scan's findings"));
  assert.equal(ifOf(HOLD), ifOf("Summarise the scan's findings"));
});

test("a refused finding is withheld from the comments, the summary, the log and the record; a passing one is not", (t) => {
  const s = setup(t, { [MJS]: TARGET_CHECK });
  s.write(
    "scan-results.json",
    results([
      finding({ description: `Reads ${HOME_PATH} at start-up.` }),
      finding({ line: 20 }),
      finding({ line: 30, recommendation: "Compare with skunkworks." }),
    ]),
  );
  const hold = s.hold({ PRIVATE_REPO_NAMES: "skunkworks" });
  assert.equal(hold.status, 0, hold.stdout + hold.stderr);
  assert.deepEqual(
    s.read("scan-results.json").findings.map((f) => Boolean(f._withheld)),
    [true, false, true],
  );
  assert.equal(
    s.text("scan-withheld.md"),
    "2 of the 3 findings are withheld from the inline comments, this record and the later steps' log: the repository's public-content check found in their text a local or project-storage path; a private repository name. This repository is public, so the text is not posted.\n",
  );
  assert.doesNotMatch(hold.stdout + hold.stderr, /notes\.txt|skunkworks/);

  const summary = s.run(summaryScript);
  assert.equal(summary.status, 0, summary.stdout + summary.stderr);
  assert.equal(s.text("scan-count"), "3\n");
  assert.equal(
    s.text("scan-findings.md"),
    "- **HIGH** `command_injection` in `app/api.js:20`: `The branch name reaches a shell command.`\n",
  );
  assert.match(summary.stdout, /::group::1 of the 3 findings \(the rest withheld\)/);
  assert.doesNotMatch(summary.stdout, /notes\.txt|skunkworks|api\.js:12|api\.js:30/);

  const stub = stubGh(s.repo.dir, [
    { match: "^api --paginate repos/acme/widgets/pulls/7/comments", json: [] },
    { match: "^api -X POST repos/acme/widgets/pulls/7/comments", stdout: "u\n" },
    { match: "^api --method GET repos/acme/widgets/pulls/7 ", stdout: `${s.repo.git("rev-parse", "origin/main")}\n` },
    { match: "^api --paginate repos/acme/widgets/issues/7/comments", json: [] },
    { match: "^api --method POST repos/acme/widgets/issues/7/comments", stdout: "u\n" },
  ]);
  const gh = {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    REPO: "acme/widgets",
    PR: "7",
    HEAD,
  };
  const comments = s.run(commentScript, gh);
  assert.equal(comments.status, 0, comments.stdout + comments.stderr);
  assert.match(comments.stdout, /2 findings withheld by the public-content check get no inline comment/);
  assert.match(comments.stdout, /inline comments: 1 posted/);
  const record = s.run(recordScript, gh);
  assert.equal(record.status, 0, record.stdout + record.stderr);
  const calls = fs
    .readFileSync(stub.log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((c) => c.args.includes("POST"));
  const inline = calls.filter((c) => c.args.includes("repos/acme/widgets/pulls/7/comments"));
  assert.equal(inline.length, 1);
  assert.equal(JSON.parse(inline[0].stdin).line, 20);
  const post = calls.find((c) => c.args.includes("repos/acme/widgets/issues/7/comments"));
  const body = post.args[post.args.indexOf("-f") + 1];
  assert.match(body, /### Security scan: completed, 3 findings/);
  assert.match(body, /`app\/api\.js:20`/);
  assert.match(body, /2 of the 3 findings are withheld/);
  assert.doesNotMatch(body, /notes\.txt|skunkworks|api\.js:12|api\.js:30/);
});

test("the hold clears its marker when there is nothing to hold: no result, no check, or no finding", (t) => {
  const pending = (s) => s.text("scan-content-pending");
  // Neither results nor candidates: the scan left nothing.
  const nothing = setup(t, { [MJS]: TARGET_CHECK });
  const none = nothing.hold();
  assert.equal(none.status, 0, none.stdout + none.stderr);
  assert.match(none.stdout, /^no scan result to check$/m);
  assert.equal(pending(nothing), null);
  // The base ships no check.
  const unchecked = setup(t);
  unchecked.write("scan-results.json", results([finding()]));
  const free = unchecked.hold();
  assert.equal(free.status, 0, free.stdout + free.stderr);
  assert.match(free.stdout, /ships no public-content check/);
  assert.equal(pending(unchecked), null);
  // A completed scan with no findings.
  const clean = setup(t, { [MJS]: TARGET_CHECK });
  clean.write("scan-results.json", results([]));
  const empty = clean.hold();
  assert.equal(empty.status, 0, empty.stdout + empty.stderr);
  assert.match(empty.stdout, /^no findings to check$/m);
  assert.equal(pending(clean), null);
});

test("results that are not a completed scan send the hold to the candidates", (t) => {
  const s = setup(t, { [MJS]: TARGET_CHECK });
  s.write("scan-results.json", { ...results([finding()]), analysis_summary: { review_completed: false } });
  fs.writeFileSync(
    path.join(s.input, "candidates.json"),
    JSON.stringify(results([finding({ description: `Reads ${HOME_PATH}.` }), finding({ line: 20 })])),
  );
  const hold = s.hold();
  assert.equal(hold.status, 0, hold.stdout + hold.stderr);
  const candidates = JSON.parse(fs.readFileSync(path.join(s.input, "candidates.json"), "utf8"));
  assert.deepEqual(candidates.findings.map((f) => Boolean(f._withheld)), [true, false]);
  assert.equal(s.read("scan-results.json").findings[0]._withheld, undefined);
  // One of two refused reads as one.
  assert.match(s.text("scan-withheld.md"), /^1 of the 2 findings is withheld from the inline comments/);
  assert.equal(s.text("scan-content-pending"), null);
});

test("a finding withheld for a sign-off line names that kind", (t) => {
  const s = setup(t, { [MJS]: CHECK });
  const signoff = ["Signed-off", "-by: Sam <123+sam@users.noreply.github.com>"].join("");
  s.write("scan-results.json", results([finding({ description: `Reads this.\n${signoff}` })]));
  const hold = s.hold();
  assert.equal(hold.status, 0, hold.stdout + hold.stderr);
  assert.match(
    s.text("scan-withheld.md"),
    /found in their text a Signed-off-by line other than the public footer\./,
  );
});

test("a check that cannot run withholds every finding, and the notice says so", (t) => {
  const s = setup(t, { [MJS]: "process.exit(2);\n" });
  s.write("scan-results.json", results([finding(), finding({ line: 20 })]));
  const hold = s.hold();
  assert.equal(hold.status, 0, hold.stdout + hold.stderr);
  assert.match(hold.stdout, /::warning::the repository's public-content check could not run \(exit 2\)/);
  assert.ok(s.read("scan-results.json").findings.every((f) => f._withheld));
  assert.match(s.text("scan-withheld.md"), /could not run \(exit 2\), so the text of all 2 findings is withheld/);
  const summary = s.run(summaryScript);
  assert.equal(summary.status, 0, summary.stdout + summary.stderr);
  assert.equal(s.text("scan-findings.md"), null);
  assert.doesNotMatch(summary.stdout, /::group::/);

  const stub = stubGh(s.repo.dir, [
    { match: "^api --paginate repos/acme/widgets/issues/7/comments", json: [] },
    { match: "^api --method POST repos/acme/widgets/issues/7/comments", stdout: "u\n" },
  ]);
  const notice = s.run(noticeScript, {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    REPO: "acme/widgets",
    PR: "7",
    HEAD,
    MODE: "push",
    JOB_STATUS: "failure",
    GITHUB_RUN_ID: "1",
  });
  assert.equal(notice.status, 0, notice.stdout + notice.stderr);
  const [post] = fs
    .readFileSync(stub.log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((c) => c.args.includes("POST"));
  const body = post.args[post.args.indexOf("-f") + 1];
  assert.match(body, /finished for head a+ with 2 findings/);
  assert.match(body, /could not run \(exit 2\), so the text of all 2 findings is withheld/);
  assert.doesNotMatch(body, /api\.js/);
});

test("a check that cannot run is not run again for the findings after it", (t) => {
  // The check runs in RUNNER_TEMP; each run leaves a line there.
  const s = setup(t, { [MJS]: "import fs from 'node:fs';\nfs.appendFileSync('check-runs', 'x\\n');\nprocess.exit(2);\n" });
  s.write("scan-results.json", results([finding(), finding({ line: 20 }), finding({ line: 30 })]));
  const hold = s.hold();
  assert.equal(hold.status, 0, hold.stdout + hold.stderr);
  assert.equal(s.text("check-runs"), "x\n");
  assert.ok(s.read("scan-results.json").findings.every((f) => f._withheld));
});

test("a check that runs past its time limit cannot run", (t) => {
  // timeout exits 124 when it stops the check; the stand-in exits so too.
  const s = setup(t, { [MJS]: "process.exit(124);\n" });
  s.write("scan-results.json", results([finding()]));
  assert.equal(s.hold().status, 0);
  assert.match(s.text("scan-withheld.md"), /could not run \(it ran past 30 seconds\), so the finding's text is withheld/);
  assert.ok(s.read("scan-results.json").findings[0]._withheld);
});

test("an exit 1 without a finding line, and a base check that is a symlink, cannot run", (t) => {
  const quiet = setup(t, { [MJS]: "console.log('no');\nprocess.exit(1);\n" });
  quiet.write("scan-results.json", results([finding()]));
  assert.equal(quiet.hold().status, 0);
  assert.match(quiet.text("scan-withheld.md"), /could not run \(exit 1 without naming a line it found\)/);

  const linked = setup(t, { "elsewhere.mjs": CHECK });
  fs.mkdirSync(path.join(linked.repo.dir, ".github/scripts"), { recursive: true });
  linked.repo.git("checkout", "-q", "main");
  fs.mkdirSync(path.join(linked.repo.dir, ".github/scripts"), { recursive: true });
  fs.symlinkSync("../../elsewhere.mjs", path.join(linked.repo.dir, MJS));
  linked.repo.git("add", ".github");
  linked.repo.git("commit", "-q", "-m", "link the check");
  linked.repo.git("update-ref", "refs/remotes/origin/main", linked.repo.git("rev-parse", "HEAD"));
  linked.repo.git("checkout", "-q", "feature");
  linked.write("scan-results.json", results([finding()]));
  assert.equal(linked.hold().status, 0);
  assert.match(linked.text("scan-withheld.md"), /could not run \(\.github\/scripts\/public-content\.mjs on main is not a regular file\)/);
  assert.ok(linked.read("scan-results.json").findings[0]._withheld);
});

test("a check only the head has is ignored, and the findings go as before", (t) => {
  const s = setup(t, {}, { [MJS]: "process.exit(1);\n" });
  const before = results([finding()]);
  s.write("scan-results.json", before);
  const hold = s.hold();
  assert.equal(hold.status, 0, hold.stdout + hold.stderr);
  assert.match(hold.stdout, /the base branch ships no public-content check, so the findings go as before/);
  assert.deepEqual(s.read("scan-results.json"), before);
  assert.equal(s.text("scan-withheld.md"), null);
});

test("a base's Python check runs with python3 -I and only PATH and PRIVATE_REPO_NAMES", (t) => {
  const envLog = path.join(tempDir(t), "env.json");
  const py = [
    "import json, os, sys",
    "if not sys.flags.isolated:",
    "    sys.exit(3)",
    // Python sets LC_CTYPE itself under the C locale (PEP 538), and macOS
    // adds __CF_USER_TEXT_ENCODING: neither came from the step.
    `json.dump(sorted(k for k in os.environ if k not in ("LC_CTYPE", "__CF_USER_TEXT_ENCODING")), open(${JSON.stringify(envLog)}, "w"))`,
    "text = open(sys.argv[1].split('=', 1)[1], encoding='utf-8').read()",
    "if 'hush' in text:",
    "    print('::error title=Public repository content::text x, line 3: the word hush in ' + text)",
    "    sys.exit(1)",
    "",
  ].join("\n");
  const s = setup(t, { [PY]: py });
  s.write("scan-results.json", results([finding({ description: "hush" }), finding({ line: 20 })]));
  const hold = s.hold({ PRIVATE_REPO_NAMES: "skunkworks", GH_TOKEN: "job-token" });
  assert.equal(hold.status, 0, hold.stdout + hold.stderr);
  assert.deepEqual(
    s.read("scan-results.json").findings.map((f) => Boolean(f._withheld)),
    [true, false],
  );
  // A kind the kit's checks do not print is named generically.
  assert.match(s.text("scan-withheld.md"), /found in their text a detail the check rules out\./);
  assert.doesNotMatch(s.text("scan-withheld.md"), /hush/);
  assert.deepEqual(JSON.parse(fs.readFileSync(envLog, "utf8")), ["PATH", "PRIVATE_REPO_NAMES"]);
});

test("when the verification did not finish, the candidates are checked", (t) => {
  const s = setup(t, { [MJS]: CHECK });
  fs.writeFileSync(
    path.join(s.input, "candidates.json"),
    JSON.stringify({ findings: [finding({ file: HOME_PATH }), finding({ line: 20 })] }),
  );
  const hold = s.hold();
  assert.equal(hold.status, 0, hold.stdout + hold.stderr);
  const candidates = JSON.parse(fs.readFileSync(path.join(s.input, "candidates.json"), "utf8"));
  assert.deepEqual(
    candidates.findings.map((f) => Boolean(f._withheld)),
    [true, false],
  );
  const summary = s.run(summaryScript);
  assert.equal(summary.status, 0, summary.stdout + summary.stderr);
  assert.doesNotMatch(s.text("scan-findings.md"), /notes\.txt/);
  assert.match(s.text("scan-findings.md"), /api\.js:20.*\(unverified\)/);
});

test("findings the check passes are left as they were", (t) => {
  const s = setup(t, { [MJS]: CHECK });
  const before = results([finding(), finding({ line: 20 })]);
  s.write("scan-results.json", before);
  const hold = s.hold();
  assert.equal(hold.status, 0, hold.stdout + hold.stderr);
  assert.match(hold.stdout, /the public-content check passed all 2 findings/);
  assert.deepEqual(s.read("scan-results.json"), before);
  assert.equal(s.text("scan-withheld.md"), null);
});

test("a token the comment or the record would rebuild by taking out a backtick is refused", (t) => {
  const s = setup(t, { [MJS]: TARGET_CHECK });
  s.write(
    "scan-results.json",
    results([
      finding({ description: at("Reads /ho", "`me/dra/notes.txt.") }),
      finding({ line: 20, recommendation: "Compare skunk`works." }),
      finding({ line: 30 }),
    ]),
  );
  const hold = s.hold({ PRIVATE_REPO_NAMES: "skunkworks" });
  assert.equal(hold.status, 0, hold.stdout + hold.stderr);
  assert.deepEqual(
    s.read("scan-results.json").findings.map((f) => Boolean(f._withheld)),
    [true, true, false],
  );
});

test("a check step that did not finish leaves the summary listing no finding's text", (t) => {
  const s = setup(t, { [MJS]: CHECK });
  s.write("scan-results.json", results([finding(), finding({ line: 20 })]));
  // As a step cut short leaves it: the marker, and no finding marked.
  fs.writeFileSync(s.file("scan-content-pending"), "");
  const summary = s.run(summaryScript);
  assert.equal(summary.status, 0, summary.stdout + summary.stderr);
  assert.equal(s.text("scan-count"), "2\n");
  assert.equal(s.text("scan-findings.md"), null);
  assert.doesNotMatch(summary.stdout, /api\.js|::group::/);
  assert.match(summary.stdout, /::warning::the public-content check did not finish/);
  assert.match(s.text("scan-withheld.md"), /did not finish, so the text of all 2 findings is withheld/);
  // A step that finishes takes the marker down.
  const hold = s.hold();
  assert.equal(hold.status, 0, hold.stdout + hold.stderr);
  assert.ok(!fs.existsSync(s.file("scan-content-pending")));
});

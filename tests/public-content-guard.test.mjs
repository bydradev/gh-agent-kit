// The MCP server's public-content guard: with PUBLIC_CONTENT_CHECK set (a
// public repository whose base or default branch ships a check), every text
// a tool posts is checked first and refused, unposted, when the check finds
// something or cannot run; without it, posts go as before. The repository's
// own .github/scripts/public-content.mjs is the check for most cases; small
// stand-ins cover what a third-party check might do.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { ghCalls, gitRepo, root, startServer, tempDir } from "./helpers/server.mjs";

const CHECK = path.join(root, ".github/scripts/public-content.mjs");
// Examples of what the check finds, built from parts so that this file's
// own lines pass the repository's check.
const at = (...parts) => parts.join("");
const LINK = at("https://claude.", "ai/code/", "session", "_0123456789abcdefABCDEF");
const HOME_PATH = at("/ho", "me/dra/notes.txt");
const PROJECT_PATH = at("/m", "nt/project-files/x");
const ADDRESS = at("someone", "@", "gmail.com");
const PRIVATE_REPO = at("bydradev", "/secret-thing");
const CHAT = at("claude.", "ai/chat/abc");

const REPORT = (base, head, extra = "") =>
  [
    "## Review R1: No blocking findings",
    "",
    "Closes reviewed: none",
    `Base reviewed: main at ${base}`,
    "Title reviewed: feat: add a widget",
    `Head reviewed: ${head}`,
    extra,
  ].join("\n");

// A pull request #7 whose head is one commit on main.
function review(t, env = {}) {
  const repo = gitRepo(t);
  const base = repo.commit("a.txt", "a\n", "base");
  repo.git("checkout", "-q", "-b", "feature");
  const head = repo.commit("b.txt", "b\n", "feature");
  repo.git("update-ref", "refs/remotes/origin/main", base);
  const rules = [
    {
      match: "^api --method GET repos/acme/widgets/pulls/7$",
      stdout: {
        state: "open",
        draft: false,
        base: { ref: "main", sha: base },
        head: { sha: head },
      },
    },
    {
      match: "issues\\?state=all&creator=github-actions%5Bbot%5D&per_page=100&page=1$",
      stdout: [],
    },
    { match: "^api -X POST ", stdout: "https://github.com/acme/widgets/pull/7#c1" },
  ];
  return {
    base,
    head,
    rules,
    env: { PR: "7", HEAD_SHA: head, BASE: "main", GITHUB_WORKSPACE: repo.dir, ...env },
  };
}
const triage = (env = {}) => ({
  mode: "triage",
  env: { TRIAGE_ISSUE: "8", TRIAGE_EVENT: "issues", ...env },
  rules: [
    {
      match: "^api --method GET repos/acme/widgets/issues/8$",
      stdout: {
        number: 8,
        title: "t",
        body: "",
        state: "open",
        labels: [],
        user: { login: "dev" },
      },
    },
    { match: "^api -X POST ", stdout: "https://github.com/acme/widgets/issues/8#c1" },
  ],
});
const posts = (server) => ghCalls(server).filter((c) => c.args.includes("POST"));

// A file holding the private names, as the workflow writes it.
function namesFile(t, names) {
  const file = path.join(tempDir(t), "private-repo-names");
  fs.writeFileSync(file, names);
  return file;
}

test("post_report is refused, unposted, while the check finds something, and posts once reworded", async (t) => {
  const f = review(t, { PUBLIC_CONTENT_CHECK: CHECK });
  const server = await startServer(t, { mode: "review", env: f.env, rules: f.rules });
  const bad = await server.call("post_report", { body: REPORT(f.base, f.head, `See ${LINK}.`) });
  assert.equal(bad.isError, true);
  assert.match(bad.text, /public-content check found 2 problem\(s\), so nothing was posted/);
  assert.match(bad.text, /body line 7: a claude\.ai link; body line 7: a session or thread ID/);
  assert.doesNotMatch(bad.text, /session_0123/);
  assert.equal(posts(server).length, 0);
  const ok = await server.call("post_report", { body: REPORT(f.base, f.head, "See the run.") });
  assert.equal(ok.isError, false, ok.text);
  assert.equal(posts(server).length, 1);
});

test("inline_comment and file_issue are checked, file_issue field by field", async (t) => {
  const f = review(t, { PUBLIC_CONTENT_CHECK: CHECK });
  const server = await startServer(t, { mode: "review", env: f.env, rules: f.rules });
  const inline = await server.call("inline_comment", {
    path: "b.txt",
    line: 1,
    body: `Compare ${HOME_PATH}`,
  });
  assert.equal(inline.isError, true);
  assert.match(inline.text, /body line 1: a local or project-storage path/);
  const issue = {
    finding: "R1-01",
    title: `Mention ${ADDRESS} in the docs`,
    outcome: "Done.",
    acceptance: `- [ ] one\n- [ ] see ${PRIVATE_REPO}`,
  };
  const filed = await server.call("file_issue", issue);
  assert.equal(filed.isError, true);
  assert.match(
    filed.text,
    /title line 1: an email address other than a noreply one; acceptance line 2: a bydradev or bydraio repository outside the public list/,
  );
  assert.equal(posts(server).length, 0);
  const ok = await server.call("file_issue", {
    ...issue,
    title: "Mention the contact address in the docs",
    acceptance: "- [ ] one",
  });
  assert.equal(ok.isError, false, ok.text);
  assert.equal(posts(server).length, 1);
});

test("triage's comment is checked, and refusing it leaves the run's one comment unspent", async (t) => {
  const server = await startServer(t, triage({ PUBLIC_CONTENT_CHECK: CHECK }));
  const bad = await server.call("comment", { body: `## Triage\n\nAs in ${PROJECT_PATH}.` });
  assert.equal(bad.isError, true);
  assert.match(bad.text, /body line 3: a local or project-storage path/);
  assert.equal(posts(server).length, 0);
  const ok = await server.call("comment", { body: "## Triage\n\nPlan." });
  assert.equal(ok.isError, false, ok.text);
  assert.equal(posts(server).length, 1);
});

test("a repository without a check posts as before", async (t) => {
  const f = review(t);
  const server = await startServer(t, { mode: "review", env: f.env, rules: f.rules });
  const r = await server.call("post_report", { body: REPORT(f.base, f.head, `See ${LINK}.`) });
  assert.equal(r.isError, false, r.text);
  const t2 = await startServer(t, triage());
  assert.equal((await t2.call("comment", { body: `See ${LINK}.` })).isError, false);
});

test("a bare private name is refused only when PRIVATE_REPO_NAMES reaches the check", async (t) => {
  const body = "## Triage\n\nLike skunkworks does.";
  const without = await startServer(t, triage({ PUBLIC_CONTENT_CHECK: CHECK }));
  assert.equal((await without.call("comment", { body })).isError, false);
  const names = namesFile(t, "other, skunkworks\n");
  const withNames = await startServer(
    t,
    triage({ PUBLIC_CONTENT_CHECK: CHECK, PRIVATE_REPO_NAMES_FILE: names }),
  );
  const r = await withNames.call("comment", { body });
  assert.equal(r.isError, true);
  assert.match(r.text, /body line 3: a private repository name/);
  assert.doesNotMatch(r.text, /skunkworks/);
  assert.equal(posts(withNames).length, 0);
});

// A stand-in check that misbehaves as a third-party one might: it prints
// what it matched, names a kind of its own, and records its environment.
function noisyCheck(t) {
  const dir = tempDir(t);
  const file = path.join(dir, "check.mjs");
  const envLog = path.join(dir, "env.json");
  fs.writeFileSync(
    file,
    `import fs from "node:fs";
const arg = process.argv.find((a) => a.startsWith("--text="));
const text = fs.readFileSync(arg.slice(7), "utf8");
fs.writeFileSync(${JSON.stringify(envLog)}, JSON.stringify(Object.keys(process.env)));
if (!text.includes("hush")) process.exit(0);
console.log("matched: " + text);
console.log("::error title=Public repository content::text x, line 1: the word hush in " + text);
process.exit(1);
`,
  );
  return { file, envLog };
}

test("the check's own output never reaches the model, and it gets no token", async (t) => {
  const check = noisyCheck(t);
  const names = namesFile(t, "skunkworks");
  const server = await startServer(
    t,
    triage({
      PUBLIC_CONTENT_CHECK: check.file,
      PRIVATE_REPO_NAMES_FILE: names,
      GH_TOKEN: "job-token",
    }),
  );
  const r = await server.call("comment", { body: "hush now" });
  assert.equal(r.isError, true);
  assert.match(r.text, /body line 1: a detail the check rules out/);
  assert.doesNotMatch(r.text, /hush|matched:/);
  assert.deepEqual(JSON.parse(fs.readFileSync(check.envLog, "utf8")).sort(), [
    "PATH",
    "PRIVATE_REPO_NAMES",
  ]);
});

test("a configured check that cannot run refuses every post", async (t) => {
  const dir = tempDir(t);
  const broken = path.join(dir, "broken.mjs");
  fs.writeFileSync(broken, "process.exit(2);\n");
  for (const [check, why] of [
    [broken, /could not run \(exit 2\)/],
    [path.join(dir, "missing.mjs"), /could not run \(it is not installed\)/],
  ]) {
    const server = await startServer(t, triage({ PUBLIC_CONTENT_CHECK: check }));
    const r = await server.call("comment", { body: "## Triage\n\nPlan." });
    assert.equal(r.isError, true, check);
    assert.match(r.text, /nothing was posted/);
    assert.match(r.text, why);
    assert.equal(posts(server).length, 0);
  }
});

test("a Python check runs with python3 -I", async (t) => {
  const dir = tempDir(t);
  const check = path.join(dir, "check_public_content.py");
  fs.writeFileSync(
    check,
    [
      "import sys",
      "if not sys.flags.isolated:",
      "    sys.exit(3)",
      "text = open(sys.argv[1].split('=', 1)[1], encoding='utf-8').read()",
      "if 'claude.' + 'ai/chat' in text:",
      "    print('::error title=Public repository content::text x, line 1: a claude.ai link')",
      "    sys.exit(1)",
      "",
    ].join("\n"),
  );
  const server = await startServer(t, triage({ PUBLIC_CONTENT_CHECK: check }));
  const r = await server.call("comment", { body: CHAT });
  assert.equal(r.isError, true);
  assert.match(r.text, /body line 1: a claude\.ai link/);
  const ok = await server.call("comment", { body: "fine" });
  assert.equal(ok.isError, false, ok.text);
});

test("an exit 1 without a line the check names, and a long list of findings", async (t) => {
  const dir = tempDir(t);
  const quiet = path.join(dir, "quiet.mjs");
  fs.writeFileSync(quiet, "console.log('something is wrong');\nprocess.exit(1);\n");
  const server = await startServer(t, triage({ PUBLIC_CONTENT_CHECK: quiet }));
  const r = await server.call("comment", { body: "## Triage\n\nPlan." });
  assert.equal(r.isError, true);
  assert.match(r.text, /could not run \(exit 1 without naming a line it found\)/);
  assert.doesNotMatch(r.text, /something is wrong/);
  assert.match(server.stderr(), /public-content check could not run/);

  const many = await startServer(t, triage({ PUBLIC_CONTENT_CHECK: CHECK }));
  const body = Array.from({ length: 12 }, () => HOME_PATH).join("\n");
  const long = await many.call("comment", { body });
  assert.equal(long.isError, true);
  assert.match(long.text, /found 12 problem\(s\)/);
  assert.match(long.text, /body line 10: a local or project-storage path; and 2 more\./);
  assert.doesNotMatch(long.text, /body line 11/);
});

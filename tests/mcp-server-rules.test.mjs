// MCP server rules a rule-by-rule mutation sweep found no test for (#94):
// the token file, the start-up checks on the run's settings, the argument
// checks behind the git tools, and the paging that keeps every item and
// cuts only a body that cannot fit a page.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { ghCalls, gitRepo, startServer, tempDir } from "./helpers/server.mjs";

// A checkout on a feature branch over origin/main.
function checkout(t, base = "main") {
  const repo = gitRepo(t);
  const baseSha = repo.commit("a.txt", "a\n", "base");
  repo.git("checkout", "-q", "-b", "feature");
  const head = repo.commit("b.txt", "b\n", "feature");
  repo.git("update-ref", `refs/remotes/origin/${base}`, baseSha);
  return { repo, baseSha, head, env: { PR: "7", HEAD_SHA: head, BASE: base, GITHUB_WORKSPACE: repo.dir } };
}
const pullRule = (c, base = "main") => ({
  match: "^api --method GET repos/acme/widgets/pulls/7$",
  stdout: {
    number: 7,
    title: "feat: add a widget",
    body: "",
    state: "open",
    draft: false,
    user: { login: "dev" },
    base: { ref: base, sha: c.baseSha },
    head: { sha: c.head },
  },
});

test("the server reads the job token from GH_TOKEN_FILE and gives it to gh", async (t) => {
  const c = checkout(t);
  const dir = tempDir(t);
  const tokenFile = path.join(dir, "token");
  fs.writeFileSync(tokenFile, "ghs_from_the_file\n");
  const tokens = path.join(dir, "tokens");
  const server = await startServer(t, {
    mode: "review",
    env: { ...c.env, GH_TOKEN_FILE: tokenFile, GH_STUB_TOKEN_LOG: tokens },
    rules: [pullRule(c)],
  });
  const r = await server.call("pr");
  assert.equal(r.isError, false, r.text);
  assert.deepEqual([...new Set(fs.readFileSync(tokens, "utf8").trim().split("\n"))], ["ghs_from_the_file"]);
});

// The server refuses to start, before reading anything, on a setting that
// could point its calls elsewhere.
async function refusesToStart(t, mode, env) {
  const server = await startServer(t, { mode, env, rules: [] });
  const code = await server.exited;
  assert.notEqual(code, 0, `${mode} ${JSON.stringify(env)} started`);
  assert.deepEqual(ghCalls(server), []);
}

test("each mode refuses to start on a malformed number, repository or run setting", async (t) => {
  const review = { PR: "7", HEAD_SHA: "a".repeat(40), BASE: "main" };
  for (const env of [
    { ...review, PR: "7a" },
    { ...review, GITHUB_REPOSITORY: "acme" },
    { ...review, GITHUB_REPOSITORY: "acme/wid gets" },
    { ...review, GITHUB_REPOSITORY: "acme/.." },
    { ...review, GITHUB_REPOSITORY: "./widgets" },
    { ...review, HEAD_SHA: "a".repeat(39) },
    { ...review, BASE: "" },
    { ...review, GITHUB_RUN_ID: "1001x" },
    { ...review, GITHUB_RUN_ATTEMPT: "" },
  ])
    await refusesToStart(t, "review", env);
  for (const env of [
    { TRIAGE_ISSUE: "8a" },
    { TRIAGE_ISSUE: "8", GITHUB_REPOSITORY: "acme/../x" },
    { TRIAGE_ISSUE: "8", GITHUB_RUN_ID: "x" },
    { TRIAGE_ISSUE: "8", GITHUB_RUN_ATTEMPT: "1.5" },
  ])
    await refusesToStart(t, "triage", env);
  const dir = tempDir(t);
  const sweep = {
    ELIGIBLE_ISSUES: "1",
    DISPATCH_LOG: path.join(dir, "log"),
    DISPATCH_QUEUE: path.join(dir, "queue"),
    GITHUB_REF_NAME: "main",
  };
  for (const name of Object.keys(sweep)) await refusesToStart(t, "sweep", { ...sweep, [name]: "" });
  await refusesToStart(t, "sweep", { ...sweep, GITHUB_REPOSITORY: "acme" });
  await refusesToStart(t, "unknown", {});
});

test("the git tools refuse a ref, range or path that is not plain, before running git", async (t) => {
  const c = checkout(t);
  const server = await startServer(t, { mode: "review", env: c.env, rules: [pullRule(c)] });
  for (const [tool, args, message] of [
    ["show", { ref: 5 }, /^ref must be a sha, HEAD or origin\/<branch>/],
    ["show", { ref: "--stat" }, /^ref must be/],
    ["show", { ref: "HEAD..origin/main" }, /^ref must be/],
    ["show", { ref: "HEAD@{1}" }, /^ref must be/],
    ["show", { ref: "HEAD", path: "" }, /^path must be a relative path inside the checkout/],
    ["show", { ref: "HEAD", path: ".git" }, /^path must be a relative path/],
    ["diff", { path: ["b.txt"] }, /^path must be a relative path/],
    ["diff", { path: "a/../b.txt" }, /^path must be a relative path/],
    ["log", { range: ["HEAD..HEAD"] }, /^range must be <ref>\.\.<ref>/],
    ["log", { range: "--all..HEAD" }, /^range must be/],
    ["log", { range: "HEAD..--all" }, /^range must be/],
    ["comment_body", { kind: "issue", id: "5" }, /^id must be a positive integer/],
    ["comment_body", { kind: "issue", id: 1.5 }, /^id must be a positive integer/],
  ]) {
    const r = await server.call(tool, args);
    assert.equal(r.isError, true, `${tool} ${JSON.stringify(args)}: ${r.text}`);
    assert.match(r.text, message, `${tool} ${JSON.stringify(args)}`);
  }
  assert.ok(!ghCalls(server).some((call) => call.args.join(" ").includes("comments/")));
});

test("the git tools take the fetched base whatever its name, and a plain range", async (t) => {
  const c = checkout(t, "release+1");
  const server = await startServer(t, { mode: "review", env: c.env, rules: [pullRule(c, "release+1")] });
  const base = await server.call("show", { ref: "origin/release+1", path: "a.txt" });
  assert.equal(base.isError, false, base.text);
  assert.equal(base.text, "a\n");
  const log = await server.call("log", { range: "origin/release+1..HEAD" });
  assert.equal(log.isError, false, log.text);
  assert.match(log.text, /^[0-9a-f]+ feature$/m);
  assert.doesNotMatch(log.text, / base$/m);
});

// The conversation, served from page rules for each API page.
const comment = (id, body = `comment ${id}`) => ({
  id,
  user: { login: "github-actions[bot]", type: "Bot" },
  created_at: "2026-10-22T08:00:00Z",
  body,
});
const pages = (all, path = "repos/acme/widgets/issues/7/comments") =>
  Array.from({ length: Math.ceil(all.length / 100) || 1 }, (_, k) => ({
    match: `^api --method GET ${path.replace(/[?]/g, "\\?")}\\?per_page=100&page=${k + 1}$`,
    stdout: all.slice(k * 100, k * 100 + 100),
  }));
async function conversation(t, all, extra = []) {
  const c = checkout(t);
  return startServer(t, { mode: "review", env: c.env, rules: [pullRule(c), ...pages(all), ...extra] });
}
const page = async (server, tool, args) => {
  const r = await server.call(tool, args);
  assert.equal(r.isError, false, r.text);
  return JSON.parse(r.text);
};

test("a listing reads only the pages it needs and starts at 0 for a start it cannot use", async (t) => {
  const server = await conversation(t, [comment(1), comment(2), comment(3)]);
  for (const start of [undefined, -1, 1.5, "1"]) {
    const p = await page(server, "conversation", start === undefined ? {} : { start });
    assert.deepEqual([p.start, p.count, p.next_start], [0, 3, null], String(start));
  }
  const from = await page(server, "conversation", { start: 2 });
  assert.deepEqual(from.items.map((i) => i.id), [3]);
  // Fewer than 100 on the first page: there is no second page to ask for.
  assert.ok(!ghCalls(server).some((c) => c.args.join(" ").includes("page=2")));
});

test("a listing cuts a body too long for a page of its own, and names the tool that reads it whole", async (t) => {
  const long = "x".repeat(30000);
  const server = await conversation(t, [comment(1, long), comment(2)], [
    {
      match: "^api --method GET repos/acme/widgets/pulls/7/reviews\\?per_page=100&page=1$",
      stdout: [{ id: 9, user: { login: "github-actions[bot]", type: "Bot" }, state: "COMMENTED", submitted_at: "2026-10-22T08:00:00Z", body: long }],
    },
  ]);
  const first = await page(server, "conversation", {});
  assert.deepEqual([first.count, first.next_start], [1, 1]);
  assert.match(first.items[0].body, /\n\[body cut; read it whole with comment_body, id 1\]$/);
  assert.ok(first.items[0].body.length < 24000);
  const rest = await page(server, "conversation", { start: first.next_start });
  assert.deepEqual(rest.items.map((i) => i.id), [2]);
  const review = await page(server, "reviews", {});
  assert.match(review.items[0].body, /\n\[body cut; read it whole with comment_body, id 9, kind review\]$/);
});

test("a long text is served from page 1 for a page it cannot use", async (t) => {
  const c = checkout(t);
  fs.writeFileSync(path.join(c.repo.dir, "big.txt"), "line\n".repeat(10000));
  c.repo.git("add", "big.txt");
  c.repo.git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "big");
  const server = await startServer(t, {
    mode: "review",
    env: { ...c.env, HEAD_SHA: c.repo.git("rev-parse", "HEAD").trim() },
    rules: [pullRule(c)],
  });
  for (const p of [0, -1, 1.5, "2"]) {
    const r = await server.call("show", { ref: "HEAD", path: "big.txt", page: p });
    assert.equal(r.isError, false, r.text);
    assert.match(r.text, /^\[page 1 of 3, 24000 characters each; pass page: 2 for the next\]\n/, String(p));
  }
  const last = await server.call("show", { ref: "HEAD", path: "big.txt", page: 9 });
  assert.match(last.text, /^\[page 3 of 3, 24000 characters each; the last\]\n/);
});

test("file_issue keeps the reviewer's out-of-scope text, and marks the optional sections left empty", async (t) => {
  const c = checkout(t);
  const rules = [
    pullRule(c),
    { match: "issues\\?state=all&creator=github-actions%5Bbot%5D&per_page=100&page=1$", stdout: [] },
    { match: "^api -X POST repos/acme/widgets/issues ", stdout: "https://github.com/acme/widgets/issues/57" },
  ];
  const server = await startServer(t, { mode: "review", env: c.env, rules });
  const args = { finding: "R1-01", title: "Cache the listing", outcome: "It is cached.", acceptance: "- [ ] cached" };
  assert.equal((await server.call("file_issue", { ...args, out_of_scope: "Not the search." })).isError, false);
  assert.equal((await server.call("file_issue", { ...args, finding: "R1-02" })).isError, false);
  const [given, empty] = ghCalls(server)
    .filter((call) => call.args.includes("POST"))
    .map((call) => JSON.parse(call.stdin).body);
  assert.match(given, /### Out of scope\n\nNot the search\.\n/);
  for (const h of ["References", "Out of scope", "Size"]) assert.match(empty, new RegExp(`### ${h}\\n\\n_No response_\\n`), h);
});

test("the issue tools name a repo option that is not text as another repository's, and an author without a login as unknown", async (t) => {
  const c = checkout(t);
  const server = await startServer(t, {
    mode: "review",
    env: c.env,
    rules: [
      pullRule(c),
      {
        match: "^api --method GET repos/acme/widgets/issues/7/comments\\?per_page=100&page=1$",
        stdout: [{ id: 3, user: { login: null, type: "User" }, created_at: "2026-10-22T08:00:00Z", body: "x" }],
      },
    ],
  });
  for (const repo of [5, ["acme/widgets"]]) {
    const r = await server.call("issue", { number: 12, repo });
    assert.equal(r.isError, true, JSON.stringify(repo));
    assert.match(r.text, /^repo is not an option: the issue tools read this repository only/, JSON.stringify(repo));
  }
  const p = await page(server, "conversation", {});
  assert.equal(p.items[0].withheld, "the author is unknown; the body is not shown");
  assert.ok(!ghCalls(server).some((call) => call.args.join(" ").includes("/collaborators/")));
});

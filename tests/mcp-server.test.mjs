// Tests for .github/scripts/mcp-server.mjs, run as the workflows run it: one
// process per mode, JSON-RPC over stdio, gh replaced by a stub that answers
// from fixed rules and logs every call, git real in a scratch repository.
//
//   node --test tests/*.test.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { ghCalls, gitRepo, startServer, tempDir } from "./helpers/server.mjs";

const REPORT = (base, head) =>
  [
    "## Review R1: No blocking findings",
    "",
    "Closes reviewed: none",
    `Base reviewed: main at ${base}`,
    "Title reviewed: feat: add a widget",
    `Head reviewed: ${head}`,
  ].join("\n");

const LINES = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`);

// A pull request #7 whose head is one commit on main's first commit.
function reviewFixture(t) {
  const repo = gitRepo(t);
  const base = repo.commit("a.txt", "a\n", "base");
  repo.git("checkout", "-q", "-b", "feature");
  const head = repo.commit("b.txt", LINES.join("\n") + "\n", "feature");
  repo.git("update-ref", "refs/remotes/origin/main", base);
  const pull = (over = {}) => ({
    number: 7,
    title: "feat: add a widget",
    body: "",
    state: "open",
    merged: false,
    draft: false,
    user: { login: "dev" },
    base: { ref: "main", sha: base },
    head: { sha: head },
    ...over,
  });
  const env = { PR: "7", HEAD_SHA: head, BASE: "main", GITHUB_WORKSPACE: repo.dir };
  return { repo, base, head, pull, env };
}

const prRule = (pull) => ({ match: "^api --method GET repos/acme/widgets/pulls/7$", stdout: pull });
const postRule = (url) => ({ match: "^api -X POST ", stdout: url });
const posts = (server) => ghCalls(server).filter((c) => c.args.includes("POST"));

test("server refuses to start without its mode's environment", async (t) => {
  const server = await startServer(t, { mode: "review", env: { PR: "7" } });
  assert.notEqual(await server.exited, 0);
  assert.match(server.stderr(), /review mode needs PR/);
});

test("tools/list names every review tool and an unknown tool is an error", async (t) => {
  const f = reviewFixture(t);
  const server = await startServer(t, { mode: "review", env: f.env });
  const init = await server.request("initialize", { protocolVersion: "2025-06-18" });
  assert.equal(init.result.serverInfo.name, "agent-kit");
  const list = await server.request("tools/list", {});
  const names = list.result.tools.map((x) => x.name);
  for (const name of ["pr", "diff", "range_diff", "inline_comment", "post_report"])
    assert.ok(names.includes(name), name);
  const r = await server.call("no_such_tool");
  assert.ok(r.rpcError);
});

test("post_report posts once, with the run marker, when the run is current", async (t) => {
  const f = reviewFixture(t);
  const server = await startServer(t, {
    mode: "review",
    env: f.env,
    rules: [prRule(f.pull()), postRule("https://github.com/acme/widgets/pull/7#c1")],
  });
  const r = await server.call("post_report", { body: REPORT(f.base, f.head) });
  assert.equal(r.isError, false, r.text);
  assert.equal(r.text, "posted https://github.com/acme/widgets/pull/7#c1");
  const [post] = posts(server);
  assert.ok(post.args.includes("repos/acme/widgets/issues/7/comments"));
  assert.ok(post.stdin.endsWith("\n\n<!-- pr-review run 1001.1 -->\n"));
  const again = await server.call("post_report", { body: REPORT(f.base, f.head) });
  assert.equal(again.isError, true);
  assert.match(again.text, /already posted/);
  assert.equal(posts(server).length, 1);
});

// OpenCode carries a run on after Go's capacity refusal in a new CLI
// process, which starts a new server; with STATE_FILE the run's limits
// hold across it.
test("with STATE_FILE, a carried-on run's new server keeps the run's report and inline limits", async (t) => {
  const f = reviewFixture(t);
  const state = path.join(tempDir(t), "agent-kit-state.json");
  const env = { ...f.env, STATE_FILE: state };
  const rules = [prRule(f.pull()), postRule("u")];
  const first = await startServer(t, { mode: "review", env, rules });
  const inline = { path: "b.txt", line: 1, body: "finding" };
  assert.equal((await first.call("inline_comment", inline)).isError, false);
  assert.equal((await first.call("post_report", { body: REPORT(f.base, f.head) })).isError, false);
  assert.deepEqual(JSON.parse(fs.readFileSync(state, "utf8")), {
    report: true,
    inline: 1,
    issues: 0,
    comment: false,
  });
  const next = await startServer(t, { mode: "review", env, rules });
  const again = await next.call("post_report", { body: REPORT(f.base, f.head) });
  assert.equal(again.isError, true);
  assert.match(again.text, /already posted/);
  assert.equal((await next.call("inline_comment", inline)).isError, false);
  assert.equal(JSON.parse(fs.readFileSync(state, "utf8")).inline, 2);
  fs.writeFileSync(state, JSON.stringify({ report: true, inline: 40, issues: 0, comment: false }));
  const last = await startServer(t, { mode: "review", env, rules });
  assert.match((await last.call("inline_comment", inline)).text, /has posted 40 inline comments/);
  assert.equal(posts(next).length, 1);
  assert.equal(posts(last).length, 0);
});

test("post_report turns CRLF line endings into LF before checking and posting", async (t) => {
  const f = reviewFixture(t);
  const server = await startServer(t, {
    mode: "review",
    env: f.env,
    rules: [prRule(f.pull()), postRule("u")],
  });
  const r = await server.call("post_report", {
    body: REPORT(f.base, f.head).replace(/\n/g, "\r\n"),
  });
  assert.equal(r.isError, false, r.text);
  assert.ok(!posts(server)[0].stdin.includes("\r"));
});

test("post_report refuses a Base reviewed line naming another base than the one diffed", async (t) => {
  // range_diff fetches a Base reviewed sha by sha later, so the line may
  // name only the commit this run diffed against.
  const f = reviewFixture(t);
  const server = await startServer(t, {
    mode: "review",
    env: f.env,
    rules: [prRule(f.pull()), postRule("u")],
  });
  for (const body of [
    REPORT("f".repeat(40), f.head),
    REPORT(f.base, f.head).replace("Base reviewed: main at ", "Base reviewed: develop at "),
  ]) {
    const r = await server.call("post_report", { body });
    assert.equal(r.isError, true);
    assert.match(
      r.text,
      new RegExp(`^the Base reviewed line must read "Base reviewed: main at ${f.base}"`),
    );
  }
  assert.equal(posts(server).length, 0);
});

// reportLineProblem: each of the four lines exactly once, plain, well-formed.
for (const [name, mutate] of [
  ["a missing Head reviewed line", (b) => b.replace(/^Head reviewed: .*$/m, "")],
  ["a bulleted Base reviewed line", (b) => b.replace(/^Base reviewed:/m, "- Base reviewed:")],
  [
    "a bold Title reviewed line",
    (b) => b.replace(/^Title reviewed: (.*)$/m, "**Title reviewed:** $1"),
  ],
  ["a second Closes reviewed line", (b) => `${b}\nCloses reviewed: #3`],
  [
    "a short base sha",
    (b) => b.replace(/^(Base reviewed: main at )([0-9a-f]{40})$/m, (_, p, s) => p + s.slice(0, 7)),
  ],
  [
    "a malformed Closes reviewed line",
    (b) => b.replace("Closes reviewed: none", "Closes reviewed: issue 3"),
  ],
]) {
  test(`post_report refuses ${name} and posts nothing`, async (t) => {
    const f = reviewFixture(t);
    const server = await startServer(t, {
      mode: "review",
      env: f.env,
      rules: [prRule(f.pull()), postRule("u")],
    });
    const r = await server.call("post_report", { body: mutate(REPORT(f.base, f.head)) });
    assert.equal(r.isError, true);
    assert.match(r.text, /^the report must carry exactly one plain "/);
    assert.equal(posts(server).length, 0);
  });
}

test("post_report accepts closed issues in this and other repositories", async (t) => {
  const f = reviewFixture(t);
  const server = await startServer(t, {
    mode: "review",
    env: f.env,
    rules: [prRule(f.pull()), postRule("u")],
  });
  const body = REPORT(f.base, f.head).replace(
    "Closes reviewed: none",
    "Closes reviewed: #3, acme/other#4",
  );
  const r = await server.call("post_report", { body });
  assert.equal(r.isError, false, r.text);
});

// stale(): every way the run can stop matching the pull request.
for (const [name, over, expected] of [
  ["closed", { state: "closed" }, /is now closed; nothing posted/],
  ["merged", { state: "closed", merged: true }, /is now merged; nothing posted/],
  ["back in draft", { draft: true }, /converted to a draft/],
  [
    "retargeted",
    { base: { ref: "develop", sha: "0".repeat(40) } },
    /retargeted from main to develop/,
  ],
  ["pushed to", { head: { sha: "f".repeat(40) } }, /head moved to f{40}/],
]) {
  test(`post_report and inline_comment refuse when the pull request was ${name}`, async (t) => {
    const f = reviewFixture(t);
    const server = await startServer(t, {
      mode: "review",
      env: f.env,
      rules: [prRule(f.pull(typeof over === "function" ? over(f) : over)), postRule("u")],
    });
    const report = await server.call("post_report", { body: REPORT(f.base, f.head) });
    assert.equal(report.isError, true);
    assert.match(report.text, expected);
    const inline = await server.call("inline_comment", { path: "b.txt", line: 1, body: "x" });
    assert.equal(inline.isError, true);
    assert.match(inline.text, expected);
    assert.equal(posts(server).length, 0);
  });
}

test("a base push that keeps the merge base leaves the run current", async (t) => {
  const f = reviewFixture(t);
  const moved = "c".repeat(40);
  const server = await startServer(t, {
    mode: "review",
    env: f.env,
    rules: [
      prRule(f.pull({ base: { ref: "main", sha: moved } })),
      {
        match: `^api --method GET repos/acme/widgets/compare/${moved}\\.\\.\\.${f.head}$`,
        stdout: { merge_base_commit: { sha: f.base } },
      },
      postRule("u"),
    ],
  });
  const r = await server.call("post_report", { body: REPORT(f.base, f.head) });
  assert.equal(r.isError, false, r.text);
});

test("a base push that moves the merge base makes the run stale", async (t) => {
  const f = reviewFixture(t);
  const moved = "c".repeat(40);
  const server = await startServer(t, {
    mode: "review",
    env: f.env,
    rules: [
      prRule(f.pull({ base: { ref: "main", sha: moved } })),
      {
        match: "^api --method GET repos/acme/widgets/compare/",
        stdout: { merge_base_commit: { sha: "d".repeat(40) } },
      },
      postRule("u"),
    ],
  });
  const r = await server.call("post_report", { body: REPORT(f.base, f.head) });
  assert.equal(r.isError, true);
  assert.match(
    r.text,
    /moved to c{40} after this run diffed against [0-9a-f]{40}, and the pull request's diff changed/,
  );
  assert.equal(posts(server).length, 0);
});

test("inline_comment checks its arguments and posts on the reviewed head", async (t) => {
  const f = reviewFixture(t);
  const server = await startServer(t, {
    mode: "review",
    env: f.env,
    rules: [prRule(f.pull()), postRule("u")],
  });
  for (const [args, message] of [
    [{ path: "../x", line: 1, body: "x" }, /relative path/],
    [{ path: "-x", line: 1, body: "x" }, /relative path/],
    [{ path: ".git/config", line: 1, body: "x" }, /relative path/],
    [{ path: "b.txt", line: 0, body: "x" }, /positive integer/],
    [{ path: "b.txt", line: 1, body: "  " }, /non-empty/],
  ]) {
    const r = await server.call("inline_comment", args);
    assert.equal(r.isError, true, JSON.stringify(args));
    assert.match(r.text, message);
  }
  assert.equal(posts(server).length, 0);
  const ok = await server.call("inline_comment", { path: "b.txt", line: 1, body: "finding" });
  assert.equal(ok.isError, false, ok.text);
  const sent = JSON.parse(posts(server)[0].stdin);
  assert.deepEqual(sent, {
    body: "finding",
    commit_id: f.head,
    path: "b.txt",
    line: 1,
    side: "RIGHT",
  });
});

test("diff and show refuse paths and refs that could reach outside the checkout", async (t) => {
  const f = reviewFixture(t);
  const server = await startServer(t, { mode: "review", env: f.env });
  assert.match((await server.call("diff", { path: "/etc/passwd" })).text, /relative path/);
  assert.match((await server.call("show", { ref: "--output=/tmp/x" })).text, /ref must be/);
  assert.match((await server.call("show", { ref: "HEAD", path: "../../x" })).text, /relative path/);
  assert.match((await server.call("log", { range: "HEAD" })).text, /range must be/);
  const diff = await server.call("diff", {});
  assert.equal(diff.isError, false);
  assert.match(diff.text, /\+\+\+ b\/b\.txt/);
});

test("a result longer than a page comes in numbered pages", async (t) => {
  const f = reviewFixture(t);
  f.repo.commit("big.txt", "x".repeat(60000) + "\n", "big");
  const env = { ...f.env, HEAD_SHA: f.repo.git("rev-parse", "HEAD") };
  const server = await startServer(t, { mode: "review", env });
  const first = await server.call("diff", { path: "big.txt" });
  assert.match(first.text, /^\[page 1 of 3, 24000 characters each; pass page: 2 for the next\]\n/);
  const last = await server.call("diff", { path: "big.txt", page: 9 });
  assert.match(last.text, /^\[page 3 of 3, 24000 characters each; the last\]\n/);
});

// A head that marks a changed file -diff in its own .gitattributes: git
// reads attributes from the working tree, so a plain diff would show only
// "Binary files differ". The tools read the base's instead.
function hiddenFixture(t) {
  const repo = gitRepo(t);
  const base = repo.commit("app.js", LINES.join("\n") + "\n", "base");
  repo.git("update-ref", "refs/remotes/origin/main", base);
  const head = (branch, line) => {
    repo.git("checkout", "-q", "-b", branch, base);
    repo.commit(".gitattributes", "app.js -diff\n", "attributes");
    const lines = LINES.map((l, i) => (i === 3 ? line : l));
    return repo.commit("app.js", lines.join("\n") + "\n", "change");
  };
  const evil = head("evil", "EVIL");
  const other = head("other", "OTHER");
  repo.git("checkout", "-q", "evil");
  const env = { PR: "7", HEAD_SHA: evil, BASE: "main", GITHUB_WORKSPACE: repo.dir };
  // The checkout really would hide it.
  assert.match(repo.git("diff", `${base}...HEAD`, "--", "app.js"), /^Binary files /m);
  return { repo, base, evil, other, env };
}

test("diff, files and show read the base's attributes, not the head's", async (t) => {
  const f = hiddenFixture(t);
  const server = await startServer(t, { mode: "review", env: f.env });
  const diff = await server.call("diff", {});
  assert.equal(diff.isError, false, diff.text);
  assert.match(diff.text, /^\+app\.js -diff$/m);
  assert.match(diff.text, /^-line 4\n\+EVIL$/m);
  assert.doesNotMatch(diff.text, /Binary files/);
  const one = await server.call("diff", { path: "app.js" });
  assert.match(one.text, /^\+EVIL$/m);
  const files = await server.call("files", {});
  assert.equal(files.text, "1\t0\t.gitattributes\n1\t1\tapp.js\n");
  const show = await server.call("show", { ref: f.evil });
  assert.match(show.text, /^\+EVIL$/m);
});

test("range_diff compares hidden changes by content", async (t) => {
  const f = hiddenFixture(t);
  const server = await startServer(t, { mode: "review", env: { ...f.env, HEAD_SHA: f.other } });
  f.repo.git("checkout", "-q", "other");
  const r = await server.call("range_diff", { old_head: f.evil, new_head: f.other });
  assert.equal(r.isError, false, r.text);
  assert.doesNotMatch(r.text, /^The pull request's diff is unchanged/);
  assert.match(r.text, /^ {4}-\+EVIL$/m);
  assert.match(r.text, /^ {4}\+\+OTHER$/m);
});

test("diff and files keep the base's own attributes", async (t) => {
  // The base decides: a file it marks -diff stays binary for the reviewer.
  const repo = gitRepo(t);
  repo.commit(".gitattributes", "data.bin -diff\n", "attributes");
  const base = repo.commit("data.bin", "one\n", "base");
  repo.git("update-ref", "refs/remotes/origin/main", base);
  repo.git("checkout", "-q", "-b", "feature");
  const head = repo.commit("data.bin", "two\n", "change");
  const env = { PR: "7", HEAD_SHA: head, BASE: "main", GITHUB_WORKSPACE: repo.dir };
  const server = await startServer(t, { mode: "review", env });
  assert.match(
    (await server.call("diff", {})).text,
    /^Binary files a\/data\.bin and b\/data\.bin differ$/m,
  );
  assert.equal((await server.call("files", {})).text, "-\t-\tdata.bin\n");
});

test("range_diff reads each side with its own base's attributes", async (t) => {
  // The last review's base marked app.js -diff, so the reviewer saw no
  // content; the current base drops that, and the same change rebased is
  // content now, which is not an unchanged diff.
  const repo = gitRepo(t);
  repo.commit(".gitattributes", "app.js -diff\n", "attributes");
  const oldBase = repo.commit("app.js", LINES.join("\n") + "\n", "base");
  repo.git("checkout", "-q", "-b", "feature");
  const lines = LINES.map((l, i) => (i === 3 ? "changed" : l));
  const oldHead = repo.commit("app.js", lines.join("\n") + "\n", "change");
  repo.git("checkout", "-q", "main");
  repo.git("rm", "-q", ".gitattributes");
  repo.git("commit", "-q", "-m", "no attributes");
  const base = repo.git("rev-parse", "HEAD");
  repo.git("checkout", "-q", "-b", "rebased");
  repo.git("cherry-pick", oldHead);
  const newHead = repo.git("rev-parse", "HEAD");
  repo.git("update-ref", "refs/remotes/origin/main", base);
  const env = { PR: "7", HEAD_SHA: newHead, BASE: "main", GITHUB_WORKSPACE: repo.dir };
  const server = await startServer(t, { mode: "review", env });
  const r = await server.call("range_diff", {
    old_head: oldHead,
    new_head: newHead,
    old_base: oldBase,
  });
  assert.equal(r.isError, false, r.text);
  assert.doesNotMatch(r.text, /^The pull request's diff is unchanged/);
});

// range_diff: the arguments, a rebase-only head, a changed head, and a
// base given as old_base.
function rangeFixture(t) {
  const f = reviewFixture(t);
  const { git, commit } = f.repo;
  git("checkout", "-q", "main");
  const moved = commit("c.txt", "c\n", "base moves on");
  git("checkout", "-q", "-b", "rebased", f.head);
  git("rebase", "-q", moved);
  const rebased = git("rev-parse", "HEAD");
  git("checkout", "-q", "-b", "changed", moved);
  const changed = commit(
    "b.txt",
    LINES.map((l, i) => (i === 3 ? "changed" : l)).join("\n") + "\n",
    "feature",
  );
  git("update-ref", "refs/remotes/origin/main", moved);
  git("checkout", "-q", "rebased");
  return { ...f, moved, rebased, changed, env: { ...f.env, HEAD_SHA: rebased } };
}

test("range_diff takes commit shas only", async (t) => {
  const f = rangeFixture(t);
  const server = await startServer(t, { mode: "review", env: f.env });
  for (const args of [
    { old_head: "HEAD", new_head: f.rebased },
    { old_head: f.head, new_head: "--output=/tmp/x" },
    { old_head: f.head, new_head: `${f.rebased}..main` },
  ]) {
    const r = await server.call("range_diff", args);
    assert.equal(r.isError, true);
    assert.equal(r.text, "heads must be commit shas");
  }
  const r = await server.call("range_diff", {
    old_head: f.head,
    new_head: f.rebased,
    old_base: "main",
  });
  assert.equal(r.text, "old_base must be a commit sha");
});

test("range_diff says so when the last reviewed head is gone from the checkout", async (t) => {
  // A force-pushed head: well-formed, but no commit here, and not fetched.
  const f = rangeFixture(t);
  const gone = "0123456789abcdef0123456789abcdef01234567";
  const server = await startServer(t, { mode: "review", env: f.env });
  for (const args of [
    { old_head: gone, new_head: f.rebased },
    { old_head: gone, new_head: f.rebased, old_base: f.base },
  ]) {
    const r = await server.call("range_diff", args);
    assert.equal(r.isError, true);
    assert.equal(
      r.text,
      `old_head ${gone} is not in the checkout (the head was force-pushed since the last report); the delta cannot be isolated, so run the full follow-up`,
    );
  }
  // The empty new range needs no old_head, so it still answers.
  const empty = await server.call("range_diff", { old_head: gone, new_head: f.base });
  assert.equal(empty.isError, false, empty.text);
  assert.match(empty.text, / is empty: the base already contains every commit/);
});

test("range_diff with old_base shows a rebase-only head as unchanged", async (t) => {
  const f = rangeFixture(t);
  const server = await startServer(t, { mode: "review", env: f.env });
  const r = await server.call("range_diff", {
    old_head: f.head,
    new_head: f.rebased,
    old_base: f.base,
  });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /^The pull request's diff is unchanged: /);
});

test("range_diff shows a head whose content changed", async (t) => {
  const f = rangeFixture(t);
  const server = await startServer(t, { mode: "review", env: f.env });
  const r = await server.call("range_diff", {
    old_head: f.head,
    new_head: f.changed,
    old_base: f.base,
  });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /^1: {2}[0-9a-f]+ ! 1: {2}[0-9a-f]+ feature$/m);
});

test("range_diff says so when the base already holds every commit of the head", async (t) => {
  // The issue's case: a pull request whose commits all reached the base.
  const f = reviewFixture(t);
  f.repo.git("update-ref", "refs/remotes/origin/main", f.head);
  const server = await startServer(t, { mode: "review", env: f.env });
  const r = await server.call("range_diff", {
    old_head: f.head,
    new_head: f.head,
    old_base: f.base,
  });
  assert.equal(r.isError, false, r.text);
  assert.match(
    r.text,
    /^origin\/main\.\.[0-9a-f]{40} is empty: the base already contains every commit/,
  );
});

test("range_diff reports the diff unchanged when the base took in an empty commit", async (t) => {
  // The head is an empty commit and a real one on the base; the base then
  // fast-forwards over the empty one. range-diff lists it as removed, but
  // the pull request's diff is the same.
  const f = reviewFixture(t);
  const { git, commit } = f.repo;
  git("checkout", "-q", "-b", "empty-first", f.base);
  git("commit", "-q", "--allow-empty", "-m", "empty");
  const empty = git("rev-parse", "HEAD");
  const head = commit("d.txt", "d\n", "real");
  git("update-ref", "refs/remotes/origin/main", empty);
  const server = await startServer(t, { mode: "review", env: { ...f.env, HEAD_SHA: head } });
  const r = await server.call("range_diff", { old_head: head, new_head: head, old_base: f.base });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /^The pull request's diff is unchanged: /);
  assert.match(
    git("range-diff", `${f.base}..${head}`, `${empty}..${head}`),
    /^1: {2}[0-9a-f]+ < -: +-+ empty$/m,
  );
});

test("range_diff shows the series when only commit messages changed", async (t) => {
  // A reword (a footer added) leaves the diff byte-identical, but the
  // message is new, so it is not a rebase.
  const f = reviewFixture(t);
  const { git } = f.repo;
  git("checkout", "-q", "-b", "reworded", f.head);
  git("commit", "-q", "--amend", "-m", "feature\n\nBREAKING CHANGE: the widget moved");
  const reworded = git("rev-parse", "HEAD");
  const server = await startServer(t, { mode: "review", env: { ...f.env, HEAD_SHA: reworded } });
  const r = await server.call("range_diff", { old_head: f.head, new_head: reworded });
  assert.equal(r.isError, false, r.text);
  assert.match(
    r.text,
    /^The pull request's diff is unchanged: .*, but commit messages changed: 1 in origin\/main\.\.[0-9a-f]{40} new or changed, 1 from the last reviewed range dropped or squashed away; review those messages\.\n\nNew or changed in origin\/main\.\.[0-9a-f]{40}:\n\ncommit [0-9a-f]{40}\n {4}feature\n {4}\n {4}BREAKING CHANGE: the widget moved\n\nDropped or squashed away from origin\/main\.\.[0-9a-f]{40}:\n\ncommit [0-9a-f]{40}\n {4}feature\n\ngit range-diff \(merge commits left out\):\n\n1: {2}[0-9a-f]+ ! 1: {2}[0-9a-f]+ feature$/m,
  );
});

test("range_diff gives a merge commit's changed message in full", async (t) => {
  // git range-diff leaves merge commits out, so a reworded merge shows
  // only in the listed messages.
  const f = reviewFixture(t);
  const { git, commit } = f.repo;
  git("checkout", "-q", "-b", "side", f.base);
  commit("s.txt", "s\n", "side");
  git("checkout", "-q", "-b", "merged", f.head);
  git("merge", "-q", "--no-ff", "-m", "merge side", "side");
  const merged = git("rev-parse", "HEAD");
  git("commit", "-q", "--amend", "-m", "merge side\n\nRefs: the merge footer");
  const amended = git("rev-parse", "HEAD");
  const server = await startServer(t, { mode: "review", env: { ...f.env, HEAD_SHA: amended } });
  const r = await server.call("range_diff", { old_head: merged, new_head: amended });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /, but commit messages changed: 1 in .* new or changed, 1 from the last/);
  assert.match(
    r.text,
    new RegExp(`commit ${amended}\n {4}merge side\n {4}\n {4}Refs: the merge footer`),
  );
  assert.match(r.text, new RegExp(`commit ${merged}\n {4}merge side\n\n`));
});

test("range_diff shows the series when a squash dropped a commit message", async (t) => {
  // Two commits squashed into one that keeps only the second message:
  // every new message was in the old range, but the first one is gone.
  const f = reviewFixture(t);
  const { git, commit } = f.repo;
  git("checkout", "-q", "-b", "two", f.head);
  const two = commit("e.txt", "e\n", "second");
  git("checkout", "-q", "-b", "squashed", f.base);
  git("merge", "-q", "--squash", two);
  git("commit", "-q", "-m", "second");
  const squashed = git("rev-parse", "HEAD");
  const server = await startServer(t, { mode: "review", env: { ...f.env, HEAD_SHA: squashed } });
  const r = await server.call("range_diff", { old_head: two, new_head: squashed });
  assert.equal(r.isError, false, r.text);
  assert.match(
    r.text,
    /, but commit messages changed: 0 in .* new or changed, 1 from the last reviewed range dropped or squashed away;/,
  );
});

test("range_diff reads a commit message holding control characters whole", async (t) => {
  // A \x01 and a line that looks like a sha inside a message must not
  // split the commit: the reworded tail still counts as changed.
  const f = reviewFixture(t);
  const { git } = f.repo;
  git("checkout", "-q", "-b", "control", f.head);
  git("commit", "-q", "--amend", "-m", `feature\x01${f.base}\n${f.base}`);
  const old = git("rev-parse", "HEAD");
  git("commit", "-q", "--amend", "-m", "feature");
  const now = git("rev-parse", "HEAD");
  const server = await startServer(t, { mode: "review", env: { ...f.env, HEAD_SHA: now } });
  const r = await server.call("range_diff", { old_head: old, new_head: now });
  assert.equal(r.isError, false, r.text);
  assert.match(
    r.text,
    /, but commit messages changed: 1 in .* new or changed, 1 from the last reviewed range dropped/,
  );
});

test("range_diff with an unchanged diff and an empty old range says everything is new", async (t) => {
  // The last reviewed head added nothing; the new head adds an empty
  // commit only, so both diffs are empty.
  const f = reviewFixture(t);
  const { git } = f.repo;
  git("checkout", "-q", "-b", "only-empty", f.base);
  git("commit", "-q", "--allow-empty", "-m", "empty");
  const head = git("rev-parse", "HEAD");
  const server = await startServer(t, { mode: "review", env: { ...f.env, HEAD_SHA: head } });
  const r = await server.call("range_diff", { old_head: f.base, new_head: head });
  assert.equal(r.isError, false, r.text);
  assert.match(
    r.text,
    /are byte-identical, but origin\/main\.\.[0-9a-f]{40} is empty: .* review them in full:\n\ncommit [0-9a-f]{40}\n {4}empty$/,
  );
});

test("range_diff says so when the last reviewed range was empty", async (t) => {
  const f = rangeFixture(t);
  const server = await startServer(t, { mode: "review", env: f.env });
  const r = await server.call("range_diff", {
    old_head: f.base,
    new_head: f.changed,
    old_base: f.base,
  });
  assert.equal(r.isError, false, r.text);
  assert.match(
    r.text,
    /^[0-9a-f]{40}\.\.[0-9a-f]{40} is empty: the last reviewed head added nothing/,
  );
});

// An old_base gone from the checkout: the base was force-pushed back past
// it after the last report. The origin is a bare repository that still
// serves it under a pull request ref, as GitHub does.
function goneBaseFixture(t) {
  const f = rangeFixture(t);
  const { git } = f.repo;
  const origin = path.join(path.dirname(f.repo.dir), "origin.git");
  git("clone", "-q", "--bare", f.repo.dir, origin);
  // Make the old base in a scratch clone of the origin only.
  const other = path.join(path.dirname(f.repo.dir), "other");
  git("clone", "-q", origin, other);
  const run = (...args) =>
    execFileSync("git", ["-C", other, ...args], {
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Test",
        GIT_AUTHOR_EMAIL: "test@example.com",
        GIT_COMMITTER_NAME: "Test",
        GIT_COMMITTER_EMAIL: "test@example.com",
      },
    }).trim();
  run("checkout", "-q", f.base);
  fs.writeFileSync(path.join(other, "gone.txt"), "gone\n");
  run("add", "gone.txt");
  run("commit", "-q", "-m", "a base commit since force-pushed away");
  const gone = run("rev-parse", "HEAD");
  run("push", "-q", "origin", `${gone}:refs/pull/9/head`);
  git("remote", "add", "origin", origin);
  assert.throws(() => git("cat-file", "-e", `${gone}^{commit}`));
  return { ...f, gone };
}
const reportComments = (base, head, login = "github-actions[bot]", marker = true) => ({
  match: "^api --method GET repos/acme/widgets/issues/7/comments\\?per_page=100&page=1$",
  stdout: [
    {
      id: 1,
      user: { login, type: "Bot" },
      body: `${REPORT(base, head)}${marker ? "\n\n<!-- pr-review run 1001.1 -->\n" : ""}`,
    },
  ],
});

test("range_diff fetches an old_base a report recorded when the checkout lacks it", async (t) => {
  const f = goneBaseFixture(t);
  const server = await startServer(t, {
    mode: "review",
    env: { ...f.env, HEAD_SHA: f.head },
    rules: [reportComments(f.gone, f.head)],
  });
  const r = await server.call("range_diff", {
    old_head: f.head,
    new_head: f.head,
    old_base: f.gone,
  });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /^The pull request's diff is unchanged: /);
  f.repo.git("cat-file", "-e", `${f.gone}^{commit}`);
  // Nothing persisted: no FETCH_HEAD, no credentials in the config.
  assert.ok(!fs.existsSync(path.join(f.repo.dir, ".git/FETCH_HEAD")));
  assert.doesNotMatch(f.repo.git("config", "--local", "--list"), /extraheader/i);
});

test("range_diff fetches only a commit a Claude report names as its base", async (t) => {
  const f = goneBaseFixture(t);
  for (const rule of [
    reportComments(f.base, f.head),
    reportComments(f.gone, f.head, "someone"),
    reportComments(f.gone, f.head, "github-actions[bot]", false),
  ]) {
    const server = await startServer(t, { mode: "review", env: f.env, rules: [rule] });
    const r = await server.call("range_diff", {
      old_head: f.head,
      new_head: f.head,
      old_base: f.gone,
    });
    assert.equal(r.isError, true);
    assert.match(
      r.text,
      /no report on this pull request names it as its Base reviewed commit; .* run the full follow-up$/,
    );
  }
  const server = await startServer(t, { mode: "review", env: f.env });
  const short = await server.call("range_diff", {
    old_head: f.head,
    new_head: f.head,
    old_base: f.gone.slice(0, 12),
  });
  assert.equal(short.isError, true);
  assert.match(short.text, /only a full 40-character sha can be fetched/);
  assert.throws(() => f.repo.git("cat-file", "-e", `${f.gone}^{commit}`));
});

test("range_diff answers an empty new range without fetching a gone old_base", async (t) => {
  // No report names the gone base, so a fetch would be refused; the
  // answer does not need it.
  const f = goneBaseFixture(t);
  const server = await startServer(t, { mode: "review", env: f.env });
  const r = await server.call("range_diff", {
    old_head: f.head,
    new_head: f.base,
    old_base: f.gone,
  });
  assert.equal(r.isError, false, r.text);
  assert.match(
    r.text,
    /^origin\/main\.\.[0-9a-f]{40} is empty: the base already contains every commit/,
  );
  assert.throws(() => f.repo.git("cat-file", "-e", `${f.gone}^{commit}`));
});

test("range_diff says the full follow-up applies when the fetch fails", async (t) => {
  const f = goneBaseFixture(t);
  f.repo.git("remote", "set-url", "origin", path.join(path.dirname(f.repo.dir), "missing.git"));
  const server = await startServer(t, {
    mode: "review",
    env: f.env,
    rules: [reportComments(f.gone, f.head)],
  });
  const r = await server.call("range_diff", {
    old_head: f.head,
    new_head: f.head,
    old_base: f.gone,
  });
  assert.equal(r.isError, true);
  assert.match(
    r.text,
    /is not in the checkout and fetching it by sha failed \(.+\); the base change cannot be isolated, so run the full follow-up$/,
  );
});

// ---------- triage mode ----------

const triageEnv = (extra = {}) => ({ TRIAGE_ISSUE: "8", TRIAGE_EVENT: "issues", ...extra });
const issueRule = (over = {}) => ({
  match: "^api --method GET repos/acme/widgets/issues/8$",
  stdout: {
    number: 8,
    title: "t",
    body: "",
    state: "open",
    labels: [],
    updated_at: "2026-10-01T00:00:00Z",
    user: { login: "dev" },
    ...over,
  },
});

test("open_prs finds this repository's mentions of the issue and which pull requests close it", async (t) => {
  const pulls = [
    [1, "fix: #8 crash", "", "main"],
    [2, "chore", "see #80", "main"],
    [3, "chore", "acme/widgets#8", "main"],
    [4, "chore", "Acme/Widgets#8", "develop"],
    [5, "chore", "other/widgets#8", "main"],
    [6, "chore", "https://github.com/acme/widgets/issues/8", "main"],
    [7, "chore", "https://github.com/acme/widgets/issues/80", "main"],
    [8, "chore", "abc#8 and x/#8", "main"],
    [9, "chore", "Closes #8", "main"],
    [10, "chore", "Closes #8", "develop"],
    [11, "chore", "fixes: acme/widgets#8", "main"],
    [12, "chore", "Resolves https://github.com/acme/widgets/issues/8", "main"],
  ].map(([number, title, body, ref]) => ({
    number,
    title,
    body,
    base: { ref },
    user: { login: "dev", type: "User" },
  }));
  const server = await startServer(t, {
    mode: "triage",
    env: triageEnv(),
    rules: [
      { match: "^api --method GET repos/acme/widgets$", stdout: { default_branch: "main" } },
      // An author with write access; review-screen.test.mjs covers the others.
      {
        match: "^api --method GET repos/acme/widgets/collaborators/dev/permission$",
        stdout: { permission: "write" },
      },
      { match: "pulls\\?state=open&per_page=100&page=1$", stdout: pulls },
    ],
  });
  const r = await server.call("open_prs", {});
  assert.equal(r.isError, false, r.text);
  const items = JSON.parse(r.text).items;
  assert.deepEqual(
    items.map((i) => [i.number, i.closes_this_issue]),
    [
      [1, false],
      [3, false],
      [4, false],
      [6, false],
      [9, true],
      [10, false],
      [11, true],
      [12, true],
    ],
  );
});

// editedAfterApproval, through the info tool.
function infoRules({ lastEditedAt = null, events = [] }) {
  return [
    {
      match: "^api graphql ",
      stdout: { data: { repository: { issue: { lastEditedAt } } } },
    },
    { match: "^api --paginate --slurp repos/acme/widgets/issues/8/timeline", stdout: [events] },
    issueRule(),
  ];
}
const approved = (at) => ({ event: "labeled", label: { name: "agent:approved" }, created_at: at });
for (const [name, fixture, expected] of [
  ["no approval", { lastEditedAt: "2026-10-02T00:00:00Z" }, false],
  [
    "an edit before the approval",
    { lastEditedAt: "2026-10-01T00:00:00Z", events: [approved("2026-10-02T00:00:00Z")] },
    false,
  ],
  [
    "an edit in the approval's second",
    { lastEditedAt: "2026-10-02T00:00:00Z", events: [approved("2026-10-02T00:00:00Z")] },
    true,
  ],
  [
    "an edit after the approval",
    { lastEditedAt: "2026-10-03T00:00:00Z", events: [approved("2026-10-02T00:00:00Z")] },
    true,
  ],
  [
    "a reopen after the approval",
    {
      events: [
        approved("2026-10-02T00:00:00Z"),
        { event: "reopened", created_at: "2026-10-03T00:00:00Z" },
      ],
    },
    true,
  ],
  [
    "a retitle after the approval",
    {
      events: [
        approved("2026-10-02T00:00:00Z"),
        { event: "renamed", created_at: "2026-10-03T00:00:00Z" },
      ],
    },
    true,
  ],
  [
    "a re-approval after the edit",
    {
      lastEditedAt: "2026-10-03T00:00:00Z",
      events: [approved("2026-10-02T00:00:00Z"), approved("2026-10-04T00:00:00Z")],
    },
    false,
  ],
]) {
  test(`info reports edited_after_approval ${expected} for ${name}`, async (t) => {
    const server = await startServer(t, {
      mode: "triage",
      env: triageEnv(),
      rules: infoRules(fixture),
    });
    const r = await server.call("info", {});
    assert.equal(r.isError, false, r.text);
    assert.equal(JSON.parse(r.text).edited_after_approval, expected);
  });
}

test("remove_label takes agent:approved off only on a fresh triage or a later edit", async (t) => {
  const edit = { match: "^issue edit 8 --repo acme/widgets --remove-label ", stdout: "" };
  const stale = await startServer(t, {
    mode: "triage",
    env: triageEnv({ TRIAGE_EVENT: "dispatch" }),
    rules: [
      edit,
      ...infoRules({
        lastEditedAt: "2026-10-01T00:00:00Z",
        events: [approved("2026-10-02T00:00:00Z")],
      }),
    ],
  });
  const refused = await stale.call("remove_label", { label: "agent:approved" });
  assert.equal(refused.isError, true);
  assert.match(refused.text, /may only go on a run the operator started/);
  assert.equal(ghCalls(stale).filter((c) => c.args[0] === "issue").length, 0);

  const edited = await startServer(t, {
    mode: "triage",
    env: triageEnv({ TRIAGE_EVENT: "dispatch" }),
    rules: [
      edit,
      ...infoRules({
        lastEditedAt: "2026-10-03T00:00:00Z",
        events: [approved("2026-10-02T00:00:00Z")],
      }),
    ],
  });
  const ok = await edited.call("remove_label", { label: "agent:approved" });
  assert.equal(ok.isError, false, ok.text);

  const reopened = await startServer(t, {
    mode: "triage",
    env: triageEnv({ TRIAGE_EVENT: "reopened" }),
    rules: [edit, issueRule()],
  });
  assert.equal((await reopened.call("remove_label", { label: "ready" })).isError, false);
  assert.equal((await reopened.call("remove_label", { label: "in-progress" })).isError, false);
  const other = await reopened.call("remove_label", { label: "wontfix" });
  assert.match(other.text, /may not remove 'wontfix'/);
});

test("add_label adds only the bot's labels, never needs-triage", async (t) => {
  const server = await startServer(t, {
    mode: "triage",
    env: triageEnv(),
    rules: [
      { match: "^issue edit 8 --repo acme/widgets --add-label P2$", stdout: "" },
      issueRule(),
    ],
  });
  assert.equal((await server.call("add_label", { label: "P2" })).isError, false);
  for (const label of ["needs-triage", "agent:approved", "ready"])
    assert.match((await server.call("add_label", { label })).text, /may not add/);
});

test("comment posts once with the run marker and never on a pull request", async (t) => {
  const server = await startServer(t, {
    mode: "triage",
    env: triageEnv(),
    rules: [issueRule(), postRule("https://github.com/acme/widgets/issues/8#c1")],
  });
  const r = await server.call("comment", { body: "## Triage\n" });
  assert.equal(r.isError, false, r.text);
  assert.equal(posts(server)[0].stdin, "## Triage\n\n<!-- issue-triage run 1001.1 -->\n");
  assert.match((await server.call("comment", { body: "again" })).text, /already posted/);

  const onPr = await startServer(t, {
    mode: "triage",
    env: triageEnv(),
    rules: [issueRule({ pull_request: { url: "x" } }), postRule("u")],
  });
  const refused = await onPr.call("comment", { body: "x" });
  assert.equal(refused.isError, true);
  assert.match(refused.text, /is a pull request, not an issue/);
  assert.equal(posts(onPr).length, 0);
});

test("with STATE_FILE, a carried-on triage's new server does not comment again", async (t) => {
  const state = path.join(tempDir(t), "agent-kit-state.json");
  const env = triageEnv({ STATE_FILE: state });
  const rules = [issueRule(), postRule("u")];
  const first = await startServer(t, { mode: "triage", env, rules });
  assert.equal((await first.call("comment", { body: "## Triage\n" })).isError, false);
  const next = await startServer(t, { mode: "triage", env, rules });
  assert.match((await next.call("comment", { body: "again" })).text, /already posted/);
  assert.equal(posts(next).length, 0);
});

// ---------- sweep mode ----------

test("dispatch starts a run once per eligible issue still eligible now", async (t) => {
  const dir = fs.mkdtempSync(
    path.join(fs.realpathSync(process.env.TMPDIR || "/tmp"), "kit-sweep-"),
  );
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const eligible = path.join(dir, "eligible");
  const log = path.join(dir, "dispatched");
  fs.writeFileSync(eligible, "8\n9\n");
  fs.writeFileSync(log, "");
  const sweep = {
    mode: "sweep",
    env: { ELIGIBLE_ISSUES: eligible, DISPATCH_LOG: log, GITHUB_REF_NAME: "main" },
    rules: [
      {
        match: "issues/8$",
        stdout: {
          state: "open",
          labels: [{ name: "needs-triage" }],
          updated_at: "2026-10-01T00:00:00Z",
        },
      },
      {
        match: "issues/9$",
        stdout: {
          state: "open",
          labels: [{ name: "triaged" }],
          updated_at: "2026-10-01T00:00:00Z",
        },
      },
      {
        match: "^workflow run issue-triage.yml --repo acme/widgets --ref main -f issue=8$",
        stdout: "",
      },
    ],
  };
  const server = await startServer(t, sweep);
  assert.match(
    (await server.call("dispatch", { number: 7 })).text,
    /not in this sweep's eligible list/,
  );
  assert.match(
    (await server.call("dispatch", { number: 8 })).text,
    /^dispatched issue-triage.yml for #8 on main$/,
  );
  assert.match((await server.call("dispatch", { number: 8 })).text, /already dispatched/);
  assert.match(
    (await server.call("dispatch", { number: 9 })).text,
    /^not dispatched: #9 now carries triaged/,
  );
  assert.equal(fs.readFileSync(log, "utf8"), "8\n9\n");
  assert.equal(ghCalls(server).filter((c) => c.args[0] === "workflow").length, 1);
  // OpenCode carries a sweep on after a capacity refusal in a new process,
  // whose new server reads the log back.
  const next = await startServer(t, sweep);
  for (const number of [8, 9])
    assert.match((await next.call("dispatch", { number })).text, /already dispatched/);
  assert.equal(ghCalls(next).length, 0);
  assert.equal(fs.readFileSync(log, "utf8"), "8\n9\n");
});

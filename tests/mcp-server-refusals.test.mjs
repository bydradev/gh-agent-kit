// The MCP server's refusals that no other test asserted as refusals: each
// call breaks one rule, must come back as an error naming it, and must
// leave GitHub unwritten. A refusal that only changed its wording, or one
// that let the call go on, fails here.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ghCalls, gitRepo, startServer, tempDir } from "./helpers/server.mjs";

const writes = (server) =>
  ghCalls(server).filter(
    (c) => c.args.includes("POST") || c.args.includes("PATCH") || c.args[0] === "issue",
  );

async function refuses(server, cases) {
  for (const [tool, args, message] of cases) {
    const r = await server.call(tool, args);
    assert.equal(r.isError, true, `${tool} ${JSON.stringify(args)}: ${r.text}`);
    assert.match(r.text, message, `${tool} ${JSON.stringify(args)}`);
  }
  assert.deepEqual(writes(server), []);
}

// A checkout on a feature branch over origin/main, and the server's state
// file holding what the run has already posted.
function review(t, state) {
  const repo = gitRepo(t);
  const base = repo.commit("a.txt", "a\n", "base");
  repo.git("checkout", "-q", "-b", "feature");
  const head = repo.commit("b.txt", "b\n", "feature");
  repo.git("update-ref", "refs/remotes/origin/main", base);
  const env = { PR: "7", HEAD_SHA: head, BASE: "main", GITHUB_WORKSPACE: repo.dir };
  if (state) {
    env.STATE_FILE = path.join(tempDir(t), "state.json");
    fs.writeFileSync(env.STATE_FILE, JSON.stringify(state));
  }
  const pull = {
    number: 7,
    title: "feat: add a widget",
    body: "",
    state: "open",
    draft: false,
    user: { login: "dev" },
    base: { ref: "main", sha: base },
    head: { sha: head },
  };
  const rules = [
    { match: "^api --method GET repos/acme/widgets/pulls/7$", stdout: pull },
    {
      match: "^api --method GET repos/acme/widgets/issues/12$",
      stdout: {
        number: 12,
        title: "a pull request",
        pull_request: {},
        repository_url: "https://api.github.com/repos/acme/widgets",
        user: { login: "dev", type: "User" },
      },
    },
    {
      match: "issues\\?state=all&creator=github-actions%5Bbot%5D&per_page=100&page=1$",
      stdout: [],
    },
  ];
  return { env, rules };
}

test("the review's tools refuse bad arguments and spent limits, and write nothing", async (t) => {
  const f = review(t);
  const server = await startServer(t, { mode: "review", env: f.env, rules: f.rules });
  await refuses(server, [
    ["comment_body", { kind: "issue", id: 0 }, /^id must be a positive integer/],
    ["comment_body", { kind: "commit", id: 1 }, /^kind must be issue, inline or review/],
    ["issue", { number: 0 }, /^number must be a positive integer/],
    ["issue", { number: 12 }, /^#12 is a pull request, not an issue/],
    ["issue_comments", { number: -1 }, /^number must be a positive integer/],
    ["diff", { path: "../outside" }, /^path must be a relative path inside the checkout/],
    ["show", { ref: "--output=x" }, /^ref must be a sha, HEAD or origin\/<branch>/],
    [
      "show",
      { ref: "HEAD", path: "/etc/passwd" },
      /^path must be a relative path inside the checkout/,
    ],
    ["log", { range: "HEAD" }, /^range must be <ref>\.\.<ref>/],
    [
      "range_diff",
      { old_head: "a".repeat(40), new_head: "b".repeat(40), old_base: "main" },
      /^old_base must be a commit sha/,
    ],
    [
      "file_issue",
      { finding: "R1-01", title: "t", outcome: "o", acceptance: "- [ ] a", references: 5 },
      /^references must be text/,
    ],
    ["post_report", { body: "  \n" }, /^body must be non-empty text/],
  ]);
});

test("the review's per-run limits hold from the state file", async (t) => {
  const f = review(t, { report: false, inline: 40, issues: 5, comment: false });
  const server = await startServer(t, { mode: "review", env: f.env, rules: f.rules });
  await refuses(server, [
    [
      "inline_comment",
      { path: "b.txt", line: 1, body: "x" },
      /^this run has posted 40 inline comments/,
    ],
    [
      "file_issue",
      { finding: "R1-09", title: "t", outcome: "o", acceptance: "- [ ] a" },
      /^this run has filed 5 issues/,
    ],
  ]);
});

const triageIssue = (over = {}) => ({
  match: "^api --method GET repos/acme/widgets/issues/8$",
  stdout: {
    number: 8,
    title: "t",
    body: "",
    state: "open",
    labels: [],
    updated_at: "2026-10-01T00:00:00Z",
    repository_url: "https://api.github.com/repos/acme/widgets",
    user: { login: "dev" },
    ...over,
  },
});

test("triage's tools refuse bad arguments, labels it may not move and a second comment", async (t) => {
  const state = path.join(tempDir(t), "state.json");
  fs.writeFileSync(state, JSON.stringify({ comment: true }));
  const server = await startServer(t, {
    mode: "triage",
    env: { TRIAGE_ISSUE: "8", TRIAGE_EVENT: "issues", STATE_FILE: state },
    rules: [
      triageIssue(),
      {
        match: "^api --method GET repos/acme/widgets/issues/12$",
        stdout: {
          number: 12,
          title: "a pull request",
          pull_request: {},
          repository_url: "https://api.github.com/repos/acme/widgets",
          user: { login: "dev", type: "User" },
        },
      },
    ],
  });
  await refuses(server, [
    ["search", { terms: "  " }, /^terms must be non-empty text/],
    ["read_issue", { number: 0 }, /^number must be a positive integer/],
    ["read_issue", { number: 12 }, /^#12 is a pull request, not an issue/],
    ["add_label", { label: "agent:approved" }, /^the bot may not add 'agent:approved'/],
    ["add_label", { label: "requested" }, /^the bot may not add 'requested'/],
    ["remove_label", { label: "requested" }, /^the bot may not remove 'requested'/],
    ["remove_label", { label: "bug-ish" }, /^the bot may not remove 'bug-ish'/],
    ["comment", { body: "## Triage\n\nAgain." }, /^this run has already posted its one comment/],
  ]);
});

test("triage refuses an empty comment", async (t) => {
  const server = await startServer(t, {
    mode: "triage",
    env: { TRIAGE_ISSUE: "8", TRIAGE_EVENT: "issues" },
    rules: [triageIssue()],
  });
  await refuses(server, [["comment", { body: " \n " }, /^body must be non-empty text/]]);
});

test("the sweep's dispatch refuses a bad number, one off the list, and a second dispatch", async (t) => {
  const dir = tempDir(t);
  const env = {
    ELIGIBLE_ISSUES: path.join(dir, "eligible"),
    DISPATCH_LOG: path.join(dir, "dispatched"),
    DISPATCH_QUEUE: path.join(dir, "dispatch-queue"),
    GITHUB_REF_NAME: "main",
  };
  fs.writeFileSync(env.ELIGIBLE_ISSUES, "8\n");
  fs.writeFileSync(env.DISPATCH_LOG, "");
  fs.writeFileSync(env.DISPATCH_QUEUE, "");
  const server = await startServer(t, {
    mode: "sweep",
    env,
    rules: [triageIssue({ labels: [{ name: "needs-triage" }] })],
  });
  const first = await server.call("dispatch", { number: 8 });
  assert.equal(first.isError, false, first.text);
  await refuses(server, [
    ["dispatch", { number: 0 }, /^number must be a positive integer/],
    ["dispatch", { number: 7 }, /^#7 is not in this sweep's eligible list/],
    ["dispatch", { number: 8 }, /^#8 was already dispatched by this sweep/],
  ]);
  // One queued run, from the one call allowed.
  assert.equal(fs.readFileSync(env.DISPATCH_QUEUE, "utf8"), "8\n");
});

test("the server refuses an unknown mode", async (t) => {
  const server = await startServer(t, { mode: "deploy", env: {} });
  assert.notEqual(await server.exited, 0);
  assert.match(server.stderr(), /usage: mcp-server\.mjs review \| triage \| sweep/);
});

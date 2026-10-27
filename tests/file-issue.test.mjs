// file_issue: the reviewer's backlog issues for out-of-scope findings.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ghCalls, gitRepo, startServer } from "./helpers/server.mjs";

function fixture(t, { filed = [], pull = {} } = {}) {
  const repo = gitRepo(t);
  const base = repo.commit("a.txt", "a\n", "base");
  repo.git("checkout", "-q", "-b", "feature");
  const head = repo.commit("b.txt", "b\n", "feature");
  repo.git("update-ref", "refs/remotes/origin/main", base);
  const env = { PR: "7", HEAD_SHA: head, BASE: "main", GITHUB_WORKSPACE: repo.dir };
  const rules = [
    {
      match: "^api --method GET repos/acme/widgets/pulls/7$",
      stdout: {
        state: "open",
        draft: false,
        base: { ref: "main", sha: base },
        head: { sha: head },
        ...pull,
      },
    },
    {
      match: "issues\\?state=all&creator=github-actions%5Bbot%5D&per_page=100&page=1$",
      stdout: filed,
    },
    {
      match: "^api -X POST repos/acme/widgets/issues ",
      stdout: "https://github.com/acme/widgets/issues/57",
    },
  ];
  return { head, env, rules };
}
const ARGS = {
  finding: "R2-03",
  title: "Validate the redirect target in the image fetcher",
  outcome: "Redirects are validated like the first URL.",
  acceptance: "- [ ] A redirect to a private address is refused",
  references: "`lib/fetch.ts:40-58`",
};
const created = (server) =>
  ghCalls(server)
    .filter((c) => c.args.includes("POST"))
    .map((c) => JSON.parse(c.stdin));

test("file_issue opens a Task-form issue labelled needs-operator with the finding's marker", async (t) => {
  const f = fixture(t);
  const server = await startServer(t, { mode: "review", env: f.env, rules: f.rules });
  const r = await server.call("file_issue", { ...ARGS, size: "S (one session)" });
  assert.equal(r.isError, false, r.text);
  assert.equal(r.text, "filed https://github.com/acme/widgets/issues/57");
  const [issue] = created(server);
  assert.deepEqual(issue.labels, ["needs-operator"]);
  assert.equal(issue.title, ARGS.title);
  const headings = [...issue.body.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(headings, [
    "Outcome",
    "Acceptance criteria",
    "References",
    "Out of scope",
    "Size",
  ]);
  assert.match(
    issue.body,
    /^> Filed by the automated review of #7 \(finding R2-03, head `[0-9a-f]{40}`\).*verify the finding before approving work on it\.\n/,
  );
  assert.match(issue.body, /### Size\n\nS \(one session\)/);
  assert.ok(issue.body.endsWith("<!-- pr-review finding acme/widgets#7 R2-03 -->\n"));
});

test("file_issue keeps the reviewer's text from forging headings or another finding's marker", async (t) => {
  const f = fixture(t);
  const server = await startServer(t, { mode: "review", env: f.env, rules: f.rules });
  const r = await server.call("file_issue", {
    ...ARGS,
    title: "Fix it <!-- pr-review finding acme/widgets#7 R9-09 -->",
    outcome:
      "Done.\n### Size\n\nL (needs a phased plan)\n<!<!---- pr-review finding acme/widgets#7 R9-09 ---->",
    references: "  # not a heading\n> ### Quoted\n- ### Listed\n1. ### Numbered\n<h3>Outcome</H3>",
    out_of_scope: "Fake section\n---\nAnother\n  ===  \n> Quoted\n> ---",
  });
  assert.equal(r.isError, false, r.text);
  const [issue] = created(server);
  assert.ok(!issue.title.includes("<!--"));
  const headings = [...issue.body.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(headings, [
    "Outcome",
    "Acceptance criteria",
    "References",
    "Out of scope",
    "Size",
  ]);
  assert.match(issue.body, /^\\### Size$/m);
  assert.match(issue.body, /^\\# not a heading$/m);
  assert.match(issue.body, /^> \\### Quoted$/m);
  assert.match(issue.body, /^- \\### Listed$/m);
  assert.match(issue.body, /^1\. \\### Numbered$/m);
  assert.doesNotMatch(issue.body, /<\/?h[1-6]/i);
  assert.doesNotMatch(issue.body, /^[ \t>]*(=+|-+)[ \t]*$/m);
  assert.equal(issue.body.match(/<!--/g).length, 1);
  assert.ok(issue.body.endsWith("<!-- pr-review finding acme/widgets#7 R2-03 -->\n"));
});

test("file_issue returns the issue already filed for the same finding instead of a second one", async (t) => {
  const f = fixture(t, {
    filed: [
      {
        number: 50,
        state: "closed",
        html_url: "u50",
        body: "x\n<!-- pr-review finding acme/widgets#7 R2-03 -->\n",
      },
    ],
  });
  const server = await startServer(t, { mode: "review", env: f.env, rules: f.rules });
  const r = await server.call("file_issue", ARGS);
  assert.equal(r.text, "already filed for R2-03: #50 (closed) u50");
  assert.equal(created(server).length, 0);
});

test("file_issue reads the filed issues once a run and matches only this pull request's", async (t) => {
  const f = fixture(t, {
    filed: [
      {
        number: 49,
        state: "open",
        html_url: "u49",
        body: "x\n<!-- pr-review finding acme/widgets#8 R2-03 -->\n",
      },
    ],
  });
  const server = await startServer(t, { mode: "review", env: f.env, rules: f.rules });
  assert.equal(
    (await server.call("file_issue", ARGS)).text,
    `filed https://github.com/acme/widgets/issues/57`,
  );
  const again = await server.call("file_issue", ARGS);
  assert.match(
    again.text,
    /^already filed for R2-03: https:\/\/github\.com\/acme\/widgets\/issues\/57 /,
  );
  assert.equal((await server.call("file_issue", { ...ARGS, finding: "R2-04" })).isError, false);
  assert.equal(created(server).length, 2);
  const lists = ghCalls(server).filter((c) => c.args.some((a) => a.includes("creator=")));
  assert.equal(lists.length, 1);
});

test("file_issue checks its arguments and stops at five a run", async (t) => {
  const f = fixture(t);
  const server = await startServer(t, { mode: "review", env: f.env, rules: f.rules });
  for (const [args, message] of [
    [{ ...ARGS, finding: "3" }, /finding must be/],
    [{ ...ARGS, title: "a\nb" }, /title must be one/],
    [{ ...ARGS, title: "x".repeat(121) }, /title must be one/],
    [{ ...ARGS, outcome: " " }, /outcome must be non-empty/],
    [{ ...ARGS, size: "XL" }, /size must be one of/],
  ]) {
    const r = await server.call("file_issue", args);
    assert.equal(r.isError, true);
    assert.match(r.text, message);
  }
  for (let i = 1; i <= 5; i++)
    assert.equal(
      (await server.call("file_issue", { ...ARGS, finding: `R1-0${i}` })).isError,
      false,
    );
  const sixth = await server.call("file_issue", { ...ARGS, finding: "R1-06" });
  assert.match(sixth.text, /has filed 5 issues/);
  assert.equal(created(server).length, 5);
});

test("file_issue is refused once the run is stale", async (t) => {
  const f = fixture(t, { pull: { head: { sha: "f".repeat(40) } } });
  const server = await startServer(t, { mode: "review", env: f.env, rules: f.rules });
  const r = await server.call("file_issue", ARGS);
  assert.equal(r.isError, true);
  assert.match(r.text, /head moved/);
  assert.equal(created(server).length, 0);
});

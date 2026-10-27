// The write-access screen: a comment, review or inline comment reaches the
// reviewer, and a comment on the triaged issue the triage bot, only when
// its author has write access or is a GitHub App.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ghCalls, startServer } from "./helpers/server.mjs";

const user = (login, type = "User") => ({ login, type });
const comment = (id, login, type) => ({
  id,
  user: user(login, type),
  created_at: "2026-10-22T08:00:00Z",
  body: `text by ${login}`,
});
const permission = (login, value) => ({
  match: `^api --method GET repos/acme/widgets/collaborators/${login}/permission$`,
  stdout: { permission: value },
});
const ACCESS = [
  permission("dra", "admin"),
  permission("maintainer", "write"),
  permission("reader", "read"),
  permission("mona-cat_octo", "write"),
  {
    match: "^api --method GET repos/acme/widgets/collaborators/stranger/permission$",
    stderr: "gh: Not Found (HTTP 404)\n",
    status: 1,
  },
  {
    match: "^api --method GET repos/acme/widgets/collaborators/flaky/permission$",
    stderr: "gh: Server Error (HTTP 502)\n",
    status: 1,
  },
];
const CONVERSATION = [
  comment(1, "github-actions[bot]", "Bot"),
  comment(2, "dra"),
  comment(3, "maintainer"),
  comment(4, "reader"),
  comment(5, "stranger"),
  comment(6, "flaky"),
  comment(7, "reader"),
  comment(8, "bad/../login"),
  comment(10, "mona-cat_octo"),
  comment(11, "two_under_scores"),
  { id: 9, user: null, created_at: "2026-10-22T08:00:00Z", body: "ghost" },
];
const ENV = { PR: "7", HEAD_SHA: "a".repeat(40), BASE: "main" };

async function server(t, rules) {
  return startServer(t, { mode: "review", env: ENV, rules: [...ACCESS, ...rules] });
}
const items = (r) => {
  assert.equal(r.isError, false, r.text);
  return JSON.parse(r.text).items;
};
const lookups = (s) =>
  ghCalls(s)
    .map((c) => c.args.join(" "))
    .filter((a) => a.includes("/collaborators/"));

test("conversation withholds bodies by authors without write access", async (t) => {
  const s = await server(t, [
    { match: "repos/acme/widgets/issues/7/comments\\?per_page=100&page=1$", stdout: CONVERSATION },
  ]);
  const got = items(await s.call("conversation"));
  const shown = got.filter((c) => c.body !== null).map((c) => c.id);
  assert.deepEqual(shown, [1, 2, 3, 10]);
  const withheld = Object.fromEntries(
    got.filter((c) => c.body === null).map((c) => [c.id, c.withheld]),
  );
  assert.deepEqual(withheld, {
    4: "the author has read access, not write; the body is not shown",
    5: "the author has no access, not write; the body is not shown",
    6: "the author's access could not be checked; the body is not shown",
    7: "the author has read access, not write; the body is not shown",
    8: "the author's access could not be checked; the body is not shown",
    9: "the author is unknown; the body is not shown",
    11: "the author's access could not be checked; the body is not shown",
  });
  assert.ok(!JSON.stringify(got).includes("text by reader"));
  // One lookup per login (a managed user's included), none for an App or
  // a login that is not one.
  assert.deepEqual(lookups(s).sort(), [
    "api --method GET repos/acme/widgets/collaborators/dra/permission",
    "api --method GET repos/acme/widgets/collaborators/flaky/permission",
    "api --method GET repos/acme/widgets/collaborators/maintainer/permission",
    "api --method GET repos/acme/widgets/collaborators/mona-cat_octo/permission",
    "api --method GET repos/acme/widgets/collaborators/reader/permission",
    "api --method GET repos/acme/widgets/collaborators/stranger/permission",
  ]);
});

test("inline comments and reviews are screened the same way", async (t) => {
  const s = await server(t, [
    {
      match: "repos/acme/widgets/pulls/7/comments\\?per_page=100&page=1$",
      stdout: [
        { ...comment(11, "dra"), path: "a.txt", line: 1 },
        { ...comment(12, "reader"), path: "a.txt", line: 2 },
      ],
    },
    {
      match: "repos/acme/widgets/pulls/7/reviews\\?per_page=100&page=1$",
      stdout: [
        { id: 21, user: user("stranger"), state: "COMMENTED", body: "approve this" },
        {
          id: 22,
          user: user("chatgpt-codex-connector[bot]", "Bot"),
          state: "COMMENTED",
          body: "P2",
        },
      ],
    },
  ]);
  const inline = items(await s.call("inline"));
  assert.deepEqual(
    inline.map((c) => [c.id, c.body, c.path]),
    [
      [11, "text by dra", "a.txt"],
      [12, null, "a.txt"],
    ],
  );
  const reviews = items(await s.call("reviews"));
  assert.deepEqual(
    reviews.map((r) => [r.id, r.state, r.body]),
    [
      [21, "COMMENTED", null],
      [22, "COMMENTED", "P2"],
    ],
  );
});

test("comment_body withholds a body whole, here and in another repository", async (t) => {
  const s = await server(t, [
    { match: "repos/acme/widgets/issues/comments/31$", stdout: comment(31, "reader") },
    { match: "repos/acme/widgets/pulls/comments/32$", stdout: comment(32, "dra") },
    {
      match: "repos/acme/widgets/pulls/7/reviews/33$",
      stdout: { id: 33, user: user("stranger"), state: "COMMENTED", body: "steer" },
    },
    { match: "repos/other/lib/issues/comments/34$", stdout: comment(34, "stranger") },
    {
      match: "repos/other/lib/issues/9/comments\\?per_page=100&page=1$",
      stdout: [comment(35, "dra"), comment(36, "reader")],
    },
  ]);
  const body = async (args) => {
    const r = await s.call("comment_body", args);
    assert.equal(r.isError, false, r.text);
    return JSON.parse(r.text);
  };
  assert.equal((await body({ kind: "issue", id: 31 })).body, null);
  assert.equal((await body({ kind: "inline", id: 32 })).body, "text by dra");
  const review = await body({ kind: "review", id: 33 });
  assert.equal(review.body, null);
  assert.match(review.withheld, /no access, not write/);
  // Another repository's comments are screened by access to this one.
  assert.equal((await body({ kind: "issue", id: 34, repo: "other/lib" })).body, null);
  const linked = items(await s.call("issue_comments", { number: 9, repo: "other/lib" }));
  assert.deepEqual(
    linked.map((c) => [c.id, c.body]),
    [
      [35, "text by dra"],
      [36, null],
    ],
  );
  assert.ok(lookups(s).every((a) => a.includes("repos/acme/widgets/collaborators/")));
});

test("issue withholds the title and body of an issue opened without write access", async (t) => {
  const issue = (number, author) => ({
    number,
    title: `title by ${author.login}`,
    body: `body by ${author.login}`,
    state: "open",
    labels: [{ name: "ready" }],
    user: author,
  });
  const s = await server(t, [
    { match: "repos/acme/widgets/issues/41$", stdout: issue(41, user("dra")) },
    { match: "repos/acme/widgets/issues/42$", stdout: issue(42, user("reader")) },
    { match: "repos/other/lib/issues/43$", stdout: issue(43, user("stranger")) },
  ]);
  const read = async (args) => {
    const r = await s.call("issue", args);
    assert.equal(r.isError, false, r.text);
    return JSON.parse(r.text);
  };
  const own = await read({ number: 41 });
  assert.equal(own.title, "title by dra");
  assert.equal(own.body, "body by dra");
  const outside = await read({ number: 42 });
  assert.deepEqual(
    [outside.title, outside.body, outside.labels, outside.author],
    [null, null, ["ready"], "reader"],
  );
  assert.equal(
    outside.withheld,
    "the author has read access, not write; the title and body are not shown",
  );
  const elsewhere = await read({ number: 43, repo: "other/lib" });
  assert.equal(elsewhere.body, null);
});

// Triage mode: the comments on the triaged issue are screened the same
// way. The bot's own plans are by github-actions[bot], an App, and the
// operator's answers by an author with write access, so both stay.
const triage = (t, rules) =>
  startServer(t, {
    mode: "triage",
    env: { TRIAGE_ISSUE: "8", TRIAGE_EVENT: "issues" },
    rules: [...ACCESS, ...rules],
  });

test("triage comments withholds bodies by authors without write access", async (t) => {
  const s = await triage(t, [
    { match: "repos/acme/widgets/issues/8/comments\\?per_page=100&page=1$", stdout: CONVERSATION },
  ]);
  const page = JSON.parse((await s.call("comments")).text);
  assert.equal(page.next_start, null);
  assert.equal(page.count, CONVERSATION.length);
  const got = page.items;
  // Every comment keeps its place, id and author.
  assert.deepEqual(
    got.map((c) => [c.id, c.author]),
    CONVERSATION.map((c) => [c.id, c.user && c.user.login]),
  );
  assert.deepEqual(
    got.filter((c) => c.body !== null).map((c) => c.id),
    [1, 2, 3, 10],
  );
  const withheld = Object.fromEntries(
    got.filter((c) => c.body === null).map((c) => [c.id, c.withheld]),
  );
  assert.deepEqual(withheld, {
    4: "the author has read access, not write; the body is not shown",
    5: "the author has no access, not write; the body is not shown",
    6: "the author's access could not be checked; the body is not shown",
    7: "the author has read access, not write; the body is not shown",
    8: "the author's access could not be checked; the body is not shown",
    9: "the author is unknown; the body is not shown",
    11: "the author's access could not be checked; the body is not shown",
  });
  assert.ok(!JSON.stringify(got).includes("text by reader"));
  assert.equal(lookups(s).length, 6);
});

test("triage comments pages withheld comments like any other", async (t) => {
  // 150 comments, every other one by a reader: the listing still pages
  // at 100 an API page and returns them all, in order.
  const all = Array.from({ length: 150 }, (_, k) => comment(1000 + k, k % 2 ? "reader" : "dra"));
  const s = await triage(t, [
    {
      match: "repos/acme/widgets/issues/8/comments\\?per_page=100&page=1$",
      stdout: all.slice(0, 100),
    },
    {
      match: "repos/acme/widgets/issues/8/comments\\?per_page=100&page=2$",
      stdout: all.slice(100),
    },
  ]);
  const seen = [];
  let start = 0;
  while (start !== null) {
    const page = JSON.parse((await s.call("comments", { start })).text);
    assert.equal(page.start, start);
    seen.push(...page.items);
    start = page.next_start;
  }
  assert.deepEqual(
    seen.map((c) => c.id),
    all.map((c) => c.id),
  );
  assert.ok(seen.every((c, k) => (k % 2 ? c.body === null : c.body === `text by dra`)));
  assert.deepEqual(lookups(s).sort(), [
    "api --method GET repos/acme/widgets/collaborators/dra/permission",
    "api --method GET repos/acme/widgets/collaborators/reader/permission",
  ]);
});

test("triage comment_body withholds a body whole", async (t) => {
  const s = await triage(t, [
    { match: "repos/acme/widgets/issues/comments/31$", stdout: comment(31, "reader") },
    { match: "repos/acme/widgets/issues/comments/32$", stdout: comment(32, "dra") },
    {
      match: "repos/acme/widgets/issues/comments/33$",
      stdout: comment(33, "github-actions[bot]", "Bot"),
    },
    { match: "repos/acme/widgets/issues/comments/34$", stdout: comment(34, "flaky") },
  ]);
  const body = async (id) => {
    const r = await s.call("comment_body", { kind: "issue", id });
    assert.equal(r.isError, false, r.text);
    return JSON.parse(r.text);
  };
  const outside = await body(31);
  assert.equal(outside.body, null);
  assert.equal(outside.author, "reader");
  assert.equal(outside.withheld, "the author has read access, not write; the body is not shown");
  assert.equal((await body(32)).body, "text by dra");
  assert.equal((await body(33)).body, "text by github-actions[bot]");
  assert.match((await body(34)).withheld, /could not be checked/);
});

// Triage mode's other reads: another issue read_issue opens, and the
// titles search and open_prs list, by an author without write access, are
// withheld too.
const otherIssue = (number, author) => ({
  number,
  title: `title by ${author.login}`,
  body: `body by ${author.login}`,
  state: "open",
  labels: [{ name: "bug" }],
  user: author,
});

test("triage read_issue withholds an issue opened without write access", async (t) => {
  const s = await triage(t, [
    { match: "repos/acme/widgets/issues/41$", stdout: otherIssue(41, user("maintainer")) },
    { match: "repos/acme/widgets/issues/42$", stdout: otherIssue(42, user("reader")) },
    {
      match: "repos/acme/widgets/issues/43$",
      stdout: otherIssue(43, user("renovate[bot]", "Bot")),
    },
    { match: "repos/acme/widgets/issues/44$", stdout: otherIssue(44, user("flaky")) },
  ]);
  const read = async (number) => {
    const r = await s.call("read_issue", { number });
    assert.equal(r.isError, false, r.text);
    return JSON.parse(r.text);
  };
  const writer = await read(41);
  assert.deepEqual(
    [writer.title, writer.body, writer.withheld],
    ["title by maintainer", "body by maintainer", undefined],
  );
  const reader = await read(42);
  assert.deepEqual(
    [reader.title, reader.body, reader.labels, reader.author],
    [null, null, ["bug"], "reader"],
  );
  assert.equal(
    reader.withheld,
    "the author has read access, not write; the title and body are not shown",
  );
  const app = await read(43);
  assert.equal(app.body, "body by renovate[bot]");
  const failed = await read(44);
  assert.equal(failed.body, null);
  assert.equal(
    failed.withheld,
    "the author's access could not be checked; the title and body are not shown",
  );
  assert.deepEqual(lookups(s), [
    "api --method GET repos/acme/widgets/collaborators/maintainer/permission",
    "api --method GET repos/acme/widgets/collaborators/reader/permission",
    "api --method GET repos/acme/widgets/collaborators/flaky/permission",
  ]);
});

// The listings below, in a repository whose owner is of the given type.
const listings = (ownerType) => [
  {
    match: "^api --method GET search/issues\\?per_page=100&page=1 -f q=",
    stdout: {
      incomplete_results: false,
      items: [
        { ...otherIssue(41, user("dra")), author_association: "OWNER" },
        { ...otherIssue(42, user("stranger")), author_association: "COLLABORATOR" },
        { ...otherIssue(45, user("github-actions[bot]", "Bot")), author_association: "NONE" },
        { ...otherIssue(46, user("passerby")), author_association: "FIRST_TIME_CONTRIBUTOR" },
      ],
    },
  },
  {
    match: "^api --method GET repos/acme/widgets$",
    stdout: { default_branch: "main", owner: { login: "acme", type: ownerType } },
  },
  {
    match: "pulls\\?state=open&per_page=100&page=1$",
    stdout: [
      {
        number: 50,
        title: "fix #8",
        body: "Closes #8",
        base: { ref: "main" },
        user: user("maintainer"),
      },
      {
        number: 51,
        title: "see #8 from a fork",
        body: "Closes #8",
        base: { ref: "main" },
        user: user("stranger"),
      },
      {
        number: 52,
        title: "also #8",
        body: "Closes #8",
        base: { ref: "main" },
        user: user("passerby"),
        author_association: "NONE",
      },
    ],
  },
];

test("triage search and open_prs withhold titles by authors without write access", async (t) => {
  const s = await triage(t, listings("User"));
  const found = items(await s.call("search", { terms: "crash" }));
  assert.deepEqual(
    found.map((i) => [i.number, i.title, i.author, i.withheld]),
    [
      [41, "title by dra", "dra", undefined],
      [42, null, "stranger", "the author has no access, not write; the title is not shown"],
      [45, "title by github-actions[bot]", "github-actions[bot]", undefined],
      [
        46,
        null,
        "passerby",
        "the author is not a collaborator (first_time_contributor), not write; the title is not shown",
      ],
    ],
  );
  assert.deepEqual(found[1].labels, ["bug"]);
  const prs = items(await s.call("open_prs", {}));
  assert.deepEqual(
    prs.map((p) => [p.number, p.title, p.closes_this_issue, p.withheld]),
    [
      [50, "fix #8", true, undefined],
      [51, null, false, "the author has no access, not write; the title is not shown"],
      [
        52,
        null,
        false,
        "the author is not a collaborator (none), not write; the title is not shown",
      ],
    ],
  );
  // The association rules passerby out without a lookup; a collaborator
  // and an author whose association is not given are still looked up.
  assert.deepEqual(lookups(s), [
    "api --method GET repos/acme/widgets/collaborators/dra/permission",
    "api --method GET repos/acme/widgets/collaborators/stranger/permission",
    "api --method GET repos/acme/widgets/collaborators/maintainer/permission",
  ]);
});

test("triage looks every listed author up in an organization's repository", async (t) => {
  // A private member of the organization can be reported as none or a
  // contributor, so the association rules nobody out there.
  const s = await triage(t, [permission("passerby", "write"), ...listings("Organization")]);
  const found = items(await s.call("search", { terms: "crash" }));
  assert.deepEqual(
    found.map((i) => [i.number, i.title, i.withheld]),
    [
      [41, "title by dra", undefined],
      [42, null, "the author has no access, not write; the title is not shown"],
      [45, "title by github-actions[bot]", undefined],
      [46, "title by passerby", undefined],
    ],
  );
  // passerby's closing pull request counts here: the lookup finds write.
  const prs = items(await s.call("open_prs", {}));
  assert.deepEqual(
    prs.map((p) => [p.number, p.title, p.closes_this_issue]),
    [
      [50, "fix #8", true],
      [51, null, false],
      [52, "also #8", true],
    ],
  );
  assert.deepEqual(lookups(s), [
    "api --method GET repos/acme/widgets/collaborators/dra/permission",
    "api --method GET repos/acme/widgets/collaborators/stranger/permission",
    "api --method GET repos/acme/widgets/collaborators/passerby/permission",
    "api --method GET repos/acme/widgets/collaborators/maintainer/permission",
  ]);
});

// A closing keyword counts only from an author with write access or an
// App: anyone can write one in a body, and a closing pull request holds off
// the stale-claim comment.
test("open_prs counts a closing pull request only from an author with write access", async (t) => {
  const closing = (number, author, extra = {}) => ({
    number,
    title: `pr ${number}`,
    body: "Closes #8",
    base: { ref: "main" },
    user: author,
    ...extra,
  });
  const s = await triage(t, [
    {
      match: "^api --method GET repos/acme/widgets$",
      stdout: { default_branch: "main", owner: { login: "acme", type: "User" } },
    },
    {
      match: "pulls\\?state=open&per_page=100&page=1$",
      stdout: [
        closing(60, user("maintainer")),
        closing(61, user("reader")),
        closing(62, user("stranger")),
        closing(63, user("flaky")),
        closing(64, user("github-actions[bot]", "Bot")),
        closing(65, null),
        closing(66, user("passerby"), { author_association: "NONE" }),
        closing(67, user("dra"), { base: { ref: "develop" } }),
      ],
    },
  ]);
  const prs = items(await s.call("open_prs", {}));
  assert.deepEqual(
    prs.map((p) => [p.number, p.closes_this_issue, p.withheld]),
    [
      [60, true, undefined],
      [61, false, "the author has read access, not write; the title is not shown"],
      [62, false, "the author has no access, not write; the title is not shown"],
      [63, false, "the author's access could not be checked; the title is not shown"],
      [64, true, undefined],
      [65, false, "the author is unknown; the title is not shown"],
      [66, false, "the author is not a collaborator (none), not write; the title is not shown"],
      [67, false, undefined],
    ],
  );
  // One lookup per author, shared with the title's screening; the
  // association rules passerby out without one, and an App needs none.
  assert.deepEqual(lookups(s), [
    "api --method GET repos/acme/widgets/collaborators/maintainer/permission",
    "api --method GET repos/acme/widgets/collaborators/reader/permission",
    "api --method GET repos/acme/widgets/collaborators/stranger/permission",
    "api --method GET repos/acme/widgets/collaborators/flaky/permission",
    "api --method GET repos/acme/widgets/collaborators/dra/permission",
  ]);
});

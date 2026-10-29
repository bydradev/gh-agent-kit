// Nothing the model posts notifies anyone: the server puts a zero-width
// space after each @ (or character reference for one) in the report, the
// inline comments, the filed issues and the triage comment. Only a
// suggestion block in an inline comment stays as written, where the
// server is sure GitHub renders it as one; text that only looks like
// code, other code blocks, addresses and URLs do not. The workflow drops
// the spaces before comparing the report's reviewed lines with the pull
// request.
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { ghCalls, gitRepo, root, startServer, stubGh, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const Z = String.fromCharCode(0x200b);
const CR = String.fromCharCode(13);
// Every @, and every character reference for one.
const allQuiet = (s) => s.replace(/(@|&#0*64;|&#[xX]0*40;|&commat;)/g, `$1${Z}`);
const TEXT = [
  "Thanks @dra, and cc @acme/security-team (see @codex's note).",
  "Write to you@example.com; `@dra` and ``x @y`` are code.",
  "```",
  "@decorator",
  "```",
  "```suggestion",
  "@Override",
  "```",
  "@last",
].join("\n");
const QUIET = [
  `Thanks @${Z}dra, and cc @${Z}acme/security-team (see @${Z}codex's note).`,
  `Write to you@${Z}example.com; \`@${Z}dra\` and \`\`x @${Z}y\`\` are code.`,
  "```",
  `@${Z}decorator`,
  "```",
  "```suggestion",
  `@${Z}Override`,
  "```",
  `@${Z}last`,
].join("\n");
// An inline comment's suggestion is committed as written.
const QUIET_INLINE = QUIET.replace(`@${Z}Override`, "@Override");

function review(t) {
  const repo = gitRepo(t);
  const base = repo.commit("a.txt", "a\n", "base");
  repo.git("checkout", "-q", "-b", "feature");
  const head = repo.commit("b.txt", "b\n", "feature");
  repo.git("update-ref", "refs/remotes/origin/main", base);
  const env = { PR: "7", HEAD_SHA: head, BASE: "main", GITHUB_WORKSPACE: repo.dir };
  const pull = {
    number: 7,
    title: "feat: thank @dra",
    body: "",
    state: "open",
    draft: false,
    base: { ref: "main", sha: base },
    head: { sha: head },
  };
  const rules = [
    { match: "^api --method GET repos/acme/widgets/pulls/7$", stdout: pull },
    {
      match: "issues\\?state=all&creator=github-actions%5Bbot%5D&per_page=100&page=1$",
      stdout: [],
    },
    { match: "^api -X POST ", stdout: "https://github.com/acme/widgets/x" },
  ];
  return { base, head, env, rules, pull };
}
const sent = (server) =>
  ghCalls(server)
    .filter((c) => c.args.includes("POST"))
    .map((c) => c.stdin);
const reviewedLines = (f, title = "feat: thank @dra") => [
  "Closes reviewed: none",
  `Base reviewed: main at ${f.base}`,
  `Title reviewed: ${title}`,
  `Head reviewed: ${f.head}`,
];
const report = (f, title) =>
  ["## Review R1: No blocking findings", "", "Body.", "", ...reviewedLines(f, title)].join("\n");

test("post_report and inline_comment quiet mentions, the reviewed title's too", async (t) => {
  const f = review(t);
  const server = await startServer(t, { mode: "review", env: f.env, rules: f.rules });
  const body = ["## Review R1: No blocking findings", "", TEXT, "", ...reviewedLines(f)].join("\n");
  const r = await server.call("post_report", { body });
  assert.equal(r.isError, false, r.text);
  const inline = await server.call("inline_comment", { path: "b.txt", line: 1, body: TEXT });
  assert.equal(inline.isError, false, inline.text);
  const [posted, comment] = sent(server);
  assert.equal(
    posted,
    [
      "## Review R1: No blocking findings",
      "",
      QUIET,
      "",
      ...reviewedLines(f, `feat: thank @${Z}dra`),
    ].join("\n") + "\n\n<!-- pr-review run 1001.1 -->\n",
  );
  assert.equal(JSON.parse(comment).body, QUIET_INLINE);
});

test("the report check compares the reviewed lines without the zero-width spaces", (t) => {
  const f = review(t);
  // The installed server writes the run marker.
  const script = stepScript("pr-review.yml", "Fail when no review report was posted").replaceAll(
    "/opt/agent-kit/mcp-server.mjs",
    path.join(root, ".github/scripts/mcp-server.mjs"),
  );
  const check = (pull, title) => {
    const body = [report(f, title), "", "<!-- pr-review run 1001.1 -->"].join("\n");
    const dir = tempDir(t);
    const stub = stubGh(dir, [
      {
        match: "^api --paginate repos/acme/widgets/issues/7/comments --jq",
        json: [{ id: 1, user: { login: "github-actions[bot]" }, body }],
      },
      { match: "^api --method GET repos/acme/widgets/pulls/7$", stdout: pull },
    ]);
    return runStep(dir, script, {
      PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
      GH_STUB_RULES: stub.rulesFile,
      GH_STUB_LOG: stub.log,
      REPO: "acme/widgets",
      PR: "7",
      GITHUB_RUN_ID: "1001",
      GITHUB_RUN_ATTEMPT: "1",
      LAST_COMMENT_ID: "0",
      STARTED: "2026-01-01T00:00:00Z",
    });
  };
  const ok = check(f.pull, `feat: thank @${Z}dra`);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  // A title can hold a zero-width space already (copied from a filed
  // issue's), and the server adds its own after the @.
  const copied = check({ ...f.pull, title: `feat: thank @${Z}dra` }, `feat: thank @${Z}${Z}dra`);
  assert.equal(copied.status, 0, copied.stdout + copied.stderr);
  const other = check({ ...f.pull, title: "feat: thank @someone" }, `feat: thank @${Z}dra`);
  assert.equal(other.status, 1, other.stdout + other.stderr);
  assert.match(other.stdout, /title \[feat: thank @dra\] vs \[feat: thank @someone\]/);
});

test("post_report refuses a Title reviewed line that is not the pull request's title", async (t) => {
  const f = review(t);
  const server = await startServer(t, { mode: "review", env: f.env, rules: f.rules });
  const r = await server.call("post_report", { body: report(f, "@octocat and @acme/everyone") });
  assert.equal(r.isError, true);
  assert.match(r.text, /the Title reviewed line must read "Title reviewed: feat: thank @dra"/);
  assert.deepEqual(sent(server), []);
});

test("post_report takes the title with its zero-width spaces or line separators", async (t) => {
  for (const [title, reviewed] of [
    [`feat: thank @${Z}dra`, "feat: thank @dra"],
    [`feat: a${String.fromCharCode(0x2028)}b @dra`, `feat: a${String.fromCharCode(0x2028)}b @dra`],
  ]) {
    const f = review(t);
    f.pull.title = title;
    const server = await startServer(t, { mode: "review", env: f.env, rules: f.rules });
    const r = await server.call("post_report", { body: report(f, reviewed) });
    assert.equal(r.isError, false, `${JSON.stringify(title)}: ${r.text}`);
    assert.ok(sent(server)[0].includes(`Title reviewed: ${allQuiet(reviewed)}\n`), title);
  }
});

test("file_issue quiets mentions, those the comment stripping joins too", async (t) => {
  const f = review(t);
  const server = await startServer(t, { mode: "review", env: f.env, rules: f.rules });
  const r = await server.call("file_issue", {
    finding: "R1-01",
    title: "Ask @<!---->dra about the cache",
    outcome: `${TEXT}\nPing &#6<!---->4;octocat and &com<!---->mat;octocat and @-->octocat`,
    acceptance: "- [ ] @--!>dra agrees",
  });
  assert.equal(r.isError, false, r.text);
  const issue = JSON.parse(sent(server)[0]);
  assert.equal(issue.title, `Ask @${Z}dra about the cache`);
  const ping = `Ping &#64;${Z}octocat and &commat;${Z}octocat and @${Z}octocat`;
  assert.ok(issue.body.includes(`${QUIET}\n${ping}`), issue.body);
  assert.ok(issue.body.includes(`- [ ] @${Z}dra agrees`), issue.body);
});

test("a fence one section of a filed issue leaves open keeps no later mention live", async (t) => {
  const f = review(t);
  const server = await startServer(t, { mode: "review", env: f.env, rules: f.rules });
  const r = await server.call("file_issue", {
    finding: "R1-01",
    title: "Split fence",
    outcome: "```\n@x",
    acceptance: "```suggestion\n@octocat\n```",
  });
  assert.equal(r.isError, false, r.text);
  const { body } = JSON.parse(sent(server)[0]);
  assert.ok(body.includes(`\`\`\`\n@${Z}x\n`), body);
  assert.ok(body.includes(`\`\`\`suggestion\n@${Z}octocat\n\`\`\``), body);
});

function triage(t) {
  return startServer(t, {
    mode: "triage",
    env: { TRIAGE_ISSUE: "8", TRIAGE_EVENT: "issues" },
    rules: [
      {
        match: "^api --method GET repos/acme/widgets/issues/8$",
        stdout: { number: 8, state: "open", labels: [], user: { login: "dra", type: "User" } },
      },
      { match: "^api -X POST ", stdout: "u" },
    ],
  });
}
async function posted(t, lines) {
  const server = await triage(t);
  const r = await server.call("comment", { body: `## Triage\n\n${lines.join("\n")}\n` });
  assert.equal(r.isError, false, r.text);
  const [body] = sent(server);
  return body.replace(/^## Triage\n\n/, "").replace(/\n\n<!-- issue-triage run 1001\.1 -->\n$/, "");
}
// Each body as one inline comment, as posted.
async function inline(t, bodies) {
  const f = review(t);
  const server = await startServer(t, { mode: "review", env: f.env, rules: f.rules });
  for (const body of bodies) {
    const r = await server.call("inline_comment", { path: "b.txt", line: 1, body });
    assert.equal(r.isError, false, r.text);
  }
  return sent(server).map((s) => JSON.parse(s).body);
}

test("the triage comment quiets mentions, in its code blocks too", async (t) => {
  assert.equal(await posted(t, [TEXT]), QUIET);
});

test("text that only looks like code, an address and a URL have their mentions quieted", async (t) => {
  for (const [what, lines] of [
    ["escaped backticks", ["see \\` @octocat \\`"]],
    ["a code span across a line break", ["x ` y", "@octocat ` z"]],
    ["a stray backtick", ["a stray `@octocat"]],
    ["an escaped @", ["\\@octocat"]],
    ["emphasis around or before it", ["_@octocat_ and __@octocat__ and _x_@octocat"]],
    ["one @ after another", ["@@octocat and &#64;@octocat"]],
    ["character references", ["&#64;octocat &#x40;octocat &#0064;octocat &commat;octocat"]],
    ["a character reference in the login", ["@&#111;ctocat"]],
    ["after a reference or a sha", ["#12@octocat and abc1234@octocat"]],
    ["inline HTML", ["<details><summary>cc @octocat</summary>"]],
    ["a URL after an open bracket", ["[see https://example.com/@octocat"]],
    [
      "links",
      [
        "See https://www.npmjs.com/package/@types/node and [the post](https://medium.com/@octocat/post).",
        "(https://example.com/@x) and <https://example.com/@y>",
      ],
    ],
  ]) {
    const quiet = lines.map(allQuiet);
    assert.notDeepEqual(quiet, lines, what);
    assert.equal(await posted(t, lines), quiet.join("\n"), what);
  }
});

test("an inline comment's code that is no sure suggestion block has its mentions quieted", async (t) => {
  const cases = [
    ["another code block", ["```js", "@decorator", "```"]],
    ["a backtick fence whose info string has a backtick", ["```suggestion `x`", "@octocat", "```"]],
    ["a fence inside an HTML block", ["<div>", "```suggestion", "@octocat", "```", "</div>"]],
    ["a fence after a lone tag", ["<span>", "```suggestion", "@octocat", "```"]],
    ["a lone tag with > in a value", ['<a title="x>y">', "```suggestion", "@octocat", "```"]],
    ["a block tag with text", ["<source src=x> media", "```suggestion", "@octocat", "```"]],
    ["an unclosed fence inside an HTML block", ["<div>", "```", "</div>", "", "@octocat"]],
    ["an unclosed fence", ["```suggestion", "@octocat"]],
    ["a fence in a quote", ["> ```suggestion", "> @octocat", "> ```"]],
    ["a fence in a list item", ["- item", "  ```suggestion", "  @octocat", "  ```", "- @bob"]],
    // GitHub's parser closes the indented fence on the third line, so a
    // reading from the second would keep the fourth.
    ["after an indented fence", ["  ~~~", "```suggestion", "~~~", "@octocat", "```"]],
    ["after a fence in a list", ["- a", "  ~~~", "```suggestion", "~~~", "@octocat", "```"]],
    [
      "a lone carriage return",
      [["```suggestion", "foo", "```", "@octocat"].join(CR), "```"],
      ["```suggestion", "foo", "```", `@${Z}octocat`, "```"],
    ],
    [
      "a form feed in a tag",
      [`<x${String.fromCharCode(12)}a=1>`, "```suggestion", "@octocat", "```"],
    ],
    [
      "a vertical tab in a tag",
      [`</x${String.fromCharCode(11)}>`, "```suggestion", "@octocat", "```"],
    ],
    [
      "a byte order mark",
      [`${String.fromCharCode(0xfeff)}~~~`, "```suggestion", "~~~", "@octocat", "```"],
    ],
    [
      "a line separator in an info string",
      [`~~~ a${String.fromCharCode(0x2028)}b`, "```suggestion", "~~~", "@octocat", "```"],
    ],
  ];
  const got = await inline(
    t,
    cases.map(([, lines]) => lines.join("\n")),
  );
  cases.forEach(([what, lines, want], i) => {
    const quiet = want ?? lines.map(allQuiet);
    assert.notDeepEqual(quiet, lines, what);
    assert.equal(got[i], quiet.join("\n"), what);
  });
});

test("an inline comment's suggestion block GitHub renders as one stays as written", async (t) => {
  // Each case with the first and last line of the block kept.
  const cases = [
    ["a suggestion", ["Suggested:", "```suggestion", "@Override", "```"], 1, 3],
    ["after inline HTML", ["<b>Suggested change</b>", "```suggestion", "@Override", "```"], 1, 3],
    ["a shorter fence inside", ["````suggestion", "```", "@inner", "```", "````"], 0, 4],
    ["a tilde fence", ["~~~ suggestion", "@inner", "~~~"], 0, 2],
    [
      "after an HTML comment closed on its line",
      ["<!-- @a -->", "```suggestion", "@b", "```"],
      1,
      3,
    ],
    ["after an HTML block and a blank line", ["<div>", "", "```suggestion", "@inner", "```"], 2, 4],
    ["after another code block", ["```js", "@x", "```", "```suggestion", "@inner", "```"], 3, 5],
    [
      "a closing fence indented, then text",
      ["```suggestion", "@inner", "   ```  ", "@after"],
      0,
      2,
    ],
    ["a carriage return and line feed", ["```suggestion\r", "@inner\r", "```\r", "@after"], 0, 2],
  ];
  const got = await inline(
    t,
    cases.map(([, lines]) => lines.join("\n")),
  );
  cases.forEach(([what, lines, from, to], i) => {
    const want = lines.map((l, j) => {
      const line = l.replace(/\r$/, "");
      return j >= from && j <= to ? line : allQuiet(line);
    });
    assert.equal(got[i], want.join("\n"), what);
  });
});

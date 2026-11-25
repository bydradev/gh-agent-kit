// An issue github-actions[bot] opened (the reviewer's file_issue) is shown
// by triage's read_issue and search and the review's issue tool only once
// the operator vouched for its text by adding needs-triage after it last
// changed (#100). Other GitHub Apps' issues keep the rule for an App.
import assert from "node:assert/strict";
import { test } from "node:test";
import { startServer } from "./helpers/server.mjs";

const T1 = "2026-11-20T10:00:00Z";
const T2 = "2026-11-21T10:00:00Z";
const T3 = "2026-11-22T10:00:00Z";
const person = (login) => ({ login, type: "User" });
const BOT = { login: "github-actions[bot]", type: "Bot" };
const mark = (event, actor, at) => ({
  event,
  label: { name: "needs-triage" },
  actor,
  created_at: at,
});
const issue = (number, user) => ({
  number,
  title: `title of ${number}`,
  body: `body of ${number}`,
  state: "open",
  labels: [{ name: "needs-operator" }],
  repository_url: "https://api.github.com/repos/acme/widgets",
  html_url: `https://github.com/acme/widgets/issues/${number}`,
  user,
  author_association: "NONE",
});

// #30 is github-actions[bot]'s, with the given timeline and last edit;
// #31 is another App's.
function rules({ events = [], edited = null, timelineFails = false } = {}) {
  return [
    { match: "^api --method GET repos/acme/widgets/issues/30$", stdout: issue(30, BOT) },
    {
      match: "^api --method GET repos/acme/widgets/issues/31$",
      stdout: issue(31, { login: "renovate[bot]", type: "Bot" }),
    },
    {
      match: "^api graphql .* -F n=30$",
      stdout: { data: { repository: { issue: { lastEditedAt: edited } } } },
    },
    timelineFails
      ? {
          match: "^api --paginate --slurp repos/acme/widgets/issues/30/timeline",
          stderr: "gh: Server Error (HTTP 502)\n",
          status: 1,
        }
      : {
          match: "^api --paginate --slurp repos/acme/widgets/issues/30/timeline",
          stdout: [events],
        },
    {
      match: "^api --method GET repos/acme/widgets/collaborators/dra/permission$",
      stdout: { permission: "admin" },
    },
    {
      match: "^api --method GET repos/acme/widgets/collaborators/reader/permission$",
      stdout: { permission: "read" },
    },
    {
      match: "^api --method GET search/issues\\?per_page=100&page=1 -f q=",
      stdout: {
        incomplete_results: false,
        total_count: 2,
        items: [issue(30, BOT), issue(31, { login: "renovate[bot]", type: "Bot" })],
      },
    },
  ];
}

// What each of the three tools shows of #30 and #31: the title, or null.
async function shown(t, setup) {
  const triage = await startServer(t, {
    mode: "triage",
    env: { TRIAGE_ISSUE: "8", TRIAGE_EVENT: "opened" },
    rules: rules(setup),
  });
  const review = await startServer(t, {
    mode: "review",
    env: { PR: "7", HEAD_SHA: "a".repeat(40), BASE: "main" },
    rules: rules(setup),
  });
  const read = async (s, tool, number) => {
    const r = await s.call(tool, { number });
    assert.equal(r.isError, false, r.text);
    return JSON.parse(r.text);
  };
  const found = JSON.parse((await triage.call("search", { terms: "title" })).text).items;
  const out = {};
  for (const number of [30, 31]) {
    const items = [
      await read(triage, "read_issue", number),
      found.find((i) => i.number === number),
      await read(review, "issue", number),
    ];
    for (const i of items) {
      if (i.title === null) {
        assert.equal(i.body ?? null, null);
        assert.ok(i.withheld, JSON.stringify(i));
      }
      assert.doesNotMatch(JSON.stringify(i.withheld === undefined ? {} : i), /title of|body of/);
    }
    out[number] = items.map((i) => i.title);
    out[`${number}withheld`] = items.map((i) => i.withheld);
  }
  return out;
}

const CASES = [
  ["never vouched for", {}, false],
  [
    "vouched for by the operator",
    { events: [mark("labeled", person("dra"), T2)], edited: T1 },
    true,
  ],
  [
    "vouched for, then answered by triage, which removes needs-triage",
    { events: [mark("labeled", person("dra"), T2), mark("unlabeled", BOT, T3)], edited: T1 },
    true,
  ],
  ["edited after the vouch", { events: [mark("labeled", person("dra"), T1)], edited: T2 }, false],
  [
    "edited in the vouch's second",
    { events: [mark("labeled", person("dra"), T1)], edited: T1 },
    false,
  ],
  [
    "retitled after the vouch",
    {
      events: [
        mark("labeled", person("dra"), T1),
        { event: "renamed", actor: person("dra"), created_at: T2 },
      ],
    },
    false,
  ],
  [
    "reopened after the vouch",
    {
      events: [
        mark("labeled", person("dra"), T1),
        { event: "reopened", actor: person("dra"), created_at: T2 },
      ],
    },
    false,
  ],
  [
    "labelled by someone without write access",
    { events: [mark("labeled", person("reader"), T2)] },
    false,
  ],
  ["labelled by a bot", { events: [mark("labeled", BOT, T2)] }, false],
  [
    "vouched for, then withdrawn by a person",
    { events: [mark("labeled", person("dra"), T2), mark("unlabeled", person("dra"), T3)] },
    false,
  ],
  [
    "withdrawn, then vouched for again",
    {
      events: [
        mark("labeled", person("dra"), T1),
        mark("unlabeled", person("dra"), T2),
        mark("labeled", person("dra"), T3),
      ],
    },
    true,
  ],
  ["whose timeline cannot be read", { timelineFails: true }, false],
];

for (const [name, setup, vouched] of CASES) {
  test(`a github-actions[bot] issue ${name} is ${vouched ? "shown" : "withheld"} by read_issue, search and issue`, async (t) => {
    const got = await shown(t, setup);
    assert.deepEqual(
      got[30],
      vouched ? ["title of 30", "title of 30", "title of 30"] : [null, null, null],
    );
    if (!vouched) {
      for (const w of got["30withheld"])
        assert.match(
          w,
          setup.timelineFails
            ? /^github-actions\[bot\] opened it and whether the operator vouched for its text could not be checked; the title/
            : /^github-actions\[bot\] opened it and nobody with write access has vouched for its current text by adding needs-triage .*; the title/,
        );
    }
    // Another App's issue keeps the rule for an App, whatever #30's state.
    assert.deepEqual(got[31], ["title of 31", "title of 31", "title of 31"]);
  });
}

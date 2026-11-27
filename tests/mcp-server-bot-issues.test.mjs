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
const OTHER_APP = { login: "renovate[bot]", type: "Bot" };
const mark = (event, actor, at, name = "needs-triage") => ({
  event,
  label: { name },
  actor,
  created_at: at,
});
const issue = (number, user, title = `title of ${number}`, body = `body of ${number}`) => ({
  number,
  title,
  body,
  state: "open",
  labels: [{ name: "needs-operator" }],
  repository_url: "https://api.github.com/repos/acme/widgets",
  html_url: `https://github.com/acme/widgets/issues/${number}`,
  user,
  author_association: "NONE",
});

// #30 is github-actions[bot]'s, with the given timeline and last edit;
// #31 is another App's. GraphQL answers #30's text with the titles in
// snapshots in turn (the vouch check reads the text before and after the
// timeline), while REST and search hold a stale copy, so a tool that shows
// theirs fails the assertions.
function rules({
  events = [],
  edited = null,
  timelineFails = false,
  snapshots = ["title of 30"],
  labels = ["needs-triage"],
  labelSnapshots,
  bodySnapshots,
  editedSnapshots,
  comments = [],
}) {
  const reads = (labelSnapshots || bodySnapshots || editedSnapshots || snapshots).length;
  return [
    {
      match: "^api --method GET repos/acme/widgets/issues/30$",
      stdout: issue(30, BOT, "stale title", "stale body"),
    },
    { match: "^api --method GET repos/acme/widgets/issues/31$", stdout: issue(31, OTHER_APP) },
    {
      match: "^api graphql .* -F n=30$",
      sequence: Array.from({ length: reads }, (_, k) => ({
        data: {
          repository: {
            issue: {
              title: snapshots.length === reads ? snapshots[k] : snapshots[0],
              body: bodySnapshots ? bodySnapshots[k] : "body of 30",
              lastEditedAt: editedSnapshots ? editedSnapshots[k] : edited,
              labels: {
                nodes: (labelSnapshots ? labelSnapshots[k] : labels).map((name) => ({ name })),
              },
            },
          },
        },
      })),
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
      match: "^api --paginate --slurp repos/acme/widgets/issues/30/comments",
      stdout: [comments],
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
        items: [issue(30, BOT, "stale title", "stale body"), issue(31, OTHER_APP)],
      },
    },
  ];
}

// What triage's read_issue and search and the review's issue tool show of
// #30 and #31: titles (all three), bodies (the two direct reads) and
// withheld reasons.
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
      assert.doesNotMatch(JSON.stringify(i), /stale/);
      if (i.title === null) {
        assert.equal(i.body ?? null, null);
        assert.ok(i.withheld, JSON.stringify(i));
      }
    }
    out[number] = {
      titles: items.map((i) => i.title),
      bodies: [items[0].body, items[2].body],
      withheld: items.map((i) => i.withheld),
    };
  }
  return out;
}

const ANSWERED = [mark("labeled", person("dra"), T2), mark("unlabeled", BOT, T3)];
const answer = (body, at) => ({ user: BOT, body, created_at: at });

const SHOWN = { titles: Array(3).fill("title of 30"), bodies: ["body of 30", "body of 30"] };
const WITHHELD = { titles: [null, null, null], bodies: [null, null] };
const NOT_VOUCHED =
  /^github-actions\[bot\] opened it and nobody with write access has vouched for its current text by adding needs-triage .*; the title/;

const CASES = [
  ["never vouched for", {}, NOT_VOUCHED],
  ["vouched for by the operator", { events: [mark("labeled", person("dra"), T2)], edited: T1 }],
  [
    "vouched for, then planned by triage, which removes needs-triage",
    {
      events: ANSWERED,
      edited: T1,
      labels: ["triaged"],
      comments: [answer("## Triage\n\n**Summary:** fix it.", T3)],
    },
  ],
  [
    "vouched for, then asked about by triage",
    {
      events: ANSWERED,
      edited: T1,
      labels: ["needs-operator"],
      comments: [answer("## Triage: questions\n\n1. Which?", T3)],
    },
    NOT_VOUCHED,
  ],
  [
    "planned, then asked about by a later triage",
    {
      events: ANSWERED,
      edited: T1,
      labels: ["triaged"],
      comments: [answer("## Triage\n\nplan", T3), answer("## Triage: questions\n\nWhich?", T3)],
    },
    NOT_VOUCHED,
  ],
  [
    "whose needs-triage the bot removed without an answer",
    { events: ANSWERED, edited: T1, labels: ["triaged"] },
    NOT_VOUCHED,
  ],
  [
    "planned by a look-alike comment from someone else",
    {
      events: ANSWERED,
      edited: T1,
      labels: ["triaged"],
      comments: [{ ...answer("## Triage\n\nplan", T3), user: person("dra") }],
    },
    NOT_VOUCHED,
  ],
  [
    "edited after the vouch",
    { events: [mark("labeled", person("dra"), T1)], edited: T2 },
    NOT_VOUCHED,
  ],
  [
    "edited in the vouch's second",
    { events: [mark("labeled", person("dra"), T1)], edited: T1 },
    NOT_VOUCHED,
  ],
  [
    "retitled after the vouch",
    {
      events: [
        mark("labeled", person("dra"), T1),
        { event: "renamed", actor: person("dra"), created_at: T2 },
      ],
    },
    NOT_VOUCHED,
  ],
  [
    "reopened after the vouch",
    {
      events: [
        mark("labeled", person("dra"), T1),
        { event: "reopened", actor: person("dra"), created_at: T2 },
      ],
    },
    NOT_VOUCHED,
  ],
  [
    "labelled by someone without write access",
    { events: [mark("labeled", person("reader"), T2)] },
    NOT_VOUCHED,
  ],
  ["labelled by a bot", { events: [mark("labeled", BOT, T2)] }, NOT_VOUCHED],
  [
    "vouched for, then withdrawn by a person",
    { events: [mark("labeled", person("dra"), T2), mark("unlabeled", person("dra"), T3)] },
    NOT_VOUCHED,
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
  ],
  [
    "labelled with another label by the operator",
    { events: [mark("labeled", person("dra"), T2, "bug")], edited: T1 },
    NOT_VOUCHED,
  ],
  [
    "vouched for, then given needs-triage again by the bot",
    { events: [mark("labeled", person("dra"), T2), mark("labeled", BOT, T3)], edited: T1 },
  ],
  [
    "vouched for, then unlabelled by an account GitHub no longer names",
    { events: [mark("labeled", person("dra"), T2), mark("unlabeled", null, T3)], edited: T1 },
    NOT_VOUCHED,
  ],
  [
    "vouched for, with a label event that carries no label",
    {
      events: [
        mark("labeled", person("dra"), T2),
        { event: "labeled", label: null, actor: person("dra"), created_at: T3 },
      ],
      edited: T1,
    },
  ],
  [
    "planned by triage among comments by no one, without a body, or not triage's",
    {
      events: ANSWERED,
      edited: T1,
      labels: ["triaged"],
      comments: [
        answer("## Triage\n\n**Summary:** fix it.", T3),
        { user: null, body: "## Triage: questions\n\nWhich?", created_at: T3 },
        { user: BOT, created_at: T3 },
        { user: BOT, body: ["## Triage: questions"], created_at: T3 },
        answer("Thanks for the report.", T3),
      ],
    },
  ],
  [
    "whose timeline cannot be read",
    { timelineFails: true },
    /^github-actions\[bot\] opened it and whether the operator vouched for its text could not be checked; the title/,
  ],
  [
    // A read can catch a revision nobody vouched for just before the
    // operator corrects the text and vouches for the new one: the text
    // shown is the one the vouch read covers, so a change between the two
    // reads around the timeline withholds it.
    "whose text changes while the vouch is read",
    {
      events: [mark("labeled", person("dra"), T2)],
      edited: T1,
      snapshots: Array(6).fill(["title of 30, unvouched", "title of 30"]).flat(),
    },
    /^github-actions\[bot\] opened it and its text or labels changed while it was being read; the title/,
  ],
  [
    "whose triaged label is removed while the vouch is read",
    {
      events: ANSWERED,
      edited: T1,
      comments: [answer("## Triage\n\nplan", T3)],
      labelSnapshots: Array(6)
        .fill([["triaged"], []])
        .flat(),
    },
    /^github-actions\[bot\] opened it and its text or labels changed while it was being read; the title/,
  ],
  // Cases a rule-by-rule sweep found no test for (#94).
  [
    "whose body changes while the vouch is read",
    {
      events: [mark("labeled", person("dra"), T2)],
      edited: T1,
      bodySnapshots: Array(6).fill(["body of 30, unvouched", "body of 30"]).flat(),
    },
    /^github-actions\[bot\] opened it and its text or labels changed while it was being read; the title/,
  ],
  [
    "whose last edit moves while the vouch is read",
    {
      events: [mark("labeled", person("dra"), T2)],
      editedSnapshots: Array(6).fill([T1, T1.replace("10:00", "10:01")]).flat(),
    },
    /^github-actions\[bot\] opened it and its text or labels changed while it was being read; the title/,
  ],
  ["labelled by an actor GitHub no longer names", { events: [mark("labeled", null, T2)] }, NOT_VOUCHED],
  [
    "planned by triage, then its needs-triage removed by a person",
    {
      events: [mark("labeled", person("dra"), T1), mark("unlabeled", person("dra"), T2)],
      labels: ["triaged"],
      comments: [answer("## Triage\n\nplan", T3)],
    },
    NOT_VOUCHED,
  ],
  [
    "planned by triage but no longer triaged",
    {
      events: ANSWERED,
      edited: T1,
      labels: ["needs-operator"],
      comments: [answer("## Triage\n\nplan", T3)],
    },
    NOT_VOUCHED,
  ],
];

for (const [name, setup, reason] of CASES) {
  test(`a github-actions[bot] issue ${name} is ${reason ? "withheld" : "shown"} by read_issue, search and issue`, async (t) => {
    const got = await shown(t, setup);
    assert.deepEqual({ titles: got[30].titles, bodies: got[30].bodies }, reason ? WITHHELD : SHOWN);
    for (const w of got[30].withheld)
      if (reason) assert.match(w, reason);
      else assert.equal(w, undefined);
    // Another App's issue keeps the rule for an App, whatever #30's state.
    assert.deepEqual(got[31].titles, Array(3).fill("title of 31"));
    assert.deepEqual(got[31].bodies, ["body of 31", "body of 31"]);
  });
}

// On a triage run for the issue itself, with the gate's hash, a failed
// lookup gives its own reason, not a claim that the text changed.
test("read_issue of the run's own issue gives the lookup's reason when it fails", async (t) => {
  const s = await startServer(t, {
    mode: "triage",
    env: { TRIAGE_ISSUE: "30", TRIAGE_EVENT: "labeled", VOUCHED_TEXT_SHA256: "0".repeat(64) },
    rules: rules({ timelineFails: true }),
  });
  const r = await s.call("read_issue", { number: 30 });
  assert.equal(r.isError, false, r.text);
  const got = JSON.parse(r.text);
  assert.equal(got.title, null);
  assert.match(got.withheld, /whether the operator vouched for its text could not be checked/);
});

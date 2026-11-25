// issue-triage's access gate, "Refuse an issue whose author, or an issue
// event whose actor, lacks write access", read from the workflow and run
// against the stub gh: an issue event for an author or actor without write
// access ends green as a skip, with a notice, while a dispatch by hand of
// such an issue still fails. The steps after the gate are checked to honour
// its skip, so a skipped event costs no checkout, install or model call.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { root, stubGh, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const GATE = "Refuse an issue whose author, or an issue event whose actor, lacks write access";
const script = stepScript("issue-triage.yml", GATE);

const permission = (login, value) => ({
  match: `^api --method GET repos/acme/widgets/collaborators/${login}/permission --jq`,
  json: { permission: value },
});
const ACCESS = [
  permission("dra", "admin"),
  permission("maintainer", "write"),
  permission("reader", "read"),
  permission("triager", "triage"),
  permission("outsider", "none"),
  {
    match: "^api --method GET repos/acme/widgets/collaborators/ghost/permission",
    stderr: "gh: Not Found (HTTP 404)\n",
    status: 1,
  },
  {
    match: "^api --method GET repos/acme/widgets/collaborators/dependabot\\[bot\\]/permission",
    stderr: "gh: Not Found (HTTP 404)\n",
    status: 1,
  },
  {
    match: "^api --method GET repos/acme/widgets/collaborators/flaky/permission",
    stderr: "gh: Server Error (HTTP 502)\n",
    status: 1,
  },
];

// Runs the gate on issue 8, written by `author` (of `type`, User unless
// given) and carrying `labels`, for an event of `event` (issues or
// workflow_dispatch) by `actor`, with the issue event's `action` and
// `label`; a dispatch of a github-actions[bot] issue also reads `timeline`
// (its labeled, renamed and reopened events) and `edited` (lastEditedAt).
// Returns its result, the outputs it wrote and the permission lookups it
// made.
function gate(
  t,
  { author, type = "User", labels = [], event, actor = "dra", action, label, timeline, edited },
) {
  const dir = tempDir(t);
  const stub = stubGh(dir, [
    ...ACCESS,
    {
      match: "^api --method GET repos/acme/widgets/issues/8 --jq ",
      json: { user: { login: author, type }, labels: labels.map((name) => ({ name })) },
    },
    ...(timeline
      ? [
          {
            match: "^api --paginate repos/acme/widgets/issues/8/timeline --jq ",
            json: timeline,
          },
          {
            match: "^api graphql -f owner=acme -f name=widgets -F number=8 ",
            json: {
              data: {
                repository: {
                  issue: { title: "a finding", body: "Fix it.\r\n", lastEditedAt: edited ?? null },
                },
              },
            },
          },
        ]
      : []),
  ]);
  const output = path.join(dir, "github-output");
  fs.writeFileSync(output, "");
  const githubEnv = path.join(dir, "github-env");
  fs.writeFileSync(githubEnv, "");
  const r = runStep(dir, script, {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    GITHUB_OUTPUT: output,
    GITHUB_ENV: githubEnv,
    RUNNER_TEMP: dir,
    REPO: "acme/widgets",
    TRIAGE_ISSUE: "8",
    EVENT: event,
    ACTOR: actor,
    ACTION: action ?? (event === "issues" ? "labeled" : ""),
    LABEL: label ?? (event === "issues" ? "needs-triage" : ""),
  });
  const lookups = fs
    .readFileSync(stub.log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l).args.join(" "))
    .filter((c) => c.includes("/collaborators/"))
    .map((c) => c.match(/collaborators\/([^/]+)\//)[1]);
  return {
    ...r,
    output: fs.readFileSync(output, "utf8"),
    env: fs.readFileSync(githubEnv, "utf8"),
    lookups,
  };
}

test("an author and actor with write access pass, with no skip", (t) => {
  for (const [author, actor] of [
    ["dra", "dra"],
    ["maintainer", "dra"],
    ["dra", "maintainer"],
  ]) {
    const r = gate(t, { author, event: "issues", actor });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(r.output, "");
    assert.doesNotMatch(r.stdout, /::(notice|error)::/);
    assert.deepEqual(r.lookups, [author, actor]);
    assert.equal(r.env, "");
  }
});

test("an issue event for an author without write access is skipped with a notice", (t) => {
  for (const [author, access] of [
    ["reader", "read"],
    ["triager", "triage"],
    ["outsider", "none"],
    ["ghost", "none"],
  ]) {
    const r = gate(t, { author, event: "issues" });
    assert.equal(r.status, 0, `${author}: ${r.stdout}${r.stderr}`);
    assert.ok(
      r.stdout.includes(
        `::notice::${author} has '${access}' access to acme/widgets, not write; not triaged\n`,
      ),
      r.stdout,
    );
    assert.doesNotMatch(r.stdout, /::error::/);
    assert.equal(r.output, "skip=true\n");
    // The actor is not looked up once the author is refused.
    assert.deepEqual(r.lookups, [author]);
  }
});

test("an issue event by an actor without write access is skipped with a notice", (t) => {
  const r = gate(t, { author: "dra", event: "issues", actor: "reader" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(
    r.stdout.includes(
      "::notice::reader has 'read' access to acme/widgets, not write; not triaged\n",
    ),
    r.stdout,
  );
  assert.equal(r.output, "skip=true\n");
  assert.deepEqual(r.lookups, ["dra", "reader"]);
});

test("a dispatch of an issue whose author lacks write access still fails", (t) => {
  for (const [author, access] of [
    ["reader", "read"],
    ["ghost", "none"],
  ]) {
    const r = gate(t, { author, event: "workflow_dispatch", actor: "reader" });
    assert.equal(r.status, 1, `${author}: ${r.stdout}${r.stderr}`);
    assert.ok(
      r.stdout.includes(
        `::error::${author} has '${access}' access to acme/widgets, not write; not triaged\n`,
      ),
      r.stdout,
    );
    assert.equal(r.output, "");
    // A dispatch's actor is not checked.
    assert.deepEqual(r.lookups, [author]);
  }
});

test("a dispatch checks only the author, so a reader's dispatch of a write author's issue passes", (t) => {
  const r = gate(t, { author: "maintainer", event: "workflow_dispatch", actor: "reader" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.output, "");
  assert.deepEqual(r.lookups, ["maintainer"]);
});

test("a lookup that fails for another reason fails the run, on any event", (t) => {
  for (const event of ["issues", "workflow_dispatch"]) {
    const r = gate(t, { author: "flaky", event });
    assert.equal(r.status, 1, `${event}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /HTTP 502/);
    assert.equal(r.output, "");
  }
});

// An issue github-actions[bot] opened (the reviewer's file_issue) has an
// author with no access: the operator vouches for its text by adding
// needs-triage, and whoever added it is checked in the author's place.
const BOT = { author: "github-actions[bot]", type: "Bot" };
// What a passed vouch hands the server: the hash of the title and body the
// gate read with the last edit, in one GraphQL read.
const VOUCHED = `VOUCHED_TEXT_SHA256=${crypto
  .createHash("sha256")
  .update("a finding\nFix it.\r\n")
  .digest("hex")}\n`;
const labeled = (name, at, by = "dra") => ({
  event: "labeled",
  created_at: at,
  label: { name },
  actor: { login: by },
});

test("needs-triage added to a github-actions[bot] issue checks the labeller, not the author", (t) => {
  const event = (actor) =>
    gate(t, {
      ...BOT,
      labels: ["needs-triage", "needs-operator"],
      event: "issues",
      actor,
      timeline: [labeled("needs-triage", "2026-11-03T00:00:00Z", actor)],
      edited: "2026-11-01T00:00:00Z",
    });
  const r = event("maintainer");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.output, "");
  assert.equal(r.env, VOUCHED);
  assert.deepEqual(r.lookups, ["maintainer"]);
  // A labeller without write access vouches for nothing.
  const reader = event("reader");
  assert.equal(reader.status, 0, reader.stdout + reader.stderr);
  assert.match(
    reader.stdout,
    /::notice::#8 was opened by github-actions\[bot\] and reader, who added needs-triage, has 'read' access/,
  );
  assert.equal(reader.output, "skip=true\n");
  assert.equal(reader.env, "");
});

test("a label run finds the issue edited after the label it came from, and is skipped", (t) => {
  // The edit's own run cancels this one once it starts; until then the
  // gate sees the edit and refuses.
  const r = gate(t, {
    ...BOT,
    labels: ["needs-triage"],
    event: "issues",
    timeline: [labeled("needs-triage", "2026-11-03T00:00:00Z")],
    edited: "2026-11-03T00:00:05Z",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /add needs-triage to it \(after any edit\) to vouch for its text/);
  assert.equal(r.output, "skip=true\n");
  assert.deepEqual(r.lookups, []);
});

test("a label run checks its own sender as well as the latest labeller", (t) => {
  // An older run, by a reader, finds a newer needs-triage by a writer.
  const r = gate(t, {
    ...BOT,
    labels: ["needs-triage"],
    event: "issues",
    actor: "reader",
    timeline: [
      labeled("needs-triage", "2026-11-03T00:00:00Z", "reader"),
      { event: "unlabeled", created_at: "2026-11-03T00:00:01Z", label: { name: "needs-triage" } },
      labeled("needs-triage", "2026-11-03T00:00:02Z", "maintainer"),
    ],
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /and reader, who added needs-triage, has 'read' access/);
  assert.equal(r.output, "skip=true\n");
  assert.deepEqual(r.lookups, ["reader"]);
  // The writer's own run passes.
  const w = gate(t, {
    ...BOT,
    labels: ["needs-triage"],
    event: "issues",
    actor: "maintainer",
    timeline: [labeled("needs-triage", "2026-11-03T00:00:02Z", "maintainer")],
  });
  assert.equal(w.output, "", w.stdout + w.stderr);
  assert.equal(w.env, VOUCHED);
  assert.deepEqual(w.lookups, ["maintainer"]);
});

test("any other event on a github-actions[bot] issue is skipped with a notice", (t) => {
  for (const [action, label] of [
    ["opened", ""],
    ["edited", ""],
    ["reopened", ""],
    ["labeled", "bug"],
  ]) {
    const r = gate(t, { ...BOT, event: "issues", action, label });
    assert.equal(r.status, 0, `${action} ${label}: ${r.stdout}${r.stderr}`);
    assert.match(
      r.stdout,
      /::notice::#8 was opened by github-actions\[bot\]; only needs-triage added by someone with write access starts its triage; not triaged/,
    );
    assert.equal(r.output, "skip=true\n");
    assert.deepEqual(r.lookups, []);
  }
});

test("a dispatch of a github-actions[bot] issue runs when needs-triage is newer than every edit", (t) => {
  const r = gate(t, {
    ...BOT,
    labels: ["needs-triage", "needs-operator"],
    event: "workflow_dispatch",
    actor: "reader",
    timeline: [
      labeled("needs-operator", "2026-11-01T00:00:00Z", "github-actions[bot]"),
      { event: "renamed", created_at: "2026-11-02T00:00:00Z", actor: { login: "dra" } },
      labeled("needs-triage", "2026-11-03T00:00:00Z", "maintainer"),
    ],
    edited: "2026-11-02T12:00:00Z",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.output, "");
  assert.equal(r.env, VOUCHED);
  // The labeller is checked, not the author or the dispatch's actor.
  assert.deepEqual(r.lookups, ["maintainer"]);
});

test("a dispatch of a github-actions[bot] issue without a vouching needs-triage ends green with a notice", (t) => {
  const vouched = labeled("needs-triage", "2026-11-03T00:00:00Z");
  for (const [why, over] of [
    ["no needs-triage now", { labels: [], timeline: [vouched] }],
    ["never labelled", { timeline: [labeled("bug", "2026-11-03T00:00:00Z")] }],
    ["edited after", { timeline: [vouched], edited: "2026-11-04T00:00:00Z" }],
    ["edited the same second", { timeline: [vouched], edited: "2026-11-03T00:00:00Z" }],
    [
      "renamed after",
      { timeline: [vouched, { event: "renamed", created_at: "2026-11-04T00:00:00Z" }] },
    ],
    [
      "reopened after",
      { timeline: [vouched, { event: "reopened", created_at: "2026-11-04T00:00:00Z" }] },
    ],
  ]) {
    const r = gate(t, { ...BOT, labels: ["needs-triage"], event: "workflow_dispatch", ...over });
    assert.equal(r.status, 0, `${why}: ${r.stdout}${r.stderr}`);
    assert.match(
      r.stdout,
      /::notice::#8 was opened by github-actions\[bot\]; add needs-triage to it \(after any edit\) to vouch for its text and have it triaged; not triaged/,
      why,
    );
    assert.doesNotMatch(r.stdout, /::error::/, why);
    assert.equal(r.output, "skip=true\n", why);
    assert.equal(r.env, "", why);
    assert.deepEqual(r.lookups, [], why);
  }
});

test("a dispatch vouched for by a labeller without write access ends green with a notice", (t) => {
  const r = gate(t, {
    ...BOT,
    labels: ["needs-triage"],
    event: "workflow_dispatch",
    timeline: [labeled("needs-triage", "2026-11-03T00:00:00Z", "triager")],
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(
    r.stdout,
    /::notice::#8 was opened by github-actions\[bot\] and triager, who added needs-triage, has 'triage' access to acme\/widgets, not write; someone with write access must add it to vouch for its text; not triaged/,
  );
  assert.doesNotMatch(r.stdout, /::error::/);
  assert.equal(r.output, "skip=true\n");
  assert.deepEqual(r.lookups, ["triager"]);
});

test("a dispatch takes the last needs-triage in timeline order when two share a second", (t) => {
  // A writer's label, removed and added again by a triager in the same
  // second: the triager's is the one in force, whatever the logins sort as.
  for (const [first, last, passes] of [
    ["maintainer", "triager", false],
    ["triager", "maintainer", true],
  ]) {
    const r = gate(t, {
      ...BOT,
      labels: ["needs-triage"],
      event: "workflow_dispatch",
      timeline: [
        labeled("needs-triage", "2026-11-03T00:00:00Z", first),
        { event: "unlabeled", created_at: "2026-11-03T00:00:00Z", label: { name: "needs-triage" } },
        labeled("needs-triage", "2026-11-03T00:00:00Z", last),
      ],
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(r.output, passes ? "" : "skip=true\n", `${first} then ${last}`);
    assert.equal(r.env, passes ? VOUCHED : "", `${first} then ${last}`);
    assert.deepEqual(r.lookups, [last]);
  }
});

test("another bot's issue is refused as before, needs-triage or not", (t) => {
  const other = { author: "dependabot[bot]", type: "Bot", labels: ["needs-triage"] };
  const event = gate(t, { ...other, event: "issues" });
  assert.equal(event.status, 0, event.stdout + event.stderr);
  assert.match(event.stdout, /::notice::dependabot\[bot\] has 'none' access/);
  assert.equal(event.output, "skip=true\n");
  const dispatch = gate(t, { ...other, event: "workflow_dispatch" });
  assert.equal(dispatch.status, 1, dispatch.stdout + dispatch.stderr);
  assert.match(dispatch.stdout, /::error::dependabot\[bot\] has 'none' access/);
  assert.deepEqual(dispatch.lookups, ["dependabot[bot]"]);
});

// The settings job's if:, read from the workflow and evaluated on issue
// events: it is the first filter, so a github-actions[bot] issue reaches
// the gate only on needs-triage being added or an edit (which the gate
// skips; its run cancels one in flight), and another bot's never.
function settingsIf() {
  const lines = fs
    .readFileSync(path.join(root, ".github/workflows/issue-triage.yml"), "utf8")
    .split("\n");
  const job = lines.indexOf("  settings:");
  const at = lines.findIndex((l, i) => i > job && l.trim() === "if: >-");
  const body = [];
  for (let i = at + 1; lines[i].startsWith("      "); i++) body.push(lines[i].trim());
  const js = body
    .join(" ")
    .replace(/\.labels\.\*\.name/g, ".labels.map((l) => l.name)")
    .replace(/'([^']*)'/g, (_, v) => JSON.stringify(v))
    .replace(/==/g, "===")
    .replace(/!===/g, "!==");
  return new Function("github", "contains", `return (${js});`);
}

test("issue-triage.yml: the settings job passes a bot's issue only on a vouching needs-triage or an edit", () => {
  const passes = settingsIf();
  const contains = (list, v) => list.includes(v);
  const check = (login, type, action, label) =>
    passes(
      {
        event_name: "issues",
        event: {
          action,
          label: label ? { name: label } : undefined,
          issue: { state: "open", user: { login, type }, labels: [] },
        },
      },
      contains,
    );
  assert.equal(check("github-actions[bot]", "Bot", "labeled", "needs-triage"), true);
  // An edit passes only to cancel a run in flight; the gate skips it.
  assert.equal(check("github-actions[bot]", "Bot", "edited", undefined), true);
  for (const [action, label] of [
    ["opened", undefined],
    ["reopened", undefined],
    ["labeled", "bug"],
  ]) {
    assert.equal(check("github-actions[bot]", "Bot", action, label), false, `${action} ${label}`);
  }
  assert.equal(check("dependabot[bot]", "Bot", "labeled", "needs-triage"), false);
  // A person's issue is unchanged: any edit, or needs-triage added.
  assert.equal(check("dra", "User", "edited", undefined), true);
  assert.equal(check("dra", "User", "labeled", "needs-triage"), true);
  assert.equal(check("dra", "User", "labeled", "bug"), false);
});

// Every step after the gate either runs only on a sweep (the gate runs only
// on a single issue) or checks the gate's skip in its if:, so a skipped
// event runs nothing else.
const SKIP = "steps.gate.outputs.skip != 'true'";
test("every step after the gate honours its skip", () => {
  const lines = fs
    .readFileSync(path.join(root, ".github/workflows/issue-triage.yml"), "utf8")
    .split("\n");
  const start = lines.findIndex((l) => l.trim() === `- name: ${GATE}`);
  assert.notEqual(start, -1);
  assert.equal(lines[start + 1].trim(), "id: gate");
  // The gate is the triage job's first step, so a refused event costs no
  // checkout or install (the settings job before it reads no issue text).
  const job = lines.indexOf("  triage:");
  assert.notEqual(job, -1);
  const first = lines.findIndex((l, i) => i > job && /^ {6}- \w+:/.test(l));
  assert.equal(first, start, `the first step is ${lines[first]?.trim()}, not the gate`);
  // The triage job's steps, up to the next job (the dispatch job, which
  // runs only on a sweep's queue).
  const end = lines.findIndex((l, i) => i > start && /^ {2}\w[\w-]*:$/.test(l));
  const steps = [];
  for (let i = start + 1; i < (end === -1 ? lines.length : end); i++) {
    if (!/^ {6}- \w+:/.test(lines[i])) continue;
    let cond = null;
    for (let j = i + 1; j < lines.length && !/^ {6}(- |#)/.test(lines[j]); j++) {
      const m = lines[j].match(/^ {8}if: (.*)$/);
      if (m) cond = m[1];
    }
    steps.push({ step: lines[i].trim(), cond });
  }
  assert.ok(steps.length >= 10, `only ${steps.length} steps found after the gate`);
  for (const { step, cond } of steps) {
    assert.ok(
      // A sweep step runs with no gate: the gate is for a single issue.
      cond === "env.TRIAGE_ISSUE == ''" ||
        cond === "${{ !cancelled() && env.TRIAGE_ISSUE == '' }}" ||
        cond === SKIP ||
        (cond ?? "").endsWith(` && ${SKIP}`),
      `${step} runs after a skip (if: ${cond})`,
    );
  }
});

// The kit-update-check workflow's two scripts, read from the workflow file
// and run with bash as the job runs them: the comparison against a scratch
// kit served as a bare repository, and the notice against the stub gh.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { root, stubGh, tempDir } from "./helpers/server.mjs";
import { needsBash4, runStep, stepScript } from "./helpers/workflow.mjs";

const compareScript = stepScript("kit-update-check.yml", "Compare the lock with the kit");
const noticeScript = stepScript("kit-update-check.yml", "Open, update or close the notice");

const SOURCE = "github.com/acme/kit";

// A kit with two commits (three with moves or forms), each a release
// (v0.1.0, v0.2.0, v0.3.0), served at https://github.com/acme/kit.git
// through a url.insteadOf in a global git config of the test's own. after()
// runs git in the served repository, for a later tag or an unreleased
// commit. With forms, the manifest lists issue forms too: v0.2.0 changes
// one, adds one and drops one, and v0.3.0 changes only a form.
// With block, v0.2.0 adds docs/agents-md-block.md with the Work tracking
// block between its markers (v0.1.0 has none).
function kitFixture(t, { moves = false, forms = false, block = false, blockDoc = BLOCK_DOC } = {}) {
  const dir = tempDir(t);
  const work = path.join(dir, "kit");
  fs.mkdirSync(work);
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: work,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_AUTHOR_NAME: "Test",
        GIT_AUTHOR_EMAIL: "test@example.com",
        GIT_COMMITTER_NAME: "Test",
        GIT_COMMITTER_EMAIL: "test@example.com",
      },
    }).trim();
  const write = (file, content, mode = 0o644) => {
    fs.mkdirSync(path.dirname(path.join(work, file)), { recursive: true });
    fs.writeFileSync(path.join(work, file), content);
    fs.chmodSync(path.join(work, file), mode);
  };
  git("init", "-q", "-b", "main");
  git("config", "commit.gpgsign", "false");
  write(
    "kit-manifest.txt",
    "# the kit's files\na.txt\nrun.sh\ngone.txt\nkeep.txt\nseed s1.md\nseed s2.md\n" +
      (forms ? `${FORMS}/bug.yml\n${FORMS}/old.yml\n` : ""),
  );
  if (forms) {
    write(`${FORMS}/bug.yml`, "bug\n");
    write(`${FORMS}/old.yml`, "old\n");
  }
  write("a.txt", "a\n");
  write("run.sh", "#!/bin/sh\n", 0o755);
  write("gone.txt", "gone\n");
  write("keep.txt", "keep\n");
  write("s1.md", "seed one\n");
  write("s2.md", "seed two\n");
  git("add", "-A");
  git("commit", "-q", "-m", "first");
  const first = git("rev-parse", "HEAD");
  git("tag", "v0.1.0");
  // A changed file, a lost executable bit, a new file, a new seed, a changed
  // seed (not reported), a dropped file and a dropped seed (not reported).
  write(
    "kit-manifest.txt",
    "a.txt\nrun.sh\nkeep.txt\nnew.txt\nseed s1.md\nseed s3.md\n" +
      (forms ? `${FORMS}/bug.yml\n${FORMS}/task.yml\n` : ""),
  );
  if (forms) {
    write(`${FORMS}/bug.yml`, "bug, changed\n");
    write(`${FORMS}/task.yml`, "task\n");
    git("rm", "-q", `${FORMS}/old.yml`);
  }
  write("a.txt", "a changed\n");
  write("run.sh", "#!/bin/sh\n", 0o644);
  write("new.txt", "new\n");
  write("s1.md", "seed one, changed\n");
  write("s3.md", "seed three\n");
  if (block) write("docs/agents-md-block.md", blockDoc);
  git("rm", "-q", "gone.txt", "s2.md");
  git("add", "-A");
  git("commit", "-q", "-m", "second");
  const second = git("rev-parse", "HEAD");
  git("tag", "-a", "-m", "v0.2.0", "v0.2.0");
  let third;
  if (moves) {
    // A managed file becomes a seed and a seed becomes managed, contents
    // unchanged.
    write("kit-manifest.txt", "a.txt\nrun.sh\nseed keep.txt\nnew.txt\ns1.md\nseed s3.md\n");
    git("add", "-A");
    git("commit", "-q", "-m", "third");
    third = git("rev-parse", "HEAD");
    git("tag", "v0.3.0");
  } else if (forms) {
    write(`${FORMS}/bug.yml`, "bug, changed again\n");
    git("commit", "-q", "-am", "third");
    third = git("rev-parse", "HEAD");
    git("tag", "v0.3.0");
  }
  const bare = path.join(dir, "kit.git");
  git("clone", "-q", "--bare", work, bare);
  const config = path.join(dir, "gitconfig");
  fs.writeFileSync(config, `[url "file://${bare}"]\n\tinsteadOf = https://${SOURCE}.git\n`);
  // A commit on main that no release carries yet: a.txt changes again.
  const unreleased = () => {
    write("a.txt", "a, unreleased\n");
    git("commit", "-q", "-am", "unreleased");
    git("push", "-q", bare, "main");
    return git("rev-parse", "HEAD");
  };
  const after = (...args) => git("--git-dir", bare, ...args);
  return { first, second, third, config, unreleased, after };
}

// A target repository's checkout with a lock (and an AGENTS.md when
// agents is given), and the compare step run on it.
function compare(t, kit, lock, agents) {
  const dir = tempDir(t);
  if (agents !== undefined) {
    fs.mkdirSync(path.join(dir, "target"), { recursive: true });
    fs.writeFileSync(path.join(dir, "target/AGENTS.md"), agents);
  }
  if (lock !== null) {
    fs.mkdirSync(path.join(dir, "target/.github"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "target/.github/gh-agent-kit.lock"),
      typeof lock === "string" ? lock : JSON.stringify(lock),
    );
  }
  const output = path.join(dir, "github-output");
  fs.writeFileSync(output, "");
  const temp = path.join(dir, "runner-temp");
  fs.mkdirSync(temp);
  const r = runStep(dir, compareScript, {
    GIT_CONFIG_GLOBAL: kit.config,
    GIT_CONFIG_NOSYSTEM: "1",
    GITHUB_OUTPUT: output,
    RUNNER_TEMP: temp,
  });
  const outputs = Object.fromEntries(
    fs
      .readFileSync(output, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split(/=(.*)/s).slice(0, 2)),
  );
  return { ...r, outputs };
}

const FORMS = ".github/ISSUE_TEMPLATE";

const START = "<!-- gh-agent-kit:work-tracking:start -->";
const END = "<!-- gh-agent-kit:work-tracking:end -->";
const BLOCK = `${START}\n\n### Work tracking\n\n- A rule.\n\n${END}\n`;
// As in the kit: the block inside a fenced example, between prose.
const BLOCK_DOC = `# The AGENTS.md block\n\nProse.\n\n\`\`\`markdown\n${BLOCK}\`\`\`\n`;
const agentsWith = (block) =>
  `# Working in this repo\n\n## Project specifics\n\n### Ours\n\nA rule.\n\n${block}`;

const LOCK_AT = (ref) => ({
  source: SOURCE,
  ref,
  dirty: false,
  seeds: ["s1.md", "s2.md"],
  paths: ["a.txt", "run.sh", "gone.txt", "keep.txt", "s1.md", "s2.md"],
});

test("the compare step reports each changed, added and removed file", { skip: needsBash4 }, (t) => {
  const kit = kitFixture(t);
  const r = compare(t, kit, LOCK_AT(kit.first));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(
    r.stdout,
    [
      "updated    a.txt",
      "updated    run.sh",
      "added      new.txt",
      "added      s3.md",
      "removed    gone.txt",
      "",
    ].join("\n"),
  );
  assert.deepEqual(r.outputs, {
    state: "behind",
    ref: kit.second,
    tag: "v0.2.0",
    source: SOURCE,
  });
});

test("the compare step reports a file moving between seed and managed", { skip: needsBash4 }, (t) => {
  const kit = kitFixture(t, { moves: true });
  const r = compare(t, kit, {
    source: SOURCE,
    ref: kit.second,
    dirty: false,
    seeds: ["s1.md", "s3.md"],
    paths: ["a.txt", "run.sh", "keep.txt", "new.txt", "s1.md", "s3.md"],
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "updated    keep.txt\nupdated    s1.md\n");
  assert.deepEqual(r.outputs, {
    state: "behind",
    ref: kit.third,
    tag: "v0.3.0",
    source: SOURCE,
  });
});

test("the compare step leaves out the kit's issue forms when the lock keeps its own", { skip: needsBash4 }, (t) => {
  const kit = kitFixture(t, { forms: true });
  // With the kit's forms, a changed, added and dropped form each count.
  const withKit = compare(t, kit, {
    ...LOCK_AT(kit.first),
    paths: [...LOCK_AT(kit.first).paths, `${FORMS}/bug.yml`, `${FORMS}/old.yml`],
  });
  assert.equal(withKit.status, 0, withKit.stderr);
  assert.equal(
    withKit.stdout,
    [
      "updated    a.txt",
      "updated    run.sh",
      "added      new.txt",
      "added      s3.md",
      `updated    ${FORMS}/bug.yml`,
      `added      ${FORMS}/task.yml`,
      "removed    gone.txt",
      `removed    ${FORMS}/old.yml`,
      "",
    ].join("\n"),
  );
  // With its own, as install.sh --issue-forms=own records it, none does.
  const own = compare(t, kit, { ...LOCK_AT(kit.first), issue_forms: "own" });
  assert.equal(own.status, 0, own.stderr);
  assert.equal(
    own.stdout,
    [
      "updated    a.txt",
      "updated    run.sh",
      "added      new.txt",
      "added      s3.md",
      "removed    gone.txt",
      "",
    ].join("\n"),
  );
  assert.equal(own.outputs.state, "behind");
  // A form an own lock lists, by hand, is not reported when dropped either.
  const listed = compare(t, kit, {
    ...LOCK_AT(kit.first),
    issue_forms: "own",
    paths: [...LOCK_AT(kit.first).paths, `${FORMS}/old.yml`],
  });
  assert.equal(listed.status, 0, listed.stderr);
  assert.equal(listed.stdout, own.stdout);
  // A release that changed only a form leaves such a lock current.
  const current = {
    source: SOURCE,
    ref: kit.second,
    dirty: false,
    seeds: ["s1.md", "s3.md"],
    paths: ["a.txt", "run.sh", "keep.txt", "new.txt", "s1.md", "s3.md"],
  };
  const formsOnly = compare(t, kit, { ...current, issue_forms: "own" });
  assert.equal(formsOnly.status, 0, formsOnly.stderr);
  assert.equal(formsOnly.stdout, "");
  assert.deepEqual(formsOnly.outputs, {
    state: "current",
    ref: kit.third,
    tag: "v0.3.0",
    source: SOURCE,
  });
  const kitForms = compare(t, kit, {
    ...current,
    issue_forms: "kit",
    paths: [...current.paths, `${FORMS}/bug.yml`, `${FORMS}/task.yml`],
  });
  assert.equal(kitForms.status, 0, kitForms.stderr);
  assert.equal(kitForms.stdout, `updated    ${FORMS}/bug.yml\n`);
  assert.equal(kitForms.outputs.state, "behind");
});

test("the compare step reports a missing or differing Work tracking block", { skip: needsBash4 }, (t) => {
  const kit = kitFixture(t, { block: true });
  const atRelease = {
    source: SOURCE,
    ref: kit.second,
    dirty: false,
    seeds: ["s1.md", "s3.md"],
    paths: ["a.txt", "run.sh", "keep.txt", "new.txt", "s1.md", "s3.md"],
  };
  // The release's block, as install.sh writes it: current.
  const same = compare(t, kit, atRelease, agentsWith(BLOCK));
  assert.equal(same.status, 0, same.stderr);
  assert.equal(same.stdout, "");
  assert.equal(same.outputs.state, "current");
  // An edit inside the markers, no AGENTS.md, an AGENTS.md without the
  // block, or the block only inside fenced code each count.
  const cases = [
    [agentsWith(BLOCK.replace("A rule.", "A rule, edited.")), "updated"],
    [undefined, "missing"],
    [agentsWith(""), "missing"],
    [agentsWith("```markdown\n" + BLOCK + "```\n"), "missing"],
  ];
  for (const [agents, verb] of cases) {
    const r = compare(t, kit, atRelease, agents);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, `${verb.padEnd(11)}AGENTS.md (Work tracking block)\n`);
    assert.equal(r.outputs.state, "behind");
  }
  // Behind a release that adds the block, it is listed after the files.
  const behind = compare(t, kit, LOCK_AT(kit.first), agentsWith(""));
  assert.equal(behind.status, 0, behind.stderr);
  assert.match(behind.stdout, /^removed {4}gone\.txt\nmissing {4}AGENTS\.md \(Work tracking block\)\n$/m);
  // Two blocks, markers out of order, or a block inside a fence that an
  // inner fence of fewer backticks does not close are no block install.sh
  // would accept, so they count too.
  for (const [agents, verb] of [
    [agentsWith(BLOCK + "\n" + BLOCK), "updated"],
    [agentsWith(`${END}\n${START}\n`), "updated"],
    [agentsWith("````md\n```\n" + BLOCK + "````\n"), "missing"],
  ]) {
    const r = compare(t, kit, atRelease, agents);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, `${verb.padEnd(11)}AGENTS.md (Work tracking block)\n`);
  }
  // A lock past the release is current, its block included: going back
  // is not an update.
  const unreleased = kit.unreleased();
  const past = compare(
    t,
    kit,
    { ...atRelease, ref: unreleased },
    agentsWith(BLOCK.replace("A rule.", "A rule, edited.")),
  );
  assert.equal(past.status, 0, past.stderr);
  assert.equal(past.stdout, "");
  assert.equal(past.outputs.state, "current");
});

// What install.sh writes is what the compare step accepts: the kit's real
// block, installed into AGENTS.md files with and without a final newline
// and with a closed fence before the block's place, compares as current.
test("the compare step finds the block install.sh writes current", { skip: needsBash4 }, (t) => {
  const kit = kitFixture(t, { block: true, blockDoc: fs.readFileSync(path.join(root, "docs/agents-md-block.md"), "utf8") });
  for (const agents of [
    "# Working in this repo\n\n## Project specifics\n\n### Ours\n\nA rule.\n",
    "# Working in this repo\n\n## Project specifics\n\nA rule.",
    "# W\n\n## Project specifics\n\n~~~sh\n## not a heading\n~~~\n\n## Later\n\nText.\n",
  ]) {
    const target = tempDir(t);
    execFileSync("git", ["init", "-q", target], { env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" } });
    fs.writeFileSync(path.join(target, "AGENTS.md"), agents);
    const out = execFileSync("bash", [path.join(root, "install.sh"), target], {
      encoding: "utf8",
      env: { ...process.env, KIT_ALLOW_DIRTY: "1", GIT_CONFIG_GLOBAL: "/dev/null" },
    });
    assert.match(out, /^added {6}AGENTS\.md \(Work tracking block\)$/m);
    const installed = fs.readFileSync(path.join(target, "AGENTS.md"), "utf8");
    const r = compare(
      t,
      kit,
      {
        source: SOURCE,
        ref: kit.second,
        dirty: false,
        seeds: ["s1.md", "s3.md"],
        paths: ["a.txt", "run.sh", "keep.txt", "new.txt", "s1.md", "s3.md"],
      },
      installed,
    );
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, "", installed);
    assert.equal(r.outputs.state, "current");
  }
});

test("the compare step checks no block for a release without one", (t) => {
  const kit = kitFixture(t);
  const r = compare(t, kit, LOCK_AT(kit.second), agentsWith(""));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "");
  assert.equal(r.outputs.state, "current");
});

test("the compare step finds a lock at the latest release current", (t) => {
  const kit = kitFixture(t);
  const r = compare(t, kit, LOCK_AT(kit.second));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "");
  assert.deepEqual(r.outputs, {
    state: "current",
    ref: kit.second,
    tag: "v0.2.0",
    source: SOURCE,
  });
});

test("the compare step ignores what the default branch has past the latest release", { skip: needsBash4 }, (t) => {
  const kit = kitFixture(t);
  const unreleased = kit.unreleased();
  // At the release, the unreleased change to a.txt is not reported.
  const atRelease = compare(t, kit, LOCK_AT(kit.second));
  assert.equal(atRelease.status, 0, atRelease.stderr);
  assert.equal(atRelease.stdout, "");
  assert.equal(atRelease.outputs.state, "current");
  // Behind the release, the files are compared with the release, not main.
  const behind = compare(t, kit, LOCK_AT(kit.first));
  assert.equal(behind.status, 0, behind.stderr);
  assert.match(behind.stdout, /^updated {4}a\.txt$/m);
  assert.deepEqual(
    { ref: behind.outputs.ref, tag: behind.outputs.tag },
    { ref: kit.second, tag: "v0.2.0" },
  );
  // Past the release (installed from main), going back is not an update.
  const past = compare(t, kit, LOCK_AT(unreleased));
  assert.equal(past.status, 0, past.stderr);
  assert.equal(past.stdout, "");
  assert.deepEqual(past.outputs, {
    state: "current",
    ref: kit.second,
    tag: "v0.2.0",
    source: SOURCE,
  });
});

test("the compare step takes the highest vX.Y.Z tag as the latest release", { skip: needsBash4 }, (t) => {
  const kit = kitFixture(t);
  const unreleased = kit.unreleased();
  // Neither a pre-release, a tag of another form nor one that sorts
  // first as text is the latest release.
  kit.after("tag", "v0.10.0-rc.1", unreleased);
  kit.after("tag", "release-9", unreleased);
  kit.after("tag", "v0.9.9", kit.first);
  const old = compare(t, kit, LOCK_AT(kit.second));
  assert.equal(old.status, 0, old.stderr);
  assert.equal(old.outputs.tag, "v0.9.9");
  assert.equal(old.outputs.ref, kit.first);
  // The lock is past v0.9.9's commit, so it is current.
  assert.equal(old.outputs.state, "current");
  kit.after("tag", "v0.10.0", unreleased);
  const r = compare(t, kit, {
    ...LOCK_AT(kit.second),
    seeds: ["s1.md", "s3.md"],
    paths: ["a.txt", "run.sh", "keep.txt", "new.txt", "s1.md", "s3.md"],
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "updated    a.txt\n");
  assert.deepEqual(r.outputs, {
    state: "behind",
    ref: unreleased,
    tag: "v0.10.0",
    source: SOURCE,
  });
});

test("the compare step warns and stops when the kit has no release", (t) => {
  const kit = kitFixture(t);
  for (const tag of ["v0.1.0", "v0.2.0"]) kit.after("tag", "-d", tag);
  kit.after("tag", "v0.3.0-rc.1", kit.second);
  const r = compare(t, kit, LOCK_AT(kit.first));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /::warning::https:\/\/github\.com\/acme\/kit has no release/);
  assert.deepEqual(r.outputs, {});
});

test("the compare step says so when the lock's ref is not in the kit's history", (t) => {
  const kit = kitFixture(t);
  const r = compare(t, kit, LOCK_AT("0123456789abcdef0123456789abcdef01234567"));
  assert.equal(r.status, 0, r.stderr);
  assert.match(
    r.stdout,
    /^The lock's ref 0123456789abcdef0123456789abcdef01234567 is not in the kit's history, .* latest release, v0\.2\.0, /,
  );
  assert.equal(r.outputs.state, "behind");
});

test("the compare step checks the lock before it fetches anything", (t) => {
  const kit = kitFixture(t);
  const none = compare(t, kit, null);
  assert.equal(none.status, 0, none.stderr);
  assert.match(none.stdout, /::notice::no \.github\/gh-agent-kit\.lock in this repository/);
  assert.deepEqual(none.outputs, {});
  for (const [lock, message] of [
    [
      { ...LOCK_AT(kit.first), source: "https://evil.example/kit" },
      /the lock's source .* is not github\.com\/<owner>\/<repo>/,
    ],
    [LOCK_AT(kit.first.slice(0, 12)), /the lock's ref .* is not a full commit id/],
  ]) {
    const r = compare(t, kit, lock);
    assert.equal(r.status, 1);
    assert.match(r.stdout, message);
    assert.deepEqual(r.outputs, {});
  }
});

test("the compare step warns and stops when it cannot fetch the kit", (t) => {
  const kit = kitFixture(t);
  const missing = path.join(tempDir(t), "missing.git");
  fs.writeFileSync(kit.config, `[url "file://${missing}"]\n\tinsteadOf = https://${SOURCE}.git\n`);
  const r = compare(t, kit, LOCK_AT(kit.first));
  assert.equal(r.status, 0, r.stderr);
  assert.match(
    r.stdout,
    /::warning::could not fetch https:\/\/github\.com\/acme\/kit; the update check reads only a public repository/,
  );
  assert.doesNotMatch(r.stdout, /KIT_READ_TOKEN|add-mask/);
  assert.deepEqual(r.outputs, {});
});

// The notice step against the stub gh.
const ISSUES = "^api --method GET repos/acme/widgets/issues -f state=open";
const MARKER = "<!-- kit-update-check -->";
const bot = { login: "github-actions[bot]" };
const lookAlike = {
  number: 5,
  pull_request: null,
  user: { login: "someone" },
  body: `${MARKER}\nnot ours`,
};

function notice(t, { state, issues }) {
  const dir = tempDir(t);
  const temp = path.join(dir, "runner-temp");
  fs.mkdirSync(temp);
  fs.writeFileSync(path.join(temp, "check.out"), "updated    a.txt\nadded      new.txt\n");
  const stub = stubGh(dir, [
    { match: ISSUES, json: issues },
    { match: "^api --method (POST|PATCH) ", stdout: "" },
  ]);
  const r = runStep(dir, noticeScript, {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    REPO: "acme/widgets",
    STATE: state,
    KIT_REF: "f".repeat(40),
    KIT_TAG: "v1.2.3",
    KIT_SOURCE: SOURCE,
    RUN_URL: "https://github.com/acme/widgets/actions/runs/1",
    RUNNER_TEMP: temp,
  });
  const calls = fs
    .readFileSync(stub.log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l).args);
  return { ...r, writes: calls.filter((a) => /^(POST|PATCH)$/.test(a[2])) };
}

test("the notice step opens one issue when behind and none is open", (t) => {
  // A look-alike by someone else and a pull request are not the notice.
  const r = notice(t, {
    state: "behind",
    issues: [lookAlike, { number: 6, pull_request: {}, user: bot, body: MARKER }],
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.writes.length, 1);
  const [args] = r.writes;
  assert.deepEqual(args.slice(0, 4), ["api", "--method", "POST", "repos/acme/widgets/issues"]);
  assert.ok(args.includes("labels[]=needs-operator"));
  assert.ok(args.includes("title=Update gh-agent-kit to v1.2.3"));
  const body = args.find((a) => a.startsWith(`body=${MARKER}\n`));
  assert.ok(body, "the body starts with the marker");
  assert.match(body, /differs from the kit's latest release, v1\.2\.3, as listed below/);
  assert.match(body, /cannot place the Work tracking block .* needs that edit by hand first/);
  assert.match(body, /AGENTS\.md when its Work tracking block is missing or differs/);
  assert.match(body, /against github\.com\/acme\/kit v1\.2\.3 \(`f{40}`\)/);
  assert.match(body, /~~~text\nupdated {4}a\.txt\nadded {6}new\.txt\n~~~/);
  assert.match(body, /`git checkout v1\.2\.3`/);
});

test("the notice step updates the open notice instead of opening another", (t) => {
  const r = notice(t, {
    state: "behind",
    issues: [lookAlike, { number: 12, pull_request: null, user: bot, body: `${MARKER}\nold` }],
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.writes.length, 1);
  assert.deepEqual(r.writes[0].slice(0, 4), [
    "api",
    "--method",
    "PATCH",
    "repos/acme/widgets/issues/12",
  ]);
});

test("the notice step closes the open notice once current", (t) => {
  const r = notice(t, {
    state: "current",
    issues: [{ number: 12, pull_request: null, user: bot, body: `${MARKER}\nold` }],
  });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(
    r.writes.map((a) => a.slice(0, 4).join(" ")),
    [
      "api --method POST repos/acme/widgets/issues/12/comments",
      "api --method PATCH repos/acme/widgets/issues/12",
    ],
  );
  assert.ok(r.writes[0].some((a) => a.includes("current with github.com/acme/kit v1.2.3")));
  assert.ok(r.writes[1].includes("state=closed"));
  assert.ok(r.writes[1].includes("state_reason=completed"));
});

test("the notice step leaves a look-alike alone and writes nothing when current", (t) => {
  const r = notice(t, { state: "current", issues: [lookAlike] });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.writes, []);
});

// The guard steps pr-review and security-scan share, read from each
// workflow and run with bash against the stub gh: the write-access gate,
// the removal of the head's executable Claude configuration and the check
// that the checkout holds no credentials. Each test plants the case its
// rule refuses beside one it lets through.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { gitRepo, stubGh, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const WORKFLOWS = [
  { file: "pr-review.yml", refused: "not reviewed" },
  { file: "security-scan.yml", refused: "not scanned" },
];

function step(t, file, name, { env = {}, rules = [], dir } = {}) {
  dir ??= tempDir(t);
  const stub = stubGh(tempDir(t), rules);
  return runStep(dir, stepScript(file, name), {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    REPO: "acme/widgets",
    ...env,
  });
}

const permission = (login, value) => ({
  match: `^api --method GET repos/acme/widgets/collaborators/${login}/permission --jq`,
  json: { permission: value },
});
const ACCESS = [
  permission("dra", "admin"),
  permission("maintainer", "write"),
  permission("reader", "read"),
  permission("outsider", "none"),
];

for (const { file, refused } of WORKFLOWS) {
  test(`${file}: the gate refuses an author or actor without write access`, (t) => {
    const GATE = "Refuse a pull request event from an author or actor without write access";
    const ok = step(t, file, GATE, { rules: ACCESS, env: { AUTHOR: "maintainer", ACTOR: "dra" } });
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    for (const [author, actor, login, access] of [
      ["reader", "dra", "reader", "read"],
      ["dra", "outsider", "outsider", "none"],
    ]) {
      const r = step(t, file, GATE, { rules: ACCESS, env: { AUTHOR: author, ACTOR: actor } });
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.match(
        r.stdout,
        new RegExp(
          `::error::${login} has '${access}' access to acme/widgets, not write; ${refused}`,
        ),
      );
    }
  });

  test(`${file}: the head's executable Claude configuration is removed`, (t) => {
    const dir = tempDir(t);
    const planted = [
      ".claude/settings.json",
      ".mcp.json",
      ".claude.json",
      "CLAUDE.local.md",
      ".gitmodules",
      ".ripgreprc",
      ".husky/pre-commit",
    ];
    const kept = ["src/app.js", ".github/workflows/ci.yml", "docs/claude.md"];
    for (const f of [...planted, ...kept]) {
      fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      fs.writeFileSync(path.join(dir, f), "x\n");
    }
    const r = step(t, file, "Remove executable Claude configuration from the checkout", { dir });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    for (const f of planted.map((p) => p.split("/")[0]))
      assert.ok(!fs.existsSync(path.join(dir, f)), `${f} is left`);
    for (const f of kept) assert.ok(fs.existsSync(path.join(dir, f)), `${f} was removed`);
  });

  test(`${file}: a checkout whose git config references credentials fails the run`, (t) => {
    const NAME = "Verify the checkout holds no credentials";
    const checkout = () => {
      const repo = gitRepo(t);
      repo.commit("README.md", "x\n", "base");
      return repo;
    };
    const clean = checkout();
    const ok = step(t, file, NAME, { dir: clean.dir });
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    for (const [key, value] of [
      ["http.https://github.com/.extraheader", "AUTHORIZATION: basic eDp5"],
      ["includeIf.gitdir:/home/runner/work/.path", "/home/runner/work/_temp/credentials.config"],
    ]) {
      const repo = checkout();
      repo.git("config", "--local", key, value);
      const r = step(t, file, NAME, { dir: repo.dir });
      assert.equal(r.status, 1, `${key}: ${r.stdout}`);
      assert.match(r.stdout, /::error::\.git\/config references credentials/);
    }
  });
}

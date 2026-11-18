// A workflow step's script, read from the workflow file and run with bash as
// the job runs it, so a test exercises the committed script itself.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { gitRepo, root } from "./server.mjs";

// The run: block of the step with this name in .github/workflows/<file>,
// without its indentation. The name may follow the step's id.
export function stepScript(file, name) {
  const lines = fs.readFileSync(path.join(root, ".github/workflows", file), "utf8").split("\n");
  const start = lines.findIndex(
    (l, i) =>
      l.trim() === `- name: ${name}` ||
      (l.trim() === `name: ${name}` && /^\s+- id:/.test(lines[i - 1] ?? "")),
  );
  assert.notEqual(start, -1, `no step named ${name}`);
  let i = start + 1;
  while (i < lines.length && !/^\s+run: \|$/.test(lines[i])) {
    assert.doesNotMatch(lines[i], /^\s+- (name|uses|id):/, `step ${name} has no run: block`);
    i++;
  }
  const indent = lines[i].match(/^\s*/)[0].length + 2;
  const body = [];
  for (i++; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() !== "" && l.match(/^\s*/)[0].length < indent) break;
    body.push(l.slice(indent));
  }
  return body.join("\n").trimEnd() + "\n";
}

// The bash a step runs with. The runner's is bash 5, but some steps use
// bash 4 features (declare -A, mapfile) that macOS's stock bash 3.2 lacks,
// so a host takes the first bash 4+ of STEP_BASH, the bash on PATH and
// Homebrew's, and falls back to the bash on PATH.
const bashMajor = (bash) => {
  const r = spawnSync(bash, ["-c", "echo ${BASH_VERSINFO[0]}"], { encoding: "utf8" });
  return r.status === 0 ? Number(r.stdout.trim()) : 0;
};
const stepBash =
  [process.env.STEP_BASH, "bash", "/opt/homebrew/bin/bash", "/usr/local/bin/bash"]
    .filter(Boolean)
    .find((bash) => bashMajor(bash) >= 4) ?? "bash";

// The skip option for a test whose step needs bash 4: false when the step's
// bash has it, otherwise the reason, which node --test prints.
export const needsBash4 =
  bashMajor(stepBash) >= 4
    ? false
    : "the step uses bash 4 (declare -A, mapfile), and no bash 4+ was found: set STEP_BASH to one";

// bash as the workflow's defaults.run.shell runs a step.
export function runStep(dir, script, env) {
  const file = path.join(dir, "step.sh");
  fs.writeFileSync(file, script);
  return spawnSync(stepBash, ["--noprofile", "--norc", "-eo", "pipefail", file], {
    cwd: dir,
    encoding: "utf8",
    // A step that loops (a carry-on whose time bound broke, under the
    // stubbed sleep) fails its test instead of holding the run.
    timeout: 60000,
    env: { PATH: process.env.PATH, HOME: dir, ...env },
  });
}

// The security scan's "Find the base's public-content check", run for a
// base whose files are baseFiles (none: a base with no check) and whose
// symlinks are baseLinks (path: target), so that RUNNER_TEMP (temp) holds
// the state and the guard the scan's later steps source. Its result is the
// step's.
export function publicContentGuard(t, temp, baseFiles = {}, baseLinks = {}) {
  const repo = gitRepo(t);
  repo.commit("a.txt", "a\n", "base");
  for (const [f, content] of Object.entries(baseFiles)) repo.commit(f, content, `base ${f}`);
  for (const [f, target] of Object.entries(baseLinks)) {
    fs.mkdirSync(path.dirname(path.join(repo.dir, f)), { recursive: true });
    fs.symlinkSync(target, path.join(repo.dir, f));
    repo.git("add", "--", f);
    repo.git("commit", "-q", "-m", `link ${f}`);
  }
  repo.git("update-ref", "refs/remotes/origin/main", repo.git("rev-parse", "HEAD"));
  fs.mkdirSync(temp, { recursive: true });
  const r = runStep(
    repo.dir,
    stepScript("security-scan.yml", "Find the base's public-content check"),
    {
      RUNNER_TEMP: temp,
      BASE: "main",
    },
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return r;
}

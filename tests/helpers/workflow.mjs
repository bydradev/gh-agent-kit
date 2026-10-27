// A workflow step's script, read from the workflow file and run with bash as
// the job runs it, so a test exercises the committed script itself.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { root } from "./server.mjs";

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

// bash as the workflow's defaults.run.shell runs a step.
export function runStep(dir, script, env) {
  const file = path.join(dir, "step.sh");
  fs.writeFileSync(file, script);
  return spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", file], {
    cwd: dir,
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: dir, ...env },
  });
}

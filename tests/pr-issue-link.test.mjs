// The pr-issue-link workflow's check, read from the workflow file and run
// with bash as the job runs it, on pull request bodies; and the job-level
// exemptions for Dependabot and Release Please.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { root, stubGh, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const script = stepScript("pr-issue-link.yml", "Look for a closing issue or a No issue line");

// The step against the stub gh, serving the pull request with this body
// (null when it has none).
function check(t, body) {
  const dir = tempDir(t);
  const stub = stubGh(dir, [
    { match: "^api repos/acme/widgets/pulls/5 --jq", json: { body: body ?? null } },
  ]);
  return runStep(dir, script, {
    PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
    GH_STUB_RULES: stub.rulesFile,
    GH_STUB_LOG: stub.log,
    REPO: "acme/widgets",
    PR: "5",
  });
}

test("a closing keyword before an issue passes, in each form GitHub links", (t) => {
  for (const body of [
    "## Why\n\nCloses #12.",
    "Fixes: #3",
    "RESOLVED acme/widgets#7",
    "This change resolves https://github.com/acme/widgets/issues/9 for good.",
    "- fix #1\n- also part of #2",
    "Work tracking.\r\n\r\nCloses #44\r\n",
    "Closes:#5",
    "```sh\nnpm test\n```\n\nFixes #6",
    // Backticks with a backtick after them open no fence.
    "``` not`a fence\nCloses #12",
  ]) {
    const r = check(t, body);
    assert.equal(r.status, 0, `${JSON.stringify(body)}: ${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /names the issue this pull request closes/);
  }
});

test("a No issue line with a reason passes, plain, bold, emphasised or as a list item", (t) => {
  for (const body of [
    "## Why\n\nNo issue: the operator asked to skip it for this typo fix.\n",
    "**No issue:** a typo",
    "- No issue: a typo",
    "No issue: **the operator asked to skip this**",
    "No issue: _the operator asked_",
    "**No issue:** *a typo*",
  ]) {
    const r = check(t, body);
    assert.equal(r.status, 0, `${JSON.stringify(body)}: ${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /says why this pull request has no issue/);
  }
});

test("a mention, a keyword without a number, a bare No issue, a template hint or fenced code fails", (t) => {
  for (const body of [
    undefined,
    "",
    "Part of #48.",
    "Related to #12; closes the gap in the docs.",
    "Disclosed #12",
    "Closes #12x",
    "No issue:",
    "No issue:   ",
    "<!-- Closes #12, or a No issue: line -->\n## Why\n\nBecause.",
    "Mentions closes#12 without a space",
    "**No issue:**",
    "No issue:**",
    "No issue: __",
    "**No issue:** **",
    "- __No issue:__ ",
    "**No issue:** <!-- the reason -->",
    "```\nCloses #12\n```",
    "~~~~md\n~~~\nCloses #12\n~~~~",
    // A fence that a line of the other character, or one with text after
    // its backticks, does not close; a tilde fence whose info string has a
    // backtick; and an opening fence's own info string.
    "```\n~~~\nCloses #12\n```",
    "```\n``` x\nCloses #12\n```",
    "~~~ a`b\nCloses #12\n~~~",
    "```Closes #12\ncode\n```",
    "<!--\nCloses #12\n-->\nNo issue:",
  ]) {
    const r = check(t, body);
    assert.equal(r.status, 1, `${JSON.stringify(body)} passed: ${r.stdout}`);
    assert.match(r.stdout, /::error::The pull request's body names no issue it closes/);
  }
});

test("the job skips Dependabot's and Release Please's pull requests", () => {
  const text = fs.readFileSync(path.join(root, ".github/workflows/pr-issue-link.yml"), "utf8");
  const settings = text.slice(text.indexOf("\n  settings:\n"), text.indexOf("\n  link:\n"));
  assert.match(settings, /github\.event\.pull_request\.user\.login != 'dependabot\[bot\]'/);
  assert.match(
    settings,
    /!\(startsWith\(github\.head_ref, 'release-please--'\) &&\n\s+github\.event\.pull_request\.user\.type == 'Bot'\)/,
  );
  // The script holds no expression: what it reads comes through env.
  assert.doesNotMatch(script, /\$\{\{/);
});

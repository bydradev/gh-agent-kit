// The tools the review, the scan and triage deny Claude Code, read from the
// three workflows: each run's --disallowedTools list and its settings file's
// deny list name the same tools, and both include the subagent and
// scheduling tools, since --max-turns counts only the main session's turns
// (Claude Code 2.1.306 offers Agent, Skill and ScheduleWakeup beside the
// allowed tools), and the ones ToolSearch offers that act (EnterWorktree
// and ExitWorktree add a worktree and a branch to the checkout).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { root } from "./helpers/server.mjs";
import { stepScript } from "./helpers/workflow.mjs";

const DENIED = [
  "Bash",
  "Edit",
  "Write",
  "NotebookEdit",
  "WebFetch",
  "WebSearch",
  "Agent",
  "Task",
  "Skill",
  "ScheduleWakeup",
  "EnterWorktree",
  "ExitWorktree",
  "CronDelete",
  "SendMessage",
  "TaskStop",
  "Read(//proc/**)",
  "Read(//dev/**)",
  "Read(//${GITHUB_WORKSPACE#/}/.git/**)",
];

const RUNS = [
  {
    file: "pr-review.yml",
    variable: "REVIEW_DENIED",
    listStep: "Write the model's settings and the MCP server's configuration",
    settingsStep: "Write the model's settings and the MCP server's configuration",
    runs: 1,
  },
  {
    file: "security-scan.yml",
    variable: "SCAN_DENIED",
    listStep: "Write the scan's inputs and the model's settings",
    settingsStep: "Write the scan's inputs and the model's settings",
    runs: 2,
  },
  {
    file: "issue-triage.yml",
    variable: "DENIED",
    listStep: "Scope the bot's tools to this run",
    settingsStep: "Write the model's settings and the MCP server's configuration",
    runs: 1,
  },
];

for (const { file, variable, listStep, settingsStep, runs } of RUNS) {
  test(`${file}: Claude Code is denied the shell, writes, the network and subagents, in its flags and its settings`, () => {
    const lines = stepScript(file, listStep).split("\n");
    const echoes = lines.filter((l) => l.startsWith(`echo "${variable}=`));
    assert.equal(echoes.length, 1, `one ${variable} line in ${listStep}`);
    const flags = echoes[0].match(new RegExp(`^echo "${variable}=([^"]+)" >> "\\$GITHUB_ENV"$`))[1];
    assert.deepEqual(flags.split(","), DENIED);

    const settings = stepScript(file, settingsStep)
      .split("\n")
      .filter((l) => l.trim().startsWith('"deny": '));
    assert.equal(settings.length, 1, `one settings deny list in ${settingsStep}`);
    assert.deepEqual(JSON.parse(settings[0].trim().replace(/^"deny": /, "")), DENIED);

    // Every Claude Code run gets that list and that settings file.
    const workflow = fs.readFileSync(path.join(root, ".github/workflows", file), "utf8");
    const calls = workflow.split("/opt/agent-kit/claude -p ").slice(1);
    assert.equal(calls.length, runs);
    for (const call of calls) {
      const command = call.split("\n");
      const args = command.slice(0, command.findIndex((l) => !l.endsWith("\\")) + 1).map((l) => l.trim());
      assert.ok(args.includes(`--disallowedTools "$${variable}" \\`), args.join("\n"));
      assert.ok(args.includes('--settings "$RUNNER_TEMP/claude-settings.json" \\'), args.join("\n"));
    }
  });
}

// issue-triage's OpenCode runner (KIT_TRIAGE_RUNNER=opencode, the default
// on OpenCode Go): the settings step's runner checks, which steps run on
// each runner, and "Run the triage on OpenCode" read from the workflow and
// run with bash against a stub OpenCode CLI that lists its models, records
// its environment, its arguments and the configuration it was given, and
// answers with the events of a run.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { opencodeStub, recorded } from "./helpers/opencode.mjs";
import { root, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const FILE = "issue-triage.yml";
const TRIAGE_ALLOWED =
  "Read,Grep,Glob,mcp__agent-kit__view,mcp__agent-kit__comments,mcp__agent-kit__comment_body,mcp__agent-kit__search,mcp__agent-kit__read_issue,mcp__agent-kit__open_prs,mcp__agent-kit__info,mcp__agent-kit__add_label,mcp__agent-kit__remove_label,mcp__agent-kit__comment";
const SWEEP_ALLOWED = "mcp__agent-kit__list_eligible,mcp__agent-kit__dispatch";

function settings(t, env) {
  const dir = tempDir(t);
  const envFile = path.join(dir, "github-env");
  fs.writeFileSync(envFile, "");
  const r = runStep(dir, stepScript(FILE, "Read the triage settings"), { GITHUB_ENV: envFile, ...env });
  const written = Object.fromEntries(
    fs
      .readFileSync(envFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split(/=(.*)/s).slice(0, 2)),
  );
  return { ...r, env: written };
}

test("issue-triage.yml: the runner follows the provider unless set, and opencode needs the Go provider", (t) => {
  const unset = settings(t, {});
  assert.equal(unset.status, 0, unset.stdout);
  assert.equal(unset.env.KIT_TRIAGE_RUNNER, "claude-code");
  assert.doesNotMatch(unset.stdout, /::warning::/);

  // On Go triage runs in OpenCode's CLI unless the setting says not.
  const go = settings(t, { PROVIDER: "opencode-go" });
  assert.equal(go.status, 0, go.stdout);
  assert.equal(go.env.KIT_TRIAGE_RUNNER, "opencode");
  assert.equal(go.env.KIT_TRIAGE_MODEL, "deepseek-v4.1-flash");
  assert.doesNotMatch(go.stdout, /::warning::/);

  // An effort level goes on to the run step, which passes it as a variant.
  const named = settings(t, { PROVIDER: "opencode-go", RUNNER: "opencode", EFFORT: "high" });
  assert.equal(named.status, 0, named.stdout);
  assert.equal(named.env.KIT_TRIAGE_EFFORT, "high");

  // Claude Code on Go runs when the setting asks for it, with a warning.
  const claudeOnGo = settings(t, { PROVIDER: "opencode-go", RUNNER: "claude-code" });
  assert.equal(claudeOnGo.status, 0, claudeOnGo.stdout);
  assert.equal(claudeOnGo.env.KIT_TRIAGE_RUNNER, "claude-code");
  assert.match(
    claudeOnGo.stdout,
    /^::warning::the setting KIT_TRIAGE_RUNNER is claude-code on OpenCode Go, where Claude Code runs Go's models slower than OpenCode's CLI; the kit recommends leaving it unset \(unset\)$/m,
  );

  // A model Go serves only on its Chat Completions endpoint is a Go model
  // id like any other.
  const chat = settings(t, { PROVIDER: "opencode-go", RUNNER: "opencode", MODEL: "glm-5.3-flash" });
  assert.equal(chat.status, 0, chat.stdout);
  assert.equal(chat.env.KIT_TRIAGE_MODEL, "glm-5.3-flash");

  for (const [env, message] of [
    [{ RUNNER: "codex" }, /KIT_TRIAGE_RUNNER must be claude-code, opencode or unset, not 'codex' \(unset\)/],
    // The error names where the value came from.
    [
      { RUNNER: "codex", FROM_KIT_TRIAGE_RUNNER: ".github/gh-agent-kit.yml line 3" },
      /not 'codex' \(\.github\/gh-agent-kit\.yml line 3\)/,
    ],
    [{ RUNNER: "opencode" }, /KIT_TRIAGE_RUNNER is opencode, which needs KIT_TRIAGE_PROVIDER set to opencode-go, not 'unset'/],
    [{ PROVIDER: "anthropic", RUNNER: "opencode" }, /needs KIT_TRIAGE_PROVIDER set to opencode-go, not 'anthropic'/],
    // The runner is checked first, so a Go model id does not read as a
    // bad Claude model name.
    [{ RUNNER: "opencode", MODEL: "glm-5.3-flash" }, /KIT_TRIAGE_RUNNER is opencode, which needs KIT_TRIAGE_PROVIDER set to opencode-go/],
    [{ PROVIDER: "opencode-go", RUNNER: "opencode", MODEL: "muse-spark-1.3-contributor" }, /Contributor model/],
  ]) {
    const bad = settings(t, env);
    assert.equal(bad.status, 1, JSON.stringify(env));
    assert.match(bad.stdout, message);
    // A refused runner is never passed on.
    if (message.source.includes("KIT_TRIAGE_RUNNER")) assert.equal(bad.env.KIT_TRIAGE_RUNNER, undefined, JSON.stringify(env));
  }
});

// Each step's if: as written in the workflow.
function stepIf(name) {
  const lines = fs.readFileSync(path.join(root, ".github/workflows", FILE), "utf8").split("\n");
  const start = lines.findIndex((l) => l.trim() === `- name: ${name}`);
  assert.notEqual(start, -1, name);
  const line = lines[start + 1].trim();
  assert.match(line, /^if: /, name);
  return line.slice(4);
}

test("issue-triage.yml: each runner installs and runs only its own CLI", () => {
  // Every step reads the value the settings job checked, so an unknown
  // runner never reaches the triage job.
  const notOpencode = "env.KIT_TRIAGE_RUNNER != 'opencode' && steps.gate.outputs.skip != 'true'";
  assert.equal(stepIf("Install subprocess isolation dependencies"), notOpencode);
  assert.equal(stepIf("Install Claude Code"), notOpencode);
  assert.equal(stepIf("Install OpenCode"), "env.KIT_TRIAGE_RUNNER == 'opencode' && steps.gate.outputs.skip != 'true'");
  assert.equal(stepIf("Run the triage"), "env.KIT_TRIAGE_RUNNER == 'claude-code' && steps.gate.outputs.skip != 'true'");
  assert.equal(stepIf("Run the triage on OpenCode"), "env.KIT_TRIAGE_RUNNER == 'opencode' && steps.gate.outputs.skip != 'true'");
});

test("issue-triage.yml: the OpenCode install checks the binary before installing it", () => {
  const script = stepScript(FILE, "Install OpenCode");
  const check = script.indexOf("sha256sum -c -");
  const install = script.indexOf("sudo install");
  assert.ok(check !== -1 && install !== -1 && check < install);
  assert.match(script, /github\.com\/anomalyco\/opencode\/releases\/download\/v\$VERSION\/opencode-linux-x64\.tar\.gz/);
});

const SUCCESS = [
  { type: "step_start", part: { type: "step-start" } },
  { type: "tool_use", part: { type: "tool", tool: "read", state: { status: "completed" } } },
  {
    type: "step_finish",
    part: { reason: "tool-calls", cost: 0.25, tokens: { input: 10, output: 2, reasoning: 1, cache: { read: 5, write: 0 } } },
  },
  { type: "step_start", part: { type: "step-start" } },
  { type: "text", part: { type: "text", text: "Triaged." } },
  {
    type: "step_finish",
    part: { reason: "stop", cost: 0.5, tokens: { input: 1, output: 3, reasoning: 0, cache: { read: 7, write: 2 } } },
  },
];

// The run step with the CLI replaced by a stub that lists `models`, writes
// what the run was started with and prints `events` (one JSON object a
// line) with `exit`.
function run(
  t,
  {
    events = SUCCESS,
    exit = 0,
    key = "ok",
    allowed = TRIAGE_ALLOWED,
    maxTurns = "40",
    effort = "",
    serverArgs,
    models,
    modelsExit,
  } = {},
) {
  const dir = tempDir(t);
  const temp = path.join(dir, "runner-temp");
  fs.mkdirSync(temp);
  const files = opencodeStub(dir, { events, exit, models, modelsExit });
  const mcp = {
    mcpServers: {
      "agent-kit": {
        command: "node",
        args: serverArgs ?? ["/opt/agent-kit/mcp-server.mjs", "triage"],
        env: { GH_TOKEN_FILE: path.join(temp, "gh-token"), GITHUB_REPOSITORY: "acme/widgets", TRIAGE_ISSUE: "8" },
      },
    },
  };
  const script = stepScript(FILE, "Run the triage on OpenCode").replaceAll("/opt/agent-kit/opencode", files.stub);
  const r = runStep(dir, script, {
    RUNNER_TEMP: temp,
    RESULT: path.join(temp, "opencode-events.jsonl"),
    GITHUB_WORKSPACE: dir,
    OPENCODE_API_KEY: key,
    ALLOWED: allowed,
    MCP_CONFIG: JSON.stringify(mcp),
    KIT_TRIAGE_MODEL: "glm-5.3-flash",
    KIT_TRIAGE_EFFORT: effort,
    KIT_TRIAGE_MAX_TURNS: maxTurns,
    PROMPT: "Read the skill.",
    GH_TOKEN: "job-token",
  });
  return { ...r, ...recorded(files), temp, dir };
}

test("issue-triage.yml, Run the triage on OpenCode: the run gets the Go model and an isolated configuration", (t) => {
  const r = run(t);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(r.args, ["run", "--format", "json", "-m", "opencode-go/glm-5.3-flash", "Read the skill."]);
  assert.equal(r.config.model, "opencode-go/glm-5.3-flash");
  assert.equal(r.config.small_model, "opencode-go/glm-5.3-flash");
  assert.equal(r.config.autoupdate, false);
  assert.equal(r.config.share, "disabled");
  assert.deepEqual(r.config.agent, { build: { steps: 40 } });
  // The key reaches OpenCode by its environment, never in the configuration.
  assert.equal(r.env.OPENCODE_API_KEY, "ok");
  assert.equal(r.config.provider["opencode-go"].options.apiKey, "{env:OPENCODE_API_KEY}");
  assert.doesNotMatch(r.env.OPENCODE_CONFIG_CONTENT, /"ok"/);
  for (const name of [
    "OPENCODE_DISABLE_PROJECT_CONFIG",
    "OPENCODE_PURE",
    "OPENCODE_DISABLE_CLAUDE_CODE",
    "OPENCODE_DISABLE_EXTERNAL_SKILLS",
    "OPENCODE_DISABLE_AUTOUPDATE",
    "OPENCODE_DISABLE_LSP_DOWNLOAD",
    "OPENCODE_DISABLE_MODELS_FETCH",
  ]) {
    assert.equal(r.env[name], "1", name);
  }
  const home = path.join(r.temp, "opencode-home");
  assert.equal(r.env.HOME, home);
  for (const name of ["XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME", "XDG_STATE_HOME"]) {
    assert.ok(r.env[name].startsWith(home + "/"), name);
  }
  assert.equal(r.env.GH_TOKEN, "");
  assert.equal(r.env.GITHUB_TOKEN, "");
  assert.match(r.stdout, /^steps: 2$/m);
  assert.match(r.stdout, /^cost_usd \(Go prices\): 0\.75$/m);
  assert.match(r.stdout, /^tokens: input 11, cache read 12, cache write 2, output 5, reasoning 1$/m);
  assert.match(r.stdout, /^result: Triaged\.$/m);
  assert.deepEqual(r.modelsArgs, ["models", "opencode-go", "--verbose"]);
  assert.equal(r.modelsEnv.HOME, home);
});

test("issue-triage.yml, Run the triage on OpenCode: the model must be listed and an effort level one of its variants", (t) => {
  // glm-5.3-flash has no variants in the stub's list.
  const r = run(t, { effort: "high" });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^::error::the setting KIT_TRIAGE_EFFORT is 'high', which OpenCode does not offer for glm-5\.3-flash; it offers none, or leave it unset$/m);
  assert.equal(r.env, null);
  const script = stepScript(FILE, "Run the triage on OpenCode");
  assert.match(script, /--variant "\$KIT_TRIAGE_EFFORT"/);
  const unlisted = run(t, { models: "" });
  assert.equal(unlisted.status, 1, unlisted.stdout + unlisted.stderr);
  assert.match(unlisted.stdout, /^::error::the setting KIT_TRIAGE_MODEL is 'glm-5\.3-flash', which the pinned OpenCode does not list for OpenCode Go$/m);
  assert.equal(unlisted.env, null);
  const failed = run(t, { modelsExit: 1, models: "Error: no provider\n" });
  assert.equal(failed.status, 1, failed.stdout + failed.stderr);
  assert.match(failed.stdout, /^::error::OpenCode could not list its models \(exit status 1\), so KIT_TRIAGE_MODEL could not be checked$/m);
  assert.match(failed.stderr, /Error: no provider/);
  assert.equal(failed.env, null);
});

test("issue-triage.yml, Run the triage on OpenCode: everything is denied but reads and the run's server tools", (t) => {
  const triage = run(t).config.permission;
  assert.equal(Object.keys(triage)[0], "*");
  assert.equal(triage["*"], "deny");
  assert.equal(triage.external_directory, "deny");
  assert.deepEqual(triage.read, { "*": "allow", ".git": "deny", ".git/*": "deny" });
  assert.equal(triage.grep, "allow");
  assert.equal(triage.glob, "allow");
  const tools = TRIAGE_ALLOWED.split(",")
    .filter((n) => n.startsWith("mcp__"))
    .map((n) => n.replace("mcp__agent-kit__", "agent-kit_"));
  assert.deepEqual(
    Object.keys(triage).filter((k) => k.startsWith("agent-kit_")),
    tools,
  );
  for (const k of tools) assert.equal(triage[k], "allow", k);
  for (const k of ["bash", "edit", "webfetch", "websearch", "task", "skill"]) {
    assert.equal(triage[k], undefined, k);
  }

  // The sweep's tools only, but still the reads the skill needs.
  const sweep = run(t, { allowed: SWEEP_ALLOWED }).config.permission;
  assert.deepEqual(
    Object.keys(sweep).filter((k) => k.startsWith("agent-kit_")),
    ["agent-kit_list_eligible", "agent-kit_dispatch"],
  );
  assert.equal(sweep.read["*"], "allow");

  const unknown = run(t, { allowed: "Read,Bash" });
  assert.equal(unknown.status, 5, unknown.stdout + unknown.stderr);
  assert.match(unknown.stderr, /no OpenCode permission for the allowed tool Bash/);
  assert.equal(unknown.env, null);
});

test("issue-triage.yml, Run the triage on OpenCode: the MCP server starts with its own variables and no key", (t) => {
  const dump = path.join(tempDir(t), "dump-env.mjs");
  fs.writeFileSync(dump, "process.stdout.write(JSON.stringify(process.env));\n");
  const r = run(t, { serverArgs: [dump] });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const command = r.config.mcp["agent-kit"].command;
  assert.equal(r.config.mcp["agent-kit"].type, "local");
  assert.deepEqual(command.slice(0, 2), ["/usr/bin/env", "-i"]);
  assert.equal(command.at(-1), dump);
  // Started as OpenCode would start it, with the key in the parent's
  // environment.
  const started = spawnSync(command[0], command.slice(1), {
    encoding: "utf8",
    env: { ...process.env, OPENCODE_API_KEY: "ok", GH_TOKEN: "job-token" },
  });
  assert.equal(started.status, 0, started.stderr);
  const env = JSON.parse(started.stdout);
  assert.deepEqual(Object.keys(env).sort(), [
    "GH_TOKEN_FILE",
    "GITHUB_REPOSITORY",
    "GITHUB_WORKSPACE",
    "HOME",
    "PATH",
    "TRIAGE_ISSUE",
  ]);
  assert.equal(env.GITHUB_WORKSPACE, r.dir);
  assert.notEqual(env.HOME, path.join(r.temp, "opencode-home"));
});

test("issue-triage.yml, Run the triage on OpenCode: a failed, unfinished or exhausted run fails the step", (t) => {
  const finish = (reason) => ({ type: "step_finish", part: { reason, cost: 0, tokens: {} } });
  const start = { type: "step_start", part: {} };
  for (const [opts, message] of [
    [
      {
        events: [{ type: "error", error: { name: "APIError", data: { message: "Upstream request failed: Invalid credential" } } }],
        exit: 1,
      },
      /^errors: Upstream request failed: Invalid credential$/m,
    ],
    [{ events: [start, { type: "error", error: { name: "ProviderModelNotFoundError" } }, finish("stop")] }, /^errors: ProviderModelNotFoundError$/m],
    [{ events: SUCCESS, exit: 3 }, /OpenCode's run ended in error \(exit status 3\)/],
    [{ events: [start, finish("length")] }, /^last step: length$/m],
    [{ events: [start, finish("tool-calls"), start, finish("stop")], maxTurns: "2" }, /reached the turn limit \(KIT_TRIAGE_MAX_TURNS=2\)/],
    [{ events: ["not json", ""] }, /OpenCode exited with status 0 and no events/],
  ]) {
    const r = run(t, opts);
    assert.equal(r.status, 1, JSON.stringify(opts) + r.stdout);
    assert.match(r.stdout, message, JSON.stringify(opts));
  }
  // A line that is not an event is left out of the summary.
  const noisy = run(t, { events: ["starting", "42", '"text"', ...SUCCESS] });
  assert.equal(noisy.status, 0, noisy.stdout + noisy.stderr);
});

test("issue-triage.yml, Run the triage on OpenCode: the model's text cannot run workflow commands", (t) => {
  const text = "Triaged.\n::error::steered\n::add-mask::x";
  const events = SUCCESS.map((e) => (e.type === "text" ? { ...e, part: { ...e.part, text } } : e));
  const r = run(t, { events });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const lines = r.stdout.split("\n");
  const begin = lines.findIndex((l) => /^::stop-commands::[0-9a-f]{32}$/.test(l));
  assert.notEqual(begin, -1, r.stdout);
  const end = lines.indexOf(`::${lines[begin].slice("::stop-commands::".length)}::`);
  const steered = lines.indexOf("::error::steered");
  assert.ok(begin < steered && steered < end, r.stdout);
  assert.ok(lines.indexOf("::add-mask::x") < end, r.stdout);
});

test("issue-triage.yml, Run the triage on OpenCode: no key fails before the CLI starts", (t) => {
  const r = run(t, { key: "" });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /KIT_TRIAGE_RUNNER is opencode but the OPENCODE_API_KEY secret is not set/);
  assert.equal(r.env, null);
});

test("issue-triage.yml: the checkout's OpenCode configuration goes before OpenCode first runs", (t) => {
  const NAME = "Remove the checkout's OpenCode configuration";
  assert.equal(
    stepIf(NAME),
    "env.KIT_TRIAGE_RUNNER == 'opencode' && steps.gate.outputs.skip != 'true'",
  );
  const text = fs.readFileSync(path.join(root, ".github/workflows", FILE), "utf8");
  const at = (name) => {
    const i = text.indexOf(`- name: ${name}\n`);
    assert.notEqual(i, -1, name);
    return i;
  };
  assert.ok(at(NAME) < at("Install OpenCode"));
  assert.ok(at("Install OpenCode") < at("Run the triage on OpenCode"));

  // The plugins 1.19.3 imports even with the project's configuration
  // turned off go; the rest of the checkout stays.
  const dir = tempDir(t);
  for (const file of [".opencode/plugin/a.js", ".opencode/plugins/b.ts", "opencode.json", "opencode.jsonc", "src/opencode.json", "README.md"]) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), "x\n");
  }
  const script = path.join(dir, "step.sh");
  fs.writeFileSync(script, stepScript(FILE, NAME));
  const r = spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", script], {
    cwd: dir,
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: dir },
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const gone of [".opencode", "opencode.json", "opencode.jsonc"]) {
    assert.ok(!fs.existsSync(path.join(dir, gone)), gone);
  }
  for (const kept of ["src/opencode.json", "README.md", "step.sh"]) {
    assert.ok(fs.existsSync(path.join(dir, kept)), kept);
  }
});

test("issue-triage.yml: before OpenCode runs, .git and the symlinks leave the checkout", (t) => {
  const NAME = "Hide .git and the checkout's symlinks from OpenCode";
  assert.equal(
    stepIf(NAME),
    "env.KIT_TRIAGE_RUNNER == 'opencode' && steps.gate.outputs.skip != 'true'",
  );
  const dir = tempDir(t);
  const temp = path.join(dir, "runner-temp");
  fs.mkdirSync(temp);
  const work = path.join(dir, "checkout");
  fs.mkdirSync(path.join(work, ".git"), { recursive: true });
  fs.writeFileSync(path.join(work, ".git", "config"), "[core]\n");
  fs.mkdirSync(path.join(work, ".claude", "skills"), { recursive: true });
  fs.mkdirSync(path.join(work, ".agents", "skills", "triage"), { recursive: true });
  fs.writeFileSync(path.join(work, ".agents", "skills", "triage", "SKILL.md"), "skill\n");
  fs.symlinkSync("../../.agents/skills/triage", path.join(work, ".claude", "skills", "triage"));
  fs.symlinkSync("/proc/self/environ", path.join(work, "environ"));
  const script = path.join(dir, "step.sh");
  fs.writeFileSync(script, stepScript(FILE, NAME));
  const r = spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", script], {
    cwd: work,
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: dir, RUNNER_TEMP: temp },
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(!fs.existsSync(path.join(work, ".git")));
  assert.equal(fs.readFileSync(path.join(temp, "checkout-git", "config"), "utf8"), "[core]\n");
  for (const link of ["environ", ".claude/skills/triage"]) {
    assert.throws(() => fs.lstatSync(path.join(work, link)), { code: "ENOENT" }, link);
  }
  assert.equal(fs.readFileSync(path.join(work, ".agents", "skills", "triage", "SKILL.md"), "utf8"), "skill\n");
  assert.match(r.stdout, /^removed a symlink: \.\/environ$/m);
  // It comes before OpenCode first runs.
  const text = fs.readFileSync(path.join(root, ".github/workflows", FILE), "utf8");
  assert.ok(text.indexOf(`- name: ${NAME}\n`) < text.indexOf("- name: Run the triage on OpenCode\n"));
});

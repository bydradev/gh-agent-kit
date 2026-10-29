// pr-review's OpenCode runner (KIT_REVIEW_RUNNER=opencode, the default on
// OpenCode Go): the settings step's runner checks, which steps run on each
// runner, the removal of the checkout's OpenCode configuration, the .git
// move, and "Run the review on OpenCode" read from the workflow and run with
// bash against a stub OpenCode CLI that lists its models, records its
// environment, its arguments and the configuration it was given, and
// answers with the events of a run.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { LOG_LINE, opencodeStub, recorded, sleepStub } from "./helpers/opencode.mjs";
import { root, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const FILE = "pr-review.yml";
const REVIEW_ALLOWED =
  "Read,Grep,Glob,mcp__agent-kit__inline_comment,mcp__agent-kit__pr,mcp__agent-kit__conversation,mcp__agent-kit__inline,mcp__agent-kit__reviews,mcp__agent-kit__checks,mcp__agent-kit__issue,mcp__agent-kit__issue_comments,mcp__agent-kit__comment_body,mcp__agent-kit__files,mcp__agent-kit__diff,mcp__agent-kit__show,mcp__agent-kit__log,mcp__agent-kit__range_diff,mcp__agent-kit__file_issue,mcp__agent-kit__post_report";

const workflow = () => fs.readFileSync(path.join(root, ".github/workflows", FILE), "utf8");

function settings(t, env) {
  const dir = tempDir(t);
  const envFile = path.join(dir, "github-env");
  fs.writeFileSync(envFile, "");
  const r = runStep(dir, stepScript(FILE, "Read the review settings"), { GITHUB_ENV: envFile, ...env });
  const written = Object.fromEntries(
    fs
      .readFileSync(envFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split(/=(.*)/s).slice(0, 2)),
  );
  return { ...r, env: written };
}

test("pr-review.yml: the runner follows the provider unless set, and opencode needs the Go provider", (t) => {
  const unset = settings(t, {});
  assert.equal(unset.status, 0, unset.stdout);
  assert.equal(unset.env.KIT_REVIEW_RUNNER, "claude-code");
  assert.equal(unset.env.KIT_REVIEW_MODEL, "claude-opus-5-5");
  assert.doesNotMatch(unset.stdout, /::warning::/);

  // On Go the review runs in OpenCode's CLI unless the setting says not.
  const go = settings(t, { PROVIDER: "opencode-go" });
  assert.equal(go.status, 0, go.stdout);
  assert.equal(go.env.KIT_REVIEW_RUNNER, "opencode");
  assert.equal(go.env.KIT_REVIEW_MODEL, "deepseek-v4.1-flash");
  assert.doesNotMatch(go.stdout, /::warning::/);

  // An effort level goes on to the run step, which passes it as a variant.
  const named = settings(t, { PROVIDER: "opencode-go", RUNNER: "opencode", EFFORT: "high" });
  assert.equal(named.status, 0, named.stdout);
  assert.equal(named.env.KIT_REVIEW_RUNNER, "opencode");
  assert.equal(named.env.KIT_REVIEW_EFFORT, "high");

  // Claude Code on Go runs when the setting asks for it, with a warning.
  const claudeOnGo = settings(t, {
    PROVIDER: "opencode-go",
    RUNNER: "claude-code",
    EFFORT: "low",
    FROM_KIT_REVIEW_RUNNER: "the variable",
  });
  assert.equal(claudeOnGo.status, 0, claudeOnGo.stdout);
  assert.equal(claudeOnGo.env.KIT_REVIEW_RUNNER, "claude-code");
  assert.equal(claudeOnGo.env.KIT_REVIEW_EFFORT, "low");
  assert.match(
    claudeOnGo.stdout,
    /^::warning::the setting KIT_REVIEW_RUNNER is claude-code on OpenCode Go, where Claude Code runs Go's models slower than OpenCode's CLI and reviews can hit the time limit; the kit recommends leaving it unset \(the variable\)$/m,
  );

  // Claude Code on the Anthropic API, named or not, warns of nothing.
  const anthropic = settings(t, { PROVIDER: "anthropic", RUNNER: "claude-code" });
  assert.equal(anthropic.status, 0, anthropic.stdout);
  assert.equal(anthropic.env.KIT_REVIEW_RUNNER, "claude-code");
  assert.doesNotMatch(anthropic.stdout, /::warning::/);

  for (const [env, message] of [
    [{ RUNNER: "codex" }, /KIT_REVIEW_RUNNER must be claude-code, opencode or unset, not 'codex' \(unset\)/],
    // The error names where the value came from.
    [
      { RUNNER: "codex", FROM_KIT_REVIEW_RUNNER: ".github/gh-agent-kit.yml line 3" },
      /not 'codex' \(\.github\/gh-agent-kit\.yml line 3\)/,
    ],
    [{ RUNNER: "opencode" }, /KIT_REVIEW_RUNNER is opencode, which needs KIT_REVIEW_PROVIDER set to opencode-go, not 'unset'/],
    [{ PROVIDER: "anthropic", RUNNER: "opencode" }, /needs KIT_REVIEW_PROVIDER set to opencode-go, not 'anthropic'/],
    // The runner is checked first, so a Go model id does not read as a
    // bad Claude model name.
    [{ RUNNER: "opencode", MODEL: "glm-5.3-flash" }, /KIT_REVIEW_RUNNER is opencode, which needs KIT_REVIEW_PROVIDER set to opencode-go/],
    [{ PROVIDER: "opencode-go", MODEL: "muse-spark-1.3-contributor" }, /Contributor model/],
    [{ PROVIDER: "opencode-go", EFFORT: "extreme" }, /KIT_REVIEW_EFFORT must be low, medium, high, xhigh or max, not 'extreme'/],
  ]) {
    const bad = settings(t, env);
    assert.equal(bad.status, 1, JSON.stringify(env));
    assert.match(bad.stdout, message);
    // A refused runner is never passed on.
    if (message.source.includes("KIT_REVIEW_RUNNER")) assert.equal(bad.env.KIT_REVIEW_RUNNER, undefined, JSON.stringify(env));
  }
});

test("pr-review.yml: the settings job passes the runner to the review job", () => {
  const text = workflow();
  assert.match(text, /^ {8}KIT_REVIEW_RUNNER$/m);
  assert.match(text, /^ {6}KIT_REVIEW_RUNNER: \$\{\{ steps\.pass\.outputs\.KIT_REVIEW_RUNNER \}\}$/m);
  assert.match(text, /^ {6}KIT_REVIEW_RUNNER: \$\{\{ needs\.settings\.outputs\.KIT_REVIEW_RUNNER \}\}$/m);
  assert.match(text, /^ {10}RUNNER: \$\{\{ env\.KIT_REVIEW_RUNNER \}\}$/m);
});

// Each step's if: as written in the workflow.
function stepIf(name) {
  const lines = workflow().split("\n");
  const start = lines.findIndex((l) => l.trim() === `- name: ${name}`);
  assert.notEqual(start, -1, name);
  const line = lines[start + 1].trim();
  assert.match(line, /^if: /, name);
  return line.slice(4);
}

test("pr-review.yml: each runner installs and runs only its own CLI", () => {
  // Every step reads the value the settings job checked, so an unknown
  // runner never reaches the review job.
  const notOpencode = "env.RUN != 'false' && env.KIT_REVIEW_RUNNER != 'opencode'";
  const opencode = "env.RUN != 'false' && env.KIT_REVIEW_RUNNER == 'opencode'";
  assert.equal(stepIf("Install subprocess isolation dependencies"), notOpencode);
  assert.equal(stepIf("Install Claude Code"), notOpencode);
  assert.equal(stepIf("Remove the checkout's OpenCode configuration"), opencode);
  assert.equal(stepIf("Install OpenCode"), opencode);
  assert.equal(stepIf("Run the review"), "env.RUN != 'false' && env.KIT_REVIEW_RUNNER == 'claude-code'");
  assert.equal(stepIf("Move .git out of the checkout for OpenCode"), opencode);
  assert.equal(stepIf("Run the review on OpenCode"), opencode);
  assert.equal(stepIf("Put .git back in the checkout"), "always() && env.KIT_REVIEW_RUNNER == 'opencode'");
});

test("pr-review.yml: the checkout's OpenCode configuration goes before OpenCode first runs", (t) => {
  const text = workflow();
  const at = (name) => {
    const i = text.indexOf(`- name: ${name}\n`);
    assert.notEqual(i, -1, name);
    return i;
  };
  assert.ok(at("Remove the checkout's OpenCode configuration") < at("Install OpenCode"));
  assert.ok(at("Install OpenCode") < at("Run the review on OpenCode"));

  // The plugins 1.19.3 imports even with the project's configuration
  // turned off go; the rest of the checkout stays.
  const dir = tempDir(t);
  for (const file of [".opencode/plugin/a.js", ".opencode/plugins/b.ts", ".opencode/agents/c.md", "opencode.json", "opencode.jsonc", "src/opencode.json", "README.md"]) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), "x\n");
  }
  const r = runStep(dir, stepScript(FILE, "Remove the checkout's OpenCode configuration"), {});
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const gone of [".opencode", "opencode.json", "opencode.jsonc"]) {
    assert.ok(!fs.existsSync(path.join(dir, gone)), gone);
  }
  for (const kept of ["src/opencode.json", "README.md"]) {
    assert.ok(fs.existsSync(path.join(dir, kept)), kept);
  }
  // A checkout without any is fine too.
  const again = runStep(dir, stepScript(FILE, "Remove the checkout's OpenCode configuration"), {});
  assert.equal(again.status, 0, again.stdout + again.stderr);
});

test("pr-review.yml: the OpenCode install checks the binary before installing it, at triage's pin", () => {
  const script = stepScript(FILE, "Install OpenCode");
  const check = script.indexOf("sha256sum -c -");
  const install = script.indexOf("sudo install");
  assert.ok(check !== -1 && install !== -1 && check < install);
  assert.match(script, /github\.com\/anomalyco\/opencode\/releases\/download\/v\$VERSION\/opencode-linux-x64\.tar\.gz/);
  // One OpenCode release for the kit: the same VERSION and SHA256 lines.
  const pin = (file) => {
    const text = fs.readFileSync(path.join(root, ".github/workflows", file), "utf8");
    const at = text.indexOf("- name: Install OpenCode");
    assert.notEqual(at, -1, file);
    const step = text.slice(at, text.indexOf("run: |", at));
    return [step.match(/VERSION: (\S+)/)[1], step.match(/SHA256: (\S+)/)[1]];
  };
  assert.deepEqual(pin(FILE), pin("issue-triage.yml"));
});

test("pr-review.yml: both runners get the same prompt, and OpenCode's says where it runs", () => {
  const prompts = workflow()
    .split("\n")
    .filter((l) => l.trim().startsWith('PROMPT: "Read .agents/skills/github-pr-review/SKILL.md'))
    .map((l) => l.trim());
  assert.equal(prompts.length, 2);
  assert.equal(prompts[1], prompts[0].slice(0, -1) + ' The review runs in OpenCode\'s CLI."');
});

test("github-pr-review: the Reviewer line and the round search name both runners", () => {
  const skill = fs.readFileSync(path.join(root, ".agents/skills/github-pr-review/SKILL.md"), "utf8");
  const flat = skill.replace(/\s+/g, " ");
  assert.match(flat, /Your \*Reviewer\* line is `Claude Code \(<model>\)`, or `OpenCode \(<model>\)` when the prompt says the review runs in OpenCode's CLI/);
  assert.match(flat, /whose \*Reviewer\* line names Claude Code or OpenCode/);
});

const SUCCESS = [
  { type: "step_start", part: { type: "step-start" } },
  { type: "tool_use", part: { type: "tool", tool: "agent-kit_pr", state: { status: "completed" } } },
  {
    type: "step_finish",
    part: { reason: "tool-calls", cost: 0.25, tokens: { input: 10, output: 2, reasoning: 1, cache: { read: 5, write: 0 } } },
  },
  { type: "step_start", part: { type: "step-start" } },
  { type: "text", part: { type: "text", text: "Posted the report." } },
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
    runs,
    key = "ok",
    allowed = REVIEW_ALLOWED,
    maxTurns = "120",
    model = "deepseek-v4.1-flash",
    effort = "",
    models,
    modelsExit,
    serverArgs,
  } = {},
) {
  const dir = tempDir(t);
  const temp = path.join(dir, "runner-temp");
  fs.mkdirSync(temp);
  const files = opencodeStub(dir, { events, exit, runs, models, modelsExit });
  const sleep = sleepStub(dir);
  const mcp = {
    mcpServers: {
      "agent-kit": {
        command: "node",
        args: serverArgs ?? ["/opt/agent-kit/mcp-server.mjs", "review"],
        env: {
          GH_TOKEN_FILE: path.join(temp, "gh-token"),
          GITHUB_REPOSITORY: "acme/widgets",
          PR: "7",
          GITHUB_WORKSPACE: dir,
          HEAD_SHA: "a".repeat(40),
          BASE: "main",
          GITHUB_RUN_ID: "11",
          GITHUB_RUN_ATTEMPT: "1",
        },
      },
    },
  };
  const script = stepScript(FILE, "Run the review on OpenCode").replaceAll("/opt/agent-kit/opencode", files.stub);
  const r = runStep(dir, script, {
    RUNNER_TEMP: temp,
    RESULT: path.join(temp, "opencode-events.jsonl"),
    GITHUB_WORKSPACE: dir,
    OPENCODE_API_KEY: key,
    REVIEW_ALLOWED: allowed,
    MCP_CONFIG: JSON.stringify(mcp),
    KIT_REVIEW_MODEL: model,
    KIT_REVIEW_EFFORT: effort,
    KIT_REVIEW_MAX_TURNS: maxTurns,
    PROMPT: "Read the skill.",
    GH_TOKEN: "job-token",
    PATH: sleep.path,
  });
  return { ...r, ...recorded(files), slept: sleep.slept(), temp, dir };
}

test("pr-review.yml, Run the review on OpenCode: the run gets the Go model and an isolated configuration", (t) => {
  const r = run(t);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(r.args, ["run", "--print-logs", "--format", "json", "-m", "opencode-go/deepseek-v4.1-flash", "Read the skill."]);
  assert.equal(r.config.model, "opencode-go/deepseek-v4.1-flash");
  assert.equal(r.config.small_model, "opencode-go/deepseek-v4.1-flash");
  assert.equal(r.config.autoupdate, false);
  assert.equal(r.config.share, "disabled");
  assert.deepEqual(r.config.agent, { build: { steps: 120 } });
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
  assert.match(r.stdout, /^variant: none, so the model default applies$/m);
  assert.match(r.stdout, /^steps: 2$/m);
  assert.match(r.stdout, /^cost_usd \(Go prices\): 0\.75$/m);
  assert.match(r.stdout, /^tokens: input 11, cache read 12, cache write 2, output 5, reasoning 1$/m);
  assert.match(r.stdout, /^result: Posted the report\.$/m);
  // The model list comes from the same isolated CLI, given only the
  // provider: no server, no permissions.
  assert.deepEqual(r.modelsArgs, ["models", "opencode-go", "--verbose"]);
  assert.deepEqual(r.modelsConfig, { provider: { "opencode-go": { options: { apiKey: "{env:OPENCODE_API_KEY}" } } } });
  assert.equal(r.modelsEnv.HOME, home);
  assert.equal(r.modelsEnv.OPENCODE_DISABLE_PROJECT_CONFIG, "1");
  assert.equal(r.modelsEnv.OPENCODE_DISABLE_MODELS_FETCH, "1");
  assert.equal(r.modelsEnv.GH_TOKEN, "");
});

test("pr-review.yml, Run the review on OpenCode: an effort level is a variant the model offers", (t) => {
  const max = run(t, { effort: "max" });
  assert.equal(max.status, 0, max.stdout + max.stderr);
  assert.deepEqual(max.args, ["run", "--print-logs", "--format", "json", "-m", "opencode-go/deepseek-v4.1-flash", "--variant", "max", "Read the skill."]);
  assert.match(max.stdout, /^variant: max$/m);

  // OpenCode would run a variant the model lacks with none, silently, so
  // the step refuses it before the run and names the ones there are.
  for (const [opts, message] of [
    [{ effort: "medium" }, /^::error::the setting KIT_REVIEW_EFFORT is 'medium', which OpenCode does not offer for deepseek-v4\.1-flash; it offers high, low, max, or leave it unset$/m],
    [{ effort: "xhigh" }, /KIT_REVIEW_EFFORT is 'xhigh', which OpenCode does not offer/],
    [{ model: "glm-5.3-flash", effort: "low" }, /does not offer for glm-5\.3-flash; it offers none, or leave it unset$/m],
  ]) {
    const r = run(t, opts);
    assert.equal(r.status, 1, JSON.stringify(opts) + r.stdout + r.stderr);
    assert.match(r.stdout, message, JSON.stringify(opts));
    assert.equal(r.env, null, JSON.stringify(opts));
  }
  // The last model in the list is read whole too.
  const last = run(t, { model: "glm-5.3-flash" });
  assert.equal(last.status, 0, last.stdout + last.stderr);
  assert.deepEqual(last.args, ["run", "--print-logs", "--format", "json", "-m", "opencode-go/glm-5.3-flash", "Read the skill."]);
});

test("pr-review.yml, Run the review on OpenCode: a model the pinned CLI does not list fails before the run", (t) => {
  for (const opts of [
    { model: "minimax-m3.1-flash" },
    // Only the whole id matches.
    { model: "deepseek-v4" },
    { model: "deepseek-v4.1" },
    // A CLI that lists nothing lists no model.
    { models: "" },
  ]) {
    const r = run(t, opts);
    assert.equal(r.status, 1, JSON.stringify(opts) + r.stdout + r.stderr);
    assert.match(
      r.stdout,
      new RegExp(`^::error::the setting KIT_REVIEW_MODEL is '${(opts.model ?? "deepseek-v4.1-flash").replaceAll(".", "\\.")}', which the pinned OpenCode does not list for OpenCode Go$`, "m"),
      JSON.stringify(opts),
    );
    assert.equal(r.env, null, JSON.stringify(opts));
  }
  // A CLI that cannot list its models says so, with what it printed.
  const failed = run(t, { modelsExit: 1, models: "Error: no provider\n" });
  assert.equal(failed.status, 1, failed.stdout + failed.stderr);
  assert.match(
    failed.stdout,
    /^::error::OpenCode could not list its models \(exit status 1\), so KIT_REVIEW_MODEL could not be checked$/m,
  );
  assert.match(failed.stderr, /Error: no provider/);
  assert.equal(failed.env, null);
});

test("pr-review.yml, Run the review on OpenCode: everything is denied but reads and the review's server tools", (t) => {
  const permission = run(t).config.permission;
  assert.equal(Object.keys(permission)[0], "*");
  assert.equal(permission["*"], "deny");
  assert.equal(permission.external_directory, "deny");
  assert.deepEqual(permission.read, { "*": "allow", ".git": "deny", ".git/*": "deny" });
  assert.equal(permission.grep, "allow");
  assert.equal(permission.glob, "allow");
  const tools = REVIEW_ALLOWED.split(",")
    .filter((n) => n.startsWith("mcp__"))
    .map((n) => n.replace("mcp__agent-kit__", "agent-kit_"));
  assert.deepEqual(
    Object.keys(permission).filter((k) => k.startsWith("agent-kit_")),
    tools,
  );
  for (const k of tools) assert.equal(permission[k], "allow", k);
  for (const k of ["bash", "edit", "write", "webfetch", "websearch", "task", "skill"]) {
    assert.equal(permission[k], undefined, k);
  }

  const unknown = run(t, { allowed: "Read,Bash" });
  assert.equal(unknown.status, 5, unknown.stdout + unknown.stderr);
  assert.match(unknown.stderr, /no OpenCode permission for the allowed tool Bash/);
  assert.equal(unknown.env, null);
});

test("pr-review.yml, Run the review on OpenCode: the workflow's tool list maps onto OpenCode's", (t) => {
  // The list the "Write the model's settings" step hands both runners.
  const line = stepScript(FILE, "Write the model's settings and the MCP server's configuration")
    .split("\n")
    .find((l) => l.startsWith('echo "REVIEW_ALLOWED='));
  const allowed = line.match(/^echo "REVIEW_ALLOWED=([^"]+)" >> "\$GITHUB_ENV"$/)[1];
  assert.equal(allowed, REVIEW_ALLOWED);
  const r = run(t, { allowed });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("pr-review.yml, Run the review on OpenCode: the MCP server starts with its own variables, the moved .git and no key", (t) => {
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
    "BASE",
    "GH_TOKEN_FILE",
    "GITHUB_REPOSITORY",
    "GITHUB_RUN_ATTEMPT",
    "GITHUB_RUN_ID",
    "GITHUB_WORKSPACE",
    "GIT_DIR",
    "HEAD_SHA",
    "HOME",
    "PATH",
    "PR",
  ]);
  assert.equal(env.GITHUB_WORKSPACE, r.dir);
  assert.equal(env.GIT_DIR, path.join(r.temp, "checkout-git"));
  assert.notEqual(env.HOME, path.join(r.temp, "opencode-home"));
});

test("pr-review.yml, Run the review on OpenCode: a failed, unfinished or exhausted run fails the step", (t) => {
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
    [{ events: [start, finish("tool-calls"), start, finish("stop")], maxTurns: "2" }, /reached the turn limit \(KIT_REVIEW_MAX_TURNS=2\)/],
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

test("pr-review.yml, Run the review on OpenCode: the model's text cannot run workflow commands", (t) => {
  const text = "Done.\n::error::steered\n::add-mask::x";
  const events = SUCCESS.map((e) => (e.type === "text" ? { ...e, part: { ...e.part, text } } : e));
  const r = run(t, { events });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const lines = r.stdout.split("\n");
  const begin = lines.findIndex((l) => /^::stop-commands::[0-9a-f]{32}$/.test(l));
  assert.notEqual(begin, -1, r.stdout);
  const token = lines[begin].slice("::stop-commands::".length);
  const end = lines.indexOf(`::${token}::`);
  const steered = lines.indexOf("::error::steered");
  assert.ok(begin < steered && steered < end, r.stdout);
  assert.ok(lines.indexOf("::add-mask::x") < end, r.stdout);
});

test("pr-review.yml, Run the review on OpenCode: no key fails before the CLI starts", (t) => {
  const r = run(t, { key: "" });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /KIT_REVIEW_RUNNER is opencode but the OPENCODE_API_KEY secret is not set/);
  assert.equal(r.env, null);
});

test("pr-review.yml: .git leaves the checkout for OpenCode, the server still reads it, and it comes back", (t) => {
  const dir = tempDir(t);
  const temp = path.join(dir, "runner-temp");
  fs.mkdirSync(temp);
  const work = path.join(dir, "checkout");
  fs.mkdirSync(work);
  const git = (args, opts = {}) => {
    const r = spawnSync("git", args, { cwd: work, encoding: "utf8", ...opts });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  git(["init", "-q", "-b", "main"]);
  fs.writeFileSync(path.join(work, "a.txt"), "one\n");
  git(["add", "a.txt"]);
  git(["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "one"]);
  const head = git(["rev-parse", "HEAD"]);
  const step = (name) =>
    spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", stepScript(FILE, name)], {
      cwd: work,
      encoding: "utf8",
      env: { PATH: process.env.PATH, HOME: dir, RUNNER_TEMP: temp },
    });

  const moved = step("Move .git out of the checkout for OpenCode");
  assert.equal(moved.status, 0, moved.stdout + moved.stderr);
  assert.ok(!fs.existsSync(path.join(work, ".git")));
  // The server's git calls run in the checkout with GIT_DIR set, as the
  // run step starts it.
  const gitDir = path.join(temp, "checkout-git");
  const env = { PATH: process.env.PATH, HOME: dir, GIT_DIR: gitDir };
  assert.equal(git(["rev-parse", "HEAD"], { env }), head);
  assert.equal(git(["show", "HEAD:a.txt"], { env }), "one");
  assert.equal(git(["status", "--porcelain"], { env }), "");

  const back = step("Put .git back in the checkout");
  assert.equal(back.status, 0, back.stdout + back.stderr);
  assert.ok(fs.existsSync(path.join(work, ".git", "HEAD")));
  assert.ok(!fs.existsSync(gitDir));
  assert.equal(git(["rev-parse", "HEAD"]), head);
  // Nothing moved (a run that stopped before the move): nothing to do.
  const again = step("Put .git back in the checkout");
  assert.equal(again.status, 0, again.stdout + again.stderr);
  assert.ok(fs.existsSync(path.join(work, ".git", "HEAD")));
});

test("pr-review.yml, Run the review on OpenCode: a run Go turns away as at capacity carries on in the same session", (t) => {
  const refused = {
    type: "error",
    sessionID: "ses_1",
    error: { name: "APIError", data: { message: "Upstream request failed: [ttft_admission_refused] the cell is at capacity; retry shortly (after 12 s)" } },
  };
  const first = [{ type: "step_start", sessionID: "ses_1", part: {} }, refused];
  const r = run(t, { runs: [{ events: first, exit: 1 }, { events: SUCCESS.map((e) => ({ sessionID: "ses_1", ...e })) }], effort: "high" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.calls.length, 2);
  assert.deepEqual(r.calls[1].args.slice(0, 9), ["run", "--print-logs", "--format", "json", "-m", "opencode-go/deepseek-v4.1-flash", "--variant", "high", "--session"]);
  assert.equal(r.calls[1].args[9], "ses_1");
  assert.match(r.calls[1].args[10], /^OpenCode Go turned your last request away because it was at capacity/);
  assert.deepEqual(r.calls[1].config.agent, { build: { steps: 119 } });
  assert.deepEqual(r.slept, ["12"]);
  assert.match(r.stdout, /^errors: $/m);

  // The same loop as triage's, on the review's settings, and the same
  // summary and error output after it, to the end of the step.
  const loop = (file, kind) => {
    const script = stepScript(file, kind === "REVIEW" ? "Run the review on OpenCode" : "Run the triage on OpenCode");
    return script
      .slice(script.indexOf("# Go turns a request away"))
      .replaceAll(`KIT_${kind}_`, "KIT_X_")
      .replace("# pull request steered could", "# issue steered could");
  };
  assert.ok(loop(FILE, "REVIEW").length > 3000);
  assert.match(loop(FILE, "REVIEW"), /OpenCode's run reached the turn limit/);
  assert.equal(loop(FILE, "REVIEW"), loop("issue-triage.yml", "TRIAGE"));
});

test("pr-review.yml, Run the review on OpenCode: a run that ends in error shows OpenCode's log, with commands stopped", (t) => {
  const r = run(t, { events: [{ type: "step_start", part: {} }, { type: "step_finish", part: { reason: "length" } }] });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const lines = r.stdout.split("\n");
  const at = lines.indexOf("OpenCode's log (its stderr), the last 50 lines:");
  assert.notEqual(at, -1, r.stdout);
  const begin = lines[at - 1].match(/^::stop-commands::([0-9a-f]{32})$/);
  assert.ok(begin, r.stdout);
  // The log line --print-logs gave, ended so the token has a line of its own.
  assert.equal(lines[at + 1], LOG_LINE);
  assert.equal(lines[at + 2], `::${begin[1]}::`);
  assert.match(lines[at + 3], /^::error::OpenCode's run ended in error/);
});

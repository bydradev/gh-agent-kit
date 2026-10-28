// security-scan's OpenCode runner (KIT_SECURITY_RUNNER=opencode, the default
// on OpenCode Go): the settings step's runner checks, which steps run on
// each runner, and "Run the scan on OpenCode" and "Verify the candidate
// findings on OpenCode" read from the workflow and run with bash against a
// stub OpenCode CLI. The stub lists its models, serves the two routes the
// steps call on a loopback port behind the password it is given, recording
// each request, and exports the session it was told to.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { MODELS, readEnv } from "./helpers/opencode.mjs";
import { root, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const FILE = "security-scan.yml";
const workflow = () => fs.readFileSync(path.join(root, ".github/workflows", FILE), "utf8");

function settings(t, env) {
  const dir = tempDir(t);
  const envFile = path.join(dir, "github-env");
  fs.writeFileSync(envFile, "");
  const r = runStep(dir, stepScript(FILE, "Read the scan settings"), { GITHUB_ENV: envFile, ...env });
  return { ...r, env: readEnv(envFile) };
}

test("security-scan.yml: the runner follows the provider unless set, and opencode needs the Go provider", (t) => {
  const unset = settings(t, {});
  assert.equal(unset.status, 0, unset.stdout);
  assert.equal(unset.env.KIT_SECURITY_RUNNER, "claude-code");
  assert.equal(unset.env.KIT_SECURITY_EFFORT, "xhigh");

  // On Go the scan runs in OpenCode's CLI, with no effort level unless set.
  const go = settings(t, { PROVIDER: "opencode-go" });
  assert.equal(go.status, 0, go.stdout);
  assert.equal(go.env.KIT_SECURITY_RUNNER, "opencode");
  assert.equal(go.env.KIT_SECURITY_MODEL, "deepseek-v4.1-flash");
  assert.equal(go.env.KIT_SECURITY_EFFORT, "");
  assert.doesNotMatch(go.stdout, /::warning::/);

  const named = settings(t, { PROVIDER: "opencode-go", RUNNER: "opencode", EFFORT: "max" });
  assert.equal(named.status, 0, named.stdout);
  assert.equal(named.env.KIT_SECURITY_EFFORT, "max");

  const claudeOnGo = settings(t, { PROVIDER: "opencode-go", RUNNER: "claude-code" });
  assert.equal(claudeOnGo.status, 0, claudeOnGo.stdout);
  assert.equal(claudeOnGo.env.KIT_SECURITY_RUNNER, "claude-code");
  assert.match(
    claudeOnGo.stdout,
    /^::warning::the setting KIT_SECURITY_RUNNER is claude-code on OpenCode Go, where Claude Code runs Go's models slower than OpenCode's CLI; the kit recommends leaving it unset \(unset\)$/m,
  );

  for (const [env, message] of [
    [{ RUNNER: "codex" }, /KIT_SECURITY_RUNNER must be claude-code, opencode or unset, not 'codex' \(unset\)/],
    [{ RUNNER: "opencode" }, /KIT_SECURITY_RUNNER is opencode, which needs KIT_SECURITY_PROVIDER set to opencode-go, not 'unset'/],
    [{ PROVIDER: "anthropic", RUNNER: "opencode" }, /needs KIT_SECURITY_PROVIDER set to opencode-go, not 'anthropic'/],
    // The runner is checked first, so a Go model id does not read as a
    // bad Claude model name.
    [{ RUNNER: "opencode", MODEL: "glm-5.3-flash" }, /KIT_SECURITY_RUNNER is opencode, which needs KIT_SECURITY_PROVIDER set to opencode-go/],
  ]) {
    const bad = settings(t, env);
    assert.equal(bad.status, 1, JSON.stringify(env));
    assert.match(bad.stdout, message);
    assert.equal(bad.env.KIT_SECURITY_RUNNER, undefined, JSON.stringify(env));
  }
});

test("security-scan.yml: the settings job passes the runner to the scan job", () => {
  const text = workflow();
  assert.match(text, /^ {8}KIT_SECURITY_RUNNER$/m);
  assert.match(text, /^ {6}KIT_SECURITY_RUNNER: \$\{\{ steps\.pass\.outputs\.KIT_SECURITY_RUNNER \}\}$/m);
  assert.match(text, /^ {6}KIT_SECURITY_RUNNER: \$\{\{ needs\.settings\.outputs\.KIT_SECURITY_RUNNER \}\}$/m);
  assert.match(text, /^ {10}RUNNER: \$\{\{ env\.KIT_SECURITY_RUNNER \}\}$/m);
});

// Each step's if: as written in the workflow, by name or by id.
function stepIf(name) {
  const lines = workflow().split("\n");
  const start = lines.findIndex((l) => l.trim() === `- name: ${name}` || l.trim() === `- id: ${name}`);
  assert.notEqual(start, -1, name);
  const line = lines.slice(start + 1, start + 3).find((l) => l.trim().startsWith("if: "));
  assert.ok(line, name);
  return line.trim().slice(4);
}

test("security-scan.yml: each runner installs and runs only its own CLI, and .git comes back", () => {
  const notOpencode = "env.RUN != 'false' && env.KIT_SECURITY_RUNNER != 'opencode'";
  const opencode = "env.RUN != 'false' && env.KIT_SECURITY_RUNNER == 'opencode'";
  const candidates = " && env.CANDIDATES != '' && env.CANDIDATES != '0'";
  assert.equal(stepIf("Install subprocess isolation dependencies"), notOpencode);
  assert.equal(stepIf("Install Claude Code"), notOpencode);
  assert.equal(stepIf("Remove the checkout's OpenCode configuration"), opencode);
  assert.equal(stepIf("Install OpenCode"), opencode);
  assert.equal(stepIf("Move .git out of the checkout for OpenCode"), opencode);
  assert.equal(stepIf("scan"), "env.RUN != 'false' && env.KIT_SECURITY_RUNNER == 'claude-code'");
  assert.equal(stepIf("scan_opencode"), opencode);
  assert.equal(stepIf("verify"), "env.RUN != 'false' && env.KIT_SECURITY_RUNNER == 'claude-code'" + candidates);
  assert.equal(stepIf("verify_opencode"), opencode + candidates);
  assert.equal(stepIf("Put .git back in the checkout"), "always() && env.KIT_SECURITY_RUNNER == 'opencode'");
  // The summary runs after either runner's scan.
  assert.equal(
    stepIf("Summarise the scan's findings"),
    "${{ always() && env.RUN != 'false' && (steps.scan.outcome != 'skipped' || steps.scan_opencode.outcome != 'skipped') }}",
  );

  // In order: the inputs are written from .git, the configuration goes
  // before OpenCode first runs, and .git is back before the steps that
  // read it (the record reads the base's commit).
  const text = workflow();
  const at = (name) => {
    const i = text.search(new RegExp(`- (name|id): ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n`));
    assert.notEqual(i, -1, name);
    return i;
  };
  const order = [
    "Write the scan's inputs and the model's settings",
    "Remove the checkout's OpenCode configuration",
    "Install OpenCode",
    "Move .git out of the checkout for OpenCode",
    "scan_opencode",
    "verify_opencode",
    "Put .git back in the checkout",
    "Apply the verification",
    "Record the completed scan",
  ];
  for (let i = 1; i < order.length; i++) assert.ok(at(order[i - 1]) < at(order[i]), `${order[i - 1]} before ${order[i]}`);
  // No step between the move and the return calls git.
  const between = text.slice(at("Move .git out of the checkout for OpenCode"), at("Put .git back in the checkout"));
  const scripts = between.split(/\n {6}- /).slice(1);
  for (const step of scripts) assert.doesNotMatch(step.replace(/^\s*#.*$/gm, ""), /\bgit (?!back)/, step.split("\n")[0]);
});

test("security-scan.yml: the OpenCode install is the release the review and triage pin", () => {
  const pin = (file) => {
    const text = fs.readFileSync(path.join(root, ".github/workflows", file), "utf8");
    const at = text.indexOf("- name: Install OpenCode");
    assert.notEqual(at, -1, file);
    const step = text.slice(at, text.indexOf("run: |", at));
    return [step.match(/VERSION: (\S+)/)[1], step.match(/SHA256: (\S+)/)[1]];
  };
  assert.deepEqual(pin(FILE), pin("pr-review.yml"));
  assert.deepEqual(pin(FILE), pin("issue-triage.yml"));
  const script = stepScript(FILE, "Install OpenCode");
  assert.ok(script.indexOf("sha256sum -c -") < script.indexOf("sudo install -o root"));
});

const SCAN_SCHEMA = { type: "object", required: ["files_reviewed", "findings"] };
const FINDINGS = { files_reviewed: 2, findings: [] };
// What the prompt adds, for an answer the workflow can check.
const FINISH = ` Your answer is your last message: one JSON object that fits this JSON schema, with no other text. ${JSON.stringify(SCAN_SCHEMA)}`;

// An assistant message as OpenCode stores it: one step, its cost and
// tokens, and the parts given.
const message = (parts, { cost = 0.01, tokens = {} } = {}) => ({
  info: {
    role: "assistant",
    cost,
    tokens: { input: 10, output: 2, reasoning: 3, cache: { read: 100, write: 1 }, ...tokens },
  },
  parts: [{ type: "step-start" }, ...parts],
});
// The run's two steps, the last one the answer.
const SESSION = {
  info: { id: "ses_1" },
  messages: [
    { info: { role: "user" }, parts: [{ type: "text", text: "Read the skill." }] },
    message([{ type: "tool", tool: "read" }]),
    message([{ type: "text", text: JSON.stringify(FINDINGS) }], { cost: 0.02 }),
  ],
};
// What the message route returns: the run's last message, with the given
// text.
const reply = (text) => ({ status: 200, body: { info: { role: "assistant", finish: "stop" }, parts: [{ type: "text", text }] } });
const ANSWER = reply(JSON.stringify(FINDINGS));
const PROSE = reply("No findings.");

// The step with the CLI replaced by a stub server. `answer` is what the
// message route returns (`status`, JSON `body`), or a list of them served
// in turn (the last one again once they run out); `session` is what export
// prints (null fails the export); `models` is the model list (null fails
// the listing).
function scan(
  t,
  {
    step = "Run the scan on OpenCode",
    answer = ANSWER,
    session = SESSION,
    key = "ok",
    model = "deepseek-v4.1-flash",
    effort = "",
    maxTurns = "80",
    candidates = "",
    models = MODELS,
  } = {},
) {
  const dir = tempDir(t);
  const temp = path.join(dir, "runner-temp");
  const input = path.join(temp, "scan-input");
  fs.mkdirSync(input, { recursive: true });
  const schema = path.join(temp, "scan-schema.json");
  fs.writeFileSync(schema, JSON.stringify(SCAN_SCHEMA));
  const spec = path.join(dir, "spec.json");
  fs.writeFileSync(spec, JSON.stringify({ models, answer, session }));
  const log = path.join(dir, "calls.jsonl");
  const stub = path.join(dir, "opencode");
  fs.writeFileSync(
    stub,
    `#!/usr/bin/env node
const fs = require("node:fs");
const http = require("node:http");
const spec = JSON.parse(fs.readFileSync(${JSON.stringify(spec)}, "utf8"));
const record = (entry) => fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(entry) + "\\n");
const answers = [spec.answer].flat();
let asked = 0;
const [command, ...rest] = process.argv.slice(2);
record({ command, args: rest, env: process.env, pid: process.pid });
if (command === "models") {
  if (spec.models === null) {
    process.stderr.write("Error: no provider\\n");
    process.exit(1);
  }
  process.stdout.write(spec.models);
} else if (command === "export") {
  if (spec.session === null) process.exit(1);
  process.stdout.write(JSON.stringify(spec.session, null, 2));
} else if (command === "serve") {
  const auth = "Basic " + Buffer.from("opencode:" + process.env.OPENCODE_SERVER_PASSWORD).toString("base64");
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      record({ request: req.method + " " + req.url, authorised: req.headers.authorization === auth, body: body ? JSON.parse(body) : null });
      const send = (status, value) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(value));
      };
      if (req.headers.authorization !== auth) return send(401, { name: "Unauthorized" });
      if (req.method === "POST" && req.url === "/session") return send(200, { id: "ses_1" });
      if (req.method === "POST" && req.url === "/session/ses_1/message") {
        const answer = answers[Math.min(asked++, answers.length - 1)];
        return send(answer.status, answer.body);
      }
      send(404, { name: "NotFound" });
    });
  });
  server.listen(0, rest[rest.indexOf("--hostname") + 1], () => {
    console.log("opencode server listening on http://127.0.0.1:" + server.address().port);
  });
} else {
  process.exit(2);
}
`,
    { mode: 0o755 },
  );
  const script = stepScript(FILE, step).replaceAll("/opt/agent-kit/opencode", stub);
  const result = path.join(temp, "result.json");
  const r = runStep(dir, script, {
    RUNNER_TEMP: temp,
    SCAN_INPUT: input,
    OPENCODE_API_KEY: key,
    REPO: "acme/widgets",
    PR: "7",
    SCHEMA: schema,
    RESULT: result,
    KIT_SECURITY_MODEL: model,
    KIT_SECURITY_EFFORT: effort,
    KIT_SECURITY_MAX_TURNS: maxTurns,
    CANDIDATES: candidates,
    GH_TOKEN: "job-token",
  });
  const calls = fs.existsSync(log)
    ? fs.readFileSync(log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
    : [];
  const serve = calls.find((c) => c.command === "serve");
  // The server must be gone once the step has ended.
  const alive = serve ? spawnSync("kill", ["-0", String(serve.pid)]).status === 0 : false;
  if (alive) process.kill(serve.pid);
  return {
    ...r,
    calls,
    serve,
    alive,
    requests: calls.filter((c) => c.request),
    messages: calls.filter((c) => c.request === "POST /session/ses_1/message").map((c) => c.body),
    result: fs.existsSync(result) ? JSON.parse(fs.readFileSync(result, "utf8")) : null,
    input,
    temp,
  };
}

test("security-scan.yml, Run the scan on OpenCode: the answer comes back in Claude Code's result shape", (t) => {
  const r = scan(t);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(r.result, {
    type: "result",
    subtype: "success",
    is_error: false,
    num_turns: 2,
    total_cost_usd: 0.03,
    usage: {
      input_tokens: 20,
      cache_read_input_tokens: 200,
      cache_creation_input_tokens: 2,
      output_tokens: 4,
      reasoning_tokens: 6,
    },
    errors: [],
    result: JSON.stringify(FINDINGS),
    structured_output: FINDINGS,
  });
  assert.match(r.stdout, /^turns: 2$/m);
  assert.match(r.stdout, /^cost_usd \(Go prices\): 0\.03$/m);
  assert.match(r.stdout, /^tokens: input 20, cache read 200, cache write 2, output 4, reasoning 6$/m);
  assert.match(r.stdout, /^variant: none, so the model default applies$/m);
  // The model's text is printed with workflow commands stopped.
  assert.match(r.stdout, /^::stop-commands::[0-9a-f]{32}\n[\s\S]*^result: \{"files_reviewed":2,"findings":\[\]\}\n::[0-9a-f]{32}::$/m);
  // The server is stopped before the export, and gone afterwards.
  assert.equal(r.alive, false);
  const commands = r.calls.filter((c) => c.command).map((c) => c.command);
  assert.deepEqual(commands, ["models", "serve", "export"]);
  assert.deepEqual(r.calls.find((c) => c.command === "export").args, ["ses_1"]);
});

test("security-scan.yml, Run the scan on OpenCode: the server is local, behind a password, and the prompt carries the schema", (t) => {
  const r = scan(t, { effort: "high" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(r.serve.args, ["--hostname", "127.0.0.1", "--port", "0"]);
  assert.match(r.serve.env.OPENCODE_SERVER_PASSWORD, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(r.serve.env.OPENCODE_SERVER_PASSWORD));
  assert.deepEqual(
    r.requests.map((q) => [q.request, q.authorised]),
    [
      ["POST /session", true],
      ["POST /session/ses_1/message", true],
    ],
  );
  // No json_schema format, so OpenCode forces no tool call; the schema is
  // in the prompt instead.
  const [run] = r.messages;
  assert.deepEqual(Object.keys(run).sort(), ["model", "parts", "variant"]);
  assert.deepEqual(run.model, { providerID: "opencode-go", modelID: "deepseek-v4.1-flash" });
  assert.equal(run.variant, "high");
  assert.equal(run.parts.length, 1);
  assert.equal(
    run.parts[0].text,
    `Read .agents/skills/github-security-scan/SKILL.md and follow it. This is the scan of acme/widgets pull request 7. The input directory is ${r.input}: files.txt lists the changed files and diff.patch is the diff. The scan runs in OpenCode's CLI.` +
      FINISH,
  );
  // Unset, no variant is sent at all.
  assert.equal(scan(t).messages[0].variant, undefined);
});

test("security-scan.yml, Run the scan on OpenCode: the CLI is isolated and may only read", (t) => {
  const r = scan(t);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const home = path.join(r.temp, "opencode-home");
  for (const call of r.calls.filter((c) => c.command)) {
    const env = call.env;
    assert.equal(env.HOME, home, call.command);
    for (const name of ["XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME", "XDG_STATE_HOME"]) {
      assert.ok(env[name].startsWith(home + "/"), `${call.command} ${name}`);
    }
    for (const name of [
      "OPENCODE_DISABLE_PROJECT_CONFIG",
      "OPENCODE_PURE",
      "OPENCODE_DISABLE_CLAUDE_CODE",
      "OPENCODE_DISABLE_EXTERNAL_SKILLS",
      "OPENCODE_DISABLE_AUTOUPDATE",
      "OPENCODE_DISABLE_LSP_DOWNLOAD",
      "OPENCODE_DISABLE_MODELS_FETCH",
    ]) {
      assert.equal(env[name], "1", `${call.command} ${name}`);
    }
    assert.equal(env.GH_TOKEN, "", call.command);
    assert.equal(env.GITHUB_TOKEN, "", call.command);
  }
  const config = JSON.parse(r.serve.env.OPENCODE_CONFIG_CONTENT);
  assert.equal(config.model, "opencode-go/deepseek-v4.1-flash");
  assert.equal(config.small_model, "opencode-go/deepseek-v4.1-flash");
  assert.deepEqual(config.agent, { build: { steps: 80 } });
  assert.equal(config.mcp, undefined);
  assert.equal(config.provider["opencode-go"].options.apiKey, "{env:OPENCODE_API_KEY}");
  assert.equal(r.serve.env.OPENCODE_API_KEY, "ok");
  assert.doesNotMatch(r.serve.env.OPENCODE_CONFIG_CONTENT, /"ok"/);
  const permission = config.permission;
  assert.equal(Object.keys(permission)[0], "*");
  assert.equal(permission["*"], "deny");
  assert.deepEqual(permission.external_directory, { "*": "deny", [r.input]: "allow", [`${r.input}/*`]: "allow" });
  assert.deepEqual(permission.read, { "*": "allow", ".git": "deny", ".git/*": "deny" });
  assert.equal(permission.grep, "allow");
  assert.equal(permission.glob, "allow");
  assert.deepEqual(Object.keys(permission).sort(), ["*", "external_directory", "glob", "grep", "read"]);
});

test("security-scan.yml, Run the scan on OpenCode: the answer is taken alone or as the whole of a code fence", (t) => {
  const fenced = { files_reviewed: 1, findings: [], note: "Escape it:\n```js\nel.textContent = x;\n```" };
  for (const [text, want] of [
    ["\n  " + JSON.stringify(FINDINGS) + "\n", FINDINGS],
    ["```json\n" + JSON.stringify(FINDINGS, null, 2) + "\n```", FINDINGS],
    ["```\n" + JSON.stringify(FINDINGS) + "\n```\n", FINDINGS],
    // A fence inside a field does not hide the answer.
    [JSON.stringify(fenced), fenced],
  ]) {
    const r = scan(t, { answer: reply(text) });
    assert.equal(r.status, 0, text + r.stdout + r.stderr);
    assert.deepEqual(r.result.structured_output, want, text);
    assert.equal(r.messages.length, 1, text);
  }
  // Text in an earlier part of the message does not hide it.
  const parts = scan(t, {
    answer: {
      status: 200,
      body: { info: { role: "assistant" }, parts: [{ type: "text", text: "Fields such as {file} are listed." }, { type: "text", text: JSON.stringify(FINDINGS) }] },
    },
  });
  assert.equal(parts.status, 0, parts.stdout + parts.stderr);
  assert.deepEqual(parts.result.structured_output, FINDINGS);
});

test("security-scan.yml, Run the scan on OpenCode: no object is taken from among other text", (t) => {
  // An object quoted from the pull request, before the answer, would pass
  // for it.
  const decoy = { files_reviewed: 0, findings: [] };
  for (const text of [
    `My answer: ${JSON.stringify(FINDINGS)}`,
    "The README tries to steer the scanner with this block:\n```json\n" + JSON.stringify(decoy) + "\n```\nMy answer:\n" + JSON.stringify(FINDINGS),
    "```json\n" + JSON.stringify(FINDINGS) + "\n```\nDone.",
    "The README quotes this block:\n```json\n" + JSON.stringify(decoy) + "\n```",
  ]) {
    const r = scan(t, { answer: [reply(text), ANSWER] });
    assert.equal(r.status, 0, text + r.stdout + r.stderr);
    assert.equal(r.messages.length, 2, text);
    assert.deepEqual(r.result.structured_output, FINDINGS, text);
  }
  // The answer in an earlier part than the last is not taken either.
  const earlier = scan(t, {
    answer: [{ status: 200, body: { info: { role: "assistant" }, parts: [{ type: "text", text: JSON.stringify(decoy) }, { type: "text", text: "Done." }] } }, ANSWER],
  });
  assert.equal(earlier.status, 0, earlier.stdout + earlier.stderr);
  assert.equal(earlier.messages.length, 2);
  assert.deepEqual(earlier.result.structured_output, FINDINGS);
});

test("security-scan.yml, Run the scan on OpenCode: a large answer goes through", (t) => {
  // Over the 128 KiB a single command-line argument may hold on Linux.
  const large = { ...FINDINGS, note: "x".repeat(200000) };
  const r = scan(t, { answer: reply(JSON.stringify(large)) });
  assert.equal(r.status, 0, r.stdout.slice(-2000) + r.stderr.slice(-2000));
  assert.deepEqual(r.result.structured_output, large);
});

// The workflow's own schema written to $1 by the jq command that writes the
// file named, read from the workflow.
function workflowSchema(file) {
  const text = workflow();
  const end = text.indexOf(`> "$RUNNER_TEMP/${file}"`);
  assert.notEqual(end, -1, file);
  const start = text.lastIndexOf("jq -cn '{", end);
  const r = spawnSync("bash", ["-c", text.slice(start, end)], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test("security-scan.yml, Run the scan on OpenCode: the answer is checked against every keyword of the scan's and the verification's schemas", (t) => {
  const script = stepScript(FILE, "Run the scan on OpenCode");
  const fn = script.slice(script.indexOf("read_answer() {"), script.indexOf("\n}\n", script.indexOf("read_answer() {")) + 3);
  const dir = tempDir(t);
  // The function's output for an answer whose text is each of texts.
  const read = (schema, texts) => {
    fs.writeFileSync(path.join(dir, "schema.json"), JSON.stringify(schema));
    return texts.map((text) => {
      fs.writeFileSync(path.join(dir, "opencode-answer.json"), JSON.stringify({ parts: [{ type: "text", text: JSON.stringify(text) }] }));
      const r = spawnSync("bash", ["-c", `${fn}\nread_answer`], {
        encoding: "utf8",
        env: { PATH: process.env.PATH, SCHEMA: path.join(dir, "schema.json"), RUNNER_TEMP: dir },
      });
      assert.equal(r.status, 0, r.stderr);
      return r.stdout === "" ? null : JSON.parse(r.stdout);
    });
  };
  const finding = {
    file: "a.yml",
    line: 3,
    severity: "HIGH",
    category: "injection",
    description: "d",
    exploit_scenario: "e",
    recommendation: "r",
    confidence: 0.8,
  };
  const with_ = (change) => ({ files_reviewed: 1, findings: [{ ...finding, ...change }] });
  const without = (key) => ({ files_reviewed: 1, findings: [Object.fromEntries(Object.entries(finding).filter(([k]) => k !== key))] });
  const fits = [{ files_reviewed: 0, findings: [] }, with_({}), with_({ line: 3.0, confidence: 0 }), with_({ confidence: 1 })];
  const misfits = [
    {},
    { files_reviewed: 1 },
    { files_reviewed: -1, findings: [] },
    { files_reviewed: 1.5, findings: [] },
    { files_reviewed: "1", findings: [] },
    { files_reviewed: 1, findings: [], note: "extra" },
    { files_reviewed: 1, findings: Array(51).fill(finding) },
    with_({ severity: "CRITICAL" }),
    with_({ line: 0 }),
    with_({ line: 2.5 }),
    with_({ confidence: 1.5 }),
    with_({ description: 7 }),
    with_({ extra: true }),
    without("recommendation"),
    [],
    "text",
  ];
  const scanSchema = workflowSchema("scan-schema.json");
  assert.deepEqual(read(scanSchema, fits), fits);
  assert.deepEqual(read(scanSchema, misfits), misfits.map(() => null));

  const verdict = { id: "F1", keep: true, confidence: 8, reason: "r" };
  const verdicts = (change) => ({ verdicts: [{ ...verdict, ...change }] });
  const verifySchema = workflowSchema("verify-schema.json");
  assert.deepEqual(read(verifySchema, [verdicts({}), { verdicts: [] }, verdicts({ confidence: 1 })]), [verdicts({}), { verdicts: [] }, verdicts({ confidence: 1 })]);
  assert.deepEqual(
    read(verifySchema, [verdicts({ keep: "yes" }), verdicts({ confidence: 0 }), verdicts({ confidence: 11 }), verdicts({ confidence: 7.5 }), { verdicts: [{ id: "F1" }] }]),
    [null, null, null, null, null],
  );
});

test("security-scan.yml, Run the scan on OpenCode: an answer that is not JSON or does not fit the schema is asked for again", (t) => {
  for (const miss of [PROSE, reply(JSON.stringify({ files_reviewed: 2 })), reply("[]")]) {
    const r = scan(t, { answer: [miss, ANSWER], effort: "high" });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(r.result.structured_output, FINDINGS);
    assert.equal(r.result.subtype, "success");
    assert.match(r.stdout, /^::warning::OpenCode's last message was not a JSON object that fits the schema, so the answer is asked for again$/m);
    assert.equal(r.messages.length, 2);
    // The same session, model and variant; only the text differs.
    const [first, second] = r.messages;
    assert.deepEqual({ ...second, parts: null }, { ...first, parts: null });
    assert.match(second.parts[0].text, /^That last message was not one JSON object that fits the schema, so the workflow has no answer\. Reply now with only that JSON object/);
    assert.equal(r.requests.filter((q) => q.request === "POST /session").length, 1);
    assert.equal(r.alive, false);
  }

  // Twice at most.
  const misses = scan(t, { answer: [PROSE, PROSE, PROSE, ANSWER] });
  assert.equal(misses.status, 1, misses.stdout + misses.stderr);
  assert.match(misses.stdout, /^errors: no JSON answer that fits the schema$/m);
  assert.match(misses.stdout, /^::error::OpenCode's run ended in error or without an answer that fits the schema \(curl status 0\)$/m);
  assert.equal(misses.result.structured_output, null);
  assert.equal(misses.messages.length, 3);
  assert.equal(misses.alive, false);
});

test("security-scan.yml, Run the scan on OpenCode: errors are not asked again", (t) => {
  for (const answer of [
    { status: 200, body: { info: { role: "assistant", error: { name: "APIError", data: { message: "Upstream request failed" } } }, parts: [] } },
    { status: 500, body: { name: "UnknownError" } },
    { status: 200, body: {} },
  ]) {
    const r = scan(t, { answer: [answer, ANSWER] });
    assert.equal(r.status, 1, JSON.stringify(answer) + r.stdout);
    assert.equal(r.messages.length, 1, JSON.stringify(answer));
    assert.equal(r.result.structured_output, null, JSON.stringify(answer));
    assert.equal(r.alive, false, JSON.stringify(answer));
  }
  // An error after a miss ends the asking too.
  const after = scan(t, { answer: [PROSE, { status: 500, body: { name: "UnknownError" } }, ANSWER] });
  assert.equal(after.status, 1, after.stdout);
  assert.equal(after.messages.length, 2);
});

test("security-scan.yml, Run the scan on OpenCode: the step limit counts the run's steps, not the asking again", (t) => {
  const session = {
    ...SESSION,
    messages: [
      ...SESSION.messages.slice(0, 2),
      message([{ type: "text", text: "No findings." }]),
      { info: { role: "user" }, parts: [{ type: "text", text: "That last message was not one JSON object." }] },
      message([{ type: "text", text: JSON.stringify(FINDINGS) }]),
    ],
  };
  const r = scan(t, { answer: [PROSE, ANSWER], session, maxTurns: "3" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.result.num_turns, 3);
  const limit = scan(t, { answer: [PROSE, ANSWER], session, maxTurns: "2" });
  assert.equal(limit.status, 1, limit.stdout + limit.stderr);
  assert.match(limit.stdout, /^::error::OpenCode's run reached the turn limit \(KIT_SECURITY_MAX_TURNS=2\)$/m);
});

test("security-scan.yml, Run the scan on OpenCode: no answer, an error or the turn limit fails the step", (t) => {
  for (const [opts, message] of [
    [{ answer: { status: 200, body: { info: { role: "assistant", finish: "stop" } } } }, /^errors: no JSON answer that fits the schema$/m],
    [
      { answer: { status: 200, body: { info: { role: "assistant", error: { name: "APIError", data: { message: "Upstream request failed" } } } } } },
      /^errors: Upstream request failed$/m,
    ],
    // The server's own error, with curl's status.
    [{ answer: { status: 400, body: { name: "BadRequest", data: { message: "Expected model" } } } }, /^errors: Expected model$/m],
    [{ answer: { status: 500, body: { name: "UnknownError" } } }, /without an answer that fits the schema \(curl status 22\)/],
    [{ maxTurns: "2" }, /reached the turn limit \(KIT_SECURITY_MAX_TURNS=2\)/],
  ]) {
    const r = scan(t, opts);
    assert.equal(r.status, 1, JSON.stringify(opts) + r.stdout + r.stderr);
    assert.match(r.stdout, message, JSON.stringify(opts));
    assert.equal(r.alive, false, JSON.stringify(opts));
  }
  // A session that cannot be exported leaves the counts out, with a
  // warning, but not the answer.
  const unexported = scan(t, { session: null });
  assert.equal(unexported.status, 0, unexported.stdout + unexported.stderr);
  assert.match(unexported.stdout, /^::warning::OpenCode did not export the session/m);
  assert.equal(unexported.result.num_turns, 0);
  assert.deepEqual(unexported.result.structured_output, FINDINGS);
});

test("security-scan.yml, Run the scan on OpenCode: the model and effort are checked before the server starts", (t) => {
  for (const [opts, message] of [
    [{ key: "" }, /KIT_SECURITY_RUNNER is opencode but the OPENCODE_API_KEY secret is not set/],
    [{ model: "minimax-m3.1-flash" }, /KIT_SECURITY_MODEL is 'minimax-m3\.1-flash', which the pinned OpenCode does not list/],
    [{ effort: "xhigh" }, /KIT_SECURITY_EFFORT is 'xhigh', which OpenCode does not offer for deepseek-v4\.1-flash; it offers high, low, max/],
    [{ models: null }, /^::error::OpenCode could not list its models \(exit status 1\), so KIT_SECURITY_MODEL could not be checked$/m],
  ]) {
    const r = scan(t, opts);
    assert.equal(r.status, 1, JSON.stringify(opts) + r.stdout + r.stderr);
    assert.match(r.stdout, message, JSON.stringify(opts));
    assert.equal(r.serve, undefined, JSON.stringify(opts));
  }
  // A failed listing shows what the CLI printed.
  assert.match(scan(t, { models: null }).stderr, /Error: no provider/);
});

test("security-scan.yml, Verify the candidate findings on OpenCode: the same run with the verification's prompt", (t) => {
  const r = scan(t, { step: "Verify the candidate findings on OpenCode", candidates: "3" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(
    r.messages[0].parts[0].text,
    `Read .agents/skills/github-security-scan/SKILL.md and follow it. This is the verification of the scan of acme/widgets pull request 7. The input directory is ${r.input}: candidates.json holds the 3 candidate findings, files.txt lists the changed files and diff.patch is the diff. The verification runs in OpenCode's CLI.` +
      FINISH,
  );
  assert.equal(r.result.subtype, "success");
  assert.equal(r.alive, false);
  // Both steps run the same script after their prompt.
  const body = (name) => stepScript(FILE, name).split("\n").slice(1).join("\n");
  assert.equal(body("Run the scan on OpenCode"), body("Verify the candidate findings on OpenCode"));
});

test("security-scan.yml: both runners get the same prompts, and OpenCode's say where they run", () => {
  const prompt = (name) => stepScript(FILE, name).split("\n")[0];
  assert.equal(prompt("Run the scan on OpenCode"), prompt("Run the scan").slice(0, -1) + ' The scan runs in OpenCode\'s CLI."');
  assert.equal(
    prompt("Verify the candidate findings on OpenCode"),
    prompt("Verify the candidate findings").slice(0, -1) + ' The verification runs in OpenCode\'s CLI."',
  );
});

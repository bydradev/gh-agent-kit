// The model provider switch in pr-review, security-scan and issue-triage:
// the settings steps' KIT_REVIEW_PROVIDER, KIT_SECURITY_PROVIDER and
// KIT_TRIAGE_PROVIDER, and the environment
// each Claude Code run step gives the CLI, read from the workflow files and
// run with bash against a stub CLI that records its environment.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { root, tempDir } from "./helpers/server.mjs";
import { runStep, stepScript } from "./helpers/workflow.mjs";

const JOBS = [
  {
    file: "pr-review.yml",
    settings: "Read the review settings",
    runs: ["Run the review"],
    provider: "KIT_REVIEW_PROVIDER",
    model: "KIT_REVIEW_MODEL",
    effort: "KIT_REVIEW_EFFORT",
    claudeDefault: "claude-opus-5-5",
    goDefault: "deepseek-v4.1-flash",
    claudeEffort: "",
  },
  {
    file: "security-scan.yml",
    settings: "Read the scan settings",
    runs: ["Run the scan", "Verify the candidate findings"],
    provider: "KIT_SECURITY_PROVIDER",
    model: "KIT_SECURITY_MODEL",
    effort: "KIT_SECURITY_EFFORT",
    claudeDefault: "claude-opus-5-5",
    goDefault: "deepseek-v4.1-flash",
    // The scan defaults to xhigh on the Anthropic API only: on Go no level
    // had a reliable effect on the default model, so there it passes none.
    claudeEffort: "xhigh",
  },
  {
    file: "issue-triage.yml",
    settings: "Read the triage settings",
    runs: ["Run the triage"],
    provider: "KIT_TRIAGE_PROVIDER",
    model: "KIT_TRIAGE_MODEL",
    effort: "KIT_TRIAGE_EFFORT",
    claudeDefault: "claude-sonnet-5-5",
    // The one Go model backtested for triage (2026-10-25).
    goDefault: "deepseek-v4.1-flash",
    claudeEffort: "",
  },
];

function settings(t, job, env) {
  const dir = tempDir(t);
  const envFile = path.join(dir, "github-env");
  fs.writeFileSync(envFile, "");
  const r = runStep(dir, stepScript(job.file, job.settings), { GITHUB_ENV: envFile, ...env });
  const written = Object.fromEntries(
    fs
      .readFileSync(envFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split(/=(.*)/s).slice(0, 2)),
  );
  return { ...r, env: written };
}

for (const job of JOBS) {
  test(`${job.file}: the provider sets which model names the settings step takes`, (t) => {
    const unset = settings(t, job, {});
    assert.equal(unset.status, 0, unset.stdout);
    assert.equal(unset.env[job.provider], "anthropic");
    assert.equal(unset.env[job.model], job.claudeDefault);
    assert.equal(unset.env[job.effort], job.claudeEffort);

    const go = settings(t, job, { PROVIDER: "opencode-go" });
    assert.equal(go.status, 0, go.stdout);
    assert.equal(go.env[job.provider], "opencode-go");
    assert.equal(go.env[job.model], job.goDefault);
    assert.equal(go.env[job.effort], "");

    const chosen = settings(t, job, { PROVIDER: "opencode-go", MODEL: "qwen3.8-flash" });
    assert.equal(chosen.env[job.model], "qwen3.8-flash");

    // A level the repository sets wins on either provider.
    for (const provider of ["anthropic", "opencode-go"]) {
      const set = settings(t, job, { PROVIDER: provider, EFFORT: "low" });
      assert.equal(set.status, 0, set.stdout);
      assert.equal(set.env[job.effort], "low", provider);
    }

    for (const [env, message] of [
      [{ PROVIDER: "openai" }, new RegExp(`${job.provider} must be anthropic, opencode-go or unset`)],
      [{ PROVIDER: "anthropic", MODEL: "minimax-m3" }, new RegExp(`${job.model} must be a Claude model name`)],
      [{ PROVIDER: "opencode-go", MODEL: "Bad Model" }, new RegExp(`${job.model} must be an OpenCode Go model id`)],
      [{ PROVIDER: "opencode-go", MODEL: "muse-spark-1.3-contributor" }, /Contributor model, which trains on prompts/],
    ]) {
      const bad = settings(t, job, env);
      assert.equal(bad.status, 1, JSON.stringify(env));
      assert.match(bad.stdout, message);
    }
  });

  // Each run step's env: maps both keys from the repository's secrets; the
  // tests below set them directly, so this is what checks the mapping.
  test(`${job.file}: every run step maps both keys from the secrets`, () => {
    const lines = fs.readFileSync(path.join(root, ".github/workflows", job.file), "utf8").split("\n");
    for (const name of job.runs) {
      const start = lines.findIndex((l) => l.trim() === `- name: ${name}` || l.trim() === `name: ${name}`);
      assert.notEqual(start, -1, name);
      const run = lines.findIndex((l, i) => i > start && /^\s+run: \|$/.test(l));
      const block = lines.slice(start, run).map((l) => l.trim());
      for (const key of ["ANTHROPIC_API_KEY", "OPENCODE_API_KEY"]) {
        assert.ok(block.includes(`${key}: \${{ secrets.${key} }}`), `${name} maps ${key}`);
      }
    }
  });

  for (const name of job.runs) {
    // The run step with the CLI replaced by a stub that writes the
    // variables it was started with and answers like a successful run.
    const run = (t, provider, keys) => {
      const dir = tempDir(t);
      const temp = path.join(dir, "runner-temp");
      fs.mkdirSync(path.join(temp, "scan-input"), { recursive: true });
      for (const f of ["scan-schema.json", "verify-schema.json", "claude-settings.json"]) {
        fs.writeFileSync(path.join(temp, f), "{}");
      }
      const stub = path.join(dir, "claude");
      const seen = path.join(dir, "seen-env");
      const argv = path.join(dir, "seen-args");
      fs.writeFileSync(
        stub,
        `#!/bin/bash
env > "${seen}"
printf '%s\\n' "$@" > "${argv}"
echo '{"type":"result","subtype":"success","is_error":false,"num_turns":2,"total_cost_usd":0.5,"usage":{"input_tokens":11,"cache_read_input_tokens":22,"cache_creation_input_tokens":33,"output_tokens":44},"result":"done"}'
`,
        { mode: 0o755 },
      );
      const script = stepScript(job.file, name).replaceAll("/opt/agent-kit/claude", stub);
      const r = runStep(dir, script, {
        RUNNER_TEMP: temp,
        SCAN_INPUT: path.join(temp, "scan-input"),
        RESULT: path.join(temp, "result.json"),
        CANDIDATES: "1",
        [job.provider]: provider,
        [job.model]: "the-model",
        [job.effort]: "",
        ...keys,
      });
      const env = fs.existsSync(seen)
        ? Object.fromEntries(
            fs
              .readFileSync(seen, "utf8")
              .split("\n")
              .filter(Boolean)
              .map((l) => l.split(/=(.*)/s).slice(0, 2)),
          )
        : null;
      const args = fs.existsSync(argv) ? fs.readFileSync(argv, "utf8").split("\n") : null;
      return { ...r, env, args };
    };

    test(`${job.file}, ${name}: the effort level reaches the CLI, and none when unset`, (t) => {
      const set = run(t, "anthropic", { ANTHROPIC_API_KEY: "ak", [job.effort]: "xhigh" });
      assert.equal(set.status, 0, set.stdout + set.stderr);
      const at = set.args.indexOf("--effort");
      assert.notEqual(at, -1);
      assert.equal(set.args[at + 1], "xhigh");
      const unset = run(t, "anthropic", { ANTHROPIC_API_KEY: "ak" });
      assert.equal(unset.status, 0, unset.stdout + unset.stderr);
      assert.ok(!unset.args.includes("--effort"));
    });

    test(`${job.file}, ${name}: the Anthropic provider passes the Anthropic key only`, (t) => {
      const r = run(t, "anthropic", { ANTHROPIC_API_KEY: "ak", OPENCODE_API_KEY: "ok" });
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.equal(r.env.ANTHROPIC_API_KEY, "ak");
      for (const name of ["OPENCODE_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL"]) {
        assert.equal(r.env[name], undefined, name);
      }
      assert.match(r.stdout, /^cost_usd: 0\.5$/m);
      assert.match(r.stdout, /^tokens: input 11, cache read 22, cache write 33, output 44$/m);
    });

    test(`${job.file}, ${name}: OpenCode Go gets its key as a bearer token, and nothing else`, (t) => {
      const r = run(t, "opencode-go", { ANTHROPIC_API_KEY: "ak", OPENCODE_API_KEY: "ok" });
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.equal(r.env.ANTHROPIC_BASE_URL, "https://opencode.ai/inference/go/anthropic");
      assert.equal(r.env.ANTHROPIC_AUTH_TOKEN, "ok");
      assert.equal(r.env.ANTHROPIC_API_KEY, undefined);
      assert.equal(r.env.OPENCODE_API_KEY, undefined);
      for (const alias of ["OPUS", "SONNET", "HAIKU"]) {
        assert.equal(r.env[`ANTHROPIC_DEFAULT_${alias}_MODEL`], "the-model");
      }
      assert.equal(r.env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS, "1");
      assert.equal(r.env.ENABLE_TOOL_SEARCH, "false");
      assert.match(r.stdout, /^cost_usd \(Claude prices, not Go's\): 0\.5$/m);
    });

    test(`${job.file}, ${name}: OpenCode Go without its key fails before the CLI starts`, (t) => {
      const r = run(t, "opencode-go", { ANTHROPIC_API_KEY: "ak", OPENCODE_API_KEY: "" });
      assert.equal(r.status, 1);
      assert.match(r.stdout, new RegExp(`${job.provider} is opencode-go but the OPENCODE_API_KEY secret is not set`));
      assert.equal(r.env, null);
    });

    // An unset secret reaches the step as an empty value; the Go key does
    // not stand in for it, and the error points to it only when it is set.
    test(`${job.file}, ${name}: the Anthropic provider without its key fails before the CLI starts`, (t) => {
      const missing = `${job.provider} is anthropic \\(the default\\) but the ANTHROPIC_API_KEY secret is not set; add that secret`;
      const withGo = run(t, "anthropic", { ANTHROPIC_API_KEY: "", OPENCODE_API_KEY: "ok" });
      assert.equal(withGo.status, 1);
      assert.match(
        withGo.stdout,
        new RegExp(`${missing}, or set ${job.provider} to opencode-go to use the OPENCODE_API_KEY secret instead$`, "m"),
      );
      assert.equal(withGo.env, null);
      const neither = run(t, "anthropic", {});
      assert.equal(neither.status, 1);
      assert.match(neither.stdout, new RegExp(`${missing}$`, "m"));
      assert.equal(neither.env, null);
    });
  }
}

// Starts .github/scripts/mcp-server.mjs as the workflows do (one process,
// JSON-RPC over stdio) with a stub gh first on PATH, and talks to it.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, "../..");
const serverPath = path.join(root, ".github/scripts/mcp-server.mjs");

export function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// A gh stub in its own bin directory, answering from `rules`.
export function stubGh(dir, rules) {
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const gh = path.join(bin, "gh");
  fs.writeFileSync(
    gh,
    `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(path.join(here, "gh-stub.mjs"))} "$@"\n`,
  );
  fs.chmodSync(gh, 0o755);
  const rulesFile = path.join(dir, "gh-rules.json");
  fs.writeFileSync(rulesFile, JSON.stringify(rules));
  const log = path.join(dir, "gh-log.jsonl");
  fs.writeFileSync(log, "");
  return { bin, rulesFile, log };
}

// The calls the stub received, oldest first.
export function ghCalls(server) {
  return fs
    .readFileSync(server.log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

export async function startServer(t, { mode, env = {}, rules = [] }) {
  const dir = tempDir(t);
  const stub = stubGh(dir, rules);
  const child = spawn(process.execPath, [serverPath, mode], {
    env: {
      PATH: `${stub.bin}${path.delimiter}${process.env.PATH}`,
      HOME: dir,
      GH_STUB_RULES: stub.rulesFile,
      GH_STUB_LOG: stub.log,
      GITHUB_REPOSITORY: "acme/widgets",
      GITHUB_RUN_ID: "1001",
      GITHUB_RUN_ATTEMPT: "1",
      ...env,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (d) => (stderr += d));
  const pending = new Map();
  readline.createInterface({ input: child.stdout }).on("line", (line) => {
    const msg = JSON.parse(line);
    pending.get(msg.id)?.(msg);
    pending.delete(msg.id);
  });
  const exited = new Promise((resolve) => child.on("exit", resolve));
  t.after(() => child.kill());
  let nextId = 1;
  const request = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, resolve);
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      exited.then((code) => reject(new Error(`server exited (${code}): ${stderr}`)));
    });
  // A tool's reply as { text, isError }.
  const call = async (name, args = {}) => {
    const msg = await request("tools/call", { name, arguments: args });
    if (msg.error) return { text: msg.error.message, isError: true, rpcError: true };
    return { text: msg.result.content[0].text, isError: Boolean(msg.result.isError) };
  };
  return { request, call, log: stub.log, dir, exited, stderr: () => stderr };
}

// A scratch git repository; returns a runner for git in it.
export function gitRepo(t) {
  const dir = path.join(tempDir(t), "repo");
  fs.mkdirSync(dir);
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Test",
        GIT_AUTHOR_EMAIL: "test@example.com",
        GIT_COMMITTER_NAME: "Test",
        GIT_COMMITTER_EMAIL: "test@example.com",
        GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
        GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
      },
    }).trim();
  git("init", "-q", "-b", "main");
  git("config", "commit.gpgsign", "false");
  const commit = (file, content, message) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
    git("add", "--", file);
    git("commit", "-q", "-m", message);
    return git("rev-parse", "HEAD");
  };
  return { dir, git, commit };
}

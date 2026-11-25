// U+2028 and U+2029: Node's readline ends a line at either, and
// JSON.stringify leaves both unescaped, so the server reads requests on
// "\n" only and writes the two escaped (#90).
import assert from "node:assert/strict";
import { test } from "node:test";
import { ghCalls, gitRepo, startServer } from "./helpers/server.mjs";

function reviewServer(t) {
  const repo = gitRepo(t);
  const base = repo.commit("a.txt", "a\n", "base");
  repo.git("checkout", "-q", "-b", "feature");
  const head = repo.commit("b.txt", "b\n", "feature");
  repo.git("update-ref", "refs/remotes/origin/main", base);
  return startServer(t, {
    mode: "review",
    env: { PR: "7", HEAD_SHA: head, BASE: "main", GITHUB_WORKSPACE: repo.dir },
    rules: [
      {
        match: "^api --method GET repos/acme/widgets/pulls/7$",
        stdout: {
          state: "open",
          draft: false,
          base: { ref: "main", sha: base },
          head: { sha: head },
        },
      },
      {
        match: "issues\\?state=all&creator=github-actions%5Bbot%5D&per_page=100&page=1$",
        stdout: [],
      },
      {
        match: "^api -X POST repos/acme/widgets/issues ",
        stdout: "https://github.com/acme/widgets/issues/57",
      },
    ],
  });
}

// The next reply's raw line, or a failure once the server exits or 5 s pass.
function nextLine(server, before) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("no reply")), 5000);
    server.exited.then((code) => {
      clearTimeout(timer);
      reject(new Error(`server exited (${code}): ${server.stderr()}`));
    });
    const poll = () => {
      if (server.lines.length > before) {
        clearTimeout(timer);
        resolve(server.lines[before]);
      } else setTimeout(poll, 10);
    };
    poll();
  });
}

for (const [label, ch, escape] of [
  ["U+2028", " ", "\\u2028"],
  ["U+2029", " ", "\\u2029"],
]) {
  test(
    `a request holding ${label} gets a reply that carries it escaped`,
    { timeout: 10000 },
    async (t) => {
      const server = await reviewServer(t);
      const name = `no${ch}such`;
      const r = await server.call(name);
      assert.equal(r.rpcError, true);
      assert.equal(r.text, `unknown tool ${name}`);
      const raw = server.lines.at(-1);
      assert.ok(!raw.includes(ch), `the reply holds a literal ${label}`);
      assert.ok(raw.includes(escape), raw);
    },
  );

  test(`file_issue answers a title holding ${label}`, { timeout: 10000 }, async (t) => {
    const server = await reviewServer(t);
    const r = await server.call("file_issue", {
      finding: "R1-01",
      title: `Validate the redirect${ch}target`,
      outcome: "Redirects are validated.",
      acceptance: "- [ ] A redirect is refused",
      references: "`lib/fetch.ts:40`",
      size: "S (one session)",
    });
    assert.equal(r.isError, false, r.text);
    assert.ok(!server.lines.at(-1).includes(ch));
    const posted = ghCalls(server).find((c) => c.args.includes("POST"));
    assert.ok(posted, "file_issue created the issue");
  });
}

test(
  "a request split across writes and ended with CRLF gets its reply",
  { timeout: 10000 },
  async (t) => {
    const server = await reviewServer(t);
    const text = JSON.stringify({ jsonrpc: "2.0", id: 99, method: "ping" });
    const before = server.lines.length;
    server.child.stdin.write(text.slice(0, 10));
    await new Promise((r) => setTimeout(r, 50));
    server.child.stdin.write(text.slice(10) + "\r\n");
    assert.deepEqual(JSON.parse(await nextLine(server, before)), {
      jsonrpc: "2.0",
      id: 99,
      result: {},
    });
  },
);

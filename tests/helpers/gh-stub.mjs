#!/usr/bin/env node
// A stand-in for the gh CLI in the server tests. GH_STUB_RULES names a JSON
// file of rules, each { match, stdout?, json?, stderr?, status? }: the first
// rule whose match (a regular expression) finds the call's arguments, joined
// by spaces, answers it; stdout that is not a string is printed as JSON.
// json is a response body passed through the call's own --jq filter with jq,
// as gh does, so a test exercises the filter itself. Every call is appended
// to GH_STUB_LOG as one JSON line { args, stdin }, so a test can check what
// was written and that nothing else was.
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const args = process.argv.slice(2);
const stdin = process.stdin.isTTY ? "" : fs.readFileSync(0, "utf8");
fs.appendFileSync(process.env.GH_STUB_LOG, JSON.stringify({ args, stdin }) + "\n");
const rules = JSON.parse(fs.readFileSync(process.env.GH_STUB_RULES, "utf8"));
const joined = args.join(" ");
const rule = rules.find((r) => new RegExp(r.match).test(joined));
if (!rule) {
  process.stderr.write(`gh stub: no rule for: ${joined}\n`);
  process.exit(9);
}
if (rule.stdout !== undefined)
  process.stdout.write(typeof rule.stdout === "string" ? rule.stdout : JSON.stringify(rule.stdout));
if (rule.json !== undefined) {
  const at = args.indexOf("--jq");
  const filter = at === -1 ? "." : args[at + 1];
  const jq = spawnSync("jq", ["-r", filter], {
    input: JSON.stringify(rule.json),
    encoding: "utf8",
  });
  if (jq.status !== 0) {
    process.stderr.write(`gh stub: jq failed: ${jq.error ? `${jq.error.message}\n` : jq.stderr}`);
    process.exit(9);
  }
  process.stdout.write(jq.stdout);
}
if (rule.stderr) process.stderr.write(rule.stderr);
process.exit(rule.status ?? 0);

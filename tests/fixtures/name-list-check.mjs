// Stand-in for a target repository that checks home paths and its own name list.
import fs from "node:fs";

const [, , arg] = process.argv;
if (!arg?.startsWith("--text=")) process.exit(2);
const text = fs.readFileSync(arg.slice("--text=".length), "utf8");
const names = (process.env.PRIVATE_REPO_NAMES ?? "").split(/[\s,]+/).filter(Boolean);
for (const [index, line] of text.split("\n").entries()) {
  const kinds = [];
  if (line.includes("/home/")) kinds.push("a local or project-storage path");
  if (names.some((name) => line.includes(name))) kinds.push("a private repository name");
  for (const kind of kinds) {
    console.log(`::error title=Public repository content::text, line ${index + 1}: ${kind}`);
    process.exitCode = 1;
  }
}

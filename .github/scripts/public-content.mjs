#!/usr/bin/env node
// Finds private details in text bound for this public repository: what
// AGENTS.md *Public repository content* rules out. claude.ai session,
// project, artifact and chat links, Claude-Session trailers, session and
// thread IDs, paths from an agent's machine or project storage, email
// addresses other than noreply ones, bydradev/ and bydraio/ repositories
// other than the public ones, and the bare names listed in the
// PRIVATE_REPO_NAMES environment variable (comma- or whitespace-separated; a
// repository secret in CI, an environment variable in a cloud environment).
// gh-repo-bootstrapper's .github/scripts/check_public_content.py is the same
// check in Python: keep the two in step.
//
// It reports only where a match is and what kind it is, never the matched
// text, so its output cannot repeat a private name or act as a workflow
// command.
//
//   public-content.mjs --range=BASE..HEAD   commit messages in a range
//   public-content.mjs --files=BASE..HEAD   lines the range adds to files
//   public-content.mjs --title=TEXT         a pull request title
//   public-content.mjs --pr-body=FILE       a pull request body
//   public-content.mjs --text=FILE          any other text (a comment)
//
// --files reads each commit of the range, as --range does, so a line one
// commit adds and a later one removes is still found, and takes REV^! for one
// commit. It checks the path of each file a commit adds or changes and the
// lines it adds (for a merge, the lines that are in none of its parents), but
// not this script or its tests, which hold every pattern and example it finds.
//
// Options combine and repeat. Exits 1 when anything is found, 2 on a usage
// error. This is the repository's own script: kit-manifest.txt does not
// list it, so no target gets it.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const PUBLIC_REPOSITORIES = new Set([
  "gh-repo-bootstrapper",
  "gh-agent-kit",
  "github-agent-kit",
  "gh-actions-dashboard",
]);
// The made-up repository gh-repo-bootstrapper's template tests serve from a
// mock GitHub API.
const PLACEHOLDER_REPOSITORIES = new Set(["fixture"]);

// Any claude.ai link with a path is found, so a new link format is too; only
// the generic footer link https://claude.ai/code, the Claude Code installer
// and its downloads host stay allowed. A trailer or marker is found with its
// value, so the rule that names it in backticks is not. A path is found when
// something follows the folder: under /mnt/, /workspace/, /root/, a home or
// user folder other than the runner's, Homebrew's or the placeholder `you`, a
// macOS volume or temporary folder, a Claude scratch folder, or a folder under
// `~/`.
const PATTERNS = [
  [
    "a claude.ai link",
    /(?<!downloads\.)claude\.ai\/(?!code(?![\w/-])|install\.(?:sh|ps1|cmd)(?![\w/-]))[\w-]/i,
  ],
  ["a Claude-Session trailer", /Claude-Session:[ \t]*[^\s`]/i],
  ["a project attribution marker", /claude-projects-attribution\s*:/i],
  ["a session or thread ID", /\b(?:session|cse|cmsg|chan)_[A-Za-z0-9]{16,}/],
  [
    "a local or project-storage path",
    new RegExp(
      String.raw`(?<![\w.-])(?:/mnt/|/workspace/|/root/|/home/(?!(?:runner|linuxbrew|you)\b)` +
        String.raw`|/Users/(?!you\b)|/Volumes/|(?:/private)?/var/folders/)[\w.-]` +
        String.raw`|(?<![\w.-])(?:/tmp/claude|~/[\w.-]+/)` +
        String.raw`|\b[A-Za-z]:\\Users\\(?!you\b)[\w.-]`,
    ),
  ],
];
// bydraio is the maintainer's earlier account name. The owner takes the bare
// names' boundary rather than \b, so an underscore before it (Markdown
// emphasis, _bydradev/name_) does not hide a reference.
const OWNER_REPO = /(?<![A-Za-z0-9-])(?:bydradev|bydraio)\/([A-Za-z0-9._-]+)/gi;

// An address is found unless it is a noreply one, at an example domain, or
// the contact address CODE_OF_CONDUCT.md publishes; git@github.com is SSH's
// login, not a person's. A backslash before it is an escape such as `\n`.
const EMAIL = /(?<![\w.%+\\-])([\w.%+-]+(?:\[bot\])?)@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})(?![\w-])/g;
const NOREPLY_LOCAL_PARTS = new Set(["noreply", "no-reply"]);
const NOREPLY_DOMAINS = ["users.noreply.github.com", "example.com", "example.org", "example.net"];
const PUBLISHED_ADDRESSES = new Set(["github@bydra.dev", "git@github.com"]);

// The check's own script and tests hold every pattern and example it finds.
export const EXEMPT_FILES = new Set([
  ".github/scripts/public-content.mjs",
  "tests/public-content.test.mjs",
]);
// A changed file's path is printed only when it has no finding and only these
// characters, so it cannot repeat a private name or start a workflow command.
const PRINTABLE_PATH = /^[\w./+@-]+$/;

// The two lines a Claude project thread must put at the top of a pull
// request body. AGENTS.md lets them stay there and keeps them out of squash
// commits, so a body may open with them and a commit may not.
const ATTRIBUTION = [
  /^<!-- claude-projects-attribution: \{"github_login":"[A-Za-z0-9-]+"\} -->$/,
  /^_Requested by \*\*[^*\n]+\*\* · \[project thread\]\(https:\/\/claude\.ai\/code\/project\/chan_[A-Za-z0-9]+\?thread=cmsg_[A-Za-z0-9]+\)_$/,
];

export function privateNames(value) {
  return (value ?? "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((name) => [
      name,
      new RegExp(
        // An underscore is a boundary, so Markdown emphasis (_name_) is found.
        `(?<![A-Za-z0-9-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9])`,
        "i",
      ),
    ]);
}

function privateAddress(local, domain) {
  local = local.toLowerCase();
  domain = domain.toLowerCase();
  return !(
    NOREPLY_LOCAL_PARTS.has(local) ||
    NOREPLY_DOMAINS.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`)) ||
    PUBLISHED_ADDRESSES.has(`${local}@${domain}`)
  );
}

// [line number, kind] for each finding in text, in order.
export function scan(text, names, allowAttribution = false) {
  const lines = text.split(/\r?\n/);
  const skip =
    allowAttribution &&
    lines.length >= 2 &&
    ATTRIBUTION.every((pattern, i) => pattern.test(lines[i].trim()))
      ? 2
      : 0;
  const found = [];
  lines.forEach((line, index) => {
    if (index < skip) return;
    const kinds = PATTERNS.filter(([, pattern]) => pattern.test(line)).map(([kind]) => kind);
    for (const match of line.matchAll(OWNER_REPO)) {
      // Trailing dots end a sentence. Trailing underscores close emphasis
      // only when an underscore opened it earlier in the line; otherwise they
      // are part of the name, so bydradev/gh-agent-kit_ is another repository.
      const emphasised = /(?:^|\W)_/.test(line.slice(0, match.index));
      const repository = match[1]
        .replace(emphasised ? /[._]+$/ : /\.+$/, "")
        .replace(/\.git$/, "")
        .toLowerCase();
      if (!PUBLIC_REPOSITORIES.has(repository) && !PLACEHOLDER_REPOSITORIES.has(repository)) {
        kinds.push("a bydradev or bydraio repository outside the public list");
        break;
      }
    }
    if ([...line.matchAll(EMAIL)].some(([, local, domain]) => privateAddress(local, domain)))
      kinds.push("an email address other than a noreply one");
    if (names.some(([, pattern]) => pattern.test(line))) kinds.push("a private repository name");
    for (const kind of kinds) found.push([index + 1, kind]);
  });
  return found;
}

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

function commits(range) {
  const fields = git("log", "--format=%H%x00%B%x00", "--end-of-options", range).split("\0");
  const out = [];
  for (let i = 0; i + 1 < fields.length; i += 2) out.push([fields[i].trim(), fields[i + 1]]);
  return out;
}

// BASE..HEAD or REV^!, as --files takes them.
function fileRange(value) {
  const at = value.indexOf("..");
  const [base, head] = at < 0 ? ["", ""] : [value.slice(0, at), value.slice(at + 2)];
  return (base && head && !head.startsWith(".")) || (value.endsWith("^!") && value.length > 2);
}

// [commit, place, path, [[line number, text]]] for each file a commit in the
// range adds or changes; place is the file's place in
// `git show --format= --name-only COMMIT`.
function changedFiles(range) {
  const out = [];
  for (const commit of git("rev-list", "--reverse", "--end-of-options", range).split(/\s+/)) {
    if (!commit) continue;
    const show = ["show", "--format=", "--no-color", "--no-ext-diff", "--no-textconv"];
    show.push("--find-renames", commit);
    const fields = git(...show, "--name-status", "-z").split("\0");
    let place = 0;
    for (let i = 0; fields[i]; ) {
      const status = fields[i++];
      place += 1;
      // A merge has a letter per parent and one path, even for a rename; only a
      // rename or copy in a plain commit, R or C with a score, has two.
      const paths = /^[RC]\d+$/.test(status) ? [fields[i++], fields[i++]] : [fields[i++]];
      if (/^D+$/.test(status)) continue;
      const added = [];
      let columns = 0;
      let number = 0;
      // With no context lines, a hunk holds only changed lines, each led by a
      // column per parent: + where the parent lacks the line, - where only the
      // parent has it. A line every parent lacks is added, even one that reads
      // "+++".
      for (const line of git(...show, "--unified=0", "--", ...paths).split("\n")) {
        const header = /^(@@+) .*? \+(\d+)(?:,\d+)? \1/.exec(line);
        if (header) {
          columns = header[1].length - 1;
          number = Number(header[2]);
        } else if (columns && !line.startsWith("\\") && !line.slice(0, columns).includes("-")) {
          if (line.slice(0, columns) === "+".repeat(columns))
            added.push([number, line.slice(columns)]);
          number += 1;
        }
      }
      out.push([commit, place, paths.at(-1), added]);
    }
  }
  return out;
}

export function main(argv, env = process.env, print = console.log) {
  const sources = [];
  const pending = [];
  for (const arg of argv) {
    const match = /^--(range|files|title|pr-body|text)=(.*)$/s.exec(arg);
    if (!match) {
      print(`usage: unknown argument; give --range=, --files=, --title=, --pr-body= or --text=`);
      return 2;
    }
    if (match[1] === "files" && !fileRange(match[2])) {
      print("usage: --files= takes BASE..HEAD or REV^!");
      return 2;
    }
    pending.push([match[1], match[2]]);
  }
  if (pending.length === 0) {
    print("usage: give at least one of --range=, --files=, --title=, --pr-body= or --text=");
    return 2;
  }
  for (const [option, value] of pending) {
    if (option === "title") sources.push(["title", value, false]);
    if (option === "pr-body") sources.push(["body", fs.readFileSync(value, "utf8"), true]);
    if (option === "text") sources.push([`text ${value}`, fs.readFileSync(value, "utf8"), false]);
    if (option === "range")
      for (const [sha, message] of commits(value))
        sources.push([`commit ${sha.slice(0, 7)}`, message, false]);
  }

  const names = privateNames(env.PRIVATE_REPO_NAMES);
  if (names.length === 0)
    print("PRIVATE_REPO_NAMES is not set, so bare private repository names were not checked.");

  const findings = [];
  for (const [source, text, allow] of sources)
    for (const [line, kind] of scan(text, names, allow))
      findings.push(`${source}, line ${line}: ${kind}`);
  let files = 0;
  for (const [option, value] of pending) {
    if (option !== "files") continue;
    for (const [commit, place, file, added] of changedFiles(value)) {
      if (EXEMPT_FILES.has(file)) continue;
      files += 1;
      const inName = scan(file, names).map(([, kind]) => kind);
      const source =
        inName.length || !PRINTABLE_PATH.test(file)
          ? `commit ${commit.slice(0, 7)}, changed file ${place} (name not shown)`
          : `commit ${commit.slice(0, 7)}, file ${file}`;
      for (const kind of inName) findings.push(`${source}, name: ${kind}`);
      for (const [number, line] of added)
        for (const [, kind] of scan(line, names))
          findings.push(`${source}, line ${number}: ${kind}`);
    }
  }

  for (const finding of findings) print(`::error title=Public repository content::${finding}`);
  if (findings.length) {
    print(
      `${findings.length} finding(s). Reword them as AGENTS.md *Public repository content* says; ` +
        "this check never prints the matched text. A changed file's number is its place in " +
        "`git show --format= --name-only COMMIT`.",
    );
    return 1;
  }
  print(`No private details found in ${sources.length} text(s) and ${files} file change(s).`);
  return 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}

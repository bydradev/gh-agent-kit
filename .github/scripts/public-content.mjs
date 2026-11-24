#!/usr/bin/env node
// Finds private details in text bound for this public repository: what
// AGENTS.md *Public repository content* rules out. claude.ai session,
// project, artifact and chat links, Claude-Session trailers, session and
// thread IDs, paths from an agent's machine or project storage, email
// addresses other than noreply ones.
// gh-repo-bootstrapper's .github/scripts/check_public_content.py is the same
// check in Python: keep the two in step.
//
// It reports only where a match is and what kind it is, never the matched
// text, so its output cannot repeat private text or act as a workflow
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
// An address is found unless it is a noreply one, at an example domain, or
// the contact address CODE_OF_CONDUCT.md publishes; git@github.com is SSH's
// login, not a person's. A backslash before it is an escape such as `\n`.
// It ends where no letter or digit follows: `_` never appears in a domain,
// and a `-` after the letters-only top-level label opens a suffix
// (`sam@corp.example-related`) or Markdown emphasis closes it (`_..._`).
const EMAIL = /(?<![\w.%+\\-])([\w.%+-]+(?:\[bot\])?)@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})(?![A-Za-z0-9])/g;
// The same address ending only where no word character or `-` follows. Where
// EMAIL stops early (before a `-` or `_`), this one keeps searching and can
// find an address that overlaps it (`noreply@x.example-sam@corp.example`)
// or the whole domain a `-` continues, so a line is checked with both and
// nothing this one finds is lost to the earlier end.
const EMAIL_WHOLE = /(?<![\w.%+\\-])([\w.%+-]+(?:\[bot\])?)@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})(?![\w-])/g;
// An address right after a complete literal escape in a string, in JSON or
// source text (`"Contact:\nsam@corp.example"`), which the patterns above pass
// over: their start may not follow a backslash, so that `\n@AGENTS.md` stays
// quiet. escapeStarts finds the positions where one may start, and this
// pattern is tried at each of them (sticky), so overlapping candidates such
// as `\012sam` (an octal escape) cannot hide each other. The local part is
// ASCII so Python's copy, whose \w is Unicode, agrees.
const EMAIL_AFTER_ESCAPE =
  /([A-Za-z0-9_.%+-]+(?:\[bot\])?)@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})(?![A-Za-z0-9])/y;
// Where an address may start after an escape: the positions right after an
// escape inside a string (opened by ", ` or a ' that no letter or digit comes
// before other than a Python string prefix such as f or rb, and not raw) that
// decodes to a space, a control character, a quote or a slash, mapped to
// whether the token the address ends is a URL (`scheme://` or `scheme:\/\/`
// since its last space, quote, or escaped space or control character), whose
// user information the URL guard judges. An escaped letter (`\u006e`) is
// part of the address, and an escaped backslash consumes its pair, so a run
// of them leaves the escape after it as it is. One pass over the line.
const SPACE_ESCAPES = { n: 10, r: 13, t: 9, f: 12, v: 11, 0: 0, b: 8 };
function escapeStarts(line) {
  const starts = new Map();
  let quote = null;
  let raw = false;
  let url = false;
  // A scheme's :// as written or escaped (`:\/\/`, `\u003a\u002f\u002f`), and
  // the index of its last character.
  const scheme = (j) => {
    const m = /^(?::|\\u003[aA]|\\x3[aA])(?:\/|\\\/|\\u002[fF]|\\x2[fF]){2}/.exec(line.slice(j, j + 18));
    return m ? j + m[0].length - 1 : -1;
  };
  for (let j = 0; j < line.length; ) {
    const c = line[j];
    if (quote) {
      if (c === "\\" && raw) {
        j += 2;
      } else if (c === "\\") {
        let len = 2;
        let code = SPACE_ESCAPES[line[j + 1]] ?? line.charCodeAt(j + 1);
        const u = /^\\u([0-9A-Fa-f]{4})/.exec(line.slice(j, j + 6));
        const x = /^\\x([0-9A-Fa-f]{2})/.exec(line.slice(j, j + 4));
        const o = /^\\([0-7]{1,3})/.exec(line.slice(j, j + 4));
        if (u) [len, code] = [6, parseInt(u[1], 16)];
        else if (x) [len, code] = [4, parseInt(x[1], 16)];
        else if (o) [len, code] = [1 + o[1].length, parseInt(o[1], 8)];
        // A space, or a slash after the authority (the user information is
        // only between scheme:// and the first slash), ends the URL's part.
        if (code < 0x21 || (code === 47 && url)) url = false;
        if (code < 0x21 || [34, 39, 47, 96].includes(code)) starts.set(j + len, url);
        j += len;
      } else {
        if (c === quote) [quote, raw, url] = [null, false, false];
        else if (scheme(j) >= 0) [url, j] = [true, scheme(j)];
        else if (/[ \t\r\n\f\v/]/.test(c)) url = false;
        j++;
      }
    } else {
      const prefix = /(?:^|[^A-Za-z0-9_])([rRbBuUfF]{0,2})$/.exec(line.slice(Math.max(0, j - 3), j));
      if (c === '"' || c === "`" || (c === "'" && prefix)) {
        [quote, raw, url] = [c, c !== "`" && /[rR]/.test(prefix ? prefix[1] : ""), false];
      } else if (scheme(j) >= 0) [url, j] = [true, scheme(j)];
      else if (/[ \t\r\n\f\v'"`/]/.test(c)) url = false;
      j++;
    }
  }
  return starts;
}
// A URL's user information (scheme://user@host or scheme://user:password@host),
// as tests of code that refuses credentials in URLs hold, is not an address:
// a match whose text before it ends with this is skipped. mailto: has no //,
// so an address after it is still found.
const URL_USERINFO = /[A-Za-z][A-Za-z0-9+.-]*:\/\/(?:[^\s/?#@:]*:)?$/;
const NOREPLY_LOCAL_PARTS = new Set(["noreply", "no-reply"]);
const NOREPLY_DOMAINS = ["users.noreply.github.com", "example.com", "example.org", "example.net"];
const PUBLISHED_ADDRESSES = new Set(["github@bydra.dev", "git@github.com"]);

// Only this complete literal line exempts its email; it does not verify authorship.
const DEPENDABOT_FOOTER = "Signed-off-by: dependabot[bot] <support@github.com>";

// The check's own script and tests hold every pattern and example it finds.
export const EXEMPT_FILES = new Set([
  ".github/scripts/public-content.mjs",
  "tests/public-content.test.mjs",
]);
// A changed file's path is printed only when it has no finding and only these
// characters, so it cannot repeat private text or start a workflow command.
const PRINTABLE_PATH = /^[\w./+@-]+$/;

// The two lines a Claude project thread must put at the top of a pull
// request body. AGENTS.md lets them stay there and keeps them out of squash
// commits, so a body may open with them and a commit may not.
const ATTRIBUTION = [
  /^<!-- claude-projects-attribution: \{"github_login":"[A-Za-z0-9-]+"\} -->$/,
  /^_Requested by \*\*[^*\n]+\*\* · \[project thread\]\(https:\/\/claude\.ai\/code\/project\/chan_[A-Za-z0-9]+\?thread=cmsg_[A-Za-z0-9]+\)_$/,
];

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
export function scan(text, allowAttribution = false) {
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
    if (
      line !== DEPENDABOT_FOOTER &&
      [
        ...line.matchAll(EMAIL),
        ...line.matchAll(EMAIL_WHOLE),
        ...(() => {
          const found = [];
          if (!line.includes("\\") || !line.includes("@")) return found;
          for (const [start, url] of escapeStarts(line)) {
            if (url) continue;
            EMAIL_AFTER_ESCAPE.lastIndex = start;
            const m = EMAIL_AFTER_ESCAPE.exec(line);
            if (!m) continue;
            // A hyphen and a letter or digit may continue the domain
            // (`sam@x.example-y.test`), so only the local part's exemption
            // applies then.
            const end = start + m[0].length;
            m.continued = line[end] === "-" && /[A-Za-z0-9]/.test(line[end + 1] ?? "");
            found.push(m);
          }
          return found;
        })(),
      ].some(
        (match) =>
          // The address test first: it is cheap, and the URL guard reads the
          // text before the match, which a long line holds many of.
          (match.continued
            ? !NOREPLY_LOCAL_PARTS.has(match[1].toLowerCase())
            : privateAddress(match[1], match[2])) &&
          !URL_USERINFO.test(line.slice(0, match.index)),
      )
    )
      kinds.push("an email address other than a noreply one");
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
      const diffLines = git(...show, "--unified=0", "--", ...paths).split("\n");
      for (const [index, line] of diffLines.entries()) {
        const header = /^(@@+) .*? \+(\d+)(?:,\d+)? \1/.exec(line);
        if (header) {
          columns = header[1].length - 1;
          number = Number(header[2]);
        } else if (columns && !line.startsWith("\\") && !line.slice(0, columns).includes("-")) {
          if (line.slice(0, columns) === "+".repeat(columns)) {
            const ending = diffLines[index + 1].startsWith("\\ No newline") ? "" : "\n";
            added.push([number, line.slice(columns) + ending]);
          }
          number += 1;
        }
      }
      out.push([commit, place, paths.at(-1), added]);
    }
  }
  return out;
}

export function main(argv, print = console.log) {
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

  const findings = [];
  for (const [source, text, allow] of sources)
    for (const [line, kind] of scan(text, allow))
      findings.push(`${source}, line ${line}: ${kind}`);
  let files = 0;
  for (const [option, value] of pending) {
    if (option !== "files") continue;
    for (const [commit, place, file, added] of changedFiles(value)) {
      if (EXEMPT_FILES.has(file)) continue;
      files += 1;
      const inName = scan(file).map(([, kind]) => kind);
      const source =
        inName.length || !PRINTABLE_PATH.test(file)
          ? `commit ${commit.slice(0, 7)}, changed file ${place} (name not shown)`
          : `commit ${commit.slice(0, 7)}, file ${file}`;
      for (const kind of inName) findings.push(`${source}, name: ${kind}`);
      for (const [number, line] of added)
        for (const [, kind] of scan(line))
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

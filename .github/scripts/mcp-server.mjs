#!/usr/bin/env node
// The bots' only GitHub reads and writes, as an MCP server over stdio.
// Claude Code starts it from --mcp-config with the job token in this
// process's environment only; the model's own process and shell have none,
// and its Bash tool is denied, so every operation below is the whole list
// of what the model can do with the token. Mode "review" serves the pull
// request reviewer, mode "triage" the issue bot and the sweep.
//
// No dependencies: the MCP stdio transport is newline-delimited JSON-RPC.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import readline from "node:readline";

const mode = process.argv[2];
const env = process.env;
// The job token comes from a file the workflow wrote for the runner user
// only (GH_TOKEN_FILE, outside the checkout); the server's configuration
// is passed inline, so the token must not be in it, and the model's own
// environment has GH_TOKEN blanked.
if (env.GH_TOKEN_FILE) env.GH_TOKEN = fs.readFileSync(env.GH_TOKEN_FILE, "utf8").trim();
const repo = env.GITHUB_REPOSITORY;
const LIMIT = 24000; // characters per tool result, under Claude Code's preview cut
const LABELS_ADD = [
  "bug",
  "feature",
  "chore",
  "docs",
  "P0",
  "P1",
  "P2",
  "P3",
  "triaged",
  "needs-operator",
];
const LABELS_RESET = ["ready", "agent:approved"];
// needs-triage is removable (every triage ends by swapping it) but never
// added: applying it starts another run that cancels this one.
const LABELS_REMOVE = [...LABELS_ADD, "needs-triage"];
const STATE_LABELS = [
  "needs-triage",
  "triaged",
  "ready",
  "in-progress",
  "blocked",
  "needs-operator",
];
const digits = (s) => typeof s === "string" && /^[0-9]+$/.test(s);
const repoName = (s) =>
  typeof s === "string" &&
  /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(s) &&
  !s.split("/").some((part) => /^\.+$/.test(part));
// A ref the model may name: the fetched base exactly (whatever characters
// its branch name has), or a plain name or sha from a conservative set.
const refName = (s) =>
  typeof s === "string" &&
  (s === `origin/${env.BASE}` ||
    (/^[A-Za-z0-9_./:-]+$/.test(s) && !s.startsWith("-") && !s.includes("..")));
// <ref>..<ref> or <ref>...<ref>, each side a ref as above.
const rangeArg = (s) => {
  if (typeof s !== "string") return false;
  const m = /^(.+?)(\.\.\.?)(.+)$/.exec(s);
  return Boolean(m) && refName(m[1]) && refName(m[3]);
};
const pathArg = (s) =>
  typeof s === "string" &&
  s.length > 0 &&
  !s.startsWith("-") &&
  !s.startsWith("/") &&
  !s.split("/").includes("..") &&
  !s.startsWith(".git/") &&
  s !== ".git";

function gh(args, input) {
  return execFileSync("gh", args, { encoding: "utf8", input, maxBuffer: 64 * 1024 * 1024 }).trim();
}
function git(args) {
  return execFileSync("git", args, {
    cwd: env.GITHUB_WORKSPACE,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}
// A diff, patch or range-diff as the base's attributes give it. git reads
// .gitattributes from the working tree, the pull request's head, which
// could mark a file -diff or binary and so hide its change from the
// reviewer; --attr-source reads them from the base instead (git 2.41,
// RelNotes/2.41.0; the runner's ubuntu-24.04 image has 2.55, read
// 2026-10-23), so the head's own .gitattributes change is reviewed as
// content. diff and show run no external diff or textconv driver either;
// range-diff passes the attribute source to the git log it runs but not
// the two flags, so there a textconv driver would need the base's
// attributes and the runner's git config, neither of which a head sets.
function gitDiff(attrs, command, args) {
  return git([`--attr-source=${attrs}`, command, "--no-ext-diff", "--no-textconv", ...args]);
}
function getJson(path) {
  return JSON.parse(gh(["api", "--method", "GET", path]));
}
function getPage(path, page) {
  const sep = path.includes("?") ? "&" : "?";
  return getJson(`${path}${sep}per_page=100&page=${page}`);
}
// Projected listing (the fields the skills use and no more), paged by
// size: from a 0-based start index, as many items as fit under LIMIT, in
// the API's order (oldest first). next_start is the first item not
// returned, null at the end, so no item is ever dropped. A body that
// would not fit on a page of its own is cut with a marker naming the
// comment_body tool, which serves one comment in pages.
function paged(fetchPage, start, project) {
  const from = Number.isInteger(start) && start >= 0 ? start : 0;
  const items = [];
  let idx = from;
  let size = 120;
  let more = true;
  while (more) {
    const raw = fetchPage(Math.floor(idx / 100) + 1);
    more = raw.length === 100;
    const slice = raw.slice(idx % 100);
    if (slice.length === 0) break;
    for (const r of slice) {
      const item = project(r);
      // The item as it will print, nested two levels deep in the page.
      const printed = (it) => {
        const j = JSON.stringify(it, null, 1);
        return j.length + 2 * j.split("\n").length + 2;
      };
      let cost = printed(item);
      if (size + cost > LIMIT) {
        if (items.length > 0) return { start: from, count: items.length, next_start: idx, items };
        if (typeof item.body === "string") {
          const marker = item.id
            ? `\n[body cut; read it whole with comment_body, id ${item.id}${item.state !== undefined ? ", kind review" : ""}]`
            : "\n[body cut]";
          const room = LIMIT - size - (cost - item.body.length) - marker.length - 40;
          item.body = item.body.slice(0, Math.max(room, 0)) + marker;
          cost = printed(item);
        }
      }
      items.push(item);
      size += cost;
      idx += 1;
    }
  }
  return { start: from, count: items.length, next_start: more ? idx : null, items };
}
const listing = (path, start, project) => paged((page) => getPage(path, page), start, project);
const startProp = {
  start: {
    type: "integer",
    description: "index of the first item, 0-based; pass next_start to continue",
  },
};
// One comment whole, in pages: an issue comment (a report or triage plan),
// an inline review comment, or (review mode, this pull request) a review's
// summary body. With screen, the write-access rule below applies.
function commentBody(path, id, page, screen = false) {
  if (!Number.isInteger(id) || id <= 0) return fail("id must be a positive integer");
  const c = getJson(`${path}/${id}`);
  const item = {
    ...commentFields(c),
    created_at: c.created_at ?? c.submitted_at,
    state: c.state,
    path: c.path,
    line: c.line ?? c.original_line,
  };
  const reason = screen && withheldReason(c.user);
  return text(
    reason ? { ...item, body: null, withheld: `${reason}; the body is not shown` } : item,
    page,
  );
}
const commentFields = (c) => ({
  id: c.id,
  author: c.user && c.user.login,
  author_type: c.user && c.user.type,
  created_at: c.created_at,
  body: c.body,
});
const inlineFields = (c) => ({
  ...commentFields(c),
  path: c.path,
  line: c.line ?? c.original_line,
  in_reply_to_id: c.in_reply_to_id ?? null,
});

// Text longer than LIMIT is served in pages of LIMIT characters, each
// headed by its number and the count, so nothing is silently dropped;
// listings page by item count instead and are built under LIMIT.
function text(value, page) {
  let s = typeof value === "string" ? value : JSON.stringify(value, null, 1);
  if (s.length > LIMIT) {
    const pages = Math.ceil(s.length / LIMIT);
    const p = Number.isInteger(page) && page > 0 ? Math.min(page, pages) : 1;
    const next = p < pages ? `pass page: ${p + 1} for the next` : "the last";
    s =
      `[page ${p} of ${pages}, ${LIMIT} characters each; ${next}]\n` +
      s.slice((p - 1) * LIMIT, p * LIMIT);
  }
  return { content: [{ type: "text", text: s }] };
}
const pageProp = { page: { type: "integer", description: "page of a long text, 1-based" } };
const isPr = (i) => Boolean(i && i.pull_request);
function fail(message) {
  return { content: [{ type: "text", text: message }], isError: true };
}

// ---------- review mode ----------
const pr = env.PR;
let reportPosted = false;
let inlinePosted = 0;
const INLINE_LIMIT = 40; // inline findings per run; the report carries the rest
const ISSUE_LIMIT = 5; // backlog issues per run; the report names the rest
let issuesFiled = 0;
// This pull request's filed issues by finding ID, read once per run from
// the issues this repository's bot opened, open or closed (the operator
// may have closed one as not planned), and kept current as the run files.
let filedByFinding = null;
const FINDING_ID = /^R[0-9]+-[0-9]+$/;
const SIZES = ["S (one session)", "M (one PR, several sessions)", "L (needs a phased plan)"];
// The hidden line an issue the reviewer filed carries: which pull request
// and finding it came from, so a later round does not file it again.
const issueMarker = (finding) => `<!-- pr-review finding ${repo}#${pr} ${finding} -->`;
// The finding IDs whose markers for this pull request a body carries.
const findingIdsIn = (body) =>
  [...body.matchAll(/<!-- pr-review finding ([^ ]+) (R[0-9]+-[0-9]+) -->/g)]
    .filter((m) => m[1] === `${repo}#${pr}`)
    .map((m) => m[2]);
// The model's text in a filed issue, kept from forging the form's
// structure: no HTML comment (a dedupe marker is one) and no heading.
// Comment openers and both closers ("-->" and "--!>") are stripped until
// nothing changes, so "<!<!---->" cannot rebuild one. Headings are
// escaped in every form GitHub renders: an ATX "#" after any indent,
// quote or list marker, a setext underline ("---" or "===" under a line,
// quoted or indented too), and an <h1> to <h6> tag.
function plain(t) {
  let out = t;
  for (let prev; prev !== out;) {
    prev = out;
    out = out.replace(/<!--|--!?>/g, "");
  }
  return out
    .replace(/^([ \t>*+\-0-9.)]*)#/gm, "$1\\#")
    .replace(/^([ \t>]*)(=+|-+)([ \t]*)$/gm, "$1\\$2$3")
    .replace(/<(\/?h[1-6])/gi, "&lt;$1");
}
// The body of a filed issue in the Task form's layout (its headings, as
// GitHub renders a submitted form), for the operator, who triages it by
// hand or closes it: the triage bot never reads it, since its author is
// github-actions[bot] (issue-triage.yml skips bot-authored issues), so it
// is labelled needs-operator, not needs-triage. Under a fixed line the
// model cannot change: the reviewer wrote the text after reading the pull
// request's conversation, which people without write access can add to,
// so it is unverified until the operator checks.
function taskBody({ outcome, acceptance, references, out_of_scope, size, finding }) {
  const banner =
    `> Filed by the automated review of #${pr} (finding ${finding}, head \`${env.HEAD_SHA}\`), outside that pull request's scope. ` +
    "The text below is the reviewer's, written after reading the pull request and its conversation, which people without write access can comment on: verify the finding before approving work on it.";
  const sections = [
    ["Outcome", plain(outcome)],
    ["Acceptance criteria", plain(acceptance)],
    ["References", references ? plain(references) : "_No response_"],
    ["Out of scope", out_of_scope ? plain(out_of_scope) : "_No response_"],
    ["Size", size || "_No response_"],
  ];
  return `${banner}\n\n${sections.map(([h, b]) => `### ${h}\n\n${b.trim() || "_No response_"}`).join("\n\n")}\n\n${issueMarker(finding)}\n`;
}
// The base this run diffs against, fixed when the run started: a retarget
// during the run would otherwise mix diffs against two bases, and stale()
// refuses to post after one.
function prBase() {
  return env.BASE;
}
// Why a write must be refused now, or null. A head pushed since the
// checkout was not reviewed. A base that moved (a push to the base branch
// raises no pull request event) matters only when it changes the diff
// this run read: the pull request's diff is the three-dot diff from the
// merge base, so a base push that leaves the merge base alone (the usual
// merge of another pull request) leaves the reviewed diff exact, while a
// retarget, a force-push of the base or a base that now contains part of
// the head does not. A report or inline comment on a changed diff would
// describe a change the run never saw, so the run ends without one.
function stale() {
  const p = getJson(`repos/${repo}/pulls/${pr}`);
  // No event cancels the run when the pull request closes or goes back
  // to draft, and a review of either is not wanted: a reopened or
  // readied pull request gets its own run.
  if (p.state !== "open")
    return `the pull request is now ${p.merged ? "merged" : "closed"}; nothing posted`;
  if (p.draft)
    return "the pull request was converted to a draft; nothing posted, it is reviewed when marked ready";
  if (p.base.ref !== env.BASE)
    return `the pull request was retargeted from ${env.BASE} to ${p.base.ref} after this run started; nothing posted, it needs a run against the new base`;
  if (p.head.sha !== env.HEAD_SHA)
    return `the pull request's head moved to ${p.head.sha} after this run checked out ${env.HEAD_SHA}; nothing posted, the new head needs its own run`;
  let local = "";
  try {
    local = git(["rev-parse", `origin/${p.base.ref}`]).trim();
  } catch {
    return `the pull request's base is now ${p.base.ref}, which this run did not fetch; nothing posted`;
  }
  if (p.base.sha === local) return null;
  const reviewed = git(["merge-base", local, "HEAD"]).trim();
  const live = getJson(`repos/${repo}/compare/${p.base.sha}...${env.HEAD_SHA}`).merge_base_commit
    .sha;
  if (reviewed !== live)
    return `the base ${p.base.ref} moved to ${p.base.sha} after this run diffed against ${local}, and the pull request's diff changed with it; nothing posted, the pull request needs a run against the new base`;
  return null;
}
function hasCommit(ref) {
  try {
    execFileSync("git", ["cat-file", "-e", `${ref}^{commit}`], {
      cwd: env.GITHUB_WORKSPACE,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}
// A base commit gone from the checkout (the base branch force-pushed, or
// merged and deleted) is fetched by sha, but only one a report this
// server posted on this pull request (by github-actions[bot], with
// post_report's run marker) recorded as its Base reviewed commit; since
// post_report accepts only the base the run diffed against on that line,
// that is a commit an earlier run had as its base, not one the model
// picked. GitHub served a commit no branch
// reaches but a refs/pull/<n>/head ref does when tested on 2026-10-22; one
// no ref reaches at all may be refused ("not our ref"). The job token
// goes to git through its environment only, as the workflow's fetches pass
// it, and nothing is written to .git/config or FETCH_HEAD.
function fetchReviewedBase(sha) {
  if (!/^[0-9a-f]{40}$/.test(sha))
    return "only a full 40-character sha can be fetched (pass the Base reviewed line's)";
  const recorded = new RegExp(`^Base reviewed: \\S+ at ${sha}$`, "m");
  const posted = /\n<!-- pr-review run [0-9]+\.[0-9]+ -->\n?$/;
  let found = false;
  for (let page = 1; !found; page++) {
    const raw = getPage(`repos/${repo}/issues/${pr}/comments`, page);
    found = raw.some(
      (c) =>
        c.user &&
        c.user.login === "github-actions[bot]" &&
        recorded.test(c.body || "") &&
        posted.test(c.body || ""),
    );
    if (raw.length < 100) break;
  }
  if (!found) return "no report on this pull request names it as its Base reviewed commit";
  const auth = Buffer.from(`x-access-token:${env.GH_TOKEN}`).toString("base64");
  try {
    execFileSync(
      "git",
      [
        "fetch",
        "--quiet",
        "--no-tags",
        "--no-recurse-submodules",
        "--no-write-fetch-head",
        "origin",
        sha,
      ],
      {
        cwd: env.GITHUB_WORKSPACE,
        stdio: ["ignore", "ignore", "pipe"],
        timeout: 120000,
        env: {
          ...env,
          GIT_TERMINAL_PROMPT: "0",
          GIT_CONFIG_COUNT: "1",
          GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
          GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${auth}`,
        },
      },
    );
  } catch (e) {
    const said =
      String(e.stderr || "")
        .trim()
        .split("\n")
        .pop() || "no reason given";
    return `fetching it by sha failed (${said}; GitHub may no longer serve a commit no ref reaches)`;
  }
  return hasCommit(sha) ? null : "fetching it by sha did not bring it in";
}
// The four lines the workflow's report check requires, each exactly one
// plain line of its own (a bullet or bold form does not count, and the
// check would fail the run after the report is posted).
const REPORT_LINES = [
  [
    "Closes reviewed",
    /^Closes reviewed: (none|([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)?#[0-9]+(, ([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)?#[0-9]+)*)$/gm,
  ],
  ["Base reviewed", /^Base reviewed: \S+ at [0-9a-f]{40}$/gm],
  ["Title reviewed", /^Title reviewed: .+$/gm],
  ["Head reviewed", /^Head reviewed: [0-9a-f]{40}$/gm],
];
function reportLineProblem(body) {
  for (const [name, re] of REPORT_LINES) {
    // Every line with the prefix counts, well-formed or not: the workflow
    // reads them all, so a malformed one beside a valid one fails it.
    const prefixed = (body.match(new RegExp(`^${name}:`, "gm")) || []).length;
    const valid = (body.match(re) || []).length;
    if (prefixed !== 1 || valid !== 1)
      return `the report must carry exactly one plain "${name}: ..." line of its own, at the start of a line, not a list item and not bold (found ${prefixed} such line(s), ${valid} well-formed); the four lines are "Closes reviewed: none" (or the closed issues), "Base reviewed: <base branch> at <40-hex base_sha>", "Title reviewed: <the title verbatim>" and "Head reviewed: <40-hex head>"`;
  }
  return null;
}
// Who may put text in front of the reviewer and the triage bot. Anyone who
// can read the repository can comment on its pull requests and issues or
// open an issue, while the workflows admit only authors and actors with
// write access, and what the model reads shapes everything it posts. So a
// comment, review or inline comment, or a linked issue's title and body
// (review), or a comment on the triaged issue, another issue's title and
// body, or a title search or open_prs lists (triage), reaches the model
// only when its author has write access to this repository (admin or
// write; the permission field reports maintain as write, the same reading
// as the workflows' gates) or is a GitHub App (user type Bot), which only
// the account's owner or a repository admin can install; the triage bot's
// own plans are by github-actions[bot], an App. The rule is the same for a
// linked issue in another repository, judged by access to this one, since
// the job token cannot read access there. Any other item keeps its place
// with its text withheld, so the model knows it is there; a failed lookup
// withholds too.
const access = new Map();
function withheldReason(user) {
  if (!user || typeof user.login !== "string") return "the author is unknown";
  if (user.type === "Bot") return null;
  const login = user.login;
  if (!access.has(login)) {
    let reason = "the author's access could not be checked";
    // A login is letters, digits and dashes; a managed user's (Enterprise
    // Managed Users) adds an underscore and the enterprise's alphanumeric
    // shortcode (docs.github.com, "Username considerations for external
    // authentication", read 2026-10-22).
    if (/^[A-Za-z0-9-]+(_[A-Za-z0-9]+)?$/.test(login)) {
      try {
        const permission = getJson(`repos/${repo}/collaborators/${login}/permission`).permission;
        reason =
          permission === "admin" || permission === "write"
            ? null
            : `the author has ${permission} access, not write`;
      } catch (e) {
        if (/HTTP 404/.test(String(e.stderr))) reason = "the author has no access, not write";
      }
    }
    access.set(login, reason);
  }
  return access.get(login);
}
const screened = (fields) => (c) => {
  const item = fields(c);
  const reason = withheldReason(c.user);
  return reason ? { ...item, body: null, withheld: `${reason}; the body is not shown` } : item;
};
// A listing item whose title is the only text shown (search results, pull
// requests that mention an issue), screened the same way; open_prs also
// counts a closing pull request only when this finds no reason. A listing can
// name a hundred authors a page, so in a repository a user account owns,
// where only the owner and collaborators can hold write access, an author
// GitHub associates with it as neither is withheld without a lookup
// (author_association, GitHub's GraphQL schema CommentAuthorAssociation,
// read 2026-10-23). An organization's member whose membership is private
// may be reported as a contributor or none to a token that cannot see the
// membership, so an organization's repository, or one whose owner cannot
// be read, looks every author up.
let userOwned;
const ASSOCIATED = new Set(["OWNER", "COLLABORATOR"]);
function listedReason(i) {
  if (
    i.user &&
    i.user.type !== "Bot" &&
    typeof i.author_association === "string" &&
    !ASSOCIATED.has(i.author_association)
  ) {
    if (userOwned === undefined) {
      try {
        userOwned = getJson(`repos/${repo}`).owner.type === "User";
      } catch {
        userOwned = false;
      }
    }
    if (userOwned)
      return `the author is not a collaborator (${i.author_association.toLowerCase()}), not write`;
  }
  return withheldReason(i.user);
}
const titleScreened = (fields) => (i) => {
  const item = fields(i);
  const reason = listedReason(i);
  return reason ? { ...item, title: null, withheld: `${reason}; the title is not shown` } : item;
};
const reviewTools = {
  pr: {
    description:
      "The pull request: number, title, body, base (the branch this run diffs against, fixed when it started), base_sha (that branch's commit the diff is against, for the Base reviewed line), head (the commit this run checked out and diffs, for the Head reviewed line), live_head and live_base (the pull request's head and base now; when either differs, or the base moved in a way that changes the pull request's diff (its merge base with the head), or the pull request closed or went back to draft, the run is stale and post_report and inline_comment refuse), draft, author; a long body comes in pages.",
    schema: { type: "object", properties: { ...pageProp }, additionalProperties: false },
    run: ({ page }) => {
      const p = getJson(`repos/${repo}/pulls/${pr}`);
      return text(
        {
          number: p.number,
          title: p.title,
          body: p.body,
          base: env.BASE,
          base_sha: git(["rev-parse", `origin/${env.BASE}`]).trim(),
          head: env.HEAD_SHA,
          live_head: p.head.sha,
          live_base: p.base.ref,
          draft: p.draft,
          author: p.user.login,
          state: p.state,
        },
        page,
      );
    },
  },
  conversation: {
    description:
      "The pull request's issue comments (reports and discussion), oldest first, as many as fit a page; follow next_start until null.",
    schema: { type: "object", properties: { ...startProp }, additionalProperties: false },
    run: ({ start }) =>
      text(listing(`repos/${repo}/issues/${pr}/comments`, start, screened(commentFields))),
  },
  inline: {
    description:
      "The pull request's review comments (inline findings), oldest first, as many as fit a page; follow next_start until null.",
    schema: { type: "object", properties: { ...startProp }, additionalProperties: false },
    run: ({ start }) =>
      text(listing(`repos/${repo}/pulls/${pr}/comments`, start, screened(inlineFields))),
  },
  reviews: {
    description:
      "The pull request's reviews (state and body), as many as fit a page; follow next_start until null.",
    schema: { type: "object", properties: { ...startProp }, additionalProperties: false },
    run: ({ start }) =>
      text(
        listing(
          `repos/${repo}/pulls/${pr}/reviews`,
          start,
          screened((r) => ({
            id: r.id,
            author: r.user && r.user.login,
            state: r.state,
            submitted_at: r.submitted_at,
            body: r.body,
          })),
        ),
      ),
  },
  checks: {
    description:
      "Check runs on the pull request's head: name, status, conclusion; a long list comes in pages.",
    schema: { type: "object", properties: { ...pageProp }, additionalProperties: false },
    run: ({ page }) => {
      const head = getJson(`repos/${repo}/pulls/${pr}`).head.sha;
      const runs = JSON.parse(
        gh([
          "api",
          "--paginate",
          "--slurp",
          `repos/${repo}/commits/${head}/check-runs?per_page=100`,
        ]),
      ).flatMap((p) => p.check_runs || []);
      return text(
        runs.map((c) => ({ name: c.name, status: c.status, conclusion: c.conclusion })),
        page,
      );
    },
  },
  issue: {
    description:
      "An issue the body closes: title, body, labels, state; a long body comes in pages. repo defaults to this repository (owner/repo for another).",
    schema: {
      type: "object",
      properties: { number: { type: "integer" }, repo: { type: "string" }, ...pageProp },
      required: ["number"],
      additionalProperties: false,
    },
    run: ({ number, repo: r, page }) => {
      if (!Number.isInteger(number) || number <= 0)
        return fail("number must be a positive integer");
      if (r !== undefined && !repoName(r)) return fail("repo must be owner/repo");
      const i = getJson(`repos/${r || repo}/issues/${number}`);
      if (isPr(i)) return fail(`#${number} is a pull request, not an issue`);
      // An issue's author can edit its title and body at any time, so an
      // issue opened without write access is screened as a comment is.
      const reason = withheldReason(i.user);
      const item = {
        number: i.number,
        title: i.title,
        body: i.body,
        state: i.state,
        labels: (i.labels || []).map((l) => l.name),
        author: i.user && i.user.login,
      };
      return text(
        reason
          ? {
              ...item,
              title: null,
              body: null,
              withheld: `${reason}; the title and body are not shown`,
            }
          : item,
        page,
      );
    },
  },
  issue_comments: {
    description:
      "An issue's comments, oldest first, as many as fit a page (follow next_start until null); triage plans count only when author is github-actions[bot].",
    schema: {
      type: "object",
      properties: {
        number: { type: "integer" },
        repo: { type: "string" },
        ...startProp,
      },
      required: ["number"],
      additionalProperties: false,
    },
    run: ({ number, repo: r, start }) => {
      if (!Number.isInteger(number) || number <= 0)
        return fail("number must be a positive integer");
      if (r !== undefined && !repoName(r)) return fail("repo must be owner/repo");
      return text(
        listing(`repos/${r || repo}/issues/${number}/comments`, start, screened(commentFields)),
      );
    },
  },
  comment_body: {
    description:
      "One comment whole, in pages: kind issue (a conversation or issue comment), inline (a review comment) or review (a review's summary body, this pull request only), by id; repo defaults to this repository.",
    schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["issue", "inline", "review"] },
        id: { type: "integer" },
        repo: { type: "string" },
        ...pageProp,
      },
      required: ["kind", "id"],
      additionalProperties: false,
    },
    run: ({ kind, id, repo: r, page }) => {
      if (r !== undefined && !repoName(r)) return fail("repo must be owner/repo");
      if (kind === "review") {
        if (r !== undefined && r !== repo)
          return fail("review bodies are read on this pull request only");
        return commentBody(`repos/${repo}/pulls/${pr}/reviews`, id, page, true);
      }
      if (kind === "issue")
        return commentBody(`repos/${r || repo}/issues/comments`, id, page, true);
      if (kind === "inline")
        return commentBody(`repos/${r || repo}/pulls/comments`, id, page, true);
      return fail("kind must be issue, inline or review");
    },
  },
  files: {
    description:
      "Every file the pull request changes (git --attr-source=origin/<base> diff --no-ext-diff --no-textconv --numstat --no-renames origin/<base>...HEAD, so the base's .gitattributes decide what is binary, not the head's): added, deleted, path, a rename as its old path deleted and its new path added; read each with diff.",
    schema: { type: "object", properties: { ...pageProp }, additionalProperties: false },
    run: ({ page }) => {
      const base = `origin/${prBase()}`;
      return text(gitDiff(base, "diff", ["--numstat", "--no-renames", `${base}...HEAD`]), page);
    },
  },
  diff: {
    description:
      "The pull request's diff against its base (git --attr-source=origin/<base> diff --no-ext-diff --no-textconv origin/<base>...HEAD, so the base's .gitattributes decide what is binary, not the head's), optionally for one path; long output comes in numbered pages.",
    schema: {
      type: "object",
      properties: { path: { type: "string" }, ...pageProp },
      additionalProperties: false,
    },
    run: ({ path, page }) => {
      if (path !== undefined && !pathArg(path))
        return fail("path must be a relative path inside the checkout");
      const base = `origin/${prBase()}`;
      const args = [`${base}...HEAD`];
      if (path !== undefined) args.push("--", path);
      return text(gitDiff(base, "diff", args), page);
    },
  },
  show: {
    description:
      "A file at a ref (ref:path), or a commit's patch (ref alone, with the base's .gitattributes, as diff reads them). Refs: a sha, HEAD, or origin/<base>.",
    schema: {
      type: "object",
      properties: { ref: { type: "string" }, path: { type: "string" }, ...pageProp },
      required: ["ref"],
      additionalProperties: false,
    },
    run: ({ ref, path, page }) => {
      if (!refName(ref)) return fail("ref must be a sha, HEAD or origin/<branch>");
      if (path !== undefined && !pathArg(path))
        return fail("path must be a relative path inside the checkout");
      const target = path !== undefined ? `${ref}:${path}` : ref;
      return text(gitDiff(`origin/${prBase()}`, "show", [target]), page);
    },
  },
  log: {
    description: "git log --oneline for a range such as origin/<base>..HEAD or <sha>..<sha>.",
    schema: {
      type: "object",
      properties: { range: { type: "string" }, ...pageProp },
      required: ["range"],
      additionalProperties: false,
    },
    run: ({ range, page }) => {
      if (!rangeArg(range)) return fail("range must be <ref>..<ref>");
      return text(git(["log", "--oneline", "--no-decorate", range]), page);
    },
  },
  range_diff: {
    description:
      "git range-diff of two heads against the base, with the base's .gitattributes as diff reads them: shows whether a new head is a rebase only. When the base moved since the last report (a retarget, or a base commit that differs from its Base reviewed line), pass that report's base commit as old_base: the ranges are then old_base..old_head and the current base..new_head, so the same head twice shows what the base change did to the diff. Says so instead when the pull request's diff and commit messages are unchanged (with the changed messages in full and the series when only messages changed), when the base already holds every commit of new_head, or when the last reviewed range was empty; an old_base missing from the checkout is fetched by sha when a report on this pull request recorded it as its Base reviewed commit, and an old_head missing from it (a force-pushed head) is an error that says to run the full follow-up.",
    schema: {
      type: "object",
      properties: {
        old_head: { type: "string" },
        new_head: { type: "string" },
        old_base: {
          type: "string",
          description:
            "the base commit the last report reviewed against; defaults to the current base",
        },
        ...pageProp,
      },
      required: ["old_head", "new_head"],
      additionalProperties: false,
    },
    run: ({ old_head, new_head, old_base, page }) => {
      const sha = (h) => typeof h === "string" && /^[0-9a-f]{7,40}$/.test(h);
      if (![old_head, new_head].every(sha)) return fail("heads must be commit shas");
      if (old_base !== undefined && !sha(old_base)) return fail("old_base must be a commit sha");
      const base = `origin/${prBase()}`;
      const count = (range) => Number(git(["rev-list", "--count", range]).trim());
      // range-diff refuses an empty range ("need two commit ranges"). This
      // answer needs no old_base, so it comes before any fetch of one.
      if (count(`${base}..${new_head}`) === 0)
        return text(
          `${base}..${new_head} is empty: the base already contains every commit of ${new_head}, so the pull request changes nothing against its base.`,
        );
      // A head force-pushed since the last report is gone from the checkout,
      // and no ref is sure to reach it, so it is not fetched.
      if (!hasCommit(old_head))
        return fail(
          `old_head ${old_head} is not in the checkout (the head was force-pushed since the last report); the delta cannot be isolated, so run the full follow-up`,
        );
      if (old_base !== undefined && !hasCommit(old_base)) {
        const why = fetchReviewedBase(old_base);
        if (why)
          return fail(
            `old_base ${old_base} is not in the checkout and ${why}; the base change cannot be isolated, so run the full follow-up`,
          );
      }
      const from = old_base ?? base;
      const oldEmpty = count(`${from}..${old_head}`) === 0;
      // Two-dot ranges: a three-dot range would also hold the base's own
      // new commits when the base moved, and a rebase-only head would then
      // show them as removed patches.
      const series = () =>
        gitDiff(base, "range-diff", [`${from}..${old_head}`, `${base}..${new_head}`]);
      // range-diff compares patch series, so commits the base took in
      // (an empty commit, or two that cancel) show as removed even when the
      // pull request's diff is the same; compare the diffs themselves
      // first. Same diff and the same commit messages, but for commits the
      // base took in: nothing to review. A new, changed or dropped message
      // (a reword, a footer, a squash) still is, so the messages and the
      // series follow.
      // Each side with its base's attributes, as the reviewer read it.
      if (
        gitDiff(from, "diff", [`${from}...${old_head}`]) ===
        gitDiff(base, "diff", [`${base}...${new_head}`])
      ) {
        const same = `The pull request's diff is unchanged: git diff ${from}...${old_head} and git diff ${base}...${new_head}, each with its base's attributes, are byte-identical`;
        // Each new message matched against one old one; an old commit left
        // over was dropped or squashed away, unless the base now holds it.
        // -z ends each commit with a NUL, which git refuses in a message;
        // the sha is the first line. An entry without a well-formed sha
        // never matches and is never in the base, so it counts as changed.
        const commits = (range) =>
          git(["log", "-z", "--format=%H%n%B", range])
            .split("\0")
            .filter((c) => c.trim())
            .map((c) => {
              const nl = c.indexOf("\n");
              const sha = nl === -1 ? c : c.slice(0, nl);
              return {
                sha: /^[0-9a-f]{40}$/.test(sha) ? sha : null,
                message: nl === -1 ? "" : c.slice(nl + 1).trim(),
              };
            });
        const before = commits(`${from}..${old_head}`);
        const added = commits(`${base}..${new_head}`).filter(({ message }) => {
          const i = before.findIndex((c) => c.message === message);
          if (i === -1) return true;
          before.splice(i, 1);
          return false;
        });
        const inBase = (sha) => {
          if (sha === null) return false;
          try {
            git(["merge-base", "--is-ancestor", sha, base]);
            return true;
          } catch {
            return false;
          }
        };
        const dropped = before.filter((c) => !inBase(c.sha));
        if (added.length === 0 && dropped.length === 0)
          return text(
            `${same}, and the commit messages match the last reviewed range but for commits the base now holds, so only which commits the base holds changed.`,
          );
        // The messages in full: range-diff leaves merge commits out, and
        // the log tool gives subjects only.
        const listed = (cs) =>
          cs.length === 0
            ? "(none)"
            : cs
                .map(
                  (c) =>
                    `commit ${c.sha ?? "(unreadable sha)"}\n${c.message.replace(/^/gm, "    ")}`,
                )
                .join("\n\n");
        if (oldEmpty)
          return text(
            `${same}, but ${from}..${old_head} is empty: the last reviewed head added nothing to its base, so every commit in ${base}..${new_head} is new; review them in full:\n\n${listed(added)}`,
            page,
          );
        return text(
          `${same}, but commit messages changed: ${added.length} in ${base}..${new_head} new or changed, ${dropped.length} from the last reviewed range dropped or squashed away; review those messages.\n\nNew or changed in ${base}..${new_head}:\n\n${listed(added)}\n\nDropped or squashed away from ${from}..${old_head}:\n\n${listed(dropped)}\n\ngit range-diff (merge commits left out):\n\n${series()}`,
          page,
        );
      }
      if (oldEmpty)
        return text(
          `${from}..${old_head} is empty: the last reviewed head added nothing to its base, so every commit in ${base}..${new_head} is new; review the diff in full.`,
        );
      return text(series(), page);
    },
  },
  inline_comment: {
    description:
      "Post one finding as a review comment on a line of the reviewed head's diff (path and line as the diff shows them on the new side). It cannot edit or delete; a line outside the diff is refused by GitHub.",
    schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        line: { type: "integer" },
        body: { type: "string" },
      },
      required: ["path", "line", "body"],
      additionalProperties: false,
    },
    run: ({ path, line, body }) => {
      if (inlinePosted >= INLINE_LIMIT)
        return fail(
          `this run has posted ${INLINE_LIMIT} inline comments; put the rest in the report`,
        );
      if (!pathArg(path)) return fail("path must be a relative path inside the checkout");
      if (!Number.isInteger(line) || line < 1) return fail("line must be a positive integer");
      if (typeof body !== "string" || body.trim() === "")
        return fail("body must be non-empty text");
      const why = stale();
      if (why) return fail(why);
      const r = gh(
        [
          "api",
          "-X",
          "POST",
          `repos/${repo}/pulls/${pr}/comments`,
          "--input",
          "-",
          "--jq",
          ".html_url",
        ],
        JSON.stringify({ body, commit_id: env.HEAD_SHA, path, line, side: "RIGHT" }),
      );
      inlinePosted += 1;
      return text(`posted ${r}`);
    },
  },
  file_issue: {
    description: `Open one backlog issue, in the Task form's layout and labelled needs-operator (the operator triages it by hand; the triage bot does not read bot-authored issues), for a real finding outside this pull request's scope (pre-existing, in code the pull request does not touch or make worse), instead of reporting it as this pull request's finding. At most ${ISSUE_LIMIT} per run, one per finding ID per pull request (an issue already filed for it, open or closed, is returned instead, so a later round passes the ID the earlier report filed the problem under); refused once the run is stale, like post_report. Name each filed issue in the report.`,
    schema: {
      type: "object",
      properties: {
        finding: {
          type: "string",
          description:
            "the finding's ID, such as R2-03: the ID an earlier report filed the same problem under (its notes say `R1-03 filed as #57`), else this round's",
        },
        title: { type: "string", description: "one line, at most 120 characters" },
        outcome: { type: "string", description: "what is true when the issue is done" },
        acceptance: { type: "string", description: "checkable statements, as a task list" },
        references: {
          type: "string",
          description: "files, lines and sources the finding rests on",
        },
        out_of_scope: { type: "string" },
        size: { type: "string", enum: SIZES },
      },
      required: ["finding", "title", "outcome", "acceptance"],
      additionalProperties: false,
    },
    run: (args) => {
      const { finding, title, outcome, acceptance, references, out_of_scope, size } = args;
      if (typeof finding !== "string" || !FINDING_ID.test(finding))
        return fail("finding must be a finding ID such as R2-03");
      if (typeof title !== "string" || !title.trim() || title.length > 120 || /[\r\n]/.test(title))
        return fail("title must be one non-empty line of at most 120 characters");
      for (const [name, value] of Object.entries({ outcome, acceptance }))
        if (typeof value !== "string" || !value.trim())
          return fail(`${name} must be non-empty text`);
      for (const [name, value] of Object.entries({ references, out_of_scope }))
        if (value !== undefined && typeof value !== "string") return fail(`${name} must be text`);
      if (size !== undefined && !SIZES.includes(size))
        return fail(`size must be one of: ${SIZES.join("; ")}`);
      if (!filedByFinding) {
        const found = new Map();
        for (let page = 1; ; page++) {
          const raw = getPage(
            `repos/${repo}/issues?state=all&creator=${encodeURIComponent("github-actions[bot]")}`,
            page,
          );
          for (const i of raw) {
            if (isPr(i)) continue;
            for (const id of findingIdsIn(i.body || ""))
              if (!found.has(id)) found.set(id, `#${i.number} (${i.state}) ${i.html_url}`);
          }
          if (raw.length < 100) break;
        }
        filedByFinding = found;
      }
      const earlier = filedByFinding.get(finding);
      if (earlier) return text(`already filed for ${finding}: ${earlier}`);
      if (issuesFiled >= ISSUE_LIMIT)
        return fail(`this run has filed ${ISSUE_LIMIT} issues; name the rest in the report`);
      const why = stale();
      if (why) return fail(why);
      const r = gh(
        ["api", "-X", "POST", `repos/${repo}/issues`, "--input", "-", "--jq", ".html_url"],
        JSON.stringify({
          title: plain(title.trim()),
          body: taskBody({ outcome, acceptance, references, out_of_scope, size, finding }),
          labels: ["needs-operator"],
        }),
      );
      issuesFiled += 1;
      filedByFinding.set(finding, `${r} (open, filed by this run)`);
      return text(`filed ${r}`);
    },
  },
  post_report: {
    description:
      "Post the round's report as one comment on this pull request. Allowed once per run; it cannot edit or delete. The body must carry the four plain reviewed lines (Closes, Base, Title, Head reviewed), one each at the start of a line, or the post is refused. The server appends a hidden marker naming this workflow run, which the workflow's report check looks for (run id and attempt).",
    schema: {
      type: "object",
      properties: { body: { type: "string" } },
      required: ["body"],
      additionalProperties: false,
    },
    run: ({ body }) => {
      if (reportPosted) return fail("this run has already posted its report");
      if (typeof body !== "string" || body.trim() === "")
        return fail("body must be non-empty text");
      // Line endings as the workflow's grep reads them.
      body = body.replace(/\r\n?/g, "\n");
      const problem = reportLineProblem(body);
      if (problem) return fail(problem);
      // The Base reviewed line names the commit this run diffed against,
      // which range_diff may later fetch by sha, so no other commit.
      const diffedBase = `${env.BASE} at ${git(["rev-parse", `origin/${env.BASE}`]).trim()}`;
      const named = /^Base reviewed: (.+)$/m.exec(body)[1];
      if (named !== diffedBase)
        return fail(
          `the Base reviewed line must read "Base reviewed: ${diffedBase}" (the pr tool's base and base_sha), not "Base reviewed: ${named}"`,
        );
      // The workflow checks the report's head and base lines against the
      // live pull request, so a stale run must end without a report.
      const why = stale();
      if (why) return fail(why);
      const r = gh(
        [
          "api",
          "-X",
          "POST",
          `repos/${repo}/issues/${pr}/comments`,
          "-F",
          "body=@-",
          "--jq",
          ".html_url",
        ],
        `${body.trimEnd()}\n\n<!-- pr-review run ${env.GITHUB_RUN_ID}.${env.GITHUB_RUN_ATTEMPT} -->\n`,
      );
      // Set once the post succeeded (calls run one at a time), so a
      // rejected request can be retried without a duplicate.
      reportPosted = true;
      return text(`posted ${r}`);
    },
  },
};

// ---------- triage mode ----------
const n = env.TRIAGE_ISSUE;
const event = env.TRIAGE_EVENT;
let commentPosted = false;
const dispatched = new Set();
// The issues API serves pull requests too; a dispatched number that names
// one is refused before any read or write.
function issue() {
  const i = getJson(`repos/${repo}/issues/${n}`);
  if (isPr(i)) throw new Error(`#${n} is a pull request, not an issue; nothing done`);
  return i;
}
function ensureOpen() {
  const state = issue().state;
  if (state !== "open") throw new Error(`issue #${n} is ${state}; nothing written`);
}
const hasLabel = (i, name) => (i.labels || []).some((l) => l.name === name);
// When the body was last edited (lastEditedAt, GraphQL), the issue last
// reopened or retitled (timeline), and when agent:approved was last applied
// (timeline); any of the three later than the approval means it covers an
// older scope (the run for that event may have been cancelled by a later
// one or never happened). Errors propagate: never "false" by default.
function editedAfterApproval() {
  const [owner, name] = repo.split("/");
  const q =
    "query($o: String!, $r: String!, $n: Int!) { repository(owner: $o, name: $r) { issue(number: $n) { lastEditedAt } } }";
  const lastEdited =
    JSON.parse(
      gh([
        "api",
        "graphql",
        "-f",
        `query=${q}`,
        "-f",
        `o=${owner}`,
        "-f",
        `r=${name}`,
        "-F",
        `n=${n}`,
      ]),
    ).data.repository.issue.lastEditedAt || "";
  const events = JSON.parse(
    gh(["api", "--paginate", "--slurp", `repos/${repo}/issues/${n}/timeline?per_page=100`]),
  ).flat();
  const approvals = events
    .filter((e) => e.event === "labeled" && e.label && e.label.name === "agent:approved")
    .map((e) => e.created_at);
  const approvedAt = approvals.length ? approvals[approvals.length - 1] : "";
  const latest = (type) => {
    const at = events.filter((e) => e.event === type).map((e) => e.created_at);
    return at.length ? at[at.length - 1] : "";
  };
  const reopenedAt = latest("reopened");
  const renamedAt = latest("renamed");
  const changedAt = [lastEdited, reopenedAt, renamedAt].filter(Boolean).sort().pop() || "";
  const updatedAt = issue().updated_at;
  return {
    last_edited_at: lastEdited,
    reopened_at: reopenedAt,
    renamed_at: renamedAt,
    approved_at: approvedAt,
    // Equal counts as after: timestamps have seconds, so a change in the
    // approval's second may follow it, and a reset is the safe reading.
    edited_after_approval: Boolean(approvedAt && changedAt && changedAt >= approvedAt),
    updated_at: updatedAt,
    idle_days: Math.floor((Date.now() - Date.parse(updatedAt)) / 86400000),
  };
}
// Search results (100 an API page, 1,000 at most per query), served like
// the other listings: by size from a start index, with next_start. A
// search GitHub cut short (incomplete_results, on a timeout) fails rather
// than passing part of the matches off as the whole.
function search(q, start, project) {
  const from = Number.isInteger(start) && start >= 0 ? start : 0;
  if (from >= 1000) return { start: from, count: 0, next_start: null, truncated: true, items: [] };
  // The API serves at most 1,000 results (10 pages) for a query: a page
  // past that fails, so the listing ends there and says so.
  const r = paged(
    (page) =>
      page > 10
        ? []
        : (() => {
            const r = JSON.parse(
              gh([
                "api",
                "--method",
                "GET",
                `search/issues?per_page=100&page=${page}`,
                "-f",
                `q=${q}`,
              ]),
            );
            if (r.incomplete_results)
              throw new Error(
                "GitHub cut the search short (incomplete_results: it timed out); the listing would be partial, call again",
              );
            return r.items || [];
          })(),
    from,
    project,
  );
  if (r.next_start !== null && r.next_start >= 1000) r.next_start = null;
  if (r.next_start === null && from + r.count >= 1000) r.truncated = true;
  return r;
}
// Whether a body closes issue #n of this repository, as GitHub links it:
// a closing keyword, an optional colon, then "#n", "owner/repo#n" or the
// issue URL (the same forms the review workflow parses). GitHub honours
// the keyword only on a pull request into the default branch, which the
// caller checks.
function closesIssue(body, number) {
  const r = repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `\\b(close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved):?\\s+((${r})?#|https://github\\.com/${r}/issues/)${number}\\b`,
    "i",
  ).test(body || "");
}
const triageTools = {
  view: {
    description:
      "This run's issue: title, body, labels, state, author, author_type; a long body comes in pages.",
    schema: { type: "object", properties: { ...pageProp }, additionalProperties: false },
    run: ({ page }) => {
      const i = issue();
      return text(
        {
          number: i.number,
          title: i.title,
          body: i.body,
          state: i.state,
          labels: (i.labels || []).map((l) => l.name),
          author: i.user && i.user.login,
          author_type: i.user && i.user.type,
          assignees: (i.assignees || []).map((a) => a.login),
        },
        page,
      );
    },
  },
  comments: {
    description:
      "This run's issue comments, oldest first, as many as fit a page (follow next_start until null); plans count only when author is github-actions[bot]. A comment by an author without write access, other than a GitHub App, is listed with its body withheld.",
    schema: { type: "object", properties: { ...startProp }, additionalProperties: false },
    run: ({ start }) =>
      text(listing(`repos/${repo}/issues/${n}/comments`, start, screened(commentFields))),
  },
  comment_body: {
    description: "One comment of this repository whole, in pages, by id (kind issue).",
    schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["issue"] },
        id: { type: "integer" },
        ...pageProp,
      },
      required: ["kind", "id"],
      additionalProperties: false,
    },
    run: ({ kind, id, page }) =>
      kind === "issue"
        ? commentBody(`repos/${repo}/issues/comments`, id, page, true)
        : fail("kind must be issue"),
  },
  search: {
    description:
      "Open issues of this repository matching search terms (for duplicate and related checks): number, title, labels, author, as many as fit a page; follow next_start until null (truncated: true means GitHub's 1,000-result cap was reached). An issue opened by an author without write access (a GitHub App aside) keeps its place with its title withheld and the reason. A search GitHub cuts short fails instead of returning part of the matches.",
    schema: {
      type: "object",
      properties: { terms: { type: "string" }, ...startProp },
      required: ["terms"],
      additionalProperties: false,
    },
    run: ({ terms, start }) => {
      if (typeof terms !== "string" || terms.trim() === "")
        return fail("terms must be non-empty text");
      return text(
        search(
          `repo:${repo} is:issue is:open ${terms}`,
          start,
          titleScreened((i) => ({
            number: i.number,
            title: i.title,
            labels: (i.labels || []).map((l) => l.name),
            author: i.user && i.user.login,
          })),
        ),
      );
    },
  },
  read_issue: {
    description:
      "Another issue of this repository (one search returned): title, body, labels, state, author; a long body comes in pages. An issue opened by an author without write access (a GitHub App aside) has its title and body withheld, with the reason.",
    schema: {
      type: "object",
      properties: { number: { type: "integer" }, ...pageProp },
      required: ["number"],
      additionalProperties: false,
    },
    run: ({ number, page }) => {
      if (!Number.isInteger(number) || number <= 0)
        return fail("number must be a positive integer");
      const i = getJson(`repos/${repo}/issues/${number}`);
      if (isPr(i)) return fail(`#${number} is a pull request, not an issue`);
      // Anyone who can read the repository can open an issue a search
      // turns up, so it is screened as review mode's issue tool screens one.
      const reason = withheldReason(i.user);
      const item = {
        number: i.number,
        title: i.title,
        body: i.body,
        state: i.state,
        labels: (i.labels || []).map((l) => l.name),
        author: i.user && i.user.login,
      };
      return text(
        reason
          ? {
              ...item,
              title: null,
              body: null,
              withheld: `${reason}; the title and body are not shown`,
            }
          : item,
        page,
      );
    },
  },
  open_prs: {
    description:
      "Open pull requests whose title or body mentions this issue's number (#n or its URL), read from every open pull request of the repository, as many as fit a page (follow next_start until null); closes_this_issue says whether the body closes it with a closing keyword and the pull request targets the default branch, as GitHub links it, and counts only a pull request opened by an author with write access or a GitHub App. A pull request opened by an author without write access (a GitHub App aside), a fork's included, keeps its place with its title withheld and the reason, and never closes the issue here.",
    schema: { type: "object", properties: { ...startProp }, additionalProperties: false },
    run: ({ start }) => {
      const defaultBranch = getJson(`repos/${repo}`).default_branch;
      // Every open pull request, page by page, filtered here: the base is
      // in each listing item, so no call per hit.
      // This repository's forms only: a bare #n, owner/repo#n for this
      // repository, or its issue URL; another repository's #n is not one.
      const r = repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const mention = new RegExp(
        `(?<![A-Za-z0-9_./-])(${r})?#${n}(?![0-9])|github\\.com/${r}/issues/${n}(?![0-9])`,
        "i",
      );
      const hits = [];
      for (let page = 1; ; page++) {
        const raw = getPage(`repos/${repo}/pulls?state=open`, page);
        for (const p of raw) if (mention.test(`${p.title}\n${p.body || ""}`)) hits.push(p);
        if (raw.length < 100) break;
      }
      return text(
        paged(
          (page) => hits.slice((page - 1) * 100, page * 100),
          start,
          titleScreened((p) => ({
            number: p.number,
            title: p.title,
            base: p.base.ref,
            author: p.user && p.user.login,
            // Only an author with write access, or an App, can stand for
            // a claim: anyone can write a closing keyword in a body. The
            // lookup comes last and is cached, as the title's screening
            // makes the same one.
            closes_this_issue:
              p.base.ref === defaultBranch && closesIssue(p.body, n) && listedReason(p) === null,
          })),
        ),
      );
    },
  },
  info: {
    description:
      "When the body was last edited, the issue last reopened and retitled, and when agent:approved was last applied (edited_after_approval: one of the three postdates the approval, so it covers an older scope), and when the issue last changed (idle_days: an in-progress claim is stale from 7).",
    schema: { type: "object", properties: {}, additionalProperties: false },
    run: () => text(editedAfterApproval()),
  },
  add_label: {
    description: `Add one label from the bot's set: ${LABELS_ADD.join(", ")}.`,
    schema: {
      type: "object",
      properties: { label: { type: "string" } },
      required: ["label"],
      additionalProperties: false,
    },
    run: ({ label }) => {
      if (!LABELS_ADD.includes(label)) return fail(`the bot may not add '${label}'`);
      ensureOpen();
      gh(["issue", "edit", n, "--repo", repo, "--add-label", label]);
      return text(`added ${label}`);
    },
  },
  remove_label: {
    description:
      "Remove one label: any of the bot's set or needs-triage; ready and agent:approved only on a run the operator started for a fresh triage (edited, reopened, labeled, or a dispatch of an issue carrying needs-triage) or when the issue was edited, reopened or retitled after the approval; in-progress only after a reopen.",
    schema: {
      type: "object",
      properties: { label: { type: "string" } },
      required: ["label"],
      additionalProperties: false,
    },
    run: ({ label }) => {
      if (LABELS_RESET.includes(label)) {
        // A needs-triage label is the operator asking for a fresh plan; the
        // approval of the old one goes with it (as after an edit or a
        // reopen), since a plan newer than the approval cannot be claimed.
        const retriage =
          ["edited", "reopened", "labeled"].includes(event) ||
          (event === "dispatch" && hasLabel(issue(), "needs-triage"));
        if (!retriage && !editedAfterApproval().edited_after_approval)
          return fail(
            `'${label}' may only go on a run the operator started for a fresh triage (edited, reopened, labeled, or a dispatch of an issue carrying needs-triage), or when the issue was edited, reopened or retitled after the approval; not on '${event}' here`,
          );
      } else if (label === "in-progress") {
        if (event !== "reopened")
          return fail(`'in-progress' may only go after a reopen, not on '${event}'`);
      } else if (!LABELS_REMOVE.includes(label)) {
        return fail(`the bot may not remove '${label}'`);
      }
      ensureOpen();
      gh(["issue", "edit", n, "--repo", repo, "--remove-label", label]);
      return text(`removed ${label}`);
    },
  },
  comment: {
    description:
      "Post this run's one comment on the issue. Allowed once per run; it cannot edit or delete. The server appends a hidden marker naming this workflow run, which the workflow's state check looks for (run id and attempt).",
    schema: {
      type: "object",
      properties: { body: { type: "string" } },
      required: ["body"],
      additionalProperties: false,
    },
    run: ({ body }) => {
      if (commentPosted) return fail("this run has already posted its one comment");
      if (typeof body !== "string" || body.trim() === "")
        return fail("body must be non-empty text");
      ensureOpen();
      const r = gh(
        [
          "api",
          "-X",
          "POST",
          `repos/${repo}/issues/${n}/comments`,
          "-F",
          "body=@-",
          "--jq",
          ".html_url",
        ],
        `${body.trimEnd()}\n\n<!-- issue-triage run ${env.GITHUB_RUN_ID}.${env.GITHUB_RUN_ATTEMPT} -->\n`,
      );
      // Set once the post succeeded, so a rejected request can be retried.
      commentPosted = true;
      return text(`posted ${r}`);
    },
  },
};
const sweepTools = {
  list_eligible: {
    description: "The issue numbers this sweep dispatches, computed by the workflow.",
    schema: { type: "object", properties: {}, additionalProperties: false },
    run: () => text(fs.readFileSync(env.ELIGIBLE_ISSUES, "utf8").split("\n").filter(Boolean)),
  },
  dispatch: {
    description: "Start one issue-triage run for one eligible issue on this branch, once.",
    schema: {
      type: "object",
      properties: { number: { type: "integer" } },
      required: ["number"],
      additionalProperties: false,
    },
    run: ({ number }) => {
      if (!Number.isInteger(number) || number <= 0)
        return fail("number must be a positive integer");
      const eligible = fs.readFileSync(env.ELIGIBLE_ISSUES, "utf8").split("\n").filter(Boolean);
      if (!eligible.includes(String(number)))
        return fail(`#${number} is not in this sweep's eligible list`);
      if (dispatched.has(number)) return fail(`#${number} was already dispatched by this sweep`);
      // The list was computed when the sweep started; the eligibility it
      // used (open, and needs-triage, or no state label, or an in-progress
      // claim idle for 7 days) is checked again now, so an issue closed,
      // triaged by its own event run, or claimed since is left alone (and
      // recorded as handled).
      const i = getJson(`repos/${repo}/issues/${number}`);
      const labels = (i.labels || []).map((l) => l.name);
      const idleDays = Math.floor((Date.now() - Date.parse(i.updated_at)) / 86400000);
      const state = labels.filter((l) => STATE_LABELS.includes(l));
      const stillEligible =
        i.state === "open" &&
        (labels.includes("needs-triage") ||
          state.length === 0 ||
          (labels.includes("in-progress") && idleDays >= 7));
      const skip = stillEligible
        ? null
        : i.state !== "open"
          ? `#${number} is ${i.state}`
          : labels.includes("in-progress")
            ? `#${number} was claimed ${idleDays} day(s) ago, after the sweep listed it`
            : `#${number} now carries ${state.join(", ")}, since the sweep listed it`;
      if (skip) {
        dispatched.add(number);
        fs.appendFileSync(env.DISPATCH_LOG, `${number}\n`);
        return text(`not dispatched: ${skip}`);
      }
      gh([
        "workflow",
        "run",
        "issue-triage.yml",
        "--repo",
        repo,
        "--ref",
        env.GITHUB_REF_NAME,
        "-f",
        `issue=${number}`,
      ]);
      // Recorded only after gh succeeded, so a failed call can be retried.
      dispatched.add(number);
      fs.appendFileSync(env.DISPATCH_LOG, `${number}\n`);
      return text(`dispatched issue-triage.yml for #${number} on ${env.GITHUB_REF_NAME}`);
    },
  },
};

let tools;
if (mode === "review") {
  if (
    !digits(pr) ||
    !repoName(repo) ||
    !/^[0-9a-f]{40}$/.test(env.HEAD_SHA || "") ||
    !env.BASE ||
    !digits(env.GITHUB_RUN_ID) ||
    !digits(env.GITHUB_RUN_ATTEMPT)
  )
    throw new Error(
      "review mode needs PR, GITHUB_REPOSITORY, HEAD_SHA (40 hex), BASE, GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT",
    );
  tools = reviewTools;
} else if (mode === "triage") {
  if (
    !digits(n) ||
    !repoName(repo) ||
    !digits(env.GITHUB_RUN_ID) ||
    !digits(env.GITHUB_RUN_ATTEMPT)
  )
    throw new Error(
      "triage mode needs TRIAGE_ISSUE, GITHUB_REPOSITORY, GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT",
    );
  tools = triageTools;
} else if (mode === "sweep") {
  if (!repoName(repo) || !env.ELIGIBLE_ISSUES || !env.DISPATCH_LOG || !env.GITHUB_REF_NAME)
    throw new Error(
      "sweep mode needs GITHUB_REPOSITORY, ELIGIBLE_ISSUES, DISPATCH_LOG and GITHUB_REF_NAME",
    );
  tools = sweepTools;
} else {
  throw new Error("usage: mcp-server.mjs review | triage | sweep");
}

// ---------- JSON-RPC over stdio ----------
function reply(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}
function replyError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");
}
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = msg;
  if (method === "initialize") {
    reply(id, {
      protocolVersion: (params && params.protocolVersion) || "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "agent-kit", version: "1" },
    });
  } else if (method === "notifications/initialized" || method === "ping") {
    if (id !== undefined) reply(id, {});
  } else if (method === "tools/list") {
    reply(id, {
      tools: Object.entries(tools).map(([name, t]) => ({
        name,
        description: t.description,
        inputSchema: t.schema,
      })),
    });
  } else if (method === "tools/call") {
    const name = params && params.name;
    const t = tools[name];
    if (!t) return replyError(id, -32602, `unknown tool ${name}`);
    try {
      reply(id, t.run(params.arguments || {}));
    } catch (e) {
      // gh prints the API's message (a 422's reason, for one) on stderr,
      // where the model can act on it; the exception's own first line
      // only names the command.
      const stderr =
        typeof e.stderr === "string"
          ? e.stderr
              .trim()
              .replace(/\s*\n\s*/g, "; ")
              .slice(-400)
          : "";
      reply(id, fail(`${name} failed: ${stderr || e.message.split("\n")[0]}`));
    }
  } else if (id !== undefined) {
    replyError(id, -32601, `unknown method ${method}`);
  }
});

// A GitHub Actions expression evaluator for the conditions a workflow's
// if: lines hold, so a test can check which events and states run a job or
// a step without a runner. It follows the expressions reference
// (docs.github.com, "Evaluate expressions in workflows and actions", read
// 2026-11-26): null, boolean, number and single-quoted string literals;
// ( ) [ ] . ! < <= > >= == != && ||; loose equality that ignores case for
// strings and turns mismatched types into numbers (null 0, true 1, false 0,
// a string its JSON number or NaN, '' 0, an array or object NaN); falsy
// false, 0, -0, '', null; contains, startsWith and endsWith ignoring case;
// fromJSON; and the status functions, with success() && applied in front of
// an if: that names none of them. Function names ignore case. A missing
// property reads as null.
import fs from "node:fs";
import path from "node:path";
import { root } from "./server.mjs";

function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (c === "'") {
      let s = "";
      for (i++; ; i++) {
        if (i >= src.length) throw new Error(`unterminated string in ${src}`);
        if (src[i] === "'") {
          if (src[i + 1] === "'") {
            s += "'";
            i++;
          } else break;
        } else s += src[i];
      }
      i++;
      toks.push({ t: "str", v: s });
    } else if (/[0-9]/.test(c) || (c === "-" && /[0-9]/.test(src[i + 1] ?? ""))) {
      const m = src.slice(i).match(/^-?(0x[0-9a-f]+|[0-9]+(\.[0-9]+)?(e[-+]?[0-9]+)?)/i);
      toks.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
    } else if (/[A-Za-z_]/.test(c)) {
      const m = src.slice(i).match(/^[A-Za-z_][A-Za-z0-9_-]*/);
      toks.push({ t: "id", v: m[0] });
      i += m[0].length;
    } else {
      const op = ["&&", "||", "==", "!=", "<=", ">="].find((o) => src.startsWith(o, i)) ?? c;
      if (op.length === 1 && !"()[].!<>,*".includes(op))
        throw new Error(`unexpected ${op} in ${src}`);
      toks.push({ t: "op", v: op });
      i += op.length;
    }
  }
  return toks;
}

const STATUS = new Set(["success", "always", "cancelled", "failure"]);

// Parse to a function of the context; usesStatus says whether a status
// function appears.
function parse(src) {
  const toks = tokenize(src);
  let p = 0;
  let usesStatus = false;
  const peek = (v) => toks[p] && toks[p].v === v && toks[p].t === "op";
  const eat = (v) => {
    if (!peek(v)) throw new Error(`expected ${v} at token ${p} in ${src}`);
    p++;
  };
  const or = () => {
    let l = and();
    while (peek("||")) {
      p++;
      const a = l,
        b = and();
      l = (ctx) => (truthy(a(ctx)) ? a(ctx) : b(ctx));
    }
    return l;
  };
  const and = () => {
    let l = cmp();
    while (peek("&&")) {
      p++;
      const a = l,
        b = cmp();
      l = (ctx) => (truthy(a(ctx)) ? b(ctx) : a(ctx));
    }
    return l;
  };
  const cmp = () => {
    let l = unary();
    while (toks[p]?.t === "op" && ["==", "!=", "<", "<=", ">", ">="].includes(toks[p].v)) {
      const op = toks[p++].v;
      const a = l,
        b = unary();
      l = (ctx) => compare(op, a(ctx), b(ctx));
    }
    return l;
  };
  const unary = () => {
    if (peek("!")) {
      p++;
      const a = unary();
      return (ctx) => !truthy(a(ctx));
    }
    return postfix();
  };
  const postfix = () => {
    let v = primary();
    for (;;) {
      if (peek(".")) {
        p++;
        const tok = toks[p++];
        if (tok.v === "*") {
          const a = v;
          v = (ctx) => {
            const o = a(ctx);
            if (Array.isArray(o) && o[FILTERED]) return index(o, WILDCARD);
            return filtered(o && typeof o === "object" ? Object.values(o) : []);
          };
          continue;
        }
        const key = tok.v,
          a = v;
        v = (ctx) => prop(a(ctx), key);
      } else if (peek("[")) {
        p++;
        const k = or();
        eat("]");
        const a = v;
        v = (ctx) => prop(a(ctx), k(ctx));
      } else return v;
    }
  };
  const primary = () => {
    const tok = toks[p++];
    if (!tok) throw new Error(`unexpected end of ${src}`);
    if (tok.t === "str" || tok.t === "num") return () => tok.v;
    if (tok.t === "op" && tok.v === "(") {
      const e = or();
      eat(")");
      return e;
    }
    if (tok.t !== "id") throw new Error(`unexpected ${tok.v} in ${src}`);
    if (tok.v === "true") return () => true;
    if (tok.v === "false") return () => false;
    if (tok.v === "null") return () => null;
    if (peek("(")) {
      p++;
      const args = [];
      while (!peek(")")) {
        args.push(or());
        if (peek(",")) p++;
      }
      eat(")");
      const name = tok.v.toLowerCase();
      if (STATUS.has(name)) usesStatus = true;
      return (ctx) =>
        call(
          name,
          args.map((a) => a(ctx)),
          ctx,
        );
    }
    return (ctx) => prop(ctx, tok.v);
  };
  const fn = or();
  if (p !== toks.length) throw new Error(`trailing tokens in ${src}`);
  return { fn, usesStatus };
}

// An object filter's result (labels.*.name): an index after it is applied
// to each item, as the reference's fruits.*.name example shows (read
// 2026-11-28). As the runner does it (actions/runner,
// src/Sdk/DTExpressions2/Expressions2/Sdk/Operators/Index.cs,
// HandleFilteredArray, read 2026-11-28): a name keeps each object item's
// value when the item has the property, a null value included, and skips
// the rest; a number keeps each array item's element at that index; a
// wildcard adds every value of each object or array item; an item that is
// neither is skipped.
const FILTERED = Symbol("filtered");
const WILDCARD = Symbol("wildcard");
function filtered(a) {
  a[FILTERED] = true;
  return a;
}

function index(a, k) {
  const out = [];
  for (const x of a) {
    if (x === null || x === undefined || typeof x !== "object") continue;
    if (k === WILDCARD) out.push(...(Array.isArray(x) ? x : Object.values(x)).filter((v) => v !== undefined));
    else if (Array.isArray(x)) {
      if (typeof k === "number" && Number.isInteger(k) && k >= 0 && k < x.length) out.push(x[k]);
    } else if (typeof k === "string") {
      const key = Object.keys(x).find((y) => y.toLowerCase() === k.toLowerCase());
      if (key !== undefined && x[key] !== undefined) out.push(x[key]);
    }
  }
  return filtered(out);
}

function prop(o, k) {
  if (Array.isArray(o) && o[FILTERED]) return index(o, k);
  if (o === null || o === undefined || typeof o !== "object") return null;
  const key =
    typeof k === "string" ? Object.keys(o).find((x) => x.toLowerCase() === k.toLowerCase()) : k;
  return key === undefined || o[key] === undefined ? null : o[key];
}

export function truthy(v) {
  return !(v === false || v === 0 || v === "" || v === null || v === undefined || Number.isNaN(v));
}

function toNumber(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    if (v.trim() === "") return 0;
    try {
      const n = JSON.parse(v);
      return typeof n === "number" ? n : NaN;
    } catch {
      return /^0x[0-9a-f]+$/i.test(v) ? Number(v) : NaN;
    }
  }
  return NaN;
}

function compare(op, a, b) {
  let x = a,
    y = b;
  if (typeof x === "string" && typeof y === "string") {
    x = x.toLowerCase();
    y = y.toLowerCase();
  } else if (typeof x === "object" && x !== null && typeof y === "object" && y !== null) {
    if (op === "==") return x === y;
    if (op === "!=") return x !== y;
    return false;
  } else if (typeof x !== typeof y || x === null || y === null) {
    x = toNumber(x);
    y = toNumber(y);
  }
  switch (op) {
    case "==":
      return x === y;
    case "!=":
      return x !== y;
    case "<":
      return x < y;
    case "<=":
      return x <= y;
    case ">":
      return x > y;
    case ">=":
      return x >= y;
  }
}

const str = (v) =>
  v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);

function call(name, args, ctx) {
  const status = ctx.status ?? "success";
  switch (name) {
    case "success":
      return status === "success";
    case "failure":
      return status === "failure";
    case "cancelled":
      return status === "cancelled";
    case "always":
      return true;
    case "contains":
      return Array.isArray(args[0])
        ? args[0].some((x) => compare("==", x, args[1]))
        : str(args[0]).toLowerCase().includes(str(args[1]).toLowerCase());
    case "startswith":
      return str(args[0]).toLowerCase().startsWith(str(args[1]).toLowerCase());
    case "endswith":
      return str(args[0]).toLowerCase().endsWith(str(args[1]).toLowerCase());
    case "fromjson":
      return JSON.parse(str(args[0]));
    case "tojson":
      return JSON.stringify(args[0], null, 2);
    case "format":
      return str(args[0]).replace(/\{(\d+)\}/g, (_, n) => str(args[Number(n) + 1]));
    default:
      throw new Error(`function ${name} is not modelled`);
  }
}

// Whether an if: runs with this context: { github, env, needs, steps,
// inputs, vars, status: 'success' | 'failure' | 'cancelled' }. The ${{ }}
// wrapper is optional, as in an if:.
export function runs(condition, ctx) {
  const src = condition.trim().replace(/^\$\{\{([\s\S]*)\}\}$/, "$1");
  const { fn, usesStatus } = parse(src);
  // Without a status function the runner evaluates success() && (...),
  // which short-circuits before the condition is read.
  if (!usesStatus && (ctx.status ?? "success") !== "success") return false;
  return truthy(fn(ctx));
}

// What a ${{ }} value gives as a job output, which is a string: null
// gives "", as for an output the step never wrote.
export function value(expression, ctx) {
  const src = expression.trim().replace(/^\$\{\{([\s\S]*)\}\}$/, "$1");
  const v = parse(src).fn(ctx);
  return v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
}

// A job's outputs: mapping in .github/workflows/<file>, { name: value }.
export function jobOutputs(file, job) {
  const lines = fs.readFileSync(path.join(root, ".github/workflows", file), "utf8").split("\n");
  const at = lines.indexOf(`  ${job}:`);
  if (at < 0) throw new Error(`no job ${job} in ${file}`);
  const out = {};
  let j = at + 1;
  while (j < lines.length && !/^ {2}\S/.test(lines[j]) && lines[j] !== "    outputs:") j++;
  if (lines[j] !== "    outputs:") return out;
  for (j++; j < lines.length && (/^ {6}\S/.test(lines[j]) || lines[j].trim() === ""); j++) {
    const m = lines[j].match(/^ {6}([A-Za-z0-9_-]+): (.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

// The if: of a job (by id), a step (by name) or the first step that uses an
// action (by the start of its uses:) in .github/workflows/<file>, folded to
// one line; "" when it has none.
export function ifOf(file, { job, step, uses }) {
  const lines = fs.readFileSync(path.join(root, ".github/workflows", file), "utf8").split("\n");
  let i;
  let indent;
  if (job) {
    i = lines.findIndex((l) => l === `  ${job}:`);
    indent = 4;
  } else if (uses) {
    i = lines.findIndex((l) => l.trim().startsWith(`- uses: ${uses}`));
    indent = i < 0 ? 0 : lines[i].match(/^\s*/)[0].length + 2;
  } else {
    i = lines.findIndex(
      (l, n) =>
        l.trim() === `- name: ${step}` ||
        (l.trim() === `name: ${step}` && /^\s+- id:/.test(lines[n - 1] ?? "")),
    );
    indent = lines[i]?.match(/^\s*/)[0].length + (lines[i]?.trim().startsWith("- ") ? 2 : 0);
  }
  if (i < 0) throw new Error(`no ${job ? `job ${job}` : uses ? `step using ${uses}` : `step ${step}`} in ${file}`);
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j];
    const ind = l.match(/^\s*/)[0].length;
    if (l.trim() !== "" && ind < indent) break;
    if (l.trim().startsWith("- ") && ind <= indent) break;
    if (ind === indent && l.trim().startsWith("if: ")) {
      const v = l.trim().slice(4);
      if (v !== ">-" && v !== ">") return v;
      const parts = [];
      for (
        let k = j + 1;
        k < lines.length && (lines[k].match(/^\s*/)[0].length > indent || lines[k].trim() === "");
        k++
      )
        parts.push(lines[k].trim());
      return parts.join(" ").trim();
    }
  }
  return "";
}

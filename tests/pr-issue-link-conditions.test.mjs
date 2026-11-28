// Which pull requests and states run each pr-issue-link job and step: every
// if: in pr-issue-link.yml, evaluated as GitHub evaluates it.
import assert from "node:assert/strict";
import test from "node:test";
import { ifOf, runs } from "./helpers/expression.mjs";

function check(file, where, cases) {
  const condition = ifOf(file, where);
  assert.notEqual(condition, "", `${JSON.stringify(where)} has an if:`);
  for (const [name, c, want] of cases) {
    assert.equal(runs(condition, c), want, `${file} ${where.job ?? where.step}: ${name} should ${want ? "run" : "be skipped"}`);
  }
}

const pr = (login, type, head_ref = "fix/1-x") => ({
  github: { head_ref, event: { pull_request: { user: { login, type } } } },
});

test("pr-issue-link: the settings job skips Dependabot's and Release Please's pull requests", () => {
  check("pr-issue-link.yml", { job: "settings" }, [
    ["a person's", pr("dev", "User"), true],
    ["Dependabot's", pr("dependabot[bot]", "Bot"), false],
    ["Release Please's", pr("rp[bot]", "Bot", "release-please--branches--main"), false],
    ["a person's release-please-- branch", pr("dev", "User", "release-please--x"), true],
    ["a bot's other branch", pr("x[bot]", "Bot"), true],
  ]);
});

test("pr-issue-link: the link job runs while the check is on, and when the settings failed", () => {
  const settings = (result, on, status) => ({
    needs: { settings: { result, outputs: on === undefined ? {} : { KIT_ISSUE_LINK_CHECK: on } } },
    status,
  });
  check("pr-issue-link.yml", { job: "link" }, [
    ["on", settings("success", "on"), true],
    ["off", settings("success", "off"), false],
    ["the settings job failed", settings("failure", undefined, "failure"), true],
    ["the settings job skipped", settings("skipped"), false],
    ["cancelled", settings("success", "on", "cancelled"), false],
  ]);
  check("pr-issue-link.yml", { step: "Fail when the settings job failed" }, [
    ["failed", settings("failure"), true],
    ["passed", settings("success", "on"), false],
  ]);
});

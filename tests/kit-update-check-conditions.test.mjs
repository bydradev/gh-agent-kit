// Which states run each kit-update-check job and step: every if: in
// kit-update-check.yml, evaluated as GitHub evaluates it.
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

test("the check runs while it is on, and the notice step once it has a state", () => {
  check("kit-update-check.yml", { job: "check" }, [
    ["on", { needs: { settings: { outputs: { KIT_UPDATE_CHECK: "on" } } } }, true],
    ["off", { needs: { settings: { outputs: { KIT_UPDATE_CHECK: "off" } } } }, false],
  ]);
  check("kit-update-check.yml", { step: "Open, update or close the notice" }, [
    ["behind", { steps: { check: { outputs: { state: "behind" } } } }, true],
    ["current", { steps: { check: { outputs: { state: "current" } } } }, true],
    ["no state", { steps: { check: { outputs: {} } } }, false],
  ]);
});

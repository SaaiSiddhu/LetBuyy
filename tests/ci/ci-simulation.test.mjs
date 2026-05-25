import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function runValidator(script) {
  return spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

test("CI workflows contain mandatory enterprise gates", () => {
  const result = runValidator("scripts/validators/ci-simulation-validator.mjs");
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("governed execution paths do not use npm or npx", () => {
  const result = runValidator("scripts/validators/supply-chain-validator.mjs");
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

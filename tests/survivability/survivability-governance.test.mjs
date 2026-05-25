import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

test("survivability governance validator enforces evidence contracts", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/survivability-governance-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Survivability governance validator passed/);
});

test("survivability execute mode fails closed without explicit approval", () => {
  const env = { ...process.env };
  delete env.LETBUYY_SURVIVABILITY_EXECUTION_APPROVED;

  const result = spawnSync(process.execPath, [
    "infrastructure/scripts/operations/run-survivability-suite.mjs",
    "--environment=production",
    "--mode=execute",
  ], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Cannot run survivability suite in execute mode/);
  assert.match(result.stderr, /operator-approval/);
});

test("live drill runner does not hardcode passed evidence", () => {
  const source = readFileSync("infrastructure/scripts/operations/run-live-drills.mjs", "utf8");

  assert.doesNotMatch(source, /status:\s*"passed"/);
  assert.match(source, /pass status requires measured|pass status requires observed/);
});

test("certification reports require passing live evidence", () => {
  const source = readFileSync("infrastructure/scripts/operations/generate-certification-report.mjs", "utf8");

  assert.match(source, /passing_records/);
  assert.match(source, /passingStatuses/);
  assert.match(source, /record\.is_consistent/);
  assert.match(source, /signature_valid/);
  assert.match(source, /LETBUYY_SURVIVABILITY_EXECUTION_APPROVED/);
});

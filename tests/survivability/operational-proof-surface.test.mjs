import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

test("operational proof validator enforces load and chaos evidence surfaces", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/operational-proof-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Operational proof validator passed/);
});

test("load proof runner plans without recording fake evidence", () => {
  const result = spawnSync(process.execPath, [
    "load/run-load-evidence.mjs",
    "--mode=plan",
    "--environment=staging",
    "--scenario=black-friday-api-spike",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /planned black-friday-api-spike/);
  assert.match(result.stdout, /no evidence was recorded and no certification was claimed/);
});

test("chaos proof runner fails closed in execute mode without approval", () => {
  const env = { ...process.env };
  delete env.LETBUYY_CHAOS_EXECUTION_APPROVED;

  const result = spawnSync(process.execPath, [
    "chaos/run-chaos-evidence.mjs",
    "--mode=execute",
    "--environment=staging",
    "--scenario=queue-outage",
  ], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /LETBUYY_CHAOS_EXECUTION_APPROVED=true is required/);
});

test("operational proof surfaces cannot be mistaken for certification", () => {
  const loadRunner = readFileSync("load/run-load-evidence.mjs", "utf8");
  const chaosRunner = readFileSync("chaos/run-chaos-evidence.mjs", "utf8");

  assert.match(loadRunner, /certification: false/);
  assert.match(chaosRunner, /certification: false/);
  assert.doesNotMatch(loadRunner, /status:\s*"passed"/);
  assert.doesNotMatch(chaosRunner, /status:\s*"passed"/);
});

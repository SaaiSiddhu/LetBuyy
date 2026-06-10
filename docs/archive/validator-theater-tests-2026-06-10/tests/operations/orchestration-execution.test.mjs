import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("execution runtime validator enforces deterministic execution lifecycle", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/execution-runtime-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("distributed execution contract defines resumable verified execution states", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/distributed-execution-contract.json", "utf8"));

  for (const state of ["PLANNED", "EXECUTING", "PARTIAL_FAILURE", "COMPENSATING", "RECOVERED", "VERIFIED"]) {
    assert.ok(manifest.executionEngine.states.includes(state), `missing execution state ${state}`);
  }
  assert.equal(manifest.executionEngine.recoveryPolicy, "resume-from-last-verified-checkpoint-before-compensation");
});

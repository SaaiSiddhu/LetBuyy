import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("execution reconciliation validator enforces WAL-runtime fixed point recovery", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/execution-reconciliation-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("execution reconciliation contract reconciles runtime WAL lease and saga state", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/durable-execution-contract.json", "utf8"));

  assert.deepEqual(manifest.executionReconciliation.inputs, ["runtime-state", "execution-wal", "lease", "saga"]);
  assert.equal(manifest.executionReconciliation.fixedPointPolicy, "wal-runtime-lease-saga-fixed-point-required");
  assert.equal(manifest.executionReconciliation.oscillationPolicy, "duplicate-reconciliation-actions-hard-fail");
});

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("operational storage validator enforces WAL and checkpoint retention governance", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/operational-storage-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("operational storage contract owns all durable recovery state classes", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/durable-execution-contract.json", "utf8"));
  const stateClasses = new Set(manifest.operationalStorage.stateClasses);

  for (const stateClass of ["execution-wal", "saga-wal", "replay-checkpoint", "lineage-archive", "lease-checkpoint"]) {
    assert.ok(stateClasses.has(stateClass), `missing operational state class ${stateClass}`);
  }
  assert.equal(manifest.operationalStorage.retentionPolicy, "retention-days-required-for-every-state-class");
});

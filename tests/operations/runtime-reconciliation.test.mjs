import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("runtime reconciliation validator enforces manifest-owned resource drift policy", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/runtime-reconciliation-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("runtime reconciliation manifest quarantines orphan resources", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/runtime-orchestration-manifest.json", "utf8"));

  assert.equal(manifest.mode, "governance-contract-not-live-evidence");
  assert.equal(manifest.runtimeReconciliation.orphanPolicy, "quarantine-orphan");
  assert.equal(manifest.runtimeReconciliation.driftPolicy, "fail-closed-before-activation");
  assert.ok(manifest.runtimeReconciliation.requiredActions.includes("update-drift"));
});

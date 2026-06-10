import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("reconciliation convergence validator enforces deterministic convergence planning", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/reconciliation-convergence-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("runtime survivability manifest requires orphan quarantine before activation", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/runtime-survivability-intelligence.json", "utf8"));

  assert.equal(manifest.reconciliationIntelligence.orphanRecoveryPolicy, "quarantine-orphan-before-activation");
  assert.ok(manifest.reconciliationIntelligence.actions.includes("update-drift"));
  assert.equal(manifest.reconciliationIntelligence.checksumGovernance, "convergenceChecksum-per-step-and-planChecksum");
});

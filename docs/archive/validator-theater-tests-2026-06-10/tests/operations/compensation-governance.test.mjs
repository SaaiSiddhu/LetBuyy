import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("compensation governance validator enforces rollback compensation DAG", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/compensation-governance-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("compensation governance binds rollback lineage and irreversible operation policy", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/distributed-execution-contract.json", "utf8"));

  assert.equal(manifest.compensationGovernance.rollbackLineageManifest, "config/runtime/deployment-lineage-manifest.json");
  assert.equal(manifest.compensationGovernance.irreversibleOperationPolicy, "operator-approval-required-and-checksummed");
});

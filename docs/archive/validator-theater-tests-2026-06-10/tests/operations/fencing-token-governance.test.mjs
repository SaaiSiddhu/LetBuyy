import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("fencing token validator enforces monotonic ownership tokens", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/fencing-token-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("fencing token contract rejects stale execution authority", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/durable-execution-contract.json", "utf8"));

  assert.equal(manifest.fencingGovernance.tokenPolicy, "monotonic-increment-only");
  assert.equal(manifest.fencingGovernance.epochLineage, "workerEpoch-plus-leaseVersion-plus-fencingToken");
  assert.equal(manifest.fencingGovernance.staleTokenPolicy, "reject-before-operation-apply");
});

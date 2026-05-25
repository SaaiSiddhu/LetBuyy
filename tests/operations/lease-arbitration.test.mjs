import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("lease governance validator enforces one authoritative executor", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/lease-governance-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("lease governance contract rejects split-brain ownership", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/durable-execution-contract.json", "utf8"));

  assert.equal(manifest.leaseGovernance.leasePolicy, "one-authoritative-executor-per-orchestration");
  assert.equal(manifest.leaseGovernance.takeoverPolicy, "expired-lease-only-with-monotonic-fencing-token");
  assert.equal(manifest.leaseGovernance.splitBrainPolicy, "hard-fail-on-active-owner-overlap");
});

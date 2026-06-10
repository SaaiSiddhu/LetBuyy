import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("lease heartbeat validator enforces stale executor eviction", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/lease-heartbeat-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("lease heartbeat contract requires monotonic heartbeat and drift checks", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/durable-execution-contract.json", "utf8"));

  assert.equal(manifest.leaseHeartbeat.heartbeatPolicy, "monotonic-heartbeat-sequence-per-lease-owner");
  assert.equal(manifest.leaseHeartbeat.staleExecutorPolicy, "evict-expired-heartbeat-before-takeover");
  assert.equal(manifest.leaseHeartbeat.driftPolicy, "heartbeat-checksum-and-epoch-validation-required");
});

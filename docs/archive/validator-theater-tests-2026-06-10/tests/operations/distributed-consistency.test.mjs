import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("distributed consistency validator enforces ownership and arbitration", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/distributed-consistency-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("distributed consistency gives event store precedence over derived state", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/distributed-consistency-contract.json", "utf8"));

  assert.equal(manifest.consistencyModel.precedenceHierarchy[0], "event-store");
  assert.equal(manifest.consistencyModel.replayConflictArbitration, "event-store-precedes-derived-state");
  assert.equal(manifest.consistencyModel.eventualConsistencyGovernance, "deterministic-fixed-point-required");
});

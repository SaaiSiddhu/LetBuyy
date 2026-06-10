import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("distributed conflict validator enforces deterministic arbitration", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/distributed-conflict-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("distributed conflict contract evicts stale authority through replay lineage", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/durable-execution-contract.json", "utf8"));

  assert.equal(manifest.distributedConflictArbitration.authorityPolicy, "lowest-authority-rank-then-highest-version-wins");
  assert.equal(manifest.distributedConflictArbitration.staleAuthorityPolicy, "selected-owner-removes-stale-authorities");
  assert.equal(manifest.distributedConflictArbitration.replayPolicy, "conflict-lineage-checksum-required");
});

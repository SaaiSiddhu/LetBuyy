import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("rollback intelligence validator enforces rollback DAG and compatibility", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/rollback-intelligence-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("rollback intelligence covers replay, projection, queue, migration, and lineage blast radius", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/runtime-survivability-intelligence.json", "utf8"));
  const expected = ["replay", "projection", "queue", "migration", "deployment-lineage"];

  for (const dimension of expected) assert.ok(manifest.rollbackIntelligence.requiredCompatibility.includes(dimension));
  assert.ok(manifest.rollbackIntelligence.blastRadiusDimensions.includes("worker-traffic"));
});

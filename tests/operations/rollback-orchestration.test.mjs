import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("rollback orchestration validator enforces rollback ordering and lineage", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/rollback-orchestration-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("rollback orchestration preserves replay, projection, queue, migration, and deployment lineage", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/runtime-orchestration-manifest.json", "utf8"));
  const required = ["replay", "projection", "queue", "migration", "deployment-lineage"];

  for (const step of manifest.rollbackOrchestration.steps) {
    for (const preserve of required) assert.ok(step.preserves.includes(preserve), `${step.runtimeRoot} must preserve ${preserve}`);
  }
});

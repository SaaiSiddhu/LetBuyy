import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("projection rebuild validator enforces selective bounded rebuild planning", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/projection-rebuild-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("projection rebuild intelligence prefers selective replay windows", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/runtime-survivability-intelligence.json", "utf8"));
  const candidate = manifest.projectionRebuildIntelligence.candidates[0];

  assert.equal(manifest.projectionRebuildIntelligence.rebuildPolicy, "selective-window-before-full-rebuild");
  assert.ok(candidate.lastHealthyGlobalPosition <= candidate.targetGlobalPosition);
  assert.equal(manifest.projectionRebuildIntelligence.maxBatchSize, 500);
});

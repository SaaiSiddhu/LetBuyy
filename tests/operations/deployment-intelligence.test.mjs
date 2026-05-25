import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("deployment intelligence validator enforces deterministic deployment DAG governance", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/deployment-intelligence-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("deployment intelligence covers queue workers and API activation roots", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/runtime-survivability-intelligence.json", "utf8"));

  assert.ok(manifest.deploymentIntelligence.targetRuntimeRoots.includes("services/queue-workers"));
  assert.ok(manifest.deploymentIntelligence.targetRuntimeRoots.includes("services/api-gateway"));
  assert.equal(manifest.deploymentIntelligence.convergencePolicy, "dependency-dag-before-runtime-activation");
});

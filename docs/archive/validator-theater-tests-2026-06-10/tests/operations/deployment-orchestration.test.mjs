import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("deployment orchestration validator enforces deterministic runtime activation", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/deployment-orchestration-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("production deployment orchestration requires reconciliation and rollback gates", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/runtime-orchestration-manifest.json", "utf8"));
  const production = manifest.deploymentOrchestration.stages.find((stage) => stage.environment === "production");

  assert.ok(production.requiredGates.includes("validate:reconciliation"));
  assert.ok(production.requiredGates.includes("validate:rollback"));
  assert.ok(production.runtimeRoots.includes("services/queue-workers"));
});

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("projection reconciliation validator enforces owner and hash recovery contracts", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/projection-reconciliation-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("projection reconciliation fails closed on owner drift and missing snapshots", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/runtime-orchestration-manifest.json", "utf8"));

  assert.equal(manifest.projectionReconciliation.ownerRuntime, "services/queue-workers");
  assert.ok(manifest.projectionReconciliation.requiredActions.includes("block-owner-drift"));
  assert.ok(manifest.projectionReconciliation.requiredActions.includes("restore-snapshot"));
});

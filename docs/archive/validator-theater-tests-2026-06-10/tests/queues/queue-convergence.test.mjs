import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("queue convergence validator enforces event, projection, and queue hash contracts", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/queue-convergence-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("queue convergence requires idempotency and deterministic redrive or rebuild", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/runtime-survivability-intelligence.json", "utf8"));

  assert.equal(manifest.queueConvergence.idempotencyRequired, true);
  assert.deepEqual(manifest.queueConvergence.hashes, ["eventStoreHash", "queueHash", "projectionHash"]);
  assert.equal(manifest.queueConvergence.eventualConvergencePolicy, "redrive-or-rebuild-until-hashes-align");
});

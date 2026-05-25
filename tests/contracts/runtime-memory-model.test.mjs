import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("runtime memory validator enforces deterministic memory ownership", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/runtime-memory-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("runtime memory model declares durable ephemeral replay projection queue orchestration and reconciliation ownership", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/runtime-memory-model.json", "utf8"));
  const classes = new Set(manifest.ownership.map((owner) => owner.memoryClass));

  for (const memoryClass of ["durable-state", "ephemeral-state", "replay-owned-state", "projection-owned-state", "queue-owned-state", "orchestration-owned-state", "reconciliation-owned-state"]) {
    assert.ok(classes.has(memoryClass), `missing memory class ${memoryClass}`);
  }
});

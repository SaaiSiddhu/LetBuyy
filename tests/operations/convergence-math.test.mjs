import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("convergence math validator enforces fixed-point invariants", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/convergence-math-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("convergence invariants bind event store replay projection and queue state", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/convergence-invariants.json", "utf8"));
  const invariantIds = new Set(manifest.invariants.map((invariant) => invariant.invariantId));

  for (const invariantId of ["event-store-to-replay", "replay-to-projection", "queue-to-event"]) {
    assert.ok(invariantIds.has(invariantId), `missing convergence invariant ${invariantId}`);
  }
});

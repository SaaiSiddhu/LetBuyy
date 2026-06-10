import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("CRDT convergence validator enforces monotonic lattice merge", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/crdt-convergence-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("CRDT convergence contract requires replay-safe monotonic merge algebra", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/durable-execution-contract.json", "utf8"));

  assert.equal(manifest.crdtConvergence.mergePolicy, "monotonic-lattice-join");
  assert.equal(manifest.crdtConvergence.orderingPolicy, "replay-safe-lexicographic-merge-order");
  assert.equal(manifest.crdtConvergence.oscillationPolicy, "monotonic-state-only");
});

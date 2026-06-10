import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("runtime transition validator enforces causality and checkpoint lineage", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/runtime-transition-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("runtime transition governance requires causality and checksum audit chain", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/runtime-survivability-intelligence.json", "utf8"));

  assert.equal(manifest.runtimeTransitions.causalityRequired, true);
  assert.equal(manifest.runtimeTransitions.auditChain, "previousChecksum-to-checkpointChecksum");
  assert.equal(manifest.runtimeTransitions.checkpointGovernance, "every-transition-has-gates-causation-and-checksum");
});

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("convergence proof validator enforces bounded fixed-point convergence", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/convergence-proof-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("convergence proof contract requires liveness deadlock and equilibrium policies", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/durable-execution-contract.json", "utf8"));

  assert.equal(manifest.convergenceProof.boundedPolicy, "observed-iterations-must-not-exceed-max-iterations");
  assert.equal(manifest.convergenceProof.deadlockPolicy, "acyclic-dag-and-terminal-fixed-point-required");
  assert.equal(manifest.convergenceProof.equilibriumPolicy, "fixed-point-and-theorem-checksum-required");
});

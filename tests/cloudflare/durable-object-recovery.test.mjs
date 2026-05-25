import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("Durable Object recovery validator enforces per-environment recovery lineage", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/durable-object-recovery-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("Durable Object recovery contract requires explicit dev staging and production ownership", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/durable-execution-contract.json", "utf8"));
  const environments = new Set(manifest.durableObjectRecovery.requiredEnvironments);

  for (const environment of ["dev", "staging", "production"]) {
    assert.ok(environments.has(environment), `missing Durable Object recovery env ${environment}`);
  }
  assert.equal(manifest.durableObjectRecovery.bindingPolicy, "non-inheritable-binding-explicit-per-environment");
});

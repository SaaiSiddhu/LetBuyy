import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("durable Cloudflare runtime validator enforces execution lineage and binding ownership", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/durable-cloudflare-runtime-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("durable Cloudflare runtime contract requires explicit non-inheritable bindings", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/durable-execution-contract.json", "utf8"));
  const explicitBindings = new Set(manifest.cloudflareDurableRuntime.requiredExplicitBindings);

  for (const binding of ["vars", "kv_namespaces", "r2_buckets", "queues", "durable_objects", "services", "telemetry"]) {
    assert.ok(explicitBindings.has(binding), `missing explicit Cloudflare binding ${binding}`);
  }
  assert.equal(manifest.cloudflareDurableRuntime.remoteReconciliationPolicy, "plan-only-until-execute-mode-credentials-exist");
});

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("Cloudflare resource lineage validator enforces deep binding ownership", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/cloudflare-resource-lineage-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("Cloudflare resource lineage governs non-inheritable binding classes", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/runtime-survivability-intelligence.json", "utf8"));

  for (const key of ["vars", "kv_namespaces", "r2_buckets", "queues", "durable_objects", "services", "secrets"]) {
    assert.ok(manifest.cloudflareResourceLineage.nonInheritableBindings.includes(key));
  }
  assert.equal(manifest.cloudflareResourceLineage.remoteBindingReconciliation, "plan-only-until-execute-mode-credentials-exist");
});

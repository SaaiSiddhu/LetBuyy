import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("Cloudflare execution governance validator enforces deep resource lineage", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/cloudflare-execution-governance-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("Cloudflare execution governance treats bindings as non-inheritable per environment", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/distributed-execution-contract.json", "utf8"));
  const keys = new Set(manifest.cloudflareExecutionGovernance.nonInheritableBindings);

  for (const key of ["vars", "kv_namespaces", "r2_buckets", "queues", "durable_objects", "services", "secrets"]) {
    assert.ok(keys.has(key), `missing non-inheritable key ${key}`);
  }
});

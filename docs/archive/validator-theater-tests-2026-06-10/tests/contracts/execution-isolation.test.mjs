import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("execution isolation validator enforces deny-by-default capabilities", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/execution-isolation-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("execution isolation contract declares isolated runtime trust domains", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/durable-execution-contract.json", "utf8"));
  const trustDomains = new Set(manifest.executionIsolation.trustDomains);

  assert.equal(manifest.executionIsolation.capabilityModel, "deny-by-default-capability-token");
  assert.equal(manifest.executionIsolation.authorityPolicy, "one-runtime-owner-per-operation");
  for (const domain of ["worker-runtime", "queue-runtime", "replay-runtime", "projection-runtime", "deployment-runtime"]) {
    assert.ok(trustDomains.has(domain), `missing trust domain ${domain}`);
  }
});

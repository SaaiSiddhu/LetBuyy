import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("runtime topology validator preserves manifest-backed deployment ordering", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/runtime-topology-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("deployment safety validator enforces explicit environment deployment wrappers", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/deployment-safety-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("environment isolation validator protects lower environments from production resources", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/env-isolation-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

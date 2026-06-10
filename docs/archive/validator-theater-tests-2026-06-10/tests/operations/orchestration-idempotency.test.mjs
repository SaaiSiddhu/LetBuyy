import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("orchestration idempotency validator enforces retry-safe execution", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/orchestration-idempotency-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("orchestration idempotency requires all execution hash fields", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/distributed-execution-contract.json", "utf8"));
  const fields = new Set(manifest.idempotencyEngine.requiredFields);

  for (const field of ["operationId", "operationIdempotencyKey", "executionHash", "retryFingerprint", "compensationHash", "executionChecksum"]) {
    assert.ok(fields.has(field), `missing idempotency field ${field}`);
  }
});

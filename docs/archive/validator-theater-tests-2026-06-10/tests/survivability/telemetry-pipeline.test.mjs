import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("telemetry pipeline validator enforces persisted trace lineage", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/telemetry-pipeline-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Telemetry pipeline validator passed/);
});

test("observability producer validator enforces emitted runtime metrics", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/observability-producer-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Observability producer validator passed/);
});

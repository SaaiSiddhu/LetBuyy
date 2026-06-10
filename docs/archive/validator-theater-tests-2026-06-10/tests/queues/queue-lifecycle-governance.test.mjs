import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("queue lifecycle validator enforces retry, DLQ, and env isolation contracts", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/queue-lifecycle-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("queue lifecycle manifest requires caller-supplied deterministic recovery time", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/queue-lifecycle-manifest.json", "utf8"));

  assert.equal(manifest.mode, "governance-contract-not-live-evidence");
  assert.equal(manifest.deterministicRecovery.clockSource, "caller-supplied-runtime-time");
  assert.equal(manifest.failurePolicy, "fail-closed");
});

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("durable execution validator enforces WAL-backed recovery", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/durable-execution-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("durable execution contract requires append-only journal restoration fields", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/durable-execution-contract.json", "utf8"));

  assert.equal(manifest.durableExecution.walPolicy, "append-only-execution-journal");
  assert.equal(manifest.durableExecution.restoreFunction, "restoreExecutionFromWal");
  for (const field of ["executionId", "orchestrationId", "executionSequence", "executionCheckpoint", "executionJournalEntry", "executionCausalityReference", "executionChecksum"]) {
    assert.ok(manifest.durableExecution.requiredStepFields.includes(field), `missing WAL field ${field}`);
  }
});

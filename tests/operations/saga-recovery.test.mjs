import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("saga recovery validator enforces durable compensation WAL", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/saga-recovery-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("saga recovery contract requires irreversible-operation and resumption governance", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/durable-execution-contract.json", "utf8"));

  assert.equal(manifest.sagaRecovery.compensationWalPolicy, "append-only-compensation-wal");
  assert.equal(manifest.sagaRecovery.irreversibleOperationRegistry, "irreversibleOperationIds-in-checkpoint");
  assert.equal(manifest.sagaRecovery.resumptionPolicy, "remaining-steps-derived-from-compensation-wal");
});

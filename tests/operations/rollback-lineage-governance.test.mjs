import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("rollback integrity validator enforces deterministic rollback lineage", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/rollback-integrity-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("deployment lineage validator wires rollback and queue gates", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/deployment-lineage-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("topology drift validator checks queue/replay/projection/rollback topology", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/topology-drift-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

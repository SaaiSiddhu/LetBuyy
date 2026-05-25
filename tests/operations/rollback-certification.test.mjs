import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("rollback certification validator enforces rollback DAG evidence", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/rollback-certification-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Rollback certification validator passed/);
});

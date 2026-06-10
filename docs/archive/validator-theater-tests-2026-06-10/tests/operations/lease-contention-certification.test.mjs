import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("lease contention validator enforces persisted executor arbitration", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/lease-contention-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Lease contention validator passed/);
});

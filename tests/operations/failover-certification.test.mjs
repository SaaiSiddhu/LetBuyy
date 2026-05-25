import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("failover certification validator enforces lease arbitration evidence", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/failover-certification-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Failover certification validator passed/);
});

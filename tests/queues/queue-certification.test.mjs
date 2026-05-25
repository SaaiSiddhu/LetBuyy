import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("queue certification validator enforces rebuild and convergence evidence", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/queue-certification-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Queue certification validator passed/);
});

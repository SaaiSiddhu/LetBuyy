import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("projection recovery validator enforces rebuild, checkpoint, and hash contracts", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/projection-recovery-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

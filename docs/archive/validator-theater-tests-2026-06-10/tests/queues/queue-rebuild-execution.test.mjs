import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("queue rebuild execution validator enforces persistent queue checkpoint evidence", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/queue-rebuild-execution-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Queue rebuild execution validator passed/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("recovery drill execution validator enforces restart-backed drill lineage", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/recovery-drill-execution-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Recovery drill execution validator passed/);
});

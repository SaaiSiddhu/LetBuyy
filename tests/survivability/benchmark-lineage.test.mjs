import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("benchmark lineage validator enforces dataset and environment provenance", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/benchmark-lineage-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Benchmark lineage validator passed/);
});

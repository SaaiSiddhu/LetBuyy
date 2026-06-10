import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("Durable Object certification validator enforces recovery lineage evidence", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/durable-object-certification-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Durable Object certification validator passed/);
});

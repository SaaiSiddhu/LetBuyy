import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("operational evidence validator enforces ignored artifacts and non-production scope", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/operational-evidence-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Operational evidence validator passed/);
});

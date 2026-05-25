import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("TypeScript package boundaries are composite and referenced", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/typescript-governance-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

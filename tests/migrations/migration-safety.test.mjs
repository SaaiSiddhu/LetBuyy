import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("Supabase migration history is replay-safe against destructive table operations", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/migration-safety-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

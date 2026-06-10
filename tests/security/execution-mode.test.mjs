import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("live certification execute mode fails closed without live capabilities", () => {
  const result = spawnSync(process.execPath, [
    "infrastructure/scripts/operations/phase4-live-certify.mjs",
    "--environment=staging",
    "--mode=execute",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Cannot run Phase 4 live certification in execute mode/);
});

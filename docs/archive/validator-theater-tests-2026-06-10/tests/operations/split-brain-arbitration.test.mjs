import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("split-brain validator enforces single authoritative executor", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/split-brain-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("split-brain contract rejects concurrent authority after fencing replay", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/durable-execution-contract.json", "utf8"));

  assert.equal(manifest.splitBrainPrevention.authorityPolicy, "single-authoritative-owner-after-fencing-replay");
  assert.equal(manifest.splitBrainPrevention.conflictPolicy, "higher-epoch-then-higher-fencing-token-wins");
  assert.equal(manifest.splitBrainPrevention.failurePolicy, "hard-fail-if-concurrent-authority-survives");
});

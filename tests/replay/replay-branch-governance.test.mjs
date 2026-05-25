import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("replay branch validator enforces isolated deterministic branches", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/replay-branch-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("replay branch registry requires checksum-compatible merge policy", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/replay-branch-registry.json", "utf8"));

  assert.equal(manifest.branches[0].isolated, true);
  assert.equal(manifest.branches[0].mergePolicy, "checksum-compatible-only");
  assert.equal(manifest.branches[0].expectedProjectionChecksum, "77e95d5b");
});

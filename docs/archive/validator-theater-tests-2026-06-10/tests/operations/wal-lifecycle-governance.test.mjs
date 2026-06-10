import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("WAL lifecycle validator enforces deterministic WAL recovery", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/wal-lifecycle-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("WAL lifecycle contract requires segment rotation compaction and cursor restoration", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/durable-execution-contract.json", "utf8"));

  assert.equal(manifest.walLifecycle.rotationPolicy, "deterministic-sequence-window-rotation");
  assert.equal(manifest.walLifecycle.compactionPolicy, "replay-safe-snapshot-before-compaction");
  assert.equal(manifest.walLifecycle.cursorPolicy, "replay-cursor-restored-from-segment-boundary");
});

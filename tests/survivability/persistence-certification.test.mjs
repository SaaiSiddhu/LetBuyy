import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("operational certification harness restores persisted evidence after process restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "letbuyy-persistence-certification-"));
  const output = join(dir, "report.json");
  const storage = join(dir, "store");
  const result = spawnSync(process.execPath, [
    "infrastructure/scripts/operations/run-operational-certification.mjs",
    "--mode=local",
    "--replay-events=16",
    "--queue-messages=32",
    "--wal-entries=10",
    `--storage-dir=${storage}`,
    `--output=${output}`,
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(output, "utf8"));
  assert.equal(report.persistent_backend.restart_backed, true);
  assert.ok(report.persistent_backend.restart_restoration_hash);
});

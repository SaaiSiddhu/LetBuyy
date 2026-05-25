import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("operational certification harness emits executable local evidence without production claims", () => {
  const dir = mkdtempSync(join(tmpdir(), "letbuyy-operational-certification-"));
  const output = join(dir, "report.json");
  const result = spawnSync(process.execPath, [
    "infrastructure/scripts/operations/run-operational-certification.mjs",
    "--mode=local",
    "--replay-events=24",
    "--queue-messages=48",
    "--wal-entries=12",
    `--output=${output}`,
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(readFileSync(output, "utf8"));
  assert.equal(report.scope, "local-executable");
  assert.equal(report.certification, false);
  assert.equal(report.production_certification, false);
  assert.equal(report.categories.length, 7);
  assert.ok(report.evidence_hash);
  assert.ok(report.budget_results.every((entry) => entry.within_budget));
});

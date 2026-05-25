import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const validators = [
  ["provider-execution-validator.mjs", /Provider execution validator passed/],
  ["distributed-contention-validator.mjs", /Distributed contention validator passed/],
  ["replay-scale-validator.mjs", /Replay scale validator passed/],
  ["crash-recovery-validator.mjs", /Crash recovery validator passed/],
  ["telemetry-ingestion-validator.mjs", /Telemetry ingestion validator passed/],
  ["benchmark-certification-validator.mjs", /Benchmark certification validator passed/],
  ["provider-failover-certification-validator.mjs", /Provider failover certification validator passed/],
  ["partition-recovery-validator.mjs", /Partition recovery validator passed/],
  ["immutable-evidence-validator.mjs", /Immutable evidence validator passed/],
  ["production-recovery-drill-validator.mjs", /Production recovery drill validator passed/],
];

for (const [validator, expected] of validators) {
  test(`${validator} enforces provider-backed production certification gates`, () => {
    const result = spawnSync(process.execPath, [`scripts/validators/${validator}`], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, expected);
  });
}

test("provider production certification plan mode cannot claim live evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "letbuyy-provider-certification-"));
  const output = join(dir, "report.json");
  const result = spawnSync(process.execPath, [
    "infrastructure/scripts/operations/run-provider-production-certification.mjs",
    "--mode=plan",
    `--output=${output}`,
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(readFileSync(output, "utf8"));
  assert.equal(report.certification, false);
  assert.equal(report.provider_certification, false);
  assert.ok(report.blocked_live_evidence.length > 0);
});

test("provider production certification execute mode fails closed without provider capabilities", () => {
  const result = spawnSync(process.execPath, [
    "infrastructure/scripts/operations/run-provider-production-certification.mjs",
    "--mode=execute",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Cannot run provider-backed production certification in execute mode/);
});

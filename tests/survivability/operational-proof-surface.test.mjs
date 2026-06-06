import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("operational proof validator enforces load and chaos evidence surfaces", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/operational-proof-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Operational proof validator passed/);
});

test("load proof runner plans without recording fake evidence", () => {
  const result = spawnSync(process.execPath, [
    "load/run-load-evidence.mjs",
    "--mode=plan",
    "--environment=staging",
    "--scenario=black-friday-api-spike",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /planned black-friday-api-spike/);
  assert.match(result.stdout, /no evidence was recorded and no certification was claimed/);
});

test("chaos proof runner fails closed in execute mode without approval", () => {
  const env = { ...process.env };
  delete env.LETBUYY_CHAOS_EXECUTION_APPROVED;

  const result = spawnSync(process.execPath, [
    "chaos/run-chaos-evidence.mjs",
    "--mode=execute",
    "--environment=staging",
    "--scenario=queue-outage",
  ], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /LETBUYY_CHAOS_EXECUTION_APPROVED=true is required/);
});

test("operational proof surfaces cannot be mistaken for certification", () => {
  const loadRunner = readFileSync("load/run-load-evidence.mjs", "utf8");
  const chaosRunner = readFileSync("chaos/run-chaos-evidence.mjs", "utf8");

  assert.match(loadRunner, /certification: false/);
  assert.match(chaosRunner, /certification: false/);
  assert.doesNotMatch(loadRunner, /status:\s*"passed"/);
  assert.doesNotMatch(chaosRunner, /status:\s*"passed"/);
});

test("root plan-mode evidence scripts are named as plan surfaces", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const stagingRunbook = readFileSync("docs/runbooks/staging-rehearsal.md", "utf8");
  const survivabilityRunbook = readFileSync("docs/runbooks/survivability-suite.md", "utf8");
  const resilienceGovernance = readFileSync("docs/governance/operational-resilience-governance.md", "utf8");

  assert.equal(packageJson.scripts["load:plan"], "node load/run-load-evidence.mjs --mode=plan");
  assert.equal(packageJson.scripts["chaos:plan"], "node chaos/run-chaos-evidence.mjs --mode=plan");
  assert.equal(
    packageJson.scripts["survivability:plan"],
    "node infrastructure/scripts/operations/run-survivability-suite.mjs --environment=production --mode=plan",
  );
  assert.equal(
    packageJson.scripts["certify:production:plan-report"],
    "node infrastructure/scripts/operations/generate-certification-report.mjs --environment=production --mode=plan",
  );
  assert.equal(packageJson.scripts["certify:production:report"], undefined);

  for (const source of [stagingRunbook, survivabilityRunbook, resilienceGovernance]) {
    assert.doesNotMatch(source, /proof:local|run-local-operational-proof/);
  }
  assert.match(stagingRunbook, /certify:production:plan-report/);
  assert.match(survivabilityRunbook, /plan-only proof surfaces/);
});

test("production plan report remains credential-gated and unclaimed", () => {
  const dir = mkdtempSync(join(tmpdir(), "letbuyy-plan-report-"));
  const output = join(dir, "report.json");
  const result = spawnSync(process.execPath, [
    "infrastructure/scripts/operations/generate-certification-report.mjs",
    "--environment=production",
    "--mode=plan",
    `--output=${output}`,
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(readFileSync(output, "utf8"));
  assert.equal(report.requested_mode, "plan");
  assert.equal(report.status, "credential-gated");
  assert.equal(report.live_certified, false);
  assert.match(report.conclusion, /certification remains credential-gated and unclaimed/);
  for (const evidence of Object.values(report.evidence_summary)) {
    assert.equal(evidence.records, 0);
    assert.equal(evidence.fresh, false);
  }
});

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function runNode(args, options = {}) {
  return spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    ...options,
  });
}

test('anti-fabrication gate fails a planted fake UTR fixture', () => {
  const dir = mkdtempSync(join(tmpdir(), 'letbuyy-fabrication-fixture-'));
  const fixture = join(dir, 'planted.ts');
  writeFileSync(fixture, "export const payout = { utr: 'fake UTR for test' };\n", 'utf8');

  try {
    const result = runNode(['scripts/validators/foundation-antifabrication-gate.mjs'], {
      env: {
        ...process.env,
        LETBUYY_ANTI_FABRICATION_EXTRA_FILES: fixture,
      },
    });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}\n${result.stdout}`, /synthetic-utr|fabricated UTR/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('governance runner keeps dependency validators in gate lane and exposes report lane', () => {
  const source = readFileSync('scripts/validate-governance.mjs', 'utf8');
  for (const validator of [
    'dependency-manifest-validator.mjs',
    'undeclared-import-validator.mjs',
    'package-export-validator.mjs',
    'dependency-graph-validator.mjs',
    'circular-import-validator.mjs',
  ]) {
    assert.match(source, new RegExp(`"${validator}"`));
  }
  assert.match(source, /const demotedValidators = \[\]/);
  assert.match(source, /foundation-stepup-report-validator\.mjs/);

  const report = runNode(['scripts/validate-governance.mjs', '--lane=report']);
  assert.equal(report.status, 0, report.stderr || report.stdout);
  assert.match(report.stdout, /Foundation Step-Up report lane/);
});

test('Wave 0 backup policy and restore drill are staged as build-and-prove only', () => {
  const policy = JSON.parse(readFileSync('config/runtime/database-recovery-policy.json', 'utf8'));
  assert.equal(policy.mode, 'build-and-prove-not-live-action');
  assert.equal(policy.pointInTimeRecovery.skipId, 'SKIP-W0-PITR-TIER');
  assert.equal(policy.restoreDrill.script, 'scripts/governance/foundation-restore-drill.mjs');

  const plan = runNode(['scripts/governance/foundation-restore-drill.mjs', '--plan']);
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  assert.match(plan.stdout, /no production\/shared DB action/i);
});

test('frozen path gate rejects staged locked files unless commit-msg carries override trailer', () => {
  const hook = readFileSync('scripts/validators/frozen-path-override-gate.mjs', 'utf8');
  assert.match(hook, /FROZEN-OVERRIDE:/);
  assert.match(hook, /apps\/identity-platform\/src\/lib\/auth\/cookies\.ts/);
  assert.match(hook, /database\/supabase\/migrations\/139_executable_foundation_ledger_core\.sql/);

  const preCommit = readFileSync('scripts/git-hooks/pre-commit', 'utf8');
  assert.match(preCommit, /frozen-path-override-gate\.mjs/);
});

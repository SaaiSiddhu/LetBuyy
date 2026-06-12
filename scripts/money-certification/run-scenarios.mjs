#!/usr/bin/env node
// Document 5 scenario harness runner.
// Usage:
//   node run-scenarios.mjs              # run all 12
//   node run-scenarios.mjs s01 s02 s06  # run specific scenarios
// Evidence JSON is written to LAUNCH_READINESS_2026_06_12/evidence/d-money-certification/
//
// Required env vars: STAGING_SUPABASE_URL, STAGING_SUPABASE_SERVICE_ROLE_KEY,
//                    STAGING_API_URL, STAGING_MERCHANT_SITE_ID, STAGING_MERCHANT_AUTH_TOKEN
// Optional: STAGING_INTERNAL_API_SECRET, STAGING_OPERATOR_USER_ID, STAGING_OPERATOR_TOKEN

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

const ALL_SCENARIOS = [
  's01-upi-capture',
  's02-full-refund',
  's03-partial-refund',
  's04-cod-remittance',
  's05-webhook-recovery',
  's06-duplicate-replay',
  's07-settlement-ingest',
  's08-payout-release',
  's09-payout-failure',
  's10-cross-window-refund',
  's11-ai-credit-purchase',
  's12-crash-recovery',
];

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const selectedPrefixes = args.length > 0 ? args : null;

const scenarios = selectedPrefixes
  ? ALL_SCENARIOS.filter(s => selectedPrefixes.some(p => s.startsWith(p)))
  : ALL_SCENARIOS;

if (scenarios.length === 0) {
  console.error(`No matching scenarios for: ${selectedPrefixes.join(', ')}`);
  console.error(`Available: ${ALL_SCENARIOS.join(', ')}`);
  process.exit(1);
}

console.log(`\n═══════════════════════════════════════════════════`);
console.log(`LetBuyy Money Certification — Document 5 Harnesses`);
console.log(`Running ${scenarios.length}/${ALL_SCENARIOS.length} scenarios`);
console.log(`═══════════════════════════════════════════════════\n`);

const results = [];
for (const scenario of scenarios) {
  const scriptPath = join(SCRIPT_DIR, 'scenarios', `${scenario}.mjs`);
  console.log(`\n───────────────────────────────────────────────────`);
  console.log(`SCENARIO: ${scenario}`);
  console.log(`───────────────────────────────────────────────────`);
  const start = Date.now();
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: 'inherit',
    env: process.env,
  });
  const duration = Date.now() - start;
  const passed = result.status === 0;
  results.push({ scenario, passed, durationMs: duration, exitCode: result.status });
  console.log(`\n${passed ? 'PASS' : 'FAIL'} ${scenario} (${duration}ms)`);
}

console.log(`\n═══════════════════════════════════════════════════`);
console.log(`SUMMARY`);
console.log(`═══════════════════════════════════════════════════`);
for (const r of results) {
  console.log(`  ${r.passed ? '✓' : '✗'} ${r.scenario} (${r.durationMs}ms)`);
}
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
console.log(`\n${passed}/${results.length} passed${failed > 0 ? `, ${failed} FAILED` : ''}`);

if (failed > 0) {
  console.error('\nSome scenarios failed. Review evidence JSON files for details.');
  process.exit(1);
}

#!/usr/bin/env node
// Document 5 §1 invariant checker.
// Runs I1–I8 as executable SQL checks against the live DB.
// A check passes only if psql exits 0 AND returns no output rows.
// Any row in the output means a violation exists in the ledger.
//
// Usage:
//   node check-invariants.mjs              # check all
//   node check-invariants.mjs i1 i3 i7    # check specific invariants
//   node check-invariants.mjs --probe      # negative-control self-test (must exit nonzero)
//
// Required env vars: STAGING_DB_URL (psql connection string)
//   or: STAGING_SUPABASE_URL + STAGING_SUPABASE_SERVICE_ROLE_KEY (REST API mode)

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const INV_DIR = join(SCRIPT_DIR, 'invariants');
const PROBE_FILE = join(INV_DIR, 'fixtures', 'violation-probe.sql');

const ALL_INVARIANTS = [
  { id: 'i1', file: 'i1-double-entry.sql', label: 'Double-entry balance' },
  { id: 'i2', file: 'i2-append-only.sql', label: 'Append-only ledger' },
  { id: 'i3', file: 'i3-provider-conservation.sql', label: 'Provider conservation' },
  { id: 'i4', file: 'i4-merchant-conservation.sql', label: 'Merchant conservation' },
  { id: 'i5', file: 'i5-zero-rake.sql', label: 'Zero rake (0% commission)' },
  { id: 'i6', file: 'i6-idempotency.sql', label: 'Idempotency (no duplicate entries)' },
  { id: 'i7', file: 'i7-single-writer.sql', label: 'Single writer (canonical module only)' },
  { id: 'i8', file: 'i8-cod-symmetry.sql', label: 'COD symmetry' },
];

const rawArgs = process.argv.slice(2);
const isProbe = rawArgs.includes('--probe');
const selectedArgs = rawArgs.filter(a => !a.startsWith('--'));

// --probe: negative-control self-test.
// Runs violation-probe.sql (returns 1 row) and verifies the runner correctly exits nonzero.
// If the probe fixture makes this runner exit 0, the instrument is broken — report and exit 2.
if (isProbe) {
  if (!existsSync(PROBE_FILE)) {
    console.error(`Probe fixture not found: ${PROBE_FILE}`);
    process.exit(2);
  }
  const DB_URL = process.env.STAGING_DB_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!DB_URL) {
    console.error('--probe requires STAGING_DB_URL (or DATABASE_URL or SUPABASE_DB_URL)');
    process.exit(2);
  }
  console.log('\n[PROBE] Running violation-probe.sql — runner must exit nonzero on nonempty output');
  const r = spawnSync('psql', [DB_URL, '--file', PROBE_FILE, '--tuples-only', '--no-align'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  const stdout = (r.stdout || '').trim();
  const probeDetected = r.status !== 0 || stdout !== '';
  if (!probeDetected) {
    console.error('[PROBE] INSTRUMENT BROKEN: runner returned exit 0 with empty output for a known-violation fixture.');
    console.error('        The invariant runner cannot detect violations. Fix the runner before relying on it.');
    process.exit(2);
  }
  console.log(`[PROBE] Detection confirmed: exit=${r.status}, stdout="${stdout}"`);
  console.log('[PROBE] Runner correctly identifies nonempty result as a violation — negative control PASS.');
  process.exit(1); // exit 1: the probe IS a violation, as intended
}

const DB_URL = process.env.STAGING_DB_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!DB_URL) {
  console.error('STAGING_DB_URL (or DATABASE_URL or SUPABASE_DB_URL) is required');
  console.error('Example: postgresql://postgres:<PASSWORD>@<HOST>:5432/postgres');
  process.exit(1);
}

const invariants = selectedArgs.length > 0
  ? ALL_INVARIANTS.filter(i => selectedArgs.some(id => i.id === id || i.id.startsWith(id)))
  : ALL_INVARIANTS;

console.log(`\n═══════════════════════════════════════════════════`);
console.log(`LetBuyy Money Certification — Invariant Checks I1–I8`);
console.log(`Checking ${invariants.length}/${ALL_INVARIANTS.length} invariants`);
console.log(`Pass = exit 0 AND empty output (zero violation rows)`);
console.log(`═══════════════════════════════════════════════════\n`);

const results = [];
for (const inv of invariants) {
  console.log(`\n[${inv.id.toUpperCase()}] ${inv.label}`);
  const sqlFile = join(INV_DIR, inv.file);
  const result = spawnSync('psql', [DB_URL, '--file', sqlFile, '--tuples-only', '--no-align'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();
  // Pass only if psql exits 0 AND returned no rows.
  // A nonempty stdout means violation rows were printed — the invariant is broken.
  const passed = result.status === 0 && stdout === '';
  results.push({ ...inv, passed, exitCode: result.status, stdout, stderr });
  if (passed) {
    console.log(`  → PASS (exit 0, 0 violation rows)`);
  } else {
    console.log(`  → FAIL (exit=${result.status}, violation rows below)`);
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
  }
}

console.log(`\n═══════════════════════════════════════════════════`);
console.log(`INVARIANT CHECK SUMMARY`);
console.log(`═══════════════════════════════════════════════════`);
for (const r of results) {
  console.log(`  ${r.passed ? '✓' : '✗'} [${r.id.toUpperCase()}] ${r.label}`);
}
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
console.log(`\n${passed}/${results.length} passed${failed > 0 ? `, ${failed} FAILED` : ''}`);

if (failed > 0) {
  console.error('\nInvariant violations found — review output above for rows that must be empty.');
  process.exit(1);
}

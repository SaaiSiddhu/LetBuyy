#!/usr/bin/env node
// Document 5 §1 invariant checker.
// Runs I1–I8 as executable SQL checks against the live DB.
// Usage:
//   node check-invariants.mjs              # check all
//   node check-invariants.mjs i1 i3 i7    # check specific invariants
//
// Required env vars: STAGING_DB_URL (psql connection string)
//   or: STAGING_SUPABASE_URL + STAGING_SUPABASE_SERVICE_ROLE_KEY (REST API mode)

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const INV_DIR = join(SCRIPT_DIR, 'invariants');

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

const DB_URL = process.env.STAGING_DB_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!DB_URL) {
  console.error('STAGING_DB_URL (or DATABASE_URL or SUPABASE_DB_URL) is required');
  console.error('Example: postgresql://postgres:<PASSWORD>@<HOST>:5432/postgres');
  process.exit(1);
}

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const selectedIds = args.length > 0 ? args : null;

const invariants = selectedIds
  ? ALL_INVARIANTS.filter(i => selectedIds.some(id => i.id === id || i.id.startsWith(id)))
  : ALL_INVARIANTS;

console.log(`\n═══════════════════════════════════════════════════`);
console.log(`LetBuyy Money Certification — Invariant Checks I1–I8`);
console.log(`Checking ${invariants.length}/${ALL_INVARIANTS.length} invariants`);
console.log(`═══════════════════════════════════════════════════\n`);

const results = [];
for (const inv of invariants) {
  console.log(`\n[${inv.id.toUpperCase()}] ${inv.label}`);
  const sqlFile = join(INV_DIR, inv.file);
  const result = spawnSync('psql', [DB_URL, '--file', sqlFile, '--tuples-only', '--no-align'], {
    stdio: 'inherit',
    encoding: 'utf8',
  });
  const passed = result.status === 0;
  results.push({ ...inv, passed, exitCode: result.status });
  console.log(`  → ${passed ? 'PASS' : 'FAIL (check output above)'}`);
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
  console.error('\nInvariant violations found — review SQL output above for rows that should be empty.');
  process.exit(1);
}

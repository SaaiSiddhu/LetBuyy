/**
 * SecurityTimelineService tests — LSAS Phase 14.
 *
 * Stubs memory-intel.json to control which ChangeRecords the LCTS TimelineService produces,
 * then verifies SecurityTimelineService.entries() filters correctly to security-relevant ones.
 *
 * Conventions:
 *   - FIXED clock '2026-07-04T00:00:00.000Z'
 *   - stubStore pattern from the test spec
 *   - createEngine from @letbuyy/lcis-core
 *   - SecurityTimelineService(core, now) constructed directly
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { type ArtifactStore, createEngine } from '@letbuyy/lcis-core';
import { SecurityTimelineService } from '../src/timeline/SecurityTimelineService';
import type { SecurityTimelineEntry } from '../src/shared/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const FIXED = '2026-07-04T00:00:00.000Z';
const fixedNow = () => FIXED;

function stubStore(artifacts: Record<string, unknown>): ArtifactStore {
  return {
    has: (n: string) => n in artifacts,
    tryRead: (n: string) => artifacts[n] ?? null,
    read: (n: string) => {
      if (!(n in artifacts)) throw new Error('missing ' + n);
      return artifacts[n];
    },
    pathOf: (n: string) => '/stub/' + n,
  } as unknown as ArtifactStore;
}

function makeEngine(memoryIntel: unknown) {
  const core = createEngine({
    store: stubStore({ 'memory-intel.json': memoryIntel }),
    repoRoot: '/stub',
  });
  return new SecurityTimelineService(core, fixedNow);
}

function emptyEngine() {
  const core = createEngine({ store: stubStore({}), repoRoot: '/stub' });
  return new SecurityTimelineService(core, fixedNow);
}

// ── Representative memory-intel fixtures ──────────────────────────────────────

/** Contains both security and non-security migrations/decisions. */
const MIXED_MEMORY = {
  migrations: [
    // security: matches 'rls'
    { n: 180, file: '180_add_rls_policies.sql', name: 'add rls policies', type: 'security' },
    // security: matches 'payment'
    { n: 174, file: '174_payment_ledger.sql', name: 'payment ledger', type: 'payment' },
    // security: matches 'auth'
    { n: 170, file: '170_auth_tokens.sql', name: 'auth tokens', type: 'auth' },
    // NOT security: no matching term
    { n: 165, file: '165_product_index.sql', name: 'product index', type: 'products' },
    // NOT security: 'orders' alone without security term
    { n: 160, file: '160_orders_table.sql', name: 'orders table', type: 'orders' },
  ],
  decisions: [
    // security: matches 'security'
    { id: 'D-010', section: 'security', rule: 'RLS required', source: 'docs/security.md' },
    // security: matches 'policy'
    { id: 'D-011', section: 'policy', rule: 'no public using true', source: 'docs/policies.md' },
    // security: matches 'tenant'
    { id: 'D-012', section: 'tenant scoping', rule: 'site_id required', source: 'docs/tenancy.md' },
    // NOT security: purely cosmetic
    { id: 'D-020', section: 'UI', rule: 'button colour', source: 'docs/design.md' },
    // NOT security: unrelated
    { id: 'D-021', section: 'logging', rule: 'log levels', source: 'docs/ops.md' },
  ],
};

/** Only non-security records. */
const NON_SECURITY_MEMORY = {
  migrations: [
    { n: 100, file: '100_products.sql', name: 'products table', type: 'products' },
    { n: 101, file: '101_collections.sql', name: 'collections', type: 'catalog' },
  ],
  decisions: [
    { id: 'D-001', section: 'UI', rule: 'button colour', source: 'docs/design.md' },
  ],
};

/** Only security records. */
const ALL_SECURITY_MEMORY = {
  migrations: [
    { n: 201, file: '201_auth_migration.sql', name: 'auth migration', type: 'auth' },
    { n: 202, file: '202_rls_tables.sql', name: 'rls tables', type: 'security' },
  ],
  decisions: [
    { id: 'D-101', section: 'payment security', rule: 'ledger only', source: 'docs/payments.md' },
  ],
};

// ── Filtering correctness ─────────────────────────────────────────────────────

test('entries() keeps only security-relevant records from mixed memory-intel', () => {
  const svc = makeEngine(MIXED_MEMORY);
  const entries = svc.entries();
  // Should include: migrations 180 (rls), 174 (payment), 170 (auth); decisions D-010 (security), D-011 (policy), D-012 (tenant)
  // Should exclude: migrations 165 (products), 160 (orders); decisions D-020 (UI), D-021 (logging)
  assert.equal(entries.length, 6);
});

test('entries() excludes non-security migrations', () => {
  const svc = makeEngine(MIXED_MEMORY);
  const entries = svc.entries();
  const ids = entries.map((e) => e.id);
  assert.ok(!ids.includes('migration-165'), 'product migration should be excluded');
  assert.ok(!ids.includes('migration-160'), 'orders migration should be excluded');
});

test('entries() excludes non-security decisions', () => {
  const svc = makeEngine(MIXED_MEMORY);
  const entries = svc.entries();
  const ids = entries.map((e) => e.id);
  assert.ok(!ids.includes('decision-D-020'), 'UI decision should be excluded');
  assert.ok(!ids.includes('decision-D-021'), 'logging decision should be excluded');
});

test('entries() includes security migrations by term rls', () => {
  const svc = makeEngine(MIXED_MEMORY);
  const entries = svc.entries();
  const ids = entries.map((e) => e.id);
  assert.ok(ids.includes('migration-180'), 'rls migration should be included');
});

test('entries() includes security migrations by term payment', () => {
  const svc = makeEngine(MIXED_MEMORY);
  const entries = svc.entries();
  const ids = entries.map((e) => e.id);
  assert.ok(ids.includes('migration-174'), 'payment migration should be included');
});

test('entries() includes security migrations by term auth', () => {
  const svc = makeEngine(MIXED_MEMORY);
  const entries = svc.entries();
  const ids = entries.map((e) => e.id);
  assert.ok(ids.includes('migration-170'), 'auth migration should be included');
});

test('entries() includes security decisions by term security', () => {
  const svc = makeEngine(MIXED_MEMORY);
  const entries = svc.entries();
  const ids = entries.map((e) => e.id);
  assert.ok(ids.includes('decision-D-010'), 'security decision should be included');
});

test('entries() includes security decisions by term policy', () => {
  const svc = makeEngine(MIXED_MEMORY);
  const entries = svc.entries();
  const ids = entries.map((e) => e.id);
  assert.ok(ids.includes('decision-D-011'), 'policy decision should be included');
});

test('entries() includes security decisions by term tenant', () => {
  const svc = makeEngine(MIXED_MEMORY);
  const entries = svc.entries();
  const ids = entries.map((e) => e.id);
  assert.ok(ids.includes('decision-D-012'), 'tenant decision should be included');
});

// ── at: null preserved ────────────────────────────────────────────────────────

test('entries() preserves at: null for all migration records (no timestamps in memory-intel)', () => {
  const svc = makeEngine(MIXED_MEMORY);
  const entries = svc.entries().filter((e) => e.kind === 'migration');
  assert.ok(entries.length > 0, 'expected migration entries');
  for (const entry of entries) {
    assert.equal(entry.at, null, `migration ${entry.id} should have at: null`);
  }
});

test('entries() preserves at: null for decision records', () => {
  const svc = makeEngine(MIXED_MEMORY);
  const entries = svc.entries().filter((e) => e.kind === 'decision');
  assert.ok(entries.length > 0, 'expected decision entries');
  for (const entry of entries) {
    assert.equal(entry.at, null, `decision ${entry.id} should have at: null`);
  }
});

test('entries() preserves at: null — not fabricated as a timestamp', () => {
  const svc = makeEngine(ALL_SECURITY_MEMORY);
  const entries = svc.entries();
  assert.ok(entries.length > 0);
  for (const entry of entries) {
    assert.equal(entry.at, null);
  }
});

// ── Empty honest ──────────────────────────────────────────────────────────────

test('entries() returns [] when memory-intel.json is absent (no artifact)', () => {
  const svc = emptyEngine();
  const entries = svc.entries();
  assert.deepEqual(entries, []);
});

test('entries() returns [] when memory-intel.json has no security records', () => {
  const svc = makeEngine(NON_SECURITY_MEMORY);
  const entries = svc.entries();
  assert.deepEqual(entries, []);
});

test('entries() returns [] when memory-intel.json has empty migrations and decisions', () => {
  const svc = makeEngine({ migrations: [], decisions: [] });
  const entries = svc.entries();
  assert.deepEqual(entries, []);
});

test('entries() returns [] when memory-intel.json is an empty object', () => {
  const svc = makeEngine({});
  const entries = svc.entries();
  assert.deepEqual(entries, []);
});

test('entries() returns [] on malformed artifact (string instead of object)', () => {
  const svc = makeEngine('not-an-object');
  const entries = svc.entries();
  assert.deepEqual(entries, []);
});

test('entries() returns [] on null artifact value', () => {
  const core = createEngine({ store: stubStore({ 'memory-intel.json': null }), repoRoot: '/stub' });
  const svc = new SecurityTimelineService(core, fixedNow);
  const entries = svc.entries();
  assert.deepEqual(entries, []);
});

// ── Order preserved (newest-first = LCTS order) ───────────────────────────────

test('entries() preserves LCTS ordering: migrations ordered by n DESC (newest first)', () => {
  const svc = makeEngine(MIXED_MEMORY);
  const migrationEntries = svc.entries().filter((e) => e.kind === 'migration');
  // Expect 180, 174, 170 in that order
  assert.equal(migrationEntries[0].id, 'migration-180');
  assert.equal(migrationEntries[1].id, 'migration-174');
  assert.equal(migrationEntries[2].id, 'migration-170');
});

test('entries() migrations come before decisions in ordering (both null-at; migrations first)', () => {
  const svc = makeEngine(MIXED_MEMORY);
  const entries = svc.entries();
  const firstDecisionIdx = entries.findIndex((e) => e.kind === 'decision');
  const lastMigrationIdx = entries.map((e) => e.kind).lastIndexOf('migration');
  if (firstDecisionIdx !== -1 && lastMigrationIdx !== -1) {
    assert.ok(
      lastMigrationIdx < firstDecisionIdx,
      'all migrations should appear before decisions in the timeline',
    );
  }
});

test('entries() returns all-security records in insertion order', () => {
  const svc = makeEngine(ALL_SECURITY_MEMORY);
  const entries = svc.entries();
  // 2 migrations (n=202, n=201 DESC) + 1 decision
  assert.equal(entries.length, 3);
  assert.equal(entries[0].id, 'migration-202');
  assert.equal(entries[1].id, 'migration-201');
  assert.equal(entries[2].id, 'decision-D-101');
});

// ── Determinism ───────────────────────────────────────────────────────────────

test('entries() is deterministic: two calls return identical results', () => {
  const svc = makeEngine(MIXED_MEMORY);
  const first = svc.entries();
  const second = svc.entries();
  assert.deepEqual(
    first.map((e) => e.id),
    second.map((e) => e.id),
  );
});

test('entries() serialises deterministically via JSON.stringify', () => {
  const svc = makeEngine(MIXED_MEMORY);
  assert.equal(JSON.stringify(svc.entries()), JSON.stringify(svc.entries()));
});

test('two services built with the same core+now produce identical entries', () => {
  const core = createEngine({
    store: stubStore({ 'memory-intel.json': MIXED_MEMORY }),
    repoRoot: '/stub',
  });
  const a = new SecurityTimelineService(core, fixedNow);
  const b = new SecurityTimelineService(core, fixedNow);
  assert.deepEqual(a.entries(), b.entries());
});

// ── Term matching: case-insensitive ──────────────────────────────────────────

test('term matching is case-insensitive: UPPERCASE term in detail is matched', () => {
  const mem = {
    migrations: [
      { n: 300, file: '300_RLS_tables.sql', name: 'RLS tables', type: 'RLS' },
    ],
    decisions: [],
  };
  const svc = makeEngine(mem);
  const entries = svc.entries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, 'migration-300');
});

test('term matching is case-insensitive: MixedCase AUTH is matched', () => {
  const mem = {
    migrations: [
      { n: 301, file: '301_Auth_check.sql', name: 'Auth check', type: 'Auth' },
    ],
    decisions: [],
  };
  const svc = makeEngine(mem);
  const entries = svc.entries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, 'migration-301');
});

test('term matching is case-insensitive: SECURITY in decision detail', () => {
  const mem = {
    migrations: [],
    decisions: [
      { id: 'D-CAS', section: 'SECURITY review', rule: 'audit', source: 'docs/audit.md' },
    ],
  };
  const svc = makeEngine(mem);
  const entries = svc.entries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, 'decision-D-CAS');
});

test('term matching: POLICY uppercase in decision section matches', () => {
  const mem = {
    migrations: [],
    decisions: [
      { id: 'D-POL', section: 'POLICY audit', rule: 'check', source: 'docs/policy.md' },
    ],
  };
  const svc = makeEngine(mem);
  const entries = svc.entries();
  assert.equal(entries.length, 1);
});

test('term matching: tenant (case-insensitive) in decision rule is matched', () => {
  const mem = {
    migrations: [],
    decisions: [
      { id: 'D-TEN', section: 'isolation', rule: 'TENANT isolation required', source: 'docs/tenancy.md' },
    ],
  };
  const svc = makeEngine(mem);
  const entries = svc.entries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, 'decision-D-TEN');
});

test('term site_id in migration detail is matched', () => {
  const mem = {
    migrations: [
      { n: 400, file: '400_site_id_index.sql', name: 'site_id index', type: 'tenant' },
    ],
    decisions: [],
  };
  const svc = makeEngine(mem);
  const entries = svc.entries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, 'migration-400');
});

test('term gift in migration detail is matched', () => {
  const mem = {
    migrations: [
      { n: 401, file: '401_gift_cards.sql', name: 'gift cards', type: 'gift' },
    ],
    decisions: [],
  };
  const svc = makeEngine(mem);
  const entries = svc.entries();
  assert.equal(entries.length, 1);
});

test('term ledger in migration detail is matched', () => {
  const mem = {
    migrations: [
      { n: 402, file: '402_ledger_entries.sql', name: 'ledger entries', type: 'ledger' },
    ],
    decisions: [],
  };
  const svc = makeEngine(mem);
  const entries = svc.entries();
  assert.equal(entries.length, 1);
});

test('term payout in migration detail is matched', () => {
  const mem = {
    migrations: [
      { n: 403, file: '403_payout_table.sql', name: 'payout table', type: 'payout' },
    ],
    decisions: [],
  };
  const svc = makeEngine(mem);
  const entries = svc.entries();
  assert.equal(entries.length, 1);
});

test('term refund in migration detail is matched', () => {
  const mem = {
    migrations: [
      { n: 404, file: '404_refund_status.sql', name: 'refund status', type: 'refund' },
    ],
    decisions: [],
  };
  const svc = makeEngine(mem);
  const entries = svc.entries();
  assert.equal(entries.length, 1);
});

// ── Kind filtering: only migration | decision ─────────────────────────────────

test('entries() only produces entries with kind migration or decision', () => {
  const svc = makeEngine(MIXED_MEMORY);
  const entries = svc.entries();
  for (const entry of entries) {
    assert.ok(
      entry.kind === 'migration' || entry.kind === 'decision',
      `unexpected kind: ${entry.kind}`,
    );
  }
});

// ── SecurityTimelineEntry field mapping ───────────────────────────────────────

test('entries() maps id correctly from ChangeRecord', () => {
  const svc = makeEngine(ALL_SECURITY_MEMORY);
  const entries = svc.entries();
  assert.ok(entries.some((e) => e.id === 'migration-202'));
  assert.ok(entries.some((e) => e.id === 'migration-201'));
  assert.ok(entries.some((e) => e.id === 'decision-D-101'));
});

test('entries() maps kind correctly from ChangeRecord', () => {
  const svc = makeEngine(ALL_SECURITY_MEMORY);
  const migrations = svc.entries().filter((e) => e.kind === 'migration');
  const decisions = svc.entries().filter((e) => e.kind === 'decision');
  assert.equal(migrations.length, 2);
  assert.equal(decisions.length, 1);
});

test('entries() maps subject correctly from ChangeRecord', () => {
  const svc = makeEngine(ALL_SECURITY_MEMORY);
  const entry = svc.entries().find((e) => e.id === 'migration-202');
  assert.ok(entry);
  assert.equal(entry.subject, '202_rls_tables.sql');
});

test('entries() maps detail correctly from ChangeRecord', () => {
  const svc = makeEngine(ALL_SECURITY_MEMORY);
  const entry = svc.entries().find((e) => e.id === 'migration-202');
  assert.ok(entry);
  // LCTS TimelineService builds detail as name + type joined by ' / '
  assert.ok(typeof entry.detail === 'string');
  assert.ok(entry.detail.length > 0);
});

test('entries() maps connection field from ChangeRecord', () => {
  const svc = makeEngine(ALL_SECURITY_MEMORY);
  const entries = svc.entries();
  for (const entry of entries) {
    assert.ok(
      entry.connection === 'CONNECTED' || entry.connection === 'NOT_CONNECTED',
      `unexpected connection: ${entry.connection}`,
    );
  }
});

test('entries() maps evidence array from ChangeRecord', () => {
  const svc = makeEngine(ALL_SECURITY_MEMORY);
  const entries = svc.entries();
  for (const entry of entries) {
    assert.ok(Array.isArray(entry.evidence), 'evidence should be an array');
  }
});

test('entries() structural records from memory-intel.json are CONNECTED', () => {
  const svc = makeEngine(ALL_SECURITY_MEMORY);
  const entries = svc.entries();
  for (const entry of entries) {
    assert.equal(entry.connection, 'CONNECTED');
  }
});

// ── readonly contract ─────────────────────────────────────────────────────────

test('entries() returns a frozen-compatible readonly array (is an array)', () => {
  const svc = makeEngine(ALL_SECURITY_MEMORY);
  const entries = svc.entries();
  assert.ok(Array.isArray(entries));
});

test('entries() each entry has all required SecurityTimelineEntry fields', () => {
  const svc = makeEngine(ALL_SECURITY_MEMORY);
  const entries = svc.entries();
  assert.ok(entries.length > 0);
  for (const entry of entries) {
    assert.ok('id' in entry, 'missing id');
    assert.ok('at' in entry, 'missing at');
    assert.ok('kind' in entry, 'missing kind');
    assert.ok('subject' in entry, 'missing subject');
    assert.ok('detail' in entry, 'missing detail');
    assert.ok('connection' in entry, 'missing connection');
    assert.ok('evidence' in entry, 'missing evidence');
  }
});

// ── try/catch → [] ────────────────────────────────────────────────────────────

test('entries() returns [] (not throw) when store.tryRead throws internally', () => {
  // Build a core where store.tryRead always throws to exercise the try/catch
  const throwingStore = {
    has: () => true,
    tryRead: () => { throw new Error('store exploded'); },
    read: () => { throw new Error('store exploded'); },
    pathOf: (n: string) => '/stub/' + n,
  } as unknown as ArtifactStore;
  const core = createEngine({ store: throwingStore, repoRoot: '/stub' });
  const svc = new SecurityTimelineService(core, fixedNow);
  // Should not throw; should return []
  let result: readonly SecurityTimelineEntry[] = [];
  assert.doesNotThrow(() => { result = svc.entries(); });
  assert.deepEqual(result, []);
});

// ── Mixed migration+decision with single record ───────────────────────────────

test('entries() with a single security migration returns exactly that one record', () => {
  const mem = {
    migrations: [{ n: 500, file: '500_auth_migration.sql', name: 'auth migration', type: 'auth' }],
    decisions: [],
  };
  const svc = makeEngine(mem);
  const entries = svc.entries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, 'migration-500');
  assert.equal(entries[0].kind, 'migration');
});

test('entries() with a single security decision returns exactly that one record', () => {
  const mem = {
    migrations: [],
    decisions: [{ id: 'D-SEC', section: 'security', rule: 'audit', source: 'docs/security.md' }],
  };
  const svc = makeEngine(mem);
  const entries = svc.entries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, 'decision-D-SEC');
  assert.equal(entries[0].kind, 'decision');
});

// ── Many records, check count precisely ──────────────────────────────────────

test('entries() with all-security-only memory returns all records', () => {
  const svc = makeEngine(ALL_SECURITY_MEMORY);
  const entries = svc.entries();
  assert.equal(entries.length, 3); // 2 migrations + 1 decision
});

test('entries() with all-non-security memory returns 0 records', () => {
  const svc = makeEngine(NON_SECURITY_MEMORY);
  const entries = svc.entries();
  assert.equal(entries.length, 0);
});

test('entries() count matches manual filter of MIXED_MEMORY security records', () => {
  const svc = makeEngine(MIXED_MEMORY);
  const entries = svc.entries();
  // 3 security migrations (180, 174, 170) + 3 security decisions (D-010, D-011, D-012) = 6
  assert.equal(entries.length, 6);
});

// ── Multiple terms matching the same record ───────────────────────────────────

test('entries() does not duplicate a record that matches multiple security terms', () => {
  const mem = {
    migrations: [
      // Matches both 'auth' and 'rls' — should appear once
      { n: 600, file: '600_auth_rls_migration.sql', name: 'auth rls migration', type: 'auth' },
    ],
    decisions: [],
  };
  const svc = makeEngine(mem);
  const entries = svc.entries();
  assert.equal(entries.length, 1, 'should not duplicate a record matching multiple terms');
});

test('entries() does not duplicate a decision matching both policy and security', () => {
  const mem = {
    migrations: [],
    decisions: [
      { id: 'D-DUP', section: 'security policy', rule: 'enforce policy', source: 'docs.md' },
    ],
  };
  const svc = makeEngine(mem);
  const entries = svc.entries();
  assert.equal(entries.length, 1);
});

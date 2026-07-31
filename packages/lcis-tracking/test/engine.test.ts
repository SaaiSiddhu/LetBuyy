/**
 * ChangeTrackingEngine (LCTS facade) tests — Phase 10.
 * create/get/reset lifecycle, report composition over stub artifacts, findings TR01/TR03/TR06,
 * deterministic replay (same fixtures → identical JSON), honest NOT_CONNECTED feeds.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtifactStore, createEngine } from '@letbuyy/lcis-core';
import {
  createTrackingEngine,
  getTrackingEngine,
  resetTrackingEngine,
} from '../src/index';

const FIXED = '2026-07-04T00:00:00.000Z';

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

const MEMORY_INTEL = {
  decisions: [
    { id: 'D-001', title: 'Adopt canonical ledger', type: 'payment', source: 'docs/decisions.md' },
    { id: 'D-002', title: 'Freeze theme registry', type: 'theme', source: 'docs/theme.md' },
  ],
  migrations: [
    { n: 173, file: '173_orders_index.sql', name: 'orders index', type: 'orders', decision: 'migration 173' },
    { n: 174, file: '174_v1_gift_card_refund_restore.sql', name: 'v1 gift card refund restore', type: 'refund', decision: 'migration 174' },
  ],
};

const DB_INTEL = {
  tables: [{ name: 'orders' }, { name: 'payment_transactions' }],
  rpcs: [{ name: 'create_checkout_order' }],
  policies: [{ name: 'orders_rls', table: 'orders' }],
  triggers: [{ name: 'orders_audit' }],
};

const INFRA_INTEL = {
  workers: [{ name: 'queue-worker' }],
  queues: [{ name: 'order-events' }],
  routes: [{ path: '/v1/orders' }],
  packages: [{ name: '@letbuyy/api-gateway' }],
};

function fullEngine() {
  const core = createEngine({
    store: stubStore({ 'memory-intel.json': MEMORY_INTEL, 'db-intel.json': DB_INTEL, 'infra-intel.json': INFRA_INTEL }),
    repoRoot: '/stub',
  });
  return createTrackingEngine({ core, now: () => FIXED });
}

function bareEngine() {
  const core = createEngine({ store: stubStore({}), repoRoot: '/stub' });
  return createTrackingEngine({ core, now: () => FIXED });
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

test('createTrackingEngine exposes core + the five services', () => {
  const e = fullEngine();
  assert.ok(e.core);
  for (const svc of ['timeline', 'diff', 'impact', 'rollback', 'history'] as const) {
    assert.ok(e[svc], `service ${svc} missing`);
  }
});

test('getTrackingEngine returns a process-wide singleton; reset clears it', () => {
  resetTrackingEngine();
  const core = createEngine({ store: stubStore({}), repoRoot: '/stub' });
  const a = getTrackingEngine({ core, now: () => FIXED });
  assert.equal(getTrackingEngine(), a);
  resetTrackingEngine();
  assert.notEqual(getTrackingEngine({ core, now: () => FIXED }), a);
  resetTrackingEngine();
});

// ── generateTimeline ──────────────────────────────────────────────────────────

test('generateTimeline composes migrations + decisions from the stub artifact', () => {
  const t = fullEngine().generateTimeline();
  assert.ok(t.records.some((r) => r.id === 'migration-174'));
  assert.ok(t.records.some((r) => r.kind === 'decision'));
  assert.equal(t.timestamp, FIXED);
});

test('generateTimeline without live facts is honest: liveConnected false + feeds listed', () => {
  const t = fullEngine().generateTimeline();
  assert.equal(t.liveConnected, false);
  assert.ok(t.notConnectedFeeds.length > 0);
});

// ── generateDiff ──────────────────────────────────────────────────────────────

test('generateDiff detects added and removed entities across categories', () => {
  const e = fullEngine();
  const before = { label: 'before', at: null, tables: ['orders'], rpcs: [], policies: [], triggers: [], workers: ['queue-worker'], queues: [], routes: [], packages: [] };
  const after = { label: 'after', at: FIXED, tables: ['orders', 'refunds'], rpcs: [], policies: [], triggers: [], workers: [], queues: [], routes: [], packages: [] };
  const d = e.generateDiff(before, after);
  assert.equal(d.added, 1);
  assert.equal(d.removed, 1);
  assert.ok(d.records.some((r) => r.kind === 'table' && r.subject === 'refunds' && r.action === 'added'));
  assert.ok(d.records.some((r) => r.kind === 'worker' && r.subject === 'queue-worker' && r.action === 'removed'));
});

// ── generateTrackingReport ────────────────────────────────────────────────────

test('tracking report composes timeline + latest migration + decision count', () => {
  const r = fullEngine().generateTrackingReport();
  assert.equal(r.latestMigration?.n, 174);
  assert.equal(r.latestMigration?.file, '174_v1_gift_card_refund_restore.sql');
  assert.equal(r.decisionCount, 2);
  assert.ok(r.timeline.records.length >= 4);
});

test('TR03 fires for money-path migrations (refund type in detail)', () => {
  const r = fullEngine().generateTrackingReport();
  const tr03 = r.findings.filter((f) => f.rule === 'TR03');
  assert.ok(tr03.length >= 1, `expected TR03 for the refund migration, findings: ${r.findings.map((f) => f.rule).join(',')}`);
  assert.ok(tr03.some((f) => f.subject.includes('gift_card_refund')));
});

test('TR06 fires per disconnected live feed', () => {
  const r = fullEngine().generateTrackingReport();
  const tr06 = r.findings.filter((f) => f.rule === 'TR06');
  assert.equal(tr06.length, r.timeline.notConnectedFeeds.length);
  for (const f of tr06) assert.equal(f.connection, 'NOT_CONNECTED');
});

test('TR01 fires when structural artifacts are missing (bare store)', () => {
  const r = bareEngine().generateTrackingReport();
  const tr01 = r.findings.filter((f) => f.rule === 'TR01');
  assert.ok(tr01.length >= 2, 'expected TR01 for missing db-intel + infra-intel');
});

test('TR01 absent when both structural artifacts are present', () => {
  const r = fullEngine().generateTrackingReport();
  assert.equal(r.findings.filter((f) => f.rule === 'TR01').length, 0);
});

test('report carries provenance: evidence + fixed timestamp + honest liveConnected', () => {
  const r = fullEngine().generateTrackingReport();
  assert.ok(r.evidence.length > 0);
  assert.equal(r.timestamp, FIXED);
  assert.equal(r.liveConnected, false);
  assert.match(r.summary, /NOT_CONNECTED/);
});

test('bare store report is honest-empty, never a throw', () => {
  const r = bareEngine().generateTrackingReport();
  assert.equal(r.latestMigration, null);
  assert.equal(r.decisionCount, 0);
});

// ── Deterministic replay ──────────────────────────────────────────────────────

test('deterministic replay: identical fixtures → byte-identical report JSON', () => {
  const a = fullEngine().generateTrackingReport();
  const b = fullEngine().generateTrackingReport();
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test('deterministic replay holds for timeline and diff too', () => {
  const e1 = fullEngine();
  const e2 = fullEngine();
  assert.deepEqual(
    JSON.parse(JSON.stringify(e1.generateTimeline())),
    JSON.parse(JSON.stringify(e2.generateTimeline())),
  );
  const inv = { label: 'x', at: null, tables: ['a'], rpcs: [], policies: [], triggers: [], workers: [], queues: [], routes: [], packages: [] };
  assert.deepEqual(
    JSON.parse(JSON.stringify(e1.generateDiff(inv, inv))),
    JSON.parse(JSON.stringify(e2.generateDiff(inv, inv))),
  );
});

// ── generateHistory ───────────────────────────────────────────────────────────

test('generateHistory filters timeline records for the subject', () => {
  const h = fullEngine().generateHistory('gift_card');
  assert.ok(h.records.some((r) => r.subject.includes('gift_card')));
  assert.equal(h.timestamp, FIXED);
});

test('generateHistory for an unknown subject is honest-empty', () => {
  const h = fullEngine().generateHistory('zz-nonexistent-subject-zz');
  assert.equal(h.records.length, 0);
});

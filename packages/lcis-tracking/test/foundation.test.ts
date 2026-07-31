/**
 * LCTS foundation tests — exercises the shared building blocks without touching
 * any service implementation: tracking() envelope, confidenceFrom(), emptyInventory(),
 * readCurrentInventory() with stub stores, and TRACKING_RULES / TrackingRuleRegistry.
 *
 * No real ArtifactStore (no filesystem IO in the test bodies). All clocks are injected.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { LcisEngine } from '@letbuyy/lcis-core';
import { evidence, notConnected } from '@letbuyy/lcis-core';
import {
  confidenceFrom,
  emptyInventory,
  readCurrentInventory,
  tracking,
  TRACKING_RULES,
  TrackingRuleRegistry,
} from '../src/shared/index';

// ── fixed clock ────────────────────────────────────────────────────────────────

const FIXED_TS = '2026-07-04T00:00:00.000Z';
const fixedNow = (): string => FIXED_TS;

// ── stub ArtifactStore factory ─────────────────────────────────────────────────

type StoreData = Record<string, unknown>;

function makeStore(data: StoreData) {
  return {
    has(name: string): boolean {
      return Object.prototype.hasOwnProperty.call(data, name);
    },
    tryRead<T = unknown>(name: string): T | null {
      return Object.prototype.hasOwnProperty.call(data, name) ? (data[name] as T) : null;
    },
    read<T = unknown>(name: string): T {
      if (!Object.prototype.hasOwnProperty.call(data, name)) throw new Error(`artifact not found: ${name}`);
      return data[name] as T;
    },
    pathOf(name: string): string {
      return `/stub/${name}`;
    },
  } as unknown as LcisEngine['store'];
}

function makeEngine(data: StoreData): LcisEngine {
  return { store: makeStore(data) } as unknown as LcisEngine;
}

// ── real-shaped db/infra fixtures ──────────────────────────────────────────────

const DB_FIXTURE = {
  tables: [{ name: 'orders' }, { name: 'order_items' }, { name: 'sites' }],
  rpcs: [{ name: 'create_checkout_order' }, { name: 'confirm_order_payment_with_ledger' }],
  policies: [
    { name: 'orders_tenant_isolation', table: 'orders' },
    { name: 'sites_owner_only', table: 'sites' },
  ],
  triggers: [{ name: 'trg_audit_orders' }],
};

const INFRA_FIXTURE = {
  workers: [{ name: 'queue-worker' }, { name: 'webhook-worker' }],
  queues: [{ name: 'checkout-queue' }, { name: 'email-queue' }],
  routes: [{ path: '/v1/orders' }, { path: '/v1/products' }, { name: 'health' }],
  packages: [{ name: '@letbuyy/ui' }, { name: '@letbuyy/shared-types' }],
};

// ═══════════════════════════════════════════════════════════════════════════════
// tracking() envelope
// ═══════════════════════════════════════════════════════════════════════════════

test('tracking: body properties are passed through to the result', () => {
  const ev = [evidence('artifact-field', 'db-intel.json', 'ok', 'graphify-out/db-intel.json')];
  const result = tracking({ domain: 'orders', count: 42 }, { evidence: ev, now: fixedNow });
  assert.equal(result.domain, 'orders');
  assert.equal(result.count, 42);
});

test('tracking: timestamp equals the injected clock string', () => {
  const ev = [evidence('file', 'src/foo.ts')];
  const result = tracking({ x: 1 }, { evidence: ev, now: fixedNow });
  assert.equal(result.timestamp, FIXED_TS);
});

test('tracking: evidence array is preserved verbatim', () => {
  const ev = [
    evidence('artifact-field', 'db-intel.json', 'note'),
    notConnected('live:commits', 'GITHUB_TOKEN'),
  ];
  const result = tracking({}, { evidence: ev, now: fixedNow });
  assert.deepEqual(result.evidence, ev);
});

test('tracking: liveConnected defaults to false when not supplied', () => {
  const result = tracking({}, { evidence: [], now: fixedNow });
  assert.equal(result.liveConnected, false);
});

test('tracking: liveConnected can be overridden to true', () => {
  const result = tracking({}, { evidence: [], liveConnected: true, now: fixedNow });
  assert.equal(result.liveConnected, true);
});

test('tracking: confidence derived from evidence when not explicitly supplied', () => {
  const ev = [evidence('artifact-field', 'db-intel.json', 'ok', 'graphify-out/db-intel.json')];
  const result = tracking({}, { evidence: ev, now: fixedNow });
  assert.equal(result.confidence, confidenceFrom(ev));
});

test('tracking: explicit confidence overrides the derived value', () => {
  const ev = [evidence('artifact-field', 'db-intel.json', 'ok', 'graphify-out/db-intel.json')];
  const result = tracking({}, { evidence: ev, confidence: 0.77, now: fixedNow });
  assert.equal(result.confidence, 0.77);
});

test('tracking: sources are deduped from evidence.source when not supplied', () => {
  const ev = [
    evidence('artifact-field', 'db-intel.json', 'ok', 'graphify-out/db-intel.json'),
    evidence('artifact-field', 'db-intel.json', 'also ok', 'graphify-out/db-intel.json'),
    evidence('artifact-field', 'infra-intel.json', 'inf', 'graphify-out/infra-intel.json'),
  ];
  const result = tracking({}, { evidence: ev, now: fixedNow });
  const sorted = [...result.sources].sort();
  assert.deepEqual(sorted, ['graphify-out/db-intel.json', 'graphify-out/infra-intel.json']);
});

test('tracking: explicit sources override the deduped evidence.source list', () => {
  const ev = [evidence('file', 'src/foo.ts', 'note', 'src/foo.ts')];
  const explicit = ['custom-source-a', 'custom-source-b'];
  const result = tracking({}, { evidence: ev, sources: explicit, now: fixedNow });
  assert.deepEqual(result.sources, explicit);
});

test('tracking: sources contains no duplicates when evidence repeats the same source', () => {
  const ev = Array.from({ length: 5 }, () =>
    evidence('artifact-field', 'ref', 'detail', 'graphify-out/db-intel.json'),
  );
  const result = tracking({}, { evidence: ev, now: fixedNow });
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0], 'graphify-out/db-intel.json');
});

test('tracking: evidence without source fields produces empty sources array', () => {
  const ev = [evidence('artifact-field', 'ref', 'detail')];
  const result = tracking({}, { evidence: ev, now: fixedNow });
  assert.equal(result.sources.length, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// confidenceFrom
// ═══════════════════════════════════════════════════════════════════════════════

test('confidenceFrom: returns 0 for empty evidence array', () => {
  assert.equal(confidenceFrom([]), 0);
});

test('confidenceFrom: returns 0 when all evidence is not-connected', () => {
  const ev = [
    notConnected('live:commits', 'GITHUB_TOKEN'),
    notConnected('live:deploys', 'VERCEL_TOKEN'),
  ];
  assert.equal(confidenceFrom(ev), 0);
});

test('confidenceFrom: returns 0.6 for exactly 1 connected evidence item', () => {
  const ev = [evidence('artifact-field', 'db-intel.json')];
  assert.equal(confidenceFrom(ev), 0.6);
});

test('confidenceFrom: returns 0.7 for 2 connected evidence items', () => {
  const ev = [
    evidence('artifact-field', 'db-intel.json'),
    evidence('artifact-field', 'infra-intel.json'),
  ];
  assert.equal(confidenceFrom(ev), 0.7);
});

test('confidenceFrom: caps at 0.9 regardless of how many connected items are provided', () => {
  const ev = Array.from({ length: 20 }, (_, i) =>
    evidence('artifact-field', `ref-${i}`),
  );
  assert.equal(confidenceFrom(ev), 0.9);
});

test('confidenceFrom: not-connected items do not count toward connected total', () => {
  const connected = evidence('artifact-field', 'db-intel.json');
  const notConn = notConnected('live:commits', 'GITHUB_TOKEN');
  // 1 connected → 0.5 + 0.1*1 = 0.6
  assert.equal(confidenceFrom([connected, notConn]), 0.6);
});

// ═══════════════════════════════════════════════════════════════════════════════
// emptyInventory
// ═══════════════════════════════════════════════════════════════════════════════

test('emptyInventory: all array fields are empty', () => {
  const inv = emptyInventory('test-label');
  for (const key of ['tables', 'rpcs', 'policies', 'triggers', 'workers', 'queues', 'routes', 'packages'] as const) {
    assert.equal(inv[key].length, 0, `expected ${key} to be empty`);
  }
});

test('emptyInventory: label is preserved', () => {
  const inv = emptyInventory('baseline');
  assert.equal(inv.label, 'baseline');
});

test('emptyInventory: at defaults to null when not supplied', () => {
  const inv = emptyInventory('baseline');
  assert.equal(inv.at, null);
});

test('emptyInventory: at is preserved when supplied', () => {
  const inv = emptyInventory('archive', FIXED_TS);
  assert.equal(inv.at, FIXED_TS);
});

// ═══════════════════════════════════════════════════════════════════════════════
// readCurrentInventory — happy path (both artifacts present + valid)
// ═══════════════════════════════════════════════════════════════════════════════

test('readCurrentInventory: tables are sorted and deduplicated from db-intel', () => {
  const { inventory } = readCurrentInventory(
    makeEngine({ 'db-intel.json': DB_FIXTURE }),
    fixedNow,
  );
  assert.deepEqual([...inventory.tables].sort(), inventory.tables.slice());
  assert.ok(inventory.tables.includes('orders'));
  assert.ok(inventory.tables.includes('sites'));
  assert.ok(inventory.tables.includes('order_items'));
});

test('readCurrentInventory: rpcs are sorted from db-intel', () => {
  const { inventory } = readCurrentInventory(
    makeEngine({ 'db-intel.json': DB_FIXTURE }),
    fixedNow,
  );
  assert.ok(inventory.rpcs.includes('create_checkout_order'));
  assert.ok(inventory.rpcs.includes('confirm_order_payment_with_ledger'));
});

test('readCurrentInventory: workers and queues come from infra-intel', () => {
  const { inventory } = readCurrentInventory(
    makeEngine({ 'db-intel.json': DB_FIXTURE, 'infra-intel.json': INFRA_FIXTURE }),
    fixedNow,
  );
  assert.ok(inventory.workers.includes('queue-worker'));
  assert.ok(inventory.workers.includes('webhook-worker'));
  assert.ok(inventory.queues.includes('checkout-queue'));
  assert.ok(inventory.queues.includes('email-queue'));
});

test('readCurrentInventory: routes include paths and named entries from infra-intel', () => {
  const { inventory } = readCurrentInventory(
    makeEngine({ 'db-intel.json': DB_FIXTURE, 'infra-intel.json': INFRA_FIXTURE }),
    fixedNow,
  );
  assert.ok(inventory.routes.includes('/v1/orders'));
  assert.ok(inventory.routes.includes('health'));
});

test('readCurrentInventory: inventory label is "current"', () => {
  const { inventory } = readCurrentInventory(makeEngine({}), fixedNow);
  assert.equal(inventory.label, 'current');
});

test('readCurrentInventory: inventory.at equals the injected clock', () => {
  const { inventory } = readCurrentInventory(makeEngine({}), fixedNow);
  assert.equal(inventory.at, FIXED_TS);
});

test('readCurrentInventory: missing db-intel produces a not-connected evidence entry', () => {
  const { evidence: ev } = readCurrentInventory(makeEngine({}), fixedNow);
  assert.ok(
    ev.some((e) => e.kind === 'not-connected' && e.ref.includes('inventory:db')),
    'expected not-connected evidence for missing db-intel',
  );
});

test('readCurrentInventory: missing infra-intel produces a not-connected evidence entry', () => {
  const { evidence: ev } = readCurrentInventory(makeEngine({}), fixedNow);
  assert.ok(
    ev.some((e) => e.kind === 'not-connected' && e.ref.includes('inventory:infra')),
    'expected not-connected evidence for missing infra-intel',
  );
});

test('readCurrentInventory: missing db-intel yields empty table/rpc/policy/trigger arrays', () => {
  const { inventory } = readCurrentInventory(makeEngine({}), fixedNow);
  assert.equal(inventory.tables.length, 0);
  assert.equal(inventory.rpcs.length, 0);
  assert.equal(inventory.policies.length, 0);
  assert.equal(inventory.triggers.length, 0);
});

test('readCurrentInventory: missing infra-intel yields empty worker/queue/route/package arrays', () => {
  const { inventory } = readCurrentInventory(makeEngine({}), fixedNow);
  assert.equal(inventory.workers.length, 0);
  assert.equal(inventory.queues.length, 0);
  assert.equal(inventory.routes.length, 0);
  assert.equal(inventory.packages.length, 0);
});

test('readCurrentInventory: malformed db-intel does not throw and yields empty db arrays', () => {
  const malformed = { tables: 'not-an-array', rpcs: 999 };
  assert.doesNotThrow(() => {
    const { inventory } = readCurrentInventory(
      makeEngine({ 'db-intel.json': malformed }),
      fixedNow,
    );
    assert.equal(inventory.tables.length, 0);
    assert.equal(inventory.rpcs.length, 0);
  });
});

test('readCurrentInventory: malformed infra-intel does not throw and yields empty infra arrays', () => {
  const malformed = { workers: 'bad', queues: null };
  assert.doesNotThrow(() => {
    const { inventory } = readCurrentInventory(
      makeEngine({ 'infra-intel.json': malformed }),
      fixedNow,
    );
    assert.equal(inventory.workers.length, 0);
    assert.equal(inventory.queues.length, 0);
  });
});

test('readCurrentInventory: malformed db-intel produces an artifact-field evidence (not a throw)', () => {
  const malformed = { tables: 'not-an-array' };
  const { evidence: ev } = readCurrentInventory(
    makeEngine({ 'db-intel.json': malformed }),
    fixedNow,
  );
  assert.ok(
    ev.some((e) => e.kind === 'artifact-field' && e.ref === 'db-intel.json'),
    'expected artifact-field evidence for malformed db-intel',
  );
});

test('readCurrentInventory: valid db-intel produces an artifact-field evidence with counts', () => {
  const { evidence: ev } = readCurrentInventory(
    makeEngine({ 'db-intel.json': DB_FIXTURE }),
    fixedNow,
  );
  const dbEv = ev.find((e) => e.kind === 'artifact-field' && e.ref === 'db-intel.json');
  assert.ok(dbEv, 'expected artifact-field evidence for db-intel.json');
  assert.ok(dbEv.detail?.includes('tables'), 'detail should mention tables');
});

// ═══════════════════════════════════════════════════════════════════════════════
// TRACKING_RULES / TrackingRuleRegistry
// ═══════════════════════════════════════════════════════════════════════════════

test('TRACKING_RULES: contains exactly 6 rules', () => {
  assert.equal(TRACKING_RULES.length, 6);
});

test('TRACKING_RULES: all rule ids are unique', () => {
  const ids = TRACKING_RULES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('TRACKING_RULES: ids are exactly TR01 through TR06', () => {
  const ids = TRACKING_RULES.map((r) => r.id).sort();
  assert.deepEqual(ids, ['TR01', 'TR02', 'TR03', 'TR04', 'TR05', 'TR06']);
});

test('TRACKING_RULES: every rule has a non-empty title', () => {
  for (const rule of TRACKING_RULES) {
    assert.ok(rule.title.length > 0, `rule ${rule.id} has empty title`);
  }
});

test('TRACKING_RULES: every rule has a non-empty description', () => {
  for (const rule of TRACKING_RULES) {
    assert.ok(rule.description.length > 0, `rule ${rule.id} has empty description`);
  }
});

test('TRACKING_RULES: TR03 is the money/tenant rule with severity "critical"', () => {
  const tr03 = TRACKING_RULES.find((r) => r.id === 'TR03');
  assert.ok(tr03, 'TR03 not found');
  assert.equal(tr03.severity, 'critical');
});

test('TRACKING_RULES: TR06 live-feed rule has severity "info"', () => {
  const tr06 = TRACKING_RULES.find((r) => r.id === 'TR06');
  assert.ok(tr06, 'TR06 not found');
  assert.equal(tr06.severity, 'info');
});

test('TrackingRuleRegistry.list() returns the same 6 rules as TRACKING_RULES', () => {
  const reg = new TrackingRuleRegistry();
  assert.deepEqual(reg.list(), TRACKING_RULES);
});

test('TrackingRuleRegistry.get() returns the rule for a valid id', () => {
  const reg = new TrackingRuleRegistry();
  for (const expected of TRACKING_RULES) {
    const found = reg.get(expected.id);
    assert.ok(found, `expected to find rule ${expected.id}`);
    assert.equal(found.id, expected.id);
    assert.equal(found.title, expected.title);
  }
});

test('TrackingRuleRegistry.get() returns undefined for an unknown id', () => {
  const reg = new TrackingRuleRegistry();
  assert.equal(reg.get('TR99'), undefined);
  assert.equal(reg.get(''), undefined);
  assert.equal(reg.get('tr01'), undefined); // case-sensitive
});

test('TrackingRuleRegistry.list() is immutable — the returned array is the frozen readonly ref', () => {
  const reg = new TrackingRuleRegistry();
  const list = reg.list();
  // Calling list() twice returns the same underlying readonly array
  assert.equal(list, reg.list());
});

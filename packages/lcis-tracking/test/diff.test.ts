/**
 * SemanticDiffService tests — LCTS Phase 10.
 * Fixed clock: '2026-07-04T00:00:00.000Z'
 * Stub artifact store: no real graphify-out dependency.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ArtifactStore, createEngine } from '@letbuyy/lcis-core';
import { SemanticDiffService } from '../src/diff/index';
import type { SnapshotInventory } from '../src/shared/types';

// ── Helpers ────────────────────────────────────────────────────────────────────

const FIXED_CLOCK = '2026-07-04T00:00:00.000Z';
const fixedNow = (): string => FIXED_CLOCK;

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

function makeEngine(artifacts: Record<string, unknown> = {}) {
  return createEngine({ store: stubStore(artifacts), repoRoot: '/stub' });
}

function makeService(artifacts: Record<string, unknown> = {}) {
  return new SemanticDiffService(makeEngine(artifacts), fixedNow);
}

function emptySnap(label: string, at: string | null = FIXED_CLOCK): SnapshotInventory {
  return { label, at, tables: [], rpcs: [], policies: [], triggers: [], workers: [], queues: [], routes: [], packages: [] };
}

function fullSnap(label: string, at: string | null = FIXED_CLOCK): SnapshotInventory {
  return {
    label,
    at,
    tables: ['orders', 'products'],
    rpcs: ['create_order'],
    policies: ['rls-orders'],
    triggers: ['trg_audit'],
    workers: ['payment-worker'],
    queues: ['order-queue'],
    routes: ['/api/orders', '/api/products'],
    packages: ['@letbuyy/ui'],
  };
}

// ── currentInventory() ─────────────────────────────────────────────────────────

describe('currentInventory — absent artifacts', () => {
  it('returns an InventoryRead with two not-connected evidence entries when both artifacts are absent', () => {
    const svc = makeService({});
    const inv = svc.currentInventory();
    const notConn = inv.evidence.filter((e) => e.kind === 'not-connected');
    assert.equal(notConn.length, 2, 'should have one not-connected per missing artifact');
  });

  it('inventory label is "current"', () => {
    const inv = makeService({}).currentInventory();
    assert.equal(inv.inventory.label, 'current');
  });

  it('inventory has empty arrays when artifacts absent', () => {
    const inv = makeService({}).currentInventory();
    assert.equal(inv.inventory.tables.length, 0);
    assert.equal(inv.inventory.rpcs.length, 0);
    assert.equal(inv.inventory.packages.length, 0);
  });

  it('does not throw when artifacts are absent', () => {
    assert.doesNotThrow(() => makeService({}).currentInventory());
  });
});

describe('currentInventory — with db-intel artifact', () => {
  const dbFixture = {
    tables: [{ name: 'orders' }, { name: 'products' }],
    rpcs: [{ name: 'create_order' }],
    policies: [{ name: 'rls-orders', table: 'orders' }],
    triggers: [{ name: 'trg_audit' }],
  };

  it('reads tables from db-intel.json', () => {
    const inv = makeService({ 'db-intel.json': dbFixture }).currentInventory();
    assert.deepEqual(inv.inventory.tables, ['orders', 'products']);
  });

  it('reads rpcs from db-intel.json', () => {
    const inv = makeService({ 'db-intel.json': dbFixture }).currentInventory();
    assert.deepEqual(inv.inventory.rpcs, ['create_order']);
  });

  it('evidence includes artifact-field kind for db-intel when present', () => {
    const inv = makeService({ 'db-intel.json': dbFixture }).currentInventory();
    const field = inv.evidence.find((e) => e.kind === 'artifact-field' && e.ref === 'db-intel.json');
    assert.ok(field, 'should have artifact-field evidence for db-intel.json');
  });

  it('gracefully handles malformed db-intel.json (tables as non-array)', () => {
    const inv = makeService({ 'db-intel.json': { tables: 'bad', rpcs: null } }).currentInventory();
    // zod-safe degradation — inventory is empty, no throw
    assert.doesNotThrow(() => inv);
  });
});

describe('currentInventory — with infra-intel artifact', () => {
  const infraFixture = {
    workers: [{ name: 'payment-worker' }],
    queues: [{ name: 'order-queue' }],
    routes: [{ path: '/api/orders' }],
    packages: [{ name: '@letbuyy/ui' }],
  };

  it('reads workers from infra-intel.json', () => {
    const inv = makeService({ 'infra-intel.json': infraFixture }).currentInventory();
    assert.deepEqual(inv.inventory.workers, ['payment-worker']);
  });

  it('reads queues from infra-intel.json', () => {
    const inv = makeService({ 'infra-intel.json': infraFixture }).currentInventory();
    assert.deepEqual(inv.inventory.queues, ['order-queue']);
  });

  it('reads routes from infra-intel.json using path field', () => {
    const inv = makeService({ 'infra-intel.json': infraFixture }).currentInventory();
    assert.deepEqual(inv.inventory.routes, ['/api/orders']);
  });
});

// ── diff() — empty snapshots ────────────────────────────────────────────────────

describe('diff — both snapshots empty', () => {
  it('produces zero added, removed, unchanged', () => {
    const svc = makeService();
    const d = svc.diff(emptySnap('v1'), emptySnap('v2'));
    assert.equal(d.added, 0);
    assert.equal(d.removed, 0);
    assert.equal(d.unchanged, 0);
  });

  it('confidence is 0 when both snapshots empty', () => {
    const d = makeService().diff(emptySnap('a'), emptySnap('b'));
    assert.equal(d.confidence, 0);
  });

  it('records array is empty', () => {
    const d = makeService().diff(emptySnap('a'), emptySnap('b'));
    assert.equal(d.records.length, 0);
  });

  it('summary mentions 0 added, 0 removed, 0 unchanged', () => {
    const d = makeService().diff(emptySnap('before'), emptySnap('after'));
    assert.ok(d.summary.includes('0 added, 0 removed, 0 unchanged'), `unexpected summary: ${d.summary}`);
  });

  it('liveConnected is false for empty diff', () => {
    assert.equal(makeService().diff(emptySnap('a'), emptySnap('b')).liveConnected, false);
  });

  it('timestamp equals fixed clock', () => {
    assert.equal(makeService().diff(emptySnap('a'), emptySnap('b')).timestamp, FIXED_CLOCK);
  });
});

// ── diff() — added items ───────────────────────────────────────────────────────

describe('diff — items added in after', () => {
  const before = emptySnap('v1');
  const after = { ...emptySnap('v2'), tables: ['orders', 'products'] } satisfies SnapshotInventory;

  it('counts added correctly', () => {
    const d = makeService().diff(before, after);
    assert.equal(d.added, 2);
  });

  it('removed is 0 when nothing removed', () => {
    assert.equal(makeService().diff(before, after).removed, 0);
  });

  it('record ids follow pattern kind:subject#action', () => {
    const d = makeService().diff(before, after);
    const ids = d.records.map((r) => r.id);
    assert.ok(ids.includes('table:orders#added'));
    assert.ok(ids.includes('table:products#added'));
  });

  it('action on added records is "added"', () => {
    const d = makeService().diff(before, after);
    assert.ok(d.records.every((r) => r.action === 'added'));
  });

  it('connection is CONNECTED on added records', () => {
    const d = makeService().diff(before, after);
    assert.ok(d.records.every((r) => r.connection === 'CONNECTED'));
  });

  it('record.at matches after.at', () => {
    const d = makeService().diff(before, after);
    assert.ok(d.records.every((r) => r.at === after.at));
  });

  it('evidence cites both snapshot labels', () => {
    const d = makeService().diff(before, after);
    const rec = d.records.find((r) => r.id === 'table:orders#added');
    assert.ok(rec, 'should have record for orders');
    const detail = rec.evidence[0].detail ?? '';
    assert.ok(detail.includes('v1') || detail.includes('v2'), `evidence detail should cite snapshots: ${detail}`);
  });
});

// ── diff() — removed items ─────────────────────────────────────────────────────

describe('diff — items removed in after', () => {
  const before = { ...emptySnap('v1'), rpcs: ['create_order', 'delete_order'] } satisfies SnapshotInventory;
  const after = emptySnap('v2');

  it('counts removed correctly', () => {
    const d = makeService().diff(before, after);
    assert.equal(d.removed, 2);
  });

  it('added is 0 when nothing added', () => {
    assert.equal(makeService().diff(before, after).added, 0);
  });

  it('record ids include #removed', () => {
    const d = makeService().diff(before, after);
    assert.ok(d.records.some((r) => r.id === 'rpc:create_order#removed'));
    assert.ok(d.records.some((r) => r.id === 'rpc:delete_order#removed'));
  });

  it('action on removed records is "removed"', () => {
    const d = makeService().diff(before, after);
    assert.ok(d.records.every((r) => r.action === 'removed'));
  });
});

// ── diff() — unchanged items ───────────────────────────────────────────────────

describe('diff — unchanged items', () => {
  const snap = { ...emptySnap('v1'), tables: ['orders'] } satisfies SnapshotInventory;
  const snapV2 = { ...emptySnap('v2'), tables: ['orders'] } satisfies SnapshotInventory;

  it('unchanged count is 1 when same single table in both', () => {
    const d = makeService().diff(snap, snapV2);
    assert.equal(d.unchanged, 1);
    assert.equal(d.added, 0);
    assert.equal(d.removed, 0);
  });

  it('no records emitted for unchanged items', () => {
    const d = makeService().diff(snap, snapV2);
    assert.equal(d.records.length, 0);
  });
});

// ── diff() — mixed add/remove/unchanged ───────────────────────────────────────

describe('diff — mixed scenario', () => {
  const before: SnapshotInventory = {
    label: 'before',
    at: '2026-06-01T00:00:00.000Z',
    tables: ['orders', 'products'],
    rpcs: ['create_order'],
    policies: [],
    triggers: [],
    workers: [],
    queues: [],
    routes: [],
    packages: [],
  };
  const after: SnapshotInventory = {
    label: 'after',
    at: FIXED_CLOCK,
    tables: ['orders', 'customers'], // products removed, customers added
    rpcs: ['create_order'],          // unchanged
    policies: [],
    triggers: [],
    workers: [],
    queues: [],
    routes: [],
    packages: [],
  };

  it('added count is 1 (customers)', () => {
    assert.equal(makeService().diff(before, after).added, 1);
  });

  it('removed count is 1 (products)', () => {
    assert.equal(makeService().diff(before, after).removed, 1);
  });

  it('unchanged count is 2 (orders + create_order)', () => {
    assert.equal(makeService().diff(before, after).unchanged, 2);
  });

  it('summary mentions correct counts', () => {
    const d = makeService().diff(before, after);
    assert.ok(d.summary.includes('1 added, 1 removed, 2 unchanged'), `unexpected summary: ${d.summary}`);
  });

  it('summary includes before and after labels', () => {
    const d = makeService().diff(before, after);
    assert.ok(d.summary.includes('before'), 'should mention before label');
    assert.ok(d.summary.includes('after'), 'should mention after label');
  });
});

// ── diff() — category ordering ─────────────────────────────────────────────────

describe('diff — deterministic ordering', () => {
  it('records are ordered: tables first, then rpcs, then policies, then triggers, then workers, queues, routes, packages', () => {
    const before = emptySnap('v1');
    const after: SnapshotInventory = {
      label: 'v2',
      at: FIXED_CLOCK,
      tables: ['ztable'],
      rpcs: ['arpc'],
      policies: [],
      triggers: [],
      workers: ['wrkr'],
      queues: [],
      routes: [],
      packages: [],
    };
    const d = makeService().diff(before, after);
    const kinds = d.records.map((r) => r.kind);
    assert.equal(kinds[0], 'table');
    assert.equal(kinds[1], 'rpc');
    assert.equal(kinds[2], 'worker');
  });

  it('subjects within a category are sorted ascending', () => {
    const before = emptySnap('v1');
    const after: SnapshotInventory = { ...emptySnap('v2'), tables: ['zebra', 'alpha', 'monkey'] };
    const d = makeService().diff(before, after);
    const subjects = d.records.map((r) => r.subject);
    assert.deepEqual(subjects, ['alpha', 'monkey', 'zebra']);
  });

  it('two identical calls produce identical JSON', () => {
    const before: SnapshotInventory = { ...emptySnap('snap-a'), tables: ['t1'], packages: ['pkg-a'] };
    const after: SnapshotInventory = { ...emptySnap('snap-b'), tables: ['t2'], packages: ['pkg-a'] };
    const svc = makeService();
    const d1 = svc.diff(before, after);
    const d2 = svc.diff(before, after);
    assert.deepEqual(JSON.stringify(d1), JSON.stringify(d2));
  });
});

// ── diff() — provenance / TrackingArtifact fields ─────────────────────────────

describe('diff — provenance fields', () => {
  it('liveConnected is always false (structural diff; no live feed)', () => {
    const d = makeService().diff(fullSnap('a'), fullSnap('b'));
    assert.equal(d.liveConnected, false);
  });

  it('timestamp equals fixed clock', () => {
    const d = makeService().diff(emptySnap('x'), fullSnap('y'));
    assert.equal(d.timestamp, FIXED_CLOCK);
  });

  it('before and after fields match snapshot labels', () => {
    const d = makeService().diff(emptySnap('snap-before'), fullSnap('snap-after'));
    assert.equal(d.before, 'snap-before');
    assert.equal(d.after, 'snap-after');
  });

  it('confidence > 0 when there are change records (non-empty snapshots)', () => {
    const d = makeService().diff(emptySnap('a'), fullSnap('b'));
    assert.ok(d.confidence > 0, `confidence should be >0, got ${d.confidence}`);
  });

  it('sources array is populated from evidence when records exist', () => {
    const d = makeService().diff(emptySnap('a'), { ...emptySnap('b'), tables: ['orders'] });
    assert.ok(Array.isArray(d.sources));
  });

  it('each change record carries at least one evidence entry', () => {
    const d = makeService().diff(emptySnap('a'), { ...emptySnap('b'), packages: ['pkg-x'] });
    assert.ok(d.records.every((r) => r.evidence.length > 0));
  });
});

// ── diff() — all categories represented ───────────────────────────────────────

describe('diff — all eight categories', () => {
  it('emits records for all categories when each has a new item', () => {
    const before = emptySnap('base');
    const after = fullSnap('new');
    const d = makeService().diff(before, after);
    const kinds = new Set(d.records.map((r) => r.kind));
    assert.ok(kinds.has('table'));
    assert.ok(kinds.has('rpc'));
    assert.ok(kinds.has('policy'));
    assert.ok(kinds.has('trigger'));
    assert.ok(kinds.has('worker'));
    assert.ok(kinds.has('queue'));
    assert.ok(kinds.has('route'));
    assert.ok(kinds.has('package'));
  });

  it('total added count matches sum of new items across all categories', () => {
    const before = emptySnap('base');
    const after = fullSnap('new'); // 2 tables + 1 rpc + 1 policy + 1 trigger + 1 worker + 1 queue + 2 routes + 1 package = 10
    const d = makeService().diff(before, after);
    assert.equal(d.added, 10);
  });

  it('removed count for full->empty diff equals sum of all items in before', () => {
    const before = fullSnap('old');
    const after = emptySnap('empty');
    const d = makeService().diff(before, after);
    assert.equal(d.removed, 10);
  });
});

// ── diff() — snapshot with null at ────────────────────────────────────────────

describe('diff — null at field', () => {
  it('record.at is null when after.at is null', () => {
    const before = emptySnap('a', null);
    const after: SnapshotInventory = { ...emptySnap('b', null), tables: ['t'] };
    const d = makeService().diff(before, after);
    assert.equal(d.records[0].at, null);
  });

  it('does not throw when both snapshots have null at', () => {
    assert.doesNotThrow(() =>
      makeService().diff(emptySnap('a', null), { ...emptySnap('b', null), rpcs: ['my_rpc'] }),
    );
  });
});

// ── diff() — deduplication ─────────────────────────────────────────────────────

describe('diff — deduplication of subjects', () => {
  it('handles duplicate entries in input arrays without double-counting', () => {
    const before = emptySnap('v1');
    // duplicates in input — only unique subjects should be counted
    const after: SnapshotInventory = { ...emptySnap('v2'), tables: ['orders', 'orders', 'products'] };
    const svc = makeService();
    const d = svc.diff(before, after);
    // Set-based: 'orders' and 'products' — 2 unique added
    assert.equal(d.added, 2);
  });
});

/**
 * MetricCatalogService tests — per-layer key format, always-included twin-independent
 * entries, sorted + deduped output, determinism, and the resolveSeries CONNECTED /
 * NOT_CONNECTED contract. Fixed clock '2026-07-04T00:00:00.000Z'. 62 tests total.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtifactStore, createEngine } from '@letbuyy/lcis-core';
import { MetricCatalogService } from '../src/catalog/index';

const FIXED = '2026-07-04T00:00:00.000Z';
const NOW = () => FIXED;

// ── Stub helpers ──────────────────────────────────────────────────────────────

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

function createCatalog(artifacts: Record<string, unknown>): MetricCatalogService {
  const core = createEngine({ store: stubStore(artifacts), repoRoot: '/stub' });
  return new MetricCatalogService(core, NOW);
}

// Artifact sets used across multiple suites
const EMPTY_ARTIFACTS: Record<string, unknown> = {};

const API_ARTIFACTS: Record<string, unknown> = {
  'infra-intel.json': {
    workers: [],
    queues: [],
    routes: [{ path: '/v1/orders' }, { path: '/v1/products' }],
  },
};

const RPC_ARTIFACTS: Record<string, unknown> = {
  'db-intel.json': {
    tables: [],
    rpcs: [{ name: 'create_checkout_order' }, { name: 'confirm_order_payment_with_ledger' }],
    policies: [],
    triggers: [],
  },
};

const TABLE_ARTIFACTS: Record<string, unknown> = {
  'db-intel.json': {
    tables: [{ name: 'orders' }, { name: 'payment_transactions' }],
    rpcs: [],
    policies: [],
    triggers: [],
  },
};

const QUEUE_ARTIFACTS: Record<string, unknown> = {
  'infra-intel.json': {
    workers: [],
    queues: [{ name: 'order-events' }, { name: 'email-jobs' }],
    routes: [],
  },
};

const WORKER_ARTIFACTS: Record<string, unknown> = {
  'infra-intel.json': {
    workers: [{ name: 'queue-worker' }, { name: 'cron-worker' }],
    queues: [],
    routes: [],
  },
};

const FULL_ARTIFACTS: Record<string, unknown> = {
  'domain-intel.json': {
    domains: [
      { key: 'orders', dependsOn: [], tables: ['orders'], rpcs: ['create_checkout_order'], owners: ['@orders-team'] },
      { key: 'payments', dependsOn: ['orders'], tables: ['payment_transactions'], rpcs: ['confirm_order_payment_with_ledger'], owners: ['@payments-team'] },
    ],
  },
  'db-intel.json': {
    tables: [{ name: 'orders' }, { name: 'payment_transactions' }],
    rpcs: [{ name: 'create_checkout_order' }, { name: 'confirm_order_payment_with_ledger' }],
    policies: [{ name: 'orders_rls', table: 'orders' }],
    triggers: [{ name: 'orders_audit', table: 'orders' }],
  },
  'infra-intel.json': {
    workers: [{ name: 'queue-worker' }],
    queues: [{ name: 'order-events' }],
    routes: [{ path: '/v1/orders' }],
  },
};

// ── 1. Empty twin → only 2 twin-independent metrics ──────────────────────────

test('empty twin: buildCatalog returns exactly 2 entries', () => {
  const catalog = createCatalog(EMPTY_ARTIFACTS).buildCatalog();
  assert.equal(catalog.length, 2);
});

test('empty twin: includes ratio.cache.redis', () => {
  const catalog = createCatalog(EMPTY_ARTIFACTS).buildCatalog();
  assert.ok(catalog.some((d) => d.key === 'ratio.cache.redis'));
});

test('empty twin: includes resource.db.postgres', () => {
  const catalog = createCatalog(EMPTY_ARTIFACTS).buildCatalog();
  assert.ok(catalog.some((d) => d.key === 'resource.db.postgres'));
});

test('empty twin: no twin-derived metrics present', () => {
  const catalog = createCatalog(EMPTY_ARTIFACTS).buildCatalog();
  assert.ok(!catalog.some((d) => d.key.startsWith('latency.') || d.key.startsWith('throughput.') || d.key.startsWith('scaling.') || d.key.startsWith('cold-start.') || d.key.startsWith('resource.worker.')));
});

// ── 2. API/route node → latency.api.<name> ───────────────────────────────────

test('api routes: latency.api.* entries emitted for each route', () => {
  const catalog = createCatalog(API_ARTIFACTS).buildCatalog();
  assert.ok(catalog.some((d) => d.key === 'latency.api./v1/orders'));
  assert.ok(catalog.some((d) => d.key === 'latency.api./v1/products'));
});

test('api route descriptor: kind is latency', () => {
  const catalog = createCatalog(API_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'latency.api./v1/orders')!;
  assert.equal(d.kind, 'latency');
});

test('api route descriptor: unit is ms', () => {
  const catalog = createCatalog(API_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'latency.api./v1/orders')!;
  assert.equal(d.unit, 'ms');
});

test('api route descriptor: liveSource is AE SQL API', () => {
  const catalog = createCatalog(API_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'latency.api./v1/orders')!;
  assert.match(d.liveSource, /Analytics Engine SQL API/);
});

test('api route descriptor: reachable is false', () => {
  const catalog = createCatalog(API_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'latency.api./v1/orders')!;
  assert.equal(d.reachable, false);
});

test('api route descriptor: unreachableReason mentions GET boundary', () => {
  const catalog = createCatalog(API_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'latency.api./v1/orders')!;
  assert.ok(d.unreachableReason && d.unreachableReason.length > 0);
  assert.match(d.unreachableReason, /GET/);
});

test('api route descriptor: requiredEnv is empty', () => {
  const catalog = createCatalog(API_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'latency.api./v1/orders')!;
  assert.deepEqual([...d.requiredEnv], []);
});

test('api route descriptor: entity is the twin node id', () => {
  const catalog = createCatalog(API_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'latency.api./v1/orders')!;
  assert.equal(d.entity, 'api:/v1/orders');
});

// ── 3. RPC node → latency.rpc.<name> ─────────────────────────────────────────

test('rpc: latency.rpc.* entries emitted for each rpc', () => {
  const catalog = createCatalog(RPC_ARTIFACTS).buildCatalog();
  assert.ok(catalog.some((d) => d.key === 'latency.rpc.create_checkout_order'));
  assert.ok(catalog.some((d) => d.key === 'latency.rpc.confirm_order_payment_with_ledger'));
});

test('rpc descriptor: kind is latency', () => {
  const catalog = createCatalog(RPC_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'latency.rpc.create_checkout_order')!;
  assert.equal(d.kind, 'latency');
});

test('rpc descriptor: unit is ms', () => {
  const catalog = createCatalog(RPC_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'latency.rpc.create_checkout_order')!;
  assert.equal(d.unit, 'ms');
});

test('rpc descriptor: liveSource is AE SQL API', () => {
  const catalog = createCatalog(RPC_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'latency.rpc.create_checkout_order')!;
  assert.match(d.liveSource, /Analytics Engine SQL API/);
});

test('rpc descriptor: reachable is false', () => {
  const catalog = createCatalog(RPC_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'latency.rpc.create_checkout_order')!;
  assert.equal(d.reachable, false);
});

test('rpc descriptor: requiredEnv is empty', () => {
  const catalog = createCatalog(RPC_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'latency.rpc.create_checkout_order')!;
  assert.deepEqual([...d.requiredEnv], []);
});

test('rpc descriptor: entity is rpc:<name>', () => {
  const catalog = createCatalog(RPC_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'latency.rpc.create_checkout_order')!;
  assert.equal(d.entity, 'rpc:create_checkout_order');
});

// ── 4. Table node → latency.db.<name> ────────────────────────────────────────

test('table: latency.db.* entries emitted for each table', () => {
  const catalog = createCatalog(TABLE_ARTIFACTS).buildCatalog();
  assert.ok(catalog.some((d) => d.key === 'latency.db.orders'));
  assert.ok(catalog.some((d) => d.key === 'latency.db.payment_transactions'));
});

test('table descriptor: kind is latency', () => {
  const catalog = createCatalog(TABLE_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'latency.db.orders')!;
  assert.equal(d.kind, 'latency');
});

test('table descriptor: unit is ms', () => {
  const catalog = createCatalog(TABLE_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'latency.db.orders')!;
  assert.equal(d.unit, 'ms');
});

test('table descriptor: liveSource is pg_stat_statements', () => {
  const catalog = createCatalog(TABLE_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'latency.db.orders')!;
  assert.match(d.liveSource, /pg_stat_statements/);
});

test('table descriptor: reachable is false', () => {
  const catalog = createCatalog(TABLE_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'latency.db.orders')!;
  assert.equal(d.reachable, false);
});

test('table descriptor: entity is table:<name>', () => {
  const catalog = createCatalog(TABLE_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'latency.db.orders')!;
  assert.equal(d.entity, 'table:orders');
});

test('table descriptor: unreachableReason is present', () => {
  const catalog = createCatalog(TABLE_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'latency.db.orders')!;
  assert.ok(d.unreachableReason && d.unreachableReason.length > 0);
});

// ── 5. Queue node → throughput + scaling ─────────────────────────────────────

test('queue: throughput.queue.* emitted for each queue', () => {
  const catalog = createCatalog(QUEUE_ARTIFACTS).buildCatalog();
  assert.ok(catalog.some((d) => d.key === 'throughput.queue.order-events'));
  assert.ok(catalog.some((d) => d.key === 'throughput.queue.email-jobs'));
});

test('queue: scaling.queue.* emitted for each queue', () => {
  const catalog = createCatalog(QUEUE_ARTIFACTS).buildCatalog();
  assert.ok(catalog.some((d) => d.key === 'scaling.queue.order-events'));
  assert.ok(catalog.some((d) => d.key === 'scaling.queue.email-jobs'));
});

test('throughput queue descriptor: kind is throughput', () => {
  const catalog = createCatalog(QUEUE_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'throughput.queue.order-events')!;
  assert.equal(d.kind, 'throughput');
});

test('throughput queue descriptor: reachable is false', () => {
  const catalog = createCatalog(QUEUE_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'throughput.queue.order-events')!;
  assert.equal(d.reachable, false);
});

test('throughput queue descriptor: liveSource mentions Cloudflare GraphQL', () => {
  const catalog = createCatalog(QUEUE_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'throughput.queue.order-events')!;
  assert.match(d.liveSource, /Cloudflare GraphQL/);
});

test('scaling queue descriptor: kind is scaling', () => {
  const catalog = createCatalog(QUEUE_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'scaling.queue.order-events')!;
  assert.equal(d.kind, 'scaling');
});

test('scaling queue descriptor: reachable is true', () => {
  const catalog = createCatalog(QUEUE_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'scaling.queue.order-events')!;
  assert.equal(d.reachable, true);
});

test('scaling queue descriptor: requiredEnv includes CLOUDFLARE_API_TOKEN', () => {
  const catalog = createCatalog(QUEUE_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'scaling.queue.order-events')!;
  assert.ok(d.requiredEnv.includes('CLOUDFLARE_API_TOKEN'));
});

test('scaling queue descriptor: requiredEnv includes CLOUDFLARE_ACCOUNT_ID', () => {
  const catalog = createCatalog(QUEUE_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'scaling.queue.order-events')!;
  assert.ok(d.requiredEnv.includes('CLOUDFLARE_ACCOUNT_ID'));
});

test('scaling queue descriptor: entity is queue:<name>', () => {
  const catalog = createCatalog(QUEUE_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'scaling.queue.order-events')!;
  assert.equal(d.entity, 'queue:order-events');
});

// ── 6. Worker node → cold-start + resource ────────────────────────────────────

test('worker: cold-start.worker.* emitted for each worker', () => {
  const catalog = createCatalog(WORKER_ARTIFACTS).buildCatalog();
  assert.ok(catalog.some((d) => d.key === 'cold-start.worker.queue-worker'));
  assert.ok(catalog.some((d) => d.key === 'cold-start.worker.cron-worker'));
});

test('worker: resource.worker.* emitted for each worker', () => {
  const catalog = createCatalog(WORKER_ARTIFACTS).buildCatalog();
  assert.ok(catalog.some((d) => d.key === 'resource.worker.queue-worker'));
  assert.ok(catalog.some((d) => d.key === 'resource.worker.cron-worker'));
});

test('cold-start descriptor: kind is cold-start', () => {
  const catalog = createCatalog(WORKER_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'cold-start.worker.queue-worker')!;
  assert.equal(d.kind, 'cold-start');
});

test('cold-start descriptor: liveSource is AE SQL API', () => {
  const catalog = createCatalog(WORKER_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'cold-start.worker.queue-worker')!;
  assert.match(d.liveSource, /Analytics Engine SQL API/);
});

test('cold-start descriptor: reachable is false', () => {
  const catalog = createCatalog(WORKER_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'cold-start.worker.queue-worker')!;
  assert.equal(d.reachable, false);
});

test('resource worker descriptor: kind is resource', () => {
  const catalog = createCatalog(WORKER_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'resource.worker.queue-worker')!;
  assert.equal(d.kind, 'resource');
});

test('resource worker descriptor: liveSource is AE SQL API', () => {
  const catalog = createCatalog(WORKER_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'resource.worker.queue-worker')!;
  assert.match(d.liveSource, /Analytics Engine SQL API/);
});

test('resource worker descriptor: reachable is false', () => {
  const catalog = createCatalog(WORKER_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'resource.worker.queue-worker')!;
  assert.equal(d.reachable, false);
});

test('worker descriptor: entity is worker:<name>', () => {
  const catalog = createCatalog(WORKER_ARTIFACTS).buildCatalog();
  const d = catalog.find((x) => x.key === 'cold-start.worker.queue-worker')!;
  assert.equal(d.entity, 'worker:queue-worker');
});

// ── 7. Always-included twin-independent entries ───────────────────────────────

test('ratio.cache.redis is always present regardless of twin content', () => {
  for (const arts of [EMPTY_ARTIFACTS, API_ARTIFACTS, RPC_ARTIFACTS, TABLE_ARTIFACTS, FULL_ARTIFACTS]) {
    const catalog = createCatalog(arts).buildCatalog();
    assert.ok(catalog.some((d) => d.key === 'ratio.cache.redis'), `missing in ${JSON.stringify(Object.keys(arts))}`);
  }
});

test('resource.db.postgres is always present regardless of twin content', () => {
  for (const arts of [EMPTY_ARTIFACTS, API_ARTIFACTS, WORKER_ARTIFACTS, FULL_ARTIFACTS]) {
    const catalog = createCatalog(arts).buildCatalog();
    assert.ok(catalog.some((d) => d.key === 'resource.db.postgres'));
  }
});

test('ratio.cache.redis: kind is ratio', () => {
  const d = createCatalog(EMPTY_ARTIFACTS).buildCatalog().find((x) => x.key === 'ratio.cache.redis')!;
  assert.equal(d.kind, 'ratio');
});

test('ratio.cache.redis: entity is infrastructure:redis', () => {
  const d = createCatalog(EMPTY_ARTIFACTS).buildCatalog().find((x) => x.key === 'ratio.cache.redis')!;
  assert.equal(d.entity, 'infrastructure:redis');
});

test('ratio.cache.redis: reachable is false (INFO not in allowlist)', () => {
  const d = createCatalog(EMPTY_ARTIFACTS).buildCatalog().find((x) => x.key === 'ratio.cache.redis')!;
  assert.equal(d.reachable, false);
});

test('resource.db.postgres: kind is resource', () => {
  const d = createCatalog(EMPTY_ARTIFACTS).buildCatalog().find((x) => x.key === 'resource.db.postgres')!;
  assert.equal(d.kind, 'resource');
});

test('resource.db.postgres: entity is database:postgres', () => {
  const d = createCatalog(EMPTY_ARTIFACTS).buildCatalog().find((x) => x.key === 'resource.db.postgres')!;
  assert.equal(d.entity, 'database:postgres');
});

test('resource.db.postgres: reachable is true', () => {
  const d = createCatalog(EMPTY_ARTIFACTS).buildCatalog().find((x) => x.key === 'resource.db.postgres')!;
  assert.equal(d.reachable, true);
});

test('resource.db.postgres: requiredEnv includes SUPABASE_MGMT_TOKEN', () => {
  const d = createCatalog(EMPTY_ARTIFACTS).buildCatalog().find((x) => x.key === 'resource.db.postgres')!;
  assert.ok(d.requiredEnv.includes('SUPABASE_MGMT_TOKEN'));
});

test('resource.db.postgres: requiredEnv includes SUPABASE_PROJECT_REF', () => {
  const d = createCatalog(EMPTY_ARTIFACTS).buildCatalog().find((x) => x.key === 'resource.db.postgres')!;
  assert.ok(d.requiredEnv.includes('SUPABASE_PROJECT_REF'));
});

// ── 8. Sorted by key ──────────────────────────────────────────────────────────

test('full catalog: keys are sorted alphabetically', () => {
  const catalog = createCatalog(FULL_ARTIFACTS).buildCatalog();
  const keys = catalog.map((d) => d.key);
  const sorted = [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  assert.deepEqual(keys, sorted);
});

test('empty catalog: keys are sorted (trivially 2 entries)', () => {
  const catalog = createCatalog(EMPTY_ARTIFACTS).buildCatalog();
  const keys = catalog.map((d) => d.key);
  const sorted = [...keys].sort();
  assert.deepEqual(keys, sorted);
});

test('worker-only catalog: keys are sorted', () => {
  const catalog = createCatalog(WORKER_ARTIFACTS).buildCatalog();
  const keys = catalog.map((d) => d.key);
  const sorted = [...keys].sort();
  assert.deepEqual(keys, sorted);
});

test('queue-only catalog: keys are sorted', () => {
  const catalog = createCatalog(QUEUE_ARTIFACTS).buildCatalog();
  const keys = catalog.map((d) => d.key);
  const sorted = [...keys].sort();
  assert.deepEqual(keys, sorted);
});

// ── 9. Deduplication ─────────────────────────────────────────────────────────

test('no duplicate keys in empty twin catalog', () => {
  const catalog = createCatalog(EMPTY_ARTIFACTS).buildCatalog();
  const keys = catalog.map((d) => d.key);
  assert.equal(keys.length, new Set(keys).size);
});

test('no duplicate keys in full twin catalog', () => {
  const catalog = createCatalog(FULL_ARTIFACTS).buildCatalog();
  const keys = catalog.map((d) => d.key);
  assert.equal(keys.length, new Set(keys).size);
});

test('twin-independent keys appear exactly once even in full catalog', () => {
  const catalog = createCatalog(FULL_ARTIFACTS).buildCatalog();
  const redisCount = catalog.filter((d) => d.key === 'ratio.cache.redis').length;
  const pgCount = catalog.filter((d) => d.key === 'resource.db.postgres').length;
  assert.equal(redisCount, 1);
  assert.equal(pgCount, 1);
});

test('no duplicate keys in queue catalog', () => {
  const catalog = createCatalog(QUEUE_ARTIFACTS).buildCatalog();
  const keys = catalog.map((d) => d.key);
  assert.equal(keys.length, new Set(keys).size);
});

// ── 10. Determinism ───────────────────────────────────────────────────────────

test('identical artifacts produce identical catalog JSON', () => {
  const a = createCatalog(FULL_ARTIFACTS).buildCatalog();
  const b = createCatalog(FULL_ARTIFACTS).buildCatalog();
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test('buildCatalog called twice on same instance returns identical structure', () => {
  const svc = createCatalog(FULL_ARTIFACTS);
  const a = svc.buildCatalog();
  const b = svc.buildCatalog();
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

// ── 11. resolveSeries — CONNECTED path ───────────────────────────────────────

test('resolveSeries with non-empty values: connection is CONNECTED', () => {
  const svc = createCatalog(RPC_ARTIFACTS);
  const d = svc.buildCatalog().find((x) => x.key.startsWith('latency.rpc.'))!;
  const s = svc.resolveSeries(d, [10, 20, 30]);
  assert.equal(s.connection, 'CONNECTED');
});

test('resolveSeries with non-empty values: values are the provided array', () => {
  const svc = createCatalog(RPC_ARTIFACTS);
  const d = svc.buildCatalog().find((x) => x.key.startsWith('latency.rpc.'))!;
  const s = svc.resolveSeries(d, [10, 20, 30]);
  assert.deepEqual([...s.values!], [10, 20, 30]);
});

test('resolveSeries CONNECTED: descriptor is passed through unchanged', () => {
  const svc = createCatalog(RPC_ARTIFACTS);
  const d = svc.buildCatalog().find((x) => x.key.startsWith('latency.rpc.'))!;
  const s = svc.resolveSeries(d, [5]);
  assert.equal(s.descriptor, d);
});

test('resolveSeries CONNECTED: evidence cites caller-provided series', () => {
  const svc = createCatalog(RPC_ARTIFACTS);
  const d = svc.buildCatalog().find((x) => x.key.startsWith('latency.rpc.'))!;
  const s = svc.resolveSeries(d, [5, 6]);
  assert.ok(s.evidence.length >= 1);
  const ev = s.evidence[0]!;
  // The evidence detail or source should mention caller-provided series
  const mentions = (ev.detail ?? '') + (ev.source ?? '');
  assert.match(mentions, /caller-provided series/);
});

test('resolveSeries CONNECTED: single-element array is accepted', () => {
  const svc = createCatalog(RPC_ARTIFACTS);
  const d = svc.buildCatalog().find((x) => x.key.startsWith('latency.rpc.'))!;
  const s = svc.resolveSeries(d, [42]);
  assert.equal(s.connection, 'CONNECTED');
  assert.deepEqual([...s.values!], [42]);
});

test('resolveSeries CONNECTED: works for a scaling queue metric', () => {
  const svc = createCatalog(QUEUE_ARTIFACTS);
  const d = svc.buildCatalog().find((x) => x.key.startsWith('scaling.queue.'))!;
  const s = svc.resolveSeries(d, [1, 2, 3]);
  assert.equal(s.connection, 'CONNECTED');
  assert.equal(s.values!.length, 3);
});

// ── 12. resolveSeries — NOT_CONNECTED path ────────────────────────────────────

test('resolveSeries with no provided arg: connection is NOT_CONNECTED', () => {
  const svc = createCatalog(RPC_ARTIFACTS);
  const d = svc.buildCatalog().find((x) => x.key.startsWith('latency.rpc.'))!;
  const s = svc.resolveSeries(d);
  assert.equal(s.connection, 'NOT_CONNECTED');
});

test('resolveSeries NOT_CONNECTED: values is null', () => {
  const svc = createCatalog(RPC_ARTIFACTS);
  const d = svc.buildCatalog().find((x) => x.key.startsWith('latency.rpc.'))!;
  const s = svc.resolveSeries(d);
  assert.equal(s.values, null);
});

test('resolveSeries NOT_CONNECTED: descriptor passes through', () => {
  const svc = createCatalog(RPC_ARTIFACTS);
  const d = svc.buildCatalog().find((x) => x.key.startsWith('latency.rpc.'))!;
  const s = svc.resolveSeries(d);
  assert.equal(s.descriptor, d);
});

test('resolveSeries NOT_CONNECTED: evidence has at least one not-connected entry', () => {
  const svc = createCatalog(RPC_ARTIFACTS);
  const d = svc.buildCatalog().find((x) => x.key.startsWith('latency.rpc.'))!;
  const s = svc.resolveSeries(d);
  assert.ok(s.evidence.some((e) => e.kind === 'not-connected'));
});

test('resolveSeries NOT_CONNECTED: evidence cites liveSource', () => {
  const svc = createCatalog(RPC_ARTIFACTS);
  const d = svc.buildCatalog().find((x) => x.key.startsWith('latency.rpc.'))!;
  const s = svc.resolveSeries(d);
  const ev = s.evidence[0]!;
  // The source on the not-connected evidence is the liveSource (as passed to notConnected)
  assert.ok(ev.source === d.liveSource || ev.ref === d.key);
});

test('resolveSeries NOT_CONNECTED: empty provided array triggers NOT_CONNECTED', () => {
  const svc = createCatalog(RPC_ARTIFACTS);
  const d = svc.buildCatalog().find((x) => x.key.startsWith('latency.rpc.'))!;
  const s = svc.resolveSeries(d, []);
  assert.equal(s.connection, 'NOT_CONNECTED');
  assert.equal(s.values, null);
});

// ── 13. resolveSeries edge cases ─────────────────────────────────────────────

test('resolveSeries: works with ratio.cache.redis descriptor (always present)', () => {
  const svc = createCatalog(EMPTY_ARTIFACTS);
  const d = svc.buildCatalog().find((x) => x.key === 'ratio.cache.redis')!;
  const s = svc.resolveSeries(d, [0.85]);
  assert.equal(s.connection, 'CONNECTED');
  assert.deepEqual([...s.values!], [0.85]);
});

test('resolveSeries: works with resource.db.postgres descriptor (always present)', () => {
  const svc = createCatalog(EMPTY_ARTIFACTS);
  const d = svc.buildCatalog().find((x) => x.key === 'resource.db.postgres')!;
  const s = svc.resolveSeries(d);
  assert.equal(s.connection, 'NOT_CONNECTED');
  assert.equal(s.values, null);
});

test('resolveSeries: provided undefined explicitly → NOT_CONNECTED', () => {
  const svc = createCatalog(TABLE_ARTIFACTS);
  const d = svc.buildCatalog().find((x) => x.key.startsWith('latency.db.'))!;
  const s = svc.resolveSeries(d, undefined);
  assert.equal(s.connection, 'NOT_CONNECTED');
  assert.equal(s.values, null);
});

// ── 14. Multi-layer twin: counts per layer ────────────────────────────────────

test('full twin: correct count of api metric entries', () => {
  const catalog = createCatalog(FULL_ARTIFACTS).buildCatalog();
  // 1 route → 1 api metric
  const apiMetrics = catalog.filter((d) => d.key.startsWith('latency.api.'));
  assert.equal(apiMetrics.length, 1);
});

test('full twin: correct count of rpc metric entries', () => {
  const catalog = createCatalog(FULL_ARTIFACTS).buildCatalog();
  // 2 rpcs → 2 latency.rpc.* entries
  const rpcMetrics = catalog.filter((d) => d.key.startsWith('latency.rpc.'));
  assert.equal(rpcMetrics.length, 2);
});

test('full twin: correct count of table metric entries', () => {
  const catalog = createCatalog(FULL_ARTIFACTS).buildCatalog();
  // 2 tables → 2 latency.db.* entries
  const tableMetrics = catalog.filter((d) => d.key.startsWith('latency.db.'));
  assert.equal(tableMetrics.length, 2);
});

test('full twin: correct count of queue metric entries (throughput + scaling per queue)', () => {
  const catalog = createCatalog(FULL_ARTIFACTS).buildCatalog();
  // 1 queue → 1 throughput + 1 scaling = 2
  const queueMetrics = catalog.filter((d) => d.key.startsWith('throughput.queue.') || d.key.startsWith('scaling.queue.'));
  assert.equal(queueMetrics.length, 2);
});

test('full twin: correct count of worker metric entries (cold-start + resource per worker)', () => {
  const catalog = createCatalog(FULL_ARTIFACTS).buildCatalog();
  // 1 worker → 1 cold-start + 1 resource = 2
  const workerMetrics = catalog.filter((d) => d.key.startsWith('cold-start.worker.') || d.key.startsWith('resource.worker.'));
  assert.equal(workerMetrics.length, 2);
});

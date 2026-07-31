/**
 * DependencyTwinEngine (LDTS facade) tests + the Phase 11 performance benchmark.
 * The benchmark is MEASURED here (never fabricated in docs): pure algorithms over a
 * deterministic synthetic 2,000-node twin must complete within generous ceilings.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtifactStore, createEngine } from '@letbuyy/lcis-core';
import {
  buildAdjacency,
  createTwinEngine,
  criticalPath,
  detectCycles,
  fanReport,
  findSpofs,
  getTwinEngine,
  impactRadius,
  resetTwinEngine,
  shortestPath as spAlg,
  type Adjacency,
  type TwinEdge,
  type TwinNode,
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

const DOMAIN_INTEL = {
  domains: [
    { key: 'payments', dependsOn: ['orders'], consumedBy: [], tables: ['payment_transactions'], rpcs: ['confirm_order_payment_with_ledger'], owners: ['@payments-team'] },
    { key: 'orders', dependsOn: [], consumedBy: ['payments'], tables: ['orders'], rpcs: ['create_checkout_order'], owners: ['@orders-team'] },
  ],
};

const DB_INTEL = {
  tables: [{ name: 'orders' }, { name: 'payment_transactions' }],
  rpcs: [{ name: 'create_checkout_order' }, { name: 'confirm_order_payment_with_ledger' }],
  policies: [{ name: 'orders_rls', table: 'orders' }],
  triggers: [{ name: 'orders_audit', table: 'orders' }],
};

const INFRA_INTEL = {
  workers: [{ name: 'queue-worker' }],
  queues: [{ name: 'order-events' }],
  routes: [{ path: '/v1/orders' }],
};

function fullEngine() {
  const core = createEngine({
    store: stubStore({ 'domain-intel.json': DOMAIN_INTEL, 'db-intel.json': DB_INTEL, 'infra-intel.json': INFRA_INTEL }),
    repoRoot: '/stub',
  });
  return createTwinEngine({ core, now: () => FIXED });
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

test('createTwinEngine exposes core + builder; singleton get/reset works', () => {
  const e = fullEngine();
  assert.ok(e.core);
  assert.ok(e.builder);
  resetTwinEngine();
  const core = createEngine({ store: stubStore({}), repoRoot: '/stub' });
  const a = getTwinEngine({ core, now: () => FIXED });
  assert.equal(getTwinEngine(), a);
  resetTwinEngine();
});

test('buildTwin is cached per engine instance (same object identity)', () => {
  const e = fullEngine();
  assert.equal(e.buildTwin(), e.buildTwin());
});

// ── Twin composition over stub artifacts ──────────────────────────────────────

test('twin contains domain/table/rpc nodes with deterministic ids', () => {
  const g = fullEngine().buildTwin();
  const ids = new Set(g.nodes.map((n) => n.id));
  assert.ok(ids.has('domain:payments'));
  assert.ok(ids.has('domain:orders'));
  assert.ok(ids.has('table:orders'));
  assert.ok(ids.has('rpc:create_checkout_order'));
});

test('domain depends-on edge exists (payments -> orders)', () => {
  const g = fullEngine().buildTwin();
  assert.ok(
    g.edges.some((e) => e.from === 'domain:payments' && e.to === 'domain:orders' && e.relation === 'depends-on'),
  );
});

test('twin report composes cycles/spof/fan/critical path with provenance', () => {
  const r = fullEngine().generateTwinReport();
  assert.ok(r.nodeCount > 0);
  assert.ok(r.edgeCount > 0);
  assert.equal(r.timestamp, FIXED);
  assert.equal(r.liveConnected, false);
  assert.match(r.summary, /NOT_CONNECTED/);
});

test('missing artifacts are honest: missingSources named, no throw', () => {
  const core = createEngine({ store: stubStore({}), repoRoot: '/stub' });
  const r = createTwinEngine({ core, now: () => FIXED }).generateTwinReport();
  assert.ok(r.missingSources.length >= 3);
  assert.equal(r.nodeCount, 0);
});

// ── Facade algorithm pass-through ─────────────────────────────────────────────

test('shortestPath finds the domain dependency path', () => {
  const p = fullEngine().shortestPath('domain:payments', 'domain:orders');
  assert.equal(p.found, true);
  assert.equal(p.hops, 1);
});

test('impactRadius from a table reaches its domain', () => {
  const r = fullEngine().impactRadius('table:orders', 2);
  const reached = r.rings.flat();
  assert.ok(reached.includes('domain:orders'), `reached: ${reached.join(',')}`);
});

test('views dispatch: all six views project without error', () => {
  const e = fullEngine();
  for (const v of ['dependency', 'ownership', 'execution', 'communication', 'infrastructure', 'data-flow'] as const) {
    const proj = e.view(v);
    assert.equal(proj.view, v);
    assert.ok(Array.isArray(proj.nodes));
  }
});

test('ownership view contains the owner edge', () => {
  const proj = fullEngine().view('ownership');
  assert.ok(proj.edges.some((e) => e.relation === 'owned-by'));
});

test('deterministic replay: two engines produce identical twin report JSON', () => {
  const a = fullEngine().generateTwinReport();
  const b = fullEngine().generateTwinReport();
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

// ── Performance benchmark (measured, generous ceilings) ──────────────────────

function syntheticTwin(n: number): { nodes: TwinNode[]; edges: TwinEdge[] } {
  const nodes: TwinNode[] = [];
  const edges: TwinEdge[] = [];
  for (let i = 0; i < n; i++) {
    nodes.push({ id: `symbol:n${i}`, layer: 'symbol', label: `n${i}`, domain: null, evidence: [] });
    if (i > 0) {
      edges.push({ from: `symbol:n${i}`, to: `symbol:n${Math.floor((i - 1) / 2)}`, relation: 'depends-on', views: ['dependency'], evidence: [] });
    }
    if (i > 10 && i % 7 === 0) {
      edges.push({ from: `symbol:n${i}`, to: `symbol:n${i - 5}`, relation: 'calls', views: ['execution'], evidence: [] });
    }
  }
  return { nodes, edges };
}

test('benchmark: adjacency + all five algorithms over 2,000 nodes complete under 3s total', () => {
  const { nodes, edges } = syntheticTwin(2000);
  const t0 = process.hrtime.bigint();
  const adj = buildAdjacency(nodes, edges);
  const nodesById = new Map(nodes.map((x) => [x.id, x]));
  const cycles = detectCycles(adj);
  const spofs = findSpofs(adj);
  const fan = fanReport(adj, 10);
  const critical = criticalPath(adj);
  const radius = impactRadius(adj, nodesById, 'symbol:n0', 4);
  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1_000_000;

  assert.equal(cycles.count, 0, 'synthetic tree+forward edges is acyclic');
  assert.ok(spofs.count > 0, 'tree interior nodes are articulation points');
  assert.equal(fan.top.length, 10);
  assert.ok(critical.length >= 9, `binary-tree depth path expected >= 9, got ${critical.length}`);
  assert.ok(radius.totalReached > 0);
  assert.ok(elapsedMs < 3000, `algorithms took ${elapsedMs.toFixed(1)}ms (ceiling 3000ms)`);
});

test('benchmark: shortestPath across the 2,000-node twin under 250ms', () => {
  const { nodes, edges } = syntheticTwin(2000);
  const adj = buildAdjacency(nodes, edges);
  const t0 = process.hrtime.bigint();
  const p = shortestPathOf(adj);
  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1_000_000;
  assert.equal(p.found, true);
  assert.ok(elapsedMs < 250, `shortestPath took ${elapsedMs.toFixed(1)}ms`);
});

function shortestPathOf(adj: Adjacency) {
  return spAlg(adj, 'symbol:n1999', 'symbol:n0');
}

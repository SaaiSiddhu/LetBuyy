/**
 * views-a.test.ts — DependencyView, OwnershipView, ExecutionView
 *
 * Conventions:
 *  - node:test + assert/strict
 *  - Fixed clock '2026-07-04T00:00:00.000Z'
 *  - Deep-freeze fixture to verify input immutability
 *  - 55+ tests across all three view services
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DependencyView } from '../src/views/DependencyView';
import { ExecutionView } from '../src/views/ExecutionView';
import { OwnershipView } from '../src/views/OwnershipView';
import type { TwinEdge, TwinGraph, TwinNode } from '../src/shared/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FIXED_TS = '2026-07-04T00:00:00.000Z';

function makeNode(id: string, layer: TwinNode['layer'] = 'api', domain: string | null = null): TwinNode {
  return { id, layer, label: id, domain, evidence: [] };
}

function makeEdge(
  from: string,
  to: string,
  relation: TwinEdge['relation'],
  views: TwinEdge['views'],
): TwinEdge {
  return { from, to, relation, views, evidence: [] };
}

function makeGraph(nodes: readonly TwinNode[], edges: readonly TwinEdge[]): TwinGraph {
  const byLayer: Record<string, number> = {};
  for (const n of nodes) {
    byLayer[n.layer] = (byLayer[n.layer] ?? 0) + 1;
  }
  return {
    nodes,
    edges,
    byLayer,
    missingSources: [],
    summary: 'test graph',
    evidence: [],
    confidence: 0.8,
    sources: ['test'],
    timestamp: FIXED_TS,
    liveConnected: false,
  };
}

/**
 * Deep-freeze an object so any accidental mutation throws at runtime.
 * This verifies the views do not mutate the input graph.
 */
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const v of Object.values(obj as Record<string, unknown>)) {
    deepFreeze(v);
  }
  return obj;
}

// ─── Empty graph fixture ──────────────────────────────────────────────────────

const emptyGraph = makeGraph([], []);

// ─── Rich mixed-view fixture ──────────────────────────────────────────────────
//
// Nodes: n-api, n-rpc, n-table, n-worker, n-queue, n-owner, n-extra-owner
// Edges cover dependency / ownership / execution / communication so we can
// verify each view isolates correctly.

const nApi    = makeNode('api:checkout', 'api');
const nRpc    = makeNode('rpc:create_order', 'rpc');
const nTable  = makeNode('table:orders', 'table');
const nWorker = makeNode('worker:mailer', 'worker');
const nQueue  = makeNode('queue:email-q', 'queue');
const nOwner  = makeNode('owner:payments-team', 'owner');
const nOwner2 = makeNode('owner:infra-team', 'owner');
const nExtra  = makeNode('api:unrelated', 'api');    // appears in no edge of interest

// dependency edges
const eDep1 = makeEdge('api:checkout', 'rpc:create_order', 'calls', ['dependency']);
const eDep2 = makeEdge('rpc:create_order', 'table:orders', 'writes-to', ['dependency']);
const eDepAndOwn = makeEdge('api:checkout', 'rpc:create_order', 'depends-on', ['dependency', 'ownership']);

// ownership edges
const eOwn1 = makeEdge('rpc:create_order', 'owner:payments-team', 'owned-by', ['ownership']);

// execution edges
const eExec1 = makeEdge('worker:mailer', 'queue:email-q', 'consumes', ['execution']);
const eExec2 = makeEdge('api:checkout', 'worker:mailer', 'triggers', ['execution']);

// communication-only edge (must NOT appear in dep/own/exec views)
const eComm = makeEdge('api:checkout', 'table:orders', 'reads', ['communication']);

// ─── DependencyView ──────────────────────────────────────────────────────────

describe('DependencyView', () => {
  const view = new DependencyView();

  // ── 1. Empty graph ────────────────────────────────────────────────────────
  it('empty graph → 0 nodes, 0 edges', () => {
    const r = view.project(emptyGraph);
    assert.equal(r.nodes.length, 0);
    assert.equal(r.edges.length, 0);
  });

  // ── 2. view property ──────────────────────────────────────────────────────
  it('view property is "dependency"', () => {
    const r = view.project(emptyGraph);
    assert.equal(r.view, 'dependency');
  });

  // ── 3. Filters out non-dependency edges ───────────────────────────────────
  it('excludes ownership-only edges', () => {
    const g = makeGraph([nApi, nRpc, nOwner], [eOwn1]);
    const r = view.project(g);
    assert.equal(r.edges.length, 0);
  });

  it('excludes execution-only edges', () => {
    const g = makeGraph([nWorker, nQueue], [eExec1]);
    const r = view.project(g);
    assert.equal(r.edges.length, 0);
  });

  it('excludes communication-only edges', () => {
    const g = makeGraph([nApi, nTable], [eComm]);
    const r = view.project(g);
    assert.equal(r.edges.length, 0);
  });

  // ── 4. Includes correct edges ─────────────────────────────────────────────
  it('includes dependency edges', () => {
    const g = makeGraph([nApi, nRpc, nTable], [eDep1, eDep2]);
    const r = view.project(g);
    assert.equal(r.edges.length, 2);
    assert.equal(r.edges[0]!.from, 'api:checkout');
    assert.equal(r.edges[1]!.from, 'rpc:create_order');
  });

  it('includes multi-view edge that contains dependency', () => {
    const g = makeGraph([nApi, nRpc], [eDepAndOwn]);
    const r = view.project(g);
    assert.equal(r.edges.length, 1);
    assert.deepEqual(r.edges[0], eDepAndOwn);
  });

  // ── 5. Node subset: only referenced nodes ─────────────────────────────────
  it('includes only nodes referenced by dependency edges', () => {
    const g = makeGraph([nApi, nRpc, nTable, nWorker, nQueue, nExtra], [eDep1]);
    const r = view.project(g);
    const ids = r.nodes.map((n) => n.id);
    assert.ok(ids.includes('api:checkout'));
    assert.ok(ids.includes('rpc:create_order'));
    assert.ok(!ids.includes('table:orders'));
    assert.ok(!ids.includes('worker:mailer'));
    assert.ok(!ids.includes('api:unrelated'));
  });

  it('excludes nodes not referenced by any dependency edge', () => {
    const g = makeGraph([nApi, nRpc, nExtra, nOwner], [eDep1]);
    const r = view.project(g);
    assert.equal(r.nodes.length, 2);
  });

  it('node referenced in two dependency edges appears exactly once', () => {
    const g = makeGraph([nApi, nRpc, nTable], [eDep1, eDep2]);
    const r = view.project(g);
    const count = r.nodes.filter((n) => n.id === 'rpc:create_order').length;
    assert.equal(count, 1);
  });

  it('self-referencing edge: from===to, node appears once', () => {
    const eSelf = makeEdge('api:checkout', 'api:checkout', 'depends-on', ['dependency']);
    const g = makeGraph([nApi], [eSelf]);
    const r = view.project(g);
    assert.equal(r.nodes.length, 1);
    assert.equal(r.nodes[0]!.id, 'api:checkout');
  });

  // ── 6. Empty result when no dependency edges ───────────────────────────────
  it('graph with only non-dependency edges → 0 nodes, 0 edges', () => {
    const g = makeGraph([nWorker, nQueue, nOwner], [eExec1, eOwn1, eComm]);
    const r = view.project(g);
    assert.equal(r.nodes.length, 0);
    assert.equal(r.edges.length, 0);
  });

  // ── 7. Summary counts ──────────────────────────────────────────────────────
  it('summary reflects correct counts', () => {
    const g = makeGraph([nApi, nRpc, nTable], [eDep1, eDep2]);
    const r = view.project(g);
    // 3 nodes: api:checkout, rpc:create_order, table:orders; 2 edges
    assert.ok(r.summary.includes('3'));
    assert.ok(r.summary.includes('2'));
  });

  it('summary uses singular "node" and "edge"', () => {
    const eSingle = makeEdge('api:checkout', 'rpc:create_order', 'calls', ['dependency']);
    const g = makeGraph([nApi, nRpc], [eSingle]);
    const r = view.project(g);
    // 2 nodes, 1 edge
    assert.ok(r.summary.includes('2 nodes'));
    assert.ok(r.summary.includes('1 edge'));
    assert.ok(!r.summary.includes('1 edges'));
  });

  it('summary with a single node (self-referencing edge)', () => {
    const eSelf = makeEdge('api:checkout', 'api:checkout', 'depends-on', ['dependency']);
    const g = makeGraph([nApi], [eSelf]);
    const r = view.project(g);
    assert.ok(r.summary.includes('1 node'));
    assert.ok(!r.summary.includes('1 nodes'));
  });

  // ── 8. Determinism: order preserved from input ─────────────────────────────
  it('preserves node input order', () => {
    // Input order: nRpc, nApi, nTable
    const g = makeGraph([nRpc, nApi, nTable], [eDep1, eDep2]);
    const r = view.project(g);
    // api:checkout and rpc:create_order referenced; table:orders also referenced
    // Input order: nRpc first, then nApi, then nTable
    assert.equal(r.nodes[0]!.id, 'rpc:create_order');
    assert.equal(r.nodes[1]!.id, 'api:checkout');
    assert.equal(r.nodes[2]!.id, 'table:orders');
  });

  it('preserves edge input order', () => {
    const g = makeGraph([nApi, nRpc, nTable], [eDep2, eDep1]);
    const r = view.project(g);
    assert.equal(r.edges[0]!.from, 'rpc:create_order');
    assert.equal(r.edges[1]!.from, 'api:checkout');
  });

  // ── 9. Input immutability ──────────────────────────────────────────────────
  it('does not mutate the input graph (deep-frozen fixture)', () => {
    const g = deepFreeze(makeGraph([nApi, nRpc, nTable], [eDep1, eDep2]));
    // Must not throw despite the graph being frozen
    assert.doesNotThrow(() => view.project(g as TwinGraph));
  });
});

// ─── OwnershipView ───────────────────────────────────────────────────────────

describe('OwnershipView', () => {
  const view = new OwnershipView();

  // ── 1. Empty graph ────────────────────────────────────────────────────────
  it('empty graph → 0 nodes, 0 edges', () => {
    const r = view.project(emptyGraph);
    assert.equal(r.nodes.length, 0);
    assert.equal(r.edges.length, 0);
  });

  // ── 2. view property ──────────────────────────────────────────────────────
  it('view property is "ownership"', () => {
    const r = view.project(emptyGraph);
    assert.equal(r.view, 'ownership');
  });

  // ── 3. Filters out non-ownership edges ────────────────────────────────────
  it('excludes dependency-only edges', () => {
    const g = makeGraph([nApi, nRpc], [eDep1]);
    const r = view.project(g);
    assert.equal(r.edges.length, 0);
  });

  it('excludes execution-only edges', () => {
    const g = makeGraph([nWorker, nQueue], [eExec1]);
    const r = view.project(g);
    assert.equal(r.edges.length, 0);
  });

  it('excludes communication-only edges', () => {
    const g = makeGraph([nApi, nTable], [eComm]);
    const r = view.project(g);
    assert.equal(r.edges.length, 0);
  });

  // ── 4. Includes correct edges ─────────────────────────────────────────────
  it('includes ownership edges', () => {
    const g = makeGraph([nRpc, nOwner], [eOwn1]);
    const r = view.project(g);
    assert.equal(r.edges.length, 1);
    assert.deepEqual(r.edges[0], eOwn1);
  });

  it('includes multi-view edge that contains ownership', () => {
    const g = makeGraph([nApi, nRpc], [eDepAndOwn]);
    const r = view.project(g);
    assert.equal(r.edges.length, 1);
    assert.deepEqual(r.edges[0], eDepAndOwn);
  });

  // ── 5. Owner nodes always included ────────────────────────────────────────
  it('owner node with no edges still included', () => {
    const g = makeGraph([nApi, nOwner], [eDep1]); // eDep1 is dependency-only
    const r = view.project(g);
    const ids = r.nodes.map((n) => n.id);
    assert.ok(ids.includes('owner:payments-team'));
  });

  it('multiple owner nodes all included even when no ownership edges', () => {
    const g = makeGraph([nApi, nOwner, nOwner2], []);
    const r = view.project(g);
    const ids = r.nodes.map((n) => n.id);
    assert.ok(ids.includes('owner:payments-team'));
    assert.ok(ids.includes('owner:infra-team'));
    assert.equal(r.edges.length, 0);
  });

  it('non-owner node without ownership edge excluded', () => {
    const g = makeGraph([nApi, nOwner], [eOwn1]); // nApi not in eOwn1
    const r = view.project(g);
    const ids = r.nodes.map((n) => n.id);
    assert.ok(!ids.includes('api:checkout'));
  });

  it('owner node referenced in edge is not duplicated', () => {
    const g = makeGraph([nRpc, nOwner], [eOwn1]);
    const r = view.project(g);
    const count = r.nodes.filter((n) => n.id === 'owner:payments-team').length;
    assert.equal(count, 1);
  });

  it('non-owner node in an ownership edge is included', () => {
    const g = makeGraph([nRpc, nOwner], [eOwn1]);
    const r = view.project(g);
    const ids = r.nodes.map((n) => n.id);
    assert.ok(ids.includes('rpc:create_order'));
  });

  it('graph with no ownership edges but owner nodes: 0 edges, owner nodes present', () => {
    const g = makeGraph([nApi, nRpc, nOwner, nOwner2], [eDep1]);
    const r = view.project(g);
    assert.equal(r.edges.length, 0);
    const ids = r.nodes.map((n) => n.id);
    assert.ok(ids.includes('owner:payments-team'));
    assert.ok(ids.includes('owner:infra-team'));
    assert.ok(!ids.includes('api:checkout'));
    assert.ok(!ids.includes('rpc:create_order'));
  });

  it('ownership edges + extra owner nodes: both sets unioned', () => {
    const g = makeGraph([nRpc, nOwner, nOwner2], [eOwn1]);
    const r = view.project(g);
    // eOwn1: rpc:create_order → owner:payments-team; plus owner:infra-team (extra owner)
    const ids = r.nodes.map((n) => n.id);
    assert.ok(ids.includes('rpc:create_order'));
    assert.ok(ids.includes('owner:payments-team'));
    assert.ok(ids.includes('owner:infra-team'));
    assert.equal(r.nodes.length, 3);
  });

  // ── 6. Summary counts ──────────────────────────────────────────────────────
  it('summary reflects correct counts', () => {
    const g = makeGraph([nRpc, nOwner], [eOwn1]);
    const r = view.project(g);
    assert.ok(r.summary.includes('2'));
    assert.ok(r.summary.includes('1 edge'));
  });

  it('summary uses singular "node" when 1 node', () => {
    // Single owner node, no edges
    const g = makeGraph([nOwner], []);
    const r = view.project(g);
    assert.ok(r.summary.includes('1 node'));
    assert.ok(!r.summary.includes('1 nodes'));
  });

  it('summary uses "0 edges" correctly', () => {
    const g = makeGraph([nOwner], []);
    const r = view.project(g);
    assert.ok(r.summary.includes('0 edge'));
  });

  // ── 7. Determinism: order preserved from input ─────────────────────────────
  it('preserves node input order (owner nodes keep their input position)', () => {
    // Input order: nOwner2, nOwner, nRpc
    const g = makeGraph([nOwner2, nOwner, nRpc], [eOwn1]);
    const r = view.project(g);
    // All three nodes should be present; order = input order
    assert.equal(r.nodes[0]!.id, 'owner:infra-team');
    assert.equal(r.nodes[1]!.id, 'owner:payments-team');
    assert.equal(r.nodes[2]!.id, 'rpc:create_order');
  });

  it('preserves edge input order', () => {
    const eOwn2 = makeEdge('api:checkout', 'owner:infra-team', 'owned-by', ['ownership']);
    const g = makeGraph([nApi, nRpc, nOwner, nOwner2], [eOwn2, eOwn1]);
    const r = view.project(g);
    assert.equal(r.edges[0]!.from, 'api:checkout');
    assert.equal(r.edges[1]!.from, 'rpc:create_order');
  });

  // ── 8. Input immutability ──────────────────────────────────────────────────
  it('does not mutate the input graph (deep-frozen fixture)', () => {
    const g = deepFreeze(makeGraph([nRpc, nOwner], [eOwn1]));
    assert.doesNotThrow(() => view.project(g as TwinGraph));
  });
});

// ─── ExecutionView ───────────────────────────────────────────────────────────

describe('ExecutionView', () => {
  const view = new ExecutionView();

  // ── 1. Empty graph ────────────────────────────────────────────────────────
  it('empty graph → 0 nodes, 0 edges', () => {
    const r = view.project(emptyGraph);
    assert.equal(r.nodes.length, 0);
    assert.equal(r.edges.length, 0);
  });

  // ── 2. view property ──────────────────────────────────────────────────────
  it('view property is "execution"', () => {
    const r = view.project(emptyGraph);
    assert.equal(r.view, 'execution');
  });

  // ── 3. Filters out non-execution edges ────────────────────────────────────
  it('excludes dependency-only edges', () => {
    const g = makeGraph([nApi, nRpc], [eDep1]);
    const r = view.project(g);
    assert.equal(r.edges.length, 0);
  });

  it('excludes ownership-only edges', () => {
    const g = makeGraph([nRpc, nOwner], [eOwn1]);
    const r = view.project(g);
    assert.equal(r.edges.length, 0);
  });

  it('excludes communication-only edges', () => {
    const g = makeGraph([nApi, nTable], [eComm]);
    const r = view.project(g);
    assert.equal(r.edges.length, 0);
  });

  // ── 4. Includes correct edges ─────────────────────────────────────────────
  it('includes execution edges', () => {
    const g = makeGraph([nWorker, nQueue], [eExec1]);
    const r = view.project(g);
    assert.equal(r.edges.length, 1);
    assert.deepEqual(r.edges[0], eExec1);
  });

  it('includes multi-view edge that contains execution', () => {
    const eExecAndDep = makeEdge('worker:mailer', 'queue:email-q', 'consumes', ['execution', 'dependency']);
    const g = makeGraph([nWorker, nQueue], [eExecAndDep]);
    const r = view.project(g);
    assert.equal(r.edges.length, 1);
    assert.deepEqual(r.edges[0], eExecAndDep);
  });

  it('includes multiple execution edges', () => {
    const g = makeGraph([nApi, nWorker, nQueue], [eExec1, eExec2]);
    const r = view.project(g);
    assert.equal(r.edges.length, 2);
  });

  // ── 5. Node subset ────────────────────────────────────────────────────────
  it('includes only nodes referenced by execution edges', () => {
    const g = makeGraph([nApi, nWorker, nQueue, nRpc, nExtra], [eExec1]);
    const r = view.project(g);
    const ids = r.nodes.map((n) => n.id);
    assert.ok(ids.includes('worker:mailer'));
    assert.ok(ids.includes('queue:email-q'));
    assert.ok(!ids.includes('api:checkout'));
    assert.ok(!ids.includes('rpc:create_order'));
    assert.ok(!ids.includes('api:unrelated'));
  });

  it('excludes nodes not referenced by any execution edge', () => {
    const g = makeGraph([nApi, nWorker, nQueue], [eExec1]);
    const r = view.project(g);
    assert.equal(r.nodes.length, 2);
  });

  it('node referenced in two execution edges appears exactly once', () => {
    const g = makeGraph([nApi, nWorker, nQueue], [eExec1, eExec2]);
    const r = view.project(g);
    const count = r.nodes.filter((n) => n.id === 'worker:mailer').length;
    assert.equal(count, 1);
  });

  it('self-referencing execution edge: node appears once', () => {
    const eSelf = makeEdge('worker:mailer', 'worker:mailer', 'triggers', ['execution']);
    const g = makeGraph([nWorker], [eSelf]);
    const r = view.project(g);
    assert.equal(r.nodes.length, 1);
    assert.equal(r.nodes[0]!.id, 'worker:mailer');
  });

  it('cross-layer execution edge: worker→queue both included', () => {
    const g = makeGraph([nWorker, nQueue], [eExec1]);
    const r = view.project(g);
    const ids = r.nodes.map((n) => n.id);
    assert.ok(ids.includes('worker:mailer'));
    assert.ok(ids.includes('queue:email-q'));
  });

  // ── 6. Empty result when no execution edges ────────────────────────────────
  it('graph with only dependency edges → 0 nodes, 0 edges', () => {
    const g = makeGraph([nApi, nRpc], [eDep1]);
    const r = view.project(g);
    assert.equal(r.nodes.length, 0);
    assert.equal(r.edges.length, 0);
  });

  // ── 7. Summary counts ──────────────────────────────────────────────────────
  it('summary reflects correct counts', () => {
    const g = makeGraph([nApi, nWorker, nQueue], [eExec1, eExec2]);
    const r = view.project(g);
    // eExec1: worker→queue; eExec2: api→worker → 3 referenced nodes, 2 edges
    assert.ok(r.summary.includes('3'));
    assert.ok(r.summary.includes('2'));
  });

  it('summary uses singular "edge" when 1 edge', () => {
    const g = makeGraph([nWorker, nQueue], [eExec1]);
    const r = view.project(g);
    assert.ok(r.summary.includes('1 edge'));
    assert.ok(!r.summary.includes('1 edges'));
  });

  it('summary uses singular "node" when 1 node (self-ref)', () => {
    const eSelf = makeEdge('worker:mailer', 'worker:mailer', 'triggers', ['execution']);
    const g = makeGraph([nWorker], [eSelf]);
    const r = view.project(g);
    assert.ok(r.summary.includes('1 node'));
    assert.ok(!r.summary.includes('1 nodes'));
  });

  // ── 8. Determinism: order preserved from input ─────────────────────────────
  it('preserves node input order', () => {
    // Input order: nQueue, nWorker, nApi
    const g = makeGraph([nQueue, nWorker, nApi], [eExec1, eExec2]);
    const r = view.project(g);
    assert.equal(r.nodes[0]!.id, 'queue:email-q');
    assert.equal(r.nodes[1]!.id, 'worker:mailer');
    assert.equal(r.nodes[2]!.id, 'api:checkout');
  });

  it('preserves edge input order', () => {
    const g = makeGraph([nApi, nWorker, nQueue], [eExec2, eExec1]);
    const r = view.project(g);
    assert.equal(r.edges[0]!.from, 'api:checkout');
    assert.equal(r.edges[1]!.from, 'worker:mailer');
  });

  // ── 9. Input immutability ──────────────────────────────────────────────────
  it('does not mutate the input graph (deep-frozen fixture)', () => {
    const g = deepFreeze(makeGraph([nWorker, nQueue], [eExec1]));
    assert.doesNotThrow(() => view.project(g as TwinGraph));
  });
});

// ─── Cross-view integration ───────────────────────────────────────────────────

describe('Cross-view integration', () => {
  const depView  = new DependencyView();
  const ownView  = new OwnershipView();
  const execView = new ExecutionView();

  // Build a rich graph with all three kinds of edges + communication-only.
  const mixedGraph = makeGraph(
    [nApi, nRpc, nTable, nWorker, nQueue, nOwner, nOwner2, nExtra],
    [eDep1, eDep2, eOwn1, eExec1, eExec2, eComm, eDepAndOwn],
  );

  it('DependencyView: correct edge count in mixed graph', () => {
    const r = depView.project(mixedGraph);
    // eDep1, eDep2, eDepAndOwn all have 'dependency'
    assert.equal(r.edges.length, 3);
  });

  it('OwnershipView: correct edge count in mixed graph', () => {
    const r = ownView.project(mixedGraph);
    // eOwn1 + eDepAndOwn both have 'ownership'
    assert.equal(r.edges.length, 2);
  });

  it('ExecutionView: correct edge count in mixed graph', () => {
    const r = execView.project(mixedGraph);
    // eExec1 + eExec2
    assert.equal(r.edges.length, 2);
  });

  it('No edge leaks between dependency and ownership projections', () => {
    const dep  = depView.project(mixedGraph);
    const own  = ownView.project(mixedGraph);
    // eExec1 must not appear in either
    const depEdgeIds = dep.edges.map((e) => `${e.from}→${e.to}:${e.relation}`);
    const ownEdgeIds = own.edges.map((e) => `${e.from}→${e.to}:${e.relation}`);
    const execEdge = 'worker:mailer→queue:email-q:consumes';
    assert.ok(!depEdgeIds.includes(execEdge));
    assert.ok(!ownEdgeIds.includes(execEdge));
  });

  it('No edge leaks between execution and dependency projections', () => {
    const dep  = depView.project(mixedGraph);
    const exec = execView.project(mixedGraph);
    // eOwn1 must not appear in either
    const depEdgeIds  = dep.edges.map((e) => `${e.from}→${e.to}:${e.relation}`);
    const execEdgeIds = exec.edges.map((e) => `${e.from}→${e.to}:${e.relation}`);
    const ownEdge = 'rpc:create_order→owner:payments-team:owned-by';
    assert.ok(!depEdgeIds.includes(ownEdge));
    assert.ok(!execEdgeIds.includes(ownEdge));
  });

  it('communication-only edge absent from all three views', () => {
    const dep  = depView.project(mixedGraph);
    const own  = ownView.project(mixedGraph);
    const exec = execView.project(mixedGraph);
    const commStr = 'api:checkout→table:orders:reads';
    const inDep  = dep.edges.some((e)  => `${e.from}→${e.to}:${e.relation}` === commStr);
    const inOwn  = own.edges.some((e)  => `${e.from}→${e.to}:${e.relation}` === commStr);
    const inExec = exec.edges.some((e) => `${e.from}→${e.to}:${e.relation}` === commStr);
    assert.ok(!inDep,  'comm edge must not be in dependency view');
    assert.ok(!inOwn,  'comm edge must not be in ownership view');
    assert.ok(!inExec, 'comm edge must not be in execution view');
  });

  it('OwnershipView includes extra owner nodes not referenced by any edge', () => {
    const r = ownView.project(mixedGraph);
    const ids = r.nodes.map((n) => n.id);
    // nOwner2 (owner:infra-team) has no ownership edge in mixedGraph
    assert.ok(ids.includes('owner:infra-team'));
  });

  it('DependencyView excludes owner nodes if they have no dependency edges', () => {
    const r = depView.project(mixedGraph);
    const ids = r.nodes.map((n) => n.id);
    assert.ok(!ids.includes('owner:payments-team'));
    assert.ok(!ids.includes('owner:infra-team'));
  });

  it('three independent view instances produce the same result as shared instances', () => {
    // Verifies no hidden state across calls
    const r1 = new DependencyView().project(mixedGraph);
    const r2 = new DependencyView().project(mixedGraph);
    assert.equal(r1.edges.length, r2.edges.length);
    assert.equal(r1.nodes.length, r2.nodes.length);
  });

  it('calling project twice on the same view instance yields identical results', () => {
    const dv = new DependencyView();
    const r1 = dv.project(mixedGraph);
    const r2 = dv.project(mixedGraph);
    assert.deepEqual(r1.edges, r2.edges);
    assert.deepEqual(r1.nodes, r2.nodes);
  });
});

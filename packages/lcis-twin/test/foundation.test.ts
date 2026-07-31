/**
 * LDTS Phase 11 — foundation tests.
 *
 * Covers:
 *  (A) twin() envelope — evidence passthrough, confidenceFrom exact values,
 *      sources deduplication, timestamp === injected clock, liveConnected default.
 *  (B) Type spot-checks — constructing valid TwinNode / TwinEdge / TwinGraph literals
 *      to verify the frozen contract shapes compile and hold at runtime.
 *  (C) TwinGraph invariant helpers — unique node ids, edges reference existing nodes,
 *      byLayer sums to node count.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

// Import only from the package's own shared surface — no lcis-core in test imports.
import { twin, confidenceFrom, defaultNow } from '../src/shared/envelope';
import type {
  TwinNode,
  TwinEdge,
  TwinGraph,
  TwinArtifact,
  TwinLayer,
  TwinRelation,
  TwinView,
} from '../src/shared/types';
import type { Evidence } from '@letbuyy/lcis-core';

// ── Fixed test clock (deterministic) ──────────────────────────────────────────

const FIXED_TS = '2026-07-04T00:00:00.000Z';
const fixedNow = (): string => FIXED_TS;

// ── Helpers ───────────────────────────────────────────────────────────────────

function ev(kind: Evidence['kind'], ref: string, source?: string): Evidence {
  return source !== undefined
    ? { kind, ref, source }
    : { kind, ref };
}

function notConnectedEv(ref: string): Evidence {
  return { kind: 'not-connected', ref };
}

// ── (A) confidenceFrom ────────────────────────────────────────────────────────

test('confidenceFrom: empty evidence array returns 0', () => {
  assert.equal(confidenceFrom([]), 0);
});

test('confidenceFrom: all not-connected evidence returns 0', () => {
  const evs: Evidence[] = [notConnectedEv('VAR_A'), notConnectedEv('VAR_B')];
  assert.equal(confidenceFrom(evs), 0);
});

test('confidenceFrom: one connected evidence returns 0.6 (0.5 + 0.1 * 1)', () => {
  assert.equal(confidenceFrom([ev('file', 'a.ts')]), 0.6);
});

test('confidenceFrom: two connected evidence items returns 0.7', () => {
  assert.equal(confidenceFrom([ev('file', 'a.ts'), ev('graph-node', 'n1')]), 0.7);
});

test('confidenceFrom: three connected evidence items returns 0.8', () => {
  const evs = [ev('file', 'a.ts'), ev('graph-node', 'n1'), ev('rpc', 'create_order')];
  assert.equal(confidenceFrom(evs), 0.8);
});

test('confidenceFrom: four connected evidence items returns 0.9 (cap)', () => {
  const evs = [
    ev('file', 'a.ts'),
    ev('graph-node', 'n1'),
    ev('rpc', 'r1'),
    ev('table', 't1'),
  ];
  assert.equal(confidenceFrom(evs), 0.9);
});

test('confidenceFrom: five connected evidence items still caps at 0.9', () => {
  const evs = [
    ev('file', 'a.ts'),
    ev('graph-node', 'n1'),
    ev('rpc', 'r1'),
    ev('table', 't1'),
    ev('policy', 'p1'),
  ];
  assert.equal(confidenceFrom(evs), 0.9);
});

test('confidenceFrom: mixed connected and not-connected counts only connected', () => {
  // 1 connected + 3 not-connected => 0.5 + 0.1*1 = 0.6
  const evs: Evidence[] = [
    ev('file', 'a.ts'),
    notConnectedEv('VAR_A'),
    notConnectedEv('VAR_B'),
    notConnectedEv('VAR_C'),
  ];
  assert.equal(confidenceFrom(evs), 0.6);
});

// ── (A) twin() envelope ───────────────────────────────────────────────────────

test('twin: timestamp equals injected clock', () => {
  const result = twin({ value: 1 }, { evidence: [], now: fixedNow });
  assert.equal(result.timestamp, FIXED_TS);
});

test('twin: evidence is passed through exactly', () => {
  const evs: Evidence[] = [ev('file', 'src/index.ts', 'graphify-out/graph.json')];
  const result = twin({ x: 'y' }, { evidence: evs, now: fixedNow });
  assert.deepEqual(result.evidence, evs);
});

test('twin: liveConnected defaults to false when not supplied', () => {
  const result = twin({ x: 1 }, { evidence: [], now: fixedNow });
  assert.equal(result.liveConnected, false);
});

test('twin: liveConnected can be set to true', () => {
  const result = twin({ x: 1 }, { evidence: [], liveConnected: true, now: fixedNow });
  assert.equal(result.liveConnected, true);
});

test('twin: confidence is auto-computed from evidence when not supplied', () => {
  const evs = [ev('file', 'a.ts'), ev('graph-node', 'n1')];
  const result = twin({}, { evidence: evs, now: fixedNow });
  assert.equal(result.confidence, 0.7);
});

test('twin: explicit confidence overrides the computed value', () => {
  const result = twin({}, { evidence: [ev('file', 'f.ts')], confidence: 0.42, now: fixedNow });
  assert.equal(result.confidence, 0.42);
});

test('twin: sources are auto-derived (deduped) from evidence.source fields', () => {
  const evs: Evidence[] = [
    { kind: 'file', ref: 'a.ts', source: 'graphify-out/graph.json' },
    { kind: 'graph-node', ref: 'n1', source: 'graphify-out/graph.json' }, // duplicate source
    { kind: 'rpc', ref: 'rpc_x', source: 'graphify-out/db-intel.json' },
  ];
  const result = twin({}, { evidence: evs, now: fixedNow });
  assert.deepEqual([...result.sources].sort(), [
    'graphify-out/db-intel.json',
    'graphify-out/graph.json',
  ]);
});

test('twin: explicit sources override the auto-derived deduplication', () => {
  const evs: Evidence[] = [{ kind: 'file', ref: 'a.ts', source: 'auto-source' }];
  const explicit = ['explicit-source'];
  const result = twin({}, { evidence: evs, sources: explicit, now: fixedNow });
  assert.deepEqual([...result.sources], explicit);
});

test('twin: evidence with no source fields yields empty sources list', () => {
  const evs: Evidence[] = [{ kind: 'not-connected', ref: 'VAR_X' }];
  const result = twin({}, { evidence: evs, now: fixedNow });
  assert.deepEqual([...result.sources], []);
});

test('twin: body properties are merged into the result', () => {
  const result = twin(
    { alpha: 'hello', beta: 42 },
    { evidence: [], now: fixedNow },
  );
  assert.equal((result as { alpha: string }).alpha, 'hello');
  assert.equal((result as { beta: number }).beta, 42);
});

test('twin: TwinArtifact shape — result has all five mandatory fields', () => {
  const result: TwinArtifact = twin({}, { evidence: [], now: fixedNow });
  assert.ok('evidence' in result);
  assert.ok('confidence' in result);
  assert.ok('sources' in result);
  assert.ok('timestamp' in result);
  assert.ok('liveConnected' in result);
});

test('twin: sources array has no duplicates when multiple evidence share the same source', () => {
  const evs: Evidence[] = Array.from({ length: 5 }, (_, i) => ({
    kind: 'file' as const,
    ref: `file${i}.ts`,
    source: 'shared-source',
  }));
  const result = twin({}, { evidence: evs, now: fixedNow });
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0], 'shared-source');
});

test('twin: zero-confidence when evidence is empty (confidence = 0)', () => {
  const result = twin({}, { evidence: [], now: fixedNow });
  assert.equal(result.confidence, 0);
});

test('twin: zero-confidence when all evidence is not-connected', () => {
  const evs = [notConnectedEv('A'), notConnectedEv('B')];
  const result = twin({}, { evidence: evs, now: fixedNow });
  assert.equal(result.confidence, 0);
});

// ── (B) TwinNode / TwinEdge frozen type spot-checks ──────────────────────────

test('TwinNode literal: id scheme is layer:name', () => {
  const node: TwinNode = {
    id: 'api:checkout',
    layer: 'api',
    label: 'Checkout API',
    domain: 'checkout',
    evidence: [],
  };
  assert.equal(node.id, 'api:checkout');
  assert.equal(node.layer, 'api');
});

test('TwinNode literal: domain can be null', () => {
  const node: TwinNode = {
    id: 'symbol:utils',
    layer: 'symbol',
    label: 'Utility helpers',
    domain: null,
    evidence: [],
  };
  assert.equal(node.domain, null);
});

test('TwinNode literal: all 21 TwinLayer values are valid string literals', () => {
  const layers: TwinLayer[] = [
    'feature', 'page', 'api', 'rpc', 'worker', 'queue', 'cron',
    'database', 'table', 'trigger', 'policy', 'storage',
    'deployment', 'infrastructure', 'test', 'documentation',
    'domain', 'service', 'symbol', 'owner', 'secret',
  ];
  assert.equal(layers.length, 21);
  for (const layer of layers) {
    assert.equal(typeof layer, 'string');
  }
});

test('TwinEdge literal: from/to/relation/views/evidence fields present', () => {
  const edge: TwinEdge = {
    from: 'api:checkout',
    to: 'rpc:create_checkout_order',
    relation: 'calls',
    views: ['dependency', 'execution'],
    evidence: [ev('graph-edge', 'api:checkout->rpc:create_checkout_order')],
  };
  assert.equal(edge.relation, 'calls');
  assert.equal(edge.views.length, 2);
});

test('TwinEdge literal: all 13 TwinRelation values are distinct string literals', () => {
  const relations: TwinRelation[] = [
    'depends-on', 'calls', 'reads', 'writes-to', 'triggers', 'consumes',
    'publishes-to', 'owned-by', 'deployed-by', 'contains', 'secures',
    'documents', 'tests',
  ];
  const unique = new Set(relations);
  assert.equal(unique.size, 13);
});

test('TwinEdge literal: all 6 TwinView values are distinct string literals', () => {
  const views: TwinView[] = [
    'dependency', 'ownership', 'execution', 'communication', 'infrastructure', 'data-flow',
  ];
  const unique = new Set(views);
  assert.equal(unique.size, 6);
});

// ── (C) TwinGraph invariant helpers over a sample literal ────────────────────

/** Build a minimal, well-formed TwinGraph literal for invariant testing. */
function makeSampleGraph(): TwinGraph {
  const nodes: TwinNode[] = [
    { id: 'api:orders', layer: 'api', label: 'Orders API', domain: 'orders', evidence: [] },
    { id: 'rpc:create_order', layer: 'rpc', label: 'create_order RPC', domain: 'orders', evidence: [] },
    { id: 'table:orders', layer: 'table', label: 'orders table', domain: 'orders', evidence: [] },
    { id: 'worker:order-worker', layer: 'worker', label: 'Order Worker', domain: 'orders', evidence: [] },
    { id: 'owner:payments-team', layer: 'owner', label: 'Payments Team', domain: null, evidence: [] },
  ];
  const edges: TwinEdge[] = [
    { from: 'api:orders', to: 'rpc:create_order', relation: 'calls', views: ['dependency', 'execution'], evidence: [] },
    { from: 'rpc:create_order', to: 'table:orders', relation: 'writes-to', views: ['data-flow'], evidence: [] },
    { from: 'worker:order-worker', to: 'table:orders', relation: 'reads', views: ['execution'], evidence: [] },
    { from: 'rpc:create_order', to: 'worker:order-worker', relation: 'triggers', views: ['communication'], evidence: [] },
    { from: 'table:orders', to: 'owner:payments-team', relation: 'owned-by', views: ['ownership'], evidence: [] },
  ];
  const byLayer: Record<string, number> = {
    api: 1,
    rpc: 1,
    table: 1,
    worker: 1,
    owner: 1,
  };
  return twin(
    {
      nodes,
      edges,
      byLayer,
      missingSources: [],
      summary: 'Sample graph for invariant tests.',
    },
    { evidence: [ev('file', 'test-fixture')], now: fixedNow },
  );
}

const SAMPLE = makeSampleGraph();

test('TwinGraph invariant: node ids are unique', () => {
  const ids = SAMPLE.nodes.map((n) => n.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, 'duplicate node ids found in graph');
});

test('TwinGraph invariant: every edge.from references an existing node id', () => {
  const nodeIds = new Set(SAMPLE.nodes.map((n) => n.id));
  for (const edge of SAMPLE.edges) {
    assert.ok(nodeIds.has(edge.from), `edge.from '${edge.from}' references a non-existent node`);
  }
});

test('TwinGraph invariant: every edge.to references an existing node id', () => {
  const nodeIds = new Set(SAMPLE.nodes.map((n) => n.id));
  for (const edge of SAMPLE.edges) {
    assert.ok(nodeIds.has(edge.to), `edge.to '${edge.to}' references a non-existent node`);
  }
});

test('TwinGraph invariant: byLayer sums to total node count', () => {
  const total = Object.values(SAMPLE.byLayer).reduce((a, b) => a + b, 0);
  assert.equal(total, SAMPLE.nodes.length, 'byLayer totals do not match node count');
});

test('TwinGraph invariant: every node layer appears in byLayer', () => {
  for (const node of SAMPLE.nodes) {
    assert.ok(
      node.layer in SAMPLE.byLayer,
      `node '${node.id}' has layer '${node.layer}' not present in byLayer`,
    );
  }
});

test('TwinGraph invariant: byLayer entry for each key is a positive integer', () => {
  for (const [layer, count] of Object.entries(SAMPLE.byLayer)) {
    assert.ok(Number.isInteger(count) && count > 0, `byLayer['${layer}'] = ${count} is not a positive integer`);
  }
});

test('TwinGraph invariant: missingSources is an array (may be empty)', () => {
  assert.ok(Array.isArray(SAMPLE.missingSources));
});

test('TwinGraph invariant: all edge views are non-empty arrays', () => {
  for (const edge of SAMPLE.edges) {
    assert.ok(edge.views.length > 0, `edge ${edge.from}->${edge.to} has no views`);
  }
});

test('TwinGraph invariant: the twin envelope fields are present on the graph', () => {
  assert.ok('confidence' in SAMPLE);
  assert.ok('sources' in SAMPLE);
  assert.ok('timestamp' in SAMPLE);
  assert.ok('liveConnected' in SAMPLE);
  assert.ok('evidence' in SAMPLE);
});

test('TwinGraph envelope: timestamp is the fixed injected clock value', () => {
  assert.equal(SAMPLE.timestamp, FIXED_TS);
});

test('TwinGraph envelope: liveConnected is false (structural-only twin)', () => {
  assert.equal(SAMPLE.liveConnected, false);
});

// ── Stress: invariant helper against a graph with a duplicated node ─────────

test('TwinGraph invariant: duplicate node ids are detectable', () => {
  const nodes: TwinNode[] = [
    { id: 'api:x', layer: 'api', label: 'X', domain: null, evidence: [] },
    { id: 'api:x', layer: 'api', label: 'X duplicate', domain: null, evidence: [] },
  ];
  const ids = nodes.map((n) => n.id);
  const unique = new Set(ids);
  assert.notEqual(unique.size, ids.length, 'expected duplicate detection to trigger');
});

// ── Stress: invariant helper against a graph with a dangling edge ─────────────

test('TwinGraph invariant: dangling edge.from is detectable', () => {
  const nodeIds = new Set(['api:x', 'rpc:y']);
  const from = 'api:DANGLING';
  assert.ok(!nodeIds.has(from), 'expected dangling node to be absent from node set');
});

/**
 * views-b.test.ts — CommunicationView, InfrastructureView, DataFlowView.
 *
 * Test dimensions (per view, ~19 each):
 *   - correct view label on the projection
 *   - empty graph → empty projection with correct summary
 *   - no edges for this view (other-view edges only) → empty projection
 *   - single matching edge: nodes/edges count and ids
 *   - only `from` node present (dangling `to` omitted from nodes list)
 *   - only `to` node present (dangling `from` omitted from nodes list)
 *   - multiple matching edges accumulate correctly
 *   - edges from other views are excluded
 *   - edge in MULTIPLE views is included (multi-view membership)
 *   - node unreferenced by any view edge is excluded
 *   - node order preserved (input order)
 *   - edge order preserved (input order)
 *   - summary string exact format singular node/edge
 *   - summary string exact format plural nodes/edges
 *   - determinism: two calls to project() on same graph return equal results
 *   - immutability: returned arrays are different references from graph arrays
 *   - self-loop edge (from === to) counts the node exactly once
 *   - deduplication: same node referenced by two edges included once
 *   - graph with zero nodes and edges with matching view: nodes empty
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { TwinEdge, TwinGraph, TwinNode, TwinView } from '../src/shared/types';
import { CommunicationView } from '../src/views/CommunicationView';
import { DataFlowView } from '../src/views/DataFlowView';
import { InfrastructureView } from '../src/views/InfrastructureView';

// ── Helpers ───────────────────────────────────────────────────────────────────

const FIXED = '2026-07-04T00:00:00.000Z';

function makeNode(id: string, layer: TwinNode['layer'] = 'service'): TwinNode {
  return { id, layer, label: id, domain: null, evidence: [] };
}

function makeEdge(
  from: string,
  to: string,
  relation: TwinEdge['relation'],
  views: readonly TwinView[],
): TwinEdge {
  return { from, to, relation, views, evidence: [] };
}

function emptyGraph(): TwinGraph {
  return {
    nodes: [],
    edges: [],
    byLayer: {},
    missingSources: [],
    summary: 'empty',
    evidence: [],
    confidence: 0,
    sources: [],
    timestamp: FIXED,
    liveConnected: false,
  };
}

function graphWith(nodes: readonly TwinNode[], edges: readonly TwinEdge[]): TwinGraph {
  return {
    ...emptyGraph(),
    nodes,
    edges,
  };
}

// ── CommunicationView ─────────────────────────────────────────────────────────

test('CommunicationView: view label is "communication"', () => {
  const p = new CommunicationView().project(emptyGraph());
  assert.equal(p.view, 'communication');
});

test('CommunicationView: empty graph yields empty nodes and edges', () => {
  const p = new CommunicationView().project(emptyGraph());
  assert.equal(p.nodes.length, 0);
  assert.equal(p.edges.length, 0);
});

test('CommunicationView: empty graph summary is correctly formatted', () => {
  const p = new CommunicationView().project(emptyGraph());
  assert.equal(p.summary, 'communication view: 0 nodes, 0 edges');
});

test('CommunicationView: no communication edges in graph yields empty projection', () => {
  const g = graphWith(
    [makeNode('api:a'), makeNode('api:b')],
    [makeEdge('api:a', 'api:b', 'depends-on', ['dependency'])],
  );
  const p = new CommunicationView().project(g);
  assert.equal(p.nodes.length, 0);
  assert.equal(p.edges.length, 0);
});

test('CommunicationView: single communication edge yields correct node ids', () => {
  const g = graphWith(
    [makeNode('api:a'), makeNode('service:b')],
    [makeEdge('api:a', 'service:b', 'calls', ['communication'])],
  );
  const p = new CommunicationView().project(g);
  assert.equal(p.edges.length, 1);
  assert.equal(p.nodes.length, 2);
  assert.ok(p.nodes.some((n) => n.id === 'api:a'));
  assert.ok(p.nodes.some((n) => n.id === 'service:b'));
});

test('CommunicationView: non-communication edges excluded even when nodes exist', () => {
  const g = graphWith(
    [makeNode('api:a'), makeNode('table:t')],
    [
      makeEdge('api:a', 'table:t', 'reads', ['data-flow']),
      makeEdge('api:a', 'table:t', 'calls', ['communication']),
    ],
  );
  const p = new CommunicationView().project(g);
  assert.equal(p.edges.length, 1);
  assert.equal(p.edges[0]!.relation, 'calls');
});

test('CommunicationView: edge in multiple views including communication is included', () => {
  const g = graphWith(
    [makeNode('service:x'), makeNode('service:y')],
    [makeEdge('service:x', 'service:y', 'calls', ['communication', 'dependency'])],
  );
  const p = new CommunicationView().project(g);
  assert.equal(p.edges.length, 1);
});

test('CommunicationView: node not referenced by any communication edge is excluded', () => {
  const g = graphWith(
    [makeNode('api:a'), makeNode('service:b'), makeNode('table:orphan')],
    [makeEdge('api:a', 'service:b', 'calls', ['communication'])],
  );
  const p = new CommunicationView().project(g);
  assert.ok(!p.nodes.some((n) => n.id === 'table:orphan'));
});

test('CommunicationView: multiple communication edges accumulate all referenced nodes', () => {
  const g = graphWith(
    [makeNode('api:a'), makeNode('service:b'), makeNode('service:c')],
    [
      makeEdge('api:a', 'service:b', 'calls', ['communication']),
      makeEdge('service:b', 'service:c', 'calls', ['communication']),
    ],
  );
  const p = new CommunicationView().project(g);
  assert.equal(p.edges.length, 2);
  assert.equal(p.nodes.length, 3);
});

test('CommunicationView: node order preserved (input order)', () => {
  const n1 = makeNode('api:a');
  const n2 = makeNode('service:b');
  const n3 = makeNode('service:c');
  const g = graphWith(
    [n1, n2, n3],
    [makeEdge('service:c', 'api:a', 'calls', ['communication'])],
  );
  const p = new CommunicationView().project(g);
  // n1 and n3 are referenced; n2 is not. n1 comes before n3 in input.
  assert.equal(p.nodes[0]!.id, 'api:a');
  assert.equal(p.nodes[1]!.id, 'service:c');
});

test('CommunicationView: edge order preserved (input order)', () => {
  const g = graphWith(
    [makeNode('api:a'), makeNode('service:b'), makeNode('service:c')],
    [
      makeEdge('api:a', 'service:b', 'calls', ['communication']),
      makeEdge('service:b', 'service:c', 'calls', ['communication']),
    ],
  );
  const p = new CommunicationView().project(g);
  assert.equal(p.edges[0]!.from, 'api:a');
  assert.equal(p.edges[1]!.from, 'service:b');
});

test('CommunicationView: summary singular node and edge', () => {
  const g = graphWith(
    [makeNode('api:a'), makeNode('service:b')],
    [makeEdge('api:a', 'service:b', 'calls', ['communication'])],
  );
  // 2 nodes but summary counts them as plural
  const p = new CommunicationView().project(g);
  assert.equal(p.summary, 'communication view: 2 nodes, 1 edge');
});

test('CommunicationView: summary singular node only (self-loop)', () => {
  const g = graphWith(
    [makeNode('service:x')],
    [makeEdge('service:x', 'service:x', 'calls', ['communication'])],
  );
  const p = new CommunicationView().project(g);
  assert.equal(p.summary, 'communication view: 1 node, 1 edge');
});

test('CommunicationView: self-loop edge — node included exactly once', () => {
  const g = graphWith(
    [makeNode('service:x')],
    [makeEdge('service:x', 'service:x', 'calls', ['communication'])],
  );
  const p = new CommunicationView().project(g);
  assert.equal(p.nodes.length, 1);
  assert.equal(p.nodes[0]!.id, 'service:x');
});

test('CommunicationView: node referenced by two edges included once (deduplication)', () => {
  const g = graphWith(
    [makeNode('api:hub'), makeNode('service:a'), makeNode('service:b')],
    [
      makeEdge('api:hub', 'service:a', 'calls', ['communication']),
      makeEdge('api:hub', 'service:b', 'calls', ['communication']),
    ],
  );
  const p = new CommunicationView().project(g);
  assert.equal(p.nodes.filter((n) => n.id === 'api:hub').length, 1);
  assert.equal(p.nodes.length, 3);
});

test('CommunicationView: determinism — two calls return deeply equal results', () => {
  const g = graphWith(
    [makeNode('api:a'), makeNode('service:b')],
    [makeEdge('api:a', 'service:b', 'calls', ['communication'])],
  );
  const v = new CommunicationView();
  const p1 = v.project(g);
  const p2 = v.project(g);
  assert.deepEqual(p1, p2);
});

test('CommunicationView: returned nodes array is not the same reference as graph.nodes', () => {
  const g = graphWith(
    [makeNode('api:a'), makeNode('service:b')],
    [makeEdge('api:a', 'service:b', 'calls', ['communication'])],
  );
  const p = new CommunicationView().project(g);
  assert.notEqual(p.nodes, g.nodes);
});

test('CommunicationView: returned edges array is not the same reference as graph.edges', () => {
  const g = graphWith(
    [makeNode('api:a'), makeNode('service:b')],
    [makeEdge('api:a', 'service:b', 'calls', ['communication'])],
  );
  const p = new CommunicationView().project(g);
  assert.notEqual(p.edges, g.edges);
});

test('CommunicationView: dangling from-node (only `from` present in graph.nodes)', () => {
  // Only makeNode for 'api:a'; 'service:b' is not in graph.nodes.
  const g = graphWith(
    [makeNode('api:a')],
    [makeEdge('api:a', 'service:b', 'calls', ['communication'])],
  );
  const p = new CommunicationView().project(g);
  // Edge is included (filtering is on edges, not on node presence),
  // but node 'service:b' absent from graph.nodes so absent from projection.nodes.
  assert.equal(p.edges.length, 1);
  assert.ok(p.nodes.some((n) => n.id === 'api:a'));
  assert.ok(!p.nodes.some((n) => n.id === 'service:b'));
});

// ── InfrastructureView ────────────────────────────────────────────────────────

test('InfrastructureView: view label is "infrastructure"', () => {
  const p = new InfrastructureView().project(emptyGraph());
  assert.equal(p.view, 'infrastructure');
});

test('InfrastructureView: empty graph yields empty nodes and edges', () => {
  const p = new InfrastructureView().project(emptyGraph());
  assert.equal(p.nodes.length, 0);
  assert.equal(p.edges.length, 0);
});

test('InfrastructureView: empty graph summary is correctly formatted', () => {
  const p = new InfrastructureView().project(emptyGraph());
  assert.equal(p.summary, 'infrastructure view: 0 nodes, 0 edges');
});

test('InfrastructureView: no infrastructure edges yields empty projection', () => {
  const g = graphWith(
    [makeNode('worker:w'), makeNode('queue:q')],
    [makeEdge('worker:w', 'queue:q', 'consumes', ['execution'])],
  );
  const p = new InfrastructureView().project(g);
  assert.equal(p.nodes.length, 0);
  assert.equal(p.edges.length, 0);
});

test('InfrastructureView: single infrastructure edge yields correct nodes', () => {
  const g = graphWith(
    [makeNode('worker:w'), makeNode('queue:q')],
    [makeEdge('worker:w', 'queue:q', 'consumes', ['infrastructure'])],
  );
  const p = new InfrastructureView().project(g);
  assert.equal(p.edges.length, 1);
  assert.equal(p.nodes.length, 2);
});

test('InfrastructureView: non-infrastructure edges excluded', () => {
  const g = graphWith(
    [makeNode('deployment:d'), makeNode('worker:w'), makeNode('queue:q')],
    [
      makeEdge('deployment:d', 'worker:w', 'deployed-by', ['infrastructure']),
      makeEdge('worker:w', 'queue:q', 'consumes', ['execution']),
    ],
  );
  const p = new InfrastructureView().project(g);
  assert.equal(p.edges.length, 1);
  assert.equal(p.edges[0]!.relation, 'deployed-by');
});

test('InfrastructureView: edge in multiple views including infrastructure is included', () => {
  const g = graphWith(
    [makeNode('deployment:d'), makeNode('worker:w')],
    [makeEdge('deployment:d', 'worker:w', 'deployed-by', ['infrastructure', 'ownership'])],
  );
  const p = new InfrastructureView().project(g);
  assert.equal(p.edges.length, 1);
});

test('InfrastructureView: orphan node not included', () => {
  const g = graphWith(
    [makeNode('worker:w'), makeNode('queue:q'), makeNode('secret:s')],
    [makeEdge('worker:w', 'queue:q', 'consumes', ['infrastructure'])],
  );
  const p = new InfrastructureView().project(g);
  assert.ok(!p.nodes.some((n) => n.id === 'secret:s'));
});

test('InfrastructureView: multiple infrastructure edges accumulate all nodes', () => {
  const g = graphWith(
    [makeNode('deployment:d'), makeNode('worker:w'), makeNode('queue:q')],
    [
      makeEdge('deployment:d', 'worker:w', 'deployed-by', ['infrastructure']),
      makeEdge('worker:w', 'queue:q', 'consumes', ['infrastructure']),
    ],
  );
  const p = new InfrastructureView().project(g);
  assert.equal(p.edges.length, 2);
  assert.equal(p.nodes.length, 3);
});

test('InfrastructureView: node order preserved', () => {
  const g = graphWith(
    [makeNode('deployment:d'), makeNode('worker:w'), makeNode('queue:q')],
    [makeEdge('worker:w', 'queue:q', 'consumes', ['infrastructure'])],
  );
  const p = new InfrastructureView().project(g);
  assert.equal(p.nodes[0]!.id, 'worker:w');
  assert.equal(p.nodes[1]!.id, 'queue:q');
});

test('InfrastructureView: edge order preserved', () => {
  const g = graphWith(
    [makeNode('deployment:d'), makeNode('worker:w'), makeNode('queue:q')],
    [
      makeEdge('deployment:d', 'worker:w', 'deployed-by', ['infrastructure']),
      makeEdge('worker:w', 'queue:q', 'consumes', ['infrastructure']),
    ],
  );
  const p = new InfrastructureView().project(g);
  assert.equal(p.edges[0]!.relation, 'deployed-by');
  assert.equal(p.edges[1]!.relation, 'consumes');
});

test('InfrastructureView: summary with 2 nodes and 1 edge (plural/singular)', () => {
  const g = graphWith(
    [makeNode('deployment:d'), makeNode('worker:w')],
    [makeEdge('deployment:d', 'worker:w', 'deployed-by', ['infrastructure'])],
  );
  const p = new InfrastructureView().project(g);
  assert.equal(p.summary, 'infrastructure view: 2 nodes, 1 edge');
});

test('InfrastructureView: summary with 1 node and 1 edge (singular/singular) via self-loop', () => {
  const g = graphWith(
    [makeNode('worker:w')],
    [makeEdge('worker:w', 'worker:w', 'consumes', ['infrastructure'])],
  );
  const p = new InfrastructureView().project(g);
  assert.equal(p.summary, 'infrastructure view: 1 node, 1 edge');
});

test('InfrastructureView: self-loop node included exactly once', () => {
  const g = graphWith(
    [makeNode('worker:w')],
    [makeEdge('worker:w', 'worker:w', 'consumes', ['infrastructure'])],
  );
  const p = new InfrastructureView().project(g);
  assert.equal(p.nodes.length, 1);
});

test('InfrastructureView: shared node referenced by two edges appears once', () => {
  const g = graphWith(
    [makeNode('deployment:d'), makeNode('worker:w1'), makeNode('worker:w2')],
    [
      makeEdge('deployment:d', 'worker:w1', 'deployed-by', ['infrastructure']),
      makeEdge('deployment:d', 'worker:w2', 'deployed-by', ['infrastructure']),
    ],
  );
  const p = new InfrastructureView().project(g);
  assert.equal(p.nodes.filter((n) => n.id === 'deployment:d').length, 1);
});

test('InfrastructureView: determinism — two calls return deeply equal results', () => {
  const g = graphWith(
    [makeNode('worker:w'), makeNode('queue:q')],
    [makeEdge('worker:w', 'queue:q', 'consumes', ['infrastructure'])],
  );
  const v = new InfrastructureView();
  assert.deepEqual(v.project(g), v.project(g));
});

test('InfrastructureView: returned nodes array is not the same reference as graph.nodes', () => {
  const g = graphWith(
    [makeNode('worker:w'), makeNode('queue:q')],
    [makeEdge('worker:w', 'queue:q', 'consumes', ['infrastructure'])],
  );
  const p = new InfrastructureView().project(g);
  assert.notEqual(p.nodes, g.nodes);
});

test('InfrastructureView: returned edges array is not the same reference as graph.edges', () => {
  const g = graphWith(
    [makeNode('worker:w'), makeNode('queue:q')],
    [makeEdge('worker:w', 'queue:q', 'consumes', ['infrastructure'])],
  );
  const p = new InfrastructureView().project(g);
  assert.notEqual(p.edges, g.edges);
});

test('InfrastructureView: dangling to-node not included in projection.nodes', () => {
  // 'queue:q' is not in graph.nodes.
  const g = graphWith(
    [makeNode('worker:w')],
    [makeEdge('worker:w', 'queue:q', 'consumes', ['infrastructure'])],
  );
  const p = new InfrastructureView().project(g);
  assert.equal(p.edges.length, 1);
  assert.ok(!p.nodes.some((n) => n.id === 'queue:q'));
  assert.ok(p.nodes.some((n) => n.id === 'worker:w'));
});

// ── DataFlowView ──────────────────────────────────────────────────────────────

test('DataFlowView: view label is "data-flow"', () => {
  const p = new DataFlowView().project(emptyGraph());
  assert.equal(p.view, 'data-flow');
});

test('DataFlowView: empty graph yields empty nodes and edges', () => {
  const p = new DataFlowView().project(emptyGraph());
  assert.equal(p.nodes.length, 0);
  assert.equal(p.edges.length, 0);
});

test('DataFlowView: empty graph summary is correctly formatted', () => {
  const p = new DataFlowView().project(emptyGraph());
  assert.equal(p.summary, 'data-flow view: 0 nodes, 0 edges');
});

test('DataFlowView: no data-flow edges yields empty projection', () => {
  const g = graphWith(
    [makeNode('api:a'), makeNode('table:t')],
    [makeEdge('api:a', 'table:t', 'calls', ['communication'])],
  );
  const p = new DataFlowView().project(g);
  assert.equal(p.nodes.length, 0);
  assert.equal(p.edges.length, 0);
});

test('DataFlowView: single data-flow edge yields correct nodes', () => {
  const g = graphWith(
    [makeNode('rpc:r'), makeNode('table:t')],
    [makeEdge('rpc:r', 'table:t', 'reads', ['data-flow'])],
  );
  const p = new DataFlowView().project(g);
  assert.equal(p.edges.length, 1);
  assert.equal(p.nodes.length, 2);
  assert.ok(p.nodes.some((n) => n.id === 'rpc:r'));
  assert.ok(p.nodes.some((n) => n.id === 'table:t'));
});

test('DataFlowView: non-data-flow edges excluded even when nodes present', () => {
  const g = graphWith(
    [makeNode('rpc:r'), makeNode('table:t')],
    [
      makeEdge('rpc:r', 'table:t', 'reads', ['data-flow']),
      makeEdge('rpc:r', 'table:t', 'writes-to', ['data-flow']),
      makeEdge('rpc:r', 'table:t', 'depends-on', ['dependency']),
    ],
  );
  const p = new DataFlowView().project(g);
  assert.equal(p.edges.length, 2);
  assert.ok(p.edges.every((e) => e.views.includes('data-flow')));
});

test('DataFlowView: edge in multiple views including data-flow is included', () => {
  const g = graphWith(
    [makeNode('rpc:r'), makeNode('table:t')],
    [makeEdge('rpc:r', 'table:t', 'reads', ['data-flow', 'execution'])],
  );
  const p = new DataFlowView().project(g);
  assert.equal(p.edges.length, 1);
});

test('DataFlowView: orphan node not included', () => {
  const g = graphWith(
    [makeNode('rpc:r'), makeNode('table:t'), makeNode('domain:orphan')],
    [makeEdge('rpc:r', 'table:t', 'reads', ['data-flow'])],
  );
  const p = new DataFlowView().project(g);
  assert.ok(!p.nodes.some((n) => n.id === 'domain:orphan'));
});

test('DataFlowView: multiple data-flow edges accumulate all referenced nodes', () => {
  const g = graphWith(
    [makeNode('rpc:r'), makeNode('table:t1'), makeNode('table:t2')],
    [
      makeEdge('rpc:r', 'table:t1', 'reads', ['data-flow']),
      makeEdge('rpc:r', 'table:t2', 'writes-to', ['data-flow']),
    ],
  );
  const p = new DataFlowView().project(g);
  assert.equal(p.edges.length, 2);
  assert.equal(p.nodes.length, 3);
});

test('DataFlowView: node order preserved (input order)', () => {
  // graph.nodes: [table:t, rpc:r] — t comes before r in input.
  // Edge references both.
  const g = graphWith(
    [makeNode('table:t'), makeNode('rpc:r')],
    [makeEdge('rpc:r', 'table:t', 'reads', ['data-flow'])],
  );
  const p = new DataFlowView().project(g);
  assert.equal(p.nodes[0]!.id, 'table:t');
  assert.equal(p.nodes[1]!.id, 'rpc:r');
});

test('DataFlowView: edge order preserved (input order)', () => {
  const g = graphWith(
    [makeNode('rpc:r'), makeNode('table:t1'), makeNode('table:t2')],
    [
      makeEdge('rpc:r', 'table:t1', 'reads', ['data-flow']),
      makeEdge('rpc:r', 'table:t2', 'writes-to', ['data-flow']),
    ],
  );
  const p = new DataFlowView().project(g);
  assert.equal(p.edges[0]!.relation, 'reads');
  assert.equal(p.edges[1]!.relation, 'writes-to');
});

test('DataFlowView: summary with 2 nodes and 1 edge (plural/singular)', () => {
  const g = graphWith(
    [makeNode('rpc:r'), makeNode('table:t')],
    [makeEdge('rpc:r', 'table:t', 'reads', ['data-flow'])],
  );
  const p = new DataFlowView().project(g);
  assert.equal(p.summary, 'data-flow view: 2 nodes, 1 edge');
});

test('DataFlowView: summary with 1 node and 1 edge (singular/singular) via self-loop', () => {
  const g = graphWith(
    [makeNode('table:t')],
    [makeEdge('table:t', 'table:t', 'triggers', ['data-flow'])],
  );
  const p = new DataFlowView().project(g);
  assert.equal(p.summary, 'data-flow view: 1 node, 1 edge');
});

test('DataFlowView: summary with 2 nodes and 2 edges (all plural)', () => {
  const g = graphWith(
    [makeNode('rpc:r'), makeNode('table:t')],
    [
      makeEdge('rpc:r', 'table:t', 'reads', ['data-flow']),
      makeEdge('rpc:r', 'table:t', 'writes-to', ['data-flow']),
    ],
  );
  const p = new DataFlowView().project(g);
  assert.equal(p.summary, 'data-flow view: 2 nodes, 2 edges');
});

test('DataFlowView: self-loop node included exactly once', () => {
  const g = graphWith(
    [makeNode('table:t')],
    [makeEdge('table:t', 'table:t', 'triggers', ['data-flow'])],
  );
  const p = new DataFlowView().project(g);
  assert.equal(p.nodes.length, 1);
  assert.equal(p.nodes[0]!.id, 'table:t');
});

test('DataFlowView: shared from-node referenced by two edges appears once', () => {
  const g = graphWith(
    [makeNode('rpc:r'), makeNode('table:t1'), makeNode('table:t2')],
    [
      makeEdge('rpc:r', 'table:t1', 'reads', ['data-flow']),
      makeEdge('rpc:r', 'table:t2', 'writes-to', ['data-flow']),
    ],
  );
  const p = new DataFlowView().project(g);
  assert.equal(p.nodes.filter((n) => n.id === 'rpc:r').length, 1);
});

test('DataFlowView: determinism — two calls return deeply equal results', () => {
  const g = graphWith(
    [makeNode('rpc:r'), makeNode('table:t')],
    [makeEdge('rpc:r', 'table:t', 'reads', ['data-flow'])],
  );
  const v = new DataFlowView();
  assert.deepEqual(v.project(g), v.project(g));
});

test('DataFlowView: returned nodes array is not the same reference as graph.nodes', () => {
  const g = graphWith(
    [makeNode('rpc:r'), makeNode('table:t')],
    [makeEdge('rpc:r', 'table:t', 'reads', ['data-flow'])],
  );
  const p = new DataFlowView().project(g);
  assert.notEqual(p.nodes, g.nodes);
});

test('DataFlowView: returned edges array is not the same reference as graph.edges', () => {
  const g = graphWith(
    [makeNode('rpc:r'), makeNode('table:t')],
    [makeEdge('rpc:r', 'table:t', 'reads', ['data-flow'])],
  );
  const p = new DataFlowView().project(g);
  assert.notEqual(p.edges, g.edges);
});

test('DataFlowView: dangling to-node (absent from graph.nodes) not in projection.nodes', () => {
  const g = graphWith(
    [makeNode('rpc:r')],
    [makeEdge('rpc:r', 'table:missing', 'reads', ['data-flow'])],
  );
  const p = new DataFlowView().project(g);
  assert.equal(p.edges.length, 1);
  assert.ok(!p.nodes.some((n) => n.id === 'table:missing'));
  assert.ok(p.nodes.some((n) => n.id === 'rpc:r'));
});

// ── Cross-view independence tests ─────────────────────────────────────────────

test('all three views on same graph are independent projections (no cross-contamination)', () => {
  const g = graphWith(
    [makeNode('api:a'), makeNode('service:b'), makeNode('worker:w'), makeNode('queue:q'), makeNode('rpc:r'), makeNode('table:t')],
    [
      makeEdge('api:a', 'service:b', 'calls', ['communication']),
      makeEdge('worker:w', 'queue:q', 'consumes', ['infrastructure']),
      makeEdge('rpc:r', 'table:t', 'reads', ['data-flow']),
    ],
  );
  const comm = new CommunicationView().project(g);
  const infra = new InfrastructureView().project(g);
  const flow = new DataFlowView().project(g);

  assert.equal(comm.edges.length, 1);
  assert.equal(infra.edges.length, 1);
  assert.equal(flow.edges.length, 1);

  // No edge from another view leaks into comm
  assert.ok(comm.edges.every((e) => e.views.includes('communication')));
  assert.ok(infra.edges.every((e) => e.views.includes('infrastructure')));
  assert.ok(flow.edges.every((e) => e.views.includes('data-flow')));
});

test('multi-view edge shared between communication and data-flow appears in both', () => {
  const g = graphWith(
    [makeNode('api:a'), makeNode('table:t')],
    [makeEdge('api:a', 'table:t', 'reads', ['communication', 'data-flow'])],
  );
  const comm = new CommunicationView().project(g);
  const flow = new DataFlowView().project(g);
  assert.equal(comm.edges.length, 1);
  assert.equal(flow.edges.length, 1);
});

test('multi-view edge shared across all three views appears in all three projections', () => {
  const g = graphWith(
    [makeNode('worker:w'), makeNode('queue:q')],
    [makeEdge('worker:w', 'queue:q', 'consumes', ['communication', 'infrastructure', 'data-flow'])],
  );
  const comm = new CommunicationView().project(g);
  const infra = new InfrastructureView().project(g);
  const flow = new DataFlowView().project(g);
  assert.equal(comm.edges.length, 1);
  assert.equal(infra.edges.length, 1);
  assert.equal(flow.edges.length, 1);
});

test('large mixed graph: each view selects only its own edges', () => {
  // Build 10 edges: 4 communication, 3 infrastructure, 3 data-flow
  const nodes = Array.from({ length: 12 }, (_, i) => makeNode(`service:n${i}`));
  const edges: TwinEdge[] = [
    makeEdge('service:n0', 'service:n1', 'calls', ['communication']),
    makeEdge('service:n1', 'service:n2', 'calls', ['communication']),
    makeEdge('service:n2', 'service:n3', 'calls', ['communication']),
    makeEdge('service:n3', 'service:n4', 'calls', ['communication']),
    makeEdge('service:n4', 'service:n5', 'deployed-by', ['infrastructure']),
    makeEdge('service:n5', 'service:n6', 'consumes', ['infrastructure']),
    makeEdge('service:n6', 'service:n7', 'consumes', ['infrastructure']),
    makeEdge('service:n7', 'service:n8', 'reads', ['data-flow']),
    makeEdge('service:n8', 'service:n9', 'writes-to', ['data-flow']),
    makeEdge('service:n9', 'service:n10', 'reads', ['data-flow']),
  ];
  const g = graphWith(nodes, edges);

  assert.equal(new CommunicationView().project(g).edges.length, 4);
  assert.equal(new InfrastructureView().project(g).edges.length, 3);
  assert.equal(new DataFlowView().project(g).edges.length, 3);
});

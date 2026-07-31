/**
 * Frozen algorithm tests for LDTS graph-algorithms.ts.
 * Uses node:test + assert/strict; FIXED clock '2026-07-04T00:00:00.000Z'.
 * Pure fixtures — no IO, no src changes.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAdjacency,
  criticalPath,
  detectCycles,
  fanReport,
  findSpofs,
  impactRadius,
  shortestPath,
  type Adjacency,
} from '../src/algorithms/graph-algorithms';
import type { TwinEdge, TwinNode } from '../src/shared/types';

// ── Fixture helpers ──────────────────────────────────────────────────────────

function n(id: string, layer: TwinNode['layer'] = 'api', domain: string | null = null): TwinNode {
  return { id, layer, label: id, domain, evidence: [] };
}

function e(from: string, to: string): TwinEdge {
  return { from, to, relation: 'depends-on', views: ['dependency'], evidence: [] };
}

/** Build adjacency from shorthand: n('id') and e('from','to'). */
function adj(nodes: TwinNode[], edges: TwinEdge[]): Adjacency {
  return buildAdjacency(nodes, edges);
}

/** Build nodesById map from a TwinNode array. */
function byId(nodes: TwinNode[]): ReadonlyMap<string, TwinNode> {
  return new Map(nodes.map((nd) => [nd.id, nd]));
}

// ═══════════════════════════════════════════════════════════════════════════════
// buildAdjacency — 15+ tests
// ═══════════════════════════════════════════════════════════════════════════════

test('buildAdjacency: ids are sorted ascending', () => {
  const nodes = [n('c'), n('a'), n('b')];
  const a = buildAdjacency(nodes, []);
  assert.deepEqual([...a.ids], ['a', 'b', 'c']);
});

test('buildAdjacency: empty graph produces empty maps and ids', () => {
  const a = buildAdjacency([], []);
  assert.deepEqual([...a.ids], []);
  assert.equal(a.out.size, 0);
  assert.equal(a.in.size, 0);
});

test('buildAdjacency: out neighbor lists are sorted', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const edges = [e('a', 'd'), e('a', 'b'), e('a', 'c')];
  const a = buildAdjacency(nodes, edges);
  assert.deepEqual(a.out.get('a'), ['b', 'c', 'd']);
});

test('buildAdjacency: in neighbor lists are sorted', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const edges = [e('d', 'a'), e('b', 'a'), e('c', 'a')];
  const a = buildAdjacency(nodes, edges);
  assert.deepEqual(a.in.get('a'), ['b', 'c', 'd']);
});

test('buildAdjacency: dangling edge (from not in nodes) is dropped', () => {
  const nodes = [n('a'), n('b')];
  const edges = [e('x', 'b')]; // x not in nodes
  const a = buildAdjacency(nodes, edges);
  assert.deepEqual(a.out.get('a'), []);
  assert.deepEqual(a.in.get('b'), []);
});

test('buildAdjacency: dangling edge (to not in nodes) is dropped', () => {
  const nodes = [n('a'), n('b')];
  const edges = [e('a', 'z')]; // z not in nodes
  const a = buildAdjacency(nodes, edges);
  assert.deepEqual(a.out.get('a'), []);
});

test('buildAdjacency: both-dangling edge (neither from nor to in nodes) is dropped', () => {
  const nodes = [n('a')];
  const edges = [e('x', 'y')];
  const a = buildAdjacency(nodes, edges);
  assert.deepEqual(a.out.get('a'), []);
});

test('buildAdjacency: self-loop is kept in adjacency', () => {
  const nodes = [n('a'), n('b')];
  const edges = [e('a', 'a')];
  const a = buildAdjacency(nodes, edges);
  assert.deepEqual(a.out.get('a'), ['a']);
  assert.deepEqual(a.in.get('a'), ['a']);
});

test('buildAdjacency: multiple edges from same node accumulate', () => {
  const nodes = [n('a'), n('b'), n('c')];
  const edges = [e('a', 'b'), e('a', 'c')];
  const a = buildAdjacency(nodes, edges);
  assert.deepEqual(a.out.get('a'), ['b', 'c']);
});

test('buildAdjacency: multiple edges to same node accumulate in-list', () => {
  const nodes = [n('a'), n('b'), n('c')];
  const edges = [e('b', 'a'), e('c', 'a')];
  const a = buildAdjacency(nodes, edges);
  assert.deepEqual(a.in.get('a'), ['b', 'c']);
});

test('buildAdjacency: single-node no-edge graph', () => {
  const nodes = [n('solo')];
  const a = buildAdjacency(nodes, []);
  assert.deepEqual([...a.ids], ['solo']);
  assert.deepEqual(a.out.get('solo'), []);
  assert.deepEqual(a.in.get('solo'), []);
});

test('buildAdjacency: bidirectional edges stored correctly', () => {
  const nodes = [n('a'), n('b')];
  const edges = [e('a', 'b'), e('b', 'a')];
  const a = buildAdjacency(nodes, edges);
  assert.deepEqual(a.out.get('a'), ['b']);
  assert.deepEqual(a.out.get('b'), ['a']);
  assert.deepEqual(a.in.get('a'), ['b']);
  assert.deepEqual(a.in.get('b'), ['a']);
});

test('buildAdjacency: ids include isolated nodes (no edges)', () => {
  const nodes = [n('x'), n('y'), n('z')];
  const a = buildAdjacency(nodes, []);
  assert.deepEqual([...a.ids], ['x', 'y', 'z']);
});

test('buildAdjacency: partial dangling — valid edge alongside dangling edge', () => {
  const nodes = [n('a'), n('b')];
  const edges = [e('a', 'b'), e('ghost', 'b')];
  const a = buildAdjacency(nodes, edges);
  assert.deepEqual(a.out.get('a'), ['b']);
  assert.deepEqual(a.in.get('b'), ['a']); // ghost edge dropped
});

test('buildAdjacency: large sorted ids (stress sort correctness)', () => {
  const ids = ['z', 'm', 'a', 'f', 'b'];
  const nodes = ids.map((id) => n(id));
  const a = buildAdjacency(nodes, []);
  assert.deepEqual([...a.ids], ['a', 'b', 'f', 'm', 'z']);
});

// ═══════════════════════════════════════════════════════════════════════════════
// shortestPath — 25+ tests
// ═══════════════════════════════════════════════════════════════════════════════

test('shortestPath: direct edge — hops 1, path exact', () => {
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, [e('a', 'b')]);
  const r = shortestPath(a, 'a', 'b');
  assert.equal(r.found, true);
  assert.equal(r.hops, 1);
  assert.deepEqual([...r.path], ['a', 'b']);
});

test('shortestPath: two-hop path', () => {
  const nodes = [n('a'), n('b'), n('c')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c')]);
  const r = shortestPath(a, 'a', 'c');
  assert.equal(r.found, true);
  assert.equal(r.hops, 2);
  assert.deepEqual([...r.path], ['a', 'b', 'c']);
});

test('shortestPath: from === to returns path=[from], hops 0', () => {
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, [e('a', 'b')]);
  const r = shortestPath(a, 'a', 'a');
  assert.equal(r.found, true);
  assert.equal(r.hops, 0);
  assert.deepEqual([...r.path], ['a']);
});

test('shortestPath: unknown from — found false, empty path', () => {
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, [e('a', 'b')]);
  const r = shortestPath(a, 'z', 'b');
  assert.equal(r.found, false);
  assert.deepEqual([...r.path], []);
});

test('shortestPath: unknown to — found false, empty path', () => {
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, [e('a', 'b')]);
  const r = shortestPath(a, 'a', 'z');
  assert.equal(r.found, false);
  assert.deepEqual([...r.path], []);
});

test('shortestPath: unreachable (no path) — found false', () => {
  const nodes = [n('a'), n('b'), n('c')];
  const a = adj(nodes, [e('a', 'b')]); // c is isolated
  const r = shortestPath(a, 'a', 'c');
  assert.equal(r.found, false);
  assert.deepEqual([...r.path], []);
  assert.equal(r.hops, 0);
});

test('shortestPath: prefers fewest hops among alternatives', () => {
  // a->b->c and a->c (direct). Shortest is a->c (1 hop).
  const nodes = [n('a'), n('b'), n('c')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('a', 'c')]);
  const r = shortestPath(a, 'a', 'c');
  assert.equal(r.found, true);
  assert.equal(r.hops, 1);
  assert.deepEqual([...r.path], ['a', 'c']);
});

test('shortestPath: diamond tie-break — b-branch chosen (b < c sorted)', () => {
  // a->b, a->c, b->d, c->d. BFS: a's neighbors sorted = [b,c]. b enqueued first.
  // b->d found first, so path = a->b->d.
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const a = adj(nodes, [e('a', 'b'), e('a', 'c'), e('b', 'd'), e('c', 'd')]);
  const r = shortestPath(a, 'a', 'd');
  assert.equal(r.found, true);
  assert.equal(r.hops, 2);
  assert.deepEqual([...r.path], ['a', 'b', 'd']);
});

test('shortestPath: linear chain length 5', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d'), n('e')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('c', 'd'), e('d', 'e')]);
  const r = shortestPath(a, 'a', 'e');
  assert.equal(r.found, true);
  assert.equal(r.hops, 4);
  assert.deepEqual([...r.path], ['a', 'b', 'c', 'd', 'e']);
});

test('shortestPath: path content is EXACT array', () => {
  const nodes = [n('x'), n('y'), n('z')];
  const a = adj(nodes, [e('x', 'y'), e('y', 'z')]);
  const r = shortestPath(a, 'x', 'z');
  assert.deepEqual([...r.path], ['x', 'y', 'z']);
});

test('shortestPath: reverse direction not found when edge is one-way', () => {
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, [e('a', 'b')]);
  const r = shortestPath(a, 'b', 'a');
  assert.equal(r.found, false);
});

test('shortestPath: single node, no edges, from===to', () => {
  const nodes = [n('solo')];
  const a = adj(nodes, []);
  const r = shortestPath(a, 'solo', 'solo');
  assert.equal(r.found, true);
  assert.equal(r.hops, 0);
  assert.deepEqual([...r.path], ['solo']);
});

test('shortestPath: two disconnected components — found false', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const a = adj(nodes, [e('a', 'b'), e('c', 'd')]);
  const r = shortestPath(a, 'a', 'd');
  assert.equal(r.found, false);
});

test('shortestPath: self-loop on from does not break BFS', () => {
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, [e('a', 'a'), e('a', 'b')]);
  const r = shortestPath(a, 'a', 'b');
  assert.equal(r.found, true);
  assert.equal(r.hops, 1);
  assert.deepEqual([...r.path], ['a', 'b']);
});

test('shortestPath: three-hop path through intermediate nodes', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('c', 'd')]);
  const r = shortestPath(a, 'a', 'd');
  assert.equal(r.hops, 3);
  assert.deepEqual([...r.path], ['a', 'b', 'c', 'd']);
});

test('shortestPath: BFS finds shortest not DFS (shortcut via c)', () => {
  // a->b->c->d and a->d. Shortest = a->d (1 hop).
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('c', 'd'), e('a', 'd')]);
  const r = shortestPath(a, 'a', 'd');
  assert.equal(r.hops, 1);
  assert.deepEqual([...r.path], ['a', 'd']);
});

test('shortestPath: from equals to even if not directly connected to anything', () => {
  const nodes = [n('alone')];
  const a = adj(nodes, []);
  const r = shortestPath(a, 'alone', 'alone');
  assert.equal(r.found, true);
  assert.equal(r.hops, 0);
});

test('shortestPath: diamond with c-branch would be shorter name — b still chosen (b < c)', () => {
  // a -> [b, c] -> d. b < c alphabetically. b gets processed first -> b-branch wins.
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const a = adj(nodes, [e('a', 'c'), e('a', 'b'), e('b', 'd'), e('c', 'd')]);
  const r = shortestPath(a, 'a', 'd');
  assert.deepEqual([...r.path], ['a', 'b', 'd']);
});

test('shortestPath: longer diamond — 3 intermediates, b-branch still wins', () => {
  // a->[b,c], b->e, c->e. b<c, b first, b->e first.
  const nodes = [n('a'), n('b'), n('c'), n('e')];
  const a = adj(nodes, [e('a', 'b'), e('a', 'c'), e('b', 'e'), e('c', 'e')]);
  const r = shortestPath(a, 'a', 'e');
  assert.deepEqual([...r.path], ['a', 'b', 'e']);
  assert.equal(r.hops, 2);
});

test('shortestPath: path from node to itself with cycle in graph', () => {
  const nodes = [n('a'), n('b'), n('c')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('c', 'a')]);
  const r = shortestPath(a, 'a', 'a');
  assert.equal(r.found, true);
  assert.equal(r.hops, 0);
  assert.deepEqual([...r.path], ['a']);
});

test('shortestPath: cycle does not cause infinite loop', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('c', 'b'), e('c', 'd')]);
  const r = shortestPath(a, 'a', 'd');
  assert.equal(r.found, true);
  assert.equal(r.hops, 3);
  assert.deepEqual([...r.path], ['a', 'b', 'c', 'd']);
});

test('shortestPath: from and to are both unknown nodes', () => {
  const nodes = [n('a')];
  const a = adj(nodes, []);
  const r = shortestPath(a, 'x', 'y');
  assert.equal(r.found, false);
  assert.equal(r.hops, 0);
  assert.deepEqual([...r.path], []);
});

test('shortestPath: hops property matches path.length - 1 when found', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d'), n('e')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('c', 'd'), e('d', 'e')]);
  const r = shortestPath(a, 'a', 'e');
  assert.equal(r.hops, r.path.length - 1);
});

test('shortestPath: result carries correct from/to', () => {
  const nodes = [n('src'), n('dst')];
  const a = adj(nodes, [e('src', 'dst')]);
  const r = shortestPath(a, 'src', 'dst');
  assert.equal(r.from, 'src');
  assert.equal(r.to, 'dst');
});

// ═══════════════════════════════════════════════════════════════════════════════
// detectCycles — 20+ tests
// ═══════════════════════════════════════════════════════════════════════════════

test('detectCycles: acyclic DAG — count 0, empty cycles', () => {
  const nodes = [n('a'), n('b'), n('c')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c')]);
  const r = detectCycles(a);
  assert.equal(r.count, 0);
  assert.deepEqual([...r.cycles], []);
});

test('detectCycles: simple 2-cycle a->b->a', () => {
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'a')]);
  const r = detectCycles(a);
  assert.equal(r.count, 1);
  assert.deepEqual([...r.cycles[0]!], ['a', 'b']);
});

test('detectCycles: 3-cycle a->b->c->a', () => {
  const nodes = [n('a'), n('b'), n('c')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('c', 'a')]);
  const r = detectCycles(a);
  assert.equal(r.count, 1);
  assert.deepEqual([...r.cycles[0]!], ['a', 'b', 'c']);
});

test('detectCycles: self-loop counts as a cycle', () => {
  const nodes = [n('a')];
  const a = adj(nodes, [e('a', 'a')]);
  const r = detectCycles(a);
  assert.equal(r.count, 1);
  assert.deepEqual([...r.cycles[0]!], ['a']);
});

test('detectCycles: two disjoint cycles — sorted by first id', () => {
  // Cycle 1: p->q->p; Cycle 2: x->y->x
  const nodes = [n('p'), n('q'), n('x'), n('y')];
  const a = adj(nodes, [e('p', 'q'), e('q', 'p'), e('x', 'y'), e('y', 'x')]);
  const r = detectCycles(a);
  assert.equal(r.count, 2);
  // sorted by first element: p < x
  assert.deepEqual([...r.cycles[0]!], ['p', 'q']);
  assert.deepEqual([...r.cycles[1]!], ['x', 'y']);
});

test('detectCycles: DAG with diamond — no cycles', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const a = adj(nodes, [e('a', 'b'), e('a', 'c'), e('b', 'd'), e('c', 'd')]);
  const r = detectCycles(a);
  assert.equal(r.count, 0);
});

test('detectCycles: cycle members are sorted asc', () => {
  const nodes = [n('c'), n('a'), n('b')];
  const a = adj(nodes, [e('c', 'a'), e('a', 'b'), e('b', 'c')]);
  const r = detectCycles(a);
  assert.equal(r.count, 1);
  const cycle = [...r.cycles[0]!];
  assert.deepEqual(cycle, [...cycle].sort());
});

test('detectCycles: empty graph — count 0', () => {
  const a = buildAdjacency([], []);
  const r = detectCycles(a);
  assert.equal(r.count, 0);
});

test('detectCycles: single node no self-loop — count 0', () => {
  const nodes = [n('a')];
  const a = adj(nodes, []);
  const r = detectCycles(a);
  assert.equal(r.count, 0);
});

test('detectCycles: figure-eight sharing a center node — ONE SCC with all', () => {
  // a->b->c->a and c->d->e->c. Node c is shared. All 5 form one SCC.
  const nodes = [n('a'), n('b'), n('c'), n('d'), n('e')];
  const a = adj(nodes, [
    e('a', 'b'), e('b', 'c'), e('c', 'a'), // first loop
    e('c', 'd'), e('d', 'e'), e('e', 'c'), // second loop shares c
  ]);
  const r = detectCycles(a);
  assert.equal(r.count, 1);
  const members = [...r.cycles[0]!];
  assert.deepEqual(members, ['a', 'b', 'c', 'd', 'e']);
});

test('detectCycles: linear chain with back-edge produces one cycle', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('c', 'd'), e('d', 'b')]);
  const r = detectCycles(a);
  assert.equal(r.count, 1);
  const cycle = [...r.cycles[0]!];
  assert.deepEqual(cycle, ['b', 'c', 'd']);
});

test('detectCycles: two separate self-loops', () => {
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, [e('a', 'a'), e('b', 'b')]);
  const r = detectCycles(a);
  assert.equal(r.count, 2);
  assert.deepEqual([...r.cycles[0]!], ['a']);
  assert.deepEqual([...r.cycles[1]!], ['b']);
});

test('detectCycles: nested back-edge — only one SCC', () => {
  // a->b->c->a->d->e->a: all reachable from a form one SCC
  const nodes = [n('a'), n('b'), n('c'), n('d'), n('e')];
  const a = adj(nodes, [
    e('a', 'b'), e('b', 'c'), e('c', 'a'),
    e('a', 'd'), e('d', 'e'), e('e', 'a'),
  ]);
  const r = detectCycles(a);
  assert.equal(r.count, 1);
  assert.deepEqual([...r.cycles[0]!], ['a', 'b', 'c', 'd', 'e']);
});

test('detectCycles: cycles list sorted by first element asc', () => {
  // Make two cycles: [m,n] and [a,b] — expect [a,b] first
  const nodes = [n('a'), n('b'), n('m'), n('n')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'a'), e('m', 'n'), e('n', 'm')]);
  const r = detectCycles(a);
  assert.equal(r.count, 2);
  assert.ok(r.cycles[0]![0]! <= r.cycles[1]![0]!);
  assert.deepEqual([...r.cycles[0]!], ['a', 'b']);
  assert.deepEqual([...r.cycles[1]!], ['m', 'n']);
});

test('detectCycles: 4-node cycle', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('c', 'd'), e('d', 'a')]);
  const r = detectCycles(a);
  assert.equal(r.count, 1);
  assert.deepEqual([...r.cycles[0]!], ['a', 'b', 'c', 'd']);
});

test('detectCycles: isolated node plus cycle — isolated not in cycles', () => {
  const nodes = [n('a'), n('b'), n('c'), n('iso')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('c', 'a')]);
  const r = detectCycles(a);
  assert.equal(r.count, 1);
  const members = r.cycles[0]!;
  assert.ok(!members.includes('iso'));
});

test('detectCycles: chain with tail has no cycle', () => {
  // a->b->c; nothing loops back
  const nodes = [n('a'), n('b'), n('c')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c')]);
  const r = detectCycles(a);
  assert.equal(r.count, 0);
});

test('detectCycles: two 2-cycles plus DAG portion — 2 cycles detected', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d'), n('e')];
  // a->b->a cycle; c->d->c cycle; e is a DAG leaf
  const a = adj(nodes, [e('a', 'b'), e('b', 'a'), e('c', 'd'), e('d', 'c'), e('e', 'c')]);
  const r = detectCycles(a);
  assert.equal(r.count, 2);
});

test('detectCycles: count matches cycles.length', () => {
  const nodes = [n('a'), n('b'), n('c')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('c', 'a')]);
  const r = detectCycles(a);
  assert.equal(r.count, r.cycles.length);
});

test('detectCycles: self-loop alongside regular node — only self-loop is a cycle', () => {
  const nodes = [n('a'), n('b'), n('c')];
  const a = adj(nodes, [e('a', 'a'), e('a', 'b'), e('b', 'c')]);
  const r = detectCycles(a);
  assert.equal(r.count, 1);
  assert.deepEqual([...r.cycles[0]!], ['a']);
});

// ═══════════════════════════════════════════════════════════════════════════════
// findSpofs — 15+ tests
// ═══════════════════════════════════════════════════════════════════════════════

test('findSpofs: empty graph — no spofs', () => {
  const a = buildAdjacency([], []);
  const r = findSpofs(a);
  assert.equal(r.count, 0);
  assert.deepEqual([...r.spofs], []);
});

test('findSpofs: single node — no spofs', () => {
  const nodes = [n('a')];
  const a = adj(nodes, []);
  const r = findSpofs(a);
  assert.equal(r.count, 0);
});

test('findSpofs: chain a->b->c — b is the SPOF', () => {
  const nodes = [n('a'), n('b'), n('c')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c')]);
  const r = findSpofs(a);
  assert.equal(r.count, 1);
  assert.equal(r.spofs[0]!.id, 'b');
  assert.equal(r.spofs[0]!.splitComponents, 2);
});

test('findSpofs: star center with 3 leaves — center is SPOF, splitComponents=3', () => {
  // a -> b, a -> c, a -> d
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const a = adj(nodes, [e('a', 'b'), e('a', 'c'), e('a', 'd')]);
  const r = findSpofs(a);
  assert.equal(r.count, 1);
  assert.equal(r.spofs[0]!.id, 'a');
  assert.equal(r.spofs[0]!.splitComponents, 3);
});

test('findSpofs: pure 3-cycle — no SPOFs (removal keeps remaining 2 still connected)', () => {
  const nodes = [n('a'), n('b'), n('c')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('c', 'a')]);
  const r = findSpofs(a);
  assert.equal(r.count, 0);
});

test('findSpofs: pure 4-cycle — no SPOFs', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('c', 'd'), e('d', 'a')]);
  const r = findSpofs(a);
  assert.equal(r.count, 0);
});

test('findSpofs: two isolated nodes — no SPOFs', () => {
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, []);
  const r = findSpofs(a);
  assert.equal(r.count, 0);
});

test('findSpofs: two components each internally connected, no cross-bridge', () => {
  // Component 1: a-b-c triangle; Component 2: x-y-z triangle
  const nodes = [n('a'), n('b'), n('c'), n('x'), n('y'), n('z')];
  const a = adj(nodes, [
    e('a', 'b'), e('b', 'c'), e('c', 'a'),
    e('x', 'y'), e('y', 'z'), e('z', 'x'),
  ]);
  const r = findSpofs(a);
  assert.equal(r.count, 0);
});

test('findSpofs: bridge node between two triangles is exactly the SPOF', () => {
  // Triangle 1: a-b-c cycle; bridge node m; Triangle 2: x-y-z cycle; m bridges: c->m->x
  const nodes = [n('a'), n('b'), n('c'), n('m'), n('x'), n('y'), n('z')];
  const a = adj(nodes, [
    e('a', 'b'), e('b', 'c'), e('c', 'a'), // triangle 1
    e('c', 'm'), e('m', 'x'),               // bridge via m
    e('x', 'y'), e('y', 'z'), e('z', 'x'), // triangle 2
  ]);
  const r = findSpofs(a);
  const ids = r.spofs.map((s) => s.id);
  assert.ok(ids.includes('m'), 'bridge node m is a SPOF');
});

test('findSpofs: linear chain length 4 — two internal nodes are SPOFs', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('c', 'd')]);
  const r = findSpofs(a);
  const ids = r.spofs.map((s) => s.id);
  assert.ok(ids.includes('b'), 'b is a SPOF in chain');
  assert.ok(ids.includes('c'), 'c is a SPOF in chain');
});

test('findSpofs: star with 4 leaves — splitComponents = 4', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d'), n('e')];
  const a = adj(nodes, [e('a', 'b'), e('a', 'c'), e('a', 'd'), e('a', 'e')]);
  const r = findSpofs(a);
  assert.equal(r.count, 1);
  assert.equal(r.spofs[0]!.id, 'a');
  assert.equal(r.spofs[0]!.splitComponents, 4);
});

test('findSpofs: count matches spofs.length', () => {
  const nodes = [n('a'), n('b'), n('c')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c')]);
  const r = findSpofs(a);
  assert.equal(r.count, r.spofs.length);
});

test('findSpofs: completely connected clique — no SPOFs (K3)', () => {
  const nodes = [n('a'), n('b'), n('c')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'a'), e('a', 'c'), e('c', 'a'), e('b', 'c'), e('c', 'b')]);
  const r = findSpofs(a);
  assert.equal(r.count, 0);
});

test('findSpofs: two-node graph with single directed edge — one direction only', () => {
  // a->b undirected: a-b. Removing either leaves isolated node. Both have parent-1child structure.
  // Actually a is root (DFS from a first in sorted order), b is child. b has no further children.
  // rootChildren = 1 so a is NOT a SPOF. b is leaf, NOT a SPOF.
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, [e('a', 'b')]);
  const r = findSpofs(a);
  // Two-node path: removing b leaves just a (not a split); removing a leaves just b (not a split)
  // So no articulation points
  assert.equal(r.count, 0);
});

test('findSpofs: spofs sorted by splitComponents desc then id asc', () => {
  // Star center (a->b, a->c, a->d: splitComponents=3) and chain bridge (x->y->z: splitComponents=2)
  const nodes = [n('a'), n('b'), n('c'), n('d'), n('x'), n('y'), n('z')];
  const a = adj(nodes, [
    e('a', 'b'), e('a', 'c'), e('a', 'd'), // star, center a
    e('x', 'y'), e('y', 'z'),              // chain, bridge y
  ]);
  const r = findSpofs(a);
  assert.ok(r.spofs.length >= 2);
  assert.ok(r.spofs[0]!.splitComponents >= r.spofs[1]!.splitComponents);
});

// ═══════════════════════════════════════════════════════════════════════════════
// fanReport — 12+ tests
// ═══════════════════════════════════════════════════════════════════════════════

test('fanReport: empty graph — top is empty', () => {
  const a = buildAdjacency([], []);
  const r = fanReport(a, 20);
  assert.deepEqual([...r.top], []);
});

test('fanReport: isolated nodes have fanIn=0 and fanOut=0', () => {
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, []);
  const r = fanReport(a, 20);
  for (const entry of r.top) {
    assert.equal(entry.fanIn, 0);
    assert.equal(entry.fanOut, 0);
  }
});

test('fanReport: exact fanIn counts', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const a = adj(nodes, [e('b', 'a'), e('c', 'a'), e('d', 'a')]);
  const r = fanReport(a, 20);
  const entry = r.top.find((e) => e.id === 'a')!;
  assert.equal(entry.fanIn, 3);
});

test('fanReport: exact fanOut counts', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const a = adj(nodes, [e('a', 'b'), e('a', 'c'), e('a', 'd')]);
  const r = fanReport(a, 20);
  const entry = r.top.find((e) => e.id === 'a')!;
  assert.equal(entry.fanOut, 3);
});

test('fanReport: ranking by fanIn desc', () => {
  const nodes = [n('a'), n('b'), n('c'), n('hub')];
  const a = adj(nodes, [e('a', 'hub'), e('b', 'hub'), e('c', 'hub')]);
  const r = fanReport(a, 20);
  assert.equal(r.top[0]!.id, 'hub');
  assert.equal(r.top[0]!.fanIn, 3);
});

test('fanReport: top param truncates', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d'), n('e')];
  const a = adj(nodes, []);
  const r = fanReport(a, 3);
  assert.equal(r.top.length, 3);
});

test('fanReport: top=0 returns empty', () => {
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, [e('a', 'b')]);
  const r = fanReport(a, 0);
  assert.deepEqual([...r.top], []);
});

test('fanReport: tie on fanIn — ranked by fanOut desc', () => {
  // Both a and b have fanIn=1; a has fanOut=2, b has fanOut=1 => a first
  const nodes = [n('a'), n('b'), n('c'), n('x'), n('y'), n('z')];
  const a = adj(nodes, [
    e('c', 'a'), e('c', 'b'), // both get fanIn=1
    e('a', 'x'), e('a', 'y'), // a fanOut=2
    e('b', 'z'),               // b fanOut=1
  ]);
  const r = fanReport(a, 6);
  const aEntry = r.top.find((e) => e.id === 'a')!;
  const bEntry = r.top.find((e) => e.id === 'b')!;
  assert.ok(r.top.indexOf(aEntry) < r.top.indexOf(bEntry));
});

test('fanReport: tie on fanIn and fanOut — sorted by id asc', () => {
  // a and b both fanIn=1, fanOut=1 => sorted by id: a before b
  const nodes = [n('a'), n('b'), n('c'), n('x'), n('y')];
  const a = adj(nodes, [
    e('c', 'a'), e('c', 'b'),
    e('a', 'x'), e('b', 'y'),
  ]);
  const r = fanReport(a, 6);
  const aEntry = r.top.find((e) => e.id === 'a')!;
  const bEntry = r.top.find((e) => e.id === 'b')!;
  assert.ok(r.top.indexOf(aEntry) < r.top.indexOf(bEntry));
});

test('fanReport: top defaults cover all nodes when top >= node count', () => {
  const nodes = [n('a'), n('b'), n('c')];
  const a = adj(nodes, [e('a', 'b')]);
  const r = fanReport(a, 100);
  assert.equal(r.top.length, 3);
});

test('fanReport: single node, no edges', () => {
  const nodes = [n('x')];
  const a = adj(nodes, []);
  const r = fanReport(a, 5);
  assert.equal(r.top.length, 1);
  assert.equal(r.top[0]!.id, 'x');
  assert.equal(r.top[0]!.fanIn, 0);
  assert.equal(r.top[0]!.fanOut, 0);
});

test('fanReport: fan entries cover all nodes (none omitted up to top limit)', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const nodes = ids.map((id) => n(id));
  const a = adj(nodes, []);
  const r = fanReport(a, 4);
  const reportedIds = r.top.map((e) => e.id).sort();
  assert.deepEqual(reportedIds, ids);
});

// ═══════════════════════════════════════════════════════════════════════════════
// impactRadius — 18+ tests
// ═══════════════════════════════════════════════════════════════════════════════

test('impactRadius: unknown root — empty result', () => {
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, [e('a', 'b')]);
  const nb = byId(nodes);
  const r = impactRadius(a, nb, 'zzz', 2);
  assert.equal(r.totalReached, 0);
  assert.deepEqual([...r.rings], []);
});

test('impactRadius: depth 0 — empty rings', () => {
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, [e('a', 'b')]);
  const nb = byId(nodes);
  const r = impactRadius(a, nb, 'a', 0);
  assert.equal(r.totalReached, 0);
  assert.deepEqual([...r.rings], []);
  assert.equal(r.depth, 0);
});

test('impactRadius: depth 1, direct out-neighbor in ring 1', () => {
  const nodes = [n('a'), n('b'), n('c')];
  const a = adj(nodes, [e('a', 'b'), e('a', 'c')]);
  const nb = byId(nodes);
  const r = impactRadius(a, nb, 'a', 1);
  assert.equal(r.rings.length, 1);
  assert.deepEqual([...r.rings[0]!], ['b', 'c']);
  assert.equal(r.totalReached, 2);
});

test('impactRadius: depth 1 includes in-neighbors (undirected BFS)', () => {
  // x->a, a->y. Root=a, depth=1. Ring 1 should include both x (in) and y (out).
  const nodes = [n('a'), n('x'), n('y')];
  const a = adj(nodes, [e('x', 'a'), e('a', 'y')]);
  const nb = byId(nodes);
  const r = impactRadius(a, nb, 'a', 1);
  assert.equal(r.rings.length, 1);
  assert.deepEqual([...r.rings[0]!], ['x', 'y']);
  assert.equal(r.totalReached, 2);
});

test('impactRadius: depth 2 expands rings correctly', () => {
  // a->b->c->d. Root=a, depth=2. Ring1=[b], Ring2=[c]
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('c', 'd')]);
  const nb = byId(nodes);
  const r = impactRadius(a, nb, 'a', 2);
  assert.equal(r.rings.length, 2);
  assert.deepEqual([...r.rings[0]!], ['b']);
  assert.deepEqual([...r.rings[1]!], ['c']);
  assert.equal(r.totalReached, 2);
});

test('impactRadius: no revisits in rings', () => {
  // a->b, b->c, a->c. Root=a depth=3. Ring1=[b,c]. Ring2 from b/c expands but c already visited.
  const nodes = [n('a'), n('b'), n('c')];
  const a = adj(nodes, [e('a', 'b'), e('a', 'c'), e('b', 'c')]);
  const nb = byId(nodes);
  const r = impactRadius(a, nb, 'a', 3);
  // c is reached in ring 1 via a->c; should not re-appear in ring 2
  const allReached = r.rings.flat();
  const unique = new Set(allReached);
  assert.equal(allReached.length, unique.size);
});

test('impactRadius: rings are sorted asc', () => {
  const nodes = [n('a'), n('c'), n('b')];
  const a = adj(nodes, [e('a', 'c'), e('a', 'b')]);
  const nb = byId(nodes);
  const r = impactRadius(a, nb, 'a', 1);
  const ring = [...r.rings[0]!];
  assert.deepEqual(ring, [...ring].sort());
});

test('impactRadius: totalReached sum matches ring lengths', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('c', 'd')]);
  const nb = byId(nodes);
  const r = impactRadius(a, nb, 'a', 3);
  const sumRings = r.rings.reduce((s, ring) => s + ring.length, 0);
  assert.equal(r.totalReached, sumRings);
});

test('impactRadius: byLayer counts match layer of reached nodes', () => {
  const nodes = [
    n('a', 'api'),
    n('b', 'database'),
    n('c', 'database'),
    n('d', 'rpc'),
  ];
  const a = adj(nodes, [e('a', 'b'), e('a', 'c'), e('a', 'd')]);
  const nb = byId(nodes);
  const r = impactRadius(a, nb, 'a', 1);
  assert.equal(r.byLayer['database'], 2);
  assert.equal(r.byLayer['rpc'], 1);
});

test('impactRadius: depth exceeds reachable — stops early', () => {
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, [e('a', 'b')]);
  const nb = byId(nodes);
  const r = impactRadius(a, nb, 'a', 10);
  assert.equal(r.rings.length, 1); // only b reachable
  assert.equal(r.totalReached, 1);
});

test('impactRadius: isolated root — empty rings', () => {
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, []); // no edges
  const nb = byId(nodes);
  const r = impactRadius(a, nb, 'a', 3);
  assert.deepEqual([...r.rings], []);
  assert.equal(r.totalReached, 0);
});

test('impactRadius: root field matches requested root', () => {
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, [e('a', 'b')]);
  const nb = byId(nodes);
  const r = impactRadius(a, nb, 'a', 1);
  assert.equal(r.root, 'a');
});

test('impactRadius: depth field reflects requested depth', () => {
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, [e('a', 'b')]);
  const nb = byId(nodes);
  const r = impactRadius(a, nb, 'a', 5);
  assert.equal(r.depth, 5);
});

test('impactRadius: bidirectional edge — both directions in ring 1', () => {
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'a')]);
  const nb = byId(nodes);
  const r = impactRadius(a, nb, 'a', 1);
  assert.deepEqual([...r.rings[0]!], ['b']);
  assert.equal(r.totalReached, 1);
});

test('impactRadius: deterministic on repeat call', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const a = adj(nodes, [e('a', 'b'), e('a', 'c'), e('b', 'd'), e('c', 'd')]);
  const nb = byId(nodes);
  const r1 = impactRadius(a, nb, 'a', 3);
  const r2 = impactRadius(a, nb, 'a', 3);
  assert.deepEqual(r1, r2);
});

test('impactRadius: nodesById missing entry defaults layer to unknown in byLayer', () => {
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, [e('a', 'b')]);
  // empty nodesById — b won't be found
  const emptyMap: ReadonlyMap<string, TwinNode> = new Map();
  const r = impactRadius(a, emptyMap, 'a', 1);
  assert.equal(r.byLayer['unknown'], 1);
});

test('impactRadius: depth 3 full traversal of 4-chain', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('c', 'd')]);
  const nb = byId(nodes);
  const r = impactRadius(a, nb, 'a', 3);
  assert.equal(r.rings.length, 3);
  assert.deepEqual([...r.rings[0]!], ['b']);
  assert.deepEqual([...r.rings[1]!], ['c']);
  assert.deepEqual([...r.rings[2]!], ['d']);
  assert.equal(r.totalReached, 3);
});

test('impactRadius: negative depth treated as depth 0 — empty', () => {
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, [e('a', 'b')]);
  const nb = byId(nodes);
  const r = impactRadius(a, nb, 'a', -1);
  assert.deepEqual([...r.rings], []);
  assert.equal(r.totalReached, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// criticalPath — 12+ tests
// ═══════════════════════════════════════════════════════════════════════════════

test('criticalPath: empty graph — empty path, length 0', () => {
  const a = buildAdjacency([], []);
  const r = criticalPath(a);
  assert.equal(r.length, 0);
  assert.deepEqual([...r.path], []);
});

test('criticalPath: single node no edges — path=[node], length=0', () => {
  const nodes = [n('a')];
  const a = adj(nodes, []);
  const r = criticalPath(a);
  assert.deepEqual([...r.path], ['a']);
  assert.equal(r.length, 0);
});

test('criticalPath: linear chain a->b->c->d — path=[a,b,c,d], length=3', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('c', 'd')]);
  const r = criticalPath(a);
  assert.deepEqual([...r.path], ['a', 'b', 'c', 'd']);
  assert.equal(r.length, 3);
});

test('criticalPath: diamond a->[b,c]->d — length=2, deterministic branch', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const a = adj(nodes, [e('a', 'b'), e('a', 'c'), e('b', 'd'), e('c', 'd')]);
  const r = criticalPath(a);
  assert.equal(r.length, 2);
  // deterministic: among equal-length paths, ties broken by sorted neighbor order
  // b < c, so b-branch chosen: a->b->d
  assert.deepEqual([...r.path], ['a', 'b', 'd']);
});

test('criticalPath: cycle a->b->a with tail b->c — cycle condensed, path has length >= 1', () => {
  // After condensation: {a,b} -> c. Condensed path = rep(a)->c = [a, c], length 1.
  const nodes = [n('a'), n('b'), n('c')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'a'), e('b', 'c')]);
  const r = criticalPath(a);
  // rep of cycle is 'a' (sorted first). DAG: a->c. Length=1, path=['a','c']
  assert.equal(r.length, 1);
  assert.deepEqual([...r.path], ['a', 'c']);
});

test('criticalPath: two disjoint chains — longer one chosen', () => {
  // Chain 1: a->b->c (length 2); Chain 2: x->y (length 1)
  const nodes = [n('a'), n('b'), n('c'), n('x'), n('y')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('x', 'y')]);
  const r = criticalPath(a);
  assert.equal(r.length, 2);
  assert.deepEqual([...r.path], ['a', 'b', 'c']);
});

test('criticalPath: deterministic — two runs produce identical result', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d')];
  const a = adj(nodes, [e('a', 'b'), e('a', 'c'), e('b', 'd'), e('c', 'd')]);
  const r1 = criticalPath(a);
  const r2 = criticalPath(a);
  assert.deepEqual(r1, r2);
});

test('criticalPath: length = path.length - 1', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d'), n('e')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('c', 'd'), e('d', 'e')]);
  const r = criticalPath(a);
  assert.equal(r.length, r.path.length - 1);
});

test('criticalPath: two equal-length chains — picks start node by sorted id', () => {
  // Chain 1: a->b->c (length 2); Chain 2: x->y->z (length 2). a < x so a-chain chosen.
  const nodes = [n('a'), n('b'), n('c'), n('x'), n('y'), n('z')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('x', 'y'), e('y', 'z')]);
  const r = criticalPath(a);
  assert.equal(r.length, 2);
  assert.deepEqual([...r.path], ['a', 'b', 'c']);
});

test('criticalPath: complete cycle — length 0 (condensed to single node)', () => {
  // a->b->c->a: one SCC condensed to 'a'. No other nodes. DAG is single node 'a', length 0.
  const nodes = [n('a'), n('b'), n('c')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('c', 'a')]);
  const r = criticalPath(a);
  assert.equal(r.length, 0);
  assert.deepEqual([...r.path], ['a']);
});

test('criticalPath: chain length 5', () => {
  const nodes = [n('a'), n('b'), n('c'), n('d'), n('e'), n('f')];
  const a = adj(nodes, [e('a', 'b'), e('b', 'c'), e('c', 'd'), e('d', 'e'), e('e', 'f')]);
  const r = criticalPath(a);
  assert.equal(r.length, 5);
  assert.deepEqual([...r.path], ['a', 'b', 'c', 'd', 'e', 'f']);
});

test('criticalPath: single edge — path=[a,b], length=1', () => {
  const nodes = [n('a'), n('b')];
  const a = adj(nodes, [e('a', 'b')]);
  const r = criticalPath(a);
  assert.deepEqual([...r.path], ['a', 'b']);
  assert.equal(r.length, 1);
});

test('criticalPath: path through DAG with multiple sources — longest from any source', () => {
  // Two sources: a->c->e and b->d->e->f. Longest = b->d->e->f (length 3).
  const nodes = [n('a'), n('b'), n('c'), n('d'), n('e'), n('f')];
  const a = adj(nodes, [e('a', 'c'), e('c', 'e'), e('b', 'd'), e('d', 'e'), e('e', 'f')]);
  const r = criticalPath(a);
  assert.equal(r.length, 3);
  // b < a in sort, but b->d->e->f is length 3, a->c->e->f is also length 3
  // tie on dist: among sorted start nodes, first one with max dist wins
  // a and b both might have dist=3; a < b alphabetically so 'a' wins
  // path: a->c->e->f
  assert.deepEqual([...r.path], ['a', 'c', 'e', 'f']);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Determinism sweep — 3+ tests on a 30-node hardcoded fixture
// ═══════════════════════════════════════════════════════════════════════════════

// Build a 30-node hardcoded fixture (deterministic, not random)
const LARGE_NODES: TwinNode[] = [
  n('n01', 'api', 'commerce'), n('n02', 'rpc', 'commerce'), n('n03', 'table', 'commerce'),
  n('n04', 'worker', 'ops'), n('n05', 'queue', 'ops'), n('n06', 'cron', 'ops'),
  n('n07', 'feature', 'identity'), n('n08', 'page', 'identity'), n('n09', 'api', 'identity'),
  n('n10', 'service', 'payments'), n('n11', 'table', 'payments'), n('n12', 'rpc', 'payments'),
  n('n13', 'trigger', 'payments'), n('n14', 'policy', 'payments'), n('n15', 'domain', 'payments'),
  n('n16', 'symbol', 'shipping'), n('n17', 'owner', 'shipping'), n('n18', 'secret', 'shipping'),
  n('n19', 'infrastructure', 'infra'), n('n20', 'deployment', 'infra'), n('n21', 'documentation', 'infra'),
  n('n22', 'test', 'quality'), n('n23', 'api', 'storefront'), n('n24', 'page', 'storefront'),
  n('n25', 'feature', 'storefront'), n('n26', 'database', 'core'), n('n27', 'storage', 'core'),
  n('n28', 'queue', 'core'), n('n29', 'worker', 'core'), n('n30', 'cron', 'core'),
];

const LARGE_EDGES: TwinEdge[] = [
  // linear chain: n01->n02->n03->n11->n12->n13
  e('n01', 'n02'), e('n02', 'n03'), e('n03', 'n11'), e('n11', 'n12'), e('n12', 'n13'),
  // branch from n01
  e('n01', 'n04'), e('n04', 'n05'), e('n05', 'n06'),
  // feature flow
  e('n07', 'n08'), e('n08', 'n09'), e('n09', 'n10'), e('n10', 'n11'),
  // cycle: n14->n15->n14
  e('n14', 'n15'), e('n15', 'n14'),
  // cross domain
  e('n16', 'n11'), e('n17', 'n16'),
  // secret/infra
  e('n18', 'n19'), e('n19', 'n20'),
  // test/docs
  e('n22', 'n23'), e('n23', 'n24'), e('n24', 'n25'),
  // storage/queue/worker
  e('n26', 'n27'), e('n27', 'n28'), e('n28', 'n29'), e('n29', 'n30'),
  // back-edges to create complexity
  e('n13', 'n26'), e('n20', 'n22'),
  // a self-loop
  e('n21', 'n21'),
];

const LARGE_ADJ = buildAdjacency(LARGE_NODES, LARGE_EDGES);
const LARGE_BYID = byId(LARGE_NODES);

test('determinism sweep: buildAdjacency identical on two calls', () => {
  const a1 = buildAdjacency(LARGE_NODES, LARGE_EDGES);
  const a2 = buildAdjacency(LARGE_NODES, LARGE_EDGES);
  assert.deepEqual([...a1.ids], [...a2.ids]);
  for (const id of a1.ids) {
    assert.deepEqual(a1.out.get(id), a2.out.get(id));
    assert.deepEqual(a1.in.get(id), a2.in.get(id));
  }
});

test('determinism sweep: all algorithms produce identical results on two runs', () => {
  // shortestPath
  const sp1 = shortestPath(LARGE_ADJ, 'n01', 'n13');
  const sp2 = shortestPath(LARGE_ADJ, 'n01', 'n13');
  assert.deepEqual(sp1, sp2);

  // detectCycles
  const dc1 = detectCycles(LARGE_ADJ);
  const dc2 = detectCycles(LARGE_ADJ);
  assert.deepEqual(dc1, dc2);

  // findSpofs
  const fs1 = findSpofs(LARGE_ADJ);
  const fs2 = findSpofs(LARGE_ADJ);
  assert.deepEqual(fs1, fs2);

  // fanReport
  const fr1 = fanReport(LARGE_ADJ, 30);
  const fr2 = fanReport(LARGE_ADJ, 30);
  assert.deepEqual(fr1, fr2);

  // impactRadius
  const ir1 = impactRadius(LARGE_ADJ, LARGE_BYID, 'n01', 4);
  const ir2 = impactRadius(LARGE_ADJ, LARGE_BYID, 'n01', 4);
  assert.deepEqual(ir1, ir2);

  // criticalPath
  const cp1 = criticalPath(LARGE_ADJ);
  const cp2 = criticalPath(LARGE_ADJ);
  assert.deepEqual(cp1, cp2);
});

test('determinism sweep: large fixture structural invariants hold', () => {
  // ids are sorted
  const ids = [...LARGE_ADJ.ids];
  assert.deepEqual(ids, [...ids].sort());

  // out neighbor lists are sorted
  for (const id of ids) {
    const outs = LARGE_ADJ.out.get(id)!;
    assert.deepEqual([...outs], [...outs].sort());
  }

  // in neighbor lists are sorted
  for (const id of ids) {
    const ins = LARGE_ADJ.in.get(id)!;
    assert.deepEqual([...ins], [...ins].sort());
  }

  // detectCycles: n14-n15 cycle and n21 self-loop must be detected
  const dc = detectCycles(LARGE_ADJ);
  const members = dc.cycles.flatMap((c) => [...c]);
  assert.ok(members.includes('n14'), 'n14 in a cycle');
  assert.ok(members.includes('n15'), 'n15 in a cycle');
  assert.ok(members.includes('n21'), 'n21 self-loop cycle');

  // fanReport: n11 has many in-edges, should rank highly
  const fr = fanReport(LARGE_ADJ, 5);
  const topIds = fr.top.map((e) => e.id);
  assert.ok(topIds.includes('n11'), 'n11 (high fanIn) in top 5');

  // criticalPath has length >= 5 (n07->n08->n09->n10->n11->n12->n13->n26 chain)
  const cp = criticalPath(LARGE_ADJ);
  assert.ok(cp.length >= 5, `critical path length ${cp.length} >= 5`);
});

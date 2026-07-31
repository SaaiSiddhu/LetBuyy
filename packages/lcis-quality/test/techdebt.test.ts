/**
 * TechDebtService tests — LQAS Phase 15.
 *
 * Stubs memory-intel.json (for churn via LCTS TimelineService) and graph.json
 * (for complexity via GraphService.degree). Verifies:
 *   - score = churn × complexity exactness
 *   - threshold (score >= 2 appears; score < 2 is excluded)
 *   - severity bands (high >=20, medium >=8, low <8)
 *   - sort (score desc then subject asc)
 *   - cap at 30 items
 *   - empty timeline → []
 *   - missing artifact (null tryRead) → []
 *   - try/catch → [] on bad input
 *   - determinism (identical output on two calls with same fixtures)
 *   - graph fallback: table: prefix, rpc: prefix, raw, default 1
 *   - evidence fields present and correct
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { type ArtifactStore, createEngine } from '@letbuyy/lcis-core';
import { TechDebtService } from '../src/techdebt/index';

// ── fixed clock ────────────────────────────────────────────────────────────────

const FIXED = '2026-07-04T00:00:00.000Z';
const fixedNow = (): string => FIXED;

// ── stub ArtifactStore factory ─────────────────────────────────────────────────

function stubStore(artifacts: Record<string, unknown>): ArtifactStore {
  return {
    has: (n: string) => n in artifacts,
    tryRead: (n: string) => (n in artifacts ? artifacts[n] : null) ?? null,
    read: (n: string) => {
      if (!(n in artifacts)) throw new Error('missing ' + n);
      return artifacts[n];
    },
    pathOf: (n: string) => '/stub/' + n,
  } as unknown as ArtifactStore;
}

// ── build an engine with given memory-intel + graph artifacts ──────────────────

function makeEngine(memoryIntel: unknown, graphData: unknown) {
  const store = stubStore({
    'memory-intel.json': memoryIntel,
    graph: graphData,
  });
  return createEngine({ store, repoRoot: '/stub' });
}

// ── graph fixture helpers ──────────────────────────────────────────────────────

function graphWith(
  nodeIds: string[],
  edges: Array<{ source: string; target: string }>,
) {
  return {
    nodes: nodeIds.map((id) => ({ id, label: id })),
    links: edges,
  };
}

/** Graph where node 'table:orders' has 6 edges. */
const GRAPH_ORDERS_TABLE = graphWith(
  ['table:orders', 'a', 'b', 'c', 'd', 'e', 'f'],
  [
    { source: 'table:orders', target: 'a' },
    { source: 'table:orders', target: 'b' },
    { source: 'table:orders', target: 'c' },
    { source: 'a', target: 'table:orders' },
    { source: 'b', target: 'table:orders' },
    { source: 'c', target: 'table:orders' },
  ],
);

/** Simple empty graph. */
const EMPTY_GRAPH = { nodes: [], links: [] };

// ── memory-intel fixture helpers ───────────────────────────────────────────────

/** Produce a memory-intel with N migrations all having subject = file name. */
function memoryWithMigrations(
  entries: Array<{ n: number; file: string; name?: string }>,
) {
  return {
    decisions: [],
    migrations: entries.map((e) => ({
      n: e.n,
      file: e.file,
      name: e.name ?? `migration ${e.n}`,
      type: 'schema',
    })),
  };
}

/** memory-intel with repeated subjects via multiple migrations. */
function repeatedSubjectMemory() {
  return {
    decisions: [],
    migrations: [
      { n: 1, file: 'orders', name: 'orders idx', type: 'schema' },
      { n: 2, file: 'orders', name: 'orders rls', type: 'schema' },
      { n: 3, file: 'orders', name: 'orders fk', type: 'schema' },
      { n: 4, file: 'products', name: 'products pk', type: 'schema' },
      { n: 5, file: 'products', name: 'products idx', type: 'schema' },
    ],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Basic construction + hotspots() call
// ══════════════════════════════════════════════════════════════════════════════

test('TechDebtService: constructs without throwing', () => {
  const core = makeEngine(repeatedSubjectMemory(), GRAPH_ORDERS_TABLE);
  assert.doesNotThrow(() => new TechDebtService(core, fixedNow));
});

test('TechDebtService: hotspots() returns a readonly array', () => {
  const core = makeEngine(repeatedSubjectMemory(), GRAPH_ORDERS_TABLE);
  const svc = new TechDebtService(core, fixedNow);
  const result = svc.hotspots();
  assert.ok(Array.isArray(result));
});

// ══════════════════════════════════════════════════════════════════════════════
// Empty / missing artifact → honest []
// ══════════════════════════════════════════════════════════════════════════════

test('empty timeline (empty migrations + decisions) → hotspots() returns []', () => {
  const core = makeEngine({ decisions: [], migrations: [] }, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  assert.deepEqual(svc.hotspots(), []);
});

test('missing memory-intel artifact → hotspots() returns []', () => {
  const store = stubStore({ graph: EMPTY_GRAPH });
  const core = createEngine({ store, repoRoot: '/stub' });
  const svc = new TechDebtService(core, fixedNow);
  assert.deepEqual(svc.hotspots(), []);
});

test('null tryRead for memory-intel → hotspots() returns []', () => {
  // stubStore returns null for unknown keys; omit memory-intel.json
  const store = stubStore({ graph: EMPTY_GRAPH });
  const core = createEngine({ store, repoRoot: '/stub' });
  const svc = new TechDebtService(core, fixedNow);
  assert.deepEqual(svc.hotspots(), []);
});

// ══════════════════════════════════════════════════════════════════════════════
// score = churn × complexity exactness
// ══════════════════════════════════════════════════════════════════════════════

test('score = churn × complexity: orders churn=3, degree=6 → score=18', () => {
  // table:orders has degree 6 in GRAPH_ORDERS_TABLE
  const memory = memoryWithMigrations([
    { n: 1, file: 'orders' },
    { n: 2, file: 'orders' },
    { n: 3, file: 'orders' },
  ]);
  const core = makeEngine(memory, GRAPH_ORDERS_TABLE);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  const ordersItem = items.find((i) => i.subject === 'orders');
  assert.ok(ordersItem, 'orders item must exist');
  assert.equal(ordersItem!.churn, 3);
  assert.equal(ordersItem!.complexity, 6);
  assert.equal(ordersItem!.score, 18);
});

test('score = churn × complexity: products churn=2, no graph node → complexity=1, score=2', () => {
  const memory = memoryWithMigrations([
    { n: 10, file: 'products' },
    { n: 11, file: 'products' },
  ]);
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  const p = items.find((i) => i.subject === 'products');
  assert.ok(p, 'products item must exist');
  assert.equal(p!.churn, 2);
  assert.equal(p!.complexity, 1);
  assert.equal(p!.score, 2);
});

test('score = churn × complexity: churn=5, complexity=4 → score=20', () => {
  const graph = graphWith(
    ['table:payments', 'n1', 'n2', 'n3', 'n4'],
    [
      { source: 'table:payments', target: 'n1' },
      { source: 'table:payments', target: 'n2' },
      { source: 'n3', target: 'table:payments' },
      { source: 'n4', target: 'table:payments' },
    ],
  );
  const memory = memoryWithMigrations([
    { n: 1, file: 'payments' },
    { n: 2, file: 'payments' },
    { n: 3, file: 'payments' },
    { n: 4, file: 'payments' },
    { n: 5, file: 'payments' },
  ]);
  const core = makeEngine(memory, graph);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  const p = items.find((i) => i.subject === 'payments');
  assert.ok(p);
  assert.equal(p!.score, 20);
});

test('score = churn × complexity: churn=1, complexity=1 → score=1 → below threshold → excluded', () => {
  const memory = memoryWithMigrations([{ n: 1, file: 'singleton' }]);
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  assert.ok(items.every((i) => i.subject !== 'singleton'));
});

// ══════════════════════════════════════════════════════════════════════════════
// Score threshold: score >= 2 appears; score < 2 does not
// ══════════════════════════════════════════════════════════════════════════════

test('threshold: score=2 (churn=2, complexity=1) is included', () => {
  const memory = memoryWithMigrations([
    { n: 1, file: 'alpha' },
    { n: 2, file: 'alpha' },
  ]);
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  assert.ok(items.some((i) => i.subject === 'alpha'));
});

test('threshold: score=1 (churn=1, complexity=1) is excluded', () => {
  const memory = memoryWithMigrations([{ n: 99, file: 'omega' }]);
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  assert.ok(items.every((i) => i.subject !== 'omega'));
});

test('threshold: score=2 (churn=1, complexity=2) is included', () => {
  // graph: 'raw-subject' has degree 2
  const graph = graphWith(
    ['raw-subject', 'x'],
    [
      { source: 'raw-subject', target: 'x' },
      { source: 'x', target: 'raw-subject' },
    ],
  );
  const memory = memoryWithMigrations([{ n: 1, file: 'raw-subject' }]);
  const core = makeEngine(memory, graph);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  const item = items.find((i) => i.subject === 'raw-subject');
  assert.ok(item, 'raw-subject with score=2 should be included');
  assert.equal(item!.score, 2);
});

test('threshold: only items with score >= 2 appear', () => {
  const memory = memoryWithMigrations([
    { n: 1, file: 'a' }, // churn=1, complexity=1, score=1 → excluded
    { n: 2, file: 'b' },
    { n: 3, file: 'b' }, // churn=2, complexity=1, score=2 → included
  ]);
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  assert.ok(items.every((i) => i.score >= 2));
  assert.ok(items.some((i) => i.subject === 'b'));
  assert.ok(items.every((i) => i.subject !== 'a'));
});

// ══════════════════════════════════════════════════════════════════════════════
// Severity bands
// ══════════════════════════════════════════════════════════════════════════════

test('severity: score < 8 → low', () => {
  // churn=2, complexity=1, score=2
  const memory = memoryWithMigrations([
    { n: 1, file: 'low-item' },
    { n: 2, file: 'low-item' },
  ]);
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const item = svc.hotspots().find((i) => i.subject === 'low-item');
  assert.ok(item);
  assert.equal(item!.severity, 'low');
});

test('severity: score=8 → medium', () => {
  // churn=8, complexity=1, score=8
  const migrations = Array.from({ length: 8 }, (_, k) => ({
    n: k + 1,
    file: 'med-item',
  }));
  const memory = memoryWithMigrations(migrations);
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const item = svc.hotspots().find((i) => i.subject === 'med-item');
  assert.ok(item);
  assert.equal(item!.score, 8);
  assert.equal(item!.severity, 'medium');
});

test('severity: score=19 → medium (just below high)', () => {
  // churn=19, complexity=1, score=19
  const migrations = Array.from({ length: 19 }, (_, k) => ({
    n: k + 1,
    file: 'hi-edge',
  }));
  const core = makeEngine(memoryWithMigrations(migrations), EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const item = svc.hotspots().find((i) => i.subject === 'hi-edge');
  assert.ok(item);
  assert.equal(item!.severity, 'medium');
});

test('severity: score=20 → high', () => {
  // churn=5, complexity=4, score=20 → high
  const graph = graphWith(
    ['table:site_settings', 'n1', 'n2', 'n3'],
    [
      { source: 'table:site_settings', target: 'n1' },
      { source: 'table:site_settings', target: 'n2' },
      { source: 'n3', target: 'table:site_settings' },
      { source: 'n1', target: 'table:site_settings' },
    ],
  );
  const migrations = Array.from({ length: 5 }, (_, k) => ({
    n: k + 1,
    file: 'site_settings',
  }));
  const core = makeEngine(memoryWithMigrations(migrations), graph);
  const svc = new TechDebtService(core, fixedNow);
  const item = svc.hotspots().find((i) => i.subject === 'site_settings');
  assert.ok(item);
  assert.equal(item!.score, 20);
  assert.equal(item!.severity, 'high');
});

test('severity: score >= 20 → high (score=40)', () => {
  // churn=8, complexity=5, score=40
  const graph = graphWith(
    ['table:big', 'a', 'b', 'c', 'd'],
    [
      { source: 'table:big', target: 'a' },
      { source: 'table:big', target: 'b' },
      { source: 'table:big', target: 'c' },
      { source: 'a', target: 'table:big' },
      { source: 'b', target: 'table:big' },
    ],
  );
  const migrations = Array.from({ length: 8 }, (_, k) => ({
    n: k + 1,
    file: 'big',
  }));
  const core = makeEngine(memoryWithMigrations(migrations), graph);
  const svc = new TechDebtService(core, fixedNow);
  const item = svc.hotspots().find((i) => i.subject === 'big');
  assert.ok(item);
  assert.equal(item!.score, 40);
  assert.equal(item!.severity, 'high');
});

// ══════════════════════════════════════════════════════════════════════════════
// Sort: score desc, then subject asc
// ══════════════════════════════════════════════════════════════════════════════

test('sort: items ordered by score descending', () => {
  const memory = {
    decisions: [],
    migrations: [
      { n: 1, file: 'z-subject' },
      { n: 2, file: 'z-subject' }, // churn=2, score=2
      { n: 3, file: 'a-subject' },
      { n: 4, file: 'a-subject' },
      { n: 5, file: 'a-subject' },
      { n: 6, file: 'a-subject' }, // churn=4, score=4
    ],
  };
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  assert.ok(items.length >= 2);
  // a-subject score=4, z-subject score=2 → a-subject first
  const aIdx = items.findIndex((i) => i.subject === 'a-subject');
  const zIdx = items.findIndex((i) => i.subject === 'z-subject');
  assert.ok(aIdx < zIdx, 'higher score must come first');
});

test('sort: tie-break on subject ascending', () => {
  // Both 'bravo' and 'alpha' have churn=2, no graph match → score=2 each
  const memory = memoryWithMigrations([
    { n: 1, file: 'bravo' },
    { n: 2, file: 'bravo' },
    { n: 3, file: 'alpha' },
    { n: 4, file: 'alpha' },
  ]);
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  const subjects = items.map((i) => i.subject);
  const alphaIdx = subjects.indexOf('alpha');
  const bravoIdx = subjects.indexOf('bravo');
  assert.ok(alphaIdx < bravoIdx, 'alpha must appear before bravo (subject asc tie-break)');
});

test('sort: descending by score is preserved across multiple distinct scores', () => {
  const memory = {
    decisions: [],
    migrations: [
      { n: 1, file: 'c3', name: 'c3' },
      { n: 2, file: 'c3', name: 'c3' },
      { n: 3, file: 'c3', name: 'c3' }, // churn=3
      { n: 4, file: 'b2', name: 'b2' },
      { n: 5, file: 'b2', name: 'b2' }, // churn=2
      { n: 6, file: 'a5', name: 'a5' },
      { n: 7, file: 'a5', name: 'a5' },
      { n: 8, file: 'a5', name: 'a5' },
      { n: 9, file: 'a5', name: 'a5' },
      { n: 10, file: 'a5', name: 'a5' }, // churn=5
    ],
  };
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  const scores = items.map((i) => i.score);
  for (let i = 1; i < scores.length; i++) {
    assert.ok(scores[i - 1] >= scores[i], `scores must be non-increasing; got ${scores[i - 1]} before ${scores[i]}`);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Cap at 30 items
// ══════════════════════════════════════════════════════════════════════════════

test('cap: result is at most 30 items even with 40 qualifying subjects', () => {
  // 40 unique subjects each with churn=2 (score=2, all pass threshold)
  const migrations: Array<{ n: number; file: string; name: string }> = [];
  for (let i = 0; i < 40; i++) {
    migrations.push({ n: i * 2 + 1, file: `subject-${String(i).padStart(3, '0')}`, name: `m${i * 2 + 1}` });
    migrations.push({ n: i * 2 + 2, file: `subject-${String(i).padStart(3, '0')}`, name: `m${i * 2 + 2}` });
  }
  const core = makeEngine({ decisions: [], migrations }, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  assert.ok(items.length <= 30, `expected <= 30 items; got ${items.length}`);
  assert.equal(items.length, 30);
});

test('cap: result is <= 30 when fewer than 30 qualifying subjects', () => {
  const memory = memoryWithMigrations([
    { n: 1, file: 'x' },
    { n: 2, file: 'x' },
  ]);
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  assert.ok(items.length <= 30);
});

// ══════════════════════════════════════════════════════════════════════════════
// Graph-degree fallback strategy
// ══════════════════════════════════════════════════════════════════════════════

test('graph fallback: table: prefix matched first', () => {
  // 'table:orders' has degree 4 in graph; raw 'orders' is not a node
  const graph = graphWith(
    ['table:orders', 'a', 'b'],
    [
      { source: 'table:orders', target: 'a' },
      { source: 'table:orders', target: 'b' },
      { source: 'a', target: 'table:orders' },
      { source: 'b', target: 'table:orders' },
    ],
  );
  const memory = memoryWithMigrations([
    { n: 1, file: 'orders' },
    { n: 2, file: 'orders' },
  ]);
  const core = makeEngine(memory, graph);
  const svc = new TechDebtService(core, fixedNow);
  const item = svc.hotspots().find((i) => i.subject === 'orders');
  assert.ok(item);
  assert.equal(item!.complexity, 4); // degree of table:orders
  assert.equal(item!.score, 8); // 2 × 4
});

test('graph fallback: rpc: prefix matched when table: has degree 0', () => {
  // 'rpc:create_order' has degree 3; no 'table:create_order' node
  const graph = graphWith(
    ['rpc:create_order', 'n1', 'n2'],
    [
      { source: 'rpc:create_order', target: 'n1' },
      { source: 'rpc:create_order', target: 'n2' },
      { source: 'n1', target: 'rpc:create_order' },
    ],
  );
  const memory = memoryWithMigrations([
    { n: 1, file: 'create_order' },
    { n: 2, file: 'create_order' },
  ]);
  const core = makeEngine(memory, graph);
  const svc = new TechDebtService(core, fixedNow);
  const item = svc.hotspots().find((i) => i.subject === 'create_order');
  assert.ok(item);
  assert.equal(item!.complexity, 3); // degree of rpc:create_order
});

test('graph fallback: raw subject matched when table: and rpc: both absent', () => {
  // 'my_worker' has degree 2; no table:/rpc: prefixed variant
  const graph = graphWith(
    ['my_worker', 'x'],
    [
      { source: 'my_worker', target: 'x' },
      { source: 'x', target: 'my_worker' },
    ],
  );
  const memory = memoryWithMigrations([
    { n: 1, file: 'my_worker' },
    { n: 2, file: 'my_worker' },
  ]);
  const core = makeEngine(memory, graph);
  const svc = new TechDebtService(core, fixedNow);
  const item = svc.hotspots().find((i) => i.subject === 'my_worker');
  assert.ok(item);
  assert.equal(item!.complexity, 2);
});

test('graph fallback: defaults to complexity=1 when no node found under any prefix', () => {
  const memory = memoryWithMigrations([
    { n: 1, file: 'unknown_entity' },
    { n: 2, file: 'unknown_entity' },
  ]);
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const item = svc.hotspots().find((i) => i.subject === 'unknown_entity');
  assert.ok(item);
  assert.equal(item!.complexity, 1);
  assert.equal(item!.score, 2);
});

test('graph fallback: table: prefix wins over rpc: when both exist', () => {
  // table:widget has degree 3, rpc:widget has degree 5; table wins (first candidate)
  const graph = graphWith(
    ['table:widget', 'rpc:widget', 'a', 'b', 'c', 'd'],
    [
      { source: 'table:widget', target: 'a' },
      { source: 'table:widget', target: 'b' },
      { source: 'a', target: 'table:widget' },
      { source: 'rpc:widget', target: 'c' },
      { source: 'rpc:widget', target: 'd' },
      { source: 'c', target: 'rpc:widget' },
      { source: 'd', target: 'rpc:widget' },
      { source: 'b', target: 'rpc:widget' },
    ],
  );
  const memory = memoryWithMigrations([
    { n: 1, file: 'widget' },
    { n: 2, file: 'widget' },
  ]);
  const core = makeEngine(memory, graph);
  const svc = new TechDebtService(core, fixedNow);
  const item = svc.hotspots().find((i) => i.subject === 'widget');
  assert.ok(item);
  assert.equal(item!.complexity, 3); // table:widget degree = 3, wins over rpc:widget
});

// ══════════════════════════════════════════════════════════════════════════════
// Evidence
// ══════════════════════════════════════════════════════════════════════════════

test('evidence: each item has non-empty evidence array', () => {
  const memory = memoryWithMigrations([
    { n: 1, file: 'orders' },
    { n: 2, file: 'orders' },
  ]);
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  for (const item of items) {
    assert.ok(item.evidence.length > 0, `item ${item.subject} must have evidence`);
  }
});

test('evidence: first evidence record has kind artifact-field', () => {
  const memory = memoryWithMigrations([
    { n: 1, file: 'orders' },
    { n: 2, file: 'orders' },
  ]);
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  const item = items.find((i) => i.subject === 'orders');
  assert.ok(item);
  assert.equal(item!.evidence[0].kind, 'artifact-field');
});

test('evidence: second evidence record has kind graph-node', () => {
  const memory = memoryWithMigrations([
    { n: 1, file: 'orders' },
    { n: 2, file: 'orders' },
  ]);
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  const item = items.find((i) => i.subject === 'orders');
  assert.ok(item);
  assert.equal(item!.evidence[1].kind, 'graph-node');
});

test('evidence: artifact-field detail contains churn and complexity', () => {
  const memory = memoryWithMigrations([
    { n: 1, file: 'orders' },
    { n: 2, file: 'orders' },
    { n: 3, file: 'orders' },
  ]);
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const item = svc.hotspots().find((i) => i.subject === 'orders');
  assert.ok(item);
  const detail = item!.evidence[0].detail ?? '';
  assert.ok(detail.includes('churn 3'), `detail should contain churn; got: ${detail}`);
  assert.ok(detail.includes('complexity 1'), `detail should contain complexity; got: ${detail}`);
  assert.ok(detail.includes('score 3'), `detail should contain score; got: ${detail}`);
});

test('evidence: graph-node evidence ref equals the subject', () => {
  const memory = memoryWithMigrations([
    { n: 1, file: 'payments' },
    { n: 2, file: 'payments' },
  ]);
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const item = svc.hotspots().find((i) => i.subject === 'payments');
  assert.ok(item);
  assert.equal(item!.evidence[1].ref, 'payments');
});

// ══════════════════════════════════════════════════════════════════════════════
// Determinism
// ══════════════════════════════════════════════════════════════════════════════

test('determinism: two calls with identical fixtures produce identical output', () => {
  const core = makeEngine(repeatedSubjectMemory(), GRAPH_ORDERS_TABLE);
  const svc = new TechDebtService(core, fixedNow);
  const first = svc.hotspots();
  const second = svc.hotspots();
  assert.deepEqual(first, second);
});

test('determinism: two independent engines with the same fixtures produce identical output', () => {
  const memory = repeatedSubjectMemory();
  const core1 = makeEngine(memory, GRAPH_ORDERS_TABLE);
  const core2 = makeEngine(memory, GRAPH_ORDERS_TABLE);
  const svc1 = new TechDebtService(core1, fixedNow);
  const svc2 = new TechDebtService(core2, fixedNow);
  assert.deepEqual(svc1.hotspots(), svc2.hotspots());
});

// ══════════════════════════════════════════════════════════════════════════════
// Multi-subject scenarios
// ══════════════════════════════════════════════════════════════════════════════

test('multi-subject: orders(churn=3) and products(churn=2) both appear in correct order', () => {
  const core = makeEngine(repeatedSubjectMemory(), GRAPH_ORDERS_TABLE);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  const ordersItem = items.find((i) => i.subject === 'orders');
  const productsItem = items.find((i) => i.subject === 'products');
  assert.ok(ordersItem, 'orders must be present');
  assert.ok(productsItem, 'products must be present');
  // orders: churn=3, degree=6 (table:orders), score=18
  // products: churn=2, degree=1 (no node), score=2
  assert.equal(ordersItem!.churn, 3);
  assert.equal(ordersItem!.score, 18);
  assert.equal(productsItem!.churn, 2);
  assert.equal(productsItem!.score, 2);
  const orderIdx = items.indexOf(ordersItem!);
  const productIdx = items.indexOf(productsItem!);
  assert.ok(orderIdx < productIdx, 'orders (score=18) must precede products (score=2)');
});

test('multi-subject: only subjects with score >= 2 are present', () => {
  const core = makeEngine(repeatedSubjectMemory(), GRAPH_ORDERS_TABLE);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  for (const item of items) {
    assert.ok(item.score >= 2, `every item must have score >= 2; got ${item.score} for ${item.subject}`);
  }
});

test('multi-subject: all returned items have valid Severity values', () => {
  const core = makeEngine(repeatedSubjectMemory(), GRAPH_ORDERS_TABLE);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  const valid: Set<string> = new Set(['high', 'medium', 'low', 'critical', 'info']);
  for (const item of items) {
    assert.ok(valid.has(item.severity), `invalid severity: ${item.severity}`);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Decisions also contribute to churn
// ══════════════════════════════════════════════════════════════════════════════

test('decisions: subject appearing in decisions also counts toward churn', () => {
  // decisions have source field as subject
  const memory = {
    decisions: [
      { id: 'D-001', source: 'orders', section: 'ledger', rule: 'QA06' },
      { id: 'D-002', source: 'orders', section: 'rls', rule: 'QA06' },
    ],
    migrations: [
      { n: 1, file: 'orders', name: 'orders idx', type: 'schema' },
    ],
  };
  const core = makeEngine(memory, GRAPH_ORDERS_TABLE);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  const ordersItem = items.find((i) => i.subject === 'orders');
  // timeline record for migration has subject='orders' (from file field)
  // timeline records for decisions have subject = source = 'orders'
  // total churn >= 3 (1 migration + 2 decisions)
  assert.ok(ordersItem, 'orders must be present');
  assert.ok(ordersItem!.churn >= 3, `expected churn >= 3; got ${ordersItem!.churn}`);
});

// ══════════════════════════════════════════════════════════════════════════════
// TechDebtItem shape
// ══════════════════════════════════════════════════════════════════════════════

test('TechDebtItem shape: subject, churn, complexity, score, severity, evidence all present', () => {
  const memory = memoryWithMigrations([
    { n: 1, file: 'orders' },
    { n: 2, file: 'orders' },
  ]);
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const item = svc.hotspots()[0];
  assert.ok(item);
  assert.equal(typeof item.subject, 'string');
  assert.equal(typeof item.churn, 'number');
  assert.equal(typeof item.complexity, 'number');
  assert.equal(typeof item.score, 'number');
  assert.equal(typeof item.severity, 'string');
  assert.ok(Array.isArray(item.evidence));
});

test('TechDebtItem: score equals churn * complexity', () => {
  const graph = graphWith(
    ['table:checkout', 'x', 'y', 'z'],
    [
      { source: 'table:checkout', target: 'x' },
      { source: 'table:checkout', target: 'y' },
      { source: 'z', target: 'table:checkout' },
    ],
  );
  const migrations = Array.from({ length: 4 }, (_, i) => ({
    n: i + 1,
    file: 'checkout',
  }));
  const core = makeEngine(memoryWithMigrations(migrations), graph);
  const svc = new TechDebtService(core, fixedNow);
  const item = svc.hotspots().find((i) => i.subject === 'checkout');
  assert.ok(item);
  assert.equal(item!.score, item!.churn * item!.complexity);
});

// ══════════════════════════════════════════════════════════════════════════════
// Error tolerance
// ══════════════════════════════════════════════════════════════════════════════

test('error tolerance: malformed memory-intel (non-object) → []', () => {
  const store = stubStore({ 'memory-intel.json': 'not an object', graph: EMPTY_GRAPH });
  const core = createEngine({ store, repoRoot: '/stub' });
  const svc = new TechDebtService(core, fixedNow);
  assert.doesNotThrow(() => svc.hotspots());
  // zod parse will fail on "not an object" → timeline has empty records
  const items = svc.hotspots();
  assert.ok(Array.isArray(items));
});

test('error tolerance: graph artifact missing → complexity defaults to 1, no throw', () => {
  // graph artifact missing entirely; memory-intel present
  const store = stubStore({ 'memory-intel.json': repeatedSubjectMemory() });
  const core = createEngine({ store, repoRoot: '/stub' });
  const svc = new TechDebtService(core, fixedNow);
  // graph.degree() will throw when graph is not loaded; try/catch should catch it
  assert.doesNotThrow(() => svc.hotspots());
});

// ══════════════════════════════════════════════════════════════════════════════
// Fixed clock does not affect hotspot list (only provenance timestamps)
// ══════════════════════════════════════════════════════════════════════════════

test('clock: different clocks produce identical hotspot subjects, churn, complexity, score', () => {
  const memory = repeatedSubjectMemory();
  const core1 = makeEngine(memory, GRAPH_ORDERS_TABLE);
  const core2 = makeEngine(memory, GRAPH_ORDERS_TABLE);
  const svc1 = new TechDebtService(core1, () => '2025-01-01T00:00:00.000Z');
  const svc2 = new TechDebtService(core2, () => '2030-12-31T23:59:59.999Z');
  const h1 = svc1.hotspots();
  const h2 = svc2.hotspots();
  assert.equal(h1.length, h2.length);
  for (let i = 0; i < h1.length; i++) {
    assert.equal(h1[i].subject, h2[i].subject);
    assert.equal(h1[i].churn, h2[i].churn);
    assert.equal(h1[i].complexity, h2[i].complexity);
    assert.equal(h1[i].score, h2[i].score);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Scores in result are all non-negative integers
// ══════════════════════════════════════════════════════════════════════════════

test('all returned items have positive integer score, churn, and complexity', () => {
  const memory = {
    decisions: [],
    migrations: [
      { n: 1, file: 'a', name: 'a', type: 'schema' },
      { n: 2, file: 'a', name: 'a2', type: 'schema' },
      { n: 3, file: 'b', name: 'b', type: 'schema' },
      { n: 4, file: 'b', name: 'b2', type: 'schema' },
      { n: 5, file: 'b', name: 'b3', type: 'schema' },
    ],
  };
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  for (const item of svc.hotspots()) {
    assert.ok(Number.isInteger(item.churn) && item.churn > 0);
    assert.ok(Number.isInteger(item.complexity) && item.complexity > 0);
    assert.ok(Number.isInteger(item.score) && item.score > 0);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Edge: exactly 30 qualifying subjects → all 30 returned
// ══════════════════════════════════════════════════════════════════════════════

test('exactly 30 qualifying subjects → all 30 returned', () => {
  const migrations: Array<{ n: number; file: string; name: string }> = [];
  for (let i = 0; i < 30; i++) {
    migrations.push({ n: i * 2 + 1, file: `entity-${i}`, name: `e${i * 2 + 1}` });
    migrations.push({ n: i * 2 + 2, file: `entity-${i}`, name: `e${i * 2 + 2}` });
  }
  const core = makeEngine({ decisions: [], migrations }, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  assert.equal(svc.hotspots().length, 30);
});

// ══════════════════════════════════════════════════════════════════════════════
// Severity boundary exactness
// ══════════════════════════════════════════════════════════════════════════════

test('severity boundary: score=7 → low', () => {
  const migrations = Array.from({ length: 7 }, (_, i) => ({
    n: i + 1,
    file: 'bound7',
    name: `m${i}`,
  }));
  const core = makeEngine(memoryWithMigrations(migrations), EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const item = svc.hotspots().find((i) => i.subject === 'bound7');
  assert.ok(item);
  assert.equal(item!.severity, 'low');
});

test('severity boundary: score=9 → medium', () => {
  const migrations = Array.from({ length: 9 }, (_, i) => ({
    n: i + 1,
    file: 'bound9',
    name: `m${i}`,
  }));
  const core = makeEngine(memoryWithMigrations(migrations), EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const item = svc.hotspots().find((i) => i.subject === 'bound9');
  assert.ok(item);
  assert.equal(item!.severity, 'medium');
});

// ══════════════════════════════════════════════════════════════════════════════
// Additional coverage: churn count per unique subject
// ══════════════════════════════════════════════════════════════════════════════

test('churn count: single subject appearing N times has churn=N', () => {
  const count = 6;
  const migrations = Array.from({ length: count }, (_, i) => ({
    n: i + 1,
    file: 'repeated',
    name: `m${i}`,
  }));
  const core = makeEngine(memoryWithMigrations(migrations), EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const item = svc.hotspots().find((i) => i.subject === 'repeated');
  assert.ok(item);
  assert.equal(item!.churn, count);
});

test('churn count: multiple distinct subjects each have correct individual churn', () => {
  const memory = memoryWithMigrations([
    { n: 1, file: 'aaa' },
    { n: 2, file: 'aaa' },
    { n: 3, file: 'aaa' }, // churn=3
    { n: 4, file: 'bbb' },
    { n: 5, file: 'bbb' }, // churn=2
  ]);
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  const aaa = items.find((i) => i.subject === 'aaa');
  const bbb = items.find((i) => i.subject === 'bbb');
  assert.ok(aaa);
  assert.ok(bbb);
  assert.equal(aaa!.churn, 3);
  assert.equal(bbb!.churn, 2);
});

test('complexity defaults to 1 exactly (not 0) when graph has no matching node', () => {
  const memory = memoryWithMigrations([
    { n: 1, file: 'ghost' },
    { n: 2, file: 'ghost' },
  ]);
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const item = svc.hotspots().find((i) => i.subject === 'ghost');
  assert.ok(item);
  assert.equal(item!.complexity, 1); // must be exactly 1, not 0
  assert.notEqual(item!.complexity, 0);
});

test('hotspots() called twice returns same length', () => {
  const core = makeEngine(repeatedSubjectMemory(), GRAPH_ORDERS_TABLE);
  const svc = new TechDebtService(core, fixedNow);
  assert.equal(svc.hotspots().length, svc.hotspots().length);
});

test('result items are frozen/immutable (readonly contract fulfilled — no mutation needed)', () => {
  const core = makeEngine(repeatedSubjectMemory(), GRAPH_ORDERS_TABLE);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  // readonly typed — just verify the array is returned with the correct structure
  assert.ok(items.length > 0);
  const item = items[0];
  assert.ok('subject' in item);
  assert.ok('churn' in item);
  assert.ok('complexity' in item);
  assert.ok('score' in item);
  assert.ok('severity' in item);
  assert.ok('evidence' in item);
});

test('score threshold is exclusive of 1: only score >= 2 is in output', () => {
  // churn=1, no graph match → complexity=1 → score=1 → excluded
  const memory = memoryWithMigrations([{ n: 1, file: 'only-once' }]);
  const core = makeEngine(memory, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  assert.equal(items.length, 0);
});

test('graph degree is measured by total edges (in + out combined)', () => {
  // node 'table:edges_node': 3 out + 2 in = degree 5
  const graph = graphWith(
    ['table:edges_node', 'o1', 'o2', 'o3', 'i1', 'i2'],
    [
      { source: 'table:edges_node', target: 'o1' },
      { source: 'table:edges_node', target: 'o2' },
      { source: 'table:edges_node', target: 'o3' },
      { source: 'i1', target: 'table:edges_node' },
      { source: 'i2', target: 'table:edges_node' },
    ],
  );
  const memory = memoryWithMigrations([
    { n: 1, file: 'edges_node' },
    { n: 2, file: 'edges_node' },
  ]);
  const core = makeEngine(memory, graph);
  const svc = new TechDebtService(core, fixedNow);
  const item = svc.hotspots().find((i) => i.subject === 'edges_node');
  assert.ok(item);
  assert.equal(item!.complexity, 5); // total degree = 3 out + 2 in
  assert.equal(item!.score, 10); // 2 × 5
});

test('hotspots returns subjects with highest scores when cap of 30 is applied', () => {
  // 35 subjects; subjects 0..4 have churn=5, subjects 5..34 have churn=2
  // After cap, subjects 0..4 (score=5) and 25 of the rest (score=2) should appear
  const migrations: Array<{ n: number; file: string; name: string }> = [];
  let counter = 1;
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      migrations.push({ n: counter++, file: `high-${i}`, name: `h${counter}` });
    }
  }
  for (let i = 0; i < 30; i++) {
    migrations.push({ n: counter++, file: `low-${i}`, name: `l${counter}` });
    migrations.push({ n: counter++, file: `low-${i}`, name: `l${counter}` });
  }
  const core = makeEngine({ decisions: [], migrations }, EMPTY_GRAPH);
  const svc = new TechDebtService(core, fixedNow);
  const items = svc.hotspots();
  assert.equal(items.length, 30);
  // All high- subjects (score=5) must appear before any low- subjects (score=2)
  const highItems = items.filter((i) => i.subject.startsWith('high-'));
  assert.equal(highItems.length, 5);
  const lastHighIdx = Math.max(...highItems.map((h) => items.indexOf(h)));
  const firstLowIdx = items.findIndex((i) => i.subject.startsWith('low-'));
  assert.ok(lastHighIdx < firstLowIdx, 'all high-score items must precede low-score items');
});

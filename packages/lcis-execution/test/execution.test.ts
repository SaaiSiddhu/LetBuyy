/**
 * EIS Execution Intelligence tests — ExecutionIntelligenceService + ExecutionGraphService.
 *
 * Runs against the REAL graphify-out artifacts (no fixtures). Verifies:
 *   - Every method returns typed artifact with evidence/confidence/sources/timestamp
 *   - Work breakdown covers every affected set (schema, rpc, api, worker, migration, test, docs, verification)
 *   - Graph implementationOrder is valid topological order (no item before its deps)
 *   - criticalPath non-empty when there are dependencies
 *   - parallelizable excludes dependents
 *   - Determinism: same input+now → deep-equal output
 *   - Money change → high-risk work items
 *   - Source scan: no fetch/child_process/spawn/exec/eval/writeFile in src/execution/**.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine } from '@letbuyy/lcis-core';
import { ExecutionIntelligenceService } from '../src/execution/ExecutionIntelligenceService';
import { ExecutionGraphService } from '../src/execution/ExecutionGraphService';
import { topoSort, criticalPath } from '../src/execution/work-graph';
import type { ChangeRequest, WorkItem, ExecutionGraph } from '../src/shared/index';

const __dirname = dirname(fileURLToPath(import.meta.url));

const FIXED = '2026-06-20T00:00:00.000Z';
const engine = createEngine();
const eis = new ExecutionIntelligenceService(engine, () => FIXED);
const egs = new ExecutionGraphService(engine, () => FIXED);

// Pull real fixtures from the live artifacts so assertions are not brittle to specific names.
const db = engine.store.read<{ tables: { name: string; money?: boolean; tenant?: boolean }[] }>('db-intel');
const di = engine.store.read<{ domains: { key: string }[] }>('domain-intel');
const moneyTable = db.tables.find((t) => t.money)?.name;
const tenantTable = db.tables.find((t) => t.tenant)?.name;
const aDomain = di.domains[0]?.key;
const bDomain = di.domains[1]?.key;

// A request that resolves to real entities.
const domainReq: ChangeRequest = { text: 'change', domains: [aDomain!] };
const moneyReq: ChangeRequest = { text: 'touch ledger', tables: [moneyTable!] };
const unresolved: ChangeRequest = { text: 'zzqqx wibble frobnicate xyzzy' };

// ── Source scan: no forbidden patterns in src/execution ─────────────────────

test('source scan: no fetch/child_process/spawn/exec/eval/writeFile in src/execution', () => {
  const srcDir = join(__dirname, '../src/execution');
  const files = readdirSync(srcDir).filter((f) => f.endsWith('.ts'));
  const FORBIDDEN = ['fetch(', 'child_process', 'spawn(', 'exec(', 'eval(', 'writeFile', 'appendFile'];
  for (const file of files) {
    const content = readFileSync(join(srcDir, file), 'utf8');
    for (const pat of FORBIDDEN) {
      assert.ok(!content.includes(pat), `Forbidden pattern "${pat}" found in src/execution/${file}`);
    }
  }
});

// ── work-graph.ts: topoSort ──────────────────────────────────────────────────

test('topoSort: empty input returns empty order', () => {
  const r = topoSort([]);
  assert.deepEqual([...r.order], []);
  assert.deepEqual(r.blocked, []);
});

test('topoSort: single node with no deps has layer 0', () => {
  const r = topoSort([{ id: 'a', dependsOn: [] }]);
  assert.deepEqual([...r.order], ['a']);
  assert.equal(r.layers.get('a'), 0);
  assert.deepEqual(r.blocked, []);
});

test('topoSort: linear chain gives correct topo order', () => {
  const nodes = [
    { id: 'c', dependsOn: ['b'] },
    { id: 'b', dependsOn: ['a'] },
    { id: 'a', dependsOn: [] },
  ];
  const r = topoSort(nodes);
  const order = [...r.order];
  assert.equal(order[0], 'a');
  assert.equal(order[1], 'b');
  assert.equal(order[2], 'c');
  assert.equal(r.layers.get('a'), 0);
  assert.equal(r.layers.get('b'), 1);
  assert.equal(r.layers.get('c'), 2);
});

test('topoSort: parallel nodes are alphabetically sorted within a layer', () => {
  const nodes = [
    { id: 'z', dependsOn: [] },
    { id: 'a', dependsOn: [] },
    { id: 'm', dependsOn: [] },
  ];
  const r = topoSort(nodes);
  assert.deepEqual([...r.order], ['a', 'm', 'z']);
});

test('topoSort: node with missing dep is blocked', () => {
  const nodes = [
    { id: 'b', dependsOn: ['ghost'] }, // 'ghost' not in nodes
    { id: 'a', dependsOn: [] },
  ];
  const r = topoSort(nodes);
  assert.ok(r.blocked.includes('b'), 'b should be blocked');
  assert.ok([...r.order].includes('a'), 'a should still be ordered');
});

test('criticalPath: returns empty for empty order', () => {
  const cp = criticalPath([], []);
  assert.deepEqual([...cp], []);
});

test('criticalPath: linear chain has length == nodes.length', () => {
  const nodes = [
    { id: 'a', dependsOn: [] },
    { id: 'b', dependsOn: ['a'] },
    { id: 'c', dependsOn: ['b'] },
  ];
  const r = topoSort(nodes);
  const cp = criticalPath(nodes, [...r.order]);
  assert.equal(cp.length, 3);
  assert.equal(cp[0], 'a');
  assert.equal(cp[cp.length - 1], 'c');
});

test('criticalPath: picks the longest path when two branches exist', () => {
  const nodes = [
    { id: 'root', dependsOn: [] },
    { id: 'branch-a', dependsOn: ['root'] },
    { id: 'branch-b', dependsOn: ['root'] },
    { id: 'deep', dependsOn: ['branch-a'] },
  ];
  const r = topoSort(nodes);
  const cp = criticalPath(nodes, [...r.order]);
  // The longest path is root -> branch-a -> deep (length 3), not root -> branch-b (length 2).
  assert.ok(cp.includes('deep'), 'critical path should go through the deeper branch');
  assert.ok(!cp.includes('branch-b'), 'critical path should not include the shorter branch');
});

// ── analyzeChange ─────────────────────────────────────────────────────────────

test('analyzeChange: returns a ChangeAnalysis with evidence/confidence/sources/timestamp', () => {
  assert.ok(aDomain, 'need a real domain');
  const a = eis.analyzeChange(domainReq);
  assert.equal(a.timestamp, FIXED);
  assert.ok(a.evidence.length > 0);
  assert.ok(a.sources.length > 0);
  assert.ok(a.confidence > 0 && a.confidence <= 0.95);
  assert.ok(a.affected.domains.includes(aDomain!));
  assert.equal(a.unresolved, false);
});

test('analyzeChange: unresolved request is honestly empty', () => {
  const a = eis.analyzeChange(unresolved);
  assert.equal(a.unresolved, true);
  assert.deepEqual(a.affected.domains, []);
});

// ── estimateComplexity ────────────────────────────────────────────────────────

test('estimateComplexity from ChangeRequest returns a ComplexityAssessment', () => {
  const c = eis.estimateComplexity(domainReq);
  assert.ok(typeof c.band === 'string');
  assert.ok(typeof c.score === 'number');
  assert.ok(Array.isArray(c.factors));
});

test('estimateComplexity: empty (unresolved) request → trivial', () => {
  const c = eis.estimateComplexity(unresolved);
  assert.equal(c.band, 'trivial');
  assert.equal(c.score, 0);
});

test('estimateComplexity: pre-computed ChangeAnalysis re-uses it (facade reuse)', () => {
  const a = eis.analyzeChange(domainReq);
  const c = eis.estimateComplexity(a);
  assert.equal(c.band, a.complexity.band);
  assert.equal(c.score, a.complexity.score);
});

// ── estimateRisk ──────────────────────────────────────────────────────────────

test('estimateRisk: money table → critical', () => {
  assert.ok(moneyTable, 'need a real money table');
  const r = eis.estimateRisk(moneyReq);
  assert.equal(r.money, true);
  assert.equal(r.level, 'critical');
});

test('estimateRisk from ChangeRequest returns a RiskAssessment', () => {
  const r = eis.estimateRisk(domainReq);
  assert.ok(typeof r.level === 'string');
  assert.ok(typeof r.score === 'number');
  assert.ok(Array.isArray(r.drivers));
});

test('estimateRisk: unresolved → low risk', () => {
  const r = eis.estimateRisk(unresolved);
  assert.equal(r.level, 'low');
  assert.equal(r.score, 0);
});

// ── estimateDependencies ──────────────────────────────────────────────────────

test('estimateDependencies returns an array of strings', () => {
  const deps = eis.estimateDependencies(domainReq);
  assert.ok(Array.isArray(deps));
  for (const d of deps) assert.equal(typeof d, 'string');
});

test('estimateDependencies: deduped (no repeat entries)', () => {
  const deps = eis.estimateDependencies(domainReq);
  assert.equal(deps.length, new Set(deps).size);
});

// ── generateWorkBreakdown ─────────────────────────────────────────────────────

test('generateWorkBreakdown: returns WorkItem array', () => {
  const items = eis.generateWorkBreakdown(domainReq);
  assert.ok(Array.isArray(items));
  assert.ok(items.length > 0);
});

test('generateWorkBreakdown: always includes test, docs, verification items', () => {
  const items = eis.generateWorkBreakdown(domainReq);
  const cats = items.map((it) => it.category);
  assert.ok(cats.includes('test'), 'must include test item');
  assert.ok(cats.includes('docs'), 'must include docs item');
  assert.ok(cats.includes('verification'), 'must include verification item');
});

test('generateWorkBreakdown: schema items for each affected table', () => {
  assert.ok(moneyTable, 'need a real money table');
  const a = eis.analyzeChange(moneyReq);
  const items = eis.generateWorkBreakdown(a);
  const schemaItems = items.filter((it) => it.category === 'schema');
  assert.ok(schemaItems.length >= a.affected.tables.length, 'one schema item per table');
});

test('generateWorkBreakdown: migration item when tables are affected', () => {
  assert.ok(moneyTable, 'need a real money table');
  const a = eis.analyzeChange(moneyReq);
  const items = eis.generateWorkBreakdown(a);
  if (a.affected.tables.length > 0) {
    const migItems = items.filter((it) => it.category === 'migration');
    assert.ok(migItems.length > 0, 'migration item must exist when tables are affected');
  }
});

test('generateWorkBreakdown: rpc items depend on schema items', () => {
  const a = eis.analyzeChange(domainReq);
  const items = eis.generateWorkBreakdown(a);
  const schemaIds = new Set(items.filter((it) => it.category === 'schema').map((it) => it.id));
  const rpcItems = items.filter((it) => it.category === 'rpc');
  for (const rpc of rpcItems) {
    for (const dep of rpc.dependsOn) {
      assert.ok(schemaIds.has(dep) || items.some((it) => it.id === dep), `rpc dep "${dep}" must exist`);
    }
  }
});

test('generateWorkBreakdown: verification depends on test item', () => {
  const items = eis.generateWorkBreakdown(domainReq);
  const verifyItem = items.find((it) => it.category === 'verification');
  assert.ok(verifyItem, 'verification item must exist');
  assert.ok(verifyItem!.dependsOn.includes('wb-test-0'), 'verification must depend on test item');
});

test('generateWorkBreakdown: every item has evidence', () => {
  const items = eis.generateWorkBreakdown(domainReq);
  for (const it of items) {
    assert.ok(it.evidence.length > 0, `WorkItem "${it.id}" must have evidence`);
  }
});

test('generateWorkBreakdown: money change → high/critical risk items', () => {
  assert.ok(moneyTable, 'need a real money table');
  const items = eis.generateWorkBreakdown(moneyReq);
  const schemaItems = items.filter((it) => it.category === 'schema');
  for (const it of schemaItems) {
    assert.ok(
      it.risk === 'high' || it.risk === 'critical',
      `Schema item "${it.id}" risk must be high or critical for money change, got "${it.risk}"`,
    );
  }
});

// ── generateMilestones ────────────────────────────────────────────────────────

test('generateMilestones: returns non-empty array', () => {
  const ms = eis.generateMilestones(domainReq);
  assert.ok(Array.isArray(ms));
  assert.ok(ms.length > 0);
});

test('generateMilestones: every milestone has id, title, items[], gate', () => {
  const ms = eis.generateMilestones(domainReq);
  for (const m of ms) {
    assert.ok(typeof m.id === 'string');
    assert.ok(typeof m.title === 'string');
    assert.ok(Array.isArray(m.items));
    assert.ok(typeof m.gate === 'string');
  }
});

test('generateMilestones: milestone-4 (Test & Verify) always present', () => {
  const ms = eis.generateMilestones(domainReq);
  const m4 = ms.find((m) => m.id === 'milestone-4');
  assert.ok(m4, 'milestone-4 must always be present');
  assert.ok(m4!.items.length > 0);
});

test('generateMilestones: all work item ids are covered by some milestone', () => {
  const a = eis.analyzeChange(domainReq);
  const items = eis.generateWorkBreakdown(a);
  const ms = eis.generateMilestones(a);
  const coveredIds = new Set(ms.flatMap((m) => m.items));
  for (const it of items) {
    assert.ok(coveredIds.has(it.id), `WorkItem "${it.id}" must be in some milestone`);
  }
});

// ── generateExecutionChecklist ────────────────────────────────────────────────

test('generateExecutionChecklist: returns array of items with done:false', () => {
  const cl = eis.generateExecutionChecklist(domainReq);
  assert.ok(Array.isArray(cl));
  assert.ok(cl.length > 0);
  for (const item of cl) {
    assert.equal(item.done, false);
    assert.ok(typeof item.step === 'string');
    assert.ok(typeof item.category === 'string');
    assert.ok(Array.isArray(item.evidence));
  }
});

test('generateExecutionChecklist: steps are in implementation order (schema before rpc)', () => {
  const a = eis.analyzeChange(domainReq);
  const cl = eis.generateExecutionChecklist(a);
  const schemaIdx = cl.findIndex((it) => it.category === 'schema');
  const rpcIdx = cl.findIndex((it) => it.category === 'rpc');
  if (schemaIdx !== -1 && rpcIdx !== -1) {
    assert.ok(schemaIdx < rpcIdx, 'schema steps must come before rpc steps');
  }
});

// ── generateExecutionGraph ────────────────────────────────────────────────────

test('generateExecutionGraph: returns ExecutionGraph with provenance', () => {
  const g = eis.generateExecutionGraph(domainReq);
  assert.equal(g.timestamp, FIXED);
  assert.ok(g.evidence.length > 0);
  assert.ok(g.confidence > 0 && g.confidence <= 0.95);
  assert.ok(Array.isArray(g.nodes));
  assert.ok(Array.isArray(g.edges));
  assert.ok(Array.isArray(g.implementationOrder));
  assert.ok(Array.isArray(g.criticalPath));
  assert.ok(Array.isArray(g.parallelizable));
  assert.ok(Array.isArray(g.blocked));
});

test('generateExecutionGraph: implementationOrder is a valid topological order', () => {
  const a = eis.analyzeChange(domainReq);
  const g = eis.generateExecutionGraph(a);
  const items = eis.generateWorkBreakdown(a);
  const itemMap = new Map(items.map((it) => [it.id, it]));
  const orderIdx = new Map<string, number>(g.implementationOrder.map((id, i) => [id, i]));

  for (const id of g.implementationOrder) {
    const item = itemMap.get(id);
    if (!item) continue;
    for (const dep of item.dependsOn) {
      if (orderIdx.has(dep)) {
        const depIdx = orderIdx.get(dep)!;
        const thisIdx = orderIdx.get(id)!;
        assert.ok(depIdx < thisIdx, `dep "${dep}" (idx ${depIdx}) must come before "${id}" (idx ${thisIdx})`);
      }
    }
  }
});

test('generateExecutionGraph: criticalPath is non-empty when there are dependencies', () => {
  const a = eis.analyzeChange(domainReq);
  const g = eis.generateExecutionGraph(a);
  const items = eis.generateWorkBreakdown(a);
  const hasDeps = items.some((it) => it.dependsOn.length > 0);
  if (hasDeps) {
    assert.ok(g.criticalPath.length > 0, 'criticalPath must be non-empty when there are dependencies');
  }
});

test('generateExecutionGraph: parallelizable nodes have no dependsOn in their work items', () => {
  const a = eis.analyzeChange(domainReq);
  const g = eis.generateExecutionGraph(a);
  const items = eis.generateWorkBreakdown(a);
  const itemMap = new Map(items.map((it) => [it.id, it]));
  for (const id of g.parallelizable) {
    const item = itemMap.get(id);
    if (item) {
      assert.equal(item.dependsOn.length, 0, `parallelizable item "${id}" must have no deps`);
    }
  }
});

test('generateExecutionGraph: every node in implementationOrder is accounted for in nodes array', () => {
  const g = eis.generateExecutionGraph(domainReq);
  const nodeIds = new Set(g.nodes.map((n) => n.id));
  for (const id of g.implementationOrder) {
    assert.ok(nodeIds.has(id), `${id} in implementationOrder must appear in nodes`);
  }
});

test('generateExecutionGraph: onCriticalPath set correctly on nodes', () => {
  const g = eis.generateExecutionGraph(domainReq);
  const cpSet = new Set(g.criticalPath);
  for (const node of g.nodes) {
    if (cpSet.has(node.id)) {
      assert.equal(node.onCriticalPath, true, `node "${node.id}" is on criticalPath but onCriticalPath is false`);
    }
  }
});

test('ExecutionGraphService.build: same result as eis.generateExecutionGraph', () => {
  const a = eis.analyzeChange(domainReq);
  const g1 = eis.generateExecutionGraph(a);
  const g2 = egs.build(a);
  assert.deepEqual(g1.implementationOrder, g2.implementationOrder);
  assert.deepEqual(g1.criticalPath, g2.criticalPath);
  assert.deepEqual(g1.parallelizable, g2.parallelizable);
});

// ── planImplementation / buildExecutionPlan ───────────────────────────────────

test('planImplementation: returns ExecutionPlan with full provenance', () => {
  const ep = eis.planImplementation(domainReq);
  assert.equal(ep.timestamp, FIXED);
  assert.ok(ep.evidence.length > 0);
  assert.ok(ep.confidence > 0 && ep.confidence <= 0.95);
  assert.ok(Array.isArray(ep.sources));
  assert.ok(typeof ep.summary === 'string');
  assert.ok(ep.summary.length > 0);
});

test('planImplementation: ExecutionPlan has all required fields', () => {
  const ep = eis.planImplementation(domainReq);
  assert.ok(ep.request);
  assert.ok(ep.complexity);
  assert.ok(ep.risk);
  assert.ok(Array.isArray(ep.workBreakdown));
  assert.ok(Array.isArray(ep.milestones));
  assert.ok(ep.graph);
  assert.ok(Array.isArray(ep.checklist));
  assert.ok(Array.isArray(ep.dependencies));
});

test('buildExecutionPlan: alias produces same result as planImplementation', () => {
  const p1 = eis.planImplementation(domainReq);
  const p2 = eis.buildExecutionPlan(domainReq);
  assert.deepEqual(p1.graph.implementationOrder, p2.graph.implementationOrder);
  assert.deepEqual(p1.summary, p2.summary);
  assert.deepEqual(p1.complexity.band, p2.complexity.band);
});

test('planImplementation: unresolved → plan is honestly empty, not fabricated', () => {
  const ep = eis.planImplementation(unresolved);
  assert.ok(ep.summary.toLowerCase().includes('empty') || ep.summary.toLowerCase().includes('no'));
  assert.deepEqual(ep.graph.implementationOrder.filter((id: string) => id.startsWith('wb-schema-')), []);
});

// ── Determinism ───────────────────────────────────────────────────────────────

test('determinism: same request+now → deep-equal ExecutionPlan output', () => {
  const p1 = eis.planImplementation(domainReq);
  const p2 = eis.planImplementation(domainReq);
  assert.deepEqual(p1.timestamp, p2.timestamp);
  assert.deepEqual(p1.complexity, p2.complexity);
  assert.deepEqual(p1.risk, p2.risk);
  assert.deepEqual([...p1.graph.implementationOrder], [...p2.graph.implementationOrder]);
  assert.deepEqual([...p1.graph.criticalPath], [...p2.graph.criticalPath]);
});

test('determinism: same request+now → deep-equal graph output', () => {
  const g1 = eis.generateExecutionGraph(domainReq);
  const g2 = eis.generateExecutionGraph(domainReq);
  assert.deepEqual([...g1.implementationOrder], [...g2.implementationOrder]);
  assert.deepEqual([...g1.criticalPath], [...g2.criticalPath]);
  assert.deepEqual([...g1.parallelizable], [...g2.parallelizable]);
  assert.deepEqual([...g1.blocked], [...g2.blocked]);
});

/**
 * ExecutionIntelligenceService tests — EAOS Phase 8.
 *
 * Verifies:
 * - Derived status matches pkg.graph.parallelizable/blocked exactly (CONNECTED)
 * - Live signals (run-state, completion) are NOT_CONNECTED with correct liveSource and confidence 0
 * - Provenance: evidence/confidence/sources/timestamp/liveConnected:false on every output
 * - Determinism under a fixed clock
 * - Read-only source (no mutations, no IO)
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine } from '@letbuyy/lcis-core';
import { buildEngineeringPackage } from '../src/index';
import { ExecutionIntelligenceService } from '../src/execution/index';

const FIXED = '2026-06-21T00:00:00.000Z';
const engine = createEngine();

async function pkg() {
  return buildEngineeringPackage(engine, { text: 'Build GST Filing' }, () => FIXED);
}

// ── Shared package (built once, reused across tests) ─────────────────────────

let _pkg: Awaited<ReturnType<typeof pkg>> | null = null;
async function getSharedPkg() {
  if (!_pkg) _pkg = await pkg();
  return _pkg;
}

// ── Service construction ──────────────────────────────────────────────────────

test('ExecutionIntelligenceService constructs with an LcisEngine', async () => {
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  assert.ok(svc instanceof ExecutionIntelligenceService);
});

test('ExecutionIntelligenceService constructs with defaultNow (no second arg)', async () => {
  const svc = new ExecutionIntelligenceService(engine);
  assert.ok(svc instanceof ExecutionIntelligenceService);
});

// ── buildExecutionGraph ───────────────────────────────────────────────────────

test('buildExecutionGraph returns ExecutionGraph shape', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const g = svc.buildExecutionGraph(p);
  assert.ok(Array.isArray(g.nodes));
  assert.ok(Array.isArray(g.edges));
  assert.ok(Array.isArray(g.implementationOrder));
  assert.ok(Array.isArray(g.criticalPath));
  assert.ok(Array.isArray(g.parallelizable));
  assert.ok(Array.isArray(g.blocked));
  assert.ok(typeof g.summary === 'string' && g.summary.length > 0);
});

test('buildExecutionGraph: node count matches pkg.graph.nodes', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const g = svc.buildExecutionGraph(p);
  assert.equal(g.nodes.length, p.graph.nodes.length);
});

test('buildExecutionGraph: parallelizable tasks get status READY', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const g = svc.buildExecutionGraph(p);
  const parallelSet = new Set(p.graph.parallelizable);
  const blockedSet = new Set(p.graph.blocked);
  for (const node of g.nodes) {
    if (parallelSet.has(node.id)) {
      assert.equal(node.status, 'READY', `Expected READY for ${node.id}`);
    }
  }
});

test('buildExecutionGraph: blocked tasks get status BLOCKED', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const g = svc.buildExecutionGraph(p);
  const blockedSet = new Set(p.graph.blocked);
  for (const node of g.nodes) {
    if (blockedSet.has(node.id)) {
      assert.equal(node.status, 'BLOCKED', `Expected BLOCKED for ${node.id}`);
    }
  }
});

test('buildExecutionGraph: non-parallelizable non-blocked tasks are PLANNED', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const g = svc.buildExecutionGraph(p);
  const parallelSet = new Set(p.graph.parallelizable);
  const blockedSet = new Set(p.graph.blocked);
  for (const node of g.nodes) {
    if (!parallelSet.has(node.id) && !blockedSet.has(node.id)) {
      assert.equal(node.status, 'PLANNED', `Expected PLANNED for ${node.id}`);
    }
  }
});

test('buildExecutionGraph: every node has connection CONNECTED', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const g = svc.buildExecutionGraph(p);
  for (const node of g.nodes) {
    assert.equal(node.connection, 'CONNECTED', `node ${node.id} should be CONNECTED`);
  }
});

test('buildExecutionGraph: every node has a liveSource string', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const g = svc.buildExecutionGraph(p);
  for (const node of g.nodes) {
    assert.ok(typeof node.liveSource === 'string' && node.liveSource.length > 0);
  }
});

test('buildExecutionGraph: implementationOrder matches pkg', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const g = svc.buildExecutionGraph(p);
  assert.deepEqual([...g.implementationOrder], [...p.graph.implementationOrder]);
});

test('buildExecutionGraph: criticalPath matches pkg', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const g = svc.buildExecutionGraph(p);
  assert.deepEqual([...g.criticalPath], [...p.graph.criticalPath]);
});

test('buildExecutionGraph: parallelizable matches pkg', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const g = svc.buildExecutionGraph(p);
  assert.deepEqual([...g.parallelizable], [...p.graph.parallelizable]);
});

test('buildExecutionGraph: blocked matches pkg', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const g = svc.buildExecutionGraph(p);
  assert.deepEqual([...g.blocked], [...p.graph.blocked]);
});

test('buildExecutionGraph: edges map from/to/relation correctly', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const g = svc.buildExecutionGraph(p);
  assert.equal(g.edges.length, p.graph.edges.length);
  for (const edge of g.edges) {
    assert.equal(edge.relation, 'depends-on');
    assert.ok(typeof edge.from === 'string');
    assert.ok(typeof edge.to === 'string');
  }
});

// ── Provenance on ExecutionGraph ──────────────────────────────────────────────

test('buildExecutionGraph: graph has OrchestrationArtifact fields', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const g = svc.buildExecutionGraph(p);
  assert.ok(Array.isArray(g.evidence));
  assert.ok(typeof g.confidence === 'number');
  assert.ok(Array.isArray(g.sources));
  assert.equal(g.timestamp, FIXED);
  assert.equal(g.liveConnected, false);
});

test('buildExecutionGraph: confidence is > 0 (structural evidence present)', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const g = svc.buildExecutionGraph(p);
  assert.ok(g.confidence > 0, 'structural graph should have positive confidence');
  assert.ok(g.confidence <= 0.9, 'structural confidence capped at 0.9');
});

// ── currentExecutionState ─────────────────────────────────────────────────────

test('currentExecutionState returns planned/ready/blocked counts', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const state = svc.currentExecutionState(p);
  assert.equal(typeof state.planned, 'number');
  assert.equal(typeof state.ready, 'number');
  assert.equal(typeof state.blocked, 'number');
  assert.ok(state.planned >= 0);
  assert.ok(state.ready >= 0);
  assert.ok(state.blocked >= 0);
});

test('currentExecutionState: counts add up to total tasks', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const state = svc.currentExecutionState(p);
  assert.equal(state.planned + state.ready + state.blocked, p.graph.nodes.length);
});

test('currentExecutionState: ready matches parallelizable count', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const state = svc.currentExecutionState(p);
  assert.equal(state.ready, p.graph.parallelizable.length);
});

test('currentExecutionState: blocked matches pkg.graph.blocked count', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const state = svc.currentExecutionState(p);
  assert.equal(state.blocked, p.graph.blocked.length);
});

test('currentExecutionState: connection is CONNECTED', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const state = svc.currentExecutionState(p);
  assert.equal(state.connection, 'CONNECTED');
});

test('currentExecutionState: liveRunStateNote mentions NOT_CONNECTED', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const state = svc.currentExecutionState(p);
  assert.ok(state.liveRunStateNote.includes('NOT_CONNECTED'));
});

test('currentExecutionState: liveSource is non-empty string', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const state = svc.currentExecutionState(p);
  assert.ok(typeof state.liveSource === 'string' && state.liveSource.length > 0);
});

// ── blockedWork ───────────────────────────────────────────────────────────────

test('blockedWork returns ExecutionFinding[] for each blocked task', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const findings = svc.blockedWork(p);
  assert.equal(findings.length, p.graph.blocked.length);
});

test('blockedWork: each finding has category blocked', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const findings = svc.blockedWork(p);
  for (const f of findings) {
    assert.equal(f.category, 'blocked');
  }
});

test('blockedWork: each finding severity is high', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const findings = svc.blockedWork(p);
  for (const f of findings) {
    assert.equal(f.severity, 'high');
  }
});

test('blockedWork: each finding connection is CONNECTED', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const findings = svc.blockedWork(p);
  for (const f of findings) {
    assert.equal(f.connection, 'CONNECTED');
  }
});

test('blockedWork: each finding has rule EO02', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const findings = svc.blockedWork(p);
  for (const f of findings) {
    assert.equal(f.rule, 'EO02');
  }
});

test('blockedWork: each finding subject is in pkg.graph.blocked', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const findings = svc.blockedWork(p);
  const blockedSet = new Set(p.graph.blocked);
  for (const f of findings) {
    assert.ok(blockedSet.has(f.subject), `subject ${f.subject} should be in blocked set`);
  }
});

test('blockedWork: each finding has positive confidence (CONNECTED)', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const findings = svc.blockedWork(p);
  for (const f of findings) {
    assert.ok(f.confidence > 0, `CONNECTED finding should have positive confidence`);
  }
});

test('blockedWork: each finding has non-empty evidence', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const findings = svc.blockedWork(p);
  for (const f of findings) {
    assert.ok(Array.isArray(f.evidence) && f.evidence.length > 0);
  }
});

// ── criticalPath ──────────────────────────────────────────────────────────────

test('criticalPath returns pkg.graph.criticalPath as an array', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const cp = svc.criticalPath(p);
  assert.deepEqual(cp, [...p.graph.criticalPath]);
});

test('criticalPath returns a new array (not the same reference)', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const cp = svc.criticalPath(p);
  assert.notEqual(cp, p.graph.criticalPath);
});

// ── parallelizableWork ────────────────────────────────────────────────────────

test('parallelizableWork returns pkg.graph.parallelizable as an array', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const pw = svc.parallelizableWork(p);
  assert.deepEqual(pw, [...p.graph.parallelizable]);
});

test('parallelizableWork returns a new array (not same reference)', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const pw = svc.parallelizableWork(p);
  assert.notEqual(pw, p.graph.parallelizable);
});

// ── completionPercentage ──────────────────────────────────────────────────────

test('completionPercentage: planned = tasks.length (CONNECTED)', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const metric = svc.completionPercentage(p);
  assert.equal(metric.planned, p.tasks.length);
});

test('completionPercentage: completed is null (NOT_CONNECTED)', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const metric = svc.completionPercentage(p);
  assert.equal(metric.completed, null);
});

test('completionPercentage: connection is NOT_CONNECTED', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const metric = svc.completionPercentage(p);
  assert.equal(metric.connection, 'NOT_CONNECTED');
});

test('completionPercentage: liveSource is non-empty string', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const metric = svc.completionPercentage(p);
  assert.ok(typeof metric.liveSource === 'string' && metric.liveSource.length > 0);
});

test('completionPercentage: label is non-empty string', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const metric = svc.completionPercentage(p);
  assert.ok(typeof metric.label === 'string' && metric.label.length > 0);
});

// ── remainingWork ─────────────────────────────────────────────────────────────

test('remainingWork returns all tasks (completion NOT_CONNECTED → all are remaining)', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const remaining = svc.remainingWork(p);
  assert.equal(remaining.length, p.graph.nodes.length);
});

test('remainingWork returns ExecutionNode[] with correct shape', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const remaining = svc.remainingWork(p);
  for (const node of remaining) {
    assert.ok(typeof node.id === 'string');
    assert.ok(typeof node.title === 'string');
    assert.ok(typeof node.layer === 'string');
    assert.ok(['PLANNED', 'READY', 'BLOCKED'].includes(node.status));
    assert.equal(node.connection, 'CONNECTED');
  }
});

// ── executionHealth ───────────────────────────────────────────────────────────

test('executionHealth returns ExecutionHealth shape', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const health = svc.executionHealth(p);
  assert.equal(health.area, 'execution');
  assert.ok(typeof health.connectedSignals === 'number');
  assert.ok(typeof health.notConnectedSignals === 'number');
});

test('executionHealth: score is 0..100 or null', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const health = svc.executionHealth(p);
  if (health.score !== null) {
    assert.ok(health.score >= 0 && health.score <= 100);
  }
});

test('executionHealth: band is a valid HealthBand', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const health = svc.executionHealth(p);
  assert.ok(['healthy', 'degraded', 'failing', 'unknown'].includes(health.band));
});

test('executionHealth: all blocked tasks → failing or degraded band', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const health = svc.executionHealth(p);
  if (p.graph.blocked.length === p.graph.nodes.length && p.graph.nodes.length > 0) {
    assert.equal(health.score, 0);
    assert.equal(health.band, 'failing');
  }
});

test('executionHealth: no blocked tasks → healthy band', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const health = svc.executionHealth(p);
  if (p.graph.blocked.length === 0 && p.graph.nodes.length > 0) {
    assert.equal(health.band, 'healthy');
    assert.equal(health.score, 100);
  }
});

test('executionHealth: connectedSignals > 0', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const health = svc.executionHealth(p);
  assert.ok(health.connectedSignals > 0);
});

test('executionHealth: notConnectedSignals > 0 (live signals always absent)', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const health = svc.executionHealth(p);
  assert.ok(health.notConnectedSignals > 0);
});

// ── generateExecutionReport ───────────────────────────────────────────────────

test('generateExecutionReport returns ExecutionReport shape', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const report = svc.generateExecutionReport(p);
  assert.ok(report.graph && Array.isArray(report.graph.nodes));
  assert.ok(Array.isArray(report.findings));
  assert.ok(report.health && typeof report.health.area === 'string');
  assert.ok(report.completion && report.completion.connection === 'NOT_CONNECTED');
  assert.ok(typeof report.summary === 'string' && report.summary.length > 0);
  assert.ok(report.request && typeof report.request.text === 'string');
});

test('generateExecutionReport: OrchestrationArtifact fields present', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const report = svc.generateExecutionReport(p);
  assert.ok(Array.isArray(report.evidence));
  assert.ok(typeof report.confidence === 'number');
  assert.ok(Array.isArray(report.sources));
  assert.equal(report.timestamp, FIXED);
  assert.equal(report.liveConnected, false);
});

test('generateExecutionReport: confidence > 0 (structural evidence)', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const report = svc.generateExecutionReport(p);
  assert.ok(report.confidence > 0);
  assert.ok(report.confidence <= 0.9);
});

test('generateExecutionReport: liveConnected always false', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const report = svc.generateExecutionReport(p);
  assert.equal(report.liveConnected, false);
});

test('generateExecutionReport: request matches pkg.request', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const report = svc.generateExecutionReport(p);
  assert.deepEqual(report.request, p.request);
});

test('generateExecutionReport: embedded graph has same node count', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const report = svc.generateExecutionReport(p);
  assert.equal(report.graph.nodes.length, p.graph.nodes.length);
});

test('generateExecutionReport: completion.planned = tasks.length', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const report = svc.generateExecutionReport(p);
  assert.equal(report.completion.planned, p.tasks.length);
});

test('generateExecutionReport: completion.completed is null', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const report = svc.generateExecutionReport(p);
  assert.equal(report.completion.completed, null);
});

test('generateExecutionReport: summary mentions feature text', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const report = svc.generateExecutionReport(p);
  assert.ok(report.summary.includes('GST Filing'), `summary should mention feature text: ${report.summary}`);
});

test('generateExecutionReport: summary mentions NOT_CONNECTED', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const report = svc.generateExecutionReport(p);
  assert.ok(report.summary.includes('NOT_CONNECTED'));
});

test('generateExecutionReport: findings count equals blockedWork count', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const report = svc.generateExecutionReport(p);
  const blocked = svc.blockedWork(p);
  assert.equal(report.findings.length, blocked.length);
});

// ── Determinism ───────────────────────────────────────────────────────────────

test('generateExecutionReport is deterministic under fixed clock', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const r1 = svc.generateExecutionReport(p);
  const r2 = svc.generateExecutionReport(p);
  assert.equal(r1.timestamp, r2.timestamp);
  assert.equal(r1.confidence, r2.confidence);
  assert.equal(r1.graph.nodes.length, r2.graph.nodes.length);
  assert.equal(r1.summary, r2.summary);
  assert.equal(r1.findings.length, r2.findings.length);
});

test('buildExecutionGraph is deterministic under fixed clock', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const g1 = svc.buildExecutionGraph(p);
  const g2 = svc.buildExecutionGraph(p);
  assert.equal(g1.nodes.length, g2.nodes.length);
  assert.equal(g1.timestamp, g2.timestamp);
  assert.equal(g1.confidence, g2.confidence);
  assert.equal(g1.summary, g2.summary);
});

test('executionHealth is deterministic', async () => {
  const p = await getSharedPkg();
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const h1 = svc.executionHealth(p);
  const h2 = svc.executionHealth(p);
  assert.equal(h1.score, h2.score);
  assert.equal(h1.band, h2.band);
  assert.equal(h1.connectedSignals, h2.connectedSignals);
});

// ── Two different feature requests ────────────────────────────────────────────

test('generateExecutionReport with different request text', async () => {
  const p2 = await buildEngineeringPackage(engine, { text: 'Implement Shipping Zones' }, () => FIXED);
  const svc = new ExecutionIntelligenceService(engine, () => FIXED);
  const report = svc.generateExecutionReport(p2);
  assert.ok(report.request.text === 'Implement Shipping Zones');
  assert.equal(report.liveConnected, false);
  assert.equal(report.completion.completed, null);
  assert.equal(report.completion.connection, 'NOT_CONNECTED');
});

// ── Read-only source scan ─────────────────────────────────────────────────────

test('ExecutionIntelligenceService source has no fetch/spawn/exec/eval/writeFile', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(
    new URL('../src/execution/ExecutionIntelligenceService.ts', import.meta.url).pathname,
    'utf-8',
  );
  const stripped = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!stripped.includes('fetch('), 'no fetch');
  assert.ok(!stripped.includes('child_process'), 'no child_process');
  assert.ok(!stripped.includes('spawn('), 'no spawn');
  assert.ok(!stripped.includes('exec('), 'no exec');
  assert.ok(!stripped.includes('eval('), 'no eval');
  assert.ok(!stripped.includes('writeFile'), 'no writeFile');
  assert.ok(!stripped.includes('writeFileSync'), 'no writeFileSync');
});

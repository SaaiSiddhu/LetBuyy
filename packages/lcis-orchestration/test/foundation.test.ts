/**
 * EAOS foundation tests — the builders + rule registry + envelope + catalog reader run against the
 * REAL artifacts, and buildEngineeringPackage() composes a REAL EINS package (the single input EAOS
 * overlays execution state onto). Verifies the honesty contract (NOT_CONNECTED → confidence 0,
 * liveConnected false) and the evidence/confidence/sources/timestamp envelope.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine, evidence } from '@letbuyy/lcis-core';
import {
  EXECUTION_RULES,
  ExecutionConfidenceCalculator,
  ExecutionEvidenceBuilder,
  ExecutionRuleRegistry,
  ExecutionSeverityScorer,
  OrchestrationArtifactStore,
  buildEngineeringPackage,
  execution,
  isEngineeringPackage,
} from '../src/index';

const FIXED = '2026-06-21T00:00:00.000Z';
const engine = createEngine();

// ── rule registry ─────────────────────────────────────────────────────────────
test('ExecutionRuleRegistry exposes EO01..EO08', () => {
  const reg = new ExecutionRuleRegistry();
  assert.equal(reg.list().length, 8);
  assert.equal(EXECUTION_RULES.length, 8);
  assert.equal(reg.get('EO03')?.severity, 'critical');
  assert.ok(reg.get('EO01')?.category === 'ownership');
  assert.ok(reg.byCategory('rollout').length >= 1);
});

// ── builders ───────────────────────────────────────────────────────────────────
test('ExecutionSeverityScorer: money/failed-validation → critical, blocked → high', () => {
  const s = new ExecutionSeverityScorer();
  assert.equal(s.forFinding({ money: true }), 'critical');
  assert.equal(s.forFinding({ failedValidation: true }), 'critical');
  assert.equal(s.forFinding({ blocked: true }), 'high');
  assert.equal(s.forFinding({ missingArtifact: true }), 'medium');
  assert.equal(s.forFinding({ base: 'info' }), 'info');
  assert.equal(s.max('low', 'critical'), 'critical');
});
test('ExecutionConfidenceCalculator: NOT_CONNECTED → 0, CONNECTED capped at 0.9', () => {
  const c = new ExecutionConfidenceCalculator();
  assert.equal(c.forConnection('NOT_CONNECTED', [evidence('graph-node', 't')]), 0);
  assert.ok(c.forConnection('CONNECTED', [evidence('graph-node', 't')]) > 0);
  assert.ok(c.fromEvidence(Array(40).fill(evidence('graph-node', 't'))) <= 0.9);
  assert.equal(c.fromEvidence([]), 0);
});
test('ExecutionEvidenceBuilder: reuse citation + honest not-connected', () => {
  const eb = new ExecutionEvidenceBuilder();
  const reuse = eb.reuse('lcis-engineering', 'getEngineeringEngine', 'package');
  assert.equal(reuse.ref, 'lcis-engineering:getEngineeringEngine');
  assert.equal(reuse.source, 'packages/lcis-engineering');
  const nc = eb.notConnected('task:x.run-state', 'execution-tracking store (CI/git)');
  assert.equal(nc.kind, 'not-connected');
  assert.ok((nc.detail ?? '').includes('execution-tracking store'));
});
test('execution() envelope stamps provenance + honest liveConnected=false', () => {
  const out = execution({ ok: true }, { evidence: [evidence('graph-node', 't', 'd', 'lcis-engineering:EngineeringPackage')], now: () => FIXED });
  assert.equal(out.timestamp, FIXED);
  assert.equal(out.liveConnected, false);
  assert.ok(out.confidence > 0 && out.confidence <= 0.9);
  assert.deepEqual(out.sources, ['lcis-engineering:EngineeringPackage']);
});

// ── catalog reader (real artifacts) ───────────────────────────────────────────
test('OrchestrationArtifactStore reads the real structural catalog', () => {
  const store = new OrchestrationArtifactStore(engine);
  assert.ok(store.functions().length > 50, 'RPCs present');
  assert.ok(store.tables().length > 100, 'tables present');
  assert.ok(store.routes().length >= 1, 'routes present');
});

// ── the composed EINS input (real package build) ──────────────────────────────
test('buildEngineeringPackage composes a real EINS package for a feature', async () => {
  const pkg = await buildEngineeringPackage(engine, { text: 'Build GST Filing' }, () => FIXED);
  assert.ok(isEngineeringPackage(pkg), 'is a real EngineeringPackage');
  assert.ok(Array.isArray(pkg.tasks));
  assert.ok(pkg.graph && Array.isArray(pkg.graph.parallelizable) && Array.isArray(pkg.graph.blocked));
  assert.ok(Array.isArray(pkg.agentPlan.tasks));
  assert.ok(['GO', 'CONDITIONAL_GO', 'NO_GO'].includes(pkg.decision.verdict));
});
test('buildEngineeringPackage is deterministic under a fixed clock', async () => {
  const a = await buildEngineeringPackage(engine, { text: 'Implement Shipping Zones' }, () => FIXED);
  const b = await buildEngineeringPackage(engine, { text: 'Implement Shipping Zones' }, () => FIXED);
  assert.equal(a.tasks.length, b.tasks.length);
  assert.equal(a.decision.verdict, b.decision.verdict);
  assert.equal(a.timestamp, FIXED);
});
test('isEngineeringPackage rejects non-packages', () => {
  assert.equal(isEngineeringPackage(null), false);
  assert.equal(isEngineeringPackage({ tasks: [] }), false);
});

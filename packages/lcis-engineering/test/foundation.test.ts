/**
 * EINS foundation tests — the builders + the FROZEN contract, plus a composition smoke-test
 * proving the prior engines (eis/gov/ops) wire in and are reusable from this package. Runs
 * against the REAL graphify-out artifacts.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine, evidence } from '@letbuyy/lcis-core';
import { createEisEngine } from '@letbuyy/lcis-execution';
import { createGovernanceEngine } from '@letbuyy/lcis-governance';
import { createOperationsEngine } from '@letbuyy/lcis-operations';
import {
  ENGINEERING_RULES,
  EngineeringArtifactStore,
  EngineeringConfidenceCalculator,
  EngineeringEvidenceBuilder,
  EngineeringFindingBuilder,
  EngineeringRuleRegistry,
  EngineeringSeverityScorer,
  engineering,
} from '../src/index';

const FIXED = '2026-06-21T00:00:00.000Z';
const core = createEngine();
const store = new EngineeringArtifactStore(core);

test('EngineeringArtifactStore reads the real domain anatomy', () => {
  assert.ok(store.domains().length >= 10, 'domains present');
  const d = store.domains()[0]!;
  assert.ok(typeof d.key === 'string' && Array.isArray(d.tables));
});

test('EngineeringRuleRegistry exposes the E001..E008 construction gates mapped to R-rules', () => {
  const reg = new EngineeringRuleRegistry();
  assert.equal(reg.list().length, 8);
  assert.equal(ENGINEERING_RULES.length, 8);
  assert.equal(reg.get('E001')?.mapsTo, 'R001');
  assert.equal(reg.get('E002')?.severity, 'critical');
  assert.ok(reg.byLayer('migration').length >= 1);
});

test('EngineeringEvidenceBuilder.reuse cites the composed prior-system method', () => {
  const e = new EngineeringEvidenceBuilder().reuse('lcis-execution', 'eis.analyze', 'change surface');
  assert.equal(e.ref, 'lcis-execution:eis.analyze');
  assert.equal(e.source, 'packages/lcis-execution');
});

test('EngineeringConfidenceCalculator: composed mean (capped 0.9), 0 when empty', () => {
  const c = new EngineeringConfidenceCalculator();
  assert.equal(c.fromComposed([]), 0);
  assert.equal(c.fromComposed([0.9, 0.9, 0.9]), 0.9);
  assert.ok(c.fromComposed([0.8, 0.95, 0.99]) <= 0.9);
  assert.equal(c.fromEvidence([]), 0);
  assert.ok(c.fromEvidence(Array(50).fill(evidence('table', 't'))) <= 0.9);
});

test('EngineeringSeverityScorer: money → critical, tenant/broad → high', () => {
  const s = new EngineeringSeverityScorer();
  assert.equal(s.forFeature({ money: true }), 'critical');
  assert.equal(s.forFeature({ tenant: true }), 'high');
  assert.equal(s.forFeature({ broadBlast: true }), 'high');
  assert.equal(s.forFeature({ base: 'low' }), 'low');
});

test('EngineeringFindingBuilder: deterministic id + confidence from evidence', () => {
  const f = new EngineeringFindingBuilder().build({
    category: 'gate', kind: 'money-rpc', severity: 'critical', subject: 'gst_filings',
    title: 'money mutation needs canonical RPC', detail: 'E001', rule: 'E001',
    evidence: [evidence('table', 'gst_filings', 'money', 'graphify-out/db-intel.json')],
  });
  assert.equal(f.id, 'MONEY-RPC-gst_filings');
  assert.equal(f.rule, 'E001');
  assert.ok(f.confidence > 0);
});

test('engineering() stamps evidence + confidence + sources + timestamp', () => {
  const out = engineering({ ok: true }, { evidence: [evidence('rpc', 'r', 'd', 'packages/lcis-execution')], now: () => FIXED });
  assert.equal(out.timestamp, FIXED);
  assert.ok(out.confidence > 0 && out.confidence <= 0.9);
  assert.deepEqual(out.sources, ['packages/lcis-execution']);
});

// ── composition smoke-test: the prior engines wire in + are reusable ──────────
test('the prior engines compose: eis.analyze yields a real change surface', () => {
  const eis = createEisEngine({ now: () => FIXED });
  const a = eis.analyze({ text: 'change', domains: [store.domains()[0]!.key] });
  assert.ok(Array.isArray(a.affected.domains) && a.affected.domains.length >= 1);
  assert.ok(typeof a.confidence === 'number');
});
test('the prior engines compose: gov + ops construct without error', () => {
  const gov = createGovernanceEngine({ now: () => FIXED });
  const ops = createOperationsEngine({ now: () => FIXED });
  assert.ok(gov.compliance && gov.ownership && gov.security);
  assert.ok(typeof ops.runtime === 'function' && typeof ops.operationsReport === 'function');
});

/**
 * test/foundation.test.ts — LSAS foundation tests.
 *
 * Covers: security() envelope semantics, SECURITY_RULES invariants (SEC01..SEC08,
 * unique ids, weights > 0, severities valid, registry), type-shape smoke tests,
 * and risk band boundary tests via RiskScoringService on crafted inputs
 * (exact scores/bands at boundaries 70/50/30/15; empty -> risk 0 low, health unknown/null).
 *
 * Fixed clock: 2026-07-04T00:00:00.000Z
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { evidence, notConnected } from '@letbuyy/lcis-core';
import {
  SECURITY_RULES,
  SecurityRuleRegistry,
  security,
  confidenceFrom,
} from '../src/shared/index';
import { RiskScoringService, type RiskScoringInput } from '../src/risk/index';
import type {
  Severity,
  SecurityReport,
  SecurityRecommendation,
  SecurityRiskScore,
  SecurityHealth,
} from '../src/shared/types';

const FIXED_NOW = '2026-07-04T00:00:00.000Z';
const fixedNow = () => FIXED_NOW;

// ── Helpers ────────────────────────────────────────────────────────────────────

const VALID_SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

function makeThreat(rule: string, sev: Severity = 'high') {
  return {
    id: `threat-${rule}`,
    rule,
    category: 'missing-auth' as const,
    severity: sev,
    subject: `subject-${rule}`,
    title: `Threat ${rule}`,
    detail: `Detail ${rule}`,
    connection: 'CONNECTED' as const,
    evidence: [evidence('artifact-field', rule, 'foundation test', 'test')],
    vector: `vector-${rule}`,
  };
}

function makeAttackPath(id: string, sev: Severity = 'high') {
  return {
    id,
    entry: `entry-${id}`,
    target: `target-${id}`,
    path: [],
    hops: 1,
    severity: sev,
    connection: 'CONNECTED' as const,
    evidence: [evidence('artifact-field', id, 'attack path', 'test')],
  };
}

const emptyInput: RiskScoringInput = {
  threats: [],
  vulnerabilities: [],
  attackPaths: [],
  abuseSignals: [],
  compliance: [],
};

const svc = new RiskScoringService();

function ruleWeight(id: string): number {
  return SECURITY_RULES.find((r) => r.id === id)?.weight ?? 0;
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. security() ENVELOPE SEMANTICS
// ═════════════════════════════════════════════════════════════════════════════

test('security() stamps timestamp from now() parameter', () => {
  const result = security(
    { foo: 'bar' },
    { evidence: [], now: fixedNow },
  );
  assert.equal(result.timestamp, FIXED_NOW);
});

test('security() uses injected now, not wall clock', () => {
  const r1 = security({ x: 1 }, { evidence: [], now: () => '2020-01-01T00:00:00.000Z' });
  assert.equal(r1.timestamp, '2020-01-01T00:00:00.000Z');
});

test('security() stamps liveConnected: false by default', () => {
  const result = security({ body: true }, { evidence: [], now: fixedNow });
  assert.equal(result.liveConnected, false);
});

test('security() stamps liveConnected: true when explicitly set', () => {
  const result = security({ body: true }, { evidence: [], liveConnected: true, now: fixedNow });
  assert.equal(result.liveConnected, true);
});

test('security() merges body fields into result', () => {
  const result = security({ myField: 42, other: 'hello' }, { evidence: [], now: fixedNow });
  assert.equal(result.myField, 42);
  assert.equal(result.other, 'hello');
});

test('security() sets confidence 0 when no evidence', () => {
  const result = security({}, { evidence: [], now: fixedNow });
  assert.equal(result.confidence, 0);
});

test('security() sets confidence > 0 for connected evidence', () => {
  const ev = evidence('artifact-field', 'foo', 'test', 'src');
  const result = security({}, { evidence: [ev], now: fixedNow });
  assert.ok(result.confidence > 0);
});

test('security() confidence capped at 0.9 for many connected evidence items', () => {
  const evs = Array.from({ length: 20 }, (_, i) => evidence('artifact-field', `e${i}`, 'test', 'src'));
  const result = security({}, { evidence: evs, now: fixedNow });
  assert.ok(result.confidence <= 0.9);
});

test('security() dedupes sources from evidence', () => {
  const ev1 = evidence('artifact-field', 'a', 'test', 'source-X');
  const ev2 = evidence('artifact-field', 'b', 'test', 'source-X');
  const ev3 = evidence('artifact-field', 'c', 'test', 'source-Y');
  const result = security({}, { evidence: [ev1, ev2, ev3], now: fixedNow });
  assert.equal(result.sources.length, 2);
  assert.ok(result.sources.includes('source-X'));
  assert.ok(result.sources.includes('source-Y'));
});

test('security() uses explicit confidence when provided', () => {
  const result = security({}, { evidence: [], confidence: 0.75, now: fixedNow });
  assert.equal(result.confidence, 0.75);
});

test('security() uses explicit sources when provided', () => {
  const result = security({}, { evidence: [], sources: ['my-source'], now: fixedNow });
  assert.deepEqual([...result.sources], ['my-source']);
});

test('confidenceFrom returns 0 for empty evidence', () => {
  assert.equal(confidenceFrom([]), 0);
});

test('confidenceFrom returns 0 for all not-connected evidence', () => {
  const nc = notConnected('foo', 'MY_ENV');
  assert.equal(confidenceFrom([nc]), 0);
});

test('confidenceFrom increases with more connected evidence', () => {
  const ev1 = evidence('artifact-field', 'a', 'test');
  const ev2 = evidence('artifact-field', 'b', 'test');
  const c1 = confidenceFrom([ev1]);
  const c2 = confidenceFrom([ev1, ev2]);
  assert.ok(c2 > c1);
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. SECURITY_RULES INVARIANTS
// ═════════════════════════════════════════════════════════════════════════════

test('SECURITY_RULES has exactly 8 rules (SEC01..SEC08)', () => {
  assert.equal(SECURITY_RULES.length, 8);
});

test('SECURITY_RULES ids are SEC01..SEC08', () => {
  const ids = SECURITY_RULES.map((r) => r.id);
  for (let i = 1; i <= 8; i++) {
    const expected = `SEC0${i}`;
    assert.ok(ids.includes(expected), `missing ${expected}`);
  }
});

test('SECURITY_RULES ids are unique', () => {
  const ids = SECURITY_RULES.map((r) => r.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length);
});

test('all SECURITY_RULES have weight > 0', () => {
  for (const rule of SECURITY_RULES) {
    assert.ok(rule.weight > 0, `rule ${rule.id} has weight <= 0: ${rule.weight}`);
  }
});

test('all SECURITY_RULES severities are valid Severity values', () => {
  for (const rule of SECURITY_RULES) {
    assert.ok(
      VALID_SEVERITIES.includes(rule.severity),
      `rule ${rule.id} has invalid severity: ${rule.severity}`,
    );
  }
});

test('SEC01 is critical with weight 12', () => {
  const rule = SECURITY_RULES.find((r) => r.id === 'SEC01');
  assert.ok(rule);
  assert.equal(rule.severity, 'critical');
  assert.equal(rule.weight, 12);
});

test('SEC02 is critical with weight 10', () => {
  const rule = SECURITY_RULES.find((r) => r.id === 'SEC02');
  assert.ok(rule);
  assert.equal(rule.severity, 'critical');
  assert.equal(rule.weight, 10);
});

test('SEC04 is critical with weight 11', () => {
  const rule = SECURITY_RULES.find((r) => r.id === 'SEC04');
  assert.ok(rule);
  assert.equal(rule.severity, 'critical');
  assert.equal(rule.weight, 11);
});

test('SEC08 is high with weight 9', () => {
  const rule = SECURITY_RULES.find((r) => r.id === 'SEC08');
  assert.ok(rule);
  assert.equal(rule.severity, 'high');
  assert.equal(rule.weight, 9);
});

test('SEC07 has the lowest weight (3)', () => {
  const minWeight = Math.min(...SECURITY_RULES.map((r) => r.weight));
  assert.equal(minWeight, 3);
  const rule = SECURITY_RULES.find((r) => r.weight === 3);
  assert.equal(rule?.id, 'SEC07');
});

test('all SECURITY_RULES have non-empty title, description', () => {
  for (const rule of SECURITY_RULES) {
    assert.ok(rule.title.length > 0, `rule ${rule.id} has empty title`);
    assert.ok(rule.description.length > 0, `rule ${rule.id} has empty description`);
  }
});

// ── SecurityRuleRegistry ──────────────────────────────────────────────────────

test('SecurityRuleRegistry.list() returns all 8 rules', () => {
  const registry = new SecurityRuleRegistry();
  assert.equal(registry.list().length, 8);
});

test('SecurityRuleRegistry.get(SEC01) returns SEC01', () => {
  const registry = new SecurityRuleRegistry();
  const rule = registry.get('SEC01');
  assert.ok(rule);
  assert.equal(rule.id, 'SEC01');
});

test('SecurityRuleRegistry.get(unknown) returns undefined', () => {
  const registry = new SecurityRuleRegistry();
  assert.equal(registry.get('SEC99'), undefined);
});

test('SecurityRuleRegistry.get returns the same rule object as SECURITY_RULES', () => {
  const registry = new SecurityRuleRegistry();
  for (const expected of SECURITY_RULES) {
    const got = registry.get(expected.id);
    assert.ok(got);
    assert.equal(got.id, expected.id);
    assert.equal(got.weight, expected.weight);
    assert.equal(got.severity, expected.severity);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. TYPE-SHAPE SMOKE TESTS
// ═════════════════════════════════════════════════════════════════════════════

test('RiskScoringService.score() returns { risk, health, recommendations }', () => {
  const result = svc.score(emptyInput);
  assert.ok('risk' in result);
  assert.ok('health' in result);
  assert.ok('recommendations' in result);
});

test('SecurityRiskScore shape has all required fields', () => {
  const { risk } = svc.score(emptyInput);
  const r = risk as SecurityRiskScore;
  assert.ok(typeof r.score === 'number');
  assert.ok(typeof r.band === 'string');
  assert.ok(typeof r.criticalCount === 'number');
  assert.ok(typeof r.highCount === 'number');
  assert.ok(typeof r.connectedSignals === 'number');
  assert.ok(typeof r.notConnectedSignals === 'number');
  assert.ok(Array.isArray(r.drivers));
});

test('SecurityHealth shape has all required fields', () => {
  const { health } = svc.score(emptyInput);
  const h = health as SecurityHealth;
  assert.ok(typeof h.band === 'string');
  // score can be null
  assert.ok(h.score === null || typeof h.score === 'number');
  assert.ok(typeof h.connectedSignals === 'number');
  assert.ok(typeof h.notConnectedSignals === 'number');
});

test('SecurityRecommendation shape has all required fields', () => {
  const { recommendations } = svc.score({
    ...emptyInput,
    threats: [makeThreat('SEC01', 'critical')],
  });
  assert.ok(recommendations.length > 0);
  const rec = recommendations[0] as SecurityRecommendation;
  assert.ok(typeof rec.id === 'string');
  assert.ok(typeof rec.rule === 'string');
  assert.strictEqual(rec.advisory, true);
  assert.ok(typeof rec.action === 'string');
  assert.ok(typeof rec.rationale === 'string');
  assert.ok(typeof rec.severity === 'string');
  assert.ok(Array.isArray(rec.evidence));
});

test('risk.score is a number in range [0, 100]', () => {
  const inputs: RiskScoringInput[] = [
    emptyInput,
    { ...emptyInput, threats: [makeThreat('SEC01', 'critical')] },
    {
      ...emptyInput,
      threats: Array.from({ length: 20 }, (_, i) => ({ ...makeThreat('SEC01', 'critical'), id: `t${i}` })),
    },
  ];
  for (const input of inputs) {
    const { risk } = svc.score(input);
    assert.ok(risk.score >= 0 && risk.score <= 100, `score out of range: ${risk.score}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. BAND BOUNDARY TESTS (exact scores)
// ═════════════════════════════════════════════════════════════════════════════

// Boundary at 70 (critical)
test('exact score 70: band critical', () => {
  // 5*SEC01(12)=60 + SEC02(10) = 70
  const threats = [
    ...Array.from({ length: 5 }, (_, i) => ({ ...makeThreat('SEC01', 'critical'), id: `f70-1-${i}` })),
    makeThreat('SEC02', 'critical'),
  ];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 70);
  assert.equal(risk.band, 'critical');
});

test('exact score 71: band critical', () => {
  // 5*SEC01(12)=60 + SEC04(11) = 71
  const threats = [
    ...Array.from({ length: 5 }, (_, i) => ({ ...makeThreat('SEC01', 'critical'), id: `f71-1-${i}` })),
    makeThreat('SEC04', 'critical'),
  ];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 71);
  assert.equal(risk.band, 'critical');
});

// Boundary at 50 (high)
test('exact score 50: band high', () => {
  // 2*SEC01(12)=24 + 2*SEC04(11)=22 + SEC06(4) = 50
  const threats = [
    ...Array.from({ length: 2 }, (_, i) => ({ ...makeThreat('SEC01', 'critical'), id: `f50-1-${i}` })),
    ...Array.from({ length: 2 }, (_, i) => ({ ...makeThreat('SEC04', 'critical'), id: `f50-4-${i}` })),
    makeThreat('SEC06', 'medium'),
  ];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 50);
  assert.equal(risk.band, 'high');
});

test('score 51: band high', () => {
  // 2*SEC01=24 + 2*SEC04=22 + SEC05(7) = 53 nope.
  // Let's get 51: 3*SEC04(11)=33 + SEC02(10)=10 + SEC03(8) = 51 exactly!
  const threats = [
    ...Array.from({ length: 3 }, (_, i) => ({ ...makeThreat('SEC04', 'critical'), id: `f51-4-${i}` })),
    makeThreat('SEC02', 'critical'),
    makeThreat('SEC03', 'high'),
  ];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 51);
  assert.equal(risk.band, 'high');
});

// Boundary at 30 (elevated)
test('exact score 30: band elevated', () => {
  // SEC01(12) + SEC04(11) + SEC05(7) = 30
  const threats = [
    makeThreat('SEC01', 'critical'),
    makeThreat('SEC04', 'critical'),
    makeThreat('SEC05', 'high'),
  ];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 30);
  assert.equal(risk.band, 'elevated');
});

test('score 31: band elevated', () => {
  // SEC01(12) + SEC04(11) + SEC03(8) = 31 exactly!
  const threats = [
    makeThreat('SEC01', 'critical'),
    makeThreat('SEC04', 'critical'),
    makeThreat('SEC03', 'high'),
  ];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 31);
  assert.equal(risk.band, 'elevated');
});

// Boundary at 15 (moderate)
test('exact score 15: band moderate', () => {
  // SEC03(8) + SEC05(7) = 15
  const threats = [makeThreat('SEC03', 'high'), makeThreat('SEC05', 'high')];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 15);
  assert.equal(risk.band, 'moderate');
});

test('score 16: band moderate', () => {
  // SEC03(8) + SEC05(7) + SEC07(3) = 18 nope.
  // SEC02(10) + SEC06(4) + SEC07(3) - 1 = nope.
  // SEC04(11) + SEC07(3) - nope = 14.
  // SEC02(10) + SEC03(8) - nope = 18.
  // SEC05(7) + SEC06(4) + SEC07(3) + SEC06(4) - nope (can't dup).
  // Need exactly 16: SEC02(10) + SEC06(4) - nope=14.
  // SEC03(8)+SEC05(7)+SEC07(3) - nope = 18.
  // SEC01(12)+SEC06(4) = 16!
  const threats = [makeThreat('SEC01', 'critical'), makeThreat('SEC06', 'medium')];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 16);
  assert.equal(risk.band, 'moderate');
});

// Empty input boundaries
test('empty input: risk 0, band low', () => {
  const { risk } = svc.score(emptyInput);
  assert.equal(risk.score, 0);
  assert.equal(risk.band, 'low');
});

test('empty input: health unknown, score null', () => {
  const { health } = svc.score(emptyInput);
  assert.equal(health.band, 'unknown');
  assert.equal(health.score, null);
});

// Just below critical (69 -> high)
test('score 69: band high (just below critical boundary)', () => {
  // 3*SEC01(12)=36 + 3*SEC04(11)=33 = 69 exactly
  const threats = [
    ...Array.from({ length: 3 }, (_, i) => ({ ...makeThreat('SEC01', 'critical'), id: `f69-1-${i}` })),
    ...Array.from({ length: 3 }, (_, i) => ({ ...makeThreat('SEC04', 'critical'), id: `f69-4-${i}` })),
  ];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 69);
  assert.equal(risk.band, 'high');
});

// Just below high (49 -> elevated)
test('score 49: band elevated (just below high boundary)', () => {
  // 2*SEC01(12)=24 + 2*SEC04(11)=22 + SEC07(3) = 49
  const threats = [
    ...Array.from({ length: 2 }, (_, i) => ({ ...makeThreat('SEC01', 'critical'), id: `f49-1-${i}` })),
    ...Array.from({ length: 2 }, (_, i) => ({ ...makeThreat('SEC04', 'critical'), id: `f49-4-${i}` })),
    makeThreat('SEC07', 'medium'),
  ];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 49);
  assert.equal(risk.band, 'elevated');
});

// Just below elevated (29 -> moderate)
test('score 29: band moderate (just below elevated boundary)', () => {
  // SEC04(11) + SEC03(8) + SEC02(10) = 29
  const threats = [
    makeThreat('SEC04', 'critical'),
    makeThreat('SEC03', 'high'),
    makeThreat('SEC02', 'critical'),
  ];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 29);
  assert.equal(risk.band, 'moderate');
});

// Just below moderate (14 -> low)
test('score 14: band low (just below moderate boundary)', () => {
  // SEC05(7) + SEC06(4) + SEC07(3) = 14
  const threats = [
    makeThreat('SEC05', 'high'),
    makeThreat('SEC06', 'medium'),
    makeThreat('SEC07', 'medium'),
  ];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 14);
  assert.equal(risk.band, 'low');
});

/**
 * test/risk.test.ts — RiskScoringService exhaustive unit tests.
 *
 * Covers: weight summation, cap at 100, band boundaries (0/15/30/50/70),
 * health inversion, unknown case, recommendations (distinct rules, advisory literal,
 * SEC08 path advisory), determinism, empty input, driver ordering, counts.
 *
 * Fixed clock: 2026-07-04T00:00:00.000Z (not used by pure scorer — included for parity).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { evidence, notConnected } from '@letbuyy/lcis-core';
import { RiskScoringService, type RiskScoringInput } from '../src/risk/index';
import type {
  AttackPath,
  AbuseSignal,
  ComplianceItem,
  Threat,
  Vulnerability,
} from '../src/shared/types';
import { SECURITY_RULES } from '../src/shared/rules';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeThreat(rule: string, severity: Threat['severity'] = 'high', connection: Threat['connection'] = 'CONNECTED'): Threat {
  return {
    id: `t-${rule}`,
    rule,
    category: 'missing-auth',
    severity,
    subject: `subject-${rule}`,
    title: `Threat ${rule}`,
    detail: `Detail for ${rule}`,
    connection,
    evidence: [evidence('artifact-field', rule, 'test threat', 'test')],
    vector: `vector-${rule}`,
  };
}

function makeVuln(rule: string, connection: Vulnerability['connection'] = 'CONNECTED'): Vulnerability {
  return {
    id: `v-${rule}`,
    rule,
    category: 'missing-validation',
    severity: 'medium',
    subject: `vuln-subject-${rule}`,
    title: `Vuln ${rule}`,
    detail: `Vuln detail ${rule}`,
    connection,
    evidence: [evidence('artifact-field', rule, 'test vuln', 'test')],
    weakness: `weakness-${rule}`,
  };
}

function makeAttackPath(id: string, severity: AttackPath['severity'] = 'high', connection: AttackPath['connection'] = 'CONNECTED'): AttackPath {
  return {
    id,
    entry: `entry-${id}`,
    target: `target-${id}`,
    path: [],
    hops: 1,
    severity,
    connection,
    evidence: [evidence('artifact-field', id, 'attack path', 'test')],
  };
}

function makeAbuseSignal(kind: string): AbuseSignal {
  return {
    kind,
    subject: `abuse-${kind}`,
    detail: `Abuse detail ${kind}`,
    connection: 'NOT_CONNECTED',
    liveSource: 'ABUSE_TELEMETRY_ENDPOINT',
    evidence: [notConnected(`abuse-${kind}`, 'ABUSE_TELEMETRY_ENDPOINT')],
  };
}

function makeCompliance(rule: string, status: ComplianceItem['status'] = 'COMPLIANT'): ComplianceItem {
  return {
    rule,
    title: `Compliance ${rule}`,
    status,
    detail: `Detail ${rule}`,
    evidence: [evidence('artifact-field', rule, 'compliance', 'test')],
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

// ── Weight lookup helpers ──────────────────────────────────────────────────────
function ruleWeight(id: string): number {
  return SECURITY_RULES.find((r) => r.id === id)?.weight ?? 0;
}

const W = {
  SEC01: ruleWeight('SEC01'), // 12
  SEC02: ruleWeight('SEC02'), // 10
  SEC03: ruleWeight('SEC03'), // 8
  SEC04: ruleWeight('SEC04'), // 11
  SEC05: ruleWeight('SEC05'), // 7
  SEC06: ruleWeight('SEC06'), // 4
  SEC07: ruleWeight('SEC07'), // 3
  SEC08: ruleWeight('SEC08'), // 9
};

// ═════════════════════════════════════════════════════════════════════════════
// 1. EMPTY INPUT
// ═════════════════════════════════════════════════════════════════════════════

test('empty input: risk score is 0', () => {
  const { risk } = svc.score(emptyInput);
  assert.equal(risk.score, 0);
});

test('empty input: risk band is low', () => {
  const { risk } = svc.score(emptyInput);
  assert.equal(risk.band, 'low');
});

test('empty input: health band is unknown', () => {
  const { health } = svc.score(emptyInput);
  assert.equal(health.band, 'unknown');
});

test('empty input: health score is null', () => {
  const { health } = svc.score(emptyInput);
  assert.equal(health.score, null);
});

test('empty input: no recommendations', () => {
  const { recommendations } = svc.score(emptyInput);
  assert.equal(recommendations.length, 0);
});

test('empty input: criticalCount = 0', () => {
  const { risk } = svc.score(emptyInput);
  assert.equal(risk.criticalCount, 0);
});

test('empty input: highCount = 0', () => {
  const { risk } = svc.score(emptyInput);
  assert.equal(risk.highCount, 0);
});

test('empty input: connectedSignals = 0', () => {
  const { risk } = svc.score(emptyInput);
  assert.equal(risk.connectedSignals, 0);
});

test('empty input: notConnectedSignals = 0', () => {
  const { risk } = svc.score(emptyInput);
  assert.equal(risk.notConnectedSignals, 0);
});

test('empty input: drivers is empty array', () => {
  const { risk } = svc.score(emptyInput);
  assert.deepEqual([...risk.drivers], []);
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. WEIGHT SUMMATION EXACTNESS
// ═════════════════════════════════════════════════════════════════════════════

test('single SEC01 threat: score = SEC01 weight (12)', () => {
  const { risk } = svc.score({ ...emptyInput, threats: [makeThreat('SEC01', 'critical')] });
  assert.equal(risk.score, W.SEC01);
});

test('single SEC02 threat: score = SEC02 weight (10)', () => {
  const { risk } = svc.score({ ...emptyInput, threats: [makeThreat('SEC02', 'critical')] });
  assert.equal(risk.score, W.SEC02);
});

test('single SEC03 threat: score = SEC03 weight (8)', () => {
  const { risk } = svc.score({ ...emptyInput, threats: [makeThreat('SEC03', 'high')] });
  assert.equal(risk.score, W.SEC03);
});

test('single SEC04 threat: score = SEC04 weight (11)', () => {
  const { risk } = svc.score({ ...emptyInput, threats: [makeThreat('SEC04', 'critical')] });
  assert.equal(risk.score, W.SEC04);
});

test('single SEC05 threat: score = SEC05 weight (7)', () => {
  const { risk } = svc.score({ ...emptyInput, threats: [makeThreat('SEC05', 'high')] });
  assert.equal(risk.score, W.SEC05);
});

test('single SEC06 threat: score = SEC06 weight (4)', () => {
  const { risk } = svc.score({ ...emptyInput, threats: [makeThreat('SEC06', 'medium')] });
  assert.equal(risk.score, W.SEC06);
});

test('single SEC07 threat: score = SEC07 weight (3)', () => {
  const { risk } = svc.score({ ...emptyInput, threats: [makeThreat('SEC07', 'medium')] });
  assert.equal(risk.score, W.SEC07);
});

test('two different rule threats: scores add', () => {
  const { risk } = svc.score({
    ...emptyInput,
    threats: [makeThreat('SEC01', 'critical'), makeThreat('SEC02', 'critical')],
  });
  assert.equal(risk.score, W.SEC01 + W.SEC02); // 22
});

test('two threats with SAME rule: weight counts twice', () => {
  const t1 = makeThreat('SEC01', 'critical');
  const t2 = { ...makeThreat('SEC01', 'critical'), id: 't-SEC01-2' };
  const { risk } = svc.score({ ...emptyInput, threats: [t1, t2] });
  assert.equal(risk.score, W.SEC01 * 2); // 24
});

test('three SEC01 threats: weight counts three times (36)', () => {
  const threats = [0, 1, 2].map((i) => ({ ...makeThreat('SEC01', 'critical'), id: `t-SEC01-${i}` }));
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, W.SEC01 * 3); // 36
});

test('one attack path adds SEC08 weight (9)', () => {
  const { risk } = svc.score({ ...emptyInput, attackPaths: [makeAttackPath('ap1')] });
  assert.equal(risk.score, W.SEC08); // 9
});

test('two attack paths: score = 2 * SEC08 weight (18)', () => {
  const { risk } = svc.score({
    ...emptyInput,
    attackPaths: [makeAttackPath('ap1'), makeAttackPath('ap2')],
  });
  assert.equal(risk.score, W.SEC08 * 2); // 18
});

test('threat + attack path: score = rule weight + SEC08 weight', () => {
  const { risk } = svc.score({
    ...emptyInput,
    threats: [makeThreat('SEC05', 'high')],
    attackPaths: [makeAttackPath('ap1')],
  });
  assert.equal(risk.score, W.SEC05 + W.SEC08); // 16
});

test('unknown rule id in threat: contributes 0 weight', () => {
  const unknownThreat = makeThreat('SEC99', 'high');
  const { risk } = svc.score({ ...emptyInput, threats: [unknownThreat] });
  assert.equal(risk.score, 0);
});

test('vulnerabilities do not contribute to risk score (only threats + paths)', () => {
  const { risk: withVuln } = svc.score({ ...emptyInput, vulnerabilities: [makeVuln('SEC06')] });
  const { risk: base } = svc.score(emptyInput);
  assert.equal(withVuln.score, base.score);
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. CAP AT 100
// ═════════════════════════════════════════════════════════════════════════════

test('many threats: score capped at 100', () => {
  // 10 x SEC01 (weight 12) = 120 raw -> capped at 100
  const threats = Array.from({ length: 10 }, (_, i) => ({
    ...makeThreat('SEC01', 'critical'),
    id: `t-cap-${i}`,
  }));
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 100);
});

test('mixed rules exceeding 100: score capped at 100', () => {
  // SEC01*5 + SEC04*5 = 60 + 55 = 115 -> capped at 100
  const threats = [
    ...Array.from({ length: 5 }, (_, i) => ({ ...makeThreat('SEC01', 'critical'), id: `t1-${i}` })),
    ...Array.from({ length: 5 }, (_, i) => ({ ...makeThreat('SEC04', 'critical'), id: `t4-${i}` })),
  ];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 100);
});

test('capped score: band is critical (100 >= 70)', () => {
  const threats = Array.from({ length: 10 }, (_, i) => ({
    ...makeThreat('SEC01', 'critical'),
    id: `t-capband-${i}`,
  }));
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.band, 'critical');
});

test('capped score: health score is 0', () => {
  const threats = Array.from({ length: 10 }, (_, i) => ({
    ...makeThreat('SEC01', 'critical'),
    id: `t-cap-h-${i}`,
  }));
  const { health } = svc.score({ ...emptyInput, threats });
  assert.equal(health.score, 0);
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. BAND BOUNDARIES (exact values)
// ═════════════════════════════════════════════════════════════════════════════

// Band: critical >= 70, high >= 50, elevated >= 30, moderate >= 15, else low

test('score 70 -> band critical', () => {
  // Need raw sum = 70. Use SEC01(12)*5 + SEC04(11)*... let's build exactly:
  // 5*SEC01=60, 1*SEC04=11 -> 71, too much.
  // Let's use: 5*SEC01(12)=60 + 1*SEC02(10)=10 -> 70 exact.
  const threats = [
    ...Array.from({ length: 5 }, (_, i) => ({ ...makeThreat('SEC01', 'critical'), id: `b70-1-${i}` })),
    makeThreat('SEC02', 'critical'),
  ];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 70);
  assert.equal(risk.band, 'critical');
});

test('score 69 -> band high', () => {
  // 5*SEC01(12)=60 + 1*SEC05(7)=7 -> 67, not 69.
  // 5*SEC01(12)=60 + SEC03(8)=8 + 1/SEC07=? No.
  // 5*SEC01=60 + SEC04(11) - 2 = impossible (fractions not allowed, weights are whole).
  // Instead: 4*SEC04(11)=44 + 2*SEC02(10)=20 + 1*SEC03(8) = 72 too big.
  // Let's try: 4*SEC01(12)=48 + SEC04(11)=11 + SEC05(7)=7 + SEC06(4) - (48+11+7+4=70)  too exact.
  // Use direct attack paths: 7*SEC08(9)=63 + 1*SEC03(8)=71 - still 71.
  // 7*SEC08=63 + SEC05(7) - 1 = nope.
  // Build 69: 7*SEC08(9)=63 + SEC06(4)=4 + SEC07(3) - nope 70.
  // 7*SEC08=63 + SEC06(4)=4 - nope 67.
  // Actually: 5*SEC01(12)=60 + SEC05(7)=7 + SEC06(4) - nope 71.
  // 5*SEC01=60 + SEC07(3)=3 + SEC03(8) - nope 71.
  // 4*SEC01(12)=48 + 2*SEC04(11)=22 - 1 = nope.
  // 4*SEC01=48+2*SEC04=22=70? no 70.
  // Hmm let's use: 5*SEC01=60 + SEC05(7) = 67, not 69.
  // 5*SEC01=60 + SEC06(4)+SEC05(7) = 71, nope.
  // 4*SEC01(12)=48 + SEC04(11)=11 + SEC05(7)=7 = 66.
  // 4*SEC01=48 + 2*SEC04=22 = 70 (boundaries already tested).
  // For score 69: use 4*SEC04(11)=44 + 2*SEC02(10)=20 + 1*SEC03(8)-3 = can't.
  // Use: 3*SEC01(12)=36 + 3*SEC04(11)=33 = 69 exactly!
  const threats = [
    ...Array.from({ length: 3 }, (_, i) => ({ ...makeThreat('SEC01', 'critical'), id: `b69-1-${i}` })),
    ...Array.from({ length: 3 }, (_, i) => ({ ...makeThreat('SEC04', 'critical'), id: `b69-4-${i}` })),
  ];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 69);
  assert.equal(risk.band, 'high');
});

test('score 50 -> band high', () => {
  // 2*SEC01(12)=24 + 2*SEC04(11)=22 + 1*SEC06(4) = 50 exactly
  const threats = [
    ...Array.from({ length: 2 }, (_, i) => ({ ...makeThreat('SEC01', 'critical'), id: `b50-1-${i}` })),
    ...Array.from({ length: 2 }, (_, i) => ({ ...makeThreat('SEC04', 'critical'), id: `b50-4-${i}` })),
    makeThreat('SEC06', 'medium'),
  ];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 50);
  assert.equal(risk.band, 'high');
});

test('score 49 -> band elevated', () => {
  // 2*SEC01(12)=24 + 2*SEC04(11)=22 + 1*SEC07(3) = 49
  const threats = [
    ...Array.from({ length: 2 }, (_, i) => ({ ...makeThreat('SEC01', 'critical'), id: `b49-1-${i}` })),
    ...Array.from({ length: 2 }, (_, i) => ({ ...makeThreat('SEC04', 'critical'), id: `b49-4-${i}` })),
    makeThreat('SEC07', 'medium'),
  ];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 49);
  assert.equal(risk.band, 'elevated');
});

test('score 30 -> band elevated', () => {
  // 2*SEC02(10)=20 + 1*SEC03(8)=8 + SEC06(4) - nope = 32.
  // 2*SEC02(10)=20 + SEC03(8) + SEC06(4) - 2 = nope.
  // 2*SEC04(11)=22 + SEC06(4)=4 + SEC07(3) = 29, nope.
  // 2*SEC04=22 + 1*SEC02(10) - 2 = nope.
  // SEC01(12)+SEC04(11)+SEC05(7) = 30 exactly!
  const threats = [
    makeThreat('SEC01', 'critical'),
    makeThreat('SEC04', 'critical'),
    makeThreat('SEC05', 'high'),
  ];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 30);
  assert.equal(risk.band, 'elevated');
});

test('score 29 -> band moderate', () => {
  // SEC01(12)+SEC04(11)+SEC06(4)+SEC07(3) = 30, nope.
  // SEC01(12)+SEC04(11)+SEC06(4) = 27, nope.
  // SEC01(12)+SEC04(11)+SEC07(3) = 26, nope.
  // Need 29: SEC02(10)*2=20 + SEC05(7)=7 + SEC06(4)=4 - 2 = nope.
  // SEC04(11)+SEC03(8)+SEC02(10) = 29! Let's verify: 11+8+10=29 yes.
  const threats = [
    makeThreat('SEC04', 'critical'),
    makeThreat('SEC03', 'high'),
    makeThreat('SEC02', 'critical'),
  ];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 29);
  assert.equal(risk.band, 'moderate');
});

test('score 15 -> band moderate', () => {
  // SEC02(10)+SEC05(7) = 17 nope.
  // SEC02(10)+SEC06(4)+SEC07(3) - nope 17.
  // SEC03(8)+SEC05(7) = 15 exactly!
  const threats = [
    makeThreat('SEC03', 'high'),
    makeThreat('SEC05', 'high'),
  ];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 15);
  assert.equal(risk.band, 'moderate');
});

test('score 14 -> band low', () => {
  // SEC03(8)+SEC06(4)+SEC07(3) - nope = 15.
  // SEC05(7)+SEC06(4)+SEC07(3) = 14 exactly!
  const threats = [
    makeThreat('SEC05', 'high'),
    makeThreat('SEC06', 'medium'),
    makeThreat('SEC07', 'medium'),
  ];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.score, 14);
  assert.equal(risk.band, 'low');
});

test('score 1 -> band low', () => {
  // Use a tiny weight: none of the rules have weight 1.
  // Create scenario: 1 SEC07 (3) but hold on — we need exactly 1.
  // We can't get 1 from the defined rules. Let's check: min weight is 3 (SEC07).
  // Score 1 is unreachable with the current rules. Let's test score 3 (SEC07 alone).
  const { risk } = svc.score({ ...emptyInput, threats: [makeThreat('SEC07', 'medium')] });
  assert.equal(risk.score, 3);
  assert.equal(risk.band, 'low');
});

test('score 0 -> band low (no threats, no paths)', () => {
  const { risk } = svc.score(emptyInput);
  assert.equal(risk.band, 'low');
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. HEALTH INVERSION
// ═════════════════════════════════════════════════════════════════════════════

test('health score = 100 - risk score when connected signals exist', () => {
  const input = { ...emptyInput, threats: [makeThreat('SEC01', 'critical')] };
  const { risk, health } = svc.score(input);
  assert.equal(health.score, 100 - risk.score);
});

test('health band healthy when risk is low (score 3 -> health 97)', () => {
  const { health } = svc.score({ ...emptyInput, threats: [makeThreat('SEC07', 'medium')] });
  assert.equal(health.score, 97);
  assert.equal(health.band, 'healthy');
});

test('health band healthy at risk 20 (health 80)', () => {
  // SEC01(12)+SEC03(8)=20 -> health=80 -> >= 80 -> healthy
  const { health } = svc.score({
    ...emptyInput,
    threats: [makeThreat('SEC01', 'critical'), makeThreat('SEC03', 'high')],
  });
  assert.equal(health.score, 80);
  assert.equal(health.band, 'healthy');
});

test('health band degraded at risk 30 (health 70)', () => {
  // SEC01(12)+SEC04(11)+SEC05(7)=30 -> health=70 -> >= 50 && < 80 -> degraded
  const threats = [
    makeThreat('SEC01', 'critical'),
    makeThreat('SEC04', 'critical'),
    makeThreat('SEC05', 'high'),
  ];
  const { health } = svc.score({ ...emptyInput, threats });
  assert.equal(health.score, 70);
  assert.equal(health.band, 'degraded');
});

test('health band failing at risk 60 (health 40)', () => {
  // 5*SEC01(12)=60. health=40 -> < 50 -> failing.
  const threats = Array.from({ length: 5 }, (_, i) => ({
    ...makeThreat('SEC01', 'critical'),
    id: `hd-${i}`,
  }));
  const { health } = svc.score({ ...emptyInput, threats });
  assert.equal(health.score, 40);
  assert.equal(health.band, 'failing');
});

test('health band failing at risk 55 (health 45)', () => {
  // 4*SEC01(12)=48+SEC05(7)=7 = 55. health=45 -> < 50 -> failing.
  const threats = [
    ...Array.from({ length: 4 }, (_, i) => ({ ...makeThreat('SEC01', 'critical'), id: `hf-1-${i}` })),
    makeThreat('SEC05', 'high'),
  ];
  const { health } = svc.score({ ...emptyInput, threats });
  assert.equal(health.score, 45);
  assert.equal(health.band, 'failing');
});

test('health band failing at risk 75 (health 25)', () => {
  // Need risk 51..99. Risk 75: 5*SEC01=60 + SEC02(10)+SEC07(3)- nope.
  // 5*SEC01=60+SEC04(11)+SEC06(4) = 75 exactly!
  const threats = [
    ...Array.from({ length: 5 }, (_, i) => ({ ...makeThreat('SEC01', 'critical'), id: `hff-1-${i}` })),
    makeThreat('SEC04', 'critical'),
    makeThreat('SEC06', 'medium'),
  ];
  const { health } = svc.score({ ...emptyInput, threats });
  assert.equal(health.score, 25);
  assert.equal(health.band, 'failing');
});

test('health band unknown: no threats AND no connected signals', () => {
  const { health } = svc.score(emptyInput);
  assert.equal(health.band, 'unknown');
  assert.equal(health.score, null);
});

test('health band NOT unknown when compliance items present even with no threats', () => {
  // Compliance items add to connectedSignals, but threats.length=0 still.
  // Spec: "connectedSignals===0 AND threats.length===0 -> unknown".
  // With compliance items, connectedSignals > 0 but threats.length=0 still satisfies the spec.
  // Wait — re-reading: "if connectedSignals===0 AND threats.length===0 -> band 'unknown'"
  // Compliance counts as connectedSignals. So if compliance.length>0, connectedSignals>0 -> not unknown.
  const input = { ...emptyInput, compliance: [makeCompliance('GDPR-1')] };
  const { health } = svc.score(input);
  assert.equal(health.band, 'healthy'); // risk=0 -> health=100 -> healthy
  assert.equal(health.score, 100);
});

test('health band NOT unknown when only abuseSignals present (not-connected signals)', () => {
  // abuseSignals go to notConnectedSignals but do NOT add to connectedSignals.
  // If threats=0 and connectedSignals=0 (even with abuse signals), it stays unknown.
  const input = { ...emptyInput, abuseSignals: [makeAbuseSignal('brute-force')] };
  const { health } = svc.score(input);
  // connectedSignals=0, threats.length=0 -> unknown
  assert.equal(health.band, 'unknown');
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. SIGNAL COUNTS
// ═════════════════════════════════════════════════════════════════════════════

test('connectedSignals counts CONNECTED threats', () => {
  const input = {
    ...emptyInput,
    threats: [makeThreat('SEC01', 'critical', 'CONNECTED'), makeThreat('SEC02', 'critical', 'CONNECTED')],
  };
  const { risk } = svc.score(input);
  assert.equal(risk.connectedSignals, 2);
});

test('not-connected threats go to notConnectedSignals', () => {
  const input = {
    ...emptyInput,
    threats: [
      makeThreat('SEC01', 'critical', 'CONNECTED'),
      { ...makeThreat('SEC02', 'critical'), connection: 'NOT_CONNECTED' as const },
    ],
  };
  const { risk } = svc.score(input);
  assert.equal(risk.connectedSignals, 1);
  assert.equal(risk.notConnectedSignals, 1);
});

test('vulnerabilities contribute to connectedSignals', () => {
  const input = { ...emptyInput, vulnerabilities: [makeVuln('SEC06', 'CONNECTED')] };
  const { risk } = svc.score(input);
  assert.equal(risk.connectedSignals, 1);
});

test('abuseSignals always go to notConnectedSignals', () => {
  const input = {
    ...emptyInput,
    abuseSignals: [makeAbuseSignal('rate-abuse'), makeAbuseSignal('credential-stuffing')],
  };
  const { risk } = svc.score(input);
  assert.equal(risk.notConnectedSignals, 2);
});

test('compliance items add to connectedSignals', () => {
  const input = {
    ...emptyInput,
    compliance: [makeCompliance('GDPR-1'), makeCompliance('PCI-1')],
  };
  const { risk } = svc.score(input);
  assert.equal(risk.connectedSignals, 2);
});

test('CONNECTED attack paths contribute to connectedSignals', () => {
  const input = {
    ...emptyInput,
    attackPaths: [makeAttackPath('ap1', 'high', 'CONNECTED')],
  };
  const { risk } = svc.score(input);
  assert.equal(risk.connectedSignals, 1);
});

test('NOT_CONNECTED attack paths go to notConnectedSignals', () => {
  const input = {
    ...emptyInput,
    attackPaths: [makeAttackPath('ap1', 'high', 'NOT_CONNECTED')],
  };
  const { risk } = svc.score(input);
  assert.equal(risk.notConnectedSignals, 1);
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. CRITICAL / HIGH COUNTS
// ═════════════════════════════════════════════════════════════════════════════

test('criticalCount: counts critical threats', () => {
  const { risk } = svc.score({
    ...emptyInput,
    threats: [
      makeThreat('SEC01', 'critical'),
      makeThreat('SEC04', 'critical'),
      makeThreat('SEC03', 'high'),
    ],
  });
  assert.equal(risk.criticalCount, 2);
});

test('highCount: counts high threats', () => {
  const { risk } = svc.score({
    ...emptyInput,
    threats: [
      makeThreat('SEC01', 'critical'),
      makeThreat('SEC03', 'high'),
      makeThreat('SEC05', 'high'),
    ],
  });
  assert.equal(risk.highCount, 2);
});

test('criticalCount: includes critical attack paths', () => {
  const { risk } = svc.score({
    ...emptyInput,
    threats: [makeThreat('SEC01', 'critical')],
    attackPaths: [makeAttackPath('ap1', 'critical')],
  });
  assert.equal(risk.criticalCount, 2);
});

test('highCount: includes high attack paths', () => {
  const { risk } = svc.score({
    ...emptyInput,
    attackPaths: [makeAttackPath('ap1', 'high'), makeAttackPath('ap2', 'high')],
  });
  assert.equal(risk.highCount, 2);
});

test('medium threats do not add to criticalCount or highCount', () => {
  const { risk } = svc.score({ ...emptyInput, threats: [makeThreat('SEC06', 'medium')] });
  assert.equal(risk.criticalCount, 0);
  assert.equal(risk.highCount, 0);
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. DRIVERS
// ═════════════════════════════════════════════════════════════════════════════

test('drivers: top rule by contribution appears first', () => {
  // 2*SEC01=24 vs 1*SEC04=11 -> SEC01 first
  const threats = [
    makeThreat('SEC01', 'critical'),
    { ...makeThreat('SEC01', 'critical'), id: 't-SEC01-2' },
    makeThreat('SEC04', 'critical'),
  ];
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.equal(risk.drivers[0], 'SEC01');
});

test('drivers: at most 5 entries', () => {
  // 6 different rules: SEC01..SEC07 (7 rules) -> 5 drivers max
  const threats = ['SEC01','SEC02','SEC03','SEC04','SEC05','SEC06','SEC07'].map(
    (r) => makeThreat(r, 'high')
  );
  const { risk } = svc.score({ ...emptyInput, threats });
  assert.ok(risk.drivers.length <= 5);
});

test('drivers: SEC08 appears when attack paths present', () => {
  const { risk } = svc.score({
    ...emptyInput,
    attackPaths: [makeAttackPath('ap1'), makeAttackPath('ap2')],
  });
  assert.ok(risk.drivers.includes('SEC08'));
});

test('drivers: empty when no threats and no paths', () => {
  const { risk } = svc.score(emptyInput);
  assert.equal(risk.drivers.length, 0);
});

// ═════════════════════════════════════════════════════════════════════════════
// 9. RECOMMENDATIONS — DISTINCT RULES
// ═════════════════════════════════════════════════════════════════════════════

test('one recommendation per distinct threat rule', () => {
  // Two SEC01 threats: only ONE rec for SEC01
  const t1 = makeThreat('SEC01', 'critical');
  const t2 = { ...makeThreat('SEC01', 'critical'), id: 't-SEC01-dup' };
  const { recommendations } = svc.score({ ...emptyInput, threats: [t1, t2] });
  const sec01Recs = recommendations.filter((r) => r.rule === 'SEC01');
  assert.equal(sec01Recs.length, 1);
});

test('distinct rules produce distinct recommendations', () => {
  const threats = [
    makeThreat('SEC01', 'critical'),
    makeThreat('SEC05', 'high'),
    makeThreat('SEC06', 'medium'),
  ];
  const { recommendations } = svc.score({ ...emptyInput, threats });
  assert.equal(recommendations.length, 3);
});

test('no threats: no recommendations', () => {
  const { recommendations } = svc.score(emptyInput);
  assert.equal(recommendations.length, 0);
});

test('SEC08 recommendation added when attack paths present', () => {
  const { recommendations } = svc.score({
    ...emptyInput,
    attackPaths: [makeAttackPath('ap1')],
  });
  const sec08 = recommendations.find((r) => r.rule === 'SEC08');
  assert.ok(sec08);
});

test('SEC08 recommendation NOT duplicated when threat also references SEC08', () => {
  // If a threat already has rule SEC08, the threat-based loop creates SEC08-rec.
  // The attack path branch uses "if (!rulesSeen.has('SEC08'))" so no dup.
  const sec08Threat = makeThreat('SEC08', 'high');
  const { recommendations } = svc.score({
    ...emptyInput,
    threats: [sec08Threat],
    attackPaths: [makeAttackPath('ap1')],
  });
  const sec08Recs = recommendations.filter((r) => r.rule === 'SEC08');
  assert.equal(sec08Recs.length, 1);
});

// ═════════════════════════════════════════════════════════════════════════════
// 10. ADVISORY LITERAL
// ═════════════════════════════════════════════════════════════════════════════

test('every recommendation has advisory: true (literal)', () => {
  const threats = ['SEC01', 'SEC03', 'SEC05'].map((r) => makeThreat(r, 'high'));
  const { recommendations } = svc.score({ ...emptyInput, threats });
  for (const rec of recommendations) {
    assert.strictEqual(rec.advisory, true);
  }
});

test('advisory literal is boolean true, not truthy string', () => {
  const { recommendations } = svc.score({
    ...emptyInput,
    threats: [makeThreat('SEC02', 'critical')],
  });
  assert.ok(recommendations.length > 0);
  assert.strictEqual(typeof recommendations[0].advisory, 'boolean');
  assert.strictEqual(recommendations[0].advisory, true);
});

test('advisory literal present on SEC08 path recommendation', () => {
  const { recommendations } = svc.score({
    ...emptyInput,
    attackPaths: [makeAttackPath('ap1')],
  });
  const sec08Rec = recommendations.find((r) => r.rule === 'SEC08');
  assert.ok(sec08Rec);
  assert.strictEqual(sec08Rec.advisory, true);
});

// ═════════════════════════════════════════════════════════════════════════════
// 11. RECOMMENDATION ID FORMAT
// ═════════════════════════════════════════════════════════════════════════════

test('recommendation ids follow <RULE>-rec pattern', () => {
  const threats = ['SEC01', 'SEC05'].map((r) => makeThreat(r, 'high'));
  const { recommendations } = svc.score({ ...emptyInput, threats });
  for (const rec of recommendations) {
    assert.match(rec.id, /^SEC\d\d-rec$/);
  }
});

test('SEC01-rec id is correct', () => {
  const { recommendations } = svc.score({ ...emptyInput, threats: [makeThreat('SEC01', 'critical')] });
  assert.ok(recommendations.some((r) => r.id === 'SEC01-rec'));
});

test('SEC08-rec id is correct for attack path advisory', () => {
  const { recommendations } = svc.score({ ...emptyInput, attackPaths: [makeAttackPath('ap1')] });
  assert.ok(recommendations.some((r) => r.id === 'SEC08-rec'));
});

// ═════════════════════════════════════════════════════════════════════════════
// 12. RECOMMENDATION SORTING
// ═════════════════════════════════════════════════════════════════════════════

test('recommendations sorted: critical before high before medium', () => {
  const threats = [
    makeThreat('SEC06', 'medium'),    // medium, weight 4
    makeThreat('SEC05', 'high'),      // high, weight 7
    makeThreat('SEC01', 'critical'),  // critical, weight 12
  ];
  const { recommendations } = svc.score({ ...emptyInput, threats });
  assert.equal(recommendations[0].severity, 'critical');
  assert.equal(recommendations[1].severity, 'high');
  assert.equal(recommendations[2].severity, 'medium');
});

test('recommendations with same severity sorted by id ascending', () => {
  // SEC01 and SEC04 are both critical
  const threats = [
    makeThreat('SEC04', 'critical'),
    makeThreat('SEC01', 'critical'),
  ];
  const { recommendations } = svc.score({ ...emptyInput, threats });
  assert.ok(recommendations[0].id <= recommendations[1].id);
});

// ═════════════════════════════════════════════════════════════════════════════
// 13. RECOMMENDATION ACTION TEXT
// ═════════════════════════════════════════════════════════════════════════════

test('recommendation action starts with "Consider remediating"', () => {
  const { recommendations } = svc.score({ ...emptyInput, threats: [makeThreat('SEC01', 'critical')] });
  assert.ok(recommendations[0].action.startsWith('Consider remediating'));
});

test('recommendation rationale cites the count', () => {
  const t1 = makeThreat('SEC01', 'critical');
  const t2 = { ...makeThreat('SEC01', 'critical'), id: 't-SEC01-3' };
  const { recommendations } = svc.score({ ...emptyInput, threats: [t1, t2] });
  const rec = recommendations.find((r) => r.rule === 'SEC01');
  assert.ok(rec);
  assert.ok(rec.rationale.includes('2'));
});

test('recommendation severity matches rule severity', () => {
  const { recommendations } = svc.score({ ...emptyInput, threats: [makeThreat('SEC01', 'critical')] });
  const sec01Rec = recommendations.find((r) => r.rule === 'SEC01');
  assert.ok(sec01Rec);
  // SEC01 rule severity is 'critical'
  assert.equal(sec01Rec.severity, 'critical');
});

// ═════════════════════════════════════════════════════════════════════════════
// 14. DETERMINISM
// ═════════════════════════════════════════════════════════════════════════════

test('score() is deterministic: same input produces same output', () => {
  const input: RiskScoringInput = {
    threats: [makeThreat('SEC01', 'critical'), makeThreat('SEC04', 'critical')],
    vulnerabilities: [makeVuln('SEC06')],
    attackPaths: [makeAttackPath('ap1')],
    abuseSignals: [makeAbuseSignal('brute-force')],
    compliance: [makeCompliance('GDPR-1')],
  };
  const r1 = svc.score(input);
  const r2 = svc.score(input);
  assert.equal(r1.risk.score, r2.risk.score);
  assert.equal(r1.risk.band, r2.risk.band);
  assert.equal(r1.health.score, r2.health.score);
  assert.equal(r1.recommendations.length, r2.recommendations.length);
});

test('new RiskScoringService instance produces same output as existing one', () => {
  const input: RiskScoringInput = {
    threats: [makeThreat('SEC03', 'high')],
    vulnerabilities: [],
    attackPaths: [],
    abuseSignals: [],
    compliance: [],
  };
  const svc2 = new RiskScoringService();
  const r1 = svc.score(input);
  const r2 = svc2.score(input);
  assert.equal(r1.risk.score, r2.risk.score);
  assert.equal(r1.risk.band, r2.risk.band);
});

// ═════════════════════════════════════════════════════════════════════════════
// 15. EDGE CASES
// ═════════════════════════════════════════════════════════════════════════════

test('only vulnerabilities: risk score 0 (vulns do not contribute weight)', () => {
  const { risk } = svc.score({ ...emptyInput, vulnerabilities: [makeVuln('SEC06')] });
  assert.equal(risk.score, 0);
});

test('only compliance items: risk 0, health 100, band healthy', () => {
  const { risk, health } = svc.score({ ...emptyInput, compliance: [makeCompliance('GDPR-1')] });
  assert.equal(risk.score, 0);
  assert.equal(health.score, 100);
  assert.equal(health.band, 'healthy');
});

test('only abuse signals: risk 0, health unknown (no threats, no connected signals)', () => {
  const { risk, health } = svc.score({ ...emptyInput, abuseSignals: [makeAbuseSignal('brute')] });
  assert.equal(risk.score, 0);
  assert.equal(health.band, 'unknown');
});

test('health connectedSignals mirrors risk connectedSignals', () => {
  const input = {
    ...emptyInput,
    threats: [makeThreat('SEC01', 'critical', 'CONNECTED')],
    vulnerabilities: [makeVuln('SEC06', 'NOT_CONNECTED')],
  };
  const { risk, health } = svc.score(input);
  assert.equal(health.connectedSignals, risk.connectedSignals);
  assert.equal(health.notConnectedSignals, risk.notConnectedSignals);
});

test('full mixed input: all fields computed consistently', () => {
  const input: RiskScoringInput = {
    threats: [makeThreat('SEC01', 'critical'), makeThreat('SEC05', 'high')],
    vulnerabilities: [makeVuln('SEC06')],
    attackPaths: [makeAttackPath('ap1', 'high')],
    abuseSignals: [makeAbuseSignal('rate-abuse')],
    compliance: [makeCompliance('GDPR-1', 'VIOLATED')],
  };
  const { risk, health, recommendations } = svc.score(input);
  // SEC01(12) + SEC05(7) + SEC08(9) = 28
  assert.equal(risk.score, 28);
  assert.equal(risk.band, 'moderate');
  assert.equal(health.score, 72);
  assert.equal(health.band, 'degraded');
  // Distinct threat rules: SEC01, SEC05 -> 2 recs + SEC08 for attack paths -> 3 total
  assert.equal(recommendations.length, 3);
});

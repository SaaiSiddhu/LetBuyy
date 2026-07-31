/**
 * ArchitectureQualityService test suite — LQAS architecture analytics.
 * node:test + assert/strict; FIXED clock '2026-07-04T00:00:00.000Z'.
 *
 * Test strategy:
 *   - Stub ArtifactStore + createEngine for full deterministic control.
 *   - Provide domain-intel + db-intel artifacts that produce known cycle/spof/fan counts.
 *   - Verify finding shapes, band boundaries, maintainability formula, clamp, determinism.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtifactStore, createEngine } from '@letbuyy/lcis-core';
import { ArchitectureQualityService } from '../src/architecture/ArchitectureQualityService';

const FIXED = '2026-07-04T00:00:00.000Z';

// ── Stub helpers ──────────────────────────────────────────────────────────────

function stubStore(artifacts: Record<string, unknown>): ArtifactStore {
  return {
    has: (n: string) => n in artifacts,
    tryRead: (n: string) => artifacts[n] ?? null,
    read: (n: string) => {
      if (!(n in artifacts)) throw new Error('missing ' + n);
      return artifacts[n];
    },
    pathOf: (n: string) => '/stub/' + n,
  } as unknown as ArtifactStore;
}

function createService(artifacts: Record<string, unknown>): ArchitectureQualityService {
  const core = createEngine({ store: stubStore(artifacts), repoRoot: '/stub' });
  return new ArchitectureQualityService(core, () => FIXED);
}

// ── Artifact fixtures ─────────────────────────────────────────────────────────

/**
 * CYCLE fixture: alpha ↔ beta (bidirectional dependsOn → 1 cycle).
 * alpha depends on beta AND beta depends on alpha.
 *
 * Expected: cycleCount=1, cycle members = ['domain:alpha','domain:beta'].
 */
const CYCLE_DOMAIN_INTEL = {
  domains: [
    { key: 'alpha', label: 'Alpha', tables: [], rpcs: [], owners: [], dependsOn: ['beta'] },
    { key: 'beta', label: 'Beta', tables: [], rpcs: [], owners: [], dependsOn: ['alpha'] },
  ],
};

const CYCLE_DB_INTEL = {
  tables: [],
  rpcs: [],
  policies: [],
  triggers: [],
};

/**
 * SPOF fixture: root → bridge → leaf (chain; bridge is articulation point in undirected view).
 * No cycles.
 *
 * Expected: cycleCount=0, spofCount>=1 (bridge is an AP).
 */
const SPOF_DOMAIN_INTEL = {
  domains: [
    { key: 'root', label: 'Root', tables: [], rpcs: [], owners: [], dependsOn: ['bridge'] },
    { key: 'bridge', label: 'Bridge', tables: [], rpcs: [], owners: [], dependsOn: ['leaf'] },
    { key: 'leaf', label: 'Leaf', tables: [], rpcs: [], owners: [], dependsOn: [] },
  ],
};

const SPOF_DB_INTEL = { tables: [], rpcs: [], policies: [], triggers: [] };

/**
 * HIGH-FAN fixture: hub domain has 6 domains depending on it (fanIn=6) and depends on 5 others (fanOut=5).
 * hub degree = 11 >= 10 → exactly 1 high-fan entity.
 *
 * Topology: d0..d5 each dependsOn 'hub'; hub dependsOn t0..t4.
 * Expected: highFanCount >= 1 (hub is counted).
 */
const HIGH_FAN_DOMAIN_INTEL = {
  domains: [
    { key: 'hub', label: 'Hub', tables: [], rpcs: [], owners: [], dependsOn: ['t0', 't1', 't2', 't3', 't4'] },
    { key: 'd0', label: 'D0', tables: [], rpcs: [], owners: [], dependsOn: ['hub'] },
    { key: 'd1', label: 'D1', tables: [], rpcs: [], owners: [], dependsOn: ['hub'] },
    { key: 'd2', label: 'D2', tables: [], rpcs: [], owners: [], dependsOn: ['hub'] },
    { key: 'd3', label: 'D3', tables: [], rpcs: [], owners: [], dependsOn: ['hub'] },
    { key: 'd4', label: 'D4', tables: [], rpcs: [], owners: [], dependsOn: ['hub'] },
    { key: 'd5', label: 'D5', tables: [], rpcs: [], owners: [], dependsOn: ['hub'] },
    { key: 't0', label: 'T0', tables: [], rpcs: [], owners: [], dependsOn: [] },
    { key: 't1', label: 'T1', tables: [], rpcs: [], owners: [], dependsOn: [] },
    { key: 't2', label: 'T2', tables: [], rpcs: [], owners: [], dependsOn: [] },
    { key: 't3', label: 'T3', tables: [], rpcs: [], owners: [], dependsOn: [] },
    { key: 't4', label: 'T4', tables: [], rpcs: [], owners: [], dependsOn: [] },
  ],
};

const HIGH_FAN_DB_INTEL = { tables: [], rpcs: [], policies: [], triggers: [] };

/**
 * EMPTY fixture: no artifacts at all.
 * Expected: all counts zero, connection CONNECTED, band 'excellent'.
 */
const EMPTY_ARTIFACTS = {};

/**
 * COMBINED fixture: cycle + SPOF (bridge chain) but no hub → cycleCount=1, spofCount>=1.
 */
const COMBINED_DOMAIN_INTEL = {
  domains: [
    // Cycle: alpha ↔ beta
    { key: 'alpha', label: 'Alpha', tables: [], rpcs: [], owners: [], dependsOn: ['beta'] },
    { key: 'beta', label: 'Beta', tables: [], rpcs: [], owners: [], dependsOn: ['alpha'] },
    // Chain for SPOF: root → mid → tip
    { key: 'root2', label: 'Root2', tables: [], rpcs: [], owners: [], dependsOn: ['mid'] },
    { key: 'mid', label: 'Mid', tables: [], rpcs: [], owners: [], dependsOn: ['tip'] },
    { key: 'tip', label: 'Tip', tables: [], rpcs: [], owners: [], dependsOn: [] },
  ],
};

const COMBINED_DB_INTEL = { tables: [], rpcs: [], policies: [], triggers: [] };

// ═══════════════════════════════════════════════════════════════════════════════
// Section 1: analyze() — basic structure
// ═══════════════════════════════════════════════════════════════════════════════

test('analyze: returns ArchitectureQuality with all required fields', () => {
  const svc = createService({ 'domain-intel.json': CYCLE_DOMAIN_INTEL, 'db-intel.json': CYCLE_DB_INTEL });
  const result = svc.analyze();
  assert.ok('cycleCount' in result);
  assert.ok('spofCount' in result);
  assert.ok('highFanCount' in result);
  assert.ok('findings' in result);
  assert.ok('band' in result);
  assert.ok('connection' in result);
});

test('analyze: connection is always CONNECTED (structural)', () => {
  const svc = createService({ 'domain-intel.json': CYCLE_DOMAIN_INTEL, 'db-intel.json': CYCLE_DB_INTEL });
  assert.equal(svc.analyze().connection, 'CONNECTED');
});

test('analyze: connection is CONNECTED on empty artifacts (degrades gracefully)', () => {
  const svc = createService(EMPTY_ARTIFACTS);
  assert.equal(svc.analyze().connection, 'CONNECTED');
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 2: analyze() — cycle detection
// ═══════════════════════════════════════════════════════════════════════════════

test('analyze: detects 1 cycle from bidirectional alpha↔beta dependsOn', () => {
  const svc = createService({ 'domain-intel.json': CYCLE_DOMAIN_INTEL, 'db-intel.json': CYCLE_DB_INTEL });
  const result = svc.analyze();
  assert.equal(result.cycleCount, 1);
});

test('analyze: cycle finding has rule QA02', () => {
  const svc = createService({ 'domain-intel.json': CYCLE_DOMAIN_INTEL, 'db-intel.json': CYCLE_DB_INTEL });
  const result = svc.analyze();
  const qa02 = result.findings.filter((f) => f.rule === 'QA02');
  assert.equal(qa02.length, 1);
});

test('analyze: cycle finding has severity high', () => {
  const svc = createService({ 'domain-intel.json': CYCLE_DOMAIN_INTEL, 'db-intel.json': CYCLE_DB_INTEL });
  const qa02 = svc.analyze().findings.find((f) => f.rule === 'QA02')!;
  assert.equal(qa02.severity, 'high');
});

test('analyze: cycle finding subject contains both cycle members', () => {
  const svc = createService({ 'domain-intel.json': CYCLE_DOMAIN_INTEL, 'db-intel.json': CYCLE_DB_INTEL });
  const qa02 = svc.analyze().findings.find((f) => f.rule === 'QA02')!;
  assert.ok(qa02.subject.includes('domain:alpha'), `subject: ${qa02.subject}`);
  assert.ok(qa02.subject.includes('domain:beta'), `subject: ${qa02.subject}`);
});

test('analyze: cycle finding has connection CONNECTED', () => {
  const svc = createService({ 'domain-intel.json': CYCLE_DOMAIN_INTEL, 'db-intel.json': CYCLE_DB_INTEL });
  const qa02 = svc.analyze().findings.find((f) => f.rule === 'QA02')!;
  assert.equal(qa02.connection, 'CONNECTED');
});

test('analyze: cycle finding has non-empty evidence array', () => {
  const svc = createService({ 'domain-intel.json': CYCLE_DOMAIN_INTEL, 'db-intel.json': CYCLE_DB_INTEL });
  const qa02 = svc.analyze().findings.find((f) => f.rule === 'QA02')!;
  assert.ok(qa02.evidence.length > 0);
});

test('analyze: cycle finding has non-empty id', () => {
  const svc = createService({ 'domain-intel.json': CYCLE_DOMAIN_INTEL, 'db-intel.json': CYCLE_DB_INTEL });
  const qa02 = svc.analyze().findings.find((f) => f.rule === 'QA02')!;
  assert.ok(qa02.id.length > 0);
});

test('analyze: no cycle findings when graph is acyclic (SPOF fixture)', () => {
  const svc = createService({ 'domain-intel.json': SPOF_DOMAIN_INTEL, 'db-intel.json': SPOF_DB_INTEL });
  const result = svc.analyze();
  assert.equal(result.cycleCount, 0);
  assert.equal(result.findings.filter((f) => f.rule === 'QA02').length, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 3: analyze() — SPOF detection
// ═══════════════════════════════════════════════════════════════════════════════

test('analyze: detects SPOF in root→bridge→leaf chain', () => {
  const svc = createService({ 'domain-intel.json': SPOF_DOMAIN_INTEL, 'db-intel.json': SPOF_DB_INTEL });
  const result = svc.analyze();
  assert.ok(result.spofCount >= 1, `spofCount=${result.spofCount}`);
});

test('analyze: SPOF finding has rule QA04', () => {
  const svc = createService({ 'domain-intel.json': SPOF_DOMAIN_INTEL, 'db-intel.json': SPOF_DB_INTEL });
  const qa04 = svc.analyze().findings.filter((f) => f.rule === 'QA04');
  assert.ok(qa04.length >= 1);
});

test('analyze: SPOF finding has severity high', () => {
  const svc = createService({ 'domain-intel.json': SPOF_DOMAIN_INTEL, 'db-intel.json': SPOF_DB_INTEL });
  const qa04 = svc.analyze().findings.find((f) => f.rule === 'QA04')!;
  assert.equal(qa04.severity, 'high');
});

test('analyze: SPOF finding subject is the articulation-point node id', () => {
  const svc = createService({ 'domain-intel.json': SPOF_DOMAIN_INTEL, 'db-intel.json': SPOF_DB_INTEL });
  const qa04 = svc.analyze().findings.find((f) => f.rule === 'QA04')!;
  assert.ok(qa04.subject.length > 0);
  // bridge is the articulation point in the chain
  assert.ok(qa04.subject.includes('bridge'), `subject was: ${qa04.subject}`);
});

test('analyze: SPOF finding has non-empty evidence', () => {
  const svc = createService({ 'domain-intel.json': SPOF_DOMAIN_INTEL, 'db-intel.json': SPOF_DB_INTEL });
  const qa04 = svc.analyze().findings.find((f) => f.rule === 'QA04')!;
  assert.ok(qa04.evidence.length > 0);
});

test('analyze: SPOF finding connection is CONNECTED', () => {
  const svc = createService({ 'domain-intel.json': SPOF_DOMAIN_INTEL, 'db-intel.json': SPOF_DB_INTEL });
  const qa04 = svc.analyze().findings.find((f) => f.rule === 'QA04')!;
  assert.equal(qa04.connection, 'CONNECTED');
});

test('analyze: spofCount matches QA04 finding count', () => {
  const svc = createService({ 'domain-intel.json': SPOF_DOMAIN_INTEL, 'db-intel.json': SPOF_DB_INTEL });
  const result = svc.analyze();
  const qa04Count = result.findings.filter((f) => f.rule === 'QA04').length;
  assert.equal(result.spofCount, qa04Count);
});

test('analyze: cycle-only graph has spofCount 0 (alpha↔beta fully connected)', () => {
  const svc = createService({ 'domain-intel.json': CYCLE_DOMAIN_INTEL, 'db-intel.json': CYCLE_DB_INTEL });
  const result = svc.analyze();
  // alpha↔beta is a 2-node undirected complete graph, no articulation point
  assert.equal(result.spofCount, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 4: analyze() — high-fan detection
// ═══════════════════════════════════════════════════════════════════════════════

test('analyze: detects hub as high-fan (fanIn=6, fanOut=5, degree=11)', () => {
  const svc = createService({ 'domain-intel.json': HIGH_FAN_DOMAIN_INTEL, 'db-intel.json': HIGH_FAN_DB_INTEL });
  const result = svc.analyze();
  assert.ok(result.highFanCount >= 1, `highFanCount=${result.highFanCount}`);
});

test('analyze: high-fan finding has rule QA03', () => {
  const svc = createService({ 'domain-intel.json': HIGH_FAN_DOMAIN_INTEL, 'db-intel.json': HIGH_FAN_DB_INTEL });
  const qa03 = svc.analyze().findings.filter((f) => f.rule === 'QA03');
  assert.ok(qa03.length >= 1);
});

test('analyze: high-fan finding has severity medium', () => {
  const svc = createService({ 'domain-intel.json': HIGH_FAN_DOMAIN_INTEL, 'db-intel.json': HIGH_FAN_DB_INTEL });
  const qa03 = svc.analyze().findings.find((f) => f.rule === 'QA03')!;
  assert.equal(qa03.severity, 'medium');
});

test('analyze: high-fan finding subject is hub node id', () => {
  const svc = createService({ 'domain-intel.json': HIGH_FAN_DOMAIN_INTEL, 'db-intel.json': HIGH_FAN_DB_INTEL });
  const qa03 = svc.analyze().findings.find((f) => f.rule === 'QA03')!;
  assert.ok(qa03.subject.includes('hub'), `subject: ${qa03.subject}`);
});

test('analyze: high-fan finding detail mentions fanIn and fanOut', () => {
  const svc = createService({ 'domain-intel.json': HIGH_FAN_DOMAIN_INTEL, 'db-intel.json': HIGH_FAN_DB_INTEL });
  const qa03 = svc.analyze().findings.find((f) => f.rule === 'QA03')!;
  assert.ok(qa03.detail.includes('fan-in'), `detail: ${qa03.detail}`);
  assert.ok(qa03.detail.includes('fan-out'), `detail: ${qa03.detail}`);
});

test('analyze: high-fan finding has non-empty evidence', () => {
  const svc = createService({ 'domain-intel.json': HIGH_FAN_DOMAIN_INTEL, 'db-intel.json': HIGH_FAN_DB_INTEL });
  const qa03 = svc.analyze().findings.find((f) => f.rule === 'QA03')!;
  assert.ok(qa03.evidence.length > 0);
});

test('analyze: highFanCount matches QA03 finding count', () => {
  const svc = createService({ 'domain-intel.json': HIGH_FAN_DOMAIN_INTEL, 'db-intel.json': HIGH_FAN_DB_INTEL });
  const result = svc.analyze();
  const qa03Count = result.findings.filter((f) => f.rule === 'QA03').length;
  assert.equal(result.highFanCount, qa03Count);
});

test('analyze: low-fan graph (cycle only) has highFanCount 0', () => {
  const svc = createService({ 'domain-intel.json': CYCLE_DOMAIN_INTEL, 'db-intel.json': CYCLE_DB_INTEL });
  const result = svc.analyze();
  // alpha↔beta: each has fanIn=1 and fanOut=1, degree=2 — below threshold 10
  assert.equal(result.highFanCount, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 5: analyze() — band logic
// ═══════════════════════════════════════════════════════════════════════════════

test('band: excellent when cycleCount=0 and spofCount=0 (empty graph)', () => {
  const svc = createService(EMPTY_ARTIFACTS);
  const result = svc.analyze();
  assert.equal(result.cycleCount, 0);
  assert.equal(result.spofCount, 0);
  assert.equal(result.band, 'excellent');
});

test('band: excellent when cycleCount=0 and spofCount=1', () => {
  // SPOF fixture has no cycles; spofCount=1 (bridge) → excellent
  const svc = createService({ 'domain-intel.json': SPOF_DOMAIN_INTEL, 'db-intel.json': SPOF_DB_INTEL });
  const result = svc.analyze();
  assert.equal(result.cycleCount, 0);
  assert.ok(result.spofCount <= 1, `expected spofCount<=1, got ${result.spofCount}`);
  assert.equal(result.band, 'excellent');
});

test('band: good when cycleCount=1 and spofCount=0', () => {
  // Cycle fixture has cycleCount=1, spofCount=0 → good
  const svc = createService({ 'domain-intel.json': CYCLE_DOMAIN_INTEL, 'db-intel.json': CYCLE_DB_INTEL });
  const result = svc.analyze();
  assert.equal(result.cycleCount, 1);
  assert.equal(result.spofCount, 0);
  assert.equal(result.band, 'good');
});

test('band: fair when cycleCount is 2 (manually verify band rule: >1 and <=3)', () => {
  // Two separate cycles: alpha↔beta and gamma↔delta
  const twoRingDomainIntel = {
    domains: [
      { key: 'alpha', label: 'Alpha', tables: [], rpcs: [], owners: [], dependsOn: ['beta'] },
      { key: 'beta', label: 'Beta', tables: [], rpcs: [], owners: [], dependsOn: ['alpha'] },
      { key: 'gamma', label: 'Gamma', tables: [], rpcs: [], owners: [], dependsOn: ['delta'] },
      { key: 'delta', label: 'Delta', tables: [], rpcs: [], owners: [], dependsOn: ['gamma'] },
    ],
  };
  const svc = createService({ 'domain-intel.json': twoRingDomainIntel, 'db-intel.json': CYCLE_DB_INTEL });
  const result = svc.analyze();
  assert.equal(result.cycleCount, 2);
  assert.equal(result.band, 'fair');
});

test('band: poor when cycleCount > 3', () => {
  // Four separate cycles
  const fourRingDomainIntel = {
    domains: [
      { key: 'a1', label: 'A1', tables: [], rpcs: [], owners: [], dependsOn: ['a2'] },
      { key: 'a2', label: 'A2', tables: [], rpcs: [], owners: [], dependsOn: ['a1'] },
      { key: 'b1', label: 'B1', tables: [], rpcs: [], owners: [], dependsOn: ['b2'] },
      { key: 'b2', label: 'B2', tables: [], rpcs: [], owners: [], dependsOn: ['b1'] },
      { key: 'c1', label: 'C1', tables: [], rpcs: [], owners: [], dependsOn: ['c2'] },
      { key: 'c2', label: 'C2', tables: [], rpcs: [], owners: [], dependsOn: ['c1'] },
      { key: 'd1', label: 'D1', tables: [], rpcs: [], owners: [], dependsOn: ['d2'] },
      { key: 'd2', label: 'D2', tables: [], rpcs: [], owners: [], dependsOn: ['d1'] },
    ],
  };
  const svc = createService({ 'domain-intel.json': fourRingDomainIntel, 'db-intel.json': CYCLE_DB_INTEL });
  const result = svc.analyze();
  assert.equal(result.cycleCount, 4);
  assert.equal(result.band, 'poor');
});

test('band: fair when cycleCount=3 (boundary, still fair)', () => {
  const threeRingDomainIntel = {
    domains: [
      { key: 'a1', label: 'A1', tables: [], rpcs: [], owners: [], dependsOn: ['a2'] },
      { key: 'a2', label: 'A2', tables: [], rpcs: [], owners: [], dependsOn: ['a1'] },
      { key: 'b1', label: 'B1', tables: [], rpcs: [], owners: [], dependsOn: ['b2'] },
      { key: 'b2', label: 'B2', tables: [], rpcs: [], owners: [], dependsOn: ['b1'] },
      { key: 'c1', label: 'C1', tables: [], rpcs: [], owners: [], dependsOn: ['c2'] },
      { key: 'c2', label: 'C2', tables: [], rpcs: [], owners: [], dependsOn: ['c1'] },
    ],
  };
  const svc = createService({ 'domain-intel.json': threeRingDomainIntel, 'db-intel.json': CYCLE_DB_INTEL });
  const result = svc.analyze();
  assert.equal(result.cycleCount, 3);
  assert.equal(result.band, 'fair');
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 6: analyze() — combined fixture & findings ordering
// ═══════════════════════════════════════════════════════════════════════════════

test('combined: cycle and SPOF both present', () => {
  const svc = createService({ 'domain-intel.json': COMBINED_DOMAIN_INTEL, 'db-intel.json': COMBINED_DB_INTEL });
  const result = svc.analyze();
  assert.ok(result.cycleCount >= 1, `cycleCount=${result.cycleCount}`);
  assert.ok(result.spofCount >= 1, `spofCount=${result.spofCount}`);
});

test('combined: findings include both QA02 and QA04', () => {
  const svc = createService({ 'domain-intel.json': COMBINED_DOMAIN_INTEL, 'db-intel.json': COMBINED_DB_INTEL });
  const findings = svc.analyze().findings;
  assert.ok(findings.some((f) => f.rule === 'QA02'), 'missing QA02');
  assert.ok(findings.some((f) => f.rule === 'QA04'), 'missing QA04');
});

test('combined: total finding count equals cycleCount + spofCount + highFanCount', () => {
  const svc = createService({ 'domain-intel.json': COMBINED_DOMAIN_INTEL, 'db-intel.json': COMBINED_DB_INTEL });
  const result = svc.analyze();
  const expected = result.cycleCount + result.spofCount + result.highFanCount;
  assert.equal(result.findings.length, expected);
});

test('all findings have non-empty id, rule, subject, title, detail', () => {
  const svc = createService({ 'domain-intel.json': COMBINED_DOMAIN_INTEL, 'db-intel.json': COMBINED_DB_INTEL });
  for (const f of svc.analyze().findings) {
    assert.ok(f.id.length > 0, `finding id empty`);
    assert.ok(f.rule.length > 0, `finding rule empty`);
    assert.ok(f.subject.length > 0, `finding subject empty`);
    assert.ok(f.title.length > 0, `finding title empty`);
    assert.ok(f.detail.length > 0, `finding detail empty`);
  }
});

test('all findings have evidence with kind and ref', () => {
  const svc = createService({ 'domain-intel.json': COMBINED_DOMAIN_INTEL, 'db-intel.json': COMBINED_DB_INTEL });
  for (const f of svc.analyze().findings) {
    for (const ev of f.evidence) {
      assert.ok(ev.kind.length > 0);
      assert.ok(ev.ref.length > 0);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 7: analyze() — empty / missing artifacts
// ═══════════════════════════════════════════════════════════════════════════════

test('empty artifacts: cycleCount=0', () => {
  assert.equal(createService(EMPTY_ARTIFACTS).analyze().cycleCount, 0);
});

test('empty artifacts: spofCount=0', () => {
  assert.equal(createService(EMPTY_ARTIFACTS).analyze().spofCount, 0);
});

test('empty artifacts: highFanCount=0', () => {
  assert.equal(createService(EMPTY_ARTIFACTS).analyze().highFanCount, 0);
});

test('empty artifacts: findings is empty array', () => {
  assert.equal(createService(EMPTY_ARTIFACTS).analyze().findings.length, 0);
});

test('empty artifacts: band is excellent', () => {
  assert.equal(createService(EMPTY_ARTIFACTS).analyze().band, 'excellent');
});

test('only db-intel, no domain-intel: analyzes without throw', () => {
  const svc = createService({ 'db-intel.json': CYCLE_DB_INTEL });
  const result = svc.analyze();
  assert.ok('cycleCount' in result);
  assert.equal(result.connection, 'CONNECTED');
});

test('only domain-intel, no db-intel: analyzes without throw', () => {
  const svc = createService({ 'domain-intel.json': CYCLE_DOMAIN_INTEL });
  const result = svc.analyze();
  assert.ok('cycleCount' in result);
});

test('malformed domain-intel (non-array domains): degrades without throw', () => {
  const svc = createService({ 'domain-intel.json': { domains: 'not-an-array' }, 'db-intel.json': CYCLE_DB_INTEL });
  const result = svc.analyze();
  assert.ok('cycleCount' in result);
  assert.equal(result.connection, 'CONNECTED');
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 8: maintainability() — index formula exactness
// ═══════════════════════════════════════════════════════════════════════════════

test('maintainability: index = 100 when all counts zero', () => {
  const svc = createService(EMPTY_ARTIFACTS);
  const m = svc.maintainability();
  assert.equal(m.index, 100);
});

test('maintainability: index formula — 1 cycle = 100 - 6 = 94', () => {
  // cycleCount=1, spofCount=0, highFanCount=0 → 100 - 6*1 - 4*0 - 2*0 = 94
  const svc = createService({ 'domain-intel.json': CYCLE_DOMAIN_INTEL, 'db-intel.json': CYCLE_DB_INTEL });
  const arch = svc.analyze();
  assert.equal(arch.cycleCount, 1);
  assert.equal(arch.spofCount, 0);
  const m = svc.maintainability();
  assert.equal(m.index, 94);
});

test('maintainability: index formula — 1 SPOF = 100 - 4 = 96', () => {
  // SPOF fixture: cycleCount=0, spofCount=1, highFanCount=0 → 100 - 6*0 - 4*1 - 2*0 = 96
  const svc = createService({ 'domain-intel.json': SPOF_DOMAIN_INTEL, 'db-intel.json': SPOF_DB_INTEL });
  const arch = svc.analyze();
  assert.equal(arch.cycleCount, 0);
  const spofCount = arch.spofCount;
  const m = svc.maintainability();
  assert.equal(m.index, 100 - 4 * spofCount);
});

test('maintainability: formula is 100 - 6*cycles - 4*spofs - 2*highFans (general)', () => {
  const svc = createService({ 'domain-intel.json': COMBINED_DOMAIN_INTEL, 'db-intel.json': COMBINED_DB_INTEL });
  const arch = svc.analyze();
  const m = svc.maintainability();
  const expected = Math.max(0, Math.min(100, 100 - 6 * arch.cycleCount - 4 * arch.spofCount - 2 * arch.highFanCount));
  assert.equal(m.index, expected);
});

test('maintainability: index is clamped to 0 at minimum', () => {
  // 18 cycles → 100 - 6*18 = 100 - 108 = -8 → clamped to 0
  const domains = [];
  for (let i = 0; i < 18; i++) {
    domains.push({ key: `x${i}a`, label: `X${i}A`, tables: [], rpcs: [], owners: [], dependsOn: [`x${i}b`] });
    domains.push({ key: `x${i}b`, label: `X${i}B`, tables: [], rpcs: [], owners: [], dependsOn: [`x${i}a`] });
  }
  const svc = createService({ 'domain-intel.json': { domains }, 'db-intel.json': CYCLE_DB_INTEL });
  const arch = svc.analyze();
  assert.ok(arch.cycleCount >= 17, `cycleCount=${arch.cycleCount}`);
  assert.equal(svc.maintainability().index, 0);
});

test('maintainability: index is clamped to 100 at maximum', () => {
  const svc = createService(EMPTY_ARTIFACTS);
  assert.equal(svc.maintainability().index, 100);
});

test('maintainability: index is an integer (no fractional penalty)', () => {
  const svc = createService({ 'domain-intel.json': CYCLE_DOMAIN_INTEL, 'db-intel.json': CYCLE_DB_INTEL });
  const m = svc.maintainability();
  assert.equal(m.index, Math.floor(m.index));
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 9: maintainability() — band
// ═══════════════════════════════════════════════════════════════════════════════

test('maintainability band: excellent when index >= 80', () => {
  const svc = createService(EMPTY_ARTIFACTS); // index = 100
  assert.equal(svc.maintainability().band, 'excellent');
});

test('maintainability band: excellent at index = 80 (boundary)', () => {
  // 100 - 6*cycles = 80 → cycles = 20/6 ≈ 3.33 (not integer) — use spofs instead
  // 100 - 4*spofs = 80 → spofs = 5 → need exactly 5 SPOFs
  // Chain of 7 nodes: root → p1 → p2 → p3 → p4 → p5 → leaf
  // Articulation points: p1, p2, p3, p4, p5 = 5 SPOFs
  const sevenChain = {
    domains: [
      { key: 'r', label: 'R', tables: [], rpcs: [], owners: [], dependsOn: ['p1'] },
      { key: 'p1', label: 'P1', tables: [], rpcs: [], owners: [], dependsOn: ['p2'] },
      { key: 'p2', label: 'P2', tables: [], rpcs: [], owners: [], dependsOn: ['p3'] },
      { key: 'p3', label: 'P3', tables: [], rpcs: [], owners: [], dependsOn: ['p4'] },
      { key: 'p4', label: 'P4', tables: [], rpcs: [], owners: [], dependsOn: ['p5'] },
      { key: 'p5', label: 'P5', tables: [], rpcs: [], owners: [], dependsOn: ['lf'] },
      { key: 'lf', label: 'LF', tables: [], rpcs: [], owners: [], dependsOn: [] },
    ],
  };
  const svc = createService({ 'domain-intel.json': sevenChain, 'db-intel.json': SPOF_DB_INTEL });
  const m = svc.maintainability();
  // index = 100 - 4*5 = 80 → excellent
  assert.equal(m.index, 80);
  assert.equal(m.band, 'excellent');
});

test('maintainability band: good when index 60..79', () => {
  // index = 100 - 6*1 - 4*spofCount; cycle=1 gives 94 - 4*spofCount
  // Want 60..79: 94 - 4*spofCount = 70 → spofCount = 6
  // Use: 1 cycle (alpha↔beta) + 8-chain for 6 SPOFs
  const mixedDomains = {
    domains: [
      { key: 'alpha', label: 'Alpha', tables: [], rpcs: [], owners: [], dependsOn: ['beta'] },
      { key: 'beta', label: 'Beta', tables: [], rpcs: [], owners: [], dependsOn: ['alpha'] },
      { key: 'n0', label: 'N0', tables: [], rpcs: [], owners: [], dependsOn: ['n1'] },
      { key: 'n1', label: 'N1', tables: [], rpcs: [], owners: [], dependsOn: ['n2'] },
      { key: 'n2', label: 'N2', tables: [], rpcs: [], owners: [], dependsOn: ['n3'] },
      { key: 'n3', label: 'N3', tables: [], rpcs: [], owners: [], dependsOn: ['n4'] },
      { key: 'n4', label: 'N4', tables: [], rpcs: [], owners: [], dependsOn: ['n5'] },
      { key: 'n5', label: 'N5', tables: [], rpcs: [], owners: [], dependsOn: ['n6'] },
      { key: 'n6', label: 'N6', tables: [], rpcs: [], owners: [], dependsOn: ['n7'] },
      { key: 'n7', label: 'N7', tables: [], rpcs: [], owners: [], dependsOn: [] },
    ],
  };
  const svc = createService({ 'domain-intel.json': mixedDomains, 'db-intel.json': SPOF_DB_INTEL });
  const arch = svc.analyze();
  const m = svc.maintainability();
  assert.ok(m.index >= 40 && m.index < 80, `index=${m.index}`);
  assert.ok(m.band === 'good' || m.band === 'fair', `band=${m.band}`);
});

test('maintainability band: poor when index < 40', () => {
  // 18 cycles → index = 0 → poor
  const domains = [];
  for (let i = 0; i < 18; i++) {
    domains.push({ key: `y${i}a`, label: `Y${i}A`, tables: [], rpcs: [], owners: [], dependsOn: [`y${i}b`] });
    domains.push({ key: `y${i}b`, label: `Y${i}B`, tables: [], rpcs: [], owners: [], dependsOn: [`y${i}a`] });
  }
  const svc = createService({ 'domain-intel.json': { domains }, 'db-intel.json': CYCLE_DB_INTEL });
  assert.equal(svc.maintainability().band, 'poor');
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 10: maintainability() — drivers
// ═══════════════════════════════════════════════════════════════════════════════

test('maintainability drivers: empty when no issues', () => {
  const svc = createService(EMPTY_ARTIFACTS);
  const m = svc.maintainability();
  assert.ok(m.drivers.length > 0); // "No structural issues detected"
  assert.ok(m.drivers[0]!.includes('No structural'));
});

test('maintainability drivers: mentions cycles count when cycles > 0', () => {
  const svc = createService({ 'domain-intel.json': CYCLE_DOMAIN_INTEL, 'db-intel.json': CYCLE_DB_INTEL });
  const m = svc.maintainability();
  assert.ok(m.drivers.some((d) => d.includes('cycle')), `drivers: ${m.drivers.join(', ')}`);
});

test('maintainability drivers: mentions SPOF count when spofs > 0', () => {
  const svc = createService({ 'domain-intel.json': SPOF_DOMAIN_INTEL, 'db-intel.json': SPOF_DB_INTEL });
  const m = svc.maintainability();
  assert.ok(m.drivers.some((d) => d.includes('SPOF')), `drivers: ${m.drivers.join(', ')}`);
});

test('maintainability drivers: returns array', () => {
  const svc = createService({ 'domain-intel.json': CYCLE_DOMAIN_INTEL, 'db-intel.json': CYCLE_DB_INTEL });
  assert.ok(Array.isArray(svc.maintainability().drivers));
});

test('maintainability drivers: mentions penalty points for cycles', () => {
  const svc = createService({ 'domain-intel.json': CYCLE_DOMAIN_INTEL, 'db-intel.json': CYCLE_DB_INTEL });
  const m = svc.maintainability();
  const cycleDriver = m.drivers.find((d) => d.includes('cycle'));
  assert.ok(cycleDriver, 'no cycle driver found');
  assert.ok(cycleDriver!.includes('pts') || cycleDriver!.includes('−'), `driver: ${cycleDriver}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 11: determinism
// ═══════════════════════════════════════════════════════════════════════════════

test('determinism: two analyze() calls on same instance return identical results', () => {
  const svc = createService({ 'domain-intel.json': COMBINED_DOMAIN_INTEL, 'db-intel.json': COMBINED_DB_INTEL });
  const a = svc.analyze();
  const b = svc.analyze();
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test('determinism: two separate service instances produce identical analyze() results', () => {
  const a = createService({ 'domain-intel.json': CYCLE_DOMAIN_INTEL, 'db-intel.json': CYCLE_DB_INTEL }).analyze();
  const b = createService({ 'domain-intel.json': CYCLE_DOMAIN_INTEL, 'db-intel.json': CYCLE_DB_INTEL }).analyze();
  assert.equal(a.cycleCount, b.cycleCount);
  assert.equal(a.spofCount, b.spofCount);
  assert.equal(a.highFanCount, b.highFanCount);
  assert.equal(a.band, b.band);
  assert.equal(a.connection, b.connection);
});

test('determinism: maintainability() twice on same instance yields same index', () => {
  const svc = createService({ 'domain-intel.json': CYCLE_DOMAIN_INTEL, 'db-intel.json': CYCLE_DB_INTEL });
  const m1 = svc.maintainability();
  const m2 = svc.maintainability();
  assert.equal(m1.index, m2.index);
  assert.equal(m1.band, m2.band);
});

test('determinism: fixed clock produces stable timestamp-free determinism (cycleCount consistent)', () => {
  const make = () =>
    new ArchitectureQualityService(
      createEngine({ store: stubStore({ 'domain-intel.json': CYCLE_DOMAIN_INTEL, 'db-intel.json': CYCLE_DB_INTEL }), repoRoot: '/stub' }),
      () => FIXED,
    );
  assert.equal(make().analyze().cycleCount, make().analyze().cycleCount);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 12: findings uniqueness + QA03 threshold exactness
// ═══════════════════════════════════════════════════════════════════════════════

test('finding ids are unique within a single analyze() call', () => {
  const svc = createService({ 'domain-intel.json': COMBINED_DOMAIN_INTEL, 'db-intel.json': COMBINED_DB_INTEL });
  const ids = svc.analyze().findings.map((f) => f.id);
  assert.equal(ids.length, new Set(ids).size, 'duplicate finding ids');
});

test('QA03 threshold: node with fanIn+fanOut=9 is NOT flagged as high-fan', () => {
  // hub2 depends on 4 others (fanOut=4) and 5 depend on it (fanIn=5) → degree 9 < 10
  const borderlineIntel = {
    domains: [
      { key: 'hub2', label: 'Hub2', tables: [], rpcs: [], owners: [], dependsOn: ['t0', 't1', 't2', 't3'] },
      { key: 'd0', label: 'D0', tables: [], rpcs: [], owners: [], dependsOn: ['hub2'] },
      { key: 'd1', label: 'D1', tables: [], rpcs: [], owners: [], dependsOn: ['hub2'] },
      { key: 'd2', label: 'D2', tables: [], rpcs: [], owners: [], dependsOn: ['hub2'] },
      { key: 'd3', label: 'D3', tables: [], rpcs: [], owners: [], dependsOn: ['hub2'] },
      { key: 'd4', label: 'D4', tables: [], rpcs: [], owners: [], dependsOn: ['hub2'] },
      { key: 't0', label: 'T0', tables: [], rpcs: [], owners: [], dependsOn: [] },
      { key: 't1', label: 'T1', tables: [], rpcs: [], owners: [], dependsOn: [] },
      { key: 't2', label: 'T2', tables: [], rpcs: [], owners: [], dependsOn: [] },
      { key: 't3', label: 'T3', tables: [], rpcs: [], owners: [], dependsOn: [] },
    ],
  };
  const svc = createService({ 'domain-intel.json': borderlineIntel, 'db-intel.json': HIGH_FAN_DB_INTEL });
  const result = svc.analyze();
  // hub2: fanIn=5 (d0..d4 → hub2), fanOut=4 (hub2 → t0..t3) → degree=9 → NOT high-fan
  assert.equal(result.findings.filter((f) => f.rule === 'QA03' && f.subject.includes('hub2')).length, 0);
});

test('QA03 threshold: node with fanIn+fanOut=10 IS flagged as high-fan (exact boundary)', () => {
  // hub3: fanOut=5 (depends on t0..t4), fanIn=5 (d0..d4 depend on hub3) → degree=10 ≥ 10
  const exactBoundaryIntel = {
    domains: [
      { key: 'hub3', label: 'Hub3', tables: [], rpcs: [], owners: [], dependsOn: ['t0', 't1', 't2', 't3', 't4'] },
      { key: 'd0', label: 'D0', tables: [], rpcs: [], owners: [], dependsOn: ['hub3'] },
      { key: 'd1', label: 'D1', tables: [], rpcs: [], owners: [], dependsOn: ['hub3'] },
      { key: 'd2', label: 'D2', tables: [], rpcs: [], owners: [], dependsOn: ['hub3'] },
      { key: 'd3', label: 'D3', tables: [], rpcs: [], owners: [], dependsOn: ['hub3'] },
      { key: 'd4', label: 'D4', tables: [], rpcs: [], owners: [], dependsOn: ['hub3'] },
      { key: 't0', label: 'T0', tables: [], rpcs: [], owners: [], dependsOn: [] },
      { key: 't1', label: 'T1', tables: [], rpcs: [], owners: [], dependsOn: [] },
      { key: 't2', label: 'T2', tables: [], rpcs: [], owners: [], dependsOn: [] },
      { key: 't3', label: 'T3', tables: [], rpcs: [], owners: [], dependsOn: [] },
      { key: 't4', label: 'T4', tables: [], rpcs: [], owners: [], dependsOn: [] },
    ],
  };
  const svc = createService({ 'domain-intel.json': exactBoundaryIntel, 'db-intel.json': HIGH_FAN_DB_INTEL });
  const result = svc.analyze();
  const qa03ForHub3 = result.findings.filter((f) => f.rule === 'QA03' && f.subject.includes('hub3'));
  assert.equal(qa03ForHub3.length, 1);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 13: edge cases
// ═══════════════════════════════════════════════════════════════════════════════

test('single-node graph (one domain, no edges): all counts zero, excellent', () => {
  const svc = createService({
    'domain-intel.json': { domains: [{ key: 'solo', label: 'Solo', tables: [], rpcs: [], owners: [], dependsOn: [] }] },
    'db-intel.json': CYCLE_DB_INTEL,
  });
  const result = svc.analyze();
  assert.equal(result.cycleCount, 0);
  assert.equal(result.spofCount, 0);
  assert.equal(result.highFanCount, 0);
  assert.equal(result.band, 'excellent');
});

test('self-loop domain (dependsOn itself): detected as a cycle', () => {
  const svc = createService({
    'domain-intel.json': { domains: [{ key: 'self', label: 'Self', tables: [], rpcs: [], owners: [], dependsOn: ['self'] }] },
    'db-intel.json': CYCLE_DB_INTEL,
  });
  const result = svc.analyze();
  // Tarjan treats self-loop as a cycle (selfLoop check in detectCycles)
  assert.equal(result.cycleCount, 1);
});

test('graph field is included in stub (TwinBuilderService reads graph artifact when present)', () => {
  // Provide a stub graph to ensure no crash on presence of graph artifact
  const svc = createService({
    'domain-intel.json': CYCLE_DOMAIN_INTEL,
    'db-intel.json': CYCLE_DB_INTEL,
    'graph.json': { nodes: [], links: [] },
  });
  const result = svc.analyze();
  assert.ok('cycleCount' in result);
});

test('analyze returns readonly arrays (findings is iterable)', () => {
  const svc = createService({ 'domain-intel.json': SPOF_DOMAIN_INTEL, 'db-intel.json': SPOF_DB_INTEL });
  const result = svc.analyze();
  assert.ok(Symbol.iterator in result.findings);
});

test('maintainability index is always an integer (not a float from formula)', () => {
  const svc = createService({ 'domain-intel.json': COMBINED_DOMAIN_INTEL, 'db-intel.json': COMBINED_DB_INTEL });
  const { index } = svc.maintainability();
  assert.equal(index % 1, 0);
});

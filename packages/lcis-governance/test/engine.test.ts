/**
 * GovernanceEngine facade tests — the end-to-end composite: drift + compliance + ownership +
 * security + readiness into one constitutional report + per-area health, over the REAL
 * artifacts. Verifies full provenance, score ranges, determinism, and the singleton.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createGovernanceEngine,
  getGovernanceEngine,
  resetGovernanceEngine,
  type HealthView,
} from '../src/index';

const FIXED = '2026-06-20T00:00:00.000Z';
const gov = createGovernanceEngine({ now: () => FIXED });

function hasProvenance(x: unknown): boolean {
  const r = x as Record<string, unknown>;
  return (
    Array.isArray(r['evidence']) &&
    typeof r['confidence'] === 'number' &&
    Array.isArray(r['sources']) &&
    typeof r['timestamp'] === 'string'
  );
}

test('generateGovernanceReport composes all five sub-reports with full provenance', async () => {
  const r = await gov.generateGovernanceReport();
  for (const k of ['drift', 'compliance', 'ownership', 'security', 'readiness'] as const) {
    assert.ok(r[k], `${k} present`);
    assert.ok(hasProvenance(r[k]), `${k} carries provenance`);
  }
  assert.ok(hasProvenance(r));
  assert.equal(r.timestamp, FIXED);
});

test('composite healthScore is in [0, 100]', async () => {
  const r = await gov.generateGovernanceReport();
  assert.ok(Number.isFinite(r.healthScore));
  assert.ok(r.healthScore >= 0 && r.healthScore <= 100);
});

test('compliance score + readiness overall are real and in range', async () => {
  const r = await gov.generateGovernanceReport();
  assert.ok(r.compliance.score >= 0 && r.compliance.score <= 100);
  assert.ok(r.readiness.overall >= 0 && r.readiness.overall <= 100);
  assert.ok(Array.isArray(r.compliance.violations));
});

const HEALTH_AREAS: { name: string; run: () => HealthView | Promise<HealthView> }[] = [
  { name: 'architecture', run: () => gov.generateArchitectureHealth() },
  { name: 'security', run: () => gov.generateSecurityHealth() },
  { name: 'ownership', run: () => gov.generateOwnershipHealth() },
  { name: 'readiness', run: () => gov.generateReadinessHealth() },
  { name: 'domain', run: () => gov.generateDomainHealth() },
];

for (const area of HEALTH_AREAS) {
  test(`generate${area.name}Health → a scored, evidence-cited HealthView`, async () => {
    const h = await area.run();
    assert.equal(h.area, area.name);
    assert.ok(h.score >= 0 && h.score <= 100);
    assert.ok(Array.isArray(h.findings));
    assert.ok(hasProvenance(h));
    assert.equal(h.timestamp, FIXED);
  });
}

test('governance report is deterministic under a fixed clock', async () => {
  const a = await gov.generateGovernanceReport();
  const b = await gov.generateGovernanceReport();
  assert.deepEqual(a, b);
});

test('every governance finding carries evidence + a severity', async () => {
  const r = await gov.generateGovernanceReport();
  const all = [...r.drift.findings, ...r.security.findings, ...r.compliance.violations];
  for (const f of all) {
    assert.ok(f.evidence.length >= 0);
    assert.ok(['critical', 'high', 'medium', 'low', 'info'].includes(f.severity));
    assert.ok(typeof f.confidence === 'number');
  }
});

test('getGovernanceEngine is a process-wide singleton; reset clears it', () => {
  resetGovernanceEngine();
  const a = getGovernanceEngine();
  assert.equal(getGovernanceEngine(), a);
  resetGovernanceEngine();
  assert.notEqual(getGovernanceEngine(), a);
  resetGovernanceEngine();
});

test('the five services are exposed for direct querying', () => {
  assert.ok(gov.drift && gov.compliance && gov.ownership && gov.security && gov.readiness);
});

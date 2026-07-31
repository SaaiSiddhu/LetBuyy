/**
 * GDIS foundation tests — the GovernanceArtifactStore + builders run against the REAL
 * graphify-out artifacts (no fixtures). Verifies the store reads the real governance data,
 * the deterministic builders, and the evidence/confidence/sources/timestamp contract.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine, evidence } from '@letbuyy/lcis-core';
import {
  ConfidenceCalculator,
  FindingBuilder,
  GovernanceArtifactStore,
  GovernanceRuleRegistry,
  RULES,
  SeverityScorer,
  governance,
} from '../src/index';

const FIXED = '2026-06-20T00:00:00.000Z';
const engine = createEngine();
const store = new GovernanceArtifactStore(engine);

// ── store reads real governance data ─────────────────────────────────────────
test('GovernanceArtifactStore reads the real db-intel slices', () => {
  assert.ok(store.tables().length > 100, 'hundreds of tables');
  assert.ok(store.functions().length > 50, 'scores of functions');
  assert.ok(store.policies().length > 100, 'hundreds of policies');
  assert.ok(store.tables().some((t) => t.money), 'a money table exists');
  assert.ok(store.tables().some((t) => t.tenant), 'a tenant table exists');
  assert.ok(store.functions().some((f) => f.securityDefiner), 'a SECURITY DEFINER function exists');
});
test('GovernanceArtifactStore reads domains, workers, ownership, migrations', () => {
  assert.ok(store.domains().length >= 10, 'domains present');
  assert.ok(store.domains().some((d) => d.owners.length > 0), 'some domain has owners');
  assert.ok(store.workers().length >= 1, 'workers present');
  assert.ok(store.ownership().length >= 1, 'CODEOWNERS map present');
  assert.ok(store.migrations().length >= 1, 'migrations present');
});
test('a tenant table without RLS is representable (the R002 signal is real)', () => {
  // We do not assert a violation exists; we assert the FIELDS that detect it are present.
  const t = store.tables()[0]!;
  assert.equal(typeof t.rls, 'boolean');
  assert.equal(typeof t.tenant, 'boolean');
});

// ── rule registry ────────────────────────────────────────────────────────────
test('GovernanceRuleRegistry exposes R001..R008', () => {
  const reg = new GovernanceRuleRegistry();
  assert.equal(reg.list().length, 8);
  assert.equal(RULES.length, 8);
  assert.equal(reg.get('R002')?.severity, 'critical');
  assert.ok(reg.byCategory('security').length >= 1);
});

// ── builders ─────────────────────────────────────────────────────────────────
test('SeverityScorer: money → critical, tenant/public → high, else base', () => {
  const s = new SeverityScorer();
  assert.equal(s.forEntity({ money: true }), 'critical');
  assert.equal(s.forEntity({ tenant: true }), 'high');
  assert.equal(s.forEntity({ public: true }), 'high');
  assert.equal(s.forEntity({ base: 'low' }), 'low');
  assert.equal(s.max('low', 'high'), 'high');
});
test('ConfidenceCalculator: 0 with no evidence, capped at 0.95', () => {
  const c = new ConfidenceCalculator();
  assert.equal(c.fromEvidence([]), 0);
  assert.ok(c.fromEvidence(Array(50).fill(evidence('table', 't'))) <= 0.95);
});
test('FindingBuilder: deterministic id + confidence from evidence', () => {
  const fb = new FindingBuilder();
  const f = fb.build({
    id: fb.stableId('table-drift', 'orders'),
    category: 'drift',
    kind: 'table-drift',
    severity: 'high',
    subject: 'orders',
    title: 'orphan table',
    detail: 'not claimed by any domain',
    evidence: [evidence('table', 'orders', 'no domain', 'graphify-out/db-intel.json')],
  });
  assert.equal(f.id, 'TABLE-DRIFT-orders');
  assert.ok(f.confidence > 0);
  assert.equal(f.evidence.length, 1);
});
test('governance() stamps evidence + confidence + sources + timestamp', () => {
  const out = governance(
    { findings: [] },
    { evidence: [evidence('table', 't', 'd', 'graphify-out/db-intel.json')], now: () => FIXED },
  );
  assert.equal(out.timestamp, FIXED);
  assert.ok(out.confidence > 0 && out.confidence <= 0.95);
  assert.deepEqual(out.sources, ['graphify-out/db-intel.json']);
});

/**
 * OperationsEngine facade tests — the end-to-end composite over the REAL artifacts: all 8 area
 * reports + the operations report that answers the canonical questions. Verifies provenance, the
 * honesty contract (liveConnected false; live signals NOT_CONNECTED), determinism, and the singleton.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOperationsEngine,
  getOperationsEngine,
  resetOperationsEngine,
  type AreaReport,
} from '../src/index';

const FIXED = '2026-06-20T00:00:00.000Z';
const ops = createOperationsEngine({ now: () => FIXED });

function hasProvenance(x: unknown): boolean {
  const r = x as Record<string, unknown>;
  return (
    Array.isArray(r['evidence']) &&
    typeof r['confidence'] === 'number' &&
    Array.isArray(r['sources']) &&
    typeof r['timestamp'] === 'string' &&
    typeof r['liveConnected'] === 'boolean'
  );
}

const AREAS: { name: string; run: () => AreaReport }[] = [
  { name: 'runtime', run: () => ops.runtime() },
  { name: 'commerce', run: () => ops.commerce() },
  { name: 'merchant', run: () => ops.merchant() },
  { name: 'customer', run: () => ops.customer() },
  { name: 'deployment', run: () => ops.deployment() },
  { name: 'incident', run: () => ops.incident() },
  { name: 'security', run: () => ops.security() },
  { name: 'forecast', run: () => ops.forecast() },
];

for (const a of AREAS) {
  test(`${a.name}() returns a typed, evidence-cited area report`, () => {
    const r = a.run();
    assert.equal(r.area, a.name);
    assert.ok(Array.isArray(r.facts) && Array.isArray(r.findings) && Array.isArray(r.signals));
    assert.ok(r.health && typeof r.health.band === 'string');
    assert.ok(hasProvenance(r));
    assert.equal(r.timestamp, FIXED);
  });
}

test('every live signal is honestly NOT_CONNECTED (value null + env vars) — nothing fabricated', () => {
  for (const a of AREAS) {
    for (const s of a.run().signals) {
      if (s.status === 'NOT_CONNECTED') {
        assert.equal(s.value, null, `${s.key} value must be null`);
        assert.ok(s.requiresEnvVar.length >= 1, `${s.key} must name env vars`);
      }
    }
  }
});

test('operationsReport composes all 8 areas + answers the canonical questions', () => {
  const r = ops.operationsReport();
  for (const k of ['runtime', 'commerce', 'merchant', 'customer', 'deployment', 'incident', 'security', 'forecast'] as const) {
    assert.ok(r[k], `${k} present`);
    assert.ok(hasProvenance(r[k]));
  }
  for (const k of ['healthy', 'degraded', 'failing', 'changed', 'atRisk', 'investigate'] as const) {
    assert.ok(Array.isArray(r.answers[k]), `answers.${k} is an array`);
  }
  assert.ok(hasProvenance(r));
  assert.equal(r.liveConnected, false); // honest: no live values connected in this env
});

test('operationsReport surfaces real structural risks for investigation (SPOF etc.)', () => {
  const r = ops.operationsReport();
  // The queue-workers / tenant-schema SPOFs are real CONNECTED critical findings → at-risk/investigate.
  assert.ok(r.answers.atRisk.length >= 1, 'at least one at-risk finding from structural analysis');
});

test('operations report is deterministic under a fixed clock', () => {
  assert.deepEqual(ops.operationsReport(), ops.operationsReport());
});

test('overall health is computed (or honestly unknown) with signal counts', () => {
  const h = ops.operationsReport().health;
  assert.equal(h.area, 'overall');
  assert.ok(h.score === null || (h.score >= 0 && h.score <= 100));
  assert.ok(h.notConnectedSignals >= 1, 'live telemetry is NOT_CONNECTED in this env');
});

test('getOperationsEngine is a process-wide singleton; reset clears it', () => {
  resetOperationsEngine();
  const a = getOperationsEngine();
  assert.equal(getOperationsEngine(), a);
  resetOperationsEngine();
  assert.notEqual(getOperationsEngine(), a);
  resetOperationsEngine();
});

test('the eight services are exposed for direct querying', () => {
  assert.ok(
    ops.runtimeOps && ops.commerceOps && ops.merchantOps && ops.customerOps &&
    ops.deploymentOps && ops.incidentOps && ops.securityOps && ops.forecastOps,
  );
});

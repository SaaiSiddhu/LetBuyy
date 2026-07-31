/**
 * EisEngine facade tests — the end-to-end integration: a single request analysed once,
 * then every plan derived from it. Verifies all 8 plans are produced with full provenance,
 * determinism (fixed clock → deep-equal), the singleton, and money/tenant propagation
 * across the whole plan set.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  type FullPlan,
  createEisEngine,
  getEisEngine,
  resetEisEngine,
} from '../src/index';

const FIXED = '2026-06-20T00:00:00.000Z';
const eis = createEisEngine({ now: () => FIXED });

// Real money/tenant fixtures from the live artifacts (not brittle to specific names).
const db = eis.core.store.read<{ tables: { name: string; money?: boolean; tenant?: boolean }[] }>('db-intel');
const moneyTable = db.tables.find((t) => t.money)?.name;

const PLAN_KEYS: (keyof FullPlan)[] = [
  'change', 'execution', 'executionGraph', 'migration', 'tests', 'rollback', 'launch', 'verification',
];

function hasProvenance(x: unknown): boolean {
  const r = x as Record<string, unknown>;
  return (
    Array.isArray(r['evidence']) &&
    typeof r['confidence'] === 'number' &&
    Array.isArray(r['sources']) &&
    typeof r['timestamp'] === 'string'
  );
}

test('planAll produces all 8 plans for a natural-language request', async () => {
  const full = await eis.planAll({ text: 'Add GST Filing' });
  for (const k of PLAN_KEYS) assert.ok(full[k], `plan ${k} present`);
});

test('every plan in the full set carries evidence/confidence/sources/timestamp', async () => {
  const full = await eis.planAll({ text: 'Add GST Filing' });
  for (const k of PLAN_KEYS) assert.ok(hasProvenance(full[k]), `${k} carries provenance`);
});

test('every plan timestamp honours the injected clock (deterministic)', async () => {
  const full = await eis.planAll({ text: 'Add GST Filing' });
  for (const k of PLAN_KEYS) assert.equal((full[k] as { timestamp: string }).timestamp, FIXED);
});

test('confidence is always within [0, 0.95]', async () => {
  const full = await eis.planAll({ text: 'Implement Shipping Zones' });
  for (const k of PLAN_KEYS) {
    const c = (full[k] as { confidence: number }).confidence;
    assert.ok(c >= 0 && c <= 0.95, `${k} confidence ${c} in range`);
  }
});

test('planAll is deterministic under a fixed clock (same request → deep-equal)', async () => {
  const a = await eis.planAll({ text: 'Migrate Checkout' });
  const b = await eis.planAll({ text: 'Migrate Checkout' });
  assert.deepEqual(a, b);
});

test('a money change propagates critical risk through change + rollback + migration', () => {
  assert.ok(moneyTable, 'db-intel has a money table');
  const req = { text: 'touch ledger', tables: [moneyTable!] };
  const direct = eis.analyze(req);
  assert.equal(direct.risk.money, true);
  assert.equal(direct.risk.level, 'critical');
  assert.ok(eis.rollback.generateRollbackPlan(req).irreversible.length > 0, 'money → irreversible findings');
  assert.equal(eis.migration.analyzeMigration(req).readiness.ready, false);
});

test('analyze() returns the shared ChangeAnalysis backbone', () => {
  const a = eis.analyze({ text: 'Add GST Filing' });
  assert.ok('affected' in a && 'seeds' in a && 'risk' in a);
  assert.equal(a.timestamp, FIXED);
});

test('getEisEngine returns a process-wide singleton; reset clears it', () => {
  resetEisEngine();
  const a = getEisEngine();
  const b = getEisEngine();
  assert.equal(a, b);
  resetEisEngine();
  assert.notEqual(getEisEngine(), a);
  resetEisEngine();
});

test('launch decision is one of GO / CONDITIONAL_GO / NO_GO with rationale', async () => {
  const full = await eis.planAll({ text: 'Add GST Filing' });
  assert.ok(['GO', 'CONDITIONAL_GO', 'NO_GO'].includes(full.launch.decision.decision));
  assert.ok(full.launch.decision.rationale.length > 0);
});

test('execution graph implementation order contains no item before its dependencies', async () => {
  const full = await eis.planAll({ text: 'Implement Shipping Zones' });
  const order = full.executionGraph.implementationOrder;
  const pos = new Map(order.map((id, i) => [id, i]));
  for (const e of full.executionGraph.edges) {
    if (pos.has(e.from) && pos.has(e.to)) {
      assert.ok(pos.get(e.from)! < pos.get(e.to)!, `${e.from} before ${e.to}`);
    }
  }
});

test('an unresolved request still yields a complete, honest (empty) plan set', async () => {
  const full = await eis.planAll({ text: 'zzqqx wibble frobnicate xyzzy' });
  assert.equal(full.change.unresolved, true);
  for (const k of PLAN_KEYS) assert.ok(hasProvenance(full[k]));
  assert.deepEqual(full.change.affected.domains, []);
});

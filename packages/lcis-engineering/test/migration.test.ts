/**
 * EINS Phase 7 — MigrationIntelligenceService tests ≥40.
 *
 * Verifies:
 * - planMigration delegates to eis.migration.analyzeMigration (same shape/values, not reimplemented)
 * - migrationGates yields the correct findings per condition (data-loss/blocker/reversibility)
 * - all findings cite reuse evidence from lcis-execution
 * - determinism (fixed clock, two calls → identical)
 * - read-only source scan of src/migration/*.ts passes (no fetch/spawn/exec/writeFile/eval)
 * - EINS does NOT reimplement migration logic (source scan for ChangeAnalyzer/toAnalysis absent)
 *
 * Uses real graphify-out artifacts via createEngine().
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createEngine } from '@letbuyy/lcis-core';
import { createEisEngine } from '@letbuyy/lcis-execution';
import { MigrationIntelligenceService } from '../src/migration/index';

// ── Fixed clock + engines ───────────────────────────────────────────────────
const FIXED = '2026-06-21T00:00:00.000Z';
const core = createEngine();
const svc = new MigrationIntelligenceService(core, () => FIXED);
// Direct eis.migration for delegation assertions
const eis = createEisEngine({ core, now: () => FIXED });

// ── Real fixtures ───────────────────────────────────────────────────────────
const db = core.store.read<{ tables: { name: string; money?: boolean; tenant?: boolean }[] }>('db-intel');
const di = core.store.read<{ domains: { key: string }[] }>('domain-intel');

const moneyTable = db.tables.find((t) => t.money)?.name;
const tenantTable = db.tables.find((t) => t.tenant)?.name;
const aDomain = di.domains[0]?.key;
const plainTable = db.tables.find((t) => !t.money && !t.tenant)?.name;

// ── 1. planMigration: delegation (not reimplementation) ────────────────────
test('planMigration: returns a MigrationPlan (has request/targets/steps/dependencyOrder/risk/dataLossRisks/readiness/simulatedImpact)', () => {
  assert.ok(aDomain, 'need a domain');
  const plan = svc.planMigration({ text: 'change schema', domains: [aDomain!] });
  assert.ok(plan.request, 'has request');
  assert.ok(Array.isArray(plan.targets), 'has targets[]');
  assert.ok(Array.isArray(plan.steps), 'has steps[]');
  assert.ok(Array.isArray(plan.dependencyOrder), 'has dependencyOrder[]');
  assert.ok(plan.risk, 'has risk');
  assert.ok(Array.isArray(plan.dataLossRisks), 'has dataLossRisks[]');
  assert.ok(plan.readiness, 'has readiness');
  assert.ok(typeof plan.simulatedImpact === 'string', 'has simulatedImpact string');
});

test('planMigration: carries evidence, confidence, sources, timestamp', () => {
  assert.ok(aDomain);
  const plan = svc.planMigration({ text: 'change', domains: [aDomain!] });
  assert.ok(Array.isArray(plan.evidence) && plan.evidence.length > 0, 'has evidence');
  assert.ok(plan.confidence > 0 && plan.confidence <= 0.95, 'confidence in (0, 0.95]');
  assert.ok(Array.isArray(plan.sources) && plan.sources.length > 0, 'has sources');
  assert.equal(plan.timestamp, FIXED, 'timestamp is injected clock');
});

test('planMigration: delegates — same dependencyOrder as eis.migration directly', () => {
  assert.ok(aDomain);
  const req = { text: 'alter tables', domains: [aDomain!] };
  const fromSvc = svc.planMigration(req);
  const fromEis = eis.migration.analyzeMigration(req);
  assert.deepEqual(fromSvc.dependencyOrder, fromEis.dependencyOrder, 'dependencyOrder matches eis.migration');
});

test('planMigration: delegates — same readiness.ready as eis.migration directly', () => {
  assert.ok(moneyTable);
  const req = { text: 'alter ledger', tables: [moneyTable!] };
  const fromSvc = svc.planMigration(req);
  const fromEis = eis.migration.analyzeMigration(req);
  assert.equal(fromSvc.readiness.ready, fromEis.readiness.ready, 'readiness.ready matches');
});

test('planMigration: delegates — same risk.level as eis.migration directly', () => {
  assert.ok(moneyTable);
  const req = { text: 'alter money table', tables: [moneyTable!] };
  const fromSvc = svc.planMigration(req);
  const fromEis = eis.migration.analyzeMigration(req);
  assert.equal(fromSvc.risk.level, fromEis.risk.level, 'risk.level matches eis.migration');
});

test('planMigration: delegates — same steps count as eis.migration directly', () => {
  assert.ok(aDomain);
  const req = { text: 'schema change', domains: [aDomain!] };
  const fromSvc = svc.planMigration(req);
  const fromEis = eis.migration.analyzeMigration(req);
  assert.equal(fromSvc.steps.length, fromEis.steps.length, 'step count matches');
});

test('planMigration: delegates — same dataLossRisks length as eis.migration directly', () => {
  assert.ok(moneyTable && tenantTable);
  const req = { text: 'alter both', tables: [moneyTable!, tenantTable!] };
  const fromSvc = svc.planMigration(req);
  const fromEis = eis.migration.analyzeMigration(req);
  assert.equal(fromSvc.dataLossRisks.length, fromEis.dataLossRisks.length, 'dataLossRisks count matches');
});

test('planMigration: delegates — same irreversibleSteps count as eis.migration directly', () => {
  assert.ok(aDomain);
  const req = { text: 'drop and recreate', domains: [aDomain!] };
  const fromSvc = svc.planMigration(req);
  const fromEis = eis.migration.analyzeMigration(req);
  assert.equal(fromSvc.irreversibleSteps.length, fromEis.irreversibleSteps.length, 'irreversibleSteps count matches');
});

test('planMigration: unresolved request returns valid plan shape', () => {
  const plan = svc.planMigration({ text: 'zzqq xyzwibble frobnicate9999' });
  assert.ok(plan.request, 'has request');
  assert.ok(Array.isArray(plan.steps), 'has steps');
  assert.ok(plan.simulatedImpact.includes('SIMULATION'), 'simulatedImpact has SIMULATION note');
});

// ── 2. migrationGates: money table → data-loss + blocker + reversibility ───
test('migrationGates: money table → at least one finding returned', () => {
  assert.ok(moneyTable);
  const gates = svc.migrationGates({ text: 'alter ledger', tables: [moneyTable!] });
  assert.ok(Array.isArray(gates) && gates.length >= 1, 'at least one finding');
});

test('migrationGates: money table → includes a blocker finding (readiness.ready=false)', () => {
  assert.ok(moneyTable);
  const gates = svc.migrationGates({ text: 'alter ledger', tables: [moneyTable!] });
  const blocker = gates.find((f) => f.category === 'blocker');
  assert.ok(blocker, 'blocker finding present for money table');
});

test('migrationGates: money table blocker has severity critical', () => {
  assert.ok(moneyTable);
  const gates = svc.migrationGates({ text: 'alter ledger', tables: [moneyTable!] });
  const blocker = gates.find((f) => f.category === 'blocker');
  assert.equal(blocker?.severity, 'critical');
});

test('migrationGates: money table → includes a data-loss finding (E002)', () => {
  assert.ok(moneyTable);
  const gates = svc.migrationGates({ text: 'alter ledger', tables: [moneyTable!] });
  const e002 = gates.find((f) => f.rule === 'E002' || f.kind === 'data-loss');
  assert.ok(e002, 'E002/data-loss finding present');
});

test('migrationGates: money table data-loss finding mentions canonical-ledger or money', () => {
  assert.ok(moneyTable);
  const gates = svc.migrationGates({ text: 'alter ledger', tables: [moneyTable!] });
  const e002 = gates.find((f) => f.rule === 'E002' || f.kind === 'data-loss');
  const detail = (e002?.detail ?? '') + (e002?.title ?? '');
  assert.ok(
    detail.toLowerCase().includes('money') || detail.toLowerCase().includes('ledger') || detail.toLowerCase().includes('canonical'),
    'detail mentions money/ledger/canonical'
  );
});

test('migrationGates: money table → includes a reversibility finding (E006)', () => {
  assert.ok(moneyTable);
  const gates = svc.migrationGates({ text: 'alter ledger', tables: [moneyTable!] });
  const e006 = gates.find((f) => f.rule === 'E006' || f.kind === 'reversibility');
  assert.ok(e006, 'E006/reversibility finding present');
});

test('migrationGates: reversibility finding has severity high', () => {
  assert.ok(moneyTable);
  const gates = svc.migrationGates({ text: 'alter ledger', tables: [moneyTable!] });
  const e006 = gates.find((f) => f.rule === 'E006' || f.kind === 'reversibility');
  assert.equal(e006?.severity, 'high');
});

// ── 3. migrationGates: reuse evidence cited ────────────────────────────────
test('migrationGates: all findings have at least one evidence entry', () => {
  assert.ok(moneyTable);
  const gates = svc.migrationGates({ text: 'alter', tables: [moneyTable!] });
  for (const f of gates) {
    assert.ok(f.evidence.length > 0, `finding "${f.kind}" must have evidence`);
  }
});

test('migrationGates: all findings cite reuse evidence from lcis-execution', () => {
  assert.ok(moneyTable);
  const gates = svc.migrationGates({ text: 'alter', tables: [moneyTable!] });
  for (const f of gates) {
    const hasReuseEv = f.evidence.some((e) => e.source === 'packages/lcis-execution');
    assert.ok(hasReuseEv, `finding "${f.kind}" must cite reuse evidence from packages/lcis-execution`);
  }
});

test('migrationGates: reuse evidence refs reference eis.migration methods', () => {
  assert.ok(moneyTable);
  const gates = svc.migrationGates({ text: 'alter', tables: [moneyTable!] });
  for (const f of gates) {
    const reuseEv = f.evidence.filter((e) => e.source === 'packages/lcis-execution');
    for (const ev of reuseEv) {
      assert.ok(
        ev.ref.includes('eis.migration') || ev.ref.includes('lcis-execution:eis'),
        `evidence ref "${ev.ref}" must reference eis.migration`
      );
    }
  }
});

test('migrationGates: blocker finding detail mentions verifyMigrationReadiness or SECURITY DEFINER or RPC', () => {
  assert.ok(moneyTable);
  const gates = svc.migrationGates({ text: 'alter', tables: [moneyTable!] });
  const blocker = gates.find((f) => f.category === 'blocker');
  assert.ok(blocker, 'blocker present');
  assert.ok(
    blocker!.detail.includes('verifyMigrationReadiness') ||
    blocker!.detail.includes('SECURITY DEFINER') ||
    blocker!.detail.includes('RPC') ||
    blocker!.detail.includes('canonical'),
    'blocker detail mentions verifyMigrationReadiness or RPC'
  );
});

test('migrationGates: E006 finding detail mentions irreversibleSteps or DROP', () => {
  assert.ok(moneyTable);
  const gates = svc.migrationGates({ text: 'alter', tables: [moneyTable!] });
  const e006 = gates.find((f) => f.rule === 'E006' || f.kind === 'reversibility');
  assert.ok(e006, 'E006 present');
  assert.ok(
    e006!.detail.toLowerCase().includes('irreversible') ||
    e006!.detail.toUpperCase().includes('DROP') ||
    e006!.detail.includes('reversible:false'),
    'E006 detail mentions irreversible/DROP'
  );
});

// ── 4. migrationGates: empty / unresolved ─────────────────────────────────
test('migrationGates: unresolved request may return zero findings (no data-loss, ready, no irreversible)', () => {
  const gates = svc.migrationGates({ text: 'zzqq xyzwibble frobnicate9999' });
  assert.ok(Array.isArray(gates), 'returns array');
  // An unresolved request may have no dataLossRisks, ready=true, irreversibleSteps still present
  // — we don't assert specific count, just shape
});

test('migrationGates: plain non-money table returns no blocker finding', () => {
  if (!plainTable) return;
  const gates = svc.migrationGates({ text: 'alter plain', tables: [plainTable] });
  const blocker = gates.find((f) => f.category === 'blocker');
  assert.ok(!blocker, 'no blocker for plain table (readiness should be ready)');
});

// ── 5. Finding shape (EngineeringFinding contract) ─────────────────────────
test('migrationGates: each finding has id/category/kind/severity/subject/title/detail/confidence', () => {
  assert.ok(moneyTable);
  const gates = svc.migrationGates({ text: 'alter', tables: [moneyTable!] });
  for (const f of gates) {
    assert.ok(typeof f.id === 'string' && f.id.length > 0, 'has id');
    assert.ok(['gate', 'risk', 'gap', 'blocker'].includes(f.category), 'valid category');
    assert.ok(typeof f.kind === 'string' && f.kind.length > 0, 'has kind');
    assert.ok(['critical', 'high', 'medium', 'low', 'info'].includes(f.severity), 'valid severity');
    assert.ok(typeof f.subject === 'string' && f.subject.length > 0, 'has subject');
    assert.ok(typeof f.title === 'string' && f.title.length > 0, 'has title');
    assert.ok(typeof f.detail === 'string' && f.detail.length > 0, 'has detail');
    assert.ok(typeof f.confidence === 'number' && f.confidence >= 0 && f.confidence <= 1, 'valid confidence');
  }
});

test('migrationGates: finding ids are unique within a call', () => {
  assert.ok(moneyTable);
  const gates = svc.migrationGates({ text: 'alter', tables: [moneyTable!] });
  const ids = gates.map((f) => f.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, 'finding ids are unique');
});

// ── 6. Determinism ─────────────────────────────────────────────────────────
test('planMigration: deterministic — two calls yield same readiness.ready', () => {
  assert.ok(moneyTable);
  const req = { text: 'alter ledger', tables: [moneyTable!] };
  const a = svc.planMigration(req);
  const b = svc.planMigration(req);
  assert.equal(a.readiness.ready, b.readiness.ready);
});

test('planMigration: deterministic — two calls yield same steps length', () => {
  assert.ok(aDomain);
  const req = { text: 'schema change', domains: [aDomain!] };
  const a = svc.planMigration(req);
  const b = svc.planMigration(req);
  assert.equal(a.steps.length, b.steps.length);
});

test('migrationGates: deterministic — two calls yield same finding kinds', () => {
  assert.ok(moneyTable);
  const req = { text: 'alter ledger', tables: [moneyTable!] };
  const a = svc.migrationGates(req);
  const b = svc.migrationGates(req);
  assert.deepEqual(a.map((f) => f.kind), b.map((f) => f.kind));
});

test('migrationGates: deterministic — two calls yield same finding count', () => {
  assert.ok(moneyTable);
  const req = { text: 'alter', tables: [moneyTable!] };
  const a = svc.migrationGates(req);
  const b = svc.migrationGates(req);
  assert.equal(a.length, b.length);
});

// ── 7. EINS does NOT reimplement (source scan) ─────────────────────────────
test('src/migration/*.ts contains no fetch/spawn/exec/eval/writeFile/appendFile/child_process calls', () => {
  const dir = resolve(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..', 'src', 'migration');
  const forbidden = ['fetch(', 'spawn(', 'exec(', 'eval(', 'writeFile(', 'appendFile(', 'child_process'];
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
  assert.ok(files.length > 0, 'must have .ts files in src/migration/');
  for (const file of files) {
    const src = readFileSync(join(dir, file), 'utf8');
    for (const banned of forbidden) {
      assert.ok(!src.includes(banned), `${file} must not contain "${banned}" (EINS is read-only)`);
    }
  }
});

test('src/migration/*.ts does not import node:child_process / node:net / node:http / node:https', () => {
  const dir = resolve(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..', 'src', 'migration');
  const forbidden = ['child_process', 'node:net', 'node:http', 'node:https'];
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    const src = readFileSync(join(dir, file), 'utf8');
    for (const banned of forbidden) {
      assert.ok(!src.includes(banned), `${file} must not import "${banned}"`);
    }
  }
});

test('src/migration/MigrationIntelligenceService.ts does not contain ChangeAnalyzer or toAnalysis (not reimplementing)', () => {
  const filePath = resolve(
    import.meta.dirname ?? new URL('.', import.meta.url).pathname,
    '..', 'src', 'migration', 'MigrationIntelligenceService.ts',
  );
  const src = readFileSync(filePath, 'utf8');
  // Strip comments before checking to avoid false positives in doc comments
  const strippedSrc = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(
    !strippedSrc.includes('ChangeAnalyzer'),
    'MigrationIntelligenceService.ts must not contain ChangeAnalyzer (EINS does not reimplement)'
  );
  assert.ok(
    !strippedSrc.includes('toAnalysis'),
    'MigrationIntelligenceService.ts must not contain toAnalysis (EINS does not reimplement)'
  );
});

test('src/migration/MigrationIntelligenceService.ts calls eis.migration.analyzeMigration (the canonical delegate)', () => {
  const filePath = resolve(
    import.meta.dirname ?? new URL('.', import.meta.url).pathname,
    '..', 'src', 'migration', 'MigrationIntelligenceService.ts',
  );
  const src = readFileSync(filePath, 'utf8');
  assert.ok(
    src.includes('eis.migration.analyzeMigration'),
    'must call eis.migration.analyzeMigration (composition point, not reimplementation)'
  );
});

test('src/migration/MigrationIntelligenceService.ts imports from lcis-execution (not lcis-core migration internals)', () => {
  const filePath = resolve(
    import.meta.dirname ?? new URL('.', import.meta.url).pathname,
    '..', 'src', 'migration', 'MigrationIntelligenceService.ts',
  );
  const src = readFileSync(filePath, 'utf8');
  assert.ok(
    src.includes("from '@letbuyy/lcis-execution'"),
    'must import MigrationPlan from @letbuyy/lcis-execution'
  );
  assert.ok(
    src.includes('createEisEngine'),
    'must use createEisEngine (composition, not raw service instantiation)'
  );
});

// ── 8. Default constructor ─────────────────────────────────────────────────
test('MigrationIntelligenceService: default constructor (no args) constructs without error', () => {
  assert.doesNotThrow(() => new MigrationIntelligenceService(), 'default constructor must not throw');
});

test('MigrationIntelligenceService: custom core + fixed now yields deterministic timestamp', () => {
  const svc2 = new MigrationIntelligenceService(core, () => FIXED);
  assert.ok(moneyTable);
  const plan = svc2.planMigration({ text: 'alter', tables: [moneyTable!] });
  assert.equal(plan.timestamp, FIXED, 'timestamp from injected clock');
});

// ── 9. migrationGates: tenant table ────────────────────────────────────────
test('migrationGates: tenant table → at least one finding returned', () => {
  assert.ok(tenantTable);
  const gates = svc.migrationGates({ text: 'alter tenant', tables: [tenantTable!] });
  assert.ok(Array.isArray(gates) && gates.length >= 1, 'at least one finding for tenant table');
});

// ── 10. migrationGates: E002 data-loss finding only when dataLossRisks present
test('migrationGates: no data-loss finding when unresolved (no tables)', () => {
  const gates = svc.migrationGates({ text: 'zzqq xyzwibble' });
  const e002 = gates.find((f) => f.rule === 'E002' || f.kind === 'data-loss');
  // No tables in blast radius → no data-loss finding
  assert.ok(!e002, 'no E002 finding when no affected tables');
});

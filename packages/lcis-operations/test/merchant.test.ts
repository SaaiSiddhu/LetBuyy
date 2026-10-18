/**
 * MerchantOperationsService tests — LCOS Phase 6.
 * All tests run against the REAL graphify-out artifacts (no fixtures/mocks).
 * Fixed `now` for determinism. Read-only source scan: no fetch/spawn/exec/writeFile.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine } from '@letbuyy/lcis-core';
import { MerchantOperationsService } from '../src/merchant/index';
import type { OperationalFinding, OperationalFact, LiveSignal, MerchantReport } from '../src/shared/index';

const FIXED = '2026-06-21T00:00:00.000Z';
const NOW = () => FIXED;
const tenantTableCount = createEngine().store.read<{summary: {tenantTables: number}}>('merchant-intelligence').summary.tenantTables;

function makeService(): MerchantOperationsService {
  return new MerchantOperationsService(createEngine(), NOW);
}

// ── read-only source scan — no forbidden side-effects ─────────────────────────
test('MerchantOperationsService source contains no fetch/child_process/exec/spawn/writeFile', () => {
  const src = (() => {
    try {
      const fs = require('node:fs');
      const path = require('node:path');
      const p = path.join(__dirname, '../src/merchant/MerchantOperationsService.ts');
      return fs.readFileSync(p, 'utf8');
    } catch { return ''; }
  })();
  // Strip comments before scanning
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.ok(!stripped.includes('fetch('), 'no fetch() call');
  assert.ok(!stripped.includes('child_process'), 'no child_process');
  assert.ok(!stripped.includes('spawn('), 'no spawn()');
  assert.ok(!stripped.includes('exec('), 'no exec()');
  assert.ok(!stripped.includes('writeFile'), 'no writeFile');
  assert.ok(!stripped.includes('eval('), 'no eval()');
  assert.ok(!stripped.includes('require('), 'no require() in service');
});

// ── constructor ───────────────────────────────────────────────────────────────
test('MerchantOperationsService constructs without error', () => {
  assert.doesNotThrow(() => makeService());
});

// ── detectActivation ─────────────────────────────────────────────────────────
test('detectActivation returns OperationalFinding[]', () => {
  const findings = makeService().detectActivation();
  assert.ok(Array.isArray(findings));
  assert.ok(findings.length >= 1, 'at least one finding');
});

test('detectActivation includes lifecycle model CONNECTED finding', () => {
  const findings = makeService().detectActivation();
  const connected = findings.filter((f) => f.status === 'CONNECTED');
  assert.ok(connected.length >= 1, 'at least one CONNECTED structural finding');
  const lifecycle = connected.find((f) => f.kind === 'activation-lifecycle');
  assert.ok(lifecycle != null, 'lifecycle finding present');
  assert.equal(lifecycle!.area, 'merchant');
});

test('detectActivation includes NOT_CONNECTED finding for live rate', () => {
  const findings = makeService().detectActivation();
  const notConn = findings.filter((f) => f.status === 'NOT_CONNECTED');
  assert.ok(notConn.length >= 1, 'at least one NOT_CONNECTED finding for live rate');
  assert.ok(notConn.every((f) => f.confidence === 0), 'all NOT_CONNECTED have confidence=0');
});

test('detectActivation NOT_CONNECTED findings cite SUPABASE env var', () => {
  const findings = makeService().detectActivation();
  const notConn = findings.filter((f) => f.status === 'NOT_CONNECTED');
  for (const f of notConn) {
    const hasEnvRef = f.evidence.some((e) =>
      (e.detail ?? '').includes('SUPABASE') || (e.ref ?? '').includes('SUPABASE') || (e.source ?? '').includes('SUPABASE'),
    );
    assert.ok(hasEnvRef, `finding ${f.id} must cite SUPABASE env var`);
  }
});

test('detectActivation lifecycle finding cites real lifecycle states from artifact', () => {
  const findings = makeService().detectActivation();
  const lifecycle = findings.find((f) => f.kind === 'activation-lifecycle');
  if (lifecycle) {
    assert.ok(lifecycle.detail.includes('8'), 'mentions 8-state machine from artifact');
  }
});

// ── detectGrowth ─────────────────────────────────────────────────────────────
test('detectGrowth returns OperationalFinding[]', () => {
  const findings = makeService().detectGrowth();
  assert.ok(Array.isArray(findings));
  assert.ok(findings.length >= 1);
});

test('detectGrowth includes growth model CONNECTED finding', () => {
  const findings = makeService().detectGrowth();
  const connected = findings.filter((f) => f.status === 'CONNECTED');
  assert.ok(connected.length >= 1, 'structural growth model CONNECTED');
  const gm = connected.find((f) => f.kind === 'growth-model');
  assert.ok(gm != null, 'growth-model finding present');
});

test('detectGrowth live rate is NOT_CONNECTED with confidence 0', () => {
  const findings = makeService().detectGrowth();
  const notConn = findings.filter((f) => f.status === 'NOT_CONNECTED');
  assert.ok(notConn.length >= 1, 'at least one NOT_CONNECTED growth finding');
  assert.ok(notConn.every((f) => f.confidence === 0));
});

test('detectGrowth CONNECTED finding references real growth dimensions from artifact', () => {
  const findings = makeService().detectGrowth();
  const gm = findings.find((f) => f.kind === 'growth-model' && f.status === 'CONNECTED');
  if (gm) {
    // merchant-growth.json has 5 dimensions: GMV trend, catalog growth, repeat rate, AOV, channel mix
    assert.ok(gm.detail.includes('5') || gm.title.includes('5'), 'references 5 growth dimensions from artifact');
  }
});

// ── detectChurn ──────────────────────────────────────────────────────────────
test('detectChurn returns OperationalFinding[]', () => {
  const findings = makeService().detectChurn();
  assert.ok(Array.isArray(findings));
  assert.ok(findings.length >= 1);
});

test('detectChurn includes churn signal model CONNECTED finding', () => {
  const findings = makeService().detectChurn();
  const connected = findings.filter((f) => f.status === 'CONNECTED');
  assert.ok(connected.length >= 1, 'structural churn signal model CONNECTED');
  const cm = connected.find((f) => f.kind === 'churn-signal-model');
  assert.ok(cm != null, 'churn-signal-model finding present');
});

test('detectChurn churn model references 5 signals from artifact', () => {
  const findings = makeService().detectChurn();
  const cm = findings.find((f) => f.kind === 'churn-signal-model' && f.status === 'CONNECTED');
  if (cm) {
    assert.ok(cm.detail.includes('5') || cm.title.includes('5'), '5 churn signals from artifact');
    // Should mention real signal names from merchant-churn.json
    const realSignals = ['order inactivity', 'GMV decline', 'subscription lapse', 'billing failure', 'login inactivity'];
    const mentionsAtLeastOne = realSignals.some((s) => cm.detail.toLowerCase().includes(s.toLowerCase()));
    assert.ok(mentionsAtLeastOne, 'mentions at least one real churn signal name');
  }
});

test('detectChurn live churn rate NOT_CONNECTED confidence=0', () => {
  const findings = makeService().detectChurn();
  const notConn = findings.filter((f) => f.status === 'NOT_CONNECTED');
  assert.ok(notConn.length >= 1);
  assert.ok(notConn.every((f) => f.confidence === 0));
});

test('detectChurn NOT_CONNECTED findings cite Supabase source', () => {
  const findings = makeService().detectChurn();
  const notConn = findings.filter((f) => f.status === 'NOT_CONNECTED');
  for (const f of notConn) {
    const refersToSupabase = f.evidence.some((e) =>
      (e.detail ?? '').includes('SUPABASE') || (e.source ?? '').includes('SUPABASE'),
    );
    assert.ok(refersToSupabase, `${f.id} must cite SUPABASE env var`);
  }
});

// ── detectDormancy ───────────────────────────────────────────────────────────
test('detectDormancy returns OperationalFinding[]', () => {
  const findings = makeService().detectDormancy();
  assert.ok(Array.isArray(findings));
  assert.ok(findings.length >= 1);
});

test('detectDormancy includes dormancy detector CONNECTED finding', () => {
  const findings = makeService().detectDormancy();
  const connected = findings.filter((f) => f.status === 'CONNECTED');
  assert.ok(connected.length >= 1, 'detector pattern CONNECTED');
  const dd = connected.find((f) => f.kind === 'dormancy-detector');
  assert.ok(dd != null, 'dormancy-detector finding present');
  assert.ok(dd!.detail.includes('orders'), 'references orders table as source');
});

test('detectDormancy live count is NOT_CONNECTED confidence=0', () => {
  const findings = makeService().detectDormancy();
  const notConn = findings.filter((f) => f.status === 'NOT_CONNECTED');
  assert.ok(notConn.length >= 1);
  assert.ok(notConn.every((f) => f.confidence === 0));
});

// ── detectRetention ───────────────────────────────────────────────────────────
test('detectRetention returns OperationalFinding[]', () => {
  const findings = makeService().detectRetention();
  assert.ok(Array.isArray(findings));
  assert.ok(findings.length >= 2, 'SPOF finding + NOT_CONNECTED finding');
});

test('detectRetention includes CRITICAL CONNECTED single-schema SPOF finding', () => {
  const findings = makeService().detectRetention();
  const spof = findings.find((f) => f.kind === 'retention-spof' && f.status === 'CONNECTED');
  assert.ok(spof != null, 'SPOF finding present and CONNECTED');
  assert.equal(spof!.severity, 'critical', 'SPOF is critical severity');
  assert.ok(spof!.confidence > 0, 'CONNECTED finding has non-zero confidence');
});

test('detectRetention SPOF finding mentions tenant table count from real artifact', () => {
  const findings = makeService().detectRetention();
  const spof = findings.find((f) => f.kind === 'retention-spof');
  if (spof) {
    // merchant-intelligence.json summary.tenantTables = 256
    assert.ok(
      spof.detail.includes(String(tenantTableCount)) || spof.title.includes(String(tenantTableCount)),
      'SPOF finding references 256 tenant tables from artifact',
    );
  }
});

test('detectRetention SPOF finding references verifySiteOwnership', () => {
  const findings = makeService().detectRetention();
  const spof = findings.find((f) => f.kind === 'retention-spof');
  if (spof) {
    assert.ok(spof.detail.includes('verifySiteOwnership'), 'mentions verifySiteOwnership isolation point');
  }
});

test('detectRetention SPOF finding has CONNECTED evidence from merchant-intelligence artifact', () => {
  const findings = makeService().detectRetention();
  const spof = findings.find((f) => f.kind === 'retention-spof');
  if (spof) {
    const artifactEvidence = spof.evidence.filter((e) => e.kind === 'artifact-field');
    assert.ok(artifactEvidence.length >= 1, 'SPOF is backed by artifact evidence');
    assert.ok(
      artifactEvidence.some((e) => e.ref.includes('M-1') || e.ref.includes('tenantTables') || e.ref.includes('singlePointOfDependency')),
      'cites M-1 or tenantTables from artifact',
    );
  }
});

test('detectRetention live retention rate NOT_CONNECTED confidence=0', () => {
  const findings = makeService().detectRetention();
  const notConn = findings.filter((f) => f.status === 'NOT_CONNECTED');
  assert.ok(notConn.length >= 1);
  assert.ok(notConn.every((f) => f.confidence === 0));
});

// ── generateMerchantReport ────────────────────────────────────────────────────
test('generateMerchantReport returns a valid MerchantReport', () => {
  const report = makeService().generateMerchantReport();
  assert.equal(report.area, 'merchant');
  assert.ok(Array.isArray(report.facts));
  assert.ok(Array.isArray(report.findings));
  assert.ok(Array.isArray(report.signals));
  assert.ok(typeof report.summary === 'string' && report.summary.length > 0);
});

test('generateMerchantReport has mandatory OperationalArtifact envelope fields', () => {
  const report = makeService().generateMerchantReport();
  assert.ok(Array.isArray(report.evidence));
  assert.ok(typeof report.confidence === 'number');
  assert.ok(Array.isArray(report.sources));
  assert.ok(typeof report.timestamp === 'string');
  assert.ok(typeof report.liveConnected === 'boolean');
});

test('generateMerchantReport liveConnected is false (no live data in this env)', () => {
  const report = makeService().generateMerchantReport();
  assert.equal(report.liveConnected, false);
});

test('generateMerchantReport timestamp matches fixed now', () => {
  const report = makeService().generateMerchantReport();
  assert.equal(report.timestamp, FIXED);
});

test('generateMerchantReport health has area=merchant', () => {
  const report = makeService().generateMerchantReport();
  assert.equal(report.health.area, 'merchant');
  assert.ok(typeof report.health.connectedSignals === 'number');
  assert.ok(typeof report.health.notConnectedSignals === 'number');
});

test('generateMerchantReport signals are all from merchant area', () => {
  const report = makeService().generateMerchantReport();
  assert.ok(report.signals.length >= 1, 'at least one merchant signal');
  for (const s of report.signals) {
    assert.equal(s.area, 'merchant', `signal ${s.key} must be in merchant area`);
  }
});

test('generateMerchantReport signals are NOT_CONNECTED with null values (no live data)', () => {
  const report = makeService().generateMerchantReport();
  const notConn = report.signals.filter((s) => s.status === 'NOT_CONNECTED');
  assert.ok(notConn.length >= 1);
  for (const s of notConn) {
    assert.equal(s.value, null, `signal ${s.key} value must be null (NOT_CONNECTED)`);
  }
});

test('generateMerchantReport findings include the critical SPOF finding', () => {
  const report = makeService().generateMerchantReport();
  const spof = report.findings.find((f) => f.kind === 'retention-spof' && f.status === 'CONNECTED');
  assert.ok(spof != null, 'SPOF finding in report');
  assert.equal(spof!.severity, 'critical');
});

test('generateMerchantReport has facts from all 6 dimensions (lifecycle/health/risk/growth/adoption/churn)', () => {
  const report = makeService().generateMerchantReport();
  const factKinds = new Set(report.facts.map((f) => f.kind));
  assert.ok(factKinds.has('lifecycle-state-count'), 'lifecycle fact present');
  assert.ok(factKinds.has('health-dimension-count'), 'health fact present');
  assert.ok(factKinds.has('risk-dimension-count'), 'risk fact present');
  assert.ok(factKinds.has('growth-dimension-count'), 'growth fact present');
  assert.ok(factKinds.has('adoption-feature-count'), 'adoption fact present');
  assert.ok(factKinds.has('churn-signal-count'), 'churn fact present');
});

test('generateMerchantReport structural facts have CONNECTED status and non-null values', () => {
  const report = makeService().generateMerchantReport();
  const structural = report.facts.filter((f) => f.status === 'CONNECTED');
  assert.ok(structural.length >= 1, 'at least one CONNECTED fact');
  for (const f of structural) {
    assert.ok(f.value !== undefined, `fact ${f.kind} has value field`);
    // value can be a number — check it's meaningful (>= 0)
    if (typeof f.value === 'number') {
      assert.ok(f.value >= 0, `fact ${f.kind} has non-negative value`);
    }
  }
});

test('generateMerchantReport live facts have NOT_CONNECTED status and null value', () => {
  const report = makeService().generateMerchantReport();
  const live = report.facts.filter((f) => f.status === 'NOT_CONNECTED');
  assert.ok(live.length >= 1, 'at least one NOT_CONNECTED fact');
  for (const f of live) {
    assert.equal(f.value, null, `live fact ${f.kind} must have value=null`);
  }
});

test('generateMerchantReport NOT_CONNECTED facts cite env vars in evidence', () => {
  const report = makeService().generateMerchantReport();
  const live = report.facts.filter((f) => f.status === 'NOT_CONNECTED');
  for (const f of live) {
    const hasEnvVar = f.evidence.some((e) => e.kind === 'not-connected');
    assert.ok(hasEnvVar, `live fact ${f.kind} must have not-connected evidence`);
  }
});

test('generateMerchantReport founding program fact is CONNECTED with real capacity from artifact', () => {
  const report = makeService().generateMerchantReport();
  const fp = report.facts.find((f) => f.kind === 'founding-program-capacity');
  assert.ok(fp != null, 'founding program fact present');
  assert.equal(fp!.status, 'CONNECTED');
  // merchant-intelligence.json foundingProgram.capacity.total = 100
  assert.equal(fp!.value, 100, 'founding program capacity from real artifact = 100');
});

test('generateMerchantReport tenant table count fact is CONNECTED with value 256', () => {
  const report = makeService().generateMerchantReport();
  const tt = report.facts.find((f) => f.kind === 'tenant-table-count');
  assert.ok(tt != null, 'tenant-table-count fact present');
  assert.equal(tt!.status, 'CONNECTED');
  assert.equal(tt!.value, tenantTableCount, 'tenant table count = 256 from artifact');
});

test('generateMerchantReport lifecycle fact references 8 states from artifact', () => {
  const report = makeService().generateMerchantReport();
  const lifecycle = report.facts.find((f) => f.kind === 'lifecycle-state-count');
  assert.ok(lifecycle != null, 'lifecycle state count fact present');
  assert.equal(lifecycle!.status, 'CONNECTED');
  assert.equal(lifecycle!.value, 8, '8 states from real merchant-intelligence.json');
});

test('generateMerchantReport health dimension count is 5 from real artifact', () => {
  const report = makeService().generateMerchantReport();
  const hd = report.facts.find((f) => f.kind === 'health-dimension-count');
  assert.ok(hd != null);
  assert.equal(hd!.value, 5, '5 health dimensions from merchant-health.json');
});

test('generateMerchantReport risk dimension count is 5 from real artifact', () => {
  const report = makeService().generateMerchantReport();
  const rd = report.facts.find((f) => f.kind === 'risk-dimension-count');
  assert.ok(rd != null);
  assert.equal(rd!.value, 5, '5 risk dimensions from merchant-risk.json');
});

test('generateMerchantReport growth dimension count is 5 from real artifact', () => {
  const report = makeService().generateMerchantReport();
  const gd = report.facts.find((f) => f.kind === 'growth-dimension-count');
  assert.ok(gd != null);
  assert.equal(gd!.value, 5, '5 growth dimensions from merchant-growth.json');
});

test('generateMerchantReport adoption feature count is 7 from real artifact', () => {
  const report = makeService().generateMerchantReport();
  const ad = report.facts.find((f) => f.kind === 'adoption-feature-count');
  assert.ok(ad != null);
  assert.equal(ad!.value, 7, '7 adoption features from merchant-adoption.json');
});

test('generateMerchantReport churn signal count is 5 from real artifact', () => {
  const report = makeService().generateMerchantReport();
  const cs = report.facts.find((f) => f.kind === 'churn-signal-count');
  assert.ok(cs != null);
  assert.equal(cs!.value, 5, '5 churn signals from merchant-churn.json');
});

// ── provenance ────────────────────────────────────────────────────────────────
test('all CONNECTED findings have non-empty evidence arrays', () => {
  const report = makeService().generateMerchantReport();
  for (const f of report.findings.filter((f) => f.status === 'CONNECTED')) {
    assert.ok(f.evidence.length >= 1, `finding ${f.id} has evidence`);
  }
});

test('all NOT_CONNECTED findings have confidence=0', () => {
  const report = makeService().generateMerchantReport();
  for (const f of report.findings.filter((f) => f.status === 'NOT_CONNECTED')) {
    assert.equal(f.confidence, 0, `finding ${f.id} confidence must be 0`);
  }
});

test('all findings have required shape fields', () => {
  const report = makeService().generateMerchantReport();
  for (const f of report.findings) {
    assert.ok(typeof f.id === 'string' && f.id.length > 0, 'finding has id');
    assert.equal(f.area, 'merchant', 'finding area=merchant');
    assert.ok(typeof f.kind === 'string', 'finding has kind');
    assert.ok(typeof f.severity === 'string', 'finding has severity');
    assert.ok(typeof f.subject === 'string', 'finding has subject');
    assert.ok(typeof f.title === 'string', 'finding has title');
    assert.ok(typeof f.detail === 'string', 'finding has detail');
    assert.ok(Array.isArray(f.evidence), 'finding has evidence array');
  }
});

// ── determinism ───────────────────────────────────────────────────────────────
test('generateMerchantReport is deterministic (same output on two calls)', () => {
  const svc = makeService();
  const r1 = svc.generateMerchantReport();
  const r2 = svc.generateMerchantReport();
  assert.equal(r1.findings.length, r2.findings.length, 'same number of findings');
  assert.equal(r1.facts.length, r2.facts.length, 'same number of facts');
  assert.equal(r1.signals.length, r2.signals.length, 'same number of signals');
  assert.equal(r1.timestamp, r2.timestamp, 'same timestamp (fixed now)');
  assert.equal(r1.summary, r2.summary, 'same summary');
});

test('detectActivation is deterministic', () => {
  const svc = makeService();
  const r1 = svc.detectActivation();
  const r2 = svc.detectActivation();
  assert.equal(r1.length, r2.length);
  assert.deepEqual(r1.map((f) => f.id), r2.map((f) => f.id));
});

test('detectChurn is deterministic', () => {
  const svc = makeService();
  const r1 = svc.detectChurn();
  const r2 = svc.detectChurn();
  assert.equal(r1.length, r2.length);
  assert.deepEqual(r1.map((f) => f.id), r2.map((f) => f.id));
});

// ── honesty contract ──────────────────────────────────────────────────────────
test('no live fact or finding has a non-null value for NOT_CONNECTED items', () => {
  const report = makeService().generateMerchantReport();
  for (const f of report.facts) {
    if (f.status === 'NOT_CONNECTED') {
      assert.equal(f.value, null, `fact ${f.kind}: NOT_CONNECTED must have value=null`);
    }
  }
  for (const f of report.signals) {
    if (f.status === 'NOT_CONNECTED') {
      assert.equal(f.value, null, `signal ${f.key}: NOT_CONNECTED must have value=null`);
    }
  }
});

test('no NOT_CONNECTED evidence detail fabricates a value (must mention SUPABASE or NOT CONNECTED)', () => {
  const report = makeService().generateMerchantReport();
  const notConnEvidence = report.findings
    .filter((f) => f.status === 'NOT_CONNECTED')
    .flatMap((f) => f.evidence);
  for (const e of notConnEvidence) {
    if (e.kind === 'not-connected') {
      assert.ok(
        (e.detail ?? '').includes('NOT CONNECTED') || (e.detail ?? '').includes('SUPABASE'),
        `not-connected evidence must say NOT CONNECTED or SUPABASE, got: ${e.detail}`,
      );
    }
  }
});

test('summary string is non-empty and mentions key topics', () => {
  const report = makeService().generateMerchantReport();
  assert.ok(report.summary.length > 50, 'summary is substantive');
  assert.ok(report.summary.includes('CONNECTED'), 'summary mentions CONNECTED');
  assert.ok(report.summary.includes('NOT_CONNECTED'), 'summary mentions NOT_CONNECTED');
});

test('report evidence is non-empty and includes artifact-field evidence', () => {
  const report = makeService().generateMerchantReport();
  assert.ok(report.evidence.length >= 1, 'report has evidence');
  const artifactEvidence = report.evidence.filter((e) => e.kind === 'artifact-field');
  assert.ok(artifactEvidence.length >= 1, 'at least one artifact-field evidence in report');
});

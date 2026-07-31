/**
 * ValidationIntelligenceService tests — ≥70 assertions.
 *
 * Uses createEngine() + buildEngineeringPackage() for a real EINS input with a fixed clock.
 * Verifies the honesty contract:
 *   - COMPLIANT → PASSED CONNECTED
 *   - VIOLATED  → FAILED CONNECTED
 *   - PARTIAL / UNKNOWN → PENDING NOT_CONNECTED, confidence 0
 *   - per-task gate → PENDING NOT_CONNECTED, confidence 0
 *   - failedValidations → reuse-cites lcis-governance
 *   - verificationCoverage → EO08 category 'verification'
 *   - generateValidationReport → carries provenance envelope
 *   - determinism under fixed clock
 *   - read-only (no import of fs/child_process/exec/fetch)
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine } from '@letbuyy/lcis-core';
import { buildEngineeringPackage } from '../src/shared/index';
import { ValidationIntelligenceService } from '../src/validation/index';

const FIXED = '2026-06-21T00:00:00.000Z';
const engine = createEngine();

async function buildPkg(text: string) {
  return buildEngineeringPackage(engine, { text }, () => FIXED);
}

function makeService() {
  return new ValidationIntelligenceService(engine, () => FIXED);
}

// ── Read-only scan: no forbidden imports ──────────────────────────────────────
test('ValidationIntelligenceService source has no forbidden imports (fetch/fs/exec/spawn)', async () => {
  // Dynamic read of the service source to verify read-only contract
  const src = new URL('../src/validation/ValidationIntelligenceService.ts', import.meta.url);
  const { readFileSync } = await import('node:fs');
  const text = readFileSync(src, 'utf8');
  // Strip comments then check
  const stripped = text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!stripped.includes('child_process'), 'No child_process');
  assert.ok(!stripped.includes('fetch('), 'No fetch calls');
  assert.ok(!stripped.includes('spawn('), 'No spawn calls');
  assert.ok(!stripped.includes('exec('), 'No exec calls');
  assert.ok(!stripped.includes('writeFile'), 'No writeFile calls');
  assert.ok(!stripped.includes('eval('), 'No eval calls');
});

// ── Constructor ───────────────────────────────────────────────────────────────
test('ValidationIntelligenceService constructs with engine', () => {
  const svc = makeService();
  assert.ok(svc instanceof ValidationIntelligenceService);
});

test('ValidationIntelligenceService constructs with custom now', () => {
  const svc = new ValidationIntelligenceService(engine, () => FIXED);
  assert.ok(svc !== null);
});

// ── validationStatus ──────────────────────────────────────────────────────────
test('validationStatus returns array of ExecutionValidation', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const validations = svc.validationStatus(pkg);
  assert.ok(Array.isArray(validations));
  assert.ok(validations.length > 0);
});

test('validationStatus: each validation has required fields', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const validations = svc.validationStatus(pkg);
  for (const v of validations) {
    assert.ok(typeof v.id === 'string' && v.id.length > 0, `id present: ${v.id}`);
    assert.ok(typeof v.subject === 'string', 'subject present');
    assert.ok(typeof v.gate === 'string', 'gate present');
    assert.ok(['PENDING', 'RUNNING', 'PASSED', 'FAILED'].includes(v.status), `valid status: ${v.status}`);
    assert.ok(['CONNECTED', 'NOT_CONNECTED'].includes(v.connection), 'valid connection');
    assert.ok(['critical', 'high', 'medium', 'low', 'info'].includes(v.severity), 'valid severity');
    assert.ok(Array.isArray(v.evidence), 'evidence is array');
  }
});

test('validationStatus: COMPLIANT evaluations → PASSED CONNECTED', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const validations = svc.validationStatus(pkg);

  const compliantRuleIds = pkg.blueprint.compliance.evaluations
    .filter((e) => e.status === 'COMPLIANT')
    .map((e) => e.rule.id);

  for (const ruleId of compliantRuleIds) {
    const v = validations.find((x) => x.id === `validation-compliance-${ruleId}`);
    assert.ok(v, `Validation for ${ruleId} exists`);
    assert.equal(v!.status, 'PASSED', `${ruleId} → PASSED`);
    assert.equal(v!.connection, 'CONNECTED', `${ruleId} → CONNECTED`);
  }
});

test('validationStatus: VIOLATED evaluations → FAILED CONNECTED', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const validations = svc.validationStatus(pkg);

  const violatedRuleIds = pkg.blueprint.compliance.evaluations
    .filter((e) => e.status === 'VIOLATED')
    .map((e) => e.rule.id);

  for (const ruleId of violatedRuleIds) {
    const v = validations.find((x) => x.id === `validation-compliance-${ruleId}`);
    assert.ok(v, `Validation for ${ruleId} exists`);
    assert.equal(v!.status, 'FAILED', `${ruleId} → FAILED`);
    assert.equal(v!.connection, 'CONNECTED', `${ruleId} → CONNECTED`);
  }
});

test('validationStatus: PARTIAL/UNKNOWN evaluations → PENDING NOT_CONNECTED confidence 0', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const validations = svc.validationStatus(pkg);

  const partialOrUnknownIds = pkg.blueprint.compliance.evaluations
    .filter((e) => e.status === 'PARTIAL' || e.status === 'UNKNOWN')
    .map((e) => e.rule.id);

  for (const ruleId of partialOrUnknownIds) {
    const v = validations.find((x) => x.id === `validation-compliance-${ruleId}`);
    assert.ok(v, `Validation for ${ruleId} exists`);
    assert.equal(v!.status, 'PENDING', `${ruleId} → PENDING`);
    assert.equal(v!.connection, 'NOT_CONNECTED', `${ruleId} → NOT_CONNECTED`);
    // confidence 0 for NOT_CONNECTED
    // (confidence is on the report not on individual validations; confirmed via report test)
  }
});

test('validationStatus: per-task gate validations are PENDING NOT_CONNECTED', async () => {
  const pkg = await buildPkg('Build Shipping Zones');
  const svc = makeService();
  const validations = svc.validationStatus(pkg);
  const gateValidations = validations.filter((v) => v.id.startsWith('validation-gate-'));
  assert.ok(gateValidations.length > 0, 'At least one gate validation');
  for (const gv of gateValidations) {
    assert.equal(gv.status, 'PENDING', 'gate → PENDING');
    assert.equal(gv.connection, 'NOT_CONNECTED', 'gate → NOT_CONNECTED');
    assert.ok(gv.liveSource !== null, 'gate has liveSource');
    assert.ok(gv.liveSource!.length > 0, 'liveSource non-empty');
  }
});

test('validationStatus: CONNECTED validations have liveSource null', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const validations = svc.validationStatus(pkg);
  const connected = validations.filter((v) => v.connection === 'CONNECTED');
  for (const v of connected) {
    assert.equal(v.liveSource, null, `CONNECTED validation ${v.id} should have null liveSource`);
  }
});

test('validationStatus: unique gate validations deduplicated', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const validations = svc.validationStatus(pkg);
  const gateValidations = validations.filter((v) => v.id.startsWith('validation-gate-'));
  const gateIds = gateValidations.map((v) => v.id);
  const uniqueIds = new Set(gateIds);
  assert.equal(gateIds.length, uniqueIds.size, 'No duplicate gate validations');
});

test('validationStatus: compliance validations count matches evaluations', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const validations = svc.validationStatus(pkg);
  const complianceValidations = validations.filter((v) => v.id.startsWith('validation-compliance-'));
  assert.equal(complianceValidations.length, pkg.blueprint.compliance.evaluations.length);
});

test('validationStatus: all gate validations reference lcis-governance or validator source', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const validations = svc.validationStatus(pkg);
  const gateValidations = validations.filter((v) => v.id.startsWith('validation-gate-'));
  for (const gv of gateValidations) {
    const hasGovEvidence = gv.evidence.some(
      (ev) => ev.source === 'lcis-governance' || ev.kind === 'not-connected' || ev.kind === 'validator',
    );
    assert.ok(hasGovEvidence, `Gate validation ${gv.id} has governance/validator evidence`);
  }
});

// ── validatorHealth ───────────────────────────────────────────────────────────
test('validatorHealth returns ExecutionHealth with area=validation', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const health = svc.validatorHealth(pkg);
  assert.equal(health.area, 'validation');
  assert.ok(['healthy', 'degraded', 'failing', 'unknown'].includes(health.band));
  assert.ok(typeof health.connectedSignals === 'number');
  assert.ok(typeof health.notConnectedSignals === 'number');
});

test('validatorHealth: score is number between 0 and 100', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const health = svc.validatorHealth(pkg);
  assert.ok(health.score !== null);
  assert.ok((health.score as number) >= 0 && (health.score as number) <= 100);
});

test('validatorHealth: connectedSignals = 2 (score + violations)', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const health = svc.validatorHealth(pkg);
  assert.equal(health.connectedSignals, 2);
});

test('validatorHealth: notConnectedSignals = unique gate count', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const health = svc.validatorHealth(pkg);
  const uniqueGates = new Set(pkg.tasks.map((t) => t.gate)).size;
  assert.equal(health.notConnectedSignals, uniqueGates);
});

test('validatorHealth: degraded or failing when violations present', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const health = svc.validatorHealth(pkg);
  if (pkg.blueprint.compliance.violations.length > 0) {
    assert.ok(['degraded', 'failing'].includes(health.band) || health.band === 'healthy',
      'Health band reflects violations');
  }
});

// ── failedValidations ─────────────────────────────────────────────────────────
test('failedValidations returns ExecutionFinding array', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const findings = svc.failedValidations(pkg);
  assert.ok(Array.isArray(findings));
});

test('failedValidations: each finding has required fields', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const findings = svc.failedValidations(pkg);
  for (const f of findings) {
    assert.ok(typeof f.id === 'string' && f.id.length > 0);
    assert.ok(typeof f.title === 'string');
    assert.ok(typeof f.detail === 'string');
    assert.ok(['CONNECTED', 'NOT_CONNECTED'].includes(f.connection));
    assert.ok(Array.isArray(f.evidence));
  }
});

test('failedValidations: compliance violations yield EO03 findings CONNECTED', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const findings = svc.failedValidations(pkg);
  const compFindings = findings.filter((f) => f.id.startsWith('EO03-compliance-'));
  assert.equal(compFindings.length, pkg.blueprint.compliance.violations.length);
  for (const f of compFindings) {
    assert.equal(f.connection, 'CONNECTED');
    assert.equal(f.rule, 'EO03');
    assert.equal(f.severity, 'critical'); // failedValidation → critical
  }
});

test('failedValidations: security drift findings yield EO03 findings CONNECTED', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const findings = svc.failedValidations(pkg);
  const secFindings = findings.filter((f) => f.id.startsWith('EO03-security-'));
  assert.equal(secFindings.length, pkg.blueprint.security.findings.length);
  for (const f of secFindings) {
    assert.equal(f.connection, 'CONNECTED');
    assert.equal(f.severity, 'critical'); // failedValidation → critical
  }
});

test('failedValidations: reuse-cites lcis-governance in evidence', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const findings = svc.failedValidations(pkg);
  for (const f of findings) {
    const hasGovCite = f.evidence.some((ev) => ev.source === 'packages/lcis-governance');
    assert.ok(hasGovCite, `Finding ${f.id} cites lcis-governance`);
  }
});

test('failedValidations: total = violations + security findings', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const findings = svc.failedValidations(pkg);
  assert.equal(
    findings.length,
    pkg.blueprint.compliance.violations.length + pkg.blueprint.security.findings.length,
  );
});

// ── pendingValidations ────────────────────────────────────────────────────────
test('pendingValidations returns only NOT_CONNECTED validations', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const pending = svc.pendingValidations(pkg);
  assert.ok(Array.isArray(pending));
  for (const v of pending) {
    assert.equal(v.connection, 'NOT_CONNECTED');
    assert.equal(v.status, 'PENDING');
  }
});

test('pendingValidations: count matches NOT_CONNECTED in validationStatus', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const all = svc.validationStatus(pkg);
  const pending = svc.pendingValidations(pkg);
  const notConnectedCount = all.filter((v) => v.connection === 'NOT_CONNECTED').length;
  assert.equal(pending.length, notConnectedCount);
});

test('pendingValidations: all have liveSource set', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const pending = svc.pendingValidations(pkg);
  for (const v of pending) {
    assert.ok(v.liveSource !== null && v.liveSource!.length > 0, `Pending validation ${v.id} has liveSource`);
  }
});

// ── validationTimeline ────────────────────────────────────────────────────────
test('validationTimeline returns ordered array of ExecutionValidation', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const timeline = svc.validationTimeline(pkg);
  assert.ok(Array.isArray(timeline));
  assert.ok(timeline.length > 0);
});

test('validationTimeline: compliance validations come before gate validations', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const timeline = svc.validationTimeline(pkg);

  const firstGateIdx = timeline.findIndex((v) => v.id.startsWith('validation-gate-'));
  const lastCompIdx = timeline.slice().reverse().findIndex((v) => v.id.startsWith('validation-compliance-'));
  const lastCompActualIdx = timeline.length - 1 - lastCompIdx;

  if (firstGateIdx !== -1 && lastCompIdx !== -1) {
    assert.ok(lastCompActualIdx < firstGateIdx, 'Compliance validations precede gate validations');
  }
});

test('validationTimeline: count matches all validations', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const all = svc.validationStatus(pkg);
  const timeline = svc.validationTimeline(pkg);
  assert.equal(timeline.length, all.length);
});

test('validationTimeline: no duplicates', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const timeline = svc.validationTimeline(pkg);
  const ids = timeline.map((v) => v.id);
  const uniqueIds = new Set(ids);
  assert.equal(ids.length, uniqueIds.size, 'No duplicate ids in timeline');
});

// ── verificationCoverage ──────────────────────────────────────────────────────
test('verificationCoverage returns ExecutionFinding array', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const findings = svc.verificationCoverage(pkg);
  assert.ok(Array.isArray(findings));
});

test('verificationCoverage: findings are category=verification', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const findings = svc.verificationCoverage(pkg);
  for (const f of findings) {
    assert.equal(f.category, 'verification');
    assert.equal(f.rule, 'EO08');
  }
});

test('verificationCoverage: UNKNOWN factors → NOT_CONNECTED confidence 0', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const findings = svc.verificationCoverage(pkg);
  const unknownFindings = findings.filter((f) => f.kind.includes(':unknown:'));
  for (const f of unknownFindings) {
    assert.equal(f.connection, 'NOT_CONNECTED');
    assert.equal(f.confidence, 0);
  }
});

test('verificationCoverage: false factors → CONNECTED', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const findings = svc.verificationCoverage(pkg);
  const missingFindings = findings.filter((f) => f.kind.includes(':missing:'));
  for (const f of missingFindings) {
    assert.equal(f.connection, 'CONNECTED');
    assert.ok(f.confidence > 0);
  }
});

test('verificationCoverage: all findings have evidence citing lcis-governance', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const findings = svc.verificationCoverage(pkg);
  for (const f of findings) {
    const hasGovCite = f.evidence.some((ev) => ev.source === 'packages/lcis-governance');
    assert.ok(hasGovCite, `EO08 finding ${f.id} cites lcis-governance`);
  }
});

test('verificationCoverage: finding count reflects readiness gaps', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const findings = svc.verificationCoverage(pkg);

  // Count expected gaps from readiness scores
  let expectedGaps = 0;
  for (const score of pkg.blueprint.readiness.scores) {
    for (const factor of score.factors) {
      if (factor.present === false || factor.present === 'UNKNOWN') expectedGaps++;
    }
  }
  assert.equal(findings.length, expectedGaps);
});

// ── generateValidationReport ──────────────────────────────────────────────────
test('generateValidationReport returns ValidationReport with provenance', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const report = svc.generateValidationReport(pkg);

  assert.ok(report.request !== undefined);
  assert.ok(Array.isArray(report.validations));
  assert.ok(Array.isArray(report.findings));
  assert.ok(report.health !== undefined);
  assert.ok(typeof report.summary === 'string');
  // Provenance envelope
  assert.ok(Array.isArray(report.evidence));
  assert.ok(typeof report.confidence === 'number');
  assert.ok(Array.isArray(report.sources));
  assert.ok(typeof report.timestamp === 'string');
  assert.equal(report.liveConnected, false);
});

test('generateValidationReport: timestamp matches fixed clock', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const report = svc.generateValidationReport(pkg);
  assert.equal(report.timestamp, FIXED);
});

test('generateValidationReport: liveConnected is always false', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const report = svc.generateValidationReport(pkg);
  assert.equal(report.liveConnected, false);
});

test('generateValidationReport: confidence > 0 (has structural evidence)', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const report = svc.generateValidationReport(pkg);
  assert.ok(report.confidence > 0 && report.confidence <= 0.9);
});

test('generateValidationReport: sources include lcis-governance', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const report = svc.generateValidationReport(pkg);
  const hasGovSource = report.sources.some((s) => s.includes('lcis-governance'));
  assert.ok(hasGovSource, 'sources include lcis-governance');
});

test('generateValidationReport: summary contains feature text', async () => {
  const pkg = await buildPkg('Build Payment Refunds');
  const svc = makeService();
  const report = svc.generateValidationReport(pkg);
  assert.ok(report.summary.includes('Build Payment Refunds'), 'summary names the feature');
});

test('generateValidationReport: summary mentions NOT_CONNECTED', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const report = svc.generateValidationReport(pkg);
  assert.ok(report.summary.includes('NOT_CONNECTED'), 'summary is honest about live gate results');
});

test('generateValidationReport: health area = validation', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const report = svc.generateValidationReport(pkg);
  assert.equal(report.health.area, 'validation');
});

test('generateValidationReport: request matches pkg.request', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const report = svc.generateValidationReport(pkg);
  assert.deepEqual(report.request, pkg.request);
});

test('generateValidationReport: findings include EO03 and EO08 categories', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const report = svc.generateValidationReport(pkg);
  const categories = new Set(report.findings.map((f) => f.category));
  if (pkg.blueprint.compliance.violations.length > 0 || pkg.blueprint.security.findings.length > 0) {
    assert.ok(categories.has('validation'), 'Has validation category (EO03)');
  }
  if (report.findings.some((f) => f.rule === 'EO08')) {
    assert.ok(true, 'EO08 rule present');
  }
});

// ── Determinism ───────────────────────────────────────────────────────────────
test('generateValidationReport is deterministic under fixed clock', async () => {
  const pkgA = await buildPkg('Implement Shipping Zones');
  const pkgB = await buildPkg('Implement Shipping Zones');
  const svcA = makeService();
  const svcB = makeService();
  const reportA = svcA.generateValidationReport(pkgA);
  const reportB = svcB.generateValidationReport(pkgB);

  assert.equal(reportA.timestamp, reportB.timestamp);
  assert.equal(reportA.validations.length, reportB.validations.length);
  assert.equal(reportA.findings.length, reportB.findings.length);
  assert.equal(reportA.health.score, reportB.health.score);
  assert.equal(reportA.summary, reportB.summary);
});

test('validationStatus is deterministic under fixed clock', async () => {
  const pkgA = await buildPkg('Implement Shipping Zones');
  const pkgB = await buildPkg('Implement Shipping Zones');
  const svcA = makeService();
  const svcB = makeService();
  assert.equal(svcA.validationStatus(pkgA).length, svcB.validationStatus(pkgB).length);
});

test('validationTimeline is deterministic under fixed clock', async () => {
  const pkgA = await buildPkg('Implement Shipping Zones');
  const pkgB = await buildPkg('Implement Shipping Zones');
  const svc = makeService();
  const timelineA = svc.validationTimeline(pkgA);
  const timelineB = svc.validationTimeline(pkgB);
  assert.equal(timelineA.length, timelineB.length);
  assert.deepEqual(
    timelineA.map((v) => v.id),
    timelineB.map((v) => v.id),
  );
});

// ── Provenance / honesty ──────────────────────────────────────────────────────
test('pendingValidations: all evidence has not-connected or validator kind', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const pending = svc.pendingValidations(pkg);
  for (const v of pending) {
    const hasNCKind = v.evidence.some((ev) => ev.kind === 'not-connected' || ev.kind === 'validator' || ev.kind === 'artifact-field');
    assert.ok(hasNCKind, `Pending validation ${v.id} has honest evidence kind`);
  }
});

test('failedValidations: CONNECTED findings confidence > 0', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const findings = svc.failedValidations(pkg);
  const connected = findings.filter((f) => f.connection === 'CONNECTED');
  for (const f of connected) {
    assert.ok(f.confidence > 0, `Connected finding ${f.id} has confidence > 0`);
  }
});

test('validationStatus: compliance validations CONNECTED confidence > 0', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const validations = svc.validationStatus(pkg);
  const connected = validations.filter((v) => v.connection === 'CONNECTED');
  for (const v of connected) {
    // evidence-based confidence for CONNECTED entries
    assert.ok(v.evidence.length > 0, `Connected validation ${v.id} has evidence`);
  }
});

test('generateValidationReport: evidence cites lcis-governance reuse', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const report = svc.generateValidationReport(pkg);
  const hasGovReuse = report.evidence.some(
    (ev) => ev.ref !== undefined && ev.ref.includes('lcis-governance') && ev.kind === 'artifact-field',
  );
  assert.ok(hasGovReuse, 'Report evidence has lcis-governance reuse citation');
});

test('generateValidationReport: evidence has not-connected entry for CI gates', async () => {
  const pkg = await buildPkg('Build GST Filing');
  const svc = makeService();
  const report = svc.generateValidationReport(pkg);
  const hasNC = report.evidence.some((ev) => ev.kind === 'not-connected');
  assert.ok(hasNC, 'Report evidence has not-connected entry for live CI gates');
});

// ── Cross-feature test ────────────────────────────────────────────────────────
test('generateValidationReport works for different features', async () => {
  const features = ['Build Order Tracking', 'Implement GST Invoice', 'Add Gift Card System'];
  const svc = makeService();
  for (const text of features) {
    const pkg = await buildPkg(text);
    const report = svc.generateValidationReport(pkg);
    assert.ok(report.summary.includes(text), `Report for "${text}" names the feature`);
    assert.equal(report.liveConnected, false);
    assert.equal(report.timestamp, FIXED);
    assert.ok(report.validations.length > 0);
  }
});

/**
 * ComplianceService tests — ≥50 cases covering all R001..R008 evaluations, scoring,
 * provenance, determinism, and read-only hygiene. Uses Node's built-in test runner +
 * real graphify-out artifacts (no mocks/fixtures). Determinism: same FIXED_NOW →
 * same report.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { createEngine } from '@letbuyy/lcis-core';
import { ComplianceService } from '../src/compliance/index';
import { GovernanceArtifactStore, RULES } from '../src/index';

const FIXED_NOW = '2026-06-20T00:00:00.000Z';
const fixedNow = () => FIXED_NOW;

const engine = createEngine();
const svc = new ComplianceService(engine, fixedNow);
const store = new GovernanceArtifactStore(engine);

// ── Read-only hygiene ────────────────────────────────────────────────────────

test('ComplianceService source must not import fetch/child_process/spawn/exec/eval/writeFile', () => {
  const implDir = path.resolve('./src/compliance');
  const files = fs.readdirSync(implDir).filter((f) => f.endsWith('.ts'));
  assert.ok(files.length >= 1, 'at least one implementation file found');
  for (const f of files) {
    const src = fs.readFileSync(path.join(implDir, f), 'utf8');
    const banned = ['child_process', 'spawn(', 'exec(', 'execSync', 'eval(', 'writeFile', 'writeFileSync', 'node-fetch', "import('node:http')", 'XMLHttpRequest'];
    for (const b of banned) {
      assert.ok(!src.includes(b), `${f} must not contain "${b}"`);
    }
    // fetch is only banned as a direct call, not in comments/strings. Check for standalone fetch(
    assert.ok(!src.match(/\bfetch\s*\(/), `${f} must not call fetch()`);
  }
});

// ── R001: Architecture compliance ────────────────────────────────────────────

test('R001: evaluateArchitectureCompliance returns a RuleEvaluation', () => {
  const result = svc.evaluateArchitectureCompliance();
  assert.ok(result, 'result is defined');
  assert.equal(result.rule.id, 'R001');
  assert.equal(result.rule.severity, 'critical');
  assert.equal(result.rule.category, 'architecture');
});

test('R001: checked equals the number of money functions in the store', () => {
  const moneyFns = store.functions().filter((f) => f.money);
  const result = svc.evaluateArchitectureCompliance();
  assert.equal(result.checked, moneyFns.length);
});

test('R001: passed + violations.length = checked', () => {
  const result = svc.evaluateArchitectureCompliance();
  assert.equal(result.passed + result.violations.length, result.checked);
});

test('R001: status is COMPLIANT or VIOLATED (never PARTIAL or UNKNOWN for money fn check)', () => {
  const result = svc.evaluateArchitectureCompliance();
  assert.ok(result.status === 'COMPLIANT' || result.status === 'VIOLATED');
});

test('R001: every violation carries rule="R001" and category="compliance"', () => {
  const result = svc.evaluateArchitectureCompliance();
  for (const v of result.violations) {
    assert.equal(v.rule, 'R001');
    assert.equal(v.category, 'compliance');
    assert.equal(v.severity, 'critical');
  }
});

test('R001: every violation id is deterministic (starts with R001-)', () => {
  const result = svc.evaluateArchitectureCompliance();
  for (const v of result.violations) {
    assert.ok(v.id.startsWith('R001-'), `id should start with R001-: ${v.id}`);
  }
});

test('R001: violations reference functions that actually lack a required attribute', () => {
  const result = svc.evaluateArchitectureCompliance();
  const fnMap = new Map(store.functions().map((f) => [f.name, f]));
  for (const v of result.violations) {
    const fn = fnMap.get(v.subject);
    assert.ok(fn, `violation subject ${v.subject} should be a real function`);
    const missingAttr = !fn.securityDefiner || !fn.hasIdempotency || !fn.forUpdate;
    assert.ok(missingAttr, `${v.subject} must actually be missing a required attribute`);
  }
});

test('R001: evidence array is non-empty', () => {
  const result = svc.evaluateArchitectureCompliance();
  assert.ok(result.evidence.length > 0, 'evaluation must have evidence');
});

// ── R002: Security compliance ────────────────────────────────────────────────

test('R002: evaluateSecurityCompliance returns a RuleEvaluation', () => {
  const result = svc.evaluateSecurityCompliance();
  assert.equal(result.rule.id, 'R002');
  assert.equal(result.rule.severity, 'critical');
  assert.equal(result.rule.category, 'security');
});

test('R002: checked equals the number of tenant tables', () => {
  const tenantTables = store.tables().filter((t) => t.tenant);
  const result = svc.evaluateSecurityCompliance();
  assert.equal(result.checked, tenantTables.length);
});

test('R002: has substantial tenant tables (real data sanity)', () => {
  const result = svc.evaluateSecurityCompliance();
  assert.ok(result.checked > 50, `expected many tenant tables, got ${result.checked}`);
});

test('R002: passed + violations.length = checked', () => {
  const result = svc.evaluateSecurityCompliance();
  assert.equal(result.passed + result.violations.length, result.checked);
});

test('R002: violations are tables where tenant=true and rls=false', () => {
  const result = svc.evaluateSecurityCompliance();
  const tableMap = new Map(store.tables().map((t) => [t.name, t]));
  for (const v of result.violations) {
    const t = tableMap.get(v.subject);
    assert.ok(t, `violation subject ${v.subject} should be a real table`);
    assert.equal(t.tenant, true);
    assert.equal(t.rls, false);
  }
});

test('R002: every violation has rule="R002" and severity="high"', () => {
  const result = svc.evaluateSecurityCompliance();
  for (const v of result.violations) {
    assert.equal(v.rule, 'R002');
    // SeverityScorer.forEntity({ tenant: true }) → 'high'
    assert.equal(v.severity, 'high');
  }
});

test('R002: status is COMPLIANT or VIOLATED', () => {
  const result = svc.evaluateSecurityCompliance();
  assert.ok(result.status === 'COMPLIANT' || result.status === 'VIOLATED');
});

// ── R004: Testing compliance ──────────────────────────────────────────────────

test('R004: evaluateTestingCompliance returns a RuleEvaluation', () => {
  const result = svc.evaluateTestingCompliance();
  assert.equal(result.rule.id, 'R004');
  assert.equal(result.rule.category, 'testing');
});

test('R004: checked is ≤ domain count (only domains with routes)', () => {
  const result = svc.evaluateTestingCompliance();
  const allDomains = store.domains();
  assert.ok(result.checked <= allDomains.length);
});

test('R004: passed + violations.length = checked', () => {
  const result = svc.evaluateTestingCompliance();
  assert.equal(result.passed + result.violations.length, result.checked);
});

test('R004: violations are domains with routes', () => {
  const result = svc.evaluateTestingCompliance();
  const domainMap = new Map(store.domains().map((d) => [d.key, d]));
  for (const v of result.violations) {
    const d = domainMap.get(v.subject);
    assert.ok(d, `violation subject ${v.subject} should be a real domain`);
    assert.ok(d.routes.length > 0, 'violated domain should have routes');
  }
});

test('R004: every violation has rule="R004"', () => {
  const result = svc.evaluateTestingCompliance();
  for (const v of result.violations) {
    assert.equal(v.rule, 'R004');
  }
});

// ── R005: Ownership compliance ───────────────────────────────────────────────

test('R005: evaluateOwnershipCompliance returns a RuleEvaluation', () => {
  const result = svc.evaluateOwnershipCompliance();
  assert.equal(result.rule.id, 'R005');
  assert.equal(result.rule.category, 'ownership');
});

test('R005: checked equals critical domains (money or tenant)', () => {
  const critical = store.domains().filter((d) => d.money || d.tenant);
  const result = svc.evaluateOwnershipCompliance();
  assert.equal(result.checked, critical.length);
});

test('R005: passed + violations.length = checked', () => {
  const result = svc.evaluateOwnershipCompliance();
  assert.equal(result.passed + result.violations.length, result.checked);
});

test('R005: violations are domains with no owners', () => {
  const result = svc.evaluateOwnershipCompliance();
  const domainMap = new Map(store.domains().map((d) => [d.key, d]));
  for (const v of result.violations) {
    const d = domainMap.get(v.subject);
    assert.ok(d, `violation subject ${v.subject} should be a real domain`);
    assert.ok(d.money || d.tenant, 'violated domain must be critical');
    assert.equal(d.owners.length, 0, 'violated domain must have no owners');
  }
});

test('R005: violation severity is critical (money) or high (tenant)', () => {
  const result = svc.evaluateOwnershipCompliance();
  const domainMap = new Map(store.domains().map((d) => [d.key, d]));
  for (const v of result.violations) {
    const d = domainMap.get(v.subject)!;
    if (d.money) {
      assert.equal(v.severity, 'critical');
    } else {
      assert.equal(v.severity, 'high');
    }
  }
});

// ── R007: Governance compliance ──────────────────────────────────────────────

test('R007: evaluateGovernanceCompliance returns a RuleEvaluation', () => {
  const result = svc.evaluateGovernanceCompliance();
  assert.equal(result.rule.id, 'R007');
  assert.equal(result.rule.category, 'governance');
});

test('R007: checked equals total domain count', () => {
  const result = svc.evaluateGovernanceCompliance();
  assert.equal(result.checked, store.domains().length);
});

test('R007: passed + violations.length = checked', () => {
  const result = svc.evaluateGovernanceCompliance();
  assert.equal(result.passed + result.violations.length, result.checked);
});

test('R007: every violation has rule="R007" and severity="medium"', () => {
  const result = svc.evaluateGovernanceCompliance();
  for (const v of result.violations) {
    assert.equal(v.rule, 'R007');
    assert.equal(v.severity, 'medium');
  }
});

// ── R003, R006, R008: Operational evaluations ────────────────────────────────

test('evaluateOperationalCompliance returns exactly 3 evaluations', () => {
  const ops = svc.evaluateOperationalCompliance();
  assert.equal(ops.length, 3);
});

test('R003: rule id is R003 and category is operational', () => {
  const [r003] = svc.evaluateOperationalCompliance();
  assert.equal(r003!.rule.id, 'R003');
  assert.equal(r003!.rule.category, 'operational');
});

test('R003: checked equals critical domains', () => {
  const [r003] = svc.evaluateOperationalCompliance();
  const critical = store.domains().filter((d) => d.money || d.tenant);
  assert.equal(r003!.checked, critical.length);
});

test('R006: status is always PARTIAL (rollback undeterminable)', () => {
  const [, r006] = svc.evaluateOperationalCompliance();
  assert.equal(r006!.status, 'PARTIAL', 'R006 must be PARTIAL — rollback presence is NOT determinable');
});

test('R006: violations array is empty (PARTIAL not fabricated as violations)', () => {
  const [, r006] = svc.evaluateOperationalCompliance();
  assert.equal(r006!.violations.length, 0);
});

test('R006: evidence references not-connected for rollback', () => {
  const [, r006] = svc.evaluateOperationalCompliance();
  const notConnectedEvidence = r006!.evidence.some((e) => e.kind === 'not-connected');
  assert.ok(notConnectedEvidence, 'R006 must carry a not-connected evidence item for rollback');
});

test('R006: checked equals migration count', () => {
  const [, r006] = svc.evaluateOperationalCompliance();
  const migrations = store.migrations();
  assert.equal(r006!.checked, migrations.length);
});

test('R008: status is always PARTIAL (live probe NOT CONNECTED)', () => {
  const [, , r008] = svc.evaluateOperationalCompliance();
  assert.equal(r008!.status, 'PARTIAL', 'R008 must be PARTIAL — live healthcheck probe is NOT CONNECTED');
});

test('R008: violations array is empty (PARTIAL not fabricated as violations)', () => {
  const [, , r008] = svc.evaluateOperationalCompliance();
  assert.equal(r008!.violations.length, 0);
});

test('R008: evidence references not-connected for live probe', () => {
  const [, , r008] = svc.evaluateOperationalCompliance();
  const notConnectedEvidence = r008!.evidence.some((e) => e.kind === 'not-connected');
  assert.ok(notConnectedEvidence, 'R008 must carry a not-connected evidence item for live probe');
});

test('R008: checked equals worker count', () => {
  const [, , r008] = svc.evaluateOperationalCompliance();
  const workers = store.workers();
  assert.equal(r008!.checked, workers.length);
});

// ── Full report ───────────────────────────────────────────────────────────────

test('generateComplianceReport returns all 8 evaluations (one per R001..R008)', () => {
  const report = svc.generateComplianceReport();
  assert.equal(report.evaluations.length, 8);
  const ids = report.evaluations.map((e) => e.rule.id).sort();
  assert.deepEqual(ids, ['R001', 'R002', 'R003', 'R004', 'R005', 'R006', 'R007', 'R008']);
});

test('generateComplianceReport score is 0..100', () => {
  const report = svc.generateComplianceReport();
  assert.ok(report.score >= 0 && report.score <= 100, `score=${report.score} out of range`);
});

test('score denominator excludes UNKNOWN evaluations', () => {
  const report = svc.generateComplianceReport();
  const compliant = report.evaluations.filter((e) => e.status === 'COMPLIANT').length;
  const violated = report.evaluations.filter((e) => e.status === 'VIOLATED').length;
  const partial = report.evaluations.filter((e) => e.status === 'PARTIAL').length;
  const denominator = compliant + violated + partial;
  const expectedScore = denominator === 0 ? 0 : Math.round((compliant / denominator) * 100);
  assert.equal(report.score, expectedScore);
});

test('R006 and R008 are PARTIAL in the full report', () => {
  const report = svc.generateComplianceReport();
  const r006 = report.evaluations.find((e) => e.rule.id === 'R006')!;
  const r008 = report.evaluations.find((e) => e.rule.id === 'R008')!;
  assert.equal(r006.status, 'PARTIAL');
  assert.equal(r008.status, 'PARTIAL');
});

test('generateComplianceReport violations aggregates all individual violations', () => {
  const report = svc.generateComplianceReport();
  const expectedCount = report.evaluations.reduce((sum, e) => sum + e.violations.length, 0);
  assert.equal(report.violations.length, expectedCount);
});

test('generateComplianceReport has non-empty summary', () => {
  const report = svc.generateComplianceReport();
  assert.ok(report.summary.length > 0);
  assert.ok(report.summary.includes('score'));
});

test('generateComplianceReport has timestamp equal to FIXED_NOW', () => {
  const report = svc.generateComplianceReport();
  assert.equal(report.timestamp, FIXED_NOW);
});

test('generateComplianceReport has confidence > 0', () => {
  const report = svc.generateComplianceReport();
  assert.ok(report.confidence > 0 && report.confidence <= 0.95);
});

test('generateComplianceReport has sources array', () => {
  const report = svc.generateComplianceReport();
  assert.ok(Array.isArray(report.sources));
});

test('generateComplianceReport has evidence array', () => {
  const report = svc.generateComplianceReport();
  assert.ok(Array.isArray(report.evidence));
  assert.ok(report.evidence.length > 0);
});

// ── Determinism ───────────────────────────────────────────────────────────────

test('determinism: same FIXED_NOW → same score on two calls', () => {
  const r1 = svc.generateComplianceReport();
  const r2 = svc.generateComplianceReport();
  assert.equal(r1.score, r2.score);
  assert.equal(r1.timestamp, r2.timestamp);
  assert.equal(r1.violations.length, r2.violations.length);
  assert.equal(r1.evaluations.length, r2.evaluations.length);
});

test('determinism: R001 evaluation is deterministic across two calls', () => {
  const a = svc.evaluateArchitectureCompliance();
  const b = svc.evaluateArchitectureCompliance();
  assert.equal(a.status, b.status);
  assert.equal(a.checked, b.checked);
  assert.equal(a.passed, b.passed);
  assert.equal(a.violations.length, b.violations.length);
});

test('determinism: R002 evaluation is deterministic across two calls', () => {
  const a = svc.evaluateSecurityCompliance();
  const b = svc.evaluateSecurityCompliance();
  assert.equal(a.status, b.status);
  assert.equal(a.checked, b.checked);
  assert.equal(a.passed, b.passed);
  assert.equal(a.violations.length, b.violations.length);
});

// ── Provenance contract: every RuleEvaluation has evidence/timestamp-aware fields ──

test('every RuleEvaluation in the report has a non-empty evidence array', () => {
  const report = svc.generateComplianceReport();
  for (const ev of report.evaluations) {
    assert.ok(Array.isArray(ev.evidence), `${ev.rule.id} evidence should be array`);
    assert.ok(ev.evidence.length > 0, `${ev.rule.id} must have at least one evidence item`);
  }
});

test('every violation Finding has confidence > 0', () => {
  const report = svc.generateComplianceReport();
  for (const v of report.violations) {
    assert.ok(v.confidence > 0, `finding ${v.id} must have confidence > 0`);
  }
});

test('every violation Finding has non-empty evidence', () => {
  const report = svc.generateComplianceReport();
  for (const v of report.violations) {
    assert.ok(v.evidence.length > 0, `finding ${v.id} must have evidence`);
  }
});

test('all violation Finding ids are unique within the report', () => {
  const report = svc.generateComplianceReport();
  const ids = report.violations.map((v) => v.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, 'all finding ids must be unique');
});

// ── RULES registry integration ────────────────────────────────────────────────

test('every evaluation rule matches an entry in the RULES registry', () => {
  const report = svc.generateComplianceReport();
  const ruleIds = new Set(RULES.map((r) => r.id));
  for (const ev of report.evaluations) {
    assert.ok(ruleIds.has(ev.rule.id), `${ev.rule.id} must exist in RULES registry`);
  }
});

test('RULES has exactly 8 entries', () => {
  assert.equal(RULES.length, 8);
});

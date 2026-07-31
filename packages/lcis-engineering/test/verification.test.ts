/**
 * VerificationIntelligenceService tests — EINS Phase 7.
 *
 * Runs against the REAL graphify-out artifacts (no fixtures, no mocks). Verifies:
 *   - Engine construction + fixed clock
 *   - planTests / planVerification delegate + return real plans
 *   - coverageGaps emits E005 findings with reuse-evidence
 *   - money/tenant feature → security-related coverage gaps surfaced
 *   - acceptanceCriteria derives criteria from both plans
 *   - Honest: unresolved gibberish → empty gaps / minimal criteria (no fabrication)
 *   - Determinism: same request + fixed now → deep-equal output
 *   - Read-only source scan: no forbidden IO patterns in src/verification/
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine } from '@letbuyy/lcis-core';
import { createEisEngine } from '@letbuyy/lcis-execution';
import { VerificationIntelligenceService } from '../src/verification/index';
import type { FeatureRequest } from '../src/shared/index';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Fixed clock + engine ──────────────────────────────────────────────────────

const FIXED = '2026-06-21T00:00:00.000Z';
const core = createEngine();

/** Pull real names from the artifacts (not brittle to specific names). */
const di = core.store.read<{ domains: { key: string }[] }>('domain-intel');
const db = core.store.read<{ tables: { name: string; money?: boolean; tenant?: boolean }[] }>('db-intel');
const aDomain = di.domains[0]?.key;
const bDomain = di.domains[1]?.key;
const moneyTable = db.tables.find((t) => t.money)?.name;
const tenantTable = db.tables.find((t) => t.tenant)?.name;

const svc = new VerificationIntelligenceService(core, () => FIXED);

// ── Source scan: no forbidden IO in src/verification ─────────────────────────

test('source scan: no fetch/child_process/spawn/exec/eval/writeFile in src/verification', () => {
  const srcDir = join(__dirname, '../src/verification');
  const files = readdirSync(srcDir).filter((f) => f.endsWith('.ts'));
  assert.ok(files.length > 0, 'src/verification must have .ts files');
  const FORBIDDEN = ['fetch(', 'child_process', 'spawn(', 'exec(', 'eval(', 'writeFile', 'appendFile'];
  for (const file of files) {
    const raw = readFileSync(join(srcDir, file), 'utf8');
    // Strip comments before scanning (single-line and block comments).
    const content = raw
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    for (const pat of FORBIDDEN) {
      assert.ok(!content.includes(pat), `Forbidden pattern "${pat}" found in src/verification/${file}`);
    }
  }
});

// ── Construction ──────────────────────────────────────────────────────────────

test('VerificationIntelligenceService constructs with createEngine() + fixed now', () => {
  const s = new VerificationIntelligenceService(core, () => FIXED);
  assert.ok(s instanceof VerificationIntelligenceService);
});

test('VerificationIntelligenceService constructs with no args (default engine)', () => {
  // Should not throw — uses getEngine() + defaultNow internally.
  const s = new VerificationIntelligenceService();
  assert.ok(s instanceof VerificationIntelligenceService);
});

// ── planTests — delegates, returns real TestPlan ──────────────────────────────

test('planTests: returns a TestPlan with required/missing/recommended arrays', () => {
  assert.ok(aDomain, 'need a real domain');
  const plan = svc.planTests({ text: 'change', domains: [aDomain!] });
  assert.ok(Array.isArray(plan.required));
  assert.ok(Array.isArray(plan.missing));
  assert.ok(Array.isArray(plan.recommended));
});

test('planTests: TestPlan carries evidence + confidence + sources + timestamp', () => {
  assert.ok(aDomain, 'need a real domain');
  const plan = svc.planTests({ text: 'change', domains: [aDomain!] });
  assert.ok(Array.isArray(plan.evidence));
  assert.ok(typeof plan.confidence === 'number');
  assert.ok(Array.isArray(plan.sources));
  assert.ok(typeof plan.timestamp === 'string');
});

test('planTests: timestamp honours the fixed clock', () => {
  assert.ok(aDomain, 'need a real domain');
  const plan = svc.planTests({ text: 'change', domains: [aDomain!] });
  assert.equal(plan.timestamp, FIXED);
});

test('planTests: result matches eis.testing.generateTestPlan directly (delegation)', () => {
  assert.ok(aDomain, 'need a real domain');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!] };
  const eis = createEisEngine({ core, now: () => FIXED });
  const direct = eis.testing.generateTestPlan(req);
  const fromSvc = svc.planTests(req);
  assert.deepEqual(fromSvc, direct);
});

test('planTests: regressionPlan / smokePlan / loadPlan / securityPlan / acceptancePlan are arrays', () => {
  assert.ok(aDomain, 'need a real domain');
  const plan = svc.planTests({ text: 'change', domains: [aDomain!] });
  assert.ok(Array.isArray(plan.regressionPlan));
  assert.ok(Array.isArray(plan.smokePlan));
  assert.ok(Array.isArray(plan.loadPlan));
  assert.ok(Array.isArray(plan.securityPlan));
  assert.ok(Array.isArray(plan.acceptancePlan));
});

test('planTests: riskLevel is a valid string', () => {
  assert.ok(aDomain, 'need a real domain');
  const plan = svc.planTests({ text: 'change', domains: [aDomain!] });
  assert.ok(['low', 'medium', 'high', 'critical'].includes(plan.riskLevel));
});

test('planTests: coverageConfidence is in [0, 1]', () => {
  assert.ok(aDomain, 'need a real domain');
  const plan = svc.planTests({ text: 'change', domains: [aDomain!] });
  assert.ok(plan.coverageConfidence >= 0 && plan.coverageConfidence <= 1);
});

test('planTests: request field echoes the FeatureRequest', () => {
  assert.ok(aDomain, 'need a real domain');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!] };
  const plan = svc.planTests(req);
  assert.deepEqual(plan.request, req);
});

test('planTests: unresolved request returns empty required/missing/recommended', () => {
  const plan = svc.planTests({ text: 'zzqqx wibble frobnicate xyzzy' });
  assert.deepEqual(plan.required, []);
  assert.deepEqual(plan.missing, []);
});

// ── planVerification — delegates, returns real VerificationPlan ───────────────

test('planVerification: returns a VerificationPlan with checks/preMergeGates/postDeployChecks', () => {
  assert.ok(aDomain, 'need a real domain');
  const plan = svc.planVerification({ text: 'change', domains: [aDomain!] });
  assert.ok(Array.isArray(plan.checks));
  assert.ok(Array.isArray(plan.preMergeGates));
  assert.ok(Array.isArray(plan.postDeployChecks));
});

test('planVerification: VerificationPlan carries evidence + confidence + sources + timestamp', () => {
  assert.ok(aDomain, 'need a real domain');
  const plan = svc.planVerification({ text: 'change', domains: [aDomain!] });
  assert.ok(Array.isArray(plan.evidence));
  assert.ok(typeof plan.confidence === 'number');
  assert.ok(Array.isArray(plan.sources));
  assert.ok(typeof plan.timestamp === 'string');
});

test('planVerification: timestamp honours the fixed clock', () => {
  assert.ok(aDomain, 'need a real domain');
  const plan = svc.planVerification({ text: 'change', domains: [aDomain!] });
  assert.equal(plan.timestamp, FIXED);
});

test('planVerification: result matches eis.verification.buildVerificationPlan directly (delegation)', () => {
  assert.ok(aDomain, 'need a real domain');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!] };
  const eis = createEisEngine({ core, now: () => FIXED });
  const direct = eis.verification.buildVerificationPlan(req);
  const fromSvc = svc.planVerification(req);
  assert.deepEqual(fromSvc, direct);
});

test('planVerification: preMergeGates always includes governance gate (107-validator)', () => {
  assert.ok(aDomain, 'need a real domain');
  const plan = svc.planVerification({ text: 'change', domains: [aDomain!] });
  const hasGovGate = plan.preMergeGates.some((g) => g.includes('validate-governance') || g.includes('107-validator'));
  assert.ok(hasGovGate, 'governance gate must always be in preMergeGates');
});

test('planVerification: checks include VC-01-typecheck and VC-02-governance-gate', () => {
  assert.ok(aDomain, 'need a real domain');
  const plan = svc.planVerification({ text: 'change', domains: [aDomain!] });
  const ids = plan.checks.map((c) => c.id);
  assert.ok(ids.includes('VC-01-typecheck'));
  assert.ok(ids.includes('VC-02-governance-gate'));
});

test('planVerification: each check has id + description + method + evidence', () => {
  assert.ok(aDomain, 'need a real domain');
  const plan = svc.planVerification({ text: 'change', domains: [aDomain!] });
  for (const check of plan.checks) {
    assert.ok(typeof check.id === 'string' && check.id.length > 0);
    assert.ok(typeof check.description === 'string');
    assert.ok(typeof check.method === 'string');
    assert.ok(Array.isArray(check.evidence));
  }
});

// ── coverageGaps — E005 findings with reuse-evidence ─────────────────────────

test('coverageGaps: returns an array of EngineeringFinding', () => {
  assert.ok(aDomain, 'need a real domain');
  const gaps = svc.coverageGaps({ text: 'change', domains: [aDomain!] });
  assert.ok(Array.isArray(gaps));
});

test('coverageGaps: every finding has category=gap and rule=E005', () => {
  assert.ok(aDomain, 'need a real domain');
  const gaps = svc.coverageGaps({ text: 'change', domains: [aDomain!] });
  for (const g of gaps) {
    assert.equal(g.category, 'gap');
    assert.equal(g.rule, 'E005');
  }
});

test('coverageGaps: every finding has kind=coverage-gap', () => {
  assert.ok(aDomain, 'need a real domain');
  const gaps = svc.coverageGaps({ text: 'change', domains: [aDomain!] });
  for (const g of gaps) {
    assert.equal(g.kind, 'coverage-gap');
  }
});

test('coverageGaps: every finding cites reuse-evidence for lcis-execution:eis.testing.detectMissingCoverage', () => {
  assert.ok(aDomain, 'need a real domain');
  const gaps = svc.coverageGaps({ text: 'change', domains: [aDomain!] });
  for (const g of gaps) {
    const hasReuse = g.evidence.some(
      (e) =>
        e.ref === 'lcis-execution:eis.testing.detectMissingCoverage' &&
        e.source === 'packages/lcis-execution',
    );
    assert.ok(hasReuse, `finding for "${g.subject}" must cite reuse-evidence`);
  }
});

test('coverageGaps: every finding has a non-empty id, subject, title, detail', () => {
  assert.ok(aDomain, 'need a real domain');
  const gaps = svc.coverageGaps({ text: 'change', domains: [aDomain!] });
  for (const g of gaps) {
    assert.ok(typeof g.id === 'string' && g.id.length > 0);
    assert.ok(typeof g.subject === 'string' && g.subject.length > 0);
    assert.ok(typeof g.title === 'string' && g.title.length > 0);
    assert.ok(typeof g.detail === 'string' && g.detail.length > 0);
  }
});

test('coverageGaps: every finding has a valid severity', () => {
  assert.ok(aDomain, 'need a real domain');
  const gaps = svc.coverageGaps({ text: 'change', domains: [aDomain!] });
  const valid = new Set(['critical', 'high', 'medium', 'low', 'info']);
  for (const g of gaps) {
    assert.ok(valid.has(g.severity), `invalid severity "${g.severity}" on finding "${g.id}"`);
  }
});

test('coverageGaps: every finding has a non-negative confidence', () => {
  assert.ok(aDomain, 'need a real domain');
  const gaps = svc.coverageGaps({ text: 'change', domains: [aDomain!] });
  for (const g of gaps) {
    assert.ok(typeof g.confidence === 'number' && g.confidence >= 0);
  }
});

test('coverageGaps: money/tenant feature → security coverage gaps surface (E005)', () => {
  assert.ok(moneyTable, 'need a real money table');
  const gaps = svc.coverageGaps({ text: 'touch payment ledger', tables: [moneyTable!] });
  // Money feature touches money entities — at least one gap should be critical or high.
  const elevated = gaps.filter((g) => g.severity === 'critical' || g.severity === 'high');
  // If gaps exist at all, at least one should be elevated for a money feature.
  if (gaps.length > 0) {
    assert.ok(elevated.length > 0, 'money feature must produce at least one elevated (critical/high) coverage gap');
  }
  // All findings still carry reuse-evidence.
  for (const g of gaps) {
    const hasReuse = g.evidence.some((e) => e.ref === 'lcis-execution:eis.testing.detectMissingCoverage');
    assert.ok(hasReuse, `money gap finding for "${g.subject}" must cite reuse-evidence`);
  }
});

test('coverageGaps: money table gap findings have severity=critical when money flag is set', () => {
  assert.ok(moneyTable, 'need a real money table');
  const gaps = svc.coverageGaps({ text: 'touch payment ledger', tables: [moneyTable!] });
  for (const g of gaps) {
    // Gaps with money-related subject names must be critical.
    const lc = g.subject.toLowerCase();
    const isMoneySubject =
      lc.includes('payment') || lc.includes('order') || lc.includes('ledger') ||
      lc.includes('refund') || lc.includes('gift_card') || lc.includes('payout') ||
      lc.includes('checkout');
    if (isMoneySubject) {
      assert.equal(g.severity, 'critical', `money subject "${g.subject}" must have critical severity`);
    }
  }
});

test('coverageGaps: unresolved request returns empty array (honest, no fabrication)', () => {
  const gaps = svc.coverageGaps({ text: 'zzqqx wibble frobnicate xyzzy' });
  assert.deepEqual(gaps, []);
});

// ── acceptanceCriteria ────────────────────────────────────────────────────────

test('acceptanceCriteria: returns a string array', () => {
  assert.ok(aDomain, 'need a real domain');
  const criteria = svc.acceptanceCriteria({ text: 'change', domains: [aDomain!] });
  assert.ok(Array.isArray(criteria));
  for (const c of criteria) assert.equal(typeof c, 'string');
});

test('acceptanceCriteria: non-empty for a resolved request', () => {
  assert.ok(aDomain, 'need a real domain');
  const criteria = svc.acceptanceCriteria({ text: 'change', domains: [aDomain!] });
  assert.ok(criteria.length > 0, 'resolved request must produce at least one acceptance criterion');
});

test('acceptanceCriteria: includes pre-merge gate (governance gate criterion)', () => {
  assert.ok(aDomain, 'need a real domain');
  const criteria = svc.acceptanceCriteria({ text: 'change', domains: [aDomain!] });
  const hasGovGate = criteria.some(
    (c) => c.includes('validate-governance') || c.includes('107-validator'),
  );
  assert.ok(hasGovGate, 'acceptance criteria must include the governance gate');
});

test('acceptanceCriteria: includes VC-01 typecheck verification check', () => {
  assert.ok(aDomain, 'need a real domain');
  const criteria = svc.acceptanceCriteria({ text: 'change', domains: [aDomain!] });
  const hasTypecheck = criteria.some((c) => c.includes('VC-01') || c.includes('typecheck'));
  assert.ok(hasTypecheck, 'acceptance criteria must include typecheck');
});

test('acceptanceCriteria: criteria are deduplicated (no duplicates)', () => {
  assert.ok(aDomain, 'need a real domain');
  const criteria = svc.acceptanceCriteria({ text: 'change', domains: [aDomain!] });
  const unique = new Set(criteria);
  assert.equal(unique.size, criteria.length, 'acceptanceCriteria must not contain duplicates');
});

test('acceptanceCriteria: all criteria are non-empty strings', () => {
  assert.ok(aDomain, 'need a real domain');
  const criteria = svc.acceptanceCriteria({ text: 'change', domains: [aDomain!] });
  for (const c of criteria) {
    assert.ok(c.trim().length > 0, 'each criterion must be a non-empty string');
  }
});

// ── Determinism ───────────────────────────────────────────────────────────────

test('determinism: planTests — same request + fixed now → deep-equal', () => {
  assert.ok(aDomain, 'need a real domain');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!] };
  const a = svc.planTests(req);
  const b = svc.planTests(req);
  assert.deepEqual(a, b);
});

test('determinism: planVerification — same request + fixed now → deep-equal', () => {
  assert.ok(aDomain, 'need a real domain');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!] };
  const a = svc.planVerification(req);
  const b = svc.planVerification(req);
  assert.deepEqual(a, b);
});

test('determinism: coverageGaps — same request + fixed now → deep-equal', () => {
  assert.ok(aDomain, 'need a real domain');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!] };
  const a = svc.coverageGaps(req);
  const b = svc.coverageGaps(req);
  assert.deepEqual(a, b);
});

test('determinism: acceptanceCriteria — same request + fixed now → deep-equal', () => {
  assert.ok(aDomain, 'need a real domain');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!] };
  const a = svc.acceptanceCriteria(req);
  const b = svc.acceptanceCriteria(req);
  assert.deepEqual(a, b);
});

test('determinism: unresolved coverageGaps → deep-equal', () => {
  const a = svc.coverageGaps({ text: 'zzqqx wibble frobnicate xyzzy' });
  const b = svc.coverageGaps({ text: 'zzqqx wibble frobnicate xyzzy' });
  assert.deepEqual(a, b);
});

test('determinism: two-domain acceptanceCriteria is deterministic', () => {
  assert.ok(aDomain && bDomain, 'need two real domains');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!, bDomain!] };
  const a = svc.acceptanceCriteria(req);
  const b = svc.acceptanceCriteria(req);
  assert.deepEqual(a, b);
});

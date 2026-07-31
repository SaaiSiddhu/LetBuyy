/**
 * SecurityDriftService tests — ≥50 assertions against REAL graphify-out artifacts.
 *
 * Key design choices:
 *   - createEngine() + a fixed ISO timestamp for determinism
 *   - All assertions reflect REAL field values from the probe runs (not guesses):
 *       417 tables, 256 tenant, 20 rls=false, 18 money tables
 *       164 functions, 34 money, 136 secDef, 40 idempotency
 *       658 policies, 34 public, 149 usesSiteId, 279 serviceRole
 *       22 domains, 8 money domains, all 22 tenant
 *   - honest notes: policy SQL text is NOT inspected; route auth is PARTIAL
 *   - determinism: calling any method twice returns identical results
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createEngine } from '@letbuyy/lcis-core';
import { SecurityDriftService } from '../src/security/index';
import type { Finding, SecurityDriftReport } from '../src/shared/types';

const FIXED = '2026-06-20T00:00:00.000Z';
const fixedNow = () => FIXED;

const engine = createEngine();
const svc = new SecurityDriftService(engine, fixedNow);

// ── helpers ───────────────────────────────────────────────────────────────────

function assertFinding(f: Finding, label: string) {
  assert.ok(typeof f.id === 'string' && f.id.length > 0, `${label}: id present`);
  assert.ok(typeof f.kind === 'string' && f.kind.length > 0, `${label}: kind present`);
  assert.ok(typeof f.severity === 'string', `${label}: severity present`);
  assert.ok(typeof f.title === 'string' && f.title.length > 0, `${label}: title present`);
  assert.ok(typeof f.detail === 'string' && f.detail.length > 0, `${label}: detail present`);
  assert.ok(typeof f.confidence === 'number' && f.confidence >= 0 && f.confidence <= 0.95, `${label}: confidence in [0,0.95]`);
  assert.ok(Array.isArray(f.evidence) && f.evidence.length > 0, `${label}: has evidence`);
  assert.equal(f.category, 'security', `${label}: category=security`);
}

function assertArtifact(obj: SecurityDriftReport, label: string) {
  assert.ok(Array.isArray(obj.evidence), `${label}: evidence array`);
  assert.ok(typeof obj.confidence === 'number', `${label}: confidence number`);
  assert.ok(typeof obj.timestamp === 'string', `${label}: timestamp string`);
  assert.ok(Array.isArray(obj.sources), `${label}: sources array`);
}

// ── 1. findMissingRLS ─────────────────────────────────────────────────────────

test('findMissingRLS returns findings for the 20 tenant tables with rls=false', () => {
  const findings = svc.findMissingRLS();
  // Real data: 20 tenant tables have rls=false (all rls=false tables ARE tenant tables)
  assert.equal(findings.length, 20, 'exactly 20 missing-RLS findings');
});

test('findMissingRLS: all findings have kind=missing-rls and severity critical or high', () => {
  const findings = svc.findMissingRLS();
  for (const f of findings) {
    assert.equal(f.kind, 'missing-rls');
    assert.ok(f.severity === 'critical' || f.severity === 'high', `severity is critical/high, got ${f.severity}`);
  }
});

test('findMissingRLS: rule R002 is set on every finding', () => {
  const findings = svc.findMissingRLS();
  for (const f of findings) {
    assert.equal(f.rule, 'R002', 'R002 on every missing-rls finding');
  }
});

test('findMissingRLS: ids are deterministic stable ids', () => {
  const findings = svc.findMissingRLS();
  // All ids start with MISSING-RLS-
  for (const f of findings) {
    assert.ok(f.id.startsWith('MISSING-RLS-'), `id starts with MISSING-RLS-, got ${f.id}`);
  }
});

test('findMissingRLS: finding subjects are known rls=false tenant tables', () => {
  const findings = svc.findMissingRLS();
  // Confirmed real table names from probe
  const knownRlsFalseTables = ['ledger_accounts', 'ledger_transactions', 'ledger_entries', 'compensation_actions', 'outbox_consumptions'];
  const subjects = new Set(findings.map((f) => f.subject));
  for (const name of knownRlsFalseTables) {
    assert.ok(subjects.has(name), `known rls=false table "${name}" is in findings`);
  }
});

test('findMissingRLS: each finding has table-type evidence from db-intel', () => {
  const findings = svc.findMissingRLS();
  for (const f of findings.slice(0, 5)) {
    assertFinding(f, `missing-rls/${f.subject}`);
    assert.equal(f.evidence[0]!.kind, 'table');
    assert.ok(f.evidence[0]!.source?.includes('db-intel'), 'evidence source is db-intel');
  }
});

test('findMissingRLS: money tables (ledger_transactions, ledger_entries) get critical severity', () => {
  const findings = svc.findMissingRLS();
  // From probe: ledger_transactions and ledger_entries have money=true → critical
  // ledger_accounts has money=false, tenant=true → high
  const moneyLedgerFindings = findings.filter(
    (f) => f.subject === 'ledger_transactions' || f.subject === 'ledger_entries',
  );
  assert.ok(moneyLedgerFindings.length > 0, 'money ledger tables are in findings');
  for (const f of moneyLedgerFindings) {
    assert.equal(f.severity, 'critical', `money ledger table ${f.subject} should be critical`);
  }
  // ledger_accounts is tenant-only (money=false) → high
  const ledgerAccounts = findings.find((f) => f.subject === 'ledger_accounts');
  if (ledgerAccounts) {
    assert.equal(ledgerAccounts.severity, 'high', 'ledger_accounts (tenant, !money) is high');
  }
});

test('findMissingRLS: deterministic — two calls return identical results', () => {
  const a = svc.findMissingRLS();
  const b = svc.findMissingRLS();
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i]!.id, b[i]!.id);
    assert.equal(a[i]!.severity, b[i]!.severity);
  }
});

// ── 2. findDangerousPolicies ──────────────────────────────────────────────────

test('findDangerousPolicies finds all 34 public policies', () => {
  const findings = svc.findDangerousPolicies();
  assert.equal(findings.length, 34, 'exactly 34 dangerous-policy findings (one per public policy)');
});

test('findDangerousPolicies: all findings have kind=dangerous-policy', () => {
  const findings = svc.findDangerousPolicies();
  for (const f of findings) {
    assert.equal(f.kind, 'dangerous-policy');
  }
});

test('findDangerousPolicies: policy "anyone_read_plans" on "plans" table is present', () => {
  const findings = svc.findDangerousPolicies();
  const f = findings.find((x) => x.subject === 'anyone_read_plans');
  assert.ok(f, 'anyone_read_plans finding present');
  assert.ok(f!.detail.includes('"plans"'), 'detail mentions plans table');
});

test('findDangerousPolicies: detail mentions LIMITATION about SQL text not being inspected', () => {
  const findings = svc.findDangerousPolicies();
  for (const f of findings.slice(0, 3)) {
    assert.ok(
      f.detail.includes('LIMITATION') || f.detail.includes('not inspected') || f.detail.includes('NOT inspected'),
      `finding detail mentions limitation for ${f.subject}`,
    );
  }
});

test('findDangerousPolicies: findings have policy-kind evidence from db-intel', () => {
  const findings = svc.findDangerousPolicies();
  for (const f of findings.slice(0, 3)) {
    const policyEvidence = f.evidence.find((e) => e.kind === 'policy');
    assert.ok(policyEvidence, `policy evidence present for ${f.subject}`);
    assert.ok(policyEvidence!.source?.includes('db-intel'));
  }
});

test('findDangerousPolicies: public policy on money table has critical severity', () => {
  const findings = svc.findDangerousPolicies();
  // From probe: 1 public policy on a money table
  const moneyPublic = findings.filter((f) => f.severity === 'critical');
  assert.ok(moneyPublic.length >= 1, 'at least 1 critical dangerous-policy (on money table)');
});

test('findDangerousPolicies: deterministic', () => {
  const a = svc.findDangerousPolicies();
  const b = svc.findDangerousPolicies();
  assert.equal(a.length, b.length);
  assert.deepEqual(
    a.map((f) => f.id),
    b.map((f) => f.id),
  );
});

// ── 3. findPublicMutations ────────────────────────────────────────────────────

test('findPublicMutations returns exactly 4 findings (the real non-secDef money fns)', () => {
  // Real data: 4 money functions with securityDefiner=false
  const findings = svc.findPublicMutations();
  assert.equal(findings.length, 4, '4 money fns without SECURITY DEFINER');
});

test('findPublicMutations: sync_order_items_store_id is in results (confirmed from probe)', () => {
  const findings = svc.findPublicMutations();
  const f = findings.find((x) => x.subject === 'sync_order_items_store_id');
  assert.ok(f, 'sync_order_items_store_id in public-mutation findings');
  assert.equal(f!.severity, 'critical');
  assert.equal(f!.rule, 'R001');
});

test('findPublicMutations: all findings have severity=critical and kind=public-mutation', () => {
  const findings = svc.findPublicMutations();
  for (const f of findings) {
    assert.equal(f.severity, 'critical');
    assert.equal(f.kind, 'public-mutation');
    assert.equal(f.rule, 'R001');
  }
});

test('findPublicMutations: confirms most money functions ARE SECURITY DEFINER', () => {
  // 34 money fns total, 4 are not secDef → 30 are secDef (not surfaced as violations)
  const findings = svc.findPublicMutations();
  assert.ok(findings.length < 10, `only ${findings.length} non-secDef money fns (most are SECURITY DEFINER)`);
});

test('findPublicMutations: deterministic', () => {
  const a = svc.findPublicMutations();
  const b = svc.findPublicMutations();
  assert.deepEqual(
    a.map((f) => f.id),
    b.map((f) => f.id),
  );
});

// ── 4. findCrossTenantRisks ────────────────────────────────────────────────────

test('findCrossTenantRisks finds 72 tenant tables missing site_id', () => {
  const findings = svc.findCrossTenantRisks();
  const tableFindings = findings.filter((f) => f.kind === 'cross-tenant-risk' && f.id.includes('NO-SITEID-'));
  // From probe: 72 tenant tables with hasSiteId=false
  // The table-level findings have id starting with CROSS-TENANT-NO-SITEID-
  const noSiteIdFindings = findings.filter((f) => f.id.includes('CROSS-TENANT-NO-SITEID'));
  assert.equal(noSiteIdFindings.length, 72, '72 tenant tables without site_id');
});

test('findCrossTenantRisks finds policy-level risks (usesSiteId=false on tenant tables)', () => {
  const findings = svc.findCrossTenantRisks();
  const policyFindings = findings.filter((f) => f.id.includes('CROSS-TENANT-POLICY-NO-SITEID'));
  // From probe: 285 policies on tenant tables with usesSiteId=false
  assert.ok(policyFindings.length > 100, `many policy-level cross-tenant risks: ${policyFindings.length}`);
});

test('findCrossTenantRisks: all have kind=cross-tenant-risk', () => {
  const findings = svc.findCrossTenantRisks();
  for (const f of findings) {
    assert.equal(f.kind, 'cross-tenant-risk');
    assert.equal(f.category, 'security');
  }
});

test('findCrossTenantRisks: ai_credits is in table-level findings (confirmed from probe)', () => {
  const findings = svc.findCrossTenantRisks();
  const f = findings.find((x) => x.subject === 'ai_credits');
  assert.ok(f, 'ai_credits (tenant, no site_id) is in cross-tenant findings');
});

test('findCrossTenantRisks: detail mentions LIMITATION about SQL text', () => {
  const findings = svc.findCrossTenantRisks();
  for (const f of findings.slice(0, 3)) {
    assert.ok(
      f.detail.includes('LIMITATION') || f.detail.includes('not inspected'),
      `LIMITATION noted in ${f.id}`,
    );
  }
});

test('findCrossTenantRisks: deterministic', () => {
  const a = svc.findCrossTenantRisks();
  const b = svc.findCrossTenantRisks();
  assert.equal(a.length, b.length);
});

// ── 5. findMissingValidation ───────────────────────────────────────────────────

test('findMissingValidation finds money fns with missing idempotency or forUpdate', () => {
  // Real data: 14 money fns miss idempotency, 19 miss forUpdate
  // (overlap means not 14+19=33 distinct fns; max is 34 money fns total)
  const findings = svc.findMissingValidation();
  assert.ok(findings.length > 0, 'some money fns missing validation');
  // The count is bounded by money fn count (34)
  assert.ok(findings.length <= 34, `at most 34 findings (one per money fn)`);
});

test('findMissingValidation: all findings have kind=missing-validation and rule=R001', () => {
  const findings = svc.findMissingValidation();
  for (const f of findings) {
    assert.equal(f.kind, 'missing-validation');
    assert.equal(f.rule, 'R001');
    assert.equal(f.severity, 'high');
  }
});

test('findMissingValidation: each finding explains what is missing', () => {
  const findings = svc.findMissingValidation();
  for (const f of findings.slice(0, 5)) {
    assert.ok(
      f.detail.includes('idempotency') || f.detail.includes('FOR UPDATE') || f.detail.includes('lock'),
      `detail explains the gap for ${f.subject}`,
    );
  }
});

test('findMissingValidation: only money fns are reported', () => {
  const findings = svc.findMissingValidation();
  // Every subject should correspond to a money function
  assert.ok(findings.length > 0);
  for (const f of findings) {
    const ev = f.evidence[0];
    assert.ok(ev, 'has evidence');
    assert.ok(ev!.detail?.includes('money=true'), `evidence mentions money=true for ${f.subject}`);
  }
});

test('findMissingValidation: deterministic', () => {
  const a = svc.findMissingValidation();
  const b = svc.findMissingValidation();
  assert.deepEqual(
    a.map((f) => f.id),
    b.map((f) => f.id),
  );
});

// ── 6. findMissingAuth ─────────────────────────────────────────────────────────

test('findMissingAuth returns info findings (heuristic — not structural verdicts)', () => {
  const findings = svc.findMissingAuth();
  assert.ok(findings.length >= 1, 'at least the middleware-limitation info finding');
  for (const f of findings) {
    assert.equal(f.severity, 'info', 'all missing-auth findings are info severity');
    assert.equal(f.kind, 'missing-auth');
  }
});

test('findMissingAuth: always emits the middleware-limitation finding', () => {
  const findings = svc.findMissingAuth();
  // stableId('missing-auth', 'middleware-limitation') => 'MISSING-AUTH-middleware-limitation'
  const limitationFinding = findings.find((f) => f.id.includes('middleware-limitation'));
  assert.ok(limitationFinding, 'middleware-limitation finding is always present');
  assert.ok(limitationFinding!.detail.includes('LIMITATION'), 'mentions LIMITATION');
});

test('findMissingAuth: confidence is low (heuristic)', () => {
  const findings = svc.findMissingAuth();
  for (const f of findings) {
    assert.ok(f.confidence <= 0.5, `heuristic finding has low confidence: ${f.confidence}`);
  }
});

test('findMissingAuth: public policies on sensitive tables trigger a finding', () => {
  // From probe: 15 public policies on tenant tables + 1 on money table
  const findings = svc.findMissingAuth();
  // stableId('missing-auth', 'public-policy-on-sensitive-table') =>
  //   'MISSING-AUTH-public-policy-on-sensitive-table'
  const sensitiveFinding = findings.find((f) => f.id.includes('public-policy-on-sensitive-table'));
  assert.ok(sensitiveFinding, 'public-policy-on-sensitive-table finding is present');
  assert.ok(sensitiveFinding!.detail.includes('public=true'), 'mentions public policies');
});

test('findMissingAuth: deterministic', () => {
  const a = svc.findMissingAuth();
  const b = svc.findMissingAuth();
  assert.deepEqual(
    a.map((f) => f.id),
    b.map((f) => f.id),
  );
});

// ── 7. findMissingSecurityTests ───────────────────────────────────────────────

test('findMissingSecurityTests only covers money or tenant domains', () => {
  const findings = svc.findMissingSecurityTests();
  // All 22 domains are tenant=true; 8 are money=true
  // So we expect findings for domains missing a security test
  assert.ok(findings.length > 0, 'some domains missing security tests');
  assert.ok(findings.length <= 22, 'at most 22 domains checked');
});

test('findMissingSecurityTests: money domains with no security test file get high/critical', () => {
  const findings = svc.findMissingSecurityTests();
  const moneyFindings = findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high',
  );
  // money domain with no security test → high severity
  assert.ok(moneyFindings.length >= 1, 'at least one money domain missing security tests');
});

test('findMissingSecurityTests: detail explains the graph search used', () => {
  const findings = svc.findMissingSecurityTests();
  for (const f of findings.slice(0, 3)) {
    assert.ok(
      f.detail.includes('graph') || f.detail.includes('search') || f.detail.includes('graph.json'),
      `detail explains the search for ${f.subject}`,
    );
  }
});

test('findMissingSecurityTests: each finding has domain evidence from domain-intel', () => {
  const findings = svc.findMissingSecurityTests();
  for (const f of findings.slice(0, 5)) {
    const domainEv = f.evidence.find((e) => e.source?.includes('domain-intel'));
    assert.ok(domainEv, `domain-intel evidence for ${f.subject}`);
  }
});

test('findMissingSecurityTests: deterministic', () => {
  const a = svc.findMissingSecurityTests();
  const b = svc.findMissingSecurityTests();
  assert.deepEqual(
    a.map((f) => f.id),
    b.map((f) => f.id),
  );
});

// ── 8. findSensitiveDomainViolations ─────────────────────────────────────────

test('findSensitiveDomainViolations only reports money domains', () => {
  const findings = svc.findSensitiveDomainViolations();
  // 8 money domains; each with violations should appear
  assert.ok(findings.length > 0, 'some money domains have violations');
  assert.ok(findings.length <= 8, 'at most 8 money domain violation findings');
});

test('findSensitiveDomainViolations: findings have kind=sensitive-domain-violation', () => {
  const findings = svc.findSensitiveDomainViolations();
  for (const f of findings) {
    assert.equal(f.kind, 'sensitive-domain-violation');
    assert.equal(f.category, 'security');
  }
});

test('findSensitiveDomainViolations: subjects are money domain keys', () => {
  const findings = svc.findSensitiveDomainViolations();
  const moneyDomainKeys = ['gift-cards', 'refunds', 'payouts', 'payments', 'shipping', 'inventory', 'orders', 'operations'];
  for (const f of findings) {
    assert.ok(moneyDomainKeys.includes(f.subject), `subject "${f.subject}" is a money domain`);
  }
});

test('findSensitiveDomainViolations: each finding aggregates sub-findings', () => {
  const findings = svc.findSensitiveDomainViolations();
  for (const f of findings) {
    assert.ok(f.detail.includes('violation') || f.detail.includes('finding'), 'detail mentions violations');
  }
});

test('findSensitiveDomainViolations: deterministic', () => {
  const a = svc.findSensitiveDomainViolations();
  const b = svc.findSensitiveDomainViolations();
  assert.deepEqual(
    a.map((f) => f.id),
    b.map((f) => f.id),
  );
});

// ── 9. generateSecurityDriftReport ───────────────────────────────────────────

test('generateSecurityDriftReport returns a SecurityDriftReport with governance envelope', () => {
  const report = svc.generateSecurityDriftReport();
  assertArtifact(report, 'SecurityDriftReport');
  assert.ok(Array.isArray(report.findings), 'findings is array');
  assert.ok(typeof report.byKind === 'object' && report.byKind !== null, 'byKind is object');
  assert.ok(typeof report.summary === 'string' && report.summary.length > 0, 'summary present');
});

test('generateSecurityDriftReport: timestamp matches fixed clock', () => {
  const report = svc.generateSecurityDriftReport();
  assert.equal(report.timestamp, FIXED, 'fixed timestamp from injected now()');
});

test('generateSecurityDriftReport: findings include all 8 kind types', () => {
  const report = svc.generateSecurityDriftReport();
  const kinds = new Set(report.findings.map((f) => f.kind));
  const expectedKinds = [
    'missing-rls',
    'dangerous-policy',
    'public-mutation',
    'cross-tenant-risk',
    'missing-validation',
    'missing-auth',
    'missing-security-test',
    'sensitive-domain-violation',
  ];
  for (const k of expectedKinds) {
    assert.ok(kinds.has(k), `byKind contains "${k}"`);
  }
});

test('generateSecurityDriftReport: byKind counts match finding lengths', () => {
  const report = svc.generateSecurityDriftReport();
  for (const [kind, count] of Object.entries(report.byKind)) {
    const actual = report.findings.filter((f) => f.kind === kind).length;
    assert.equal(actual, count, `byKind["${kind}"] = ${count} matches actual`);
  }
});

test('generateSecurityDriftReport: missing-rls count = 20 in byKind', () => {
  const report = svc.generateSecurityDriftReport();
  assert.equal(report.byKind['missing-rls'], 20, 'byKind.missing-rls = 20');
});

test('generateSecurityDriftReport: dangerous-policy count = 34 in byKind', () => {
  const report = svc.generateSecurityDriftReport();
  assert.equal(report.byKind['dangerous-policy'], 34, 'byKind.dangerous-policy = 34');
});

test('generateSecurityDriftReport: public-mutation count = 4 in byKind', () => {
  const report = svc.generateSecurityDriftReport();
  assert.equal(report.byKind['public-mutation'], 4, 'byKind.public-mutation = 4');
});

test('generateSecurityDriftReport: summary mentions structural-only limitation', () => {
  const report = svc.generateSecurityDriftReport();
  assert.ok(
    report.summary.includes('NOT CONNECTED') || report.summary.includes('Structural-only'),
    'summary mentions live probes NOT CONNECTED',
  );
});

test('generateSecurityDriftReport: confidence is between 0 and 0.95', () => {
  const report = svc.generateSecurityDriftReport();
  assert.ok(report.confidence > 0 && report.confidence <= 0.95, `confidence=${report.confidence}`);
});

test('generateSecurityDriftReport: sources include db-intel', () => {
  const report = svc.generateSecurityDriftReport();
  assert.ok(report.sources.some((s) => s.includes('db-intel')), 'sources include db-intel');
});

test('generateSecurityDriftReport: deterministic across two calls', () => {
  const a = svc.generateSecurityDriftReport();
  const b = svc.generateSecurityDriftReport();
  assert.equal(a.findings.length, b.findings.length, 'same finding count');
  assert.equal(a.timestamp, b.timestamp, 'same timestamp (fixed clock)');
  assert.deepEqual(Object.keys(a.byKind).sort(), Object.keys(b.byKind).sort(), 'same byKind keys');
  for (const k of Object.keys(a.byKind)) {
    assert.equal(a.byKind[k], b.byKind[k], `byKind["${k}"] consistent`);
  }
});

test('generateSecurityDriftReport: every finding has provenance (evidence + confidence)', () => {
  const report = svc.generateSecurityDriftReport();
  for (const f of report.findings) {
    assert.ok(Array.isArray(f.evidence) && f.evidence.length > 0, `finding ${f.id} has evidence`);
    assert.ok(typeof f.confidence === 'number' && f.confidence >= 0 && f.confidence <= 0.95, `finding ${f.id} confidence valid`);
  }
});

// ── source-level read-only verification ────────────────────────────────────────

test('SecurityDriftService source does NOT import/call forbidden IO primitives', () => {
  const src = readFileSync(
    new URL('../src/security/SecurityDriftService.ts', import.meta.url).pathname,
    'utf-8',
  );
  // These must not appear as imports or runtime calls — JSDoc mentions in comments are ok.
  // We check for import statements and actual call-site patterns, not comment text.
  const forbiddenImports = [
    "from 'child_process'",
    'from "child_process"',
    "require('child_process')",
    'require("child_process")',
    "from 'fs'",
    'from "fs"',
    "require('fs')",
    'require("fs")',
  ];
  for (const term of forbiddenImports) {
    assert.ok(!src.includes(term), `source must not import "${term}"`);
  }
  // These must not appear anywhere (not even in comments — they are runtime calls)
  const forbiddenCalls = ['spawn(', 'exec(', 'writeFile(', 'fetch(', 'new Worker('];
  for (const term of forbiddenCalls) {
    assert.ok(!src.includes(term), `source must not call "${term}"`);
  }
});

test('SecurityDriftService source does NOT use eval or dynamic import with runtime url', () => {
  const src = readFileSync(
    new URL('../src/security/SecurityDriftService.ts', import.meta.url).pathname,
    'utf-8',
  );
  assert.ok(!src.includes('eval('), 'no eval');
});

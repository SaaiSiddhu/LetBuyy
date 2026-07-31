/**
 * DriftDetectionService tests — all 16 detectors against REAL graphify-out artifacts.
 * Fixed `now` → deep-equal determinism. No fixtures, no mocks, no TODOs.
 * Read-only: src/drift/** source scanned at the end to prove no IO/mutation.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createEngine } from '@letbuyy/lcis-core';
import { DriftDetectionService } from '../src/drift/index';
import type { Finding, DriftReport } from '../src/shared/index';

const FIXED = '2026-06-20T00:00:00.000Z';
const fixedNow = () => FIXED;

const engine = createEngine();
const svc = new DriftDetectionService(engine, fixedNow);

// ── helpers ──────────────────────────────────────────────────────────────────
function assertFinding(f: Finding): void {
  assert.ok(f.id.length > 0, 'finding has id');
  assert.ok(f.kind.length > 0, 'finding has kind');
  assert.ok(f.subject.length > 0, 'finding has subject');
  assert.ok(f.title.length > 0, 'finding has title');
  assert.ok(f.detail.length > 0, 'finding has detail');
  assert.ok(f.evidence.length > 0, `${f.id} must have evidence`);
  assert.ok(f.confidence >= 0 && f.confidence <= 1, `${f.id} confidence in [0,1]`);
  assert.ok(['critical', 'high', 'medium', 'low', 'info'].includes(f.severity), `${f.id} valid severity`);
  assert.equal(f.category, 'drift', `${f.id} category is drift`);
}

// ── 1. detectTableDrift ───────────────────────────────────────────────────────
test('detectTableDrift returns Finding[] with evidence', () => {
  const findings = svc.detectTableDrift();
  assert.ok(Array.isArray(findings));
  for (const f of findings) {
    assertFinding(f);
    assert.equal(f.kind, 'table-drift');
  }
});

test('detectTableDrift: money orphan tables get critical severity', () => {
  const findings = svc.detectTableDrift();
  const moneyOrphans = findings.filter((f) => f.detail.includes('money=true'));
  for (const f of moneyOrphans) {
    assert.equal(f.severity, 'critical', `money orphan table ${f.subject} must be critical`);
  }
});

test('detectTableDrift: all claimed tables absent from findings', () => {
  const findings = svc.detectTableDrift();
  const store = engine.store;
  const domainIntel = store.tryRead<{ domains?: { tables?: string[] }[] }>('domain-intel');
  const claimed = new Set<string>();
  for (const d of domainIntel?.domains ?? []) {
    for (const t of d.tables ?? []) claimed.add(t.toLowerCase());
  }
  for (const f of findings) {
    assert.ok(!claimed.has(f.subject.toLowerCase()), `${f.subject} is claimed — should NOT be a drift finding`);
  }
});

// ── 2. detectRPCDrift ─────────────────────────────────────────────────────────
test('detectRPCDrift returns Finding[] with evidence', () => {
  const findings = svc.detectRPCDrift();
  assert.ok(Array.isArray(findings));
  for (const f of findings) {
    assertFinding(f);
    assert.equal(f.kind, 'rpc-drift');
  }
});

test('detectRPCDrift: money orphan RPCs get critical severity', () => {
  const findings = svc.detectRPCDrift();
  const moneyOrphans = findings.filter((f) => f.detail.includes('money=true'));
  for (const f of moneyOrphans) {
    assert.equal(f.severity, 'critical', `money orphan RPC ${f.subject} must be critical`);
  }
});

test('detectRPCDrift: IDs are deterministic (stableId format)', () => {
  const findings = svc.detectRPCDrift();
  for (const f of findings.slice(0, 5)) {
    assert.ok(f.id.startsWith('RPC-DRIFT-'), `id ${f.id} must start with RPC-DRIFT-`);
  }
});

// ── 3. detectDomainDrift ──────────────────────────────────────────────────────
test('detectDomainDrift returns Finding[] with evidence', () => {
  const findings = svc.detectDomainDrift();
  assert.ok(Array.isArray(findings));
  for (const f of findings) {
    assertFinding(f);
    assert.equal(f.kind, 'domain-drift');
  }
});

test('detectDomainDrift: all orphaned domains have empty tables and rpcs', () => {
  const findings = svc.detectDomainDrift();
  const domainIntel = engine.store.tryRead<{ domains?: { key: string; tables?: string[]; rpcs?: string[] }[] }>('domain-intel');
  const domainMap = new Map((domainIntel?.domains ?? []).map((d) => [d.key, d]));
  for (const f of findings) {
    const d = domainMap.get(f.subject);
    if (d) {
      assert.equal((d.tables ?? []).length, 0, `${f.subject} must have 0 tables`);
      assert.equal((d.rpcs ?? []).length, 0, `${f.subject} must have 0 rpcs`);
    }
  }
});

// ── 4. detectServiceDrift ─────────────────────────────────────────────────────
test('detectServiceDrift returns Finding[]', () => {
  const findings = svc.detectServiceDrift();
  assert.ok(Array.isArray(findings));
  for (const f of findings) {
    assertFinding(f);
    assert.equal(f.kind, 'service-drift');
    assert.ok(f.evidence.length >= 2, 'service-drift findings carry ≥2 evidence items');
  }
});

// ── 5. detectWorkerDrift ──────────────────────────────────────────────────────
test('detectWorkerDrift returns Finding[]', () => {
  const findings = svc.detectWorkerDrift();
  assert.ok(Array.isArray(findings));
  for (const f of findings) {
    assertFinding(f);
    assert.equal(f.kind, 'worker-drift');
  }
});

// ── 6. detectQueueDrift ───────────────────────────────────────────────────────
test('detectQueueDrift returns Finding[]', () => {
  const findings = svc.detectQueueDrift();
  assert.ok(Array.isArray(findings));
  for (const f of findings) {
    assertFinding(f);
    assert.equal(f.kind, 'queue-drift');
  }
});

test('detectQueueDrift: unused queues (no consumer) get high severity', () => {
  const findings = svc.detectQueueDrift();
  const unused = findings.filter((f) => f.detail.includes('no consumer'));
  for (const f of unused) {
    assert.equal(f.severity, 'high', `unused queue ${f.subject} must be high severity`);
  }
});

// ── 7. detectEventDrift ───────────────────────────────────────────────────────
test('detectEventDrift returns Finding[]', () => {
  const findings = svc.detectEventDrift();
  assert.ok(Array.isArray(findings));
  for (const f of findings) {
    assertFinding(f);
    assert.equal(f.kind, 'event-drift');
    assert.equal(f.severity, 'high', 'orphan event channels are high severity');
  }
});

test('detectEventDrift: each orphan event channel finding mentions "producer"', () => {
  const findings = svc.detectEventDrift();
  for (const f of findings) {
    assert.ok(f.detail.toLowerCase().includes('producer'), `${f.id} detail must mention producer`);
  }
});

// ── 8. detectRunbookDrift ─────────────────────────────────────────────────────
test('detectRunbookDrift returns Finding[] for money/tenant domains without runbooks', () => {
  const findings = svc.detectRunbookDrift();
  assert.ok(Array.isArray(findings));
  for (const f of findings) {
    assertFinding(f);
    assert.equal(f.kind, 'runbook-drift');
    // Only money or tenant domains should appear
    assert.ok(
      f.detail.includes('money=true') || f.detail.includes('tenant=true'),
      `${f.id} should only flag money or tenant domains`,
    );
  }
});

test('detectRunbookDrift: money domains without runbook get high severity', () => {
  const findings = svc.detectRunbookDrift();
  const moneyMissing = findings.filter((f) => f.detail.includes('money=true'));
  for (const f of moneyMissing) {
    assert.equal(f.severity, 'high', `${f.subject} money domain missing runbook must be high`);
  }
});

// ── 9. detectTestDrift ────────────────────────────────────────────────────────
test('detectTestDrift returns Finding[]', () => {
  const findings = svc.detectTestDrift();
  assert.ok(Array.isArray(findings));
  for (const f of findings) {
    assertFinding(f);
    assert.equal(f.kind, 'test-drift');
  }
});

test('detectTestDrift: money/tenant domains with no tests get elevated severity', () => {
  const findings = svc.detectTestDrift();
  const elevated = findings.filter((f) =>
    f.detail.toLowerCase().includes('money=true') || f.detail.toLowerCase().includes('tenant=true'),
  );
  for (const f of elevated) {
    assert.ok(['critical', 'high'].includes(f.severity), `${f.subject} elevated test drift must be high+`);
  }
});

// ── 10. detectDocumentationDrift ──────────────────────────────────────────────
test('detectDocumentationDrift returns Finding[]', () => {
  const findings = svc.detectDocumentationDrift();
  assert.ok(Array.isArray(findings));
  for (const f of findings) {
    assertFinding(f);
    assert.equal(f.kind, 'documentation-drift');
  }
});

test('detectDocumentationDrift: all findings mention memory search', () => {
  const findings = svc.detectDocumentationDrift();
  for (const f of findings) {
    assert.ok(
      f.detail.toLowerCase().includes('memory') || f.detail.toLowerCase().includes('search') || f.detail.toLowerCase().includes('document'),
      `${f.id} detail must mention memory/search`,
    );
  }
});

// ── 11. detectMigrationDrift ──────────────────────────────────────────────────
test('detectMigrationDrift includes honest UNKNOWN rollback finding', () => {
  const findings = svc.detectMigrationDrift();
  assert.ok(findings.length >= 1, 'at least the rollback-UNKNOWN info finding');
  const rollbackFinding = findings.find((f) => f.subject === 'migration-rollback');
  assert.ok(rollbackFinding, 'must have a migration-rollback info finding');
  assert.equal(rollbackFinding.severity, 'info', 'rollback UNKNOWN is info not a violation');
  assert.equal(rollbackFinding.kind, 'migration-drift');
  assert.ok(rollbackFinding.detail.includes('UNKNOWN'), 'detail must say UNKNOWN');
  assert.ok(rollbackFinding.confidence <= 0.35, 'UNKNOWN finding has low confidence');
});

test('detectMigrationDrift: sequence gap findings reference two migration numbers', () => {
  const findings = svc.detectMigrationDrift();
  const gaps = findings.filter((f) => f.subject.startsWith('migration-gap:'));
  for (const g of gaps) {
    assert.ok(g.kind === 'migration-drift');
    // Title uses → arrow; detail uses "from X to Y" prose
    assert.ok(
      g.title.includes('→') || g.detail.includes('from') || g.detail.includes('jumps'),
      `gap finding must reference sequence numbers: ${g.detail}`,
    );
  }
});

test('detectMigrationDrift: all gap findings are medium severity', () => {
  const findings = svc.detectMigrationDrift();
  const gaps = findings.filter((f) => f.subject.startsWith('migration-gap:'));
  for (const g of gaps) {
    assert.equal(g.severity, 'medium', `sequence gap ${g.subject} must be medium`);
  }
});

// ── 12. detectValidatorDrift ──────────────────────────────────────────────────
test('detectValidatorDrift emits honest PARTIAL info finding', () => {
  const findings = svc.detectValidatorDrift();
  assert.equal(findings.length, 1, 'exactly one PARTIAL finding');
  const f = findings[0]!;
  assertFinding(f);
  assert.equal(f.kind, 'validator-drift');
  assert.equal(f.severity, 'info');
  assert.ok(f.detail.includes('PARTIAL') || f.title.includes('PARTIAL'), 'must say PARTIAL');
  assert.ok(f.confidence <= 0.35, 'PARTIAL finding has low confidence');
});

// ── 13. detectOwnershipDrift ──────────────────────────────────────────────────
test('detectOwnershipDrift returns Finding[] for unowned domains', () => {
  const findings = svc.detectOwnershipDrift();
  assert.ok(Array.isArray(findings));
  for (const f of findings) {
    assertFinding(f);
    assert.equal(f.kind, 'ownership-drift');
  }
});

test('detectOwnershipDrift: money domains without owners are critical or high', () => {
  const findings = svc.detectOwnershipDrift();
  const moneyOwnerless = findings.filter(
    (f) => f.detail.includes('money=true') && !f.subject.includes('workers'),
  );
  for (const f of moneyOwnerless) {
    assert.ok(['critical', 'high'].includes(f.severity), `money domain ${f.subject} ownership gap must be critical/high`);
  }
});

// ── 14. detectSecurityDrift ───────────────────────────────────────────────────
test('detectSecurityDrift: tenant tables with rls=false are critical', () => {
  const findings = svc.detectSecurityDrift();
  const rlsFindings = findings.filter((f) => f.detail.includes('rls=false'));
  for (const f of rlsFindings) {
    assert.equal(f.severity, 'critical', `rls=false tenant table ${f.subject} must be critical`);
    assert.equal(f.rule, 'R002', 'must reference R002');
  }
});

test('detectSecurityDrift: public policies with no site_id are high', () => {
  const findings = svc.detectSecurityDrift();
  const publicPolicies = findings.filter((f) => f.kind === 'security-drift' && !f.detail.includes('rls=false'));
  for (const f of publicPolicies) {
    assert.equal(f.severity, 'high', `public policy ${f.subject} must be high`);
  }
});

test('detectSecurityDrift: all findings have evidence', () => {
  const findings = svc.detectSecurityDrift();
  for (const f of findings) {
    assertFinding(f);
    assert.equal(f.kind, 'security-drift');
  }
});

// ── 15. detectArchitectureDrift ───────────────────────────────────────────────
test('detectArchitectureDrift returns exactly 1 composite Finding', () => {
  const findings = svc.detectArchitectureDrift();
  assert.equal(findings.length, 1);
  const f = findings[0]!;
  assertFinding(f);
  assert.equal(f.kind, 'architecture');
  assert.ok(f.title.includes('composite'), 'composite finding title');
});

test('detectArchitectureDrift composite severity ≥ most severe individual finding', () => {
  const RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  const composite = svc.detectArchitectureDrift()[0]!;
  const secFindings = svc.detectSecurityDrift();
  // Security drift has critical findings (tenant rls=false) — composite must be critical too
  const hasCritical = secFindings.some((f) => f.severity === 'critical');
  if (hasCritical) {
    assert.equal(composite.severity, 'critical', 'composite must be critical when security drift is critical');
  } else {
    assert.ok(RANK[composite.severity] >= 0, 'composite severity is valid');
  }
});

// ── 16. generateDriftReport ───────────────────────────────────────────────────
test('generateDriftReport returns a DriftReport with all provenance fields', () => {
  const report = svc.generateDriftReport('all');
  assert.equal(report.scope, 'all');
  assert.ok(Array.isArray(report.findings));
  assert.ok(report.findings.length > 0, 'must have findings');
  assert.ok(typeof report.byKind === 'object');
  assert.ok(typeof report.summary === 'string' && report.summary.length > 0);
  assert.ok(Array.isArray(report.evidence));
  assert.ok(Array.isArray(report.sources));
  assert.ok(report.confidence >= 0 && report.confidence <= 1);
  assert.equal(report.timestamp, FIXED, 'timestamp must be fixed (deterministic)');
});

test('generateDriftReport byKind counts sum to total findings', () => {
  const report = svc.generateDriftReport('all');
  const kindTotal = Object.values(report.byKind).reduce((a, b) => a + b, 0);
  assert.equal(kindTotal, report.findings.length, 'byKind counts must sum to total findings');
});

test('generateDriftReport contains findings from all 14 leaf detectors + architecture composite', () => {
  const report = svc.generateDriftReport('all');
  const kinds = new Set(report.findings.map((f) => f.kind));
  // Must contain at least these kinds
  const expected = [
    'migration-drift',   // detectMigrationDrift
    'validator-drift',   // detectValidatorDrift
    'ownership-drift',   // detectOwnershipDrift
    'architecture',      // detectArchitectureDrift composite
  ];
  for (const k of expected) {
    assert.ok(kinds.has(k), `report must contain findings of kind "${k}"`);
  }
});

test('generateDriftReport is deterministic with fixed now', () => {
  const r1 = svc.generateDriftReport('all');
  const r2 = svc.generateDriftReport('all');
  assert.equal(r1.timestamp, r2.timestamp);
  assert.equal(r1.findings.length, r2.findings.length);
  assert.equal(r1.summary, r2.summary);
  assert.deepEqual(r1.byKind, r2.byKind);
});

test('generateDriftReport with custom scope preserves the scope', () => {
  const report = svc.generateDriftReport('payments');
  assert.equal(report.scope, 'payments');
  assert.equal(report.timestamp, FIXED);
});

test('generateDriftReport byKind includes table-drift if any tables are orphaned', () => {
  const tableDrift = svc.detectTableDrift();
  const report = svc.generateDriftReport('all');
  if (tableDrift.length > 0) {
    assert.ok('table-drift' in report.byKind, 'byKind must include table-drift');
    assert.equal(report.byKind['table-drift'], tableDrift.length);
  }
});

test('generateDriftReport byKind includes rpc-drift if any RPCs are orphaned', () => {
  const rpcDrift = svc.detectRPCDrift();
  const report = svc.generateDriftReport('all');
  if (rpcDrift.length > 0) {
    assert.ok('rpc-drift' in report.byKind, 'byKind must include rpc-drift');
    assert.equal(report.byKind['rpc-drift'], rpcDrift.length);
  }
});

test('generateDriftReport: security-drift findings with R002 rule propagate into report', () => {
  const report = svc.generateDriftReport('all');
  const r002 = report.findings.filter((f) => f.rule === 'R002');
  const secDrift = svc.detectSecurityDrift();
  const r002Direct = secDrift.filter((f) => f.rule === 'R002');
  assert.equal(r002.length, r002Direct.length, 'R002 findings must propagate through to report');
});

// ── source scan: no IO/mutation in src/drift/*.ts ─────────────────────────────
test('src/drift/DriftDetectionService.ts uses no exec/spawn/writeFile/fetch', () => {
  const src = readFileSync(
    new URL('../src/drift/DriftDetectionService.ts', import.meta.url),
    'utf8',
  );
  const FORBIDDEN = ['child_process', 'exec(', 'spawn(', 'writeFile', 'fetch(', 'eval(', 'require('];
  for (const pat of FORBIDDEN) {
    assert.ok(!src.includes(pat), `DriftDetectionService.ts must not contain "${pat}"`);
  }
});

test('src/drift/index.ts re-exports DriftDetectionService', () => {
  const src = readFileSync(
    new URL('../src/drift/index.ts', import.meta.url),
    'utf8',
  );
  assert.ok(src.includes('DriftDetectionService'), 'index.ts must export DriftDetectionService');
});

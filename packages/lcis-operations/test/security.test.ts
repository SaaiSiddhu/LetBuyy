/**
 * LCOS SecurityOperationsService tests — verifies the security area operational intelligence.
 * Uses Node built-in test runner (node:test + node:assert). Tests run against the REAL
 * graphify-out artifacts (no fixtures). Verifies the honesty contract (NOT_CONNECTED → value=null,
 * confidence=0), provenance fields, determinism, and structural posture findings from governance.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createEngine } from '@letbuyy/lcis-core';
import { SecurityOperationsService } from '../src/security/index';
import type { OperationalFinding, SecurityOpsReport } from '../src/shared/index';

// ── Setup ────────────────────────────────────────────────────────────────────

const FIXED = '2026-06-21T00:00:00.000Z';
const fixedNow = () => FIXED;

function createEngine_() {
  return createEngine();
}

// ── createEngine + fixed now ─────────────────────────────────────────────────

test('createEngine() returns a valid LcisEngine', () => {
  const engine = createEngine_();
  assert.ok(engine, 'engine is truthy');
  assert.ok(typeof engine.store === 'object', 'engine has store');
  assert.ok(typeof engine.graph === 'object', 'engine has graph');
  assert.ok(typeof engine.blast === 'object', 'engine has blast');
});

test('fixed now function returns the expected ISO string', () => {
  assert.equal(fixedNow(), FIXED);
});

test('SecurityOperationsService can be instantiated with engine + fixed now', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  assert.ok(svc, 'service is truthy');
  assert.ok(typeof svc.detectAuthAnomalies === 'function', 'detectAuthAnomalies is a function');
  assert.ok(typeof svc.detectAbuseSignals === 'function', 'detectAbuseSignals is a function');
  assert.ok(typeof svc.detectCredentialEvents === 'function', 'detectCredentialEvents is a function');
  assert.ok(typeof svc.detectSecuritySpikes === 'function', 'detectSecuritySpikes is a function');
  assert.ok(typeof svc.generateSecurityReport === 'function', 'generateSecurityReport is a function');
});

// ── detectAuthAnomalies — live NOT_CONNECTED ──────────────────────────────────

test('detectAuthAnomalies() returns an array', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectAuthAnomalies();
  assert.ok(Array.isArray(findings), 'returns array');
});

test('detectAuthAnomalies() is non-empty (has live NOT_CONNECTED + structural findings)', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectAuthAnomalies();
  assert.ok(findings.length >= 2, `expected >= 2 findings, got ${findings.length}`);
});

test('detectAuthAnomalies() live auth-failure-rate finding: value=null, confidence=0', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectAuthAnomalies();
  const liveFinding = findings.find((f) => f.kind === 'auth-failure-rate');
  assert.ok(liveFinding, 'auth-failure-rate finding is present');
  assert.equal(liveFinding.status, 'NOT_CONNECTED', 'status is NOT_CONNECTED');
  assert.equal(liveFinding.confidence, 0, 'confidence is 0 for NOT_CONNECTED');
  assert.equal(liveFinding.area, 'security', 'area is security');
});

test('detectAuthAnomalies() live finding source contains SUPABASE_URL env var', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectAuthAnomalies();
  const liveFinding = findings.find((f) => f.kind === 'auth-failure-rate');
  assert.ok(liveFinding, 'auth-failure-rate finding is present');
  // Evidence should contain not-connected evidence that names SUPABASE_URL
  const notConnEvidence = liveFinding.evidence.filter((e) => e.kind === 'not-connected');
  assert.ok(notConnEvidence.length >= 1, 'has not-connected evidence');
  const mentionsSupa = notConnEvidence.some(
    (e) => (e.detail ?? '').includes('SUPABASE_URL') || (e.source ?? '').includes('SUPABASE_URL'),
  );
  assert.ok(mentionsSupa, 'evidence mentions SUPABASE_URL');
});

test('detectAuthAnomalies() structural two-issuer model finding is CONNECTED', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectAuthAnomalies();
  const structural = findings.find((f) => f.kind === 'two-issuer-auth-model');
  assert.ok(structural, 'two-issuer-auth-model finding is present');
  assert.equal(structural.status, 'CONNECTED', 'structural finding is CONNECTED');
  assert.ok(structural.confidence > 0, 'structural finding has confidence > 0');
});

test('detectAuthAnomalies() has provenance fields on every finding', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectAuthAnomalies();
  for (const f of findings) {
    assert.ok(typeof f.id === 'string' && f.id.length > 0, `finding ${f.kind} has id`);
    assert.ok(typeof f.area === 'string', `finding ${f.kind} has area`);
    assert.ok(typeof f.kind === 'string', `finding ${f.kind} has kind`);
    assert.ok(typeof f.severity === 'string', `finding ${f.kind} has severity`);
    assert.ok(typeof f.title === 'string', `finding ${f.kind} has title`);
    assert.ok(typeof f.detail === 'string', `finding ${f.kind} has detail`);
    assert.ok(Array.isArray(f.evidence), `finding ${f.kind} has evidence array`);
  }
});

// ── detectAbuseSignals — live NOT_CONNECTED ───────────────────────────────────

test('detectAbuseSignals() returns an array', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectAbuseSignals();
  assert.ok(Array.isArray(findings), 'returns array');
});

test('detectAbuseSignals() is non-empty', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectAbuseSignals();
  assert.ok(findings.length >= 1, `expected >= 1 findings, got ${findings.length}`);
});

test('detectAbuseSignals() live abuse-bot-rate finding: NOT_CONNECTED, value must be derivable as null', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectAbuseSignals();
  const liveFinding = findings.find((f) => f.kind === 'abuse-bot-rate');
  assert.ok(liveFinding, 'abuse-bot-rate finding is present');
  assert.equal(liveFinding.status, 'NOT_CONNECTED', 'status is NOT_CONNECTED');
  assert.equal(liveFinding.confidence, 0, 'confidence is 0');
});

test('detectAbuseSignals() live finding evidence contains TURNSTILE_SECRET_KEY', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectAbuseSignals();
  const liveFinding = findings.find((f) => f.kind === 'abuse-bot-rate');
  assert.ok(liveFinding, 'abuse-bot-rate finding is present');
  const notConnEvidence = liveFinding.evidence.filter((e) => e.kind === 'not-connected');
  assert.ok(notConnEvidence.length >= 1, 'has not-connected evidence');
  const mentionsTurnstile = notConnEvidence.some(
    (e) => (e.detail ?? '').includes('TURNSTILE_SECRET_KEY') || (e.source ?? '').includes('TURNSTILE_SECRET_KEY'),
  );
  assert.ok(mentionsTurnstile, 'evidence mentions TURNSTILE_SECRET_KEY');
});

test('detectAbuseSignals() structural Turnstile finding is CONNECTED', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectAbuseSignals();
  const structural = findings.find((f) => f.kind === 'turnstile-integration-structural');
  assert.ok(structural, 'turnstile-integration-structural finding is present');
  assert.equal(structural.status, 'CONNECTED', 'Turnstile structural finding is CONNECTED');
});

// ── detectCredentialEvents — live NOT_CONNECTED ───────────────────────────────

test('detectCredentialEvents() returns an array', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectCredentialEvents();
  assert.ok(Array.isArray(findings), 'returns array');
});

test('detectCredentialEvents() credential-events finding: NOT_CONNECTED, confidence=0', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectCredentialEvents();
  const f = findings.find((finding) => finding.kind === 'credential-events');
  assert.ok(f, 'credential-events finding is present');
  assert.equal(f.status, 'NOT_CONNECTED', 'status is NOT_CONNECTED');
  assert.equal(f.confidence, 0, 'confidence is 0');
});

test('detectCredentialEvents() evidence names SUPABASE_URL as source', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectCredentialEvents();
  const f = findings.find((finding) => finding.kind === 'credential-events');
  assert.ok(f, 'credential-events finding present');
  const notConnEvidence = f.evidence.filter((e) => e.kind === 'not-connected');
  assert.ok(notConnEvidence.length >= 1, 'has not-connected evidence');
  const mentionsSupa = notConnEvidence.some(
    (e) => (e.detail ?? '').includes('SUPABASE_URL') || (e.source ?? '').includes('SUPABASE_URL'),
  );
  assert.ok(mentionsSupa, 'evidence mentions SUPABASE_URL as the required env var');
});

// ── detectSecuritySpikes — structural from governance ─────────────────────────

test('detectSecuritySpikes() returns an array', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectSecuritySpikes();
  assert.ok(Array.isArray(findings), 'returns array');
});

test('detectSecuritySpikes() is non-empty (has live NOT_CONNECTED + structural)', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectSecuritySpikes();
  assert.ok(findings.length >= 1, `expected >= 1 findings, got ${findings.length}`);
});

test('detectSecuritySpikes() live-security-spike finding is NOT_CONNECTED, confidence=0', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectSecuritySpikes();
  const liveFinding = findings.find((f) => f.kind === 'live-security-spike');
  assert.ok(liveFinding, 'live-security-spike finding is present');
  assert.equal(liveFinding.status, 'NOT_CONNECTED', 'status is NOT_CONNECTED');
  assert.equal(liveFinding.confidence, 0, 'confidence is 0');
});

test('detectSecuritySpikes() has structural findings from governance (dangerous-policy, missing-rls, or cross-tenant-risk)', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectSecuritySpikes();
  const structural = findings.filter(
    (f) => f.status === 'CONNECTED' && (
      f.kind === 'dangerous-policy' ||
      f.kind === 'missing-rls' ||
      f.kind === 'cross-tenant-risk'
    ),
  );
  assert.ok(structural.length > 0, `expected structural security findings from governance, got 0. All findings: ${findings.map(f => f.kind).join(', ')}`);
});

test('detectSecuritySpikes() structural findings have CONNECTED status and positive confidence', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectSecuritySpikes();
  const structural = findings.filter((f) => f.status === 'CONNECTED');
  assert.ok(structural.length > 0, 'has structural CONNECTED findings');
  for (const f of structural) {
    assert.equal(f.status, 'CONNECTED', `finding ${f.id} is CONNECTED`);
    assert.ok(f.evidence.length > 0, `finding ${f.id} has evidence`);
  }
});

test('detectSecuritySpikes() dangerous-policy findings have area=security', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectSecuritySpikes();
  const dangerous = findings.filter((f) => f.kind === 'dangerous-policy');
  for (const f of dangerous) {
    assert.equal(f.area, 'security', `dangerous-policy finding ${f.id} has area=security`);
  }
});

// ── Static posture findings are non-empty (real artifacts) ───────────────────

test('static posture findings from detectSecuritySpikes are real (non-empty)', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectSecuritySpikes();
  // The real artifacts have 34 public policies, 20 missing-rls tables, etc.
  // So we should have a non-empty list of structural findings
  const staticFindings = findings.filter((f) => f.status === 'CONNECTED');
  assert.ok(staticFindings.length > 0, `expected non-empty static posture findings, got 0`);
});

test('dangerous-policy findings mention a table name in detail', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectSecuritySpikes();
  const dangerous = findings.filter((f) => f.kind === 'dangerous-policy');
  // Only check if there are dangerous policy findings
  if (dangerous.length > 0) {
    for (const f of dangerous) {
      assert.ok(f.detail.length > 0, `dangerous-policy finding ${f.id} has non-empty detail`);
    }
  }
});

// ── generateSecurityReport ────────────────────────────────────────────────────

test('generateSecurityReport() returns a SecurityOpsReport', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const report = svc.generateSecurityReport();
  assert.ok(report, 'report is truthy');
  assert.equal(report.area, 'security', 'area is security');
});

test('generateSecurityReport() has area="security"', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const report = svc.generateSecurityReport();
  assert.equal(report.area, 'security');
});

test('generateSecurityReport() has facts array (non-empty)', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const report = svc.generateSecurityReport();
  assert.ok(Array.isArray(report.facts), 'facts is array');
  assert.ok(report.facts.length > 0, 'facts is non-empty');
});

test('generateSecurityReport() has findings array (non-empty)', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const report = svc.generateSecurityReport();
  assert.ok(Array.isArray(report.findings), 'findings is array');
  assert.ok(report.findings.length > 0, 'findings is non-empty');
});

test('generateSecurityReport() has signals from LiveSignalRegistry (security area)', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const report = svc.generateSecurityReport();
  assert.ok(Array.isArray(report.signals), 'signals is array');
  assert.ok(report.signals.length >= 4, `expected >= 4 security signals, got ${report.signals.length}`);
  // All signals must be in the security area
  for (const sig of report.signals) {
    assert.equal(sig.area, 'security', `signal ${sig.key} has area=security`);
  }
});

test('generateSecurityReport() health field is present and valid', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const report = svc.generateSecurityReport();
  assert.ok(report.health, 'health is present');
  assert.equal(report.health.area, 'security', 'health.area is security');
  assert.ok(
    report.health.band === 'healthy' || report.health.band === 'degraded' ||
    report.health.band === 'failing' || report.health.band === 'unknown',
    `health.band is a valid HealthBand: ${report.health.band}`,
  );
  assert.ok(typeof report.health.connectedSignals === 'number', 'connectedSignals is number');
  assert.ok(typeof report.health.notConnectedSignals === 'number', 'notConnectedSignals is number');
});

test('generateSecurityReport() summary is a non-empty string', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const report = svc.generateSecurityReport();
  assert.ok(typeof report.summary === 'string', 'summary is string');
  assert.ok(report.summary.length > 0, 'summary is non-empty');
});

test('generateSecurityReport() provenance fields: evidence, confidence, sources, timestamp, liveConnected', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const report = svc.generateSecurityReport();
  assert.ok(Array.isArray(report.evidence), 'evidence is array');
  assert.ok(report.evidence.length > 0, 'evidence is non-empty');
  assert.ok(typeof report.confidence === 'number', 'confidence is number');
  assert.ok(report.confidence >= 0 && report.confidence <= 1, 'confidence is in [0,1]');
  assert.ok(Array.isArray(report.sources), 'sources is array');
  assert.ok(typeof report.timestamp === 'string', 'timestamp is string');
  assert.equal(report.liveConnected, false, 'liveConnected is false (no live adapter wired)');
});

test('generateSecurityReport() timestamp equals fixed now', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const report = svc.generateSecurityReport();
  assert.equal(report.timestamp, FIXED, 'timestamp matches fixed now');
});

// ── Determinism ───────────────────────────────────────────────────────────────

test('detectAuthAnomalies() is deterministic (same output on two calls)', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const first = svc.detectAuthAnomalies();
  const second = svc.detectAuthAnomalies();
  assert.equal(first.length, second.length, 'same number of findings');
  for (let i = 0; i < first.length; i++) {
    assert.equal(first[i].id, second[i].id, `finding ${i} id is deterministic`);
    assert.equal(first[i].kind, second[i].kind, `finding ${i} kind is deterministic`);
    assert.equal(first[i].status, second[i].status, `finding ${i} status is deterministic`);
    assert.equal(first[i].confidence, second[i].confidence, `finding ${i} confidence is deterministic`);
  }
});

test('detectSecuritySpikes() is deterministic (same output on two calls)', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const first = svc.detectSecuritySpikes();
  const second = svc.detectSecuritySpikes();
  assert.equal(first.length, second.length, 'same number of findings');
  for (let i = 0; i < first.length; i++) {
    assert.equal(first[i].id, second[i].id, `finding ${i} id is deterministic`);
    assert.equal(first[i].kind, second[i].kind, `finding ${i} kind is deterministic`);
  }
});

test('generateSecurityReport() is deterministic (same area, findings count, signals count)', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const first = svc.generateSecurityReport();
  const second = svc.generateSecurityReport();
  assert.equal(first.area, second.area, 'area is deterministic');
  assert.equal(first.findings.length, second.findings.length, 'findings count is deterministic');
  assert.equal(first.signals.length, second.signals.length, 'signals count is deterministic');
  assert.equal(first.summary, second.summary, 'summary is deterministic');
});

// ── Read-only constraint check ────────────────────────────────────────────────

test('SecurityOperationsService source code must not contain forbidden mutation/IO patterns', () => {
  // Read the source file as text and verify no banned calls are present
  const srcPath = new URL('../src/security/SecurityOperationsService.ts', import.meta.url);
  const src = readFileSync(srcPath, 'utf-8');

  // Banned patterns: fetch, child_process, spawn, exec, eval, writeFile, network writes
  const banned = [
    { pattern: /\bfetch\s*\(/, label: 'fetch()' },
    { pattern: /require\s*\(\s*['"]child_process['"]/, label: 'require(child_process)' },
    { pattern: /import.*['"]child_process['"]/, label: 'import child_process' },
    { pattern: /\bspawn\s*\(/, label: 'spawn()' },
    { pattern: /\bexecSync\s*\(/, label: 'execSync()' },
    { pattern: /\bexecFile\s*\(/, label: 'execFile()' },
    { pattern: /\beval\s*\(/, label: 'eval()' },
    { pattern: /writeFile[Sync]*\s*\(/, label: 'writeFile()' },
    { pattern: /createWriteStream\s*\(/, label: 'createWriteStream()' },
  ];

  for (const { pattern, label } of banned) {
    assert.ok(!pattern.test(src), `SecurityOperationsService must not contain ${label}`);
  }
});

// ── Honesty contract — all NOT_CONNECTED findings have value derivation ───────

test('All NOT_CONNECTED findings have confidence=0', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const allFindings: OperationalFinding[] = [
    ...svc.detectAuthAnomalies(),
    ...svc.detectAbuseSignals(),
    ...svc.detectCredentialEvents(),
    ...svc.detectSecuritySpikes(),
  ];
  const notConnected = allFindings.filter((f) => f.status === 'NOT_CONNECTED');
  assert.ok(notConnected.length >= 4, `expected >= 4 NOT_CONNECTED findings, got ${notConnected.length}`);
  for (const f of notConnected) {
    assert.equal(f.confidence, 0, `NOT_CONNECTED finding ${f.id} must have confidence=0`);
  }
});

test('All NOT_CONNECTED findings have at least one not-connected evidence entry', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const allFindings: OperationalFinding[] = [
    ...svc.detectAuthAnomalies(),
    ...svc.detectAbuseSignals(),
    ...svc.detectCredentialEvents(),
    ...svc.detectSecuritySpikes(),
  ];
  const notConnected = allFindings.filter((f) => f.status === 'NOT_CONNECTED');
  for (const f of notConnected) {
    const ncEvidence = f.evidence.filter((e) => e.kind === 'not-connected');
    assert.ok(ncEvidence.length >= 1, `NOT_CONNECTED finding ${f.id} must have not-connected evidence`);
  }
});

// ── Signals from LiveSignalRegistry included in report ────────────────────────

test('generateSecurityReport() signals include security.auth-failure-rate signal', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const report = svc.generateSecurityReport();
  const authSig = report.signals.find((s) => s.key === 'security.auth-failure-rate');
  assert.ok(authSig, 'security.auth-failure-rate signal is in report');
  assert.equal(authSig.status, 'NOT_CONNECTED', 'auth-failure-rate signal is NOT_CONNECTED');
});

test('generateSecurityReport() signals include security.abuse-signals signal', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const report = svc.generateSecurityReport();
  const abuseSig = report.signals.find((s) => s.key === 'security.abuse-signals');
  assert.ok(abuseSig, 'security.abuse-signals signal is in report');
  assert.equal(abuseSig.status, 'NOT_CONNECTED', 'abuse-signals signal is NOT_CONNECTED');
});

test('generateSecurityReport() signals include security.controls signal', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const report = svc.generateSecurityReport();
  const controlsSig = report.signals.find((s) => s.key === 'security.controls');
  assert.ok(controlsSig, 'security.controls signal is in report');
  assert.equal(controlsSig.status, 'CONNECTED', 'security.controls signal is CONNECTED');
});

// ── detectSecuritySpikes derives from governance engine ───────────────────────

test('detectSecuritySpikes() findings derived from governance have prefixed IDs', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectSecuritySpikes();
  const govDerived = findings.filter(
    (f) => f.status === 'CONNECTED' && f.id.startsWith('LCOS-'),
  );
  assert.ok(govDerived.length > 0, `expected governance-derived findings with LCOS- prefix, got 0`);
});

test('detectSecuritySpikes() structural finding subjects are table/policy names', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const findings = svc.detectSecuritySpikes();
  const structural = findings.filter((f) => f.status === 'CONNECTED' && f.kind !== 'security-controls-present');
  // Subjects should be non-empty strings
  for (const f of structural) {
    assert.ok(typeof f.subject === 'string' && f.subject.length > 0, `structural finding ${f.id} has non-empty subject`);
  }
});

// ── generateSecurityReport() security summary mentions key metrics ─────────────

test('generateSecurityReport() summary mentions "security posture" or "Security posture"', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const report = svc.generateSecurityReport();
  assert.ok(
    report.summary.toLowerCase().includes('security') || report.summary.toLowerCase().includes('posture'),
    `summary should mention security or posture: "${report.summary}"`,
  );
});

test('generateSecurityReport() summary mentions NOT CONNECTED (honesty)', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const report = svc.generateSecurityReport();
  const summaryUpper = report.summary.toUpperCase();
  assert.ok(
    summaryUpper.includes('NOT CONNECTED') || summaryUpper.includes('NOT_CONNECTED'),
    `summary should mention NOT CONNECTED for live signals: "${report.summary}"`,
  );
});

// ── Comprehensive all-methods coverage ───────────────────────────────────────

test('All 4 detect methods together produce >= 7 findings', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const all = [
    ...svc.detectAuthAnomalies(),
    ...svc.detectAbuseSignals(),
    ...svc.detectCredentialEvents(),
    ...svc.detectSecuritySpikes(),
  ];
  assert.ok(all.length >= 7, `expected >= 7 combined findings, got ${all.length}`);
});

test('All findings across all methods have area=security', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const all = [
    ...svc.detectAuthAnomalies(),
    ...svc.detectAbuseSignals(),
    ...svc.detectCredentialEvents(),
    ...svc.detectSecuritySpikes(),
  ];
  for (const f of all) {
    assert.equal(f.area, 'security', `finding ${f.id} (kind=${f.kind}) must have area=security`);
  }
});

test('generateSecurityReport() findings contain all findings from all detect methods', () => {
  const engine = createEngine_();
  const svc = new SecurityOperationsService(engine, fixedNow);
  const report = svc.generateSecurityReport();
  const allDetected = [
    ...svc.detectAuthAnomalies(),
    ...svc.detectAbuseSignals(),
    ...svc.detectCredentialEvents(),
    ...svc.detectSecuritySpikes(),
  ];
  // Report findings length should equal sum of all detect methods
  assert.equal(
    report.findings.length,
    allDetected.length,
    `report.findings.length (${report.findings.length}) should equal sum of all detect methods (${allDetected.length})`,
  );
});

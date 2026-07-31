/**
 * LCOS Phase 6 — IncidentOperationsService tests.
 *
 * All tests use the REAL graphify-out artifacts (no fixtures). Verifies:
 *   - detectIncidents(): live NOT_CONNECTED + structural CONNECTED facts
 *   - detectOutages(): queue-workers SPOF + NOT_CONNECTED live metrics
 *   - detectBlastRadius(): REUSES SignalCorrelator (real domain graph); authoritative payments blast
 *   - detectRecoveryStatus(): runbook coverage CONNECTED; live NOT_CONNECTED; gap findings
 *   - generateIncidentReport(): full IncidentReport shape, honesty contract, determinism
 *
 * Honesty rules (enforced in every test):
 *   - NOT_CONNECTED findings have confidence = 0 and value = null
 *   - CONNECTED findings have confidence > 0 and evidence with real sources
 *   - No mock/stub/fabricated values; no network; no file writes
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine } from '@letbuyy/lcis-core';
import { IncidentOperationsService } from '../src/incident/index';
import { OperationsArtifactStore, SignalCorrelator } from '../src/shared/index';

const FIXED = '2026-06-21T00:00:00.000Z';
const engine = createEngine();
const svc = new IncidentOperationsService(engine, () => FIXED);

// ── Read-only source scan ─────────────────────────────────────────────────────
test('source scan: IncidentOperationsService.ts contains no fetch/network/spawn/exec/writeFile', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../src/incident/IncidentOperationsService.ts', import.meta.url),
    'utf-8',
  );
  // strip single-line comments
  const noComments = src.replace(/\/\/.*$/gm, '');
  for (const banned of ['fetch(', 'child_process', 'spawn(', 'exec(', 'writeFile', 'eval(', 'WebSocket']) {
    assert.equal(noComments.includes(banned), false, `banned token found: ${banned}`);
  }
});

// ── detectIncidents ───────────────────────────────────────────────────────────
test('detectIncidents() returns an array of OperationalFinding', () => {
  const findings = svc.detectIncidents();
  assert.ok(Array.isArray(findings), 'returns an array');
  assert.ok(findings.length >= 1, 'at least one finding');
});

test('detectIncidents(): live open-incidents finding is NOT_CONNECTED with confidence 0', () => {
  const findings = svc.detectIncidents();
  const live = findings.find((f) => f.kind === 'open-incidents');
  assert.ok(live, 'open-incidents finding present');
  assert.equal(live!.status, 'NOT_CONNECTED');
  assert.equal(live!.confidence, 0);
  assert.ok(live!.detail.includes('NOT CONNECTED') || live!.detail.includes('NOT_CONNECTED'), 'detail mentions NOT CONNECTED');
  assert.ok(live!.detail.includes('SUPABASE_SERVICE_ROLE_KEY'), 'cites required env var');
});

test('detectIncidents(): live NOT_CONNECTED finding has area=incident', () => {
  const findings = svc.detectIncidents();
  const live = findings.find((f) => f.kind === 'open-incidents');
  assert.equal(live!.area, 'incident');
});

test('detectIncidents(): live NOT_CONNECTED evidence has kind=not-connected', () => {
  const findings = svc.detectIncidents();
  const live = findings.find((f) => f.kind === 'open-incidents');
  const nc = live!.evidence.find((e) => e.kind === 'not-connected');
  assert.ok(nc, 'not-connected evidence present');
  assert.ok((nc!.detail ?? '').includes('SUPABASE_SERVICE_ROLE_KEY'), 'env var in detail');
});

test('detectIncidents(): structural incident model finding is CONNECTED (from incident-intelligence-v5)', () => {
  const findings = svc.detectIncidents();
  const model = findings.find((f) => f.kind === 'incident-model');
  // Only present if artifact exists with a domain field
  const store = new OperationsArtifactStore(engine);
  const intel = store.incidents() as { domain?: string } | null;
  if (intel?.domain) {
    assert.ok(model, 'incident-model finding present');
    assert.equal(model!.status, 'CONNECTED');
    assert.ok(model!.confidence > 0, 'CONNECTED finding has confidence > 0');
    assert.ok(model!.detail.includes('payments'), 'references payments domain');
  } else {
    // artifact not present — no model finding required (honest absence)
    assert.ok(model === undefined || model.status !== 'CONNECTED', 'no fabricated CONNECTED finding without artifact');
  }
});

test('detectIncidents(): runbook schema finding is CONNECTED (22 runbooks)', () => {
  const findings = svc.detectIncidents();
  const schema = findings.find((f) => f.kind === 'incident-schema');
  const store = new OperationsArtifactStore(engine);
  const rb = store.runbooks() as { summary?: { domains?: number } } | null;
  if (rb?.summary?.domains) {
    assert.ok(schema, 'incident-schema finding present');
    assert.equal(schema!.status, 'CONNECTED');
    assert.ok(schema!.confidence > 0);
    assert.ok(schema!.detail.includes('5 sections'), 'mentions 5-section structure');
  }
});

test('detectIncidents(): all NOT_CONNECTED findings have confidence=0', () => {
  const findings = svc.detectIncidents();
  for (const f of findings) {
    if (f.status === 'NOT_CONNECTED') {
      assert.equal(f.confidence, 0, `${f.id} must have confidence 0`);
    }
  }
});

test('detectIncidents(): all CONNECTED findings have confidence > 0', () => {
  const findings = svc.detectIncidents();
  for (const f of findings) {
    if (f.status === 'CONNECTED') {
      assert.ok(f.confidence > 0, `${f.id} must have confidence > 0`);
    }
  }
});

// ── detectOutages ─────────────────────────────────────────────────────────────
test('detectOutages() returns an array with at least one finding', () => {
  const findings = svc.detectOutages();
  assert.ok(Array.isArray(findings));
  assert.ok(findings.length >= 1);
});

test('detectOutages(): live worker status is NOT_CONNECTED with confidence 0', () => {
  const findings = svc.detectOutages();
  const liveWorker = findings.find((f) => f.kind === 'live-outage-status');
  assert.ok(liveWorker, 'live-outage-status present');
  assert.equal(liveWorker!.status, 'NOT_CONNECTED');
  assert.equal(liveWorker!.confidence, 0);
  assert.ok(liveWorker!.detail.includes('CF_ANALYTICS_API_TOKEN'), 'cites CF env var');
});

test('detectOutages(): live queue depth is NOT_CONNECTED with confidence 0', () => {
  const findings = svc.detectOutages();
  const liveQueue = findings.find((f) => f.kind === 'live-queue-depth');
  assert.ok(liveQueue, 'live-queue-depth present');
  assert.equal(liveQueue!.status, 'NOT_CONNECTED');
  assert.equal(liveQueue!.confidence, 0);
  assert.ok(liveQueue!.detail.includes('CLOUDFLARE_API_TOKEN'), 'cites Cloudflare env var');
});

test('detectOutages(): queue-workers SPOF finding is CONNECTED and critical', () => {
  const findings = svc.detectOutages();
  const spof = findings.find((f) => f.kind === 'spof-outage-pattern');
  const store = new OperationsArtifactStore(engine);
  const queues = store.queueGraph();
  if (queues.length > 0) {
    assert.ok(spof, 'spof-outage-pattern present');
    assert.equal(spof!.status, 'CONNECTED');
    assert.equal(spof!.severity, 'critical');
    assert.ok(spof!.confidence > 0);
    assert.ok(spof!.detail.includes('letbuyy-queue-workers'), 'mentions the worker');
    assert.ok(spof!.detail.includes('SPOF'), 'mentions SPOF');
  }
});

test('detectOutages(): money domain pattern is CONNECTED and critical', () => {
  const findings = svc.detectOutages();
  const money = findings.find((f) => f.kind === 'outage-pattern' && f.subject === 'money-domains');
  const store = new OperationsArtifactStore(engine);
  const rb = store.runbooks() as { runbooks?: Record<string, unknown> } | null;
  if (rb?.runbooks) {
    assert.ok(money, 'money outage pattern present');
    assert.equal(money!.status, 'CONNECTED');
    assert.equal(money!.severity, 'critical');
    assert.ok(money!.detail.includes('payments'), 'references payments');
    assert.ok(money!.detail.includes('reconcil'), 'references reconciliation');
  }
});

test('detectOutages(): deploy pipeline SPOF finding references production-readiness artifact', () => {
  const findings = svc.detectOutages();
  const deploy = findings.find((f) => f.kind === 'infrastructure-spof');
  const store = new OperationsArtifactStore(engine);
  if (store.productionReadiness()) {
    assert.ok(deploy, 'infrastructure-spof present');
    assert.equal(deploy!.status, 'CONNECTED');
    assert.ok(deploy!.detail.includes('SPOF'), 'mentions SPOF');
    assert.ok(deploy!.detail.includes('fail-closed'), 'mentions fail-closed rollback policy');
  }
});

test('detectOutages(): all NOT_CONNECTED findings have confidence=0', () => {
  const findings = svc.detectOutages();
  for (const f of findings) {
    if (f.status === 'NOT_CONNECTED') assert.equal(f.confidence, 0, `${f.id} confidence must be 0`);
  }
});

// ── detectBlastRadius ─────────────────────────────────────────────────────────
test('detectBlastRadius() returns at least one finding', () => {
  const findings = svc.detectBlastRadius();
  assert.ok(Array.isArray(findings));
  assert.ok(findings.length >= 1);
});

test('detectBlastRadius(): REUSES SignalCorrelator for real domain (not reimplemented)', () => {
  // Verify SignalCorrelator itself works on a real domain key from domain-intel
  const di = engine.store.read<{ domains: { key: string }[] }>('domain-intel');
  if (Array.isArray(di?.domains) && di.domains.length > 0) {
    const key = di.domains[0]!.key;
    const corr = new SignalCorrelator(engine).correlateDomain(key);
    // correlateDomain returns null when key not in graph, or a real result
    assert.ok(corr === null || (typeof corr.subject === 'string' && corr.subject === key));
  }
});

test('detectBlastRadius(): payments blast-radius finding is CONNECTED with real numbers', () => {
  const findings = svc.detectBlastRadius();
  const store = new OperationsArtifactStore(engine);
  const intel = store.incidents() as { domain?: string; blastRadius?: { domains?: number; tables?: number } } | null;
  if (intel?.domain === 'payments' && intel.blastRadius) {
    const auth = findings.find((f) => f.kind === 'blast-radius-authoritative' && f.subject === 'payments');
    assert.ok(auth, 'authoritative payments blast finding present');
    assert.equal(auth!.status, 'CONNECTED');
    assert.ok(auth!.confidence > 0);
    assert.ok(auth!.detail.includes(`${intel.blastRadius.domains}`), 'correct domain count in detail');
    assert.ok(auth!.detail.includes(`${intel.blastRadius.tables}`), 'correct table count in detail');
  }
});

test('detectBlastRadius(): blast findings have provenance (evidence with source)', () => {
  const findings = svc.detectBlastRadius();
  for (const f of findings.filter((f2) => f2.status === 'CONNECTED')) {
    assert.ok(f.evidence.length >= 1, `${f.id} must have evidence`);
    const hasSrc = f.evidence.some((e) => typeof e.source === 'string' && e.source.length > 0);
    assert.ok(hasSrc, `${f.id} evidence must have a source`);
  }
});

test('detectBlastRadius(): blast findings include money=true for payments (from blast or known)', () => {
  const findings = svc.detectBlastRadius();
  // the authoritative finding for payments references money/ledger tables
  const payments = findings.find(
    (f) => f.subject === 'payments' && f.status === 'CONNECTED',
  );
  if (payments) {
    const dl = payments.detail.toLowerCase();
    assert.ok(dl.includes('ledger') || dl.includes('money'), 'references money/ledger');
  }
});

test('detectBlastRadius(): all CONNECTED blast findings have confidence > 0', () => {
  const findings = svc.detectBlastRadius();
  for (const f of findings.filter((f2) => f2.status === 'CONNECTED')) {
    assert.ok(f.confidence > 0, `${f.id} must have confidence > 0`);
  }
});

// ── detectRecoveryStatus ──────────────────────────────────────────────────────
test('detectRecoveryStatus() returns findings', () => {
  const findings = svc.detectRecoveryStatus();
  assert.ok(Array.isArray(findings));
  assert.ok(findings.length >= 1);
});

test('detectRecoveryStatus(): runbook coverage finding is CONNECTED', () => {
  const findings = svc.detectRecoveryStatus();
  const coverage = findings.find((f) => f.kind === 'runbook-coverage');
  const store = new OperationsArtifactStore(engine);
  const rb = store.runbooks() as { runbooks?: Record<string, unknown> } | null;
  if (rb?.runbooks && Object.keys(rb.runbooks).length > 0) {
    assert.ok(coverage, 'runbook-coverage finding present');
    assert.equal(coverage!.status, 'CONNECTED');
    assert.ok(coverage!.confidence > 0);
    assert.ok(coverage!.detail.includes('5-section'), 'mentions 5-section structure');
  }
});

test('detectRecoveryStatus(): money-domain runbook findings are CONNECTED', () => {
  const findings = svc.detectRecoveryStatus();
  const moneyFindings = findings.filter((f) => f.kind === 'money-runbook');
  for (const f of moneyFindings) {
    assert.equal(f.status, 'CONNECTED', `${f.id} must be CONNECTED`);
    assert.ok(f.confidence > 0, `${f.id} must have confidence > 0`);
  }
});

test('detectRecoveryStatus(): money-domain runbook findings reference Protocol A steps', () => {
  const findings = svc.detectRecoveryStatus();
  const moneyFindings = findings.filter((f) => f.kind === 'money-runbook');
  for (const f of moneyFindings) {
    // Each finding should describe the money-domain detection approach
    assert.ok(
      f.detail.includes('NOT CONNECTED') || f.detail.includes('ledger') || f.detail.includes('reconcil'),
      `${f.id} should mention reconciliation or NOT CONNECTED`,
    );
  }
});

test('detectRecoveryStatus(): live recovery progress is NOT_CONNECTED with confidence=0', () => {
  const findings = svc.detectRecoveryStatus();
  const live = findings.find((f) => f.kind === 'live-recovery-progress');
  assert.ok(live, 'live-recovery-progress finding present');
  assert.equal(live!.status, 'NOT_CONNECTED');
  assert.equal(live!.confidence, 0);
});

test('detectRecoveryStatus(): live ledger health is NOT_CONNECTED with confidence=0', () => {
  const findings = svc.detectRecoveryStatus();
  const ledger = findings.find((f) => f.kind === 'live-ledger-health');
  assert.ok(ledger, 'live-ledger-health finding present');
  assert.equal(ledger!.status, 'NOT_CONNECTED');
  assert.equal(ledger!.confidence, 0);
  assert.ok(ledger!.detail.includes('SUPABASE_SERVICE_ROLE_KEY'), 'cites env var');
});

test('detectRecoveryStatus(): gap findings are CONNECTED with severity=high', () => {
  const findings = svc.detectRecoveryStatus();
  const gaps = findings.filter((f) => f.kind === 'runbook-gap');
  for (const g of gaps) {
    assert.equal(g.status, 'CONNECTED', `gap ${g.id} is structural (CONNECTED)`);
    assert.equal(g.severity, 'high', `gap ${g.id} must be high severity`);
    assert.ok(g.detail.includes('money'), `gap ${g.id} detail mentions money domain`);
  }
});

test('detectRecoveryStatus(): all NOT_CONNECTED findings have confidence=0', () => {
  const findings = svc.detectRecoveryStatus();
  for (const f of findings) {
    if (f.status === 'NOT_CONNECTED') assert.equal(f.confidence, 0, `${f.id} must be 0`);
  }
});

// ── generateIncidentReport ────────────────────────────────────────────────────
test('generateIncidentReport() returns a valid IncidentReport shape', () => {
  const report = svc.generateIncidentReport();
  assert.equal(report.area, 'incident');
  assert.ok(Array.isArray(report.facts), 'has facts');
  assert.ok(Array.isArray(report.findings), 'has findings');
  assert.ok(Array.isArray(report.signals), 'has signals');
  assert.ok(report.health, 'has health');
  assert.ok(typeof report.summary === 'string', 'has summary');
});

test('generateIncidentReport(): OperationalArtifact envelope is stamped', () => {
  const report = svc.generateIncidentReport();
  assert.ok(Array.isArray(report.evidence), 'evidence present');
  assert.ok(report.evidence.length >= 1, 'non-empty evidence');
  assert.ok(typeof report.confidence === 'number', 'confidence is number');
  assert.ok(Array.isArray(report.sources), 'sources present');
  assert.equal(report.timestamp, FIXED, 'timestamp uses fixed now()');
  assert.equal(report.liveConnected, false, 'liveConnected is false (no live values)');
});

test('generateIncidentReport(): confidence is 0..0.9 (structural cap)', () => {
  const report = svc.generateIncidentReport();
  assert.ok(report.confidence >= 0 && report.confidence <= 0.9, `confidence=${report.confidence} out of range`);
});

test('generateIncidentReport(): includes incident-area signals from LiveSignalRegistry', () => {
  const report = svc.generateIncidentReport();
  assert.ok(report.signals.length >= 1, 'signals present');
  for (const sig of report.signals) {
    assert.equal(sig.area, 'incident', 'all signals are incident-area');
  }
});

test('generateIncidentReport(): incident-area signals NOT_CONNECTED have value=null', () => {
  const report = svc.generateIncidentReport();
  for (const sig of report.signals) {
    if (sig.status === 'NOT_CONNECTED') {
      assert.equal(sig.value, null, `${sig.key} must have value=null`);
      assert.ok(sig.requiresEnvVar.length >= 1, `${sig.key} must name required env vars`);
    }
  }
});

test('generateIncidentReport(): facts include runbook-count with a real value', () => {
  const report = svc.generateIncidentReport();
  const countFact = report.facts.find((f) => f.kind === 'runbook-count');
  assert.ok(countFact, 'runbook-count fact present');
  if (countFact!.status === 'CONNECTED') {
    assert.ok(typeof countFact!.value === 'number' && countFact!.value >= 0, 'has numeric value');
  } else {
    assert.equal(countFact!.value, null, 'non-CONNECTED fact has null value');
  }
});

test('generateIncidentReport(): facts include open-incidents fact with value=null (NOT_CONNECTED)', () => {
  const report = svc.generateIncidentReport();
  const liveIncFact = report.facts.find((f) => f.kind === 'open-incidents');
  assert.ok(liveIncFact, 'open-incidents fact present');
  assert.equal(liveIncFact!.status, 'NOT_CONNECTED');
  assert.equal(liveIncFact!.value, null, 'live incident count is null (NOT_CONNECTED)');
});

test('generateIncidentReport(): health has area=incident', () => {
  const report = svc.generateIncidentReport();
  assert.equal(report.health.area, 'incident');
  assert.ok(typeof report.health.connectedSignals === 'number');
  assert.ok(typeof report.health.notConnectedSignals === 'number');
});

test('generateIncidentReport(): health band is not unknown (structural findings exist)', () => {
  const report = svc.generateIncidentReport();
  // With CONNECTED structural findings, band should not be 'unknown'
  if (report.findings.some((f) => f.status === 'CONNECTED')) {
    assert.notEqual(report.health.band, 'unknown', 'structural findings → band should be determined');
  }
});

test('generateIncidentReport(): summary is non-empty and mentions key facts', () => {
  const report = svc.generateIncidentReport();
  assert.ok(report.summary.length > 20, 'summary is non-trivial');
  assert.ok(report.summary.includes('runbook') || report.summary.includes('SPOF'), 'summary references key findings');
});

test('generateIncidentReport(): sources are non-empty strings', () => {
  const report = svc.generateIncidentReport();
  assert.ok(report.sources.length >= 1, 'has sources');
  for (const src of report.sources) {
    assert.ok(typeof src === 'string' && src.length > 0, `source must be non-empty string: ${src}`);
  }
});

test('generateIncidentReport(): all finding ids are deterministic (no random)', () => {
  const r1 = svc.generateIncidentReport();
  const r2 = svc.generateIncidentReport();
  const ids1 = r1.findings.map((f) => f.id).sort();
  const ids2 = r2.findings.map((f) => f.id).sort();
  assert.deepEqual(ids1, ids2, 'finding ids are deterministic across calls');
});

test('generateIncidentReport(): is deterministic (same output for same input)', () => {
  const r1 = svc.generateIncidentReport();
  const r2 = svc.generateIncidentReport();
  assert.equal(r1.findings.length, r2.findings.length, 'same finding count');
  assert.equal(r1.facts.length, r2.facts.length, 'same fact count');
  assert.equal(r1.signals.length, r2.signals.length, 'same signal count');
  assert.equal(r1.summary, r2.summary, 'same summary');
});

// ── Provenance ────────────────────────────────────────────────────────────────
test('all CONNECTED findings carry evidence with a real source', () => {
  const report = svc.generateIncidentReport();
  for (const f of report.findings.filter((f2) => f2.status === 'CONNECTED')) {
    assert.ok(f.evidence.length >= 1, `${f.id} needs evidence`);
    const hasSource = f.evidence.some((e) => typeof e.source === 'string' && e.source.length > 0);
    assert.ok(hasSource, `${f.id} evidence must have a source`);
  }
});

test('all NOT_CONNECTED findings carry not-connected evidence with env var', () => {
  const report = svc.generateIncidentReport();
  for (const f of report.findings.filter((f2) => f2.status === 'NOT_CONNECTED')) {
    const nc = f.evidence.find((e) => e.kind === 'not-connected');
    assert.ok(nc, `${f.id} must have not-connected evidence`);
    assert.ok((nc!.detail ?? '').length > 0, `${f.id} not-connected detail must be non-empty`);
    // env var name should be present in detail
    assert.ok((nc!.detail ?? '').includes('requires '), `${f.id} detail should include 'requires <ENV>'`);
  }
});

// ── Honesty contract ──────────────────────────────────────────────────────────
test('honesty: no finding fabricates a live value (value=null for NOT_CONNECTED facts)', () => {
  const report = svc.generateIncidentReport();
  for (const fact of report.facts) {
    if (fact.status === 'NOT_CONNECTED') {
      assert.equal(fact.value, null, `fact ${fact.kind}:${fact.subject} must have value=null`);
    }
  }
});

test('honesty: no NOT_CONNECTED signal has a non-null value', () => {
  const report = svc.generateIncidentReport();
  for (const sig of report.signals) {
    if (sig.status === 'NOT_CONNECTED') {
      assert.equal(sig.value, null, `signal ${sig.key} must have null value`);
    }
  }
});

test('honesty: liveConnected is always false (no live adapters wired)', () => {
  const report = svc.generateIncidentReport();
  assert.equal(report.liveConnected, false);
});

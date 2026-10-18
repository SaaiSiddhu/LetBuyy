/**
 * LCOS Phase 6 — CustomerOperationsService tests.
 *
 * Run against the REAL graphify-out artifacts (no fixtures). Fixed `now` for determinism.
 * Verifies:
 *  - Structural journey/funnel facts are CONNECTED with real artifact data
 *  - All live rates are NOT_CONNECTED: value=null, confidence=0, requiresEnvVar named
 *  - Provenance: every fact/finding carries evidence with a named source
 *  - Determinism: same call twice → identical report
 *  - READ-ONLY: source files contain no fetch/spawn/exec/writeFile/network/db-write
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createEngine } from '@letbuyy/lcis-core';
import { CustomerOperationsService } from '../src/customer/index';
import type { CustomerReport, OperationalFinding, OperationalFact, LiveSignal } from '../src/shared/index';

const FIXED = '2026-06-21T00:00:00.000Z';
const engine = createEngine();
const svc = new CustomerOperationsService(engine, () => FIXED);
const journey = engine.store.read<{stages: {stage: string; tables: number; rpcs: number}[]}>('customer-journey-intelligence');

// ── Helpers ───────────────────────────────────────────────────────────────────

function isNotConnectedFinding(f: OperationalFinding): boolean {
  return f.status === 'NOT_CONNECTED';
}
function isConnectedFact(f: OperationalFact): boolean {
  return f.status === 'CONNECTED';
}
function firstFactByKind(facts: readonly OperationalFact[], kind: string): OperationalFact | undefined {
  return facts.find((f) => f.kind === kind);
}
function findingsById(findings: readonly OperationalFinding[], id: string): OperationalFinding | undefined {
  return findings.find((f) => f.id === id);
}

// ── 1. Service instantiates without error ─────────────────────────────────────

test('CustomerOperationsService: instantiates with real artifacts', () => {
  assert.ok(svc instanceof CustomerOperationsService);
});

// ── 2. generateCustomerReport: shape + area ───────────────────────────────────

test('generateCustomerReport: returns area=customer', () => {
  const r = svc.generateCustomerReport();
  assert.equal(r.area, 'customer');
});

test('generateCustomerReport: has facts, findings, signals, health, summary', () => {
  const r = svc.generateCustomerReport();
  assert.ok(Array.isArray(r.facts) && r.facts.length > 0, 'facts present');
  assert.ok(Array.isArray(r.findings) && r.findings.length > 0, 'findings present');
  assert.ok(Array.isArray(r.signals) && r.signals.length > 0, 'signals present');
  assert.ok(r.health !== undefined, 'health present');
  assert.ok(typeof r.summary === 'string' && r.summary.length > 0, 'summary present');
});

test('generateCustomerReport: envelope fields stamped (evidence, confidence, sources, timestamp, liveConnected)', () => {
  const r = svc.generateCustomerReport();
  assert.ok(Array.isArray(r.evidence) && r.evidence.length > 0, 'evidence present');
  assert.ok(typeof r.confidence === 'number', 'confidence present');
  assert.ok(Array.isArray(r.sources), 'sources present');
  assert.equal(r.timestamp, FIXED, 'timestamp is fixed (deterministic)');
  assert.equal(r.liveConnected, false, 'liveConnected is false — no live values in this env');
});

// ── 3. Structural journey facts ────────────────────────────────────────────────

test('generateCustomerReport: journey-funnel fact is CONNECTED with value=8', () => {
  const r = svc.generateCustomerReport();
  const fact = firstFactByKind(r.facts, 'journey-funnel');
  assert.ok(fact, 'journey-funnel fact present');
  assert.equal(fact!.status, 'CONNECTED');
  assert.equal(fact!.value, 8, '8-stage funnel');
  assert.ok(fact!.evidence.length > 0, 'has evidence');
});

test('generateCustomerReport: critical-stages fact is CONNECTED with Payment+Refund', () => {
  const r = svc.generateCustomerReport();
  const fact = firstFactByKind(r.facts, 'critical-stages');
  assert.ok(fact, 'critical-stages fact present');
  assert.equal(fact!.status, 'CONNECTED');
  assert.ok(String(fact!.value).includes('Payment'), 'Payment is critical');
  assert.ok(String(fact!.value).includes('Refund'), 'Refund is critical');
});

test('generateCustomerReport: per-stage-topology facts — one per stage, all CONNECTED', () => {
  const r = svc.generateCustomerReport();
  const stageFacts = r.facts.filter((f) => f.kind === 'stage-topology');
  assert.equal(stageFacts.length, 8, '8 stage-topology facts');
  for (const f of stageFacts) {
    assert.equal(f.status, 'CONNECTED', `${f.subject} topology CONNECTED`);
    assert.ok(f.evidence.length > 0, `${f.subject} has evidence`);
  }
});

test('generateCustomerReport: Payment stage preserves current table and RPC counts', () => {
  const r = svc.generateCustomerReport();
  const pay = r.facts.find((f) => f.kind === 'stage-topology' && f.subject === 'Payment');
  assert.ok(pay, 'Payment topology fact present');
  const stage = journey.stages.find(row => row.stage === 'Payment')!;
  assert.ok(String(pay!.value).includes(`tables:${stage.tables}`), 'Payment preserves the current table count');
  assert.ok(String(pay!.value).includes(`rpcs:${stage.rpcs}`), 'Payment preserves the current RPC count');
});

test('generateCustomerReport: Refund stage preserves current table and RPC counts', () => {
  const r = svc.generateCustomerReport();
  const ref = r.facts.find((f) => f.kind === 'stage-topology' && f.subject === 'Refund');
  assert.ok(ref, 'Refund topology fact present');
  const stage = journey.stages.find(row => row.stage === 'Refund')!;
  assert.ok(String(ref!.value).includes(`tables:${stage.tables}`), 'Refund preserves the current table count');
  assert.ok(String(ref!.value).includes(`rpcs:${stage.rpcs}`), 'Refund preserves the current RPC count');
});

// ── 4. Stage-dropoff facts — all NOT_CONNECTED ────────────────────────────────

test('generateCustomerReport: stage-dropoff facts — 8, all NOT_CONNECTED, value=null', () => {
  const r = svc.generateCustomerReport();
  const dropoffs = r.facts.filter((f) => f.kind === 'stage-dropoff');
  assert.equal(dropoffs.length, 8, '8 stage-dropoff facts');
  for (const f of dropoffs) {
    assert.equal(f.status, 'NOT_CONNECTED', `${f.subject} dropoff NOT_CONNECTED`);
    assert.equal(f.value, null, `${f.subject} dropoff value is null`);
    assert.ok(f.evidence.length > 0, `${f.subject} dropoff has evidence`);
    // evidence must cite an env var
    const ev = f.evidence[0];
    assert.equal(ev!.kind, 'not-connected', `${f.subject} dropoff evidence is not-connected`);
  }
});

// ── 5. Graph model facts ───────────────────────────────────────────────────────

test('generateCustomerReport: 8 graph-model facts, all CONNECTED', () => {
  const r = svc.generateCustomerReport();
  const models = r.facts.filter((f) => f.kind === 'graph-model');
  assert.equal(models.length, 8, '8 graph model facts');
  for (const m of models) {
    assert.equal(m.status, 'CONNECTED', `${m.subject} graph model CONNECTED`);
    assert.ok(typeof m.value === 'number' && (m.value as number) > 0, `${m.subject} has source count`);
  }
});

test('generateCustomerReport: 8 graph-rate facts, all NOT_CONNECTED, value=null', () => {
  const r = svc.generateCustomerReport();
  const rates = r.facts.filter((f) => f.kind === 'graph-rate');
  assert.equal(rates.length, 8, '8 graph-rate facts');
  for (const r2 of rates) {
    assert.equal(r2.status, 'NOT_CONNECTED', `${r2.subject} rate NOT_CONNECTED`);
    assert.equal(r2.value, null, `${r2.subject} rate value is null`);
  }
});

test('generateCustomerReport: funnel graph sources include analytics_event_stream', () => {
  const r = svc.generateCustomerReport();
  const funnel = r.facts.find((f) => f.kind === 'graph-model' && f.subject === 'funnel');
  assert.ok(funnel, 'funnel graph model fact present');
  assert.ok(funnel!.detail.includes('analytics_event_stream'), 'funnel cites analytics_event_stream');
});

// ── 6. detectConversionDrops ──────────────────────────────────────────────────

test('detectConversionDrops: returns OperationalFinding[]', () => {
  const findings = svc.detectConversionDrops();
  assert.ok(Array.isArray(findings) && findings.length > 0);
});

test('detectConversionDrops: conversion-model finding is CONNECTED', () => {
  const f = findingsById(svc.detectConversionDrops(), 'CONVERSION-MODEL-CONNECTED');
  assert.ok(f, 'CONVERSION-MODEL-CONNECTED present');
  assert.equal(f!.status, 'CONNECTED');
  assert.ok(f!.confidence > 0, 'confidence > 0 for CONNECTED');
});

test('detectConversionDrops: session-to-order rate finding is NOT_CONNECTED, confidence=0', () => {
  const f = findingsById(svc.detectConversionDrops(), 'CONVERSION-RATE-NOT-CONNECTED');
  assert.ok(f, 'CONVERSION-RATE-NOT-CONNECTED present');
  assert.equal(f!.status, 'NOT_CONNECTED');
  assert.equal(f!.confidence, 0, 'confidence 0 for NOT_CONNECTED');
  assert.ok(f!.detail.includes('CF_ANALYTICS_API_TOKEN') || f!.detail.includes('SUPABASE_URL'), 'detail cites env var');
});

test('detectConversionDrops: Payment stage finding is CONNECTED+critical (money=true)', () => {
  const f = findingsById(svc.detectConversionDrops(), 'CONVERSION-PAYMENT-STAGE-RISK');
  assert.ok(f, 'CONVERSION-PAYMENT-STAGE-RISK present');
  assert.equal(f!.status, 'CONNECTED');
  assert.equal(f!.severity, 'critical');
});

// ── 7. detectTrafficAnomalies ─────────────────────────────────────────────────

test('detectTrafficAnomalies: returns OperationalFinding[]', () => {
  const findings = svc.detectTrafficAnomalies();
  assert.ok(Array.isArray(findings) && findings.length > 0);
});

test('detectTrafficAnomalies: Landing stage topology CONNECTED', () => {
  const f = findingsById(svc.detectTrafficAnomalies(), 'TRAFFIC-LANDING-TOPOLOGY');
  assert.ok(f, 'TRAFFIC-LANDING-TOPOLOGY present');
  assert.equal(f!.status, 'CONNECTED');
});

test('detectTrafficAnomalies: CDN/Vercel SPOF is critical+CONNECTED', () => {
  const f = findingsById(svc.detectTrafficAnomalies(), 'TRAFFIC-CDN-SPOF');
  assert.ok(f, 'TRAFFIC-CDN-SPOF present');
  assert.equal(f!.status, 'CONNECTED');
  assert.equal(f!.severity, 'critical');
});

test('detectTrafficAnomalies: sessions NOT_CONNECTED, confidence=0, cites CF env vars', () => {
  const f = findingsById(svc.detectTrafficAnomalies(), 'TRAFFIC-SESSIONS-NOT-CONNECTED');
  assert.ok(f, 'TRAFFIC-SESSIONS-NOT-CONNECTED present');
  assert.equal(f!.status, 'NOT_CONNECTED');
  assert.equal(f!.confidence, 0);
  assert.ok(f!.detail.includes('CF_ANALYTICS_API_TOKEN'), 'detail cites CF_ANALYTICS_API_TOKEN');
});

// ── 8. detectSearchFailures ───────────────────────────────────────────────────

test('detectSearchFailures: returns OperationalFinding[]', () => {
  const findings = svc.detectSearchFailures();
  assert.ok(Array.isArray(findings) && findings.length > 0);
});

test('detectSearchFailures: SEARCH_QUEUE dependency is CONNECTED', () => {
  const f = findingsById(svc.detectSearchFailures(), 'SEARCH-QUEUE-DEPENDENCY');
  assert.ok(f, 'SEARCH-QUEUE-DEPENDENCY present');
  assert.equal(f!.status, 'CONNECTED');
  assert.ok(f!.evidence.length > 0);
});

test('detectSearchFailures: search telemetry NOT_CONNECTED, confidence=0', () => {
  const f = findingsById(svc.detectSearchFailures(), 'SEARCH-TELEMETRY-NOT-CONNECTED');
  assert.ok(f, 'SEARCH-TELEMETRY-NOT-CONNECTED present');
  assert.equal(f!.status, 'NOT_CONNECTED');
  assert.equal(f!.confidence, 0);
});

// ── 9. detectSessionAnomalies ─────────────────────────────────────────────────

test('detectSessionAnomalies: returns OperationalFinding[]', () => {
  const findings = svc.detectSessionAnomalies();
  assert.ok(Array.isArray(findings) && findings.length > 0);
});

test('detectSessionAnomalies: session model CONNECTED', () => {
  const f = findingsById(svc.detectSessionAnomalies(), 'SESSION-MODEL-CONNECTED');
  assert.ok(f, 'SESSION-MODEL-CONNECTED present');
  assert.equal(f!.status, 'CONNECTED');
});

test('detectSessionAnomalies: session anomaly NOT_CONNECTED, confidence=0', () => {
  const f = findingsById(svc.detectSessionAnomalies(), 'SESSION-ANOMALY-NOT-CONNECTED');
  assert.ok(f, 'SESSION-ANOMALY-NOT-CONNECTED present');
  assert.equal(f!.status, 'NOT_CONNECTED');
  assert.equal(f!.confidence, 0);
  assert.ok(f!.detail.includes('SUPABASE_URL'), 'cites SUPABASE_URL');
});

test('detectSessionAnomalies: risk model CONNECTED (order_risk_assessments, risk_scores, risk_signals)', () => {
  const f = findingsById(svc.detectSessionAnomalies(), 'SESSION-RISK-MODEL-CONNECTED');
  assert.ok(f, 'SESSION-RISK-MODEL-CONNECTED present');
  assert.equal(f!.status, 'CONNECTED');
  assert.ok(f!.detail.includes('order_risk_assessments'));
});

// ── 10. detectAbandonment ─────────────────────────────────────────────────────

test('detectAbandonment: returns OperationalFinding[]', () => {
  const findings = svc.detectAbandonment();
  assert.ok(Array.isArray(findings) && findings.length > 0);
});

test('detectAbandonment: abandonment model CONNECTED', () => {
  const f = findingsById(svc.detectAbandonment(), 'ABANDONMENT-MODEL-CONNECTED');
  assert.ok(f, 'ABANDONMENT-MODEL-CONNECTED present');
  assert.equal(f!.status, 'CONNECTED');
  assert.ok(f!.detail.includes('carts'));
});

test('detectAbandonment: cart rate NOT_CONNECTED, confidence=0, cites SUPABASE_URL', () => {
  const f = findingsById(svc.detectAbandonment(), 'ABANDONMENT-CART-RATE-NOT-CONNECTED');
  assert.ok(f, 'ABANDONMENT-CART-RATE-NOT-CONNECTED present');
  assert.equal(f!.status, 'NOT_CONNECTED');
  assert.equal(f!.confidence, 0);
  assert.ok(f!.detail.includes('SUPABASE_URL'));
});

test('detectAbandonment: checkout rate NOT_CONNECTED, confidence=0', () => {
  const f = findingsById(svc.detectAbandonment(), 'ABANDONMENT-CHECKOUT-RATE-NOT-CONNECTED');
  assert.ok(f, 'ABANDONMENT-CHECKOUT-RATE-NOT-CONNECTED present');
  assert.equal(f!.status, 'NOT_CONNECTED');
  assert.equal(f!.confidence, 0);
});

test('detectAbandonment: Checkout complexity is critical+CONNECTED (money)', () => {
  const f = findingsById(svc.detectAbandonment(), 'ABANDONMENT-CHECKOUT-COMPLEXITY');
  assert.ok(f, 'ABANDONMENT-CHECKOUT-COMPLEXITY present');
  assert.equal(f!.status, 'CONNECTED');
  assert.equal(f!.severity, 'critical');
  const stage = journey.stages.find(row => row.stage === 'Checkout')!;
  assert.ok(f!.detail.includes(`${stage.tables} tables`), 'Checkout preserves the current table count');
});

// ── 11. Signals from registry ─────────────────────────────────────────────────

test('generateCustomerReport: signals include journey-topology (CONNECTED) and conversion-rate (NOT_CONNECTED)', () => {
  const r = svc.generateCustomerReport();
  const journeyTopo = r.signals.find((s: LiveSignal) => s.key === 'customer.journey-topology');
  const convRate = r.signals.find((s: LiveSignal) => s.key === 'customer.conversion-rate');
  assert.ok(journeyTopo, 'customer.journey-topology signal present');
  assert.equal(journeyTopo!.status, 'CONNECTED');
  assert.ok(convRate, 'customer.conversion-rate signal present');
  assert.equal(convRate!.status, 'NOT_CONNECTED');
  assert.equal(convRate!.value, null, 'conversion-rate value is null');
});

test('generateCustomerReport: all NOT_CONNECTED signals have requiresEnvVar set', () => {
  const r = svc.generateCustomerReport();
  for (const s of r.signals) {
    if (s.status === 'NOT_CONNECTED') {
      assert.ok(s.requiresEnvVar.length > 0, `${s.key} names requiresEnvVar`);
      assert.equal(s.value, null, `${s.key} value is null`);
    }
  }
});

test('generateCustomerReport: signals include traffic and abandonment-rate (both NOT_CONNECTED)', () => {
  const r = svc.generateCustomerReport();
  const traffic = r.signals.find((s: LiveSignal) => s.key === 'customer.traffic');
  const abandonment = r.signals.find((s: LiveSignal) => s.key === 'customer.abandonment-rate');
  assert.ok(traffic, 'customer.traffic signal present');
  assert.equal(traffic!.status, 'NOT_CONNECTED');
  assert.equal(traffic!.value, null);
  assert.ok(abandonment, 'customer.abandonment-rate signal present');
  assert.equal(abandonment!.status, 'NOT_CONNECTED');
  assert.equal(abandonment!.value, null);
});

// ── 12. Health ────────────────────────────────────────────────────────────────

test('generateCustomerReport: health.area is customer', () => {
  const r = svc.generateCustomerReport();
  assert.equal(r.health.area, 'customer');
});

test('generateCustomerReport: health has notConnectedSignals > 0 (honest — live signals not wired)', () => {
  const r = svc.generateCustomerReport();
  assert.ok(r.health.notConnectedSignals > 0, 'not-connected signals > 0');
});

// ── 13. Provenance ────────────────────────────────────────────────────────────

test('generateCustomerReport: every finding has at least one evidence item', () => {
  const r = svc.generateCustomerReport();
  for (const f of r.findings) {
    assert.ok(f.evidence.length > 0, `finding ${f.id} has evidence`);
  }
});

test('generateCustomerReport: every fact has at least one evidence item', () => {
  const r = svc.generateCustomerReport();
  for (const f of r.facts) {
    assert.ok(f.evidence.length > 0, `fact ${f.kind}/${f.subject} has evidence`);
  }
});

test('generateCustomerReport: NOT_CONNECTED facts cite a known env var', () => {
  const r = svc.generateCustomerReport();
  const KNOWN_ENVS = ['CF_ANALYTICS_API_TOKEN', 'CF_ACCOUNT_ID', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  for (const f of r.facts) {
    if (f.status === 'NOT_CONNECTED') {
      const ev = f.evidence[0]!;
      assert.equal(ev.kind, 'not-connected', `${f.kind}/${f.subject} evidence kind`);
      const detail = ev.detail ?? '';
      const citesKnown = KNOWN_ENVS.some((e) => detail.includes(e));
      assert.ok(citesKnown, `${f.kind}/${f.subject} NOT_CONNECTED cites a known env var, got: ${detail}`);
    }
  }
});

test('generateCustomerReport: CONNECTED findings have confidence > 0', () => {
  const r = svc.generateCustomerReport();
  for (const f of r.findings) {
    if (f.status === 'CONNECTED') {
      assert.ok(f.confidence > 0, `${f.id} CONNECTED but confidence=${f.confidence}`);
    }
  }
});

test('generateCustomerReport: NOT_CONNECTED findings have confidence = 0', () => {
  const r = svc.generateCustomerReport();
  for (const f of r.findings) {
    if (isNotConnectedFinding(f)) {
      assert.equal(f.confidence, 0, `${f.id} NOT_CONNECTED must have confidence=0`);
    }
  }
});

// ── 14. Determinism ────────────────────────────────────────────────────────────

test('generateCustomerReport: deterministic — same output on two calls', () => {
  const svc2 = new CustomerOperationsService(engine, () => FIXED);
  const r1 = svc2.generateCustomerReport();
  const r2 = svc2.generateCustomerReport();
  assert.equal(r1.timestamp, r2.timestamp, 'timestamps match');
  assert.equal(r1.facts.length, r2.facts.length, 'fact counts match');
  assert.equal(r1.findings.length, r2.findings.length, 'finding counts match');
  assert.equal(r1.summary, r2.summary, 'summaries match');
  assert.equal(r1.confidence, r2.confidence, 'confidence matches');
});

test('detectConversionDrops: deterministic — same finding IDs on two calls', () => {
  const ids1 = svc.detectConversionDrops().map((f) => f.id).sort();
  const ids2 = svc.detectConversionDrops().map((f) => f.id).sort();
  assert.deepEqual(ids1, ids2);
});

// ── 15. READ-ONLY source scan ─────────────────────────────────────────────────

const SERVICE_SRC = readFileSync(
  new URL('../src/customer/CustomerOperationsService.ts', import.meta.url).pathname,
  'utf8',
);

// Strip single-line comments to avoid false positives in JSDoc
const strippedSrc = SERVICE_SRC.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('CustomerOperationsService source: no fetch() calls', () => {
  assert.ok(!strippedSrc.match(/\bfetch\s*\(/), 'no fetch() in source');
});

test('CustomerOperationsService source: no child_process/spawn/exec', () => {
  assert.ok(!strippedSrc.match(/child_process|spawn\s*\(|exec\s*\(/), 'no child_process in source');
});

test('CustomerOperationsService source: no eval()', () => {
  assert.ok(!strippedSrc.match(/\beval\s*\(/), 'no eval() in source');
});

test('CustomerOperationsService source: no writeFile/appendFile/mkdir', () => {
  assert.ok(!strippedSrc.match(/writeFile|appendFile|mkdirSync|mkdir\s*\(/), 'no write FS ops in source');
});

test('CustomerOperationsService source: no direct DB write patterns (insert/update/upsert/delete)', () => {
  assert.ok(!strippedSrc.match(/\.from\s*\([^)]+\)\s*\.(insert|update|upsert|delete)/), 'no DB mutation in source');
});

test('CustomerOperationsService source: no setTimeout/setInterval/Promise.race with timeouts', () => {
  assert.ok(!strippedSrc.match(/setTimeout\s*\(|setInterval\s*\(/), 'no timers in source');
});

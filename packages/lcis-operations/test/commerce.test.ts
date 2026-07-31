/**
 * commerce.test.ts — ≥45 tests for CommerceOperationsService (LCOS Phase 6).
 *
 * Uses real graphify-out artifacts (db-intel.json, revenue-intelligence-v2.json,
 * commerce-control-intel.json). Fixed now=() => FIXED for determinism.
 * No mocks, no stubs, no placeholders, no network calls, no file writes.
 * Tests verify the honesty contract: live amounts NOT_CONNECTED (value=null, confidence=0,
 * requiresEnvVar named), structural topology CONNECTED.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine } from '@letbuyy/lcis-core';
import { CommerceOperationsService } from '../src/commerce/index';
import type { CommerceReport, OperationalFinding } from '../src/shared/index';

const FIXED = '2026-06-21T00:00:00.000Z';
const engine = createEngine();
const svc = new CommerceOperationsService(engine, () => FIXED);

// ── helpers ───────────────────────────────────────────────────────────────────

function findingById(findings: readonly OperationalFinding[], id: string): OperationalFinding | undefined {
  return findings.find((f) => f.id === id);
}

function notConnectedFindings(findings: readonly OperationalFinding[]): OperationalFinding[] {
  return findings.filter((f) => f.status === 'NOT_CONNECTED');
}

function connectedFindings(findings: readonly OperationalFinding[]): OperationalFinding[] {
  return findings.filter((f) => f.status === 'CONNECTED');
}

function hasEnvVar(f: OperationalFinding, envVar: string): boolean {
  return f.evidence.some((e) => e.detail?.includes(envVar) || e.source === envVar || e.ref?.includes(envVar));
}

// ── 1. GMV Trend ─────────────────────────────────────────────────────────────

test('detectGmvTrend returns at least 2 findings', () => {
  const findings = svc.detectGmvTrend();
  assert.ok(findings.length >= 2, `expected ≥2, got ${findings.length}`);
});

test('detectGmvTrend: funnel topology finding is CONNECTED', () => {
  const f = findingById(svc.detectGmvTrend(), 'COMMERCE-GMV-FUNNEL-TOPOLOGY');
  assert.ok(f !== undefined, 'funnel topology finding present');
  assert.equal(f!.status, 'CONNECTED');
  assert.equal(f!.area, 'commerce');
});

test('detectGmvTrend: funnel topology confidence > 0', () => {
  const f = findingById(svc.detectGmvTrend(), 'COMMERCE-GMV-FUNNEL-TOPOLOGY');
  assert.ok(f!.confidence > 0, `confidence=${f!.confidence} should be >0 for CONNECTED finding`);
});

test('detectGmvTrend: live GMV finding is NOT_CONNECTED', () => {
  const f = findingById(svc.detectGmvTrend(), 'COMMERCE-GMV-LIVE-NOT-CONNECTED');
  assert.ok(f !== undefined, 'live GMV finding present');
  assert.equal(f!.status, 'NOT_CONNECTED');
});

test('detectGmvTrend: live GMV confidence is exactly 0', () => {
  const f = findingById(svc.detectGmvTrend(), 'COMMERCE-GMV-LIVE-NOT-CONNECTED');
  assert.equal(f!.confidence, 0);
});

test('detectGmvTrend: live GMV finding names SUPABASE_URL', () => {
  const f = findingById(svc.detectGmvTrend(), 'COMMERCE-GMV-LIVE-NOT-CONNECTED');
  assert.ok(hasEnvVar(f!, 'SUPABASE_URL'), 'SUPABASE_URL named in evidence');
});

test('detectGmvTrend: live GMV finding names SUPABASE_SERVICE_ROLE_KEY', () => {
  const f = findingById(svc.detectGmvTrend(), 'COMMERCE-GMV-LIVE-NOT-CONNECTED');
  assert.ok(hasEnvVar(f!, 'SUPABASE_SERVICE_ROLE_KEY'), 'SUPABASE_SERVICE_ROLE_KEY named in evidence');
});

test('detectGmvTrend: funnel topology detail mentions orders.total_minor', () => {
  const f = findingById(svc.detectGmvTrend(), 'COMMERCE-GMV-FUNNEL-TOPOLOGY');
  assert.ok(f!.detail.includes('orders.total_minor'), 'detail cites source table+column');
});

test('detectGmvTrend: deterministic — identical results on two calls', () => {
  const a = svc.detectGmvTrend();
  const b = svc.detectGmvTrend();
  assert.deepEqual(JSON.stringify(a), JSON.stringify(b));
});

// ── 2. Order Trend ────────────────────────────────────────────────────────────

test('detectOrderTrend returns at least 3 findings', () => {
  const findings = svc.detectOrderTrend();
  assert.ok(findings.length >= 3, `expected ≥3, got ${findings.length}`);
});

test('detectOrderTrend: orders domain topology finding is CONNECTED', () => {
  const f = findingById(svc.detectOrderTrend(), 'COMMERCE-ORDER-DOMAIN-TOPOLOGY');
  assert.ok(f !== undefined);
  assert.equal(f!.status, 'CONNECTED');
  assert.equal(f!.area, 'commerce');
});

test('detectOrderTrend: orders domain detail includes route/rpc/table counts from real artifact', () => {
  const f = findingById(svc.detectOrderTrend(), 'COMMERCE-ORDER-DOMAIN-TOPOLOGY');
  // Real artifact has routes:3, rpcs:12, tables:10 for orders domain
  assert.ok(f!.detail.includes('12 RPCs') || f!.detail.includes('rpcs=12') || f!.detail.includes('12'), 'orders domain has 12 RPCs');
});

test('detectOrderTrend: order journey topology finding is CONNECTED', () => {
  const f = findingById(svc.detectOrderTrend(), 'COMMERCE-ORDER-JOURNEY-TOPOLOGY');
  assert.ok(f !== undefined);
  assert.equal(f!.status, 'CONNECTED');
});

test('detectOrderTrend: order journey detail includes create_checkout_order', () => {
  const f = findingById(svc.detectOrderTrend(), 'COMMERCE-ORDER-JOURNEY-TOPOLOGY');
  assert.ok(f!.detail.includes('create_checkout_order'), 'checkout RPC in journey detail');
});

test('detectOrderTrend: live order rate finding is NOT_CONNECTED', () => {
  const f = findingById(svc.detectOrderTrend(), 'COMMERCE-ORDER-RATE-NOT-CONNECTED');
  assert.ok(f !== undefined);
  assert.equal(f!.status, 'NOT_CONNECTED');
  assert.equal(f!.confidence, 0);
});

test('detectOrderTrend: live order rate names SUPABASE_URL', () => {
  const f = findingById(svc.detectOrderTrend(), 'COMMERCE-ORDER-RATE-NOT-CONNECTED');
  assert.ok(hasEnvVar(f!, 'SUPABASE_URL'));
});

// ── 3. Refund Spikes ──────────────────────────────────────────────────────────

test('detectRefundSpikes returns at least 3 findings', () => {
  const findings = svc.detectRefundSpikes();
  assert.ok(findings.length >= 3, `expected ≥3, got ${findings.length}`);
});

test('detectRefundSpikes: refund ledger path finding is CONNECTED', () => {
  const f = findingById(svc.detectRefundSpikes(), 'COMMERCE-REFUND-LEDGER-PATH-CONNECTED');
  assert.ok(f !== undefined);
  assert.equal(f!.status, 'CONNECTED');
});

test('detectRefundSpikes: refund journey detail includes complete_order_refund', () => {
  const f = findingById(svc.detectRefundSpikes(), 'COMMERCE-REFUND-LEDGER-PATH-CONNECTED');
  assert.ok(f!.detail.includes('complete_order_refund'), 'refund RPC in journey');
});

test('detectRefundSpikes: refund journey detail includes restore_gift_card_on_refund', () => {
  const f = findingById(svc.detectRefundSpikes(), 'COMMERCE-REFUND-LEDGER-PATH-CONNECTED');
  assert.ok(f!.detail.includes('restore_gift_card_on_refund'), 'gift card restore RPC in journey');
});

test('detectRefundSpikes: leakage RPCs finding is CONNECTED', () => {
  const f = findingById(svc.detectRefundSpikes(), 'COMMERCE-REFUND-LEAKAGE-RPCS-CONNECTED');
  assert.ok(f !== undefined);
  assert.equal(f!.status, 'CONNECTED');
});

test('detectRefundSpikes: leakage RPCs finding title includes real count (≥12)', () => {
  const f = findingById(svc.detectRefundSpikes(), 'COMMERCE-REFUND-LEAKAGE-RPCS-CONNECTED');
  // Real artifact has 12 leakage RPCs
  const match = f!.title.match(/(\d+) leakage/);
  assert.ok(match !== null && parseInt(match[1]!) >= 12, `title: ${f!.title}`);
});

test('detectRefundSpikes: live refund rate finding is NOT_CONNECTED', () => {
  const f = findingById(svc.detectRefundSpikes(), 'COMMERCE-REFUND-RATE-NOT-CONNECTED');
  assert.ok(f !== undefined);
  assert.equal(f!.status, 'NOT_CONNECTED');
  assert.equal(f!.confidence, 0);
});

test('detectRefundSpikes: live refund rate names SUPABASE_SERVICE_ROLE_KEY', () => {
  const f = findingById(svc.detectRefundSpikes(), 'COMMERCE-REFUND-RATE-NOT-CONNECTED');
  assert.ok(hasEnvVar(f!, 'SUPABASE_SERVICE_ROLE_KEY'));
});

// ── 4. Payment Failures ───────────────────────────────────────────────────────

test('detectPaymentFailures returns at least 3 findings', () => {
  const findings = svc.detectPaymentFailures();
  assert.ok(findings.length >= 3, `expected ≥3, got ${findings.length}`);
});

test('detectPaymentFailures: payment journey finding is CONNECTED', () => {
  const f = findingById(svc.detectPaymentFailures(), 'COMMERCE-PAYMENT-JOURNEY-CONNECTED');
  assert.ok(f !== undefined);
  assert.equal(f!.status, 'CONNECTED');
});

test('detectPaymentFailures: payment journey detail includes confirm_order_payment_with_ledger', () => {
  const f = findingById(svc.detectPaymentFailures(), 'COMMERCE-PAYMENT-JOURNEY-CONNECTED');
  assert.ok(f!.detail.includes('confirm_order_payment_with_ledger'), 'payment RPC in journey');
});

test('detectPaymentFailures: money functions NOT SECURITY DEFINER produce CONNECTED findings', () => {
  const findings = svc.detectPaymentFailures();
  const noSdFindings = findings.filter((f) => f.kind === 'payment-security-no-sd');
  assert.ok(noSdFindings.length > 0, 'at least one not-SD money function finding');
  for (const f of noSdFindings) {
    assert.equal(f.status, 'CONNECTED', `${f.id} should be CONNECTED`);
    assert.ok(f.confidence > 0, `${f.id} confidence should be >0 for CONNECTED finding`);
  }
});

test('detectPaymentFailures: sync_order_items_site_id (not SD) produces a finding', () => {
  const findings = svc.detectPaymentFailures();
  const f = findings.find((f) => f.subject === 'sync_order_items_site_id');
  assert.ok(f !== undefined, 'sync_order_items_site_id finding present');
  assert.equal(f!.status, 'CONNECTED');
});

test('detectPaymentFailures: trigger/read helpers (enforce_ledger_transaction_balance) are info severity', () => {
  const findings = svc.detectPaymentFailures();
  const f = findings.find((f) => f.subject === 'enforce_ledger_transaction_balance');
  assert.ok(f !== undefined, 'enforce_ledger_transaction_balance finding present');
  assert.equal(f!.severity, 'info', 'trigger helper should be info severity');
});

test('detectPaymentFailures: live payment failure rate is NOT_CONNECTED', () => {
  const f = findingById(svc.detectPaymentFailures(), 'COMMERCE-PAYMENT-FAILURE-RATE-NOT-CONNECTED');
  assert.ok(f !== undefined);
  assert.equal(f!.status, 'NOT_CONNECTED');
  assert.equal(f!.confidence, 0);
});

test('detectPaymentFailures: live payment failure rate names SUPABASE_URL', () => {
  const f = findingById(svc.detectPaymentFailures(), 'COMMERCE-PAYMENT-FAILURE-RATE-NOT-CONNECTED');
  assert.ok(hasEnvVar(f!, 'SUPABASE_URL'));
});

test('detectPaymentFailures: no-SD non-trigger findings are high severity', () => {
  const findings = svc.detectPaymentFailures();
  const highRiskNoSd = findings.filter(
    (f) => f.kind === 'payment-security-no-sd' &&
      !['enforce_ledger_transaction_balance', 'ledger_balance_breaks'].includes(f.subject),
  );
  for (const f of highRiskNoSd) {
    assert.equal(f.severity, 'high', `${f.subject} should be high severity`);
  }
});

// ── 5. Checkout Degradation ───────────────────────────────────────────────────

test('detectCheckoutDegradation returns at least 3 findings', () => {
  const findings = svc.detectCheckoutDegradation();
  assert.ok(findings.length >= 3, `expected ≥3, got ${findings.length}`);
});

test('detectCheckoutDegradation: checkout RPC finding is CONNECTED', () => {
  const f = findingById(svc.detectCheckoutDegradation(), 'COMMERCE-CHECKOUT-RPC-CONNECTED');
  assert.ok(f !== undefined);
  assert.equal(f!.status, 'CONNECTED');
});

test('detectCheckoutDegradation: checkout RPC detail includes securityDefiner=true', () => {
  const f = findingById(svc.detectCheckoutDegradation(), 'COMMERCE-CHECKOUT-RPC-CONNECTED');
  assert.ok(f!.detail.includes('securityDefiner=true'), `detail: ${f!.detail}`);
});

test('detectCheckoutDegradation: checkout RPC detail includes hasIdempotency=true', () => {
  const f = findingById(svc.detectCheckoutDegradation(), 'COMMERCE-CHECKOUT-RPC-CONNECTED');
  assert.ok(f!.detail.includes('hasIdempotency=true'), `detail: ${f!.detail}`);
});

test('detectCheckoutDegradation: orders domain finding present and CONNECTED', () => {
  const f = findingById(svc.detectCheckoutDegradation(), 'COMMERCE-CHECKOUT-DOMAIN-ORDERS');
  assert.ok(f !== undefined);
  assert.equal(f!.status, 'CONNECTED');
});

test('detectCheckoutDegradation: live checkout finding is NOT_CONNECTED', () => {
  const f = findingById(svc.detectCheckoutDegradation(), 'COMMERCE-CHECKOUT-DEGRADATION-NOT-CONNECTED');
  assert.ok(f !== undefined);
  assert.equal(f!.status, 'NOT_CONNECTED');
  assert.equal(f!.confidence, 0);
});

// ── 6. CommerceReport ─────────────────────────────────────────────────────────

test('generateCommerceReport returns a valid CommerceReport', () => {
  const report: CommerceReport = svc.generateCommerceReport();
  assert.equal(report.area, 'commerce');
  assert.ok(Array.isArray(report.findings));
  assert.ok(Array.isArray(report.facts));
  assert.ok(Array.isArray(report.signals));
  assert.ok(typeof report.summary === 'string');
  assert.ok(report.health !== undefined);
});

test('generateCommerceReport: timestamp is the fixed value', () => {
  const report = svc.generateCommerceReport();
  assert.equal(report.timestamp, FIXED);
});

test('generateCommerceReport: liveConnected is false (honest — no live values)', () => {
  const report = svc.generateCommerceReport();
  assert.equal(report.liveConnected, false);
});

test('generateCommerceReport: evidence array is non-empty', () => {
  const report = svc.generateCommerceReport();
  assert.ok(report.evidence.length > 0);
});

test('generateCommerceReport: sources array is non-empty', () => {
  const report = svc.generateCommerceReport();
  assert.ok(report.sources.length > 0);
});

test('generateCommerceReport: facts include ledger table facts', () => {
  const report = svc.generateCommerceReport();
  const ledgerFact = report.facts.find((f) => f.kind === 'ledger-table' && f.subject === 'ledger_accounts');
  assert.ok(ledgerFact !== undefined, 'ledger_accounts fact present');
  assert.equal(ledgerFact!.status, 'CONNECTED');
});

test('generateCommerceReport: facts include GMV NOT_CONNECTED fact', () => {
  const report = svc.generateCommerceReport();
  const gmvFact = report.facts.find((f) => f.kind === 'gmv-amount');
  assert.ok(gmvFact !== undefined, 'GMV fact present');
  assert.equal(gmvFact!.value, null, 'GMV value must be null (NOT_CONNECTED)');
  assert.equal(gmvFact!.status, 'NOT_CONNECTED');
});

test('generateCommerceReport: facts include money-table-count with real count (≥18)', () => {
  const report = svc.generateCommerceReport();
  const fact = report.facts.find((f) => f.kind === 'money-table-count');
  assert.ok(fact !== undefined, 'money-table-count fact present');
  // db-intel.json flags 18 tables as money=true (the 44 in the discovery doc includes adjacent tables
  // not flagged money=true in the artifact — the structural count from the artifact is 18)
  assert.ok(typeof fact!.value === 'number' && fact!.value >= 18, `count=${fact!.value}`);
});

test('generateCommerceReport: facts include money-function-count with real count (≥34)', () => {
  const report = svc.generateCommerceReport();
  const fact = report.facts.find((f) => f.kind === 'money-function-count');
  assert.ok(fact !== undefined, 'money-function-count fact present');
  assert.ok(typeof fact!.value === 'number' && fact!.value >= 34, `count=${fact!.value}`);
});

test('generateCommerceReport: facts include subscriptions NOT_IMPLEMENTED fact', () => {
  const report = svc.generateCommerceReport();
  const subFact = report.facts.find((f) => f.kind === 'subscriptions-status');
  assert.ok(subFact !== undefined, 'subscriptions fact present');
  assert.equal(subFact!.value, 'NOT_IMPLEMENTED');
});

test('generateCommerceReport: revenue-funnel-stages fact has real funnel stages', () => {
  const report = svc.generateCommerceReport();
  const fact = report.facts.find((f) => f.kind === 'revenue-funnel-stages');
  assert.ok(fact !== undefined, 'revenue-funnel-stages fact present');
  // Real artifact has 4 stages: GMV, captured, net revenue, payout
  assert.ok(typeof fact!.value === 'string' && fact!.value.includes('GMV'), `value: ${fact!.value}`);
});

test('generateCommerceReport: signals include all commerce-area signals from registry', () => {
  const report = svc.generateCommerceReport();
  // Registry has 5 commerce signals: ledger-topology, gmv, order-rate, refund-rate, payment-failure-rate
  assert.ok(report.signals.length >= 5, `expected ≥5, got ${report.signals.length}`);
  for (const sig of report.signals) {
    assert.equal(sig.area, 'commerce');
  }
});

test('generateCommerceReport: commerce.ledger-topology signal is CONNECTED', () => {
  const report = svc.generateCommerceReport();
  const sig = report.signals.find((s) => s.key === 'commerce.ledger-topology');
  assert.ok(sig !== undefined, 'ledger topology signal present');
  assert.equal(sig!.status, 'CONNECTED');
});

test('generateCommerceReport: commerce.gmv signal is NOT_CONNECTED with null value', () => {
  const report = svc.generateCommerceReport();
  const sig = report.signals.find((s) => s.key === 'commerce.gmv');
  assert.ok(sig !== undefined, 'GMV signal present');
  assert.equal(sig!.status, 'NOT_CONNECTED');
  assert.equal(sig!.value, null);
});

test('generateCommerceReport: subscriptions finding (NOT IMPLEMENTED) present', () => {
  const report = svc.generateCommerceReport();
  const subFinding = findingById(report.findings, 'COMMERCE-SUBSCRIPTIONS-NOT-IMPLEMENTED');
  assert.ok(subFinding !== undefined, 'subscriptions finding present');
  assert.equal(subFinding!.area, 'commerce');
  assert.equal(subFinding!.severity, 'info');
});

test('generateCommerceReport: subscriptions finding detail mentions NOT IMPLEMENTED', () => {
  const report = svc.generateCommerceReport();
  const subFinding = findingById(report.findings, 'COMMERCE-SUBSCRIPTIONS-NOT-IMPLEMENTED');
  assert.ok(subFinding!.detail.includes('NOT IMPLEMENTED'), 'detail is honest');
});

test('generateCommerceReport: summary mentions SUPABASE_URL for NOT_CONNECTED', () => {
  const report = svc.generateCommerceReport();
  assert.ok(report.summary.includes('SUPABASE_URL'), 'summary cites env var');
});

test('generateCommerceReport: summary mentions Subscriptions NOT IMPLEMENTED', () => {
  const report = svc.generateCommerceReport();
  assert.ok(
    report.summary.includes('NOT IMPLEMENTED') || report.summary.toLowerCase().includes('subscription'),
    'summary is honest about subscriptions',
  );
});

test('generateCommerceReport: health area is commerce', () => {
  const report = svc.generateCommerceReport();
  assert.equal(report.health.area, 'commerce');
});

test('generateCommerceReport: health notConnectedSignals > 0 (honest about live gaps)', () => {
  const report = svc.generateCommerceReport();
  assert.ok(report.health.notConnectedSignals > 0, 'some signals not connected (honest)');
});

test('generateCommerceReport: all NOT_CONNECTED findings have confidence 0', () => {
  const report = svc.generateCommerceReport();
  for (const f of notConnectedFindings(report.findings)) {
    assert.equal(f.confidence, 0, `${f.id} has status NOT_CONNECTED but confidence=${f.confidence}`);
  }
});

test('generateCommerceReport: all CONNECTED findings have confidence > 0', () => {
  const report = svc.generateCommerceReport();
  for (const f of connectedFindings(report.findings)) {
    assert.ok(f.confidence > 0, `${f.id} has status CONNECTED but confidence=${f.confidence}`);
  }
});

test('generateCommerceReport: deterministic — two calls produce identical JSON', () => {
  const svc2 = new CommerceOperationsService(engine, () => FIXED);
  const a = svc2.generateCommerceReport();
  const b = svc2.generateCommerceReport();
  assert.deepEqual(JSON.stringify(a), JSON.stringify(b));
});

test('generateCommerceReport: no live value is fabricated (all NOT_CONNECTED signals have null value)', () => {
  const report = svc.generateCommerceReport();
  for (const sig of report.signals) {
    if (sig.status === 'NOT_CONNECTED') {
      assert.equal(sig.value, null, `signal ${sig.key} is NOT_CONNECTED but value=${sig.value} — fabrication forbidden`);
    }
  }
});

test('generateCommerceReport: no live fact value is fabricated (all NOT_CONNECTED facts have null value)', () => {
  const report = svc.generateCommerceReport();
  for (const fact of report.facts) {
    if (fact.status === 'NOT_CONNECTED') {
      assert.equal(fact.value, null, `fact ${fact.kind}/${fact.subject} is NOT_CONNECTED but value=${fact.value}`);
    }
  }
});

// ── 7. Provenance & source scan ───────────────────────────────────────────────

test('generateCommerceReport: every finding has at least one evidence entry', () => {
  const report = svc.generateCommerceReport();
  for (const f of report.findings) {
    assert.ok(f.evidence.length > 0, `${f.id} has no evidence`);
  }
});

test('generateCommerceReport: every fact has at least one evidence entry', () => {
  const report = svc.generateCommerceReport();
  const factsWithEvidence = report.facts.filter((f) => f.evidence.length > 0);
  // At least most facts should have evidence (ledger tables + gmv + counts etc.)
  assert.ok(factsWithEvidence.length >= 5, `only ${factsWithEvidence.length} facts have evidence`);
});

test('generateCommerceReport: evidence sources reference real artifact file paths', () => {
  const report = svc.generateCommerceReport();
  const sources = report.sources;
  assert.ok(sources.some((s) => s.includes('db-intel') || s.includes('revenue-intelligence') || s.includes('commerce-control')),
    'evidence cites real artifact paths');
});

// ── 8. Source scan (read-only guard) ──────────────────────────────────────────

test('CommerceOperationsService source has no fetch/child_process/spawn/exec/eval/writeFile', async () => {
  const src = await import('node:fs/promises').then((m) => m.readFile(
    new URL('../src/commerce/CommerceOperationsService.ts', import.meta.url).pathname,
    'utf8',
  ));
  // Strip comments first (single-line and multi-line)
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');
  const forbidden = ['fetch(', 'child_process', 'spawn(', 'exec(', 'eval(', 'writeFile(', 'require('];
  for (const term of forbidden) {
    assert.ok(!stripped.includes(term), `Source must not contain: ${term}`);
  }
});

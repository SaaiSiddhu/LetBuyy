#!/usr/bin/env node
// LCIS Omega — Merchant Risk Engine (Phase 2). Risk MODEL over the real risk/kyc/billing tables;
// per-merchant risk scores are live rows (query-bound). Also surfaces the structural risk facts.
import { loadIntel, pickTables, tablesMatching, writeOut, LIVE, nowStamp } from './omega-lib.mjs';

export function buildMerchantRisk() {
  const { db } = loadIntel();
  if (!db) return { error: 'db-intel.json missing' };
  const dims = [
    { name: 'KYC completeness', signal: 'merchant KYC documents verified', sources: pickTables(db, ['merchant_kyc_documents', 'onboarding_attempts']) },
    { name: 'order risk', signal: 'risk-scored orders', sources: pickTables(db, ['order_risk_assessments', 'risk_scores', 'risk_signals', 'risk_rules', 'risk_action_events']) },
    { name: 'payment risk', signal: 'failed/abandoned payment ratio', sources: pickTables(db, ['payment_transactions', 'payment_attempts']) },
    { name: 'refund/chargeback', signal: 'refund-to-order ratio', sources: pickTables(db, ['refunds', 'refund_transactions', 'return_requests']) },
    { name: 'billing risk', signal: 'dunning / mandate failures', sources: pickTables(db, ['billing_dunning_events', 'billing_mandates', 'merchant_billing_invoices']) },
  ].filter((d) => d.sources.length);
  const detectors = {
    riskScore: { metric: 'composite 0-100 risk per site', source: 'risk_scores / order_risk_assessments by site_id', query: 'weighted over dimensions', value: LIVE },
    highRiskMerchants: { metric: 'sites above risk threshold', source: 'risk_scores by site_id', query: 'risk > threshold', value: LIVE },
    kycGaps: { metric: 'sites with incomplete KYC', source: 'merchant_kyc_documents', query: 'missing/expired docs', value: LIVE },
  };
  const structuralFindings = [
    { id: 'MR-1', finding: 'A full risk model exists in-schema (risk_rules → risk_signals → risk_scores → risk_action_events) plus order_risk_assessments.', evidence: tablesMatching(db, /risk/).join(', ') },
    { id: 'MR-2', finding: 'KYC is document-backed (merchant_kyc_documents) and gated at onboarding.', evidence: 'merchant_kyc_documents, onboarding_attempts' },
  ];
  return { summary: { dimensions: dims.length, riskTables: tablesMatching(db, /risk/).length, detectors: Object.keys(detectors).length, liveDataNote: 'Per-merchant risk scores are live rows in risk_scores/order_risk_assessments; the model is repository truth.', generatedAt: nowStamp(db) }, model: { dimensions: dims }, detectors, structuralFindings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = buildMerchantRisk(); writeOut('merchant-risk.json', i);
  if (i.error) { console.error(i.error); process.exit(1); }
  console.log('\nMerchant Risk Engine —', i.summary.dimensions, 'dimensions /', i.summary.riskTables, 'risk tables · scores query-bound → graphify-out/merchant-risk.json');
}

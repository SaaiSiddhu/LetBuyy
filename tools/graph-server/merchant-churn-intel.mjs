#!/usr/bin/env node
// LCIS Omega — Merchant Churn Engine (Phase 2). Churn-signal MODEL over real activity/billing tables.
import { loadIntel, pickTables, writeOut, LIVE, nowStamp } from './omega-lib.mjs';

export function buildMerchantChurn() {
  const { db } = loadIntel();
  if (!db) return { error: 'db-intel.json missing' };
  const signals = [
    { name: 'order inactivity', signal: 'no orders in N days', sources: pickTables(db, ['orders', 'checkout_sessions']) },
    { name: 'GMV decline', signal: 'sustained GMV drop', sources: pickTables(db, ['orders', 'ledger_entries']) },
    { name: 'subscription lapse', signal: 'cancelled/expired plan', sources: pickTables(db, ['subscriptions', 'plan_entitlements', 'site_entitlement_overrides']) },
    { name: 'billing failure', signal: 'dunning / failed mandate', sources: pickTables(db, ['billing_dunning_events', 'billing_mandates', 'merchant_billing_invoices']) },
    { name: 'login inactivity', signal: 'no merchant session in N days', sources: pickTables(db, ['sessions', 'site_memberships', 'store_memberships']) },
  ].filter((s) => s.sources.length);
  const detectors = {
    churnRisk: { metric: 'churn probability per site', source: signals.map((s) => s.sources[0]).join(', '), query: 'combine inactivity + billing failure + GMV decline', value: LIVE },
    churningMerchants: { metric: 'sites at high churn risk', source: 'orders + subscriptions + billing_dunning_events', query: 'churnRisk > threshold', value: LIVE },
    churnedMerchants: { metric: 'sites with cancelled subscription + no orders', source: 'subscriptions + orders', query: 'status=cancelled AND inactive', value: LIVE },
  };
  return { summary: { signals: signals.length, sourceTables: [...new Set(signals.flatMap((s) => s.sources))].length, detectors: Object.keys(detectors).length, liveDataNote: 'Churn probability requires live activity/billing time-series; the signal model is repository truth.', generatedAt: nowStamp(db) }, model: { signals }, detectors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = buildMerchantChurn(); writeOut('merchant-churn.json', i);
  if (i.error) { console.error(i.error); process.exit(1); }
  console.log('\nMerchant Churn Engine —', i.summary.signals, 'churn signals · probability query-bound → graphify-out/merchant-churn.json');
}

#!/usr/bin/env node
// LCIS Omega — Merchant Health Engine (Phase 2). Defines the merchant-health MODEL over real
// schema tables; the per-merchant health SCORE is computed from live site-scoped rows (query-bound).
import { loadIntel, tablesMatching, pickTables, writeOut, LIVE, nowStamp } from './omega-lib.mjs';

export function buildMerchantHealth() {
  const { db } = loadIntel();
  if (!db) return { error: 'db-intel.json missing — run pnpm graph:db' };
  const dims = [
    { name: 'order activity', weight: 0.25, signal: 'order volume + recency per site', sources: pickTables(db, ['orders', 'order_items', 'checkout_sessions']) },
    { name: 'payment success', weight: 0.25, signal: 'captured / attempted ratio', sources: pickTables(db, ['payment_transactions', 'payment_attempts']) },
    { name: 'fulfillment', weight: 0.2, signal: 'shipped / fulfilled ratio + SLA', sources: pickTables(db, ['fulfillment_orders', 'shipments', 'shipment_events']) },
    { name: 'data integrity', weight: 0.15, signal: 'RLS-protected tenant data, no ledger breaks', sources: pickTables(db, ['ledger_entries', 'money_ledger_site_reconciliations']) },
    { name: 'incidents', weight: 0.15, signal: 'open production incidents touching the site', sources: pickTables(db, ['production_incidents', 'production_incident_events']) },
  ].filter((d) => d.sources.length);
  const detectors = {
    healthScore: { metric: 'weighted 0-100 health per site_id', source: dims.map((d) => d.sources[0]).join(', '), query: 'aggregate per site_id over the dimensions above', value: LIVE },
    unhealthyMerchants: { metric: 'sites below health threshold', source: 'orders + payment_transactions by site_id', query: 'health < 60', value: LIVE },
  };
  const structuralFindings = [
    { id: 'MH-1', finding: 'Health is computable per site_id from the canonical tables — no per-merchant telemetry pipeline needed; one aggregation query yields it.', evidence: `dimensions backed by ${dims.flatMap((d) => d.sources).length} real tables` },
  ];
  return { summary: { dimensions: dims.length, sourceTables: [...new Set(dims.flatMap((d) => d.sources))].length, detectors: Object.keys(detectors).length, liveDataNote: 'Per-merchant health scores require live site-scoped rows; the model + query are repository truth, the values are query-bound.', generatedAt: nowStamp(db) }, model: { dimensions: dims }, detectors, structuralFindings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = buildMerchantHealth(); writeOut('merchant-health.json', i);
  if (i.error) { console.error(i.error); process.exit(1); }
  console.log('\nMerchant Health Engine —', i.summary.dimensions, 'dimensions /', i.summary.sourceTables, 'tables · scores query-bound → graphify-out/merchant-health.json');
}

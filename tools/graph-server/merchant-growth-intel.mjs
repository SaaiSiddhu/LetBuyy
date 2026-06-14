#!/usr/bin/env node
// LCIS Omega — Merchant Growth Engine (Phase 2). Growth MODEL over real tables; trends query-bound.
import { loadIntel, pickTables, writeOut, LIVE, nowStamp } from './omega-lib.mjs';

export function buildMerchantGrowth() {
  const { db } = loadIntel();
  if (!db) return { error: 'db-intel.json missing' };
  const dims = [
    { name: 'GMV trend', signal: 'sum(orders.total_minor) over time per site', sources: pickTables(db, ['orders', 'ledger_entries']) },
    { name: 'catalog growth', signal: 'new products published', sources: pickTables(db, ['products', 'product_options', 'collections']) },
    { name: 'repeat rate', signal: 'returning customers per site', sources: pickTables(db, ['store_customers', 'customer_activity_log', 'orders']) },
    { name: 'AOV', signal: 'avg order value trend', sources: pickTables(db, ['orders', 'order_items']) },
    { name: 'channel mix', signal: 'gift-card + promotion uptake', sources: pickTables(db, ['gift_card_accounts', 'promotion_redemptions']) },
  ].filter((d) => d.sources.length);
  const detectors = {
    growthRate: { metric: 'GMV MoM growth % per site', source: 'orders by site_id, monthly', query: 'window over orders.created_at', value: LIVE },
    growingMerchants: { metric: 'top sites by GMV growth', source: 'orders + ledger', query: 'rank by growth %', value: LIVE },
    stalledMerchants: { metric: 'flat/declining GMV', source: 'orders by site_id', query: 'growth <= 0', value: LIVE },
  };
  return { summary: { dimensions: dims.length, sourceTables: [...new Set(dims.flatMap((d) => d.sources))].length, detectors: Object.keys(detectors).length, liveDataNote: 'Growth trends require live time-series rows; model + queries are repository truth.', generatedAt: nowStamp(db) }, model: { dimensions: dims }, detectors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = buildMerchantGrowth(); writeOut('merchant-growth.json', i);
  if (i.error) { console.error(i.error); process.exit(1); }
  console.log('\nMerchant Growth Engine —', i.summary.dimensions, 'dimensions · trends query-bound → graphify-out/merchant-growth.json');
}

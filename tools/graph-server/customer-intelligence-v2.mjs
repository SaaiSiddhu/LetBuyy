#!/usr/bin/env node
// LCIS Omega — Customer Intelligence v2 (Phase 3). Eight customer graphs mapped to real tables;
// rates/counts are live analytics (query-bound). Funnel/conversion/refund/retention/risk/journey/
// abandonment/loyalty.
import { loadIntel, pickTables, writeOut, LIVE, nowStamp } from './omega-lib.mjs';

export function buildCustomerIntelligenceV2() {
  const { db } = loadIntel();
  if (!db) return { error: 'db-intel.json missing' };
  const T = (names) => pickTables(db, names);
  const graphs = {
    funnel:      { stages: ['view', 'product', 'cart', 'checkout', 'order'], sources: T(['analytics_event_stream', 'analytics_events', 'carts', 'checkout_sessions', 'orders']), metric: 'stage-to-stage conversion', value: LIVE },
    conversion:  { metric: 'sessions → orders ratio', sources: T(['sessions', 'checkout_sessions', 'orders', 'store_customers']), value: LIVE },
    refund:      { metric: 'orders → refunds rate per customer', sources: T(['orders', 'refunds', 'refund_transactions', 'return_requests']), value: LIVE },
    retention:   { metric: 'repeat purchase rate / cohort retention', sources: T(['store_customers', 'orders', 'customer_activity_log']), value: LIVE },
    risk:        { metric: 'customer fraud/risk score', sources: T(['order_risk_assessments', 'risk_scores', 'risk_signals']), value: LIVE },
    journey:     { metric: 'landing→payment→refund path (see /api/customer-intelligence v5)', sources: T(['analytics_event_stream', 'orders', 'shipments']), value: LIVE },
    abandonment: { metric: 'carts/checkouts not converted', sources: T(['carts', 'checkout_sessions', 'customer_wishlists']), value: LIVE },
    loyalty:     { metric: 'repeat + wishlist + gift-card balance', sources: T(['store_customers', 'customer_wishlists', 'gift_card_accounts', 'product_reviews']), value: LIVE },
  };
  const present = Object.fromEntries(Object.entries(graphs).map(([k, v]) => [k, v.sources.length]));
  return { summary: { graphs: Object.keys(graphs).length, graphsBacked: Object.values(present).filter(Boolean).length, liveDataNote: 'Funnel/conversion/refund/retention/abandonment RATES require live analytics (analytics_event_stream + orders); the graph model + sources are repository truth.', generatedAt: nowStamp(db) }, graphs };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = buildCustomerIntelligenceV2(); writeOut('customer-intelligence.json', i);
  if (i.error) { console.error(i.error); process.exit(1); }
  console.log('\nCustomer Intelligence v2 —', i.summary.graphs, 'graphs (', i.summary.graphsBacked, 'schema-backed) · rates query-bound → graphify-out/customer-intelligence.json');
}

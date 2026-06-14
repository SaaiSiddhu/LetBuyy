#!/usr/bin/env node
// LCIS Genesis — Commerce Control (Phase 4). EXTENDS merchant/customer/revenue/domain intelligence into
// one commerce view with the 6 journeys (merchant/customer/order/payment/refund/inventory). Pure
// composition. Live counts (merchants/GMV/conversion) are query-bound (NOT CONNECTED).
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;

const JOURNEYS = {
  merchant: ['Signup', 'Verification', 'Store Creation', 'Products', 'Inventory', 'Orders', 'Payouts'],
  customer: ['Landing', 'Browse', 'Product', 'Cart', 'Checkout', 'Payment', 'Order', 'Tracking', 'Refund'],
  order: ['Cart', 'Checkout', 'create_checkout_order', 'Inventory reserved', 'Fulfillment', 'Shipped', 'Delivered'],
  payment: ['Checkout', 'Razorpay/COD', 'Signature verify', 'confirm_order_payment_with_ledger', 'Ledger posted', 'Payout accrues'],
  refund: ['Return requested', 'Step-up HMAC', 'complete_order_refund', 'Ledger reversal', 'restore_gift_card_on_refund', 'Customer notified'],
  inventory: ['Stock set', 'Reserved at checkout', 'Decremented on fulfillment', 'Adjusted/transferred', 'Reconciled'],
};

export function buildCommerceControl() {
  const di = g('domain-intel.json'), merch = g('merchant-intelligence.json'), cust = g('customer-intelligence.json'), rev = g('revenue-intelligence-v2.json');
  if (!di) return { error: 'domain-intel.json missing — run pnpm graph:domain' };
  const COMMERCE = ['merchant', 'storefront', 'orders', 'products', 'collections', 'inventory', 'payments', 'refunds', 'payouts', 'gift-cards', 'discounts', 'gst', 'shipping', 'analytics'];
  const domains = COMMERCE.map((k) => { const d = di.domains.find((x) => x.key === k); return d ? { key: k, label: d.label, routes: d.counts.routes, rpcs: d.counts.rpcs, tables: d.counts.tables, money: d.money } : null; }).filter(Boolean);
  const liveMetrics = {
    merchants: { source: 'sites / orders by site_id (Supabase)', value: 'NOT CONNECTED' },
    gmv: { source: 'orders.total_minor / ledger (Supabase)', value: 'NOT CONNECTED' },
    conversion: { source: 'analytics_event_stream funnel (Supabase)', value: 'NOT CONNECTED' },
    customers: merch ? { source: 'store_customers (Supabase)', value: 'NOT CONNECTED' } : null,
  };
  const summary = {
    domains: domains.length, journeys: Object.keys(JOURNEYS).length,
    models: { merchant: !!merch, customer: !!cust, revenue: !!rev },
    liveNote: 'Commerce structure (domains, journeys, models) is repository truth; live counts (merchants/GMV/conversion/customers) are Supabase rows (query-bound — NOT CONNECTED).',
    generatedAt: di.summary.generatedAt,
  };
  return { summary, domains, journeys: JOURNEYS, liveMetrics };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildCommerceControl();
  if (intel.error) { console.error(intel.error); process.exit(1); }
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'commerce-control-intel.json'), JSON.stringify(intel));
  console.log('\nLCIS Genesis — Commerce Control —', intel.summary.domains, 'domains ·', intel.summary.journeys, 'journeys (merchant/customer/order/payment/refund/inventory)');
  console.log('  live counts query-bound (NOT CONNECTED) → graphify-out/commerce-control-intel.json');
}

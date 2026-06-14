#!/usr/bin/env node
// LCIS Omega — Revenue Intelligence v2 (Phase 4). Revenue funnel/attribution/dependency/leakage/
// refund-impact/gift-card-liability/payout-dependency/merchant-revenue, over the canonical ledger.
// Amounts are live ledger rows (query-bound). The gift-card liability concept and the ledger
// dependency graph are repository truth.
import { loadIntel, pickTables, rpcsMatching, writeOut, LIVE, nowStamp } from './omega-lib.mjs';

export function buildRevenueIntelligenceV2() {
  const { db, di } = loadIntel();
  if (!db) return { error: 'db-intel.json missing' };
  const T = (n) => pickTables(db, n);
  const R = (re) => rpcsMatching(db, re);

  const models = {
    funnel:        { stages: ['GMV', 'captured', 'net revenue', 'payout'], sources: T(['orders', 'payment_transactions', 'ledger_entries', 'payout_statements']), value: LIVE },
    attribution:   { metric: 'revenue by channel (promotion / gift-card / direct)', sources: T(['promotion_redemptions', 'gift_card_redemptions', 'orders']), value: LIVE },
    dependencyGraph:{ metric: 'domains feeding revenue', domains: di ? (di.domains.find((d) => d.key === 'payments')?.consumedBy.map((c) => c.domain) || []) : [], note: 'cross-domain consumers of payments' },
    leakageDetection:{ metric: 'orders captured without ledger posting', rpcs: R(/ledger_balance_breaks|reconcil|enforce_ledger/), value: LIVE },
    refundImpact:  { metric: 'refund → ledger reversal magnitude', sources: T(['refunds', 'refund_transactions', 'ledger_entries']), rpcs: R(/refund/), value: LIVE },
    giftCardLiability:{ metric: 'outstanding gift-card balance = unredeemed LIABILITY', sources: T(['gift_card_accounts', 'gift_card_ledger_entries', 'gift_card_redemptions']), rpcs: R(/gift_card_available_balance|issue_gift_card|restore_gift_card/), note: 'balance is a ledger projection (no mutable decrement) — sum of outstanding = liability', value: LIVE },
    payoutDependency:{ metric: 'payouts gated on settlement + commission', sources: T(['payout_statements', 'settlements', 'commission_schedules', 'partner_payout_ledger_entries']), rpcs: R(/payout|settle|commission/), value: LIVE },
    merchantRevenueDependency:{ metric: 'revenue per site_id (shared schema)', sources: T(['orders', 'ledger_entries']), note: 'every site shares one ledger; site_id partitions revenue', value: LIVE },
  };
  return { summary: { models: Object.keys(models).length, moneyRpcs: db.summary.moneyFunctions, giftCardLiabilityModeled: !!models.giftCardLiability.sources.length, liveDataNote: 'All revenue AMOUNTS (GMV, net, refund value, gift-card liability, payouts) are live ledger rows — run the named reconciliation/balance RPCs. The models + dependency graph are repository truth.', generatedAt: nowStamp(db) }, models };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = buildRevenueIntelligenceV2(); writeOut('revenue-intelligence-v2.json', i);
  if (i.error) { console.error(i.error); process.exit(1); }
  console.log('\nRevenue Intelligence v2 —', i.summary.models, 'models · gift-card liability modeled:', i.summary.giftCardLiabilityModeled, '· amounts query-bound → graphify-out/revenue-intelligence-v2.json');
}

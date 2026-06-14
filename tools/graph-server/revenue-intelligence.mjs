#!/usr/bin/env node
// LetBuyy Revenue Intelligence (LCIS v5, Phase 4) — the money MODEL over the canonical ledger:
// Revenue ← Orders → Payments → Ledger → Payouts; Refunds; Gift Cards; GST. Plus the
// leak/anomaly DETECTORS (the reconciliation RPCs) and the STRUCTURAL high-risk-path finding.
//
// HONESTY: revenue/refund AMOUNTS are live ledger rows, NOT in the repo. This engine names the
// exact reconciliation RPC for each leak/anomaly check, and computes the one structural risk that
// IS repository truth: money RPCs that are not idempotent or not row-locked. No money figures invented.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;

export function buildRevenueIntelligence() {
  const db = g('db-intel.json');
  if (!db) return { error: 'db-intel.json missing — run pnpm graph:db' };
  const fns = db.functions;
  const moneyFns = fns.filter((f) => f.money);
  const has = (re) => fns.filter((f) => re.test(f.name)).map((f) => f.name);

  // The money flow map (real tables/RPCs).
  const flow = {
    revenue:   { tables: ['orders', 'order_items', 'payment_transactions'], rpcs: has(/create_checkout_order|confirm_order_payment/) },
    refunds:   { tables: db.tables.filter((t) => /refund|return/.test(t.name)).map((t) => t.name), rpcs: has(/refund|return/) },
    giftCards: { tables: db.tables.filter((t) => /gift_card/.test(t.name)).map((t) => t.name), rpcs: has(/gift_card/) },
    payouts:   { tables: db.tables.filter((t) => /payout|settlement|commission/.test(t.name)).map((t) => t.name), rpcs: has(/payout|settle|commission/) },
    ledger:    { tables: db.tables.filter((t) => /ledger/.test(t.name)).map((t) => t.name), rpcs: has(/ledger/) },
    gst:       { tables: db.tables.filter((t) => /tax|gst|invoice/.test(t.name)).map((t) => t.name), rpcs: has(/tax|gst|invoice/) },
  };

  // Leak / anomaly detectors — the reconciliation RPCs ARE the detectors (values query-bound).
  const detectors = {
    revenueLeaks:    { check: 'orders captured without a matching ledger posting', rpc: has(/ledger_balance_breaks|reconcil/), value: 'live-query-required' },
    refundAnomalies: { check: 'refunds exceeding captured amount / orphan refunds', rpc: has(/refund/), value: 'live-query-required' },
    unbalancedFlows: { check: 'double-entry sum != 0 for a ledger_transaction', rpc: has(/enforce_ledger_transaction_balance|ledger_balance_breaks|post_ledger_transaction/), value: 'live-query-required' },
    siteReconciliation: { check: 'per-site ledger balance drift', rpc: has(/refresh_money_ledger_site_reconciliation|resolve_money_ledger_source_site_id/), value: 'live-query-required' },
  };

  // STRUCTURAL high-risk money paths — repository truth (computable now).
  const highRiskPaths = moneyFns
    .filter((f) => !f.hasIdempotency || !f.forUpdate || !f.securityDefiner)
    .map((f) => ({ rpc: f.name, securityDefiner: f.securityDefiner, idempotency: f.hasIdempotency, forUpdate: f.forUpdate,
      why: [!f.securityDefiner && 'not SECURITY DEFINER', !f.hasIdempotency && 'no idempotency_key', !f.forUpdate && 'no FOR UPDATE lock'].filter(Boolean).join(', ') }));

  const summary = {
    moneyRpcs: moneyFns.length,
    moneyTables: db.summary.moneyTablesPresent.length,
    canonicalMutationRpcs: moneyFns.filter((f) => f.securityDefiner && f.hasIdempotency && f.forUpdate).length,
    highRiskPaths: highRiskPaths.length,
    balanceInvariant: 'append-only double-entry; enforce_ledger_transaction_balance + ledger_balance_breaks; balances CHECK >= 0',
    liveDataNote: 'Revenue/refund/payout AMOUNTS are live ledger rows — run the named reconciliation RPCs against production. The repo holds the model + the high-risk-path structural analysis.',
    note: 'high-risk paths are money-touching functions missing SD/idempotency/row-lock — many are reconciliation/backfill/projection helpers (not user-callable mutations); canonical-ledger-only-validator is authoritative.',
    generatedAt: db.summary.generatedAt,
  };
  return { summary, flow, detectors, highRiskPaths: highRiskPaths.slice(0, 40) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildRevenueIntelligence();
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'revenue-intelligence.json'), JSON.stringify(intel));
  if (intel.error) { console.error(intel.error); process.exit(1); }
  const s = intel.summary;
  console.log('\nLetBuyy Revenue Intelligence (LCIS v5)');
  console.log(`  money RPCs ${s.moneyRpcs} (canonical mutations ${s.canonicalMutationRpcs}) · money tables ${s.moneyTables}`);
  console.log(`  high-risk money paths (no SD/idem/lock): ${s.highRiskPaths} — ${s.note.slice(0, 60)}…`);
  console.log(`  ⚠ ${s.liveDataNote.slice(0, 90)}…`);
  console.log(`  → graphify-out/revenue-intelligence.json\n`);
}

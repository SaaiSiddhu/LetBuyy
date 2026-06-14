#!/usr/bin/env node
// LetBuyy Merchant Intelligence (LCIS v5, Phase 3) — the merchant operating MODEL
// Merchant → Products → Orders → Payments → Refunds → Payouts → Gift Cards → Revenue
//          → Domains → Deployments → Incidents, with the detection queries for
// top / inactive / broken / high-risk merchants and revenue concentration.
//
// HONESTY: which merchants are top/inactive/broken and their revenue are LIVE production
// rows (site-scoped), NOT in the repo. This engine defines each detector with the exact
// table/RPC to query, and surfaces the STRUCTURAL facts (single-tenant schema = single point
// of dependency; tenant/money table counts) that are repository truth. No merchant data invented.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;

const STAGES = ['merchant', 'products', 'orders', 'payments', 'refunds', 'payouts', 'gift-cards', 'analytics', 'storefront', 'themes'];

export function buildMerchantIntelligence() {
  const di = g('domain-intel.json'), db = g('db-intel.json');
  if (!di || !db) return { error: 'domain-intel.json / db-intel.json missing — run pnpm graph:domain && graph:db' };
  const byKey = Object.fromEntries(di.domains.map((d) => [d.key, d]));
  const table = (n) => db.tables.find((t) => t.name === n);

  const operating = STAGES.map((k) => {
    const d = byKey[k]; if (!d) return null;
    return { stage: d.label, key: k, apps: d.apps, tables: d.tables.length,
      tenantTables: d.tables.filter((t) => table(t)?.tenant).length, money: d.money };
  }).filter(Boolean);

  // Detectors — each names the live source; value is query-bound (never fabricated).
  const detectors = {
    topMerchants:        { metric: 'orders + GMV per site_id', source: 'orders (site_id, total_minor) / site_usage_meters', query: 'SELECT site_id, count(*), sum(total_minor) FROM orders GROUP BY 1 ORDER BY 3 DESC', value: 'live-query-required' },
    inactiveMerchants:   { metric: 'no orders in N days', source: 'orders.created_at by site_id', query: 'sites with max(orders.created_at) < now()-interval', value: 'live-query-required' },
    brokenMerchants:     { metric: 'orders present but payment_transactions failing', source: 'payment_transactions.status by site_id', query: 'sites with failed/abandoned payment ratio high', value: 'live-query-required' },
    highRiskMerchants:   { metric: 'order_risk / kyc gaps', source: 'order_risk_*, kyc tables, risk domain', query: 'risk-scored sites', value: 'live-query-required' },
    revenueConcentration:{ metric: 'GMV share of top-k sites', source: 'orders + ledger by site_id', query: 'top-k GMV / total GMV', value: 'live-query-required' },
  };

  // STRUCTURAL findings — repository truth.
  const tenantTables = db.tables.filter((t) => t.tenant).length;
  const findings = [
    { id: 'M-1', severity: 'structural', finding: 'Single-tenant shared schema + single deploy: every merchant shares the same Postgres schema, the same Workers, and the same Vercel apps. This is a SINGLE POINT OF DEPENDENCY — one bad migration or worker deploy affects ALL merchants simultaneously.', evidence: `${tenantTables} tenant tables (site_id/store_id); isolation is RLS + verifySiteOwnership, not physical separation; 1 deploy pipeline (production-deploy.yml).` },
    { id: 'M-2', severity: 'structural', finding: 'Per-merchant behavior is feature-flag driven, not code-forked.', evidence: 'operational_feature_flags / operational_feature_flag_audit_events — flags toggle features per site without separate code paths.' },
    { id: 'M-3', severity: 'info', finding: 'Merchant money is isolated per site_id in the canonical ledger.', evidence: 'ledger_entries/ledger_transactions carry site_id; resolve_money_ledger_source_site_id + refresh_money_ledger_site_reconciliation reconcile per-site balances.' },
  ];

  const summary = {
    operatingStages: operating.length,
    tenantTables,
    moneyStages: operating.filter((o) => o.money).map((o) => o.key),
    detectors: Object.keys(detectors).length,
    singlePointOfDependency: true,
    liveDataNote: 'Top/inactive/broken/high-risk merchants and revenue concentration require live site-scoped rows — query the sources named per detector. The repo holds the MODEL + the queries, not the merchant data.',
    generatedAt: db.summary.generatedAt,
  };
  return { summary, operating, detectors, findings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildMerchantIntelligence();
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'merchant-intelligence.json'), JSON.stringify(intel));
  if (intel.error) { console.error(intel.error); process.exit(1); }
  const s = intel.summary;
  console.log('\nLetBuyy Merchant Intelligence (LCIS v5)');
  console.log(`  operating stages ${s.operatingStages} · tenant tables ${s.tenantTables} · detectors ${s.detectors}`);
  console.log(`  single point of dependency: ${s.singlePointOfDependency} (shared schema + single deploy)`);
  console.log(`  ⚠ ${s.liveDataNote.slice(0, 90)}…`);
  console.log(`  → graphify-out/merchant-intelligence.json\n`);
}

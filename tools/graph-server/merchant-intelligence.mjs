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

// Founding Merchant Program intelligence. STRUCTURAL model + flows are repository
// truth (CONNECTED). Live counts/revenue/conversion are NOT CONNECTED — each names its
// exact live source. Never fabricates a slot count or revenue figure.
function buildFoundingProgram(db) {
  const has = (n) => Boolean((db.tables || []).find((t) => t.name === n));
  const expected = ['founding_merchant_program', 'founding_merchant_allocations', 'pricing_snapshots'];
  const present = expected.filter(has);
  return {
    purpose: 'The first 100 paying merchants get a lifetime price lock. Scarcity drives V1 conversion; the lock rewards early-adopter risk.',
    capacity: { total: 100, public: 70, invited: 20, partner: 10 },
    owner: 'DB + payments route: @saai-sidd (CODEOWNERS). Pricing logic: @letbuyy/billing-core (resolveMerchantPricing) + resolve_merchant_locked_price RPC.',
    allocationFlow: {
      chokepoint: 'SubscriptionExecutionAdapter.activateMerchantSubscription() → allocate_founding_merchant() RPC (single chokepoint, all paid paths)',
      eligibility: "subscriptions.status='active' AND amount_paid>0 AND sites.trial_status='paid'",
      raceSafety: 'SELECT … FOR UPDATE on the founding_merchant_program singleton; idempotent via partial unique index (site_id WHERE released_at IS NULL); cap enforced by CHECK (used_slots <= total_slots).',
      nonFatal: 'allocation failure / program-full never rolls back the paid subscription.',
      source: 'docs/v1/FOUNDING_ALLOCATION_DEFINITION.md',
    },
    reclaimFlow: {
      trigger: 'Razorpay subscription-refund webhook → reclaim_founding_merchant()',
      policy: 'refund ≤14 days → release slot + clear price lock + decrement counters + emit founding_slot_reclaimed; >14 days → retained as a historical founder, slot stays consumed.',
      source: 'docs/v1/PRICE_LOCK_VERIFICATION.md',
    },
    priceLockFlow: {
      guarantee: 'I1: founders are never charged catalog price. I2: future catalog price changes never affect existing founders.',
      mechanism: 'applyFoundingLockToPlan + resolveMerchantPricing at every charge site; founders forced to server-authoritative order/mandate mode (razorpay_plan_id nulled).',
      source: 'docs/v1/PRICE_LOCK_ARCHITECTURE.md',
    },
    pools: { PUBLIC: 70, INVITED: 20, PARTNER: 10, note: 'source resolved from sites.intended_allocation_source (else PUBLIC); per-pool caps enforced in allocate_founding_merchant.' },
    tables: { expected, present, structuralConnected: present.length === expected.length, hint: present.length === expected.length ? null : 'run pnpm graph:db after migrations 176-178 to index founding tables' },
    rpcs: ['allocate_founding_merchant', 'reclaim_founding_merchant', 'get_founding_program_public', 'set_founding_program_state', 'resolve_merchant_locked_price', 'reconcile_founding_program', 'admin_repair_price_lock'],
    events: ['founding_slot_allocated', 'founding_slot_reclaimed', 'founding_program_full', 'founding_program_paused', 'merchant_price_locked', 'merchant_upgraded'],
    counterIntegrity: 'remaining_slots is a GENERATED column (total_slots - used_slots); reconcile_founding_program() compares counters vs COUNT(active allocations) and reports healthy|mismatch|repaired.',
    liveMetrics: {
      remainingSlots: { connected: false, source: 'GET /v1/founding-program/remaining (get_founding_program_public)' },
      allocated: { connected: false, source: 'COUNT(founding_merchant_allocations WHERE released_at IS NULL)' },
      conversionRate: { connected: false, source: 'paid activations → allocations (live ledger + founding_merchant_allocations)' },
      revenueDistribution: { connected: false, source: 'subscriptions.amount_paid grouped by founder vs non-founder (live, site-scoped)' },
      planDistribution: { connected: false, source: 'founding_merchant_allocations.plan_slug GROUP BY (live)' },
      lifetimeDiscountLiability: { connected: false, source: 'sum(regular - locked) per active founder per month (live)' },
    },
    answers: {
      'how many founding slots remain': 'structural cap 100 CONNECTED; live remaining is NOT CONNECTED here — GET /v1/founding-program/remaining.',
      'how are founding slots allocated': 'allocate_founding_merchant() at the activation chokepoint, race-safe + idempotent (see allocationFlow).',
      'who owns founding pricing logic': '@letbuyy/billing-core + resolve_merchant_locked_price; DB owned by @saai-sidd.',
      'how does renewal pricing work': 'resolveMerchantPricing/applyFoundingLockToPlan at every charge site; founders billed via order/mandate mode at the locked price.',
      'how does refund reclaim work': '≤14-day refund → reclaim_founding_merchant() from the subscription-refund webhook (see reclaimFlow).',
      'what breaks if allocation fails': 'nothing customer-facing — allocation is non-fatal + idempotent; the paid subscription is unaffected; reconcile_founding_program() backstops drift.',
      'what systems depend on plan pricing': 'checkout + renewal + marketing pricing page + entitlement resolution; FOUNDERS ARE EXCLUDED (locked snapshot on sites/allocations).',
    },
  };
}

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

  // V7 — merchant lifecycle state machine (states are computed from live site-scoped rows; the
  // model + the SQL signal per transition are repository truth).
  const lifecycle = {
    states: ['Created', 'Activated', 'First Product', 'First Order', 'First Revenue', 'Active', 'At Risk', 'Churned'],
    transitions: [
      { state: 'Created', signal: 'sites row exists', source: 'sites' },
      { state: 'Activated', signal: 'onboarding complete + store published', source: 'onboarding_attempts, sites.status' },
      { state: 'First Product', signal: 'first products row', source: 'products' },
      { state: 'First Order', signal: 'first orders row', source: 'orders' },
      { state: 'First Revenue', signal: 'first captured payment_transactions', source: 'payment_transactions, ledger_entries' },
      { state: 'Active', signal: 'orders within trailing window', source: 'orders.created_at' },
      { state: 'At Risk', signal: 'declining orders + billing dunning', source: 'orders, billing_dunning_events, subscriptions' },
      { state: 'Churned', signal: 'subscription cancelled + inactive', source: 'subscriptions, orders' },
    ],
    funnels: {
      activation: { steps: ['Created', 'Activated', 'First Product', 'First Order', 'First Revenue'], metric: 'count + conversion per step (per site_id)', value: 'live-query-required' },
      retention: { steps: ['First Revenue', 'Active', 'At Risk', 'Churned'], metric: 'cohort retention over trailing windows', value: 'live-query-required' },
    },
    note: 'Per-merchant CURRENT state + funnel counts require live site rows; the 8-state machine + each transition signal/source are repository truth.',
  };
  const foundingProgram = buildFoundingProgram(db);
  const summary = {
    operatingStages: operating.length,
    tenantTables,
    moneyStages: operating.filter((o) => o.money).map((o) => o.key),
    detectors: Object.keys(detectors).length,
    lifecycleStates: lifecycle.states.length,
    singlePointOfDependency: true,
    foundingProgram: { capacity: foundingProgram.capacity.total, structuralConnected: foundingProgram.tables.structuralConnected, liveMetrics: 'NOT CONNECTED (see foundingProgram.liveMetrics for exact sources)' },
    liveDataNote: 'Top/inactive/broken/high-risk merchants, lifecycle state and revenue concentration require live site-scoped rows — query the sources named per detector/transition. The repo holds the MODEL + the queries, not the merchant data.',
    generatedAt: db.summary.generatedAt,
  };
  return { summary, operating, detectors, findings, lifecycle, foundingProgram };
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

#!/usr/bin/env node
// LCIS Omega — Cost Intelligence (Phase 5). Maps each platform service to its REAL pricing MODEL
// (published list pricing as a reference rate + free tier + the cost formula). Usage is LIVE
// (query-bound) — total cost = rate × usage is therefore query-bound. NOTHING fabricated:
// rates are published-list reference values (confirm current provider pricing); usage is never invented.
import { loadIntel, writeOut, LIVE, nowStamp } from './omega-lib.mjs';

// Published list-pricing REFERENCE (confirm against current provider pricing pages).
// usageMetric is the live driver; source = where the usage count comes from (query-bound).
const PRICING = [
  { service: 'Cloudflare Workers (requests)', unit: 'million requests', freeTier: '100k req/day', listRate: '$0.30 / million (after $5/mo Paid plan incl 10M)', usageMetric: 'request count', source: 'Analytics Engine / RUNTIME_TELEMETRY' },
  { service: 'Workers KV', unit: 'reads/writes + GB-mo', freeTier: '100k reads/day', listRate: '$0.50/million reads, $5/million writes, $0.50/GB-mo', usageMetric: 'kv ops + storage', source: 'Cloudflare dashboard' },
  { service: 'R2 (object storage)', unit: 'GB-mo + ops', freeTier: '10GB-mo, zero egress', listRate: '$0.015/GB-mo storage, $4.50/million Class A ops, egress FREE', usageMetric: 'GB stored + ops', source: 'Cloudflare R2 metrics' },
  { service: 'Cloudflare Queues', unit: 'million operations', freeTier: '1M ops/mo', listRate: '$0.40 / million operations', usageMetric: 'queue ops', source: 'Cloudflare Queues metrics' },
  { service: 'Analytics Engine', unit: 'data points + queries', freeTier: 'included', listRate: 'per data point written / read', usageMetric: 'telemetry write volume', source: 'RUNTIME_TELEMETRY dataset' },
  { service: 'Hyperdrive', unit: 'connection pooling', freeTier: 'included on Workers Paid', listRate: 'no extra per-query (pooling)', usageMetric: 'connections', source: 'Cloudflare Hyperdrive' },
  { service: 'Vercel', unit: 'seats + bandwidth + functions', freeTier: 'Hobby', listRate: '$20/seat/mo Pro + usage (bandwidth, fn-GB-hr, image opt)', usageMetric: 'seats + bandwidth + fn invocations', source: 'Vercel usage' },
  { service: 'Supabase (Postgres)', unit: 'compute + storage + egress', freeTier: 'Free (limited)', listRate: '$25/mo Pro + compute add-ons + $0.125/GB storage + egress', usageMetric: 'db size + compute + egress', source: 'Supabase usage / db size' },
  { service: 'Resend (email)', unit: 'emails', freeTier: '3k/mo', listRate: '$20/mo for 50k, then per-email', usageMetric: 'emails sent', source: 'Resend API / NOTIFICATION_QUEUE volume' },
  { service: 'Razorpay (payments)', unit: '% of transaction value', freeTier: '—', listRate: '~2% per captured transaction (India standard; confirm plan)', usageMetric: 'captured GMV', source: 'payment_transactions / ledger (live GMV)' },
];

export function buildCostIntelligence() {
  const { db, infra } = loadIntel();
  // cost dependency graph: usage driver → service → what scales it
  const dependencyGraph = PRICING.map((p) => ({ service: p.service, driver: p.usageMetric, scalesWith:
    /request|queue|telemetry|connection/.test(p.usageMetric) ? 'concurrent users / traffic'
    : /GMV/.test(p.usageMetric) ? 'order volume (revenue)'
    : /email/.test(p.usageMetric) ? 'orders + lifecycle sends'
    : /db|storage|GB/.test(p.usageMetric) ? 'data growth (merchants × catalog × orders)' : 'usage' }));

  const forecastEngine = { formula: 'monthlyCost = Σ_service (listRate × liveUsage)  −  freeTierAllowance',
    note: 'liveUsage is query-bound per the source column; this engine supplies the rate model + formula, not invented usage.' };

  // hotspot detector — which driver dominates as scale grows (structural reasoning, not a $ figure)
  const hotspots = [
    { rank: 1, service: 'Razorpay', why: 'fees are ~2% of GMV — grows linearly with revenue and is usually the largest line at scale', lever: 'negotiate MDR; route COD off-gateway' },
    { rank: 2, service: 'Supabase Postgres', why: 'single shared DB compute + storage scales with merchants×orders×catalog', lever: 'read replicas, projections, partitioning (hot-table-partition-maintenance)' },
    { rank: 3, service: 'Cloudflare Workers + Queues', why: 'request + queue ops scale with concurrent users; cheap per-unit but unbounded', lever: 'cache (CACHE binding), batch queue consumers' },
    { rank: 4, service: 'Vercel bandwidth', why: 'storefront traffic egress', lever: 'CDN cache hit-rate, image optimization' },
  ];

  const scalingModel = {
    drivers: { merchants: 'DB storage + compute + onboarding emails', concurrentUsers: 'Workers requests + Queue ops + Hyperdrive connections + Vercel bandwidth', gmv: 'Razorpay fees + ledger rows' },
    note: 'Concrete monthly figures require live usage (request counts, GB stored, GMV) — query the sources above. The repo supplies the rate model + dependency graph + hotspot ranking, never fabricated totals.',
  };

  return { summary: { services: PRICING.length, hotspots: hotspots.length, totalCost: LIVE,
    liveDataNote: 'Usage is query-bound; rates are published-list reference (confirm current). Total cost = rate × usage is therefore query-bound — no usage or total is fabricated.',
    generatedAt: nowStamp(db) }, pricing: PRICING, dependencyGraph, forecastEngine, hotspots, scalingModel };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = buildCostIntelligence(); writeOut('cost-intelligence.json', i);
  console.log('\nCost Intelligence —', i.summary.services, 'services priced (reference) · usage + totals query-bound');
  console.log('  top hotspot:', i.hotspots[0].service, '—', i.hotspots[0].why.slice(0, 60));
  console.log('  → graphify-out/cost-intelligence.json');
}

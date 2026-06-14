#!/usr/bin/env node
// LetBuyy Customer Journey Intelligence (LCIS v5, Phase 8) — maps Landing → Product → Cart →
// Checkout → Payment → Order → Tracking → Refund onto domains, and flags each stage's
// failure points / risk points / external dependencies (structural — dropoff RATES are live analytics).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;

const JOURNEY = [
  { stage: 'Landing', domains: ['storefront'], external: ['CDN/Vercel'], risk: 'low' },
  { stage: 'Product', domains: ['products', 'collections'], external: ['SEARCH_QUEUE'], risk: 'low' },
  { stage: 'Cart', domains: ['orders'], external: [], risk: 'medium' },
  { stage: 'Checkout', domains: ['orders', 'discounts', 'gst', 'shipping'], external: ['shipping rate providers'], risk: 'high' },
  { stage: 'Payment', domains: ['payments', 'gift-cards'], external: ['Razorpay (HMAC)'], risk: 'critical' },
  { stage: 'Order', domains: ['orders', 'inventory'], external: ['RUNTIME_QUEUE'], risk: 'high' },
  { stage: 'Tracking', domains: ['shipping', 'notifications'], external: ['Resend', 'shipment events'], risk: 'medium' },
  { stage: 'Refund', domains: ['refunds'], external: ['Razorpay refund + step-up'], risk: 'critical' },
];

export function buildCustomerJourneyIntelligence() {
  const di = g('domain-intel.json'), db = g('db-intel.json');
  if (!di) return { error: 'domain-intel.json missing — run pnpm graph:domain' };
  const byKey = Object.fromEntries(di.domains.map((d) => [d.key, d]));
  const stages = JOURNEY.map((s) => {
    const ds = s.domains.map((k) => byKey[k]).filter(Boolean);
    const money = ds.some((d) => d.money);
    const tables = [...new Set(ds.flatMap((d) => d.tables))];
    return {
      stage: s.stage, domains: s.domains, risk: s.risk, money,
      routes: [...new Set(ds.flatMap((d) => d.routes))], tables: tables.length, rpcs: [...new Set(ds.flatMap((d) => d.rpcs))].length,
      externalDependencies: s.external,
      failurePoints: [money && 'payment-provider failure', s.external.length && `external dependency: ${s.external.join(', ')}`, s.risk === 'critical' && 'money/ledger consistency'].filter(Boolean),
      dropoffMetric: 'live analytics (analytics_event_stream / funnel) — not in repo',
    };
  });
  const summary = {
    stages: stages.length, funnel: JOURNEY.map((s) => s.stage),
    criticalStages: stages.filter((s) => s.risk === 'critical').map((s) => s.stage),
    externalDependencies: [...new Set(JOURNEY.flatMap((s) => s.external))],
    dropoffNote: 'Dropoff/conversion RATES require live funnel analytics (analytics_event_stream) — the repo holds the journey structure + failure/risk points, not the rates.',
    generatedAt: di.summary.generatedAt,
  };
  return { summary, stages };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildCustomerJourneyIntelligence();
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'customer-journey-intelligence.json'), JSON.stringify(intel));
  if (intel.error) { console.error(intel.error); process.exit(1); }
  const s = intel.summary;
  console.log('\nLetBuyy Customer Journey Intelligence (LCIS v5)');
  console.log(`  ${s.funnel.join(' → ')}`);
  console.log(`  critical stages: ${s.criticalStages.join(', ')} · external deps: ${s.externalDependencies.join(', ')}`);
  console.log(`  → graphify-out/customer-journey-intelligence.json\n`);
}

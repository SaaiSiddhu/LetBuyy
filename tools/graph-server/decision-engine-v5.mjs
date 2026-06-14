#!/usr/bin/env node
// LetBuyy AI Decision Engine (LCIS v5, Phase 10) — ranks what to fix next / highest risk /
// what blocks launch / scale / 100 merchants / 10k / 100k users, from the REAL open blockers
// (V1 blocker report), the readiness scores, and the STRUCTURAL scale levers. Scale limits are
// framed as levers + known platform limits — concrete capacity numbers require load tests (not fabricated).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExecutionIntel } from './execution-intel.mjs';
import { buildProductionReadiness } from './production-readiness-intel.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;
const SEV = (s) => /🔴|critical/i.test(s) ? 3 : /🟠/.test(s) ? 2 : /🟡/.test(s) ? 1 : 0;

export function buildDecisionEngine() {
  const ex = buildExecutionIntel();
  const pr = buildProductionReadiness();
  const rev = g('revenue-intelligence.json');
  const sec = g('security-intelligence-v5.json');
  const merch = g('merchant-intelligence.json');

  const open = ex.blockers.filter((b) => !/done|resolved|complete|hidden|fixed/i.test(b.status))
    .sort((a, b) => SEV(b.severity) - SEV(a.severity));

  const fixNext = open.map((b, i) => ({ rank: i + 1, id: b.id, severity: b.severity, title: b.title, status: b.status }));

  const highestRisk = [
    ...open.filter((b) => SEV(b.severity) >= 2).map((b) => ({ type: 'blocker', ref: b.id, detail: b.title, severity: b.severity })),
    ...(rev ? [{ type: 'money', ref: 'high-risk-paths', detail: `${rev.summary.highRiskPaths} money fns without SD/idem/lock (mostly reconciliation helpers — verify)`, severity: '🟠' }] : []),
    ...(sec ? [{ type: 'tenant', ref: 'cross-tenant', detail: `${sec.summary.crossTenantCandidates} tenant tables without detected RLS (candidate)`, severity: '🟠' }] : []),
    ...(merch ? [{ type: 'spof', ref: 'M-1', detail: 'single shared schema + single deploy = all-merchant blast radius', severity: '🟠' }] : []),
  ];

  const blocksLaunch = { verdict: ex.summary.launchVerdict, blockers: open.map((b) => `${b.id} (${b.severity}): ${b.title}`) };

  const blocksScale = {
    blocks100Merchants: [
      'Merchant onboarding/registration completeness (LB-12 shopper registration is open)',
      'Lifecycle emails (LB-10) for merchant/customer comms',
      'Per-merchant feature flags exist (operational_feature_flags) — fine to 100; shared schema is not the bottleneck at this scale',
    ],
    blocks10kUsers: [
      'Postgres connection ceiling behind one Hyperdrive binding — pool sizing + read projections are the lever',
      'RLS evaluation overhead on hot tenant tables (orders, products) — index + projection coverage',
      'Queue throughput (EVENT/ANALYTICS/SEARCH/NOTIFICATION/RUNTIME) — Cloudflare Queues batch size + consumer concurrency',
    ],
    blocks100kConcurrentUsers: [
      'Single Supabase Postgres is the platform SPOF — needs read replicas / projection stores / partitioning (hot-table-partition-maintenance exists as a seam)',
      'Worker CPU-time (50ms) + 128MB isolate limits on the hottest gateway routes — measure with RUNTIME_TELEMETRY first',
      'Hyperdrive connection multiplexing limits; storefront cache (CACHE binding) hit-rate',
      'NOTE: concrete capacity numbers require a load test against staging — not derivable from the repo. These are the levers + known platform limits, not fabricated thresholds.',
    ],
  };

  const summary = {
    launchVerdict: ex.summary.launchVerdict, overallReadiness: pr.summary.overall,
    fixNextCount: fixNext.length, highestRiskCount: highestRisk.length,
    topPriority: fixNext[0] ? `${fixNext[0].id}: ${fixNext[0].title}` : 'none open',
    lowestReadiness: pr.summary.lowest,
    note: 'Ranking is derived from the real V1 blocker report + structural readiness + scale levers. Scale thresholds need a load test (not fabricated).',
    generatedAt: ex.summary.generatedAt,
  };
  return { summary, fixNext, highestRisk, blocksLaunch, blocksScale };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildDecisionEngine();
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'decision-engine.json'), JSON.stringify(intel));
  console.log('\nLetBuyy AI Decision Engine (LCIS v5)');
  console.log(`  launch verdict ${intel.summary.launchVerdict} · overall readiness ${intel.summary.overallReadiness}%`);
  console.log(`  fix next #1: ${intel.summary.topPriority}`);
  console.log(`  fix order: ${intel.fixNext.map((f) => f.id).join(' → ')}`);
  console.log(`  blocks 100k users: ${intel.blocksScale.blocks100kConcurrentUsers.length} structural levers (capacity = load-test, not fabricated)`);
  console.log(`  → graphify-out/decision-engine.json\n`);
}

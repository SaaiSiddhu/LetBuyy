#!/usr/bin/env node
// LCIS Omega — Decision Engine v2 (Phase 15). Extends the v5 ranking with 1,000 and 10,000 merchant
// scale tiers. Built from the real blocker report + structural scale levers. Capacity numbers require
// a load test — framed as levers + known platform limits, never fabricated.
import { writeOut, nowStamp } from './omega-lib.mjs';
import { buildDecisionEngine } from './decision-engine-v5.mjs';
import { buildProductionReadinessV2 } from './production-readiness-v2.mjs';

export function buildDecisionEngineV2() {
  const v5 = buildDecisionEngine();
  const pr = buildProductionReadinessV2();

  const scale = {
    ...v5.blocksScale,
    blocks1000Merchants: [
      'Single Supabase Postgres compute — at 1k active stores the shared DB compute/IO is the first ceiling; needs Pro+ compute add-ons and read projections',
      'Connection pool sizing behind one Hyperdrive binding (per-tenant concurrency)',
      'Onboarding/KYC throughput (merchant_kyc_documents pipeline) + billing (subscriptions, dunning) at volume',
      'RLS evaluation cost on hot tenant tables — index + projection coverage',
    ],
    blocks10000Merchants: [
      'Shared-schema multi-tenancy hits hard limits — needs partitioning/sharding by site_id or tenant pods (hot-table-partition-maintenance is the seam)',
      'Single deploy pipeline blast radius (M-1) — a bad migration affects all 10k stores; needs staged/canary rollout per tenant cohort',
      'Read replicas + projection stores (CQRS) for catalog/storefront read scale',
      'Per-tenant cost attribution (cost-intelligence) becomes necessary for pricing/limits',
      'NOTE: the exact merchant ceiling requires a load test against staging — these are the structural levers, not a fabricated number.',
    ],
  };

  return { summary: { launchVerdict: v5.summary.launchVerdict, overallReadiness: pr.summary?.overall,
    fixNextCount: v5.fixNext.length, scaleTiers: ['launch', '100 merchants', '1k merchants', '10k merchants', '10k users', '100k users'],
    topPriority: v5.summary.topPriority,
    note: 'Ranking from the real V1 blocker report + structural readiness + scale levers; capacity thresholds need a load test (not fabricated).', generatedAt: nowStamp() },
    fixNext: v5.fixNext, highestRisk: v5.highestRisk, blocksLaunch: v5.blocksLaunch, blocksScale: scale };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = buildDecisionEngineV2(); writeOut('decision-engine-v2.json', i);
  console.log('\nDecision Engine v2 — verdict', i.summary.launchVerdict, '· readiness', i.summary.overallReadiness + '%');
  console.log('  fix order:', i.fixNext.map((f) => f.id).join(' → '));
  console.log('  scale tiers:', i.summary.scaleTiers.join(', '));
  console.log('  → graphify-out/decision-engine-v2.json');
}

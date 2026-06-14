#!/usr/bin/env node
// LCIS V7 — Mission Control Executive Dashboard (Phase 11). Composes the existing engines into one
// executive view: production health, launch readiness, merchant/revenue/infra/security health,
// deployment status, open findings, critical risks, recommended actions. Pure composition — no new
// numbers invented; live values stay NOT CONNECTED with their source.
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProductionHealth } from './production-health.mjs';
import { buildProductionReadinessV2 } from './production-readiness-v2.mjs';
import { buildDecisionEngineV2 } from './decision-engine-v2.mjs';
import { buildAuditEngineV2 } from './audit-engine-v2.mjs';
import { buildConnectionsIntel } from './connections-intel.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;

export function buildMissionControlDashboard() {
  const health = buildProductionHealth();
  const pr = buildProductionReadinessV2();
  const de = buildDecisionEngineV2();
  const audit = buildAuditEngineV2();
  const conn = buildConnectionsIntel();
  const merch = g('merchant-intelligence.json'), rev = g('revenue-intelligence-v2.json'), sec = g('security-intelligence-v5.json'), infra = g('infra-intel.json'), exec = g('execution-intel.json');

  const dim = (n) => pr.dimensions?.find((d) => d.dimension === n)?.score ?? null;
  const tiles = [
    { tile: 'Production Health', value: health.summary.overall, kind: 'status', detail: `${health.summary.counts.GREEN} GREEN / ${health.summary.counts.YELLOW} YELLOW / ${health.summary.counts.RED} RED` },
    { tile: 'Launch Readiness', value: pr.summary.launchVerdict, kind: 'status', detail: `${pr.summary.overall}% structural · ${pr.summary.openBlockers} open blockers` },
    { tile: 'Merchant Health', value: dim('Merchant') ? dim('Merchant') + '%' : '—', kind: 'pct', detail: merch ? `${merch.summary.operatingStages} stages · single-tenant SPOF` : 'model ready; scores live-query-bound' },
    { tile: 'Revenue Health', value: dim('Revenue') ? dim('Revenue') + '%' : '—', kind: 'pct', detail: rev ? `${rev.summary.models} models incl gift-card liability · amounts live-query-bound` : '—' },
    { tile: 'Infrastructure Health', value: dim('Infrastructure') ? dim('Infrastructure') + '%' : '—', kind: 'pct', detail: `${infra?.summary.workers} workers · ${infra?.summary.queueProducers.length} queues · ${infra?.summary.secretsRequired} secrets` },
    { tile: 'Security Health', value: dim('Security') ? dim('Security') + '%' : '—', kind: 'pct', detail: sec ? `${sec.summary.controlsPresent}/${sec.summary.controls} controls · ${sec.summary.crossTenantCandidates} cross-tenant candidates` : '—' },
    { tile: 'Deployment Status', value: 'DECLARED', kind: 'status', detail: 'migrate gate + rollback present; live versions NOT CONNECTED (deploy APIs)' },
    { tile: 'Live Data', value: `${conn.summary.notConnected} NOT CONNECTED`, kind: 'warn', detail: `${conn.summary.adapterReady} adapters ready; wire a connected environment to activate` },
  ];

  const openFindings = audit.findings.filter((f) => f.count > 0).map((f) => ({ id: f.id, category: f.category, count: f.count, authority: f.authority }));
  const criticalRisks = [
    ...(de.highestRisk || []).slice(0, 5).map((r) => ({ type: r.type, detail: r.detail, severity: r.severity })),
  ];
  const recommendedActions = [
    ...(de.fixNext || []).slice(0, 5).map((f, i) => ({ rank: i + 1, id: f.id, action: f.title, severity: f.severity })),
    { rank: 99, id: 'CONNECT', action: 'Connect a staging environment (Supabase + Cloudflare read tokens) to activate the live layer — adapters are ready', severity: '🟡' },
  ];

  return {
    summary: { overallHealth: health.summary.overall, launchVerdict: pr.summary.launchVerdict, structuralReadiness: pr.summary.overall,
      openFindings: openFindings.reduce((a, f) => a + f.count, 0), criticalRisks: criticalRisks.length,
      liveNotConnected: conn.summary.notConnected, generatedAt: pr.summary.generatedAt },
    tiles, health: health.systems, openFindings, criticalRisks, recommendedActions,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildMissionControlDashboard();
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'mission-control-dashboard.json'), JSON.stringify(intel));
  const s = intel.summary;
  console.log('\nLCIS Mission Control Dashboard (V7)');
  console.log(`  overall health ${s.overallHealth} · launch ${s.launchVerdict} · structural ${s.structuralReadiness}%`);
  console.log(`  open findings ${s.openFindings} · critical risks ${s.criticalRisks} · live NOT CONNECTED ${s.liveNotConnected}`);
  console.log(`  top action: ${intel.recommendedActions[0].id} — ${intel.recommendedActions[0].action.slice(0, 50)}`);
  console.log('  → graphify-out/mission-control-dashboard.json');
}

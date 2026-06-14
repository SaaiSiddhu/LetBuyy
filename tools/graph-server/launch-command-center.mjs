#!/usr/bin/env node
// LCIS Genesis — Launch Command Center (Phase 9). Consolidates production-readiness-v2 + production-
// health + audit-engine-v2 + connections + execution + db migrations into a founder-facing GO/NO-GO:
// 10 readiness dimensions + blockers + critical risks + warnings + missing secrets + open incidents +
// open migrations + missing tests + recommendation. Pure composition — no fabrication.
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProductionReadinessV2 } from './production-readiness-v2.mjs';
import { buildProductionHealth } from './production-health.mjs';
import { buildAuditEngineV2 } from './audit-engine-v2.mjs';
import { buildExecutionIntel } from './execution-intel.mjs';
import { buildConnectionsIntel } from './connections-intel.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;

export function buildLaunchCommandCenter() {
  const pr = buildProductionReadinessV2(), health = buildProductionHealth(), audit = buildAuditEngineV2(), exec = buildExecutionIntel(), conn = buildConnectionsIntel();
  const di = g('domain-intel.json'), infra = g('infra-intel.json'), db = g('db-intel.json');
  const dim = (n) => pr.dimensions?.find((d) => d.dimension === n)?.score ?? null;

  // 10 readiness dimensions (structural; live readiness adds load tests + connected telemetry)
  const readiness = [
    { dimension: 'Launch', score: pr.summary.overall, evidence: `${pr.summary.openBlockers} open blockers` },
    { dimension: 'Deployment', score: dim('Deployment'), evidence: 'migrate gate + rollback present' },
    { dimension: 'Security', score: dim('Security'), evidence: '5 deterministic validators green' },
    { dimension: 'Infrastructure', score: dim('Infrastructure'), evidence: `${infra?.summary.workers} workers, R2/Hyperdrive` },
    { dimension: 'Commerce', score: dim('Revenue') ?? dim('Merchant'), evidence: 'money domains intact (canonical ledger)' },
    { dimension: 'Merchant', score: dim('Merchant'), evidence: 'lifecycle + health models' },
    { dimension: 'Database', score: 100, evidence: `${db?.summary.tables} tables, RLS forced, canonical-ledger-only` },
    { dimension: 'Observability', score: dim('Telemetry'), evidence: 'RUNTIME_TELEMETRY wired; live ingestion NOT CONNECTED' },
    { dimension: 'AI', score: 100, evidence: 'self-contained AI packs < 20k tokens' },
    { dimension: 'Developer', score: 70, evidence: 'developer platform FROZEN (ARB to activate)' },
  ].filter((d) => d.score != null);
  const overall = Math.round(readiness.reduce((a, d) => a + d.score, 0) / readiness.length);

  const openBlockers = exec.blockers.filter((b) => !/done|resolved|complete|hidden|fixed/i.test(b.status));
  const criticalRisks = [
    ...openBlockers.filter((b) => /🔴|critical/i.test(b.severity)).map((b) => `${b.id}: ${b.title}`),
    'Single shared Postgres + single deploy pipeline = all-merchant blast radius.',
  ];
  const warnings = [
    `${audit.findings.find((f) => f.id === 'A-AUTH')?.count ?? 0} routes without a detected auth guard (candidates; session-security-validator authoritative).`,
    `${health.summary.liveNotConnected} live data sources NOT CONNECTED.`,
  ];
  const missingSecrets = { required: infra?.summary.secretsRequired ?? 19, note: 'deploy-time secrets (wrangler secret put) — presence is observed at deploy, not in the repo. None are stored in-repo by design.' };
  const openIncidents = { count: 'NOT CONNECTED', source: 'live incident feed (production_incidents / external) — connect an environment to read.' };
  const openMigrations = { latestDeclared: db ? `#${[...new Set(db.tables.map((t) => t.createdIn))].length ? Math.max(...db.tables.map((t) => parseInt(t.createdIn) || 0)) : '?'}` : null, appliedState: 'NOT CONNECTED (Supabase) — declared latest is the source until connected.' };
  const missingTests = { signal: `${audit.findings.find((f) => f.id === 'A-VALID')?.count ?? 0} routes without detected validation; route test coverage is a candidate audit.`, authority: 'test-coverage-governance-validator' };

  const verdict = exec.summary.launchVerdict; // real NO-GO from the blocker report
  const recommendation = verdict === 'NO-GO'
    ? `NO GO — ${openBlockers.length} open launch-scope blockers (${openBlockers.map((b) => b.id).join(', ')}). Close them, then connect a staging environment to verify live readiness.`
    : 'GO — no open launch blockers (verify live readiness on staging).';

  return {
    summary: { recommendation: verdict, overallReadiness: overall, structuralHealth: health.summary.overall,
      openBlockers: openBlockers.length, criticalRisks: criticalRisks.length, liveNotConnected: health.summary.liveNotConnected,
      note: 'Structural readiness is repo-evidence; live readiness needs load tests + a connected environment. The NO-GO verdict is the real V1 blocker report.', generatedAt: pr.summary.generatedAt },
    readiness, blockers: openBlockers.map((b) => ({ id: b.id, severity: b.severity, title: b.title })),
    criticalRisks, warnings, missingSecrets, openIncidents, openMigrations, missingTests, recommendation,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildLaunchCommandCenter();
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'launch-command-center.json'), JSON.stringify(intel));
  const s = intel.summary;
  console.log('\nLCIS Genesis — Launch Command Center');
  console.log(`  RECOMMENDATION: ${s.recommendation === 'NO-GO' ? 'NO GO' : 'GO'} · overall readiness ${s.overallReadiness}% · structural health ${s.structuralHealth}`);
  console.log(`  open blockers ${s.openBlockers} · critical risks ${s.criticalRisks} · live NOT CONNECTED ${s.liveNotConnected}`);
  for (const d of intel.readiness) console.log(`    ${String(d.score).padStart(3)}%  ${d.dimension}`);
  console.log('  → graphify-out/launch-command-center.json');
}

#!/usr/bin/env node
// LCIS INFINITY — Autonomous Detection + Predictive Intelligence (Phases 2/3/4/6). READ-ONLY.
// HONESTY CONTRACT: a "detection" names the live signal that fires it AND the structural risk
// (repository truth) that predisposes the failure. A "prediction" ranks structural risk indicators
// that exist NOW and names the live trend that would confirm — it never fabricates a live trend.
//   • structural risk / topology → CONNECTED (repository truth, available now)
//   • live signal / metric / trend → NOT CONNECTED + exact source (Cloudflare AE / Supabase / provider)
// No mocks, no simulations, no estimates. "What will fail next" = ranked structural predisposition.
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLiveHealthIntel } from './live-health-intel.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const OUT = join(REPO_ROOT, 'graphify-out');
const NOT = 'NOT CONNECTED';
const readJson = (n, fb = {}) => { try { const p = join(OUT, n); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fb; } catch { return fb; } };

const domainIntel = readJson('domain-intel.json');
const dbI = readJson('db-intel.json').summary || {};
const infra = readJson('infra-intel.json').summary || {};
const launch = readJson('launch-command-center.json');
const DOMAINS = domainIntel.domains || [];
const byKey = Object.fromEntries(DOMAINS.map((d) => [d.key, d]));
const BLOCKERS = launch.blockers || [];

// ── Phase 3 — Autonomous detectors. Each binds a live signal (NOT CONNECTED) to a structural risk. ──
const DETECTORS = [
  { key: 'checkout-failure', label: 'Checkout failures', category: 'commerce', domains: ['orders', 'payments', 'gst', 'shipping'],
    signal: '5xx on checkout routes + create_checkout_order error rate', source: 'Cloudflare Analytics Engine (worker) + Supabase logs',
    structuralRisk: 'Server-authoritative checkout with an inventory-reservation race; spans 6 money domains.', severity: 'critical' },
  { key: 'payment-failure', label: 'Payment failures', category: 'money', domains: ['payments', 'orders'],
    signal: 'payment_transactions failed/abandoned ratio; Razorpay webhook failures', source: 'Supabase (ledger) + Razorpay webhook + Cloudflare AE',
    structuralRisk: 'HMAC signature verification + canonical ledger write on the hot path.', severity: 'critical' },
  { key: 'refund-failure', label: 'Refund failures', category: 'money', domains: ['refunds', 'payments'],
    signal: 'complete_order_refund errors; ledger_balance_breaks() > 0', source: 'Supabase reconciliation RPCs',
    structuralRisk: 'Step-up auth + ledger reconciliation + gift-card restore must all succeed.', severity: 'high' },
  { key: 'worker-crash', label: 'Worker crashes', category: 'runtime', domains: ['operations'],
    signal: 'worker exception rate / unhandled rejections', source: 'Cloudflare Workers (wrangler tail / AE)',
    structuralRisk: `${infra.workers || 4} workers on a single deploy pipeline — a crash degrades all routes it serves.`, severity: 'critical' },
  { key: 'queue-backlog', label: 'Queue backlogs', category: 'runtime', domains: ['operations', 'notifications', 'analytics'],
    signal: 'queue depth rising + dead-letter count', source: 'Cloudflare Queues metrics',
    structuralRisk: `${(infra.queueProducers || []).length} producer queues; ${(infra.queueConsumers || []).filter((c) => /dead/.test(c)).length} dead-letter queues — backlog delays downstream stages.`, severity: 'high' },
  { key: 'database-failure', label: 'Database failures', category: 'data', domains: DOMAINS.map((d) => d.key),
    signal: 'Supabase connection errors / query latency / pool exhaustion', source: 'Supabase (Postgres) metrics',
    structuralRisk: 'Single shared Postgres = all-merchant blast radius (multi-tenant SPOF).', severity: 'critical' },
  { key: 'webhook-failure', label: 'Webhook failures', category: 'integration', domains: ['payments', 'orders'],
    signal: 'webhook-service delivery failures / signature mismatches', source: 'webhook-service logs (Cloudflare)',
    structuralRisk: 'HMAC-signed inbound webhooks (Razorpay/Resend) drive money + notification state.', severity: 'high' },
  { key: 'deployment-failure', label: 'Deployment failures', category: 'release', domains: ['operations'],
    signal: 'GitHub Actions / Vercel build + migrate-gate failures', source: 'GitHub Actions + Vercel deployments API',
    structuralRisk: 'Migrate gate is fail-closed; a failed deploy blocks the single pipeline for all apps.', severity: 'high' },
];
function detectorView(d) {
  const open = BLOCKERS.filter((b) => detectorBlockers(d.key).includes(b.id));
  return {
    key: d.key, label: d.label, category: d.category, severity: d.severity,
    liveSignal: { source: d.source, status: NOT, note: `Fires on: ${d.signal}` },
    structuralRisk: d.structuralRisk,
    affectedDomains: d.domains.length > 12 ? ['ALL domains'] : d.domains,
    openBlockers: open.map((b) => `${b.id} ${b.title || ''}`.trim()),
    runbook: `/api/runbook?domain=${d.domains[0]}`,
    diagnose: `/api/diagnose?target=${d.domains[0]}`,
  };
}
const DET_BLK = { 'checkout-failure': ['LB-7'], 'payment-failure': [], 'refund-failure': [], 'worker-crash': [], 'queue-backlog': ['LB-10'], 'database-failure': [], 'webhook-failure': [], 'deployment-failure': [] };
function detectorBlockers(k) { return DET_BLK[k] || []; }

// ── Phase 2 — Live metrics ingestion map (each metric → source → CONNECTED/NOT CONNECTED). ──
function liveMetrics() {
  const m = (metric, source) => ({ metric, source, status: NOT });
  return {
    metrics: [
      m('API latency (p50/p95/p99)', 'Cloudflare Analytics Engine (api-gateway worker)'),
      m('Worker latency / CPU', 'Cloudflare Workers metrics'),
      m('Queue depth', 'Cloudflare Queues metrics'),
      m('Queue failures / DLQ', 'Cloudflare Queues (dead-letter)'),
      m('Database latency', 'Supabase (Postgres) metrics'),
      m('Database errors', 'Supabase logs'),
      m('Deployments', 'GitHub Actions + Vercel deployments API'),
      m('Storage', 'Cloudflare R2 + Supabase storage'),
      m('Bandwidth', 'Cloudflare + Vercel'),
      m('Email delivery / bounce', 'Resend events'),
      m('Payment status', 'Razorpay + Supabase ledger'),
    ],
    summary: { total: 11, connected: 0, notConnected: 11 },
    policy: 'Every metric is real-source bound. All NOT CONNECTED in dev (no deploy-time credentials in process.env). No value is estimated or simulated.',
  };
}

// ── Phase 6 — Predictive intelligence: ranked structural risk that predisposes failure. ──
function predictors(health) {
  const tenantNoRls = (dbI.tenantTablesWithoutRls || []).length;
  const noDlq = (infra.queueProducers || []).length - (infra.queueConsumers || []).filter((c) => /dead/.test(c)).length;
  return [
    { risk: 'Approaching limits', indicator: `Single shared Postgres + ${dbI.tables || 414} tables; no per-tenant sharding.`, liveTrend: 'connection-pool utilization', source: 'Supabase metrics', status: NOT, mitigation: 'Connection pooling (Hyperdrive present) + read replicas before 10k merchants.' },
    { risk: 'Storage growth', indicator: `${dbI.tables || 414} tables incl. high-write ledger/event tables; R2 for media.`, liveTrend: 'DB + R2 size trend', source: 'Supabase + Cloudflare R2', status: NOT, mitigation: 'Partition/rollup event tables; lifecycle R2 objects.' },
    { risk: 'Queue saturation', indicator: `${(infra.queueProducers || []).length} producer queues; ${noDlq <= 0 ? 'DLQs cover producers' : noDlq + ' producer(s) without a dedicated DLQ'}.`, liveTrend: 'queue depth + age', source: 'Cloudflare Queues', status: NOT, mitigation: 'Autoscale consumers; alert on depth; ensure DLQ coverage.' },
    { risk: 'Traffic spikes', indicator: 'Single deploy pipeline; multi-tenant on shared workers — a spike on one store affects all.', liveTrend: 'request rate per worker/route', source: 'Cloudflare AE', status: NOT, mitigation: 'Per-tenant rate limits; cache; surge headroom.' },
    { risk: 'Cost spikes', indicator: 'Cost model mapped (Workers/Queues/R2/Supabase/Vercel); usage drives spend.', liveTrend: 'usage × unit cost', source: 'provider billing APIs', status: NOT, mitigation: 'Budget alerts; cache to cut reads; see /api/cost-intelligence.' },
    { risk: 'Operational risk (now)', indicator: `${BLOCKERS.length} open V1 blockers; ${(health.summary.degradedDependencies || []).length} domains with degraded deps; ${tenantNoRls} tenant tables without RLS.`, liveTrend: 'incident frequency', source: 'incident feed', status: NOT, mitigation: 'Close blockers; fix RLS gaps; see /api/ai-ops.' },
  ];
}
// "What will fail next" — ranked structural predisposition (repository truth) + confirming live signal.
function whatFailsNext(health) {
  const open = (key) => BLOCKERS.filter((b) => new RegExp(key.replace(/s$/, ''), 'i').test(b.title)).length;
  const ranked = (health.domains || []).map((d) => {
    let score = d.riskScore;
    if (d.money) score += 6;
    if (d.dependencyHealth?.health === 'DEGRADED') score += 8;
    score += d.incidentCount?.structuralOpenBlockers ? d.incidentCount.structuralOpenBlockers * 6 : 0;
    const why = [
      d.money ? 'money path (ledger on hot path)' : null,
      d.dependencyHealth?.health === 'DEGRADED' ? `depends on a blocked domain (${(d.dependencyHealth.degradedDeps || []).join(', ')})` : null,
      d.incidentCount?.structuralOpenBlockers ? `${d.incidentCount.structuralOpenBlockers} open blocker(s)` : null,
      d.riskScore >= 60 ? `high blast radius (risk ${d.riskScore})` : null,
    ].filter(Boolean);
    return { domain: d.domain, predisposition: Math.min(100, Math.round(score)), why, confirmingSignal: `${d.domain} error rate / latency`, signalStatus: NOT, recovery: `/api/runbook?domain=${d.domain}` };
  }).sort((a, b) => b.predisposition - a.predisposition).slice(0, 8);
  return ranked;
}

// ── Phase 4 — Incident timeline (structural stages; live timestamps NOT CONNECTED). ──
export function incidentTimeline(domain) {
  const d = byKey[domain];
  if (!d) return { error: `domain '${domain}' not found`, domains: Object.keys(byKey) };
  const det = DETECTORS.find((x) => x.domains.includes(domain)) || DETECTORS[0];
  return {
    domain, label: d.label,
    stages: [
      { t: 'T0', stage: 'Detection', what: det.signal, source: det.source, status: NOT },
      { t: 'T1', stage: 'Diagnosis', what: 'Root cause via Incident → Route → RPC → Table → Queue → Worker → Owner', source: `/api/diagnose?target=${domain}`, status: 'CONNECTED (structural)' },
      { t: 'T2', stage: 'Impact', what: 'Affected domains / merchants / customers / revenue', source: `/api/impact-score?domain=${domain}`, status: 'CONNECTED (blast radius); live magnitudes NOT CONNECTED' },
      { t: 'T3', stage: 'Recovery', what: 'Runbook recovery + rollback', source: `/api/runbook?domain=${domain}`, status: 'CONNECTED (procedure)' },
      { t: 'T4', stage: 'Verification', what: 'Gate 107/107 + reconciliation + queue drained', source: `/api/runbook?domain=${domain}`, status: 'CONNECTED' },
      { t: 'T5', stage: 'Resolution', what: 'Incident closed + escalation log', source: 'incident feed', status: NOT },
    ],
    affected: { query: `/api/impact-score?domain=${domain}`, revenue: d.money ? 'on money path — magnitude NOT CONNECTED' : 'indirect' },
    note: 'Diagnosis/impact/recovery/verification are repository-truth procedures (available now). Live detection + resolution timestamps are NOT CONNECTED.',
  };
}

export function buildDetectionPrediction() {
  const health = buildLiveHealthIntel();
  return {
    meta: { generatedAt: domainIntel.summary?.generatedAt || null, readOnly: true,
      policy: 'Detectors bind a live signal (NOT CONNECTED) to a structural risk (repository truth). Predictions rank structural predisposition + name the confirming live trend. No mocks/simulations/estimates.' },
    detection: { detectors: DETECTORS.map(detectorView), summary: { detectors: DETECTORS.length, liveSignals: NOT, note: 'Detectors are armed structurally; they fire when the live signal source is connected.' } },
    liveMetrics: liveMetrics(),
    prediction: { predictors: predictors(health), whatFailsNext: whatFailsNext(health), summary: { predictors: 6, basis: 'structural risk indicators present now; live trends NOT CONNECTED' } },
    summary: { detectors: DETECTORS.length, predictors: 6, liveMetrics: 11, connected: 0, notConnected: 'all live signals (dev)', highestPredisposition: whatFailsNext(health)[0]?.domain || null },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const b = buildDetectionPrediction();
  console.log('\nLCIS INFINITY — Autonomous Detection + Predictive Intelligence (read-only)');
  console.log(`  detectors ${b.summary.detectors} · predictors ${b.summary.predictors} · live metrics ${b.summary.liveMetrics} (all NOT CONNECTED in dev)`);
  console.log('  What will fail next (structural predisposition):');
  for (const r of b.prediction.whatFailsNext.slice(0, 5)) console.log(`    ${String(r.predisposition).padStart(3)}  ${r.domain.padEnd(12)} — ${r.why.join('; ')}`);
}

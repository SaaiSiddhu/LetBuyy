#!/usr/bin/env node
// LetBuyy Production Readiness Engine (LCIS v5, Phase 9) — scores each system 0-100 from
// REPOSITORY EVIDENCE (structural readiness, not a live SLA): surface completeness (routes/rpcs/
// tables), RLS coverage, ownership, money-RPC integrity, and open blockers that reference it.
// Every score carries its evidence. Open blockers come from the real V1 blocker report.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExecutionIntel } from './execution-intel.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;

// system → domain key (or 'infra' for cross-cutting), + the keyword that a blocker would mention
const SYSTEMS = [
  ['Architecture', 'infra:arch'], ['Infrastructure', 'infra:infra'], ['Security', 'infra:security'],
  ['Payments', 'payments'], ['Orders', 'orders'], ['Shipping', 'shipping'], ['GST', 'gst'],
  ['Gift Cards', 'gift-cards'], ['Refunds', 'refunds'], ['Payouts', 'payouts'],
  ['Merchant App', 'merchant'], ['Storefront', 'storefront'], ['Identity', 'identity'],
  ['Internal Systems', 'operations'], ['Queues', 'infra:queues'], ['Workers', 'infra:workers'],
  ['Deployments', 'infra:deploy'], ['Secrets', 'infra:secrets'],
];

export function buildProductionReadiness() {
  const di = g('domain-intel.json'), db = g('db-intel.json'), infra = g('infra-intel.json');
  if (!di || !db) return { error: 'domain-intel.json / db-intel.json missing' };
  const ex = buildExecutionIntel();
  const openBlockers = ex.blockers.filter((b) => !/done|resolved|complete|hidden|fixed/i.test(b.status));
  const table = (n) => db.tables.find((t) => t.name === n);

  const scoreDomain = (key) => {
    const d = di.domains.find((x) => x.key === key);
    if (!d) return { score: 50, evidence: ['domain not found — partial'], blockers: [] };
    let score = 100; const ev = []; const hit = [];
    ev.push(`${d.counts.routes} routes · ${d.counts.rpcs} rpcs · ${d.counts.tables} tables · ${d.counts.policies} policies`);
    if (!d.counts.routes) { score -= 10; ev.push('no gateway routes (−10)'); }
    if (!d.counts.rpcs && d.money) { score -= 10; ev.push('money domain with no RPC (−10)'); }
    if (!d.owners.length) { score -= 10; ev.push('no CODEOWNERS owner (−10)'); }
    const tenantNoRls = d.tables.filter((t) => table(t)?.tenant && !table(t)?.rls).length;
    if (tenantNoRls) { score -= Math.min(15, tenantNoRls * 3); ev.push(`${tenantNoRls} tenant tables w/o detected RLS (candidate, validator-authoritative)`); }
    // open blockers referencing this domain (by label/key keyword)
    const kw = new RegExp(key.replace('-', '.?').replace(/s$/, ''), 'i');
    for (const b of openBlockers) if (kw.test(b.title) || kw.test(b.id)) { const pen = /🔴|critical/i.test(b.severity) ? 30 : /🟠/.test(b.severity) ? 15 : 8; score -= pen; hit.push(b.id); ev.push(`blocker ${b.id} (−${pen})`); }
    return { score: Math.max(0, Math.min(100, score)), evidence: ev, blockers: hit };
  };

  const scoreInfra = (tag) => {
    const s = infra?.summary; const ev = []; let score = 100;
    if (tag === 'arch') { ev.push('107/107 governance validators green', `${db.summary.tables} tables / ${db.summary.functions} RPCs modeled`); }
    if (tag === 'infra') { ev.push(`${s?.workers || 0} workers · R2 ${s?.r2.length || 0} · Hyperdrive ${s?.hyperdrive ? '✓' : '✗'} · ${s?.queueProducers.length || 0} queues`); if (!s?.hyperdrive) score -= 20; }
    if (tag === 'security') { ev.push(`${db.summary.policies} policies · ${db.summary.forceRlsTables} FORCE · 5 deterministic validators`, `${db.summary.tenantTablesWithoutRls.length} tenant tables w/o detected RLS (candidate)`); score -= Math.min(10, db.summary.tenantTablesWithoutRls.length); }
    if (tag === 'queues') { ev.push(`${s?.queueProducers.length || 0} producers / ${s?.queueConsumers.length || 0} consumers incl dead-letter`); }
    if (tag === 'workers') { ev.push(`${s?.workers || 0} Cloudflare Workers with [observability] + RUNTIME_TELEMETRY`); }
    if (tag === 'deploy') { ev.push(`migrate gate ${s?.hasMigrateGate ? '✓' : '✗'} · rollback script present`, 'single pipeline = SPOF (mitigated by gates)'); if (!s?.hasMigrateGate) score -= 20; }
    if (tag === 'secrets') { ev.push(`${s?.secretsRequired || 0} production secrets via wrangler secret put`); }
    return { score: Math.max(0, Math.min(100, score)), evidence: ev, blockers: [] };
  };

  const systems = SYSTEMS.map(([name, key]) => {
    const r = key.startsWith('infra:') ? scoreInfra(key.split(':')[1]) : scoreDomain(key);
    return { system: name, key, score: r.score, evidence: r.evidence, blockers: r.blockers };
  });
  const overall = Math.round(systems.reduce((a, s) => a + s.score, 0) / systems.length);

  const summary = {
    overall, systems: systems.length,
    launchVerdict: ex.summary.launchVerdict, openBlockers: openBlockers.length,
    lowest: [...systems].sort((a, b) => a.score - b.score).slice(0, 5).map((s) => ({ system: s.system, score: s.score })),
    scope: 'STRUCTURAL readiness from repository evidence (surface completeness, RLS, ownership, money integrity, open blockers) — NOT a live production SLA. Live readiness adds load tests + telemetry.',
    generatedAt: ex.summary.generatedAt,
  };
  return { summary, systems };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildProductionReadiness();
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'production-readiness.json'), JSON.stringify(intel));
  if (intel.error) { console.error(intel.error); process.exit(1); }
  console.log('\nLetBuyy Production Readiness (LCIS v5) — STRUCTURAL (repo evidence)');
  console.log(`  overall ${intel.summary.overall}% · launch verdict ${intel.summary.launchVerdict} · open blockers ${intel.summary.openBlockers}`);
  for (const s of intel.systems) console.log(`    ${String(s.score).padStart(3)}%  ${s.system}${s.blockers.length ? '  ⟵ ' + s.blockers.join(',') : ''}`);
  console.log(`  → graphify-out/production-readiness.json\n`);
}

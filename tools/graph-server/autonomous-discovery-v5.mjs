#!/usr/bin/env node
// LetBuyy Autonomous Discovery v5 (Phase 14) — detects dead/unused/orphaned surfaces:
// dead RPCs, dead routes, dead tables, unused queues/workers/secrets, orphaned domains.
// ALL CANDIDATES — the 107 deterministic validators stay authoritative. Each carries its verify step.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;

export function runDiscoveryV5() {
  const db = g('db-intel.json'), di = g('domain-intel.json'), infra = g('infra-intel.json');
  if (!db || !di || !infra) return { error: 'intel JSON missing — run pnpm graph:v5' };

  // dead RPCs: not invoked via gateway db.rpc AND SECURITY DEFINER (trigger/internal fns excluded by note)
  const deadRpcs = db.functions.filter((f) => !f.callers.length && f.securityDefiner).map((f) => f.name);
  // dead routes: gateway route files that call NO db.rpc (candidate — may be read-only/proxy routes)
  const routesWithRpc = new Set(Object.keys(db.routeRpc));
  const deadRoutes = di.summary.unclassifiedRoutes; // unclassified + (proxy) — from domain layer
  // dead tables: no policy AND not touched by any rpc AND not reached by a route
  const touched = new Set(db.functions.flatMap((f) => f.touches));
  const reached = new Set(Object.values(db.routeTables).flat());
  const deadTables = db.tables.filter((t) => !t.policies.length && !touched.has(t.name) && !reached.has(t.name)).map((t) => t.name);
  // unused queues: declared producer with no consumer (Cloudflare DLQ aside)
  const consumers = new Set(infra.summary.queueConsumers);
  const unusedQueues = infra.summary.queueProducers.filter((q) => ![...consumers].some((c) => c.toLowerCase().includes(q.toLowerCase().replace('_queue', '').replace('_', '-'))));
  // unused workers: worker with no routes and no queues
  const unusedWorkers = infra.workers.filter((w) => !w.queueProducers.length && !w.queueConsumers.length && !w.bindings.length).map((w) => w.name);
  // unused secrets: declared secret not mapped to any domain
  const mappedSecrets = new Set(di.domains.flatMap((d) => d.secrets));
  const unusedSecrets = infra.secrets.filter((s) => !mappedSecrets.has(s));
  // orphaned domains: no dependsOn AND no consumedBy (isolated)
  const orphanedDomains = di.domains.filter((d) => !d.dependsOn.length && !d.consumedBy.length).map((d) => d.key);

  const summary = {
    deadRpcs: deadRpcs.length, deadRoutes: deadRoutes.length, deadTables: deadTables.length,
    unusedQueues: unusedQueues.length, unusedWorkers: unusedWorkers.length, unusedSecrets: unusedSecrets.length,
    orphanedDomains: orphanedDomains.length,
    note: 'ALL candidates. Dead RPCs are mostly trigger/internal functions (verify with CREATE TRIGGER); dead tables are mostly event-sourcing/projection internals; unused secrets are platform-wide (SUPABASE_*) used by every domain. The 107 deterministic validators are authoritative for real dead-code.',
    generatedAt: db.summary.generatedAt,
  };
  return { summary, deadRpcs: deadRpcs.slice(0, 40), deadRoutes, deadTables: deadTables.slice(0, 40), unusedQueues, unusedWorkers, unusedSecrets, orphanedDomains };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = runDiscoveryV5();
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'autonomous-discovery-v5.json'), JSON.stringify(intel));
  if (intel.error) { console.error(intel.error); process.exit(1); }
  const s = intel.summary;
  console.log('\nLetBuyy Autonomous Discovery v5 (candidates only)');
  console.log(`  dead rpcs ${s.deadRpcs} · dead routes ${s.deadRoutes} · dead tables ${s.deadTables}`);
  console.log(`  unused queues ${s.unusedQueues} · workers ${s.unusedWorkers} · secrets ${s.unusedSecrets} · orphaned domains ${s.orphanedDomains}`);
  console.log(`  orphaned domains: ${intel.orphanedDomains.join(', ') || '—'}`);
  console.log(`  → graphify-out/autonomous-discovery-v5.json\n`);
}

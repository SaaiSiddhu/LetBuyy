#!/usr/bin/env node
// LetBuyy Incident Intelligence (LCIS v3, Phase 9) — for a domain or route, resolves the
// Incident → Route → RPC → Table → Queue → Worker → Owner chain and the blast radius.
// Answers: root cause surface · blast radius · affected domains · affected merchants.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blastDomain } from './cross-domain-engine.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function traceIncident(di, db, infra, target) {
  if (!di || !db) return { error: 'domain-intel.json / db-intel.json missing' };
  // resolve target → domain (accepts a domain key, a route name, an rpc, or a table)
  let d = di.domains.find((x) => x.key === target || x.label.toLowerCase() === (target || '').toLowerCase());
  if (!d) d = di.domains.find((x) => x.routes.includes(target) || x.rpcs.includes(target) || x.tables.includes(target));
  if (!d) {
    const t = (target || '').toLowerCase();
    d = di.domains.find((x) => x.routes.some((r) => r.includes(t)) || x.tables.some((tb) => tb.includes(t)));
  }
  if (!d) return { error: `could not map '${target}' to a domain`, available: di.domains.map((x) => x.key) };

  const blast = blastDomain(di, d.key);
  const tenantTables = d.tables.filter((tn) => db.tables.find((t) => t.name === tn && t.tenant));
  const moneyTables = d.tables.filter((tn) => db.tables.find((t) => t.name === tn && t.money));

  return {
    target, domain: d.key, label: d.label,
    chain: {
      routes: d.routes, rpcs: d.rpcs.slice(0, 30), tables: d.tables,
      queues: d.queues, workers: d.workers, owners: d.owners,
    },
    rootCauseSurface: {
      // most-coupled tables/rpcs are the likeliest blast origins
      moneyTables, tenantTables: tenantTables.length,
      highestCouplingDeps: d.dependsOn.slice(0, 5),
    },
    blastRadius: { domains: blast.blastRadius.domains, affected: blast.blastRadius.affected, layers: blast.blastRadius.layers,
      routes: blast.routes.length, rpcs: blast.rpcs.length, tables: blast.tables.length },
    affectedDomains: [d.key, ...blast.blastRadius.affected],
    affectedMerchants: tenantTables.length
      ? 'ALL tenants — shared multi-tenant schema; tenant isolation is RLS + verifySiteOwnership, not physical separation'
      : 'platform-internal (no tenant table in this domain)',
    owners: blast.owners,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const g = (f) => existsSync(join(ROOT, 'graphify-out', f)) ? JSON.parse(readFileSync(join(ROOT, 'graphify-out', f), 'utf8')) : null;
  console.log(JSON.stringify(traceIncident(g('domain-intel.json'), g('db-intel.json'), g('infra-intel.json'), process.argv[2] || 'payments'), null, 2));
}

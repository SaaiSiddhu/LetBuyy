#!/usr/bin/env node
// LetBuyy Change-Impact Engine (LCIS v4, Phase 5) — "what breaks if I modify <domain>?"
// One call returns Routes / RPCs / Tables / Workers / Queues / Deployments / Merchants /
// Domains / Owners by composing the v3 cross-domain blast with db + infra + deploy facts.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blastDomain } from './cross-domain-engine.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function changeImpact(di, db, infra, key) {
  if (!di) return { error: 'domain-intel.json missing — run pnpm graph:domain' };
  const b = blastDomain(di, key);
  if (b.error) return b;
  const d = di.domains.find((x) => x.key === key);
  const moneyTouched = b.tables.some((t) => (db?.tables.find((x) => x.name === t)?.money));
  const tenantTouched = b.tables.some((t) => (db?.tables.find((x) => x.name === t)?.tenant));
  const queues = [...new Set([d, ...b.blastRadius.affected.map((k) => di.domains.find((x) => x.key === k))].filter(Boolean).flatMap((x) => x.queues))];
  return {
    domain: key, label: b.label,
    breaks: {
      domains: { count: b.blastRadius.domains, list: b.blastRadius.affected, layers: b.blastRadius.layers },
      routes: b.routes, rpcs: b.rpcs, tables: b.tables,
      workers: b.services.workers, queues,
      deployments: { workers: b.services.workers, apps: b.services.apps,
        gate: 'production-deploy.yml: migrate-production → workers → Vercel; rollback via production-rollback.mjs' },
      merchants: tenantTouched ? 'ALL tenants — shared multi-tenant schema (RLS + verifySiteOwnership isolate, not physical separation)' : 'platform-internal (no tenant table touched)',
      owners: b.owners,
    },
    risk: { money: moneyTouched, tenant: tenantTouched,
      note: moneyTouched ? 'touches money tables — canonical-ledger-only-validator + step-up apply; run `graph:intel blast` on the RPCs before merge' : 'no money table in blast radius' },
  };
}

const DOMAINS = ['refunds', 'payments', 'orders', 'shipping', 'gst', 'gift-cards', 'themes', 'marketplace'];

if (import.meta.url === `file://${process.argv[1]}`) {
  const g = (f) => existsSync(join(ROOT, 'graphify-out', f)) ? JSON.parse(readFileSync(join(ROOT, 'graphify-out', f), 'utf8')) : null;
  const di = g('domain-intel.json'), db = g('db-intel.json'), infra = g('infra-intel.json');
  const key = process.argv[2];
  if (key) console.log(JSON.stringify(changeImpact(di, db, infra, key), null, 2));
  else for (const k of DOMAINS) { const r = changeImpact(di, db, infra, k); console.log(`${k.padEnd(12)} → ${r.breaks.domains.count} domains, ${r.breaks.routes.length} routes, ${r.breaks.rpcs.length} rpcs, ${r.breaks.tables.length} tables · money=${r.risk.money}`); }
}

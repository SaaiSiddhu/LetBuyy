#!/usr/bin/env node
// LetBuyy Merchant Operating Graph (LCIS v4, Phase 6) — the live operating chain
// Merchant → Store → Theme → Orders → Products → Payments → Shipping → GST → Gift Cards → Payouts.
// Answers: which merchant depends on X · which feature is used · which merchants are affected.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHAIN = ['merchant', 'storefront', 'themes', 'orders', 'products', 'payments', 'shipping', 'gst', 'gift-cards', 'payouts'];

export function buildMerchantOperatingGraph(di, db) {
  if (!di) return { error: 'domain-intel.json missing — run pnpm graph:domain' };
  const byKey = Object.fromEntries(di.domains.map((d) => [d.key, d]));
  const chain = CHAIN.map((k) => {
    const d = byKey[k]; if (!d) return null;
    const tenantTables = d.tables.filter((tn) => db?.tables.find((t) => t.name === tn && t.tenant)).length;
    return { node: d.label, key: k, apps: d.apps, routes: d.routes.length, rpcs: d.rpcs.length, tables: d.tables.length,
      tenantTables, money: d.money, dependsOn: d.dependsOn.map((x) => x.domain), feeds: d.consumedBy.map((x) => x.domain) };
  }).filter(Boolean);
  return {
    chain,
    affectedMerchants: 'Every feature in the chain is tenant-scoped (site_id); a change to any node affects ALL merchants on the shared schema — isolation is RLS + verifySiteOwnership, not per-merchant deploys.',
    whichMerchantDependsOnX: 'All active stores depend on every chain node — LetBuyy is single-deploy multi-tenant; per-merchant feature flags live in operational_feature_flags, not separate code paths.',
    summary: { nodes: chain.length, tenantTables: chain.reduce((a, c) => a + c.tenantTables, 0),
      moneyNodes: chain.filter((c) => c.money).map((c) => c.key) },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const g = (f) => existsSync(join(ROOT, 'graphify-out', f)) ? JSON.parse(readFileSync(join(ROOT, 'graphify-out', f), 'utf8')) : null;
  console.log(JSON.stringify(buildMerchantOperatingGraph(g('domain-intel.json'), g('db-intel.json')), null, 2));
}

#!/usr/bin/env node
// LetBuyy Merchant Intelligence (LCIS v3, Phase 4) — maps the merchant lifecycle
// Merchant → Store → Products → Orders → Payments → Shipping → GST → Gift Cards → Themes
// onto the discovered domain graph. Pure (takes loaded domain-intel).
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const STAGES = ['merchant', 'products', 'collections', 'inventory', 'orders', 'payments', 'refunds', 'payouts', 'shipping', 'gst', 'discounts', 'gift-cards', 'themes', 'analytics'];

export function buildMerchantIntel(di) {
  if (!di) return { error: 'domain-intel.json missing — run pnpm graph:domain' };
  const stages = STAGES.map((k) => {
    const d = di.domains.find((x) => x.key === k);
    if (!d) return null;
    return { stage: d.label, key: d.key,
      apps: d.apps, routes: d.routes.length, rpcs: d.rpcs.length, tables: d.tables.length,
      dependsOn: d.dependsOn.map((x) => x.domain), owners: d.owners, money: d.money };
  }).filter(Boolean);
  const merchantFacingApps = [...new Set(stages.flatMap((s) => s.apps))];
  return {
    funnel: STAGES,
    stages,
    merchantFacingApps,
    summary: { stages: stages.length, totalRoutes: stages.reduce((a, s) => a + s.routes, 0),
      totalRpcs: stages.reduce((a, s) => a + s.rpcs, 0), totalTables: stages.reduce((a, s) => a + s.tables, 0) },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const g = (f) => existsSync(join(ROOT, 'graphify-out', f)) ? JSON.parse(readFileSync(join(ROOT, 'graphify-out', f), 'utf8')) : null;
  console.log(JSON.stringify(buildMerchantIntel(g('domain-intel.json')), null, 2));
}

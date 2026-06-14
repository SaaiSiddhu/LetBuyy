#!/usr/bin/env node
// LCIS Omega — Merchant Adoption Engine (Phase 2). Feature-adoption MODEL over real tables.
import { loadIntel, pickTables, writeOut, LIVE, nowStamp } from './omega-lib.mjs';

export function buildMerchantAdoption() {
  const { db } = loadIntel();
  if (!db) return { error: 'db-intel.json missing' };
  const features = [
    { name: 'feature flags', signal: 'enabled operational flags per site', sources: pickTables(db, ['operational_feature_flags', 'operational_feature_flag_exposures']) },
    { name: 'catalog', signal: 'products published', sources: pickTables(db, ['products', 'collections', 'metafields']) },
    { name: 'theme customization', signal: 'theme drafts/instances edited', sources: pickTables(db, ['store_themes', 'theme_instances', 'theme_editor_drafts']) },
    { name: 'gift cards', signal: 'gift-card program active', sources: pickTables(db, ['gift_card_accounts']) },
    { name: 'payments configured', signal: 'payment credentials set', sources: pickTables(db, ['payment_credentials', 'payment_tokens']) },
    { name: 'shipping configured', signal: 'shipping zones/rates set', sources: pickTables(db, ['shipping_zones', 'shipping_rates']) },
    { name: 'entitlements', signal: 'plan entitlements consumed', sources: pickTables(db, ['plan_entitlements', 'site_entitlement_overrides', 'usage_meter_entries']) },
  ].filter((f) => f.sources.length);
  const detectors = {
    adoptionScore: { metric: '% of available features activated per site', source: features.map((f) => f.sources[0]).join(', '), query: 'count active features / total per site', value: LIVE },
    underAdopted: { metric: 'sites using < N core features', source: 'operational_feature_flags by site', query: 'adoption < threshold', value: LIVE },
  };
  return { summary: { features: features.length, sourceTables: [...new Set(features.flatMap((f) => f.sources))].length, detectors: Object.keys(detectors).length, liveDataNote: 'Adoption % requires live per-site flag/config rows; the feature model is repository truth.', generatedAt: nowStamp(db) }, model: { features }, detectors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = buildMerchantAdoption(); writeOut('merchant-adoption.json', i);
  if (i.error) { console.error(i.error); process.exit(1); }
  console.log('\nMerchant Adoption Engine —', i.summary.features, 'features tracked · % query-bound → graphify-out/merchant-adoption.json');
}

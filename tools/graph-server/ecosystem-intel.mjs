#!/usr/bin/env node
// LetBuyy OS (V7 master) — Ecosystem Intelligence: Theme (P13), App Marketplace (P14) and
// Developer Platform (P15) layers, modeled from the REAL schema. These three domains are FROZEN
// (not deploy targets) per governance — the schema exists; usage/installs/performance are live rows
// (query-bound). One module, three layers. Output: graphify-out/ecosystem-intel.json
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;
const LIVE = 'live-query-required';

function layer(db, key, label, frozen, tableRe, rpcRe, capabilities, risks) {
  const tables = db.tables.filter((t) => tableRe.test(t.name)).map((t) => t.name);
  const rpcs = db.functions.filter((f) => rpcRe.test(f.name)).map((f) => f.name);
  return {
    key, label, frozen,
    summary: { tables: tables.length, rpcs: rpcs.length, capabilities: capabilities.length,
      frozenStatus: frozen, liveDataNote: `${label} usage/installs/performance/health are live site-scoped rows (query-bound). The schema + capabilities are repository truth. This domain is FROZEN (not a deploy target).` },
    surface: { tables, rpcs },
    capabilities: capabilities.map((c) => ({ ...c, tables: c.tables.filter((t) => tables.includes(t)) })),
    risk: risks,
  };
}

export function buildEcosystemIntel() {
  const db = g('db-intel.json'), di = g('domain-intel.json');
  if (!db) return { error: 'db-intel.json missing — run pnpm graph:db' };
  const owner = (k) => di?.domains.find((d) => d.key === k)?.owners || ['@saai-sidd'];

  const theme = layer(db, 'themes', 'Theme Marketplace', true,
    /theme/, /theme/,
    [
      { capability: 'Rendering', detail: 'Liquid/JSON render with locked sanitizer (ART-17: no new React sections)', tables: ['theme_renderer_manifests', 'theme_schema_manifests', 'theme_layouts', 'theme_templates', 'theme_section_definitions', 'theme_block_definitions'] },
      { capability: 'Versioning', detail: 'releases, package versions, migrations', tables: ['theme_releases', 'theme_package_versions', 'theme_packages', 'theme_migrations'] },
      { capability: 'Marketplace', detail: 'purchases, reviews, presets', tables: ['theme_purchases', 'theme_reviews', 'theme_presets'] },
      { capability: 'Editing', detail: 'editor drafts, draft patches, instance drafts, preview sessions', tables: ['theme_editor_drafts', 'theme_draft_patches', 'theme_instance_drafts', 'theme_preview_sessions'] },
      { capability: 'Developer', detail: 'developer listings + payout accounts', tables: ['theme_developer_listings', 'theme_developer_payout_accounts'] },
    ],
    [{ id: 'TH-1', risk: 'theme-marketplace FROZEN — not a deploy target; ARB to activate', severity: 'info' },
     { id: 'TH-2', risk: 'sanitizer is locked (FORBID lists, outputEscape:escape); new React-per-section forbidden post-freeze (ART-17)', severity: 'governance' }]);
  theme.usage = { installs: { source: 'store_themes / theme install_count', value: LIVE }, performance: { source: 'render telemetry (RUNTIME_TELEMETRY)', value: LIVE }, compatibility: { source: 'theme_schema_manifests version checks', value: LIVE }, owners: owner('themes') };

  const apps = layer(db, 'apps', 'App Marketplace', true,
    /^app_|marketplace|extension/, /app_|install|extension/,
    [
      { capability: 'Installation', detail: 'install lifecycle + uninstall feedback', tables: ['app_installations', 'app_uninstall_feedback'] },
      { capability: 'Extensions', detail: 'extension + function registrations', tables: ['app_extensions', 'app_extension_registrations', 'app_function_registrations'] },
      { capability: 'Webhooks', detail: 'app webhooks (HMAC-signed)', tables: ['app_webhooks'] },
      { capability: 'Billing', detail: 'charges, pricing plans, usage meters, spend controls', tables: ['app_billing_charges', 'app_pricing_plans', 'app_usage_events', 'app_usage_meter_rollups', 'app_spend_controls'] },
      { capability: 'Reviews & discovery', detail: 'reviews, collections, featured placements, discovery events', tables: ['app_reviews', 'marketplace_review_records', 'app_collections', 'app_collection_items', 'app_featured_placements', 'app_discovery_events'] },
      { capability: 'Versions & developers', detail: 'app versions + developer accounts', tables: ['app_versions', 'app_developers'] },
    ],
    [{ id: 'AP-1', risk: 'app-marketplace FROZEN — not a deploy target; ARB to activate', severity: 'info' },
     { id: 'AP-2', risk: 'app webhooks are external attack surface — HMAC verify server-side', severity: 'security' }]);
  apps.permissionsScopes = { source: 'oauth_clients/oauth_grants + app scopes', note: 'apps authorize via OAuth scopes; permissions in employee_permissions/site_role_permissions', value: LIVE };
  apps.usage = { installations: { source: 'app_installations / app install_count', value: LIVE }, health: { source: 'app_webhooks delivery + app_usage_events', value: LIVE }, owners: owner('marketplace') };

  const dev = layer(db, 'developer', 'Developer Platform', true,
    /developer|oauth|api_client|api_key|sdk/, /oauth|api_client|developer/,
    [
      { capability: 'OAuth / PKCE', detail: 'oauth clients + grants (PKCE)', tables: ['oauth_clients', 'oauth_grants'] },
      { capability: 'API clients', detail: 'per-site API clients', tables: ['site_api_clients'] },
      { capability: 'Developer profiles', detail: 'developer profiles + app/theme developer accounts', tables: ['developer_profiles', 'app_developers', 'theme_developer_listings'] },
      { capability: 'Payouts', detail: 'theme developer payout accounts', tables: ['theme_developer_payout_accounts'] },
    ],
    [{ id: 'DV-1', risk: 'developer-portal FROZEN — OAuth/PKCE require ARB to activate', severity: 'info' },
     { id: 'DV-2', risk: 'rate limits are central (Upstash Redis) — live, NOT CONNECTED from repo', severity: 'info' }]);
  dev.rateLimits = { source: 'Upstash Redis (UPSTASH_REDIS_*)', value: LIVE, status: 'NOT CONNECTED' };
  dev.usage = { apiCalls: { source: 'RUNTIME_TELEMETRY per api-client', value: LIVE }, owners: owner('developer') };

  const layers = { themes: theme, apps, developer: dev };
  return {
    summary: { layers: 3, allFrozen: true,
      themeTables: theme.summary.tables, appTables: apps.summary.tables, developerTables: dev.summary.tables,
      note: 'All three ecosystem domains are FROZEN (not deploy targets). Schema + capabilities are repository truth; usage/installs/health are live (query-bound).',
      generatedAt: db.summary.generatedAt },
    layers,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildEcosystemIntel();
  if (intel.error) { console.error(intel.error); process.exit(1); }
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'ecosystem-intel.json'), JSON.stringify(intel));
  const s = intel.summary;
  console.log('\nLetBuyy Ecosystem Intelligence (V7) — Theme / Apps / Developer (all FROZEN)');
  console.log(`  themes ${s.themeTables} tables · apps ${s.appTables} tables · developer ${s.developerTables} tables`);
  console.log(`  capabilities: theme ${intel.layers.themes.capabilities.length}, apps ${intel.layers.apps.capabilities.length}, dev ${intel.layers.developer.capabilities.length}`);
  console.log('  → graphify-out/ecosystem-intel.json');
}

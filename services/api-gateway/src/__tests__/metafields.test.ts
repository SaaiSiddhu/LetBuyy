import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

test('metafields migration creates tenant-scoped definition and value tables', () => {
  const migration = source('database/supabase/migrations/138_mobile_store_metafields.sql');

  assert.match(migration, /Writer: services\/api-gateway\/src\/routes\/metafields\.ts/);
  for (const table of ['store_metafield_definitions', 'store_metafield_values']) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(migration, new RegExp(`CREATE POLICY ${table}.*site_owner_all`, 's'));
    assert.match(migration, new RegExp(`update_${table}_updated_at`));
    assert.match(migration, /public\.update_updated_at\(\)/);
  }
});

test('metafields route owns custom data read and mutation contract', () => {
  const route = source('services/api-gateway/src/routes/metafields.ts');
  const gateway = source('services/api-gateway/src/index.ts');
  const ownership = source('scripts/validators/route-ownership-validator.mjs');

  assert.match(gateway, /api\.route\('\/metafields', metafieldsRouter\)/);
  assert.match(route, /router\.get\('\/definitions'/);
  assert.match(route, /router\.post\('\/definitions'/);
  assert.match(route, /router\.patch\('\/definitions\/:definitionId'/);
  assert.match(route, /router\.delete\('\/definitions\/:definitionId'/);
  assert.match(route, /router\.get\('\/values'/);
  assert.match(route, /router\.put\('\/values'/);
  assert.match(route, /router\.delete\('\/values\/:valueId'/);
  assert.match(route, /resolveOwnedMetafieldStore/);
  assert.match(route, /\.from\('store_metafield_definitions'\)/);
  assert.match(route, /\.from\('store_metafield_values'\)/);
  assert.doesNotMatch(route, /S-026|SKIP-NEEDS-BACKEND|backend contract/i);
  for (const table of ['store_metafield_definitions', 'store_metafield_values']) {
    assert.match(ownership, new RegExp(`'${table}'`));
  }
  assert.match(ownership, /resolveOwnedMetafieldStore/);
});

test('clients and mobile app expose metafields without the S-026 blocked seam', () => {
  const bff = source('services/mobile-bff/src/index.ts');
  const tsClient = source('packages/typescript/api-client/src/index.ts');
  const dartClient = source('packages/dart/api_client/lib/src/api_client.dart');
  const routes = source('apps/mobile/merchant-app/lib/app/routes.dart');
  const service = source('apps/mobile/merchant-app/lib/services/metafield_service.dart');
  const screen = source('apps/mobile/merchant-app/lib/screens/settings/custom_data_screen.dart');
  const blocked = source('apps/mobile/merchant-app/lib/services/platform_blocked_service.dart');
  const features = source('apps/mobile/merchant-app/lib/screens/parity/merchant_feature_definitions.dart');

  assert.match(bff, /'\/v1\/metafields'/);
  assert.match(tsClient, /readonly metafields = \{/);
  assert.match(tsClient, /CreateStoreMetafieldDefinitionInput/);
  assert.match(tsClient, /UpsertStoreMetafieldValueInput/);
  assert.match(dartClient, /class MetafieldsApi/);
  assert.match(dartClient, /Future<List<JsonMap>> listDefinitions/);
  assert.match(service, /fetchDefinitions/);
  assert.match(service, /StoreMetafieldsSummary/);
  assert.match(routes, /CustomDataScreen/);
  assert.match(screen, /Custom Data/);
  assert.doesNotMatch(blocked, /MOBILE_CUSTOM_DATA|S-026/);
  assert.match(features, /endpoint: 'metafields'/);
});

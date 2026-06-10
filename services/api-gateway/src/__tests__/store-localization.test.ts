import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

test('store localization migration creates tenant-scoped market, locale, and translation tables', () => {
  const migration = source('database/supabase/migrations/137_mobile_storefront_localization.sql');

  assert.match(migration, /Writer: services\/api-gateway\/src\/routes\/stores-localization\.ts/);
  for (const table of ['store_markets', 'storefront_locales', 'storefront_translations']) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(migration, new RegExp(`CREATE POLICY ${table}.*site_owner_all`, 's'));
    assert.match(migration, new RegExp(`update_${table}_updated_at`));
    assert.match(migration, /public\.update_updated_at\(\)/);
  }
});

test('stores route owns storefront localization read and mutation contract', () => {
  const route = source('services/api-gateway/src/routes/stores-localization.ts');
  const storesRoute = source('services/api-gateway/src/routes/stores.ts');
  const ownership = source('scripts/validators/route-ownership-validator.mjs');

  assert.match(storesRoute, /registerStoreLocalizationRoutes\(router\)/);
  assert.match(route, /router\.get\('\/:id\/localization'/);
  assert.match(route, /router\.patch\('\/:id\/localization'/);
  assert.match(route, /router\.post\('\/:id\/localization\/markets'/);
  assert.match(route, /router\.patch\('\/:id\/localization\/markets\/:marketId'/);
  assert.match(route, /router\.delete\('\/:id\/localization\/markets\/:marketId'/);
  assert.match(route, /router\.post\('\/:id\/localization\/locales'/);
  assert.match(route, /router\.post\('\/:id\/localization\/translations'/);
  assert.match(route, /resolveOwnedLocalizationStore/);
  assert.match(route, /\.from\('store_markets'\)/);
  assert.match(route, /\.from\('storefront_locales'\)/);
  assert.match(route, /\.from\('storefront_translations'\)/);
  assert.doesNotMatch(route, /S-025|SKIP-NEEDS-BACKEND|backend contract/i);
  for (const table of ['store_markets', 'storefront_locales', 'storefront_translations']) {
    assert.match(ownership, new RegExp(`'${table}'`));
  }
});

test('clients and mobile app expose localization without the S-025 blocked seam', () => {
  const bff = source('services/mobile-bff/src/index.ts');
  const tsClient = source('packages/typescript/api-client/src/index.ts');
  const dartClient = source('packages/dart/api_client/lib/src/api_client.dart');
  const routes = source('apps/mobile/merchant-app/lib/app/routes.dart');
  const service = source('apps/mobile/merchant-app/lib/services/store_service.dart');
  const screen = source('apps/mobile/merchant-app/lib/screens/settings/localization_markets_screen.dart');
  const blocked = source('apps/mobile/merchant-app/lib/services/platform_blocked_service.dart');

  assert.match(bff, /'\/v1\/stores'/);
  assert.match(tsClient, /localization: \{/);
  assert.match(tsClient, /createMarket/);
  assert.match(tsClient, /createLocale/);
  assert.match(tsClient, /createTranslation/);
  assert.match(dartClient, /Future<JsonMap> localization/);
  assert.match(dartClient, /Future<JsonMap> createMarket/);
  assert.match(service, /fetchLocalization/);
  assert.match(service, /StoreLocalizationSummary/);
  assert.match(routes, /LocalizationMarketsScreen/);
  assert.match(routes, /path:\s*'\/features\/localization-markets'/);
  assert.match(screen, /Localization & Markets/);
  assert.doesNotMatch(blocked, /MOBILE_LOCALIZATION_MARKETS|S-025/);
  assert.equal(existsSync('apps/mobile/merchant-app/lib/screens/parity/merchant_feature_definitions.dart'), false);
});

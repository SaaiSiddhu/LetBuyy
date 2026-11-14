import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const THEME_BUNDLE_SOURCE = 'packages/theme-engine/src/theme-bundle.ts';
const THEME_SCHEMA_ADAPTER_SOURCE = 'services/api-gateway/src/execution/schema-registry-execution.adapter.ts';
const THEME_EXECUTION_ADAPTER_SOURCE = 'services/api-gateway/src/execution/theme-execution.adapter.ts';
const THEME_ROUTE_SOURCE = 'services/api-gateway/src/routes/themes.ts';
const STOREFRONT_STORE_SERVICE_SOURCE = 'apps/commerce/web/src/lib/store-service.ts';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('portable upload schema accepts Liquid bundles through the existing theme package upload route', () => {
  const bundleSource = read(THEME_BUNDLE_SOURCE);
  const routeSource = read(THEME_ROUTE_SOURCE);

  assert.match(bundleSource, /bundle: PortableThemePackageBundleSchema/);
  assert.match(bundleSource, /export const UploadPortableThemePackageSchema = UploadThemePackageSchema/);
  assert.match(routeSource, /UploadThemePackageSchema/);
  assert.match(routeSource, /portable JSON-contract\/Liquid schema registry/);
});

test('Liquid package uploads persist a full versioned bundle manifest', () => {
  const bundleSource = read(THEME_BUNDLE_SOURCE);
  const adapterSource = read(THEME_SCHEMA_ADAPTER_SOURCE);

  assert.match(bundleSource, /export function buildLiquidThemePackagePersistencePayload/);
  assert.match(bundleSource, /package_manifest: \{/);
  assert.match(bundleSource, /liquidBundle: bundle/);
  assert.match(bundleSource, /themeBundle: bundle/);
  assert.match(bundleSource, /bundle_paths: LIQUID_THEME_BUNDLE_PATHS/);
  assert.match(adapterSource, /parsePortableThemePackageBundle\(input\)/);
  assert.match(adapterSource, /buildPortableThemePackagePersistencePayload\(bundle\)/);
  assert.match(adapterSource, /rendererEngine: liquid \? 'liquid' : 'json-contract'/);
});

test('installed Liquid themes publish immutable release artifacts the storefront can resolve', () => {
  const executionSource = read(THEME_EXECUTION_ADAPTER_SOURCE);
  const storeServiceSource = read(STOREFRONT_STORE_SERVICE_SOURCE);

  assert.match(executionSource, /LiquidThemePackageBundleSchema\.safeParse\(candidate\)/);
  assert.match(executionSource, /renderer_engine: rendererEngine/);
  assert.match(executionSource, /liquid_ready: Boolean\(liquidBundle\)/);
  assert.match(executionSource, /liquidBundle,/);
  assert.match(executionSource, /themeBundle: liquidBundle/);
  assert.match(storeServiceSource, /LiquidThemePackageBundleSchema\.safeParse\(templateConfig\.liquidBundle\)/);
  assert.match(storeServiceSource, /liquidBundle,/);
  assert.match(storeServiceSource, /releaseManifest/);
});

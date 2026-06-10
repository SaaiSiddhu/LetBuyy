import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(testDir, '../..');

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

test('mobile app bridge sessions expose a signed host policy', () => {
  const sharedTypes = read('packages/shared-types/src/index.ts');
  const appPlatform = read('packages/shared-types/src/app-platform.ts');
  const gatewayRoute = read('services/api-gateway/src/routes/app-store/extension-routes.ts');
  const gatewayPackage = read('services/api-gateway/package.json');
  const gatewayManifest = read('services/api-gateway/runtime.manifest.json');

  assert.match(sharedTypes, /MobileAdminAppBridgeHostPolicySchema/);
  assert.match(sharedTypes, /mobile_host:\s*MobileAdminAppBridgeHostPolicySchema\.optional\(\)/);
  assert.match(appPlatform, /createMobileAdminAppBridgeHostPolicy/);
  assert.match(appPlatform, /token_transport:\s*'native_bridge'/);
  assert.match(gatewayRoute, /createMobileAdminAppBridgeHostPolicy/);
  assert.match(gatewayRoute, /from '@letbuyy\/shared-types'/);
  assert.match(gatewayRoute, /mobile_host:\s*createMobileAdminAppBridgeHostPolicy/);
  assert.match(gatewayPackage, /"@letbuyy\/shared-types":\s*"workspace:\*"/);
  assert.match(gatewayManifest, /"@letbuyy\/shared-types"/);
});

test('merchant mobile app runs installed apps in a WebView bridge host', () => {
  const service = read('apps/mobile/merchant-app/lib/services/app_marketplace_service.dart');
  const screen = read('apps/mobile/merchant-app/lib/screens/apps/app_bridge_runtime_screen.dart');
  const appsScreen = read('apps/mobile/merchant-app/lib/screens/apps/apps_screen.dart');
  const blockedService = read('apps/mobile/merchant-app/lib/services/platform_blocked_service.dart');

  assert.match(service, /class AppBridgeRuntimeSessionContract/);
  assert.match(service, /createEmbeddedAppBridgeRuntime/);
  assert.match(service, /appStore\.bridgeFetch/);
  assert.doesNotMatch(service, /MOBILE_EMBEDDED_APP_BRIDGE_RUNTIME/);
  assert.match(screen, /WebViewController/);
  assert.match(screen, /addJavaScriptChannel/);
  assert.match(screen, /appBridge/);
  assert.match(screen, /fetchEmbeddedBridgeData/);
  assert.match(appsScreen, /AppBridgeRuntimeScreen/);
  assert.match(appsScreen, /openEmbeddedAppBridgeRuntime/);
  assert.match(appsScreen, /_openInstalledExternally/);
  assert.match(appsScreen, /LaunchMode\.externalApplication/);
  assert.doesNotMatch(blockedService, /S-027/);
  assert.doesNotMatch(blockedService, /MOBILE_EMBEDDED_APP_BRIDGE_RUNTIME/);
  assert.equal(existsSync(join(repoRoot, 'apps/mobile/merchant-app/lib/screens/parity/merchant_feature_definitions.dart')), false);
  assert.equal(existsSync(join(repoRoot, 'apps/mobile/merchant-app/lib/screens/parity/merchant_feature_screen.dart')), false);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const APP_ENGINE_SOURCE = 'packages/app-engine/src/index.ts';
const APP_STORE_ROUTE_SOURCE = 'services/api-gateway/src/routes/app-store.ts';
const EXTENSION_HOST_SOURCE = 'packages/extension-host/src/index.ts';
const EMBEDDED_BRIDGE_CLIENT_SOURCE = 'apps/merchant-control-plane/src/components/apps/EmbeddedAppBridgeClient.tsx';
const EMBEDDED_APP_PAGE_SOURCE = 'apps/merchant-control-plane/src/app/[store]/apps/[installationId]/page.tsx';
const SHARED_TYPES_SOURCE = 'packages/shared-types/src/index.ts';

function createZodStub() {
  const zChain = new Proxy(function zChain() {}, {
    get: () => zChain,
    apply: () => zChain,
  });

  const z = new Proxy(function z() {}, {
    get: () => () => zChain,
    apply: () => zChain,
  });

  return { z, zChain };
}

function loadTypeScriptModule(sourcePath, requireMap) {
  const source = readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require(specifier) {
      if (specifier in requireMap) return requireMap[specifier];
      throw new Error(`Unexpected test require from ${sourcePath}: ${specifier}`);
    },
    URL,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
  };

  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath });
  return module.exports;
}

const { z, zChain } = createZodStub();
const appEngine = loadTypeScriptModule(APP_ENGINE_SOURCE, {
  zod: { z },
  '@letbuyy/shared-types': { UuidSchema: zChain },
});
const extensionHost = loadTypeScriptModule(EXTENSION_HOST_SOURCE, {});

test('admin app bridge resolves installed app embed surfaces safely', () => {
  const stagingUrl = 'https://merchant.staging.letbuyy.store/example-app-bridge.html';
  const exampleInstallation = appEngine.createExampleAdminAppInstallation(stagingUrl);
  const stagingSurface = appEngine.normalizeAppAdminEmbedSurface(exampleInstallation);

  assert.equal(stagingSurface.url, stagingUrl);
  assert.equal(stagingSurface.origin, 'https://merchant.staging.letbuyy.store');
  assert.equal(stagingSurface.title, 'Example App');
  assert.deepEqual(Array.from(stagingSurface.capabilities), ['api.fetch', 'toast', 'resize']);

  const insecureSurface = appEngine.normalizeAppAdminEmbedSurface(
    appEngine.createExampleAdminAppInstallation('http://partner.example.com/example-app-bridge.html'),
  );
  assert.equal(insecureSurface, null);

  const productionSurface = appEngine.normalizeAppAdminEmbedSurface({
    id: 'install_prod',
    app_id: 'app_prod',
    store_id: 'site_prod',
    scopes_granted: ['read_products'],
    config: {
      admin_embed: {
        url: 'https://apps.example.com/merchant',
        label: 'Production app',
        capabilities: ['api.fetch', 'toast', 'navigation.redirect', 'unsafe.scope'],
      },
    },
    marketplace_apps: {
      id: 'app_prod',
      name: 'Production App',
      slug: 'production-app',
      app_url: 'https://apps.example.com',
    },
  });

  assert.equal(productionSurface.url, 'https://apps.example.com/merchant');
  assert.equal(productionSurface.origin, 'https://apps.example.com');
  assert.equal(productionSurface.label, 'Production app');
  assert.deepEqual(Array.from(productionSurface.capabilities), ['api.fetch', 'toast', 'navigation.redirect']);
});

test('admin app bridge sends iframe API calls through the gateway with the app session token', () => {
  const bridgeClient = readFileSync(EMBEDDED_BRIDGE_CLIENT_SOURCE, 'utf8');
  const appStoreRoute = readFileSync(APP_STORE_ROUTE_SOURCE, 'utf8');
  const sharedTypes = readFileSync(SHARED_TYPES_SOURCE, 'utf8');

  assert.match(sharedTypes, /api_base_url: UrlSchema/);
  assert.match(bridgeClient, /\/app-store\/bridge\/fetch/);
  assert.match(bridgeClient, /Authorization: `\$\{session\.bridge\.token_type\} \$\{session\.bridge\.access_token\}`/);
  assert.doesNotMatch(bridgeClient, /api_base_path: `\/api\/stores/);

  assert.match(appStoreRoute, /\/bridge\/fetch/);
  assert.match(appStoreRoute, /verifyAppScopedAccessToken/);
  assert.match(appStoreRoute, /createLetbuyyInternalIdentityHeaders/);
  assert.match(appStoreRoute, /Bridge request path is not allowed/);
});

test('WS13 X2 admin UI extension host normalizes registered extensions and enforces sandbox policy', () => {
  const extensionHostSource = readFileSync(EXTENSION_HOST_SOURCE, 'utf8');
  const bridgeClient = readFileSync(EMBEDDED_BRIDGE_CLIENT_SOURCE, 'utf8');
  const embeddedAppPage = readFileSync(EMBEDDED_APP_PAGE_SOURCE, 'utf8');

  for (const marker of [
    'LETBUYY_EXTENSION_HOST_VERSION',
    'ADMIN_EXTENSION_IFRAME_SANDBOX',
    'listEnabledAdminUiExtensions',
    'createAdminUiExtensionFramePolicy',
    'createAdminUiExtensionBridgeContext',
  ]) {
    assert.ok(extensionHostSource.includes(marker), `extension-host package is missing ${marker}`);
  }

  const normalized = extensionHost.normalizeAdminUiExtensionRegistration({
    id: 'reg_admin_001',
    site_id: 'site_001',
    app_id: 'app_001',
    installation_id: 'install_001',
    extension_handle: 'rewards-panel',
    extension_type: 'dashboard_widget',
    surface: 'admin.ui',
    target: 'admin.dashboard.widget',
    renderer: 'iframe',
    source_url: 'https://apps.example.com/admin/rewards',
    scopes: ['read_products'],
    capabilities: ['api.fetch', 'toast', 'unsafe.scope'],
    settings: { title: 'Rewards panel' },
    manifest_schema_version: '2026-06-05.ws13',
    status: 'enabled',
    sort_order: 2,
  });

  assert.equal(normalized.title, 'Rewards panel');
  assert.equal(normalized.origin, 'https://apps.example.com');
  assert.equal(normalized.target, 'admin.dashboard.widget');
  assert.deepEqual(Array.from(normalized.capabilities), ['api.fetch', 'toast']);

  const rejectedSurface = extensionHost.normalizeAdminUiExtensionRegistration({
    ...normalized,
    id: 'reg_checkout',
    surface: 'checkout.ui',
  });
  assert.equal(rejectedSurface, null);

  const rejectedUrl = extensionHost.normalizeAdminUiExtensionRegistration({
    ...normalized,
    id: 'reg_http',
    source_url: 'http://apps.example.com/admin/rewards',
  });
  assert.equal(rejectedUrl, null);

  const policy = extensionHost.createAdminUiExtensionFramePolicy();
  assert.equal(policy.sandbox, 'allow-forms allow-popups allow-same-origin allow-scripts');
  assert.equal(policy.referrerPolicy, 'no-referrer');

  assert.match(bridgeClient, /@letbuyy\/extension-host/);
  assert.match(bridgeClient, /listEnabledAdminUiExtensions\(adminExtensions\)/);
  assert.match(bridgeClient, /sandbox=\{framePolicy\.sandbox\}/);
  assert.match(bridgeClient, /referrerPolicy=\{framePolicy\.referrerPolicy\}/);
  assert.match(embeddedAppPage, /appStore\.extensionRegistry/);
  assert.match(embeddedAppPage, /adminExtensions=\{registry\?\.extensions \|\| \[\]\}/);
});

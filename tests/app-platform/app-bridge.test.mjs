import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const APP_ENGINE_SOURCE = 'packages/app-engine/src/index.ts';
const APP_STORE_ROUTE_SOURCE = 'services/api-gateway/src/routes/app-store.ts';
const STOREFRONT_ROUTE_SOURCE = 'services/api-gateway/src/routes/storefront.ts';
const EXTENSION_HOST_SOURCE = 'packages/extension-host/src/index.ts';
const EMBEDDED_BRIDGE_CLIENT_SOURCE = 'apps/merchant-control-plane/src/components/apps/EmbeddedAppBridgeClient.tsx';
const EMBEDDED_APP_PAGE_SOURCE = 'apps/merchant-control-plane/src/app/[store]/apps/[installationId]/page.tsx';
const CHECKOUT_EXTENSION_HOST_SOURCE = 'apps/storefront-runtime/src/components/checkout-extensions/CheckoutExtensionHost.tsx';
const CHECKOUT_CLIENT_SOURCE = 'apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx';
const CHECKOUT_PAGE_SOURCE = 'apps/storefront-runtime/src/app/store/[subdomain]/checkout/page.tsx';
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

test('WS13 X3 checkout UI extension host normalizes public registrations and mounts checkout targets', () => {
  const extensionHostSource = readFileSync(EXTENSION_HOST_SOURCE, 'utf8');
  const checkoutHostSource = readFileSync(CHECKOUT_EXTENSION_HOST_SOURCE, 'utf8');
  const checkoutClientSource = readFileSync(CHECKOUT_CLIENT_SOURCE, 'utf8');
  const checkoutPageSource = readFileSync(CHECKOUT_PAGE_SOURCE, 'utf8');
  const storefrontRouteSource = readFileSync(STOREFRONT_ROUTE_SOURCE, 'utf8');
  const apiClientSource = readFileSync('packages/typescript/api-client/src/index.ts', 'utf8');
  const sharedTypes = readFileSync(SHARED_TYPES_SOURCE, 'utf8');

  for (const marker of [
    'CHECKOUT_UI_EXTENSION_TARGETS',
    'CHECKOUT_EXTENSION_IFRAME_SANDBOX',
    'listEnabledCheckoutUiExtensions',
    'createCheckoutUiExtensionFramePolicy',
    'createCheckoutUiExtensionBridgeContext',
  ]) {
    assert.ok(extensionHostSource.includes(marker), `extension-host package is missing ${marker}`);
  }

  const normalized = extensionHost.normalizeCheckoutUiExtensionRegistration({
    id: 'reg_checkout_001',
    site_id: 'site_001',
    app_id: 'app_001',
    installation_id: 'install_001',
    extension_handle: 'delivery-note',
    extension_type: 'checkout_extension',
    surface: 'checkout.ui',
    target: 'checkout.shipping-options.render-after',
    renderer: 'iframe',
    source_url: 'https://apps.example.com/checkout/delivery-note',
    scopes: ['read_checkout'],
    capabilities: ['api.fetch', 'toast', 'resize'],
    settings: { title: 'Delivery note' },
    manifest_schema_version: '2026-06-05.ws13',
    status: 'enabled',
    sort_order: 1,
  });

  assert.equal(normalized.title, 'Delivery note');
  assert.equal(normalized.origin, 'https://apps.example.com');
  assert.equal(normalized.target, 'checkout.shipping-options.render-after');
  assert.deepEqual(Array.from(normalized.capabilities), ['toast', 'resize']);

  const rejectedAdmin = extensionHost.normalizeCheckoutUiExtensionRegistration({
    ...normalized,
    id: 'reg_admin',
    surface: 'admin.ui',
  });
  assert.equal(rejectedAdmin, null);

  const rejectedUrl = extensionHost.normalizeCheckoutUiExtensionRegistration({
    ...normalized,
    id: 'reg_http',
    source_url: 'http://apps.example.com/checkout/delivery-note',
  });
  assert.equal(rejectedUrl, null);

  const policy = extensionHost.createCheckoutUiExtensionFramePolicy();
  assert.equal(policy.sandbox, 'allow-forms allow-popups allow-scripts');
  assert.equal(policy.referrerPolicy, 'no-referrer');

  assert.match(sharedTypes, /StorefrontCheckoutExtensionRegistryResponseSchema/);
  assert.match(apiClientSource, /checkoutExtensions: \(subdomain: string/);
  assert.match(storefrontRouteSource, /\/:subdomain\/checkout\/extensions/);
  assert.match(storefrontRouteSource, /\.from\('app_extension_registrations'\)/);
  assert.match(storefrontRouteSource, /\.eq\('site_id', store\.id\)/);
  assert.match(storefrontRouteSource, /\.eq\('surface', 'checkout\.ui'\)/);
  assert.match(storefrontRouteSource, /\.eq\('status', 'enabled'\)/);

  assert.match(checkoutHostSource, /@letbuyy\/extension-host/);
  assert.match(checkoutHostSource, /sandbox=\{framePolicy\.sandbox\}/);
  assert.match(checkoutHostSource, /letbuyy\.checkout\.extension\.context/);
  assert.match(checkoutHostSource, /letbuyy\.checkout\.extension\.resize/);
  assert.match(checkoutPageSource, /storefront\.checkoutExtensions\(subdomain\)/);
  for (const target of [
    'checkout.contact.render-after',
    'checkout.shipping-options.render-after',
    'checkout.payment-options.render-after',
    'checkout.order-summary.render-after',
  ]) {
    assert.match(checkoutClientSource, new RegExp(`target="${target}"`));
  }
});

test('WS13 X4 theme app blocks load from the per-store extension registry into WS11 slots', () => {
  const storefrontRouteSource = readFileSync(STOREFRONT_ROUTE_SOURCE, 'utf8');

  assert.match(storefrontRouteSource, /function loadRegisteredThemeAppBlocks/);
  assert.match(storefrontRouteSource, /function appBlockFromRegistryRegistration/);
  assert.match(storefrontRouteSource, /\.from\('app_extension_registrations'\)/);
  assert.match(storefrontRouteSource, /\.eq\('site_id', storeId\)/);
  assert.match(storefrontRouteSource, /\.eq\('surface', 'theme\.app_block'\)/);
  assert.match(storefrontRouteSource, /\.eq\('status', 'enabled'\)/);
  assert.match(storefrontRouteSource, /normalizeAppBlockInstance\(\{/);
  assert.match(storefrontRouteSource, /source_entrypoint: storefrontString\(registration\.source_entrypoint\)/);
  assert.match(storefrontRouteSource, /loadLegacyStorefrontAppBlocks/);
  assert.match(storefrontRouteSource, /for \(const block of registeredBlocks\) merged\.set\(block\.id, block\)/);
  assert.match(storefrontRouteSource, /app_blocks: appBlocks/);
});

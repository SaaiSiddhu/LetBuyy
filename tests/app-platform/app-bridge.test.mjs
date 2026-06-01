import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const APP_ENGINE_SOURCE = 'packages/app-engine/src/index.ts';
const APP_STORE_ROUTE_SOURCE = 'services/api-gateway/src/routes/app-store.ts';
const EMBEDDED_BRIDGE_CLIENT_SOURCE = 'apps/merchant-control-plane/src/components/apps/EmbeddedAppBridgeClient.tsx';
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

test('admin app bridge resolves installed app embed surfaces safely', () => {
  const localUrl = 'http://127.0.0.1:3002/example-app-bridge.html';
  const exampleInstallation = appEngine.createExampleAdminAppInstallation(localUrl);
  const localSurface = appEngine.normalizeAppAdminEmbedSurface(exampleInstallation, { allowLocalhost: true });

  assert.equal(localSurface.url, localUrl);
  assert.equal(localSurface.origin, 'http://127.0.0.1:3002');
  assert.equal(localSurface.title, 'Example App');
  assert.deepEqual(Array.from(localSurface.capabilities), ['api.fetch', 'toast', 'resize']);

  assert.equal(appEngine.normalizeAppAdminEmbedSurface(exampleInstallation, { allowLocalhost: false }), null);

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
  }, { allowLocalhost: false });

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

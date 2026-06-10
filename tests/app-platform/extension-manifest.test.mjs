import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { readAppStoreRouteSource } from '../helpers/app-store-route-source.mjs';

const APP_ENGINE_SOURCE = 'packages/shared-types/src/app-platform.ts';
const APP_FUNCTION_RUNTIME_SOURCE = 'services/api-gateway/src/extensions/app-functions-runtime.ts';
const DEVELOPER_REFERENCE_SOURCE = 'apps/developer-portal/src/lib/reference.ts';
const OPERATIONS_REVIEW_PAGE_SOURCE = 'apps/platform-operations-portal/src/app/(dashboard)/operations/page.tsx';
const APP_EXTENSION_REGISTRY_MIGRATION = 'database/supabase/migrations/076_app_extension_registry.sql';
const appEngineSource = readFileSync(APP_ENGINE_SOURCE, 'utf8');
const appStoreRouteSource = readAppStoreRouteSource();
const appFunctionRuntimeSource = readFileSync(APP_FUNCTION_RUNTIME_SOURCE, 'utf8');
const developerReferenceSource = readFileSync(DEVELOPER_REFERENCE_SOURCE, 'utf8');
const operationsReviewPageSource = readFileSync(OPERATIONS_REVIEW_PAGE_SOURCE, 'utf8');
const appExtensionRegistryMigration = readFileSync(APP_EXTENSION_REGISTRY_MIGRATION, 'utf8');

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
    RegExp,
    Math,
  };

  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath });
  return module.exports;
}

const { z, zChain } = createZodStub();
const appEngine = loadTypeScriptModule(APP_ENGINE_SOURCE, {
  zod: { z },
  '@letbuyy/shared-types': { UuidSchema: zChain },
});

test('WS13 X0 publishes a declarative app manifest contract for every extension surface', () => {
  for (const marker of [
    "LETBUYY_APP_MANIFEST_SCHEMA_VERSION = '2026-06-05.ws13'",
    "'admin.ui'",
    "'checkout.ui'",
    "'theme.app_block'",
    "'cart.discount.calculate'",
    "'checkout.shipping.rate'",
    "'checkout.payment.customize'",
    "'checkout.validation.run'",
    'AppManifestExtensionSchema',
    'AppManifestFunctionSchema',
    'LetbuyyAppManifestSchema',
    'planAppManifestRegistration',
  ]) {
    assert.ok(appEngineSource.includes(marker), `shared app-platform manifest contract is missing ${marker}`);
  }
});

test('WS13 X0 normalizes an example app manifest into extension and function registry records', () => {
  const manifest = appEngine.createExampleLetbuyyAppManifest();
  const normalized = appEngine.normalizeLetbuyyAppManifest(manifest);

  assert.equal(normalized.ok, true);
  assert.equal(normalized.value.schema_version, '2026-06-05.ws13');
  assert.deepEqual(
    Array.from(normalized.value.extensions.map((extension) => extension.surface)).sort(),
    ['admin.ui', 'checkout.ui', 'theme.app_block'],
  );
  assert.deepEqual(Array.from(normalized.value.functions[0].hooks), ['cart.discount.calculate']);
  assert.equal(normalized.value.functions[0].timeout_ms, 5);
  assert.equal(normalized.value.functions[0].deterministic, true);

  const registration = appEngine.planAppManifestRegistration('app_loyalty_001', manifest);
  assert.equal(registration.ok, true);
  assert.equal(registration.value.extensionRecords.length, 3);
  assert.equal(registration.value.functionRecords.length, 1);
  assert.deepEqual(
    Array.from(registration.value.extensionRecords.map((record) => record.type)).sort(),
    ['checkout_extension', 'dashboard_widget', 'storefront_block'],
  );
  assert.equal(registration.value.extensionRecords[0].config.manifest_schema_version, '2026-06-05.ws13');
  assert.equal(registration.value.functionRecords[0].hooks[0], 'cart.discount.calculate');
  assert.equal(registration.value.functionRecords[0].wasm_sha256.length, 64);
});

test('WS13 X0 manifest normalization fails closed for insecure UI and Function sources', () => {
  const manifest = appEngine.createExampleLetbuyyAppManifest();
  manifest.extensions[0].source.url = 'http://apps.example.com/admin';
  manifest.functions[0].wasm.module_url = 'http://apps.example.com/discount.wasm';

  const normalized = appEngine.normalizeLetbuyyAppManifest(manifest);

  assert.equal(normalized.ok, false);
  assert.match(normalized.message, /source\.url must be HTTPS/);
  assert.match(normalized.message, /wasm\.module_url must be HTTPS/);
});

test('WS13 X1 plans per-store extension and function registry records from a manifest', () => {
  for (const marker of [
    'LETBUYY_APP_EXTENSION_REGISTRY_STATUSES',
    'AppExtensionRegistryRecord',
    'AppFunctionRegistryRecord',
    'planAppExtensionRegistryInstall',
  ]) {
    assert.ok(appEngineSource.includes(marker), `shared app-platform registry contract is missing ${marker}`);
  }

  const plan = appEngine.planAppExtensionRegistryInstall({
    appId: 'app_loyalty_001',
    storeId: 'site_001',
    installationId: 'install_001',
    installedBy: 'user_001',
    registeredAt: '2026-06-05T00:00:00.000Z',
    manifestInput: appEngine.createExampleLetbuyyAppManifest(),
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.value.extensionRegistrations.length, 3);
  assert.equal(plan.value.functionRegistrations.length, 1);
  assert.deepEqual(
    Array.from(plan.value.extensionRegistrations.map((registration) => registration.site_id)),
    ['site_001', 'site_001', 'site_001'],
  );
  assert.deepEqual(
    Array.from(plan.value.extensionRegistrations.map((registration) => registration.status)),
    ['enabled', 'enabled', 'enabled'],
  );
  assert.equal(plan.value.extensionRegistrations[0].installation_id, 'install_001');
  assert.equal(plan.value.extensionRegistrations[0].extension_type, 'dashboard_widget');
  assert.equal(plan.value.extensionRegistrations[2].renderer, 'liquid_app_block');
  assert.equal(plan.value.functionRegistrations[0].runtime, 'wasm');
  assert.equal(plan.value.functionRegistrations[0].wasm_sha256.length, 64);
  assert.equal(plan.value.functionRegistrations[0].timeout_ms, 5);
});

test('WS13 X1 wires install, enable-disable, and uninstall revocation to per-store registry tables', () => {
  for (const marker of [
    'CREATE TABLE public.app_extension_registrations',
    'CREATE TABLE public.app_function_registrations',
    'site_id uuid NOT NULL',
    'created_by uuid',
    'updated_by uuid',
    'deleted_at timestamp with time zone',
    'EXECUTE FUNCTION public.update_updated_at()',
    'ALTER TABLE public.app_extension_registrations ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE public.app_function_registrations ENABLE ROW LEVEL SECURITY',
    'app_extension_registrations_service_all',
    'app_function_registrations_service_all',
  ]) {
    assert.ok(appExtensionRegistryMigration.includes(marker), `registry migration is missing ${marker}`);
  }

  for (const marker of [
    'planAppExtensionRegistryInstall',
    'registerAppExtensionRegistry',
    'revokeAppExtensionRegistry',
    "router.get('/installations/:id/extensions'",
    "router.patch('/installations/:id/extensions/:registrationId'",
    "router.patch('/installations/:id/functions/:registrationId'",
    ".from('app_extension_registrations')",
    ".from('app_function_registrations')",
    "status must be enabled or disabled",
    "extension_registry: registry.value",
  ]) {
    assert.ok(appStoreRouteSource.includes(marker), `app-store route registry wiring is missing ${marker}`);
  }
});

test('WS13 X6 publishes lifecycle observability and developer review handoff', () => {
  for (const marker of [
    'LETBUYY_APP_EXTENSION_LIFECYCLE_VERSION',
    'LETBUYY_APP_EXTENSION_OBSERVABILITY_SIGNALS',
    'LETBUYY_APP_EXTENSION_LIFECYCLE_ROUTES',
    'createAppExtensionLifecycleSnapshot',
    'createAppExtensionDeveloperHandoff',
    'createAppExtensionReviewChecklist',
  ]) {
    assert.ok(appEngineSource.includes(marker), `shared app-platform lifecycle contract is missing ${marker}`);
  }

  const snapshot = appEngine.createAppExtensionLifecycleSnapshot({
    observedAt: '2026-06-05T06:00:00.000Z',
    extensions: [
      {
        id: 'reg_admin',
        installation_id: 'install_001',
        app_id: 'app_001',
        extension_handle: 'admin-rewards-panel',
        surface: 'admin.ui',
        target: 'admin.dashboard.widget',
        status: 'enabled',
        app_version: '1.0.0',
        manifest_schema_version: '2026-06-05.ws13',
      },
      {
        id: 'reg_checkout',
        installation_id: 'install_001',
        app_id: 'app_001',
        extension_handle: 'checkout-rewards-banner',
        surface: 'checkout.ui',
        target: 'checkout.order-summary.render-after',
        status: 'disabled',
      },
    ],
    functions: [
      {
        id: 'fn_discount',
        installation_id: 'install_001',
        app_id: 'app_001',
        function_handle: 'loyalty-discount',
        hooks: ['cart.discount.calculate'],
        status: 'revoked',
      },
    ],
  });

  assert.equal(snapshot.lifecycle_version, '2026-06-05.ws13.lifecycle');
  assert.equal(snapshot.status_counts.enabled, 1);
  assert.equal(snapshot.status_counts.disabled, 1);
  assert.equal(snapshot.status_counts.revoked, 1);
  assert.equal(snapshot.extensions[0].surface, 'admin.ui');
  assert.deepEqual(Array.from(snapshot.functions[0].hooks), ['cart.discount.calculate']);
  assert.ok(snapshot.routes.includes('PATCH /v1/app-store/installations/:id/functions/:registrationId'));
  assert.ok(snapshot.observability.signals.includes('app_extension.lifecycle.status_changed'));
  assert.ok(snapshot.observability.signals.includes('app_function.execution.duration_ms'));
  assert.ok(snapshot.developer_handoff.sdk_source_files.includes('apps/developer-portal/src/lib/reference.ts'));
  assert.ok(snapshot.review_checklist.some((item) => item.key === 'deterministic_wasm_functions'));

  for (const marker of [
    'createAppExtensionLifecycleSnapshot',
    'recordAppExtensionLifecycleMetric',
    'app_extension.lifecycle.status_changed',
    'extension_lifecycle_contract',
    'extension_lifecycle_review',
    'extension_developer_handoff',
  ]) {
    assert.ok(appStoreRouteSource.includes(marker), `app-store lifecycle route/review wiring is missing ${marker}`);
  }

  for (const marker of [
    'recordAppFunctionExecutionMetric',
    'app_function.execution.count',
    'app_function.execution.duration_ms',
    'app_function.execution.failed_securely',
    'LETBUYY_APP_EXTENSION_LIFECYCLE_VERSION',
  ]) {
    assert.ok(appFunctionRuntimeSource.includes(marker), `Function runtime observability is missing ${marker}`);
  }

  for (const marker of [
    '2026-06-05.ws13.lifecycle',
    'Extension lifecycle and observability',
    'GET /v1/app-store/installations/:id/extensions',
    'app_function.execution.failed_securely',
  ]) {
    assert.ok(developerReferenceSource.includes(marker), `developer reference is missing ${marker}`);
  }

  for (const marker of [
    'lifecycleReviewItems',
    'extension_lifecycle_review',
    'Extension lifecycle',
  ]) {
    assert.ok(operationsReviewPageSource.includes(marker), `operations review page is missing ${marker}`);
  }
});

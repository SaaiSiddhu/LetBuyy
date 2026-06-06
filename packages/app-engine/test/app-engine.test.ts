import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LETBUYY_APP_MANIFEST_SCHEMA_VERSION,
  applyAppFunctionRuntimeOutput,
  createAppFunctionCheckoutDecision,
  normalizeAppFunctionRuntimeOutput,
  normalizeLetbuyyAppManifest,
  planAppExtensionRegistryInstall,
} from '../src/index.ts';

const VALID_HASH = 'a'.repeat(64);

test('app manifests require HTTPS extension/function sources and normalize bounded Wasm limits', () => {
  const invalid = normalizeLetbuyyAppManifest({
    schema_version: LETBUYY_APP_MANIFEST_SCHEMA_VERSION,
    app: { slug: 'Inventory Tools', name: 'Inventory Tools', version: '1.0.0' },
    scopes: ['read_products'],
    extensions: [{
      handle: 'stock-panel',
      surface: 'settings_page',
      source: { url: 'http://apps.example.test/settings' },
    }],
  });
  assert.equal(invalid.ok, false);

  const valid = normalizeLetbuyyAppManifest({
    schema_version: LETBUYY_APP_MANIFEST_SCHEMA_VERSION,
    app: { slug: 'Inventory Tools', name: 'Inventory Tools', version: '1.0.0' },
    scopes: ['write_app_metadata', 'read_products', 'read_products'],
    extensions: [{
      handle: 'stock-panel',
      surface: 'settings_page',
      source: { url: 'https://apps.example.test/settings' },
      capabilities: ['toast', 'resize', 'unknown'],
    }],
    functions: [{
      handle: 'shipping-rates',
      hooks: ['checkout.shipping.rate', 'unsupported.hook'],
      wasm: { module_url: 'https://apps.example.test/function.wasm', sha256: VALID_HASH.toUpperCase() },
      timeout_ms: 99,
      memory_limit_kb: 9_999,
    }],
  });

  assert.equal(valid.ok, true);
  if (!valid.ok) return;
  assert.equal(valid.value.app.slug, 'inventory-tools');
  assert.deepEqual(valid.value.scopes, ['read_products', 'write_app_metadata']);
  assert.deepEqual(valid.value.extensions[0].capabilities, ['toast', 'resize']);
  assert.equal(valid.value.functions[0].timeout_ms, 5);
  assert.equal(valid.value.functions[0].memory_limit_kb, 1_024);
  assert.equal(valid.value.functions[0].wasm.sha256, VALID_HASH);
});

test('app extension install plans produce enabled records and runtime outputs fail closed', () => {
  const plan = planAppExtensionRegistryInstall({
    appId: 'app_1',
    storeId: 'store_1',
    installationId: 'installation_1',
    installedBy: 'user_1',
    registeredAt: '2026-06-06T00:00:00.000Z',
    manifestInput: {
      schema_version: LETBUYY_APP_MANIFEST_SCHEMA_VERSION,
      app: { slug: 'ship-tools', name: 'Ship Tools', version: '1.0.0' },
      scopes: ['read_orders'],
      extensions: [{
        handle: 'thank-you',
        surface: 'checkout.ui',
        target: 'checkout.thank-you.render-after',
        source: { url: 'https://apps.example.test/thanks' },
      }],
    },
  });

  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.equal(plan.value.extensionRegistrations[0].status, 'enabled');
  assert.equal(plan.value.extensionRegistrations[0].manifest_schema_version, LETBUYY_APP_MANIFEST_SCHEMA_VERSION);

  const invalidOutput = normalizeAppFunctionRuntimeOutput({
    operations: [{ type: 'validation_error', message: 'x'.repeat(241) }],
  });
  assert.equal(invalidOutput.ok, false);

  const decision = createAppFunctionCheckoutDecision({
    couponCode: ' launch10 ',
    shippingMethod: 'standard',
    paymentMethod: 'cod',
  });
  const next = applyAppFunctionRuntimeOutput(decision, {
    operations: [
      { type: 'apply_discount_code', coupon_code: 'summer20' },
      { type: 'select_shipping_method', shipping_method: 'express' },
      { type: 'allow_payment_methods', payment_methods: ['razorpay'] },
    ],
    metadata: {},
  });

  assert.equal(next.couponCode, 'SUMMER20');
  assert.equal(next.shippingMethod, 'express');
  assert.deepEqual(next.validationErrors, [{
    field: 'payment_method',
    message: 'The selected payment method is not available for this checkout.',
  }]);
});

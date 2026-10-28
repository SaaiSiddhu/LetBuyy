import assert from 'node:assert/strict';
import test from 'node:test';
import { StorePaymentSetupSchema, SaveStorePaymentConfigSchema, UpdateStorePaymentMethodsSchema } from '@letbuyy/shared-types';
import { deriveStorePaymentSetup, type StorePaymentReadinessInput } from '../src/store-payment-readiness';

const ready: StorePaymentReadinessInput = {
  schemaReady: true, onlineRequested: true, accountMode: 'ownAccount', hasCredentials: true,
  credentialVerified: true, credentialsUsable: true, environment: 'sandbox',
};

test('saved credentials never imply bank, KYC, live or managed approval', () => {
  const state = StorePaymentSetupSchema.parse(deriveStorePaymentSetup(ready));
  assert.equal(state.status, 'test_ready');
  assert.equal(state.online_checkout_available, true);
  assert.equal(state.business_verification, 'not_confirmed');
  assert.equal(state.bank_verification, 'not_confirmed');
  assert.equal(state.settlement_status, 'not_available_in_test');
  assert.equal(state.managed_payments.available, false);
});

test('disabling online preserves account environment and independent enablement eligibility', () => {
  const state = deriveStorePaymentSetup({ ...ready, onlineRequested: false });
  assert.equal(state.status, 'disabled');
  assert.equal(state.environment, 'sandbox');
  assert.equal(state.can_enable_online, true);
  assert.equal(state.online_checkout_available, false);
});

test('every missing readiness condition denies effective online checkout', () => {
  const cases: Partial<StorePaymentReadinessInput>[] = [
    { schemaReady: false }, { accountMode: 'shared' }, { accountMode: undefined },
    { hasCredentials: false }, { credentialVerified: false }, { credentialsUsable: false },
    { environment: 'live' }, { environment: null },
  ];
  for (const change of cases) {
    const state = deriveStorePaymentSetup({ ...ready, ...change });
    assert.equal(state.can_enable_online, false, JSON.stringify(change));
    assert.equal(state.online_checkout_available, false, JSON.stringify(change));
    assert.ok(state.blocking_reasons.length > 0);
  }
});

test('exhaustive readiness matrix never opens checkout from requested state alone', () => {
  for (let bits = 0; bits < 64; bits++) {
    for (const environment of ['sandbox', 'live', null] as const) {
      const input: StorePaymentReadinessInput = {
        schemaReady: Boolean(bits & 1), onlineRequested: Boolean(bits & 2),
        accountMode: bits & 4 ? 'ownAccount' : 'shared', hasCredentials: Boolean(bits & 8),
        credentialVerified: Boolean(bits & 16), credentialsUsable: Boolean(bits & 32), environment,
      };
      const state = StorePaymentSetupSchema.parse(deriveStorePaymentSetup(input));
      const eligible = input.schemaReady && input.hasCredentials && input.credentialVerified && input.credentialsUsable
        && input.accountMode === 'ownAccount' && input.environment === 'sandbox';
      assert.equal(state.can_enable_online, eligible);
      assert.equal(state.online_checkout_available, eligible && input.onlineRequested);
    }
  }
});

test('credential input defaults to test and rejects environment confusion, coercion and secret whitespace', () => {
  const input = { key_id: ['rzp', 'test', 'synthetic123'].join('_'), key_secret: 'synthetic-credential-only' };
  assert.equal(SaveStorePaymentConfigSchema.parse(input).test_mode, true);
  for (const change of [
    { test_mode: false }, { test_mode: 'false' }, { key_id: input.key_id.replace('_test_', '_live_') },
    { key_secret: 'too short' }, { key_secret: 'synthetic credential only' }, { mode: 'shared' },
  ]) assert.equal(SaveStorePaymentConfigSchema.safeParse({ ...input, ...change }).success, false);
});

test('method updates cannot smuggle gateway, credentials or non-boolean grants', () => {
  assert.deepEqual(UpdateStorePaymentMethodsSchema.parse({ cod_enabled: true }), { cod_enabled: true });
  assert.equal(UpdateStorePaymentMethodsSchema.safeParse({}).success, false);
  assert.equal(UpdateStorePaymentMethodsSchema.safeParse({ online_payment_enabled: 'true' }).success, false);
  assert.equal(UpdateStorePaymentMethodsSchema.safeParse({ cod_enabled: true, mode: 'shared' }).success, false);
});

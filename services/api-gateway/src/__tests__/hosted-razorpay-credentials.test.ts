import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
import { hostedRazorpayTestCredentials } from '../lib/hosted-razorpay-credentials';
import { encryptPaymentSecret, readStoreRazorpayTestCredentials, managedSandboxConfigured } from '../lib/store-payment-config';

test('production only uses the verified cart store keys and never falls back to shared keys', async () => {
    const id = crypto.randomUUID();
    const encryptionKey = crypto.randomUUID();
    const keyId = ['rzp', 'test', crypto.randomUUID().replaceAll('-', '')].join('_');
    const secret = crypto.randomUUID().replaceAll('-', '');
    const settings = { mode: 'ownAccount' as const, razorpay: { key_id: keyId, key_secret_ciphertext: await encryptPaymentSecret(secret, encryptionKey, { siteId: id, keyId, environment: 'sandbox' }), verified: true, test_mode: true } };
    let snapshot = { id, online_payment_enabled: true, payment_settings: settings as typeof settings | null };
    const app = new Hono<{ Bindings: Env }>();
    app.get('/', async c => {
        const value = await hostedRazorpayTestCredentials(c, id, snapshot);
        return c.json({ ready: Boolean(value), usesStoreSecret: value?.keySecret === secret });
    });
    const env = { ENVIRONMENT: 'production', PAYMENT_CONFIG_ENCRYPTION_KEY: encryptionKey, RAZORPAY_KEY_ID: ['rzp', 'test', crypto.randomUUID().replaceAll('-', '')].join('_'), RAZORPAY_KEY_SECRET: crypto.randomUUID() } as Env;
    assert.deepEqual(await (await app.request('/', {}, env)).json(), { ready: true, usesStoreSecret: true });
    snapshot = { ...snapshot, id: crypto.randomUUID() };
    assert.equal((await (await app.request('/', {}, env)).json() as { ready: boolean }).ready, false);
    snapshot = { ...snapshot, id, online_payment_enabled: false };
    assert.equal((await (await app.request('/', {}, env)).json() as { ready: boolean }).ready, false);
    snapshot = { id, online_payment_enabled: true, payment_settings: null };
    assert.equal((await (await app.request('/', {}, env)).json() as { ready: boolean }).ready, false);
    snapshot = { id, online_payment_enabled: true, payment_settings: { ...settings, razorpay: { ...settings.razorpay, verified: false } } };
    assert.equal((await (await app.request('/', {}, env)).json() as { ready: boolean }).ready, false);
});

test('managed test snapshots bind account model, site and credential version; live and production are denied', async () => {
    const id = crypto.randomUUID(), credentialId = crypto.randomUUID(), encryptionKey = crypto.randomUUID();
    const keyId = ['rzp', 'test', crypto.randomUUID().replaceAll('-', '')].join('_'), secret = crypto.randomUUID();
    const settings = { mode: 'managedSandbox' as const, razorpay: { credential_id: credentialId, key_id: keyId,
        key_secret_ciphertext: await encryptPaymentSecret(secret, encryptionKey, { siteId: id, keyId, environment: 'sandbox', credentialId, accountMode: 'managedSandbox' }),
        verified: true, test_mode: true } };
    assert.ok(await readStoreRazorpayTestCredentials(settings, encryptionKey, id));
    assert.equal(await readStoreRazorpayTestCredentials({ ...settings, mode: 'ownAccount' }, encryptionKey, id), null);
    assert.equal(await readStoreRazorpayTestCredentials(settings, encryptionKey, crypto.randomUUID()), null);
    const env = { ENVIRONMENT: 'test', LETBUYY_MANAGED_PAYMENTS_MODE: 'sandbox', LETBUYY_PAYMENT_MODE: 'sandbox',
        RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: secret };
    assert.equal(managedSandboxConfigured(env), true);
    for (const change of [{ ENVIRONMENT: 'production' }, { LETBUYY_PAYMENT_MODE: 'live' },
        { LETBUYY_MANAGED_PAYMENTS_MODE: undefined }, { RAZORPAY_KEY_ID: keyId.replace('_test_', '_live_') }]) {
        assert.equal(managedSandboxConfigured({ ...env, ...change }), false);
    }
});

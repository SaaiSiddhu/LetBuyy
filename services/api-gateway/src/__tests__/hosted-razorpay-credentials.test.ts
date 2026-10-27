import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
import { hostedRazorpayTestCredentials } from '../lib/hosted-razorpay-credentials';
import { encryptPaymentSecret } from '../lib/store-payment-config';

test('production only uses the verified cart store keys and never falls back to shared keys', async () => {
    const id = crypto.randomUUID();
    const encryptionKey = crypto.randomUUID();
    const keyId = ['rzp', 'test', crypto.randomUUID().replaceAll('-', '')].join('_');
    const secret = crypto.randomUUID().replaceAll('-', '');
    const settings = { razorpay: { key_id: keyId, key_secret_ciphertext: await encryptPaymentSecret(secret, encryptionKey), verified: true, test_mode: true } };
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
    snapshot = { id, online_payment_enabled: true, payment_settings: { razorpay: { ...settings.razorpay, verified: false } } };
    assert.equal((await (await app.request('/', {}, env)).json() as { ready: boolean }).ready, false);
});

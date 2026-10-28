import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultPaymentConfig, encryptPaymentSecret, projectStorePaymentConfig, readStoreRazorpayTestCredentials, type PaymentSettings } from '../lib/store-payment-config';

test('Merchant encrypted test keys round-trip without exposing the secret in saved settings', async () => {
    const encryptionKey = crypto.randomUUID();
    const keyId = ['rzp', 'test', crypto.randomUUID().replaceAll('-', '')].join('_');
    const secret = crypto.randomUUID().replaceAll('-', '');
    const siteId = crypto.randomUUID();
    const ciphertext = await encryptPaymentSecret(secret, encryptionKey, { siteId, keyId, environment: 'sandbox' });
    assert.ok(!ciphertext.includes(secret));
    const settings: PaymentSettings = { mode: 'ownAccount', razorpay: { key_id: keyId, key_secret_ciphertext: ciphertext, verified: true, test_mode: true } };
    assert.deepEqual(await readStoreRazorpayTestCredentials(settings, encryptionKey, siteId), { keyId: keyId, keySecret: secret });
    assert.equal(await readStoreRazorpayTestCredentials(settings, crypto.randomUUID(), siteId), null);
    assert.equal(await readStoreRazorpayTestCredentials(settings, undefined, siteId), null);
    for (const patch of [{ verified: false }, { test_mode: false }, { key_id: keyId.replace('_test_', '_live_') }, { key_secret_ciphertext: ciphertext + 'tampered' }]) {
        assert.equal(await readStoreRazorpayTestCredentials({ mode: 'ownAccount', razorpay: { ...settings.razorpay, ...patch } }, encryptionKey, siteId), null);
    }
    assert.equal(await readStoreRazorpayTestCredentials({ ...settings, mode: 'shared' }, encryptionKey, siteId), null);
    assert.equal(await readStoreRazorpayTestCredentials({ ...settings, mode: undefined }, encryptionKey, siteId), null);
    assert.equal(await readStoreRazorpayTestCredentials(null, encryptionKey, siteId), null);
});

test('missing schema is unavailable, never an enabled shared sandbox', () => {
    const config = defaultPaymentConfig(crypto.randomUUID());
    assert.equal(config.online_payment_enabled, false);
    assert.equal(config.cod_enabled, false);
    assert.equal(config.provider_mode, null);
    assert.equal(config.setup.status, 'not_configured');
    assert.equal(config.setup.can_enable_online, false);
    assert.ok(config.setup.blocking_reasons.includes('schema_unavailable'));
});

test('public readiness uses actual decryption and never publishes credential material or KYC approval', async () => {
    const encryptionKey = crypto.randomUUID();
    const secret = crypto.randomUUID().replaceAll('-', '');
    const siteId = crypto.randomUUID(), keyId = ['rzp', 'test', 'synthetic123'].join('_');
    const cipher = await encryptPaymentSecret(secret, encryptionKey, { siteId, keyId, environment: 'sandbox' });
    const row = { id: siteId, online_payment_enabled: true, cod_enabled: false,
        payment_settings: { mode: 'ownAccount' as const, razorpay: {
            key_id: ['rzp', 'test', 'synthetic123'].join('_'), key_secret_ciphertext: cipher,
            verified: true, test_mode: true,
        } }, updated_at: new Date().toISOString() };
    const config = await projectStorePaymentConfig(row, encryptionKey);
    assert.equal(config.setup?.online_checkout_available, true);
    assert.equal(config.setup?.bank_verification, 'not_confirmed');
    assert.equal(config.cod_enabled, false);
    assert.equal(config.revision, row.updated_at);
    assert.ok(!JSON.stringify(config).includes(secret));
    assert.ok(!JSON.stringify(config).includes(cipher));
    const wrongKey = await projectStorePaymentConfig(row, crypto.randomUUID());
    assert.equal(wrongKey.setup?.online_checkout_available, false);
    assert.ok(wrongKey.setup?.blocking_reasons.includes('credentials_unusable'));
    const unresolved = await projectStorePaymentConfig({ ...row, payment_settings: { ...row.payment_settings, mode: 'shared' } }, encryptionKey);
    assert.equal(unresolved.setup?.can_enable_online, false);
    assert.equal(unresolved.setup?.connection, 'unresolved');
    const live = await projectStorePaymentConfig({ ...row, payment_settings: { mode: 'ownAccount', razorpay: {
        ...row.payment_settings.razorpay, test_mode: false, key_id: ['rzp', 'live', 'synthetic123'].join('_'),
    } } }, encryptionKey);
    assert.equal(live.provider_mode, 'live');
    assert.equal(live.setup?.online_checkout_available, false);
    assert.ok(live.setup?.blocking_reasons.includes('live_checkout_not_qualified'));
});


test('v2 ciphertext is bound to exact site, key, environment and encryption version', async () => {
    const siteId = crypto.randomUUID(), encryptionKey = crypto.randomUUID(), secret = crypto.randomUUID();
    const keyId = ['rzp', 'test', crypto.randomUUID().replaceAll('-', '')].join('_');
    const cipher = await encryptPaymentSecret(secret, encryptionKey, { siteId, keyId, environment: 'sandbox' });
    assert.match(cipher, /^v2:[a-f0-9]{16}:/);
    const settings: PaymentSettings = { mode: 'ownAccount', razorpay: { key_id: keyId, key_secret_ciphertext: cipher, verified: true, test_mode: true } };
    assert.equal((await readStoreRazorpayTestCredentials(settings, encryptionKey, siteId))?.keySecret, secret);
    assert.equal((await readStoreRazorpayTestCredentials(settings, encryptionKey, siteId.toUpperCase()))?.keySecret, secret);
    assert.equal(await readStoreRazorpayTestCredentials(settings, encryptionKey, crypto.randomUUID()), null);
    assert.equal(await readStoreRazorpayTestCredentials({ ...settings, razorpay: { ...settings.razorpay, key_id: keyId + 'swapped' } }, encryptionKey, siteId), null);
    const parts = cipher.split(':'); parts[1] = '0000000000000000';
    assert.equal(await readStoreRazorpayTestCredentials({ ...settings, razorpay: { ...settings.razorpay, key_secret_ciphertext: parts.join(':') } }, encryptionKey, siteId), null);
    await assert.rejects(() => encryptPaymentSecret(secret, encryptionKey, { siteId, keyId, environment: 'live' }));
});

test('legacy encrypted configuration stays read-only during explicit migration and drain', async () => {
    const encryptionKey = crypto.randomUUID(), secret = crypto.randomUUID(), siteId = crypto.randomUUID();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(encryptionKey));
    const key = await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(secret)));
    const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
    const settings: PaymentSettings = { mode: 'ownAccount', razorpay: {
        key_id: ['rzp', 'test', 'synthetic123'].join('_'), key_secret_ciphertext: `${encode(iv)}:${encode(encrypted)}`, verified: true, test_mode: true,
    } };
    assert.equal((await readStoreRazorpayTestCredentials(settings, encryptionKey, siteId))?.keySecret, secret);
    assert.equal(await readStoreRazorpayTestCredentials({ ...settings, mode: 'shared' }, encryptionKey, siteId), null);
});

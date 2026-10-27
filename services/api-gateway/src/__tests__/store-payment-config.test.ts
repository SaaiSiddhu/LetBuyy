import assert from 'node:assert/strict';
import test from 'node:test';
import { encryptPaymentSecret, readStoreRazorpayTestCredentials, type PaymentSettings } from '../lib/store-payment-config';

test('Merchant encrypted test keys round-trip without exposing the secret in saved settings', async () => {
    const encryptionKey = crypto.randomUUID();
    const secret = crypto.randomUUID().replaceAll('-', '');
    const ciphertext = await encryptPaymentSecret(secret, encryptionKey);
    assert.ok(!ciphertext.includes(secret));
    const settings: PaymentSettings = { razorpay: { key_id: 'rzp_test_synthetic', key_secret_ciphertext: ciphertext, verified: true, test_mode: true } };
    assert.deepEqual(await readStoreRazorpayTestCredentials(settings, encryptionKey), { keyId: 'rzp_test_synthetic', keySecret: secret });
    assert.equal(await readStoreRazorpayTestCredentials(settings, crypto.randomUUID()), null);
    assert.equal(await readStoreRazorpayTestCredentials(settings, undefined), null);
    for (const patch of [{ verified: false }, { test_mode: false }, { key_id: 'rzp_live_synthetic' }, { key_secret_ciphertext: ciphertext + 'tampered' }]) {
        assert.equal(await readStoreRazorpayTestCredentials({ razorpay: { ...settings.razorpay, ...patch } }, encryptionKey), null);
    }
    assert.equal(await readStoreRazorpayTestCredentials(null, encryptionKey), null);
});

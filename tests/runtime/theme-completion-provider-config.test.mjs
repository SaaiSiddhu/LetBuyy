import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRazorpayTestCsv, mapOwnedGatewayServiceUrl } from '../owned-db/theme-completion-provider-config.mjs';

test('explicit Test CSV supports the provider export and keeps secrets out of errors', () => {
    const pair = parseRazorpayTestCsv('\uFEFFkey_id,key_secret\r\nrzp_test_synthetic,synthetic-secret-only-for-unit\r\n');
    assert.equal(pair.keyId, 'rzp_test_synthetic');
    assert.equal(pair.keySecret, 'synthetic-secret-only-for-unit');
    assert(Object.isFrozen(pair));
    assert.deepEqual(parseRazorpayTestCsv('"key_id","key_secret"\n"rzp_test_synthetic","synthetic-secret-only-for-unit"'), pair);
    for (const bad of ['rzp_live_synthetic', 'rzp_test_', 'rzp_test_synthetic:other']) {
        assert.throws(() => parseRazorpayTestCsv(`key_id,key_secret\n${bad},synthetic-secret-only-for-unit`), error => {
            assert.doesNotMatch(error.message, /synthetic-secret|rzp_live/); return true;
        });
    }
    for (const bad of ['key_id,key_secret\nrzp_test_synthetic,short', 'key_id,key_secret\nrzp_test_synthetic,synthetic-secret-only-for-unit\nextra,row', 'arbitrary,key_secret\nrzp_test_synthetic,synthetic-secret-only-for-unit', 'x'.repeat(16385)]) {
        assert.throws(() => parseRazorpayTestCsv(bad));
    }
});

test('canonical webhook service binding reaches only the explicit owned loopback gateway', () => {
    assert.equal(mapOwnedGatewayServiceUrl('https://api-gateway/v1/storefront/internal/payments/confirm?x=1', 'http://127.0.0.1:54321'), 'http://127.0.0.1:54321/v1/storefront/internal/payments/confirm?x=1');
    for (const input of ['https://foreign.invalid/v1/x', 'http://api-gateway/v1/x', 'https://api-gateway@foreign.invalid/v1/x']) {
        assert.throws(() => mapOwnedGatewayServiceUrl(input, 'http://127.0.0.1:54321'));
    }
    for (const origin of ['https://production.invalid', 'http://localhost:54321', 'http://127.0.0.1', 'http://127.0.0.1:54321/path', 'http://user:secret@127.0.0.1:54321']) {
        assert.throws(() => mapOwnedGatewayServiceUrl('https://api-gateway/v1/x', origin));
    }
});

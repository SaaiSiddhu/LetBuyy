import assert from 'node:assert/strict';
import test from 'node:test';
import { MerchantNativeRequestSchema, MerchantNativeExchangeSchema, merchantNativeCallback, merchantNativeChallenge, parseMerchantNativeCallback } from '../src/merchant-native';

test('S256 matches the independent RFC 7636 reference vector', async () => {
    assert.equal(await merchantNativeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});
test('public clients cannot supply arbitrary callbacks, unsupported purposes, shared secrets or actors', () => {
    const valid = { clientId: 'merchant_android', callbackId: 'android_https', environment: 'production', purpose: 'login', challenge: 'c'.repeat(43), state: 's'.repeat(43) };
    assert.equal(MerchantNativeRequestSchema.safeParse(valid).success, true);
    for (const change of [{ redirectUri: 'https://evil.example/callback' }, { userId: crypto.randomUUID() }, { clientSecret: 'secret' }, { purpose: 'issue_operator' }, { challenge: 'short' }, { environment: 'preview' }]) {
        assert.equal(MerchantNativeRequestSchema.safeParse({ ...valid, ...change }).success, false);
    }
    assert.equal(merchantNativeCallback('merchant_android', 'ios_session', 'production'), null);
    assert.notEqual(merchantNativeCallback('merchant_ios', 'ios_session', 'production'), merchantNativeCallback('merchant_ios', 'ios_session', 'staging'));
});
test('callback requires exact registered URI, request, state and unique security fields', () => {
    const expected = { redirectUri: 'https://accounts.letbuyy.com/merchant/auth/callback', requestId: crypto.randomUUID(), state: 's'.repeat(43) };
    const callback = expected.redirectUri + '?' + new URLSearchParams({ request: expected.requestId, state: expected.state, code: 'c'.repeat(43) });
    assert.ok(parseMerchantNativeCallback(callback, expected));
    for (const value of [callback + '&code=' + 'c'.repeat(43), callback + '#fragment', callback + '&extra=x', callback.replace('accounts.letbuyy.com', 'accounts.letbuyy.com.evil.example'), callback.replace('https://', 'https://user@'), callback.replace('/callback?', '/%63allback?'), callback.replace('state=', 'state=x'), callback.replace('accounts.letbuyy.com/', 'accounts.letbuyy.com:443/')]) {
        assert.equal(parseMerchantNativeCallback(value, expected), null);
    }
    assert.equal(MerchantNativeExchangeSchema.safeParse({ clientId: 'merchant_android', callbackId: 'android_https', environment: 'production', state: expected.state, requestId: expected.requestId, code: 'c'.repeat(43), verifier: 'v'.repeat(43), token: 'client-cannot-select-session' }).success, false);
});

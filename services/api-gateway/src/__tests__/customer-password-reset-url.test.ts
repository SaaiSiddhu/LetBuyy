import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseCustomerPasswordResetUrl } from '../lib/customer-password-reset-url';

const storeId = '11111111-1111-4111-8111-111111111111';

test('password reset permits an HTTPS URL only when its host resolves to the target store', async () => {
    const result = await chooseCustomerPasswordResetUrl({
        storeId,
        requestedUrl: 'https://shop.example.test/account/reset-password?from=mail',
        fallbackUrl: 'https://accounts.example.test/reset',
        resolveSiteByHost: async host => host === 'shop.example.test' ? { id: storeId } : null,
    });
    assert.equal(result, 'https://shop.example.test/account/reset-password?from=mail');
});

test('password reset sends a wrong-store destination to the configured safe fallback', async () => {
    const result = await chooseCustomerPasswordResetUrl({
        storeId,
        requestedUrl: 'https://attacker.example/collect',
        fallbackUrl: 'https://accounts.example.test/reset',
        resolveSiteByHost: async () => ({ id: '22222222-2222-4222-8222-222222222222' }),
    });
    assert.equal(result, 'https://accounts.example.test/reset');
});

test('password reset rejects unknown hosts, insecure remote HTTP, credentials and fragments', async () => {
    const fallbackUrl = 'https://accounts.example.test/reset';
    for (const requestedUrl of [
        'https://unknown.example/collect',
        'http://shop.example.test/reset',
        'https://attacker:secret@shop.example.test/reset',
        'https://shop.example.test/reset#token',
        'not a URL',
    ]) {
        const result = await chooseCustomerPasswordResetUrl({
            storeId,
            requestedUrl,
            fallbackUrl,
            resolveSiteByHost: async host => host === 'shop.example.test' ? { id: storeId } : null,
        });
        assert.equal(result, fallbackUrl, requestedUrl);
    }
});

test('password reset allows local HTTP destinations only for a resolving local test store', async () => {
    const accepted = await chooseCustomerPasswordResetUrl({
        storeId,
        requestedUrl: 'http://shop.localhost:9000/account/reset-password',
        fallbackUrl: 'https://accounts.example.test/reset',
        resolveSiteByHost: async host => host === 'shop.localhost:9000' ? { id: storeId } : null,
    });
    assert.equal(accepted, 'http://shop.localhost:9000/account/reset-password');
});

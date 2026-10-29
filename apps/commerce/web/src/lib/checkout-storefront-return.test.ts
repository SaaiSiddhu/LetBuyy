import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCheckoutStorefrontReturn } from './checkout-storefront-return';
import type { StorefrontAccessContext } from './storefront-access';

const base = {
    siteId: '11111111-1111-4111-8111-111111111111', subdomain: 'snaz',
    rootDomain: 'shops.example.invalid', baseUrl: 'https://discovery.example.invalid',
};
const fallback = 'https://discovery.example.invalid/store/snaz';
const active: StorefrontAccessContext = {
    site_id: base.siteId, subdomain: 'snaz', custom_domain: 'shop.example.invalid',
    custom_domain_status: 'active', status: 'published', published: true,
    access_mode: 'public', access_message: null,
};

test('platform and discovery entry points preserve their separate cart origins without another request', async () => {
    const resolveHost = async () => { throw new Error('No host lookup should be needed'); };
    assert.equal(await resolveCheckoutStorefrontReturn({ ...base, resolveHost, originHint: 'https://snaz.shops.example.invalid' }), 'https://snaz.shops.example.invalid');
    assert.equal(await resolveCheckoutStorefrontReturn({ ...base, resolveHost, originHint: base.baseUrl }), fallback);
});

test('custom return navigation requires current exact ownership of the verified handoff site', async () => {
    const calls: string[] = [];
    const resolveHost = async (host: string) => { calls.push(host); return active; };
    assert.equal(await resolveCheckoutStorefrontReturn({ ...base, resolveHost, originHint: 'https://shop.example.invalid' }), 'https://shop.example.invalid');
    assert.deepEqual(calls, ['shop.example.invalid']);
    for (const patch of [
        { site_id: '22222222-2222-4222-8222-222222222222' }, { subdomain: 'other' },
        { custom_domain: 'other.example.invalid' }, { custom_domain_status: 'verifying' },
        { published: false }, { status: 'draft' },
    ]) {
        assert.equal(await resolveCheckoutStorefrontReturn({ ...base, originHint: 'https://shop.example.invalid',
            resolveHost: async () => ({ ...active, ...patch }) }), fallback);
    }
});

test('malformed, insecure, nonstandard-port and multiple navigation hints cannot become return targets', async () => {
    let calls = 0;
    const resolveHost = async () => { calls++; return active; };
    for (const originHint of [undefined, null, ['https://shop.example.invalid'], '//shop.example.invalid',
        'https://user:password@shop.example.invalid', 'https://shop.example.invalid/cart',
        'https://shop.example.invalid?next=evil', 'https://shop.example.invalid#evil',
        'http://shop.example.invalid', 'https://shop.example.invalid:444', 'javascript:alert(1)']) {
        assert.equal(await resolveCheckoutStorefrontReturn({ ...base, resolveHost, originHint }), fallback);
    }
    assert.equal(calls, 0);
});

test('sibling stores, suffix lookalikes and resolver outages retain the safe configured fallback', async () => {
    for (const originHint of ['https://other.shops.example.invalid', 'https://snaz.shops.example.invalid.evil.invalid']) {
        assert.equal(await resolveCheckoutStorefrontReturn({ ...base, originHint, resolveHost: async () => null }), fallback);
    }
    assert.equal(await resolveCheckoutStorefrontReturn({ ...base, originHint: 'https://shop.example.invalid',
        resolveHost: async () => { throw new Error('Provider unavailable'); } }), fallback);
});

test('local development keeps its storefront port while old handoffs keep their existing fallback', async () => {
    const resolveHost = async () => null;
    assert.equal(await resolveCheckoutStorefrontReturn({ ...base, rootDomain: 'localhost', baseUrl: 'http://localhost:9000',
        originHint: 'http://snaz.localhost:9000', resolveHost }), 'http://snaz.localhost:9000');
    assert.equal(await resolveCheckoutStorefrontReturn({ ...base, rootDomain: 'localhost', baseUrl: 'http://localhost:9000',
        originHint: 'http://snaz.localhost:9001', resolveHost }), 'http://localhost:9000/store/snaz');
    assert.equal(await resolveCheckoutStorefrontReturn({ ...base, rootDomain: 'localhost', baseUrl: undefined,
        originHint: undefined, resolveHost }), '/store/snaz');
    assert.equal(await resolveCheckoutStorefrontReturn({ ...base, rootDomain: 'localhost', baseUrl: undefined,
        originHint: 'http://localhost:9000', resolveHost }), 'http://localhost:9000/store/snaz');
    assert.equal(await resolveCheckoutStorefrontReturn({ ...base, originHint: undefined, resolveHost }), fallback);
});

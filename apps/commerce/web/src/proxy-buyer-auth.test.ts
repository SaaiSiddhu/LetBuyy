import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

test('discovery account pages move to the resolved public primary store after access enforcement', async () => {
    const names = ['NEXT_PUBLIC_STORE_ROOT_DOMAIN', 'NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES', 'LETBUYY_API_BASE_URL', 'INTERNAL_API_SECRET'] as const;
    const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
    Object.assign(process.env, { NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'stores.example.test', NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES: 'discovery.platform.example.test', LETBUYY_API_BASE_URL: 'https://gateway.example.invalid', INTERNAL_API_SECRET: crypto.randomUUID() });
    const originalFetch = globalThis.fetch;
    let mode = 'public';
    let customDomain: string | null = null;
    let status = 200;
    globalThis.fetch = (async (input) => {
        const url = new URL(String(input));
        assert.equal(url.searchParams.get('host'), 'synthetic-store.stores.example.test');
        return Response.json({ data: { site_id: crypto.randomUUID(), subdomain: 'synthetic-store', access_mode: mode, published: true, status: 'published', custom_domain_status: customDomain ? 'active' : 'pending', custom_domain: customDomain } }, { status });
    }) as typeof fetch;
    const request = (path = '/customers/login') => new NextRequest(`https://discovery.platform.example.test/store/synthetic-store${path}`, { headers: { host: 'discovery.platform.example.test' } });
    try {
        const login = await proxy(request('/customers/login?error=invalid_credentials'));
        assert.equal(login.status, 303);
        assert.equal(login.headers.get('location'), 'https://synthetic-store.stores.example.test/customers/login?error=invalid_credentials');
        assert.equal(login.headers.get('cache-control'), 'no-store');
        customDomain = 'shop.merchant.example';
        const register = await proxy(request('/customers/register'));
        assert.equal(register.headers.get('location'), 'https://shop.merchant.example/customers/register');
        const account = await proxy(request('/account/settings'));
        assert.equal(account.headers.get('location'), 'https://shop.merchant.example/account/settings');
        assert.equal((await proxy(request('/products'))).headers.has('location'), false);
        mode = 'offline';
        assert.equal((await proxy(request())).status, 503);
        mode = 'preview_only';
        assert.equal((await proxy(request())).status, 401);
        mode = 'password';
        assert.equal((await proxy(request())).status, 401);
        status = 503;
        const unavailable = await proxy(request());
        assert.equal(unavailable.status, 503);
        assert.equal(unavailable.headers.has('location'), false);
    } finally {
        globalThis.fetch = originalFetch;
        for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; }
    }
});

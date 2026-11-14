import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { installGatewayFake, jsonResponse, type RecordedGatewayRequest } from '@/lib/api/gateway-fetch-fake.test-support';
import { POST } from './route';

const ORIGIN = 'https://store.test';

function request(body: unknown, origin = ORIGIN) {
    return new NextRequest(`${ORIGIN}/api/shipping/rates`, {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

async function withGateway(respond: (request: RecordedGatewayRequest) => Response, run: (calls: RecordedGatewayRequest[]) => Promise<void>) {
    const fake = installGatewayFake(respond);
    try { await run(fake.requests); } finally { fake.restore(); }
}

test('storefront quote proxy resolves the public store by subdomain and forwards the validated address and subtotal', async () => {
    await withGateway((upstream) => {
        assert.equal(upstream.method, 'GET');
        assert.equal(upstream.url.pathname, '/v1/storefront/snaz/shipping-rates');
        assert.equal(upstream.url.searchParams.get('pincode'), '560001');
        assert.equal(upstream.url.searchParams.get('state'), 'Karnataka');
        assert.equal(upstream.url.searchParams.get('state_code'), '29');
        assert.equal(upstream.url.searchParams.get('subtotal_minor'), '19900');
        return jsonResponse({ data: { serviceability: { serviceable: true }, rates: [] } });
    }, async (calls) => {
        const response = await POST(request({ subdomain: 'snaz', pincode: '560001', state: 'Karnataka', state_code: '29', subtotal_minor: 19900 }));
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { data: { serviceability: { serviceable: true }, rates: [] } });
        assert.equal(calls.length, 1);
    });
});

test('storefront quote proxy refuses foreign origins and malformed destinations before the Gateway call', async () => {
    await withGateway(() => { throw new Error('gateway must not be called'); }, async (calls) => {
        assert.equal((await POST(request({ subdomain: 'snaz', pincode: '560001', state: 'Karnataka', subtotal_minor: 19900 }, 'https://attacker.test'))).status, 403);
        assert.equal((await POST(request({ subdomain: 'snaz', pincode: '000000', state: 'Karnataka', subtotal_minor: 19900 }))).status, 400);
        assert.equal(calls.length, 0);
    });
});

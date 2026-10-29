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

const input = { subdomain: 'snaz', shipping_address: { country: 'IN', zip: '560001', state: 'Karnataka', state_code: '29' },
    items: [{ product_id: '97e27542-391a-4333-ae03-e234f330eb25', quantity: 1 }] };
test('storefront delivery proxy forwards product references instead of trusting a client subtotal', async () => {
    await withGateway((upstream) => {
        assert.equal(upstream.method, 'POST');
        assert.equal(upstream.url.pathname, '/v1/storefront/snaz/shipping-rates');
        const body = JSON.parse(upstream.body || '{}');
        assert.deepEqual(body.shipping_address,input.shipping_address);
        assert.deepEqual(body.items,input.items);
        assert.equal(body.subtotal_minor,undefined);
        return jsonResponse({ data: { rates: [] } });
    }, async (calls) => {
        const response = await POST(request(input));
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.data.serviceability.serviceable,false);
        assert.equal(result.data.serviceability.carrier_confirmed,false);
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

import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { buyerCookieHeader, installGatewayFake, jsonResponse, SITE_ID, type RecordedGatewayRequest } from '@/lib/api/gateway-fetch-fake.test-support';
import * as ordersRoute from './route';

const ORIGIN = 'https://checkout.test';
const CART_ID = 'f35ca7c1-8ad3-41fc-b2c7-1c66041add4c';
const PRODUCT_ID = '92d60db5-319a-4608-88c7-0600ad5be001';
const SHIPPING_RATE_ID = 'bf12ba15-842f-4a30-b498-37ed23158241';
const HANDOFF = {
    site_id: SITE_ID,
    cart_token: 'ct_123456789',
    expires_at: '2026-10-04T10:10:00.000Z',
    cart_digest: 'a'.repeat(64),
    signature: 'b'.repeat(64),
    channel: 'web',
};

function payload(overrides: Record<string, unknown> = {}) {
    return {
        cartId: CART_ID,
        handoff: HANDOFF,
        subdomain: 'snaz',
        customer: {
            name: 'Buyer', email: 'buyer@example.test', phone: '+919876543210',
            address: { address: '42 Main Road', city: 'Bengaluru', state: 'Karnataka', stateCode: '29', pincode: '560001' },
        },
        items: [{ productId: PRODUCT_ID, variantId: null, quantity: 1 }],
        paymentMethod: 'cod',
        deliveryOption: 'standard',
        shippingRateId: SHIPPING_RATE_ID,
        shippingAmountMinor: 2500,
        idempotencyKey: 'checkout-order-key-123',
        ...overrides,
    };
}

function request(body: unknown, origin = ORIGIN, cookie?: string) {
    return new NextRequest(`${ORIGIN}/api/orders`, {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
        body: JSON.stringify(body),
    });
}

type Handler = (request: NextRequest) => Promise<Response>;
const call = (body: unknown, origin?: string, cookie?: string) => (ordersRoute.POST as Handler)(request(body, origin, cookie));

async function withGateway(respond: (request: RecordedGatewayRequest) => Response, run: (calls: RecordedGatewayRequest[]) => Promise<void>) {
    const fake = installGatewayFake(respond);
    try { await run(fake.requests); } finally { fake.restore(); }
}

function verifiedCart(overrides: Record<string, unknown> = {}) {
    return jsonResponse({ data: {
        site_id: SITE_ID,
        cart_id: CART_ID,
        subdomain: 'snaz',
        coupon_code: null,
        lines: [{ product_id: PRODUCT_ID, variant_id: null, quantity: 1 }],
        ...overrides,
    } });
}

test('order creation verifies the signed handoff and exact server cart before forwarding the order', async () => {
    await withGateway((upstream) => {
        if (upstream.url.pathname === `/v1/checkout/${CART_ID}/verify-handoff`) {
            assert.equal(upstream.method, 'GET');
            assert.equal(upstream.url.searchParams.get('signature'), HANDOFF.signature);
            return verifiedCart();
        }
        assert.equal(upstream.url.pathname, '/v1/storefront/snaz/orders');
        assert.equal(upstream.method, 'POST');
        const forwarded = JSON.parse(upstream.body || '{}') as Record<string, unknown>;
        assert.equal(forwarded.customer && (forwarded.customer as { email?: string }).email, 'buyer@example.test');
        assert.equal(forwarded.idempotencyKey, 'checkout-order-key-123');
        assert.equal(forwarded.shippingRateId, SHIPPING_RATE_ID);
        assert.equal(forwarded.shippingAmountMinor, 2500);
        assert.equal('cartId' in forwarded, false);
        assert.equal('handoff' in forwarded, false);
        return jsonResponse({ data: { order: { id: 'order-1', orderNumber: 'LB-1', status: 'pending', total: 120 } } });
    }, async (calls) => {
        const response = await call(payload());
        assert.equal(response.status, 201);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.deepEqual(await response.json(), { success: true, order: { id: 'order-1', orderNumber: 'LB-1', status: 'pending', total: 120 } });
        assert.deepEqual(calls.map((item) => item.url.pathname), [`/v1/checkout/${CART_ID}/verify-handoff`, '/v1/storefront/snaz/orders']);
    });
});

test('unsigned, expired, wrong-store, altered-line and altered-coupon requests never create orders', async () => {
    let verifyStatus = 200;
    await withGateway((upstream) => {
        if (upstream.url.pathname.includes('/verify-handoff')) return jsonResponse({ error: { code: 'CHECKOUT_HANDOFF_INVALID', message: 'expired' } }, { status: verifyStatus });
        return jsonResponse({ data: { order: { id: 'unexpected' } } });
    }, async (calls) => {
        const noProof = { ...payload() } as Record<string, unknown>;
        delete noProof.handoff;
        assert.equal((await call(noProof)).status, 401);
        assert.equal((await call(payload({ items: [{ productId: PRODUCT_ID, variantId: null, quantity: 2 }] }))).status, 409);
        verifyStatus = 401;
        assert.equal((await call(payload())).status, 401);
        assert.equal(calls.filter((item) => item.url.pathname.endsWith('/orders')).length, 0);
    });

    await withGateway((upstream) => upstream.url.pathname.includes('/verify-handoff')
        ? verifiedCart({ subdomain: 'other-store' })
        : jsonResponse({ data: { order: {} } }), async (calls) => {
        assert.equal((await call(payload())).status, 409);
        assert.equal(calls.filter((item) => item.url.pathname.endsWith('/orders')).length, 0);
    });

    await withGateway((upstream) => upstream.url.pathname.includes('/verify-handoff')
        ? verifiedCart({ coupon_code: 'SAVE10' })
        : jsonResponse({ data: { order: {} } }), async (calls) => {
        assert.equal((await call(payload({ couponCode: 'OTHER10' }))).status, 409);
        assert.equal(calls.filter((item) => item.url.pathname.endsWith('/orders')).length, 0);
    });
});

test('foreign-origin requests are rejected before a handoff or order lookup', async () => {
    await withGateway(() => { throw new Error('gateway must not be called'); }, async (calls) => {
        assert.equal((await call(payload(), 'https://attacker.test')).status, 403);
        assert.equal(calls.length, 0);
    });
});

test('a matching canonical buyer cookie is forwarded as a signed-session header; a mismatched store is refused', async () => {
    await withGateway((upstream) => {
        if (upstream.url.pathname.includes('/verify-handoff')) return verifiedCart();
        assert.equal(upstream.headers.get('x-letbuyy-storefront-session'), 'aaaaaaaa.bbbbbbbb.cccccccc');
        return jsonResponse({ data: { order: { id: 'owned-order' } } });
    }, async (calls) => {
        assert.equal((await call(payload(), undefined, buyerCookieHeader())).status, 201);
        assert.equal(calls.filter((item) => item.url.pathname.endsWith('/orders')).length, 1);
    });

    await withGateway((upstream) => upstream.url.pathname.includes('/verify-handoff')
        ? verifiedCart()
        : jsonResponse({ data: { order: {} } }), async (calls) => {
        const otherSite = '11111111-2222-4333-8444-555555555555';
        assert.equal((await call(payload(), undefined, buyerCookieHeader(undefined, otherSite))).status, 401);
        assert.equal(calls.filter((item) => item.url.pathname.endsWith('/orders')).length, 0);
    });
});

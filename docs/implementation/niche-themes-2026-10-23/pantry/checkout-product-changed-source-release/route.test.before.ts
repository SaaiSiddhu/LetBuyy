import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { installGatewayFake, jsonResponse, type RecordedGatewayRequest } from '@/lib/api/gateway-fetch-fake.test-support';
import * as checkoutRoute from './[cartId]/[step]/route';

const SITE_ID = '0d8a7b1c-3e5f-4a6b-9c1d-2e3f4a5b6c7d';
const CART_ID = 'f35ca7c1-8ad3-41fc-b2c7-1c66041add4c';
const HANDOFF = new URLSearchParams({
    site_id: SITE_ID,
    cart_token: 'ct_123456789',
    expires_at: '2026-10-04T10:10:00.000Z',
    cart_digest: 'a'.repeat(64),
    signature: 'b'.repeat(64),
    channel: 'web',
});
const ORIGIN = 'https://checkout.test';
type CheckoutHandler = (request: NextRequest, context: { params: Promise<{ cartId: string; step: string }> }) => Promise<Response>;
type CheckoutOptionsHandler = (request: NextRequest, context: { params: Promise<{ cartId: string; step: string }> }) => Promise<Response>;

function request(step: string, body: unknown, options: { origin?: string | null; contentType?: string; cartId?: string } = {}) {
    const url = `${ORIGIN}/api/checkout/${options.cartId || CART_ID}/${step}?${HANDOFF}`;
    const headers = new Headers({ 'content-type': options.contentType ?? 'application/json' });
    if (options.origin !== null) headers.set('origin', options.origin ?? ORIGIN);
    return new NextRequest(url, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
}

function optionsRequest(options: { origin?: string | null; cartId?: string; query?: Record<string, string> } = {}) {
    const query = new URLSearchParams(HANDOFF);
    for (const [key, value] of Object.entries(options.query || { country: 'IN', state: 'Karnataka', state_code: '29', pincode: '560001' })) query.set(key, value);
    const headers = new Headers();
    if (options.origin !== null) headers.set('origin', options.origin ?? ORIGIN);
    return new NextRequest(`${ORIGIN}/api/checkout/${options.cartId || CART_ID}/delivery-options?${query}`, { method: 'GET', headers });
}

function call(req: NextRequest, step: string, cartId = CART_ID) {
    return (checkoutRoute.POST as CheckoutHandler)(req, { params: Promise.resolve({ cartId, step }) });
}

function callOptions(req: NextRequest, cartId = CART_ID) {
    return (checkoutRoute.GET as CheckoutOptionsHandler)(req, { params: Promise.resolve({ cartId, step: 'delivery-options' }) });
}

async function withGateway(respond: (request: RecordedGatewayRequest) => Response, run: (calls: RecordedGatewayRequest[]) => Promise<void>) {
    const fake = installGatewayFake(respond);
    try { await run(fake.requests); } finally { fake.restore(); }
}

test('checkout contact step forwards only validated JSON through the signed handoff route and strips returned PII', async () => {
    await withGateway((upstream) => {
        assert.equal(upstream.method, 'POST');
        assert.equal(upstream.url.pathname, `/v1/checkout/${CART_ID}/contact`);
        assert.equal(upstream.url.searchParams.get('site_id'), SITE_ID);
        assert.equal(upstream.url.searchParams.get('signature'), HANDOFF.get('signature'));
        assert.deepEqual(JSON.parse(upstream.body || '{}'), { idempotency_key: 'contact-key-123', email: 'buyer@example.test', name: 'Buyer' });
        return jsonResponse({ success: true, data: { checkout: { id: 'session-1', state: 'contact', customer_email: 'buyer@example.test', shipping_address: { line1: 'private' } } } });
    }, async (calls) => {
        const response = await call(request('contact', { idempotency_key: 'contact-key-123', email: 'buyer@example.test', name: 'Buyer' }), 'contact');
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.deepEqual(await response.json(), { success: true, data: { checkout: { id: 'session-1', state: 'contact' } } });
        assert.equal(calls.length, 1);
    });
});

test('checkout confirm returns a minimal order projection, not the full database order row', async () => {
    await withGateway(() => jsonResponse({ success: true, data: {
        checkout: { id: 'session-1', state: 'completed', customer_email: 'buyer@example.test' },
        order: { id: 'order-1', order_number: 'LB-1', status: 'confirmed', total: 120, customer_email: 'buyer@example.test', shipping_address: { line1: 'private' } },
    } }), async () => {
        const response = await call(request('confirm', { idempotency_key: 'confirm-key-123' }), 'confirm');
        const responseText = await response.text();
        assert.deepEqual(JSON.parse(responseText), { success: true, data: {
            checkout: { id: 'session-1', state: 'completed' },
            order: { id: 'order-1', orderNumber: 'LB-1', status: 'confirmed', total: 120 },
        } });
        assert.doesNotMatch(responseText, /buyer@example|shipping_address/);
    });
});

test('checkout confirm preserves a safe stale-inventory conflict for the buyer', async () => {
    await withGateway(() => jsonResponse({
        success: false,
        error: {
            code: 'INSUFFICIENT_INVENTORY',
            message: 'One or more items are no longer available in the requested quantity. Review your cart and try again.',
        },
    }, { status: 409 }), async (calls) => {
        const response = await call(request('confirm', { idempotency_key: 'inventory-race-confirm-001' }), 'confirm');
        assert.equal(response.status, 409);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.deepEqual(await response.json(), {
            success: false,
            error: {
                code: 'INSUFFICIENT_INVENTORY',
                message: 'Some items are no longer available in that quantity. Review your cart and try again.',
            },
        });
        assert.equal(calls.length, 1);
        assert.equal(calls[0].url.pathname, `/v1/checkout/${CART_ID}/confirm`);
    });
});

test('Razorpay payment-intent exposes only the server-created provider order needed by hosted checkout', async () => {
    await withGateway((upstream) => {
        assert.equal(upstream.method, 'POST');
        assert.equal(upstream.url.pathname, `/v1/checkout/${CART_ID}/payment-intent`);
        assert.equal(upstream.url.searchParams.get('signature'), HANDOFF.get('signature'));
        assert.deepEqual(JSON.parse(upstream.body || '{}'), {
            idempotency_key: 'intent-key-123', provider: 'razorpay', mode: 'sandbox', tokenize: false,
            metadata: { channel: 'web' },
        });
        return jsonResponse({ success: true, data: {
            checkout: { id: 'session-1', state: 'payment_intent', buyer_account_id: 'private-buyer' },
            payment_intent: {
                payment_intent_id: 'intent-1', provider: 'razorpay', status: 'requires_action', mode: 'sandbox',
                key_id: 'rzp_test_key', provider_order_id: 'order_provider_1', amount_minor: 12345, currency: 'INR',
                buyer_account_id: 'private-buyer',
            },
        } });
    }, async () => {
        const response = await call(request('payment-intent', {
            idempotency_key: 'intent-key-123', provider: 'razorpay', mode: 'sandbox', tokenize: false,
            metadata: { channel: 'web' },
        }), 'payment-intent');
        const responseText = await response.text();
        assert.equal(response.status, 200);
        assert.deepEqual(JSON.parse(responseText), { success: true, data: {
            checkout: { id: 'session-1', state: 'payment_intent' },
            payment_intent: {
                payment_intent_id: 'intent-1', provider: 'razorpay', status: 'requires_action', mode: 'sandbox',
                key_id: 'rzp_test_key', provider_order_id: 'order_provider_1', amount_minor: 12345, currency: 'INR',
            },
        } });
        assert.doesNotMatch(responseText, /private-buyer/);
    });
});

test('Razorpay confirmation forwards signed provider proof and returns only the canonical order receipt', async () => {
    await withGateway((upstream) => {
        assert.equal(upstream.url.pathname, `/v1/checkout/${CART_ID}/confirm`);
        assert.deepEqual(JSON.parse(upstream.body || '{}'), {
            idempotency_key: 'confirm-key-123', payment_intent_id: 'intent-1',
            razorpay_order_id: 'order_provider_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig_1',
        });
        return jsonResponse({ success: true, data: {
            checkout: { id: 'session-1', state: 'completed' },
            order: { id: 'order-1', order_number: 'LB-1', status: 'paid', total: 123.45, customer_email: 'private@example.test' },
        } });
    }, async () => {
        const response = await call(request('confirm', {
            idempotency_key: 'confirm-key-123', payment_intent_id: 'intent-1',
            razorpay_order_id: 'order_provider_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig_1',
        }), 'confirm');
        const responseText = await response.text();
        assert.equal(response.status, 200);
        assert.deepEqual(JSON.parse(responseText), { success: true, data: {
            checkout: { id: 'session-1', state: 'completed' },
            order: { id: 'order-1', orderNumber: 'LB-1', status: 'paid', total: 123.45 },
        } });
        assert.doesNotMatch(responseText, /private@example/);
    });
});

test('signed delivery options keep the handoff, project accurate COD eligibility, and never claim carrier confirmation', async () => {
    await withGateway((upstream) => {
        assert.equal(upstream.method, 'GET');
        assert.equal(upstream.url.pathname, `/v1/checkout/${CART_ID}/delivery-options`);
        assert.equal(upstream.url.searchParams.get('signature'), HANDOFF.get('signature'));
        assert.equal(upstream.url.searchParams.get('state_code'), '29');
        return jsonResponse({ data: {
            serviceable: true,
            source: 'seller_shipping_zone',
            carrier_confirmed: true,
            rates: [
                { id: 'rate-1', name: 'Standard', amount: 25, currency: 'INR', estimated_days_min: 3, estimated_days_max: 5, cod_available: true },
                { id: 'rate-2', name: 'Online only', amount: 12, currency: 'INR', estimated_days_min: null, estimated_days_max: null, cod_available: false },
            ],
        } });
    }, async (calls) => {
        const response = await callOptions(optionsRequest());
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.deepEqual(await response.json(), { success: true, data: {
            serviceability: { serviceable: true, source: 'seller_shipping_zone', carrier_confirmed: false },
            rates: [
                { id: 'rate-1', name: 'Standard', type: 'flat', amount_minor: 2500, estimated_days_min: 3, estimated_days_max: 5, cod_available: true, source: 'seller_zone_configuration', carrier_confirmed: false },
                { id: 'rate-2', name: 'Online only', type: 'flat', amount_minor: 1200, estimated_days_min: null, estimated_days_max: null, cod_available: false, source: 'seller_zone_configuration', carrier_confirmed: false },
            ],
        } });
        assert.equal(calls.length, 1);
    });
});

test('marketplace delivery options reject bad origins and invalid pins before the Gateway call', async () => {
    await withGateway(() => { throw new Error('gateway must not be called'); }, async (calls) => {
        assert.equal((await callOptions(optionsRequest({ origin: 'https://attacker.test' }))).status, 403);
        assert.equal((await callOptions(optionsRequest({ query: { country: 'IN', state: 'Karnataka', pincode: '000000' } }))).status, 400);
        assert.equal(calls.length, 0);
    });
});

test('foreign and missing origins, unknown steps, malformed bodies, and invalid handoffs are refused before gateway access', async () => {
    await withGateway(() => { throw new Error('gateway must not be called'); }, async (calls) => {
        assert.equal((await call(request('contact', { idempotency_key: 'contact-key-123', email: 'buyer@example.test', name: 'Buyer' }, { origin: 'https://attacker.test' }), 'contact')).status, 403);
        assert.equal((await call(request('contact', { idempotency_key: 'contact-key-123', email: 'buyer@example.test', name: 'Buyer' }, { origin: null }), 'contact')).status, 403);
        assert.equal((await call(request('constructor', {}, {}), 'constructor')).status, 404);
        assert.equal((await call(request('contact', '{broken'), 'contact')).status, 400);
        assert.equal((await call(request('contact', { idempotency_key: 'x', email: 'bad', name: '' }), 'contact')).status, 400);
        assert.equal((await call(request('contact', { idempotency_key: 'contact-key-123', email: 'buyer@example.test', name: 'Buyer' }, { cartId: 'not-a-uuid' }), 'contact', 'not-a-uuid')).status, 400);
        assert.equal(calls.length, 0);
    });
});

test('gateway failures become a generic unavailable response without upstream details', async () => {
    await withGateway(() => jsonResponse({ error: { code: 'DB_FAILURE', message: 'private-hostname 10.0.0.1' } }, { status: 500 }), async () => {
        const response = await call(request('contact', { idempotency_key: 'contact-key-123', email: 'buyer@example.test', name: 'Buyer' }), 'contact');
        assert.equal(response.status, 503);
        assert.doesNotMatch(await response.text(), /private-hostname|10\.0\.0\.1/);
    });
});

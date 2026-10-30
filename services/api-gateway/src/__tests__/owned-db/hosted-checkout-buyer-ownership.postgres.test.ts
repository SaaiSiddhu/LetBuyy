// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// The store-host buyer session is bound before checkout crosses to checkout.letbuyy.com, then
// the hosted confirmation creates the canonical order and ownership link atomically.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { after, afterEach, before } from 'node:test';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { LETBUYY_BUYER_SESSION_HEADER, LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { normalizeIdempotencyKey, type PaymentCreateIntentInput, type PaymentIntentResult } from '@letbuyy/payments';
import { hmacSha256Hex } from '../../lib/crypto';
import { Gateway, gatewayEnv, mintSession, newIdentityKeys, seedBuyerAccount, INTERNAL_SECRET, type IdentityKeys } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const { psql } = owned;
const site = newSyntheticTenant('hosted-buyer');
const otherSite = newSyntheticTenant('hosted-buyer-alt');
const SIGNING_SECRET = 'synthetic-hosted-checkout-signing-secret';
const RAZORPAY_KEY_SECRET = 'synthetic-hosted-razorpay-secret';
const shippingZoneId = crypto.randomUUID();
const onlineOnlyZoneId = crypto.randomUUID();
const shippingRateId = crypto.randomUUID();
const onlineRateId = crypto.randomUUID();
const onlineOnlyZoneRateId = crypto.randomUUID();
let keys: IdentityKeys;
let gateway: Gateway;
let pooledProxy: OwnedPooledSqlProxy;
let productId: string;

before(async () => {
    keys = await newIdentityKeys();
    seedSyntheticTenant(psql, site);
    seedSyntheticTenant(psql, otherSite);
    productId = crypto.randomUUID();
    psql(`
      INSERT INTO products (id,store_id,name,price,sku,is_active,stock,created_at,updated_at)
      VALUES ('${productId}','${site.siteId}','Synthetic hosted product',199.00,'SYN-HOSTED-${productId}',true,25,now(),now());
      INSERT INTO shipping_zones (id,store_id,site_id,name,countries,states,zip_codes,cod_enabled)
      VALUES
        ('${shippingZoneId}','${site.siteId}','${site.siteId}','COD and online zone',ARRAY['IN'],ARRAY['Karnataka','29'],ARRAY['560001'],true),
        ('${onlineOnlyZoneId}','${site.siteId}','${site.siteId}','Online only zone',ARRAY['IN'],ARRAY['Karnataka','29'],ARRAY['560001'],false);
      INSERT INTO shipping_rates (id,zone_id,site_id,name,type,price,is_active,cod_enabled)
      VALUES
        ('${shippingRateId}','${shippingZoneId}','${site.siteId}','COD delivery','flat',20.00,true,true),
        ('${onlineRateId}','${shippingZoneId}','${site.siteId}','Online payment delivery','flat',12.00,true,false),
        ('${onlineOnlyZoneRateId}','${onlineOnlyZoneId}','${site.siteId}','Online only zone delivery','flat',10.00,true,true);
      INSERT INTO inventory_levels (id,store_id,product_id,variant_id,location_id,available,reserved,committed_quantity,available_quantity,reserved_quantity,on_hand_quantity,created_at,updated_at)
      VALUES (gen_random_uuid(),'${site.siteId}','${productId}',NULL,'${site.locationId}',25,0,0,25,0,25,now(),now());
    `);
    pooledProxy = await startOwnedPooledSqlProxy(owned);
    gateway = new Gateway(gatewayEnv(owned, keys, { ...pooledProxy.env(), CHECKOUT_SIGNING_SECRET: SIGNING_SECRET, CHECKOUT_ORIGIN: 'https://checkout.letbuyy.com' }));
});
afterEach(async () => { await gateway.settle(); psql(`UPDATE sites SET access_mode='public',published=true WHERE id='${site.siteId}';`); });
after(async () => { await closePooledSqlClients(); await pooledProxy?.stop(); });

function seedCart() {
    const id = crypto.randomUUID();
    const token = `ct_${crypto.randomUUID().replace(/-/g, '')}`;
    const line = {
        id: productId,
        product_id: productId,
        variant_id: null,
        title: 'Synthetic hosted product',
        sku: `SYN-HOSTED-${productId}`,
        image_url: null,
        quantity: 1,
        unit_price: 199,
        currency: 'INR',
        properties: {},
        line_total: 199,
    };
    const items = JSON.stringify([line]).replace(/'/g, "''");
    psql(`INSERT INTO carts (id,store_id,session_id,items,status,channel,expires_at) VALUES ('${id}','${site.siteId}','${token}','${items}'::jsonb,'active','web',now()+interval '1 day');`);
    return { id, token };
}

async function storefrontHeaders(buyerId: string, siteId = site.siteId, epoch = 1) {
    return {
        [LETBUYY_STOREFRONT_SESSION_HEADER]: await mintSession(keys, buyerId, {
            audience: 'letbuyy:storefront-session', tokenUse: 'storefront_session', epoch,
            extraClaims: { site_id: siteId },
        }),
        'Content-Type': 'application/json',
    };
}

function ownership(orderId: string) {
    return JSON.parse(psql(`SELECT COALESCE(json_agg(json_build_object('buyer_account_id',buyer_account_id,'site_id',site_id,'link_basis',link_basis)),'[]'::json) FROM buyer_order_links WHERE order_id='${orderId}';`)) as Array<{ buyer_account_id: string; site_id: string; link_basis: string }>;
}

async function startHostedCheckout(cart: { id: string; token: string }, headers: Record<string, string> = {}) {
    return gateway.request(`/v1/storefront/${site.subdomain}/cart/${cart.token}/checkout-url`, {
        method: 'POST', headers,
    });
}

async function completeCodCheckout(cart: { id: string; token: string }, checkoutUrl: string) {
    const parsed = new URL(checkoutUrl);
    const handoff = parsed.searchParams.toString();
    const base = `/v1/checkout/${cart.id}`;
    const post = (step: string, body: Record<string, unknown>) => hostedCheckoutPost(cart, checkoutUrl, step, body);
    const started = await post('contact', { idempotency_key: `hosted-contact-${cart.id}`, email: 'syn-hosted@example.invalid', name: 'Synthetic Hosted Buyer' });
    assert.equal(started.status, 200, started.text);
    const delivery = await post('delivery', {
        idempotency_key: `hosted-delivery-${cart.id}`, shipping_method: 'standard', cod_requested: true,
        shipping_address: { line1: 'Fixture Road', city: 'Bengaluru', state: 'Karnataka', state_code: '29', zip: '560001', country: 'IN' },
        shipping_quote: { shipping_rate_id: shippingRateId, expected_shipping_amount: 20 },
    });
    assert.equal(delivery.status, 200, delivery.text);
    const intent = await post('payment-intent', { idempotency_key: `hosted-intent-${cart.id}`, provider: 'cod', mode: 'sandbox', tokenize: false, metadata: { channel: 'web' } });
    assert.equal(intent.status, 201, intent.text);
    const confirmed = await post('confirm', { idempotency_key: `hosted-confirm-${cart.id}` });
    assert.equal(confirmed.status, 200, confirmed.text);
    return confirmed.json?.data?.order?.id as string;
}

async function hostedCheckoutPost(cart: { id: string; token: string }, checkoutUrl: string, step: string, body: Record<string, unknown>, target = gateway): ReturnType<Gateway['request']> {
    const handoff = new URL(checkoutUrl).searchParams.toString();
    if (step === 'delivery' && !body.expected_quote_fingerprint) {
        const address = body.shipping_address as Record<string, unknown>;
        const quote = await hostedCheckoutPost(cart, checkoutUrl, 'quote', {
            shipping_address: { country: address.country, state: address.state, state_code: address.state_code, zip: address.zip },
            shipping_rate_id: (body.shipping_quote as Record<string, unknown>).shipping_rate_id,
        }, target);
        assert.equal(quote.status, 200, quote.text);
        body = { ...body, expected_quote_fingerprint: quote.json?.data?.quote?.fingerprint };
    }
    return target.request(`/v1/checkout/${cart.id}/${step}?${handoff}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
}

test('hosted Razorpay binds a canonical buyer order, waits for capture, and retries into one ledger effect', async () => {
    const buyer = seedBuyerAccount(psql, 'hosted-razorpay-owner');
    const cart = seedCart();
    const handoff = await startHostedCheckout(cart, await storefrontHeaders(buyer.id));
    assert.equal(handoff.status, 200, handoff.text);
    const checkoutUrl = handoff.json?.data?.checkout_url as string;
    assert.ok(checkoutUrl);

    const contact = await hostedCheckoutPost(cart, checkoutUrl, 'contact', {
        idempotency_key: `hosted-contact-${cart.id}`, email: 'razorpay-buyer@example.invalid', name: 'Razorpay Buyer',
    });
    assert.equal(contact.status, 200, contact.text);
    const delivery = await hostedCheckoutPost(cart, checkoutUrl, 'delivery', {
        idempotency_key: `hosted-delivery-${cart.id}`, shipping_method: 'standard', cod_requested: false,
        shipping_address: { line1: 'Fixture Road', city: 'Bengaluru', state: 'Karnataka', state_code: '29', zip: '560001', country: 'IN' },
        shipping_quote: { shipping_rate_id: onlineRateId, expected_shipping_amount: 12 },
    });
    assert.equal(delivery.status, 200, delivery.text);

    const providerOrderId = `order_${crypto.randomUUID().replace(/-/g, '')}`;
    const providerPaymentId = `pay_${crypto.randomUUID().replace(/-/g, '')}`;
    let expectedAmountMinor = 0;
    let createCalls = 0;
    let lookupCalls = 0;
    let captured = false;
    let returnForeignReceipt = true;
    let ambiguousProviderOrder: Record<string, unknown> | null = null;
    const adapter = {
        async createIntent(input: PaymentCreateIntentInput): Promise<PaymentIntentResult> {
            createCalls += 1;
            expectedAmountMinor = input.amount.amountMinor;
            assert.equal(input.amount.currency, 'INR');
            ambiguousProviderOrder = {
                id: providerOrderId,
                entity: 'order',
                amount: input.amount.amountMinor,
                currency: 'INR',
                receipt: input.receipt,
                status: 'created',
                notes: {
                    order_id: input.orderId,
                    store_id: input.storeId,
                    idempotency_key: normalizeIdempotencyKey(input.idempotencyKey),
                    ...input.metadata,
                },
            };
            // Model Razorpay committing the order while the response is lost in transit.
            throw new Error('synthetic timeout after provider order creation');
        },
        async fetchOrdersByReceipt(receipt: string) {
            lookupCalls += 1;
            assert.equal(receipt, cart.id);
            const order = ambiguousProviderOrder
                ? { ...ambiguousProviderOrder, ...(returnForeignReceipt ? { receipt: 'another-cart' } : {}) }
                : null;
            return { items: order ? [order] : [], count: order ? 1 : 0 };
        },
        async fetchPayment(paymentId: string) {
            return {
                id: paymentId, order_id: providerOrderId, amount: expectedAmountMinor,
                currency: 'INR', status: captured ? 'captured' : 'authorized', captured,
            };
        },
    };
    const razorpayGateway = new Gateway(gatewayEnv(owned, keys, {
        CHECKOUT_SIGNING_SECRET: SIGNING_SECRET,
        CHECKOUT_ORIGIN: 'https://checkout.letbuyy.com',
        LETBUYY_RAZORPAY_MODE: 'sandbox',
        RAZORPAY_KEY_ID: 'rzp_test_synthetic',
        RAZORPAY_KEY_SECRET,
        HOSTED_RAZORPAY_TEST_ADAPTER: adapter,
    }));

    const lostResponse = await hostedCheckoutPost(cart, checkoutUrl, 'payment-intent', {
        idempotency_key: `hosted-razorpay-intent-${cart.id}`, provider: 'razorpay', mode: 'sandbox', tokenize: false, metadata: {},
    }, razorpayGateway);
    assert.equal(lostResponse.status, 503, lostResponse.text);
    assert.equal(lostResponse.json?.error?.code, 'CHECKOUT_PROVIDER_ORDER_RECONCILIATION_REQUIRED');
    assert.equal(createCalls, 1);

    psql(`UPDATE sites SET access_mode='offline',published=false WHERE id='${site.siteId}';`);
    const mismatched = await hostedCheckoutPost(cart, checkoutUrl, 'payment-intent', {
        idempotency_key: `hosted-razorpay-intent-mismatch-${cart.id}`, provider: 'razorpay', mode: 'sandbox', tokenize: false, metadata: {},
    }, razorpayGateway);
    assert.equal(mismatched.status, 503, mismatched.text);
    assert.equal(mismatched.json?.error?.code, 'CHECKOUT_PROVIDER_ORDER_RECONCILIATION_REQUIRED');
    assert.equal(createCalls, 1, 'a foreign receipt must fail closed without creating another provider order');

    returnForeignReceipt = false;
    const intent = await hostedCheckoutPost(cart, checkoutUrl, 'payment-intent', {
        idempotency_key: `hosted-razorpay-intent-recover-${cart.id}`, provider: 'razorpay', mode: 'sandbox', tokenize: false, metadata: {},
    }, razorpayGateway);
    assert.equal(intent.status, 200, intent.text);
    assert.equal(createCalls, 1);
    assert.equal(lookupCalls, 2);
    const publicIntent = intent.json?.data?.payment_intent;
    assert.equal(publicIntent?.key_id, 'rzp_test_synthetic');
    assert.equal(publicIntent?.provider_order_id, providerOrderId);
    assert.equal(publicIntent?.amount_minor, expectedAmountMinor);
    assert.equal(publicIntent?.currency, 'INR');
    assert.equal('key_secret' in (publicIntent || {}), false);
    const intentResume = await hostedCheckoutPost(cart, checkoutUrl, 'payment-intent', {
        idempotency_key: `hosted-razorpay-intent-resume-${cart.id}`, provider: 'razorpay', mode: 'sandbox', tokenize: false, metadata: {},
    }, razorpayGateway);
    assert.equal(intentResume.status, 200, intentResume.text);
    assert.equal(intentResume.json?.data?.payment_intent?.provider_order_id, providerOrderId);
    assert.equal(createCalls, 1, 'resuming a bound checkout must not create another provider order');

    const binding = JSON.parse(psql(`SELECT json_build_object('order_id',cs.payment_intent->>'order_id','provider_order_id',cs.payment_intent->>'provider_order_id','amount_minor',cs.payment_intent->>'amount_minor','payment_id',o.payment_id,'total_minor',(o.total*100)::bigint) FROM checkout_sessions cs JOIN orders o ON o.id=(cs.payment_intent->>'order_id')::uuid WHERE cs.site_id='${site.siteId}' AND cs.cart_id='${cart.id}';`)) as Record<string, string>;
    assert.equal(binding.provider_order_id, providerOrderId);
    assert.equal(binding.payment_id, providerOrderId);
    assert.equal(Number(binding.amount_minor), Number(binding.total_minor));
    assert.equal(expectedAmountMinor, Number(binding.total_minor));
    const orderId = binding.order_id;

    const signature = await hmacSha256Hex(RAZORPAY_KEY_SECRET, `${providerOrderId}|${providerPaymentId}`);
    const confirmBody = {
        idempotency_key: `hosted-razorpay-confirm-${cart.id}`,
        razorpay_order_id: providerOrderId, razorpay_payment_id: providerPaymentId, razorpay_signature: signature,
    };
    const pending = await hostedCheckoutPost(cart, checkoutUrl, 'confirm', confirmBody, razorpayGateway);
    assert.equal(pending.status, 409, pending.text);
    assert.equal(pending.json?.error?.code, 'CHECKOUT_PROVIDER_PAYMENT_PENDING');
    assert.equal(psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${site.siteId}' AND source_type='payment_capture' AND source_id='razorpay:${providerPaymentId}';`), '0');

    captured = true;
    const confirmed = await hostedCheckoutPost(cart, checkoutUrl, 'confirm', confirmBody, razorpayGateway);
    assert.equal(confirmed.status, 200, confirmed.text);
    assert.equal(confirmed.json?.data?.order?.id, orderId);
    assert.deepEqual(ownership(orderId), [{ buyer_account_id: buyer.id, site_id: site.siteId, link_basis: 'authenticated_checkout' }]);
    assert.equal(psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${site.siteId}' AND source_type='payment_capture' AND source_id='razorpay:${providerPaymentId}';`), '1');

    const replay = await hostedCheckoutPost(cart, checkoutUrl, 'confirm', confirmBody, razorpayGateway);
    assert.equal(replay.status, 200, replay.text);
    assert.equal(replay.json?.data?.order?.id, orderId);
    assert.equal(psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${site.siteId}' AND source_type='payment_capture' AND source_id='razorpay:${providerPaymentId}';`), '1');
    await razorpayGateway.settle();
});

test('normal Razorpay setup confirms its converted cart once for guest and authenticated buyers', async t => {
    for (const authenticated of [false, true]) for (const webhookFirst of [false, true]) await t.test(
        `${authenticated ? 'bound buyer' : 'guest buyer'} / ${webhookFirst ? 'webhook first' : 'browser first'}`, async () => {
        const buyer = authenticated ? seedBuyerAccount(psql, 'normal-razorpay-owner') : null;
        // Use the same fact-capturing cart writer as the real storefront. The
        // older raw-SQL carts above omit these facts and take a different path.
        const added = await gateway.request(`/v1/storefront/${site.subdomain}/cart`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...(buyer ? await storefrontHeaders(buyer.id) : {}) },
            body: JSON.stringify({ lines: [{ product_id: productId, quantity: 1 }] }),
        });
        assert.equal(added.status, 201, added.text);
        assert.equal(typeof added.json?.data.lines[0].snapshot_fingerprint, 'string');
        const cart = { id: added.json!.data.id as string, token: added.json!.data.cart_token as string };
        const handoff = await startHostedCheckout(cart, buyer ? await storefrontHeaders(buyer.id) : {});
        assert.equal(handoff.status, 200, handoff.text);
        const url = handoff.json!.data.checkout_url as string;
        assert.equal((await hostedCheckoutPost(cart, url, 'contact', {
            idempotency_key: `normal-contact-${cart.id}`, email: 'normal-payment@example.invalid', name: 'Synthetic Buyer',
        })).status, 200);
        assert.equal((await hostedCheckoutPost(cart, url, 'delivery', {
            idempotency_key: `normal-delivery-${cart.id}`, shipping_method: 'standard', cod_requested: false,
            shipping_address: { line1: 'Fixture Road', city: 'Bengaluru', state: 'Karnataka', state_code: '29', zip: '560001', country: 'IN' },
            shipping_quote: { shipping_rate_id: onlineRateId, expected_shipping_amount: 12 },
        })).status, 200);
        const providerOrderId = `order_${crypto.randomUUID().replace(/-/g, '')}`;
        const providerPaymentId = `pay_${crypto.randomUUID().replace(/-/g, '')}`;
        let amountMinor = 0, createCalls = 0, captured = false;
        const adapter = {
            async createIntent(input: PaymentCreateIntentInput): Promise<PaymentIntentResult> {
                createCalls++; amountMinor = input.amount.amountMinor;
                return { provider: 'razorpay', status: 'requires_action', amount: input.amount,
                    idempotencyKey: normalizeIdempotencyKey(String(input.idempotencyKey)), references: { providerOrderId } };
            },
            async fetchOrdersByReceipt() { return { items: [], count: 0 }; },
            async fetchPayment(paymentId: string) {
                return { id: paymentId, order_id: providerOrderId, amount: amountMinor, currency: 'INR',
                    status: captured ? 'captured' : 'authorized', captured };
            },
        };
        const paymentGateway = new Gateway(gatewayEnv(owned, keys, {
            ...pooledProxy.env(), CHECKOUT_SIGNING_SECRET: SIGNING_SECRET, CHECKOUT_ORIGIN: 'https://checkout.letbuyy.com',
            LETBUYY_RAZORPAY_MODE: 'sandbox', RAZORPAY_KEY_ID: 'rzp_test_synthetic', RAZORPAY_KEY_SECRET,
            HOSTED_RAZORPAY_TEST_ADAPTER: adapter,
        }));
        try {
            const intent = await hostedCheckoutPost(cart, url, 'payment-intent', {
                idempotency_key: `normal-intent-${cart.id}`, provider: 'razorpay', mode: 'sandbox', tokenize: false, metadata: {},
            }, paymentGateway);
            assert.equal(intent.status, 201, intent.text);
            const orderId = psql(`SELECT id FROM orders WHERE payment_id='${providerOrderId}' AND site_id='${site.siteId}';`);
            assert.ok(orderId);
            assert.equal(psql(`SELECT status FROM carts WHERE id='${cart.id}';`), 'converted');
            const body = { idempotency_key: `normal-confirm-${cart.id}`, razorpay_order_id: providerOrderId,
                razorpay_payment_id: providerPaymentId, razorpay_signature: await hmacSha256Hex(RAZORPAY_KEY_SECRET, `${providerOrderId}|${providerPaymentId}`) };
            const invalid = await hostedCheckoutPost(cart, url, 'confirm', { ...body, idempotency_key: `invalid-proof-${cart.id}`, razorpay_signature: '0'.repeat(64) }, paymentGateway);
            assert.equal(invalid.status, 400, invalid.text);
            assert.equal(invalid.json?.error.code, 'CHECKOUT_PROVIDER_SIGNATURE_INVALID');
            if (webhookFirst) {
                captured = true;
                const transition = {
                    orderId, provider: 'razorpay', paymentId: providerPaymentId, providerOrderId,
                    providerEventId: `native-webhook-first:${providerPaymentId}`,
                    idempotencyKey: `native-webhook-first:${providerPaymentId}`,
                };
                for (let attempt = 0; attempt < 2; attempt++) {
                    const paid = await paymentGateway.request('/v1/storefront/internal/payments/confirm', {
                        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Internal-API-Secret': INTERNAL_SECRET },
                        body: JSON.stringify(transition),
                    });
                    assert.equal(paid.status, 200, paid.text);
                }
                assert.equal(psql(`SELECT payment_id FROM orders WHERE id='${orderId}';`), providerPaymentId);
                const originalSession = psql(`SELECT row_to_json(s)::text FROM checkout_sessions s WHERE cart_id='${cart.id}' AND payment_method='razorpay';`);
                const recoveryPath = `/v1/storefront/${site.subdomain}/cart/${cart.token}/checkout-status`;
                const recovered = await paymentGateway.request(recoveryPath);
                assert.equal(recovered.status, 200, recovered.text);
                assert.equal(recovered.json?.data.checkout_state, 'completed');
                assert.equal(recovered.json?.data.order.id, orderId);
                assert.doesNotMatch(recovered.text, /normal-payment@|Synthetic Buyer|Fixture Road|provider_payment_id|payment_intent/);
                assert.equal(psql(`SELECT row_to_json(s)::text FROM checkout_sessions s WHERE cart_id='${cart.id}' AND payment_method='razorpay';`), originalSession, 'receipt recovery must be a read');
                assert.equal((await paymentGateway.request(`/v1/storefront/${otherSite.subdomain}/cart/${cart.token}/checkout-status`)).status, 404);
                assert.equal((await paymentGateway.request(`/v1/storefront/${site.subdomain}/cart/ct_${crypto.randomUUID().replace(/-/g, '')}/checkout-status`)).status, 404);
                const otherPaymentId = `pay_${crypto.randomUUID().replace(/-/g, '')}`;
                const foreignProof = await hostedCheckoutPost(cart, url, 'confirm', {
                    ...body, idempotency_key: `different-capture-${cart.id}`, razorpay_payment_id: otherPaymentId,
                    razorpay_signature: await hmacSha256Hex(RAZORPAY_KEY_SECRET, `${providerOrderId}|${otherPaymentId}`),
                }, paymentGateway);
                assert.equal(foreignProof.status, 409, foreignProof.text);
                assert.equal(foreignProof.json?.error.code, 'CHECKOUT_PROVIDER_AMOUNT_MISMATCH');
            } else {
                const pending = await hostedCheckoutPost(cart, url, 'confirm', body, paymentGateway);
                assert.equal(pending.status, 409, pending.text);
                assert.equal(pending.json?.error.code, 'CHECKOUT_PROVIDER_PAYMENT_PENDING');
                const pendingReceipt = await paymentGateway.request(`/v1/storefront/${site.subdomain}/cart/${cart.token}/checkout-status`);
                assert.equal(pendingReceipt.status, 200, pendingReceipt.text);
                assert.notEqual(pendingReceipt.json?.data.checkout_state, 'completed');
                assert.equal(pendingReceipt.json?.data.order, undefined);
                captured = true;
            }
            const confirmed = await hostedCheckoutPost(cart, url, 'confirm', body, paymentGateway);
            assert.equal(confirmed.status, 200, confirmed.text);
            assert.equal(confirmed.json?.data.order.id, orderId);
            const replay = await hostedCheckoutPost(cart, url, 'confirm', body, paymentGateway);
            assert.equal(replay.status, 200, replay.text);
            assert.equal(replay.json?.data.order.id, orderId);
            assert.equal(createCalls, 1);
            assert.equal(psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${site.siteId}' AND source_type='payment_capture' AND source_id='razorpay:${providerPaymentId}';`), '1');
            assert.equal(psql(`SELECT count(*) FROM payment_transactions WHERE order_id='${orderId}' AND provider_payment_id='${providerPaymentId}' AND status='captured';`), '1');
            assert.equal(psql(`SELECT count(*) FROM ledger_entries e JOIN ledger_transactions t ON t.id=e.transaction_id WHERE t.site_id='${site.siteId}' AND t.source_type='payment_capture' AND t.source_id='razorpay:${providerPaymentId}';`), '2');
            assert.equal(psql(`SELECT COALESCE(sum(CASE WHEN e.side='debit' THEN e.amount_minor ELSE -e.amount_minor END),0) FROM ledger_entries e JOIN ledger_transactions t ON t.id=e.transaction_id WHERE t.site_id='${site.siteId}' AND t.source_type='payment_capture' AND t.source_id='razorpay:${providerPaymentId}';`), '0');
            assert.equal(psql(`SELECT status FROM carts WHERE id='${cart.id}';`), 'converted');
            assert.equal(psql(`SELECT checkout_state FROM checkout_sessions WHERE cart_id='${cart.id}' AND payment_method='razorpay';`), 'completed');
            assert.deepEqual(ownership(orderId), buyer ? [{ buyer_account_id: buyer.id, site_id: site.siteId, link_basis: 'authenticated_checkout' }] : []);
        } finally { await paymentGateway.settle(); }
    });
});

test('hosted checkout records a late capture once, refuses fulfillment, and preserves the refund obligation', async () => {
    const buyer = seedBuyerAccount(psql, 'hosted-late-capture');
    const cart = seedCart();
    const handoff = await startHostedCheckout(cart, await storefrontHeaders(buyer.id));
    assert.equal(handoff.status, 200, handoff.text);
    const checkoutUrl = handoff.json?.data?.checkout_url as string;
    assert.ok(checkoutUrl);

    const contact = await hostedCheckoutPost(cart, checkoutUrl, 'contact', {
        idempotency_key: `late-contact-${cart.id}`, email: 'late-capture@example.invalid', name: 'Late Capture Buyer',
    });
    assert.equal(contact.status, 200, contact.text);
    const delivery = await hostedCheckoutPost(cart, checkoutUrl, 'delivery', {
        idempotency_key: `late-delivery-${cart.id}`, shipping_method: 'standard', cod_requested: false,
        shipping_address: { line1: 'Fixture Road', city: 'Bengaluru', state: 'Karnataka', state_code: '29', zip: '560001', country: 'IN' },
        shipping_quote: { shipping_rate_id: onlineRateId, expected_shipping_amount: 12 },
    });
    assert.equal(delivery.status, 200, delivery.text);

    const providerOrderId = `order_${crypto.randomUUID().replace(/-/g, '')}`;
    const providerPaymentId = `pay_${crypto.randomUUID().replace(/-/g, '')}`;
    let amountMinor = 0;
    let paymentLookups = 0;
    const adapter = {
        async createIntent(input: PaymentCreateIntentInput): Promise<PaymentIntentResult> {
            amountMinor = input.amount.amountMinor;
            return {
                provider: 'razorpay',
                status: 'requires_action',
                amount: input.amount,
                idempotencyKey: normalizeIdempotencyKey(String(input.idempotencyKey)),
                references: { providerOrderId },
            };
        },
        async fetchOrdersByReceipt() { return { items: [], count: 0 }; },
        async fetchPayment(paymentId: string) {
            paymentLookups += 1;
            return {
                id: paymentId, order_id: providerOrderId, amount: amountMinor,
                currency: 'INR', status: 'captured', captured: true,
            };
        },
    };
    const paymentGateway = new Gateway(gatewayEnv(owned, keys, {
        CHECKOUT_SIGNING_SECRET: SIGNING_SECRET,
        CHECKOUT_ORIGIN: 'https://checkout.letbuyy.com',
        LETBUYY_RAZORPAY_MODE: 'sandbox',
        RAZORPAY_KEY_ID: 'rzp_test_synthetic',
        RAZORPAY_KEY_SECRET,
        HOSTED_RAZORPAY_TEST_ADAPTER: adapter,
    }));
    const intent = await hostedCheckoutPost(cart, checkoutUrl, 'payment-intent', {
        idempotency_key: `late-intent-${cart.id}`, provider: 'razorpay', mode: 'sandbox', tokenize: false, metadata: {},
    }, paymentGateway);
    assert.equal(intent.status, 201, intent.text);

    const orderId = psql(`SELECT id::text FROM orders WHERE payment_id='${providerOrderId}';`);
    assert.ok(orderId);
    const inventoryBefore = psql(`SELECT available || '|' || reserved || '|' || committed_quantity || '|' || available_quantity || '|' || reserved_quantity
      FROM inventory_levels WHERE store_id='${site.siteId}' AND product_id='${productId}';`);
    assert.equal(psql(`SELECT status FROM inventory_reservations WHERE order_id='${orderId}';`), 'committed');

    psql(`UPDATE inventory_reservations SET committed_at=now()-interval '2 hours' WHERE order_id='${orderId}';`);
    const swept = Number(psql(`SELECT expire_unpaid_committed_reservations(100,60,'late-capture-sweep-${cart.id}');`));
    assert.ok(swept >= 1);
    assert.equal(psql(`SELECT status || '|' || (inventory_released_at IS NOT NULL)::text FROM orders WHERE id='${orderId}';`), 'pending|true');
    assert.equal(psql(`SELECT status FROM inventory_reservations WHERE order_id='${orderId}';`), 'released');
    const [availableBefore, reservedBefore, committedBefore, availableQuantityBefore, reservedQuantityBefore] = inventoryBefore.split('|').map(Number);
    assert.equal(psql(`SELECT available || '|' || reserved || '|' || committed_quantity || '|' || available_quantity || '|' || reserved_quantity
      FROM inventory_levels WHERE store_id='${site.siteId}' AND product_id='${productId}';`), [availableBefore + 1, reservedBefore, committedBefore - 1, availableQuantityBefore, reservedQuantityBefore].join('|'));

    psql(`UPDATE sites SET access_mode='offline',published=false WHERE id='${site.siteId}';`);
    const paymentIdempotencyKey = `late-confirm-${cart.id}`;
    const confirmBody = {
        idempotency_key: paymentIdempotencyKey,
        razorpay_order_id: providerOrderId,
        razorpay_payment_id: providerPaymentId,
        razorpay_signature: await hmacSha256Hex(RAZORPAY_KEY_SECRET, `${providerOrderId}|${providerPaymentId}`),
    };
    const confirm = () => hostedCheckoutPost(cart, checkoutUrl, 'confirm', confirmBody, paymentGateway);
    const lateCapture = await confirm();
    assert.equal(lateCapture.status, 409, lateCapture.text);
    assert.equal(lateCapture.json?.error?.code, 'PAYMENT_CAPTURED_ORDER_UNFULFILLABLE');
    assert.equal(lateCapture.json?.error?.message, 'Payment was captured but the order needs support review.');
    assert.equal(paymentLookups, 1);
    assert.equal(psql(`SELECT checkout_state FROM checkout_sessions WHERE cart_id='${cart.id}';`), 'failed');
    assert.equal(psql(`SELECT count(*) FROM outbox_events WHERE store_id='${site.siteId}' AND aggregate_id=(SELECT id::text FROM checkout_sessions WHERE cart_id='${cart.id}') AND event_type='checkout.failed';`), '1');

    assert.equal(psql(`SELECT status || '|' || fulfillment_state || '|' || payment_status || '|' || refund_status || '|' || (inventory_released_at IS NOT NULL)::text
      FROM orders WHERE id='${orderId}';`), 'cancelled|cancelled|paid|pending|true');
    assert.equal(psql(`SELECT count(*) FROM payment_transactions WHERE order_id='${orderId}' AND provider_payment_id='${providerPaymentId}' AND status='captured';`), '1');
    assert.equal(psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${site.siteId}' AND source_type='payment_capture' AND source_id='razorpay:${providerPaymentId}';`), '1');
    assert.equal(psql(`SELECT count(*) FROM compensation_actions WHERE site_id='${site.siteId}' AND flow='checkout_confirm' AND action='refund_captured_payment' AND idempotency_key='refund_captured_payment:razorpay:${providerPaymentId}';`), '1');
    assert.equal(psql(`SELECT count(*) FROM outbox_events WHERE store_id='${site.siteId}' AND aggregate_id='${orderId}' AND event_type='order.paid';`), '0');

    const replay = await confirm();
    assert.equal(replay.status, 409, replay.text);
    assert.deepEqual(replay.json, lateCapture.json);
    assert.equal(paymentLookups, 1, 'an idempotent checkout retry must replay without querying or recapturing the provider payment');
    assert.equal(psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${site.siteId}' AND source_type='payment_capture' AND source_id='razorpay:${providerPaymentId}';`), '1');
    assert.equal(psql(`SELECT count(*) FROM compensation_actions WHERE site_id='${site.siteId}' AND flow='checkout_confirm' AND action='refund_captured_payment' AND idempotency_key='refund_captured_payment:razorpay:${providerPaymentId}';`), '1');
    await paymentGateway.settle();
});

test('signed storefront delivery options include online-only rates and preserve exact COD eligibility', async () => {
    const cart = seedCart();
    const handoff = await startHostedCheckout(cart);
    assert.equal(handoff.status, 200, handoff.text);
    const checkoutUrl = handoff.json?.data?.checkout_url as string;
    const params = new URL(checkoutUrl).searchParams;
    const query = new URLSearchParams({
        site_id: params.get('site_id') || '',
        cart_token: params.get('cart_token') || '',
        expires_at: params.get('expires_at') || '',
        cart_digest: params.get('cart_digest') || '',
        signature: params.get('signature') || '',
        channel: params.get('channel') || '',
        country: 'IN', state: 'Karnataka', state_code: '29', pincode: '560001',
    });
    const response = await gateway.request(`/v1/checkout/${cart.id}/delivery-options?${query}`);
    assert.equal(response.status, 200, response.text);
    const rates = response.json?.data?.rates as Array<{ id: string; amount: number; cod_available: boolean }>;
    assert.equal(rates.find((rate) => rate.id === shippingRateId)?.cod_available, true);
    assert.equal(rates.find((rate) => rate.id === onlineRateId)?.cod_available, false);
    assert.equal(rates.find((rate) => rate.id === onlineOnlyZoneRateId)?.cod_available, false);
    assert.equal(rates.find((rate) => rate.id === onlineRateId)?.amount, 12);
    assert.equal(rates.find((rate) => rate.id === onlineOnlyZoneRateId)?.amount, 10);
});

test('hosted storefront refuses COD when the reviewed seller rate or its zone disallows COD', async () => {
    const cart = seedCart();
    const handoff = await startHostedCheckout(cart);
    assert.equal(handoff.status, 200, handoff.text);
    const checkoutUrl = handoff.json?.data?.checkout_url as string;
    const contact = await hostedCheckoutPost(cart, checkoutUrl, 'contact', {
        idempotency_key: `hosted-contact-cod-denied-${cart.id}`, email: 'syn-hosted-cod-denied@example.invalid', name: 'Synthetic Hosted Buyer',
    });
    assert.equal(contact.status, 200, contact.text);
    const delivery = await hostedCheckoutPost(cart, checkoutUrl, 'delivery', {
        idempotency_key: `hosted-delivery-cod-denied-${cart.id}`, shipping_method: 'standard', cod_requested: true,
        shipping_address: { line1: 'Fixture Road', city: 'Bengaluru', state: 'Karnataka', state_code: '29', zip: '560001', country: 'IN' },
        shipping_quote: { shipping_rate_id: onlineOnlyZoneRateId, expected_shipping_amount: 10 },
    });
    assert.equal(delivery.status, 409, delivery.text);
    assert.equal(delivery.json?.error?.code, 'CHECKOUT_COD_UNAVAILABLE');
});

test('an authenticated store-host handoff remains private across the redirect and creates one owned hosted COD order', async () => {
    const buyer = seedBuyerAccount(psql, 'hosted-owner');
    const cart = seedCart();
    const handoff = await startHostedCheckout(cart, await storefrontHeaders(buyer.id));
    assert.equal(handoff.status, 200, handoff.text);
    const checkoutUrl = handoff.json?.data?.checkout_url as string;
    assert.ok(checkoutUrl);
    assert.equal(new URL(checkoutUrl).searchParams.has('buyer_account_id'), false);
    assert.equal(new URL(checkoutUrl).searchParams.has('buyer_token'), false);
    const session = JSON.parse(psql(`SELECT json_build_object('buyer_account_id',buyer_account_id,'buyer_session_epoch',buyer_session_epoch) FROM checkout_sessions WHERE site_id='${site.siteId}' AND cart_id='${cart.id}';`));
    assert.deepEqual(session, { buyer_account_id: buyer.id, buyer_session_epoch: 1 });

    const orderId = await completeCodCheckout(cart, checkoutUrl);
    assert.ok(orderId);
    assert.deepEqual(ownership(orderId), [{ buyer_account_id: buyer.id, site_id: site.siteId, link_basis: 'authenticated_checkout' }]);
    psql(`UPDATE sites SET access_mode='offline',published=false WHERE id='${site.siteId}';`);
    const replay = await gateway.request(`/v1/checkout/${cart.id}/confirm?${new URL(checkoutUrl).searchParams}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idempotency_key: `hosted-confirm-${cart.id}` }),
    });
    assert.equal(replay.status, 200, replay.text);
    assert.equal(replay.json?.data?.order?.id, orderId);
    assert.equal(ownership(orderId).length, 1);
    const buyerHeaders={[LETBUYY_BUYER_SESSION_HEADER]:await mintSession(keys,buyer.id,{epoch:1})};
    const history=await gateway.request('/v1/storefront/buyer/orders/'+orderId,{headers:buyerHeaders});assert.equal(history.status,200,history.text);
    const stranger=seedBuyerAccount(psql,'hosted-history-other');assert.equal((await gateway.request('/v1/storefront/buyer/orders/'+orderId,{headers:{[LETBUYY_BUYER_SESSION_HEADER]:await mintSession(keys,stranger.id,{epoch:1})}})).status,404);
    const recovery=await gateway.request(`/v1/storefront/${site.subdomain}/cart/${cart.token}/checkout-status`);
    assert.equal(recovery.status,200,recovery.text);assert.doesNotMatch(recovery.text,/syn-hosted@|Synthetic Hosted Buyer|Fixture Road|razorpay_signature/);
    assert.equal((await gateway.request(`/v1/storefront/${otherSite.subdomain}/cart/${cart.token}/checkout-status`)).status,404);

});

test('guest hosted checkout stays unlinked and another store cannot bind the buyer session', async () => {
    const guestCart = seedCart();
    const guestHandoff = await startHostedCheckout(guestCart);
    assert.equal(guestHandoff.status, 200, guestHandoff.text);
    const guestOrder = await completeCodCheckout(guestCart, guestHandoff.json?.data?.checkout_url as string);
    assert.deepEqual(ownership(guestOrder), []);

    const buyer = seedBuyerAccount(psql, 'hosted-wrong-site');
    const cart = seedCart();
    const wrongSite = await startHostedCheckout(cart, await storefrontHeaders(buyer.id, otherSite.siteId));
    assert.equal(wrongSite.status, 401, wrongSite.text);
    assert.equal(psql(`SELECT count(*) FROM checkout_sessions WHERE site_id='${site.siteId}' AND cart_id='${cart.id}';`), '0');
});

test('one hosted cart cannot be rebound to a different buyer, and revocation racing the bind is denied', async () => {
    const first = seedBuyerAccount(psql, 'hosted-first');
    const second = seedBuyerAccount(psql, 'hosted-second');
    const cart = seedCart();
    const firstHandoff = await startHostedCheckout(cart, await storefrontHeaders(first.id));
    assert.equal(firstHandoff.status, 200, firstHandoff.text);
    const conflict = await startHostedCheckout(cart, await storefrontHeaders(second.id));
    assert.equal(conflict.status, 409, conflict.text);
    assert.equal(psql(`SELECT buyer_account_id FROM checkout_sessions WHERE site_id='${site.siteId}' AND cart_id='${cart.id}';`), first.id);
    const firstOrderId = await completeCodCheckout(cart, firstHandoff.json?.data?.checkout_url as string);
    assert.deepEqual(ownership(firstOrderId), [{ buyer_account_id: first.id, site_id: site.siteId, link_basis: 'authenticated_checkout' }]);

    const racedBuyer = seedBuyerAccount(psql, 'hosted-race');
    const racedCart = seedCart();
    const { tapRest } = await import('./gateway-harness');
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if (call.resource === 'buyer_accounts' && call.method === 'GET' && call.search.get('id') === `eq.${racedBuyer.id}`) {
            const response = await forward();
            psql(`UPDATE buyer_accounts SET session_epoch=2 WHERE id='${racedBuyer.id}';`);
            return response;
        }
        return forward();
    });
    try {
        const response = await startHostedCheckout(racedCart, await storefrontHeaders(racedBuyer.id));
        assert.equal(response.status, 401, response.text);
        assert.equal(psql(`SELECT count(*) FROM checkout_sessions WHERE site_id='${site.siteId}' AND cart_id='${racedCart.id}';`), '0');
    } finally {
        tap.restore();
    }
});

test('buyer binding is backend-only and its rollback/reapply preserves checkout and order records', async () => {
    const signature = 'public.bind_hosted_checkout_buyer(uuid,uuid,text,text,uuid,integer)';
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        assert.equal(psql(`SELECT has_function_privilege('${role}','${signature}','EXECUTE');`), 'f');
    }
    assert.equal(psql(`SELECT has_function_privilege('service_role','${signature}','EXECUTE');`), 't');

    const buyer = seedBuyerAccount(psql, 'hosted-rollback');
    const cart = seedCart();
    const handoff = await startHostedCheckout(cart, await storefrontHeaders(buyer.id));
    assert.equal(handoff.status, 200, handoff.text);
    const rollback = readFileSync(new URL('../../../../../database/supabase/rollback/268_hosted_checkout_buyer_binding.rollback.sql', import.meta.url), 'utf8');
    const migration = readFileSync(new URL('../../../../../database/supabase/migrations/268_hosted_checkout_buyer_binding.sql', import.meta.url), 'utf8');
    assert.match(owned.psqlExpectError(rollback), /cannot roll back hosted checkout buyer binding while active buyer checkouts exist/);
    assert.equal(psql(`SELECT to_regprocedure('${signature}') IS NOT NULL;`), 't');

    const orderId = await completeCodCheckout(cart, handoff.json?.data?.checkout_url as string);
    assert.ok(orderId);
    const orderCount = psql(`SELECT count(*) FROM orders WHERE id='${orderId}';`);
    owned.script(rollback);
    assert.equal(psql(`SELECT to_regprocedure('${signature}') IS NULL;`), 't');
    assert.equal(psql(`SELECT count(*) FROM orders WHERE id='${orderId}';`), orderCount);
    assert.equal(psql(`SELECT count(*) FROM checkout_sessions WHERE site_id='${site.siteId}' AND cart_id='${cart.id}';`), '1');
    assert.deepEqual(ownership(orderId), [{ buyer_account_id: buyer.id, site_id: site.siteId, link_basis: 'authenticated_checkout' }]);
    owned.script(migration);
    assert.equal(psql(`SELECT to_regprocedure('${signature}') IS NOT NULL;`), 't');
    assert.equal(psql(`SELECT count(*) FROM checkout_sessions WHERE site_id='${site.siteId}' AND cart_id='${cart.id}';`), '1');
    assert.deepEqual(ownership(orderId), [{ buyer_account_id: buyer.id, site_id: site.siteId, link_basis: 'authenticated_checkout' }]);
});

test('current offline policy refuses every new hosted step before claims while public recovery preserves the same checkout intent',async()=>{
 const cart=seedCart(),issued=await startHostedCheckout(cart);assert.equal(issued.status,200);const url=issued.json!.data.checkout_url;
 const contact={email:'synthetic-step-access@example.invalid',name:'Synthetic hosted step shopper'};
 const delivery={shipping_method:'standard',cod_requested:true,shipping_address:{line1:'Fixture Road',city:'Bengaluru',state:'Karnataka',state_code:'29',zip:'560001',country:'IN'},shipping_quote:{shipping_rate_id:shippingRateId,expected_shipping_amount:20}};
 const intent={provider:'cod',mode:'sandbox',tokenize:false,metadata:{}};
 for(const[step,payload]of [['contact',contact],['delivery',delivery],['payment-intent',intent]] as const){const result=await hostedCheckoutPost(cart,url,step,{...payload,idempotency_key:crypto.randomUUID()});assert.ok(result.status===200||result.status===201,result.text);}
 const counts=()=>psql(`SELECT jsonb_build_object('claims',(SELECT count(*) FROM idempotency_keys WHERE site_id='${site.siteId}'),'orders',(SELECT count(*) FROM orders WHERE store_id='${site.siteId}'),'sessions',(SELECT count(*) FROM checkout_sessions WHERE site_id='${site.siteId}'))::text;`);
 const before=counts(),confirmKey=crypto.randomUUID();psql(`UPDATE sites SET access_mode='offline' WHERE id='${site.siteId}';`);
 for(const[step,payload]of [['contact',contact],['delivery',delivery],['payment-intent',intent],['confirm',{}]] as const){const result=await hostedCheckoutPost(cart,url,step,{...payload,...(step==='delivery'?{expected_quote_fingerprint:'0'.repeat(64)}:{}),idempotency_key:step==='confirm'?confirmKey:crypto.randomUUID()});assert.equal(result.status,503,result.text);}
 assert.equal(counts(),before);assert.equal(psql(`SELECT checkout_state FROM checkout_sessions WHERE cart_id='${cart.id}';`),'payment_intent');
 psql(`UPDATE sites SET access_mode='public' WHERE id='${site.siteId}';`);const recovered=await hostedCheckoutPost(cart,url,'confirm',{idempotency_key:confirmKey});assert.equal(recovered.status,200,recovered.text);
});

test('checkout state never returns shopper contact from session and site ids without its cart capability',async()=>{
 const cart=seedCart(),issued=await startHostedCheckout(cart);assert.equal(issued.status,200);
 const contact=await hostedCheckoutPost(cart,issued.json!.data.checkout_url,'contact',{idempotency_key:crypto.randomUUID(),email:'synthetic-private-state@example.invalid',name:'Synthetic Private State'});assert.equal(contact.status,200);
 const id=contact.json!.data.checkout.id,path='/v1/checkout/'+id+'?site_id='+site.siteId;
 const exposed=await gateway.request(path);console.info('OWNED_SESSION_PRIVACY_BASELINE '+JSON.stringify({status:exposed.status,contactReturned:exposed.text.includes('synthetic-private-state@example.invalid')}));
 assert.equal(exposed.status,401);assert.equal(exposed.text.includes('synthetic-private-state@example.invalid'),false);
});
test('deleting a completed cart cannot reactivate it or erase its retained items',async()=>{
 const cart=seedCart(),issued=await startHostedCheckout(cart);assert.equal(issued.status,200);await completeCodCheckout(cart,issued.json!.data.checkout_url);
 const before=psql(`SELECT jsonb_build_object('status',status,'items',items,'coupon',coupon_code)::text FROM carts WHERE id='${cart.id}';`);
 const removed=await gateway.request(`/v1/storefront/${site.subdomain}/cart/${cart.token}`,{method:'DELETE'});
 const after=psql(`SELECT jsonb_build_object('status',status,'items',items,'coupon',coupon_code)::text FROM carts WHERE id='${cart.id}';`);
 console.info('OWNED_CART_DELETE_BASELINE '+JSON.stringify({status:removed.status,beforeStatus:JSON.parse(before).status,afterStatus:JSON.parse(after).status,itemsBefore:JSON.parse(before).items.length,itemsAfter:JSON.parse(after).items.length}));
 assert.equal(removed.status,409);assert.equal(after,before);
});

test('matching checkout cart capability permits its state, while duplicate/foreign/wrong input and dependency faults remain distinct',async()=>{
 const cart=seedCart(),issued=await startHostedCheckout(cart);assert.equal(issued.status,200);
 const contact=await hostedCheckoutPost(cart,issued.json!.data.checkout_url,'contact',{idempotency_key:crypto.randomUUID(),email:'synthetic-state-owner@example.invalid',name:'Synthetic state owner'});assert.equal(contact.status,200);
 const id=contact.json!.data.checkout.id,base='/v1/checkout/'+id+'?'+new URLSearchParams({site_id:site.siteId});
 const statePath=(targetSite=site.siteId,targetToken=cart.token,sessionId=id)=>'/v1/checkout/'+sessionId+'?'+new URLSearchParams({site_id:targetSite,cart_token:targetToken});
 const duplicate=(field:'site_id'|'cart_token')=>{const query=new URLSearchParams({site_id:site.siteId,cart_token:cart.token});query.append(field,field==='site_id'?site.siteId:cart.token);return'/v1/checkout/'+id+'?'+query;};
 const {tapRest,restJson}=await import('./gateway-harness');let down=false;const tap=tapRest(owned.restUrl,(call,forward)=>down&&call.resource==='checkout_sessions'&&call.method==='GET'?Promise.resolve(restJson(503,{message:'Synthetic private state dependency'})):forward());
 try{
  const start=tap.calls.length;assert.equal((await gateway.request(base)).status,401);assert.equal(tap.calls.slice(start).filter(c=>c.resource==='checkout_sessions').length,0);
  const valid=await gateway.request(statePath());assert.equal(valid.status,200,valid.text);assert.equal(valid.headers.get('Cache-Control'),'no-store');assert.equal(valid.json!.data.checkout.customer_email,'synthetic-state-owner@example.invalid');
  assert.equal((await gateway.request(statePath(site.siteId,'ct_'+crypto.randomUUID().replace(/-/g,'')))).status,404);
  assert.equal((await gateway.request(statePath(otherSite.siteId))).status,404);
  assert.equal((await gateway.request(duplicate('cart_token'))).status,400);
  assert.equal((await gateway.request(duplicate('site_id'))).status,400);
  assert.equal((await gateway.request(statePath(site.siteId,cart.token,'not-a-uuid'))).status,400);
  down=true;const failed=await gateway.request(statePath());assert.equal(failed.status,503);assert.doesNotMatch(failed.text,/Synthetic private state|SQLSTATE/);down=false;
  psql(`UPDATE sites SET access_mode='offline',published=false WHERE id='${site.siteId}';`);assert.equal((await gateway.request(statePath())).status,200,'a known checkout capability retains independent own-state recovery');
 }finally{tap.restore();}
});
test('active cart clearing preserves shape, while a real checkout conversion between read and update cannot be overwritten',async()=>{
 const active=seedCart();const cleared=await gateway.request(`/v1/storefront/${site.subdomain}/cart/${active.token}`,{method:'DELETE'});assert.equal(cleared.status,200,cleared.text);assert.equal(cleared.json!.data.id,active.id);assert.deepEqual(cleared.json!.data.lines,[]);assert.equal(cleared.json!.data.status,'active');assert.equal(cleared.json!.data.sales_origin,'storefront');
 const cart=seedCart(),issued=await startHostedCheckout(cart);assert.equal(issued.status,200);const url=issued.json!.data.checkout_url;
 const steps=[['contact',{email:'synthetic-delete-race@example.invalid',name:'Synthetic delete race'}],['delivery',{shipping_method:'standard',cod_requested:true,shipping_address:{line1:'Fixture Road',city:'Bengaluru',state:'Karnataka',state_code:'29',zip:'560001',country:'IN'},shipping_quote:{shipping_rate_id:shippingRateId,expected_shipping_amount:20}}],['payment-intent',{provider:'cod',mode:'sandbox',tokenize:false,metadata:{}}]] as const;
 for(const[step,body]of steps){const r=await hostedCheckoutPost(cart,url,step,{...body,idempotency_key:crypto.randomUUID()});assert.ok(r.status===200||r.status===201,r.text);}
 const {tapRest}=await import('./gateway-harness');let converted=false,orderId='',committedRow='';
 const tap=tapRest(owned.restUrl,async(call,forward)=>{
  if(!converted&&call.resource==='carts'&&call.method==='GET'&&call.search.get('session_id')==='eq.'+cart.token){
   converted=true;const snapshot=await forward();const committed=await hostedCheckoutPost(cart,url,'confirm',{idempotency_key:crypto.randomUUID()});assert.equal(committed.status,200,committed.text);orderId=committed.json!.data.order.id;committedRow=psql(`SELECT row_to_json(c)::text FROM carts c WHERE id='${cart.id}';`);return snapshot;
  }return forward();
 });
 try{
  const deleted=await gateway.request(`/v1/storefront/${site.subdomain}/cart/${cart.token}`,{method:'DELETE'});assert.equal(deleted.status,409,deleted.text);assert.equal(deleted.json!.error.code,'CART_STATE_CONFLICT');assert.ok(converted&&orderId);assert.equal(psql(`SELECT row_to_json(c)::text FROM carts c WHERE id='${cart.id}';`),committedRow);assert.equal(psql(`SELECT count(*) FROM orders WHERE id='${orderId}' AND store_id='${site.siteId}';`),'1');
 }finally{tap.restore();}
});


test('converted cart mutation is an explicit conflict, while a distinct new cart keeps the original receipt',async()=>{
 const cart=seedCart(),issued=await startHostedCheckout(cart);assert.equal(issued.status,200);const orderId=await completeCodCheckout(cart,issued.json!.data.checkout_url);
 const before=psql(`SELECT row_to_json(c)::text FROM carts c WHERE id='${cart.id}';`);
 const patched=await gateway.request(`/v1/storefront/${site.subdomain}/cart/${cart.token}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({lines:[{product_id:productId,quantity:2}]})});
 console.info('OWNED_REPEAT_CART_PATCH '+JSON.stringify({status:patched.status,originalConvertedCartUnchanged:psql(`SELECT row_to_json(c)::text FROM carts c WHERE id='${cart.id}';`)===before}));
 assert.equal(patched.status,409,patched.text);assert.equal(patched.json!.error.code,'CART_STATE_CONFLICT');assert.equal(psql(`SELECT row_to_json(c)::text FROM carts c WHERE id='${cart.id}';`),before);
 const next=await gateway.request(`/v1/storefront/${site.subdomain}/cart`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lines:[{product_id:productId,quantity:2}]})});assert.equal(next.status,201,next.text);assert.notEqual(next.json!.data.cart_token,cart.token);assert.notEqual(next.json!.data.id,cart.id);assert.equal(next.json!.data.lines[0].quantity,2);
 const receipt=await gateway.request(`/v1/storefront/${site.subdomain}/cart/${cart.token}/checkout-status`);assert.equal(receipt.status,200);assert.equal(receipt.json!.data.checkout_state,'completed');assert.equal(receipt.json!.data.order.id,orderId);assert.equal(psql(`SELECT row_to_json(c)::text FROM carts c WHERE id='${cart.id}';`),before);
});

test('cart line mutation loses to an actual committed COD conversion after its active snapshot',async()=>{
 const cart=seedCart(),issued=await startHostedCheckout(cart);assert.equal(issued.status,200);const url=issued.json!.data.checkout_url;
 const steps=[['contact',{email:'synthetic-patch-race@example.invalid',name:'Synthetic patch race'}],['delivery',{shipping_method:'standard',cod_requested:true,shipping_address:{line1:'Fixture Road',city:'Bengaluru',state:'Karnataka',state_code:'29',zip:'560001',country:'IN'},shipping_quote:{shipping_rate_id:shippingRateId,expected_shipping_amount:20}}],['payment-intent',{provider:'cod',mode:'sandbox',tokenize:false,metadata:{}}]] as const;
 for(const[step,body]of steps){const r=await hostedCheckoutPost(cart,url,step,{...body,idempotency_key:crypto.randomUUID()});assert.ok(r.status===200||r.status===201,r.text);}
 const {tapRest}=await import('./gateway-harness');let converted=false,orderId='',committedRow='';
 const tap=tapRest(owned.restUrl,async(call,forward)=>{
  if(!converted&&call.resource==='carts'&&call.method==='GET'&&call.search.get('session_id')==='eq.'+cart.token){converted=true;const snapshot=await forward();const committed=await hostedCheckoutPost(cart,url,'confirm',{idempotency_key:crypto.randomUUID()});assert.equal(committed.status,200,committed.text);orderId=committed.json!.data.order.id;committedRow=psql(`SELECT row_to_json(c)::text FROM carts c WHERE id='${cart.id}';`);return snapshot;}return forward();
 });
 try{
  const patched=await gateway.request(`/v1/storefront/${site.subdomain}/cart/${cart.token}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({lines:[{product_id:productId,quantity:2}]})});
  const unchanged=psql(`SELECT row_to_json(c)::text FROM carts c WHERE id='${cart.id}';`)===committedRow;console.info('OWNED_REPEAT_CART_PATCH_RACE '+JSON.stringify({status:patched.status,originalConvertedCartUnchanged:unchanged}));
  assert.equal(patched.status,409,patched.text);assert.equal(patched.json!.error.code,'CART_STATE_CONFLICT');assert.ok(converted&&orderId);assert.equal(unchanged,true);assert.equal(psql(`SELECT count(*) FROM orders WHERE id='${orderId}' AND store_id='${site.siteId}';`),'1');
 }finally{tap.restore();}
});

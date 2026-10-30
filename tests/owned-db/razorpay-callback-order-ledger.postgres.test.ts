import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import webhookWorker from '../../services/webhook-service/src/index';
import { Gateway, gatewayEnv, INTERNAL_SECRET, newIdentityKeys } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { requireOwnedDatabase } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { newSyntheticTenant, seedSyntheticOrder, seedSyntheticTenant } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';

const owned = requireOwnedDatabase();
const webhookSecret = 'synthetic-owned-razorpay-callback-secret';
let gateway: Gateway;
after(async () => { await gateway?.settle(); });

test('one signed Razorpay capture callback records one paid order and one balanced ledger effect', async () => {
    const tenant = newSyntheticTenant('rzp-callback');
    seedSyntheticTenant(owned.psql, tenant);
    const { orderId } = seedSyntheticOrder(owned.psql, tenant);
    const providerOrderId = `order_syn_${randomUUID().replaceAll('-', '')}`;
    const providerPaymentId = `pay_syn_${randomUUID().replaceAll('-', '')}`;
    const providerEventId = `evt_syn_${randomUUID().replaceAll('-', '')}`;
    owned.psql(`UPDATE orders SET payment_id='${providerOrderId}',payment_method='razorpay',payment_gateway='razorpay'
        WHERE id='${orderId}' AND store_id='${tenant.siteId}';`);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
    const serviceEnv = {
        ...owned.restEnv(), ENVIRONMENT: 'test', RAZORPAY_WEBHOOK_SECRET: webhookSecret,
        INTERNAL_API_SECRET: INTERNAL_SECRET,
        API_GATEWAY_SERVICE: {
            async fetch(input: string | Request, init?: RequestInit) {
                const target = new URL(typeof input === 'string' ? input : input.url);
                assert.equal(target.origin, 'https://api-gateway');
                const response = await gateway.request(target.pathname + target.search, init);
                return new Response(response.text, { status: response.status, headers: response.headers });
            },
        },
    };
    const body = JSON.stringify({
        id: providerEventId, entity: 'event', event: 'payment.captured',
        created_at: Math.floor(Date.now() / 1000), contains: ['payment'],
        payload: { payment: { entity: {
            id: providerPaymentId, entity: 'payment', order_id: providerOrderId,
            amount: 19900, currency: 'INR', status: 'captured', captured: true,
            notes: { order_id: orderId, store_id: tenant.siteId },
        } } },
    });
    const deliver = async (rawBody: string, signature: string) => {
        const response = await webhookWorker.fetch(new Request('http://127.0.0.1/razorpay', {
            method: 'POST', body: rawBody,
            headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': signature },
        }), serviceEnv);
        return { status: response.status, text: await response.text() };
    };
    const journalCount = () => owned.psql(`SELECT count(*) FROM ledger_transactions
        WHERE site_id='${tenant.siteId}' AND source_type='payment_capture'
          AND source_id='razorpay:${providerPaymentId}';`);
    const invalid = await deliver(body, '0'.repeat(64));
    assert.equal(invalid.status, 400, invalid.text);
    assert.equal(journalCount(), '0');
    assert.equal(owned.psql(`SELECT payment_status FROM orders WHERE id='${orderId}';`), 'pending');

    const baseEvent = JSON.parse(body) as { id: string; payload: { payment: { entity: Record<string, unknown> } } };
    for (const patch of [{ amount: 100 }, { currency: 'USD' }, { status: 'authorized' },
        { order_id: `order_syn_${randomUUID().replaceAll('-', '')}` }]) {
        const invalidEventId = `evt_syn_${randomUUID().replaceAll('-', '')}`;
        const invalidBody = JSON.stringify({ ...baseEvent, id: invalidEventId,
            payload: { payment: { entity: { ...baseEvent.payload.payment.entity, ...patch } } } });
        const rejected = await deliver(invalidBody, createHmac('sha256', webhookSecret).update(invalidBody).digest('hex'));
        assert.notEqual(rejected.status, 200, `signed mismatched ${Object.keys(patch)[0]} must not confirm the order`);
        assert.equal(journalCount(), '0');
        assert.equal(owned.psql(`SELECT payment_status FROM orders WHERE id='${orderId}';`), 'pending');
        assert.equal(owned.psql(`SELECT processing_status FROM payment_webhook_events WHERE provider='razorpay'
            AND provider_event_id='${invalidEventId}';`), 'failed');
    }

    const signature = createHmac('sha256', webhookSecret).update(body).digest('hex');
    const first = await deliver(body, signature);
    assert.equal(first.status, 200, first.text);
    const retry = await deliver(body, signature);
    assert.equal(retry.status, 200, retry.text);
    assert.equal(journalCount(), '1');
    assert.equal(owned.psql(`SELECT payment_status||'|'||payment_id FROM orders WHERE id='${orderId}';`),
        `paid|${providerPaymentId}`);
    assert.equal(owned.psql(`SELECT count(*) FROM payment_transactions WHERE order_id='${orderId}'
        AND provider_payment_id='${providerPaymentId}' AND status='captured';`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM payment_attempts WHERE order_id='${orderId}'
        AND provider_payment_id='${providerPaymentId}' AND attempt_type='capture';`), '1');
    assert.equal(owned.psql(`SELECT sum(CASE side WHEN 'debit' THEN amount_minor ELSE -amount_minor END)
        FROM ledger_entries WHERE transaction_id=(SELECT id FROM ledger_transactions
        WHERE site_id='${tenant.siteId}' AND source_type='payment_capture' AND source_id='razorpay:${providerPaymentId}');`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE aggregate_id='${orderId}'
        AND event_type='order.paid';`), '1');
    assert.equal(owned.psql(`SELECT processing_status FROM payment_webhook_events WHERE provider='razorpay'
        AND provider_event_id='${providerEventId}';`), 'processed');
});

test('platform-signed callback cannot capture a merchant-credential-bound order', async () => {
    const tenant = newSyntheticTenant('rzp-owned-callback');
    seedSyntheticTenant(owned.psql, tenant);
    const { orderId } = seedSyntheticOrder(owned.psql, tenant);
    const credentialId = randomUUID();
    const paymentId = randomUUID();
    const keyId = `rzp_test_${randomUUID().replaceAll('-', '')}`;
    const providerOrderId = `order_syn_${randomUUID().replaceAll('-', '')}`;
    const providerPaymentId = `pay_syn_${randomUUID().replaceAll('-', '')}`;
    owned.psql(`INSERT INTO payment_credentials(id,site_id,provider,mode,status,provider_key_id,last_verified_at,encrypted_credentials)
        VALUES('${credentialId}','${tenant.siteId}','razorpay','sandbox','active','${keyId}',now(),'{}'::jsonb);
        INSERT INTO payments(id,site_id,order_id,provider,mode,status,amount_minor,provider_order_id,provider_payment_id,credential_id,idempotency_key)
        VALUES('${paymentId}','${tenant.siteId}','${orderId}','razorpay','sandbox','requires_action',19900,'${providerOrderId}','${providerPaymentId}','${credentialId}','syn-${paymentId}');
        UPDATE orders SET payment_id='${providerOrderId}',payment_method='razorpay',payment_gateway='razorpay'
        WHERE id='${orderId}' AND store_id='${tenant.siteId}';`);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
    const body = JSON.stringify({ id: `evt_syn_${randomUUID().replaceAll('-', '')}`, event: 'payment.captured',
        payload: { payment: { entity: { id: providerPaymentId, order_id: providerOrderId,
            amount: 19900, currency: 'INR', status: 'captured',
            notes: { order_id: orderId, store_id: tenant.siteId },
        } } },
    });
    const serviceEnv = { ...owned.restEnv(), ENVIRONMENT: 'test', RAZORPAY_WEBHOOK_SECRET: webhookSecret,
        INTERNAL_API_SECRET: INTERNAL_SECRET,
        API_GATEWAY_SERVICE: { async fetch(input: string | Request, init?: RequestInit) {
            const target = new URL(typeof input === 'string' ? input : input.url);
            const response = await gateway.request(target.pathname + target.search, init);
            return new Response(response.text, { status: response.status, headers: response.headers });
        } },
    };
    const direct = await gateway.request('/v1/storefront/internal/payments/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Internal-API-Secret': INTERNAL_SECRET },
        body: JSON.stringify({ orderId, storeId: tenant.siteId, provider: 'razorpay', paymentId: providerPaymentId, providerOrderId }),
    });
    assert.equal(direct.status, 409, direct.text);
    assert.equal(direct.json?.error?.code, 'PAYMENT_ACCOUNT_CALLBACK_UNBOUND');
    const forgedSite = await gateway.request('/v1/storefront/internal/payments/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Internal-API-Secret': INTERNAL_SECRET },
        body: JSON.stringify({ orderId, storeId: randomUUID(), provider: 'razorpay',
            paymentId: providerPaymentId, providerOrderId }),
    });
    assert.equal(forgedSite.status, 404, forgedSite.text);
    const hostedOrder = seedSyntheticOrder(owned.psql, tenant).orderId;
    const cartId = randomUUID();
    const checkoutId = randomUUID();
    const hostedProviderOrderId = `order_syn_${randomUUID().replaceAll('-', '')}`;
    const intent = { credential_id: credentialId, key_id: keyId, provider: 'razorpay', mode: 'sandbox',
        status: 'requires_action', payment_intent_id: randomUUID(), order_id: hostedOrder,
        provider_order_id: hostedProviderOrderId, amount_minor: 19900, currency: 'INR' };
    owned.psql(`UPDATE payment_credentials SET selected_for_checkout=true WHERE id='${credentialId}';
        UPDATE sites SET online_payment_enabled=true,
            payment_settings='${JSON.stringify({ mode: 'ownAccount', gateways: ['razorpay'],
                razorpay: { credential_id: credentialId, key_id: keyId, test_mode: true, verified: true } })}'::jsonb
            WHERE id='${tenant.siteId}';
        INSERT INTO carts(id,store_id,session_id,items,status)
            VALUES('${cartId}','${tenant.siteId}','syn-${cartId}','[]','active');
        INSERT INTO checkout_sessions(id,site_id,cart_id,order_id,idempotency_key,status,checkout_state,payment_intent)
            VALUES('${checkoutId}','${tenant.siteId}','${cartId}','${hostedOrder}','syn-${checkoutId}',
                'payment_intent','payment_intent','${JSON.stringify(intent)}'::jsonb);`);
    const hostedPlatformCallback = await gateway.request('/v1/storefront/internal/payments/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Internal-API-Secret': INTERNAL_SECRET },
        body: JSON.stringify({ orderId: hostedOrder, storeId: tenant.siteId, provider: 'razorpay',
            paymentId: `pay_syn_${randomUUID().replaceAll('-', '')}`, providerOrderId: hostedProviderOrderId }),
    });
    assert.equal(hostedPlatformCallback.status, 409, hostedPlatformCallback.text);
    assert.equal(hostedPlatformCallback.json?.error?.code, 'PAYMENT_ACCOUNT_CALLBACK_UNBOUND');
    for (const [path, command] of [
        ['failure', { orderId, storeId: tenant.siteId, provider: 'razorpay', providerEventId: 'evt_synthetic_failed',
            paymentStatus: 'failed', orderStatus: 'cancelled' }],
        ['event', { orderId, storeId: tenant.siteId, provider: 'razorpay', providerEventId: 'evt_synthetic_created',
            eventType: 'refund.created' }],
    ] as const) {
        const refused = await gateway.request(`/v1/storefront/internal/payments/${path}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Internal-API-Secret': INTERNAL_SECRET },
            body: JSON.stringify(command),
        });
        assert.equal(refused.status, 409, refused.text);
        assert.equal(refused.json?.error?.code, 'PAYMENT_ACCOUNT_CALLBACK_UNBOUND');
    }
    const response = await webhookWorker.fetch(new Request('http://127.0.0.1/razorpay', {
        method: 'POST', body, headers: { 'X-Razorpay-Signature': createHmac('sha256', webhookSecret).update(body).digest('hex') },
    }), serviceEnv);
    assert.notEqual(response.status, 200);
    assert.equal(owned.psql(`SELECT payment_status FROM orders WHERE id='${orderId}';`), 'pending');
    assert.equal(owned.psql(`SELECT status FROM payments WHERE id='${paymentId}';`), 'requires_action');
    assert.equal(owned.psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${tenant.siteId}' AND source_type='payment_capture';`), '0');
});

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticOrder, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();

test('real public Gateway refuses an unpinned direct Razorpay start even with global test keys', async () => {
    const tenant = newSyntheticTenant('direct-retire');
    seedSyntheticTenant(owned.psql, tenant);
    const { orderId } = seedSyntheticOrder(owned.psql, tenant);
    const before = owned.psql(`SELECT jsonb_build_object(
        'order_payment_id', (SELECT payment_id FROM orders WHERE id='${orderId}'),
        'transactions', (SELECT count(*) FROM payment_transactions WHERE site_id='${tenant.siteId}'),
        'payments', (SELECT count(*) FROM payments WHERE site_id='${tenant.siteId}'),
        'ledger', (SELECT count(*) FROM ledger_transactions WHERE site_id='${tenant.siteId}'),
        'receipts', (SELECT count(*) FROM idempotency_keys WHERE site_id='${tenant.siteId}')
    )::text;`);
    const gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), {
        RAZORPAY_KEY_ID: 'rzp_test_ZZZZZZZZZZZZ',
        RAZORPAY_KEY_SECRET: 'synthetic-global-key',
    }));
    try {
        const response = await gateway.request(`/v1/storefront/${tenant.subdomain}/payments/razorpay/order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': randomUUID() },
            body: JSON.stringify({ orderId, idempotencyKey: randomUUID() }),
        });
        assert.equal(response.status, 410, response.text);
        assert.equal(response.json?.error?.code, 'HOSTED_CHECKOUT_REQUIRED');
        const after = owned.psql(`SELECT jsonb_build_object(
            'order_payment_id', (SELECT payment_id FROM orders WHERE id='${orderId}'),
            'transactions', (SELECT count(*) FROM payment_transactions WHERE site_id='${tenant.siteId}'),
            'payments', (SELECT count(*) FROM payments WHERE site_id='${tenant.siteId}'),
            'ledger', (SELECT count(*) FROM ledger_transactions WHERE site_id='${tenant.siteId}'),
            'receipts', (SELECT count(*) FROM idempotency_keys WHERE site_id='${tenant.siteId}')
        )::text;`);
        assert.equal(after, before, 'denied direct start has no order, payment, ledger or receipt mutation');
    } finally {
        await gateway.settle();
    }
});

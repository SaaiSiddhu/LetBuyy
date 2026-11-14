// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// F8 refund lifecycle: real worker → internal refund event route → owned PostgREST/Postgres
// → one atomic payment-attempt/payment/canonical-ledger mutation. The fixture is disposable and
// owns every synthetic order, payment and provider reference created here.
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test, { before } from 'node:test';
import * as webhookModule from '../../services/webhook-service/src/index.ts';
import { Gateway, gatewayEnv, newIdentityKeys, INTERNAL_SECRET, signedIdentityHeaders } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { requireOwnedDatabase } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { newSyntheticTenant, seedSyntheticOrder, seedSyntheticTenant } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import { signSensitiveActionStepUp } from '../../services/api-gateway/src/lib/security-controls';
import {merchantApprovalHeaders,TOTP_SECRET}from '../../services/api-gateway/src/__tests__/owned-db/merchant-stepup-fixture';

const owned = requireOwnedDatabase();
const tenant = newSyntheticTenant('refund-event');
const paymentId = randomUUID();
const paymentAmountMinor = 10000;
const providerPaymentId = `pay_${randomUUID().replaceAll('-', '')}`;
const refundIds = [1, 2, 3].map(() => `rfnd_${randomUUID().replaceAll('-', '')}`);
const codRequestBindingMigration = readFileSync(new URL('../../database/supabase/migrations/298_cod_remittance_request_binding.sql', import.meta.url), 'utf8');
const codWriterRollback = readFileSync(new URL('../../database/supabase/rollback/297_cod_remittance_writer_privileges.rollback.sql', import.meta.url), 'utf8');
const codRequestBindingRollback = readFileSync(new URL('../../database/supabase/rollback/298_cod_remittance_request_binding.rollback.sql', import.meta.url), 'utf8');
const gatewayPromise = newIdentityKeys().then((keys) => new Gateway(gatewayEnv(owned, keys, {
    TOTP_ENCRYPTION_KEY: TOTP_SECRET,
    RAZORPAY_KEY_ID: 'rzp_test_synthetic',
    RAZORPAY_KEY_SECRET: 'synthetic-refund-secret',
    STEP_UP_SIGNING_SECRET: 'synthetic-step-up-signing-secret-with-at-least-32-bytes',
})));
const STEP_UP_SECRET = 'synthetic-step-up-signing-secret-with-at-least-32-bytes';
const WEBHOOK_SECRET = 'synthetic-razorpay-webhook-secret';
const loadedWebhook = webhookModule as unknown as { default?: { request?: unknown; default?: unknown } };
const webhookApp = (typeof loadedWebhook.default?.request === 'function' ? loadedWebhook.default : loadedWebhook.default?.default) as {
    request(path: string, init: RequestInit, env: Record<string, unknown>): Promise<Response>;
};
let orderId = '';

function q(value: string) {
    return `'${value.replaceAll("'", "''")}'`;
}

function seedPaymentAndAttempt(input: { providerPaymentId: string; refundId: string; amountMinor: number; key: string }) {
    const order = seedSyntheticOrder(owned.psql, tenant);
    owned.psql(`
      INSERT INTO public.payments (
        id, site_id, order_id, provider, mode, status, amount_minor, currency,
        provider_payment_id, idempotency_key, created_at, updated_at
      ) VALUES (
        '${paymentId}'::uuid, '${tenant.siteId}'::uuid, '${order.orderId}'::uuid,
        'razorpay', 'sandbox', 'captured', ${paymentAmountMinor}, 'INR',
        ${q(input.providerPaymentId)}, 'synthetic-payment-${tenant.tag}', now(), now()
      );
    `);
    owned.psql(`
      INSERT INTO public.payment_attempts (
        site_id, order_id, payment_id, provider, attempt_type, status, amount, currency,
        provider_payment_id, idempotency_key, metadata, created_at, updated_at
      ) VALUES (
        '${tenant.siteId}'::uuid, '${order.orderId}'::uuid, '${paymentId}'::uuid,
        'razorpay', 'refund', 'pending', ${input.amountMinor / 100}, 'INR',
        ${q(input.providerPaymentId)}, ${q(input.key)},
        jsonb_build_object('provider_refund_id', ${q(input.refundId)}, 'refund_amount_minor', ${input.amountMinor}), now(), now()
      );
    `);
    return order.orderId;
}

function requestBody(input: { refundId: string; eventType: string; status: string; amountMinor: number }) {
    return {
        provider: 'razorpay',
        providerPaymentId,
        providerRefundId: input.refundId,
        providerEventId: `${input.eventType}:${input.refundId}`,
        eventType: input.eventType,
        status: input.status,
        amountMinor: input.amountMinor,
        currency: 'INR',
    };
}

async function callGateway(body: Record<string, unknown>) {
    const gateway = await gatewayPromise;
    return gateway.request('/v1/storefront/internal/payments/refund-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-API-Secret': INTERNAL_SECRET },
        body: JSON.stringify(body),
    });
}

async function authenticatedMerchantRefund(input: {
    gateway: Gateway;
    ownerId: string;
    ownerEmail: string;
    siteId: string;
    paymentId: string;
    idempotencyKey: string;
    amountMinor: number;
    providerRefundId?: string;
}) {
    const proofHeaders = await merchantApprovalHeaders(input.gateway,input.ownerId,input.ownerEmail,input.siteId);
    return input.gateway.request(`/v1/payments/${input.paymentId}/refund`, {
        method: 'POST',
        headers: proofHeaders,
        body: JSON.stringify({
            idempotency_key: input.idempotencyKey,
            amount_minor: input.amountMinor,
            ...(input.providerRefundId ? { provider_refund_id: input.providerRefundId } : {}),
        }),
    });
}

async function deliverSignedRefundWebhook(input: {
    gateway: Gateway;
    providerPaymentId: string;
    providerRefundId: string;
    amountMinor: number;
    eventType?: 'refund.created' | 'refund.processed' | 'refund.failed';
    failGatewayAttempts?: number;
    failGatewayResponsesAfterCommit?: number;
}) {
    const eventType = input.eventType || 'refund.processed';
    const status = eventType === 'refund.created' ? 'created' : eventType === 'refund.failed' ? 'failed' : 'processed';
    const rawBody = JSON.stringify({
        entity: 'event',
        account_id: 'acc_synthetic',
        event: eventType,
        contains: ['refund', 'payment'],
        payload: {
            refund: {
                entity: {
                    id: input.providerRefundId,
                    entity: 'refund',
                    amount: input.amountMinor,
                    currency: 'INR',
                    payment_id: input.providerPaymentId,
                    status,
                },
            },
        },
        created_at: Math.floor(Date.now() / 1000),
    });
    const signature = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
    let gatewayAttempts = 0;
    return webhookApp.request('/razorpay', {
        method: 'POST',
        body: rawBody,
        headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': signature },
    }, {
        ...owned.restEnv(),
        ENVIRONMENT: 'test',
        RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
        INTERNAL_API_SECRET: INTERNAL_SECRET,
        API_GATEWAY_SERVICE: {
            fetch: async (resource: string | Request, init?: RequestInit) => {
                gatewayAttempts += 1;
                if (gatewayAttempts <= (input.failGatewayAttempts || 0)) {
                    return new Response(JSON.stringify({ success: false, error: { code: 'UPSTREAM', message: 'synthetic transient failure' } }), {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
                const url = new URL(typeof resource === 'string' ? resource : resource.url);
                const result = await input.gateway.request(url.pathname, init);
                if (gatewayAttempts <= (input.failGatewayResponsesAfterCommit || 0)) {
                    return new Response(JSON.stringify({ success: false, error: { code: 'UPSTREAM', message: 'synthetic lost Gateway response after commit' } }), {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
                return new Response(result.text, {
                    status: result.status,
                    headers: { 'Content-Type': result.headers.get('Content-Type') || 'application/json' },
                });
            },
        },
    });
}

before(() => {
    seedSyntheticTenant(owned.psql, tenant);
    orderId = seedPaymentAndAttempt({
        providerPaymentId,
        refundId: refundIds[0],
        amountMinor: 5000,
        key: `refund-first-${tenant.tag}`,
    });
});

test('only the server role can invoke canonical money writers, including the COD writer', () => {
    const lowLevel = 'public.post_ledger_transaction(uuid,text,text,text,text,jsonb,jsonb,text)';
    const settlement = 'public.post_settlement_ledger_transaction(uuid,text,text,text,jsonb,jsonb,text)';
    const codRemittance = 'public.reconcile_cod_remittance_with_ledger(uuid,uuid,bigint,text,text,uuid,text)';
    const checkedCodRemittance = 'public.reconcile_cod_remittance_with_ledger_checked(uuid,uuid,bigint,text,text,uuid,text)';
    for (const role of ['anon', 'authenticated', 'app_tenant', 'service_role']) {
        assert.equal(owned.psql(`SELECT has_function_privilege('${role}', '${lowLevel}', 'EXECUTE');`), 'f', `${role} cannot call the low-level ledger writer`);
    }
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        assert.equal(owned.psql(`SELECT has_function_privilege('${role}', '${settlement}', 'EXECUTE');`), 'f', `${role} cannot call the settlement adapter`);
    }
    assert.equal(owned.psql(`SELECT has_function_privilege('service_role', '${settlement}', 'EXECUTE');`), 't');
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        assert.equal(owned.psql(`SELECT has_function_privilege('${role}', '${codRemittance}', 'EXECUTE');`), 'f', `${role} cannot enter the COD money writer`);
        assert.equal(owned.psql(`SELECT has_function_privilege('${role}', '${checkedCodRemittance}', 'EXECUTE');`), 'f', `${role} cannot enter the checked COD boundary`);
    }
    assert.equal(owned.psql(`SELECT has_function_privilege('service_role', '${codRemittance}', 'EXECUTE');`), 'f', 'service role cannot bypass checked replay binding');
    assert.equal(owned.psql(`SELECT has_function_privilege('service_role', '${checkedCodRemittance}', 'EXECUTE');`), 't');
    assert.equal(owned.psql(`SELECT NOT EXISTS (
      SELECT 1 FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid='${checkedCodRemittance}'::regprocedure))
      WHERE grantee=0 AND privilege_type='EXECUTE'
    );`), 't', 'PUBLIC has no execute grant on the COD money writer');
    const call = `SELECT public.reconcile_cod_remittance_with_ledger(
      '${tenant.siteId}'::uuid, '${randomUUID()}'::uuid, 100::bigint, NULL, 'denied-cod-rpc', NULL, NULL
    );`;
    const checkedCall = `SELECT public.reconcile_cod_remittance_with_ledger_checked(
      '${tenant.siteId}'::uuid, '${randomUUID()}'::uuid, 100::bigint, NULL, 'denied-cod-rpc', NULL, NULL
    );`;
    for (const role of ['anon', 'authenticated', 'app_tenant', 'service_role']) {
        assert.match(owned.psqlExpectError(`SET ROLE ${role}; ${call}`), /permission denied for function reconcile_cod_remittance_with_ledger/, role);
    }
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        assert.match(owned.psqlExpectError(`SET ROLE ${role}; ${checkedCall}`), /permission denied for function reconcile_cod_remittance_with_ledger_checked/, role);
    }
    owned.psql(codRequestBindingRollback);
    owned.psql(codWriterRollback);
    owned.psql(codRequestBindingMigration);
    assert.equal(owned.psql(`SELECT has_function_privilege('anon', '${codRemittance}', 'EXECUTE');`), 'f', 'rollback keeps the original writer private');
    assert.equal(owned.psql(`SELECT has_function_privilege('service_role', '${checkedCodRemittance}', 'EXECUTE');`), 't', 'rollback preserves the strict server boundary');
});

test('COD remittance exact replay is stable while changed amount or entry reuse conflicts', async () => {
    const merchantId = randomUUID();
    const merchantEmail = `syn-cod-${tenant.tag}@example.invalid`;
    const secondCodOrderId = randomUUID();
    const firstEntryId = randomUUID();
    const secondEntryId = randomUUID();
    const idempotencyKey = `cod-reconcile-${randomUUID()}`;
    owned.psql(`
      INSERT INTO public.users_custom (id, email, full_name)
      VALUES ('${merchantId}'::uuid, ${q(merchantEmail)}, 'Synthetic COD Merchant');
      UPDATE public.sites SET custom_user_id='${merchantId}'::uuid WHERE id='${tenant.siteId}'::uuid;
      INSERT INTO public.orders
        (id, store_id, site_id, order_number, customer_email, customer_name, shipping_address, items,
         subtotal, total, status, payment_status, payment_method, currency)
      VALUES ('${secondCodOrderId}'::uuid, '${tenant.siteId}'::uuid, '${tenant.siteId}'::uuid,
        ${q(`SYN-COD-${tenant.tag}-${randomUUID()}`)}, ${q(merchantEmail)}, 'Synthetic COD Buyer', '{}'::jsonb,
        '[]'::jsonb, 199.00, 199.00, 'confirmed', 'pending', 'cod', 'INR');
      INSERT INTO public.cod_reconciliation_entries
        (id, site_id, order_id, status, currency, expected_amount_minor, collected_amount_minor, metadata)
      VALUES
        ('${firstEntryId}'::uuid, '${tenant.siteId}'::uuid, '${orderId}'::uuid, 'collected', 'INR', 19900, 19900, '{}'::jsonb),
        ('${secondEntryId}'::uuid, '${tenant.siteId}'::uuid, '${secondCodOrderId}'::uuid, 'collected', 'INR', 19900, 19900, '{}'::jsonb);
    `);

    const gateway = await gatewayPromise;
    const reconcile = async (entryId: string, amount: number) => gateway.request(`/v1/cod/reconciliation/${entryId}/reconcile`, {
        method: 'POST',
        headers: await signedIdentityHeaders(merchantId, merchantEmail, tenant.siteId),
        body: JSON.stringify({ store_id: tenant.siteId, deposited_amount_minor: amount, idempotency_key: idempotencyKey }),
    });

    const first = await reconcile(firstEntryId, 19900);
    assert.equal(first.status, 200, first.text);
    assert.equal(first.json?.data?.entry?.deposited_amount_minor, 19900);
    const replay = await reconcile(firstEntryId, 19900);
    assert.equal(replay.status, 200, replay.text);
    assert.equal(replay.json?.data?.entry?.canonical_ledger_transaction_id, first.json?.data?.entry?.canonical_ledger_transaction_id);
    const changedAmount = await reconcile(firstEntryId, 18900);
    assert.equal(changedAmount.status, 409, changedAmount.text);
    assert.equal(changedAmount.json?.error?.code, 'CONFLICT');
    const changedEntry = await reconcile(secondEntryId, 19900);
    assert.equal(changedEntry.status, 409, changedEntry.text);
    assert.equal(changedEntry.json?.error?.code, 'IDEMPOTENCY_KEY_REUSED');
    assert.equal(owned.psql(`SELECT deposited_amount_minor_bigint::text FROM public.cod_reconciliation_entries WHERE id='${firstEntryId}'::uuid;`), '19900');
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type='cod_remittance' AND source_id='${firstEntryId}';`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM public.wallet_ledger_entries WHERE site_id='${tenant.siteId}'::uuid AND reference_id='${firstEntryId}';`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type='cod_remittance' AND source_id='${secondEntryId}';`), '0');
});

test('refund.created stays pending; processed partial/full retries post once through the real Gateway and ledger', async () => {
    const created = await callGateway(requestBody({ refundId: refundIds[0], eventType: 'refund.created', status: 'created', amountMinor: 5000 }));
    assert.equal(created.status, 200, created.text);
    assert.equal(created.json?.data?.result?.outcome, 'pending');
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type = 'refund' AND source_id = ${q(refundIds[0])};`), '0');
    assert.equal(owned.psql(`SELECT status FROM public.payment_attempts WHERE payment_id = '${paymentId}'::uuid AND idempotency_key = ${q(`refund-first-${tenant.tag}`)};`), 'pending');

    const processed = await callGateway(requestBody({ refundId: refundIds[0], eventType: 'refund.processed', status: 'processed', amountMinor: 5000 }));
    assert.equal(processed.status, 200, processed.text);
    assert.equal(processed.json?.data?.result?.outcome, 'processed');
    assert.equal(processed.json?.data?.result?.fully_refunded, false);
    assert.equal(owned.psql(`SELECT refunded_amount_minor::text FROM public.payments WHERE id = '${paymentId}'::uuid;`), '5000');
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type = 'refund' AND source_id = ${q(refundIds[0])};`), '1');
    assert.equal(owned.psql(`
      SELECT count(*) FROM public.wallet_ledger_entries AS wallet
      JOIN public.ledger_transactions AS transaction ON transaction.id = wallet.canonical_ledger_transaction_id
      WHERE transaction.source_type = 'refund'
        AND transaction.source_id = ${q(refundIds[0])}
        AND wallet.site_id = '${tenant.siteId}'::uuid
        AND wallet.entry_type = 'adjustment'
        AND wallet.direction = 'debit'
        AND wallet.status = 'posted'
        AND wallet.amount_minor_bigint = 5000;
    `), '1', 'the provider refund canonical posting atomically creates one linked wallet projection');
    assert.equal(owned.psql(`
      SELECT CASE WHEN SUM(CASE WHEN e.side = 'debit' THEN e.amount_minor ELSE -e.amount_minor END) = 0 THEN 'balanced' ELSE 'unbalanced' END
        FROM public.ledger_transactions t JOIN public.ledger_entries e ON e.transaction_id = t.id
       WHERE t.source_type = 'refund' AND t.source_id = ${q(refundIds[0])};
    `), 'balanced');

    const replay = await callGateway(requestBody({ refundId: refundIds[0], eventType: 'refund.processed', status: 'processed', amountMinor: 5000 }));
    assert.equal(replay.status, 200, replay.text);
    assert.equal(replay.json?.data?.result?.replayed, true);
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type = 'refund' AND source_id = ${q(refundIds[0])};`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM public.wallet_ledger_entries WHERE idempotency_key LIKE 'canonical-money-projection:%' AND canonical_ledger_transaction_id IN (SELECT id FROM public.ledger_transactions WHERE source_type='refund' AND source_id=${q(refundIds[0])});`), '1', 'refund replay does not duplicate the compatibility projection');

    owned.psql(`
      INSERT INTO public.payment_attempts (
        site_id, order_id, payment_id, provider, attempt_type, status, amount, currency,
        provider_payment_id, idempotency_key, metadata, created_at, updated_at
      ) VALUES (
        '${tenant.siteId}'::uuid, '${orderId}'::uuid, '${paymentId}'::uuid,
        'razorpay', 'refund', 'pending', 50, 'INR', ${q(providerPaymentId)},
        'refund-second-${tenant.tag}', jsonb_build_object('provider_refund_id', ${q(refundIds[1])}, 'refund_amount_minor', 5000), now(), now()
      );
    `);
    const second = await callGateway(requestBody({ refundId: refundIds[1], eventType: 'refund.processed', status: 'processed', amountMinor: 5000 }));
    assert.equal(second.status, 200, second.text);
    assert.equal(second.json?.data?.result?.fully_refunded, true);
    assert.equal(owned.psql(`SELECT status FROM public.payments WHERE id = '${paymentId}'::uuid;`), 'refunded');
    assert.equal(owned.psql(`SELECT refunded_amount_minor::text FROM public.payments WHERE id = '${paymentId}'::uuid;`), '10000');
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type = 'refund' AND site_id = '${tenant.siteId}'::uuid;`), '2');
    assert.equal(owned.psql(`SELECT count(*) FROM public.outbox_events WHERE idempotency_key = ${q(`payment.refund:${paymentId}:${refundIds[0]}`)};`), '1');
    assert.equal(owned.psql(`SELECT status || ':' || variance_minor FROM public.refresh_money_ledger_site_reconciliation('${tenant.siteId}'::uuid);`), 'verified:0', 'canonical refunds preserve the site wallet reconciliation after partial and full refunds');
});

test('provider failure releases its pending amount without writing a refund ledger entry', async () => {
    const failedPaymentId = randomUUID();
    const failedProviderPaymentId = `pay_${randomUUID().replaceAll('-', '')}`;
    const failedRefundId = refundIds[2];
    const order = seedSyntheticOrder(owned.psql, tenant);
    owned.psql(`
      INSERT INTO public.payments (id, site_id, order_id, provider, mode, status, amount_minor, currency, provider_payment_id, idempotency_key)
      VALUES ('${failedPaymentId}'::uuid, '${tenant.siteId}'::uuid, '${order.orderId}'::uuid, 'razorpay', 'sandbox', 'captured', 10000, 'INR', ${q(failedProviderPaymentId)}, 'synthetic-payment-failed-${tenant.tag}');
      INSERT INTO public.payment_attempts (site_id, order_id, payment_id, provider, attempt_type, status, amount, currency, provider_payment_id, idempotency_key, metadata)
      VALUES ('${tenant.siteId}'::uuid, '${order.orderId}'::uuid, '${failedPaymentId}'::uuid, 'razorpay', 'refund', 'pending', 25, 'INR', ${q(failedProviderPaymentId)}, 'refund-failed-${tenant.tag}', jsonb_build_object('provider_refund_id', ${q(failedRefundId)}, 'refund_amount_minor', 2500));
    `);

    const result = await deliverSignedRefundWebhook({
        gateway: await gatewayPromise,
        providerPaymentId: failedProviderPaymentId,
        providerRefundId: failedRefundId,
        amountMinor: 2500,
        eventType: 'refund.failed',
    });
    assert.equal(result.status, 200, await result.clone().text());
    assert.equal(owned.psql(`SELECT processing_status FROM public.payment_webhook_events WHERE provider = 'razorpay' AND provider_event_id = ${q(`refund.failed:${failedRefundId}`)};`), 'processed');
    assert.equal(owned.psql(`SELECT status FROM public.payment_attempts WHERE idempotency_key = ${q(`refund-failed-${tenant.tag}`)};`), 'failed');
    assert.equal(owned.psql(`SELECT refunded_amount_minor::text FROM public.payments WHERE id = '${failedPaymentId}'::uuid;`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type = 'refund' AND source_id = ${q(failedRefundId)};`), '0');
  });

test('a transient Gateway failure leaves the signed webhook retryable and its reclaimed retry posts exactly once', async () => {
    const retryPaymentId = randomUUID();
    const retryProviderPaymentId = `pay_${randomUUID().replaceAll('-', '')}`;
    const retryRefundId = `rfnd_${randomUUID().replaceAll('-', '')}`;
    const order = seedSyntheticOrder(owned.psql, tenant);
    owned.psql(`
      INSERT INTO public.payments (id, site_id, order_id, provider, mode, status, amount_minor, currency, provider_payment_id, idempotency_key)
      VALUES ('${retryPaymentId}'::uuid, '${tenant.siteId}'::uuid, '${order.orderId}'::uuid, 'razorpay', 'sandbox', 'captured', 10000, 'INR', ${q(retryProviderPaymentId)}, 'synthetic-payment-retry-${tenant.tag}');
      INSERT INTO public.payment_attempts (site_id, order_id, payment_id, provider, attempt_type, status, amount, currency, provider_payment_id, idempotency_key, metadata)
      VALUES ('${tenant.siteId}'::uuid, '${order.orderId}'::uuid, '${retryPaymentId}'::uuid, 'razorpay', 'refund', 'pending', 50, 'INR', ${q(retryProviderPaymentId)}, 'refund-retry-${tenant.tag}', jsonb_build_object('provider_refund_id', ${q(retryRefundId)}, 'refund_amount_minor', 5000));
    `);
    const gateway = await gatewayPromise;

    const first = await deliverSignedRefundWebhook({
        gateway,
        providerPaymentId: retryProviderPaymentId,
        providerRefundId: retryRefundId,
        amountMinor: 5000,
        failGatewayAttempts: 1,
    });
    assert.equal(first.status, 500, await first.clone().text());
    assert.equal(owned.psql(`SELECT processing_status FROM public.payment_webhook_events WHERE provider = 'razorpay' AND provider_event_id = ${q(`refund.processed:${retryRefundId}`)};`), 'failed');
    assert.equal(owned.psql(`SELECT refunded_amount_minor::text FROM public.payments WHERE id = '${retryPaymentId}'::uuid;`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type = 'refund' AND source_id = ${q(retryRefundId)};`), '0');

    const retried = await deliverSignedRefundWebhook({
        gateway,
        providerPaymentId: retryProviderPaymentId,
        providerRefundId: retryRefundId,
        amountMinor: 5000,
    });
    assert.equal(retried.status, 200, await retried.clone().text());
    assert.equal(owned.psql(`SELECT processing_status FROM public.payment_webhook_events WHERE provider = 'razorpay' AND provider_event_id = ${q(`refund.processed:${retryRefundId}`)};`), 'processed');
    assert.equal(owned.psql(`SELECT status FROM public.payment_attempts WHERE payment_id = '${retryPaymentId}'::uuid AND attempt_type = 'refund';`), 'succeeded');
    assert.equal(owned.psql(`SELECT refunded_amount_minor::text FROM public.payments WHERE id = '${retryPaymentId}'::uuid;`), '5000');
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type = 'refund' AND source_id = ${q(retryRefundId)};`), '1');

    const duplicate = await deliverSignedRefundWebhook({
        gateway,
        providerPaymentId: retryProviderPaymentId,
        providerRefundId: retryRefundId,
        amountMinor: 5000,
    });
    assert.equal(duplicate.status, 200, await duplicate.clone().text());
    assert.equal((await duplicate.json() as Record<string, unknown>).duplicate, true);
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type = 'refund' AND source_id = ${q(retryRefundId)};`), '1');
});

test('a lost Gateway response after commit is reclaimed without duplicating ledger or outbox effects', async () => {
    const lostPaymentId = randomUUID();
    const lostProviderPaymentId = `pay_${randomUUID().replaceAll('-', '')}`;
    const lostRefundId = `rfnd_${randomUUID().replaceAll('-', '')}`;
    const order = seedSyntheticOrder(owned.psql, tenant);
    owned.psql(`
      INSERT INTO public.payments (id, site_id, order_id, provider, mode, status, amount_minor, currency, provider_payment_id, idempotency_key)
      VALUES ('${lostPaymentId}'::uuid, '${tenant.siteId}'::uuid, '${order.orderId}'::uuid, 'razorpay', 'sandbox', 'captured', 10000, 'INR', ${q(lostProviderPaymentId)}, 'synthetic-payment-lost-${tenant.tag}');
      INSERT INTO public.payment_attempts (site_id, order_id, payment_id, provider, attempt_type, status, amount, currency, provider_payment_id, idempotency_key, metadata)
      VALUES ('${tenant.siteId}'::uuid, '${order.orderId}'::uuid, '${lostPaymentId}'::uuid, 'razorpay', 'refund', 'pending', 50, 'INR', ${q(lostProviderPaymentId)}, 'refund-lost-${tenant.tag}', jsonb_build_object('provider_refund_id', ${q(lostRefundId)}, 'refund_amount_minor', 5000));
    `);
    const gateway = await gatewayPromise;

    const first = await deliverSignedRefundWebhook({
        gateway,
        providerPaymentId: lostProviderPaymentId,
        providerRefundId: lostRefundId,
        amountMinor: 5000,
        failGatewayResponsesAfterCommit: 1,
    });
    assert.equal(first.status, 500, await first.clone().text());
    assert.equal(owned.psql(`SELECT processing_status FROM public.payment_webhook_events WHERE provider = 'razorpay' AND provider_event_id = ${q(`refund.processed:${lostRefundId}`)};`), 'failed');
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type = 'refund' AND source_id = ${q(lostRefundId)};`), '1', 'the Gateway committed despite the lost response');
    assert.equal(owned.psql(`SELECT count(*) FROM public.outbox_events WHERE idempotency_key = ${q(`payment.refund:${lostPaymentId}:${lostRefundId}`)};`), '1');

    const retry = await deliverSignedRefundWebhook({
        gateway,
        providerPaymentId: lostProviderPaymentId,
        providerRefundId: lostRefundId,
        amountMinor: 5000,
    });
    assert.equal(retry.status, 200, await retry.clone().text());
    assert.equal(owned.psql(`SELECT processing_status FROM public.payment_webhook_events WHERE provider = 'razorpay' AND provider_event_id = ${q(`refund.processed:${lostRefundId}`)};`), 'processed');
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type = 'refund' AND source_id = ${q(lostRefundId)};`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM public.outbox_events WHERE idempotency_key = ${q(`payment.refund:${lostPaymentId}:${lostRefundId}`)};`), '1');
});

test('concurrent signed deliveries of one provider event produce one ledger reversal', async () => {
    const concurrentPaymentId = randomUUID();
    const concurrentProviderPaymentId = `pay_${randomUUID().replaceAll('-', '')}`;
    const concurrentRefundId = `rfnd_${randomUUID().replaceAll('-', '')}`;
    const order = seedSyntheticOrder(owned.psql, tenant);
    owned.psql(`
      INSERT INTO public.payments (id, site_id, order_id, provider, mode, status, amount_minor, currency, provider_payment_id, idempotency_key)
      VALUES ('${concurrentPaymentId}'::uuid, '${tenant.siteId}'::uuid, '${order.orderId}'::uuid, 'razorpay', 'sandbox', 'captured', 10000, 'INR', ${q(concurrentProviderPaymentId)}, 'synthetic-payment-webhook-race-${tenant.tag}');
      INSERT INTO public.payment_attempts (site_id, order_id, payment_id, provider, attempt_type, status, amount, currency, provider_payment_id, idempotency_key, metadata)
      VALUES ('${tenant.siteId}'::uuid, '${order.orderId}'::uuid, '${concurrentPaymentId}'::uuid, 'razorpay', 'refund', 'pending', 50, 'INR', ${q(concurrentProviderPaymentId)}, 'refund-webhook-race-${tenant.tag}', jsonb_build_object('provider_refund_id', ${q(concurrentRefundId)}, 'refund_amount_minor', 5000));
    `);
    const gateway = await gatewayPromise;
    const deliveries = await Promise.all([
        deliverSignedRefundWebhook({ gateway, providerPaymentId: concurrentProviderPaymentId, providerRefundId: concurrentRefundId, amountMinor: 5000 }),
        deliverSignedRefundWebhook({ gateway, providerPaymentId: concurrentProviderPaymentId, providerRefundId: concurrentRefundId, amountMinor: 5000 }),
    ]);
    const statuses = deliveries.map((response) => response.status).sort((left, right) => left - right);
    assert.ok(statuses.every((status) => status === 200 || status === 409), await Promise.all(deliveries.map((response) => response.clone().text())).then((texts) => texts.join('\n')));
    assert.ok(statuses.includes(200), `at least one signed delivery must be accepted: ${statuses.join(',')}`);
    assert.equal(owned.psql(`SELECT processing_status FROM public.payment_webhook_events WHERE provider = 'razorpay' AND provider_event_id = ${q(`refund.processed:${concurrentRefundId}`)};`), 'processed');
    assert.equal(owned.psql(`SELECT status FROM public.payment_attempts WHERE payment_id = '${concurrentPaymentId}'::uuid AND attempt_type = 'refund';`), 'succeeded');
    assert.equal(owned.psql(`SELECT refunded_amount_minor::text FROM public.payments WHERE id = '${concurrentPaymentId}'::uuid;`), '5000');
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type = 'refund' AND source_id = ${q(concurrentRefundId)};`), '1');
});

test('attempt amount mismatch and over-refund are refused before canonical ledger mutation', async () => {
    const mismatchPaymentId = randomUUID();
    const mismatchProviderPaymentId = `pay_${randomUUID().replaceAll('-', '')}`;
    const mismatchRefundId = `rfnd_${randomUUID().replaceAll('-', '')}`;
    const mismatchOrder = seedSyntheticOrder(owned.psql, tenant);
    owned.psql(`
      INSERT INTO public.payments (id, site_id, order_id, provider, mode, status, amount_minor, currency, provider_payment_id, idempotency_key)
      VALUES ('${mismatchPaymentId}'::uuid, '${tenant.siteId}'::uuid, '${mismatchOrder.orderId}'::uuid, 'razorpay', 'sandbox', 'captured', 10000, 'INR', ${q(mismatchProviderPaymentId)}, 'synthetic-payment-mismatch-${tenant.tag}');
      INSERT INTO public.payment_attempts (site_id, order_id, payment_id, provider, attempt_type, status, amount, currency, provider_payment_id, idempotency_key, metadata)
      VALUES ('${tenant.siteId}'::uuid, '${mismatchOrder.orderId}'::uuid, '${mismatchPaymentId}'::uuid, 'razorpay', 'refund', 'pending', 50, 'INR', ${q(mismatchProviderPaymentId)}, 'refund-mismatch-${tenant.tag}', jsonb_build_object('provider_refund_id', ${q(mismatchRefundId)}));
    `);
    const mismatch = await callGateway({ ...requestBody({ refundId: mismatchRefundId, eventType: 'refund.processed', status: 'processed', amountMinor: 4900 }), providerPaymentId: mismatchProviderPaymentId });
    assert.equal(mismatch.status, 500);
    assert.equal(owned.psql(`SELECT refunded_amount_minor::text FROM public.payments WHERE id = '${mismatchPaymentId}'::uuid;`), '0');

    const overRefundId = `rfnd_${randomUUID().replaceAll('-', '')}`;
    const overRefundPaymentId = randomUUID();
    const overRefundProviderPaymentId = `pay_${randomUUID().replaceAll('-', '')}`;
    const overRefundOrder = seedSyntheticOrder(owned.psql, tenant);
    owned.psql(`
      INSERT INTO public.payments (id, site_id, order_id, provider, mode, status, amount_minor, refunded_amount_minor, currency, provider_payment_id, idempotency_key)
      VALUES ('${overRefundPaymentId}'::uuid, '${tenant.siteId}'::uuid, '${overRefundOrder.orderId}'::uuid, 'razorpay', 'sandbox', 'captured', 10000, 9900, 'INR', ${q(overRefundProviderPaymentId)}, 'synthetic-payment-over-${tenant.tag}');
      INSERT INTO public.payment_attempts (site_id, order_id, payment_id, provider, attempt_type, status, amount, currency, provider_payment_id, idempotency_key, metadata)
      VALUES ('${tenant.siteId}'::uuid, '${overRefundOrder.orderId}'::uuid, '${overRefundPaymentId}'::uuid, 'razorpay', 'refund', 'pending', 2, 'INR', ${q(overRefundProviderPaymentId)}, 'refund-over-${tenant.tag}', jsonb_build_object('provider_refund_id', ${q(overRefundId)}, 'refund_amount_minor', 200));
    `);
    const over = await callGateway({ ...requestBody({ refundId: overRefundId, eventType: 'refund.processed', status: 'processed', amountMinor: 200 }), providerPaymentId: overRefundProviderPaymentId });
    assert.equal(over.status, 500);
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type = 'refund' AND source_id = ${q(overRefundId)};`), '0');
    assert.equal(owned.psql(`SELECT refunded_amount_minor::text FROM public.payments WHERE id = '${overRefundPaymentId}'::uuid;`), '9900');
  });

test('authenticated merchant refund initiation reserves once, survives request replay, and reconciles through Gateway/Postgres', async () => {
    const merchantId = randomUUID();
    const outsiderId = randomUUID(), outsiderEmail = `outsider-${tenant.tag}@example.invalid`;
    const merchantEmail = `syn-refund-${tenant.tag}@example.invalid`;
    const merchantPaymentId = randomUUID();
    const merchantProviderPaymentId = `pay_${randomUUID().replaceAll('-', '')}`;
    const merchantRefundId = `rfnd_${randomUUID().replaceAll('-', '')}`;
    const key = `merchant-refund-${tenant.tag}-${randomUUID()}`;
    const order = seedSyntheticOrder(owned.psql, tenant);
    owned.psql(`
      INSERT INTO public.users_custom (id, email, full_name) VALUES ('${merchantId}'::uuid, ${q(merchantEmail)}, 'Synthetic Refund Merchant');
      INSERT INTO public.users_custom(id,email,full_name) VALUES('${outsiderId}',${q(outsiderEmail)},'Synthetic Refund Outsider');
      UPDATE public.sites SET custom_user_id = '${merchantId}'::uuid WHERE id = '${tenant.siteId}'::uuid;
      INSERT INTO public.payments (id, site_id, order_id, provider, mode, status, amount_minor, currency, provider_payment_id, idempotency_key)
      VALUES ('${merchantPaymentId}'::uuid, '${tenant.siteId}'::uuid, '${order.orderId}'::uuid, 'razorpay', 'sandbox', 'captured', 10000, 'INR', ${q(merchantProviderPaymentId)}, 'synthetic-merchant-payment-${tenant.tag}');
    `);

    const gateway = await gatewayPromise;
    const approvalHeaders = await merchantApprovalHeaders(gateway,merchantId,merchantEmail,tenant.siteId);
    const request = async () => gateway.request(`/v1/payments/${merchantPaymentId}/refund`, {
        method: 'POST',
        headers: {
            ...await signedIdentityHeaders(merchantId, merchantEmail, tenant.siteId),
            'X-Step-Up-Token': approvalHeaders['X-Step-Up-Token'],
            'X-Step-Up-Verified-At': approvalHeaders['X-Step-Up-Verified-At'],
        },
        body: JSON.stringify({ idempotency_key: key, amount_minor: 5000, reason: 'Synthetic provider lifecycle test' }),
    });

    const originalFetch = globalThis.fetch;
    let providerCalls = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        if (url.origin === 'https://api.razorpay.com' && url.pathname === `/v1/payments/${merchantProviderPaymentId}/refund`) {
            providerCalls += 1;
            assert.equal((init?.method || 'GET').toUpperCase(), 'POST');
            const requestBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
            assert.equal(requestBody.amount, 5000);
            return new Response(JSON.stringify({ id: merchantRefundId, payment_id: merchantProviderPaymentId, amount: 5000, currency: 'INR', status: 'created' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        return originalFetch(input, init);
    }) as typeof fetch;

    let first;
    let replay;
    let outsider;
    const outsiderProof=await signSensitiveActionStepUp({action:'refund.approve',actorId:outsiderId,siteId:tenant.siteId,challengeId:'syn-outsider-'+randomUUID(),signingSecret:STEP_UP_SECRET});
    try {
        first = await request();
        replay = await request();
        outsider = await gateway.request(`/v1/payments/${merchantPaymentId}/refund`, {
            method: 'POST',
            headers: {
                ...await signedIdentityHeaders(outsiderId, outsiderEmail, tenant.siteId),
                'X-Step-Up-Token': outsiderProof.token,
                'X-Step-Up-Verified-At': outsiderProof.verifiedAt,
            },
            body: JSON.stringify({ idempotency_key: `outsider-${key}`, amount_minor: 5000 }),
        });
    } finally {
        globalThis.fetch = originalFetch;
    }

    assert.equal(first?.status, 202, first?.text);
    assert.equal(replay?.status, 202, replay?.text);
    assert.equal(replay?.headers.get('X-Idempotent-Replay'), 'true');
    assert.equal(outsider?.status, 404, outsider?.text);
    assert.equal(providerCalls, 1, 'same-key replay and cross-merchant denial must not call Razorpay again');
    assert.equal(owned.psql(`SELECT status FROM public.payment_attempts WHERE payment_id = '${merchantPaymentId}'::uuid AND attempt_type = 'refund';`), 'pending');
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type = 'refund' AND site_id = '${tenant.siteId}'::uuid AND metadata->>'payment_id' = '${merchantPaymentId}';`), '0');

    const createdWebhook = await deliverSignedRefundWebhook({
        gateway,
        providerPaymentId: merchantProviderPaymentId,
        providerRefundId: merchantRefundId,
        amountMinor: 5000,
        eventType: 'refund.created',
    });
    assert.equal(createdWebhook.status, 200, await createdWebhook.clone().text());
    assert.equal(owned.psql(`SELECT processing_status FROM public.payment_webhook_events WHERE provider = 'razorpay' AND provider_event_id = ${q(`refund.created:${merchantRefundId}`)};`), 'processed');
    assert.equal(owned.psql(`SELECT status FROM public.payment_attempts WHERE payment_id = '${merchantPaymentId}'::uuid AND attempt_type = 'refund';`), 'pending');
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type = 'refund' AND site_id = '${tenant.siteId}'::uuid AND metadata->>'payment_id' = '${merchantPaymentId}';`), '0');

    const webhookResponse = await deliverSignedRefundWebhook({
        gateway,
        providerPaymentId: merchantProviderPaymentId,
        providerRefundId: merchantRefundId,
        amountMinor: 5000,
    });
    assert.equal(webhookResponse.status, 200, await webhookResponse.clone().text());
    const webhookBody = await webhookResponse.json() as Record<string, unknown>;
    assert.equal(webhookBody.received, true);
    assert.equal(owned.psql(`SELECT processing_status FROM public.payment_webhook_events WHERE provider = 'razorpay' AND provider_event_id = ${q(`refund.processed:${merchantRefundId}`)};`), 'processed');
    assert.equal(owned.psql(`SELECT status||'|'||refunded_amount_minor::text FROM public.payments WHERE id = '${merchantPaymentId}'::uuid;`), 'captured|5000');
    assert.equal(owned.psql(`SELECT status FROM public.payment_attempts WHERE payment_id = '${merchantPaymentId}'::uuid AND attempt_type = 'refund';`), 'succeeded');
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type = 'refund' AND site_id = '${tenant.siteId}'::uuid AND metadata->>'payment_id' = '${merchantPaymentId}';`), '1');

    const replayedWebhook = await deliverSignedRefundWebhook({
        gateway,
        providerPaymentId: merchantProviderPaymentId,
        providerRefundId: merchantRefundId,
        amountMinor: 5000,
    });
    assert.equal(replayedWebhook.status, 200, await replayedWebhook.clone().text());
    const replayedBody = await replayedWebhook.json() as Record<string, unknown>;
    assert.equal(replayedBody.duplicate, true);
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type = 'refund' AND site_id = '${tenant.siteId}'::uuid AND metadata->>'payment_id' = '${merchantPaymentId}';`), '1');
  });

test('authenticated UPI refund recovers a transient finalizer failure and records payment, attempt, ledger and outbox atomically', async () => {
    const manualTenant = newSyntheticTenant('manual-refund');
    const ownerId = randomUUID();
    const ownerEmail = `syn-manual-refund-${manualTenant.tag}@example.invalid`;
    const manualPaymentId = randomUUID();
    const providerRefundId = `upi-refund-${randomUUID().replaceAll('-', '')}`;
    const idempotencyKey = `manual-refund-${randomUUID()}`;
    seedSyntheticTenant(owned.psql, manualTenant);
    const order = seedSyntheticOrder(owned.psql, manualTenant);
    owned.psql(`
      INSERT INTO public.users_custom (id, email, full_name) VALUES ('${ownerId}'::uuid, ${q(ownerEmail)}, 'Synthetic UPI Refund Merchant');
      UPDATE public.sites SET custom_user_id = '${ownerId}'::uuid WHERE id = '${manualTenant.siteId}'::uuid;
      INSERT INTO public.payments (id, site_id, order_id, provider, mode, status, amount_minor, currency, idempotency_key)
      VALUES ('${manualPaymentId}'::uuid, '${manualTenant.siteId}'::uuid, '${order.orderId}'::uuid, 'upi', 'sandbox', 'captured', 10000, 'INR', 'synthetic-upi-payment-${manualTenant.tag}');
    `);

    const gateway = await gatewayPromise;
    const requestInput = {
        gateway,
        ownerId,
        ownerEmail,
        siteId: manualTenant.siteId,
        paymentId: manualPaymentId,
        idempotencyKey,
        amountMinor: 5000,
        providerRefundId,
    };
    const originalFetch = globalThis.fetch;
    let failFinalizerOnce = true;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        if (failFinalizerOnce && url.pathname.endsWith('/rpc/finalize_manual_payment_refund_attempt')) {
            failFinalizerOnce = false;
            return new Response(JSON.stringify({ code: 'XX000', message: 'synthetic transient finalizer failure' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        return originalFetch(input, init);
    }) as typeof fetch;
    let first;
    try {
        first = await authenticatedMerchantRefund(requestInput);
    } finally {
        globalThis.fetch = originalFetch;
    }
    assert.equal(first?.status, 503, first?.text);
    assert.equal(owned.psql(`SELECT status FROM public.payment_attempts WHERE payment_id = '${manualPaymentId}'::uuid AND attempt_type = 'refund';`), 'pending');
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type = 'refund' AND site_id = '${manualTenant.siteId}'::uuid AND metadata->>'payment_id' = '${manualPaymentId}';`), '0');

    const recovered = await authenticatedMerchantRefund(requestInput);
    const replay = await authenticatedMerchantRefund(requestInput);

    assert.equal(recovered.status, 200, recovered.text);
    assert.equal(recovered.json?.data?.refunded, true);
    assert.equal(recovered.json?.data?.fully_refunded, false);
    assert.equal(replay.status, 200, replay.text);
    assert.equal(replay.headers.get('X-Idempotent-Replay'), 'true');
    assert.equal(owned.psql(`SELECT status||'|'||refunded_amount_minor::text FROM public.payments WHERE id = '${manualPaymentId}'::uuid;`), 'captured|5000');
    assert.equal(owned.psql(`SELECT status||'|'||provider_event_id FROM public.payment_attempts WHERE payment_id = '${manualPaymentId}'::uuid AND attempt_type = 'refund';`), `succeeded|manual.refund:${providerRefundId}`);
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type = 'refund' AND site_id = '${manualTenant.siteId}'::uuid AND metadata->>'payment_id' = '${manualPaymentId}';`), '1');
    assert.equal(owned.psql(`
      SELECT CASE WHEN SUM(CASE WHEN e.side = 'debit' THEN e.amount_minor ELSE -e.amount_minor END) = 0 THEN 'balanced' ELSE 'unbalanced' END
        FROM public.ledger_transactions t JOIN public.ledger_entries e ON e.transaction_id = t.id
       WHERE t.source_type = 'refund' AND t.site_id = '${manualTenant.siteId}'::uuid AND t.metadata->>'payment_id' = '${manualPaymentId}';
    `), 'balanced');
    assert.equal(owned.psql(`SELECT count(*) FROM public.outbox_events WHERE idempotency_key = ${q(`payment.refund:${manualPaymentId}:upi:${providerRefundId}`)} AND event_type = 'payment.refunded' AND payload->>'provider_event_id' = ${q(`manual.refund:${providerRefundId}`)} AND payload->>'payment_status' = 'paid';`), '1');
});

test('same-key concurrent requests reserve once and different-key concurrent refunds cannot over-reserve', async () => {
    const concurrentTenant = newSyntheticTenant('refund-race');
    const ownerId = randomUUID();
    const ownerEmail = `syn-refund-race-${concurrentTenant.tag}@example.invalid`;
    const sameKeyPaymentId = randomUUID();
    const sameKeyProviderPaymentId = `pay_${randomUUID().replaceAll('-', '')}`;
    const sameKeyRefundId = `rfnd_${randomUUID().replaceAll('-', '')}`;
    const differentKeyPaymentId = randomUUID();
    const differentKeyProviderPaymentId = `pay_${randomUUID().replaceAll('-', '')}`;
    const differentKeyRefundId = `rfnd_${randomUUID().replaceAll('-', '')}`;
    const sameKey = `syn-same-refund-${randomUUID()}`;
    const owned = requireOwnedDatabase();
    seedSyntheticTenant(owned.psql, concurrentTenant);
    const sameKeyOrder = seedSyntheticOrder(owned.psql, concurrentTenant);
    const differentKeyOrder = seedSyntheticOrder(owned.psql, concurrentTenant);
    owned.psql(`
      INSERT INTO public.users_custom (id, email, full_name) VALUES ('${ownerId}'::uuid, ${q(ownerEmail)}, 'Synthetic Refund Race Merchant');
      UPDATE public.sites SET custom_user_id = '${ownerId}'::uuid WHERE id = '${concurrentTenant.siteId}'::uuid;
      INSERT INTO public.payments (id, site_id, order_id, provider, mode, status, amount_minor, currency, provider_payment_id, idempotency_key) VALUES
        ('${sameKeyPaymentId}'::uuid, '${concurrentTenant.siteId}'::uuid, '${sameKeyOrder.orderId}'::uuid, 'razorpay', 'sandbox', 'captured', 10000, 'INR', ${q(sameKeyProviderPaymentId)}, 'syn-race-payment-a-${concurrentTenant.tag}'),
        ('${differentKeyPaymentId}'::uuid, '${concurrentTenant.siteId}'::uuid, '${differentKeyOrder.orderId}'::uuid, 'razorpay', 'sandbox', 'captured', 10000, 'INR', ${q(differentKeyProviderPaymentId)}, 'syn-race-payment-b-${concurrentTenant.tag}');
    `);

    const gateway = await gatewayPromise;
    const originalFetch = globalThis.fetch;
    const callCounts = new Map<string, number>();
    let providerEnteredResolve!: () => void;
    const providerEntered = new Promise<void>((resolve) => { providerEnteredResolve = resolve; });
    let releaseProviderResolve!: () => void;
    const releaseProvider = new Promise<void>((resolve) => { releaseProviderResolve = resolve; });
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        if (url.origin === 'https://api.razorpay.com' && url.pathname.endsWith('/refund')) {
            const paymentReference = decodeURIComponent(url.pathname.split('/').at(-2) || '');
            const count = (callCounts.get(paymentReference) || 0) + 1;
            callCounts.set(paymentReference, count);
            if (paymentReference === sameKeyProviderPaymentId) {
                providerEnteredResolve();
                await releaseProvider;
            }
            const refundId = paymentReference === sameKeyProviderPaymentId ? sameKeyRefundId : differentKeyRefundId;
            return new Response(JSON.stringify({ id: refundId, payment_id: paymentReference, amount: 6000, currency: 'INR', status: 'created' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        return originalFetch(input, init);
    }) as typeof fetch;

    let sameKeyFirst: Awaited<ReturnType<typeof authenticatedMerchantRefund>> | undefined;
    let sameKeySecond: Awaited<ReturnType<typeof authenticatedMerchantRefund>> | undefined;
    let differentKeyResults: Awaited<ReturnType<typeof authenticatedMerchantRefund>>[] = [];
    try {
        const sameKeyFirstPromise = authenticatedMerchantRefund({
            gateway, ownerId, ownerEmail, siteId: concurrentTenant.siteId,
            paymentId: sameKeyPaymentId, idempotencyKey: sameKey, amountMinor: 6000,
        });
        await providerEntered;
        sameKeySecond = await authenticatedMerchantRefund({
            gateway, ownerId, ownerEmail, siteId: concurrentTenant.siteId,
            paymentId: sameKeyPaymentId, idempotencyKey: sameKey, amountMinor: 6000,
        });
        releaseProviderResolve();
        sameKeyFirst = await sameKeyFirstPromise;

        differentKeyResults = await Promise.all([
            authenticatedMerchantRefund({
                gateway, ownerId, ownerEmail, siteId: concurrentTenant.siteId,
                paymentId: differentKeyPaymentId, idempotencyKey: `syn-refund-left-${randomUUID()}`, amountMinor: 6000,
            }),
            authenticatedMerchantRefund({
                gateway, ownerId, ownerEmail, siteId: concurrentTenant.siteId,
                paymentId: differentKeyPaymentId, idempotencyKey: `syn-refund-right-${randomUUID()}`, amountMinor: 6000,
            }),
        ]);
    } finally {
        releaseProviderResolve();
        globalThis.fetch = originalFetch;
    }

    assert.equal(sameKeyFirst?.status, 202, sameKeyFirst?.text);
    assert.equal(sameKeySecond?.status, 409, sameKeySecond?.text);
    assert.equal(callCounts.get(sameKeyProviderPaymentId), 1, 'a simultaneous same-key request cannot repeat the provider side effect');
    assert.deepEqual(differentKeyResults.map((response) => response.status).sort(), [202, 409]);
    assert.equal(callCounts.get(differentKeyProviderPaymentId), 1, 'row locking prevents concurrent different keys from both reserving beyond the captured amount');
    assert.equal(owned.psql(`SELECT count(*) FROM public.payment_attempts WHERE payment_id = '${sameKeyPaymentId}'::uuid AND attempt_type = 'refund';`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM public.payment_attempts WHERE payment_id = '${differentKeyPaymentId}'::uuid AND attempt_type = 'refund' AND status = 'pending';`), '1');
    assert.equal(owned.psql(`SELECT refunded_amount_minor::text FROM public.payments WHERE id = '${differentKeyPaymentId}'::uuid;`), '0');
});

// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Phase 10: real Gateway billing routes -> shared Razorpay verifier -> owned PostgREST/Postgres
// -> atomic D-5 ad-credit finalizer. Razorpay is replaced with a deterministic local fetch adapter.
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import test, { afterEach, before } from 'node:test';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { requireOwnedDatabase } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';

const owned = requireOwnedDatabase();
const tenant = newSyntheticTenant('ad-purchase');
const otherTenant = newSyntheticTenant('ad-purchase-alt');
const owner = { id: randomUUID(), email: `ad-owner-${randomUUID()}@example.invalid` };
const otherOwner = { id: randomUUID(), email: `ad-other-${randomUUID()}@example.invalid` };
const RAZORPAY_KEY_ID = 'rzp_test_synthetic';
const RAZORPAY_KEY_SECRET = 'synthetic-ad-credit-provider-secret';
const amountMinor = 50000;
const providerPaymentId = `pay_${randomUUID().replaceAll('-', '')}`;
const secondPaymentId = `pay_${randomUUID().replaceAll('-', '')}`;
const providerOrderId = `order_${randomUUID().replaceAll('-', '')}`;
let gateway: Gateway;
let providerOrderCalls = 0;
const originalFetch = globalThis.fetch;

function q(value: string) { return `'${value.replaceAll("'", "''")}'`; }

async function send(path: string, body: Record<string, unknown>, siteId = tenant.siteId, actor = owner) {
    return gateway.request(`/v1/billing/ad-credits/${path}`, {
        method: 'POST',
        headers: { ...await signedIdentityHeaders(actor.id, actor.email, siteId), 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: siteId, ...body }),
    });
}

function paymentSignature(paymentId: string) {
    return createHmac('sha256', RAZORPAY_KEY_SECRET).update(`${providerOrderId}|${paymentId}`).digest('hex');
}

before(async () => {
    seedSyntheticTenant(owned.psql, tenant);
    seedSyntheticTenant(owned.psql, otherTenant);
    owned.psql(`
      INSERT INTO public.users (id,email) VALUES (${q(owner.id)}::uuid,${q(owner.email)}),(${q(otherOwner.id)}::uuid,${q(otherOwner.email)});
      INSERT INTO public.users_custom (id,email,email_verified) VALUES (${q(owner.id)}::uuid,${q(owner.email)},true),(${q(otherOwner.id)}::uuid,${q(otherOwner.email)},true);
      UPDATE public.sites SET user_id = ${q(owner.id)}::uuid WHERE id = ${q(tenant.siteId)}::uuid;
      UPDATE public.sites SET user_id = ${q(otherOwner.id)}::uuid WHERE id = ${q(otherTenant.siteId)}::uuid;
    `);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), {
        RAZORPAY_KEY_ID,
        RAZORPAY_KEY_SECRET,
        LETBUYY_RAZORPAY_MODE: 'sandbox',
    }));
});

afterEach(async () => {
    await gateway?.settle();
    globalThis.fetch = originalFetch;
});

test('ad-credit intent and verification credit once, bind tenant/order/payment and reject a second payment attempt', async () => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url === 'https://api.razorpay.com/v1/orders') {
            providerOrderCalls += 1;
            const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
            assert.equal(body.amount, amountMinor);
            assert.equal(body.currency, 'INR');
            assert.match(String(body.receipt), /^ac_[a-f0-9]{32}$/);
            assert.ok(String(body.receipt).length <= 40);
            assert.deepEqual(body.notes, { purpose: 'ad_credits', site_id: tenant.siteId });
            return new Response(JSON.stringify({ id: providerOrderId, amount: amountMinor, currency: 'INR', receipt: body.receipt, status: 'created' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        return originalFetch(input, init);
    }) as typeof fetch;

    const intent = await send('intent', { amount_minor: amountMinor });
    assert.equal(intent.status, 201, intent.text);
    assert.equal(providerOrderCalls, 1);
    const billingHistoryId = String(intent.json?.data?.billing_history_id || '');
    assert.ok(billingHistoryId);
    assert.equal(owned.psql(`SELECT payment_status || ':' || payment_id FROM public.billing_history
      WHERE id = ${q(billingHistoryId)}::uuid AND site_id = ${q(tenant.siteId)}::uuid;`), `pending:${providerOrderId}`);

    const body = {
        razorpay_order_id: providerOrderId,
        razorpay_payment_id: providerPaymentId,
        razorpay_signature: paymentSignature(providerPaymentId),
    };
    const invalidSignature = await send('verify', { ...body, razorpay_signature: '0'.repeat(64) });
    assert.equal(invalidSignature.status, 400, invalidSignature.text);
    assert.equal(owned.psql(`SELECT payment_status FROM public.billing_history
      WHERE id = ${q(billingHistoryId)}::uuid;`), 'pending');
    assert.equal(owned.psql(`SELECT count(*) FROM public.ad_credit_ledger_entries
      WHERE site_id = ${q(tenant.siteId)}::uuid AND entry_type = 'purchased';`), '0');

    // Independent signed requests race through the real worker/PostgREST path.
    // A response lost after any winner commits is recovered by the replay below.
    const concurrent = await Promise.all(Array.from({ length: 4 }, () => send('verify', body)));
    for (const result of concurrent) assert.equal(result.status, 200, result.text);
    assert.equal(owned.psql(`SELECT payment_status || ':' || provider_payment_reference FROM public.billing_history
      WHERE id = ${q(billingHistoryId)}::uuid;`), `paid:${providerPaymentId}`);
    assert.equal(owned.psql(`SELECT count(*) FROM public.ad_credit_ledger_entries
      WHERE site_id = ${q(tenant.siteId)}::uuid AND entry_type = 'purchased'
        AND payment_reference = ${q(providerPaymentId)} AND amount_minor = ${amountMinor};`), '1');
    const canonicalLedgerId = owned.psql(`SELECT canonical_ledger_transaction_id::text FROM public.billing_history
      WHERE id = ${q(billingHistoryId)}::uuid AND site_id = ${q(tenant.siteId)}::uuid;`);
    assert.match(canonicalLedgerId, /^[0-9a-f-]{36}$/i);
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions
      WHERE id = ${q(canonicalLedgerId)}::uuid AND source_type = 'ad_credit_purchase'
        AND source_id = ${q(billingHistoryId)};`), '1');
    assert.equal(owned.psql(`SELECT string_agg(ledger_accounts.account_code || ':' || ledger_entries.side || ':' || ledger_entries.amount_minor,
        ',' ORDER BY ledger_entries.sequence)
      FROM public.ledger_entries JOIN public.ledger_accounts ON ledger_accounts.id = ledger_entries.account_id
      WHERE ledger_entries.transaction_id = ${q(canonicalLedgerId)}::uuid;`),
      `pa_clearing:debit:${amountMinor},ad_credit_liability:credit:${amountMinor}`);
    assert.equal(owned.psql(`SELECT public.ledger_account_balance_minor(${q(tenant.siteId)}::uuid, 'merchant_payable')::text;`), '0');
    assert.equal(owned.psql(`SELECT public.ledger_account_balance_minor(${q(tenant.siteId)}::uuid, 'ad_credit_liability')::text;`), String(amountMinor));

    const replay = await send('verify', body);
    assert.equal(replay.status, 200, replay.text);
    assert.equal(replay.json?.data?.credited?.replayed, true);
    assert.equal(owned.psql(`SELECT count(*) FROM public.ad_credit_ledger_entries
      WHERE site_id = ${q(tenant.siteId)}::uuid AND payment_reference = ${q(providerPaymentId)};`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions
      WHERE source_type = 'ad_credit_purchase' AND source_id = ${q(billingHistoryId)};`), '1');

    const secondAttempt = await send('verify', {
        ...body,
        razorpay_payment_id: secondPaymentId,
        razorpay_signature: paymentSignature(secondPaymentId),
    });
    assert.equal(secondAttempt.status, 500, secondAttempt.text);
    assert.equal(owned.psql(`SELECT count(*) FROM public.ad_credit_ledger_entries
      WHERE site_id = ${q(tenant.siteId)}::uuid AND entry_type = 'purchased';`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions
      WHERE source_type = 'ad_credit_purchase' AND source_id = ${q(billingHistoryId)};`), '1');

    const foreignTenant = await send('verify', body, otherTenant.siteId, otherOwner);
    assert.equal(foreignTenant.status, 404, foreignTenant.text);
    assert.equal(owned.psql(`SELECT count(*) FROM public.ad_credit_ledger_entries
      WHERE site_id = ${q(otherTenant.siteId)}::uuid;`), '0');
    assert.equal(providerOrderCalls, 1, 'verification and retries must not create additional provider orders');
});

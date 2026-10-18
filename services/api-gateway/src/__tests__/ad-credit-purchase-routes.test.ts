// F-CHARGE-2 — the merchant ad-credit purchase, completing D-PLATFORM-CHARGE.
//
// These two routes are the first caller record_ad_credit_purchase has ever had. What matters is that
// the money facts come from the SERVER: the amount from the stored billing row, the site from the
// resolved owned-store scope, and the verification reference from what the server stored when it
// created the provider order. The request supplies only which store, and the provider's own ids.
//
// The intent route's fail-closed behaviour is exercised; the rest are source contracts, because the
// handlers use module-level dependencies (the admin client, the tenant resolver) that a fake would
// have to model — and a fake that models the scoping cannot prove the scoping.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Hono } from 'hono';
import billingRouter from '../routes/billing';

const billingSource = readFileSync(new URL('../routes/billing.ts', import.meta.url), 'utf8');
const adsSource = readFileSync(new URL('../routes/ads.ts', import.meta.url), 'utf8');
const finalizerSource = readFileSync(new URL('../../../../database/supabase/migrations/293_ad_credit_purchase_canonical_liability.sql', import.meta.url), 'utf8');

const STORE = 'aaaaaaaa-0000-4000-8000-00000000000a';

function app(env: Record<string, unknown>) {
    const root = new Hono();
    root.use('*', async (c, next) => {
        (c as unknown as { env: Record<string, unknown> }).env = env;
        c.set('auth' as never, { user: { id: 'user-1', email: 'm@example.com', storeId: STORE } } as never);
        await next();
    });
    root.route('/billing', billingRouter);
    return root;
}
const post = (payload: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });

// The handler section under test, so an assertion cannot be satisfied by unrelated billing code.
const adCreditSection = billingSource.slice(billingSource.indexOf("router.post('/ad-credits/intent'"));

test('intent fails CLOSED without Razorpay credentials, before any database access', async () => {
    // The env has no Supabase configuration either: a clean 503 can only mean nothing downstream ran.
    const res = await app({}).request('/billing/ad-credits/intent', post({ store_id: STORE, amount_minor: 50000 }), {});
    assert.equal(res.status, 503);
    assert.equal(((await res.json()) as { error: { code: string } }).error.code, 'PAYMENT_UNAVAILABLE');
});

test('intent validates the amount before reaching the provider', async () => {
    const a = app({ RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's' });
    for (const amount of [0, -1, 500, 1e12, 1.5]) {
        const res = await a.request('/billing/ad-credits/intent', post({ store_id: STORE, amount_minor: amount }), {});
        assert.equal(res.status, 400, `amount_minor ${amount} must be refused at the edge`);
    }
    // A missing store_id is refused before anything is resolved.
    assert.equal((await a.request('/billing/ad-credits/intent', post({ amount_minor: 50000 }), {})).status, 400);
});

test('verify requires every provider field', async () => {
    const a = app({ RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's' });
    const full = {
        store_id: STORE, razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig',
    };
    for (const field of ['store_id', 'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature']) {
        const partial = { ...full } as Record<string, unknown>;
        delete partial[field];
        const res = await a.request('/billing/ad-credits/verify', post(partial), {});
        assert.equal(res.status, 400, `${field} must be required`);
    }
});

test('SOURCE: the amount charged comes from the stored row, never the request', () => {
    // A caller-supplied amount is a caller-chosen number of credits.
    assert.match(adCreditSection, /const amountMinor = Number\(\(charge as \{ amount: number \}\)\.amount\)/);
    assert.match(adCreditSection, /p_billing_history_id: \(charge as \{ id: string \}\)\.id/);
    assert.match(finalizerSource, /v_charge\.amount::bigint[\s\S]{0,120}?p_provider_payment_id[\s\S]{0,120}?'ad\.purchase:' \|\| p_provider_payment_id/);
    // The verify handler must not read an amount from the body at all.
    const verifySection = adCreditSection.slice(adCreditSection.indexOf("router.post('/ad-credits/verify'"));
    assert.ok(!/body\.amount/.test(verifySection), 'verify must not take an amount from the request');
});

test('SOURCE: verification binds to the SERVER-stored reference', () => {
    assert.match(adCreditSection, /storedProviderOrderId: \(charge as \{ payment_id: string \| null \}\)\.payment_id/);
    // And the charge row is found by the provider order id AND the resolved site — scoping by the
    // reference alone would let a merchant redirect someone else's payment into their own balance.
    assert.match(adCreditSection, /\.eq\('payment_id', body\.razorpay_order_id as string\)[\s\S]{0,120}?\.eq\('site_id', tenant\.siteId\)/);
});

test('SOURCE: one payment credits once, and the row is marked paid only after it does', () => {
    assert.match(adCreditSection, /db\.rpc\('finalize_ad_credit_purchase'/);
    assert.match(adCreditSection, /p_billing_history_id: \(charge as \{ id: string \}\)\.id/);
    assert.match(adCreditSection, /p_provider_payment_id: paymentId/);
    assert.ok(!/\.update\(\{ payment_status: 'paid' \}\)/.test(adCreditSection),
        'the billing state must be finalized in the same SQL transaction as the credit');
    assert.match(finalizerSource, /public\.post_settlement_ledger_transaction\([\s\S]{0,220}?'ad_credit_purchase'/);
    assert.match(finalizerSource, /'account_code', 'pa_clearing'[\s\S]{0,180}?'side', 'debit'/);
    assert.match(finalizerSource, /'account_code', 'ad_credit_liability'[\s\S]{0,180}?'side', 'credit'/);
    assert.match(finalizerSource, /canonical_ledger_transaction_id = v_ledger_id/);
});

test('SOURCE: the routes are in billing, and ads.ts keeps its no-service-role property', () => {
    // routes/ads.ts is asserted elsewhere to contain no service-role path at all; these routes need
    // the admin client, so putting them there would have broken that contract silently.
    assert.match(billingSource, /router\.post\('\/ad-credits\/intent'/);
    assert.match(billingSource, /router\.post\('\/ad-credits\/verify'/);
    assert.ok(!/ad-credits/.test(adsSource), 'the ad-credit purchase must not live in the tenant-transaction router');
    assert.ok(!/getSupabaseAdmin/.test(adsSource), 'and ads.ts must still have no service-role path');
});

test('SOURCE: the provider order is created through the existing helper, not a second path', () => {
    assert.match(billingSource, /import \{ createRazorpayOrder \} from '@letbuyy\/infrastructure\/razorpay-adapter'/);
    assert.match(adCreditSection, /await createRazorpayOrder\(/);
    // And verification goes through the one shared verifier extracted in F-CHARGE-1.
    assert.match(billingSource, /import \{ verifyRazorpayPayment \} from '\.\.\/lib\/provider-payment-verification'/);
    assert.ok(!/crypto\.subtle\.importKey\(/.test(billingSource), 'no second HMAC construction');
});

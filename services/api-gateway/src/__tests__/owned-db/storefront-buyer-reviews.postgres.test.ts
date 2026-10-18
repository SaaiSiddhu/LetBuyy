// Canonical storefront reviews use the signed buyer session and verified buyer/store-customer link.
// Real worker, middleware, PostgREST and owned Postgres; service-role access is not an RLS proof.
import assert from 'node:assert/strict';
import test, { afterEach, before } from 'node:test';
import { issueCustomerSession, LETBUYY_CUSTOMER_SESSION_COOKIE, LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { Gateway, gatewayEnv, mintSession, newIdentityKeys, seedBuyerAccount, type IdentityKeys } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const { psql } = owned;
const site = newSyntheticTenant('buyer-reviews');
let keys: IdentityKeys;
let gateway: Gateway;
let productId: string;

before(async () => {
    keys = await newIdentityKeys();
    seedSyntheticTenant(psql, site);
    productId = crypto.randomUUID();
    psql(`INSERT INTO products (id,store_id,name,price,is_active,status) VALUES ('${productId}','${site.siteId}','Synthetic review product',19.99,true,'active');`);
    // The local-only bypass is accepted by the real Turnstile verifier only in an explicitly local runtime.
    gateway = new Gateway(gatewayEnv(owned, keys, { ENVIRONMENT: 'development', CUSTOMER_SESSION_SECRET: 'synthetic-review-customer-session-secret' }));
});
afterEach(async () => { await gateway.settle(); });

async function headers(buyerId: string, siteId = site.siteId) {
    return {
        [LETBUYY_STOREFRONT_SESSION_HEADER]: await mintSession(keys, buyerId, {
            audience: 'letbuyy:storefront-session', tokenUse: 'storefront_session', epoch: 1,
            extraClaims: { site_id: siteId },
        }),
        'Content-Type': 'application/json',
    };
}
const url = (siteId = site.siteId) => `/v1/storefront/buyer/reviews?store_id=${siteId}`;
function link(buyerId: string) {
    return psql(`SELECT link_buyer_store_customer('${buyerId}'::uuid,'${site.siteId}'::uuid)::text;`);
}
function submit(body: Record<string, unknown> = {}) {
    return JSON.stringify({ product_id: productId, rating: 5, turnstile_token: 'dev-bypass-token', ...body });
}

test('a verified linked buyer creates a pending review with server-derived identity and no PII in the response', async () => {
    const buyer = seedBuyerAccount(psql, 'review-linked');
    assert.match(link(buyer.id), /linked/);
    const customerId = psql(`SELECT store_customer_id FROM buyer_store_customers WHERE buyer_account_id='${buyer.id}' AND site_id='${site.siteId}';`);
    psql(`UPDATE store_customers SET full_name='Synthetic Linked Buyer' WHERE id='${customerId}';`);

    const response = await gateway.request(url(), { method: 'POST', headers: await headers(buyer.id), body: submit({
        store_id: crypto.randomUUID(), customer_email: 'forged@example.invalid', customer_name: 'Forged', is_verified: false,
    }) });
    assert.equal(response.status, 201);
    assert.deepEqual(response.json?.data, { review: { id: response.json?.data.review.id, status: 'pending' }, message: 'Review submitted! It will appear after approval.' });
    assert.doesNotMatch(response.text, /forged@example|Synthetic Linked Buyer|@example\.invalid/);
    assert.equal(psql(`SELECT customer_email || '|' || customer_name || '|' || is_verified::text || '|' || is_approved::text || '|' || status FROM product_reviews WHERE id='${response.json?.data.review.id}';`), `${buyer.email}|Synthetic Linked Buyer|true|false|pending`);
});

test('unlinked, legacy-unverified and inactive store relationships cannot submit reviews', async () => {
    const unlinked = seedBuyerAccount(psql, 'review-unlinked');
    const noLink = await gateway.request(url(), { method: 'POST', headers: await headers(unlinked.id), body: submit() });
    assert.equal(noLink.status, 409);
    assert.match(noLink.text, /STORE_ACCOUNT_NOT_LINKED/);

    const legacy = seedBuyerAccount(psql, 'review-legacy');
    const legacyCustomer = crypto.randomUUID();
    psql(`INSERT INTO store_customers (id,store_id,email,status) VALUES ('${legacyCustomer}','${site.siteId}','${legacy.email}','active');`);
    psql(`INSERT INTO buyer_store_customers (buyer_account_id,store_customer_id,site_id,link_basis) VALUES ('${legacy.id}','${legacyCustomer}','${site.siteId}','legacy_unverified');`);
    assert.equal((await gateway.request(url(), { method: 'POST', headers: await headers(legacy.id), body: submit() })).status, 409);

    const inactive = seedBuyerAccount(psql, 'review-inactive');
    assert.match(link(inactive.id), /linked/);
    psql(`UPDATE store_customers SET status='disabled' WHERE id=(SELECT store_customer_id FROM buyer_store_customers WHERE buyer_account_id='${inactive.id}' AND site_id='${site.siteId}');`);
    const unavailable = await gateway.request(url(), { method: 'POST', headers: await headers(inactive.id), body: submit() });
    assert.equal(unavailable.status, 409);
    assert.match(unavailable.text, /STORE_ACCOUNT_UNAVAILABLE/);
});

test('reviews reject wrong-site sessions, untrusted identity, archived products and duplicate submissions', async () => {
    const buyer = seedBuyerAccount(psql, 'review-boundary');
    assert.match(link(buyer.id), /linked/);
    const auth = await headers(buyer.id);
    assert.equal((await gateway.request(url(crypto.randomUUID()), { method: 'POST', headers: auth, body: submit() })).status, 401);
    assert.equal((await gateway.request(url(), { method: 'POST', headers: auth, body: submit({ product_id: 'not-a-uuid' }) })).status, 400);

    const first = await gateway.request(url(), { method: 'POST', headers: auth, body: submit() });
    assert.equal(first.status, 201);
    const duplicate = await gateway.request(url(), { method: 'POST', headers: auth, body: submit() });
    assert.equal(duplicate.status, 409);

    const otherProduct = crypto.randomUUID();
    psql(`INSERT INTO products (id,store_id,name,price,is_active,status) VALUES ('${otherProduct}','${site.siteId}','Synthetic archived product',19.99,false,'archived');`);
    const archived = await gateway.request(url(), { method: 'POST', headers: auth, body: submit({ product_id: otherProduct }) });
    assert.equal(archived.status, 400);
    assert.equal(psql(`SELECT count(*) FROM product_reviews WHERE product_id='${otherProduct}';`), '0');
});

test('legacy anonymous identity cannot claim a verified badge, while a database-backed customer session can', async () => {
    const csrf = crypto.randomUUID();
    const csrfHeaders = { 'Content-Type': 'application/json', Cookie: `letbuyy_csrf=${csrf}`, 'X-CSRF-Token': csrf };
    const guestEmail = `guest-${crypto.randomUUID()}@example.invalid`;
    const guest = await gateway.request('/v1/storefront/reviews', {
        method: 'POST', headers: csrfHeaders,
        body: submit({ store_id: site.siteId, customer_email: guestEmail, customer_name: 'Synthetic Guest', is_verified: true }),
    });
    assert.equal(guest.status, 201);
    assert.equal(guest.text.includes(guestEmail), false);
    assert.doesNotMatch(guest.text, /Synthetic Guest/);
    assert.equal(psql(`SELECT is_verified::text FROM product_reviews WHERE customer_email='${guestEmail}';`), 'false');

    const customerId = crypto.randomUUID();
    const customerEmail = `session-${crypto.randomUUID()}@example.invalid`;
    psql(`INSERT INTO store_customers (id,store_id,email,full_name,status) VALUES ('${customerId}','${site.siteId}','${customerEmail}','Synthetic Session Customer','active');`);
    const session = await issueCustomerSession({ storeId: site.siteId, customerId }, 'synthetic-review-customer-session-secret');
    const signedIn = await gateway.request('/v1/storefront/reviews', {
        method: 'POST',
        headers: { ...csrfHeaders, Cookie: `letbuyy_csrf=${csrf}; ${LETBUYY_CUSTOMER_SESSION_COOKIE}=${session.token}` },
        body: submit({ store_id: site.siteId, customer_email: guestEmail, customer_name: 'Forged', is_verified: false }),
    });
    assert.equal(signedIn.status, 201);
    assert.equal(signedIn.text.includes(customerEmail), false);
    assert.doesNotMatch(signedIn.text, /Synthetic Session Customer/);
    assert.equal(psql(`SELECT customer_email || '|' || customer_name || '|' || is_verified::text FROM product_reviews WHERE customer_email='${customerEmail}';`), `${customerEmail}|Synthetic Session Customer|true`);
});

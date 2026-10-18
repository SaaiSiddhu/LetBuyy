// Existing store-customer recovery through the canonical buyer-link route.
// Real signed sessions, production worker, PostgREST and owned Postgres; not a browser or RLS proof.
import assert from 'node:assert/strict';
import test, { afterEach, before } from 'node:test';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { Gateway, gatewayEnv, mintSession, newBarrier, newIdentityKeys, seedBuyerAccount, tapRest, type IdentityKeys } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const { psql } = owned;
const site = newSyntheticTenant('buyer-store-link');
const otherSite = newSyntheticTenant('buyer-store-link-alt');
const base = '/v1/storefront/buyer/link-store-customer';
let keys: IdentityKeys;
let gateway: Gateway;

before(async () => {
    keys = await newIdentityKeys();
    seedSyntheticTenant(psql, site);
    seedSyntheticTenant(psql, otherSite);
    gateway = new Gateway(gatewayEnv(owned, keys));
});
afterEach(async () => { await gateway.settle(); });

async function storefrontHeaders(buyerId: string, siteId = site.siteId) {
    return {
        [LETBUYY_STOREFRONT_SESSION_HEADER]: await mintSession(keys, buyerId, {
            audience: 'letbuyy:storefront-session',
            tokenUse: 'storefront_session',
            epoch: 1,
            extraClaims: { site_id: siteId },
        }),
        'Content-Type': 'application/json',
    };
}

async function link(headers: Record<string, string>, bodySiteId = site.siteId, querySiteId = site.siteId) {
    return gateway.request(`${base}?store_id=${encodeURIComponent(querySiteId)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ store_id: bodySiteId }),
    });
}

test('verified buyer links to the matching existing store account, upgrades a legacy edge and does not claim orders', async () => {
    const buyer = seedBuyerAccount(psql, 'link-verified');
    const customerId = crypto.randomUUID();
    psql(`INSERT INTO store_customers (id,store_id,email,full_name,status)
        VALUES ('${customerId}','${site.siteId}','${buyer.email}','Synthetic Existing Store Buyer','active');
        INSERT INTO buyer_store_customers (buyer_account_id,store_customer_id,site_id)
        VALUES ('${buyer.id}','${customerId}','${site.siteId}');`);

    const response = await link(await storefrontHeaders(buyer.id), site.siteId, site.siteId);
    assert.equal(response.status, 200, response.text);
    assert.equal(response.json?.data?.linked?.buyer_account_id, buyer.id);
    assert.equal(response.json?.data?.linked?.store_customer_id, customerId);
    assert.equal(psql(`SELECT link_basis FROM buyer_store_customers WHERE store_customer_id='${customerId}';`), 'verified_email');
    assert.equal(psql(`SELECT count(*) FROM buyer_store_customers WHERE store_customer_id='${customerId}' AND verified_at IS NOT NULL;`), '1');
    assert.equal(psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${buyer.id}' AND action='buyer_store_link.verified' AND resource_id='${customerId}';`), '1');
    assert.equal(psql(`SELECT count(*) FROM buyer_order_links WHERE buyer_account_id='${buyer.id}';`), '0', 'store linking must never claim historical orders');

    const repeated = await link(await storefrontHeaders(buyer.id), site.siteId, site.siteId);
    assert.equal(repeated.status, 200);
    assert.equal(psql(`SELECT count(*) FROM buyer_store_customers WHERE buyer_account_id='${buyer.id}' AND site_id='${site.siteId}';`), '1');
});

test('unverified buyer cannot link or cause a store-customer record to be created', async () => {
    const buyer = seedBuyerAccount(psql, 'link-unverified');
    psql(`UPDATE buyer_accounts SET email_verified=false,email_verified_at=NULL WHERE id='${buyer.id}';`);

    const response = await link(await storefrontHeaders(buyer.id), site.siteId, site.siteId);
    assert.equal(response.status, 403, response.text);
    assert.equal(response.json?.error?.code, 'EMAIL_UNVERIFIED');
    assert.equal(psql(`SELECT count(*) FROM store_customers WHERE store_id='${site.siteId}' AND email='${buyer.email}';`), '0');
    assert.equal(psql(`SELECT count(*) FROM buyer_store_customers WHERE buyer_account_id='${buyer.id}';`), '0');
    assert.equal(psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${buyer.id}' AND action='buyer_store_link.refused_unverified';`), '1');
});

test('concurrent first-time link attempts converge on one store relationship', async () => {
    const buyer = seedBuyerAccount(psql, 'link-concurrent');
    const headers = await storefrontHeaders(buyer.id);
    const barrier = newBarrier(2);
    const tap = tapRest(owned.restEnv().SUPABASE_URL, async (call, forward) => {
        if (call.resource === 'rpc/link_buyer_store_customer') await barrier.arrive();
        return forward();
    });
    try {
        const results = await Promise.all([
            link(headers, site.siteId, site.siteId),
            link(headers, site.siteId, site.siteId),
        ]);
        assert.deepEqual(results.map(result => result.status), [200, 200]);
        assert.equal(tap.calls.filter(call => call.resource === 'rpc/link_buyer_store_customer').length, 2);
        assert.equal(psql(`SELECT count(*) FROM store_customers WHERE store_id='${site.siteId}' AND email='${buyer.email}';`), '1');
        assert.equal(psql(`SELECT count(*) FROM buyer_store_customers WHERE buyer_account_id='${buyer.id}' AND site_id='${site.siteId}' AND link_basis='verified_email';`), '1');
        assert.equal(psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${buyer.id}' AND action='buyer_store_link.linked';`), '1');
    } finally {
        tap.restore();
    }
});

test('a store record linked to another buyer returns a private conflict and preserves the original link', async () => {
    const buyer = seedBuyerAccount(psql, 'link-claimant');
    const existingOwner = seedBuyerAccount(psql, 'link-existing-owner');
    const customerId = crypto.randomUUID();
    psql(`INSERT INTO store_customers (id,store_id,email,status)
        VALUES ('${customerId}','${site.siteId}','${buyer.email}','active');
        INSERT INTO buyer_store_customers (buyer_account_id,store_customer_id,site_id)
        VALUES ('${existingOwner.id}','${customerId}','${site.siteId}');`);

    const response = await link(await storefrontHeaders(buyer.id), site.siteId, site.siteId);
    assert.equal(response.status, 409);
    assert.equal(response.json?.error?.code, 'LINK_CONFLICT');
    assert.doesNotMatch(response.text, new RegExp(existingOwner.id));
    assert.equal(psql(`SELECT buyer_account_id FROM buyer_store_customers WHERE store_customer_id='${customerId}';`), existingOwner.id);
    assert.equal(psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${buyer.id}' AND action='buyer_store_link.conflict';`), '1');
});

test('a signed storefront buyer cannot link a sibling store through query or body input', async () => {
    const buyer = seedBuyerAccount(psql, 'link-site-bound');
    const headers = await storefrontHeaders(buyer.id, site.siteId);
    const wrongQuery = await link(headers, site.siteId, otherSite.siteId);
    assert.equal(wrongQuery.status, 401);
    const wrongBody = await link(headers, otherSite.siteId, site.siteId);
    assert.equal(wrongBody.status, 401);
    assert.equal(psql(`SELECT count(*) FROM buyer_store_customers WHERE buyer_account_id='${buyer.id}';`), '0');
    assert.equal(psql(`SELECT count(*) FROM store_customers WHERE email='${buyer.email}';`), '0');
});

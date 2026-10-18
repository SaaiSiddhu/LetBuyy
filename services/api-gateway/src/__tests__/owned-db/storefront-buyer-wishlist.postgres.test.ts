// Storefront buyer wishlist uses the existing store-customer list only through a verified link.
// Real worker, middleware, PostgREST and owned Postgres; service-role access is not an RLS proof.
import assert from 'node:assert/strict';
import test, { afterEach, before } from 'node:test';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { Gateway, gatewayEnv, mintSession, newIdentityKeys, seedBuyerAccount, type IdentityKeys } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const { psql } = owned;
const site = newSyntheticTenant('buyer-wishlist');
const otherSite = newSyntheticTenant('buyer-wishlist-other');
let keys: IdentityKeys;
let gateway: Gateway;

before(async () => {
    keys = await newIdentityKeys();
    seedSyntheticTenant(psql, site);
    seedSyntheticTenant(psql, otherSite);
    gateway = new Gateway(gatewayEnv(owned, keys));
});
afterEach(async () => { await gateway.settle(); });

async function auth(buyerId: string, siteId = site.siteId) {
    return { [LETBUYY_STOREFRONT_SESSION_HEADER]: await mintSession(keys, buyerId, {
        audience: 'letbuyy:storefront-session', tokenUse: 'storefront_session', epoch: 1,
        extraClaims: { site_id: siteId },
    }) };
}
const url = (siteId = site.siteId) => `/v1/storefront/buyer/wishlist?store_id=${siteId}`;
function link(buyerId: string, siteId: string) {
    return psql(`SELECT link_buyer_store_customer('${buyerId}'::uuid,'${siteId}'::uuid)::text;`);
}

test('an unlinked storefront buyer sees no customer wishlist and cannot create one', async () => {
    const buyer = seedBuyerAccount(psql, 'wishlist-unlinked');
    const headers = await auth(buyer.id);
    const read = await gateway.request(url(), { headers });
    assert.equal(read.status, 200);
    assert.deepEqual(read.json?.data, { linked: false, reason: 'not_linked', product_ids: [] });
    const write = await gateway.request(url(), { method: 'POST', headers, body: JSON.stringify({ product_id: 'product-1' }) });
    assert.equal(write.status, 409);
    assert.equal(psql(`SELECT count(*) FROM customer_wishlists;`), '0');
});

test('a legacy unverified relationship is not enough to expose the existing wishlist', async () => {
    const buyer = seedBuyerAccount(psql, 'wishlist-legacy');
    const customerId = crypto.randomUUID();
    psql(`INSERT INTO store_customers (id,store_id,email,status) VALUES ('${customerId}','${site.siteId}','${buyer.email}','active');`);
    psql(`INSERT INTO buyer_store_customers (buyer_account_id,store_customer_id,site_id,link_basis) VALUES ('${buyer.id}','${customerId}','${site.siteId}','legacy_unverified');`);
    psql(`INSERT INTO customer_wishlists (customer_id,store_id,product_id) VALUES ('${customerId}','${site.siteId}','private-product');`);
    const result = await gateway.request(url(), { headers: await auth(buyer.id) });
    assert.deepEqual(result.json?.data, { linked: false, reason: 'not_linked', product_ids: [] });
    assert.doesNotMatch(result.text, /private-product/);
});

test('only the verified buyer/store link grants site-scoped wishlist read and writes', async () => {
    const buyer = seedBuyerAccount(psql, 'wishlist-linked');
    const otherBuyer = seedBuyerAccount(psql, 'wishlist-outsider');
    assert.match(link(buyer.id, site.siteId), /linked/);
    assert.match(link(buyer.id, otherSite.siteId), /linked/);
    const customerId = psql(`SELECT store_customer_id FROM buyer_store_customers WHERE buyer_account_id='${buyer.id}' AND site_id='${site.siteId}';`);

    const headers = await auth(buyer.id);
    const add = await gateway.request(url(), { method: 'POST', headers, body: JSON.stringify({ product_id: 'shoe-1', variant_id: 'size-8', customer_id: crypto.randomUUID(), store_id: otherSite.siteId }) });
    assert.equal(add.status, 200);
    assert.equal(psql(`SELECT variant_id FROM customer_wishlists WHERE customer_id='${customerId}' AND store_id='${site.siteId}' AND product_id='shoe-1';`), 'size-8');
    const read = await gateway.request(url(), { headers: await auth(buyer.id) });
    assert.deepEqual(read.json?.data, { linked: true, product_ids: ['shoe-1'] });

    const remove = await gateway.request(url(), { method: 'DELETE', headers, body: JSON.stringify({ product_id: 'shoe-1' }) });
    assert.equal(remove.status, 200);
    assert.equal(psql(`SELECT count(*) FROM customer_wishlists WHERE customer_id='${customerId}' AND store_id='${site.siteId}';`), '0');
    await gateway.request(url(), { method: 'POST', headers, body: JSON.stringify({ product_id: 'shoe-1' }) });

    psql(`UPDATE store_customers SET status='disabled' WHERE id='${customerId}';`);
    const disabled = await gateway.request(url(), { headers });
    assert.deepEqual(disabled.json?.data, { linked: false, reason: 'store_account_unavailable', product_ids: [] });
    const inactiveWrite = await gateway.request(url(), { method: 'POST', headers, body: JSON.stringify({ product_id: 'shoe-2' }) });
    assert.equal(inactiveWrite.status, 409);
    assert.match(inactiveWrite.text, /STORE_ACCOUNT_UNAVAILABLE/);
    assert.equal(psql(`SELECT count(*) FROM customer_wishlists WHERE customer_id='${customerId}' AND store_id='${site.siteId}';`), '1');

    const outsider = await gateway.request(url(), { headers: await auth(otherBuyer.id) });
    assert.deepEqual(outsider.json?.data, { linked: false, reason: 'not_linked', product_ids: [] });
    assert.equal((await gateway.request(url(otherSite.siteId), { headers })).status, 401);
});

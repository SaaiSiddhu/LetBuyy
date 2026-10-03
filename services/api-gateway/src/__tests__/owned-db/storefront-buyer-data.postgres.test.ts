// Real worker + owned PostgREST/Postgres proof of the shared buyer data boundary.
// Suite-generated ES256 keys exercise verification and live account state; identity's
// issuer and browser are separate acceptance surfaces. Service-role access is not RLS proof.
import assert from 'node:assert/strict';
import test, { before, afterEach } from 'node:test';
import { LETBUYY_BUYER_SESSION_COOKIE, LETBUYY_BUYER_SESSION_HEADER, LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { Gateway, buyerHeaders, gatewayEnv, mintSession, newIdentityKeys, seedBuyerAccount, tapRest, restJson, type IdentityKeys } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const { psql } = owned;
const site = newSyntheticTenant('buyer-data');
const otherSite = newSyntheticTenant('buyer-other');
const base = '/v1/storefront/buyer';
let keys: IdentityKeys;
let gateway: Gateway;
before(async () => {
    keys = await newIdentityKeys();
    seedSyntheticTenant(psql, site);
    seedSyntheticTenant(psql, otherSite);
    gateway = new Gateway(gatewayEnv(owned, keys));
});
afterEach(async () => { await gateway.settle(); });

async function storeHeaders(id: string) {
    return { [LETBUYY_STOREFRONT_SESSION_HEADER]: await mintSession(keys, id, {
        audience: 'letbuyy:storefront-session', tokenUse: 'storefront_session', epoch: 1,
        extraClaims: { site_id: site.siteId },
    }), 'Content-Type': 'application/json' };
}
const atSite = (path: string, siteId = site.siteId) => `${base}${path}?store_id=${siteId}`;
const address = { full_name: 'Synthetic Buyer', address_line1: 'Fixture', city: 'Bengaluru', state: 'Karnataka', postal_code: '560001', is_default: true };

test('storefront and platform sessions share the same canonical profile and address book through all six methods', async () => {
    const buyer = seedBuyerAccount(psql, 'shared');
    const store = await storeHeaders(buyer.id);
    const platform = await buyerHeaders(keys, buyer.id, { epoch: 1 });
    assert.equal((await gateway.request(atSite('/profile'), { headers: store })).status, 200);
    const updated = await gateway.request(atSite('/profile'), { method: 'PATCH', headers: store, body: JSON.stringify({ full_name: 'Shared Buyer', email: 'forged@example.invalid', status: 'disabled', session_epoch: 99 }) });
    assert.equal(updated.status, 200);
    assert.equal(updated.json?.data.buyer.full_name, 'Shared Buyer');
    assert.equal(updated.json?.data.buyer.email, buyer.email);
    assert.equal((await gateway.request(`${base}/profile`, { headers: platform })).json?.data.buyer.full_name, 'Shared Buyer');
    const created = await gateway.request(atSite('/addresses'), { method: 'POST', headers: store, body: JSON.stringify({ ...address, buyer_account_id: crypto.randomUUID() }) });
    assert.equal(created.status, 201);
    const id = created.json?.data.address.id;
    assert.equal(created.json?.data.address.buyer_account_id, buyer.id);
    assert.equal((await gateway.request(atSite('/addresses'), { headers: store })).json?.data.addresses[0].id, id);
    assert.equal((await gateway.request(`${base}/addresses`, { headers: platform })).json?.data.addresses[0].id, id);
    assert.equal((await gateway.request(atSite(`/addresses/${id}`), { method: 'PATCH', headers: store, body: JSON.stringify({ city: 'Mumbai' }) })).status, 200);
    assert.equal((await gateway.request(atSite(`/addresses/${id}`), { method: 'DELETE', headers: store })).status, 200);
    assert.deepEqual((await gateway.request(`${base}/addresses`, { headers: platform })).json?.data.addresses, []);
});

test('a second buyer cannot read, edit or remove the first buyer address', async () => {
    const owner = seedBuyerAccount(psql, 'owner');
    const intruder = seedBuyerAccount(psql, 'intruder');
    const created = await gateway.request(`${base}/addresses`, { method: 'POST', headers: await buyerHeaders(keys, owner.id, { epoch: 1 }), body: JSON.stringify(address) });
    assert.equal(created.status, 201);
    const id = created.json?.data.address.id;
    const headers = await storeHeaders(intruder.id);
    assert.deepEqual((await gateway.request(atSite('/addresses'), { headers })).json?.data.addresses, []);
    assert.equal((await gateway.request(atSite(`/addresses/${id}`), { method: 'PATCH', headers, body: JSON.stringify({ city: 'Forged', buyer_account_id: intruder.id }) })).status, 404);
    assert.equal((await gateway.request(atSite(`/addresses/${id}`), { method: 'DELETE', headers })).status, 404);
    assert.equal(psql(`SELECT city FROM buyer_addresses WHERE id = '${id}';`), address.city);
});

test('wrong site, audience, header and ambiguous credentials are refused without falling back', async () => {
    const buyer = seedBuyerAccount(psql, 'scope');
    const store = await storeHeaders(buyer.id);
    const platform = await buyerHeaders(keys, buyer.id, { epoch: 1 });
    const token = store[LETBUYY_STOREFRONT_SESSION_HEADER];
    for (const [path, headers] of [
        [atSite('/profile', otherSite.siteId), store],
        [`${base}/profile`, store],
        [atSite('/profile'), { [LETBUYY_BUYER_SESSION_HEADER]: token }],
        [atSite('/profile'), { [LETBUYY_STOREFRONT_SESSION_HEADER]: platform[LETBUYY_BUYER_SESSION_HEADER] }],
        [atSite('/profile'), { ...store, ...platform }],
        [atSite('/profile'), { ...store, cookie: `${LETBUYY_BUYER_SESSION_COOKIE}=invalid` }],
        [atSite('/profile'), { cookie: `${LETBUYY_BUYER_SESSION_COOKIE}=%ZZ` }],
    ] as Array<[string, Record<string, string>]>) {
        assert.equal((await gateway.request(path, { headers })).status, 401, path);
    }
    for (const path of ['/orders', '/orders/claim', '/link-store-customer', '/sessions/revoke']) {
        const result = await gateway.request(atSite(path), { method: path === '/orders' ? 'GET' : 'POST', headers: store, body: path === '/orders' ? undefined : '{}' });
        assert.ok(result.status === 401 || result.status === 403, `${path}: ${result.status}`);
    }
});

test('revocation and disablement are checked afresh before a storefront write', async () => {
    const buyer = seedBuyerAccount(psql, 'lifecycle');
    const headers = await storeHeaders(buyer.id);
    assert.equal((await gateway.request(atSite('/profile'), { headers })).status, 200);
    psql(`UPDATE buyer_accounts SET session_epoch = 2 WHERE id = '${buyer.id}';`);
    assert.equal((await gateway.request(atSite('/profile'), { method: 'PATCH', headers, body: JSON.stringify({ full_name: 'Must not write' }) })).status, 401);
    psql(`UPDATE buyer_accounts SET session_epoch = 1, status = 'disabled' WHERE id = '${buyer.id}';`);
    assert.equal((await gateway.request(atSite('/addresses'), { method: 'POST', headers, body: JSON.stringify(address) })).status, 403);
    assert.equal(psql(`SELECT count(*) FROM buyer_addresses WHERE buyer_account_id = '${buyer.id}';`), '0');
    assert.equal(psql(`SELECT coalesce(full_name, '') FROM buyer_accounts WHERE id = '${buyer.id}';`), '');
});

test('a failed live session read returns a sanitized 503 and writes nothing', async () => {
    const buyer = seedBuyerAccount(psql, 'read-fault');
    const headers = await storeHeaders(buyer.id);
    const tap = tapRest(owned.restEnv().SUPABASE_URL, async (call, forward) => call.resource === 'buyer_accounts'
        ? restJson(503, { message: 'synthetic-private-database-detail' }) : forward());
    try {
        const result = await gateway.request(atSite('/addresses'), { method: 'POST', headers, body: JSON.stringify(address) });
        assert.equal(result.status, 503);
        assert.doesNotMatch(result.text, /synthetic-private-database-detail/);
        assert.ok(tap.calls.some((call) => call.resource === 'buyer_accounts'));
        // Global rate-limit RPCs precede authentication; they are not buyer writes.
        assert.ok(!tap.calls.some((call) => call.resource === 'buyer_addresses'));
        assert.equal(psql(`SELECT count(*) FROM buyer_addresses WHERE buyer_account_id = '${buyer.id}';`), '0');
    } finally { tap.restore(); }
});

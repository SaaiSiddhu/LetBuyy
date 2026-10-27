// Canonical order links, real worker and owned database. No email-based ownership.
// Synthetic ES256 issuer keys; service-role queries are not tenant RLS proof.
import assert from 'node:assert/strict';
import test, { before, afterEach } from 'node:test';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { Gateway, buyerHeaders, gatewayEnv, mintSession, newIdentityKeys, seedBuyerAccount, tapRest, restJson, type IdentityKeys } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant, seedSyntheticOrder } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const { psql } = owned;
const site = newSyntheticTenant('buyer-orders');
const otherSite = newSyntheticTenant('buyer-orders-other');
const base = '/v1/storefront/buyer';
let keys: IdentityKeys;
let gateway: Gateway;
before(async () => {
    keys = await newIdentityKeys();
    seedSyntheticTenant(psql, site, { gst: true });
    seedSyntheticTenant(psql, otherSite, { gst: true });
    gateway = new Gateway(gatewayEnv(owned, keys));
});
afterEach(async () => { await gateway.settle(); });
async function headers(buyerId: string, siteId = site.siteId) {
    return { [LETBUYY_STOREFRONT_SESSION_HEADER]: await mintSession(keys, buyerId, {
        audience: 'letbuyy:storefront-session', tokenUse: 'storefront_session', epoch: 1,
        extraClaims: { site_id: siteId },
    }) };
}
const path = (query = '', siteId = site.siteId) => `${base}/storefront-orders?store_id=${siteId}${query}`;
function linked(buyerId: string, tenant = site) {
    const { orderId } = seedSyntheticOrder(psql, tenant);
    psql(`INSERT INTO buyer_order_links (order_id,buyer_account_id,site_id,link_basis,linked_at)
      VALUES ('${orderId}','${buyerId}','${tenant.siteId}','authenticated_checkout','2026-10-01T10:00:00Z');`);
    return orderId;
}

test('a storefront sees only this buyers verified order links at its own store', async () => {
    const buyer = seedBuyerAccount(psql, 'order-own');
    const outsider = seedBuyerAccount(psql, 'order-other');
    const ownId = linked(buyer.id);
    const elsewhereId = linked(buyer.id, otherSite);
    const foreignId = linked(outsider.id);
    const unlinked = seedSyntheticOrder(psql, site).orderId;
    // Even a matching, verified email is not an explicit order ownership link.
    psql(`UPDATE buyer_accounts SET email='syn-seed-buyer-${site.subdomain}@example.invalid' WHERE id='${buyer.id}';`);
    const result = await gateway.request(path('&buyer_account_id='+outsider.id), { headers: await headers(buyer.id) });
    assert.equal(result.status, 200);
    assert.deepEqual(result.json?.data.orders.map((order: { id: string }) => order.id), [ownId]);
    assert.doesNotMatch(result.text, new RegExp([elsewhereId, foreignId, unlinked].join('|')));
    const platform = await gateway.request(`${base}/orders`, { headers: await buyerHeaders(keys, buyer.id, { epoch: 1 }) });
    assert.equal(platform.status, 200);
    assert.deepEqual(new Set(platform.json?.data.orders.map((order: { id: string }) => order.id)), new Set([ownId, elsewhereId]));
});

test('missing or wrong site/audience and expired, revoked or disabled sessions cannot read orders', async () => {
    const buyer = seedBuyerAccount(psql, 'order-scope');
    const store = await headers(buyer.id);
    for (const [url, auth] of [
        [path('', otherSite.siteId), store],
        [`${base}/storefront-orders`, store],
        [path(), await buyerHeaders(keys, buyer.id, { epoch: 1 })],
        [path(), { [LETBUYY_STOREFRONT_SESSION_HEADER]: await mintSession(keys, buyer.id, { audience: 'letbuyy:storefront-session', tokenUse: 'storefront_session', epoch: 1, extraClaims: { site_id: site.siteId }, expiresInSeconds: -60 }) }],
    ] as Array<[string, Record<string,string>]>) assert.equal((await gateway.request(url, { headers: auth })).status, 401);
    psql(`UPDATE buyer_accounts SET session_epoch=2 WHERE id='${buyer.id}';`);
    assert.equal((await gateway.request(path(), { headers: store })).status, 401);
    psql(`UPDATE buyer_accounts SET session_epoch=1,status='disabled' WHERE id='${buyer.id}';`);
    assert.equal((await gateway.request(path(), { headers: store })).status, 403);
});

test('timestamp ties paginate without omission or duplication for platform and storefront sessions', async () => {
    const buyer = seedBuyerAccount(psql, 'order-ties');
    const ids = [linked(buyer.id), linked(buyer.id), linked(buyer.id)].sort().reverse();
    for (const realm of ['platform', 'storefront']) {
        const auth = realm === 'platform' ? await buyerHeaders(keys, buyer.id, { epoch: 1 }) : await headers(buyer.id);
        let cursor: string | null = null;
        const seen: string[] = [];
        for (let page = 0; page < 3; page++) {
            const query = `&limit=1${cursor ? '&cursor='+encodeURIComponent(cursor) : ''}`;
            const result = await gateway.request(realm === 'platform' ? `${base}/orders?${query.slice(1)}` : path(query), { headers: auth });
            assert.equal(result.status, 200);
            assert.equal(result.json?.data.orders.length, 1, `${realm} page ${page}`);
            seen.push(result.json?.data.orders[0].id);
            cursor = result.json?.data.next_cursor ?? null;
            assert.equal(result.json?.data.has_more, page < 2);
        }
        assert.deepEqual(seen, ids);
        assert.equal(cursor, null);
    }
});

test('malformed cursor is a validation failure, not an unscoped query or a silent first page', async () => {
    const buyer = seedBuyerAccount(psql, 'order-cursor');
    const auth = await headers(buyer.id);
    for (const cursor of ['not-base64', btoa(JSON.stringify({ id: crypto.randomUUID(), value: 'bad,(site_id.not.is.null)' })), btoa(JSON.stringify({ id: 'bad,or', value: '2026-10-01T10:00:00Z' }))]) {
        assert.equal((await gateway.request(path('&cursor='+encodeURIComponent(cursor)), { headers: auth })).status, 400);
    }
});

test('link read failure returns sanitized failure rather than an empty order history', async () => {
    const buyer = seedBuyerAccount(psql, 'order-fault');
    const auth = await headers(buyer.id);
    const tap = tapRest(owned.restUrl, async (call, forward) => call.resource === 'buyer_order_links' ? restJson(503, { message: 'synthetic-private-link-detail' }) : forward());
    try {
        const result = await gateway.request(path(), { headers: auth });
        assert.equal(result.status, 500);
        assert.doesNotMatch(result.text, /synthetic-private-link-detail/);
        assert.ok(tap.calls.some((call) => call.resource === 'buyer_order_links' && call.search.get('site_id') === `eq.${site.siteId}`));
    } finally { tap.restore(); }
});

test('canonical storefront order detail requires this buyer link and this signed site', async () => {
    const buyer = seedBuyerAccount(psql, 'detail-own');
    const otherBuyer = seedBuyerAccount(psql, 'detail-other');
    const ownId = linked(buyer.id);
    const elsewhereId = linked(buyer.id, otherSite);
    const foreignId = linked(otherBuyer.id);
    const unlinkedId = seedSyntheticOrder(psql, site).orderId;
    const auth = await headers(buyer.id);
    const detailPath = (id: string, siteId = site.siteId) => `${base}/storefront-orders/${id}?store_id=${siteId}`;
    const own = await gateway.request(detailPath(ownId), { headers: auth }, { ...gateway.env, ORDER_ITEMS_RELATIONAL_READS: 'off' });
    assert.equal(own.status, 200);
    assert.equal(own.json?.data.order.id, ownId);
    const truth = JSON.parse(psql(`SELECT jsonb_build_object('subtotal',subtotal,'total',total,'tax',tax,'payment_method',payment_method,'shipping_cost',shipping_cost) FROM orders WHERE id='${ownId}';`));
    for (const key of ['subtotal','total','tax','payment_method','shipping_cost']) assert.equal(own.json?.data.order[key], truth[key]);
    assert.equal(own.json?.data.order.items.length, 1);
    for (const id of [elsewhereId, foreignId, unlinkedId, crypto.randomUUID()]) {
        const result = await gateway.request(detailPath(id), { headers: auth });
        assert.equal(result.status, 404);
        assert.doesNotMatch(result.text, /customer_email|shipping_address|subtotal/);
    }
    assert.equal((await gateway.request(detailPath(ownId, otherSite.siteId), { headers: auth })).status, 401);
    assert.equal((await gateway.request(detailPath('not-a-uuid'), { headers: auth })).status, 400);
    const relational = await gateway.request(detailPath(ownId), { headers: auth }, { ...gateway.env, ORDER_ITEMS_RELATIONAL_READS: 'true' });
    assert.equal(relational.status, 200);
    assert.equal(relational.json?.data.order.items.length, 1);
    assert.equal(Object.hasOwn(relational.json?.data.order, 'order_items'), false);
    assert.equal(Object.hasOwn(relational.json?.data.order.items[0], 'product_snapshot'), false);
});

test('the canonical app buyer reads linked details across stores without an email or client-supplied site authority', async () => {
    const buyer = seedBuyerAccount(psql, 'app-detail-own');
    const otherBuyer = seedBuyerAccount(psql, 'app-detail-other');
    const ownIds = [linked(buyer.id), linked(buyer.id, otherSite)];
    const foreignId = linked(otherBuyer.id);
    const unlinkedId = seedSyntheticOrder(psql, site).orderId;
    const auth = await buyerHeaders(keys, buyer.id, { epoch: 1 });
    const list = await gateway.request(`${base}/orders`, { headers: auth });
    assert.equal(list.status, 200);
    assert.deepEqual(new Set(list.json?.data.orders.map((order: { id: string }) => order.id)), new Set(ownIds));
    for (const id of ownIds) {
        const detail = await gateway.request(`${base}/orders/${id}?site_id=${crypto.randomUUID()}&buyer_account_id=${otherBuyer.id}`, { headers: auth });
        assert.equal(detail.status, 200, 'an owned app-list entry must have an owned detail read');
        assert.equal(detail.json?.data.order.id, id);
        assert.equal(detail.json?.data.order.items.length, 1);
        assert.equal(Object.hasOwn(detail.json?.data.order, 'customer_email'), false);
        assert.equal(Object.hasOwn(detail.json?.data.order, 'store_id'), false);
    }
    for (const id of [foreignId, unlinkedId, crypto.randomUUID()]) {
        const result = await gateway.request(`${base}/orders/${id}`, { headers: auth });
        assert.equal(result.status, 404);
        assert.doesNotMatch(result.text, /shipping_address|customer_email|subtotal/);
    }
    assert.equal((await gateway.request(`${base}/orders/not-a-uuid`, { headers: auth })).status, 400);
    assert.equal((await gateway.request(`${base}/orders/${ownIds[0]}`)).status, 401);
    assert.equal((await gateway.request(`${base}/orders/${ownIds[0]}`, { headers: await headers(buyer.id) })).status, 401);
    psql(`DELETE FROM buyer_order_links WHERE buyer_account_id='${buyer.id}' AND order_id='${ownIds[0]}';`);
    assert.equal((await gateway.request(`${base}/orders/${ownIds[0]}`, { headers: auth })).status, 404, 'removing ownership takes effect on the existing session');
    psql(`UPDATE buyer_accounts SET session_epoch=2 WHERE id='${buyer.id}';`);
    assert.equal((await gateway.request(`${base}/orders/${ownIds[1]}`, { headers: auth })).status, 401);
});

test('order detail database failures are sanitized and do not become a misleading 404', async () => {
    const buyer = seedBuyerAccount(psql, 'detail-fault');
    const id = linked(buyer.id);
    const auth = await headers(buyer.id);
    for (const resource of ['buyer_order_links', 'orders', 'order_items']) {
        const tap = tapRest(owned.restUrl, async (call, forward) => call.resource === resource ? restJson(503, { message: 'synthetic-private-detail-fault' }) : forward());
        try {
            const result = await gateway.request(`${base}/storefront-orders/${id}?store_id=${site.siteId}`, { headers: auth }, { ...gateway.env, ORDER_ITEMS_RELATIONAL_READS: 'true' });
            assert.equal(result.status, 500, resource);
            assert.doesNotMatch(result.text, /synthetic-private-detail-fault/);
            assert.ok(tap.calls.some((call) => call.resource === resource));
        } finally { tap.restore(); }
    }
});

test('saved coupon and exact receipt totals reach only the linked buyer list and detail', async () => {
    const buyer=seedBuyerAccount(psql,'saved-coupon-reader');const outsider=seedBuyerAccount(psql,'saved-coupon-outsider');
    const orderId=linked(buyer.id);
    psql(`UPDATE orders SET coupon_code='SAVED10',coupon_discount=19.9,discount=19.9,subtotal=199,shipping_cost=20,tax=35.82,total=234.92 WHERE id='${orderId}' AND site_id='${site.siteId}';`);
    const auth=await headers(buyer.id);
    const detail=await gateway.request(`${base}/storefront-orders/${orderId}?store_id=${site.siteId}`,{headers:auth});assert.equal(detail.status,200);
    const saved=detail.json?.data.order;assert.equal(saved.coupon_code,'SAVED10');assert.equal(Number(saved.discount),19.9);assert.equal(Number(saved.coupon_discount),19.9);assert.equal(Number(saved.total),234.92);
    const list=await gateway.request(path(),{headers:auth});assert.equal(list.status,200);const summary=list.json?.data.orders.find((row:{id:string})=>row.id===orderId);
    assert.equal(summary.coupon_code,'SAVED10');assert.equal(Number(summary.discount),19.9);assert.equal(Number(summary.total),234.92);
    const denied=await gateway.request(`${base}/storefront-orders/${orderId}?store_id=${site.siteId}`,{headers:await headers(outsider.id)});assert.equal(denied.status,404);assert.doesNotMatch(JSON.stringify(denied.json),/SAVED10|234.92/);
});

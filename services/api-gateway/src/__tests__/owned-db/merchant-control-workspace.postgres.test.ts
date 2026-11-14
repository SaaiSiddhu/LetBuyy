import assert from 'node:assert/strict';
import test from 'node:test';
import {
    requireOwnedDatabase,
    startOwnedPooledSqlProxy,
} from './owned-db-support';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { consoleFixture } from './console-session-fixture';
import {
    newSyntheticTenant,
    seedSyntheticTenant,
    seedSyntheticOrder,
} from './synthetic-tenant';
import { tapRest, restJson, signedIdentityHeaders } from './gateway-harness';
import type { Env } from '../../index';
const owned = requireOwnedDatabase();
async function fixture() {
    const f = await consoleFixture(owned),
        actor = await f.actor('viewer');
    const tag = crypto.randomUUID().slice(0, 8);
    const a = newSyntheticTenant('ctl-' + tag + '-a'),
        b = newSyntheticTenant('ctl-' + tag + '-b');
    seedSyntheticTenant(owned.psql, a);
    seedSyntheticTenant(owned.psql, b);
    const first = seedSyntheticOrder(owned.psql, a),
        second = seedSyntheticOrder(owned.psql, a),
        foreign = seedSyntheticOrder(owned.psql, b);
    const owner = crypto.randomUUID(),
        email = `syn-owner-${owner}@example.invalid`;
    owned.psql(
        `INSERT INTO users_custom(id,email,email_verified)VALUES('${owner}','${email}',true);UPDATE sites SET custom_user_id='${owner}'WHERE id='${a.siteId}';`,
    );
    const base = `/v1/internal/console/merchants/${a.siteId}/operations`;
    const get = (path = '') =>
        f.gateway.request(base + path, { headers: actor.headers });
    return { f, actor, a, b, first, second, foreign, owner, email, base, get };
}
test('viewer reads exact merchant counts, persisted SaaS limits and honest KYC mode without PII or private files', async () => {
    const j = await fixture();
    owned.psql(`INSERT INTO merchant_kyc_documents(site_id,document_type,status,provider_mode,file_url,metadata)
        VALUES('${j.a.siteId}','business_pan','needs_review','sandbox','https://private.invalid/synthetic-file','{"private_note":"SYNTHETIC-PRIVATE"}');
        INSERT INTO site_usage_meters(site_id,meter_name,period_start,period_end,quantity,limit_quantity)
        VALUES('${j.a.siteId}','products',now()-interval '1 day',now()+interval '1 day',2,5);`);
    const r = await j.get();
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json?.data.counts.products, 2);
    assert.equal(r.json?.data.counts.orders, 2);
    assert.equal(r.json?.data.saas.authority, 'persisted');
    assert.equal(r.json?.data.verification[0].status, 'needs_review');
    assert.equal(r.json?.data.verification[0].provider_mode, 'sandbox');
    assert.equal(r.json?.data.usage.length, 1);
    assert.doesNotMatch(
        r.text,
        /private\.invalid|SYNTHETIC-PRIVATE|requester_email|customer_email|shipping_address|syn-owner-/,
    );
    assert.ok(
        owned.psql(
            `SELECT count(*) FROM audit_logs WHERE resource_id='${j.a.siteId}' AND action='merchant.operations.read';`,
        ) !== '0',
    );
});
test('catalog and orders are separately paginated, filtered, stable and bound to the path site', async () => {
    const j = await fixture();
    const one = await j.get('/products?limit=1');
    assert.equal(one.status, 200, one.text);
    assert.equal(one.json?.meta.total, 2);
    assert.equal(one.json?.data.length, 1);
    const two = await j.get('/products?limit=1&page=2');
    assert.equal(two.status, 200, two.text);
    assert.notEqual(one.json?.data[0].id, two.json?.data[0].id);
    owned.psql(
        `UPDATE products SET name='Synthetic special filter',status='archived'WHERE id='${j.first.productId}';`,
    );
    const filtered = await j.get(
        '/products?q=special&status=archived&site_id=' + j.b.siteId,
    );
    assert.equal(filtered.status, 200, filtered.text);
    assert.equal(filtered.json?.data.length, 1);
    assert.equal(filtered.json?.data[0].id, j.first.productId);
    const orders = await j.get('/orders?limit=1');
    assert.equal(orders.status, 200, orders.text);
    assert.equal(orders.json?.meta.total, 2);
    assert.doesNotMatch(
        orders.text,
        /customer_email|customer_phone|shipping_address|syn-seed-buyer/,
    );
    const forged = await j.get('/orders/' + j.foreign.orderId);
    assert.equal(forged.status, 404, forged.text);
    assert.equal((await j.get('/products?limit=51')).status, 400);
});
test('owner catalog edit reaches Console while historical order evidence remains unchanged', async (t) => {
    const j = await fixture(),
        before = await j.get('/orders/' + j.first.orderId);
    const proxy = await startOwnedPooledSqlProxy(owned);
    t.after(async () => {
        await closePooledSqlClients();
        await proxy.stop();
    });
    assert.equal(before.status, 200, before.text);
    assert.equal(before.json?.data.items.length, 1);
    assert.equal(before.json?.data.items[0].name, 'Synthetic Seed Product');
    assert.equal(before.json?.data.items[0].unit_price, 199);
    assert.equal(before.json?.data.items[0].total, 199);
    const version = owned.psql(
        `SELECT version FROM products WHERE id='${j.first.productId}';`,
    );
    const key = crypto.randomUUID();
    const edit = await j.f.gateway.request(
        '/v1/products/' + j.first.productId,
        {
            method: 'PATCH',
            headers: {
                ...(await signedIdentityHeaders(j.owner, j.email, j.a.siteId)),
                'Idempotency-Key': key,
            },
            body: JSON.stringify({
                name: 'Synthetic owner edited product',
                version: Number(version),
                idempotency_key: key,
            }),
        },
        // The owned TCP proxy supplies only the connection string consumed by
        // the real pooled SQL adapter, rather than a Cloudflare binding object.
        { ...j.f.gateway.env, ...proxy.env() } as unknown as Env,
    );
    assert.equal(edit.status, 200, edit.text);
    const catalog = await j.get('/products?q=owner%20edited');
    assert.equal(catalog.status, 200, catalog.text);
    assert.equal(catalog.json?.data[0].name, 'Synthetic owner edited product');
    const after = await j.get('/orders/' + j.first.orderId);
    assert.equal(after.status, 200, after.text);
    assert.deepEqual(after.json?.data, before.json?.data);
});
test('source failure remains unavailable, mandatory audit failure denies disclosure, and no write endpoint exists', async () => {
    const j = await fixture();
    let tap = tapRest(owned.restUrl, async (call, forward) =>
        ['rpc/resolve_site_entitlements', 'site_usage_meters'].includes(
            call.resource,
        )
            ? restJson(503, { message: 'synthetic outage' })
            : forward(),
    );
    try {
        const r = await j.get();
        assert.equal(r.status, 200, r.text);
        assert.equal(r.json?.data.saas.authority, 'unavailable');
        assert.ok(r.json?.data.unavailable.includes('usage'));
        assert.equal(r.json?.data.counts.products, 2);
    } finally {
        tap.restore();
    }
    tap = tapRest(owned.restUrl, async (call, forward) =>
        call.resource === 'products'
            ? restJson(503, { message: 'synthetic outage' })
            : forward(),
    );
    try {
        assert.equal((await j.get('/products')).status, 503);
    } finally {
        tap.restore();
    }
    tap = tapRest(owned.restUrl, async (call, forward) =>
        call.resource === 'audit_logs' && call.method === 'POST'
            ? restJson(503, { message: 'synthetic audit outage' })
            : forward(),
    );
    try {
        const r = await j.get('/orders/' + j.first.orderId);
        assert.equal(r.status, 503, r.text);
        assert.doesNotMatch(r.text, /Synthetic Seed Product/);
    } finally {
        tap.restore();
    }
    const post = await j.f.gateway.request(j.base + '/products', {
        method: 'POST',
        headers: j.actor.headers,
        body: JSON.stringify({ name: 'Not allowed' }),
    });
    assert.ok([401, 403, 404, 405].includes(post.status), post.text);
});
test('a transport token, merchant identity or revoked operator cookie cannot read merchant operations', async () => {
    const j = await fixture();
    assert.equal((await j.get()).status, 200);
    const missing = await j.f.gateway.request(j.base, {
        headers: { Authorization: j.actor.headers.Authorization },
    });
    assert.equal(missing.status, 401, missing.text);
    const merchant = await j.f.gateway.request(j.base, {
        headers: await signedIdentityHeaders(j.owner, j.email, j.a.siteId),
    });
    assert.equal(merchant.status, 401, merchant.text);
    owned.psql(
        `UPDATE employees SET is_active=false WHERE user_id='${j.actor.id}';`,
    );
    const revoked = await j.get();
    assert.ok([401, 403].includes(revoked.status), revoked.text);
});

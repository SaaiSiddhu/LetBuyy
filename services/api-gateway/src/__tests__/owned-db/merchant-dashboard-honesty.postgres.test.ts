import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase(), site = newSyntheticTenant('mobile-dashboard');
const actor = crypto.randomUUID(), email = `syn-dashboard-${actor}@example.invalid`;
const productId = crypto.randomUUID();
let gateway: Gateway;
before(async () => {
    seedSyntheticTenant(owned.psql, site);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actor}','${email}',true);
        UPDATE sites SET custom_user_id='${actor}' WHERE id='${site.siteId}';
        INSERT INTO products(id,store_id,name,price,status,deleted_at) VALUES
          ('${productId}','${site.siteId}','Synthetic active',150.75,'active',null),
          (gen_random_uuid(),'${site.siteId}','Synthetic removed',10,'active',now());
        INSERT INTO store_customers(store_id,email,full_name,status,deleted_at) VALUES
          ('${site.siteId}','syn-first@example.invalid','Synthetic first','active',null),
          ('${site.siteId}','syn-second@example.invalid','Synthetic second','disabled',null),
          ('${site.siteId}','syn-removed@example.invalid','Synthetic removed','active',now());
        INSERT INTO analytics_rollups_daily(site_id,metric_name,rollup_date,metric_value) VALUES
          ('${site.siteId}','orders.created',CURRENT_DATE,3),
          ('${site.siteId}','orders.paid',CURRENT_DATE,1),
          ('${site.siteId}','revenue.paid_minor',CURRENT_DATE,15075),
          ('${site.siteId}','orders.created',CURRENT_DATE-40,2),
          ('${site.siteId}','revenue.paid_minor',CURRENT_DATE-40,10025);
        INSERT INTO analytics_rollups_daily(site_id,metric_name,rollup_date,dimensions,metric_value) VALUES
          ('${site.siteId}','product.units_sold',CURRENT_DATE,'{"product_id":"${productId}","product_name":"Synthetic active"}',1),
          ('${site.siteId}','product.revenue_minor',CURRENT_DATE,'{"product_id":"${productId}","product_name":"Synthetic active"}',15075);`);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
});
after(async () => { await gateway?.settle(); });
async function dashboard(projection = true) {
    return gateway.request(`/v1/analytics/dashboard?store_id=${site.siteId}&period=30d`, {
        headers: { ...await signedIdentityHeaders(actor, email, site.siteId), 'X-Store-ID': site.siteId },
    }, { ...gateway.env, ANALYTICS_PROJECTION_READS: projection ? 'on' : 'off' });
}

test('rollup dashboard preserves paise and counts canonical, nondeleted customer records', async () => {
    const response = await dashboard();
    assert.equal(response.status, 200, response.text);
    assert.equal(response.json?.data.summary.revenue.value, 150.75);
    assert.equal(response.json?.data.summary.avg_order_value, 50.25);
    assert.equal(response.json?.data.summary.orders.value, 3);
    assert.equal(response.json?.data.summary.customers, 2);
    assert.equal(response.json?.data.summary.products, 1);
    const top = await gateway.request(`/v1/analytics/top-products?store_id=${site.siteId}`, {
        headers: { ...await signedIdentityHeaders(actor, email, site.siteId), 'X-Store-ID': site.siteId },
    });
    assert.equal(top.status, 200, top.text);
    assert.equal(top.json?.data[0].revenue, 150.75);
});

test('a failed order read cannot become a successful zero-revenue dashboard', async () => {
    const tap = tapRest(owned.restUrl, async (call, forward) => call.resource === 'orders' && call.method === 'GET'
        ? Response.json({ code: 'XX000', message: 'synthetic private order failure' }, { status: 500 }) : forward());
    try {
        const response = await dashboard(false);
        assert.equal(response.status, 503, response.text);
        assert.equal(response.json?.error.code, 'ANALYTICS_UNAVAILABLE');
        assert.equal(response.json?.data, undefined);
        assert.doesNotMatch(response.text, /synthetic private order failure|XX000/);
    } finally { tap.restore(); }
});

test('failed mandatory entity counts stay unavailable in projected and live reads', async () => {
    for (const resource of ['products', 'store_customers']) {
        for (const projection of [true, false]) {
            const tap = tapRest(owned.restUrl, async (call, forward) => call.resource === resource && call.method === 'HEAD'
                ? Response.json({ code: 'XX000', message: 'synthetic private count failure' }, { status: 500 }) : forward());
            try {
                const response = await dashboard(projection);
                assert.equal(response.status, 503, `${resource}/${projection}: ${response.text}`);
                assert.equal(response.json?.error.code, 'ANALYTICS_UNAVAILABLE');
                assert.doesNotMatch(response.text, /synthetic private count failure|XX000/);
            } finally { tap.restore(); }
        }
    }
});

test('a successful empty live order query still reports an observed zero', async () => {
    const response = await dashboard(false);
    assert.equal(response.status, 200, response.text);
    assert.equal(response.json?.data.summary.revenue.value, 0);
    assert.equal(response.json?.data.summary.orders.value, 0);
    assert.equal(response.json?.data.summary.avg_order_value, 0);
    assert.equal(response.json?.data.summary.customers, 2);
});

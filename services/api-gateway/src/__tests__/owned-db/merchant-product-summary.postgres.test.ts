import assert from 'node:assert/strict';
import test, { afterEach, before } from 'node:test';
import { performance } from 'node:perf_hooks';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest, passThrough } from './gateway-harness';

const owned = requireOwnedDatabase();
const owner = crypto.randomUUID(), stranger = crypto.randomUUID(), store = crypto.randomUUID();
const ownerEmail = `syn-summary-${owner}@example.invalid`;
const strangerEmail = `syn-summary-${stranger}@example.invalid`;
let gateway: Gateway;

before(async () => {
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
    owned.psql(`INSERT INTO users_custom (id,email,email_verified) VALUES
      ('${owner}','${ownerEmail}',true),('${stranger}','${strangerEmail}',true);
      INSERT INTO sites (id,name,store_name,site_type,subdomain,custom_user_id)
      VALUES ('${store}','Synthetic summary','Synthetic summary','store','syn-summary-${store.slice(0,8)}','${owner}');
      INSERT INTO products (id,store_id,name,description,price,stock,is_active,status,created_at,display_order)
      SELECT gen_random_uuid(),'${store}','Synthetic product '||n,repeat('Synthetic editor content ',200),100+n,12,true,'active',now()-n*interval '1 second',n
      FROM generate_series(1,103) n;
      INSERT INTO product_variants (id,product_id,title,price,inventory_qty,position)
      SELECT gen_random_uuid(),p.id,'Synthetic variant '||n,p.price+n,3,n
      FROM products p CROSS JOIN generate_series(1,12) n WHERE p.store_id='${store}';`);
});
afterEach(async () => { await gateway.settle(); });

test('compact merchant rows omit editor content and variant work while full reads remain compatible', async () => {
    const tap = tapRest(owned.restUrl, passThrough);
    const measurements: Array<{ view: string; milliseconds: number; bytes: number; variantReads: number }> = [];
    try {
        for (const view of ['full', 'summary', 'summary', 'full']) {
            const start = tap.calls.length, started = performance.now();
            const response = await gateway.request(`/v1/products?store_id=${store}&limit=100&sort=created_at&order=desc&view=${view}`, { headers: await signedIdentityHeaders(owner, ownerEmail) });
            assert.equal(response.status, 200, response.text);
            assert.equal(response.json?.data.length, 100);
            assert.ok(response.json?.meta?.has_next, response.text.slice(0,300));
            const row = response.json!.data[0];
            assert.equal(row.name, 'Synthetic product 1');
            assert.ok(Number.isInteger(row.version) && row.version > 0);
            const calls = tap.calls.slice(start);
            const variantReads = calls.filter(call => call.resource === 'product_variants').length;
            const projection = calls.find(call => call.resource === 'products')!.search.get('select')!;
            if (view === 'summary') {
                for (const field of ['description','metadata','variants','product_variants','seo_description']) assert.equal(field in row, false, field);
                assert.equal(variantReads, 0);
                assert.ok(!projection.split(',').includes('description'));
            } else {
                assert.equal(row.variants.length, 12);
                assert.equal(variantReads, 3);
                assert.ok(row.description.length > 1000);
            }
            measurements.push({ view, milliseconds: Math.round((performance.now()-started)*10)/10, bytes: Buffer.byteLength(response.text), variantReads });
        }
        assert.ok(measurements[1].bytes < measurements[0].bytes / 4, JSON.stringify(measurements));
        console.log('MERCHANT_SUMMARY_OWNED_EVIDENCE', JSON.stringify({ products:103, variantsPerProduct:12, measurements }));
        const second = await gateway.request(`/v1/products?store_id=${store}&limit=100&page=2&sort=created_at&order=desc&view=summary`, { headers: await signedIdentityHeaders(owner, ownerEmail) });
        assert.equal(second.status,200,second.text);
        assert.equal(second.json?.data.length,3);
        assert.equal(second.json?.data[0].name,'Synthetic product 101');
    } finally { tap.restore(); }
});

test('compact reads retain live authorization and bounded validation', async () => {
    for (const view of ['full','summary']) {
        const denied = await gateway.request(`/v1/products?store_id=${store}&view=${view}`, { headers: await signedIdentityHeaders(stranger,strangerEmail) });
        assert.ok([403,404].includes(denied.status),denied.text);
        assert.ok(!denied.text.includes('Synthetic product'));
    }
    for (const query of ['view=anything','limit=200&view=summary']) {
        const invalid = await gateway.request(`/v1/products?store_id=${store}&${query}`, { headers: await signedIdentityHeaders(owner,ownerEmail) });
        assert.equal(invalid.status,400,invalid.text);
    }
});

test('AI Studio reads the canonical credit schema without inventing a future reset', async () => {
    owned.psql(`INSERT INTO ai_credits (store_id,plan_credits,bonus_credits,total_purchased) VALUES ('${store}',100,5,0);
      INSERT INTO ai_usage (store_id,feature,credits_used,status) VALUES ('${store}','custom',7,'completed'),('${store}','custom',9,'failed');`);
    const response = await gateway.request(`/v1/ai/credits?store_id=${store}`, { headers: await signedIdentityHeaders(owner,ownerEmail) });
    assert.equal(response.status,200,response.text);
    assert.equal(response.json?.data.balance,98);
    assert.equal(response.json?.data.total_used,7);
    assert.equal(response.json?.data.reset_at,null);
});

test('operations uses bounded count responses beyond REST row caps with real persisted status names', async () => {
    const source = crypto.randomUUID(), destination = crypto.randomUUID();
    owned.psql(`INSERT INTO inventory_locations (id,store_id,name,is_default) VALUES
      ('${source}','${store}','Synthetic source',true),('${destination}','${store}','Synthetic destination',false);
      INSERT INTO products (id,store_id,name,price,stock,is_active,status)
      SELECT gen_random_uuid(),'${store}','Synthetic count product '||n,10,5,true,'active' FROM generate_series(1,1005) n;
      INSERT INTO inventory_levels (store_id,product_id,location_id,available)
      SELECT '${store}',id,'${source}',5 FROM products WHERE store_id='${store}';
      INSERT INTO purchase_orders (site_id,po_number,status,idempotency_key,deleted_at)
      SELECT '${store}','SYN-PO-'||n,CASE WHEN n<=1100 THEN 'partially_received' WHEN n<=1103 THEN 'received' ELSE 'ordered' END,
      'syn-po-'||gen_random_uuid(),CASE WHEN n>1103 THEN now() END FROM generate_series(1,1105) n;
      INSERT INTO inventory_transfers (site_id,transfer_number,source_location_id,destination_location_id,status,idempotency_key,deleted_at)
      SELECT '${store}','SYN-TR-'||n,'${source}','${destination}',CASE WHEN n<=1100 THEN 'shipped' ELSE 'received' END,
      'syn-tr-'||gen_random_uuid(),CASE WHEN n>1103 THEN now() END FROM generate_series(1,1105) n;`);
    const counts = new Set(['orders','purchase_orders','inventory_transfers','inventory_levels','products']);
    const arrived = new Set<string>();
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if (counts.has(call.resource)) {
            arrived.add(call.resource);
            if (arrived.size === counts.size) release();
            await Promise.race([barrier, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('independent metric reads were serialized')),5000))]);
        }
        return forward();
    });
    try {
        const response = await gateway.request(`/v1/commerce-analytics/operations-summary?store_id=${store}`, { headers: await signedIdentityHeaders(owner,ownerEmail) });
        assert.equal(response.status,200,response.text);
        assert.deepEqual(response.json?.data, { order_count:0,open_order_count:0,po_count:1103,open_po_count:1100,transfer_count:1103,in_transit_transfer_count:1100,low_stock_sku_count:1108,total_sku_count:1108 });
        const metricCalls = tap.calls.filter(call => counts.has(call.resource));
        assert.equal(metricCalls.length,8);
        assert.ok(metricCalls.every(call => call.method === 'HEAD'),JSON.stringify(metricCalls));
        const denied = await gateway.request(`/v1/commerce-analytics/operations-summary?store_id=${store}`, { headers: await signedIdentityHeaders(stranger,strangerEmail) });
        assert.ok([403,404].includes(denied.status),denied.text);
        assert.equal(tap.calls.filter(call => counts.has(call.resource)).length,8,'foreign scope must not run metric queries');
        const expectedLevels = JSON.parse(owned.psql(`SELECT json_agg(id ORDER BY available,id) FROM inventory_levels WHERE store_id='${store}'`)) as string[];
        const traversed: string[] = [];
        for (const page of [1,2]) {
            const levels = await gateway.request(`/v1/inventory/levels?store_id=${store}&limit=100&page=${page}`, { headers: await signedIdentityHeaders(owner,ownerEmail) });
            assert.equal(levels.status,200,levels.text);
            assert.equal(levels.json?.meta.total,1108);
            assert.equal(levels.json?.data.length,100);
            traversed.push(...levels.json!.data.map((row: { id: string }) => row.id));
        }
        assert.deepEqual(traversed,expectedLevels.slice(0,200),'equal stock quantities must still have stable unique ordering');
        assert.equal(new Set(traversed).size,200);
        const empty = await gateway.request(`/v1/inventory/levels?store_id=${store}&limit=100&page=13`, { headers: await signedIdentityHeaders(owner,ownerEmail) });
        assert.equal(empty.status,200,empty.text);
        assert.deepEqual(empty.json?.data,[],'a past-end level page must not switch to legacy product-stock rows');
        assert.equal(empty.json?.meta.total,1108);

    } finally { release(); tap.restore(); }
});

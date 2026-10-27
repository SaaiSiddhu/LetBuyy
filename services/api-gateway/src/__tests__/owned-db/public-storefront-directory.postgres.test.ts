// Actual anonymous Gateway -> service-only RPC -> owned Postgres. No live accounts or RLS claim.
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { StorefrontDirectoryPayloadSchema } from '@letbuyy/shared-types';
import { Gateway, gatewayEnv, newIdentityKeys } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const first = newSyntheticTenant('dir-first'), second = newSyntheticTenant('dir-second');
const hidden = ['draft', 'password', 'preview', 'offline', 'deleted', 'unpublished'].map(tag => newSyntheticTenant('dir-' + tag));
let gateway: Gateway;
before(async () => {
    for (const tenant of [first, second, ...hidden]) seedSyntheticTenant(owned.psql, tenant);
    const owner = randomUUID();
    owned.psql(`INSERT INTO users_custom(id,email,full_name,email_verified)
        VALUES('${owner}','private-directory-owner@example.invalid','Private directory owner',true);
        UPDATE sites SET custom_user_id='${owner}',template_config='{"private_note":"synthetic-private-directory-note"}'
            WHERE id='${first.siteId}';
        UPDATE sites SET published_at='2026-10-27T00:00:00Z' WHERE id='${first.siteId}';
        UPDATE sites SET published_at='2026-10-26T00:00:00Z',store_name='${hidden[1].subdomain}' WHERE id='${second.siteId}';
        UPDATE sites SET status='draft' WHERE id='${hidden[0].siteId}';
        UPDATE sites SET access_mode='password' WHERE id='${hidden[1].siteId}';
        UPDATE sites SET access_mode='preview_only' WHERE id='${hidden[2].siteId}';
        UPDATE sites SET access_mode='offline' WHERE id='${hidden[3].siteId}';
        UPDATE sites SET deleted_at=now() WHERE id='${hidden[4].siteId}';
        UPDATE sites SET published=false WHERE id='${hidden[5].siteId}';
        INSERT INTO products(store_id,name,price,stock,is_active,status)
        VALUES('${first.siteId}','Synthetic public directory product',10,2,true,'active'),
              ('${first.siteId}','Synthetic draft product',10,2,true,'draft'),
              ('${hidden[1].siteId}','Synthetic private directory product',10,2,true,'active');
        INSERT INTO orders(store_id,site_id,customer_email,shipping_address,items,subtotal,total,status,deleted_at)
        VALUES('${first.siteId}','${first.siteId}','synthetic-directory@example.invalid','{}','[]',100,100,'delivered',NULL),
              ('${first.siteId}','${first.siteId}','synthetic-directory@example.invalid','{}','[]',100,100,'pending',NULL),
              ('${hidden[1].siteId}','${hidden[1].siteId}','synthetic-directory@example.invalid','{}','[]',100,100,'delivered',NULL),
              ('${first.siteId}','${first.siteId}','synthetic-directory@example.invalid','{}','[]',100,100,'delivered',now());`);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
});
after(async () => gateway.settle());

test('positive control: the actual anonymous directory returns public launches, actual counts and no account/config data', async () => {
    const response = await gateway.request('/v1/storefront/directory');
    assert.equal(response.status, 200, response.text);
    const body = StorefrontDirectoryPayloadSchema.parse(response.json!.data);
    assert.deepEqual(body.stores.map(site => site.subdomain), [first.subdomain, second.subdomain]);
    assert.equal(body.stats.totalStores, 2);
    assert.equal(body.stats.totalThemes, 10);
    assert.equal(body.stats.totalProducts, 1);
    assert.equal(body.stats.totalOrders, 1);
    assert.equal(body.stats.scope, 'public_stores');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(response.text, /private-directory-owner|Private directory owner|synthetic-private-directory-note|template_config|access_password/);
    for (const tenant of hidden) assert.ok(!response.text.includes(tenant.subdomain));
});

test('cursor pages are stable and bounded; a merchant becoming private is removed on the next read', async () => {
    const response = await gateway.request('/v1/storefront/directory?limit=1');
    assert.equal(response.status, 200, response.text);
    const page = StorefrontDirectoryPayloadSchema.parse(response.json!.data);
    assert.equal(page.stores.length, 1);
    assert.equal(page.stores[0].subdomain, first.subdomain);
    assert.equal(page.pagination.has_more, true);
    assert.ok(page.pagination.next_cursor);
    const next = await gateway.request('/v1/storefront/directory?limit=1&cursor=' + encodeURIComponent(page.pagination.next_cursor));
    assert.equal(next.status, 200, next.text);
    assert.deepEqual(next.json!.data.stores.map((site: { subdomain: string }) => site.subdomain), [second.subdomain]);
    assert.equal(next.json!.data.pagination.has_more, false);
    owned.psql(`UPDATE sites SET access_mode='password' WHERE id='${second.siteId}';`);
    try {
        const revoked = await gateway.request('/v1/storefront/directory');
        assert.equal(revoked.status, 200, revoked.text);
        assert.equal(revoked.json!.data.stats.totalStores, 1);
        assert.ok(!revoked.text.includes(second.subdomain));
    } finally { owned.psql(`UPDATE sites SET access_mode='public' WHERE id='${second.siteId}';`); }
});

test('the actual public finder resolves a live handle and refuses every hidden store or unknown handle', async () => {
    const found=await gateway.request('/v1/storefront/lookup?q='+first.subdomain);
    assert.equal(found.status,200,found.text);assert.equal(found.json!.data.store.subdomain,first.subdomain);
    assert.equal(found.headers.get('cache-control'),'no-store');
    for(const handle of [...hidden.map(t=>t.subdomain),'synthetic-unknown-store']){
        const response=await gateway.request('/v1/storefront/lookup?q='+handle);
        assert.equal(response.status,200,response.text);assert.equal(response.json!.data.status,'not_found');
        assert.equal(response.json!.data.store,undefined);
    }
});

test('oversized pages, arbitrary query keys and malformed/forged cursor shapes fail before the public SQL read', async () => {
    for (const query of ['limit=25', 'limit=0', 'limit=no', 'include_private=true', 'cursor=not-json',
        'cursor=' + encodeURIComponent(btoa(JSON.stringify({ id: first.siteId, value: 'not-a-date' })))]) {
        const response = await gateway.request('/v1/storefront/directory?' + query);
        assert.equal(response.status, 400, response.text);
    }
});

test('only service role can call the fixed public projection directly; invalid RPC pages are refused', () => {
    for (const role of ['anon', 'authenticated']) {
        assert.match(owned.psqlExpectError(`SET ROLE ${role}; SELECT public.public_storefront_directory_v1();`), /permission denied/);
    }
    assert.equal(owned.psql(`SELECT has_function_privilege('service_role','public.public_storefront_directory_v1(integer,timestamptz,uuid)','execute');`), 't');
    assert.match(owned.psqlExpectError(`SELECT public.public_storefront_directory_v1(25);`), /Invalid directory page/);
    assert.match(owned.psqlExpectError(`SELECT public.public_storefront_directory_v1(1,now(),NULL);`), /Invalid directory page/);
});

test('paired DOWN/UP restores the projection/default without changing existing merchant data', () => {
    const before = owned.psql(`SELECT md5(jsonb_agg(to_jsonb(s) ORDER BY id)::text) FROM sites s;`);
    const down = readFileSync(new URL('../../../../../database/supabase/rollback/398_public_storefront_directory.rollback.sql', import.meta.url), 'utf8');
    const up = readFileSync(new URL('../../../../../database/supabase/migrations/398_public_storefront_directory.sql', import.meta.url), 'utf8');
    owned.script(`BEGIN;
        ${down}
        DO $$ BEGIN IF to_regprocedure('public.public_storefront_directory_v1(integer,timestamptz,uuid)') IS NOT NULL THEN RAISE EXCEPTION 'DOWN did not remove projection'; END IF; END $$;
        ${up}
        DO $$ BEGIN IF to_regprocedure('public.public_storefront_directory_v1(integer,timestamptz,uuid)') IS NULL THEN RAISE EXCEPTION 'UP did not restore projection'; END IF; END $$;
        ROLLBACK;`);
    assert.equal(owned.psql(`SELECT md5(jsonb_agg(to_jsonb(s) ORDER BY id)::text) FROM sites s;`), before);
    assert.equal(owned.psql(`SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.sites'::regclass AND a.attname='theme_id';`), "'letbuyy-forge'::text");
});

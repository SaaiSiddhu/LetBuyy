// Real public Gateway -> PostgREST -> fully migrated owned Postgres. No auth bypass/RLS claim:
// the public feed intentionally crosses sellers through its fixed public SECURITY DEFINER RPC.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach, before } from 'node:test';
import { Gateway, gatewayEnv, newIdentityKeys } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant, type SyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const { psql, script } = owned;
const seller = newSyntheticTenant('seller-feed');
const other = newSyntheticTenant('seller-other');
const unpublished = newSyntheticTenant('seller-unpublished');
const deletedSite = newSyntheticTenant('seller-deleted');
const category = crypto.randomUUID();
const reviewer = crypto.randomUUID();
const signature = 'public.marketplace_feed(text,text,integer,timestamp with time zone,uuid,text,uuid)';
let gateway: Gateway;
type FeedCursor = { after_approved_at: string; after_id: string };
let visible: string[];
let material: { listing: string; product: string };

function seedListings(tenant: SyntheticTenant, count: number, prefix: string, visibility = 'public', approve = true) {
    const rows = Array.from({ length: count }, () => ({ listing: crypto.randomUUID(), product: crypto.randomUUID() }));
    script(rows.map((row, index) => `
      INSERT INTO products(id,site_id,store_id,name,slug,description,price,images,stock,is_active,status,country_of_origin)
        VALUES('${row.product}','${tenant.siteId}','${tenant.siteId}','Synthetic ${prefix} ${index}','syn-${row.product}',
          'Synthetic seller feed fixture',100,ARRAY[]::text[],5,true,'active','India');
      INSERT INTO channel_listings(id,site_id,product_id,channel,marketplace_category_id,visibility)
        VALUES('${row.listing}','${tenant.siteId}','${row.product}','marketplace','${category}','${visibility}');
      BEGIN;
      SELECT set_config('app.site_id','${tenant.siteId}',true);
      SELECT * FROM transition_channel_listing('${tenant.siteId}','${row.listing}','pending_review','merchant','${reviewer}',NULL,'submit-${row.listing}');
      COMMIT;
      ${approve ? `SELECT * FROM claim_marketplace_listing_review('${tenant.siteId}','${row.listing}','${reviewer}',
        'Synthetic review claim.','claim-${row.listing}',(SELECT version FROM channel_listings WHERE id='${row.listing}'));
      SELECT * FROM transition_channel_listing('${tenant.siteId}','${row.listing}','approved','operator','${reviewer}',NULL,'approve-${row.listing}');` : ''}
    `).join('\n'));
    return rows;
}

before(async () => {
    for (const tenant of [seller, other, unpublished, deletedSite]) seedSyntheticTenant(psql, tenant);
    psql(`INSERT INTO marketplace_categories(id,slug,name,is_active) VALUES('${category}','seller-fixture','Synthetic seller category',true);`);
    visible = seedListings(seller, 3, 'seller product').map((row) => row.listing);
    // Later approvals by another seller fill the first *global* page completely.
    seedListings(other, 101, 'other seller');
    seedListings(seller, 1, 'private hidden', 'hidden');
    seedListings(seller, 1, 'pending', 'public', false);
    const inactive = seedListings(seller, 1, 'inactive')[0];
    psql(`UPDATE products SET is_active=false WHERE id='${inactive.product}';`);
    const deletedProduct = seedListings(seller, 1, 'deleted product')[0];
    psql(`UPDATE products SET deleted_at=now() WHERE id='${deletedProduct.product}';`);
    const rejected = seedListings(seller, 1, 'rejected', 'public', false)[0];
    psql(`SELECT * FROM claim_marketplace_listing_review('${seller.siteId}','${rejected.listing}','${reviewer}',
      'Synthetic rejection review.','claim-rejected-${rejected.listing}',(SELECT version FROM channel_listings WHERE id='${rejected.listing}'));
      SELECT * FROM transition_channel_listing('${seller.siteId}','${rejected.listing}','rejected','operator','${reviewer}',
        'Synthetic product rejected.','reject-${rejected.listing}');`);
    seedListings(deletedSite, 1, 'deleted site');
    psql(`UPDATE sites SET deleted_at=now() WHERE id='${deletedSite.siteId}';`);
    material = seedListings(seller, 1, 'material revision')[0];
    const revoked = seedListings(seller, 1, 'revoked')[0];
    psql(`SELECT * FROM transition_channel_listing('${seller.siteId}','${revoked.listing}','delisted','operator','${reviewer}','Synthetic takedown reason.','revoke-${revoked.listing}');`);
    seedListings(unpublished, 1, 'unpublished site');
    psql(`UPDATE sites SET status='draft',published=false WHERE id='${unpublished.siteId}';`);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
});
afterEach(async () => { await gateway.settle(); });

test('seller scope is applied before pagination and every continuation stays within the public seller result', async () => {
    // Remove the fourth public item by a real material edit; the revision trigger invalidates it.
    psql(`UPDATE products SET name='Synthetic revised product' WHERE id='${material.product}';`);
    assert.equal(psql(`SELECT status FROM channel_listings WHERE id='${material.listing}';`), 'draft');
    const global = await gateway.request('/v1/storefront/marketplace/feed?limit=100');
    assert.equal(global.status, 200, global.text);
    assert.equal((global.json?.data as Array<{ site_id: string }>).some((row) => row.site_id === seller.siteId), false,
        'negative control: first global page contains none of the target seller listings');
    const seen: string[] = [];
    let cursor: FeedCursor | null = null;
    for (let page = 0; page < 3; page++) {
        const params = new URLSearchParams({ site_id: seller.siteId, limit: '2', category: 'seller-fixture', country_of_origin: ' india ', search: 'seller product' });
        if (cursor) { params.set('after_approved_at', cursor.after_approved_at); params.set('after_id', cursor.after_id); }
        const response = await gateway.request(`/v1/storefront/marketplace/feed?${params}`);
        assert.equal(response.status, 200, response.text);
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        const rows = response.json?.data as Array<{ listing_id: string; site_id: string }>;
        assert.ok(rows.every((row) => row.site_id === seller.siteId));
        for (const row of rows) assert.equal(seen.includes(row.listing_id), false);
        seen.push(...rows.map((row) => row.listing_id));
        cursor = response.json?.meta?.next_cursor as FeedCursor | null;
        if (!cursor) break;
    }
    assert.equal(cursor, null);
    assert.deepEqual(new Set(seen), new Set(visible));
    assert.equal(seen.length, 3);
});

test('forged/unknown seller scopes cannot expose pending/hidden/revoked/material or unpublished data and retries re-read revocation', async () => {
    for (const id of [unpublished.siteId, deletedSite.siteId, crypto.randomUUID()]) {
        const response = await gateway.request(`/v1/storefront/marketplace/feed?site_id=${id}`);
        assert.equal(response.status, 200, response.text);
        assert.deepEqual(response.json?.data, []);
    }
    const current = await gateway.request(`/v1/storefront/marketplace/feed?site_id=${seller.siteId}&limit=100`);
    assert.equal(current.status, 200, current.text);
    const rows = current.json?.data as Array<Record<string, unknown>>;
    assert.deepEqual(new Set(rows.map((row) => row.listing_id)), new Set(visible));
    for (const row of rows) {
        for (const field of ['cost_price','cost_per_item','sku','barcode','created_by','submitted_product_snapshot','approved_product_fingerprint']) assert.equal(field in row, false);
    }
    const revoked = visible[0];
    psql(`SELECT * FROM transition_channel_listing('${seller.siteId}','${revoked}','delisted','operator','${reviewer}','Synthetic public revocation.','second-revoke-${revoked}');`);
    const retry = await gateway.request(`/v1/storefront/marketplace/feed?site_id=${seller.siteId}&limit=100`);
    assert.equal(retry.status, 200, retry.text);
    assert.equal((retry.json?.data as Array<{ listing_id: string }>).some((row) => row.listing_id === revoked), false);
    const malformed = await gateway.request('/v1/storefront/marketplace/feed?site_id=not-a-uuid');
    assert.equal(malformed.status, 400);
});

test('new seller overload grants only the Gateway role and keeps legacy definitions/grants through rollback and reapply', () => {
    for (const role of ['anon','authenticated','app_tenant']) {
        assert.equal(psql(`SELECT has_function_privilege('${role}','${signature}','EXECUTE');`), 'f', role);
        assert.match(owned.psqlExpectError(`SET ROLE ${role}; SELECT * FROM marketplace_feed(NULL,NULL,1,NULL,NULL,NULL,'${seller.siteId}'::uuid);`), /permission denied/);
    }
    assert.equal(psql(`SELECT has_function_privilege('service_role','${signature}','EXECUTE');`), 't');
    assert.equal(psql(`SELECT NOT EXISTS(SELECT 1 FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid='${signature}'::regprocedure)) WHERE grantee=0 AND privilege_type='EXECUTE');`), 't');
    const oldSignatures = ['public.marketplace_feed(text,text,integer,timestamp with time zone,uuid)', 'public.marketplace_feed(text,text,integer,timestamp with time zone,uuid,text)'];
    const fingerprint = () => oldSignatures.map((sig) => psql(`SELECT md5(pg_get_functiondef('${sig}'::regprocedure))||'|'||proacl::text FROM pg_proc WHERE oid='${sig}'::regprocedure;`));
    const original = fingerprint();
    script(readFileSync(new URL('../../../../../database/supabase/rollback/343_marketplace_seller_feed.rollback.sql', import.meta.url), 'utf8'));
    assert.equal(psql(`SELECT to_regprocedure('${signature}') IS NULL;`), 't');
    assert.deepEqual(fingerprint(), original);
    // Previous clients still execute with the final hardened service role during rollback.
    assert.ok(Number(psql(`SET ROLE service_role; SELECT count(*) FROM marketplace_feed(NULL,NULL,100,NULL,NULL);`).split('\n').at(-1)) > 0);
    assert.ok(Number(psql(`SET ROLE service_role; SELECT count(*) FROM marketplace_feed(NULL,NULL,100,NULL,NULL,'India');`).split('\n').at(-1)) > 0);
    script(readFileSync(new URL('../../../../../database/supabase/migrations/343_marketplace_seller_feed.sql', import.meta.url), 'utf8'));
    assert.deepEqual(fingerprint(), original);
    assert.ok(Number(psql(`SET ROLE service_role; SELECT count(*) FROM marketplace_feed(NULL,NULL,100,NULL,NULL,NULL,'${seller.siteId}'::uuid);`).split('\n').at(-1)) > 0);
    assert.equal(psql(`SELECT has_function_privilege('anon','${signature}','EXECUTE');`), 'f');
});

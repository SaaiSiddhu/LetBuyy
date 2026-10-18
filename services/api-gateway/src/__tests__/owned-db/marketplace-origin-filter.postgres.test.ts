// Phase 5 origin filtering — prove migration 272's legacy and filtered RPCs, public facet, and
// real storefront worker path against the runner-owned Postgres/PostgREST only (not RLS).
import assert from 'node:assert/strict';
import test, { afterEach, before } from 'node:test';
import { Gateway, gatewayEnv, newIdentityKeys } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant, type SyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const { psql } = owned;
const site = newSyntheticTenant('origin-feed');
const hiddenSite = newSyntheticTenant('origin-hidden');
const categoryId = crypto.randomUUID();
const reviewerId = crypto.randomUUID();
let gateway: Gateway;

before(async () => {
    const keys = await newIdentityKeys();
    seedSyntheticTenant(psql, site);
    seedSyntheticTenant(psql, hiddenSite);
    psql(`INSERT INTO marketplace_categories (id, slug, name, is_active)
        VALUES ('${categoryId}', 'origin-fixture', 'Origin fixture', true);`);
    gateway = new Gateway(gatewayEnv(owned, keys));
});
afterEach(async () => { await gateway.settle(); });

function createListing(tenant: SyntheticTenant, name: string, origin: string, visibility = 'public'): { id: string; productId: string } {
    const productId = crypto.randomUUID();
    const listingId = crypto.randomUUID();
    const slug = `syn-${productId.slice(0, 12)}`;
    psql(`INSERT INTO products
        (id, site_id, store_id, name, slug, description, price, images, stock, is_active, status, country_of_origin)
        VALUES ('${productId}', '${tenant.siteId}', '${tenant.siteId}', '${name}', '${slug}', 'Synthetic marketplace origin fixture', 129.00, ARRAY[]::text[], 8, true, 'active', '${origin}');
      INSERT INTO channel_listings (id, site_id, product_id, channel, marketplace_category_id, visibility)
        VALUES ('${listingId}', '${tenant.siteId}', '${productId}', 'marketplace', '${categoryId}', '${visibility}');`);
    return { id: listingId, productId };
}

function transition(tenant: SyntheticTenant, listingId: string, status: 'pending_review' | 'approved', actor: 'merchant' | 'operator', actorId: string, key: string): void {
    const context = actor === 'merchant'
        ? `SELECT set_config('app.site_id', '${tenant.siteId}', true);`
        : `SELECT set_config('app.site_id', '', true);`;
    psql(`BEGIN;
      ${context}
      SELECT * FROM transition_channel_listing(
        '${tenant.siteId}'::uuid, '${listingId}'::uuid, '${status}', '${actor}', '${actorId}'::uuid, NULL, '${key}'
      );
      COMMIT;`);
}

function publish(tenant: SyntheticTenant, listingId: string): void {
    transition(tenant, listingId, 'pending_review', 'merchant', crypto.randomUUID(), `origin-submit-${listingId}`);
    const version = Number(psql(`SELECT version FROM channel_listings WHERE id='${listingId}';`));
    psql(`SELECT * FROM claim_marketplace_listing_review(
      '${tenant.siteId}'::uuid, '${listingId}'::uuid, '${reviewerId}'::uuid,
      'Synthetic review fixture assigned.', 'origin-claim-${listingId}', ${version}
    );`);
    transition(tenant, listingId, 'approved', 'operator', reviewerId, `origin-approve-${listingId}`);
}

async function legacyFeedRpc(): Promise<Response> {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = owned.restEnv();
    return fetch(`${SUPABASE_URL}/rest/v1/rpc/marketplace_feed`, {
        method: 'POST',
        headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            p_category_slug: null,
            p_search: null,
            p_limit: 100,
            p_after_approved_at: null,
            p_after_id: null,
        }),
    });
}

test('migration 272 preserves the five-argument feed and filters the real public worker feed before pagination', async () => {
    const india = createListing(site, 'India Origin Product', 'India');
    const indiaVariant = createListing(site, 'Whitespace India Product', '  india  ');
    const hidden = createListing(site, 'Hidden Germany Product', 'Germany', 'hidden');
    const pending = createListing(site, 'Pending Japan Product', 'Japan');
    const inactive = createListing(site, 'Inactive France Product', 'France');
    const unpublished = createListing(hiddenSite, 'Unpublished Italy Product', 'Italy');
    for (const listing of [india, indiaVariant, hidden, inactive]) publish(site, listing.id);
    publish(hiddenSite, unpublished.id);
    transition(site, pending.id, 'pending_review', 'merchant', crypto.randomUUID(), `origin-submit-${pending.id}`);
    psql(`UPDATE products SET is_active=false WHERE id='${inactive.productId}';
      UPDATE sites SET status='draft', published=false WHERE id='${hiddenSite.siteId}';`);

    const legacy = await legacyFeedRpc();
    assert.equal(legacy.status, 200, 'PostgREST still resolves the original five-argument marketplace_feed overload');
    const legacyRows = await legacy.json() as Array<{ listing_id: string }>;
    assert.ok(legacyRows.some((row) => row.listing_id === india.id));
    assert.ok(legacyRows.some((row) => row.listing_id === indiaVariant.id));

    const all = await gateway.request('/v1/storefront/marketplace/feed?limit=100');
    assert.equal(all.status, 200, all.text);
    const allIds = (all.json?.data as Array<{ listing_id: string }>).map((row) => row.listing_id);
    assert.ok(allIds.includes(india.id));
    assert.ok(allIds.includes(indiaVariant.id));
    for (const excluded of [hidden.id, pending.id, inactive.id, unpublished.id]) assert.equal(allIds.includes(excluded), false, `public feed excludes ${excluded}`);

    const filtered = await gateway.request('/v1/storefront/marketplace/feed?country_of_origin=%20INDIA%20&limit=100');
    assert.equal(filtered.status, 200, filtered.text);
    const filteredRows = filtered.json?.data as Array<{ listing_id: string; country_of_origin?: string }>;
    assert.deepEqual(new Set(filteredRows.map((row) => row.listing_id)), new Set([india.id, indiaVariant.id]));
    assert.ok(filteredRows.every((row) => row.country_of_origin && row.country_of_origin.trim().toLowerCase() === 'india'));

    const firstPage = await gateway.request('/v1/storefront/marketplace/feed?country_of_origin=india&limit=1');
    assert.equal(firstPage.status, 200);
    const firstRows = firstPage.json?.data as Array<{ listing_id: string }>;
    const cursor = firstPage.json?.meta?.next_cursor as { after_approved_at: string; after_id: string } | null;
    assert.equal(firstRows.length, 1);
    assert.ok(cursor);
    const next = new URLSearchParams({
        country_of_origin: 'india',
        limit: '1',
        after_approved_at: cursor.after_approved_at,
        after_id: cursor.after_id,
    });
    const secondPage = await gateway.request(`/v1/storefront/marketplace/feed?${next}`);
    assert.equal(secondPage.status, 200, secondPage.text);
    const secondRows = secondPage.json?.data as Array<{ listing_id: string; country_of_origin?: string }>;
    assert.equal(secondRows.length, 1);
    assert.notEqual(secondRows[0].listing_id, firstRows[0].listing_id);
    assert.equal(secondRows[0].country_of_origin?.trim().toLowerCase(), 'india');
});

test('marketplace origin facets collapse case/space variants and hide non-public, inactive, pending and unpublished offers', async () => {
    const india = createListing(site, 'Facet India Product', 'India');
    const indiaVariant = createListing(site, 'Facet India Variant', ' india ');
    const hidden = createListing(site, 'Facet Hidden Germany', 'Germany', 'hidden');
    const pending = createListing(site, 'Facet Pending Japan', 'Japan');
    const inactive = createListing(site, 'Facet Inactive France', 'France');
    const unpublished = createListing(hiddenSite, 'Facet Unpublished Italy', 'Italy');
    for (const listing of [india, indiaVariant, hidden, inactive]) publish(site, listing.id);
    publish(hiddenSite, unpublished.id);
    transition(site, pending.id, 'pending_review', 'merchant', crypto.randomUUID(), `facet-submit-${pending.id}`);
    psql(`UPDATE products SET is_active=false WHERE id='${inactive.productId}';
      UPDATE sites SET status='draft', published=false WHERE id='${hiddenSite.siteId}';`);

    const response = await gateway.request('/v1/storefront/marketplace/origins');
    assert.equal(response.status, 200, response.text);
    const origins = response.json?.data as Array<{ country_of_origin: string }>;
    assert.deepEqual(origins.map((row) => row.country_of_origin.trim().toLowerCase()), ['india']);
});

test('the public Gateway feed uses backend-only RPCs; direct public roles cannot execute them', () => {
    for(const role of ['anon','authenticated'])for(const signature of ['public.marketplace_feed(text,text,integer,timestamp with time zone,uuid,text)','public.marketplace_origins()']){
      assert.equal(psql(`SELECT has_function_privilege('${role}','${signature}','EXECUTE');`),'f');
    }
    assert.equal(psql("SELECT has_function_privilege('service_role','public.marketplace_origins()','EXECUTE');"),'t');
    assert.equal(psql(`SELECT NOT EXISTS (
      SELECT 1 FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid='public.marketplace_feed(text,text,integer,timestamp with time zone,uuid,text)'::regprocedure))
      WHERE grantee=0 AND privilege_type='EXECUTE'
    );`), 't');
    assert.equal(psql(`SELECT NOT EXISTS (
      SELECT 1 FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid='public.marketplace_origins()'::regprocedure))
      WHERE grantee=0 AND privilege_type='EXECUTE'
    );`), 't');
});

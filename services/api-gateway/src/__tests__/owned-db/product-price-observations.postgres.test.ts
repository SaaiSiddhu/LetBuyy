// Price history belongs to the canonical product and variant rows. Exercise trigger recording,
// reference-window math and privileges through the owned Postgres database only.
import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const { psql } = owned;
const site = newSyntheticTenant('price-history');
const categoryId = crypto.randomUUID();
const reviewerId = crypto.randomUUID();

before(() => {
    seedSyntheticTenant(psql, site);
    psql(`INSERT INTO marketplace_categories (id,slug,name,is_active) VALUES ('${categoryId}','price-history-fixture','Price history fixture',true);`);
});

function transition(listingId: string, status: 'pending_review' | 'approved', actor: 'merchant' | 'operator', actorId: string, key: string): void {
    const context = actor === 'merchant'
        ? `SELECT set_config('app.site_id','${site.siteId}',true);`
        : `SELECT set_config('app.site_id','',true);`;
    psql(`BEGIN; ${context}
      SELECT * FROM transition_channel_listing(
        '${site.siteId}'::uuid,'${listingId}'::uuid,'${status}','${actor}','${actorId}'::uuid,NULL,'${key}'
      );
      COMMIT;`);
}

function submitAndApproveMarketplaceListing(listingId: string): void {
    transition(listingId, 'pending_review', 'merchant', crypto.randomUUID(), `price-submit-${listingId}`);
    const version = Number(psql(`SELECT version::text FROM channel_listings WHERE id='${listingId}';`));
    psql(`SELECT * FROM claim_marketplace_listing_review(
      '${site.siteId}'::uuid,'${listingId}'::uuid,'${reviewerId}'::uuid,
      'Synthetic reviewer claim for price-history fixture.','price-claim-${listingId}',${version}
    );`);
    transition(listingId, 'approved', 'operator', reviewerId, `price-approve-${listingId}`);
}

function createApprovedMarketplaceOffer(): { productId: string; listingId: string } {
    const productId = crypto.randomUUID();
    const listingId = crypto.randomUUID();
    const slug = `syn-${productId.slice(0, 12)}`;
    psql(`INSERT INTO products (id,site_id,store_id,name,slug,description,price,images,stock,is_active,status,country_of_origin)
      VALUES ('${productId}','${site.siteId}','${site.siteId}','Synthetic marketplace offer','${slug}','Price history fixture',140,ARRAY[]::text[],8,true,'active','Italy');
      INSERT INTO channel_listings (id,site_id,product_id,channel,marketplace_category_id,visibility)
      VALUES ('${listingId}','${site.siteId}','${productId}','marketplace','${categoryId}','public');`);
    submitAndApproveMarketplaceListing(listingId);
    return { productId, listingId };
}

test('product and variant price writes create observations without inventing historical coverage', () => {
    const productId = crypto.randomUUID();
    const variantId = crypto.randomUUID();
    psql(`INSERT INTO products (id,store_id,name,price,compare_price,is_active,status) VALUES ('${productId}','${site.siteId}','Synthetic price history product',100,150,true,'active');`);
    psql(`INSERT INTO product_variants (id,product_id,title,price,compare_price,inventory_qty) VALUES ('${variantId}','${productId}','Synthetic variant',120,180,4);`);

    const fresh = JSON.parse(psql(`SELECT coalesce(json_agg(to_jsonb(w)),'[]'::json)::text FROM product_price_reference_window(ARRAY['${productId}'::uuid],now()) AS w;`)) as Array<Record<string, unknown>>;
    assert.equal(fresh.length, 2);
    assert.ok(fresh.every((row) => row.prior_coverage_complete === false));

    psql(`UPDATE product_price_observations SET observed_at=now()-interval '31 days' WHERE product_id='${productId}' AND offer_channel='storefront';`);
    psql(`UPDATE products SET price=80 WHERE id='${productId}';`);
    psql(`UPDATE product_variants SET price=105 WHERE id='${variantId}';`);
    psql(`UPDATE products SET price=90 WHERE id='${productId}';`);

    const window = JSON.parse(psql(`SELECT coalesce(json_agg(to_jsonb(w) ORDER BY w.variant_id NULLS FIRST),'[]'::json)::text FROM product_price_reference_window(ARRAY['${productId}'::uuid],now()) AS w;`)) as Array<Record<string, unknown>>;
    assert.equal(window.length, 2);
    assert.equal(window[0].variant_id, null);
    assert.equal(Number(window[0].current_price), 90);
    assert.equal(Number(window[0].prior_lowest_price_30d), 80);
    assert.equal(window[0].prior_coverage_complete, true);
    assert.equal(window[1].variant_id, variantId);
    assert.equal(Number(window[1].current_price), 105);
    assert.equal(Number(window[1].prior_lowest_price_30d), 120, 'the prior window ends before the variant price update and uses the last known boundary price');
    assert.equal(window[1].prior_coverage_complete, true);

    const firstPublicPrice = JSON.parse(psql(`SELECT to_jsonb(h)::text FROM product_price_observations h WHERE h.product_id='${productId}' AND h.variant_id IS NULL AND h.price=80 AND h.offer_channel='storefront' ORDER BY h.observed_at LIMIT 1;`)) as Record<string, unknown>;
    assert.equal(firstPublicPrice.is_available, true, 'the storefront price event records the public offer state');
    assert.equal(firstPublicPrice.offer_channel, 'storefront');

    const futureWindow = JSON.parse(psql(`SELECT to_jsonb(w)::text FROM product_price_reference_window(ARRAY['${productId}'::uuid],now()+interval '31 days') w WHERE w.variant_id IS NULL;`)) as Record<string, unknown>;
    assert.equal(Number(futureWindow.current_price), 90);
    assert.equal(Number(futureWindow.prior_lowest_price_30d), 80, 'the prior reference stays bound to the price announcement instead of counting the reduced price itself');

    const count = psql(`SELECT count(*)::text FROM product_price_observations WHERE product_id='${productId}' AND offer_channel='storefront';`);
    assert.equal(count, '9', 'price writes and product availability snapshots are retained separately for the storefront scope');
});

test('marketplace price history follows approved/public listing availability independently', () => {
    const { productId, listingId } = createApprovedMarketplaceOffer();

    const initial = JSON.parse(psql(`SELECT coalesce(json_agg(to_jsonb(w)),'[]'::json)::text FROM product_price_reference_window(ARRAY['${productId}'::uuid],now(),'marketplace') AS w;`)) as Array<Record<string, unknown>>;
    assert.equal(initial.length, 1);
    assert.equal(initial[0].prior_coverage_complete, false, 'approval begins a new, honest marketplace observation window');
    psql(`UPDATE product_price_observations SET observed_at=now()-interval '60 days' WHERE product_id='${productId}' AND offer_channel='marketplace';`);
    psql(`INSERT INTO product_price_observations
        (store_id,product_id,variant_id,price,compare_price,prior_lowest_price_30d,prior_coverage_complete,observed_at,observation_source,offer_channel,is_available)
        VALUES ('${site.siteId}','${productId}',NULL,140,NULL,NULL,false,now()-interval '51 days','migration_baseline','marketplace',true);`);

    psql(`UPDATE channel_listings SET visibility='hidden' WHERE id='${listingId}';`);
    psql(`UPDATE product_price_observations SET observed_at=now()-interval '35 days' WHERE id=(SELECT id FROM product_price_observations WHERE product_id='${productId}' AND offer_channel='marketplace' ORDER BY observed_at DESC,id DESC LIMIT 1);`);
    const hiddenSnapshot = JSON.parse(psql(`SELECT to_jsonb(h)::text FROM product_price_observations h WHERE h.product_id='${productId}' AND h.offer_channel='marketplace' ORDER BY h.observed_at DESC,h.id DESC LIMIT 1;`)) as Record<string, unknown>;
    assert.equal(hiddenSnapshot.is_available, false, 'hidden listing edits are retained as state but not as offered prices');
    psql(`UPDATE product_price_observations SET observed_at=now()-interval '34 days' WHERE id='${hiddenSnapshot.id}';`);

    psql(`UPDATE channel_listings SET visibility='public' WHERE id='${listingId}';`);
    psql(`UPDATE product_price_observations SET observed_at=now()-interval '20 days' WHERE id=(SELECT id FROM product_price_observations WHERE product_id='${productId}' AND offer_channel='marketplace' ORDER BY observed_at DESC,id DESC LIMIT 1);`);
    const visibleSnapshot = JSON.parse(psql(`SELECT to_jsonb(h)::text FROM product_price_observations h WHERE h.product_id='${productId}' AND h.offer_channel='marketplace' ORDER BY h.observed_at DESC,h.id DESC LIMIT 1;`)) as Record<string, unknown>;
    const listingState = psql(`SELECT concat_ws('|',cl.status,cl.visibility,s.status,s.deleted_at::text,p.is_active::text,p.deleted_at::text) FROM channel_listings cl JOIN sites s ON s.id=cl.site_id JOIN products p ON p.id=cl.product_id WHERE cl.id='${listingId}';`);
    assert.equal(visibleSnapshot.is_available, true, `republished observation should be available; state=${JSON.stringify(listingState)} observation=${JSON.stringify(visibleSnapshot)}`);
    assert.equal(Number(visibleSnapshot.price), 140, 'republishing records the current canonical price at the availability boundary');
    const reoffered = JSON.parse(psql(`SELECT to_jsonb(w)::text FROM product_price_reference_window(ARRAY['${productId}'::uuid],now(),'marketplace') w WHERE w.variant_id IS NULL;`)) as Record<string, unknown>;
    assert.equal(Number(reoffered.prior_lowest_price_30d), 140, 'the prior reference is anchored before the republished offer transition');
    assert.equal(reoffered.prior_coverage_complete, true, 'the observed false/true transitions prove channel history across the full window');

    psql(`UPDATE channel_listings SET channel='instant' WHERE id='${listingId}';`);
    const movedOut = JSON.parse(psql(`SELECT to_jsonb(h)::text FROM product_price_observations h WHERE h.product_id='${productId}' AND h.offer_channel='marketplace' ORDER BY h.observed_at DESC,h.id DESC LIMIT 1;`)) as Record<string, unknown>;
    assert.equal(movedOut.is_available, false, 'moving the listing out of marketplace scope records the end of that offer');

    const replacementListingId = crypto.randomUUID();
    psql(`INSERT INTO channel_listings (id,site_id,product_id,channel,marketplace_category_id,visibility)
      VALUES ('${replacementListingId}','${site.siteId}','${productId}','marketplace','${categoryId}','public');`);
    submitAndApproveMarketplaceListing(replacementListingId);
    psql(`DELETE FROM channel_listings WHERE id='${replacementListingId}';`);
    const deleted = JSON.parse(psql(`SELECT to_jsonb(h)::text FROM product_price_observations h WHERE h.product_id='${productId}' AND h.offer_channel='marketplace' ORDER BY h.observed_at DESC,h.id DESC LIMIT 1;`)) as Record<string, unknown>;
    assert.equal(deleted.is_available, false, 'deleting a marketplace listing records the end of the offer');
});

test('price observations are read-only to API roles and the reference RPC is service-role-only', () => {
    const signature = 'public.product_price_reference_window(uuid[],timestamp with time zone,text)';
    assert.equal(psql(`SELECT has_table_privilege('service_role','public.product_price_observations','SELECT')::text;`), 'true');
    for (const operation of ['INSERT', 'UPDATE', 'DELETE']) {
        assert.equal(psql(`SELECT has_table_privilege('service_role','public.product_price_observations','${operation}')::text;`), 'false');
    }
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        for (const operation of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
            assert.equal(psql(`SELECT has_table_privilege('${role}','public.product_price_observations','${operation}')::text;`), 'false');
        }
    }
    assert.equal(psql(`SELECT has_function_privilege('service_role','${signature}','EXECUTE')::text;`), 'true');
    for (const role of ['PUBLIC', 'anon', 'authenticated', 'app_tenant']) {
        if (role === 'PUBLIC') continue;
        assert.equal(psql(`SELECT has_function_privilege('${role}','${signature}','EXECUTE')::text;`), 'false');
    }
});

test('moving a product starts new variant coverage in the destination store', () => {
    const destination = newSyntheticTenant('price-destination');
    seedSyntheticTenant(psql, destination);
    const productId = crypto.randomUUID();
    const variantId = crypto.randomUUID();
    psql(`INSERT INTO products (id,store_id,name,price,is_active,status) VALUES ('${productId}','${site.siteId}','Synthetic reassigned product',100,true,'active');`);
    psql(`INSERT INTO product_variants (id,product_id,title,price,inventory_qty) VALUES ('${variantId}','${productId}','Synthetic reassigned variant',90,2);`);
    psql(`UPDATE products SET store_id='${destination.siteId}' WHERE id='${productId}';`);

    const reassignment = JSON.parse(psql(`SELECT to_jsonb(h)::text FROM product_price_observations h WHERE h.product_id='${productId}' AND h.variant_id='${variantId}' AND h.store_id='${destination.siteId}' ORDER BY h.observed_at DESC,h.id DESC LIMIT 1;`)) as Record<string, unknown>;
    assert.equal(reassignment.observation_source, 'store_reassignment_baseline');
    assert.equal(reassignment.prior_coverage_complete, false);
    assert.equal(reassignment.prior_lowest_price_30d, null);
});

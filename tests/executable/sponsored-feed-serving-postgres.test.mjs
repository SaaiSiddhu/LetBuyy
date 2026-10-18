// F-ADS-1b — migration 240's sponsored-feed serving predicate and bid ranking, on real Postgres.
//
// Serving and billing have to agree about what "can pay" means. Before 240 they did not: the feed
// filtered on status and the campaign window, while record_ad_spend also refuses a spent-out
// allocation and a reached daily cap. Every assertion here drives the feed function itself and
// checks WHICH placements come back, in WHICH order.
//
// The fences are exercised behaviourally too, not only pinned in the lineage test: a hidden product
// and an unpublished seller must stay out of a PAID slot.
//
// DESTRUCTIVE: recreates its own database and replays every migration. Refuses the shared database.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_ads1b_feed';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable
  ? false
  : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
    'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

const MIGRATION = 'database/supabase/migrations/240_sponsored_feed_serving_predicate.sql';
const ROLLBACK = 'database/supabase/rollback/240_sponsored_feed_serving_predicate.rollback.sql';

const SITE_A = '11111111-1111-4111-8111-1111111111c1';
const SITE_B = '22222222-2222-4222-8222-2222222222c2';
const CAMPAIGN_A = '33333333-3333-4333-8333-3333333333c3';
const CAMPAIGN_B = '44444444-4444-4444-8444-4444444444c4';

function psql(sql, targetDatabase = databaseName) {
    return execFileSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt'],
        { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    ).trim();
}

function psqlExpectingFailure(sql) {
    try {
        psql(sql);
        return null;
    } catch (error) {
        return `${error.stderr || ''}${error.stdout || ''}`;
    }
}

const sqlString = (v) => `'${String(v).replaceAll("'", "''")}'`;
const stripUnsupportedPg17Guc = (sql) => sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');
const applySqlFile = (relativePath) => psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, relativePath), 'utf8')));

function listMigrations() {
    return readdirSync(join(repoRoot, 'database/supabase/migrations'))
        .filter((n) => n.endsWith('.sql'))
        .sort((a, b) => {
            const na = parseInt(a.match(/^(\d+)/)?.[1] ?? '0', 10);
            const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? '0', 10);
            return na - nb || a.localeCompare(b);
        });
}

// The bootstrap lives in a shared, Supabase-faithful module since F-HARNESS-1: pgcrypto in
// `extensions` rather than `public`, Supabase's own ALTER DEFAULT PRIVILEGES, and role attributes
// stated rather than inherited from whichever suite created them first. See CAP-C62 and CAP-C64 —
// each of those three differences has silently flipped a test result in this repository.
const BOOTSTRAP_SQL = SUPABASE_FAITHFUL_BOOTSTRAP_SQL;

function bootstrapDatabase() {
    psql(`DROP DATABASE IF EXISTS "${databaseName}"; CREATE DATABASE "${databaseName}";`, 'postgres');
    psql(BOOTSTRAP_SQL);
    for (const name of listMigrations()) {
        const sql = stripUnsupportedPg17Guc(readFileSync(join(repoRoot, 'database/supabase/migrations', name), 'utf8'));
        try {
            psql(sql);
        } catch (error) {
            throw new Error(`migration ${name} failed to apply: ${error.message}`);
        }
    }
}

function seedFixtures() {
    psql(`
    INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published) VALUES
      (${sqlString(SITE_A)}::uuid, 'Ads A', 'Ads A', 'store', 'ads-a', true),
      (${sqlString(SITE_B)}::uuid, 'Ads B', 'Ads B', 'store', 'ads-b', true);

    INSERT INTO public.ad_campaigns (id, site_id, name, status) VALUES
      (${sqlString(CAMPAIGN_A)}::uuid, ${sqlString(SITE_A)}::uuid, 'Campaign A', 'draft'),
      (${sqlString(CAMPAIGN_B)}::uuid, ${sqlString(SITE_B)}::uuid, 'Campaign B', 'draft');

    -- Both sites funded, so the allocation tests fail for the reason under test rather than for want
    -- of credits. Purchases are made with the GUC unset, which the fence deliberately allows.
    SELECT public.record_ad_credit_purchase(${sqlString(SITE_A)}::uuid, 100000, 'pay_a_1', 'ads2:buy:a1');
    SELECT public.record_ad_credit_purchase(${sqlString(SITE_B)}::uuid, 100000, 'pay_b_1', 'ads2:buy:b1');
  `);
}

// One statement with the tenant GUC set to `site`, rolled back afterwards.
const withTenant = (site, statement) =>
    psqlExpectingFailure(`BEGIN;
SELECT set_config('app.site_id', ${sqlString(site)}, true);
${statement};
ROLLBACK;`);

const balance = (site) => psql(
    `SELECT public.ad_credit_balance_minor(a.id) FROM public.ad_credit_accounts a WHERE a.site_id = ${sqlString(site)}::uuid;`,
);
const allocated = (campaign) => psql(
    `SELECT allocated_minor FROM public.ad_campaigns WHERE id = ${sqlString(campaign)}::uuid;`,
);



const PRODUCT_A = '55555555-5555-4555-8555-5555555555d1';
const PRODUCT_B = '66666666-6666-4666-8666-6666666666d2';
const PRODUCT_PENDING = '77777777-7777-4777-8777-7777777777d3';
const PRODUCT_REJECTED = '88888888-8888-4888-8888-8888888888d4';
const PRODUCT_HIDDEN = '99999999-9999-4999-8999-9999999999d5';
const MARKETPLACE_CATEGORY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LISTING_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba1';
const LISTING_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const LISTING_PENDING = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbd3';
const LISTING_REJECTED = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbd4';
const LISTING_HIDDEN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbd5';

const feed = () => psql(`SELECT string_agg(campaign_id::text, ',' ORDER BY ord) FROM (
    SELECT campaign_id, row_number() OVER () AS ord FROM public.marketplace_sponsored_products(20)
  ) t;`);
const feedProducts = () => psql(`SELECT string_agg(product_id::text, ',') FROM public.marketplace_sponsored_products(20);`);
const remaining = (campaign) => psql(`SELECT public.ad_campaign_remaining_minor(${sqlString(campaign)}::uuid);`);
const configure = (campaign, sql) => psql(
    `UPDATE public.ad_campaigns SET ${sql}, status = 'active' WHERE id = ${sqlString(campaign)}::uuid;`);

after(() => {
    if (!runnable) return;
    try { psql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`, 'postgres'); } catch { /* next run recreates */ }
});

before(() => {
    if (!runnable) return;
    bootstrapDatabase();
    seedFixtures();
    // The shared harness seeds sites with published = true, a BOOLEAN column. The feed's fence reads
    // sites.STATUS, which is a different column and defaults to something else — so without this the
    // feed is empty and every ranking assertion below would pass or fail for the wrong reason.
    psql(`UPDATE public.sites SET status = 'published' WHERE id IN (${sqlString(SITE_A)}::uuid, ${sqlString(SITE_B)}::uuid);`);
    psql(`
    INSERT INTO public.products (id, store_id, site_id, name, slug, price, is_active, status) VALUES
      (${sqlString(PRODUCT_A)}::uuid, ${sqlString(SITE_A)}::uuid, ${sqlString(SITE_A)}::uuid, 'Prod A', 'prod-a', 100, true, 'active'),
      (${sqlString(PRODUCT_B)}::uuid, ${sqlString(SITE_B)}::uuid, ${sqlString(SITE_B)}::uuid, 'Prod B', 'prod-b', 200, true, 'active'),
      (${sqlString(PRODUCT_PENDING)}::uuid, ${sqlString(SITE_A)}::uuid, ${sqlString(SITE_A)}::uuid, 'Pending Prod', 'pending-prod', 300, true, 'active'),
      (${sqlString(PRODUCT_REJECTED)}::uuid, ${sqlString(SITE_A)}::uuid, ${sqlString(SITE_A)}::uuid, 'Rejected Prod', 'rejected-prod', 400, true, 'active'),
      (${sqlString(PRODUCT_HIDDEN)}::uuid, ${sqlString(SITE_A)}::uuid, ${sqlString(SITE_A)}::uuid, 'Hidden Prod', 'hidden-prod', 500, true, 'active');

    INSERT INTO public.marketplace_categories (id, slug, name) VALUES
      (${sqlString(MARKETPLACE_CATEGORY)}::uuid, 'ads-test', 'Ads Test');

    INSERT INTO public.channel_listings (id, site_id, product_id, channel, visibility, marketplace_category_id) VALUES
      (${sqlString(LISTING_A)}::uuid, ${sqlString(SITE_A)}::uuid, ${sqlString(PRODUCT_A)}::uuid, 'marketplace', 'public', ${sqlString(MARKETPLACE_CATEGORY)}::uuid),
      (${sqlString(LISTING_B)}::uuid, ${sqlString(SITE_B)}::uuid, ${sqlString(PRODUCT_B)}::uuid, 'marketplace', 'public', ${sqlString(MARKETPLACE_CATEGORY)}::uuid),
      (${sqlString(LISTING_PENDING)}::uuid, ${sqlString(SITE_A)}::uuid, ${sqlString(PRODUCT_PENDING)}::uuid, 'marketplace', 'public', ${sqlString(MARKETPLACE_CATEGORY)}::uuid),
      (${sqlString(LISTING_REJECTED)}::uuid, ${sqlString(SITE_A)}::uuid, ${sqlString(PRODUCT_REJECTED)}::uuid, 'marketplace', 'public', ${sqlString(MARKETPLACE_CATEGORY)}::uuid),
      (${sqlString(LISTING_HIDDEN)}::uuid, ${sqlString(SITE_A)}::uuid, ${sqlString(PRODUCT_HIDDEN)}::uuid, 'marketplace', 'hidden', ${sqlString(MARKETPLACE_CATEGORY)}::uuid);

    INSERT INTO public.ad_campaign_placements (site_id, campaign_id, product_id, "position") VALUES
      (${sqlString(SITE_A)}::uuid, ${sqlString(CAMPAIGN_A)}::uuid, ${sqlString(PRODUCT_A)}::uuid, 0),
      (${sqlString(SITE_B)}::uuid, ${sqlString(CAMPAIGN_B)}::uuid, ${sqlString(PRODUCT_B)}::uuid, 0),
      (${sqlString(SITE_A)}::uuid, ${sqlString(CAMPAIGN_A)}::uuid, ${sqlString(PRODUCT_PENDING)}::uuid, 1),
      (${sqlString(SITE_A)}::uuid, ${sqlString(CAMPAIGN_A)}::uuid, ${sqlString(PRODUCT_REJECTED)}::uuid, 2),
      (${sqlString(SITE_A)}::uuid, ${sqlString(CAMPAIGN_A)}::uuid, ${sqlString(PRODUCT_HIDDEN)}::uuid, 3);

    SELECT public.allocate_ad_campaign_budget(${sqlString(SITE_A)}::uuid, ${sqlString(CAMPAIGN_A)}::uuid, 40000, 'ads1b:alloc:a');
    SELECT public.allocate_ad_campaign_budget(${sqlString(SITE_B)}::uuid, ${sqlString(CAMPAIGN_B)}::uuid, 40000, 'ads1b:alloc:b');
  `);
    psql(`BEGIN;
      SELECT set_config('app.site_id', ${sqlString(SITE_A)}, true);
      SELECT * FROM public.transition_channel_listing(${sqlString(SITE_A)}::uuid, ${sqlString(LISTING_A)}::uuid, 'pending_review', 'merchant', NULL, NULL, 'ads-review:a');
      SELECT * FROM public.transition_channel_listing(${sqlString(SITE_A)}::uuid, ${sqlString(LISTING_PENDING)}::uuid, 'pending_review', 'merchant', NULL, NULL, 'ads-review:pending');
      SELECT * FROM public.transition_channel_listing(${sqlString(SITE_A)}::uuid, ${sqlString(LISTING_REJECTED)}::uuid, 'pending_review', 'merchant', NULL, NULL, 'ads-review:rejected');
      SELECT * FROM public.transition_channel_listing(${sqlString(SITE_A)}::uuid, ${sqlString(LISTING_HIDDEN)}::uuid, 'pending_review', 'merchant', NULL, NULL, 'ads-review:hidden');
      COMMIT;
      BEGIN;
      SELECT set_config('app.site_id', '', true);
      SELECT * FROM public.transition_channel_listing(${sqlString(SITE_A)}::uuid, ${sqlString(LISTING_A)}::uuid, 'approved', 'operator', NULL, 'approved test listing', 'ads-approve:a');
      SELECT * FROM public.transition_channel_listing(${sqlString(SITE_A)}::uuid, ${sqlString(LISTING_REJECTED)}::uuid, 'rejected', 'operator', NULL, 'rejected test listing', 'ads-reject:rejected');
      SELECT * FROM public.transition_channel_listing(${sqlString(SITE_A)}::uuid, ${sqlString(LISTING_HIDDEN)}::uuid, 'approved', 'operator', NULL, 'approved test listing', 'ads-approve:hidden');
      SELECT set_config('app.site_id', ${sqlString(SITE_B)}, true);
      SELECT * FROM public.transition_channel_listing(${sqlString(SITE_B)}::uuid, ${sqlString(LISTING_B)}::uuid, 'pending_review', 'merchant', NULL, NULL, 'ads-review:b');
      COMMIT;
      BEGIN;
      SELECT set_config('app.site_id', '', true);
      SELECT * FROM public.transition_channel_listing(${sqlString(SITE_B)}::uuid, ${sqlString(LISTING_B)}::uuid, 'approved', 'operator', NULL, 'approved test listing', 'ads-approve:b');
      COMMIT;`);
    configure(CAMPAIGN_A, "pricing_model = 'cpc', bid_minor = 1000");
    configure(CAMPAIGN_B, "pricing_model = 'cpc', bid_minor = 9000");
});

test('paid marketplace placements exclude pending, rejected, and hidden listings', { skip }, () => {
    assert.deepEqual(
        feedProducts().split(',').sort(),
        [PRODUCT_A, PRODUCT_B].sort(),
        'only approved, public marketplace listings may enter paid marketplace discovery',
    );
});

test('the feed ranks by bid, highest first', { skip }, () => {
    // B bids 9000, A bids 1000. Both are otherwise identical, so order is the bid and nothing else.
    assert.equal(feed(), `${CAMPAIGN_B},${CAMPAIGN_A}`);

    psql(`UPDATE public.ad_campaigns SET bid_minor = 12000 WHERE id = ${sqlString(CAMPAIGN_A)}::uuid;`);
    assert.equal(feed(), `${CAMPAIGN_A},${CAMPAIGN_B}`, 'raising a bid moves the placement up');
});

test('the bid itself never leaves the database', { skip }, () => {
    // Returning it would hand every competitor the whole auction book.
    const columns = psql(`SELECT string_agg(column_name, ',' ORDER BY ordinal_position)
      FROM information_schema.columns
     WHERE table_name = 'marketplace_sponsored_products';`);
    // The function's OUT parameters are not in information_schema; read the signature instead.
    const signature = psql(`SELECT pg_get_function_result(oid) FROM pg_proc WHERE proname = 'marketplace_sponsored_products';`);
    assert.ok(!/bid_minor/.test(signature), `the bid must not be returned: ${signature}`);
    assert.match(signature, /campaign_id/, 'but the campaign is, so a placement can be bound to it later');
    assert.equal(columns, '', 'sanity: a function has no information_schema columns');
});

test('a campaign with no remaining budget is not served', { skip }, () => {
    // Spend A's entire allocation through the canonical writer.
    psql(`UPDATE public.ad_campaigns SET bid_minor = 40000 WHERE id = ${sqlString(CAMPAIGN_A)}::uuid;`);
    const spent = psql(`SELECT public.record_ad_spend(${sqlString(SITE_A)}::uuid, ${sqlString(CAMPAIGN_A)}::uuid,
        'click', 1, 'ads1b:spend:all', NULL, NULL);`);
    assert.match(spent, /"exhausted"\s*:\s*true/, spent);
    assert.equal(feed(), CAMPAIGN_B, 'a campaign that cannot pay must not occupy a paid slot');
});

test('a campaign over its daily cap drops out, and returns when the window moves', { skip }, () => {
    psql(`UPDATE public.ad_campaigns SET daily_budget_minor = 5000, bid_minor = 5000 WHERE id = ${sqlString(CAMPAIGN_B)}::uuid;`);
    assert.equal(feed(), CAMPAIGN_B, 'still serving before the cap is reached');

    psql(`SELECT public.record_ad_spend(${sqlString(SITE_B)}::uuid, ${sqlString(CAMPAIGN_B)}::uuid,
        'click', 1, 'ads1b:daily:1', NULL, NULL);`);
    assert.equal(psql(`SELECT public.ad_campaign_spent_today_minor(${sqlString(CAMPAIGN_B)}::uuid, NULL);`), '5000');
    assert.equal(feed() || '', '', 'the cap is reached, so nothing is served');

    // Raising the cap is the same as tomorrow arriving: "today" is a window, so the campaign returns
    // without any job having reset a counter.
    psql(`UPDATE public.ad_campaigns SET daily_budget_minor = 20000 WHERE id = ${sqlString(CAMPAIGN_B)}::uuid;`);
    assert.equal(feed(), CAMPAIGN_B);
});

test('the visibility fences still hold in a PAID slot', { skip }, () => {
    // Exercised, not merely pinned: these decide what a public feed shows.
    psql(`UPDATE public.products SET is_active = false WHERE id = ${sqlString(PRODUCT_B)}::uuid;`);
    assert.equal(feed() || '', '', 'an inactive product must not appear in a paid slot');
    psql(`UPDATE public.products SET is_active = true, deleted_at = now() WHERE id = ${sqlString(PRODUCT_B)}::uuid;`);
    assert.equal(feed() || '', '', 'nor a soft-deleted one');
    psql(`UPDATE public.products SET deleted_at = NULL WHERE id = ${sqlString(PRODUCT_B)}::uuid;`);

    psql(`UPDATE public.sites SET status = 'draft' WHERE id = ${sqlString(SITE_B)}::uuid;`);
    assert.equal(feed() || '', '', 'nor a product whose seller is not published');
    psql(`UPDATE public.sites SET status = 'published' WHERE id = ${sqlString(SITE_B)}::uuid;`);
    assert.equal(feed(), CAMPAIGN_B, 'and it comes back when the seller is published again');
    assert.equal(feedProducts(), PRODUCT_B);
});

test("REPRODUCED: 232's feed serves a spent campaign a merchant re-activates", { skip }, () => {
    // The first version of this test assumed 232's feed would serve any spent-out campaign. It does
    // not: record_ad_spend flips one to 'exhausted', and 232 already filters on status. The real gap
    // is narrower and entirely reachable — a merchant can set status back to 'active' from the
    // campaign PATCH route, which does not know or care that the budget is gone. 232's feed then
    // serves it and every event it produces is declined.
    assert.equal(remaining(CAMPAIGN_A), '0', 'A is spent out from the earlier test');
    psql(`UPDATE public.ad_campaigns SET status = 'active' WHERE id = ${sqlString(CAMPAIGN_A)}::uuid;`);

    applySqlFile(ROLLBACK);
    assert.match(feed() || '', new RegExp(CAMPAIGN_A), "232's feed serves it: status is active and that is all it checks");

    applySqlFile(MIGRATION);
    assert.ok(!new RegExp(CAMPAIGN_A).test(feed() || ''), '240 keeps it out on remaining budget, whatever the status says');

    applySqlFile(MIGRATION);
});

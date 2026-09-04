// Behavioural proof for migration 217 (phase MKT-0, docs/architecture/MARKETPLACE_CHANNEL_MODEL.md §6)
// against a real Postgres: real roles, real RLS, real SECURITY DEFINER semantics.
//
// What it proves, each on the repository's own DDL (sites and products are extracted from
// 000_baseline.sql, never hand-copied, so the fixture tracks the schema instead of a snapshot of it):
//   1. As app_tenant with the tenant GUC unset, both new tenant tables yield ZERO rows and ZERO mutations.
//   2. As app_tenant scoped to site A, site B's listing is invisible and a listing that points at site B's
//      product is rejected by the site-matches-product trigger.
//   3. marketplace_feed() — the one designed cross-tenant read — returns exactly the approved, public
//      marketplace listings of published sites with sellable products, across sites, and exactly the
//      documented column list; anon can execute it but cannot read channel_listings directly.
//   4. transition_channel_listing() is idempotent (same key twice → one change, one event, replayed=true),
//      enforces the edge matrix and the realm fence, and a direct UPDATE of status is refused.
//   5. The rollback restores the 216 state and 217 re-applies cleanly.
//
// Runs under `pnpm run test:behavioral` (the ephemeral Postgres helper starts the container). Name an
// isolated container via LETBUYY_EXECUTABLE_PG_CONTAINER when another session may hold the shared one.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const migrationsDir = join(repoRoot, 'database/supabase/migrations');
const rollbackDir = join(repoRoot, 'database/supabase/rollback');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const sharedDatabase = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';
// This suite owns a database of its own inside the shared container. `DROP SCHEMA public CASCADE` on
// the shared database needs one lock slot per object the earlier suites left behind, and after the
// full-baseline suites that exceeds max_locks_per_transaction ("out of shared memory" — observed in
// the aggregated test:behavioral run). DROP/CREATE DATABASE needs no per-object locks and leaves the
// other suites' state untouched. Roles are cluster-wide, so they are created if missing, never dropped.
const databaseName = `${sharedDatabase}_channel_listings`;

const MIGRATION = '217_marketplace_channel_listings.sql';
const ROLLBACK = '217_marketplace_channel_listings.rollback.sql';

const SITE_A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const SITE_B = 'bbbbbbbb-0000-4000-8000-00000000000b';
const SITE_C = 'cccccccc-0000-4000-8000-00000000000c'; // never published
const PRODUCT = {
    A1: 'aaaaaaaa-0000-4000-8000-000000000001',
    A2: 'aaaaaaaa-0000-4000-8000-000000000002',
    A3: 'aaaaaaaa-0000-4000-8000-000000000003',
    A4: 'aaaaaaaa-0000-4000-8000-000000000004', // inactive
    A5: 'aaaaaaaa-0000-4000-8000-000000000005', // draft listing, for the transition tests
    A6: 'aaaaaaaa-0000-4000-8000-000000000006', // second draft listing
    B1: 'bbbbbbbb-0000-4000-8000-000000000001',
    C1: 'cccccccc-0000-4000-8000-000000000001',
};
const LISTING = {
    A1: '11111111-0000-4000-8000-000000000001', // approved
    A2: '11111111-0000-4000-8000-000000000002', // rejected
    A3: '11111111-0000-4000-8000-000000000003', // paused
    A4: '11111111-0000-4000-8000-000000000004', // approved, product inactive
    A5: '11111111-0000-4000-8000-000000000005', // draft
    A6: '11111111-0000-4000-8000-000000000006', // draft
    B1: '11111111-0000-4000-8000-000000000011', // approved, other site
    C1: '11111111-0000-4000-8000-000000000021', // approved, unpublished site
};
const CATEGORY = '99999999-0000-4000-8000-000000000001';

const FEED_COLUMNS = [
    'listing_id', 'product_id', 'site_id', 'store_name', 'subdomain', 'name', 'slug', 'images', 'price',
    'compare_price', 'category_slug', 'approved_at',
];

const fileCache = new Map();
function fileText(dir, name) {
    const key = join(dir, name);
    if (!fileCache.has(key)) fileCache.set(key, readFileSync(key, 'utf8'));
    return fileCache.get(key);
}

function psqlIn(database, sql) {
    return execFileSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-qAt'],
        { input: `SET client_min_messages TO warning;\n${sql}`, encoding: 'utf8' },
    ).trim();
}

function psql(sql) {
    return psqlIn(databaseName, sql);
}

// Runs `sql` expecting Postgres to REJECT it, returning the error text; success is a failed assertion.
function psqlExpectError(sql, what) {
    try {
        psql(sql);
    } catch (error) {
        return `${error.stderr || ''}${error.stdout || ''}`;
    }
    assert.fail(`expected Postgres to reject ${what}, but it succeeded`);
}

function lastLine(output) {
    const lines = output.split('\n').map((l) => l.trim()).filter(Boolean);
    return lines.at(-1) || '';
}

// One statement starting at the line containing `anchor`, through the first line ending in ';'.
// Only for statements whose interior lines do not end in ';' (CREATE TABLE, ALTER ... ADD CONSTRAINT).
function extractStatement(sqlText, anchor, { withHeader = false } = {}) {
    const lines = sqlText.split('\n');
    const index = lines.findIndex((line) => line.includes(anchor));
    assert.ok(index >= 0, `could not find "${anchor}" in 000_baseline.sql — the schema changed shape; fix this fixture, do not delete the assertion`);
    const collected = [];
    for (let i = index; i < lines.length; i += 1) {
        collected.push(lines[i]);
        if (lines[i].trimEnd().endsWith(';')) break;
    }
    if (!withHeader) return collected.join('\n');
    let header = index - 1;
    while (header >= 0 && !lines[header].trim()) header -= 1;
    return `${lines[header]}\n${collected.join('\n')}`;
}

function sqlString(value) {
    return `'${String(value).replaceAll("'", "''")}'`;
}

// Returns the LAST output line: with a site scope the set_config() call prints the site id first.
function asTenant(siteId, sql) {
    const setSite = siteId ? `SELECT set_config('app.site_id', ${sqlString(siteId)}, true);` : '';
    return lastLine(psql(`BEGIN; SET LOCAL ROLE app_tenant; ${setSite} ${sql} COMMIT;`));
}

function asTenantExpectError(siteId, sql, what) {
    const setSite = siteId ? `SELECT set_config('app.site_id', ${sqlString(siteId)}, true);` : '';
    return psqlExpectError(`BEGIN; SET LOCAL ROLE app_tenant; ${setSite} ${sql} COMMIT;`, what);
}

function ensureContainer() {
    try {
        execFileSync('docker', ['exec', containerName, 'pg_isready', '-U', 'postgres', '-d', sharedDatabase], { stdio: 'pipe' });
    } catch {
        assert.fail(`Postgres container "${containerName}" is not running — start it with scripts/governance/foundation-ephemeral-postgres.mjs start (LETBUYY_EXECUTABLE_PG_CONTAINER names an isolated one)`);
    }
}

// The pre-217 world: roles as 164 leaves them (app_tenant NOBYPASSRLS with 164's default privileges),
// current_site_id() as 139 defines it, update_updated_at() as the baseline defines it, and the real
// sites/products tables with the tenant policies 163/164 give them. Then 217 from disk.
function resetDatabase() {
    const baseline = fileText(migrationsDir, '000_baseline.sql');
    const ddl = [
        extractStatement(baseline, 'CREATE TABLE public.sites ('),
        extractStatement(baseline, 'CREATE TABLE public.products ('),
        extractStatement(baseline, 'ADD CONSTRAINT sites_pkey PRIMARY KEY', { withHeader: true }),
        extractStatement(baseline, 'ADD CONSTRAINT products_pkey PRIMARY KEY', { withHeader: true }),
    ].join('\n');

    // A fresh database per run: no per-object locks, nothing inherited from the other suites.
    psqlIn('postgres', `
    DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE);
    CREATE DATABASE ${databaseName};
  `);

    psql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN CREATE ROLE app_tenant NOLOGIN NOBYPASSRLS; END IF;
    END
    $$;
    ALTER ROLE app_tenant NOBYPASSRLS;
    GRANT app_tenant TO service_role;
    GRANT USAGE ON SCHEMA public TO app_tenant, authenticated, anon, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_tenant;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_tenant;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE OR REPLACE FUNCTION public.current_site_id() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('app.site_id', true), '')::uuid;
    $$;
    CREATE OR REPLACE FUNCTION public.update_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$;

    ${ddl}

    ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.sites FORCE ROW LEVEL SECURITY;
    CREATE POLICY app_tenant_sites_guc ON public.sites FOR ALL TO app_tenant, authenticated
      USING (id = public.current_site_id()) WITH CHECK (id = public.current_site_id());
    ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.products FORCE ROW LEVEL SECURITY;
    CREATE POLICY products_tenant_site_guc ON public.products FOR ALL TO app_tenant, authenticated
      USING (COALESCE(site_id, store_id) = public.current_site_id())
      WITH CHECK (COALESCE(site_id, store_id) = public.current_site_id());
  `);

    psql(fileText(migrationsDir, MIGRATION));
}

function seed() {
    const site = (id, subdomain, storeName, status) =>
        `INSERT INTO public.sites (id, name, store_name, site_type, subdomain, status) VALUES (${sqlString(id)}, ${sqlString(storeName)}, ${sqlString(storeName)}, 'store', ${sqlString(subdomain)}, ${sqlString(status)});`;
    const product = (id, siteId, name, slug, price, isActive = true) =>
        `INSERT INTO public.products (id, site_id, store_id, name, slug, price, is_active, images) VALUES (${sqlString(id)}, ${sqlString(siteId)}, ${sqlString(siteId)}, ${sqlString(name)}, ${sqlString(slug)}, ${price}, ${isActive}, ARRAY['https://cdn.example/${slug}.jpg']);`;
    const listing = (id, siteId, productId, status, approvedAt = null, category = CATEGORY) =>
        `INSERT INTO public.channel_listings (id, site_id, product_id, channel, status, marketplace_category_id, approved_at) VALUES (${sqlString(id)}, ${sqlString(siteId)}, ${sqlString(productId)}, 'marketplace', ${sqlString(status)}, ${category ? sqlString(category) : 'NULL'}, ${approvedAt ? sqlString(approvedAt) : 'NULL'});`;

    psql(`
    INSERT INTO public.marketplace_categories (id, slug, name) VALUES (${sqlString(CATEGORY)}, 'gadgets', 'Gadgets');
    ${site(SITE_A, 'alpha', 'Alpha Store', 'published')}
    ${site(SITE_B, 'beta', 'Beta Store', 'published')}
    ${site(SITE_C, 'gamma', 'Gamma Store', 'draft')}
    ${product(PRODUCT.A1, SITE_A, 'Alpha One', 'alpha-one', 100)}
    ${product(PRODUCT.A2, SITE_A, 'Alpha Two', 'alpha-two', 200)}
    ${product(PRODUCT.A3, SITE_A, 'Alpha Three', 'alpha-three', 300)}
    ${product(PRODUCT.A4, SITE_A, 'Alpha Four', 'alpha-four', 400, false)}
    ${product(PRODUCT.A5, SITE_A, 'Alpha Five', 'alpha-five', 500)}
    ${product(PRODUCT.A6, SITE_A, 'Alpha Six', 'alpha-six', 600)}
    ${product(PRODUCT.B1, SITE_B, 'Beta One', 'beta-one', 110)}
    ${product(PRODUCT.C1, SITE_C, 'Gamma One', 'gamma-one', 120)}
    ${listing(LISTING.A1, SITE_A, PRODUCT.A1, 'approved', '2026-09-01T10:00:00Z')}
    ${listing(LISTING.A2, SITE_A, PRODUCT.A2, 'rejected')}
    ${listing(LISTING.A3, SITE_A, PRODUCT.A3, 'paused', '2026-08-01T10:00:00Z')}
    ${listing(LISTING.A4, SITE_A, PRODUCT.A4, 'approved', '2026-09-02T10:00:00Z')}
    ${listing(LISTING.A5, SITE_A, PRODUCT.A5, 'draft', null, null)}
    ${listing(LISTING.A6, SITE_A, PRODUCT.A6, 'draft')}
    ${listing(LISTING.B1, SITE_B, PRODUCT.B1, 'approved', '2026-09-03T10:00:00Z')}
    ${listing(LISTING.C1, SITE_C, PRODUCT.C1, 'approved', '2026-09-04T10:00:00Z')}
  `);
}

test.before(() => {
    ensureContainer();
    resetDatabase();
    seed();
});

test('1. app_tenant with the GUC unset sees zero rows and cannot mutate either tenant table', () => {
    assert.equal(asTenant(null, 'SELECT count(*) FROM public.channel_listings;'), '0');
    assert.equal(asTenant(null, 'SELECT count(*) FROM public.channel_listing_moderation_events;'), '0');
    assert.equal(asTenant(null, `UPDATE public.channel_listings SET visibility = 'hidden' RETURNING 1;`), '', 'UPDATE must affect zero rows');
    assert.equal(asTenant(null, `DELETE FROM public.channel_listings RETURNING 1;`), '', 'DELETE must affect zero rows');
    const err = asTenantExpectError(
        null,
        `INSERT INTO public.channel_listings (site_id, product_id, channel) VALUES (${sqlString(SITE_A)}, ${sqlString(PRODUCT.A5)}, 'storefront');`,
        'an INSERT with no tenant context',
    );
    // Two independent fences refuse this row: the BEFORE INSERT trigger cannot see the product under RLS
    // with no tenant context, and the policy's WITH CHECK would reject it next. Either message is a refusal.
    assert.match(err, /row-level security|must match the product's site/i);
    // Nothing leaked through: still 8 listings, still 0 events, as the superuser sees them.
    assert.equal(psql('SELECT count(*) FROM public.channel_listings;'), '8');
    assert.equal(psql('SELECT count(*) FROM public.channel_listing_moderation_events;'), '0');
});

test('2. app_tenant scoped to site A cannot see site B and cannot list site B\'s product', () => {
    assert.equal(asTenant(SITE_A, `SELECT count(*) FROM public.channel_listings WHERE site_id = ${sqlString(SITE_B)};`), '0');
    assert.equal(asTenant(SITE_A, 'SELECT count(*) FROM public.channel_listings;'), '6');
    const err = asTenantExpectError(
        SITE_A,
        `INSERT INTO public.channel_listings (site_id, product_id, channel) VALUES (${sqlString(SITE_A)}, ${sqlString(PRODUCT.B1)}, 'storefront');`,
        'a site-A listing pointing at site B\'s product',
    );
    assert.match(err, /must match the product's site/);
    // The same forged insert as the superuser (RLS bypassed) is still refused by the trigger.
    const err2 = psqlExpectError(
        `INSERT INTO public.channel_listings (site_id, product_id, channel) VALUES (${sqlString(SITE_A)}, ${sqlString(PRODUCT.B1)}, 'storefront');`,
        'a forged cross-site listing as superuser',
    );
    assert.match(err2, /must match the product's site/);
});

test('3. marketplace_feed returns exactly the approved public listings of published sites, across sites, with the documented columns; anon may execute it but not read the table', () => {
    const ids = psql(`SET ROLE anon; SELECT listing_id FROM public.marketplace_feed() ORDER BY approved_at DESC; RESET ROLE;`).split('\n').filter(Boolean);
    assert.deepEqual(ids, [LISTING.B1, LISTING.A1], 'B1 (other site) and A1 only: rejected, paused, inactive-product and unpublished-site rows are excluded');

    const columns = psql(`SELECT pg_get_function_result('public.marketplace_feed'::regproc);`);
    // "TABLE(listing_id uuid, ..., approved_at timestamp with time zone)" → first token of each column.
    const names = columns.replace(/^TABLE\(/, '').replace(/\)$/, '').split(', ').map((c) => c.trim().split(' ')[0]);
    assert.deepEqual(names, FEED_COLUMNS, 'the RETURNS TABLE must equal MARKETPLACE_CHANNEL_MODEL.md §5.2 exactly');

    const row = psql(`SELECT store_name || '|' || subdomain || '|' || name || '|' || slug || '|' || price::text FROM public.marketplace_feed() WHERE listing_id = ${sqlString(LISTING.B1)};`);
    assert.equal(row, 'Beta Store|beta|Beta One|beta-one|110.00');

    assert.equal(psql(`SELECT count(*) FROM public.marketplace_feed('gadgets');`), '2');
    assert.equal(psql(`SELECT count(*) FROM public.marketplace_feed('missing-category');`), '0');
    assert.equal(psql(`SELECT count(*) FROM public.marketplace_feed(NULL, 'beta');`), '1', 'search is a case-insensitive substring match on the product name');
    assert.equal(psql(`SELECT count(*) FROM public.marketplace_feed(NULL, '%');`), '0', 'wildcards in the search term are escaped, not interpreted');
    const page1 = psql(`SELECT listing_id FROM public.marketplace_feed(NULL, NULL, 1);`);
    assert.equal(page1, LISTING.B1);
    const page2 = psql(`SELECT listing_id FROM public.marketplace_feed(NULL, NULL, 1, '2026-09-03T10:00:00Z', ${sqlString(LISTING.B1)});`);
    assert.equal(page2, LISTING.A1, 'keyset pagination continues after (approved_at, id)');

    const err = psqlExpectError(`SET ROLE anon; SELECT count(*) FROM public.channel_listings;`, 'anon reading channel_listings directly');
    assert.match(err, /permission denied/);
    const err2 = psqlExpectError(`SET ROLE anon; SELECT public.transition_channel_listing(${sqlString(SITE_A)}, ${sqlString(LISTING.A5)}, 'pending_review', 'merchant', NULL, NULL, 'k');`, 'anon calling the transition RPC');
    assert.match(err2, /permission denied/);
});

test('4. transition_channel_listing is idempotent, realm-fenced, edge-checked, and the only status writer', () => {
    const call = (site, listing, to, realm, reason, key) =>
        `SELECT replayed::text || '|' || from_status || '|' || to_status FROM public.transition_channel_listing(${sqlString(site)}, ${sqlString(listing)}, ${sqlString(to)}, ${sqlString(realm)}, NULL, ${reason === null ? 'NULL' : sqlString(reason)}, ${sqlString(key)});`;

    // Merchant submit needs a marketplace category (A5 has none).
    const noCategory = asTenantExpectError(SITE_A, call(SITE_A, LISTING.A5, 'pending_review', 'merchant', null, 'k-a5-1'), 'submitting without a category');
    assert.match(noCategory, /marketplace_category_id/);
    psql(`UPDATE public.channel_listings SET marketplace_category_id = ${sqlString(CATEGORY)} WHERE id = ${sqlString(LISTING.A5)};`);

    // Merchant edges require the tenant GUC for that site: unset → refused; wrong site → refused.
    assert.match(asTenantExpectError(null, call(SITE_A, LISTING.A5, 'pending_review', 'merchant', null, 'k-a5-2'), 'a merchant edge with no tenant context'), /tenant context required/);
    assert.match(asTenantExpectError(SITE_B, call(SITE_A, LISTING.A5, 'pending_review', 'merchant', null, 'k-a5-3'), 'a merchant edge from another tenant\'s context'), /tenant context required/);

    // The real submit.
    assert.equal(lastLine(asTenant(SITE_A, call(SITE_A, LISTING.A5, 'pending_review', 'merchant', null, 'k-a5-submit'))), 'false|draft|pending_review');
    assert.equal(psql(`SELECT status || '|' || version::text || '|' || (submitted_at IS NOT NULL)::text FROM public.channel_listings WHERE id = ${sqlString(LISTING.A5)};`), 'pending_review|2|true');
    assert.equal(psql(`SELECT count(*) FROM public.channel_listing_moderation_events WHERE listing_id = ${sqlString(LISTING.A5)};`), '1');

    // A merchant may not approve (not a merchant edge), and app_tenant may never take an operator edge.
    assert.match(asTenantExpectError(SITE_A, call(SITE_A, LISTING.A5, 'approved', 'merchant', null, 'k-a5-bad'), 'a merchant approving'), /invalid_transition/);
    assert.match(asTenantExpectError(null, call(SITE_A, LISTING.A5, 'approved', 'operator', null, 'k-a5-bad2'), 'app_tenant taking an operator edge'), /not permitted from a tenant context/);
    assert.match(psqlExpectError(`SELECT set_config('app.site_id', ${sqlString(SITE_A)}, false); ${call(SITE_A, LISTING.A5, 'approved', 'operator', null, 'k-a5-bad3')}`, 'an operator edge inside a tenant context'), /not permitted from a tenant context/);
    psql(`SELECT set_config('app.site_id', '', false);`);

    // Operator reject needs a reason; approve does not.
    assert.match(psqlExpectError(call(SITE_A, LISTING.A5, 'rejected', 'operator', null, 'k-a5-rej'), 'an operator rejection without a reason'), /reason is required/);
    assert.equal(lastLine(psql(call(SITE_A, LISTING.A5, 'approved', 'operator', null, 'k-a5-approve'))), 'false|pending_review|approved');
    assert.equal(psql(`SELECT status || '|' || (approved_at IS NOT NULL)::text || '|' || (reviewed_at IS NOT NULL)::text FROM public.channel_listings WHERE id = ${sqlString(LISTING.A5)};`), 'approved|true|true');

    // Replay: same site + key → replayed=true, nothing changes, no second event.
    assert.equal(lastLine(psql(call(SITE_A, LISTING.A5, 'approved', 'operator', null, 'k-a5-approve'))), 'true|pending_review|approved');
    assert.equal(psql(`SELECT version::text FROM public.channel_listings WHERE id = ${sqlString(LISTING.A5)};`), '3');
    assert.equal(psql(`SELECT count(*) FROM public.channel_listing_moderation_events WHERE listing_id = ${sqlString(LISTING.A5)};`), '2');

    // The approved listing now appears in the feed; pausing it removes it; resuming brings it back.
    assert.equal(psql(`SELECT count(*) FROM public.marketplace_feed() WHERE listing_id = ${sqlString(LISTING.A5)};`), '1');
    assert.equal(lastLine(asTenant(SITE_A, call(SITE_A, LISTING.A5, 'paused', 'merchant', null, 'k-a5-pause'))), 'false|approved|paused');
    assert.equal(psql(`SELECT count(*) FROM public.marketplace_feed() WHERE listing_id = ${sqlString(LISTING.A5)};`), '0');
    assert.equal(lastLine(asTenant(SITE_A, call(SITE_A, LISTING.A5, 'approved', 'merchant', null, 'k-a5-resume'))), 'false|paused|approved');

    // An illegal edge writes nothing; a wrong-site listing id reads as not found (no existence oracle).
    assert.match(asTenantExpectError(SITE_A, call(SITE_A, LISTING.A6, 'approved', 'merchant', null, 'k-a6-bad'), 'draft → approved'), /invalid_transition/);
    assert.equal(psql(`SELECT count(*) FROM public.channel_listing_moderation_events WHERE listing_id = ${sqlString(LISTING.A6)};`), '0');
    assert.match(psqlExpectError(call(SITE_A, LISTING.B1, 'delisted', 'operator', 'takedown', 'k-b1-wrong-site'), 'a listing addressed through the wrong site'), /listing not found/);

    // Direct status writes are refused even for the superuser; the event log is append-only.
    assert.match(psqlExpectError(`UPDATE public.channel_listings SET status = 'delisted' WHERE id = ${sqlString(LISTING.A6)};`, 'a direct status UPDATE'), /only through transition_channel_listing/);
    assert.match(asTenantExpectError(SITE_A, `UPDATE public.channel_listing_moderation_events SET reason = 'x';`, 'updating the moderation log'), /permission denied/);
    assert.match(asTenantExpectError(SITE_A, `DELETE FROM public.channel_listing_moderation_events;`, 'deleting from the moderation log'), /permission denied/);
});

test('5. the rollback restores the 216 state and 217 re-applies cleanly', () => {
    const sitesBefore = psql('SELECT count(*) FROM public.sites;');
    const productsBefore = psql('SELECT count(*) FROM public.products;');
    psql(fileText(rollbackDir, ROLLBACK));
    for (const table of ['channel_listings', 'channel_listing_moderation_events', 'marketplace_categories']) {
        assert.equal(psql(`SELECT (to_regclass('public.${table}') IS NULL)::text;`), 'true', `${table} must be gone`);
    }
    for (const fn of ['public.marketplace_feed(text, text, integer, timestamp with time zone, uuid)', 'public.transition_channel_listing(uuid, uuid, text, text, uuid, text, text)', 'public.channel_listings_status_via_rpc()', 'public.channel_listings_site_matches_product()']) {
        assert.equal(psql(`SELECT (to_regprocedure(${sqlString(fn)}) IS NULL)::text;`), 'true', `${fn} must be gone`);
    }
    assert.equal(psql('SELECT count(*) FROM public.sites;'), sitesBefore);
    assert.equal(psql('SELECT count(*) FROM public.products;'), productsBefore);
    assert.equal(psql(`SELECT count(*) FROM pg_policies WHERE tablename = 'products';`), '1', 'products policies untouched by the round trip');

    psql(fileText(migrationsDir, MIGRATION));
    assert.equal(psql(`SELECT (to_regclass('public.channel_listings') IS NOT NULL)::text;`), 'true');
    assert.equal(psql(`SELECT count(*) FROM public.marketplace_feed();`), '0', 'a fresh 217 has no listings');
});

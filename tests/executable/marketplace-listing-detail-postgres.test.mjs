// MKT-2 — marketplace_listing_detail (migration 220) on real Postgres.
//
// The claim: a listing is readable by id if and only if it is publicly visible by exactly the same
// seven predicates marketplace_feed uses. The point of the function is that an operator's decision
// reaches the surface a shopper opens — before it existed, an app had to fall back to the merchant's
// own product route, which never reads channel_listings, so a rejected or taken-down listing still
// rendered from the marketplace.
//
// Each fence condition is probed on its own rather than in one combined assertion, so a failure says
// which predicate stopped working. The three status cases go through transition_channel_listing, the
// real moderation path, because 217's trigger refuses a direct UPDATE of channel_listings.status —
// a direct-update probe would only prove the trigger works, not that moderation reaches this read.
//
// DESTRUCTIVE: recreates its database and replays every migration. Refuses the shared container, and
// SKIPS with the exact command when no dedicated one is named rather than throwing at import.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { before } from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER;
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_mkt2_detail';
const SHARED_CONTAINER = 'letbuyy-executable-pg';
const runnable = Boolean(containerName) && containerName !== SHARED_CONTAINER;
const skip = runnable
    ? false
    : `needs a dedicated throwaway container (never ${SHARED_CONTAINER}); run: ` +
      'docker run -d --name letbuyy-mkt2-pg -e POSTGRES_PASSWORD=postgres postgres:16-alpine && ' +
      'LETBUYY_EXECUTABLE_PG_CONTAINER=letbuyy-mkt2-pg node --test tests/executable/marketplace-listing-detail-postgres.test.mjs';

const ROLLBACK = 'database/supabase/rollback/220_marketplace_listing_detail.rollback.sql';
const MIGRATION = 'database/supabase/migrations/220_marketplace_listing_detail.sql';

const SITE = '11111111-1111-4111-8111-111111111111';
const OTHER_SITE = '22222222-2222-4222-8222-222222222222';
const PRODUCT = '44444444-4444-4444-8444-444444444444';
const PENDING_PRODUCT = '55555555-5555-4555-8555-555555555555';
const LISTING = '99999999-9999-4999-8999-999999999999';
const PENDING_LISTING = '88888888-8888-4888-8888-888888888888';
const OPERATOR = 'cccccccc-0000-4000-8000-0000000000c1';

function psql(sql, targetDatabase = databaseName) {
    return execFileSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt'],
        { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    ).trim();
}

const sqlString = (v) => `'${String(v).replaceAll("'", "''")}'`;
const stripUnsupportedPg17Guc = (sql) => sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');
const applySqlFile = (relativePath) => psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, relativePath), 'utf8')));

// Runs `statement` inside a transaction, reads the detail, then rolls back — so each probe is
// independent and the fixture is never left mutated.
function visibleAfter(statement, listingId = LISTING) {
    const out = psql(`BEGIN;\n${statement};\nSELECT count(*) FROM public.marketplace_listing_detail(${sqlString(listingId)}::uuid);\nROLLBACK;`);
    return Number(out.trim().split('\n').pop());
}

const detailCount = (listingId = LISTING) =>
    Number(psql(`SELECT count(*) FROM public.marketplace_listing_detail(${sqlString(listingId)}::uuid);`));

function listMigrations() {
    return readdirSync(join(repoRoot, 'database/supabase/migrations'))
        .filter((n) => n.endsWith('.sql'))
        .sort((a, b) => {
            const na = parseInt(a.match(/^(\d+)/)?.[1] ?? '0', 10);
            const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? '0', 10);
            return na - nb || a.localeCompare(b);
        });
}

const BOOTSTRAP_SQL = `
CREATE SCHEMA IF NOT EXISTS public;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE SCHEMA extensions;
CREATE FUNCTION extensions.gen_random_bytes(integer) RETURNS bytea LANGUAGE sql AS $$ SELECT public.gen_random_bytes($1) $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text,
    raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULL::text $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT ALL ON auth.users TO service_role;
`;

function bootstrapDatabase() {
    psql(`DROP DATABASE IF EXISTS "${databaseName}"; CREATE DATABASE "${databaseName}";`, 'postgres');
    psql(BOOTSTRAP_SQL);
    for (const name of listMigrations()) {
        try {
            psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, 'database/supabase/migrations', name), 'utf8')));
        } catch (error) {
            throw new Error(`migration ${name} failed to apply: ${error.message}`);
        }
    }
}

function seedFixtures() {
    psql(`
    INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published, status)
    VALUES (${sqlString(SITE)}::uuid, 'MKT2', 'MKT2 Store', 'store', 'mkt2-store', true, 'published'),
           (${sqlString(OTHER_SITE)}::uuid, 'Other', 'Other Store', 'store', 'other-store', true, 'published');

    -- cost_price, sku and barcode are populated deliberately: SEC-1's rule is that a public read must
    -- not return them, and a fixture that leaves them null cannot prove it (that is exactly how the
    -- storefront's own leak survived seven passing tests).
    INSERT INTO public.products (id, store_id, site_id, name, slug, description, price, is_active, status, cost_price, sku, barcode)
    VALUES (${sqlString(PRODUCT)}::uuid, ${sqlString(SITE)}::uuid, ${sqlString(SITE)}::uuid, 'Listed Item', 'listed-item', 'A description.', 799, true, 'active', 400, 'SKU-1', 'BC-1'),
           (${sqlString(PENDING_PRODUCT)}::uuid, ${sqlString(SITE)}::uuid, ${sqlString(SITE)}::uuid, 'Pending Item', 'pending-item', 'Awaiting review.', 500, true, 'active', 250, 'SKU-2', 'BC-2');

    INSERT INTO public.channel_listings (id, site_id, product_id, channel, status, visibility, approved_at)
    VALUES (${sqlString(LISTING)}::uuid, ${sqlString(SITE)}::uuid, ${sqlString(PRODUCT)}::uuid, 'marketplace', 'approved', 'public', now());

    INSERT INTO public.channel_listings (id, site_id, product_id, channel, status, visibility)
    VALUES (${sqlString(PENDING_LISTING)}::uuid, ${sqlString(SITE)}::uuid, ${sqlString(PENDING_PRODUCT)}::uuid, 'marketplace', 'pending_review', 'public');
  `);
}

before(() => {
    if (!runnable) return;
    bootstrapDatabase();
    seedFixtures();
});

test('an approved, public listing on a published site is readable by id, with the store attached', { skip }, () => {
    assert.equal(detailCount(), 1);
    const row = psql(`SELECT name || '|' || store_name || '|' || subdomain || '|' || description
                        FROM public.marketplace_listing_detail(${sqlString(LISTING)}::uuid);`);
    assert.equal(row, 'Listed Item|MKT2 Store|mkt2-store|A description.', 'the detail carries what a product page needs, including its merchant');
    assert.equal(Number(psql(`SELECT count(*) FROM public.marketplace_listing_detail('00000000-0000-4000-8000-000000000000'::uuid);`)), 0, 'an unknown id returns no row, not an error');
});

test('the response carries no cost price, SKU or barcode (SEC-1\'s rule for any public product read)', { skip }, () => {
    const shape = psql(`SELECT pg_get_function_result(oid) FROM pg_proc WHERE proname = 'marketplace_listing_detail';`);
    for (const column of ['cost_price', 'cost_per_item', 'sku', 'barcode']) {
        assert.ok(!shape.includes(column), `${column} must not be in the return shape`);
    }
    // And no value leaks under another name: the fixture's cost, sku and barcode are distinctive.
    const serialized = psql(`SELECT COALESCE(string_agg(t::text, '|'), '') FROM public.marketplace_listing_detail(${sqlString(LISTING)}::uuid) t;`);
    for (const value of ['400', 'SKU-1', 'BC-1']) {
        assert.ok(!serialized.includes(value), `the ${value} value must not appear in the row`);
    }
});

test('each fence predicate, flipped on its own, makes the listing unreadable', { skip }, () => {
    // Everything except status, which the trigger reserves for the moderation RPC (next test).
    const probes = [
        ['channel is not marketplace', `UPDATE public.channel_listings SET channel = 'storefront' WHERE id = ${sqlString(LISTING)}::uuid`],
        ['visibility is hidden', `UPDATE public.channel_listings SET visibility = 'hidden' WHERE id = ${sqlString(LISTING)}::uuid`],
        ['product is inactive', `UPDATE public.products SET is_active = false WHERE id = ${sqlString(PRODUCT)}::uuid`],
        ['product is soft-deleted', `UPDATE public.products SET deleted_at = now() WHERE id = ${sqlString(PRODUCT)}::uuid`],
        ['site is unpublished', `UPDATE public.sites SET status = 'draft' WHERE id = ${sqlString(SITE)}::uuid`],
        ['site is soft-deleted', `UPDATE public.sites SET deleted_at = now() WHERE id = ${sqlString(SITE)}::uuid`],
    ];
    for (const [label, statement] of probes) {
        assert.equal(visibleAfter(statement), 0, `${label}: the listing must become unreadable`);
    }
    // The fixture is untouched by the probes above, so the listing is still readable.
    assert.equal(detailCount(), 1, 'each probe rolls back — no false negative from a mutated fixture');
});

test('an operator decision reaches this read: pending, rejected and taken-down listings are all unreadable', { skip }, () => {
    // The whole reason 220 exists. Direct status UPDATEs are refused by 217's trigger, so these go
    // through transition_channel_listing exactly as ADM-1's operator routes do.
    assert.equal(detailCount(PENDING_LISTING), 0, 'a listing awaiting review must not be publicly readable');

    const reject = `SELECT 1 FROM public.transition_channel_listing(${sqlString(SITE)}::uuid, ${sqlString(PENDING_LISTING)}::uuid, 'rejected', 'operator', ${sqlString(OPERATOR)}::uuid, 'Counterfeit brand mark in the images.', 'probe-reject')`;
    assert.equal(visibleAfter(reject, PENDING_LISTING), 0, 'a rejected listing must not be publicly readable');

    const takeDown = `SELECT 1 FROM public.transition_channel_listing(${sqlString(SITE)}::uuid, ${sqlString(LISTING)}::uuid, 'delisted', 'operator', ${sqlString(OPERATOR)}::uuid, 'Regulatory takedown request received.', 'probe-takedown')`;
    assert.equal(visibleAfter(takeDown, LISTING), 0, 'a taken-down listing must not be publicly readable — this is the gap 220 closes');
});

test('the rollback drops only this function and round-trips, leaving marketplace_feed intact', { skip }, () => {
    applySqlFile(ROLLBACK);
    assert.equal(psql("SELECT (to_regprocedure('public.marketplace_listing_detail(uuid)') IS NOT NULL)::text;"), 'false', 'the detail function is dropped');
    assert.equal(
        psql("SELECT (to_regprocedure('public.marketplace_feed(text,text,integer,timestamp with time zone,uuid)') IS NOT NULL)::text;"),
        'true',
        'marketplace_feed must be untouched by this rollback',
    );
    applySqlFile(MIGRATION);
    assert.equal(detailCount(), 1, 're-applying restores the read');
});

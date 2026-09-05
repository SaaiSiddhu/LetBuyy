// MIG-0 — the migration actor realm (D-MIG-REALM), proven on real Postgres.
//
// A bulk import cannot record what it did as either a merchant (it acts on nobody's behalf) or an
// operator (no human reviewed it) without writing a false record. Migration 221 adds a third realm
// with exactly one edge: draft -> approved. This file measures every claim the migration's header
// makes, rather than assuming the SQL does what it says:
//   * the edge works, stamps approved_at, and writes an honest moderation event;
//   * every OTHER edge for this realm is refused — a migration import gets exactly one door;
//   * a reason is mandatory, so provenance is written down, not inferred;
//   * the tenant-context fence, inherited from operator's branch with zero new code, actually holds;
//   * the category/sellability gate — the only checkpoint before an imported listing is visible,
//     since migration skips pending_review — is not weaker than the one a normal submission passes;
//   * reviewed_at/reviewed_by stay NULL: nobody reviewed this, and the record must not pretend they did;
//   * a replay is idempotent;
//   * the merchant and operator paths are unaffected by any of the above;
//   * the rollback restores the two-realm world exactly, and refuses to do so over an existing
//     migration-realm event rather than silently orphaning it.
//
// DESTRUCTIVE: recreates its database and replays every migration. Refuses the shared database, and
// SKIPS with the exact command when no dedicated one is named rather than throwing at import.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_mig0_realm';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable
    ? false
    : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
      'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

const MIGRATION = 'database/supabase/migrations/221_channel_listing_migration_realm.sql';
const ROLLBACK = 'database/supabase/rollback/221_channel_listing_migration_realm.rollback.sql';

const SITE = '11111111-1111-4111-8111-111111111111';
const CATEGORY = 'cccccccc-0000-4000-8000-0000000000c1';
const OPERATOR = 'a0000000-0000-4000-8000-00000000000a';

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
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_tenant') THEN CREATE ROLE app_tenant NOLOGIN; END IF;
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
    VALUES (${sqlString(SITE)}::uuid, 'MIG-0 Store', 'MIG-0 Store', 'store', 'mig0-store', true, 'published');
    INSERT INTO public.marketplace_categories (id, slug, name)
    VALUES (${sqlString(CATEGORY)}::uuid, 'gadgets', 'Gadgets');
  `);
}

let productSeq = 0;
function draftListing({ active = true, category = CATEGORY } = {}) {
    productSeq += 1;
    const seq = String(productSeq).padStart(2, '0');
    const productId = `40000000-0000-4000-8000-0000000000${seq}`;
    const listingId = `50000000-0000-4000-8000-0000000000${seq}`;
    psql(`
    INSERT INTO public.products (id, store_id, site_id, name, slug, price, is_active, status)
    VALUES (${sqlString(productId)}::uuid, ${sqlString(SITE)}::uuid, ${sqlString(SITE)}::uuid, 'Item ${seq}', 'item-${seq}', 500, ${active}, 'active');
    INSERT INTO public.channel_listings (id, site_id, product_id, channel, status, visibility, marketplace_category_id)
    VALUES (${sqlString(listingId)}::uuid, ${sqlString(SITE)}::uuid, ${sqlString(productId)}::uuid, 'marketplace', 'draft', 'public', ${category ? `${sqlString(category)}::uuid` : 'NULL'});
  `);
    return { productId, listingId };
}

const migrate = (listingId, key, reason = 'Migrated from Firebase product fs-test') =>
    psql(`SELECT to_status FROM public.transition_channel_listing(${sqlString(SITE)}::uuid, ${sqlString(listingId)}::uuid, 'approved', 'migration', NULL, ${reason === null ? 'NULL' : sqlString(reason)}, ${sqlString(key)});`);

before(() => {
    if (!runnable) return;
    bootstrapDatabase();
    seedFixtures();
});

after(() => {
    if (!runnable) return;
    try {
        psql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`, 'postgres');
    } catch {
        // A cleanup failure must not fail an otherwise passing suite.
    }
});

test('a migration transition approves the listing, stamps approved_at, and writes an honest event', { skip }, () => {
    const { listingId } = draftListing();
    const result = migrate(listingId, 'mig-key-1');
    assert.equal(result, 'approved');

    const row = psql(`SELECT approved_at IS NOT NULL, reviewed_at IS NULL, reviewed_by IS NULL FROM public.channel_listings WHERE id = ${sqlString(listingId)}::uuid;`);
    assert.deepEqual(row.split('|'), ['t', 't', 't'], 'approved_at must be set; reviewed_at/reviewed_by must stay NULL — nobody reviewed this');

    const event = psql(`SELECT actor_realm || '|' || reason FROM public.channel_listing_moderation_events WHERE listing_id = ${sqlString(listingId)}::uuid;`);
    assert.equal(event, 'migration|Migrated from Firebase product fs-test');
});

test('every edge except draft -> approved is refused for the migration realm', { skip }, () => {
    for (const to of ['pending_review', 'rejected', 'paused', 'delisted']) {
        const { listingId } = draftListing();
        const error = psqlExpectingFailure(
            `SELECT public.transition_channel_listing(${sqlString(SITE)}::uuid, ${sqlString(listingId)}::uuid, ${sqlString(to)}, 'migration', NULL, 'reason text here', 'mig-edge-${to}');`,
        );
        assert.ok(error && /invalid_transition/.test(error), `draft -> ${to} must be refused for migration`);
    }
    // And once approved, no further migration-driven move is allowed either.
    const { listingId } = draftListing();
    migrate(listingId, 'mig-approve-then-delist');
    const error = psqlExpectingFailure(
        `SELECT public.transition_channel_listing(${sqlString(SITE)}::uuid, ${sqlString(listingId)}::uuid, 'delisted', 'migration', NULL, 'reason', 'mig-then-delist');`,
    );
    assert.ok(error && /invalid_transition/.test(error), 'approved -> delisted must be refused for migration — take-down is an operator edge');
});

test('a migration transition without a reason is refused', { skip }, () => {
    const { listingId } = draftListing();
    const error = psqlExpectingFailure(
        `SELECT public.transition_channel_listing(${sqlString(SITE)}::uuid, ${sqlString(listingId)}::uuid, 'approved', 'migration', NULL, NULL, 'mig-noreason');`,
    );
    assert.ok(error && /reason is required for migration/.test(error));
});

test('a migration transition is refused from a tenant context, exactly like an operator one', { skip }, () => {
    const { listingId } = draftListing();
    const error = psqlExpectingFailure(`
    BEGIN;
    SELECT set_config('app.site_id', ${sqlString(SITE)}, true);
    SET LOCAL ROLE app_tenant;
    SELECT public.transition_channel_listing(${sqlString(SITE)}::uuid, ${sqlString(listingId)}::uuid, 'approved', 'migration', NULL, 'reason', 'mig-fence');
    ROLLBACK;
  `);
    assert.ok(error && /operator transitions are not permitted from a tenant context/.test(error), 'migration inherits the same fence, with no fence code of its own');
});

test('a migration approval passes the same category and sellability gate pending_review enforces', { skip }, () => {
    const { listingId: noCategory } = draftListing({ category: null });
    const noCategoryError = psqlExpectingFailure(
        `SELECT public.transition_channel_listing(${sqlString(SITE)}::uuid, ${sqlString(noCategory)}::uuid, 'approved', 'migration', NULL, 'reason', 'mig-nocat');`,
    );
    assert.ok(noCategoryError && /marketplace_category_id/.test(noCategoryError), 'a migration approval with no category must be refused, exactly as pending_review requires one');

    const { listingId: inactive } = draftListing({ active: false });
    const inactiveError = psqlExpectingFailure(
        `SELECT public.transition_channel_listing(${sqlString(SITE)}::uuid, ${sqlString(inactive)}::uuid, 'approved', 'migration', NULL, 'reason', 'mig-inactive');`,
    );
    assert.ok(inactiveError && /product is not sellable/.test(inactiveError), 'an inactive product must be refused for migration too');
});

test('replaying the same idempotency key returns the same event, not a second one', { skip }, () => {
    const { listingId } = draftListing();
    const first = psql(`SELECT event_id FROM public.transition_channel_listing(${sqlString(SITE)}::uuid, ${sqlString(listingId)}::uuid, 'approved', 'migration', NULL, 'reason', 'mig-replay');`);
    const second = psql(`SELECT event_id FROM public.transition_channel_listing(${sqlString(SITE)}::uuid, ${sqlString(listingId)}::uuid, 'approved', 'migration', NULL, 'reason', 'mig-replay');`);
    assert.equal(second, first);
    assert.equal(psql(`SELECT count(*) FROM public.channel_listing_moderation_events WHERE listing_id = ${sqlString(listingId)}::uuid;`), '1');
});

test('the merchant and operator paths are unaffected', { skip }, () => {
    // Merchant: draft -> pending_review still works and migration's addition changed nothing about it.
    const { listingId: merchantListing } = draftListing();
    psql(`
    BEGIN;
    SELECT set_config('app.site_id', ${sqlString(SITE)}, true);
    SET LOCAL ROLE app_tenant;
    SELECT public.transition_channel_listing(${sqlString(SITE)}::uuid, ${sqlString(merchantListing)}::uuid, 'pending_review', 'merchant', NULL, NULL, 'mig-merchant-1');
    COMMIT;
  `);
    const merchantStatus = psql(`SELECT status FROM public.channel_listings WHERE id = ${sqlString(merchantListing)}::uuid;`);
    assert.equal(merchantStatus, 'pending_review');

    // Operator: pending_review -> approved still works and still stamps reviewed_at/reviewed_by, which
    // migration deliberately does not.
    const result = psql(`SELECT to_status FROM public.transition_channel_listing(${sqlString(SITE)}::uuid, ${sqlString(merchantListing)}::uuid, 'approved', 'operator', ${sqlString(OPERATOR)}::uuid, NULL, 'mig-operator-1');`);
    assert.equal(result, 'approved');
    const operatorRow = psql(`SELECT reviewed_at IS NOT NULL, reviewed_by::text FROM public.channel_listings WHERE id = ${sqlString(merchantListing)}::uuid;`);
    assert.equal(operatorRow, `t|${OPERATOR}`, 'an operator approval must still stamp reviewed_at/reviewed_by — only migration skips that');
});

test('the rollback restores the two-realm world exactly, and refuses over existing migration data', { skip }, () => {
    // Refuses over existing data: a defect class of its own if it silently succeeded and orphaned rows.
    const { listingId } = draftListing();
    migrate(listingId, 'mig-before-rollback');
    const blocked = psqlExpectingFailure(readFileSync(join(repoRoot, ROLLBACK), 'utf8'));
    assert.ok(blocked && /violated by some row/.test(blocked), 'the rollback must refuse to run over an existing migration-realm event rather than orphaning it');

    // Clean round trip, on a fresh database with no such data.
    const cleanDb = `${databaseName}_rollback`;
    psql(`DROP DATABASE IF EXISTS "${cleanDb}"; CREATE DATABASE "${cleanDb}";`, 'postgres');
    psql(BOOTSTRAP_SQL, cleanDb);
    for (const name of listMigrations()) {
        psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, 'database/supabase/migrations', name), 'utf8')), cleanDb);
    }
    psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, ROLLBACK), 'utf8')), cleanDb);
    assert.equal(
        psql("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'channel_listing_moderation_events_actor_realm_check';", cleanDb),
        "CHECK ((actor_realm = ANY (ARRAY['merchant'::text, 'operator'::text])))",
    );
    const refusedOnCleanDb = (() => {
        try {
            psql(`SELECT public.transition_channel_listing('00000000-0000-4000-8000-000000000000'::uuid, '00000000-0000-4000-8000-000000000000'::uuid, 'approved', 'migration', NULL, 'r', 'k');`, cleanDb);
            return null;
        } catch (error) {
            return `${error.stderr || ''}${error.stdout || ''}`;
        }
    })();
    assert.ok(refusedOnCleanDb && /unsupported actor_realm/.test(refusedOnCleanDb));
    psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, MIGRATION), 'utf8')), cleanDb);
    assert.equal(
        psql("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'channel_listing_moderation_events_actor_realm_check';", cleanDb),
        "CHECK ((actor_realm = ANY (ARRAY['merchant'::text, 'operator'::text, 'migration'::text])))",
        're-apply must be clean',
    );
    psql(`DROP DATABASE IF EXISTS "${cleanDb}" WITH (FORCE);`, 'postgres');
});

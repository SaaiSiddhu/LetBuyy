// The migration actor realm is RETIRED — migration 222, owner decision D-14, proven on real Postgres.
//
// WHAT THIS FILE USED TO BE, AND WHY IT CHANGED. It proved migration 221's addition of a third
// 'migration' actor realm to transition_channel_listing, for a bulk Firestore import. The owner
// cancelled that import the same day ("its test data, delete firebase completely"), and migration
// 222 retired the realm on 2026-09-05 — but the commit that shipped 222 never touched this file, so
// it went on asserting a capability the owner had ordered removed. It failed 7 of 8 tests on develop
// from that day until 2026-09-06, and nobody saw it, because no gate lane runs tests/executable
// (CAP-C66). The suite was not deleted: 222 had no test of its own, so the stale red is now the
// regression guard for the decision that made it stale.
//
// WHAT IS PROVEN HERE
//   * at head the realm is refused, and the moderation-event CHECK no longer admits it;
//   * merchant and operator paths are untouched — retiring a realm must not narrow the other two;
//   * 222 is what does the work: apply its rollback, watch 221's realm come back and function, then
//     re-apply 222 and watch it close again;
//   * 222 refuses to run over an existing migration-realm event with a readable message instead of
//     letting a restored CHECK constraint fail with a violation nobody can act on. That is the one
//     thing a forward migration must handle which 221's paired rollback could assume away, it is the
//     reason 222 exists as a migration rather than a deletion of 221, and until now nothing tested it.
//
// DESTRUCTIVE: recreates its database and replays through migration 222. Later Phase 6 migrations
// add a narrowly scoped `system` audit realm for automatic re-review invalidation; that later policy
// must not rewrite this historical 221/222 regression test. Refuses the shared database, and
// SKIPS with the exact command when no dedicated one is named rather than throwing at import.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_mig0_realm';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable
    ? false
    : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
      'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

// 222 is the subject now; its rollback re-applies 221, which is what makes the control below real.
const MIGRATION = 'database/supabase/migrations/222_retire_migration_actor_realm.sql';
const ROLLBACK = 'database/supabase/rollback/222_retire_migration_actor_realm.rollback.sql';
const TWO_REALM_CHECK = "CHECK ((actor_realm = ANY (ARRAY['merchant'::text, 'operator'::text])))";
const THREE_REALM_CHECK = "CHECK ((actor_realm = ANY (ARRAY['merchant'::text, 'operator'::text, 'migration'::text])))";

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

// The bootstrap lives in the shared, Supabase-faithful module (F-HARNESS-1/F-HARNESS-2): pgcrypto in
// `extensions` rather than `public`, Supabase's own ALTER DEFAULT PRIVILEGES, and role attributes
// stated rather than inherited from whichever suite created them first. This suite replays every
// migration, which is exactly the case where that fidelity decides whether a result means anything.
const BOOTSTRAP_SQL = SUPABASE_FAITHFUL_BOOTSTRAP_SQL;

function bootstrapDatabase() {
    psql(`DROP DATABASE IF EXISTS "${databaseName}"; CREATE DATABASE "${databaseName}";`, 'postgres');
    psql(BOOTSTRAP_SQL);
    for (const name of listMigrations().filter((name) => Number(name.match(/^\d+/)?.[0] ?? 0) <= 222)) {
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

test('at head the migration realm is refused — the D-14 guarantee', { skip }, () => {
    const { listingId } = draftListing();
    const refused = psqlExpectingFailure(
        `SELECT to_status FROM public.transition_channel_listing(${sqlString(SITE)}::uuid, ${sqlString(listingId)}::uuid, 'approved', 'migration', NULL, 'r', 'k-head');`);
    assert.ok(refused, 'the migration realm must not be usable');
    assert.match(refused, /unsupported actor_realm: migration/);

    // And the listing is untouched: a refused transition must not half-apply.
    assert.equal(psql(`SELECT status FROM public.channel_listings WHERE id = ${sqlString(listingId)}::uuid;`), 'draft');
});

test('the moderation-event CHECK no longer admits the migration realm', { skip }, () => {
    // The RPC refusing is one layer; the constraint is the one that holds if a future writer bypasses
    // the RPC. 222 restores the two-realm CHECK, so assert the constraint itself, not just the RPC.
    assert.equal(psql("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'channel_listing_moderation_events_actor_realm_check';"), TWO_REALM_CHECK);
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

test('CONTROL: 222 is what retires the realm — its rollback brings it back, and re-applying closes it', { skip }, () => {
    // Without this, "the realm is refused" could be true for some unrelated reason and 222 would be
    // doing nothing. Apply 222's rollback (which re-applies 221) and the realm must work again.
    applySqlFile(ROLLBACK);
    assert.equal(psql("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'channel_listing_moderation_events_actor_realm_check';"), THREE_REALM_CHECK, "222's rollback must restore 221's three-realm CHECK");

    const { listingId } = draftListing();
    assert.equal(migrate(listingId, 'mig-control-1'), 'approved', 'with 221 back, the migration edge must work');
    assert.equal(
        psql(`SELECT approved_at IS NOT NULL, reviewed_at IS NULL, reviewed_by IS NULL FROM public.channel_listings WHERE id = ${sqlString(listingId)}::uuid;`),
        't|t|t',
        'and must still stamp approved_at while leaving the review fields NULL — nobody reviewed this',
    );

    // Now the state 222 has to cope with in the real world: a migration-realm event already exists.
    const blocked = psqlExpectingFailure(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, MIGRATION), 'utf8')));
    assert.ok(blocked, '222 must refuse to run while a migration-realm event exists');
    assert.doesNotMatch(
        blocked,
        /violates check constraint/,
        'it must fail with its own readable message, not with a raw constraint violation nobody can act on',
    );
    assert.equal(psql("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'channel_listing_moderation_events_actor_realm_check';"), THREE_REALM_CHECK, 'a refused migration must leave the schema as it was');

    // Remove the event and 222 applies, closing the realm again. That is the round trip.
    psql("DELETE FROM public.channel_listing_moderation_events WHERE actor_realm = 'migration';");
    applySqlFile(MIGRATION);
    assert.equal(psql("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'channel_listing_moderation_events_actor_realm_check';"), TWO_REALM_CHECK);
    const after = psqlExpectingFailure(
        `SELECT public.transition_channel_listing(${sqlString(SITE)}::uuid, ${sqlString(listingId)}::uuid, 'approved', 'migration', NULL, 'r', 'k-after');`);
    assert.ok(after && /unsupported actor_realm: migration/.test(after), 're-applying 222 must close the realm again');
});
